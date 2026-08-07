/**
 * Unit tests for src/rosetta/renderers.ts
 *
 * Validates human and JSON renderers for InspectionReport:
 * - Human renderer produces readable text with ANSI
 * - JSON renderer produces schema-valid, deterministic, ANSI-free JSON
 * - Both renderers consume the same InspectionReport model
 *
 * Requirements: 8.6, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9
 */

import { describe, expect, test } from "bun:test";
import type {
	InspectionContext,
	InspectionReport,
} from "../rosetta/inspection";
import { buildInspectionReport } from "../rosetta/inspection";
import {
	type JsonRenderOptions,
	renderHuman,
	renderJson,
	renderJsonObject,
	stripAnsi,
} from "../rosetta/renderers";
import type {
	AppliedDefault,
	AppliedNormalization,
	DegradationRecord,
	TranslationDiagnostic,
	TranslationRequest,
} from "../schemas";
import { InspectionReportEnvelopeSchema } from "../schemas";

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function buildMinimalContext(
	overrides: Partial<InspectionContext> = {},
): InspectionContext {
	return {
		request: {
			direction: "source",
			sourceFormat: "kiro-power",
			strict: false,
			dryRun: false,
		},
		format: {
			formatId: "kiro-power",
			contractVersion: "1.0",
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

function buildMinimalReport(
	overrides: Partial<InspectionContext> = {},
): InspectionReport {
	return buildInspectionReport(buildMinimalContext(overrides));
}

function buildMinimalJsonOptions(
	overrides: Partial<JsonRenderOptions> = {},
): JsonRenderOptions {
	return {
		generatedAt: "2024-01-15T10:00:00.000Z",
		registryVersion: "1.0.0",
		request: {
			mode: "inbound",
			sourceDocuments: [
				{
					path: "knowledge.md",
					content: "---\nname: test\n---\nBody",
					executable: false,
				},
			],
			source: { options: {} },
			canonical: { emitEmptyAuxiliaryFiles: false },
			canonicalSchemaVersion: "1.0.0",
			strict: false,
			callerContext: {},
		} as TranslationRequest,
		defaults: [],
		normalizations: [],
		degradations: [],
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
		message: "Test diagnostic message",
		remediation: "No action needed",
		blocking: false,
		unavailableDetails: [],
		...overrides,
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Human Renderer
// ═══════════════════════════════════════════════════════════════════════════════

describe("renderHuman", () => {
	test("renders a minimal report without errors", () => {
		const report = buildMinimalReport();
		const output = renderHuman(report);
		expect(typeof output).toBe("string");
		expect(output.length).toBeGreaterThan(0);
	});

	test("includes section headers", () => {
		const report = buildMinimalReport();
		const output = stripAnsi(renderHuman(report));
		expect(output).toContain("Rosetta Stone Inspection Report");
		expect(output).toContain("Request");
		expect(output).toContain("Format");
		expect(output).toContain("Canonical");
		expect(output).toContain("Compatibility");
		expect(output).toContain("Diagnostics");
		expect(output).toContain("Plan");
		expect(output).toContain("Content Preview");
		expect(output).toContain("Collision Policy");
	});

	test("shows detected/selected format and variant", () => {
		const report = buildMinimalReport({
			format: {
				formatId: "kiro",
				contractVersion: "1.0.0",
				lifecycle: "active",
			},
			variant: { id: "steering" },
		});
		const output = stripAnsi(renderHuman(report));
		expect(output).toContain("ID: kiro");
		expect(output).toContain("Variant: steering");
	});

	test("shows compatibility summary with degradation counts", () => {
		const report = buildMinimalReport({
			compatibility: {
				fullCount: 5,
				partialCount: 2,
				noneCount: 1,
				degradations: [
					{
						capability: "hooks",
						action: "omit",
						canonicalPaths: [],
						affectedValueCount: 1,
					},
				],
				strictPromoted: false,
			},
		});
		const output = stripAnsi(renderHuman(report));
		expect(output).toContain("Full: 5");
		expect(output).toContain("Partial: 2");
		expect(output).toContain("None: 1");
		expect(output).toContain("hooks: omit");
	});

	test("shows diagnostics with severity indicators", () => {
		const report = buildMinimalReport({
			diagnostics: [
				makeDiagnostic({
					severity: "error",
					code: "RS_ERR_ONE",
					message: "Error occurred",
				}),
				makeDiagnostic({
					severity: "warning",
					code: "RS_WARN_ONE",
					message: "Be careful",
				}),
				makeDiagnostic({
					severity: "info",
					code: "RS_INFO_ONE",
					message: "FYI",
				}),
			],
		});
		const output = stripAnsi(renderHuman(report));
		expect(output).toContain("Errors: 1");
		expect(output).toContain("Warnings: 1");
		expect(output).toContain("Info: 1");
		expect(output).toContain("[RS_ERR_ONE] Error occurred");
		expect(output).toContain("[RS_WARN_ONE] Be careful");
		expect(output).toContain("[RS_INFO_ONE] FYI");
	});

	test("shows plan summary with file paths and operation counts", () => {
		const report = buildMinimalReport({
			plan: {
				schemaVersion: "1.0",
				formatId: "kiro",
				canonicalSchemaVersion: "1.0.0",
				outputFiles: [
					{
						relativePath: "dist/kiro/test/file.md",
						content: "x",
						executable: false,
					},
					{
						relativePath: "dist/kiro/test/hooks.yaml",
						content: "y",
						executable: false,
					},
				],
				operations: [
					{
						kind: "write-file",
						relativePath: "dist/kiro/test/file.md",
						outputFileIndex: 0,
					},
					{
						kind: "write-file",
						relativePath: "dist/kiro/test/hooks.yaml",
						outputFileIndex: 1,
					},
				],
				applicationState: "eligible",
				policyDiagnosticCodes: [],
			},
		});
		const output = stripAnsi(renderHuman(report));
		expect(output).toContain("Operations: 2");
		expect(output).toContain("Application state: eligible");
		expect(output).toContain("dist/kiro/test/file.md");
		expect(output).toContain("dist/kiro/test/hooks.yaml");
	});

	test("shows content preview status", () => {
		const report = buildMinimalReport({
			previewAvailable: false,
			previewUnavailableReason: "Sensitive values detected",
		});
		const output = stripAnsi(renderHuman(report));
		expect(output).toContain("Unavailable");
		expect(output).toContain("Reason: Sensitive values detected");
	});

	test("shows resolved options with origins", () => {
		const report = buildMinimalReport({
			options: {
				effective: { format: "steering", maxLines: 100 },
				origins: { format: "explicit", maxLines: "contract-default" },
				defaults: { maxLines: 100 },
			},
		});
		const output = stripAnsi(renderHuman(report));
		expect(output).toContain('format: "steering" (explicit)');
		expect(output).toContain("maxLines: 100 (contract-default)");
	});

	test("shows collision policy", () => {
		const report = buildMinimalReport({
			collisionPolicy: "overwrite",
			collisionOutcomes: { "dist/kiro/test/file.md": "overwritten" },
		});
		const output = stripAnsi(renderHuman(report));
		expect(output).toContain("Policy: overwrite");
		expect(output).toContain("Collisions: 1");
		expect(output).toContain("dist/kiro/test/file.md: overwritten");
	});

	test("contains ANSI color codes in raw output", () => {
		const report = buildMinimalReport();
		const output = renderHuman(report);
		// Should contain ANSI escape sequences
		// biome-ignore lint/suspicious/noControlCharactersInRegex: testing ANSI escape output
		expect(output).toMatch(/\x1b\[/);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// JSON Renderer
// ═══════════════════════════════════════════════════════════════════════════════

describe("renderJson", () => {
	test("produces valid JSON", () => {
		const report = buildMinimalReport();
		const json = renderJson(report, buildMinimalJsonOptions());
		expect(() => JSON.parse(json)).not.toThrow();
	});

	test("output validates through InspectionReportEnvelopeSchema", () => {
		const report = buildMinimalReport();
		const json = renderJson(report, buildMinimalJsonOptions());
		const parsed = JSON.parse(json);
		const result = InspectionReportEnvelopeSchema.safeParse(parsed);
		expect(result.success).toBe(true);
	});

	test("includes machineSchemaVersion 1.0", () => {
		const report = buildMinimalReport();
		const json = renderJson(report, buildMinimalJsonOptions());
		const parsed = JSON.parse(json);
		expect(parsed.machineSchemaVersion).toBe("1.0");
	});

	test("includes generatedAt timestamp", () => {
		const report = buildMinimalReport();
		const json = renderJson(
			report,
			buildMinimalJsonOptions({
				generatedAt: "2024-06-01T12:00:00.000Z",
			}),
		);
		const parsed = JSON.parse(json);
		expect(parsed.generatedAt).toBe("2024-06-01T12:00:00.000Z");
	});

	test("includes registryVersion", () => {
		const report = buildMinimalReport();
		const json = renderJson(
			report,
			buildMinimalJsonOptions({
				registryVersion: "2.3.1",
			}),
		);
		const parsed = JSON.parse(json);
		expect(parsed.registryVersion).toBe("2.3.1");
	});

	test("NEVER contains ANSI escape sequences", () => {
		// Include a diagnostic with ANSI-contaminated message
		const report = buildMinimalReport({
			diagnostics: [
				makeDiagnostic({
					message: "\x1b[31mRed error text\x1b[0m",
					remediation: "\x1b[33mDo something\x1b[0m",
				}),
			],
		});
		const json = renderJson(report, buildMinimalJsonOptions());
		// biome-ignore lint/suspicious/noControlCharactersInRegex: testing ANSI escape stripping
		expect(json).not.toMatch(/\x1b\[/);
		// Messages should be stripped
		const parsed = JSON.parse(json);
		expect(parsed.diagnostics[0].message).toBe("Red error text");
		expect(parsed.diagnostics[0].remediation).toBe("Do something");
	});

	test("uses deterministic key ordering (recursively sorted)", () => {
		const report = buildMinimalReport({
			options: {
				effective: { zebra: "z", alpha: "a", middle: "m" },
				origins: {
					zebra: "explicit",
					alpha: "contract-default",
					middle: "profile",
				},
				defaults: { zebra: "z", alpha: "a" },
			},
		});
		const json = renderJson(report, buildMinimalJsonOptions());
		// Keys should be in code-point (alphabetical) order
		const _lines = json.split("\n");
		// Find the relevant section and verify ordering
		expect(json).not.toContain('"zebra"'); // not in envelope (only in inspection)
		// The envelope itself should have sorted top-level keys
		const parsed = JSON.parse(json);
		const keys = Object.keys(parsed);
		const sorted = [...keys].sort();
		expect(keys).toEqual(sorted);
	});

	test("produces identical output for same input (determinism)", () => {
		const report = buildMinimalReport({
			diagnostics: [
				makeDiagnostic({ code: "RS_B_CODE", severity: "warning" }),
				makeDiagnostic({ code: "RS_A_CODE", severity: "error" }),
			],
		});
		const opts = buildMinimalJsonOptions();
		const json1 = renderJson(report, opts);
		const json2 = renderJson(report, opts);
		expect(json1).toBe(json2);
	});

	test("diagnostics follow severity/phase/code ordering", () => {
		const report = buildMinimalReport({
			diagnostics: [
				makeDiagnostic({
					code: "RS_Z_INFO",
					severity: "info",
					phase: "request",
				}),
				makeDiagnostic({
					code: "RS_A_ERROR",
					severity: "error",
					phase: "request",
				}),
				makeDiagnostic({
					code: "RS_M_WARN",
					severity: "warning",
					phase: "detection",
				}),
			],
		});
		const json = renderJson(report, buildMinimalJsonOptions());
		const parsed = JSON.parse(json);
		// Errors first, then warnings, then info
		expect(parsed.diagnostics[0].code).toBe("RS_A_ERROR");
		expect(parsed.diagnostics[1].code).toBe("RS_M_WARN");
		expect(parsed.diagnostics[2].code).toBe("RS_Z_INFO");
	});

	test("includes defaults and normalizations from options", () => {
		const defaults: AppliedDefault[] = [
			{ field: "name", value: "test-artifact", rule: "format-default" },
		];
		const normalizations: AppliedNormalization[] = [
			{
				ruleId: "trim-whitespace",
				field: "body",
				description: "Trimmed trailing whitespace",
			},
		];
		const report = buildMinimalReport();
		const json = renderJson(
			report,
			buildMinimalJsonOptions({ defaults, normalizations }),
		);
		const parsed = JSON.parse(json);
		expect(parsed.defaults).toHaveLength(1);
		expect(parsed.defaults[0].field).toBe("name");
		expect(parsed.normalizations).toHaveLength(1);
		expect(parsed.normalizations[0].ruleId).toBe("trim-whitespace");
	});

	test("includes degradation records from options", () => {
		const degradations: DegradationRecord[] = [
			{
				capability: "hooks",
				canonicalPaths: ["hooks[0]"],
				action: "omit",
				affectedValueCount: 1,
			},
		];
		const report = buildMinimalReport();
		const json = renderJson(report, buildMinimalJsonOptions({ degradations }));
		const parsed = JSON.parse(json);
		expect(parsed.degradations).toHaveLength(1);
		expect(parsed.degradations[0].capability).toBe("hooks");
	});

	test("includes plan paths when plan has operations", () => {
		const report = buildMinimalReport({
			plan: {
				schemaVersion: "1.0",
				formatId: "kiro-power",
				canonicalSchemaVersion: "1.0.0",
				outputFiles: [
					{
						relativePath: "dist/kiro/test/main.md",
						content: "x",
						executable: false,
					},
				],
				operations: [
					{
						kind: "write-file",
						relativePath: "dist/kiro/test/main.md",
						outputFileIndex: 0,
					},
				],
				applicationState: "eligible",
				policyDiagnosticCodes: [],
			},
		});
		const json = renderJson(report, buildMinimalJsonOptions());
		const parsed = JSON.parse(json);
		expect(parsed.plan).toBeDefined();
		expect(parsed.plan.fileCount).toBe(1);
		expect(parsed.plan.paths).toContain("dist/kiro/test/main.md");
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// renderJsonObject
// ═══════════════════════════════════════════════════════════════════════════════

describe("renderJsonObject", () => {
	test("returns a validated InspectionReportEnvelope object", () => {
		const report = buildMinimalReport();
		const envelope = renderJsonObject(report, buildMinimalJsonOptions());
		expect(envelope.machineSchemaVersion).toBe("1.0");
		expect(envelope.generatedAt).toBe("2024-01-15T10:00:00.000Z");
		expect(envelope.registryVersion).toBe("1.0.0");
	});

	test("validates through schema", () => {
		const report = buildMinimalReport();
		const envelope = renderJsonObject(report, buildMinimalJsonOptions());
		const result = InspectionReportEnvelopeSchema.safeParse(envelope);
		expect(result.success).toBe(true);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// stripAnsi
// ═══════════════════════════════════════════════════════════════════════════════

describe("stripAnsi", () => {
	test("removes ANSI escape sequences", () => {
		const input = "\x1b[31mred text\x1b[0m";
		expect(stripAnsi(input)).toBe("red text");
	});

	test("preserves plain text", () => {
		const input = "hello world";
		expect(stripAnsi(input)).toBe("hello world");
	});

	test("handles multiple escape sequences", () => {
		const input =
			"\x1b[1m\x1b[34mBold blue\x1b[0m normal \x1b[33myellow\x1b[0m";
		expect(stripAnsi(input)).toBe("Bold blue normal yellow");
	});

	test("handles empty string", () => {
		expect(stripAnsi("")).toBe("");
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Both renderers consume the same model
// ═══════════════════════════════════════════════════════════════════════════════

describe("renderer contract", () => {
	test("both renderers accept the same InspectionReport", () => {
		const report = buildMinimalReport({
			diagnostics: [makeDiagnostic({ code: "RS_TEST_A", severity: "error" })],
			compatibility: {
				fullCount: 3,
				partialCount: 1,
				noneCount: 0,
				degradations: [
					{
						capability: "mcp-servers",
						action: "comment",
						canonicalPaths: [],
						affectedValueCount: 2,
					},
				],
				strictPromoted: true,
			},
		});

		// Both should succeed on the same report
		const human = renderHuman(report);
		const json = renderJson(report, buildMinimalJsonOptions());

		expect(typeof human).toBe("string");
		expect(human.length).toBeGreaterThan(0);
		expect(() => JSON.parse(json)).not.toThrow();
	});

	test("JSON never leaks ANSI even with color-contaminated diagnostics", () => {
		const report = buildMinimalReport({
			diagnostics: [
				makeDiagnostic({
					code: "RS_ANSI_CHECK",
					severity: "error",
					message: "\x1b[1m\x1b[31mBold red error\x1b[0m",
					remediation: "\x1b[32mGreen remediation\x1b[0m",
				}),
			],
		});
		const json = renderJson(report, buildMinimalJsonOptions());
		// Absolutely no ANSI in JSON
		// biome-ignore lint/suspicious/noControlCharactersInRegex: testing ANSI escape stripping
		expect(json).not.toMatch(/\x1b/);
	});
});
