/**
 * Rosetta Stone — Reconciliation core property tests.
 *
 * Property-based checks for the pure three-way reconciliation core:
 * - curation preservation (curation-owned fields never lose Ours);
 * - fast-forward only when Ours == Base for an upstream-owned field;
 * - conflict keeps Ours while non-conflicting fields are still applied;
 * - deterministic union for merge-by-union fields;
 * - repeat-run canonical equivalence with identical diagnostics.
 *
 * These validate the reconciliation-core slice of the eventual Property 29
 * (task 19.7 owns the full annotated property); here they guard the core in
 * isolation.
 *
 * Validates: Requirements 18.4, 18.5, 18.6, 18.7, 18.12, 18.13
 */

import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { reconcileArtifact } from "../rosetta/reconcile";
import {
	DEFAULT_FIELD_OWNERSHIP_POLICY,
	type FieldOwnershipPolicy,
	type KnowledgeArtifact,
} from "../schemas";
import { makeArtifact, makeFrontmatter } from "./test-helpers";

const POLICY: FieldOwnershipPolicy = { ...DEFAULT_FIELD_OWNERSHIP_POLICY };

/** A small alphabet of body values so equality/divergence is generated densely. */
const arbBody = fc.constantFrom("v0", "v1", "v2", "v3");

/** Bounded keyword arrays (kebab-safe tokens). */
const arbKeywords = fc.array(fc.constantFrom("a", "b", "c", "d", "e"), {
	maxLength: 5,
});

/** Curation values. */
const arbTrust = fc.constantFrom(
	"official",
	"partner",
	"community",
	"experimental",
);

interface Triple {
	readonly base: KnowledgeArtifact;
	readonly ours: KnowledgeArtifact;
	readonly theirs: KnowledgeArtifact;
}

const arbTriple: fc.Arbitrary<Triple> = fc
	.record({
		baseBody: arbBody,
		oursBody: arbBody,
		theirsBody: arbBody,
		baseKw: arbKeywords,
		oursKw: arbKeywords,
		theirsKw: arbKeywords,
		baseTrust: arbTrust,
		oursTrust: arbTrust,
		theirsTrust: arbTrust,
	})
	.map((v) => ({
		base: makeArtifact({
			body: v.baseBody,
			frontmatter: makeFrontmatter({
				keywords: [...new Set(v.baseKw)],
				trust: v.baseTrust as never,
			}),
		}),
		ours: makeArtifact({
			body: v.oursBody,
			frontmatter: makeFrontmatter({
				keywords: [...new Set(v.oursKw)],
				trust: v.oursTrust as never,
			}),
		}),
		theirs: makeArtifact({
			body: v.theirsBody,
			frontmatter: makeFrontmatter({
				keywords: [...new Set(v.theirsKw)],
				trust: v.theirsTrust as never,
			}),
		}),
	}));

describe("Reconciliation core properties", () => {
	test("curation-owned trust always equals Ours (Req 18.6)", () => {
		fc.assert(
			fc.property(arbTriple, ({ base, ours, theirs }) => {
				const result = reconcileArtifact({
					base,
					ours,
					theirs,
					policy: POLICY,
				});
				expect(result.artifact.frontmatter.trust).toBe(ours.frontmatter.trust);
			}),
			{ numRuns: 200 },
		);
	});

	test("upstream-owned body fast-forwards iff Base==Ours and Theirs differs (Req 18.4/18.5)", () => {
		fc.assert(
			fc.property(arbTriple, ({ base, ours, theirs }) => {
				const result = reconcileArtifact({
					base,
					ours,
					theirs,
					policy: POLICY,
				});
				const oursEqBase = ours.body === base.body;
				const theirsChanged = theirs.body !== base.body;
				if (oursEqBase && theirsChanged) {
					// fast-forward: take Theirs
					expect(result.artifact.body).toBe(theirs.body);
				} else {
					// conflict or no-op: keep Ours
					expect(result.artifact.body).toBe(ours.body);
				}
			}),
			{ numRuns: 200 },
		);
	});

	test("merge-by-union contains every Ours member (no curation loss) (Req 18.7)", () => {
		fc.assert(
			fc.property(arbTriple, ({ base, ours, theirs }) => {
				const result = reconcileArtifact({
					base,
					ours,
					theirs,
					policy: POLICY,
				});
				const merged = result.artifact.frontmatter.keywords;
				// removals only apply to members present in Base but absent in Theirs.
				for (const kw of ours.frontmatter.keywords) {
					const removedUpstream =
						base.frontmatter.keywords.includes(kw) &&
						!theirs.frontmatter.keywords.includes(kw);
					if (!removedUpstream) {
						expect(merged).toContain(kw);
					}
				}
				// no duplicates
				expect(new Set(merged).size).toBe(merged.length);
			}),
			{ numRuns: 200 },
		);
	});

	test("merge-by-union includes new Theirs members not removed (Req 18.7)", () => {
		fc.assert(
			fc.property(arbTriple, ({ base, ours, theirs }) => {
				const result = reconcileArtifact({
					base,
					ours,
					theirs,
					policy: POLICY,
				});
				const merged = result.artifact.frontmatter.keywords;
				for (const kw of theirs.frontmatter.keywords) {
					expect(merged).toContain(kw);
				}
			}),
			{ numRuns: 200 },
		);
	});

	test("repeat runs are canonically equivalent with identical diagnostics (Req 18.13)", () => {
		fc.assert(
			fc.property(arbTriple, ({ base, ours, theirs }) => {
				const r1 = reconcileArtifact({ base, ours, theirs, policy: POLICY });
				const r2 = reconcileArtifact({ base, ours, theirs, policy: POLICY });
				expect(JSON.stringify(r1.artifact)).toBe(JSON.stringify(r2.artifact));
				expect(JSON.stringify(r1.diagnostics)).toBe(
					JSON.stringify(r2.diagnostics),
				);
				expect(r1.outcome).toBe(r2.outcome);
			}),
			{ numRuns: 200 },
		);
	});

	test("exactly one artifact outcome, always a valid enum member (Req 18.12)", () => {
		const valid = new Set([
			"clean",
			"fast-forward",
			"merged",
			"conflict",
			"orphaned",
			"new",
		]);
		fc.assert(
			fc.property(arbTriple, ({ base, ours, theirs }) => {
				const result = reconcileArtifact({
					base,
					ours,
					theirs,
					policy: POLICY,
				});
				expect(valid.has(result.outcome)).toBe(true);
			}),
			{ numRuns: 200 },
		);
	});

	test("two-way path (no base) never loses an Ours keyword", () => {
		fc.assert(
			fc.property(arbTriple, ({ ours, theirs }) => {
				const result = reconcileArtifact({ ours, theirs, policy: POLICY });
				for (const kw of ours.frontmatter.keywords) {
					expect(result.artifact.frontmatter.keywords).toContain(kw);
				}
			}),
			{ numRuns: 200 },
		);
	});
});
