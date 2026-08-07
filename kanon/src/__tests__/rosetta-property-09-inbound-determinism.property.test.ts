/**
 * Property 9: Inbound translation is order-independent and repeatable
 *
 * **Validates: Requirements 4.9, 12.4, 16.3**
 *
 * This property test verifies that for any source translator invocation:
 * 1. Shuffling the order of input SourceDocuments does NOT change the translation output (order independence)
 * 2. Calling the same translator twice with the same inputs produces identical output (repeatability/determinism)
 * 3. The canonical candidate (if produced) is identical regardless of document array order
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";

import { KIRO_POWER_CONTRACT } from "../rosetta/builtins/contracts";
import { translateKiroPower } from "../rosetta/builtins/sources/kiro-power";
import type { SourceTranslatorContext } from "../rosetta/registry";
import type { NormalizedRelativePath, SourceDocument } from "../schemas";

// ═══════════════════════════════════════════════════════════════════════════════
// Test Context
// ═══════════════════════════════════════════════════════════════════════════════

const BASE_CONTEXT: SourceTranslatorContext = {
	format: KIRO_POWER_CONTRACT,
	canonicalSchemaVersion: "1.0.0",
	options: {},
	callerContext: { artifactNameHint: "test-power" },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Arbitraries
// ═══════════════════════════════════════════════════════════════════════════════

/** Generates a valid POWER.md frontmatter with random content */
function arbPowerMdContent(): fc.Arbitrary<string> {
	return fc
		.tuple(
			fc.stringMatching(/^[a-z][a-z0-9-]{1,15}$/),
			fc.stringMatching(/^[a-zA-Z0-9 .,;:!?()-]{1,40}$/),
			fc.array(fc.stringMatching(/^[a-z]{2,10}$/), {
				minLength: 0,
				maxLength: 4,
			}),
			fc.boolean(),
			fc.array(fc.stringMatching(/^[a-z]{2,6}\.[a-z]{1,4}$/), {
				minLength: 0,
				maxLength: 2,
			}),
			fc.stringMatching(/^[a-zA-Z0-9 .,;:!?\n()-]{10,100}$/),
		)
		.map(([name, description, keywords, alwaysApply, globs, body]) => {
			const fmLines: string[] = [];
			fmLines.push(`name: "${name}"`);
			fmLines.push(`description: "${description}"`);
			if (keywords.length === 0) {
				fmLines.push("keywords: []");
			} else {
				fmLines.push("keywords:");
				for (const kw of keywords) {
					fmLines.push(`  - ${kw}`);
				}
			}
			if (alwaysApply) fmLines.push("alwaysApply: true");
			if (globs.length > 0) {
				fmLines.push("globs:");
				for (const g of globs) {
					fmLines.push(`  - ${g}`);
				}
			}
			return `---\n${fmLines.join("\n")}\n---\n\n${body}`;
		});
}

/** Generates a valid steering file name and content */
function arbSteeringDoc(): fc.Arbitrary<SourceDocument> {
	return fc
		.tuple(
			fc.stringMatching(/^[a-z][a-z0-9-]{1,12}$/),
			fc.stringMatching(/^[a-zA-Z0-9 .,;:!?()-]{5,80}$/),
		)
		.map(([name, content]) => ({
			path: `steering/${name}.md` as NormalizedRelativePath,
			content: `# ${name}\n\n${content}`,
			executable: false,
		}));
}

/** Generates an extra (non-steering, non-POWER.md) file that will be preserved */
function arbExtraDoc(): fc.Arbitrary<SourceDocument> {
	return fc
		.tuple(
			fc.stringMatching(/^[a-z][a-z0-9-]{1,10}$/),
			fc.constantFrom(".txt", ".json", ".yaml", ".ts"),
			fc.stringMatching(/^[a-zA-Z0-9 .,;:!?()-]{1,60}$/),
		)
		.map(([name, ext, content]) => ({
			path: `${name}${ext}` as NormalizedRelativePath,
			content,
			executable: false,
		}));
}

/**
 * Generates a valid kiro-power document set with a POWER.md,
 * 0-3 steering files, and 0-3 extra files.
 * Ensures unique paths within the set.
 */
function arbKiroPowerDocumentSet(): fc.Arbitrary<SourceDocument[]> {
	return fc
		.tuple(
			arbPowerMdContent(),
			fc.array(arbSteeringDoc(), { minLength: 0, maxLength: 3 }),
			fc.array(arbExtraDoc(), { minLength: 0, maxLength: 3 }),
		)
		.map(([powerContent, steeringDocs, extraDocs]) => {
			const powerDoc: SourceDocument = {
				path: "POWER.md" as NormalizedRelativePath,
				content: powerContent,
				executable: false,
			};

			// Deduplicate paths
			const seen = new Set<string>(["POWER.md"]);
			const uniqueSteering: SourceDocument[] = [];
			for (const doc of steeringDocs) {
				if (!seen.has(doc.path)) {
					seen.add(doc.path);
					uniqueSteering.push(doc);
				}
			}
			const uniqueExtra: SourceDocument[] = [];
			for (const doc of extraDocs) {
				if (!seen.has(doc.path)) {
					seen.add(doc.path);
					uniqueExtra.push(doc);
				}
			}

			return [powerDoc, ...uniqueSteering, ...uniqueExtra];
		});
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalize output for comparison: sort path arrays to ensure
 * order-independent comparison of consumed/preserved paths.
 */
function normalizeOutput(output: ReturnType<typeof translateKiroPower>) {
	return {
		candidate: output.candidate,
		diagnostics: [...output.diagnostics].sort((a, b) =>
			a.code < b.code ? -1 : a.code > b.code ? 1 : 0,
		),
		consumedPaths: [...output.consumedPaths].sort(),
		preservedPaths: [...output.preservedPaths].sort(),
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 9: Inbound translation is order-independent and repeatable", () => {
	it("order independence: shuffling the document array does not change translation output", () => {
		fc.assert(
			fc.property(
				arbKiroPowerDocumentSet(),
				fc.integer({ min: 1, max: 100_000 }),
				(documents, seed) => {
					// Translate with original order
					const baseline = translateKiroPower(documents, BASE_CONTEXT);
					const normalizedBaseline = normalizeOutput(baseline);

					// Create a shuffled permutation using fc.shuffledSubarray equivalent
					const shuffled = shuffleWithSeed(documents, seed);

					// Translate with shuffled order
					const shuffledResult = translateKiroPower(shuffled, BASE_CONTEXT);
					const normalizedShuffled = normalizeOutput(shuffledResult);

					// Candidate must be deeply equal
					expect(normalizedShuffled.candidate).toEqual(
						normalizedBaseline.candidate,
					);

					// Consumed paths (sorted) must match
					expect(normalizedShuffled.consumedPaths).toEqual(
						normalizedBaseline.consumedPaths,
					);

					// Preserved paths (sorted) must match
					expect(normalizedShuffled.preservedPaths).toEqual(
						normalizedBaseline.preservedPaths,
					);

					// Diagnostic codes (sorted) must match
					expect(normalizedShuffled.diagnostics.map((d) => d.code)).toEqual(
						normalizedBaseline.diagnostics.map((d) => d.code),
					);
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("repeatability: calling the translator twice with identical input produces identical output", () => {
		fc.assert(
			fc.property(arbKiroPowerDocumentSet(), (documents) => {
				// Call translator twice with the exact same inputs
				const result1 = translateKiroPower(documents, BASE_CONTEXT);
				const result2 = translateKiroPower(documents, BASE_CONTEXT);

				// Normalize both for comparison
				const normalized1 = normalizeOutput(result1);
				const normalized2 = normalizeOutput(result2);

				// Must be deeply equal
				expect(normalized2.candidate).toEqual(normalized1.candidate);
				expect(normalized2.consumedPaths).toEqual(normalized1.consumedPaths);
				expect(normalized2.preservedPaths).toEqual(normalized1.preservedPaths);
				expect(normalized2.diagnostics).toEqual(normalized1.diagnostics);
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("candidate identity: canonical candidate fields are identical regardless of document order across all permutations", () => {
		fc.assert(
			fc.property(
				arbKiroPowerDocumentSet(),
				fc.array(fc.integer({ min: 1, max: 100_000 }), {
					minLength: 3,
					maxLength: 5,
				}),
				(documents, seeds) => {
					// Get baseline result
					const baseline = translateKiroPower(documents, BASE_CONTEXT);
					if (!baseline.candidate) return; // Skip cases with no candidate

					// Try multiple different permutations
					for (const seed of seeds) {
						const shuffled = shuffleWithSeed(documents, seed);
						const result = translateKiroPower(shuffled, BASE_CONTEXT);

						// Candidate must exist and be deeply equal
						expect(result.candidate).toBeDefined();
						expect(result.candidate).toEqual(baseline.candidate);
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("triple invocation consistency: three consecutive calls produce byte-identical results", () => {
		fc.assert(
			fc.property(arbKiroPowerDocumentSet(), (documents) => {
				const result1 = translateKiroPower(documents, BASE_CONTEXT);
				const result2 = translateKiroPower(documents, BASE_CONTEXT);
				const result3 = translateKiroPower(documents, BASE_CONTEXT);

				// All three must produce the same JSON serialization
				const json1 = JSON.stringify(normalizeOutput(result1));
				const json2 = JSON.stringify(normalizeOutput(result2));
				const json3 = JSON.stringify(normalizeOutput(result3));

				expect(json2).toBe(json1);
				expect(json3).toBe(json1);
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fisher-Yates shuffle with a deterministic seed (simple LCG).
 */
function shuffleWithSeed<T>(arr: readonly T[], seed: number): T[] {
	const result = [...arr];
	let s = seed;
	for (let i = result.length - 1; i > 0; i--) {
		s = (s * 1664525 + 1013904223) & 0xffffffff;
		const j = (s >>> 0) % (i + 1);
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}
