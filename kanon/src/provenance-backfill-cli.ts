/**
 * Provenance Backfill — CLI Command Handler
 *
 * `kanon rosetta backfill [upstream]` is the one-shot command that records
 * `ProvenanceRecord`s for existing distilled artifacts (ADR-0049). It matches
 * each distilled artifact to the current upstream by NAME, records the current
 * `baseDigest`, writes the machine-managed provenance block into `knowledge.md`,
 * and seeds the git-ignored base cache. Supports `--dry-run` to report what it
 * would backfill without writing.
 *
 * This handler is the orchestration shell: it resolves config, locates the
 * upstream source root and distilled knowledge directory, resolves the source
 * revision, then delegates the per-artifact work to `backfillUpstream`
 * (src/provenance-backfill.ts), which composes the pure Rosetta Stone helpers.
 *
 * Requirements: 18.1, 18.9
 */

import { exists } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import { loadForgeConfig, type UpstreamConfig } from "./config";
import { loadKnowledgeArtifact } from "./parser";
import {
	type BackfillResult,
	type BackfillSourceFormat,
	type BackfillUpstreamOptions,
	backfillUpstream,
	type DistilledArtifactLoader,
} from "./provenance-backfill";
import type { KnowledgeArtifact } from "./schemas";

// ═══════════════════════════════════════════════════════════════════════════════
// Options
// ═══════════════════════════════════════════════════════════════════════════════

interface BackfillCliOptions {
	dryRun?: boolean;
	json?: boolean;
	revision?: string;
}

/** Source formats a path-based backfill can distill from. */
const BACKFILL_FORMATS: ReadonlySet<string> = new Set([
	"kiro-power",
	"kiro-skill",
	"superpowers",
]);

// ═══════════════════════════════════════════════════════════════════════════════
// Filesystem-backed distilled artifact loader
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Default loader: parse a distilled artifact directory via the canonical parser.
 * Returns undefined when the directory does not parse into a valid artifact so
 * the backfill classifies it as a translation failure rather than throwing.
 */
const loadDistilledFromDisk: DistilledArtifactLoader = async (artifactDir) => {
	const result = await loadKnowledgeArtifact(artifactDir);
	if ("errors" in result) {
		return undefined;
	}
	return result.data as KnowledgeArtifact;
};

// ═══════════════════════════════════════════════════════════════════════════════
// Source-revision resolution
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Resolve the upstream source revision to record in provenance. Prefers an
 * explicit `--revision`; otherwise attempts to read the current subtree HEAD via
 * git; otherwise falls back to a stable backfill marker so the (non-empty)
 * schema field is always satisfied without failing the command on machines
 * where git is unavailable.
 */
async function resolveSourceRevision(
	explicit: string | undefined,
	repoRoot: string,
): Promise<string> {
	if (explicit && explicit.trim().length > 0) {
		return explicit.trim();
	}

	try {
		const proc = Bun.spawn(["git", "rev-parse", "HEAD"], {
			cwd: repoRoot,
			stdout: "pipe",
			stderr: "ignore",
		});
		const out = (await new Response(proc.stdout).text()).trim();
		const code = await proc.exited;
		if (code === 0 && out.length > 0) {
			return `backfill:${out}`;
		}
	} catch {
		// git unavailable — fall through to the marker below.
	}

	return "backfill:unknown";
}

// ═══════════════════════════════════════════════════════════════════════════════
// Path resolution for one upstream
// ═══════════════════════════════════════════════════════════════════════════════

interface ResolvedUpstreamPaths {
	readonly sourceFormat: BackfillSourceFormat;
	readonly knowledgeDir: string;
	readonly upstreamRoot: string;
}

/**
 * Resolve the distilled knowledge directory and upstream source root for an
 * upstream config entry, or return a diagnostic string explaining why it cannot
 * be backfilled. `prefix` is relative to the repository root; `knowledgeDir` is
 * relative to the kanon working directory.
 */
async function resolveUpstreamPaths(
	upstream: UpstreamConfig,
	repoRoot: string,
	workingDir: string,
): Promise<ResolvedUpstreamPaths | string> {
	const format = upstream.format ?? "auto";
	if (!BACKFILL_FORMATS.has(format)) {
		return `format "${format}" is not a path-based source format (expected kiro-power, kiro-skill, or superpowers)`;
	}

	if (!upstream.knowledgeDir) {
		return "no knowledgeDir configured for this upstream";
	}
	if (!upstream.prefix) {
		return "no prefix (subtree path) configured for this upstream";
	}

	const knowledgeDir = isAbsolute(upstream.knowledgeDir)
		? upstream.knowledgeDir
		: resolve(workingDir, upstream.knowledgeDir);
	const upstreamRoot = isAbsolute(upstream.prefix)
		? upstream.prefix
		: resolve(repoRoot, upstream.prefix);

	if (!(await exists(knowledgeDir))) {
		return `knowledge directory not found: ${knowledgeDir}`;
	}
	if (!(await exists(upstreamRoot))) {
		return `upstream source root not found: ${upstreamRoot} (run the sync script first)`;
	}

	return {
		sourceFormat: format as BackfillSourceFormat,
		knowledgeDir,
		upstreamRoot,
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Human-readable rendering
// ═══════════════════════════════════════════════════════════════════════════════

function renderResult(result: BackfillResult, dryRun: boolean): void {
	const verb = dryRun ? "would backfill" : "backfilled";
	console.log(
		chalk.bold.cyan(`Provenance backfill — ${result.upstream}`) +
			(dryRun ? chalk.dim("  (dry run)") : ""),
	);
	console.log(chalk.dim("─".repeat(50)));

	for (const entry of result.entries) {
		switch (entry.outcome) {
			case "backfilled": {
				const digest = entry.baseDigest
					? chalk.dim(` ${entry.baseDigest.slice(0, 19)}…`)
					: "";
				console.log(`  ${chalk.green("✓")} ${chalk.bold(entry.name)}${digest}`);
				break;
			}
			case "skipped-has-provenance":
				console.log(
					`  ${chalk.dim("•")} ${entry.name} ${chalk.dim("(already has provenance)")}`,
				);
				break;
			case "unmatched":
				console.log(
					`  ${chalk.yellow("⚠")} ${entry.name} ${chalk.dim("(no upstream match)")}`,
				);
				break;
			case "translation-failed":
				console.log(
					`  ${chalk.red("✗")} ${entry.name} ${chalk.dim(`(${entry.detail ?? "translation failed"})`)}`,
				);
				break;
		}
	}

	console.log();
	console.log(
		chalk.green(`  ${result.backfilledCount} ${verb}`) +
			chalk.dim(
				`, ${result.skippedCount} skipped, ${result.unmatchedCount} unmatched, ${result.failedCount} failed`,
			),
	);
	console.log();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Command handler
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handler for `kanon rosetta backfill [upstream]`. Backfills one named upstream
 * or every configured `upstreams` entry when no name is given.
 */
async function backfillCommand(
	upstreamName: string | undefined,
	options: BackfillCliOptions,
): Promise<void> {
	const config = await loadForgeConfig();
	const upstreams = config.upstreams ?? {};

	const names = upstreamName ? [upstreamName] : Object.keys(upstreams).sort();

	if (upstreamName && !upstreams[upstreamName]) {
		console.error(
			chalk.red(`Error: Upstream "${upstreamName}" not found in config.`),
		);
		process.exit(1);
	}

	if (names.length === 0) {
		console.error(
			chalk.yellow("No upstreams configured in kanon.config.yaml."),
		);
		return;
	}

	const workingDir = process.cwd();
	const repoRoot = resolve(workingDir, "..");
	const dryRun = Boolean(options.dryRun);

	const results: BackfillResult[] = [];
	let hadError = false;

	for (const name of names) {
		const upstream = upstreams[name];
		const resolved = await resolveUpstreamPaths(upstream, repoRoot, workingDir);

		if (typeof resolved === "string") {
			if (!options.json) {
				console.error(chalk.yellow(`  ⚠ ${name} — skipped: ${resolved}`));
			}
			hadError = true;
			continue;
		}

		const sourceRevision = await resolveSourceRevision(
			options.revision,
			repoRoot,
		);

		const opts: BackfillUpstreamOptions = {
			upstream: name,
			knowledgeDir: resolved.knowledgeDir,
			upstreamRoot: resolved.upstreamRoot,
			sourceFormat: resolved.sourceFormat,
			sourceRevision,
			dryRun,
			workspaceRoot: workingDir,
		};

		const result = await backfillUpstream(opts, loadDistilledFromDisk);
		results.push(result);

		if (result.failedCount > 0) {
			hadError = true;
		}
	}

	if (options.json) {
		console.log(JSON.stringify({ dryRun, upstreams: results }, null, 2));
	} else {
		for (const result of results) {
			renderResult(result, dryRun);
		}
	}

	if (hadError) {
		process.exit(1);
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// Registration
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Register the `kanon rosetta backfill` subcommand on the rosetta command group.
 */
export function registerBackfillCommand(rosettaCmd: Command): void {
	rosettaCmd
		.command("backfill [upstream]")
		.description(
			"Backfill provenance for existing distilled artifacts by matching to current upstream by name",
		)
		.option(
			"--dry-run",
			"Report what would be backfilled without writing files",
		)
		.option("--json", "Output as JSON")
		.option(
			"--revision <rev>",
			"Upstream revision to record in provenance (default: current git HEAD)",
		)
		.action((upstream: string | undefined, opts: BackfillCliOptions) =>
			backfillCommand(upstream, opts),
		);
}
