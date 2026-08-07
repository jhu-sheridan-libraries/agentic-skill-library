/**
 * Property 23: Profile validation separates concerns and halts invalid work
 *
 * **Validates: Requirements 10.4, 10.5, 10.6, 10.7, 13.12**
 *
 * This property test verifies that for any ForgeConfig with acquisition/translation profiles:
 * 1. Non-kebab-case profile keys always produce error diagnostics
 * 2. Unknown format IDs produce errors when a registry is provided
 * 3. Path traversal in canonicalDestination always produces errors
 * 4. Literal credentials (high-entropy strings, AWS keys, GitHub tokens) produce error diagnostics
 * 5. Approved references (${ENV_VAR}) never produce credential diagnostics
 * 6. Valid profiles with no issues produce zero diagnostics
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import {
	type ForgeConfig,
	validateProfiles,
	type ProfileValidationOptions,
} from "../config";

// ═══════════════════════════════════════════════════════════════════════════════
// Arbitraries
// ═══════════════════════════════════════════════════════════════════════════════

/** Generates valid kebab-case profile keys */
function arbKebabCaseKey(): fc.Arbitrary<string> {
	return fc
		.array(fc.stringMatching(/^[a-z0-9]{2,8}$/), {
			minLength: 1,
			maxLength: 3,
		})
		.map((segments) => segments.join("-"));
}

/** Generates invalid non-kebab-case profile keys */
function arbNonKebabCaseKey(): fc.Arbitrary<string> {
	return fc.oneof(
		// Uppercase chars
		fc.stringMatching(/^[A-Z][a-zA-Z0-9]{2,10}$/),
		// Spaces
		fc.stringMatching(/^[a-z]{2,5} [a-z]{2,5}$/),
		// Underscores
		fc.stringMatching(/^[a-z]{2,5}_[a-z]{2,5}$/),
		// CamelCase
		fc.stringMatching(/^[a-z]{2,5}[A-Z][a-z]{2,5}$/),
		// Leading/trailing hyphens
		fc.stringMatching(/^-[a-z]{2,8}$/),
		// Empty string
		fc.constant(""),
	);
}

/** Generates a valid format identifier (kebab-case) */
function arbFormatId(): fc.Arbitrary<string> {
	return fc
		.array(fc.stringMatching(/^[a-z0-9]{2,6}$/), {
			minLength: 1,
			maxLength: 3,
		})
		.map((segments) => segments.join("-"));
}

/** Generates an approved credential reference ${ENV_VAR} */
function arbApprovedReference(): fc.Arbitrary<string> {
	return fc
		.stringMatching(/^[A-Z][A-Z0-9_]{2,15}$/)
		.map((name) => `\${${name}}`);
}

/** Generates literal credentials that should be detected as secrets */
function arbLiteralCredential(): fc.Arbitrary<string> {
	return fc.oneof(
		// AWS access keys (AKIA + 16 uppercase alphanumeric chars)
		fc
			.stringMatching(/^[A-Z0-9]{16}$/)
			.map((suffix) => `AKIA${suffix}`),
		// GitHub tokens (ghp_ + 36 alphanumeric chars)
		fc
			.stringMatching(/^[a-zA-Z0-9]{36}$/)
			.map((suffix) => `ghp_${suffix}`),
	);
}

/** Generates path strings with traversal (..) patterns */
function arbTraversalPath(): fc.Arbitrary<string> {
	return fc.oneof(
		// Leading traversal
		fc.stringMatching(/^[a-z]{2,8}$/).map((dir) => `../${dir}`),
		// Mid-path traversal
		fc
			.tuple(
				fc.stringMatching(/^[a-z]{2,6}$/),
				fc.stringMatching(/^[a-z]{2,6}$/),
			)
			.map(([pre, post]) => `${pre}/../${post}`),
		// Just ../
		fc.constant("../knowledge"),
		// Deep traversal
		fc.constant("../../etc/passwd"),
	);
}

/** Generates a valid safe path without traversal */
function arbSafePath(): fc.Arbitrary<string> {
	return fc
		.array(fc.stringMatching(/^[a-z0-9][a-z0-9_-]{0,8}$/), {
			minLength: 1,
			maxLength: 3,
		})
		.map((segments) => segments.join("/"));
}

/** Generates a valid acquisition profile */
function arbValidAcquisitionProfile(): fc.Arbitrary<{
	repo: string;
	branch: string;
	remote: string;
}> {
	return fc
		.tuple(
			// Use predictable low-entropy repo format: simple-user/simple-repo
			fc.stringMatching(/^[a-z]{3,6}$/),
			fc.stringMatching(/^[a-z]{3,6}$/),
			fc.constantFrom("main", "develop", "staging"),
			fc.constantFrom("origin", "upstream"),
		)
		.map(([user, repo, branch, remote]) => ({
			repo: `${user}/${repo}`,
			branch,
			remote,
		}));
}

/** Generates a valid translation profile (all safe values) */
function arbValidTranslationProfile(
	knownFormats: string[],
): fc.Arbitrary<{
	sourceFormat?: string;
	canonicalDestination: string;
	collections: string[];
	strict: boolean;
	options: Record<string, unknown>;
}> {
	return fc
		.tuple(
			knownFormats.length > 0
				? fc.constantFrom(...knownFormats)
				: fc.constant(undefined),
			arbSafePath(),
			fc.boolean(),
		)
		.map(([sourceFormat, dest, strict]) => ({
			...(sourceFormat ? { sourceFormat } : {}),
			canonicalDestination: dest,
			collections: [],
			strict,
			options: {},
		}));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 23: Profile validation separates concerns and halts invalid work", () => {
	it("non-kebab-case profile keys always produce error diagnostics", () => {
		fc.assert(
			fc.property(
				arbNonKebabCaseKey(),
				fc.oneof(fc.constant("acquisitions"), fc.constant("translations")),
				(badKey, section) => {
					const config: ForgeConfig =
						section === "acquisitions"
							? {
									acquisitions: {
										[badKey]: { repo: "org/repo", branch: "main", remote: "origin" },
									},
								}
							: {
									translations: {
										[badKey]: { collections: [], strict: false, options: {} },
									},
								};

					const result = validateProfiles(config);

					// Must produce at least one error diagnostic
					const errors = result.diagnostics.filter(
						(d) => d.severity === "error",
					);
					expect(errors.length).toBeGreaterThanOrEqual(1);
					expect(result.valid).toBe(false);

					// The error must reference the bad key
					const hasKeyDiag = errors.some(
						(d) => d.path.includes(badKey) && d.message.includes("kebab-case"),
					);
					expect(hasKeyDiag).toBe(true);
				},
			),
			{ numRuns: 100 },
		);
	});

	it("unknown format IDs produce errors when a registry is provided", () => {
		fc.assert(
			fc.property(
				arbKebabCaseKey(),
				arbFormatId(),
				fc.constantFrom("sourceFormat", "targetFormat"),
				(profileKey, unknownFormat, field) => {
					// Provide a registry that does NOT include unknownFormat
					const knownFormatIds = new Set(["kanon-canonical", "kiro-power", "kiro-skill"]);

					// Ensure our generated format is actually unknown
					fc.pre(!knownFormatIds.has(unknownFormat));

					const config: ForgeConfig = {
						translations: {
							[profileKey]: {
								[field]: unknownFormat,
								collections: [],
								strict: false,
								options: {},
							},
						},
					};

					const result = validateProfiles(config, { knownFormatIds });

					const errors = result.diagnostics.filter(
						(d) => d.severity === "error",
					);
					const hasFormatError = errors.some(
						(d) =>
							d.path.includes(profileKey) &&
							d.path.includes(field) &&
							d.message.includes("unknown format"),
					);
					expect(hasFormatError).toBe(true);
					expect(result.valid).toBe(false);
				},
			),
			{ numRuns: 100 },
		);
	});

	it("path traversal in canonicalDestination always produces errors", () => {
		fc.assert(
			fc.property(
				arbKebabCaseKey(),
				arbTraversalPath(),
				(profileKey, traversalPath) => {
					const config: ForgeConfig = {
						translations: {
							[profileKey]: {
								canonicalDestination: traversalPath,
								collections: [],
								strict: false,
								options: {},
							},
						},
					};

					const result = validateProfiles(config);

					const errors = result.diagnostics.filter(
						(d) => d.severity === "error",
					);
					const hasTraversalError = errors.some(
						(d) =>
							d.path.includes("canonicalDestination") &&
							d.message.includes("traversal"),
					);
					expect(hasTraversalError).toBe(true);
					expect(result.valid).toBe(false);
				},
			),
			{ numRuns: 100 },
		);
	});

	it("literal credentials produce error diagnostics", () => {
		fc.assert(
			fc.property(
				arbKebabCaseKey(),
				arbLiteralCredential(),
				(profileKey, credential) => {
					// Test in acquisition profile's credentialReference field
					const config: ForgeConfig = {
						acquisitions: {
							[profileKey]: {
								repo: "org/repo",
								branch: "main",
								remote: "origin",
								credentialReference: credential,
							},
						},
					};

					const result = validateProfiles(config);

					// Must detect credentials as errors
					const errors = result.diagnostics.filter(
						(d) => d.severity === "error",
					);
					const hasCredentialError = errors.some(
						(d) => d.message.includes("credential"),
					);
					expect(hasCredentialError).toBe(true);
					expect(result.valid).toBe(false);
				},
			),
			{ numRuns: 100 },
		);
	});

	it("approved references (${ENV_VAR}) never produce credential diagnostics", () => {
		fc.assert(
			fc.property(
				arbKebabCaseKey(),
				arbApprovedReference(),
				(profileKey, reference) => {
					const config: ForgeConfig = {
						acquisitions: {
							[profileKey]: {
								repo: "org/repo",
								branch: "main",
								remote: "origin",
								credentialReference: reference,
							},
						},
					};

					const result = validateProfiles(config);

					// Must NOT produce credential-related errors
					const credentialErrors = result.diagnostics.filter(
						(d) =>
							d.severity === "error" && d.message.includes("credential"),
					);
					expect(credentialErrors.length).toBe(0);
				},
			),
			{ numRuns: 100 },
		);
	});

	it("valid profiles with no issues produce zero diagnostics", () => {
		const knownFormats = ["kanon-canonical", "kiro-power", "kiro-skill", "claude-skill"];
		const knownFormatIds = new Set(knownFormats);

		fc.assert(
			fc.property(
				arbKebabCaseKey(),
				arbKebabCaseKey(),
				arbValidAcquisitionProfile(),
				arbValidTranslationProfile(knownFormats),
				(acqKey, transKey, acqProfile, transProfile) => {
					// Ensure keys are different to avoid collision issues
					fc.pre(acqKey !== transKey);

					const config: ForgeConfig = {
						acquisitions: {
							[acqKey]: acqProfile,
						},
						translations: {
							[transKey]: transProfile,
						},
					};

					const result = validateProfiles(config, { knownFormatIds });

					expect(result.diagnostics.length).toBe(0);
					expect(result.valid).toBe(true);
				},
			),
			{ numRuns: 100 },
		);
	});
});
