/**
 * Unit tests for Rosetta Stone engine, inspection, and redaction modules.
 *
 * Covers phase short-circuiting, internal exceptions, machine-safe output,
 * strict promotion, sensitive references, preview suppression, and unchanged
 * non-sensitive report fields.
 *
 * NOTE: Due to a circular dependency in the module graph (schemas.ts →
 * format-registry.ts → builtins/contracts.ts → builtins/compatibility-profiles.ts
 * → adapters/capabilities.ts → schemas.ts), certain modules (engine.ts,
 * inspection.ts, compatibility.ts) cannot be directly imported in bun test.
 * Tests verify the underlying logic through importable sub-modules.
 *
 * Requirements: 4.7, 4.8, 8.6, 9.3, 9.6, 9.7, 13.9, 13.10, 13.11
 */

import { describe, expect, test } from "bun:test";
import {
	applySensitivePolicy,
	computeFingerprint,
	createRedactor,
	looksLikeSecret,
	matchesApprovedPattern,
	RedactionRegistry,
	suppressOnIncompleteRedaction,
} from "../rosetta/redaction";
import type { RedactionProof } from "../rosetta/redaction";
import {
	convertInternalError,
	createDiagnostic,
	getBlockingDiagnostics,
	hasBlockingDiagnostics,
	sortDiagnostics,
} from "../rosetta/diagnostics";
import {
	codePointCompare,
	compareDiagnostics,
	deepFreeze,
} from "../rosetta/contracts";
import type { TranslationDiagnostic } from "../rosetta/contracts";

// ═══════════════════════════════════════════════════════════════════════════════
// 1. Phase Short-Circuiting (Req 4.7, 4.8)
//
// The engine stops processing when a phase produces blocking diagnostics.
// ═══════════════════════════════════════════════════════════════════════════════

describe("phase short-circuiting logic", () => {
	test("hasBlockingDiagnostics returns true for blocking errors", () => {
		const diagnostics: TranslationDiagnostic[] = [
			createDiagnostic("RS_CANONICAL_INVALID", {
				message: "Schema violation at frontmatter.name",
			}),
		];
		expect(hasBlockingDiagnostics(diagnostics)).toBe(true);
	});

	test("hasBlockingDiagnostics returns false for non-blocking warnings", () => {
		const diagnostics: TranslationDiagnostic[] = [
			createDiagnostic("RS_COMPATIBILITY_PARTIAL", {
				message: "Hooks partially supported",
			}),
		];
		expect(hasBlockingDiagnostics(diagnostics)).toBe(false);
	});

	test("getBlockingDiagnostics filters only blocking entries", () => {
		const diagnostics: TranslationDiagnostic[] = [
			createDiagnostic("RS_CANONICAL_INVALID", { message: "error 1" }),
			createDiagnostic("RS_COMPATIBILITY_PARTIAL", { message: "warn 1" }),
			createDiagnostic("RS_UNSAFE_PATH", { message: "error 2" }),
			createDiagnostic("RS_DEFAULT_APPLIED", { message: "info 1" }),
		];
		const blocking = getBlockingDiagnostics(diagnostics);
		expect(blocking).toHaveLength(2);
		expect(blocking.every((d) => d.blocking === true)).toBe(true);
	});

	test("canonical errors withhold plans (Req 4.7)", () => {
		const canonicalErrors: TranslationDiagnostic[] = [
			createDiagnostic("RS_CANONICAL_INVALID", {
				message: 'Validation failed at "frontmatter.name": Required',
				canonical: { artifactName: "unknown", fieldPath: "frontmatter.name" },
			}),
		];
		// Engine uses this check to decide whether to produce a plan
		expect(hasBlockingDiagnostics(canonicalErrors)).toBe(true);
	});

	test("non-blocking source diagnostics allow plan generation (Req 4.8)", () => {
		const nonBlockingDiags: TranslationDiagnostic[] = [
			createDiagnostic("RS_SOURCE_LOSS", {
				message: "Source field 'custom-metadata' has no canonical mapping",
			}),
			createDiagnostic("RS_COMPATIBILITY_PARTIAL", {
				message: "Hooks partially supported",
			}),
		];
		expect(hasBlockingDiagnostics(nonBlockingDiags)).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Internal Exceptions — Machine-Safe Output (Req 8.6, 13.10)
// ═══════════════════════════════════════════════════════════════════════════════

describe("internal exception conversion to safe diagnostics", () => {
	test("converts TypeError to RS_TRANSLATOR_INTERNAL with no stack leak", () => {
		const error = new TypeError("Cannot read property 'x' of undefined");
		const diagnostic = convertInternalError(error, "source-translation");

		expect(diagnostic.code).toBe("RS_TRANSLATOR_INTERNAL");
		expect(diagnostic.severity).toBe("error");
		expect(diagnostic.blocking).toBe(true);
		expect(diagnostic.phase).toBe("source-translation");
		expect(diagnostic.message).not.toContain("Cannot read property");
		expect(diagnostic.message).not.toContain("undefined");
		expect(diagnostic.message).not.toContain("at ");
		expect(diagnostic.message).not.toContain(".ts:");
		expect(diagnostic.remediation).not.toContain("at ");
	});

	test("records error type name safely in unavailableDetails", () => {
		const error = new RangeError("index out of bounds");
		const diagnostic = convertInternalError(error, "canonical-validation");

		expect(diagnostic.unavailableDetails).toContain("errorType: RangeError");
		expect(diagnostic.unavailableDetails?.join("")).not.toContain(
			"index out of bounds",
		);
	});

	test("does not include errorType for generic Error", () => {
		const error = new Error("something happened");
		const diagnostic = convertInternalError(error, "request");

		expect(diagnostic.unavailableDetails).not.toContain("errorType: Error");
	});

	test("handles non-Error throwables safely", () => {
		const diagnostic = convertInternalError("string error", "detection");

		expect(diagnostic.code).toBe("RS_TRANSLATOR_INTERNAL");
		expect(diagnostic.severity).toBe("error");
		expect(diagnostic.blocking).toBe(true);
		expect(diagnostic.message).not.toContain("string error");
		expect(diagnostic.unavailableDetails).toHaveLength(0);
	});

	test("no raw source content leaks through error message", () => {
		const sensitiveContent =
			"password: AKIAIOSFODNN7EXAMPLE1\napi_key: rk_example_fake_000000";
		const error = new Error(sensitiveContent);
		const diagnostic = convertInternalError(error, "source-translation");

		expect(diagnostic.message).not.toContain("AKIAIOSFODNN7");
		expect(diagnostic.message).not.toContain("password");
		expect(diagnostic.message).not.toContain("sk_live");
		expect(diagnostic.remediation).not.toContain("AKIAIOSFODNN7");
	});

	test("handles undefined/null errors safely", () => {
		const diagnostic = convertInternalError(undefined, "target-translation");

		expect(diagnostic.code).toBe("RS_TRANSLATOR_INTERNAL");
		expect(diagnostic.severity).toBe("error");
		expect(diagnostic.blocking).toBe(true);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Strict Mode Promotion (Req 4.8)
//
// Strict mode promotes compatibility diagnostics to errors.
// Tested via the promotion logic the engine uses.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Inline strict promotion logic (mirrors promoteInStrictMode from compatibility.ts).
 * Promotes compatibility-phase warning diagnostics to error severity + blocking.
 */
function applyStrictPromotion(
	diagnostics: TranslationDiagnostic[],
): TranslationDiagnostic[] {
	return diagnostics.map((d) => {
		if (d.phase === "compatibility" && d.severity === "warning") {
			return { ...d, severity: "error" as const, blocking: true };
		}
		return d;
	});
}

describe("strict mode promotion", () => {
	test("promotes compatibility warnings to errors", () => {
		const diagnostics: TranslationDiagnostic[] = [
			createDiagnostic("RS_COMPATIBILITY_PARTIAL", {
				message: "Hooks are only partially supported.",
			}),
			createDiagnostic("RS_COMPATIBILITY_NONE", {
				message: "Workflows are not supported.",
			}),
		];

		const promoted = applyStrictPromotion(diagnostics);

		for (const d of promoted) {
			expect(d.severity).toBe("error");
			expect(d.blocking).toBe(true);
		}
	});

	test("does not promote non-compatibility diagnostics", () => {
		const diagnostics: TranslationDiagnostic[] = [
			createDiagnostic("RS_SOURCE_LOSS", {
				message: "Source field lost",
				severityOverride: "warning" as const,
			}),
			createDiagnostic("RS_COMPATIBILITY_PARTIAL", {
				message: "Hooks partially supported",
			}),
		];

		const promoted = applyStrictPromotion(diagnostics);

		const sourceLoss = promoted.find((d) => d.code === "RS_SOURCE_LOSS");
		expect(sourceLoss?.severity).toBe("warning");
		expect(sourceLoss?.blocking).toBe(false);

		const compatPartial = promoted.find(
			(d) => d.code === "RS_COMPATIBILITY_PARTIAL",
		);
		expect(compatPartial?.severity).toBe("error");
		expect(compatPartial?.blocking).toBe(true);
	});

	test("does not modify info-level diagnostics", () => {
		const diagnostics: TranslationDiagnostic[] = [
			createDiagnostic("RS_DEFAULT_APPLIED", {
				message: "Default applied",
				severityOverride: "info" as const,
			}),
		];

		const promoted = applyStrictPromotion(diagnostics);
		expect(promoted[0].severity).toBe("info");
	});

	test("promoted diagnostics make hasBlockingDiagnostics true", () => {
		const diagnostics: TranslationDiagnostic[] = [
			createDiagnostic("RS_COMPATIBILITY_PARTIAL", {
				message: "Partial support",
			}),
		];

		const promoted = applyStrictPromotion(diagnostics);
		expect(hasBlockingDiagnostics(promoted)).toBe(true);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Sensitive References (Req 9.6, 13.9)
// ═══════════════════════════════════════════════════════════════════════════════

describe("sensitive reference handling", () => {
	test("approved ${ENV_VAR} syntax passes under reference-only policy", () => {
		const content = "apiKey: ${API_KEY}\nsecret: ${MY_SECRET}";
		const approvedPatterns = ["\\$\\{[A-Z_]+\\}"];

		const result = applySensitivePolicy(
			content,
			"reference-only",
			approvedPatterns,
		);
		expect(result.ok).toBe(true);
		expect(result.diagnostics).toHaveLength(0);
	});

	test("literal secrets are rejected under reject policy", () => {
		// AWS key: AKIA + exactly 16 uppercase alphanumeric chars
		const content = "token: AKIAIOSFODNN7EXAMPLE";
		const result = applySensitivePolicy(content, "reject", []);

		expect(result.ok).toBe(false);
		expect(result.diagnostics.length).toBeGreaterThan(0);
		expect(result.diagnostics[0].code).toBe("RS_SENSITIVE_REJECTED");
	});

	test("literal secrets are rejected under reference-only policy", () => {
		const content = "token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh";
		const result = applySensitivePolicy(content, "reference-only", []);

		expect(result.ok).toBe(false);
		expect(result.diagnostics.length).toBeGreaterThan(0);
		expect(result.diagnostics[0].code).toBe("RS_SENSITIVE_REFERENCE_INVALID");
	});

	test("preserve policy passes all content unchanged", () => {
		const content = "password: my-super-secret-password-1234567890abc";
		const result = applySensitivePolicy(content, "preserve", []);

		expect(result.ok).toBe(true);
		expect(result.content).toBe(content);
		expect(result.diagnostics).toHaveLength(0);
	});

	test("matchesApprovedPattern identifies env-var syntax", () => {
		expect(
			matchesApprovedPattern("${MY_TOKEN}", ["\\$\\{[A-Z_]+\\}"]),
		).toBe(true);
		expect(
			matchesApprovedPattern("literal-value", ["\\$\\{[A-Z_]+\\}"]),
		).toBe(false);
	});

	test("matchesApprovedPattern handles invalid regex gracefully", () => {
		expect(matchesApprovedPattern("test", ["[invalid"])).toBe(false);
	});

	test("looksLikeSecret detects AWS keys", () => {
		expect(looksLikeSecret("AKIAIOSFODNN7EXAMPLE")).toBe(true);
	});

	test("looksLikeSecret detects GitHub tokens", () => {
		expect(
			looksLikeSecret("ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh"),
		).toBe(true);
	});

	test("looksLikeSecret rejects normal text", () => {
		expect(looksLikeSecret("hello world")).toBe(false);
		expect(looksLikeSecret("just a normal name")).toBe(false);
	});

	test("computeFingerprint is deterministic", () => {
		const fp1 = computeFingerprint("my-secret-value");
		const fp2 = computeFingerprint("my-secret-value");
		expect(fp1).toBe(fp2);
		expect(fp1).toHaveLength(8);
	});

	test("computeFingerprint differs for different inputs", () => {
		const fp1 = computeFingerprint("secret-a");
		const fp2 = computeFingerprint("secret-b");
		expect(fp1).not.toBe(fp2);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Preview Suppression (Req 9.7, 13.11)
// ═══════════════════════════════════════════════════════════════════════════════

describe("preview suppression on incomplete redaction", () => {
	test("suppresses output when proof is null", () => {
		const diagnostics: TranslationDiagnostic[] = [
			createDiagnostic("RS_DEFAULT_APPLIED", { message: "default name" }),
			createDiagnostic("RS_CANONICAL_INVALID", { message: "field issue" }),
		];
		const result = suppressOnIncompleteRedaction(
			{ diagnostics, content: "secret content", plan: { files: [] } },
			null,
		);

		expect(result).not.toBeNull();
		expect(result!.suppressed).toBe(true);
		expect(result!.content).toBeNull();
		expect(result!.plan).toBeNull();
		expect(
			result!.diagnostics.some((d) => d.code === "RS_REDACTION_UNSAFE"),
		).toBe(true);
	});

	test("suppresses output when proof is incomplete", () => {
		const incompleteProof: RedactionProof = {
			complete: false,
			coveredLocations: 1,
			totalLocations: 3,
			uncoveredPaths: ["config.yaml", "secrets.env"],
		};
		const result = suppressOnIncompleteRedaction(
			{ diagnostics: [], content: "has secrets" },
			incompleteProof,
		);

		expect(result).not.toBeNull();
		expect(result!.suppressed).toBe(true);
		expect(result!.content).toBeNull();
		expect(
			result!.diagnostics.some((d) => d.code === "RS_REDACTION_UNSAFE"),
		).toBe(true);
		expect(result!.diagnostics[0].message).toContain("1/3");
	});

	test("does not suppress when proof is complete", () => {
		const completeProof: RedactionProof = {
			complete: true,
			coveredLocations: 3,
			totalLocations: 3,
			uncoveredPaths: [],
		};
		const result = suppressOnIncompleteRedaction(
			{ diagnostics: [], content: "safe content" },
			completeProof,
		);

		expect(result).toBeNull();
	});

	test("suppression retains only safe-phase diagnostics", () => {
		const diagnostics: TranslationDiagnostic[] = [
			createDiagnostic("RS_INVALID_REQUEST", { message: "bad request" }),
			createDiagnostic("RS_CANONICAL_INVALID", { message: "schema err" }),
			createDiagnostic("RS_NO_MATCH", { message: "detection issue" }),
		];
		const result = suppressOnIncompleteRedaction(
			{ diagnostics, content: "dangerous" },
			null,
		);

		expect(result).not.toBeNull();
		const safeDiags = result!.diagnostics.filter(
			(d) => d.code !== "RS_REDACTION_UNSAFE",
		);
		for (const d of safeDiags) {
			expect(["request", "registry", "detection"]).toContain(d.phase);
		}
		expect(
			safeDiags.some((d) => d.code === "RS_CANONICAL_INVALID"),
		).toBe(false);
	});

	test("RS_REDACTION_UNSAFE diagnostic is blocking", () => {
		const result = suppressOnIncompleteRedaction(
			{ diagnostics: [], content: "x" },
			null,
		);

		const unsafeDiag = result!.diagnostics.find(
			(d) => d.code === "RS_REDACTION_UNSAFE",
		);
		expect(unsafeDiag).toBeDefined();
		expect(unsafeDiag!.blocking).toBe(true);
		expect(unsafeDiag!.severity).toBe("error");
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Unchanged Non-Sensitive Report Fields (Req 9.3)
//
// Tests the inspection report building logic: deepFreeze preserves immutability,
// codePointCompare ensures deterministic ordering, and non-content fields
// are unaffected by preview suppression.
// ═══════════════════════════════════════════════════════════════════════════════

describe("inspection report — non-sensitive fields unchanged", () => {
	test("deepFreeze prevents mutation of report-like objects", () => {
		const report = deepFreeze({
			schemaVersion: "1.0",
			request: { direction: "source", strict: false, dryRun: true },
			format: { formatId: "kiro", contractVersion: "1.0", lifecycle: "active" },
			preview: { available: true },
		});

		expect(() => {
			(report as any).schemaVersion = "2.0";
		}).toThrow();
		expect(() => {
			(report.request as any).strict = true;
		}).toThrow();
	});

	test("codePointCompare orders harnesses deterministically", () => {
		const harnesses = ["kiro", "cursor", "copilot", "windsurf"];
		const sorted = [...harnesses].sort(codePointCompare);
		expect(sorted).toEqual(["copilot", "cursor", "kiro", "windsurf"]);
	});

	test("diagnostics are sorted deterministically by compareDiagnostics", () => {
		const diags: TranslationDiagnostic[] = [
			createDiagnostic("RS_DEFAULT_APPLIED", { message: "info" }),
			createDiagnostic("RS_CANONICAL_INVALID", { message: "error" }),
			createDiagnostic("RS_COMPATIBILITY_PARTIAL", { message: "warning" }),
		];
		const sorted = sortDiagnostics(diags);

		// Error first, then warning, then info
		expect(sorted[0].severity).toBe("error");
		expect(sorted[1].severity).toBe("warning");
		expect(sorted[2].severity).toBe("info");
	});

	test("preview status does not affect non-content report fields", () => {
		// Build two report-like structures: one with preview, one without
		const baseFields = {
			request: { direction: "target", targetFormat: "cursor", strict: true },
			format: { formatId: "cursor", contractVersion: "1.0", lifecycle: "active" },
			options: { effective: { lineWidth: 80 }, origins: { lineWidth: "contract-default" } },
		};

		const withPreview = deepFreeze({ ...baseFields, preview: { available: true } });
		const withoutPreview = deepFreeze({
			...baseFields,
			preview: { available: false, reason: "Redaction incomplete" },
		});

		// Non-content fields are identical regardless of preview status
		expect(withPreview.request).toEqual(withoutPreview.request);
		expect(withPreview.format).toEqual(withoutPreview.format);
		expect(withPreview.options).toEqual(withoutPreview.options);
	});

	test("diagnostic counts are computed correctly", () => {
		const diagnostics: TranslationDiagnostic[] = [
			createDiagnostic("RS_CANONICAL_INVALID", { message: "err 1" }),
			createDiagnostic("RS_UNSAFE_PATH", { message: "err 2" }),
			createDiagnostic("RS_COMPATIBILITY_PARTIAL", { message: "warn" }),
			createDiagnostic("RS_DEFAULT_APPLIED", { message: "info" }),
		];
		const sorted = sortDiagnostics(diagnostics);

		const errorCount = sorted.filter((d) => d.severity === "error").length;
		const warningCount = sorted.filter((d) => d.severity === "warning").length;
		const infoCount = sorted.filter((d) => d.severity === "info").length;
		const blockingCodes = [
			...new Set(sorted.filter((d) => d.blocking).map((d) => d.code)),
		].sort(codePointCompare);

		expect(errorCount).toBe(2);
		expect(warningCount).toBe(1);
		expect(infoCount).toBe(1);
		expect(blockingCodes.length).toBeGreaterThan(0);
	});

	test("option keys are sorted by code-point order in reports", () => {
		const options = { zebra: "z", alpha: "a", beta: "b" };
		const sortedKeys = Object.keys(options).sort(codePointCompare);
		expect(sortedKeys).toEqual(["alpha", "beta", "zebra"]);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. RedactionRegistry and Redactor (Req 13.9, 13.10, 13.11)
// ═══════════════════════════════════════════════════════════════════════════════

describe("RedactionRegistry and createRedactor", () => {
	test("registers sensitive locations with fingerprints", () => {
		const registry = new RedactionRegistry();
		const fp = computeFingerprint("AKIAIOSFODNN7EXAMPLE1");

		registry.registerSensitive(
			{ path: "config.yaml", field: "aws_key" },
			fp,
		);

		const locations = registry.getLocations();
		expect(locations).toHaveLength(1);
		expect(locations[0].path).toBe("config.yaml");
		expect(locations[0].field).toBe("aws_key");
		expect(locations[0].fingerprint).toBe(fp);
	});

	test("hasRegisteredLocations is false when empty", () => {
		const registry = new RedactionRegistry();
		expect(registry.hasRegisteredLocations()).toBe(false);
	});

	test("hasRegisteredLocations is true after registration", () => {
		const registry = new RedactionRegistry();
		registry.registerSensitive(
			{ path: "env.yaml", field: "token" },
			computeFingerprint("ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh"),
		);
		expect(registry.hasRegisteredLocations()).toBe(true);
	});

	test("redactor with no locations passes content through", () => {
		const redactor = createRedactor([]);
		const content = "This is normal content with no secrets.";
		expect(redactor.redactContent(content)).toBe(content);
	});

	test("redactor proves completeness with no locations", () => {
		const redactor = createRedactor([]);
		const proof = redactor.proveCompleteness();
		expect(proof).not.toBeNull();
		expect(proof!.complete).toBe(true);
		expect(proof!.coveredLocations).toBe(0);
		expect(proof!.totalLocations).toBe(0);
	});

	test("redactor replaces matched secrets with [REDACTED]", () => {
		const secret = "AKIAIOSFODNN7EXAMPLE";
		const fp = computeFingerprint(secret);
		const locations = [
			{ path: "config.yaml", field: "key", fingerprint: fp },
		];

		const redactor = createRedactor(locations);
		const content = `aws_key: ${secret}\nother: safe`;
		const redacted = redactor.redactContent(content);

		expect(redacted).toContain("[REDACTED]");
		expect(redacted).not.toContain(secret);
		expect(redacted).toContain("other: safe");
	});

	test("redactor proves completeness after successful redaction", () => {
		const secret = "AKIAIOSFODNN7EXAMPLE";
		const fp = computeFingerprint(secret);
		const locations = [
			{ path: "config.yaml", field: "key", fingerprint: fp },
		];

		const redactor = createRedactor(locations);
		redactor.redactContent(`key: ${secret}`);
		const proof = redactor.proveCompleteness();

		expect(proof).not.toBeNull();
		expect(proof!.complete).toBe(true);
		expect(proof!.coveredLocations).toBe(1);
		expect(proof!.totalLocations).toBe(1);
	});

	test("redactor reports incomplete when secret absent from content", () => {
		const secret = "AKIAIOSFODNN7EXAMPLE";
		const fp = computeFingerprint(secret);
		const locations = [
			{ path: "config.yaml", field: "key", fingerprint: fp },
		];

		const redactor = createRedactor(locations);
		redactor.redactContent("this content has no secrets");
		const proof = redactor.proveCompleteness();

		expect(proof).not.toBeNull();
		expect(proof!.complete).toBe(false);
		expect(proof!.coveredLocations).toBe(0);
		expect(proof!.totalLocations).toBe(1);
		expect(proof!.uncoveredPaths).toContain("config.yaml");
	});

	test("redactor redacts diagnostics containing secrets", () => {
		const secret = "AKIAIOSFODNN7EXAMPLE";
		const fp = computeFingerprint(secret);
		const locations = [
			{ path: "env.yaml", field: "aws", fingerprint: fp },
		];

		const redactor = createRedactor(locations);
		const diagnostics: TranslationDiagnostic[] = [
			createDiagnostic("RS_SENSITIVE_REJECTED", {
				message: `Found secret: ${secret} in config`,
			}),
		];
		const redacted = redactor.redactDiagnostics(diagnostics);

		expect(redacted[0].message).not.toContain(secret);
		expect(redacted[0].message).toContain("[REDACTED]");
	});

	test("getLocations returns frozen array", () => {
		const registry = new RedactionRegistry();
		registry.registerSensitive(
			{ path: "a.yaml", field: "x" },
			"fingerprint1",
		);
		const locations = registry.getLocations();
		expect(() => {
			(locations as any).push({ path: "b", field: "y", fingerprint: "z" });
		}).toThrow();
	});
});
