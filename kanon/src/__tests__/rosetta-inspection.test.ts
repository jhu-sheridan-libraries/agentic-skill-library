/**
 * Unit tests for src/rosetta/inspection.ts
 *
 * Validates deterministic InspectionReport construction,
 * ordering guarantees, and envelope validation.
 */

import { describe, expect, test } from "bun:test";
import type { TranslationDiagnostic } from "../schemas";
import {
	type InspectionContext,
	type InspectionReport,
	buildInspectionReport,
	validateInspectionReport,
} from "../rosetta/inspection";

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function buildMinimalContext(
	overrides: Partial<InspectionContext> = {},
): InspectionContext {
	return {
		request: {
			direction: "source",
			sourceFormat: "kiro",
			strict: false,
			dryRun: false,
		},
		format: {
			formatId: "kiro",
			contractVersion: "1.0.0",
			lifecycle: "active",
		},
		options: {
			effective: {},
			origins: {},
			defaults: {},
		},
		diagnostics: [],
		previewAvailable: true,
		...overrides,
	};
}

function makeDiagnostic(
	overrides: Partial<TranslationDiagnostic> = {},
): TranslationDiagnostic {
	return {
		code: "RS_TEST_CODE",
		severity: "info",
		phase: "request",
		message: "Test diagnostic",
		remediation: "No action needed",
		blocking: false,
		unavailableDetails: [],
		...overrides,
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// buildInspectionReport
// ═══════════════════════════════════════════════════════════════════════════════

describe("buildInspectionReport", () => {
	test("returns a frozen report with schemaVersion 1.0", () => {
		const ctx = buildMinimalContext();
		const report = buildInspectionReport(ctx);

		expect(report.schemaVersion).toBe("1.0");
		expect(Object.isFrozen(report)).toBe(true);
	});

	test("projects request summary from context", () => {
		const ctx = buildMinimalContext({
			request: {
				direction: "bidirectional",
				sourceFormat: "kiro",
				targetFormat: "cursor",
				strict: true,
				dryRun: true,
			},
		});
		const report = buildInspectionReport(ctx);

		expect(report.request.direction).toBe("bidirectional");
		expect(report.request.sourceFormat).toBe("kiro");
		expect(report.request.targetFormat).toBe("cursor");
		expect(report.request.strict).toBe(true);
		expect(report.request.dryRun).toBe(true);
	});

	test("omits detection when not provided", () => {
		const ctx = buildMinimalContext();
		const report = buildInspectionReport(ctx);

		expect(report.detection).toBeUndefined();
	});

	test("projects detection summary with sorted candidates", () => {
		const ctx = buildMinimalContext({
			detection: {
				candidates: [
					{
						formatId: "cursor",
						confidence: 0.8,
						threshold: 0.7,
						qualifies: true,
						evidence: [
							{
								ruleId: "r1",
								kind: "path-glob",
								outcome: "matched",
								paths: ["file.md"],
							},
						],
					},
					{
						formatId: "kiro",
						confidence: 0.95,
						threshold: 0.7,
						qualifies: true,
						evidence: [
							{
								ruleId: "r2",
								kind: "path-glob",
								outcome: "matched",
								paths: ["a.md"],
							},
							{
								ruleId: "r3",
								kind: "path-glob",
								outcome: "matched",
								paths: ["b.md"],
							},
						],
					},
				],
				selectedFormatId: "kiro",
				ambiguous: false,
			},
		});
		const report = buildInspectionReport(ctx);

		expect(report.detection).toBeDefined();
		expect(report.detection!.candidates).toHaveLength(2);
		// Sorted by confidence descending: kiro (0.95) first, cursor (0.8) second
		expect(report.detection!.candidates[0].formatId).toBe("kiro");
		expect(report.detection!.candidates[0].confidence).toBe(0.95);
		expect(report.detection!.candidates[0].evidenceCount).toBe(2);
		expect(report.detection!.candidates[1].formatId).toBe("cursor");
		expect(report.detection!.candidates[1].confidence).toBe(0.8);
		expect(report.detection!.candidates[1].evidenceCount).toBe(1);
		expect(report.detection!.selectedFormatId).toBe("kiro");
		expect(report.detection!.ambiguous).toBe(false);
	});

	test("sorts tied-confidence candidates by formatId code-point order", () => {
		const ctx = buildMinimalContext({
			detection: {
				candidates: [
					{
						formatId: "windsurf",
						confidence: 0.9,
						threshold: 0.7,
						qualifies: true,
						evidence: [],
					},
					{
						formatId: "cursor",
						confidence: 0.9,
						threshold: 0.7,
						qualifies: true,
						evidence: [],
					},
				],
				ambiguous: true,
			},
		});
		const report = buildInspectionReport(ctx);

		// Same confidence — sorted by formatId: cursor < windsurf
		expect(report.detection!.candidates[0].formatId).toBe("cursor");
		expect(report.detection!.candidates[1].formatId).toBe("windsurf");
	});

	test("projects format summary with variant", () => {
		const ctx = buildMinimalContext({
			format: {
				formatId: "kiro",
				contractVersion: "2.0.0",
				canonicalVersionRange: ">=1.0.0 <3.0.0",
				lifecycle: "active",
			},
			variant: { id: "steering" },
		});
		const report = buildInspectionReport(ctx);

		expect(report.format.formatId).toBe("kiro");
		expect(report.format.variant).toBe("steering");
		expect(report.format.contractVersion).toBe("2.0.0");
		expect(report.format.canonicalVersionRange).toBe(">=1.0.0 <3.0.0");
		expect(report.format.lifecycle).toBe("active");
	});

	test("projects canonical summary from artifact", () => {
		const ctx = buildMinimalContext({
			artifact: {
				schemaVersion: "1.0",
				name: "my-skill",
				type: "skill",
				harnesses: ["kiro", "cursor", "claude-code"],
				hookCount: 3,
				mcpServerCount: 1,
				workflowCount: 2,
				bodyOverrideCount: 1,
			},
		});
		const report = buildInspectionReport(ctx);

		expect(report.canonical.schemaVersion).toBe("1.0");
		expect(report.canonical.artifactName).toBe("my-skill");
		expect(report.canonical.type).toBe("skill");
		// Harnesses sorted by code-point order
		expect(report.canonical.harnesses).toEqual([
			"claude-code",
			"cursor",
			"kiro",
		]);
		expect(report.canonical.hookCount).toBe(3);
		expect(report.canonical.mcpServerCount).toBe(1);
		expect(report.canonical.workflowCount).toBe(2);
		expect(report.canonical.bodyOverrideCount).toBe(1);
	});

	test("provides defaults for missing artifact", () => {
		const ctx = buildMinimalContext();
		const report = buildInspectionReport(ctx);

		expect(report.canonical.schemaVersion).toBe("1.0");
		expect(report.canonical.harnesses).toEqual([]);
		expect(report.canonical.hookCount).toBe(0);
		expect(report.canonical.mcpServerCount).toBe(0);
	});

	test("sorts options keys by code-point order", () => {
		const ctx = buildMinimalContext({
			options: {
				effective: { zoo: true, alpha: "a", beta: 2 },
				origins: {
					zoo: "explicit",
					alpha: "profile",
					beta: "contract-default",
				},
				defaults: { beta: 2 },
			},
		});
		const report = buildInspectionReport(ctx);

		expect(Object.keys(report.options.effective)).toEqual([
			"alpha",
			"beta",
			"zoo",
		]);
		expect(Object.keys(report.options.origins)).toEqual([
			"alpha",
			"beta",
			"zoo",
		]);
		expect(Object.keys(report.options.defaults)).toEqual(["beta"]);
	});

	test("projects compatibility summary with degradation counts", () => {
		const ctx = buildMinimalContext({
			compatibility: {
				fullCount: 5,
				partialCount: 2,
				noneCount: 1,
				degradations: [
					{
						capability: "workflows",
						canonicalPaths: ["workflows"],
						action: "omit",
						affectedValueCount: 1,
					},
					{
						capability: "hooks",
						canonicalPaths: ["hooks"],
						action: "comment",
						affectedValueCount: 2,
					},
				],
				strictPromoted: true,
			},
		});
		const report = buildInspectionReport(ctx);

		expect(report.compatibility.fullCount).toBe(5);
		expect(report.compatibility.partialCount).toBe(2);
		expect(report.compatibility.noneCount).toBe(1);
		expect(report.compatibility.strictPromoted).toBe(true);
		// Degradations sorted by capability code-point: hooks < workflows
		expect(Object.keys(report.compatibility.degradations)).toEqual([
			"hooks",
			"workflows",
		]);
		expect(report.compatibility.degradations.hooks).toBe("comment");
		expect(report.compatibility.degradations.workflows).toBe("omit");
	});

	test("sorts diagnostics deterministically and counts by severity", () => {
		const ctx = buildMinimalContext({
			diagnostics: [
				makeDiagnostic({ code: "RS_B_WARNING", severity: "warning" }),
				makeDiagnostic({
					code: "RS_A_ERROR",
					severity: "error",
					blocking: true,
				}),
				makeDiagnostic({ code: "RS_C_INFO", severity: "info" }),
			],
		});
		const report = buildInspectionReport(ctx);

		expect(report.diagnostics.errorCount).toBe(1);
		expect(report.diagnostics.warningCount).toBe(1);
		expect(report.diagnostics.infoCount).toBe(1);
		// Sorted by severity: error, warning, info
		expect(report.diagnostics.diagnostics[0].code).toBe("RS_A_ERROR");
		expect(report.diagnostics.diagnostics[1].code).toBe("RS_B_WARNING");
		expect(report.diagnostics.diagnostics[2].code).toBe("RS_C_INFO");
		// Blocking codes sorted
		expect(report.diagnostics.blocking).toEqual(["RS_A_ERROR"]);
	});

	test("projects plan summary with sorted paths", () => {
		const ctx = buildMinimalContext({
			plan: {
				schemaVersion: "1.0",
				formatId: "kiro",
				variant: "steering",
				canonicalSchemaVersion: "1.0.0",
				outputFiles: [
					{
						relativePath: "z-file.md",
						content: "content",
						executable: false,
					},
					{
						relativePath: "a-file.md",
						content: "content",
						executable: false,
					},
				],
				operations: [
					{
						kind: "write-file",
						relativePath: "z-file.md",
						outputFileIndex: 0,
					},
					{
						kind: "write-file",
						relativePath: "a-file.md",
						outputFileIndex: 1,
					},
				],
				applicationState: "eligible",
				policyDiagnosticCodes: ["RS_Z_CODE", "RS_A_CODE"],
			},
		});
		const report = buildInspectionReport(ctx);

		// Paths sorted by code-point order
		expect(report.plan.outputFilePaths).toEqual(["a-file.md", "z-file.md"]);
		expect(report.plan.operationCount).toBe(2);
		expect(report.plan.applicationState).toBe("eligible");
		// Policy diagnostic codes sorted
		expect(report.plan.policyDiagnosticCodes).toEqual([
			"RS_A_CODE",
			"RS_Z_CODE",
		]);
	});

	test("defaults plan to withheld when not provided", () => {
		const ctx = buildMinimalContext();
		const report = buildInspectionReport(ctx);

		expect(report.plan.outputFilePaths).toEqual([]);
		expect(report.plan.operationCount).toBe(0);
		expect(report.plan.applicationState).toBe("withheld");
	});

	test("projects collision summary with sorted outcomes", () => {
		const ctx = buildMinimalContext({
			collisionPolicy: "overwrite",
			collisionOutcomes: {
				"z-path/file.md": "overwritten",
				"a-path/file.md": "skipped",
			},
		});
		const report = buildInspectionReport(ctx);

		expect(report.collision.policy).toBe("overwrite");
		expect(report.collision.collisionCount).toBe(2);
		expect(Object.keys(report.collision.outcomes)).toEqual([
			"a-path/file.md",
			"z-path/file.md",
		]);
	});

	test("defaults collision to policy none when not provided", () => {
		const ctx = buildMinimalContext();
		const report = buildInspectionReport(ctx);

		expect(report.collision.policy).toBe("none");
		expect(report.collision.collisionCount).toBe(0);
		expect(report.collision.outcomes).toEqual({});
	});

	test("projects preview status", () => {
		const ctx = buildMinimalContext({
			previewAvailable: false,
			previewUnavailableReason: "redaction-incomplete",
		});
		const report = buildInspectionReport(ctx);

		expect(report.preview.available).toBe(false);
		expect(report.preview.reason).toBe("redaction-incomplete");
	});

	test("omits preview reason when available", () => {
		const ctx = buildMinimalContext({ previewAvailable: true });
		const report = buildInspectionReport(ctx);

		expect(report.preview.available).toBe(true);
		expect(report.preview.reason).toBeUndefined();
	});

	test("determinism: same input produces same report", () => {
		const ctx = buildMinimalContext({
			detection: {
				candidates: [
					{
						formatId: "kiro",
						confidence: 0.9,
						threshold: 0.7,
						qualifies: true,
						evidence: [{ ruleId: "r1", kind: "path-glob", outcome: "matched", paths: ["a.md"] }],
					},
				],
				selectedFormatId: "kiro",
				ambiguous: false,
			},
			diagnostics: [
				makeDiagnostic({ code: "RS_X_CODE", severity: "warning" }),
				makeDiagnostic({ code: "RS_A_CODE", severity: "error", blocking: true }),
			],
			options: {
				effective: { b: 2, a: 1 },
				origins: { b: "explicit", a: "profile" },
				defaults: {},
			},
		});

		const report1 = buildInspectionReport(ctx);
		const report2 = buildInspectionReport(ctx);

		expect(JSON.stringify(report1)).toBe(JSON.stringify(report2));
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// validateInspectionReport
// ═══════════════════════════════════════════════════════════════════════════════

describe("validateInspectionReport", () => {
	test("accepts a valid envelope", () => {
		const envelope = {
			machineSchemaVersion: "1.0",
			generatedAt: new Date().toISOString(),
			registryVersion: "1.0.0",
			request: {
				mode: "inbound",
				sourceDocuments: [
					{ path: "test/file.md", content: "# Hello", executable: false },
				],
				source: { options: {} },
				canonical: {},
				canonicalSchemaVersion: "1.0.0",
				strict: false,
				callerContext: {},
			},
			defaults: [],
			normalizations: [],
			diagnostics: [],
			degradations: [],
		};

		const result = validateInspectionReport(envelope);
		expect(result.success).toBe(true);
	});

	test("rejects an envelope missing required fields", () => {
		const result = validateInspectionReport({});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.length).toBeGreaterThan(0);
		}
	});

	test("rejects wrong machineSchemaVersion", () => {
		const envelope = {
			machineSchemaVersion: "2.0",
			generatedAt: new Date().toISOString(),
			registryVersion: "1.0.0",
			request: {
				mode: "inbound",
				sourceDocuments: [
					{ path: "test/file.md", content: "# Hello", executable: false },
				],
				source: { options: {} },
				canonical: {},
				canonicalSchemaVersion: "1.0.0",
				strict: false,
				callerContext: {},
			},
			defaults: [],
			normalizations: [],
			diagnostics: [],
			degradations: [],
		};

		const result = validateInspectionReport(envelope);
		expect(result.success).toBe(false);
	});
});
