/**
 * Outcomes registry — pure aggregation + registry check.
 *
 * This module is the single deterministic entry point for the outcomes
 * registry (Requirement 2F). It flattens outcomes declared across a set of
 * artifacts into attributed references, then runs duplicate-id detection
 * followed by pairwise two-tier collision detection over those references.
 *
 * Everything here is pure, deterministic, and free of I/O or shared state, so
 * the cross-artifact comparison logic can be verified exhaustively with
 * property-based tests. The same `runRegistryCheck` function backs both
 * `forge validate` (cross-artifact) and `forge guild sync` (manifest-resolved
 * artifacts); only the surrounding I/O and exit-code policy differ.
 *
 * Detection order and policy:
 *   1. Duplicate ids first — outcome ids are globally unique (Req 2F.4); any
 *      repeated id yields a `duplicate-id` finding (an error).
 *   2. Each unordered pair is evaluated exactly once via `computeVerdict`:
 *        - COLLISION + mutually acknowledged (`related`) -> `acknowledged-overlap`
 *          (Req 2E.4) — not an error.
 *        - COLLISION non-acknowledged -> `collision` (error), with both
 *          normalized shapes and the keyword Jaccard score attached (Req 2F.2).
 *        - AMBIGUOUS -> `ambiguous` (warning only).
 *        - CLEAN -> no finding.
 *
 * `hasErrors` is true when any `collision` or `duplicate-id` finding exists.
 *
 * See ADR-0041 for the architectural rationale.
 */

import type { Outcome } from "../schemas";
import {
	computeVerdict,
	DEFAULT_KEYWORD_THRESHOLD,
	isAcknowledged,
	jaccardSimilarity,
	tokenizeKeywords,
} from "./collision";
import { normalizeShape } from "./normalize";

/** A single outcome paired with the name of the artifact that declared it. */
export interface OutcomeRef {
	outcome: Outcome;
	artifactName: string;
}

/** The kinds of finding the registry check can produce. */
export type CollisionKind =
	| "collision"
	| "ambiguous"
	| "duplicate-id"
	| "acknowledged-overlap";

/**
 * A finding about a pair of outcome references. `collision` and `duplicate-id`
 * are errors; `ambiguous` is a warning; `acknowledged-overlap` is informational.
 * The normalized shapes and Jaccard score are attached for `collision` and
 * `ambiguous` findings to support actionable diagnostics (Req 2F.2).
 */
export interface CollisionFinding {
	kind: CollisionKind;
	a: OutcomeRef;
	b: OutcomeRef;
	/** Normalized input shape, for collision/ambiguous findings. */
	inputShape?: string;
	/** Normalized output shape, for collision/ambiguous findings. */
	outputShape?: string;
	/** Keyword Jaccard similarity, for collision/ambiguous findings. */
	jaccard?: number;
}

/** The outcome of a full registry check over a set of outcome references. */
export interface RegistryReport {
	findings: CollisionFinding[];
	/** True when any non-acknowledged collision or duplicate id was found. */
	hasErrors: boolean;
}

/**
 * Flatten the outcomes declared by a set of artifacts into attributed
 * references (Req 2F.1 / 2G.1). Preserves artifact order and, within each
 * artifact, outcome declaration order. Pure.
 */
export function aggregateOutcomes(
	artifacts: Array<{ name: string; outcomes: Outcome[] }>,
): OutcomeRef[] {
	const refs: OutcomeRef[] = [];
	for (const artifact of artifacts) {
		for (const outcome of artifact.outcomes) {
			refs.push({ outcome, artifactName: artifact.name });
		}
	}
	return refs;
}

/** Keyword Jaccard score between two outcomes (mirrors Tier-2 input). */
function keywordJaccard(a: Outcome, b: Outcome): number {
	return jaccardSimilarity(
		tokenizeKeywords(a.keywords),
		tokenizeKeywords(b.keywords),
	);
}

/**
 * Run duplicate-id detection and pairwise collision detection over all refs.
 * Pure and deterministic (Req 2F). Duplicate ids are detected first (globally
 * unique ids, Req 2F.4); then each unordered pair is evaluated exactly once.
 *
 * @param refs       attributed outcome references (see `aggregateOutcomes`).
 * @param threshold  Tier-2 keyword Jaccard threshold (default 0.4).
 */
export function runRegistryCheck(
	refs: OutcomeRef[],
	threshold: number = DEFAULT_KEYWORD_THRESHOLD,
): RegistryReport {
	const findings: CollisionFinding[] = [];
	let hasErrors = false;

	// (1) Duplicate-id detection first (Req 2F.4). IDs are globally unique, so
	// any two refs sharing an id are reported as a duplicate-id error. Every
	// unordered pair of refs with the same id is reported once.
	for (let i = 0; i < refs.length; i++) {
		for (let j = i + 1; j < refs.length; j++) {
			if (refs[i].outcome.id === refs[j].outcome.id) {
				findings.push({ kind: "duplicate-id", a: refs[i], b: refs[j] });
				hasErrors = true;
			}
		}
	}

	// (2) Pairwise collision detection over each unordered pair, evaluated once.
	for (let i = 0; i < refs.length; i++) {
		for (let j = i + 1; j < refs.length; j++) {
			const a = refs[i].outcome;
			const b = refs[j].outcome;
			const verdict = computeVerdict(a, b, threshold);

			if (verdict === "COLLISION") {
				if (isAcknowledged(a, b)) {
					// Mutually acknowledged overlap is intentional (Req 2E.4) — not
					// an error.
					findings.push({
						kind: "acknowledged-overlap",
						a: refs[i],
						b: refs[j],
					});
				} else {
					findings.push({
						kind: "collision",
						a: refs[i],
						b: refs[j],
						inputShape: normalizeShape(a.inputShape),
						outputShape: normalizeShape(a.outputShape),
						jaccard: keywordJaccard(a, b),
					});
					hasErrors = true;
				}
			} else if (verdict === "AMBIGUOUS") {
				findings.push({
					kind: "ambiguous",
					a: refs[i],
					b: refs[j],
					inputShape: normalizeShape(a.inputShape),
					outputShape: normalizeShape(a.outputShape),
					jaccard: keywordJaccard(a, b),
				});
			}
			// CLEAN -> no finding.
		}
	}

	return { findings, hasErrors };
}
