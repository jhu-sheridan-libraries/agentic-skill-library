/**
 * Reconcile Orchestrator — unit tests for the `reconcile` sync-orchestration
 * layer (task 19.5).
 *
 * Exercises: deriving the reconcile set from ProvenanceRecords (not a hardcoded
 * map), orphaned/new classification, running the pure merge through the existing
 * canonical serialization + plan validation path, provenance-less exclusion, and
 * deterministic report ordering.
 *
 * Requirements: 18.3, 18.9, 18.10, 18.15, 18.17
 */

import { describe, expect, test } from "bun:test";
import {
	type BaseArtifactLoader,
	reconcileUpstreams,
} from "../reconcile-orchestrator";
import { computeBaseDigest } from "../rosetta/provenance-digest";
import type {
	KnowledgeArtifact,
	ProvenanceRecord,
	ReconciliationOutcome,
} from "../schemas";
import { makeArtifact, makeFrontmatter } from "./test-helpers";

/**
 * Build the recorded provenance for an Ours artifact whose base is `base`, with
 * a `baseDigest` that actually matches so self-verification passes and the full
 * three-way path runs.
 */
function provenanceForBase(
	base: KnowledgeArtifact,
	overrides: Partial<ProvenanceRecord> = {},
): ProvenanceRecord {
	const { digest } = computeBaseDigest(base);
	return provenance({
		baseDigest: digest ?? "sha256:missing",
		...overrides,
	});
}

const UPSTREAM = "kiro-marketplace";

function provenance(
	overrides: Partial<ProvenanceRecord> = {},
): ProvenanceRecord {
	return {
		upstream: UPSTREAM,
		sourcePath: "powers/example",
		sourceFormat: "kiro-power",
		sourceRevision: "abc123",
		contract: "kiro-power@1.0.0",
		baseDigest: "sha256:deadbeef",
		importedAt: "2026-07-19T00:00:00.000Z",
		...overrides,
	};
}

/** Ours artifact carrying provenance. */
function oursWithProvenance(
	name: string,
	prov: ProvenanceRecord,
	frontmatterOverrides: Parameters<typeof makeFrontmatter>[0] = {},
): KnowledgeArtifact {
	return makeArtifact({
		name,
		frontmatter: makeFrontmatter({
			name,
			provenance: prov,
			...frontmatterOverrides,
		}),
	});
}

/** Theirs artifact (freshly translated upstream), optionally with provenance. */
function theirs(
	name: string,
	opts: { prov?: ProvenanceRecord; body?: string } = {},
): KnowledgeArtifact {
	return makeArtifact({
		name,
		body: opts.body ?? "# Test Artifact\n\nThis is test content.",
		frontmatter: makeFrontmatter({
			name,
			...(opts.prov ? { provenance: opts.prov } : {}),
		}),
	});
}

/** A loader that returns the same base for a given source path. */
function loaderReturning(
	base: KnowledgeArtifact | undefined,
): BaseArtifactLoader {
	return () => base;
}

const noBaseLoader: BaseArtifactLoader = () => undefined;

describe("reconcileUpstreams — reconcile set derived from provenance (Req 18.3)", () => {
	test("only provenanced Ours artifacts are reconciled; others excluded (Req 18.17)", async () => {
		const prov = provenance({ sourcePath: "powers/curated" });
		const curated = oursWithProvenance("curated", prov);
		const handAuthored = makeArtifact({
			name: "hand-authored",
			frontmatter: makeFrontmatter({ name: "hand-authored" }),
		});

		const result = await reconcileUpstreams([
			{
				upstream: UPSTREAM,
				ours: [curated, handAuthored],
				theirs: [theirs("curated", { prov })],
				loadBase: noBaseLoader,
			},
		]);

		// hand-authored is excluded from reconciliation entirely
		expect(result.excludedArtifactNames).toContain("hand-authored");
		const names = result.report.entries.map((e) => e.artifactName);
		expect(names).toContain("curated");
		expect(names).not.toContain("hand-authored");
	});
});

describe("reconcileUpstreams — orphaned classification (Req 18.9)", () => {
	test("provenanced Ours with no matching upstream source is orphaned and untouched", async () => {
		const prov = provenance({ sourcePath: "powers/gone" });
		const ours = oursWithProvenance("gone", prov, {
			trust: "partner",
		});

		const result = await reconcileUpstreams([
			{
				upstream: UPSTREAM,
				ours: [ours],
				theirs: [], // upstream no longer has it
				loadBase: noBaseLoader,
			},
		]);

		const entry = result.report.entries.find((e) => e.artifactName === "gone");
		expect(entry?.result.outcome).toBe<ReconciliationOutcome>("orphaned");
		// Ours preserved verbatim, never deleted/overwritten
		expect(entry?.result.artifact.frontmatter.trust).toBe("partner");
		// No plan produced for an orphaned artifact
		const reconciled = result.reconciled.find((r) => r.artifactName === "gone");
		expect(reconciled?.plan).toBeUndefined();
	});
});

describe("reconcileUpstreams — new classification (Req 18.10)", () => {
	test("acquired upstream artifact with no Ours counterpart is new", async () => {
		const upstreamProv = provenance({ sourcePath: "powers/fresh" });
		const result = await reconcileUpstreams([
			{
				upstream: UPSTREAM,
				ours: [],
				theirs: [theirs("fresh", { prov: upstreamProv })],
				loadBase: noBaseLoader,
			},
		]);

		const entry = result.report.entries.find((e) => e.artifactName === "fresh");
		expect(entry?.result.outcome).toBe<ReconciliationOutcome>("new");
	});
});

describe("reconcileUpstreams — merged artifact flows through plan validation (Req 18.3)", () => {
	test("a reconciled artifact produces a validated canonical plan", async () => {
		// Base body == Ours body; Theirs body changed → fast-forward the
		// upstream-owned body. The base carries a bare provenance and its digest
		// is recorded on Ours so self-verification passes (full three-way path).
		const basePriorProv = provenance({ sourcePath: "powers/ff" });
		const base = makeArtifact({
			name: "ff",
			body: "# original body",
			frontmatter: makeFrontmatter({ name: "ff", provenance: basePriorProv }),
		});
		const prov = provenanceForBase(base, { sourcePath: "powers/ff" });
		const ours = makeArtifact({
			name: "ff",
			body: "# original body",
			frontmatter: makeFrontmatter({
				name: "ff",
				provenance: prov,
				trust: "partner",
			}),
		});
		const theirsArtifact = makeArtifact({
			name: "ff",
			body: "# upstream improved body",
			frontmatter: makeFrontmatter({ name: "ff", provenance: prov }),
		});

		const result = await reconcileUpstreams([
			{
				upstream: UPSTREAM,
				ours: [ours],
				theirs: [theirsArtifact],
				loadBase: loaderReturning(base),
			},
		]);

		const reconciled = result.reconciled.find((r) => r.artifactName === "ff");
		expect(reconciled?.result.outcome).toBe<ReconciliationOutcome>(
			"fast-forward",
		);
		// The merged artifact was serialized + validated through the existing path.
		expect(reconciled?.plan).toBeDefined();
		expect(reconciled?.plan?.outputFiles.length).toBeGreaterThan(0);
		// Body fast-forwarded to upstream; curation-owned trust preserved.
		expect(reconciled?.result.artifact.body).toBe("# upstream improved body");
		expect(reconciled?.result.artifact.frontmatter.trust).toBe("partner");
	});
});

describe("reconcileUpstreams — deterministic report ordering (Req 18.15)", () => {
	test("entries are ordered by outcome, then upstream, then artifact name", async () => {
		// Build a conflicting artifact "c" for each upstream: base body differs
		// from both Ours and Theirs → upstream-owned body conflict. The base for
		// each upstream carries that upstream's provenance so digests differ.
		const buildConflict = (upstream: string, sourcePath: string) => {
			const base = makeArtifact({
				name: "c",
				body: "# base",
				frontmatter: makeFrontmatter({
					name: "c",
					provenance: provenance({ upstream, sourcePath }),
				}),
			});
			const prov = provenanceForBase(base, { upstream, sourcePath });
			const ours = makeArtifact({
				name: "c",
				body: "# ours edit",
				frontmatter: makeFrontmatter({ name: "c", provenance: prov }),
			});
			const theirsArtifact = makeArtifact({
				name: "c",
				body: "# theirs edit",
				frontmatter: makeFrontmatter({ name: "c", provenance: prov }),
			});
			return { base, ours, theirsArtifact };
		};

		const alpha = buildConflict("alpha", "p/a");
		const beta = buildConflict("beta", "p/b");

		// Feed upstreams in reversed order to prove ordering is input-independent.
		const result = await reconcileUpstreams([
			{
				upstream: "beta",
				ours: [beta.ours],
				theirs: [
					beta.theirsArtifact,
					theirs("z-new", {
						prov: provenance({ upstream: "beta", sourcePath: "p/z" }),
					}),
				],
				loadBase: loaderReturning(beta.base),
			},
			{
				upstream: "alpha",
				ours: [alpha.ours],
				theirs: [
					alpha.theirsArtifact,
					theirs("a-new", {
						prov: provenance({ upstream: "alpha", sourcePath: "p/y" }),
					}),
				],
				loadBase: loaderReturning(alpha.base),
			},
		]);

		const order = result.report.entries.map(
			(e) => `${e.result.outcome}:${e.upstream}/${e.artifactName}`,
		);

		// conflict entries come first (both upstreams), ordered alpha then beta;
		// new entries come after.
		expect(order).toEqual([
			"conflict:alpha/c",
			"conflict:beta/c",
			"new:alpha/a-new",
			"new:beta/z-new",
		]);
	});

	test("reconciliation is repeatable — identical report across runs", async () => {
		const prov = provenance({ sourcePath: "powers/rep" });
		const ours = oursWithProvenance("rep", prov, { trust: "partner" });
		const theirsArtifact = theirs("rep", {
			prov,
			body: "# changed upstream",
		});
		const base = makeArtifact({
			name: "rep",
			body: "# original",
			frontmatter: makeFrontmatter({ name: "rep", provenance: prov }),
		});

		const opts = {
			upstream: UPSTREAM,
			ours: [ours],
			theirs: [theirsArtifact],
			loadBase: loaderReturning(base),
		};

		const first = await reconcileUpstreams([opts]);
		const second = await reconcileUpstreams([opts]);

		expect(JSON.stringify(first.report)).toBe(JSON.stringify(second.report));
	});
});
