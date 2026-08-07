/**
 * Property 5: Detection ranking and evidence are deterministic
 *
 * **Validates: Requirements 3.1, 3.2, 3.8, 16.5**
 *
 * This property test verifies that the detect() function:
 * - Produces identical rankings regardless of input document array order (permutation invariance)
 * - Returns identical results on repeated evaluation with the same inputs (stability)
 * - Produces evidence with exactly one entry per detection rule in each contract (completeness)
 * - Sorts candidates by confidence descending, then FormatIdentifier ascending (total ordering)
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import { codePointCompare } from "../rosetta/contracts";
import { type DetectionRequest, detect } from "../rosetta/detector";
import {
	createRegistryBuilder,
	type RegistryExtension,
	type SourceTranslator,
	type TargetTranslator,
} from "../rosetta/registry";
import type { DetectionRule, FormatContract, SourceDocument } from "../schemas";
import {
	arbFormatIdentifier,
	arbNormalizedRelativePath,
} from "./rosetta-arbitraries";

// ═══════════════════════════════════════════════════════════════════════════════
// Stub translators
// ═══════════════════════════════════════════════════════════════════════════════

const stubSourceTranslator: SourceTranslator = () => ({
	diagnostics: [],
	consumedPaths: [],
	preservedPaths: [],
});

const stubTargetTranslator: TargetTranslator = () => ({
	plan: {},
	diagnostics: [],
	degradations: [],
});

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build a minimal format contract with specific detection rules for testing.
 */
function buildContract(
	id: string,
	rules: DetectionRule[],
	threshold = 0.5,
): FormatContract {
	return {
		id,
		contractVersion: "1.0",
		direction: "bidirectional",
		harness: null,
		aliases: [],
		lifecycle: {
			status: "active",
			introducedIn: "1.0.0",
			deprecatedIn: undefined,
			retiredIn: undefined,
			replacement: undefined,
		},
		canonicalVersions: {
			minInclusive: "1.0.0",
			maxExclusive: "2.0.0",
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
	} as unknown as FormatContract;
}

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
 * Create a registry snapshot with the given contracts registered.
 */
function buildRegistrySnapshot(contracts: FormatContract[]) {
	const builder = createRegistryBuilder("1.0.0");
	for (const contract of contracts) {
		const ext: RegistryExtension = {
			contract,
			sourceTranslator: stubSourceTranslator,
			targetTranslator: stubTargetTranslator,
		};
		const result = builder.register(ext);
		if (!result.ok) {
			throw new Error(
				`Failed to register contract ${contract.id}: ${JSON.stringify(result)}`,
			);
		}
	}
	return builder.freeze();
}

/**
 * Shuffle an array using a Fisher-Yates shuffle with a seeded random.
 */
function shuffle<T>(arr: readonly T[], seed: number): T[] {
	const result = [...arr];
	let s = seed;
	for (let i = result.length - 1; i > 0; i--) {
		// Simple LCG for deterministic shuffling
		s = (s * 1664525 + 1013904223) & 0xffffffff;
		const j = (s >>> 0) % (i + 1);
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Arbitraries
// ═══════════════════════════════════════════════════════════════════════════════

/** Generates a detection rule with specific kind that can be meaningfully evaluated */
function _arbTestDetectionRule(index: number): fc.Arbitrary<DetectionRule> {
	return fc
		.tuple(
			fc.constantFrom("extension", "basename", "path-glob") as fc.Arbitrary<
				"extension" | "basename" | "path-glob"
			>,
			fc.string({ minLength: 1, maxLength: 10 }),
			fc.integer({ min: 1, max: 100 }),
			fc.boolean(),
		)
		.map(([kind, pattern, weight, required]) => ({
			id: `rule-${index}-${kind}`,
			kind,
			pattern,
			weight,
			required,
			evidenceLabel: `Evidence for rule-${index}`,
			maxParseBytes: undefined,
		}));
}

/** Generates a set of 2-4 contracts with unique IDs and distinct detection rules */
function arbContractSet(): fc.Arbitrary<FormatContract[]> {
	return fc
		.tuple(
			fc.integer({ min: 2, max: 4 }),
			fc.array(
				fc.tuple(
					arbFormatIdentifier(),
					fc.array(
						fc.tuple(
							fc.constantFrom(
								"extension",
								"basename",
								"path-glob",
							) as fc.Arbitrary<"extension" | "basename" | "path-glob">,
							fc.string({ minLength: 1, maxLength: 10 }),
							fc.integer({ min: 1, max: 100 }),
							fc.boolean(),
						),
						{ minLength: 1, maxLength: 4 },
					),
					fc.double({
						min: 0.1,
						max: 0.9,
						noNaN: true,
						noDefaultInfinity: true,
					}),
				),
				{ minLength: 4, maxLength: 6 },
			),
		)
		.map(([count, contractDefs]) => {
			// Ensure unique IDs
			const seen = new Set<string>();
			const contracts: FormatContract[] = [];
			for (const [id, ruleDefs, threshold] of contractDefs) {
				if (seen.has(id) || contracts.length >= count) continue;
				seen.add(id);

				const rules: DetectionRule[] = ruleDefs.map(
					([kind, pattern, weight, required], idx) => ({
						id: `${id}-r${idx}`,
						kind,
						pattern,
						weight,
						required,
						evidenceLabel: `${id} rule ${idx}`,
						maxParseBytes: undefined,
					}),
				);

				contracts.push(buildContract(id, rules, threshold));
			}
			return contracts;
		})
		.filter((contracts) => contracts.length >= 2);
}

/** Generates a set of source documents */
function arbDocumentSet(): fc.Arbitrary<SourceDocument[]> {
	return fc
		.array(
			fc.tuple(
				arbNormalizedRelativePath(),
				fc.string({ minLength: 0, maxLength: 100 }),
			),
			{ minLength: 1, maxLength: 8 },
		)
		.map((pairs) => {
			// Ensure unique paths
			const seen = new Set<string>();
			const docs: SourceDocument[] = [];
			for (const [path, content] of pairs) {
				if (seen.has(path)) continue;
				seen.add(path);
				docs.push({ path, content, executable: false });
			}
			return docs;
		})
		.filter((docs) => docs.length >= 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 5: Detection ranking and evidence are deterministic", () => {
	it("permutation invariance: shuffling the documents array produces identical candidates ranking", () => {
		fc.assert(
			fc.property(
				arbContractSet(),
				arbDocumentSet(),
				fc.integer({ min: 1, max: 1000 }),
				(contracts, documents, seed) => {
					const registrySnapshot = buildRegistrySnapshot(contracts);

					// Run detection with original document order
					const request: DetectionRequest = {
						documents,
						registrySnapshot,
						direction: "source",
					};
					const baseline = detect(request);

					// Shuffle documents and run again
					const shuffled = shuffle(documents, seed);
					const shuffledRequest: DetectionRequest = {
						documents: shuffled,
						registrySnapshot,
						direction: "source",
					};
					const shuffledResult = detect(shuffledRequest);

					// Candidates must be identical
					expect(shuffledResult.candidates.length).toBe(
						baseline.candidates.length,
					);
					for (let i = 0; i < baseline.candidates.length; i++) {
						const base = baseline.candidates[i];
						const shuf = shuffledResult.candidates[i];
						expect(shuf.formatId).toBe(base.formatId);
						expect(shuf.confidence).toBe(base.confidence);
						expect(shuf.threshold).toBe(base.threshold);
						expect(shuf.qualifies).toBe(base.qualifies);
						// Evidence ruleIds match
						expect(shuf.evidence.map((e) => e.ruleId)).toEqual(
							base.evidence.map((e) => e.ruleId),
						);
						// Evidence outcomes match
						expect(shuf.evidence.map((e) => e.outcome)).toEqual(
							base.evidence.map((e) => e.outcome),
						);
						// Evidence matched paths (sorted) match
						for (let j = 0; j < base.evidence.length; j++) {
							expect([...shuf.evidence[j].paths].sort()).toEqual(
								[...base.evidence[j].paths].sort(),
							);
						}
					}

					// Selection result must be the same
					expect(shuffledResult.ok).toBe(baseline.ok);
					if (baseline.ok && shuffledResult.ok) {
						expect(shuffledResult.selected).toBe(baseline.selected);
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("repeated evaluation stability: calling detect() multiple times produces identical results", () => {
		fc.assert(
			fc.property(
				arbContractSet(),
				arbDocumentSet(),
				(contracts, documents) => {
					const registrySnapshot = buildRegistrySnapshot(contracts);

					const request: DetectionRequest = {
						documents,
						registrySnapshot,
						direction: "source",
					};

					// Call detect() three times
					const result1 = detect(request);
					const result2 = detect(request);
					const result3 = detect(request);

					// All must be deeply equal
					expect(result2.ok).toBe(result1.ok);
					expect(result3.ok).toBe(result1.ok);

					expect(result2.candidates.length).toBe(result1.candidates.length);
					expect(result3.candidates.length).toBe(result1.candidates.length);

					for (let i = 0; i < result1.candidates.length; i++) {
						// Compare all candidate fields
						expect(result2.candidates[i].formatId).toBe(
							result1.candidates[i].formatId,
						);
						expect(result2.candidates[i].confidence).toBe(
							result1.candidates[i].confidence,
						);
						expect(result2.candidates[i].qualifies).toBe(
							result1.candidates[i].qualifies,
						);
						expect(result3.candidates[i].formatId).toBe(
							result1.candidates[i].formatId,
						);
						expect(result3.candidates[i].confidence).toBe(
							result1.candidates[i].confidence,
						);
						expect(result3.candidates[i].qualifies).toBe(
							result1.candidates[i].qualifies,
						);

						// Evidence is identical
						expect(result2.candidates[i].evidence).toEqual(
							result1.candidates[i].evidence,
						);
						expect(result3.candidates[i].evidence).toEqual(
							result1.candidates[i].evidence,
						);
					}

					// Selection is identical
					if (result1.ok && result2.ok && result3.ok) {
						expect(result2.selected).toBe(result1.selected);
						expect(result3.selected).toBe(result1.selected);
					}

					// Diagnostics are identical
					expect(result2.diagnostics).toEqual(result1.diagnostics);
					expect(result3.diagnostics).toEqual(result1.diagnostics);
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("evidence completeness: every candidate has exactly one evidence entry per detection rule", () => {
		fc.assert(
			fc.property(
				arbContractSet(),
				arbDocumentSet(),
				(contracts, documents) => {
					const registrySnapshot = buildRegistrySnapshot(contracts);

					const request: DetectionRequest = {
						documents,
						registrySnapshot,
						direction: "source",
					};
					const result = detect(request);

					// For each candidate, evidence count must equal the number of detection rules
					// in its contract
					for (const candidate of result.candidates) {
						const contract = contracts.find((c) => c.id === candidate.formatId);
						if (!contract) continue;

						// Evidence length must match rule count
						expect(candidate.evidence.length).toBe(
							contract.detection.rules.length,
						);

						// Each evidence entry must correspond to a rule in the contract (same ruleId)
						const contractRuleIds = contract.detection.rules.map((r) => r.id);
						const evidenceRuleIds = candidate.evidence.map((e) => e.ruleId);
						expect(evidenceRuleIds).toEqual(contractRuleIds);
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("total ordering: candidates are sorted by confidence descending, then FormatIdentifier ascending (code-point order)", () => {
		fc.assert(
			fc.property(
				arbContractSet(),
				arbDocumentSet(),
				(contracts, documents) => {
					const registrySnapshot = buildRegistrySnapshot(contracts);

					const request: DetectionRequest = {
						documents,
						registrySnapshot,
						direction: "source",
					};
					const result = detect(request);

					// Verify sort invariant: no two adjacent candidates violate ordering
					for (let i = 0; i < result.candidates.length - 1; i++) {
						const current = result.candidates[i];
						const next = result.candidates[i + 1];

						// Confidence must be non-increasing
						expect(current.confidence).toBeGreaterThanOrEqual(next.confidence);

						// When confidence is equal, FormatIdentifier must be non-decreasing (code-point)
						if (current.confidence === next.confidence) {
							const cmp = codePointCompare(current.formatId, next.formatId);
							expect(cmp).toBeLessThanOrEqual(0);
							// Ensure no duplicates (strict less)
							expect(cmp).toBeLessThan(0);
						}
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});
});
