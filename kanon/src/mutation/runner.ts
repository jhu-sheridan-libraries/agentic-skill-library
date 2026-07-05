/**
 * Mutation testing — runner orchestration (Req 5.1, 5.2, 5.4, 5.5, 5.9, 5.10).
 *
 * Discovers adapter source files, generates mutants, runs `bun test` against
 * each mutant, and reports kill rate. This is the I/O shell that coordinates
 * the pure-core modules (operators, delta, history).
 *
 * See ADR-0042 for the architectural rationale.
 */

import { execSync } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import chalk from "chalk";
import { ALL_MUTATION_OPERATORS, type MutationOperator } from "../config";
import { selectDeltaTargets } from "./delta";
import { appendRecord, type MutationRunRecord, parseHistory } from "./history";
import { generateMutants, type Mutant } from "./operators";

// --- Public Interfaces -------------------------------------------------------

/** Options passed from the CLI eval command to the mutation runner. */
export interface MutationRunOptions {
	/** Mutation operators to apply (from config or default all). */
	operators?: MutationOperator[];
	/** Minimum kill rate threshold (0.0–1.0). Default 0.80. */
	threshold?: number;
	/** Only mutate files changed since last run (nightly-delta strategy). */
	delta?: boolean;
	/** Path to history JSONL file. */
	historyPath?: string;
	/** Override adapters directory for testing. Default: "src/adapters". */
	adaptersDir?: string;
}

/** Report for a surviving mutant (Req 5.9). */
export interface SurvivorReport {
	filePath: string;
	line: number;
	operator: string;
	originalSnippet: string;
	mutatedSnippet: string;
}

/** Result of a mutation testing run. */
export interface MutationRunResult {
	totalMutants: number;
	killed: number;
	survived: number;
	killRate: number;
	survivors: SurvivorReport[];
	operators: MutationOperator[];
	belowThreshold: boolean;
}

/** Files excluded from adapter discovery (Req 5.2). */
const EXCLUDED_FILES = new Set(["types.ts", "index.ts", "capabilities.ts"]);

/** Default adapter directory relative to the project root. */
const DEFAULT_ADAPTERS_DIR = "src/adapters";

/** Default history file path. */
export const MUTATION_HISTORY_PATH = "evals/mutation-history.jsonl";

// --- Pure Functions ----------------------------------------------------------

/**
 * Compute kill rate = killed / total. Returns 0 when total is 0. Pure. (Req 5.5)
 */
export function computeKillRate(killed: number, total: number): number {
	if (total === 0) return 0;
	return killed / total;
}

// --- Adapter Discovery -------------------------------------------------------

/**
 * Discover adapter source files eligible for mutation (Req 5.2).
 * Scans `src/adapters/` for .ts files, excluding types.ts, index.ts,
 * and capabilities.ts.
 *
 * Returns relative paths (e.g. "src/adapters/kiro.ts").
 */
export async function discoverAdapterFiles(
	adaptersDir: string = DEFAULT_ADAPTERS_DIR,
): Promise<string[]> {
	const entries = await readdir(adaptersDir);
	return entries
		.filter((f) => f.endsWith(".ts") && !EXCLUDED_FILES.has(f))
		.map((f) => join(adaptersDir, f))
		.sort();
}

// --- Internal Helpers --------------------------------------------------------

/**
 * Get the current short git SHA.
 */
function gitSha(): string {
	try {
		return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
	} catch {
		return "unknown";
	}
}

/**
 * Get files changed since a given SHA via `git diff`.
 */
function getChangedFiles(sha: string): string[] {
	try {
		const output = execSync(`git diff --name-only ${sha} HEAD`, {
			encoding: "utf-8",
		}).trim();
		if (!output) return [];
		return output.split("\n").filter(Boolean);
	} catch {
		return [];
	}
}

/**
 * Build a SurvivorReport from a Mutant. The snippets from the operators
 * module already include line-granular context (Req 5.9).
 */
function toSurvivorReport(mutant: Mutant): SurvivorReport {
	return {
		filePath: mutant.filePath,
		line: mutant.line,
		operator: mutant.operator,
		originalSnippet: mutant.originalSnippet,
		mutatedSnippet: mutant.mutatedSnippet,
	};
}

/**
 * Print surviving mutants to stderr for operator review (Req 5.9).
 */
function reportSurvivors(survivors: SurvivorReport[]): void {
	if (survivors.length === 0) return;
	console.error(chalk.yellow(`\n  Surviving mutants (${survivors.length}):\n`));
	for (const s of survivors) {
		console.error(chalk.dim(`  ─── ${s.filePath}:${s.line} [${s.operator}]`));
		console.error(chalk.red("  - Original:"));
		for (const line of s.originalSnippet.split("\n")) {
			console.error(`    ${line}`);
		}
		console.error(chalk.green("  + Mutated:"));
		for (const line of s.mutatedSnippet.split("\n")) {
			console.error(`    ${line}`);
		}
		console.error("");
	}
}

// --- Main Runner Orchestration -----------------------------------------------

/**
 * Run mutation testing on adapter source files (Req 5.1).
 *
 * Orchestrates: adapter discovery → optional delta filtering → mutant
 * generation → test execution → result reporting → history persistence.
 *
 * Sets process.exitCode to 1 if:
 * - No adapter files found (Req 5.10)
 * - Kill rate below threshold (Req 5.5)
 */
export async function runMutationTesting(
	options: MutationRunOptions = {},
): Promise<MutationRunResult> {
	const operators = options.operators ?? ALL_MUTATION_OPERATORS;
	const threshold = options.threshold ?? 0.8;
	const historyPath = options.historyPath ?? MUTATION_HISTORY_PATH;
	const adaptersDir = options.adaptersDir ?? DEFAULT_ADAPTERS_DIR;

	// Step 1: Discover adapter files (Req 5.2, 5.10)
	let adapterFiles = await discoverAdapterFiles(adaptersDir);

	if (adapterFiles.length === 0) {
		console.error(
			chalk.red("Error: No adapter files detected in src/adapters/."),
		);
		process.exitCode = 1;
		return {
			totalMutants: 0,
			killed: 0,
			survived: 0,
			killRate: 0,
			survivors: [],
			operators,
			belowThreshold: true,
		};
	}

	// Step 2: Apply delta strategy if requested (Req 5.6, 5.7)
	if (options.delta) {
		let lastSha: string | null = null;
		try {
			const raw = await readFile(historyPath, "utf-8");
			const history = parseHistory(raw);
			if (history.length > 0) {
				lastSha = history[history.length - 1].sha;
			}
		} catch {
			// No history file — fall back to full run
		}

		if (lastSha) {
			const changedFiles = getChangedFiles(lastSha);
			const deltaTargets = selectDeltaTargets(adapterFiles, changedFiles);
			if (deltaTargets.length > 0) {
				adapterFiles = deltaTargets;
			} else {
				console.error(
					chalk.yellow(
						"  ⚠ No adapter files changed since last run — running full mutation suite.",
					),
				);
			}
		} else {
			console.error(
				chalk.yellow(
					"  ⚠ No baseline found in mutation history — falling back to full run.",
				),
			);
		}
	}

	// Step 3: Generate mutants for each adapter file (Req 5.3)
	const allMutants: Mutant[] = [];
	for (const filePath of adapterFiles) {
		const source = await readFile(filePath, "utf-8");
		const mutants = generateMutants(filePath, source, operators);
		allMutants.push(...mutants);
	}

	if (allMutants.length === 0) {
		console.error(chalk.yellow("No mutants generated — nothing to test."));
		return {
			totalMutants: 0,
			killed: 0,
			survived: 0,
			killRate: 1,
			survivors: [],
			operators,
			belowThreshold: false,
		};
	}

	console.error(
		chalk.dim(
			`  Generated ${allMutants.length} mutants across ${adapterFiles.length} adapter files.`,
		),
	);

	// Step 4: Run tests for each mutant (Req 5.4)
	let killed = 0;
	let survived = 0;
	const survivors: SurvivorReport[] = [];

	for (const mutant of allMutants) {
		const originalSource = await readFile(mutant.filePath, "utf-8");
		try {
			// Write mutated source in place
			await writeFile(mutant.filePath, mutant.mutatedSource, "utf-8");

			// Run bun test with 30s timeout (Req 5.4)
			try {
				execSync("bun test", {
					encoding: "utf-8",
					timeout: 30_000,
					stdio: "pipe",
				});
				// Tests passed — mutant survived
				survived++;
				survivors.push(toSurvivorReport(mutant));
			} catch {
				// Tests failed or timed out — mutant killed (Req 5.4)
				killed++;
			}
		} finally {
			// Always restore the original source
			await writeFile(mutant.filePath, originalSource, "utf-8");
		}
	}

	// Step 5: Compute kill rate (Req 5.5)
	const killRate = computeKillRate(killed, allMutants.length);
	const belowThreshold = killRate < threshold;

	// Step 6: Report surviving mutants (Req 5.9)
	reportSurvivors(survivors);

	// Step 7: Print summary
	const pct = (killRate * 100).toFixed(1);
	if (belowThreshold) {
		console.error(
			chalk.red(
				`  Kill rate: ${pct}% (${killed}/${allMutants.length}) — BELOW threshold ${(threshold * 100).toFixed(1)}%`,
			),
		);
		process.exitCode = 1;
	} else {
		console.error(
			chalk.green(
				`  Kill rate: ${pct}% (${killed}/${allMutants.length}) — above threshold ${(threshold * 100).toFixed(1)}%`,
			),
		);
	}

	// Step 8: Persist to history (Req 5.8)
	const record: MutationRunRecord = {
		ts: new Date().toISOString(),
		sha: gitSha(),
		killRate,
		totalMutants: allMutants.length,
		killed,
		survived,
		operators,
	};
	await appendRecord(historyPath, record);

	return {
		totalMutants: allMutants.length,
		killed,
		survived,
		killRate,
		survivors,
		operators,
		belowThreshold,
	};
}
