/**
 * Unit tests for src/rosetta/redaction.ts
 *
 * Covers sensitive-value handling, policy application, redaction registry,
 * structured redactor, completeness proofs, and suppression.
 */

import { describe, expect, test } from "bun:test";
import { createDiagnostic } from "../rosetta/diagnostics";
import {
	applySensitivePolicy,
	computeFingerprint,
	createRedactor,
	looksLikeSecret,
	matchesApprovedPattern,
	RedactionRegistry,
	suppressOnIncompleteRedaction,
} from "../rosetta/redaction";

describe("computeFingerprint", () => {
	test("returns an 8-character hex string", () => {
		const fp = computeFingerprint("my-secret-value");
		expect(fp).toMatch(/^[0-9a-f]{8}$/);
	});

	test("same input produces same fingerprint", () => {
		const a = computeFingerprint("test-secret");
		const b = computeFingerprint("test-secret");
		expect(a).toBe(b);
	});

	test("different inputs produce different fingerprints", () => {
		const a = computeFingerprint("secret-one");
		const b = computeFingerprint("secret-two");
		expect(a).not.toBe(b);
	});

	test("empty string produces a valid fingerprint", () => {
		const fp = computeFingerprint("");
		expect(fp).toMatch(/^[0-9a-f]{8}$/);
	});
});

describe("looksLikeSecret", () => {
	test("detects AWS access keys", () => {
		expect(looksLikeSecret("AKIAIOSFODNN7EXAMPLE")).toBe(true);
	});

	test("detects GitHub tokens", () => {
		expect(looksLikeSecret("ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij")).toBe(
			true,
		);
	});

	test("detects JWT-like tokens", () => {
		expect(
			looksLikeSecret(
				"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0",
			),
		).toBe(true);
	});

	test("detects password field patterns", () => {
		expect(looksLikeSecret('password: "mysupersecretpassword123"')).toBe(true);
	});

	test("does not flag normal short text", () => {
		expect(looksLikeSecret("hello world")).toBe(false);
	});

	test("does not flag simple configuration values", () => {
		expect(looksLikeSecret("production")).toBe(false);
	});
});

describe("matchesApprovedPattern", () => {
	test("matches ${ENV_VAR} pattern", () => {
		const patterns = ["^\\$\\{[A-Z_]+\\}$"];
		expect(matchesApprovedPattern("${MY_SECRET}", patterns)).toBe(true);
	});

	test("rejects literal values not matching patterns", () => {
		const patterns = ["^\\$\\{[A-Z_]+\\}$"];
		expect(matchesApprovedPattern("literal-secret-value", patterns)).toBe(
			false,
		);
	});

	test("handles empty patterns array", () => {
		expect(matchesApprovedPattern("${MY_SECRET}", [])).toBe(false);
	});

	test("handles invalid regex patterns gracefully", () => {
		const patterns = ["[invalid("];
		expect(matchesApprovedPattern("test", patterns)).toBe(false);
	});
});

describe("RedactionRegistry", () => {
	test("starts with no registered locations", () => {
		const registry = new RedactionRegistry();
		expect(registry.hasRegisteredLocations()).toBe(false);
		expect(registry.getLocations()).toHaveLength(0);
	});

	test("registers sensitive locations", () => {
		const registry = new RedactionRegistry();
		registry.registerSensitive(
			{ path: "config.yaml", field: "apiKey" },
			"abc12345",
		);
		expect(registry.hasRegisteredLocations()).toBe(true);
		expect(registry.getLocations()).toHaveLength(1);
	});

	test("returns frozen locations array", () => {
		const registry = new RedactionRegistry();
		registry.registerSensitive({ path: "file.ts", field: "token" }, "deadbeef");
		const locations = registry.getLocations();
		expect(Object.isFrozen(locations)).toBe(true);
	});

	test("registered locations include fingerprint", () => {
		const registry = new RedactionRegistry();
		registry.registerSensitive(
			{ path: "secrets.yaml", field: "password" },
			"12345678",
		);
		const loc = registry.getLocations()[0];
		expect(loc.path).toBe("secrets.yaml");
		expect(loc.field).toBe("password");
		expect(loc.fingerprint).toBe("12345678");
	});
});

describe("applySensitivePolicy", () => {
	const awsKey = "AKIAIOSFODNN7EXAMPLE";

	test("preserve policy passes content unchanged", () => {
		const result = applySensitivePolicy(`key=${awsKey}`, "preserve", []);
		expect(result.ok).toBe(true);
		expect(result.content).toBe(`key=${awsKey}`);
		expect(result.diagnostics).toHaveLength(0);
	});

	test("reject policy returns error for literal secrets", () => {
		const result = applySensitivePolicy(`key=${awsKey}`, "reject", []);
		expect(result.ok).toBe(false);
		expect(result.diagnostics.length).toBeGreaterThan(0);
		expect(result.diagnostics[0].code).toBe("RS_SENSITIVE_REJECTED");
	});

	test("reject policy allows approved references", () => {
		const result = applySensitivePolicy("key=${AWS_ACCESS_KEY}", "reject", [
			"^\\$\\{[A-Z_]+\\}$",
		]);
		// The ${...} pattern is not a secret per se, it's a reference
		expect(result.ok).toBe(true);
	});

	test("reference-only policy rejects literal secrets", () => {
		const result = applySensitivePolicy(`token=${awsKey}`, "reference-only", [
			"^\\$\\{[A-Z_]+\\}$",
		]);
		expect(result.ok).toBe(false);
		expect(result.diagnostics[0].code).toBe("RS_SENSITIVE_REFERENCE_INVALID");
	});

	test("reference-only policy accepts approved patterns", () => {
		const result = applySensitivePolicy(
			"token=${SECRET_TOKEN}",
			"reference-only",
			["^\\$\\{[A-Z_]+\\}$"],
		);
		// This contains no literal secrets, just the reference
		expect(result.ok).toBe(true);
	});

	test("clean content passes all policies", () => {
		const content = "name: my-artifact\nversion: 1.0.0";
		for (const policy of ["reject", "preserve", "reference-only"] as const) {
			const result = applySensitivePolicy(content, policy, []);
			expect(result.ok).toBe(true);
		}
	});
});

describe("createRedactor", () => {
	test("empty locations returns content unchanged", () => {
		const redactor = createRedactor([]);
		expect(redactor.redactContent("hello world")).toBe("hello world");
	});

	test("redacts matching secrets from content", () => {
		const secret = "AKIAIOSFODNN7EXAMPLE";
		const fingerprint = computeFingerprint(secret);
		const locations = [{ path: "config.yaml", field: "aws_key", fingerprint }];

		const redactor = createRedactor(locations);
		const result = redactor.redactContent(`key=${secret}`);
		expect(result).toBe("key=[REDACTED]");
		expect(result).not.toContain(secret);
	});

	test("proveCompleteness returns complete for empty locations", () => {
		const redactor = createRedactor([]);
		const proof = redactor.proveCompleteness();
		expect(proof).not.toBeNull();
		expect(proof!.complete).toBe(true);
		expect(proof!.totalLocations).toBe(0);
	});

	test("proveCompleteness returns incomplete when locations not covered", () => {
		const locations = [
			{ path: "secret.yaml", field: "key", fingerprint: "nomatch0" },
		];
		const redactor = createRedactor(locations);
		// No content redacted, so coverage is zero
		redactor.redactContent("nothing secret here");
		const proof = redactor.proveCompleteness();
		expect(proof).not.toBeNull();
		expect(proof!.complete).toBe(false);
		expect(proof!.uncoveredPaths).toContain("secret.yaml");
	});

	test("proveCompleteness returns complete after successful redaction", () => {
		const secret = "AKIAIOSFODNN7EXAMPLE";
		const fingerprint = computeFingerprint(secret);
		const locations = [{ path: "config.yaml", field: "aws_key", fingerprint }];

		const redactor = createRedactor(locations);
		redactor.redactContent(`access_key: ${secret}`);
		const proof = redactor.proveCompleteness();
		expect(proof).not.toBeNull();
		expect(proof!.complete).toBe(true);
		expect(proof!.coveredLocations).toBe(1);
		expect(proof!.totalLocations).toBe(1);
	});

	test("redactDiagnostics strips secrets from messages", () => {
		const secret = "AKIAIOSFODNN7EXAMPLE";
		const locations = [
			{
				path: "file.yaml",
				field: "key",
				fingerprint: computeFingerprint(secret),
			},
		];

		const redactor = createRedactor(locations);
		const diagnostics = [
			createDiagnostic("RS_SENSITIVE_REJECTED", {
				message: `Found secret: ${secret}`,
			}),
		];

		const redacted = redactor.redactDiagnostics(diagnostics);
		expect(redacted[0].message).not.toContain(secret);
		expect(redacted[0].message).toContain("[REDACTED]");
	});
});

describe("suppressOnIncompleteRedaction", () => {
	test("returns null when proof is complete", () => {
		const proof = {
			complete: true,
			coveredLocations: 2,
			totalLocations: 2,
			uncoveredPaths: [],
		};
		const result = suppressOnIncompleteRedaction(
			{ diagnostics: [], content: "some content" },
			proof,
		);
		expect(result).toBeNull();
	});

	test("suppresses when proof is null", () => {
		const result = suppressOnIncompleteRedaction(
			{ diagnostics: [], content: "some content" },
			null,
		);
		expect(result).not.toBeNull();
		expect(result!.suppressed).toBe(true);
		expect(result!.content).toBeNull();
		expect(result!.plan).toBeNull();
		expect(result!.diagnostics[0].code).toBe("RS_REDACTION_UNSAFE");
	});

	test("suppresses when proof is incomplete", () => {
		const proof = {
			complete: false,
			coveredLocations: 1,
			totalLocations: 3,
			uncoveredPaths: ["a.yaml", "b.yaml"],
		};
		const result = suppressOnIncompleteRedaction(
			{
				diagnostics: [
					createDiagnostic("RS_SOURCE_LOSS"),
					createDiagnostic("RS_INVALID_REQUEST"),
				],
				content: "secret content",
			},
			proof,
		);
		expect(result).not.toBeNull();
		expect(result!.suppressed).toBe(true);
		expect(result!.content).toBeNull();
		// Should keep request-phase diagnostics (safe) and add RS_REDACTION_UNSAFE
		expect(
			result!.diagnostics.some((d) => d.code === "RS_REDACTION_UNSAFE"),
		).toBe(true);
		expect(
			result!.diagnostics.some((d) => d.code === "RS_INVALID_REQUEST"),
		).toBe(true);
		// Should NOT keep source-translation phase diagnostics (may contain sensitive content)
		expect(result!.diagnostics.some((d) => d.code === "RS_SOURCE_LOSS")).toBe(
			false,
		);
	});

	test("includes informative message about incomplete coverage", () => {
		const proof = {
			complete: false,
			coveredLocations: 1,
			totalLocations: 2,
			uncoveredPaths: ["secret.yaml"],
		};
		const result = suppressOnIncompleteRedaction({ diagnostics: [] }, proof);
		expect(result!.diagnostics[0].message).toContain("1/2");
	});
});
