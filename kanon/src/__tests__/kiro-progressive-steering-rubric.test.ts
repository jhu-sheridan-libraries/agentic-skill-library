import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
	gradeProgressiveSteering,
	type ProgressiveSteeringResult,
	type Workload,
} from "../eval/rubrics/kiro-progressive-steering";

const KANON_ROOT = resolve(import.meta.dir, "../..");
const CLI_PATH = resolve(KANON_ROOT, "src/cli.ts");
const FIXTURES = resolve(
	import.meta.dir,
	"../../fixtures/eval/kiro-progressive-steering",
);

async function loadWorkload(scenarioDir: string): Promise<Workload[]> {
	const raw = await readFile(resolve(scenarioDir, "workload.json"), "utf-8");
	return JSON.parse(raw) as Workload[];
}

/**
 * Run the progressive-steering rubric through the real CLI, pointing --build at
 * the given path. Returns the parsed JSON result plus the process exit code.
 * Runs from the kanon root so scenario fixtures resolve relative to CWD.
 */
async function runRubricCli(buildPath: string): Promise<{
	exitCode: number;
	result: ProgressiveSteeringResult;
}> {
	const outDir = await mkdtemp(join(tmpdir(), "rubric-cli-"));
	const outPath = join(outDir, "rubric.json");
	try {
		const proc = Bun.spawn(
			[
				"bun",
				"run",
				CLI_PATH,
				"eval",
				"--harness",
				"kiro",
				"--rubric",
				"progressive-steering",
				"--build",
				buildPath,
				"--json",
				"--output",
				outPath,
			],
			{
				cwd: KANON_ROOT,
				stdout: "pipe",
				stderr: "pipe",
				env: { ...process.env, NO_COLOR: "1" },
			},
		);
		const exitCode = await proc.exited;
		const result = JSON.parse(
			await readFile(outPath, "utf-8"),
		) as ProgressiveSteeringResult;
		return { exitCode, result };
	} finally {
		await rm(outDir, { recursive: true, force: true });
	}
}

describe("kiro-progressive-steering rubric — scenario fixtures", () => {
	test("scenario-small grades Green with Score ≥ 80, AOCW ≤ 0.40, FMP ≥ 0.75", async () => {
		const scenarioDir = resolve(FIXTURES, "scenario-small");
		const buildDir = resolve(scenarioDir, "expected-build/dist/kiro");
		const workload = await loadWorkload(scenarioDir);

		const result = await gradeProgressiveSteering(buildDir, workload);

		expect(result.rating).toBe("green");
		expect(result.score).toBeGreaterThanOrEqual(80);
		expect(result.metrics.AOCW).toBeLessThanOrEqual(0.4);
		expect(result.metrics.FMP).toBeGreaterThanOrEqual(0.75);
	});

	test("scenario-mixed grades Green and matches per-metric targets within tolerance", async () => {
		const scenarioDir = resolve(FIXTURES, "scenario-mixed");
		const buildDir = resolve(scenarioDir, "expected-build/kiro");
		const workload = await loadWorkload(scenarioDir);

		const result = await gradeProgressiveSteering(buildDir, workload);

		// Overall rating and score
		expect(result.rating).toBe("green");
		expect(result.score).toBeGreaterThanOrEqual(80);

		// Per-metric targets from fixture README (within documented tolerance)
		// AOCW ≈ 0.20 (tolerance: ≤ 0.25)
		expect(result.metrics.AOCW).toBeLessThanOrEqual(0.25);

		// PR = 0.80 (tolerance: ≥ 0.75)
		expect(result.metrics.PR).toBeGreaterThanOrEqual(0.75);

		// FMP ≈ 0.85 (tolerance: ≥ 0.80)
		expect(result.metrics.FMP).toBeGreaterThanOrEqual(0.8);

		// MD ≈ 1.00 (tolerance: ≥ 0.95)
		expect(result.metrics.MD).toBeGreaterThanOrEqual(0.95);

		// DER ≈ 0.00 (tolerance: ≤ 0.05)
		expect(result.metrics.DER).toBeLessThanOrEqual(0.05);

		// WCA ≈ 1.00 (tolerance: ≥ 0.95)
		expect(result.metrics.WCA).toBeGreaterThanOrEqual(0.95);
	});

	test("scenario-anti grades Red", async () => {
		const scenarioDir = resolve(FIXTURES, "scenario-anti");
		const buildDir = resolve(scenarioDir, "expected-build/kiro");
		const workload = await loadWorkload(scenarioDir);

		const result = await gradeProgressiveSteering(buildDir, workload);

		expect(result.rating).toBe("red");
	});
});

describe("kiro-progressive-steering rubric — CLI --build path resolution", () => {
	// Regression: the CI job passed --build …/scenario-mixed/expected-build
	// (the PARENT of the harness dir). The grader derives each artifact's name
	// from the first path segment, so every file resolved to "kiro", which
	// zeroed FMP and MD and produced a false RED. The runner now auto-descends
	// into the kiro/ wrapper. Both the parent and the harness dir must grade
	// GREEN with exit 0.
	test("parent-of-harness build path grades Green (exit 0)", async () => {
		const parentPath =
			"fixtures/eval/kiro-progressive-steering/scenario-mixed/expected-build";
		const { exitCode, result } = await runRubricCli(parentPath);

		expect(exitCode).toBe(0);
		expect(result.rating).toBe("green");
		expect(result.metrics.FMP).toBeGreaterThanOrEqual(0.75);
		expect(result.metrics.MD).toBeGreaterThanOrEqual(0.5);
	});

	test("harness build path grades Green (exit 0)", async () => {
		const harnessPath =
			"fixtures/eval/kiro-progressive-steering/scenario-mixed/expected-build/kiro";
		const { exitCode, result } = await runRubricCli(harnessPath);

		expect(exitCode).toBe(0);
		expect(result.rating).toBe("green");
	});
});
