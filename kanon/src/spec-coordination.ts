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
	/** Optional free-text note (kept short; escaped for table cells). */
	note?: string;
}

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
const TASK_LINE_RE = /^(\s*)-\s\[( |x|X)\]\s+([0-9]+(?:\.[0-9]+)*)\.?\s+(.*)$/;

/** Extract all checkbox tasks (with ids) from a tasks.md body. */
export function parseTaskLines(tasksMd: string): TaskLine[] {
	const out: TaskLine[] = [];
	for (const line of tasksMd.split("\n")) {
		const m = line.match(TASK_LINE_RE);
		if (!m) continue;
		out.push({
			id: m[3],
			checked: m[2].toLowerCase() === "x",
			text: m[4].trim(),
		});
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
	lines.push("| Task | Owner | Status | Updated | Note |");
	lines.push("|------|-------|--------|---------|------|");
	const sorted = [...doc.claims].sort((a, b) =>
		compareTaskIds(a.taskId, b.taskId),
	);
	for (const c of sorted) {
		lines.push(
			`| ${c.taskId} | ${c.owner ?? EM_DASH} | ${c.status} | ${
				c.updated ?? EM_DASH
			} | ${c.note ? escapeCell(c.note) : EM_DASH} |`,
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
			claims.push({
				taskId: cells[0],
				owner: cells[1] === EM_DASH || cells[1] === "" ? null : cells[1],
				status,
				updated: cells[3] === EM_DASH || cells[3] === "" ? null : cells[3],
				note:
					cells[4] && cells[4] !== EM_DASH ? unescapeCell(cells[4]) : undefined,
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
			: { taskId, owner: null, status: "open", updated: null };
	const next: ClaimEntry = { ...base, ...patch, updated: now };
	if (idx >= 0) claims[idx] = next;
	else claims.push(next);
	return { ...doc, claims };
}

export interface ClaimResult {
	doc: CoordinationDoc;
	/** Set when the task was already owned by a *different* agent. */
	conflict?: { owner: string; status: TaskCoordStatus };
}

/**
 * Claim a task for an agent. If already owned by someone else and not `force`,
 * returns a conflict without mutating ownership.
 */
export function claimTask(
	doc: CoordinationDoc,
	taskId: string,
	agent: string,
	now: string,
	opts: { force?: boolean } = {},
): ClaimResult {
	const existing = doc.claims.find((c) => c.taskId === taskId);
	if (
		existing?.owner &&
		existing.owner !== agent &&
		existing.status !== "done" &&
		!opts.force
	) {
		return {
			doc,
			conflict: { owner: existing.owner, status: existing.status },
		};
	}
	return {
		doc: upsertClaim(doc, taskId, { owner: agent, status: "claimed" }, now),
	};
}

/** Release a task back to unowned/open. */
export function releaseTask(
	doc: CoordinationDoc,
	taskId: string,
	now: string,
): CoordinationDoc {
	return upsertClaim(doc, taskId, { owner: null, status: "open" }, now);
}

/** Set a task's coordination status (e.g. mark in-progress or done). */
export function setTaskStatus(
	doc: CoordinationDoc,
	taskId: string,
	status: TaskCoordStatus,
	now: string,
): CoordinationDoc {
	return upsertClaim(doc, taskId, { status }, now);
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
 * Reconcile coordination against tasks.md: add rows for new task ids, and
 * mark rows done where the checkbox is checked. Never un-marks or deletes.
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
				{ status: t.checked ? "done" : "open" },
				now,
			);
		} else if (t.checked) {
			const cur = next.claims.find((c) => c.taskId === t.id);
			if (cur && cur.status !== "done") {
				next = upsertClaim(next, t.id, { status: "done" }, now);
			}
		}
	}
	return next;
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

/** `kanon spec list` — list specs and their config + progress. */
export async function specListCommand(): Promise<void> {
	const specs = await listSpecs();
	if (specs.length === 0) {
		console.log(chalk.dim("No specs found under .kiro/specs/."));
		return;
	}
	for (const spec of specs) {
		const cfgRaw = await readIfExists(join(specDir(spec), CONFIG_FILENAME));
		const cfg = cfgRaw ? parseSpecConfig(cfgRaw) : {};
		const tasks = await loadTasks(spec);
		const done = tasks.filter((t) => t.checked).length;
		const type = cfg.specType ?? "?";
		const wf = cfg.workflowType ?? "?";
		console.log(
			`${chalk.bold(spec)}  ${chalk.dim(`[${type}/${wf}]`)}  ${chalk.cyan(
				`${done}/${tasks.length} tasks`,
			)}`,
		);
	}
}

/** `kanon spec status <spec>` — show ownership table + progress. */
export async function specStatusCommand(spec?: string): Promise<void> {
	const name = await ensureSpec(spec);
	const doc = await loadCoordination(name);
	const tasks = await loadTasks(name);
	const done = tasks.filter((t) => t.checked).length;

	console.log(chalk.bold(`Spec: ${name}`));
	console.log(chalk.cyan(`Progress: ${done}/${tasks.length} tasks complete`));
	console.log();
	console.log(chalk.bold("Task  Owner            Status        Updated"));
	for (const c of [...doc.claims].sort((a, b) =>
		compareTaskIds(a.taskId, b.taskId),
	)) {
		console.log(
			`${c.taskId.padEnd(5)} ${(c.owner ?? "—").padEnd(16)} ${c.status.padEnd(
				13,
			)} ${c.updated ?? "—"}`,
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

	const doc = await loadCoordination(name);
	const { doc: next, conflict } = claimTask(
		doc,
		taskId,
		options.agent,
		nowIso(),
		{ force: options.force },
	);
	if (conflict) {
		fail(
			`Task "${taskId}" is already claimed by "${conflict.owner}" (${conflict.status}).` +
				`\n  Use --force to take it over, or pick another task.`,
		);
	}
	await saveCoordination(next, process.cwd());
	console.log(
		chalk.green(`✓ ${options.agent} claimed task ${taskId} in ${name}`),
	);
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
