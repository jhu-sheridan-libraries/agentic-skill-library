/**
 * Rosetta Stone — Pure Base_Digest Computation and Provenance Self-Verification
 *
 * Layers digest computation and provenance self-verification ON TOP of the pure
 * reconciliation core (`reconcile.ts`, task 19.2). The reconciliation core
 * deliberately computes no digests; this module supplies the two machine-owned
 * operations that recorded-base three-way reconciliation depends on (ADR-0049 /
 * ADR-RS-007):
 *
 * 1. `computeBaseDigest` — the deterministic `sha256` fingerprint of the
 *    normalized Theirs_Artifact, reusing the Canonical_Serializer's ordering
 *    from `canonical.ts` so the digest is stable across machines
 *    (Requirement 18.2). It hashes the exact canonical byte plan the serializer
 *    produces; it does NOT invent a new serialization.
 *
 * 2. `verifyProvenanceBase` / `selfVerifyReconcileInput` — given an
 *    Ours_Artifact carrying a `ProvenanceRecord` (with its recorded
 *    `baseDigest`) and the reconstructed candidate Base_Artifact, recompute the
 *    candidate's digest and compare. A mismatch means the artifact was
 *    hand-edited such that its provenance no longer matches the recorded base,
 *    so reconciliation is routed to the reduced-confidence two-way path
 *    (`baseUnverified: true`) with a warning diagnostic (Requirement 18.16).
 *
 * BOUNDARY (Pure_Translation_Boundary): This module is a pure function of its
 * inputs. It performs NO filesystem, subprocess, network, `process`, clock,
 * random, or Git access. `sha256` is computed with Node's `node:crypto`
 * `createHash`, which is a synchronous, pure computation over in-memory bytes —
 * it is explicitly permitted by the architecture-boundary test's allowlist
 * (`rosetta-architecture-boundary.test.ts`), which forbids fs/subprocess/
 * network/process/prompt/FileSystemLoader access but not `node:crypto`. The
 * base-artifact cache, its IO, and Git access remain in the orchestration shell
 * (ADR-0049): this module only turns an in-memory artifact into a digest and
 * compares digests.
 *
 * Requirements: 18.2, 18.16
 */

import { createHash } from "node:crypto";
import type {
	KnowledgeArtifact,
	ProvenanceRecord,
	ReconciliationDiagnostic,
	TranslationDiagnostic,
} from "../schemas";
import {
	type CanonicalSerializerOptions,
	serializeCanonical,
} from "./canonical";
import type { ReconcileInput } from "./reconcile";

// ═══════════════════════════════════════════════════════════════════════════════
// Base_Digest computation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The digest algorithm prefix. Recorded `baseDigest` values are namespaced with
 * the algorithm so a future migration to a different digest can be detected
 * rather than silently compared against the wrong scheme (matches the
 * `sha256:…` shape shown in ADR-0049).
 */
const DIGEST_ALGORITHM = "sha256" as const;

/** NUL separator between the path and content of each serialized output file. */
const FIELD_SEPARATOR = "\u0000";
/** NUL separator between successive serialized output files. */
const RECORD_SEPARATOR = "\u0000\u0000";

/**
 * The outcome of a Base_Digest computation. When serialization of the artifact
 * fails (an invalid artifact), no digest can be produced and the serializer's
 * diagnostics are surfaced so the caller can decide how to degrade.
 */
export interface BaseDigestResult {
	/** The `sha256:<hex>` digest, or undefined when serialization failed. */
	readonly digest: string | undefined;
	/** Serializer diagnostics (empty on success). */
	readonly diagnostics: readonly TranslationDiagnostic[];
}

/**
 * Fold the deterministic canonical byte plan of an artifact into a stable byte
 * sequence for hashing. The Canonical_Serializer already sorts its output files
 * deterministically (by normalized path, code-point order) and renders each
 * file's bytes deterministically, so hashing `path \0 content \0\0` per file in
 * plan order is itself deterministic and reuses the serializer's ordering
 * rather than introducing a new one.
 */
function foldPlanToBytes(
	outputFiles: readonly {
		readonly relativePath: string;
		readonly content: string | Uint8Array;
	}[],
): Uint8Array {
	const encoder = new TextEncoder();
	const chunks: Uint8Array[] = [];
	for (const file of outputFiles) {
		chunks.push(encoder.encode(file.relativePath));
		chunks.push(encoder.encode(FIELD_SEPARATOR));
		chunks.push(
			typeof file.content === "string"
				? encoder.encode(file.content)
				: file.content,
		);
		chunks.push(encoder.encode(RECORD_SEPARATOR));
	}

	let total = 0;
	for (const chunk of chunks) {
		total += chunk.length;
	}
	const combined = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		combined.set(chunk, offset);
		offset += chunk.length;
	}
	return combined;
}

/**
 * Compute the Base_Digest of an already-translated Theirs_Artifact.
 *
 * The digest is `sha256` over the deterministically serialized artifact,
 * reusing the Canonical_Serializer ordering (Requirement 18.2). Identical
 * artifacts (Canonically_Equivalent) yield an identical digest regardless of
 * frontmatter key insertion order, because the serializer canonicalizes key
 * order before rendering.
 *
 * Pure: depends only on `artifact` (and optional serializer options) and
 * performs no IO. Returns `undefined` with diagnostics when the artifact cannot
 * be serialized.
 *
 * @param artifact The normalized Theirs_Artifact to fingerprint.
 * @param options Optional serializer options; defaults match the serializer.
 * @returns The `sha256:<hex>` digest plus any serializer diagnostics.
 */
export function computeBaseDigest(
	artifact: KnowledgeArtifact,
	options?: CanonicalSerializerOptions,
): BaseDigestResult {
	const { plan, diagnostics } = serializeCanonical(artifact, options);
	if (!plan) {
		return {
			digest: undefined,
			diagnostics,
		};
	}

	const bytes = foldPlanToBytes(plan.outputFiles);
	const hex = createHash(DIGEST_ALGORITHM).update(bytes).digest("hex");
	return { digest: `${DIGEST_ALGORITHM}:${hex}`, diagnostics: [] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Provenance self-verification
// ═══════════════════════════════════════════════════════════════════════════════

const SELF_VERIFY_MISMATCH_CODE = "RS_RECONCILE_PROVENANCE_UNVERIFIED";
const SELF_VERIFY_MISMATCH_REMEDIATION =
	"The recorded provenance base digest does not match the reconstructed base. " +
	"Re-import the artifact to refresh its provenance, or resolve fields manually; " +
	"reconciliation used the reduced-confidence two-way path.";

/**
 * The outcome of a provenance self-verification check.
 */
export interface ProvenanceVerification {
	/**
	 * True when the recorded provenance base could be verified against the
	 * candidate Base_Artifact (the recorded digest equals the recomputed digest).
	 * When false, callers MUST treat any candidate base as untrustworthy and run
	 * the reduced-confidence two-way path (Requirement 18.16).
	 */
	readonly verified: boolean;
	/** The recorded digest read from the ProvenanceRecord, if present. */
	readonly recordedDigest: string | undefined;
	/** The digest recomputed from the candidate Base_Artifact, if computable. */
	readonly recomputedDigest: string | undefined;
	/** A warning diagnostic when verification failed; undefined when verified. */
	readonly diagnostic: ReconciliationDiagnostic | undefined;
}

/**
 * Build the warning diagnostic emitted when self-verification fails
 * (Requirement 18.16).
 */
function buildUnverifiedDiagnostic(
	artifactName: string,
): ReconciliationDiagnostic {
	return {
		code: SELF_VERIFY_MISMATCH_CODE,
		severity: "warning",
		phase: "source-translation",
		message:
			"The recorded provenance base failed self-verification (its Base_Digest " +
			"does not match the reconstructed base); the artifact appears to have been " +
			"hand-edited. Reconciliation used the reduced-confidence two-way path.",
		remediation: SELF_VERIFY_MISMATCH_REMEDIATION,
		canonical: {
			artifactName,
			fieldPath: "frontmatter.provenance",
		},
		unavailableDetails: [],
		blocking: false,
		field: "provenance",
		fieldClass: "machine-owned",
		outcome: "conflict",
		baseValuePresent: false,
		confidence: "reduced",
	};
}

/**
 * Read the ProvenanceRecord from an artifact's canonical frontmatter, if any.
 * Artifacts authored from scratch carry no provenance (Requirement 18.17) and
 * yield `undefined`.
 */
export function readProvenance(
	artifact: KnowledgeArtifact,
): ProvenanceRecord | undefined {
	return artifact.frontmatter.provenance;
}

/**
 * Self-verify an Ours_Artifact's recorded provenance base against a candidate
 * Base_Artifact.
 *
 * Recomputes the Base_Digest of `candidateBase` (Requirement 18.2) and compares
 * it to the digest recorded in `ours.frontmatter.provenance.baseDigest`. The
 * check is:
 *
 * - `verified: true` only when a ProvenanceRecord is present, a candidate base
 *   is supplied, the candidate serializes cleanly, and the recomputed digest
 *   equals the recorded digest.
 * - `verified: false` (with a warning diagnostic) when the digests differ — the
 *   hand-edited-provenance case (Requirement 18.16).
 * - `verified: false` (no diagnostic) when there is nothing to verify against
 *   (no provenance record, or no candidate base to reconstruct from). This is
 *   not a hand-edit; it is the plain missing-base case the reconciliation core
 *   already handles by treating `base` as absent, so no extra warning is added
 *   here.
 *
 * Pure: no IO. The candidate base reconstruction (cache read, Git) is the
 * orchestrator's responsibility; this function only compares in-memory digests.
 *
 * @param ours The current curated artifact carrying the recorded provenance.
 * @param candidateBase The reconstructed Base_Artifact, or undefined on cache miss.
 * @param options Optional serializer options (must match those used at import).
 * @returns A ProvenanceVerification describing whether the base can be trusted.
 */
export function verifyProvenanceBase(
	ours: KnowledgeArtifact,
	candidateBase: KnowledgeArtifact | undefined,
	options?: CanonicalSerializerOptions,
): ProvenanceVerification {
	const provenance = readProvenance(ours);
	const recordedDigest = provenance?.baseDigest;

	// Nothing to verify: no recorded provenance or no candidate base to check
	// against. The reconciliation core treats this as an absent/untrusted base
	// on its own; do not manufacture a hand-edit warning.
	if (recordedDigest === undefined || candidateBase === undefined) {
		return {
			verified: false,
			recordedDigest,
			recomputedDigest: undefined,
			diagnostic: undefined,
		};
	}

	const { digest: recomputedDigest } = computeBaseDigest(
		candidateBase,
		options,
	);

	// The candidate base could not be serialized — treat as unverifiable rather
	// than as a hand-edit; the core degrades via the untrusted-base path.
	if (recomputedDigest === undefined) {
		return {
			verified: false,
			recordedDigest,
			recomputedDigest: undefined,
			diagnostic: undefined,
		};
	}

	if (recomputedDigest === recordedDigest) {
		return {
			verified: true,
			recordedDigest,
			recomputedDigest,
			diagnostic: undefined,
		};
	}

	// Digests diverge: the artifact was hand-edited such that its provenance no
	// longer matches the reconstructed base (Requirement 18.16).
	return {
		verified: false,
		recordedDigest,
		recomputedDigest,
		diagnostic: buildUnverifiedDiagnostic(ours.name),
	};
}

/**
 * The result of preparing a reconciliation input with provenance
 * self-verification applied.
 */
export interface SelfVerifiedReconcileInput {
	/**
	 * A ReconcileInput ready to pass to `reconcileArtifact`. When
	 * self-verification failed for a supplied candidate base, `baseUnverified`
	 * is forced to `true` so the core runs the reduced-confidence two-way path.
	 */
	readonly input: ReconcileInput;
	/** The verification outcome that produced this input. */
	readonly verification: ProvenanceVerification;
	/**
	 * A warning diagnostic to surface alongside reconciliation when
	 * self-verification failed; undefined otherwise. The reconciliation core
	 * itself also emits its own reduced-confidence artifact-level diagnostic when
	 * `baseUnverified` is set, so callers that pass this input straight through
	 * do not need to merge this diagnostic; it is exposed for callers that verify
	 * without immediately reconciling.
	 */
	readonly diagnostic: ReconciliationDiagnostic | undefined;
}

/**
 * Layer provenance self-verification on top of a would-be reconciliation input.
 *
 * Given Base (a reconstructed candidate), Ours, Theirs, and a policy, this
 * recomputes and verifies Ours's recorded Base_Digest against the candidate
 * base. If verification fails (hand-edited provenance), it returns a
 * ReconcileInput with `baseUnverified: true` so `reconcileArtifact` degrades to
 * the reduced-confidence two-way path (Requirement 18.16). When verification
 * succeeds — or when there is simply no provenance/base to check — the input is
 * returned with `baseUnverified` reflecting the original request.
 *
 * Pure: no IO. Composes `verifyProvenanceBase` with the caller's request shape.
 *
 * @param input The three-way reconciliation request (Base optional).
 * @param options Optional serializer options for digest recomputation.
 * @returns The (possibly downgraded) ReconcileInput plus the verification.
 */
export function selfVerifyReconcileInput(
	input: ReconcileInput,
	options?: CanonicalSerializerOptions,
): SelfVerifiedReconcileInput {
	const verification = verifyProvenanceBase(input.ours, input.base, options);

	// Only downgrade when there is a genuine, verifiable mismatch (a diagnostic
	// was produced). The missing-provenance / missing-base cases leave the
	// caller's original signal untouched.
	if (verification.diagnostic !== undefined) {
		return {
			input: { ...input, baseUnverified: true },
			verification,
			diagnostic: verification.diagnostic,
		};
	}

	return {
		input,
		verification,
		diagnostic: undefined,
	};
}
