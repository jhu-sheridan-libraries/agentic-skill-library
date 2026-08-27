/**
 * Reconcile Orchestrator — the `reconcile` collision policy for the sync shell.
 *
 * This impure orchestration module sits between the sync shell and the pure
 * reconciliation core (`src/rosetta/reconcile.ts`, task 19.2) plus its digest
 * helpers (`src/rosetta/provenance-digest.ts`, task 19.3). It is the mechanical
 * replacement for the retired hand-maintained drift scripts (ADR-0049 /
 * ADR-RS-007).
 *
 * Responsibilities (Requirements 18.3, 18.9, 18.10, 18.15, 18.17):
 *  1. Derive the reconcile set from `ProvenanceRecord`s — NOT a hardcoded map.
 *     Only Ours artifacts that carry provenance participate in three-way
 *     reconciliation; provenance-less artifacts are excluded and left to the
 *     existing collision behavior (Requirement 18.17).
 *  2. Classify `orphaned` (a provenanced Ours artifact whose upstream source is
 *     no longer present, Requirement 18.9) and `new` (an acquired upstream
 *     artifact with no Ours counterpart by provenance identity,
 *     Requirement 18.10).
 *  3. For each provenanced collision, self-verify the recorded base against the
 *     reconstructed base (task 19.3), run the pure `reconcileArtifact`, then
 *     serialize the merged artifact through the EXISTING canonical serializer
 *     and plan validation path (`serializeCanonical` + `validatePlan`) so the
 *     result flows through the same validation, path checks, and application as
 *     any other write. This module never bypasses plan validation.
 *  4. Build a deterministic `ReconciliationReport` ordered by outcome, then
 *     upstream, then artifact name (Requirement 18.15), renderable as human
 *     text and versioned JSON by `reconcile-report-renderer.ts`.
 *
 * BOUNDARY: This module is impure by design — it is the orchestration shell, not
 * the pure core. It reconstructs the Base_Artifact by invoking a caller-supplied
 * loader (the base-cache read at `upstream/.kanon-base/<upstream>/<name>@<digest>`
 * is owned by task 19.4; this module only *reads through* the injected loader and
 * does not reimplement the write). The pure merge, digest, and self-verification
 * remain in `src/rosetta/`.
 *
 * Requirements: 18.3, 18.9, 18.10, 18.15, 18.17
 */

import {
	type CanonicalSerializerOptions,
	serializeCanonical,
} from "./rosetta/canonical";
import { codePointCompare } from "./rosetta/contracts";
import { validatePlan } from "./rosetta/plan";
import {
	readProvenance,
	selfVerifyReconcileInput,
} from "./rosetta/provenance-digest";
import { type ReconcileInput, reconcileArtifact } from "./rosetta/reconcile";
import type {
	FieldOwnershipPolicy,
	KnowledgeArtifact,
	ProvenanceRecord,
	ReconciliationDiagnostic,
	ReconciliationOutcome,
	ReconciliationReport,
	ReconciliationReportEntry,
	ReconciliationResult,
	TranslationDiagnostic,
	TranslationPlan,
} from "./schemas";
import { DEFAULT_FIELD_OWNERSHIP_POLICY } from "./schemas";

// ═══════════════════════════════════════════════════════════════════════════════
// Public inputs
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A loader that reconstructs the recorded Base_Artifact for a given Ours
 * artifact. The concrete cache read (git-ignored
 * `upstream/.kanon-base/<upstream>/<name>@<digest>`) is owned by task 19.4; this
 * module consumes whatever the loader returns. Returning `undefined` signals a
 * cache miss, which routes the artifact to the reduced-confidence two-way path
 * (Requirement 18.11). The loader MAY be async (it usually reads a file).
 */
export type BaseArtifactLoader = (
	ours: KnowledgeArtifact,
	provenance: ProvenanceRecord,
) => Promise<KnowledgeArtifact | undefined> | KnowledgeArtifact | undefined;

/**
 * Inputs to a single upstream's reconciliation pass.
 */
export interface ReconcileUpstreamOptions {
	/** The upstream identifier these artifacts belong to (report ordering key). */
	readonly upstream: string;
	/**
	 * The current curated artifacts in the canonical knowledge tree (Ours). Only
	 * those carrying a `ProvenanceRecord` for `upstream` participate; the rest are
	 * excluded (Requirement 18.17) and surfaced via `excludedArtifactNames`.
	 */
	readonly ours: readonly KnowledgeArtifact[];
	/**
	 * The freshly translated upstream artifacts (Theirs), keyed for identity by
	 * their provenance `sourcePath` when they carry one, otherwise by name.
	 */
	readonly theirs: readonly KnowledgeArtifact[];
	/** Per-upstream field-ownership policy; defaults to the documented default. */
	readonly policy?: FieldOwnershipPolicy;
	/** Reconstructs the recorded base for an Ours artifact (cache read, task 19.4). */
	readonly loadBase: BaseArtifactLoader;
	/** Serializer options; must match those used at import for digest stability. */
	readonly serializerOptions?: CanonicalSerializerOptions;
}

/**
 * The reconciliation of a single artifact plus the validated plan produced for
 * its merged result. `plan` is `undefined` for `orphaned` artifacts (nothing to
 * write) and when the merged artifact failed serialization/validation — in the
 * latter case `planDiagnostics` explains why.
 */
export interface ReconciledArtifact {
	/** Report identity: upstream and artifact name. */
	readonly upstream: string;
	readonly artifactName: string;
	/** The pure reconciliation result (merged artifact, outcome, diagnostics). */
	readonly result: ReconciliationResult;
	/** The validated canonical plan for the merged artifact, or undefined. */
	readonly plan: TranslationPlan | undefined;
	/** Diagnostics from serializing/validating the merged artifact's plan. */
	readonly planDiagnostics: readonly TranslationDiagnostic[];
}

/**
 * The full result of reconciling one or more upstreams: the deterministic
 * report, the per-artifact plans to apply, and the names of provenance-less
 * artifacts that were excluded from reconciliation (Requirement 18.17).
 */
export interface ReconcileOrchestrationResult {
	/** Deterministic report ordered by outcome, upstream, then artifact name. */
	readonly report: ReconciliationReport;
	/** Per-artifact reconciliations with their validated plans, in report order. */
	readonly reconciled: readonly ReconciledArtifact[];
	/** Names of Ours artifacts excluded because they carry no ProvenanceRecord. */
	readonly excludedArtifactNames: readonly string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Identity helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The identity of an artifact for reconciliation matching. Two artifacts are the
 * same distilled artifact when their provenance `sourcePath` matches for the
 * same upstream; when Theirs carries no provenance we fall back to matching on
 * artifact name so a freshly translated upstream artifact still pairs with its
 * curated counterpart.
 */
function oursIdentity(provenance: ProvenanceRecord): string {
	return provenance.sourcePath;
}

/**
 * Derive the identity key for a Theirs artifact. Prefer its provenance
 * `sourcePath` (set when the source translator recorded provenance), else the
 * artifact name — matching the `sourcePath` the Ours provenance recorded at
 * import for the same source subpath.
 */
function theirsIdentity(theirs: KnowledgeArtifact): string {
	const provenance = readProvenance(theirs);
	return provenance?.sourcePath ?? theirs.name;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Merged-artifact plan production (through the existing validation path)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Serialize a merged artifact through the existing canonical serializer and
 * validate the resulting plan through `validatePlan`. This deliberately reuses
 * the same path every other write uses so a reconciled artifact is subject to
 * identical schema, path, and collision validation (Requirement 18.3, design
 * "Boundary" note). Returns the validated plan (or undefined) plus diagnostics.
 */
function planForMergedArtifact(
	merged: KnowledgeArtifact,
	serializerOptions: CanonicalSerializerOptions | undefined,
): {
	plan: TranslationPlan | undefined;
	diagnostics: readonly TranslationDiagnostic[];
} {
	const { plan: serializedPlan, diagnostics: serializeDiagnostics } =
		serializeCanonical(merged, serializerOptions);

	if (!serializedPlan) {
		return { plan: undefined, diagnostics: serializeDiagnostics };
	}

	const validation = validatePlan(serializedPlan);
	const diagnostics: TranslationDiagnostic[] = [
		...serializeDiagnostics,
		...validation.diagnostics,
	];

	if (!validation.valid || !validation.plan) {
		return { plan: undefined, diagnostics };
	}

	return { plan: validation.plan, diagnostics };
}

// ═══════════════════════════════════════════════════════════════════════════════
// orphaned / new synthesis
// ═══════════════════════════════════════════════════════════════════════════════

const ORPHANED_CODE = "RS_RECONCILE_ORPHANED";
const NEW_CODE = "RS_RECONCILE_NEW";

/**
 * Build an `orphaned` reconciliation result for an Ours artifact whose recorded
 * upstream source is absent from the freshly acquired upstream. The artifact is
 * neither deleted nor overwritten (Requirement 18.9); Ours is preserved verbatim.
 */
function orphanedResult(ours: KnowledgeArtifact): ReconciliationResult {
	const diagnostic: ReconciliationDiagnostic = {
		code: ORPHANED_CODE,
		severity: "warning",
		phase: "source-translation",
		message: `Artifact "${ours.name}" carries provenance but its recorded upstream source is no longer present upstream; it was left untouched.`,
		remediation:
			"Confirm whether the upstream removed this artifact. If so, decide whether to retire the curated copy; nothing was changed automatically.",
		canonical: {
			artifactName: ours.name,
			fieldPath: "frontmatter.provenance",
		},
		unavailableDetails: [],
		blocking: false,
		field: "provenance",
		fieldClass: "machine-owned",
		outcome: "orphaned",
		baseValuePresent: false,
		confidence: "reduced",
	};
	return {
		artifact: ours,
		outcome: "orphaned",
		diagnostics: [diagnostic],
	};
}

/**
 * Build a `new` reconciliation result for an acquired upstream artifact with no
 * Ours counterpart by provenance identity (Requirement 18.10). Theirs is carried
 * as the artifact so a downstream import decision has the candidate to hand; no
 * curation exists to preserve.
 */
function newResult(theirs: KnowledgeArtifact): ReconciliationResult {
	const diagnostic: ReconciliationDiagnostic = {
		code: NEW_CODE,
		severity: "info",
		phase: "source-translation",
		message: `Upstream artifact "${theirs.name}" has no curated counterpart; it is new.`,
		remediation:
			"Import this artifact if it should be distilled into the curated tree.",
		canonical: {
			artifactName: theirs.name,
			fieldPath: "frontmatter.provenance",
		},
		unavailableDetails: [],
		blocking: false,
		field: "provenance",
		fieldClass: "machine-owned",
		outcome: "new",
		baseValuePresent: false,
		confidence: "reduced",
	};
	return {
		artifact: theirs,
		outcome: "new",
		diagnostics: [diagnostic],
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Deterministic report ordering
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Stable ordering of outcomes in the report. This is a fixed, documented order
 * (Requirement 18.15 requires ordering *by* outcome; the concrete precedence is
 * conflict-first so the most actionable rows surface at the top of a human
 * render, followed by the remaining outcomes in a stable sequence).
 */
const OUTCOME_ORDER: Record<ReconciliationOutcome, number> = {
	conflict: 0,
	merged: 1,
	"fast-forward": 2,
	new: 3,
	orphaned: 4,
	clean: 5,
};

/**
 * Sort report entries deterministically by outcome, then upstream, then artifact
 * name (Requirement 18.15). Independent of input order.
 */
function sortReportEntries(
	entries: readonly ReconciliationReportEntry[],
): ReconciliationReportEntry[] {
	return [...entries].sort((a, b) => {
		const outcomeCmp =
			OUTCOME_ORDER[a.result.outcome] - OUTCOME_ORDER[b.result.outcome];
		if (outcomeCmp !== 0) return outcomeCmp;
		const upstreamCmp = codePointCompare(a.upstream, b.upstream);
		if (upstreamCmp !== 0) return upstreamCmp;
		return codePointCompare(a.artifactName, b.artifactName);
	});
}

// ═══════════════════════════════════════════════════════════════════════════════
// Single-upstream reconciliation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Reconcile every provenanced Ours artifact for a single upstream against the
 * freshly translated Theirs artifacts, classifying orphaned/new and producing a
 * validated plan per merged artifact.
 *
 * @returns The per-artifact reconciliations and the excluded (provenance-less)
 *   artifact names for this upstream.
 */
export async function reconcileUpstream(
	options: ReconcileUpstreamOptions,
): Promise<{
	reconciled: ReconciledArtifact[];
	excludedArtifactNames: string[];
}> {
	const {
		upstream,
		ours,
		theirs,
		loadBase,
		serializerOptions,
		policy = DEFAULT_FIELD_OWNERSHIP_POLICY,
	} = options;

	const reconciled: ReconciledArtifact[] = [];
	const excludedArtifactNames: string[] = [];

	// Index Theirs by identity so each Ours can find its counterpart and so we
	// can report leftover Theirs as `new`.
	const theirsByIdentity = new Map<string, KnowledgeArtifact>();
	for (const t of theirs) {
		theirsByIdentity.set(theirsIdentity(t), t);
	}
	const matchedTheirsIdentities = new Set<string>();

	// Deterministic iteration over Ours by name so async base loads run in a
	// stable order and the result list is stable before the final report sort.
	const sortedOurs = [...ours].sort((a, b) => codePointCompare(a.name, b.name));

	for (const oursArtifact of sortedOurs) {
		const provenance = readProvenance(oursArtifact);

		// Provenance-less artifacts are excluded from reconciliation entirely
		// (Requirement 18.17) — the sync shell falls back to existing collision
		// behavior for them.
		if (!provenance || provenance.upstream !== upstream) {
			if (!provenance) {
				excludedArtifactNames.push(oursArtifact.name);
			}
			continue;
		}

		const identity = oursIdentity(provenance);
		const theirsArtifact = theirsByIdentity.get(identity);

		if (!theirsArtifact) {
			// Recorded upstream source is gone → orphaned (Requirement 18.9).
			const result = orphanedResult(oursArtifact);
			reconciled.push({
				upstream,
				artifactName: oursArtifact.name,
				result,
				plan: undefined,
				planDiagnostics: [],
			});
			continue;
		}

		matchedTheirsIdentities.add(identity);

		// Reconstruct the recorded base (cache read owned by task 19.4). A miss
		// leaves `base` undefined so the pure core degrades to the two-way path.
		const base = await loadBase(oursArtifact, provenance);

		// Self-verify the recorded base against Ours; a hand-edited provenance
		// forces the reduced-confidence path (Requirement 18.16). When there is no
		// base to check the request is unchanged.
		const baseInput: ReconcileInput = {
			base,
			ours: oursArtifact,
			theirs: theirsArtifact,
			policy,
		};
		const { input } = selfVerifyReconcileInput(baseInput, serializerOptions);

		const result = reconcileArtifact(input);

		// Serialize + validate the merged artifact through the EXISTING path.
		// Orphaned/clean artifacts still produce a plan (identical bytes for a
		// clean outcome), which the applier's reconcile policy will no-op or
		// overwrite as appropriate; conflicts still apply non-conflicting fields.
		const { plan, diagnostics: planDiagnostics } = planForMergedArtifact(
			result.artifact,
			serializerOptions,
		);

		reconciled.push({
			upstream,
			artifactName: oursArtifact.name,
			result,
			plan,
			planDiagnostics,
		});
	}

	// Any Theirs identity never matched by an Ours provenance is `new`
	// (Requirement 18.10). Sorted for determinism.
	const unmatched = [...theirsByIdentity.entries()]
		.filter(([identity]) => !matchedTheirsIdentities.has(identity))
		.map(([, artifact]) => artifact)
		.sort((a, b) => codePointCompare(a.name, b.name));

	for (const theirsArtifact of unmatched) {
		reconciled.push({
			upstream,
			artifactName: theirsArtifact.name,
			result: newResult(theirsArtifact),
			plan: undefined,
			planDiagnostics: [],
		});
	}

	return { reconciled, excludedArtifactNames };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Multi-upstream orchestration + report assembly
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Reconcile one or more upstreams and assemble the deterministic
 * `ReconciliationReport`.
 *
 * The reconcile set is derived entirely from `ProvenanceRecord`s (Requirement
 * 18.9–18.10): it can never silently miss a newly distilled artifact and it
 * surfaces orphans and new upstream artifacts. Provenance-less artifacts are
 * excluded (Requirement 18.17).
 *
 * @param upstreams One `ReconcileUpstreamOptions` per upstream to reconcile.
 * @returns The report, per-artifact validated plans, and excluded artifact names.
 */
export async function reconcileUpstreams(
	upstreams: readonly ReconcileUpstreamOptions[],
): Promise<ReconcileOrchestrationResult> {
	const allReconciled: ReconciledArtifact[] = [];
	const allExcluded: string[] = [];

	// Iterate upstreams deterministically by identifier.
	const sortedUpstreams = [...upstreams].sort((a, b) =>
		codePointCompare(a.upstream, b.upstream),
	);

	for (const upstreamOptions of sortedUpstreams) {
		const { reconciled, excludedArtifactNames } =
			await reconcileUpstream(upstreamOptions);
		allReconciled.push(...reconciled);
		allExcluded.push(...excludedArtifactNames);
	}

	const entries: ReconciliationReportEntry[] = allReconciled.map((r) => ({
		upstream: r.upstream,
		artifactName: r.artifactName,
		result: r.result,
	}));

	const sortedEntries = sortReportEntries(entries);

	// Reorder the reconciled list to match the report ordering so callers that
	// apply plans in report order see a consistent sequence.
	const orderIndex = new Map<string, number>();
	sortedEntries.forEach((entry, index) => {
		orderIndex.set(`${entry.upstream}\u0000${entry.artifactName}`, index);
	});
	const orderedReconciled = [...allReconciled].sort((a, b) => {
		const keyA = orderIndex.get(`${a.upstream}\u0000${a.artifactName}`) ?? 0;
		const keyB = orderIndex.get(`${b.upstream}\u0000${b.artifactName}`) ?? 0;
		return keyA - keyB;
	});

	const report: ReconciliationReport = {
		machineSchemaVersion: "1.0",
		entries: sortedEntries,
	};

	return {
		report,
		reconciled: orderedReconciled,
		excludedArtifactNames: [...allExcluded].sort(codePointCompare),
	};
}
