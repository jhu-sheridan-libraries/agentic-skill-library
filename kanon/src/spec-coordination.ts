/**
 * Multi-agent coordination for Kiro Specs.
 *
 * Kiro Specs (`.kiro/specs/<name>/`) hold three markdown files plus a
 * Kiro-managed `.config.kiro` sidecar. Kiro only understands the standard
 * `- [ ]` / `- [x]` checkbox markers in `tasks.md`, so coordination state for
 * multiple agents working the same spec (who owns a task, whether it is
 * claimed, handoff notes) lives in a separate `COORDINATION.md` sidecar that
 * Kiro leaves untouched. `tasks.md` checkboxes remain the shared source of
 * truth for *completion*; `COORDINATION.md` layers *ownership* on top.
 *
 * The spec's folder NAME is the identity key — `.config.kiro` `specId` values
 * are not unique (copied/branched specs reuse them), so never key coordination
 * on `specId`.
 *
 * This module is deliberately pure where it can be: parse/serialize/mutate are
 * side-effect-free string functions; only the `*Command` actions and the small
 * read/write helpers touch the filesystem.
 */

import { exists, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";

export const COORDINATION_FILENAME = "COORDINATION.md";
export const TASKS_FILENAME = "tasks.md";
export const CONFIG_FILENAME = ".config.kiro";

/** Lifecycle of a task from a coordination standpoint. */
export type TaskCoordStatus =
	| "open"
	| "claimed"
	| "in-progress"
	| "done"
	| "blocked";

export const TASK_COORD_STATUSES: readonly TaskCoordStatus[] = [
	"open",
	"claimed",
	"in-progress",
	"done",
	"blocked",
] as const;

/** One row of the coordination table: ownership of a single task id. */
export interface ClaimEntry {
	/** Task id as it appears in tasks.md, e.g. "2.1". */
	taskId: string;
	/** Agent name that owns the task, or null when unowned. */
	owner: string | null;
	status: TaskCoordStatus;
	/** ISO-8601 timestamp of the last change, or null. */
	updated: string | null;
	/**
	 * Task ids this task depends on. It is not claimable until every dep is
	 * `done`. Parsed from the Deps column and/or `_Depends: 1, 2.3_` in tasks.md.
	 */
	deps: string[];
	/**
	 * ISO-8601 timestamp until which the current owner's active claim is
	 * considered live. Past this, the claim is stale and may be reclaimed.
	 * Null when there is no active lease (unowned or terminal status).
	 */
	leaseUntil: string | null;
	/** Optional free-text note (kept short; escaped for table cells). */
	note?: string;
}

/** Default lease duration, in minutes, for a fresh claim. */
export const DEFAULT_LEASE_MINUTES = 30;

/** A dated handoff line: one agent passing context to the next. */
export interface HandoffEntry {
	/** ISO-8601 timestamp or date. */
	when: string;
	from: string;
	to: string;
	message: string;
}

/** Parsed representation of a COORDINATION.md file. */
export interface CoordinationDoc {
	spec: string;
	claims: ClaimEntry[];
	handoffs: HandoffEntry[];
}

/** A checkbox task parsed from tasks.md. */
export interface TaskLine {
	id: string;
	checked: boolean;
	text: string;
	/**
	 * Dependency task ids declared in tasks.md via a `_Depends: 1, 2.3_` marker
	 * on the task or one of its indented sub-lines (mirrors `_Requirements:_`).
	 */
	deps: string[];
}

// --- .config.kiro -----------------------------------------------------------

export interface SpecConfig {
	specId?: string;
	workflowType?: string;
	specType?: string;
	[key: string]: unknown;
}

/** Parse a `.config.kiro` JSON sidecar; tolerant of missing/invalid input. */
export function parseSpecConfig(raw: string): SpecConfig {
	try {
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object" ? (parsed as SpecConfig) : {};
	} catch {
		return {};
	}
}

/** Generate a spec config with a real UUID v4 (never a fabricated string). */
export function makeSpecConfig(opts: {
	workflowType?: string;
	specType?: string;
}): SpecConfig {
	return {
		specId: crypto.randomUUID(),
		workflowType: opts.workflowType ?? "requirements-first",
		specType: opts.specType ?? "feature",
	};
}

// --- tasks.md checkboxes ----------------------------------------------------

// Matches lines like "- [ ] 2.1 Do the thing" or "  - [x] 3 Wire it up".
// Capture groups: 1=indent, 2=marker, 3=id, 4=trailing text.
const TASK_LINE_RE = /^(\s*)-\s\[( |x|X)\]\s+([0-9]+(?:\.[0-9]+)*)\.?\s+(.*)$/;

// Matches a `_Depends: 1, 2.3_` marker anywhere on a line (task or sub-line).
const DEPENDS_RE = /_Depends:\s*([0-9., ]+?)_/i;

function parseDepIds(s: string): string[] {
	return s
		.split(",")
		.map((x) => x.trim())
		.filter((x) => /^[0-9]+(?:\.[0-9]+)*$/.test(x));
}

/**
 * Extract all checkbox tasks (with ids) from a tasks.md body. Dependency
 * markers (`_Depends: …_`) on a task line or its indented sub-lines are
 * attached to the most recent task.
 */
export function parseTaskLines(tasksMd: string): TaskLine[] {
	const out: TaskLine[] = [];
	let current: TaskLine | null = null;
	for (const line of tasksMd.split("\n")) {
		const m = line.match(TASK_LINE_RE);
		if (m) {
			const depsOnLine = line.match(DEPENDS_RE);
			current = {
				id: m[3],
				checked: m[2].toLowerCase() === "x",
				text: m[4].trim(),
				deps: depsOnLine ? parseDepIds(depsOnLine[1]) : [],
			};
			out.push(current);
			continue;
		}
		// Non-task line: may carry a _Depends:_ marker for the current task.
		if (current) {
			const dep = line.match(DEPENDS_RE);
			if (dep) {
				for (const id of parseDepIds(dep[1])) {
					if (!current.deps.includes(id)) current.deps.push(id);
				}
			}
		}
	}
	return out;
}

/**
 * Toggle a single task's checkbox in tasks.md by id, returning the new body.
 * Only the `[ ]`/`[x]` marker changes; all other text is preserved verbatim.
 * Throws if the task id is not found.
 */
export function setTaskChecked(
	tasksMd: string,
	taskId: string,
	checked: boolean,
): string {
	let found = false;
	const lines = tasksMd.split("\n").map((line) => {
		const m = line.match(TASK_LINE_RE);
		if (!m || m[3] !== taskId) return line;
		found = true;
		const marker = checked ? "x" : " ";
		// Rebuild only the marker; keep original indentation and trailing text.
		return line.replace(/^(\s*-\s\[)( |x|X)(\])/, `$1${marker}$3`);
	});
	if (!found) {
		throw new Error(`Task "${taskId}" not found in ${TASKS_FILENAME}`);
	}
	return lines.join("\n");
}

// --- COORDINATION.md parse / serialize --------------------------------------

function escapeCell(s: string): string {
	return s.replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

function unescapeCell(s: string): string {
	return s.replace(/\\\|/g, "|").trim();
}

const EM_DASH = "—";

/** Serialize a coordination doc to canonical COORDINATION.md markdown. */
export function serializeCoordination(doc: CoordinationDoc): string {
	const lines: string[] = [];
	lines.push(`# Coordination — ${doc.spec}`);
	lines.push("");
	lines.push(
		"<!-- Managed by `kanon spec`. Ownership/claims for multi-agent work.",
	);
	lines.push(
		"     Kiro ignores this file; tasks.md checkboxes remain the completion source of truth. -->",
	);
	lines.push("");
	lines.push("## Task ownership");
	lines.push("");
	lines.push("| Task | Owner | Status | Deps | Lease until | Updated | Note |");
	lines.push("|------|-------|--------|------|-------------|---------|------|");
	const sorted = [...doc.claims].sort((a, b) =>
		compareTaskIds(a.taskId, b.taskId),
	);
	for (const c of sorted) {
		const deps = c.deps.length > 0 ? c.deps.join(", ") : EM_DASH;
		lines.push(
			`| ${c.taskId} | ${c.owner ?? EM_DASH} | ${c.status} | ${deps} | ${
				c.leaseUntil ?? EM_DASH
			} | ${c.updated ?? EM_DASH} | ${c.note ? escapeCell(c.note) : EM_DASH} |`,
		);
	}
	lines.push("");
	lines.push("## Handoffs");
	lines.push("");
	if (doc.handoffs.length === 0) {
		lines.push("_None yet._");
	} else {
		for (const h of doc.handoffs) {
			lines.push(`- ${h.when} ${h.from} → ${h.to}: ${h.message}`);
		}
	}
	lines.push("");
	return lines.join("\n");
}

/** Numeric-aware comparison of dotted task ids ("2.10" sorts after "2.2"). */
export function compareTaskIds(a: string, b: string): number {
	const pa = a.split(".").map(Number);
	const pb = b.split(".").map(Number);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const da = pa[i] ?? 0;
		const db = pb[i] ?? 0;
		if (da !== db) return da - db;
	}
	return 0;
}

/** Split a markdown table row into trimmed cells, honoring `\|` escapes. */
function splitTableRow(line: string): string[] {
	const cells: string[] = [];
	let cur = "";
	for (let i = 0; i < line.length; i++) {
		const ch = line[i];
		if (ch === "\\" && line[i + 1] === "|") {
			cur += "\\|";
			i++;
			continue;
		}
		if (ch === "|") {
			cells.push(cur);
			cur = "";
			continue;
		}
		cur += ch;
	}
	cells.push(cur);
	// Drop the empty leading/trailing cells produced by the border pipes.
	return cells.slice(1, -1).map((c) => c.trim());
}

const HANDOFF_RE = /^-\s+(\S+)\s+(.+?)\s+→\s+(.+?):\s+(.*)$/;

/** Parse a COORDINATION.md body; tolerant of hand-edits and missing sections. */
export function parseCoordination(md: string): CoordinationDoc {
	const specMatch = md.match(/^#\s+Coordination\s+—\s+(.+)$/m);
	const spec = specMatch ? specMatch[1].trim() : "";
	const claims: ClaimEntry[] = [];
	const handoffs: HandoffEntry[] = [];

	const lines = md.split("\n");
	let section: "claims" | "handoffs" | null = null;
	for (const line of lines) {
		if (/^##\s+Task ownership/i.test(line)) {
			section = "claims";
			continue;
		}
		if (/^##\s+Handoffs/i.test(line)) {
			section = "handoffs";
			continue;
		}
		if (section === "claims" && line.trim().startsWith("|")) {
			const cells = splitTableRow(line);
			if (cells.length < 4) continue;
			// Skip header and divider rows.
			if (cells[0].toLowerCase() === "task") continue;
			if (/^-+$/.test(cells[0])) continue;
			const status = (TASK_COORD_STATUSES as readonly string[]).includes(
				cells[2],
			)
				? (cells[2] as TaskCoordStatus)
				: "open";
			const cell = (i: number): string | undefined => cells[i];
			const nullable = (v: string | undefined): string | null =>
				v === undefined || v === EM_DASH || v === "" ? null : v;
			// New 7-column layout: Task | Owner | Status | Deps | Lease | Updated | Note
			// Old 5-column layout: Task | Owner | Status | Updated | Note
			const isNew = cells.length >= 6;
			claims.push({
				taskId: cells[0],
				owner: nullable(cells[1]),
				status,
				deps: isNew ? parseDepIds(cell(3) ?? "") : [],
				leaseUntil: isNew ? nullable(cell(4)) : null,
				updated: isNew ? nullable(cell(5)) : nullable(cell(3)),
				note: (() => {
					const raw = isNew ? cell(6) : cell(4);
					return raw && raw !== EM_DASH ? unescapeCell(raw) : undefined;
				})(),
			});
		}
		if (section === "handoffs") {
			const m = line.match(HANDOFF_RE);
			if (m) {
				handoffs.push({ when: m[1], from: m[2], to: m[3], message: m[4] });
			}
		}
	}
	return { spec, claims, handoffs };
}

/** Build a fresh coordination doc seeded from tasks.md task ids. */
export function initCoordination(
	spec: string,
	tasks: TaskLine[],
): CoordinationDoc {
	return {
		spec,
		claims: tasks.map((t) => ({
			taskId: t.id,
			owner: null,
			status: t.checked ? "done" : "open",
			deps: [...t.deps],
			leaseUntil: null,
			updated: null,
		})),
		handoffs: [],
	};
}

// --- pure mutations ---------------------------------------------------------

function upsertClaim(
	doc: CoordinationDoc,
	taskId: string,
	patch: Partial<Omit<ClaimEntry, "taskId">>,
	now: string,
): CoordinationDoc {
	const claims = [...doc.claims];
	const idx = claims.findIndex((c) => c.taskId === taskId);
	const base: ClaimEntry =
		idx >= 0
			? claims[idx]
			: {
					taskId,
					owner: null,
					status: "open",
					deps: [],
					leaseUntil: null,
					updated: null,
				};
	const next: ClaimEntry = { ...base, ...patch, updated: now };
	if (idx >= 0) claims[idx] = next;
	else claims.push(next);
	return { ...doc, claims };
}

export interface ClaimResult {
	doc: CoordinationDoc;
	/** Set when the task was already owned by a *different* agent. */
	conflict?: {
		owner: string;
		status: TaskCoordStatus;
		/** Whether the blocking claim's lease had expired (informational). */
		leaseExpired: boolean;
	};
	/** Set when the task's dependencies are not all done. */
	blocked?: { unmet: string[] };
}

export interface ClaimOptions {
	force?: boolean;
	/** Lease duration in minutes (default DEFAULT_LEASE_MINUTES). */
	leaseMinutes?: number;
	/** Skip the dependency gate (used only for explicit manual claims). */
	ignoreDeps?: boolean;
}

/**
 * Claim a task for an agent, setting a fresh lease. Returns a conflict (without
 * mutating) when the task is actively owned by another agent whose lease has
 * not expired, unless `force`. Returns `blocked` when dependencies are unmet,
 * unless `ignoreDeps` or `force`.
 */
export function claimTask(
	doc: CoordinationDoc,
	taskId: string,
	agent: string,
	now: string,
	opts: ClaimOptions = {},
): ClaimResult {
	const existing = doc.claims.find((c) => c.taskId === taskId);

	// Ownership gate — a live claim by another agent blocks unless forced.
	if (
		existing?.owner &&
		existing.owner !== agent &&
		existing.status !== "done" &&
		!opts.force
	) {
		const leaseExpired = isLeaseExpired(existing.leaseUntil, now);
		if (!leaseExpired) {
			return {
				doc,
				conflict: {
					owner: existing.owner,
					status: existing.status,
					leaseExpired,
				},
			};
		}
		// else: lease expired → fall through and reclaim
	}

	// Dependency gate.
	if (
		!opts.force &&
		!opts.ignoreDeps &&
		existing &&
		!depsSatisfied(doc, taskId)
	) {
		return { doc, blocked: { unmet: unmetDeps(doc, taskId) } };
	}

	const leaseUntil = leaseFrom(now, opts.leaseMinutes ?? DEFAULT_LEASE_MINUTES);
	return {
		doc: upsertClaim(
			doc,
			taskId,
			{ owner: agent, status: "claimed", leaseUntil },
			now,
		),
	};
}

/** Release a task back to unowned/open, clearing any lease. */
export function releaseTask(
	doc: CoordinationDoc,
	taskId: string,
	now: string,
): CoordinationDoc {
	return upsertClaim(
		doc,
		taskId,
		{ owner: null, status: "open", leaseUntil: null },
		now,
	);
}

/**
 * Set a task's coordination status. Reaching a terminal state (`done`) clears
 * the lease; moving to `in-progress` or `claimed` refreshes it when requested.
 */
export function setTaskStatus(
	doc: CoordinationDoc,
	taskId: string,
	status: TaskCoordStatus,
	now: string,
	opts: { leaseMinutes?: number } = {},
): CoordinationDoc {
	const patch: Partial<Omit<ClaimEntry, "taskId">> = { status };
	if (status === "done" || status === "blocked") {
		patch.leaseUntil = null;
	} else if (opts.leaseMinutes !== undefined) {
		patch.leaseUntil = leaseFrom(now, opts.leaseMinutes);
	}
	return upsertClaim(doc, taskId, patch, now);
}

/** Append a handoff note. */
export function addHandoff(
	doc: CoordinationDoc,
	from: string,
	to: string,
	message: string,
	now: string,
): CoordinationDoc {
	return {
		...doc,
		handoffs: [...doc.handoffs, { when: now, from, to, message }],
	};
}

/**
 * Reconcile coordination against tasks.md: add rows for new task ids, mark
 * rows done where the checkbox is checked, and refresh dependency lists from
 * tasks.md `_Depends:_` markers. Never un-marks or deletes.
 */
export function reconcile(
	doc: CoordinationDoc,
	tasks: TaskLine[],
	now: string,
): CoordinationDoc {
	let next = doc;
	const known = new Set(doc.claims.map((c) => c.taskId));
	for (const t of tasks) {
		if (!known.has(t.id)) {
			next = upsertClaim(
				next,
				t.id,
				{ status: t.checked ? "done" : "open", deps: [...t.deps] },
				now,
			);
		} else {
			const cur = next.claims.find((c) => c.taskId === t.id);
			if (!cur) continue;
			const patch: Partial<Omit<ClaimEntry, "taskId">> = {};
			// Adopt any deps declared in tasks.md that aren't already tracked.
			const mergedDeps = Array.from(new Set([...cur.deps, ...t.deps]));
			if (mergedDeps.length !== cur.deps.length) patch.deps = mergedDeps;
			if (t.checked && cur.status !== "done") patch.status = "done";
			if (Object.keys(patch).length > 0) {
				next = upsertClaim(next, t.id, patch, now);
			}
		}
	}
	return next;
}

// --- dependencies, leases, and task selection -------------------------------

/** A task is "complete" if its coordination status is done. */
function isDone(doc: CoordinationDoc, taskId: string): boolean {
	return doc.claims.find((c) => c.taskId === taskId)?.status === "done";
}

/** True when every dependency of the task is done (or it has none). */
export function depsSatisfied(doc: CoordinationDoc, taskId: string): boolean {
	const entry = doc.claims.find((c) => c.taskId === taskId);
	if (!entry) return true;
	return entry.deps.every((d) => isDone(doc, d));
}

/** Dependency ids that are not yet done. */
export function unmetDeps(doc: CoordinationDoc, taskId: string): string[] {
	const entry = doc.claims.find((c) => c.taskId === taskId);
	if (!entry) return [];
	return entry.deps.filter((d) => !isDone(doc, d));
}

/** True when a lease timestamp has passed relative to `now`. */
export function isLeaseExpired(
	leaseUntil: string | null,
	now: string,
): boolean {
	if (!leaseUntil) return true;
	const until = Date.parse(leaseUntil);
	if (Number.isNaN(until)) return true;
	return Date.parse(now) > until;
}

/**
 * True when a task is effectively available to a *different* agent: unowned, or
 * terminal-but-not-done is impossible, or its owner's lease has expired.
 * A `done` task is never available. The task's own agent always "has" it.
 */
export function isClaimable(
	entry: ClaimEntry,
	agent: string,
	now: string,
): boolean {
	if (entry.status === "done") return false;
	if (!entry.owner) return true;
	if (entry.owner === agent) return true;
	// Owned by someone else — only claimable if their lease expired.
	return isLeaseExpired(entry.leaseUntil, now);
}

/** Add `minutes` to an ISO timestamp, returning a new ISO timestamp. */
export function leaseFrom(now: string, minutes: number): string {
	return new Date(Date.parse(now) + minutes * 60_000).toISOString();
}

/**
 * Pick the next actionable task for an agent: the lowest-id task that is not
 * done, has all dependencies satisfied, and is claimable (unowned, owned by
 * this agent, or whose lease has expired). Returns null when nothing is ready.
 */
export function selectNextTask(
	doc: CoordinationDoc,
	agent: string,
	now: string,
): ClaimEntry | null {
	const candidates = doc.claims
		.filter((c) => c.status !== "done")
		.filter((c) => isClaimable(c, agent, now))
		.filter((c) => depsSatisfied(doc, c.taskId))
		.sort((a, b) => compareTaskIds(a.taskId, b.taskId));
	return candidates[0] ?? null;
}

// --- filesystem helpers -----------------------------------------------------

export function specsRoot(cwd = process.cwd()): string {
	return join(cwd, ".kiro", "specs");
}

export function specDir(spec: string, cwd = process.cwd()): string {
	return join(specsRoot(cwd), spec);
}

export async function listSpecs(cwd = process.cwd()): Promise<string[]> {
	const root = specsRoot(cwd);
	if (!(await exists(root))) return [];
	const entries = await readdir(root, { withFileTypes: true });
	return entries
		.filter((e) => e.isDirectory())
		.map((e) => e.name)
		.sort();
}

async function readIfExists(path: string): Promise<string | null> {
	if (!(await exists(path))) return null;
	return readFile(path, "utf-8");
}

/** Load COORDINATION.md for a spec, seeding from tasks.md if absent. */
export async function loadCoordination(
	spec: string,
	cwd = process.cwd(),
): Promise<CoordinationDoc> {
	const dir = specDir(spec, cwd);
	const coordRaw = await readIfExists(join(dir, COORDINATION_FILENAME));
	if (coordRaw !== null) return parseCoordination(coordRaw);
	const tasksRaw = (await readIfExists(join(dir, TASKS_FILENAME))) ?? "";
	return initCoordination(spec, parseTaskLines(tasksRaw));
}

export async function saveCoordination(
	doc: CoordinationDoc,
	cwd = process.cwd(),
): Promise<void> {
	const dir = specDir(doc.spec, cwd);
	await writeFile(
		join(dir, COORDINATION_FILENAME),
		serializeCoordination(doc),
		"utf-8",
	);
}

async function loadTasks(
	spec: string,
	cwd = process.cwd(),
): Promise<TaskLine[]> {
	const raw = await readIfExists(join(specDir(spec, cwd), TASKS_FILENAME));
	return raw ? parseTaskLines(raw) : [];
}

function nowIso(): string {
	return new Date().toISOString();
}

function fail(msg: string): never {
	console.error(chalk.red(`Error: ${msg}`));
	process.exit(1);
}

async function ensureSpec(spec: string | undefined): Promise<string> {
	if (!spec)
		fail("Provide a spec name, e.g. `kanon spec status user-authentication`");
	const dir = specDir(spec);
	if (!(await exists(dir))) {
		const available = await listSpecs();
		fail(
			`Spec "${spec}" not found under .kiro/specs/.` +
				(available.length
					? `\n  Available: ${available.join(", ")}`
					: "\n  No specs found in this workspace."),
		);
	}
	return spec;
}

// --- command actions --------------------------------------------------------

export interface SpecOutputOptions {
	json?: boolean;
}

/** `kanon spec list` — list specs and their config + progress. */
export async function specListCommand(
	options: SpecOutputOptions = {},
): Promise<void> {
	const specs = await listSpecs();
	const rows: Array<{
		spec: string;
		specType: string | null;
		workflowType: string | null;
		done: number;
		total: number;
	}> = [];
	for (const spec of specs) {
		const cfgRaw = await readIfExists(join(specDir(spec), CONFIG_FILENAME));
		const cfg = cfgRaw ? parseSpecConfig(cfgRaw) : {};
		const tasks = await loadTasks(spec);
		rows.push({
			spec,
			specType: (cfg.specType as string) ?? null,
			workflowType: (cfg.workflowType as string) ?? null,
			done: tasks.filter((t) => t.checked).length,
			total: tasks.length,
		});
	}

	if (options.json) {
		console.log(JSON.stringify({ specs: rows }, null, 2));
		return;
	}
	if (rows.length === 0) {
		console.log(chalk.dim("No specs found under .kiro/specs/."));
		return;
	}
	for (const r of rows) {
		console.log(
			`${chalk.bold(r.spec)}  ${chalk.dim(
				`[${r.specType ?? "?"}/${r.workflowType ?? "?"}]`,
			)}  ${chalk.cyan(`${r.done}/${r.total} tasks`)}`,
		);
	}
}

/** `kanon spec status <spec>` — show ownership table + progress. */
export async function specStatusCommand(
	spec?: string,
	options: SpecOutputOptions = {},
): Promise<void> {
	const name = await ensureSpec(spec);
	const now = nowIso();
	const tasks = await loadTasks(name);
	const doc = reconcile(await loadCoordination(name), tasks, now);
	const done = tasks.filter((t) => t.checked).length;
	const sorted = [...doc.claims].sort((a, b) =>
		compareTaskIds(a.taskId, b.taskId),
	);

	if (options.json) {
		console.log(
			JSON.stringify(
				{
					spec: name,
					progress: { done, total: tasks.length },
					tasks: sorted.map((c) => ({
						id: c.taskId,
						owner: c.owner,
						status: c.status,
						deps: c.deps,
						unmetDeps: unmetDeps(doc, c.taskId),
						leaseUntil: c.leaseUntil,
						leaseExpired: c.owner ? isLeaseExpired(c.leaseUntil, now) : null,
						updated: c.updated,
						note: c.note ?? null,
					})),
					handoffs: doc.handoffs,
				},
				null,
				2,
			),
		);
		return;
	}

	console.log(chalk.bold(`Spec: ${name}`));
	console.log(chalk.cyan(`Progress: ${done}/${tasks.length} tasks complete`));
	console.log();
	console.log(
		chalk.bold("Task  Owner            Status        Deps         Notes"),
	);
	for (const c of sorted) {
		const unmet = unmetDeps(doc, c.taskId);
		const depCol =
			c.deps.length === 0
				? "—"
				: unmet.length > 0
					? `blocked:${unmet.join(",")}`
					: "ready";
		const stale =
			c.owner && c.status !== "done" && isLeaseExpired(c.leaseUntil, now)
				? chalk.yellow(" (lease expired)")
				: "";
		console.log(
			`${c.taskId.padEnd(5)} ${(c.owner ?? "—").padEnd(16)} ${c.status.padEnd(
				13,
			)} ${depCol.padEnd(12)} ${c.note ?? ""}${stale}`,
		);
	}
	if (doc.handoffs.length > 0) {
		console.log();
		console.log(chalk.bold("Handoffs:"));
		for (const h of doc.handoffs) {
			console.log(`  ${h.when} ${h.from} → ${h.to}: ${h.message}`);
		}
	}
}

export interface SpecClaimOptions {
	agent?: string;
	force?: boolean;
	lease?: string;
	ignoreDeps?: boolean;
}

function parseLeaseMinutes(lease: string | undefined): number | undefined {
	if (lease === undefined) return undefined;
	const n = Number(lease);
	if (!Number.isFinite(n) || n <= 0) {
		fail(`--lease must be a positive number of minutes (got "${lease}")`);
	}
	return n;
}

/** `kanon spec claim <spec> <taskId> --agent <name>`. */
export async function specClaimCommand(
	spec: string | undefined,
	taskId: string | undefined,
	options: SpecClaimOptions,
): Promise<void> {
	const name = await ensureSpec(spec);
	if (!taskId)
		fail("Provide a task id, e.g. `kanon spec claim my-spec 2.1 --agent code`");
	if (!options.agent)
		fail("Provide --agent <name> to identify the claiming agent");

	const tasks = await loadTasks(name);
	if (!tasks.some((t) => t.id === taskId)) {
		fail(`Task "${taskId}" not found in ${name}/${TASKS_FILENAME}`);
	}

	// Reconcile first so deps declared in tasks.md are known before we gate on them.
	const doc = reconcile(await loadCoordination(name), tasks, nowIso());
	const {
		doc: next,
		conflict,
		blocked,
	} = claimTask(doc, taskId, options.agent, nowIso(), {
		force: options.force,
		leaseMinutes: parseLeaseMinutes(options.lease),
		ignoreDeps: options.ignoreDeps,
	});
	if (conflict) {
		fail(
			`Task "${taskId}" is already claimed by "${conflict.owner}" (${conflict.status}).` +
				`\n  Use --force to take it over, or pick another task.`,
		);
	}
	if (blocked) {
		fail(
			`Task "${taskId}" is blocked — waiting on: ${blocked.unmet.join(", ")}.` +
				`\n  Finish those first, or use --ignore-deps to override.`,
		);
	}
	await saveCoordination(next, process.cwd());
	console.log(
		chalk.green(`✓ ${options.agent} claimed task ${taskId} in ${name}`),
	);
}

export interface SpecNextOptions {
	agent?: string;
	lease?: string;
	/** Only report the next task; do not claim it. */
	dryRun?: boolean;
	json?: boolean;
}

/**
 * `kanon spec next <spec> --agent <name>` — atomically select and claim the
 * next actionable task (lowest id, deps satisfied, claimable), then print it.
 * This is the one-call path an agent uses to pull work.
 */
export async function specNextCommand(
	spec: string | undefined,
	options: SpecNextOptions,
): Promise<void> {
	const name = await ensureSpec(spec);
	if (!options.agent)
		fail("Provide --agent <name> to identify the requesting agent");

	const now = nowIso();
	const tasks = await loadTasks(name);
	// Reconcile so new tasks and tasks.md deps are reflected before selecting.
	const doc = reconcile(await loadCoordination(name), tasks, now);
	const pick = selectNextTask(doc, options.agent, now);

	if (!pick) {
		const remaining = doc.claims.filter((c) => c.status !== "done");
		if (options.json) {
			console.log(JSON.stringify({ spec: name, task: null }, null, 2));
		} else if (remaining.length === 0) {
			console.log(chalk.green(`✓ ${name}: all tasks complete.`));
		} else {
			console.log(
				chalk.yellow(
					`No actionable task in ${name} right now — ` +
						`${remaining.length} remaining but each is blocked or claimed.`,
				),
			);
		}
		return;
	}

	const text = tasks.find((t) => t.id === pick.taskId)?.text ?? "";

	if (options.dryRun) {
		if (options.json) {
			console.log(
				JSON.stringify(
					{ spec: name, task: { id: pick.taskId, text, claimed: false } },
					null,
					2,
				),
			);
		} else {
			console.log(
				`Next task in ${name}: ${chalk.bold(pick.taskId)} ${text} ${chalk.dim(
					"(dry run — not claimed)",
				)}`,
			);
		}
		return;
	}

	const { doc: next } = claimTask(doc, pick.taskId, options.agent, now, {
		leaseMinutes: parseLeaseMinutes(options.lease),
	});
	await saveCoordination(next, process.cwd());

	if (options.json) {
		console.log(
			JSON.stringify(
				{ spec: name, task: { id: pick.taskId, text, claimed: true } },
				null,
				2,
			),
		);
	} else {
		console.log(
			chalk.green(
				`✓ ${options.agent} claimed next task ${pick.taskId} in ${name}: ${text}`,
			),
		);
	}
}

/** `kanon spec release <spec> <taskId>`. */
export async function specReleaseCommand(
	spec: string | undefined,
	taskId: string | undefined,
): Promise<void> {
	const name = await ensureSpec(spec);
	if (!taskId) fail("Provide a task id to release");
	const doc = await loadCoordination(name);
	await saveCoordination(releaseTask(doc, taskId, nowIso()), process.cwd());
	console.log(chalk.green(`✓ released task ${taskId} in ${name}`));
}

export interface SpecCompleteOptions {
	agent?: string;
}

/**
 * `kanon spec done <spec> <taskId>` — mark a task complete: checks the box in
 * tasks.md AND sets coordination status to done. This is the key write path
 * that keeps the two files consistent.
 */
export async function specDoneCommand(
	spec: string | undefined,
	taskId: string | undefined,
	_options: SpecCompleteOptions,
): Promise<void> {
	const name = await ensureSpec(spec);
	if (!taskId) fail("Provide a task id to mark done");
	const dir = specDir(name);
	const tasksPath = join(dir, TASKS_FILENAME);
	const tasksRaw = await readIfExists(tasksPath);
	if (tasksRaw === null) fail(`${name}/${TASKS_FILENAME} not found`);

	let updated: string;
	try {
		updated = setTaskChecked(tasksRaw as string, taskId, true);
	} catch (err) {
		fail(err instanceof Error ? err.message : String(err));
	}
	await writeFile(tasksPath, updated, "utf-8");

	const doc = await loadCoordination(name);
	await saveCoordination(
		setTaskStatus(doc, taskId, "done", nowIso()),
		process.cwd(),
	);
	console.log(chalk.green(`✓ marked task ${taskId} done in ${name}`));
}

/** `kanon spec reconcile <spec>` — sync coordination rows to tasks.md. */
export async function specReconcileCommand(spec?: string): Promise<void> {
	const name = await ensureSpec(spec);
	const tasks = await loadTasks(name);
	const doc = await loadCoordination(name);
	const before = doc.claims.length;
	const next = reconcile(doc, tasks, nowIso());
	await saveCoordination(next, process.cwd());
	const added = next.claims.length - before;
	console.log(
		chalk.green(
			`✓ reconciled ${name}: ${next.claims.length} tracked tasks` +
				(added > 0 ? ` (+${added} new)` : ""),
		),
	);
}

export interface SpecHandoffOptions {
	from?: string;
	to?: string;
}

/** `kanon spec handoff <spec> <message> --from <a> --to <b>`. */
export async function specHandoffCommand(
	spec: string | undefined,
	message: string | undefined,
	options: SpecHandoffOptions,
): Promise<void> {
	const name = await ensureSpec(spec);
	if (!message) fail("Provide a handoff message");
	if (!options.from || !options.to) {
		fail("Provide --from <agent> and --to <agent>");
	}
	const doc = await loadCoordination(name);
	await saveCoordination(
		addHandoff(doc, options.from, options.to, message, nowIso()),
		process.cwd(),
	);
	console.log(
		chalk.green(`✓ recorded handoff ${options.from} → ${options.to}`),
	);
}
