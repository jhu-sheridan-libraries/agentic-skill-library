/** Feature: rosetta-stone, Property 30: Provenance digests and reconciliation outcomes are total and stable */

/**
 * Property 30: Provenance digests and reconciliation outcomes are total and stable
 *
 * **Validates: Requirements 18.1, 18.2, 18.3, 18.8, 18.9, 18.10, 18.11, 18.16**
 *
 * This property test exercises the full Property 30 across the three
 * collaborating layers named in the design:
 *
 * - `src/rosetta/provenance-digest.ts` — `computeBaseDigest`,
 *   `verifyProvenanceBase`, `selfVerifyReconcileInput`;
 * - `src/rosetta/reconcile.ts` — `reconcileArtifact` (the pure merge that emits
 *   `clean`, the reduced-confidence path, and one artifact-level outcome);
 * - `src/reconcile-orchestrator.ts` — `reconcileUpstreams` (the layer that
 *   classifies `orphaned`/`new` from provenance identity, since those outcomes
 *   are not produced by the pure core).
 *
 * The assertions cover, in order:
 * 1. Base_Digest stability across repeated translation and Canonically_Equivalent
 *    (reordered-frontmatter) inputs (Requirement 18.2), and totality — every
 *    valid artifact yields a digest (Requirement 18.1).
 * 2. `clean` outcome and no change when the recorded digest equals the freshly
 *    translated Theirs digest (Requirement 18.3).
 * 3. The reduced-confidence two-way path on a missing base (Requirement 18.11)
 *    OR a failed provenance self-verification (Requirement 18.16), never a
 *    silent overwrite.
 * 4. `orphaned` and `new` classification through the orchestrator
 *    (Requirements 18.9, 18.10).
 * 5. Totality — every reconciled artifact receives exactly one
 *    ReconciliationOutcome (Requirements 18.3, 18.8).
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import { reconcileUpstreams } from "../reconcile-orchestrator";
import { serializeCanonical } from "../rosetta/canonical";
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
	ReconciliationOutcomeSchema,
} from "../schemas";
import { makeArtifact, makeFrontmatter } from "./test-helpers";

const NUM_RUNS = 100;
const POLICY: FieldOwnershipPolicy = { ...DEFAULT_FIELD_OWNERSHIP_POLICY };
const UPSTREAM = "kiro-powers";

/** The closed set of legal per-artifact outcomes. */
const OUTCOME_VALUES: readonly string[] = ReconciliationOutcomeSchema.options;

// ═══════════════════════════════════════════════════════════════════════════════
// Bounded arbitraries
// ═══════════════════════════════════════════════════════════════════════════════

const arbBody = fc.constantFrom("body-a", "body-b", "body-c", "body-d");
// Unique members: merge-by-union fields dedup, so a duplicate-bearing array
// would not equal its own union and would spuriously read as `merged`. Keeping
// members unique keeps union(x, x) === x for the "no divergence" scenarios.
const arbKeywords = fc.uniqueArray(fc.constantFrom("k1", "k2", "k3", "k4"), {
	maxLength: 4,
});
const arbTrust = fc.constantFrom(
	"official",
	"partner",
	"community",
	"experimental",
) as fc.Arbitrary<Frontmatter["trust"]>;

/** A short, stable source subpath used as the provenance identity key. */
const arbSourcePath = fc.constantFrom(
	"powers/alpha",
	"powers/beta",
	"powers/gamma",
);

/**
 * Build a ProvenanceRecord for a given source subpath and recorded base digest.
 * The identity used by the orchestrator to pair Ours/Theirs is `sourcePath`.
 */
function makeProvenance(
	sourcePath: string,
	baseDigest: string,
): ProvenanceRecord {
	return {
		upstream: UPSTREAM,
		sourcePath,
		sourceFormat: "kiro-power",
		sourceRevision: "abc1234",
		contract: "kiro-power@1",
		baseDigest,
		importedAt: "2026-07-19T00:00:00.000Z",
	};
}

/**
 * Build an Ours artifact carrying provenance. The artifact `name` and its
 * provenance `sourcePath` both derive from `sourcePath` so the orchestrator's
 * name-fallback and sourcePath identity agree.
 */
function makeOurs(
	sourcePath: string,
	baseDigest: string,
	overrides: {
		body?: string;
		keywords?: string[];
		trust?: Frontmatter["trust"];
	} = {},
): KnowledgeArtifact {
	const name = sourcePath.replace(/\//g, "-");
	return makeArtifact({
		name,
		frontmatter: makeFrontmatter({
			name,
			keywords: overrides.keywords ?? ["k1"],
			trust: overrides.trust,
			provenance: makeProvenance(sourcePath, baseDigest),
		}),
		body: overrides.body ?? "body-a",
	});
}

/**
 * Build a Theirs artifact for a source subpath. Theirs carries provenance with
 * the SAME `sourcePath` so orchestrator identity matches Ours.
 */
function makeTheirs(
	sourcePath: string,
	overrides: { body?: string; keywords?: string[] } = {},
): KnowledgeArtifact {
	const name = sourcePath.replace(/\//g, "-");
	return makeArtifact({
		name,
		frontmatter: makeFrontmatter({
			name,
			keywords: overrides.keywords ?? ["k1"],
			provenance: makeProvenance(sourcePath, "sha256:unused"),
		}),
		body: overrides.body ?? "body-a",
	});
}

// ═══════════════════════════════════════════════════════════════════════════════
// 18.1 / 18.2 — Base_Digest is total and stable across repeated translation
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 30: Base_Digest is total and stable (Req 18.1, 18.2)", () => {
	it("every valid artifact yields a sha256 digest, stable across repeats and key reorder", () => {
		fc.assert(
			fc.property(
				fc.record({ body: arbBody, keywords: arbKeywords, trust: arbTrust }),
				({ body, keywords, trust }) => {
					const frontmatter = makeFrontmatter({ keywords, trust });
					const artifact = makeArtifact({ frontmatter, body });

					// Totality: a valid artifact always produces a digest (18.1).
					const first = computeBaseDigest(artifact);
					expect(first.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
					expect(first.diagnostics).toEqual([]);

					// Stability across repeated translation of the same revision (18.2).
					const second = computeBaseDigest(artifact);
					expect(second.digest).toBe(first.digest);

					// Canonically_Equivalent: reordering frontmatter keys is invisible.
					const reordered = Object.fromEntries(
						Object.entries(frontmatter).reverse(),
					) as Frontmatter;
					const reorderedDigest = computeBaseDigest(
						makeArtifact({ frontmatter: reordered, body }),
					);
					expect(reorderedDigest.digest).toBe(first.digest);
				},
			),
			{ numRuns: NUM_RUNS },
		);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 18.3 — clean outcome on digest equality
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 30: clean outcome when Theirs equals the recorded base (Req 18.3)", () => {
	it("recorded digest == fresh Theirs digest ⇒ verified, clean, artifact unchanged", () => {
		fc.assert(
			fc.property(
				fc.record({ body: arbBody, keywords: arbKeywords }),
				({ body, keywords }) => {
					// Base and Theirs are the same upstream revision (no upstream change).
					const base = makeArtifact({
						frontmatter: makeFrontmatter({ keywords }),
						body,
					});
					const recordedDigest = computeBaseDigest(base).digest as string;

					// Ours is curated identically to Base for the upstream-owned fields
					// so nothing diverges; provenance records the true base digest.
					const ours = makeArtifact({
						frontmatter: makeFrontmatter({
							keywords,
							provenance: makeProvenance("powers/alpha", recordedDigest),
						}),
						body,
					});
					const theirs = makeArtifact({
						frontmatter: makeFrontmatter({ keywords }),
						body,
					});

					// Self-verification succeeds: recorded == recomputed (18.3 precondition).
					const verification = verifyProvenanceBase(ours, base);
					expect(verification.verified).toBe(true);
					expect(verification.recomputedDigest).toBe(recordedDigest);

					const result = reconcileArtifact({
						base,
						ours,
						theirs,
						policy: POLICY,
					});
					// No divergence anywhere ⇒ clean, and Ours is preserved byte-for-byte.
					expect(result.outcome).toBe("clean");
					const oursBytes = serializeCanonical(ours).plan?.outputFiles;
					const mergedBytes = serializeCanonical(result.artifact).plan
						?.outputFiles;
					expect(mergedBytes).toEqual(oursBytes);
				},
			),
			{ numRuns: NUM_RUNS },
		);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 18.11 / 18.16 — reduced-confidence path on missing base OR failed self-verify
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 30: reduced-confidence path, never a silent overwrite (Req 18.11, 18.16)", () => {
	it("missing base or hand-edited provenance keeps Ours and flags reduced confidence", () => {
		fc.assert(
			fc.property(
				fc.record({
					oursBody: arbBody,
					theirsBody: arbBody,
					// how the base is unavailable: absent entirely, or present-but-tampered
					mode: fc.constantFrom("missing-base", "failed-self-verify"),
				}),
				({ oursBody, theirsBody, mode }) => {
					const trueBase = makeArtifact({ body: "body-base" });
					const trueDigest = computeBaseDigest(trueBase).digest as string;

					// Force an upstream-owned divergence so the two-way path must decide.
					fc.pre(oursBody !== theirsBody);

					if (mode === "missing-base") {
						// No base supplied at all (cache miss) — Requirement 18.11.
						const ours = makeArtifact({
							frontmatter: makeFrontmatter({
								provenance: makeProvenance("powers/alpha", trueDigest),
							}),
							body: oursBody,
						});
						const theirs = makeArtifact({ body: theirsBody });

						const result = reconcileArtifact({
							ours,
							theirs,
							policy: POLICY,
						});

						// Ours body is preserved (no overwrite) and a reduced-confidence
						// warning is present for the diverging upstream-owned field.
						expect(result.artifact.body).toBe(oursBody);
						const reduced = result.diagnostics.filter(
							(d) => d.confidence === "reduced",
						);
						expect(reduced.length).toBeGreaterThan(0);
						expect(result.outcome).toBe("conflict");
					} else {
						// A base IS supplied but the recorded provenance digest does not
						// match it (hand-edited provenance) — Requirement 18.16. The
						// self-verifier must downgrade the input to baseUnverified.
						const recorded = `${trueDigest}-tampered`;
						const ours = makeArtifact({
							frontmatter: makeFrontmatter({
								provenance: makeProvenance("powers/alpha", recorded),
							}),
							body: oursBody,
						});
						const theirs = makeArtifact({ body: theirsBody });

						const verification = verifyProvenanceBase(ours, trueBase);
						expect(verification.verified).toBe(false);
						expect(verification.diagnostic?.severity).toBe("warning");

						const prepared = selfVerifyReconcileInput({
							base: trueBase,
							ours,
							theirs,
							policy: POLICY,
						});
						// The verified-failed input is forced onto the two-way path.
						expect(prepared.input.baseUnverified).toBe(true);

						const result = reconcileArtifact(prepared.input);
						// Ours preserved; artifact-level reduced-confidence warning present.
						expect(result.artifact.body).toBe(oursBody);
						const reduced = result.diagnostics.filter(
							(d) => d.confidence === "reduced",
						);
						expect(reduced.length).toBeGreaterThan(0);
					}
				},
			),
			{ numRuns: NUM_RUNS },
		);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 18.9 / 18.10 — orphaned and new classification via the orchestrator
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 30: orphaned/new classification via the orchestrator (Req 18.9, 18.10)", () => {
	it("provenanced Ours absent upstream ⇒ orphaned; upstream without Ours ⇒ new", async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.record({
					// three distinct source subpaths partitioned into three roles
					paths: fc.constant([
						"powers/alpha",
						"powers/beta",
						"powers/gamma",
					] as const),
					oursBody: arbBody,
					theirsBody: arbBody,
				}),
				async ({ paths, oursBody, theirsBody }) => {
					const [matchedPath, orphanPath, newPath] = paths;

					// Ours: one matched (present upstream) + one orphan (absent upstream).
					const matchedOurs = makeOurs(matchedPath, "sha256:unused", {
						body: oursBody,
					});
					const orphanOurs = makeOurs(orphanPath, "sha256:unused", {
						body: oursBody,
					});

					// Theirs: the matched path + a brand-new path with no Ours counterpart.
					const matchedTheirs = makeTheirs(matchedPath, { body: theirsBody });
					const newTheirs = makeTheirs(newPath, { body: theirsBody });

					const { report } = await reconcileUpstreams([
						{
							upstream: UPSTREAM,
							ours: [matchedOurs, orphanOurs],
							theirs: [matchedTheirs, newTheirs],
							// no base cache — matched artifact takes the two-way path
							loadBase: () => undefined,
						},
					]);

					const byName = new Map(
						report.entries.map((e) => [e.artifactName, e.result.outcome]),
					);

					// Orphan: provenanced Ours whose source is gone upstream (18.9).
					expect(byName.get(orphanPath.replace(/\//g, "-"))).toBe("orphaned");
					// New: acquired upstream artifact with no Ours counterpart (18.10).
					expect(byName.get(newPath.replace(/\//g, "-"))).toBe("new");
					// Matched: present on both sides, so neither orphaned nor new.
					const matchedOutcome = byName.get(matchedPath.replace(/\//g, "-"));
					expect(matchedOutcome).toBeDefined();
					expect(matchedOutcome).not.toBe("orphaned");
					expect(matchedOutcome).not.toBe("new");
				},
			),
			{ numRuns: NUM_RUNS },
		);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 18.3 / 18.8 — totality: every reconciled artifact gets exactly one outcome
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 30: outcome totality — exactly one outcome per artifact (Req 18.3, 18.8)", () => {
	it("every report entry carries exactly one legal ReconciliationOutcome", async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.record({
					sourcePath: arbSourcePath,
					oursBody: arbBody,
					theirsBody: arbBody,
					oursKeywords: arbKeywords,
					theirsKeywords: arbKeywords,
					provideBase: fc.boolean(),
					// whether Theirs is present (matched) or absent (orphan) upstream
					theirsPresent: fc.boolean(),
					// an extra brand-new upstream artifact to force a `new` row
					includeNew: fc.boolean(),
				}),
				async ({
					sourcePath,
					oursBody,
					theirsBody,
					oursKeywords,
					theirsKeywords,
					provideBase,
					theirsPresent,
					includeNew,
				}) => {
					const base = makeArtifact({ body: "body-base" });
					const trueDigest = computeBaseDigest(base).digest as string;

					const ours = makeOurs(sourcePath, trueDigest, {
						body: oursBody,
						keywords: oursKeywords,
					});

					const theirsList: KnowledgeArtifact[] = [];
					if (theirsPresent) {
						theirsList.push(
							makeTheirs(sourcePath, {
								body: theirsBody,
								keywords: theirsKeywords,
							}),
						);
					}
					if (includeNew) {
						theirsList.push(
							makeTheirs("powers/delta-new", { body: theirsBody }),
						);
					}

					const { report, reconciled } = await reconcileUpstreams([
						{
							upstream: UPSTREAM,
							ours: [ours],
							theirs: theirsList,
							loadBase: () => (provideBase ? base : undefined),
						},
					]);

					// Every report entry has exactly one legal outcome (18.3, 18.8).
					expect(report.entries.length).toBe(reconciled.length);
					for (const entry of report.entries) {
						expect(OUTCOME_VALUES).toContain(entry.result.outcome);
					}
					// The set of outcomes is a partition: one per reconciled artifact.
					const names = report.entries.map((e) => e.artifactName);
					expect(new Set(names).size).toBe(names.length);
				},
			),
			{ numRuns: NUM_RUNS },
		);
	});
});
