/**
 * Unit tests for src/rosetta/plan.ts
 *
 * Covers: plan schema validation, path normalization, duplicate detection,
 * file-operation bijection, deterministic ordering, operation withholding,
 * and createPlan helper.
 */

import { describe, expect, test } from "bun:test";
import { createDiagnostic } from "../rosetta/diagnostics";
import {
	createPlan,
	normalizePlanPath,
	sortPlanDeterministically,
	validatePlan,
	withholdBlockedOperations,
} from "../rosetta/plan";
import type {
	OutputFile,
	TranslationDiagnostic,
	TranslationPlan,
} from "../schemas";

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: build a minimal valid TranslationPlan
// ═══════════════════════════════════════════════════════════════════════════════

function makeValidPlan(overrides?: Partial<TranslationPlan>): TranslationPlan {
	return {
		schemaVersion: "1.0",
		formatId: "kiro",
		canonicalSchemaVersion: "1.0.0",
		outputFiles: [
			{ relativePath: "foo/bar.md", content: "# Hello", executable: false },
		],
		operations: [
			{ kind: "write-file", relativePath: "foo/bar.md", outputFileIndex: 0 },
		],
		applicationState: "eligible",
		policyDiagnosticCodes: [],
		...overrides,
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// normalizePlanPath
// ═══════════════════════════════════════════════════════════════════════════════

describe("normalizePlanPath", () => {
	test("normalizes a valid path", () => {
		const result = normalizePlanPath("src/file.ts");
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.normalized).toBe("src/file.ts");
	});

	test("replaces backslashes with forward slashes", () => {
		const result = normalizePlanPath("src\\dir\\file.ts");
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.normalized).toBe("src/dir/file.ts");
	});

	test("applies NFC normalization", () => {
		// Combining sequence: e + combining acute accent
		const decomposed = "e\u0301"; // NFD form
		const result = normalizePlanPath(decomposed);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.normalized).toBe("\u00e9"); // NFC: single char e-acute
	});

	test("rejects empty path", () => {
		const result = normalizePlanPath("");
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain("empty");
	});

	test("rejects NUL character", () => {
		const result = normalizePlanPath("foo\0bar");
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain("NUL");
	});

	test("rejects absolute path starting with /", () => {
		const result = normalizePlanPath("/usr/bin/foo");
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain("absolute");
	});

	test("rejects drive-letter prefix", () => {
		const result = normalizePlanPath("C:\\Users\\file.txt");
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain("drive");
	});

	test("rejects UNC paths", () => {
		const result = normalizePlanPath("\\\\server\\share");
		expect(result.ok).toBe(false);
		// After backslash replacement it becomes //server/share which is absolute
		if (!result.ok) expect(result.error).toMatch(/absolute|UNC/);
	});

	test("rejects empty segments (double slash)", () => {
		const result = normalizePlanPath("foo//bar");
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain("empty");
	});

	test("rejects dot segments", () => {
		const result = normalizePlanPath("foo/./bar");
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain("'.'");
	});

	test("rejects traversal segments", () => {
		const result = normalizePlanPath("foo/../bar");
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain("traversal");
	});

	test("handles single-segment paths", () => {
		const result = normalizePlanPath("readme.md");
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.normalized).toBe("readme.md");
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// validatePlan
// ═══════════════════════════════════════════════════════════════════════════════

describe("validatePlan", () => {
	test("accepts a valid plan", () => {
		const plan = makeValidPlan();
		const result = validatePlan(plan);
		expect(result.valid).toBe(true);
		expect(result.diagnostics).toHaveLength(0);
		expect(result.plan).not.toBeNull();
	});

	test("rejects a plan failing Zod schema (missing schemaVersion)", () => {
		const plan = { ...makeValidPlan(), schemaVersion: undefined };
		const result = validatePlan(plan);
		expect(result.valid).toBe(false);
		expect(
			result.diagnostics.some((d) => d.code === "RS_PLAN_SCHEMA_INVALID"),
		).toBe(true);
		expect(result.plan).toBeNull();
	});

	test("rejects a plan with invalid formatId", () => {
		const plan = { ...makeValidPlan(), formatId: "INVALID CAPS" };
		const result = validatePlan(plan);
		expect(result.valid).toBe(false);
		expect(
			result.diagnostics.some((d) => d.code === "RS_PLAN_SCHEMA_INVALID"),
		).toBe(true);
	});

	test("detects duplicate normalized output paths", () => {
		const plan = makeValidPlan({
			outputFiles: [
				{ relativePath: "src/file.ts", content: "a", executable: false },
				{ relativePath: "src/file.ts", content: "b", executable: false },
			],
			operations: [
				{ kind: "write-file", relativePath: "src/file.ts", outputFileIndex: 0 },
				{ kind: "write-file", relativePath: "src/file.ts", outputFileIndex: 1 },
			],
		});
		const result = validatePlan(plan);
		expect(result.valid).toBe(false);
		expect(
			result.diagnostics.some((d) => d.code === "RS_PLAN_DUPLICATE_PATH"),
		).toBe(true);
	});

	test("detects orphan operation (out-of-bounds index)", () => {
		const plan = makeValidPlan({
			operations: [
				{ kind: "write-file", relativePath: "foo/bar.md", outputFileIndex: 5 },
			],
		});
		const result = validatePlan(plan);
		expect(result.valid).toBe(false);
		expect(
			result.diagnostics.some((d) => d.code === "RS_PLAN_ORPHAN_OPERATION"),
		).toBe(true);
	});

	test("detects orphan file (no operation references it)", () => {
		const plan = makeValidPlan({
			outputFiles: [
				{ relativePath: "foo/bar.md", content: "# Hello", executable: false },
				{ relativePath: "baz/qux.md", content: "# World", executable: false },
			],
			operations: [
				{ kind: "write-file", relativePath: "foo/bar.md", outputFileIndex: 0 },
			],
		});
		const result = validatePlan(plan);
		expect(result.valid).toBe(false);
		expect(
			result.diagnostics.some((d) => d.code === "RS_PLAN_ORPHAN_FILE"),
		).toBe(true);
	});

	test("detects empty content on write operations", () => {
		const plan = makeValidPlan({
			outputFiles: [
				{ relativePath: "foo/bar.md", content: "", executable: false },
			],
		});
		const result = validatePlan(plan);
		expect(result.valid).toBe(false);
		expect(
			result.diagnostics.some((d) => d.code === "RS_PLAN_ORPHAN_OPERATION"),
		).toBe(true);
	});

	test("detects multiple operations referencing the same output file", () => {
		const plan = makeValidPlan({
			outputFiles: [
				{ relativePath: "foo/bar.md", content: "content", executable: false },
			],
			operations: [
				{ kind: "write-file", relativePath: "foo/bar.md", outputFileIndex: 0 },
				{ kind: "write-file", relativePath: "foo/bar.md", outputFileIndex: 0 },
			],
		});
		const result = validatePlan(plan);
		expect(result.valid).toBe(false);
		expect(
			result.diagnostics.some((d) => d.code === "RS_PLAN_DUPLICATE_PATH"),
		).toBe(true);
	});

	test("passes with Uint8Array content", () => {
		const plan = makeValidPlan({
			outputFiles: [
				{
					relativePath: "bin/output",
					content: new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]),
					executable: true,
				},
			],
			operations: [
				{ kind: "write-file", relativePath: "bin/output", outputFileIndex: 0 },
			],
		});
		const result = validatePlan(plan);
		expect(result.valid).toBe(true);
		expect(result.diagnostics).toHaveLength(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// sortPlanDeterministically
// ═══════════════════════════════════════════════════════════════════════════════

describe("sortPlanDeterministically", () => {
	test("sorts output files by code-point order", () => {
		const plan = makeValidPlan({
			outputFiles: [
				{ relativePath: "z-file.md", content: "z", executable: false },
				{ relativePath: "a-file.md", content: "a", executable: false },
				{ relativePath: "m-file.md", content: "m", executable: false },
			],
			operations: [
				{ kind: "write-file", relativePath: "z-file.md", outputFileIndex: 0 },
				{ kind: "write-file", relativePath: "a-file.md", outputFileIndex: 1 },
				{ kind: "write-file", relativePath: "m-file.md", outputFileIndex: 2 },
			],
		});

		const sorted = sortPlanDeterministically(plan);
		expect(sorted.outputFiles[0].relativePath).toBe("a-file.md");
		expect(sorted.outputFiles[1].relativePath).toBe("m-file.md");
		expect(sorted.outputFiles[2].relativePath).toBe("z-file.md");
	});

	test("reindexes operations after sorting", () => {
		const plan = makeValidPlan({
			outputFiles: [
				{ relativePath: "z-file.md", content: "z", executable: false },
				{ relativePath: "a-file.md", content: "a", executable: false },
			],
			operations: [
				{ kind: "write-file", relativePath: "z-file.md", outputFileIndex: 0 },
				{ kind: "write-file", relativePath: "a-file.md", outputFileIndex: 1 },
			],
		});

		const sorted = sortPlanDeterministically(plan);
		// After sort: a-file.md is index 0, z-file.md is index 1
		expect(sorted.operations[0].outputFileIndex).toBe(0);
		expect(sorted.operations[0].relativePath).toBe("a-file.md");
		expect(sorted.operations[1].outputFileIndex).toBe(1);
		expect(sorted.operations[1].relativePath).toBe("z-file.md");
	});

	test("operations sort by path then kind", () => {
		const plan = makeValidPlan({
			outputFiles: [
				{ relativePath: "b.md", content: "b", executable: false },
				{ relativePath: "a.md", content: "a", executable: false },
			],
			operations: [
				{ kind: "write-file", relativePath: "b.md", outputFileIndex: 0 },
				{ kind: "write-file", relativePath: "a.md", outputFileIndex: 1 },
			],
		});

		const sorted = sortPlanDeterministically(plan);
		expect(sorted.operations[0].relativePath).toBe("a.md");
		expect(sorted.operations[1].relativePath).toBe("b.md");
	});

	test("is idempotent", () => {
		const plan = makeValidPlan({
			outputFiles: [
				{ relativePath: "c.md", content: "c", executable: false },
				{ relativePath: "a.md", content: "a", executable: false },
				{ relativePath: "b.md", content: "b", executable: false },
			],
			operations: [
				{ kind: "write-file", relativePath: "c.md", outputFileIndex: 0 },
				{ kind: "write-file", relativePath: "a.md", outputFileIndex: 1 },
				{ kind: "write-file", relativePath: "b.md", outputFileIndex: 2 },
			],
		});

		const sorted1 = sortPlanDeterministically(plan);
		const sorted2 = sortPlanDeterministically(sorted1);
		expect(sorted1.outputFiles.map((f) => f.relativePath)).toEqual(
			sorted2.outputFiles.map((f) => f.relativePath),
		);
		expect(sorted1.operations.map((o) => o.outputFileIndex)).toEqual(
			sorted2.operations.map((o) => o.outputFileIndex),
		);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// withholdBlockedOperations
// ═══════════════════════════════════════════════════════════════════════════════

describe("withholdBlockedOperations", () => {
	test("returns eligible when no blocking diagnostics", () => {
		const plan = makeValidPlan();
		const result = withholdBlockedOperations(plan, []);
		expect(result.applicationState).toBe("eligible");
		expect(result.operations).toHaveLength(1);
	});

	test("withholds operations affected by blocking diagnostics with matching path", () => {
		const plan = makeValidPlan({
			outputFiles: [
				{ relativePath: "foo/bar.md", content: "a", executable: false },
				{ relativePath: "baz/qux.md", content: "b", executable: false },
			],
			operations: [
				{ kind: "write-file", relativePath: "foo/bar.md", outputFileIndex: 0 },
				{ kind: "write-file", relativePath: "baz/qux.md", outputFileIndex: 1 },
			],
		});

		const blockingDiags: TranslationDiagnostic[] = [
			createDiagnostic("RS_PLAN_INVALID_PATH", {
				source: { path: "foo/bar.md" },
			}),
		];

		const result = withholdBlockedOperations(plan, blockingDiags);
		expect(result.operations).toHaveLength(1);
		expect(result.operations[0].relativePath).toBe("baz/qux.md");
		expect(result.applicationState).toBe("policy-required");
		expect(result.policyDiagnosticCodes).toContain("RS_PLAN_INVALID_PATH");
	});

	test("withholds entire plan when all operations affected", () => {
		const plan = makeValidPlan();
		const blockingDiags: TranslationDiagnostic[] = [
			createDiagnostic("RS_PLAN_INVALID_PATH", {
				source: { path: "foo/bar.md" },
			}),
		];

		const result = withholdBlockedOperations(plan, blockingDiags);
		expect(result.operations).toHaveLength(0);
		expect(result.applicationState).toBe("withheld");
	});

	test("withholds entire plan when blocking diagnostics have no path", () => {
		const plan = makeValidPlan();
		const blockingDiags: TranslationDiagnostic[] = [
			createDiagnostic("RS_PLAN_SCHEMA_INVALID"),
		];

		const result = withholdBlockedOperations(plan, blockingDiags);
		expect(result.applicationState).toBe("withheld");
		expect(result.operations).toHaveLength(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// createPlan
// ═══════════════════════════════════════════════════════════════════════════════

describe("createPlan", () => {
	test("creates a valid plan with defaults", () => {
		const outputFiles: OutputFile[] = [
			{
				relativePath: "src/main.ts",
				content: "export default {};",
				executable: false,
			},
		];

		const plan = createPlan("kiro", "1.0.0", outputFiles);
		expect(plan.schemaVersion).toBe("1.0");
		expect(plan.formatId).toBe("kiro");
		expect(plan.canonicalSchemaVersion).toBe("1.0.0");
		expect(plan.applicationState).toBe("eligible");
		expect(plan.policyDiagnosticCodes).toEqual([]);
		expect(plan.outputFiles).toHaveLength(1);
		expect(plan.operations).toHaveLength(1);
		expect(plan.operations[0].kind).toBe("write-file");
	});

	test("sorts output files deterministically", () => {
		const outputFiles: OutputFile[] = [
			{ relativePath: "z-file.md", content: "z", executable: false },
			{ relativePath: "a-file.md", content: "a", executable: false },
		];

		const plan = createPlan("kiro", "1.0.0", outputFiles);
		expect(plan.outputFiles[0].relativePath).toBe("a-file.md");
		expect(plan.outputFiles[1].relativePath).toBe("z-file.md");
	});

	test("accepts optional variant and application state", () => {
		const outputFiles: OutputFile[] = [
			{ relativePath: "file.md", content: "content", executable: false },
		];

		const plan = createPlan("kiro", "1.0.0", outputFiles, {
			variant: "power",
			applicationState: "policy-required",
			policyDiagnosticCodes: ["RS_PLAN_WITHHELD"],
		});

		expect(plan.variant).toBe("power");
		expect(plan.applicationState).toBe("policy-required");
		expect(plan.policyDiagnosticCodes).toEqual(["RS_PLAN_WITHHELD"]);
	});

	test("generates one write-file operation per output file", () => {
		const outputFiles: OutputFile[] = [
			{ relativePath: "a.md", content: "a", executable: false },
			{ relativePath: "b.md", content: "b", executable: false },
			{ relativePath: "c.md", content: "c", executable: false },
		];

		const plan = createPlan("kiro", "1.0.0", outputFiles);
		expect(plan.operations).toHaveLength(3);
		for (const op of plan.operations) {
			expect(op.kind).toBe("write-file");
		}
	});
});
