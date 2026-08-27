#!/usr/bin/env bun

/**
 * One-shot Rosetta Stone validation entry point.
 *
 * Runs, in order and once each (never in watch mode):
 *   1. Targeted `bun test src/__tests__/rosetta-*.test.ts` suites
 *   2. The full `bun test` suite
 *   3. `bun x tsc --noEmit` (type check)
 *   4. `bun run lint` (Biome)
 *
 * Every step inherits stdio so raw fast-check counterexamples and minimized
 * failing examples are preserved verbatim. The first failing step aborts the
 * run and the script exits with that step's nonzero status, so the command is
 * safe to use as a release/CI gate.
 *
 * Usage:
 *   bun run validate:rosetta
 *   bun run scripts/validate-rosetta.ts
 *
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 16.10
 */

import { resolve } from "node:path";
import { Glob } from "bun";

interface ValidationStep {
	readonly name: string;
	readonly command: readonly string[];
}

const projectRoot: string = resolve(import.meta.dir, "..");

/**
 * Glob matching every targeted Rosetta Stone test suite, including the
 * `*.property.test.ts` fast-check suites (they end in `.test.ts`).
 */
const ROSETTA_TEST_GLOB = "src/__tests__/rosetta-*.test.ts";

/**
 * Resolve the targeted Rosetta test files up front. `bun test` treats a bare
 * `rosetta-*.test.ts` argument as a test-name filter rather than a path glob,
 * so the files are expanded here and passed explicitly. Sorted for
 * deterministic invocation order.
 *
 * @returns Sorted relative paths to every targeted Rosetta test file.
 */
function resolveRosettaTestFiles(): readonly string[] {
	const glob = new Glob(ROSETTA_TEST_GLOB);
	const files: string[] = [];
	for (const match of glob.scanSync({ cwd: projectRoot })) {
		files.push(match);
	}
	return files.sort((left: string, right: string): number =>
		left < right ? -1 : left > right ? 1 : 0,
	);
}

/**
 * Ordered validation steps. The targeted Rosetta suites run first so a
 * Rosetta-specific regression surfaces before the (slower) full suite,
 * type check, and lint. All test invocations are one-shot: `bun test`
 * exits after a single run and is never placed in watch mode.
 */
function buildSteps(): readonly ValidationStep[] {
	const rosettaTestFiles: readonly string[] = resolveRosettaTestFiles();

	if (rosettaTestFiles.length === 0) {
		console.error(
			`No Rosetta test files matched "${ROSETTA_TEST_GLOB}". Expected targeted suites under src/__tests__/.`,
		);
		process.exit(1);
	}

	console.log(
		`Found ${rosettaTestFiles.length} targeted Rosetta test file(s).`,
	);

	return [
		{
			name: "Targeted Rosetta test suites",
			command: ["bun", "test", ...rosettaTestFiles],
		},
		{
			name: "Full Bun test suite",
			command: ["bun", "test"],
		},
		{
			name: "Type check (tsc --noEmit)",
			command: ["bun", "x", "tsc", "--noEmit"],
		},
		{
			name: "Lint (biome check)",
			command: ["bun", "run", "lint"],
		},
	];
}

/**
 * Run a single validation step, inheriting stdio so raw tool output
 * (including fast-check counterexamples) reaches the terminal unaltered.
 *
 * @param step - The named command to execute.
 * @returns The process exit code (0 on success, nonzero on failure).
 */
async function runStep(step: ValidationStep): Promise<number> {
	console.log(`\n=== ${step.name} ===`);
	console.log(`$ ${step.command.join(" ")}`);

	const proc = Bun.spawn({
		cmd: [...step.command],
		cwd: projectRoot,
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
	});

	const exitCode: number = await proc.exited;

	if (exitCode !== 0) {
		console.error(`\n✖ Step failed: ${step.name} (exit code ${exitCode})`);
	} else {
		console.log(`\n✔ Step passed: ${step.name}`);
	}

	return exitCode;
}

/**
 * Execute every validation step in order, stopping at the first failure and
 * propagating its nonzero exit status.
 */
async function main(): Promise<void> {
	const steps: readonly ValidationStep[] = buildSteps();
	for (const step of steps) {
		const exitCode: number = await runStep(step);
		if (exitCode !== 0) {
			console.error(
				`\nRosetta Stone validation aborted at "${step.name}". Fix the reported failures and re-run.`,
			);
			process.exit(exitCode);
		}
	}

	console.log("\nAll Rosetta Stone validation steps passed.");
}

await main();
