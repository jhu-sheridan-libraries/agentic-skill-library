/**
 * Shared fast-check arbitraries for Rosetta Stone property-based tests.
 *
 * Provides bounded generators for all Rosetta domain types: format identifiers,
 * paths, diagnostics, contracts, plans, and sensitive canaries.
 *
 * Requirements: 8.1, 8.2, 8.5, 8.6, 16.1, 16.3, 16.4, 16.10
 */

import fc from "fast-check";
import type {
	CanonicalCapability,
	CanonicalVersionRange,
	DetectionContract,
	DetectionRule,
	Direction,
	FormatContract,
	FormatSecurityPolicy,
	LifecycleMetadata,
	LifecycleStatus,
	NormalizationRule,
	PathConvention,
	RosettaSeverity,
	SourceDocument,
	TranslationDiagnostic,
	TranslationPhase,
	TranslationPlan,
} from "../schemas";

// ═══════════════════════════════════════════════════════════════════════════════
// Primitive Arbitraries
// ═══════════════════════════════════════════════════════════════════════════════

/** Generates valid kebab-case format identifiers (1-4 segments, 2-8 chars each) */
export function arbFormatIdentifier(): fc.Arbitrary<string> {
	return fc
		.array(fc.stringMatching(/^[a-z0-9]{2,8}$/), {
			minLength: 1,
			maxLength: 4,
		})
		.map((segments) => segments.join("-"));
}

/** Generates valid normalized relative paths (1-4 segments, valid chars, no traversal) */
export function arbNormalizedRelativePath(): fc.Arbitrary<string> {
	const segment = fc
		.stringMatching(/^[a-z0-9][a-z0-9._-]{0,11}$/)
		.filter(
			(s) => s.length > 0 && s !== "." && s !== ".." && !s.includes("\0"),
		);
	return fc
		.array(segment, { minLength: 1, maxLength: 4 })
		.map((segments) => segments.join("/"));
}

/** Generates one of the three direction values */
export function arbDirection(): fc.Arbitrary<Direction> {
	return fc.constantFrom(
		"source",
		"target",
		"bidirectional",
	) as fc.Arbitrary<Direction>;
}

/** Generates one of the four lifecycle status values */
export function arbLifecycleStatus(): fc.Arbitrary<LifecycleStatus> {
	return fc.constantFrom(
		"experimental",
		"active",
		"deprecated",
		"retired",
	) as fc.Arbitrary<LifecycleStatus>;
}

/** Generates one of the three severity values */
export function arbRosettaSeverity(): fc.Arbitrary<RosettaSeverity> {
	return fc.constantFrom(
		"info",
		"warning",
		"error",
	) as fc.Arbitrary<RosettaSeverity>;
}

/** Generates one of the 10 translation phases */
export function arbTranslationPhase(): fc.Arbitrary<TranslationPhase> {
	return fc.constantFrom(
		"request",
		"registry",
		"detection",
		"source-validation",
		"source-translation",
		"canonical-validation",
		"compatibility",
		"target-translation",
		"plan-validation",
		"redaction",
	) as fc.Arbitrary<TranslationPhase>;
}

/** Generates one of the canonical capability enum values */
export function arbCanonicalCapability(): fc.Arbitrary<CanonicalCapability> {
	return fc.constantFrom(
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
	) as fc.Arbitrary<CanonicalCapability>;
}

/** Generates bounded recursive JSON values with configurable max depth */
export function arbJsonValue(maxDepth = 3): fc.Arbitrary<unknown> {
	return fc.letrec((tie) => ({
		value: fc.oneof(
			fc.constant(null),
			fc.boolean(),
			fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }),
			fc.string({ minLength: 0, maxLength: 20 }),
			maxDepth > 0
				? fc.array(tie("nested"), { maxLength: 3 })
				: fc.constant([]),
			maxDepth > 0
				? fc.dictionary(fc.stringMatching(/^[a-z]{1,8}$/), tie("nested"), {
						maxKeys: 3,
					})
				: fc.constant({}),
		),
		nested: maxDepth > 0 ? arbJsonValue(maxDepth - 1) : fc.constant(null),
	})).value;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Composite Arbitraries
// ═══════════════════════════════════════════════════════════════════════════════

/** Generates a valid SourceDocument */
export function arbSourceDocument(): fc.Arbitrary<SourceDocument> {
	return fc.record({
		path: arbNormalizedRelativePath(),
		content: fc.string({ minLength: 1, maxLength: 200 }),
		mediaType: fc.option(
			fc.constantFrom("text/plain", "application/json", "text/markdown"),
			{ nil: undefined },
		),
		executable: fc.boolean(),
	}) as fc.Arbitrary<SourceDocument>;
}

/** Generates a valid DetectionRule */
export function arbDetectionRule(): fc.Arbitrary<DetectionRule> {
	return fc.record({
		id: fc.stringMatching(/^[a-z]{2,8}-[a-z0-9]{1,6}$/),
		kind: fc.constantFrom(
			"path-glob",
			"basename",
			"extension",
			"content-marker",
			"frontmatter-key",
			"json-pointer",
			"yaml-key",
		),
		pattern: fc.string({ minLength: 1, maxLength: 30 }),
		weight: fc.integer({ min: -10, max: 100 }),
		required: fc.boolean(),
		evidenceLabel: fc.string({ minLength: 1, maxLength: 40 }),
		maxParseBytes: fc.option(fc.integer({ min: 1, max: 1_000_000 }), {
			nil: undefined,
		}),
	}) as fc.Arbitrary<DetectionRule>;
}

/** Generates a valid DetectionContract (1-5 rules, threshold 0-1) */
export function arbDetectionContract(): fc.Arbitrary<DetectionContract> {
	return fc.record({
		threshold: fc.double({
			min: 0,
			max: 1,
			noNaN: true,
			noDefaultInfinity: true,
		}),
		rules: fc.array(arbDetectionRule(), { minLength: 1, maxLength: 5 }),
	}) as fc.Arbitrary<DetectionContract>;
}

/** Generates a valid FormatSecurityPolicy */
export function arbFormatSecurityPolicy(): fc.Arbitrary<FormatSecurityPolicy> {
	return fc.record({
		sensitiveValuePolicy: fc.constantFrom(
			"reject",
			"preserve",
			"reference-only",
		),
		allowedReferencePatterns: fc.array(
			fc.string({ minLength: 1, maxLength: 20 }),
			{ maxLength: 3 },
		),
	}) as fc.Arbitrary<FormatSecurityPolicy>;
}

/** Generates a valid NormalizationRule */
export function arbNormalizationRule(): fc.Arbitrary<NormalizationRule> {
	return fc.record({
		id: fc.stringMatching(/^[a-z]{2,8}-[a-z0-9]{1,6}$/),
		description: fc.string({ minLength: 1, maxLength: 60 }),
		scope: fc.constantFrom("source", "canonical", "both"),
	}) as fc.Arbitrary<NormalizationRule>;
}

/** Generates a valid PathConvention */
export function arbPathConvention(): fc.Arbitrary<PathConvention> {
	return fc.record({
		pattern: fc.string({ minLength: 1, maxLength: 40 }),
		required: fc.boolean(),
		description: fc.option(fc.string({ minLength: 1, maxLength: 50 }), {
			nil: undefined,
		}),
	}) as fc.Arbitrary<PathConvention>;
}

/** Generates valid LifecycleMetadata */
export function arbLifecycleMetadata(): fc.Arbitrary<LifecycleMetadata> {
	return fc.record({
		status: arbLifecycleStatus(),
		introducedIn: arbSemver(),
		deprecatedIn: fc.option(arbSemver(), { nil: undefined }),
		retiredIn: fc.option(arbSemver(), { nil: undefined }),
		replacement: fc.option(arbFormatIdentifier(), { nil: undefined }),
	}) as fc.Arbitrary<LifecycleMetadata>;
}

/** Generates a valid CanonicalVersionRange */
export function arbCanonicalVersionRange(): fc.Arbitrary<CanonicalVersionRange> {
	return fc
		.tuple(
			fc.integer({ min: 0, max: 5 }),
			fc.integer({ min: 0, max: 20 }),
			fc.integer({ min: 0, max: 20 }),
			fc.integer({ min: 0, max: 5 }),
			fc.integer({ min: 0, max: 20 }),
			fc.integer({ min: 0, max: 20 }),
		)
		.map(([maj1, min1, pat1, maj2, min2, pat2]) => ({
			minInclusive: `${maj1}.${min1}.${pat1}`,
			maxExclusive: `${maj2 + maj1}.${min2}.${pat2}`,
		})) as fc.Arbitrary<CanonicalVersionRange>;
}

/** Generates a valid TranslationDiagnostic */
export function arbTranslationDiagnostic(): fc.Arbitrary<TranslationDiagnostic> {
	return fc.record({
		code: fc.stringMatching(/^[A-Z0-9_]{2,12}$/).map((s) => `RS_${s}`),
		severity: arbRosettaSeverity(),
		phase: arbTranslationPhase(),
		formatId: fc.option(arbFormatIdentifier(), { nil: undefined }),
		message: fc.string({ minLength: 1, maxLength: 80 }),
		remediation: fc.string({ minLength: 1, maxLength: 80 }),
		source: fc.constant(undefined),
		canonical: fc.constant(undefined),
		degradation: fc.constant(undefined),
		unavailableDetails: fc.array(fc.string({ minLength: 1, maxLength: 30 }), {
			maxLength: 3,
		}),
		blocking: fc.boolean(),
	}) as fc.Arbitrary<TranslationDiagnostic>;
}

/** Generates a valid TranslationPlan with 1-5 output files and matching operations */
export function arbTranslationPlan(): fc.Arbitrary<TranslationPlan> {
	return fc
		.tuple(
			arbFormatIdentifier(),
			arbSemver(),
			fc.array(arbNormalizedRelativePath(), { minLength: 1, maxLength: 5 }),
		)
		.map(([formatId, version, paths]) => ({
			schemaVersion: "1.0" as const,
			formatId,
			variant: undefined,
			canonicalSchemaVersion: version,
			outputFiles: paths.map((p) => ({
				relativePath: p,
				content: `// generated content for ${p}`,
				executable: false,
				mediaType: undefined,
			})),
			operations: paths.map((p, idx) => ({
				kind: "write-file" as const,
				relativePath: p,
				outputFileIndex: idx,
			})),
			applicationState: "eligible" as const,
			policyDiagnosticCodes: [],
		})) as fc.Arbitrary<TranslationPlan>;
}

/** Generates a valid FormatContract (composed from sub-arbitraries) */
export function arbFormatContract(): fc.Arbitrary<FormatContract> {
	return fc
		.tuple(
			arbFormatIdentifier(),
			arbDirection(),
			arbLifecycleMetadata(),
			arbCanonicalVersionRange(),
			arbDetectionContract(),
			fc.array(arbNormalizationRule(), { minLength: 0, maxLength: 3 }),
			arbFormatSecurityPolicy(),
			fc.array(arbPathConvention(), { minLength: 0, maxLength: 3 }),
		)
		.map(
			([
				id,
				direction,
				lifecycle,
				canonicalVersions,
				detection,
				normalizationRules,
				security,
				pathConventions,
			]) => ({
				id,
				contractVersion: "1.0" as const,
				direction,
				harness: null,
				aliases: [],
				lifecycle,
				canonicalVersions,
				schemaReference: { type: "none" as const },
				pathConventions,
				detection,
				variants: {},
				defaultVariant: undefined,
				optionDefinitions: {},
				defaults: {},
				normalizationRules,
				compatibility: buildFullCompatibilityProfile(),
				security,
			}),
		) as fc.Arbitrary<FormatContract>;
}

/** Generates strings that look like secrets/tokens/passwords for testing redaction */
export function arbSensitiveCanary(): fc.Arbitrary<string> {
	return fc.oneof(
		// AWS-style key
		fc.constant("AKIAIOSFODNN7EXAMPLE"),
		// Generic token
		fc.stringMatching(/^ghp_[A-Za-z0-9]{36}$/),
		// Password-like
		fc.stringMatching(/^P@ss[a-z0-9]{4,12}!$/),
		// Base64 secret
		fc
			.array(
				fc.constantFrom(
					..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split(
						"",
					),
				),
				{
					minLength: 20,
					maxLength: 40,
				},
			)
			.map((chars) => chars.join("")),
		// JWT-like
		fc.constant(
			"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
		),
	);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Internal Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/** Generates a valid semver string */
function arbSemver(): fc.Arbitrary<string> {
	return fc
		.tuple(
			fc.integer({ min: 0, max: 9 }),
			fc.integer({ min: 0, max: 99 }),
			fc.integer({ min: 0, max: 99 }),
		)
		.map(([major, minor, patch]) => `${major}.${minor}.${patch}`);
}

/** Builds a full compatibility profile covering all canonical capabilities */
function buildFullCompatibilityProfile() {
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

	const profile: Record<string, { support: "full" }> = {};
	for (const cap of capabilities) {
		profile[cap] = { support: "full" };
	}
	return profile;
}
