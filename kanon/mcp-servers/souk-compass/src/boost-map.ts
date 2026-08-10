/**
 * Path-based search-result score boosting.
 *
 * Matching boost patterns are resolved by literal-character specificity, with
 * later configuration entries winning equal-specificity ties.
 */
import { matchGlob } from "./file-scanner.js";
import type { BoostEntry } from "./root-config.js";

interface SearchResult {
	path: string;
	score: number;
	[key: string]: unknown;
}

interface IndexedSearchResult {
	result: SearchResult;
	originalIndex: number;
}

/**
 * Count literal characters in a glob pattern.
 *
 * Glob wildcard characters (`*` and `?`) do not contribute to specificity.
 */
export function patternSpecificity(pattern: string): number {
	return [...pattern].filter(
		(character: string): boolean => character !== "*" && character !== "?",
	).length;
}

/**
 * Apply the most-specific matching boost to each result and sort by the
 * resulting score descending. Results with equal boosted scores retain their
 * original relative order.
 */
export function applyBoostMap(
	results: SearchResult[],
	boostMap: BoostEntry[],
): SearchResult[] {
	const boostedResults: IndexedSearchResult[] = results.map(
		(result: SearchResult, originalIndex: number): IndexedSearchResult => {
			let selectedBoost = 1;
			let highestSpecificity = -1;

			boostMap.forEach((entry: BoostEntry): void => {
				if (!matchGlob(entry.pattern, result.path)) return;

				const specificity = patternSpecificity(entry.pattern);
				if (specificity >= highestSpecificity) {
					highestSpecificity = specificity;
					selectedBoost = entry.boost;
				}
			});

			return {
				originalIndex,
				result: {
					...result,
					score: result.score * selectedBoost,
				},
			};
		},
	);

	return boostedResults
		.sort(
			(left: IndexedSearchResult, right: IndexedSearchResult): number =>
				right.result.score - left.result.score ||
				left.originalIndex - right.originalIndex,
		)
		.map(({ result }: IndexedSearchResult): SearchResult => result);
}
