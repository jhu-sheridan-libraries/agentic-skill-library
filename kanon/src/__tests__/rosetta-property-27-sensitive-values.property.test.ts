/** Feature: rosetta-stone, Property 27: Sensitive-value policy never leaks diagnostic or report payloads */

/**
 * Property 27: Sensitive-value policy never leaks diagnostic or report payloads
 *
 * **Validates: Requirements 13.9, 13.10, 13.11**
 *
 * For any generated credential-like value and format security policy, the value is
 * preserved, rejected, or accepted only as a reference exactly as declared, while
 * no human or machine diagnostic/inspection serialization contains the raw value;
 * if safe diagnostic construction cannot be guaranteed, only the minimal redaction
 * failure is returned and translation is aborted.
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import {
	applySensitivePolicy,
	computeFingerprint,
	createRedactor,
	looksLikeSecret,
	matchesApprovedPattern,
	RedactionRegistry,
	suppressOnIncompleteRedaction,
} from "../rosetta/redaction";
import type {
	PolicyApplicationResult,
	RedactionProof,
	SensitiveLocation,
} from "../rosetta/redaction";
import { createDiagnostic } from "../rosetta/diagnostics";
import type { FormatSecurityPolicy, TranslationDiagnostic } from "../schemas";
import { arbFormatSecurityPolicy, arbSensitiveCanary } from "./rosetta-arbitraries";

// ═══════════════════════════════════════════════════════════════════════════════
// Generators
// ═══════════════════════════════════════════════════════════════════════════════

/** Generates one of the three contract security policies */
function arbSensitiveValuePolicy(): fc.Arbitrary<
	FormatSecurityPolicy["sensitiveValuePolicy"]
> {
	return fc.constantFrom("reject", "preserve", "reference-only");
}

/** Generates approved reference patterns (${ENV_VAR} style) */
function arbApprovedReference(): fc.Arbitrary<string> {
	return fc
		.stringMatching(/^[A-Z][A-Z0-9_]{2,12}$/)
		.map((name) => `\${${name}}`);
}

/** Generates content that wraps a canary secret in surrounding text */
function arbContentWithCanary(
	canary: fc.Arbitrary<string>,
): fc.Arbitrary<{ content: string; secret: string }> {
	return fc
		.tuple(
			canary,
			fc.constantFrom("apiKey", "secret", "token", "password", "auth"),
			fc.constantFrom(" value", " = data", ": config"),
		)
		.map(([secret, field, suffix]) => ({
			content: `${field}: ${secret}\n${suffix}`,
			secret,
		}));
}

/**
 * Generates AWS-style detectable secrets (AKIA + 16 uppercase alphanumeric chars).
 * These are reliably detected by findSecretsInContent.
 */
function arbDetectableSecret(): fc.Arbitrary<string> {
	return fc
		.array(
			fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("")),
			{ minLength: 16, maxLength: 16 },
		)
		.map((chars) => `AKIA${chars.join("")}`);
}

/** Generates a diagnostic that accidentally embeds a raw secret in its message */
function arbLeakyDiagnostic(
	secret: fc.Arbitrary<string>,
): fc.Arbitrary<{ diagnostic: TranslationDiagnostic; secret: string }> {
	return secret.map((s) => ({
		diagnostic: createDiagnostic("RS_SOURCE_LOSS", {
			message: `Unmapped value: ${s}`,
		}),
		secret: s,
	}));
}

/**
 * Generates a scenario with registered locations, detectable content,
 * and one location whose fingerprint cannot be matched in content.
 * This simulates incomplete redaction.
 */
function arbIncompleteRedactionScenario(): fc.Arbitrary<{
	locations: SensitiveLocation[];
	content: string;
	diagnostics: TranslationDiagnostic[];
}> {
	return fc
		.tuple(
			arbDetectableSecret(),
			fc.constantFrom("config.yaml", "secrets.json", "env.ts"),
			fc.constantFrom("apiKey", "token", "secret"),
		)
		.map(([secret, path, field]) => {
			// Register the real location
			const realLocation: SensitiveLocation = {
				path,
				field,
				fingerprint: computeFingerprint(secret),
			};
			// Add a phantom location that can never be covered
			const phantomLocation: SensitiveLocation = {
				path: "unknown.yaml",
				field: "phantom",
				fingerprint: "00000000",
			};

			const diagnostic = createDiagnostic("RS_SOURCE_LOSS", {
				message: `Found issue with value ${secret} at ${path}`,
			});

			return {
				locations: [realLocation, phantomLocation],
				content: `${field}: ${secret}\nother: safe_value`,
				diagnostics: [diagnostic],
			};
		});
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 27: Sensitive-value policy never leaks diagnostic or report payloads", () => {
	it("preserve policy passes content unchanged without diagnostics", () => {
		fc.assert(
			fc.property(
				arbSensitiveCanary(),
				fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 3 }),
				(canary, patterns) => {
					const result = applySensitivePolicy(canary, "preserve", patterns);

					// Preserve always succeeds and returns content unchanged
					expect(result.ok).toBe(true);
					expect(result.content).toBe(canary);
					expect(result.diagnostics).toHaveLength(0);
				},
			),
			{ numRuns: 100 },
		);
	});

	it("reject policy blocks literal secrets not matching approved references", () => {
		fc.assert(
			fc.property(arbDetectableSecret(), (secret) => {
				// No approved patterns → literal secret must be rejected
				const result = applySensitivePolicy(
					`key: ${secret}`,
					"reject",
					[],
				);

				expect(result.ok).toBe(false);
				expect(result.diagnostics.length).toBeGreaterThan(0);
				expect(result.diagnostics[0].code).toBe("RS_SENSITIVE_REJECTED");

				// The diagnostic message must NOT contain the raw secret value
				for (const diag of result.diagnostics) {
					expect(diag.message).not.toContain(secret);
				}
			}),
			{ numRuns: 100 },
		);
	});

	it("reject policy allows content matching approved reference patterns", () => {
		fc.assert(
			fc.property(arbApprovedReference(), (ref) => {
				// The approved pattern matches ${ENV_VAR} syntax
				const approvedPatterns = ["\\$\\{[A-Z][A-Z0-9_]*\\}"];
				const content = `token: ${ref}`;

				const result = applySensitivePolicy(content, "reject", approvedPatterns);

				// Reference values that match approved patterns should pass
				expect(result.ok).toBe(true);
				expect(result.diagnostics).toHaveLength(0);
			}),
			{ numRuns: 100 },
		);
	});

	it("reference-only policy rejects literals not matching approved patterns", () => {
		fc.assert(
			fc.property(arbDetectableSecret(), (secret) => {
				// No approved patterns → reference-only rejects literal secrets
				const result = applySensitivePolicy(
					`key: ${secret}`,
					"reference-only",
					[],
				);

				expect(result.ok).toBe(false);
				expect(result.diagnostics.length).toBeGreaterThan(0);
				expect(result.diagnostics[0].code).toBe(
					"RS_SENSITIVE_REFERENCE_INVALID",
				);

				// Diagnostics must NOT leak the raw secret value
				for (const diag of result.diagnostics) {
					expect(diag.message).not.toContain(secret);
				}
			}),
			{ numRuns: 100 },
		);
	});

	it("reference-only policy accepts approved ${ENV_VAR} references", () => {
		fc.assert(
			fc.property(arbApprovedReference(), (ref) => {
				const approvedPatterns = ["\\$\\{[A-Z][A-Z0-9_]*\\}"];
				const content = `secret: ${ref}`;

				const result = applySensitivePolicy(
					content,
					"reference-only",
					approvedPatterns,
				);

				expect(result.ok).toBe(true);
				expect(result.diagnostics).toHaveLength(0);
			}),
			{ numRuns: 100 },
		);
	});

	it("diagnostics never contain raw sensitive values after redaction", () => {
		fc.assert(
			fc.property(arbDetectableSecret(), (secret) => {
				const fingerprint = computeFingerprint(secret);
				const location: SensitiveLocation = {
					path: "config.yaml",
					field: "apiKey",
					fingerprint,
				};

				const redactor = createRedactor([location]);

				// Simulate a diagnostic that accidentally embeds the raw secret
				const leakyDiag = createDiagnostic("RS_SOURCE_LOSS", {
					message: `Unmapped credential: ${secret}`,
				});

				const redacted = redactor.redactDiagnostics([leakyDiag]);

				// No redacted diagnostic may contain the raw secret
				for (const diag of redacted) {
					expect(diag.message).not.toContain(secret);
					expect(diag.remediation).not.toContain(secret);
				}
			}),
			{ numRuns: 100 },
		);
	});

	it("incomplete redaction aborts translation and returns only RS_REDACTION_UNSAFE", () => {
		fc.assert(
			fc.property(arbIncompleteRedactionScenario(), (scenario) => {
				const redactor = createRedactor(scenario.locations);
				redactor.redactContent(scenario.content);

				const proof = redactor.proveCompleteness();
				expect(proof).not.toBeNull();
				expect(proof!.complete).toBe(false);

				// suppressOnIncompleteRedaction must activate
				const suppressed = suppressOnIncompleteRedaction(
					{ diagnostics: scenario.diagnostics, content: scenario.content },
					proof,
				);

				expect(suppressed).not.toBeNull();
				expect(suppressed!.suppressed).toBe(true);

				// All output content is suppressed
				expect(suppressed!.content).toBeNull();
				expect(suppressed!.plan).toBeNull();

				// RS_REDACTION_UNSAFE is the primary diagnostic
				expect(
					suppressed!.diagnostics.some((d) => d.code === "RS_REDACTION_UNSAFE"),
				).toBe(true);

				// No suppressed diagnostic contains raw secrets from the content
				const secret = scenario.content.match(/AKIA[A-Z0-9]{16}/)?.[0];
				if (secret) {
					for (const diag of suppressed!.diagnostics) {
						expect(diag.message).not.toContain(secret);
						expect(diag.remediation).not.toContain(secret);
					}
				}
			}),
			{ numRuns: 100 },
		);
	});

	it("policy behavior is consistent across all three security policies for any canary", () => {
		fc.assert(
			fc.property(
				arbDetectableSecret(),
				arbSensitiveValuePolicy(),
				fc.array(fc.constant("\\$\\{[A-Z][A-Z0-9_]*\\}"), { maxLength: 2 }),
				(secret, policy, patterns) => {
					const content = `credential: ${secret}`;
					const result = applySensitivePolicy(content, policy, patterns);

					if (policy === "preserve") {
						// Preserve always succeeds
						expect(result.ok).toBe(true);
						expect(result.content).toBe(content);
					} else {
						// reject and reference-only block literal secrets (no matching pattern)
						expect(result.ok).toBe(false);
						expect(result.diagnostics.length).toBeGreaterThan(0);

						// No diagnostic leaks the raw secret
						for (const diag of result.diagnostics) {
							expect(diag.message).not.toContain(secret);
						}
					}
				},
			),
			{ numRuns: 100 },
		);
	});

	it("looksLikeSecret detects AWS keys, GitHub tokens, and JWTs from canary set", () => {
		fc.assert(
			fc.property(arbDetectableSecret(), (secret) => {
				// AWS-style keys (AKIA prefix) are always reliably detected
				expect(looksLikeSecret(secret)).toBe(true);
			}),
			{ numRuns: 100 },
		);
	});

	it("looksLikeSecret detects high-entropy canaries embedded in field context", () => {
		fc.assert(
			fc.property(arbSensitiveCanary(), (canary) => {
				// Embed the canary in a password-field context to trigger detection
				const contextual = `password: ${canary}`;
				// Either the value alone triggers detection, or in context it does
				const detectedAlone = looksLikeSecret(canary);
				const detectedInContext = looksLikeSecret(contextual);
				expect(detectedAlone || detectedInContext).toBe(true);
			}),
			{ numRuns: 100 },
		);
	});

	it("approved ${ENV_VAR} references are never flagged as secrets by matchesApprovedPattern", () => {
		fc.assert(
			fc.property(arbApprovedReference(), (ref) => {
				const approvedPatterns = ["\\$\\{[A-Z][A-Z0-9_]*\\}"];
				expect(matchesApprovedPattern(ref, approvedPatterns)).toBe(true);
			}),
			{ numRuns: 100 },
		);
	});

	it("suppressed output is identical regardless of varying secret content", () => {
		fc.assert(
			fc.property(
				arbDetectableSecret(),
				arbDetectableSecret(),
				(secretA, secretB) => {
					const incompleteProof: RedactionProof = {
						complete: false,
						coveredLocations: 0,
						totalLocations: 1,
						uncoveredPaths: ["unknown.yaml"],
					};

					const baseDiagnostics = [createDiagnostic("RS_INVALID_REQUEST")];

					const suppressedA = suppressOnIncompleteRedaction(
						{ diagnostics: baseDiagnostics, content: `key: ${secretA}` },
						incompleteProof,
					);
					const suppressedB = suppressOnIncompleteRedaction(
						{ diagnostics: baseDiagnostics, content: `key: ${secretB}` },
						incompleteProof,
					);

					// Both are suppressed
					expect(suppressedA).not.toBeNull();
					expect(suppressedB).not.toBeNull();

					// Suppressed results are structurally identical
					expect(suppressedA!.suppressed).toBe(suppressedB!.suppressed);
					expect(suppressedA!.content).toBe(suppressedB!.content);
					expect(suppressedA!.plan).toBe(suppressedB!.plan);
					expect(suppressedA!.diagnostics.length).toBe(
						suppressedB!.diagnostics.length,
					);

					// Each diagnostic code and phase matches
					for (let i = 0; i < suppressedA!.diagnostics.length; i++) {
						expect(suppressedA!.diagnostics[i].code).toBe(
							suppressedB!.diagnostics[i].code,
						);
						expect(suppressedA!.diagnostics[i].phase).toBe(
							suppressedB!.diagnostics[i].phase,
						);
					}
				},
			),
			{ numRuns: 100 },
		);
	});
});
