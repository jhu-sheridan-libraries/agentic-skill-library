/**
 * Rosetta Stone — Base_Digest and provenance self-verification unit tests.
 *
 * Exercises deterministic Base_Digest computation over the Canonical_Serializer
 * plan and provenance self-verification routing hand-edited artifacts to the
 * reduced-confidence two-way path with a warning diagnostic.
 *
 * Requirements: 18.2, 18.16
 */

import { describe, expect, test } from "bun:test";
import {
	computeBaseDigest,
	selfVerifyReconcileInput,
	verifyProvenanceBase,
} from "../rosetta/provenance-digest";
import { reconcileArtifact } from "../rosetta/reconcile";
import {
	DEFAULT_FIELD_OWNERSHIP_POLICY,
	type FieldOwnershipPolicy,
	type Frontmatter,
	type KnowledgeArtifact,
	type ProvenanceRecord,
} from "../schemas";
import { makeArtifact, makeFrontmatter } from "./test-helpers";

const DEFAULT_POLICY: FieldOwnershipPolicy = {
	...DEFAULT_FIELD_OWNERSHIP_POLICY,
};

function provenance(
	overrides: Partial<ProvenanceRecord> = {},
): ProvenanceRecord {
	return {
		upstream: "kiro-powers",
		sourcePath: "test-artifact",
		sourceFormat: "kiro-power",
		sourceRevision: "9f3c1e2",
		contract: "kiro-power@1",
		baseDigest: "sha256:placeholder",
		importedAt: "2026-07-19T00:00:00.000Z",
		...overrides,
	};
}

describe("computeBaseDigest — deterministic sha256 (Req 18.2)", () => {
	test("produces a sha256:<hex> digest for a valid artifact", () => {
		const result = computeBaseDigest(makeArtifact());
		expect(result.diagnostics).toEqual([]);
		expect(result.digest).toBeDefined();
		expect(result.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
	});

	test("identical artifacts yield identical digests", () => {
		const a = computeBaseDigest(makeArtifact());
		const b = computeBaseDigest(makeArtifact());
		expect(a.digest).toBe(b.digest);
	});

	test("canonically-equivalent artifacts (reordered frontmatter keys) yield identical digests", () => {
		// Build two frontmatters with the same content but different key insertion
		// order; the Canonical_Serializer normalizes key order before hashing.
		const forward = makeFrontmatter({
			keywords: ["alpha", "beta"],
			categories: ["debugging"],
		});
		const reordered: Frontmatter = Object.fromEntries(
			Object.entries(forward).reverse(),
		) as Frontmatter;

		const a = computeBaseDigest(makeArtifact({ frontmatter: forward }));
		const b = computeBaseDigest(makeArtifact({ frontmatter: reordered }));
		expect(a.digest).toBe(b.digest);
	});

	test("different body content yields a different digest", () => {
		const a = computeBaseDigest(makeArtifact({ body: "# One" }));
		const b = computeBaseDigest(makeArtifact({ body: "# Two" }));
		expect(a.digest).not.toBe(b.digest);
	});
});

describe("verifyProvenanceBase — self-verification (Req 18.16)", () => {
	test("verifies when the recorded digest matches the reconstructed base", () => {
		const base = makeArtifact({ body: "# Upstream body" });
		const { digest } = computeBaseDigest(base);
		expect(digest).toBeDefined();

		const ours = makeArtifact({
			body: "# Curated body",
			frontmatter: makeFrontmatter({
				provenance: provenance({ baseDigest: digest as string }),
			}),
		});

		const verification = verifyProvenanceBase(ours, base);
		expect(verification.verified).toBe(true);
		expect(verification.diagnostic).toBeUndefined();
		expect(verification.recomputedDigest).toBe(digest);
	});

	test("fails with a warning diagnostic when provenance was hand-edited", () => {
		const base = makeArtifact({ body: "# Upstream body" });
		const ours = makeArtifact({
			body: "# Curated body",
			frontmatter: makeFrontmatter({
				provenance: provenance({ baseDigest: "sha256:deadbeef" }),
			}),
		});

		const verification = verifyProvenanceBase(ours, base);
		expect(verification.verified).toBe(false);
		expect(verification.diagnostic).toBeDefined();
		expect(verification.diagnostic?.severity).toBe("warning");
		expect(verification.diagnostic?.code).toBe(
			"RS_RECONCILE_PROVENANCE_UNVERIFIED",
		);
		expect(verification.diagnostic?.confidence).toBe("reduced");
	});

	test("no diagnostic when there is no provenance record to verify", () => {
		const base = makeArtifact();
		const ours = makeArtifact();
		const verification = verifyProvenanceBase(ours, base);
		expect(verification.verified).toBe(false);
		expect(verification.diagnostic).toBeUndefined();
		expect(verification.recordedDigest).toBeUndefined();
	});

	test("no diagnostic when the candidate base is absent (cache miss)", () => {
		const ours = makeArtifact({
			frontmatter: makeFrontmatter({
				provenance: provenance({ baseDigest: "sha256:something" }),
			}),
		});
		const verification = verifyProvenanceBase(ours, undefined);
		expect(verification.verified).toBe(false);
		expect(verification.diagnostic).toBeUndefined();
		expect(verification.recordedDigest).toBe("sha256:something");
	});
});

describe("selfVerifyReconcileInput — routes to reduced-confidence path (Req 18.16)", () => {
	function inputWith(
		base: KnowledgeArtifact | undefined,
		ours: KnowledgeArtifact,
		theirs: KnowledgeArtifact,
	) {
		return {
			base,
			ours,
			theirs,
			policy: DEFAULT_POLICY,
		};
	}

	test("forces baseUnverified=true when self-verification fails", () => {
		const base = makeArtifact({ body: "# Upstream" });
		const theirs = makeArtifact({ body: "# New upstream" });
		const ours = makeArtifact({
			body: "# Curated",
			frontmatter: makeFrontmatter({
				provenance: provenance({ baseDigest: "sha256:mismatch" }),
			}),
		});

		const { input, verification, diagnostic } = selfVerifyReconcileInput(
			inputWith(base, ours, theirs),
		);
		expect(verification.verified).toBe(false);
		expect(input.baseUnverified).toBe(true);
		expect(diagnostic).toBeDefined();

		// Reconciling with the downgraded input yields a reduced-confidence result.
		const result = reconcileArtifact(input);
		const reduced = result.diagnostics.some((d) => d.confidence === "reduced");
		expect(reduced).toBe(true);
	});

	test("leaves the input untouched when self-verification passes", () => {
		const base = makeArtifact({ body: "# Upstream" });
		const { digest } = computeBaseDigest(base);
		const theirs = makeArtifact({ body: "# New upstream" });
		const ours = makeArtifact({
			body: "# Curated",
			frontmatter: makeFrontmatter({
				provenance: provenance({ baseDigest: digest as string }),
			}),
		});

		const { input, verification, diagnostic } = selfVerifyReconcileInput(
			inputWith(base, ours, theirs),
		);
		expect(verification.verified).toBe(true);
		expect(input.baseUnverified).toBeUndefined();
		expect(diagnostic).toBeUndefined();
	});

	test("leaves the input untouched when there is nothing to verify", () => {
		const theirs = makeArtifact({ body: "# New upstream" });
		const ours = makeArtifact({ body: "# Curated" });

		const { input, verification } = selfVerifyReconcileInput(
			inputWith(undefined, ours, theirs),
		);
		expect(verification.verified).toBe(false);
		expect(input.baseUnverified).toBeUndefined();
	});
});
