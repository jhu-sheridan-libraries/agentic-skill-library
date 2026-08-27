/**
 * Rosetta Stone — Base_Digest and provenance self-verification property tests.
 *
 * Property-based checks for the pure digest/self-verification layer:
 * - Base_Digest is total and stable: any valid artifact yields a sha256 digest,
 *   and Canonically_Equivalent artifacts (identical content, reordered
 *   frontmatter keys) yield the identical digest (Requirement 18.2);
 * - a recorded digest that matches the reconstructed base verifies; a
 *   hand-edited (mismatching) digest fails with a warning and routes to the
 *   reduced-confidence two-way path (Requirement 18.16).
 *
 * These validate the digest/self-verification slice of the eventual Property 30
 * (task 19.7 owns the full annotated property); here they guard the layer in
 * isolation.
 *
 * Validates: Requirements 18.2, 18.16
 */

import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import {
	computeBaseDigest,
	selfVerifyReconcileInput,
	verifyProvenanceBase,
} from "../rosetta/provenance-digest";
import {
	DEFAULT_FIELD_OWNERSHIP_POLICY,
	type FieldOwnershipPolicy,
	type Frontmatter,
	type ProvenanceRecord,
} from "../schemas";
import { makeArtifact, makeFrontmatter } from "./test-helpers";

const POLICY: FieldOwnershipPolicy = { ...DEFAULT_FIELD_OWNERSHIP_POLICY };

const arbBody = fc.constantFrom("v0", "v1", "v2", "v3");
const arbKeywords = fc.array(fc.constantFrom("a", "b", "c", "d", "e"), {
	maxLength: 5,
});
const arbTrust = fc.constantFrom(
	"official",
	"partner",
	"community",
	"experimental",
);

function baseProvenance(baseDigest: string): ProvenanceRecord {
	return {
		upstream: "kiro-powers",
		sourcePath: "test-artifact",
		sourceFormat: "kiro-power",
		sourceRevision: "9f3c1e2",
		contract: "kiro-power@1",
		baseDigest,
		importedAt: "2026-07-19T00:00:00.000Z",
	};
}

describe("Property: Base_Digest is total and stable (Req 18.2)", () => {
	test("every valid artifact yields a sha256:<hex> digest and is reorder-stable", () => {
		fc.assert(
			fc.property(
				fc.record({
					body: arbBody,
					keywords: arbKeywords,
					trust: arbTrust,
				}),
				({ body, keywords, trust }) => {
					const frontmatter = makeFrontmatter({
						keywords,
						trust: trust as Frontmatter["trust"],
					});
					const artifact = makeArtifact({ frontmatter, body });

					const first = computeBaseDigest(artifact);
					// Total: a valid artifact always produces a digest.
					expect(first.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
					expect(first.diagnostics).toEqual([]);

					// Stable: recomputing yields the same digest.
					const again = computeBaseDigest(artifact);
					expect(again.digest).toBe(first.digest);

					// Canonically_Equivalent: reordering frontmatter keys does not
					// change the digest (the serializer normalizes key order).
					const reordered: Frontmatter = Object.fromEntries(
						Object.entries(frontmatter).reverse(),
					) as Frontmatter;
					const reorderedDigest = computeBaseDigest(
						makeArtifact({ frontmatter: reordered, body }),
					);
					expect(reorderedDigest.digest).toBe(first.digest);
				},
			),
			{ numRuns: 200 },
		);
	});
});

describe("Property: self-verification routes hand-edits to reduced confidence (Req 18.16)", () => {
	test("matching digest verifies; mismatching digest fails and downgrades", () => {
		fc.assert(
			fc.property(
				fc.record({
					baseBody: arbBody,
					oursBody: arbBody,
					theirsBody: arbBody,
					tamper: fc.boolean(),
				}),
				({ baseBody, oursBody, theirsBody, tamper }) => {
					const base = makeArtifact({ body: baseBody });
					const theirs = makeArtifact({ body: theirsBody });
					const trueDigest = computeBaseDigest(base).digest as string;

					const recorded = tamper ? `${trueDigest}-tampered` : trueDigest;
					const ours = makeArtifact({
						body: oursBody,
						frontmatter: makeFrontmatter({
							provenance: baseProvenance(recorded),
						}),
					});

					const verification = verifyProvenanceBase(ours, base);
					const prepared = selfVerifyReconcileInput({
						base,
						ours,
						theirs,
						policy: POLICY,
					});

					if (tamper) {
						// Hand-edited provenance: fails with a warning, downgrades input.
						expect(verification.verified).toBe(false);
						expect(verification.diagnostic?.severity).toBe("warning");
						expect(prepared.input.baseUnverified).toBe(true);
						expect(prepared.diagnostic).toBeDefined();
					} else {
						// Intact provenance: verifies, input untouched.
						expect(verification.verified).toBe(true);
						expect(verification.diagnostic).toBeUndefined();
						expect(prepared.input.baseUnverified).toBeUndefined();
					}
				},
			),
			{ numRuns: 200 },
		);
	});
});
