/**
 * Property 6: Detection selection is total and explicit selection has precedence
 *
 * Validates: Requirements 3.3, 3.4, 3.5, 3.6, 3.7
 *
 * Verifies that:
 * - Unique selection: when exactly one format qualifies above its threshold
 *   with no ties, detect() returns ok: true with that format as selected.
 * - No-match produces RS_NO_MATCH: when no format meets its threshold (or all
 *   have missing required rules), the result has ok: false with RS_NO_MATCH.
 * - Ambiguity produces RS_AMBIGUOUS_MATCH: when two or more formats tie at the
 *   highest qualifying confidence, the result has ok: false with RS_AMBIGUOUS_MATCH.
 * - Explicit selection bypasses scoring: when explicitFormatId is set to a
 *   registered format, detection returns that format as selected.
 * - Wrong direction produces RS_DIRECTION_MISMATCH: when explicit format's
 *   direction doesn't match the requested direction.
 * - Missing required rule blocks explicit selection: even with explicit format,
 *   if a required rule is not satisfied, detection fails.
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import { type DetectionRequest, detect } from "../rosetta/detector";
import {
	createRegistryBuilder,
	type RegistryExtension,
	type SourceTranslator,
	type TargetTranslator,
} from "../rosetta/registry";
import type {
	DetectionRule,
	Direction,
	FormatContract,
	SourceDocument,
} from "../schemas";
import { arbFormatIdentifier } from "./rosetta-arbitraries";

// ═══════════════════════════════════════════════════════════════════════════════
// Stub Translators
// ═══════════════════════════════════════════════════════════════════════════════

const stubSource: SourceTranslator = () => ({
	diagnostics: [],
	consumedPaths: [],
	preservedPaths: [],
});

const stubTarget: TargetTranslator = () => ({
	plan: {},
	diagnostics: [],
	degradations: [],
});

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Builds a full compatibility profile covering all canonical capabilities.
 */
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

/**
 * Creates a minimal format contract with specific detection rules and direction.
 */
function makeContract(
	id: string,
	direction: Direction,
	rules: DetectionRule[],
	threshold: number,
): FormatContract {
	return {
		id,
		contractVersion: "1.0",
		direction,
		harness: null,
		aliases: [],
		lifecycle: {
			status: "active",
			introducedIn: "1.0.0",
		},
		canonicalVersions: {
			minInclusive: "0.0.0",
			maxExclusive: "99.0.0",
		},
		schemaReference: { type: "none" },
		pathConventions: [],
		detection: { threshold, rules },
		variants: {},
		defaultVariant: undefined,
		optionDefinitions: {},
		defaults: {},
		normalizationRules: [],
		compatibility: buildFullCompatibilityProfile(),
		security: {
			sensitiveValuePolicy: "reject",
			allowedReferencePatterns: [],
		},
	} as FormatContract;
}

/**
 * Creates a registry snapshot with multiple contracts registered.
 */
function buildRegistry(contracts: FormatContract[]) {
	const builder = createRegistryBuilder("1.0.0");
	for (const contract of contracts) {
		const ext: RegistryExtension = {
			contract,
			sourceTranslator:
				contract.direction === "source" ||
				contract.direction === "bidirectional"
					? stubSource
					: undefined,
			targetTranslator:
				contract.direction === "target" ||
				contract.direction === "bidirectional"
					? stubTarget
					: undefined,
		};
		const result = builder.register(ext);
		if (!result.ok) {
			return null;
		}
	}
	return builder.freeze();
}

/**
 * Arbitrary for generating a unique format ID that won't collide.
 */
function arbUniqueId(prefix: string): fc.Arbitrary<string> {
	return fc.stringMatching(/^[a-z]{2,6}$/).map((s) => `${prefix}-${s}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 6: Detection selection is total and explicit selection has precedence", () => {
	it("unique selection: when exactly one format qualifies, detect() returns ok: true with that format", () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 10, max: 100 }).chain((weight) =>
					fc.record({
						weight: fc.constant(weight),
						suffix1: fc.stringMatching(/^[a-z]{3,6}$/),
						suffix2: fc.stringMatching(/^[a-z]{3,6}$/),
					}),
				),
				({ weight, suffix1, suffix2 }) => {
					// Ensure unique IDs
					const id1 = `fmt-${suffix1}`;
					const id2 = `fmt-${suffix2}z`;
					if (id1 === id2) return;

					// Format A: has a rule that matches .md extension, weight > 0, threshold 0.5
					const rulesA: DetectionRule[] = [
						{
							id: "ext-md",
							kind: "extension",
							pattern: "md",
							weight,
							required: false,
							evidenceLabel: "Markdown file",
						},
					];

					// Format B: has a rule that matches .yaml extension — won't match our docs
					const rulesB: DetectionRule[] = [
						{
							id: "ext-yaml",
							kind: "extension",
							pattern: "yaml",
							weight,
							required: false,
							evidenceLabel: "YAML file",
						},
					];

					const contractA = makeContract(id1, "source", rulesA, 0.5);
					const contractB = makeContract(id2, "source", rulesB, 0.5);
					const snapshot = buildRegistry([contractA, contractB]);
					if (!snapshot) return;

					// Provide docs that only match format A's rule
					const documents: SourceDocument[] = [
						{ path: "readme.md", content: "# Hello", executable: false },
					];

					const result = detect({
						documents,
						registrySnapshot: snapshot,
						direction: "source",
					});

					expect(result.ok).toBe(true);
					if (result.ok) {
						expect(result.selected).toBe(id1);
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("no-match produces RS_NO_MATCH: when no format meets its threshold", () => {
		fc.assert(
			fc.property(
				fc.record({
					suffix: fc.stringMatching(/^[a-z]{3,6}$/),
					weight: fc.integer({ min: 1, max: 50 }),
				}),
				({ suffix, weight }) => {
					const id = `nofmt-${suffix}`;

					// Rule requires .yaml extension but docs only have .txt
					const rules: DetectionRule[] = [
						{
							id: "ext-yaml",
							kind: "extension",
							pattern: "yaml",
							weight,
							required: false,
							evidenceLabel: "YAML file",
						},
					];

					const contract = makeContract(id, "source", rules, 0.5);
					const snapshot = buildRegistry([contract]);
					if (!snapshot) return;

					// Documents that won't match
					const documents: SourceDocument[] = [
						{ path: "data.txt", content: "plain text", executable: false },
					];

					const result = detect({
						documents,
						registrySnapshot: snapshot,
						direction: "source",
					});

					expect(result.ok).toBe(false);
					if (!result.ok) {
						expect(result.diagnostics.length).toBeGreaterThan(0);
						expect(
							result.diagnostics.some((d) => d.code === "RS_NO_MATCH"),
						).toBe(true);
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("ambiguity produces RS_AMBIGUOUS_MATCH: when two formats tie at highest confidence", () => {
		fc.assert(
			fc.property(
				fc.record({
					suffix1: fc.stringMatching(/^[a-z]{3,5}$/),
					suffix2: fc.stringMatching(/^[a-z]{3,5}$/),
					weight: fc.integer({ min: 1, max: 50 }),
				}),
				({ suffix1, suffix2, weight }) => {
					const id1 = `tie-${suffix1}`;
					const id2 = `tie-${suffix2}z`;
					if (id1 === id2) return;

					// Both formats match the same document with equal weight and threshold
					const rulesA: DetectionRule[] = [
						{
							id: "ext-md",
							kind: "extension",
							pattern: "md",
							weight,
							required: false,
							evidenceLabel: "Markdown A",
						},
					];

					const rulesB: DetectionRule[] = [
						{
							id: "ext-md",
							kind: "extension",
							pattern: "md",
							weight,
							required: false,
							evidenceLabel: "Markdown B",
						},
					];

					const contractA = makeContract(id1, "source", rulesA, 0.5);
					const contractB = makeContract(id2, "source", rulesB, 0.5);
					const snapshot = buildRegistry([contractA, contractB]);
					if (!snapshot) return;

					const documents: SourceDocument[] = [
						{ path: "readme.md", content: "# Hello", executable: false },
					];

					const result = detect({
						documents,
						registrySnapshot: snapshot,
						direction: "source",
					});

					expect(result.ok).toBe(false);
					if (!result.ok) {
						expect(result.diagnostics.length).toBeGreaterThan(0);
						expect(
							result.diagnostics.some((d) => d.code === "RS_AMBIGUOUS_MATCH"),
						).toBe(true);
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("explicit selection bypasses scoring: explicitFormatId returns that format as selected", () => {
		fc.assert(
			fc.property(
				fc.record({
					suffix: fc.stringMatching(/^[a-z]{3,6}$/),
					weight: fc.integer({ min: 1, max: 50 }),
				}),
				({ suffix, weight }) => {
					const id = `explicit-${suffix}`;

					// Rule that will NOT match documents (extension .yaml vs .txt docs)
					// but explicit selection should still select the format
					const rules: DetectionRule[] = [
						{
							id: "ext-yaml",
							kind: "extension",
							pattern: "yaml",
							weight,
							required: false,
							evidenceLabel: "YAML file",
						},
					];

					const contract = makeContract(id, "bidirectional", rules, 0.5);
					const snapshot = buildRegistry([contract]);
					if (!snapshot) return;

					// Documents that do NOT match the rules
					const documents: SourceDocument[] = [
						{ path: "data.txt", content: "plain text", executable: false },
					];

					const result = detect({
						documents,
						registrySnapshot: snapshot,
						explicitFormatId: id,
						direction: "source",
					});

					// Explicit selection bypasses scoring — format is selected
					// as long as required rules pass and direction matches
					expect(result.ok).toBe(true);
					if (result.ok) {
						expect(result.selected).toBe(id);
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("wrong direction produces RS_DIRECTION_MISMATCH: explicit format's direction doesn't match", () => {
		fc.assert(
			fc.property(
				fc.record({
					suffix: fc.stringMatching(/^[a-z]{3,6}$/),
					weight: fc.integer({ min: 1, max: 50 }),
				}),
				({ suffix, weight }) => {
					const id = `dir-${suffix}`;

					const rules: DetectionRule[] = [
						{
							id: "ext-md",
							kind: "extension",
							pattern: "md",
							weight,
							required: false,
							evidenceLabel: "Markdown file",
						},
					];

					// Register as source-only
					const contract = makeContract(id, "source", rules, 0.5);
					const snapshot = buildRegistry([contract]);
					if (!snapshot) return;

					const documents: SourceDocument[] = [
						{ path: "readme.md", content: "# Hello", executable: false },
					];

					// Request with target direction — should produce RS_DIRECTION_MISMATCH
					const result = detect({
						documents,
						registrySnapshot: snapshot,
						explicitFormatId: id,
						direction: "target",
					});

					expect(result.ok).toBe(false);
					if (!result.ok) {
						expect(result.diagnostics.length).toBeGreaterThan(0);
						expect(
							result.diagnostics.some(
								(d) => d.code === "RS_DIRECTION_MISMATCH",
							),
						).toBe(true);
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("missing required rule blocks explicit selection: even explicit format fails if required rule unsatisfied", () => {
		fc.assert(
			fc.property(
				fc.record({
					suffix: fc.stringMatching(/^[a-z]{3,6}$/),
					weight: fc.integer({ min: 1, max: 50 }),
				}),
				({ suffix, weight }) => {
					const id = `reqrule-${suffix}`;

					// Rule that is REQUIRED but will NOT match the provided documents
					const rules: DetectionRule[] = [
						{
							id: "req-yaml",
							kind: "extension",
							pattern: "yaml",
							weight,
							required: true,
							evidenceLabel: "Required YAML",
						},
					];

					const contract = makeContract(id, "bidirectional", rules, 0.5);
					const snapshot = buildRegistry([contract]);
					if (!snapshot) return;

					// Documents that don't satisfy the required rule
					const documents: SourceDocument[] = [
						{ path: "data.txt", content: "plain text", executable: false },
					];

					const result = detect({
						documents,
						registrySnapshot: snapshot,
						explicitFormatId: id,
						direction: "source",
					});

					// Explicit selection is blocked by missing required rule
					expect(result.ok).toBe(false);
					if (!result.ok) {
						expect(result.diagnostics.length).toBeGreaterThan(0);
						// The diagnostic should indicate failure due to missing required rules
						expect(
							result.diagnostics.some((d) => d.code === "RS_NO_MATCH"),
						).toBe(true);
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});
});
