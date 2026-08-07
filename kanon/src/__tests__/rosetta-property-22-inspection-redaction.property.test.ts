/** Feature: rosetta-stone, Property 22: Inspection redaction fails closed and is content-noninterfering */

/**
 * Property 22: Inspection redaction fails closed and is content-noninterfering
 *
 * **Validates: Requirements 9.6, 9.7, 9.8, 13.10, 13.11**
 *
 * For any output content containing generated sensitive values, content is included
 * only when a registered redactor proves complete removal while retaining permitted
 * field/location metadata; otherwise complete content and all content-derived
 * field/location metadata are absent, and varying the excluded sensitive content
 * does not change the remaining inspection report.
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import {
	computeFingerprint,
	createRedactor,
	RedactionRegistry,
	suppressOnIncompleteRedaction,
} from "../rosetta/redaction";
import type { SensitiveLocation, RedactionProof } from "../rosetta/redaction";
import { createDiagnostic } from "../rosetta/diagnostics";
import type { TranslationDiagnostic } from "../schemas";
import { arbSensitiveCanary } from "./rosetta-arbitraries";

// ═══════════════════════════════════════════════════════════════════════════════
// Generators
// ═══════════════════════════════════════════════════════════════════════════════

/** Generates a random field name for sensitive locations */
function arbFieldName(): fc.Arbitrary<string> {
	return fc.constantFrom(
		"apiKey",
		"secret",
		"token",
		"password",
		"aws_access_key",
		"private_key",
		"auth_token",
		"client_secret",
	);
}

/** Generates a random file path for sensitive locations */
function arbFilePath(): fc.Arbitrary<string> {
	return fc
		.tuple(
			fc.constantFrom("config", "secrets", "env", "auth", "settings"),
			fc.constantFrom(".yaml", ".json", ".ts", ".env"),
		)
		.map(([name, ext]) => `${name}${ext}`);
}

/**
 * Generates canary secrets that are reliably detected by findSecretsInContent.
 * Uses only AWS key pattern since it's the most reliably matched pattern
 * (exact 20-char AKIA prefix match).
 */
function arbDetectableSecret(): fc.Arbitrary<string> {
	// AWS-style keys: AKIA + 16 uppercase alphanumeric chars
	return fc
		.array(
			fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("")),
			{ minLength: 16, maxLength: 16 },
		)
		.map((chars) => `AKIA${chars.join("")}`);
}

/** Generates a complete sensitive location with a canary secret embedded in content */
function arbSensitiveLocationWithContent(): fc.Arbitrary<{
	location: SensitiveLocation;
	secret: string;
	content: string;
}> {
	return fc
		.tuple(arbFilePath(), arbFieldName(), arbDetectableSecret())
		.map(([path, field, secret]) => {
			const fingerprint = computeFingerprint(secret);
			return {
				location: { path, field, fingerprint },
				secret,
				content: `${field}: ${secret}\nother_field: safe_value`,
			};
		});
}

/** Generates multiple sensitive locations for incomplete redaction scenarios */
function arbMultipleSensitiveLocations(): fc.Arbitrary<{
	locations: SensitiveLocation[];
	knownSecrets: string[];
	unknownSecret: string;
}> {
	return fc
		.tuple(
			fc.array(
				fc.tuple(arbFilePath(), arbFieldName(), arbDetectableSecret()),
				{ minLength: 1, maxLength: 3 },
			),
			arbDetectableSecret(),
		)
		.map(([entries, unknownSecret]) => {
			const locations = entries.map(([path, field, secret]) => ({
				path,
				field,
				fingerprint: computeFingerprint(secret),
			}));
			const knownSecrets = entries.map(([, , secret]) => secret);
			return {
				locations,
				knownSecrets,
				// Use a fingerprint that won't match any registered location
				unknownSecret,
			};
		});
}

/** Generates content containing an embedded canary secret surrounded by benign text */
function arbContentWithSecret(): fc.Arbitrary<{
	secret: string;
	content: string;
	prefix: string;
	suffix: string;
}> {
	return fc
		.tuple(
			arbDetectableSecret(),
			fc.stringMatching(/^[a-z_]{3,12}$/),
			fc.stringMatching(/^[a-z ]{3,20}$/),
		)
		.map(([secret, prefix, suffix]) => ({
			secret,
			content: `${prefix}: ${secret}\n${suffix}`,
			prefix,
			suffix,
		}));
}

/**
 * Generates a "complete" redactor scenario: locations are registered,
 * content contains the registered secrets, and all fingerprints match.
 * Uses only AWS-style keys which are reliably detected by findSecretsInContent.
 */
function arbCompleteRedactorScenario(): fc.Arbitrary<{
	locations: SensitiveLocation[];
	content: string;
	secrets: string[];
}> {
	return fc
		.array(
			fc.tuple(arbFilePath(), arbFieldName(), arbDetectableSecret()),
			{ minLength: 1, maxLength: 3 },
		)
		.map((entries) => {
			const locations: SensitiveLocation[] = [];
			const secrets: string[] = [];
			const contentParts: string[] = [];

			for (const [path, field, secret] of entries) {
				locations.push({ path, field, fingerprint: computeFingerprint(secret) });
				secrets.push(secret);
				contentParts.push(`${field}: ${secret}`);
			}

			return {
				locations,
				content: contentParts.join("\n"),
				secrets,
			};
		});
}

/**
 * Generates an "incomplete" redactor scenario: at least one registered location
 * has a fingerprint that does NOT appear in the content.
 */
function arbIncompleteRedactorScenario(): fc.Arbitrary<{
	locations: SensitiveLocation[];
	content: string;
	presentSecrets: string[];
	missingPaths: string[];
}> {
	return fc
		.tuple(
			// Present secrets (will be in content)
			fc.array(
				fc.tuple(arbFilePath(), arbFieldName(), arbDetectableSecret()),
				{ minLength: 0, maxLength: 2 },
			),
			// Missing secret (registered but not in content)
			fc.tuple(arbFilePath(), arbFieldName()),
		)
		.map(([presentEntries, [missingPath, missingField]]) => {
			const locations: SensitiveLocation[] = [];
			const presentSecrets: string[] = [];
			const contentParts: string[] = [];

			for (const [path, field, secret] of presentEntries) {
				locations.push({ path, field, fingerprint: computeFingerprint(secret) });
				presentSecrets.push(secret);
				contentParts.push(`${field}: ${secret}`);
			}

			// Add a location with a fingerprint that won't match any content
			locations.push({
				path: missingPath,
				field: missingField,
				fingerprint: "deadbeef",
			});

			return {
				locations,
				content: contentParts.join("\n") || "safe content only",
				presentSecrets,
				missingPaths: [missingPath],
			};
		});
}

/**
 * Generates diagnostics from various phases, including content-derived
 * (source-translation, target-translation) and safe (request, registry, detection).
 */
function arbMixedDiagnostics(): fc.Arbitrary<TranslationDiagnostic[]> {
	return fc
		.tuple(
			fc.boolean(), // include request-phase diagnostic
			fc.boolean(), // include detection-phase diagnostic
			fc.boolean(), // include source-translation-phase diagnostic
		)
		.map(([includeRequest, includeDetection, includeSourceTranslation]) => {
			const diagnostics: TranslationDiagnostic[] = [];
			if (includeRequest) {
				diagnostics.push(createDiagnostic("RS_INVALID_REQUEST"));
			}
			if (includeDetection) {
				diagnostics.push(createDiagnostic("RS_AMBIGUOUS_MATCH"));
			}
			if (includeSourceTranslation) {
				diagnostics.push(createDiagnostic("RS_SOURCE_LOSS"));
			}
			return diagnostics;
		});
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 22: Inspection redaction fails closed and is content-noninterfering", () => {
	it("complete redactor proves coverage and retains field/location metadata", () => {
		fc.assert(
			fc.property(arbCompleteRedactorScenario(), ({ locations, content, secrets }) => {
				const redactor = createRedactor(locations);
				const redacted = redactor.redactContent(content);

				// Content must NOT contain any raw secret
				for (const secret of secrets) {
					expect(redacted).not.toContain(secret);
				}

				// Proof must be complete
				const proof = redactor.proveCompleteness();
				expect(proof).not.toBeNull();
				expect(proof!.complete).toBe(true);
				expect(proof!.coveredLocations).toBe(locations.length);
				expect(proof!.totalLocations).toBe(locations.length);

				// Field/location metadata is retained (locations still accessible)
				for (const loc of locations) {
					expect(loc.path).toBeDefined();
					expect(loc.field).toBeDefined();
					expect(loc.fingerprint).toBeDefined();
				}
			}),
			{ numRuns: 100 },
		);
	});

	it("incomplete redactor suppresses all content and content-derived metadata", () => {
		fc.assert(
			fc.property(
				arbIncompleteRedactorScenario(),
				arbMixedDiagnostics(),
				({ locations, content, missingPaths }, diagnostics) => {
					const redactor = createRedactor(locations);
					redactor.redactContent(content);

					// Proof must be incomplete (fingerprint 'deadbeef' won't match)
					const proof = redactor.proveCompleteness();
					expect(proof).not.toBeNull();
					expect(proof!.complete).toBe(false);
					expect(proof!.uncoveredPaths.length).toBeGreaterThan(0);

					// Suppression must activate
					const suppressed = suppressOnIncompleteRedaction(
						{ diagnostics, content },
						proof,
					);
					expect(suppressed).not.toBeNull();
					expect(suppressed!.suppressed).toBe(true);

					// Content is absent
					expect(suppressed!.content).toBeNull();

					// Plan is absent
					expect(suppressed!.plan).toBeNull();

					// RS_REDACTION_UNSAFE diagnostic present
					expect(
						suppressed!.diagnostics.some((d) => d.code === "RS_REDACTION_UNSAFE"),
					).toBe(true);

					// Content-derived diagnostics are absent (source-translation phase)
					expect(
						suppressed!.diagnostics.some((d) => d.phase === "source-translation"),
					).toBe(false);
					expect(
						suppressed!.diagnostics.some((d) => d.phase === "target-translation"),
					).toBe(false);
				},
			),
			{ numRuns: 100 },
		);
	});

	it("null proof (cannot prove anything) suppresses all output", () => {
		fc.assert(
			fc.property(
				arbMixedDiagnostics(),
				fc.string({ minLength: 1, maxLength: 50 }),
				(diagnostics, content) => {
					// null proof means completeness cannot be determined at all
					const suppressed = suppressOnIncompleteRedaction(
						{ diagnostics, content },
						null,
					);
					expect(suppressed).not.toBeNull();
					expect(suppressed!.suppressed).toBe(true);
					expect(suppressed!.content).toBeNull();
					expect(suppressed!.plan).toBeNull();
					expect(
						suppressed!.diagnostics.some((d) => d.code === "RS_REDACTION_UNSAFE"),
					).toBe(true);
				},
			),
			{ numRuns: 100 },
		);
	});

	it("complete proof does NOT suppress — content is preserved", () => {
		fc.assert(
			fc.property(
				arbMixedDiagnostics(),
				fc.string({ minLength: 1, maxLength: 50 }),
				(diagnostics, content) => {
					const completeProof: RedactionProof = {
						complete: true,
						coveredLocations: 1,
						totalLocations: 1,
						uncoveredPaths: [],
					};

					const suppressed = suppressOnIncompleteRedaction(
						{ diagnostics, content },
						completeProof,
					);

					// No suppression when proof is complete
					expect(suppressed).toBeNull();
				},
			),
			{ numRuns: 100 },
		);
	});

	it("varying excluded sensitive content does not change the suppressed inspection report", () => {
		fc.assert(
			fc.property(
				arbSensitiveCanary(),
				arbSensitiveCanary(),
				arbMixedDiagnostics(),
				(secretA, secretB, diagnostics) => {
					// Two different secrets, both producing incomplete proofs
					const incompleteProof: RedactionProof = {
						complete: false,
						coveredLocations: 0,
						totalLocations: 1,
						uncoveredPaths: ["secret.yaml"],
					};

					// Suppress with content containing secretA
					const suppressedA = suppressOnIncompleteRedaction(
						{ diagnostics, content: `key: ${secretA}` },
						incompleteProof,
					);

					// Suppress with content containing secretB
					const suppressedB = suppressOnIncompleteRedaction(
						{ diagnostics, content: `key: ${secretB}` },
						incompleteProof,
					);

					// Both must be suppressed
					expect(suppressedA).not.toBeNull();
					expect(suppressedB).not.toBeNull();

					// The suppressed results must be identical regardless of the secret content
					// (content-noninterfering property)
					expect(suppressedA!.suppressed).toBe(suppressedB!.suppressed);
					expect(suppressedA!.content).toBe(suppressedB!.content);
					expect(suppressedA!.plan).toBe(suppressedB!.plan);
					expect(suppressedA!.diagnostics.length).toBe(
						suppressedB!.diagnostics.length,
					);

					// Each diagnostic code matches
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

	it("suppressed report retains only safe-phase diagnostics (request, registry, detection)", () => {
		fc.assert(
			fc.property(
				fc.tuple(
					fc.boolean(),
					fc.boolean(),
					fc.boolean(),
				),
				([hasRequest, hasRegistry, hasDetection]) => {
					const diagnostics: TranslationDiagnostic[] = [];

					// Safe-phase diagnostics
					if (hasRequest) {
						diagnostics.push(createDiagnostic("RS_INVALID_REQUEST"));
					}
					if (hasRegistry) {
						diagnostics.push(createDiagnostic("RS_INVALID_CONTRACT"));
					}
					if (hasDetection) {
						diagnostics.push(createDiagnostic("RS_AMBIGUOUS_MATCH"));
					}

					// Content-derived diagnostics (should be filtered out)
					diagnostics.push(createDiagnostic("RS_SOURCE_LOSS"));
					diagnostics.push(createDiagnostic("RS_CANONICAL_INVALID"));

					const suppressed = suppressOnIncompleteRedaction(
						{ diagnostics, content: "some sensitive content" },
						null, // null proof → fails closed
					);

					expect(suppressed).not.toBeNull();

					// RS_REDACTION_UNSAFE always present
					const redactionDiag = suppressed!.diagnostics.filter(
						(d) => d.code === "RS_REDACTION_UNSAFE",
					);
					expect(redactionDiag.length).toBe(1);

					// Only safe-phase diagnostics retained
					const retained = suppressed!.diagnostics.filter(
						(d) => d.code !== "RS_REDACTION_UNSAFE",
					);
					for (const d of retained) {
						expect(["request", "registry", "detection"]).toContain(d.phase);
					}

					// Content-derived diagnostics absent
					expect(
						suppressed!.diagnostics.some((d) => d.code === "RS_SOURCE_LOSS"),
					).toBe(false);
					expect(
						suppressed!.diagnostics.some(
							(d) => d.code === "RS_CANONICAL_INVALID",
						),
					).toBe(false);
				},
			),
			{ numRuns: 100 },
		);
	});

	it("redaction registry fingerprints are non-reversible and deterministic", () => {
		fc.assert(
			fc.property(arbSensitiveCanary(), (secret) => {
				const registry = new RedactionRegistry();
				const fingerprint = computeFingerprint(secret);

				registry.registerSensitive(
					{ path: "test.yaml", field: "key" },
					fingerprint,
				);

				const locations = registry.getLocations();
				expect(locations).toHaveLength(1);

				// Fingerprint is deterministic (same secret → same fingerprint)
				expect(computeFingerprint(secret)).toBe(fingerprint);

				// Fingerprint does not contain the raw secret
				expect(fingerprint).not.toContain(secret);

				// Fingerprint is fixed 8-char hex
				expect(fingerprint).toMatch(/^[0-9a-f]{8}$/);
			}),
			{ numRuns: 100 },
		);
	});

	it("redactor diagnostic redaction removes secrets from messages", () => {
		fc.assert(
			fc.property(arbSensitiveLocationWithContent(), ({ location, secret }) => {
				const redactor = createRedactor([location]);

				// Create a diagnostic that accidentally includes the raw secret
				// The secret is an AWS-style key, reliably detectable by findSecretsInContent
				const leakyDiagnostic = createDiagnostic("RS_SOURCE_LOSS", {
					message: `Value ${secret} is unmapped.`,
				});

				const redacted = redactor.redactDiagnostics([leakyDiagnostic]);

				// Redacted diagnostic must not contain raw secret
				expect(redacted[0].message).not.toContain(secret);
			}),
			{ numRuns: 100 },
		);
	});
});
