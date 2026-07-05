import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import {
	computeVerdict,
	isAcknowledged,
	jaccardSimilarity,
} from "../outcomes/collision";
import type { Outcome } from "../schemas";

// --- Arbitraries ---

/**
 * A token-set arbitrary: a deduplicated set of short lowercase identifiers,
 * used to exercise `jaccardSimilarity` over realistic keyword tokens.
 */
const tokenSetArb = (): fc.Arbitrary<Set<string>> =>
	fc
		.array(
			fc.stringMatching(/^[a-z][a-z0-9]{0,9}$/).filter((s) => s.length > 0),
			{ maxLength: 8 },
		)
		.map((tokens) => new Set(tokens));

/** A valid outcome id matching `^out-[a-z0-9]+(-[a-z0-9]+)*$` (<= 64 chars). */
const outcomeIdArb = (): fc.Arbitrary<string> =>
	fc
		.array(
			fc.stringMatching(/^[a-z0-9]+$/).filter((s) => s.length > 0),
			{
				minLength: 1,
				maxLength: 4,
			},
		)
		.map((parts) => `out-${parts.join("-")}`)
		.filter((id) => id.length <= 64);

/** A non-empty type-shape string with arbitrary casing and spacing. */
const shapeArb = (): fc.Arbitrary<string> =>
	fc.constantFrom(
		"string",
		"number",
		"boolean",
		"String",
		"User[]",
		"Array<number>",
		"(name: string, age: number)",
		"string | number",
		"number | string",
		"Result<T, E>",
		"   void   ",
	);

/** Up to 6 lowercase keyword tokens, each <= 24 chars. */
const keywordsArb = (): fc.Arbitrary<string[]> =>
	fc.array(
		fc
			.stringMatching(/^[a-z][a-z0-9-]{0,20}$/)
			.filter((s) => s.length > 0 && s.length <= 24),
		{ maxLength: 6 },
	);

/**
 * A valid `Outcome` value. The `related` field is left empty here; tests that
 * exercise acknowledgement wire up `related` explicitly so they control the
 * mutual-reference relationship precisely.
 */
const outcomeArb = (): fc.Arbitrary<Outcome> =>
	fc.record({
		id: outcomeIdArb(),
		kind: fc.constantFrom("specification", "operation", "invariant"),
		inputShape: shapeArb(),
		outputShape: shapeArb(),
		summary: fc.string({ maxLength: 120 }),
		keywords: keywordsArb(),
		related: fc.constant([] as string[]),
	});

// --- Property Tests ---

describe("collision detection properties", () => {
	/**
	 * **Validates: Requirements 2E.2**
	 *
	 * Property: Jaccard similarity is symmetric — swapping the two token sets
	 * yields an identical score for any pair of sets.
	 */
	test("jaccardSimilarity is symmetric", () => {
		fc.assert(
			fc.property(tokenSetArb(), tokenSetArb(), (a, b) => {
				expect(jaccardSimilarity(a, b)).toBe(jaccardSimilarity(b, a));
			}),
			{ numRuns: 300 },
		);
	});

	/**
	 * **Validates: Requirements 2E.2**
	 *
	 * Property: Jaccard range is [0, 1] — the similarity score is always between
	 * 0 and 1 inclusive for any pair of token sets (including empty sets).
	 */
	test("jaccardSimilarity output is within [0, 1]", () => {
		fc.assert(
			fc.property(tokenSetArb(), tokenSetArb(), (a, b) => {
				const score = jaccardSimilarity(a, b);
				expect(score).toBeGreaterThanOrEqual(0);
				expect(score).toBeLessThanOrEqual(1);
			}),
			{ numRuns: 300 },
		);
	});

	/**
	 * **Validates: Requirements 2E.1, 2E.3**
	 *
	 * Property: computeVerdict is symmetric — the verdict does not depend on the
	 * order of the two outcomes, for any pair and any threshold. Both tiers
	 * (shape match and keyword Jaccard) are themselves symmetric, so their
	 * combination must be too.
	 */
	test("computeVerdict is symmetric", () => {
		fc.assert(
			fc.property(
				outcomeArb(),
				outcomeArb(),
				fc.double({ min: 0, max: 1, noNaN: true }),
				(a, b, threshold) => {
					expect(computeVerdict(a, b, threshold)).toBe(
						computeVerdict(b, a, threshold),
					);
				},
			),
			{ numRuns: 300 },
		);
	});

	/**
	 * **Validates: Requirements 2E.4**
	 *
	 * Property: isAcknowledged requires a mutual reference — when only one
	 * outcome lists the other in its `related` field (a one-sided reference),
	 * acknowledgement is false. Acknowledgement is also symmetric.
	 */
	test("isAcknowledged requires mutual reference", () => {
		fc.assert(
			fc.property(outcomeArb(), outcomeArb(), (rawA, rawB) => {
				// Force distinct ids so the relationship is unambiguous.
				const a: Outcome = { ...rawA, id: "out-aaa", related: [] };
				const b: Outcome = { ...rawB, id: "out-bbb", related: [] };

				// Neither references the other: not acknowledged.
				expect(isAcknowledged(a, b)).toBe(false);

				// One-sided reference (a -> b only): not acknowledged.
				const aRefsB: Outcome = { ...a, related: [b.id] };
				expect(isAcknowledged(aRefsB, b)).toBe(false);
				expect(isAcknowledged(b, aRefsB)).toBe(false);

				// Mutual reference: acknowledged, and symmetric.
				const bRefsA: Outcome = { ...b, related: [a.id] };
				expect(isAcknowledged(aRefsB, bRefsA)).toBe(true);
				expect(isAcknowledged(bRefsA, aRefsB)).toBe(true);
			}),
			{ numRuns: 300 },
		);
	});
});
