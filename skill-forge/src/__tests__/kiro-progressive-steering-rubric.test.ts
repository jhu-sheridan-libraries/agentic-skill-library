import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
	gradeProgressiveSteering,
	type Workload,
} from "../eval/rubrics/kiro-progressive-steering";

const FIXTURES = resolve(
	import.meta.dir,
	"../../fixtures/eval/kiro-progressive-steering",
);

async function loadWorkload(scenarioDir: string): Promise<Workload[]> {
	const raw = await readFile(resolve(scenarioDir, "workload.json"), "utf-8");
	return JSON.parse(raw) as Workload[];
}

describe("kiro-progressive-steering rubric — scenario fixtures", () => {
	test("scenario-small grades Green with Score ≥ 80, AOCW ≤ 0.40, FMP ≥ 0.75", async () => {
		const scenarioDir = resolve(FIXTURES, "scenario-small");
		const buildDir = resolve(scenarioDir, "expected-build/dist/kiro");
		const workload = await loadWorkload(scenarioDir);

		const result = await gradeProgressiveSteering(buildDir, workload);

		expect(result.rating).toBe("green");
		expect(result.score).toBeGreaterThanOrEqual(80);
		expect(result.metrics.AOCW).toBeLessThanOrEqual(0.40);
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
		expect(result.metrics.FMP).toBeGreaterThanOrEqual(0.80);

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
