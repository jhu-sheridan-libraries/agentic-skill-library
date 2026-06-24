import { describe, expect, test } from "bun:test";
import {
	aggregateOutcomes,
	type OutcomeRef,
	runRegistryCheck,
} from "../outcomes/registry";
import type { Outcome } from "../schemas";

// --- Helpers ---

function outcome(overrides: Partial<Outcome> & { id: string }): Outcome {
	return {
		id: overrides.id,
		kind: overrides.kind ?? "operation",
		inputShape: overrides.inputShape ?? "string",
		outputShape: overrides.outputShape ?? "number",
		summary: overrides.summary ?? "summary",
		keywords: overrides.keywords ?? [],
		related: overrides.related ?? [],
	};
}

function ref(artifactName: string, o: Outcome): OutcomeRef {
	return { artifactName, outcome: o };
}

// --- aggregateOutcomes ---

describe("aggregateOutcomes", () => {
	test("flattens outcomes with artifact attribution, preserving order", () => {
		const a1 = outcome({ id: "out-a" });
		const a2 = outcome({ id: "out-b" });
		const b1 = outcome({ id: "out-c" });
		const refs = aggregateOutcomes([
			{ name: "alpha", outcomes: [a1, a2] },
			{ name: "beta", outcomes: [b1] },
		]);
		expect(refs).toEqual([
			{ artifactName: "alpha", outcome: a1 },
			{ artifactName: "alpha", outcome: a2 },
			{ artifactName: "beta", outcome: b1 },
		]);
	});

	test("returns empty array when no artifacts or no outcomes", () => {
		expect(aggregateOutcomes([])).toEqual([]);
		expect(aggregateOutcomes([{ name: "empty", outcomes: [] }])).toEqual([]);
	});
});

// --- runRegistryCheck ---

describe("runRegistryCheck", () => {
	test("clean set produces no findings and no errors", () => {
		const refs = [
			ref(
				"a",
				outcome({
					id: "out-a",
					inputShape: "string",
					outputShape: "number",
					keywords: ["alpha"],
				}),
			),
			ref(
				"b",
				outcome({
					id: "out-b",
					inputShape: "boolean",
					outputShape: "void",
					keywords: ["bravo"],
				}),
			),
		];
		const report = runRegistryCheck(refs);
		expect(report.findings).toEqual([]);
		expect(report.hasErrors).toBe(false);
	});

	test("detects duplicate ids as an error", () => {
		const refs = [
			ref(
				"a",
				outcome({ id: "out-dup", inputShape: "string", outputShape: "number" }),
			),
			ref(
				"b",
				outcome({ id: "out-dup", inputShape: "boolean", outputShape: "void" }),
			),
		];
		const report = runRegistryCheck(refs);
		const dup = report.findings.filter((f) => f.kind === "duplicate-id");
		expect(dup).toHaveLength(1);
		expect(report.hasErrors).toBe(true);
	});

	test("non-acknowledged collision is an error with shapes and jaccard", () => {
		const refs = [
			ref(
				"a",
				outcome({
					id: "out-a",
					inputShape: "String",
					outputShape: "Number",
					keywords: ["parse", "json"],
				}),
			),
			ref(
				"b",
				outcome({
					id: "out-b",
					inputShape: "string",
					outputShape: "number",
					keywords: ["parse", "json"],
				}),
			),
		];
		const report = runRegistryCheck(refs);
		const collision = report.findings.find((f) => f.kind === "collision");
		expect(collision).toBeDefined();
		expect(collision?.inputShape).toBe("string");
		expect(collision?.outputShape).toBe("number");
		expect(collision?.jaccard).toBe(1);
		expect(report.hasErrors).toBe(true);
	});

	test("collision finding carries both outcome IDs and both artifact names (Req 2F.2)", () => {
		const refs = [
			ref(
				"json-parser",
				outcome({
					id: "out-a",
					inputShape: "string",
					outputShape: "number",
					keywords: ["parse", "json"],
				}),
			),
			ref(
				"config-loader",
				outcome({
					id: "out-b",
					inputShape: "string",
					outputShape: "number",
					keywords: ["parse", "json"],
				}),
			),
		];
		const report = runRegistryCheck(refs);
		const collision = report.findings.find((f) => f.kind === "collision");
		expect(collision).toBeDefined();
		// Both outcome IDs must be present on the finding (2F.2).
		const ids = [collision?.a.outcome.id, collision?.b.outcome.id].sort();
		expect(ids).toEqual(["out-a", "out-b"]);
		// Both artifact names must be present on the finding (2F.2).
		const names = [collision?.a.artifactName, collision?.b.artifactName].sort();
		expect(names).toEqual(["config-loader", "json-parser"]);
		// And the matching shapes + Jaccard travel with the finding for diagnostics.
		expect(collision?.inputShape).toBe("string");
		expect(collision?.outputShape).toBe("number");
		expect(collision?.jaccard).toBe(1);
	});

	test("mutually acknowledged collision downgrades to acknowledged-overlap (no error)", () => {
		const refs = [
			ref(
				"a",
				outcome({
					id: "out-a",
					inputShape: "string",
					outputShape: "number",
					keywords: ["parse", "json"],
					related: ["out-b"],
				}),
			),
			ref(
				"b",
				outcome({
					id: "out-b",
					inputShape: "string",
					outputShape: "number",
					keywords: ["parse", "json"],
					related: ["out-a"],
				}),
			),
		];
		const report = runRegistryCheck(refs);
		expect(report.findings.map((f) => f.kind)).toEqual([
			"acknowledged-overlap",
		]);
		expect(report.hasErrors).toBe(false);
	});

	test("one-sided related is NOT acknowledged — still a collision", () => {
		const refs = [
			ref(
				"a",
				outcome({
					id: "out-a",
					inputShape: "string",
					outputShape: "number",
					keywords: ["parse", "json"],
					related: ["out-b"],
				}),
			),
			ref(
				"b",
				outcome({
					id: "out-b",
					inputShape: "string",
					outputShape: "number",
					keywords: ["parse", "json"],
					related: [],
				}),
			),
		];
		const report = runRegistryCheck(refs);
		expect(report.findings.map((f) => f.kind)).toEqual(["collision"]);
		expect(report.hasErrors).toBe(true);
	});

	test("ambiguous match (one tier only) is a warning, not an error", () => {
		const refs = [
			ref(
				"a",
				outcome({
					id: "out-a",
					inputShape: "string",
					outputShape: "number",
					keywords: ["alpha", "beta"],
				}),
			),
			ref(
				"b",
				outcome({
					id: "out-b",
					inputShape: "string",
					outputShape: "number",
					keywords: ["gamma", "delta"],
				}),
			),
		];
		const report = runRegistryCheck(refs);
		expect(report.findings.map((f) => f.kind)).toEqual(["ambiguous"]);
		expect(report.hasErrors).toBe(false);
	});

	test("evaluates each unordered pair once", () => {
		const refs = [
			ref(
				"a",
				outcome({
					id: "out-a",
					inputShape: "string",
					outputShape: "number",
					keywords: ["parse", "json", "user"],
				}),
			),
			ref(
				"b",
				outcome({
					id: "out-b",
					inputShape: "string",
					outputShape: "number",
					keywords: ["parse", "json", "user"],
				}),
			),
			ref(
				"c",
				outcome({
					id: "out-c",
					inputShape: "string",
					outputShape: "number",
					keywords: ["parse", "json", "user"],
				}),
			),
		];
		const report = runRegistryCheck(refs);
		// 3 outcomes, all colliding -> C(3,2) = 3 collision findings.
		expect(report.findings.filter((f) => f.kind === "collision")).toHaveLength(
			3,
		);
	});
});
