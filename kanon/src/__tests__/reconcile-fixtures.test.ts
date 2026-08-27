/**
 * Reconciliation fixture-based re-sync regression tests (task 19.9).
 *
 * Drives the reconcile orchestrator (`reconcileUpstreams`) through the six
 * re-synchronization scenarios that a real second-and-subsequent sync exercises:
 *
 *  - clean        — upstream-owned field unchanged; nothing to apply.
 *  - fast-forward — upstream changed a field the maintainer never touched.
 *  - conflict     — upstream and curation both changed the same upstream field.
 *  - orphaned     — a curated, provenanced artifact whose upstream source is gone.
 *  - new          — a fresh upstream artifact with no curated counterpart.
 *  - no-base      — the base cache missed, forcing the reduced-confidence path.
 *
 * Each fixture pins a distinct curation-owned signal (trust, categories,
 * collections) on the curated (Ours) artifact and a DIFFERENT value on the
 * upstream (Theirs) artifact. The central regression assertion is that NO
 * Curation_Loss occurs (Requirement 18.6): after reconciliation every
 * curation-owned field still equals the curated value in every scenario, and
 * the deterministic ReconciliationReport reports the expected outcome and
 * conflict-field detail (Requirement 18.15).
 *
 * Requirements: 18.14, 18.15
 */

import { describe, expect, test } from "bun:test";
import {
	type BaseArtifactLoader,
	reconcileUpstreams,
} from "../reconcile-orchestrator";
import { computeBaseDigest } from "../rosetta/provenance-digest";
import type {
	Category,
	KnowledgeArtifact,
	ProvenanceRecord,
	ReconciliationOutcome,
	TrustLane,
} from "../schemas";
import { makeArtifact, makeFrontmatter } from "./test-helpers";

const UPSTREAM = "kiro-marketplace";

/** The curation-owned signals a maintainer sets on a distilled artifact. */
interface Curation {
	readonly trust: TrustLane;
	readonly categories: readonly Category[];
	readonly collections: readonly string[];
}

const CURATION: Curation = {
	trust: "partner",
	// `categories` is a controlled enum on the canonical schema, so fixtures use
	// real category values to survive plan serialization/validation.
	categories: ["testing"],
	collections: ["neon-caravan"],
};

/** Build a bare provenance record for a given source path. */
function provenance(sourcePath: string): ProvenanceRecord {
	return {
		upstream: UPSTREAM,
		sourcePath,
		sourceFormat: "kiro-power",
		sourceRevision: "abc123",
		contract: "kiro-power@1.0.0",
		baseDigest: "sha256:placeholder",
		importedAt: "2026-07-19T00:00:00.000Z",
	};
}

/**
 * Build a Base artifact (the recorded common ancestor). It carries a bare
 * provenance so it serializes like any other artifact.
 */
function makeBase(name: string, body: string): KnowledgeArtifact {
	return makeArtifact({
		name,
		body,
		frontmatter: makeFrontmatter({
			name,
			provenance: provenance(`powers/${name}`),
		}),
	});
}

/**
 * Build the curated (Ours) artifact with the pinned curation signals and a
 * provenance whose `baseDigest` matches `base` so self-verification passes and
 * the full three-way path runs.
 */
function makeOurs(
	name: string,
	body: string,
	base: KnowledgeArtifact,
): KnowledgeArtifact {
	const { digest } = computeBaseDigest(base);
	return makeArtifact({
		name,
		body,
		frontmatter: makeFrontmatter({
			name,
			trust: CURATION.trust,
			categories: [...CURATION.categories],
			collections: [...CURATION.collections],
			provenance: {
				...provenance(`powers/${name}`),
				baseDigest: digest ?? "sha256:missing",
			},
		}),
	});
}

/**
 * Build the upstream (Theirs) artifact. It deliberately sets DIFFERENT
 * curation-owned values so that any Curation_Loss would be observable, and it
 * carries provenance so it pairs with Ours by source path.
 */
function makeTheirs(name: string, body: string): KnowledgeArtifact {
	return makeArtifact({
		name,
		body,
		frontmatter: makeFrontmatter({
			name,
			trust: "community",
			categories: ["security"] satisfies Category[],
			collections: ["upstream-collection"],
			provenance: provenance(`powers/${name}`),
		}),
	});
}

/** A loader that resolves each artifact's base from a name → base map. */
function mapLoader(
	bases: ReadonlyMap<string, KnowledgeArtifact>,
): BaseArtifactLoader {
	return (ours) => bases.get(ours.name);
}

/** Assert every curation-owned field on a reconciled artifact still equals Ours. */
function expectNoCurationLoss(artifact: KnowledgeArtifact): void {
	expect(artifact.frontmatter.trust).toBe(CURATION.trust);
	expect(artifact.frontmatter.categories).toEqual([...CURATION.categories]);
	expect(artifact.frontmatter.collections).toEqual([...CURATION.collections]);
}

/**
 * Assemble the full six-scenario fixture set as a single upstream reconcile
 * pass. Returns the orchestration result plus the base map used.
 */
async function runFixtureScenarios() {
	// clean: upstream-owned body identical across base and theirs.
	const cleanBase = makeBase("clean", "# body v1");
	const cleanOurs = makeOurs("clean", "# body v1", cleanBase);
	const cleanTheirs = makeTheirs("clean", "# body v1");

	// fast-forward: base == ours body; theirs changed the body.
	const ffBase = makeBase("fast-forward", "# body v1");
	const ffOurs = makeOurs("fast-forward", "# body v1", ffBase);
	const ffTheirs = makeTheirs("fast-forward", "# body v2 upstream");

	// conflict: base body differs from BOTH ours and theirs.
	const conflictBase = makeBase("conflict", "# body v1");
	const conflictOurs = makeOurs("conflict", "# body ours edit", conflictBase);
	const conflictTheirs = makeTheirs("conflict", "# body theirs edit");

	// orphaned: curated + provenanced, but no matching theirs.
	const orphanBase = makeBase("orphaned", "# body v1");
	const orphanOurs = makeOurs("orphaned", "# body v1", orphanBase);

	// new: fresh upstream artifact with no ours counterpart.
	const newTheirs = makeTheirs("new-upstream", "# fresh body");

	// no-base: base cache misses (loader returns undefined) and bodies differ →
	// reduced-confidence conflict that keeps ours.
	const noBaseOurs = makeOurs(
		"no-base",
		"# body ours",
		makeBase("no-base", "# body v1"),
	);
	const noBaseTheirs = makeTheirs("no-base", "# body theirs");

	const bases = new Map<string, KnowledgeArtifact>([
		["clean", cleanBase],
		["fast-forward", ffBase],
		["conflict", conflictBase],
		["orphaned", orphanBase],
		// "no-base" intentionally omitted → cache miss.
	]);

	const result = await reconcileUpstreams([
		{
			upstream: UPSTREAM,
			ours: [cleanOurs, ffOurs, conflictOurs, orphanOurs, noBaseOurs],
			theirs: [cleanTheirs, ffTheirs, conflictTheirs, newTheirs, noBaseTheirs],
			loadBase: mapLoader(bases),
		},
	]);

	return result;
}

describe("reconcile fixtures — per-scenario outcomes (Req 18.15)", () => {
	test("each scenario is classified with its expected outcome", async () => {
		const result = await runFixtureScenarios();

		const outcomeByName = new Map<string, ReconciliationOutcome>();
		for (const entry of result.report.entries) {
			outcomeByName.set(entry.artifactName, entry.result.outcome);
		}

		expect(outcomeByName.get("clean")).toBe<ReconciliationOutcome>("clean");
		expect(outcomeByName.get("fast-forward")).toBe<ReconciliationOutcome>(
			"fast-forward",
		);
		expect(outcomeByName.get("conflict")).toBe<ReconciliationOutcome>(
			"conflict",
		);
		expect(outcomeByName.get("orphaned")).toBe<ReconciliationOutcome>(
			"orphaned",
		);
		expect(outcomeByName.get("new-upstream")).toBe<ReconciliationOutcome>(
			"new",
		);
		// no-base bodies differ with no ancestor → reduced-confidence conflict.
		expect(outcomeByName.get("no-base")).toBe<ReconciliationOutcome>(
			"conflict",
		);
	});

	test("the report is ordered by outcome, then upstream, then artifact name", async () => {
		const result = await runFixtureScenarios();
		const order = result.report.entries.map(
			(e) => `${e.result.outcome}:${e.artifactName}`,
		);

		// conflict entries first (alphabetical by name), then fast-forward, then
		// new, then orphaned, then clean.
		expect(order).toEqual([
			"conflict:conflict",
			"conflict:no-base",
			"fast-forward:fast-forward",
			"new:new-upstream",
			"orphaned:orphaned",
			"clean:clean",
		]);
	});

	test("conflict entries surface the conflicting field in the report", async () => {
		const result = await runFixtureScenarios();
		const conflictEntry = result.report.entries.find(
			(e) => e.artifactName === "conflict",
		);
		const conflictFields = conflictEntry?.result.diagnostics
			.filter((d) => d.outcome === "conflict")
			.map((d) => d.field);
		expect(conflictFields).toContain("body");
	});
});

describe("reconcile fixtures — NO Curation_Loss in any scenario (Req 18.6)", () => {
	test("every reconciled Ours artifact preserves its curation-owned fields", async () => {
		const result = await runFixtureScenarios();

		// The four provenanced Ours artifacts that pair with a base (clean,
		// fast-forward, conflict, no-base) plus the orphaned one must all keep
		// their curation-owned fields. `new-upstream` has no curation to preserve.
		const curatedNames = new Set([
			"clean",
			"fast-forward",
			"conflict",
			"orphaned",
			"no-base",
		]);

		for (const entry of result.report.entries) {
			if (!curatedNames.has(entry.artifactName)) continue;
			expectNoCurationLoss(entry.result.artifact);
		}
	});

	test("fast-forward applies the upstream body but never touches curation", async () => {
		const result = await runFixtureScenarios();
		const ff = result.report.entries.find(
			(e) => e.artifactName === "fast-forward",
		);
		// Upstream-owned body fast-forwarded to the new value...
		expect(ff?.result.artifact.body).toBe("# body v2 upstream");
		// ...while curation-owned fields are untouched.
		if (ff) expectNoCurationLoss(ff.result.artifact);
	});

	test("conflict keeps the curated body and curation-owned fields", async () => {
		const result = await runFixtureScenarios();
		const conflict = result.report.entries.find(
			(e) => e.artifactName === "conflict",
		);
		expect(conflict?.result.artifact.body).toBe("# body ours edit");
		if (conflict) expectNoCurationLoss(conflict.result.artifact);
	});

	test("no-base reduced-confidence path keeps Ours without a base", async () => {
		const result = await runFixtureScenarios();
		const noBase = result.report.entries.find(
			(e) => e.artifactName === "no-base",
		);
		expect(noBase?.result.artifact.body).toBe("# body ours");
		// A reduced-confidence diagnostic marks the path.
		const reduced = noBase?.result.diagnostics.some(
			(d) => d.confidence === "reduced",
		);
		expect(reduced).toBe(true);
		if (noBase) expectNoCurationLoss(noBase.result.artifact);
	});
});

describe("reconcile fixtures — plan production and determinism (Req 18.15)", () => {
	test("clean/fast-forward/conflict/no-base produce validated plans; orphaned/new do not", async () => {
		const result = await runFixtureScenarios();
		const planByName = new Map(
			result.reconciled.map((r) => [r.artifactName, r.plan]),
		);

		for (const name of ["clean", "fast-forward", "conflict", "no-base"]) {
			expect(planByName.get(name)).toBeDefined();
			expect(planByName.get(name)?.outputFiles.length).toBeGreaterThan(0);
		}
		// Orphaned and new carry no merged write.
		expect(planByName.get("orphaned")).toBeUndefined();
		expect(planByName.get("new-upstream")).toBeUndefined();
	});

	test("reconciling the same fixtures twice yields an identical report", async () => {
		const first = await runFixtureScenarios();
		const second = await runFixtureScenarios();
		expect(JSON.stringify(first.report)).toBe(JSON.stringify(second.report));
	});
});
