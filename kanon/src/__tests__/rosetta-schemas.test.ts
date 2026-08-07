/**
 * Rosetta Stone schema validation, diagnostic ordering, blocking metadata,
 * internal error conversion, and envelope tests.
 *
 * Requirements: 8.1, 8.2, 8.5, 8.6, 16.1, 16.3, 16.4, 16.10
 */

import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import {
	convertInternalError,
	createDiagnostic,
	getBlockingDiagnostics,
	isBlockingCode,
	sortDiagnostics,
} from "../rosetta/diagnostics";
import {
	ContractVersionSchema,
	DiagnosticsEnvelopeSchema,
	FormatContractSchema,
	FormatIdentifierSchema,
	InspectionReportEnvelopeSchema,
	NormalizedRelativePathSchema,
	SourceDocumentSchema,
	TranslationDiagnosticSchema,
	TranslationPlanSchema,
} from "../schemas";

import {
	arbFormatIdentifier,
	arbNormalizedRelativePath,
	arbTranslationDiagnostic,
	arbTranslationPlan,
} from "./rosetta-arbitraries";

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Schema Validation Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("rosetta schema validation", () => {
	describe("FormatIdentifierSchema", () => {
		test("accepts valid kebab-case identifiers", () => {
			expect(FormatIdentifierSchema.safeParse("claude-code").success).toBe(
				true,
			);
			expect(FormatIdentifierSchema.safeParse("kiro").success).toBe(true);
			expect(FormatIdentifierSchema.safeParse("my-format-v2").success).toBe(
				true,
			);
			expect(FormatIdentifierSchema.safeParse("a1b2").success).toBe(true);
		});

		test("rejects uppercase characters", () => {
			expect(FormatIdentifierSchema.safeParse("Claude").success).toBe(false);
			expect(FormatIdentifierSchema.safeParse("UPPER").success).toBe(false);
		});

		test("rejects spaces", () => {
			expect(FormatIdentifierSchema.safeParse("my format").success).toBe(false);
		});

		test("rejects special characters", () => {
			expect(FormatIdentifierSchema.safeParse("my_format").success).toBe(false);
			expect(FormatIdentifierSchema.safeParse("my.format").success).toBe(false);
			expect(FormatIdentifierSchema.safeParse("my@format").success).toBe(false);
		});

		test("rejects leading/trailing hyphens", () => {
			expect(FormatIdentifierSchema.safeParse("-leading").success).toBe(false);
			expect(FormatIdentifierSchema.safeParse("trailing-").success).toBe(false);
		});
	});

	describe("NormalizedRelativePathSchema", () => {
		test("accepts valid paths", () => {
			expect(NormalizedRelativePathSchema.safeParse("foo/bar.ts").success).toBe(
				true,
			);
			expect(NormalizedRelativePathSchema.safeParse("a/b/c.md").success).toBe(
				true,
			);
			expect(
				NormalizedRelativePathSchema.safeParse("single-file.txt").success,
			).toBe(true);
		});

		test("rejects absolute paths", () => {
			expect(
				NormalizedRelativePathSchema.safeParse("/etc/passwd").success,
			).toBe(false);
			expect(
				NormalizedRelativePathSchema.safeParse("\\Windows\\System32").success,
			).toBe(false);
		});

		test("rejects .. traversal", () => {
			expect(NormalizedRelativePathSchema.safeParse("../secret").success).toBe(
				false,
			);
			expect(NormalizedRelativePathSchema.safeParse("a/../b").success).toBe(
				false,
			);
		});

		test("rejects NUL characters", () => {
			expect(NormalizedRelativePathSchema.safeParse("foo\0bar").success).toBe(
				false,
			);
		});

		test("rejects backslashes", () => {
			expect(NormalizedRelativePathSchema.safeParse("foo\\bar").success).toBe(
				false,
			);
		});

		test("rejects empty segments", () => {
			expect(NormalizedRelativePathSchema.safeParse("foo//bar").success).toBe(
				false,
			);
		});

		test("rejects . segments", () => {
			expect(NormalizedRelativePathSchema.safeParse("./foo").success).toBe(
				false,
			);
			expect(NormalizedRelativePathSchema.safeParse("a/./b").success).toBe(
				false,
			);
		});

		test("rejects non-NFC normalized strings", () => {
			// é as e + combining acute vs precomposed
			const nonNFC = "e\u0301"; // NFD form
			expect(NormalizedRelativePathSchema.safeParse(nonNFC).success).toBe(
				false,
			);
		});
	});

	describe("ContractVersionSchema", () => {
		test("accepts '1.0'", () => {
			expect(ContractVersionSchema.safeParse("1.0").success).toBe(true);
		});

		test("rejects '2.0'", () => {
			expect(ContractVersionSchema.safeParse("2.0").success).toBe(false);
		});

		test("rejects '1.1'", () => {
			expect(ContractVersionSchema.safeParse("1.1").success).toBe(false);
		});
	});

	describe("SourceDocumentSchema strict validation", () => {
		test("rejects extra fields", () => {
			const result = SourceDocumentSchema.safeParse({
				path: "foo/bar.ts",
				content: "hello",
				executable: false,
				extraField: "not allowed",
			});
			expect(result.success).toBe(false);
		});

		test("accepts valid document", () => {
			const result = SourceDocumentSchema.safeParse({
				path: "foo/bar.ts",
				content: "hello world",
				executable: false,
			});
			expect(result.success).toBe(true);
		});
	});

	describe("FormatContractSchema strict validation", () => {
		test("rejects extra top-level fields", () => {
			const validContract = buildMinimalFormatContract();
			const result = FormatContractSchema.safeParse({
				...validContract,
				unexpectedField: true,
			});
			expect(result.success).toBe(false);
		});
	});

	describe("TranslationDiagnosticSchema strict validation", () => {
		test("rejects extra fields", () => {
			const result = TranslationDiagnosticSchema.safeParse({
				code: "RS_TEST_CODE",
				severity: "error",
				phase: "request",
				message: "Test message",
				remediation: "Fix it",
				blocking: true,
				unavailableDetails: [],
				extra: "not allowed",
			});
			expect(result.success).toBe(false);
		});

		test("accepts valid diagnostic", () => {
			const result = TranslationDiagnosticSchema.safeParse({
				code: "RS_TEST_CODE",
				severity: "error",
				phase: "request",
				message: "Test message",
				remediation: "Fix it",
				blocking: true,
				unavailableDetails: [],
			});
			expect(result.success).toBe(true);
		});
	});

	describe("TranslationPlanSchema strict validation", () => {
		test("rejects extra fields", () => {
			const result = TranslationPlanSchema.safeParse({
				schemaVersion: "1.0",
				formatId: "test-format",
				canonicalSchemaVersion: "1.0.0",
				outputFiles: [],
				operations: [],
				applicationState: "eligible",
				policyDiagnosticCodes: [],
				extra: "nope",
			});
			expect(result.success).toBe(false);
		});

		test("accepts valid plan", () => {
			const result = TranslationPlanSchema.safeParse({
				schemaVersion: "1.0",
				formatId: "test-format",
				canonicalSchemaVersion: "1.0.0",
				outputFiles: [],
				operations: [],
				applicationState: "eligible",
				policyDiagnosticCodes: [],
			});
			expect(result.success).toBe(true);
		});
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Diagnostic Ordering Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("rosetta diagnostic ordering", () => {
	test("sorts error before warning before info", () => {
		const diagnostics = [
			makeDiagnostic({ severity: "info", code: "RS_A" }),
			makeDiagnostic({ severity: "error", code: "RS_B" }),
			makeDiagnostic({ severity: "warning", code: "RS_C" }),
		];
		const sorted = sortDiagnostics(diagnostics);
		expect(sorted[0].severity).toBe("error");
		expect(sorted[1].severity).toBe("warning");
		expect(sorted[2].severity).toBe("info");
	});

	test("sorts by phase order within same severity", () => {
		const diagnostics = [
			makeDiagnostic({
				severity: "error",
				phase: "redaction",
				code: "RS_LATE",
			}),
			makeDiagnostic({ severity: "error", phase: "request", code: "RS_EARLY" }),
			makeDiagnostic({ severity: "error", phase: "detection", code: "RS_MID" }),
		];
		const sorted = sortDiagnostics(diagnostics);
		expect(sorted[0].phase).toBe("request");
		expect(sorted[1].phase).toBe("detection");
		expect(sorted[2].phase).toBe("redaction");
	});

	test("sorts by path within same severity and phase", () => {
		const diagnostics = [
			makeDiagnostic({
				severity: "error",
				phase: "request",
				code: "RS_X",
				source: { path: "z/file.ts" },
			}),
			makeDiagnostic({
				severity: "error",
				phase: "request",
				code: "RS_X",
				source: { path: "a/file.ts" },
			}),
		];
		const sorted = sortDiagnostics(diagnostics);
		expect(sorted[0].source?.path).toBe("a/file.ts");
		expect(sorted[1].source?.path).toBe("z/file.ts");
	});

	test("is stable (same input → same output)", () => {
		const diagnostics = [
			makeDiagnostic({ severity: "warning", phase: "request", code: "RS_A" }),
			makeDiagnostic({ severity: "error", phase: "detection", code: "RS_B" }),
			makeDiagnostic({ severity: "info", phase: "redaction", code: "RS_C" }),
		];
		const sorted1 = sortDiagnostics(diagnostics);
		const sorted2 = sortDiagnostics(diagnostics);
		expect(sorted1).toEqual(sorted2);
	});

	test("property: sorting is idempotent", () => {
		fc.assert(
			fc.property(
				fc.array(arbTranslationDiagnostic(), { minLength: 0, maxLength: 20 }),
				(diagnostics) => {
					const once = sortDiagnostics(diagnostics);
					const twice = sortDiagnostics(once);
					expect(twice).toEqual(once);
				},
			),
			{ numRuns: 100 },
		);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Blocking Metadata Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("rosetta blocking metadata", () => {
	test("isBlockingCode('RS_INVALID_REQUEST') returns true", () => {
		expect(isBlockingCode("RS_INVALID_REQUEST")).toBe(true);
	});

	test("isBlockingCode('RS_NO_MATCH') returns false", () => {
		expect(isBlockingCode("RS_NO_MATCH")).toBe(false);
	});

	test("isBlockingCode('UNKNOWN_CODE') returns true (unknown = blocking)", () => {
		expect(isBlockingCode("UNKNOWN_CODE")).toBe(true);
	});

	test("createDiagnostic produces blocking=true for blocking codes", () => {
		const diag = createDiagnostic("RS_INVALID_REQUEST");
		expect(diag.blocking).toBe(true);
	});

	test("createDiagnostic produces blocking=false for non-blocking codes", () => {
		const diag = createDiagnostic("RS_NO_MATCH");
		expect(diag.blocking).toBe(false);
	});

	test("getBlockingDiagnostics filters correctly", () => {
		const diagnostics = [
			createDiagnostic("RS_INVALID_REQUEST"),
			createDiagnostic("RS_NO_MATCH"),
			createDiagnostic("RS_AMBIGUOUS_MATCH"),
		];
		const blocking = getBlockingDiagnostics(diagnostics);
		expect(blocking.length).toBe(2);
		expect(blocking.every((d) => d.blocking)).toBe(true);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Internal Error Conversion Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("rosetta internal error conversion", () => {
	test("does not leak error message", () => {
		const error = new Error("secret internal details");
		const diag = convertInternalError(error, "request");
		expect(diag.message).not.toContain("secret internal details");
	});

	test("does not leak stack trace", () => {
		const error = new Error("oops");
		const diag = convertInternalError(error, "request");
		const serialized = JSON.stringify(diag);
		expect(serialized).not.toContain("at ");
		expect(serialized).not.toContain(".ts:");
	});

	test("records error type name for Error subclasses", () => {
		class CustomValidationError extends Error {
			constructor() {
				super("bad input");
				this.name = "CustomValidationError";
			}
		}
		const error = new CustomValidationError();
		const diag = convertInternalError(error, "detection");
		expect(diag.unavailableDetails).toContain(
			"errorType: CustomValidationError",
		);
	});

	test("produces a valid TranslationDiagnosticSchema-conforming object", () => {
		const error = new TypeError("cannot read property x");
		const diag = convertInternalError(error, "source-translation");
		const result = TranslationDiagnosticSchema.safeParse(diag);
		expect(result.success).toBe(true);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Envelope Schema Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("rosetta envelope schemas", () => {
	test("InspectionReportEnvelopeSchema accepts valid envelope", () => {
		const envelope = buildMinimalInspectionEnvelope();
		const result = InspectionReportEnvelopeSchema.safeParse(envelope);
		expect(result.success).toBe(true);
	});

	test("DiagnosticsEnvelopeSchema accepts valid envelope", () => {
		const envelope = {
			machineSchemaVersion: "1.0",
			generatedAt: new Date().toISOString(),
			registryVersion: "1.0.0",
			diagnostics: [],
			status: "success",
		};
		const result = DiagnosticsEnvelopeSchema.safeParse(envelope);
		expect(result.success).toBe(true);
	});

	test("InspectionReportEnvelopeSchema rejects missing generatedAt", () => {
		const envelope = buildMinimalInspectionEnvelope();
		const { generatedAt: _, ...without } = envelope;
		const result = InspectionReportEnvelopeSchema.safeParse(without);
		expect(result.success).toBe(false);
	});

	test("DiagnosticsEnvelopeSchema rejects missing machineSchemaVersion", () => {
		const result = DiagnosticsEnvelopeSchema.safeParse({
			generatedAt: new Date().toISOString(),
			registryVersion: "1.0.0",
			diagnostics: [],
			status: "success",
		});
		expect(result.success).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Property-Based Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("rosetta property-based schema validation", () => {
	test("any generated FormatIdentifier passes FormatIdentifierSchema", () => {
		fc.assert(
			fc.property(arbFormatIdentifier(), (id) => {
				const result = FormatIdentifierSchema.safeParse(id);
				expect(result.success).toBe(true);
			}),
			{ numRuns: 200 },
		);
	});

	test("any generated NormalizedRelativePath passes NormalizedRelativePathSchema", () => {
		fc.assert(
			fc.property(arbNormalizedRelativePath(), (path) => {
				const result = NormalizedRelativePathSchema.safeParse(path);
				expect(result.success).toBe(true);
			}),
			{ numRuns: 200 },
		);
	});

	test("any generated TranslationDiagnostic passes TranslationDiagnosticSchema", () => {
		fc.assert(
			fc.property(arbTranslationDiagnostic(), (diag) => {
				const result = TranslationDiagnosticSchema.safeParse(diag);
				expect(result.success).toBe(true);
			}),
			{ numRuns: 200 },
		);
	});

	test("sortDiagnostics is idempotent (sort(sort(x)) === sort(x))", () => {
		fc.assert(
			fc.property(
				fc.array(arbTranslationDiagnostic(), { minLength: 0, maxLength: 30 }),
				(diagnostics) => {
					const once = sortDiagnostics(diagnostics);
					const twice = sortDiagnostics(once);
					expect(twice).toEqual(once);
				},
			),
			{ numRuns: 100 },
		);
	});

	test("any generated TranslationPlan passes TranslationPlanSchema", () => {
		fc.assert(
			fc.property(arbTranslationPlan(), (plan) => {
				const result = TranslationPlanSchema.safeParse(plan);
				expect(result.success).toBe(true);
			}),
			{ numRuns: 100 },
		);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Test Helpers
// ═══════════════════════════════════════════════════════════════════════════════

import type { TranslationDiagnostic } from "../schemas";

function makeDiagnostic(
	overrides: Partial<TranslationDiagnostic> = {},
): TranslationDiagnostic {
	return {
		code: "RS_TEST",
		severity: "error",
		phase: "request",
		message: "Test diagnostic",
		remediation: "Fix this",
		blocking: true,
		unavailableDetails: [],
		...overrides,
	};
}

function buildMinimalFormatContract() {
	const capabilities = [
		"frontmatter",
		"body",
		"hooks",
		"mcp-servers",
		"workflows",
		"body-overrides",
		"extra-fields",
		"path-scoping",
		"toggleable-rules",
		"file-match-inclusion",
		"system-prompt-merging",
		"skill",
		"power",
		"rule",
		"workflow",
		"agent",
		"prompt",
		"template",
		"reference-pack",
	] as const;

	const compatibility: Record<string, { support: "full" }> = {};
	for (const cap of capabilities) {
		compatibility[cap] = { support: "full" };
	}

	return {
		id: "test-format",
		contractVersion: "1.0",
		direction: "source",
		harness: null,
		aliases: [],
		lifecycle: {
			status: "active",
			introducedIn: "1.0.0",
		},
		canonicalVersions: {
			minInclusive: "1.0.0",
			maxExclusive: "2.0.0",
		},
		schemaReference: { type: "none" },
		pathConventions: [],
		detection: {
			threshold: 0.5,
			rules: [
				{
					id: "test-rule",
					kind: "extension",
					pattern: "*.test",
					weight: 10,
					required: false,
					evidenceLabel: "Test file",
				},
			],
		},
		variants: {},
		optionDefinitions: {},
		defaults: {},
		normalizationRules: [],
		compatibility,
		security: {
			sensitiveValuePolicy: "reject",
			allowedReferencePatterns: [],
		},
	};
}

function buildMinimalInspectionEnvelope() {
	return {
		machineSchemaVersion: "1.0",
		generatedAt: new Date().toISOString(),
		registryVersion: "1.0.0",
		request: {
			mode: "inbound",
			sourceDocuments: [
				{
					path: "test/file.md",
					content: "# Hello",
					executable: false,
				},
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
}
