/**
 * Outcomes registry — pure collision-detection primitives.
 *
 * These functions implement the two-tier collision-detection algorithm
 * (Requirement 2E) over the normalized representation produced by
 * `normalizeShape`. Every function here is pure, deterministic, and free of
 * I/O or shared state, so the subtle comparison logic can be verified
 * exhaustively with property-based tests.
 *
 *   - Tier-1: exact match on the normalized (inputShape, outputShape) tuple.
 *   - Tier-2: Jaccard similarity over tokenized keyword sets (>= threshold).
 *
 * The verdict matrix combines the two tiers: both -> COLLISION, exactly one ->
 * AMBIGUOUS, neither -> CLEAN. A COLLISION between two outcomes that each list
 * the other in `related` is treated as an acknowledged overlap by callers.
 *
 * See ADR-0041 for the architectural rationale.
 */

import type { Outcome } from "../schemas";
import { normalizeShape } from "./normalize";

/** The three possible collision-detection verdicts (Requirement 2E.3). */
export type Verdict = "COLLISION" | "AMBIGUOUS" | "CLEAN";

/** Default keyword Jaccard threshold for Tier-2 detection (Requirement 2E.2). */
export const DEFAULT_KEYWORD_THRESHOLD = 0.4;

/** Minimum token length to keep; tokens of this length or shorter are dropped. */
const MIN_TOKEN_LENGTH = 2;

/**
 * Tokenize a keyword set into a deduplicated set of tokens (Requirement 2E.2).
 *
 * Each keyword is split on hyphens, underscores, and whitespace. Tokens whose
 * length is `<= 2` characters are dropped, and the surviving tokens are
 * collected into a Set (deduplicating across the whole keyword array). Pure.
 */
export function tokenizeKeywords(keywords: string[]): Set<string> {
	const tokens = new Set<string>();
	for (const keyword of keywords) {
		for (const token of keyword.split(/[-_\s]+/)) {
			if (token.length > MIN_TOKEN_LENGTH) {
				tokens.add(token);
			}
		}
	}
	return tokens;
}

/**
 * Jaccard similarity between two token sets: |A∩B| / |A∪B| (Requirement 2E.2).
 *
 * Returns 0 when both sets are empty (the union is empty). The result is always
 * within the range [0, 1]. Pure and symmetric.
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
	if (a.size === 0 && b.size === 0) {
		return 0;
	}
	let intersection = 0;
	for (const token of a) {
		if (b.has(token)) {
			intersection++;
		}
	}
	const union = a.size + b.size - intersection;
	return union === 0 ? 0 : intersection / union;
}

/**
 * Tier-1 detection: exact match on the normalized (inputShape, outputShape)
 * tuple (Requirement 2E.1). Pure.
 */
export function shapesMatch(a: Outcome, b: Outcome): boolean {
	return (
		normalizeShape(a.inputShape) === normalizeShape(b.inputShape) &&
		normalizeShape(a.outputShape) === normalizeShape(b.outputShape)
	);
}

/**
 * Tier-2 detection: keyword Jaccard similarity meets or exceeds `threshold`
 * (default 0.4) (Requirement 2E.2). Pure.
 */
export function keywordsMatch(
	a: Outcome,
	b: Outcome,
	threshold: number = DEFAULT_KEYWORD_THRESHOLD,
): boolean {
	const similarity = jaccardSimilarity(
		tokenizeKeywords(a.keywords),
		tokenizeKeywords(b.keywords),
	);
	return similarity >= threshold;
}

/**
 * Compute the verdict from the two tiers (Requirement 2E.3):
 *   - both tiers match     -> COLLISION
 *   - exactly one matches   -> AMBIGUOUS
 *   - neither matches       -> CLEAN
 * Pure and symmetric in `a` and `b`.
 */
export function computeVerdict(
	a: Outcome,
	b: Outcome,
	threshold: number = DEFAULT_KEYWORD_THRESHOLD,
): Verdict {
	const tier1 = shapesMatch(a, b);
	const tier2 = keywordsMatch(a, b, threshold);
	if (tier1 && tier2) {
		return "COLLISION";
	}
	if (tier1 || tier2) {
		return "AMBIGUOUS";
	}
	return "CLEAN";
}

/**
 * True when `a` and `b` each list the other's id in their `related` field
 * (Requirement 2E.4 / 2B.2). A one-sided reference is not acknowledged. Pure.
 */
export function isAcknowledged(a: Outcome, b: Outcome): boolean {
	return a.related.includes(b.id) && b.related.includes(a.id);
}
