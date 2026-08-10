import { expect, test } from "bun:test";
import fc from "fast-check";
import { applyBoostMap } from "../boost-map.js";
import type { BoostEntry } from "../root-config.js";

interface GeneratedResult {
	id: number;
	isBoosted: boolean;
	score: number;
}

interface SearchResult {
	[key: string]: unknown;
	id: number;
	path: string;
	score: number;
}

interface SpecificityInput {
	baseScore: number;
	broadBoost: number;
	firstSpecificBoost: number;
	lastSpecificBoost: number;
	path: string;
}

const generatedResultsArbitrary: fc.Arbitrary<GeneratedResult[]> = fc.array(
	fc.record({
		isBoosted: fc.boolean(),
		score: fc.integer({ min: 0, max: 10_000 }),
	}),
	{ minLength: 1, maxLength: 50 },
).map(
	(results: Array<Omit<GeneratedResult, "id">>): GeneratedResult[] =>
		results.map(
			(result: Omit<GeneratedResult, "id">, id: number): GeneratedResult => ({
				...result,
				id,
			}),
		),
);

const specificityInputArbitrary: fc.Arbitrary<SpecificityInput> = fc
	.tuple(
		fc.constantFrom("src", "lib", "docs", "packages"),
		fc.constantFrom("api", "core", "search", "index"),
		fc.constantFrom("module", "handler", "service", "worker"),
		fc.integer({ min: 1, max: 10_000 }),
		fc.integer({ min: 1, max: 10 }),
		fc.integer({ min: 1, max: 10 }),
		fc.integer({ min: 1, max: 10 }),
	)
	.map(
		([
			rootDirectory,
			childDirectory,
			fileName,
			baseScore,
			broadBoost,
			firstSpecificBoost,
			lastSpecificBoost,
		]: [string, string, string, number, number, number, number]): SpecificityInput => ({
			baseScore,
			broadBoost,
			firstSpecificBoost,
			lastSpecificBoost,
			path: `${rootDirectory}/${childDirectory}/${fileName}.ts`,
		}),
	);

function toSearchResults(results: readonly GeneratedResult[]): SearchResult[] {
	return results.map(
		(result: GeneratedResult): SearchResult => ({
			id: result.id,
			path: `${result.isBoosted ? "boosted" : "unboosted"}/${result.id}.ts`,
			score: result.score,
		}),
	);
}

function expectedGroupOrder(
	results: readonly GeneratedResult[],
	isBoosted: boolean,
): number[] {
	return results
		.filter(
			(result: GeneratedResult): boolean => result.isBoosted === isBoosted,
		)
		.map(
			(result: GeneratedResult, originalIndex: number): {
				originalIndex: number;
				result: GeneratedResult;
			} => ({ originalIndex, result }),
		)
		.sort(
			(
				left: { originalIndex: number; result: GeneratedResult },
				right: { originalIndex: number; result: GeneratedResult },
			): number =>
				right.result.score - left.result.score ||
				left.originalIndex - right.originalIndex,
		)
		.map(({ result }: { result: GeneratedResult }): number => result.id);
}

function actualGroupOrder(
	results: ReadonlyArray<{
		[key: string]: unknown;
		path: string;
		score: number;
	}>,
	isBoosted: boolean,
): number[] {
	const pathPrefix = isBoosted ? "boosted/" : "unboosted/";
	return results
		.filter(
			(result: { path: string; score: number }): boolean =>
				result.path.startsWith(pathPrefix),
		)
		.map((result: { [key: string]: unknown }): number => {
			const id = result["id"];
			if (typeof id !== "number") {
				throw new Error("Expected boost-map to retain result IDs");
			}
			return id;
		});
}

// Feature: indexing-improvements, Property 5: Boost map application preserves relative ordering within same boost
// **Validates: Requirements 6.1, 6.3, 6.4**
test("Property 5: identical and absent boosts preserve each group's score ordering", (): void => {
	fc.assert(
		fc.property(
			generatedResultsArbitrary,
			fc.integer({ min: 1, max: 10 }),
			(
				generatedResults: GeneratedResult[],
				boost: number,
			): void => {
				const boostMap: BoostEntry[] = [{ pattern: "boosted/**", boost }];
				const boostedResults = applyBoostMap(
					toSearchResults(generatedResults),
					boostMap,
				);

				expect(actualGroupOrder(boostedResults, true)).toEqual(
					expectedGroupOrder(generatedResults, true),
				);
				expect(actualGroupOrder(boostedResults, false)).toEqual(
					expectedGroupOrder(generatedResults, false),
				);
			},
		),
		{ numRuns: 100 },
	);
});

// Feature: indexing-improvements, Property 6: Most-specific boost pattern wins
// **Validates: Requirements 6.3**
test("Property 6: the most literal-specific match wins and later ties override earlier entries", (): void => {
	fc.assert(
		fc.property(
			specificityInputArbitrary,
			(input: SpecificityInput): void => {
				const boostMap: BoostEntry[] = [
					{ pattern: "**/*.ts", boost: input.broadBoost },
					{ pattern: input.path, boost: input.firstSpecificBoost },
					{ pattern: input.path, boost: input.lastSpecificBoost },
				];
				const [boostedResult] = applyBoostMap(
					[{ path: input.path, score: input.baseScore }],
					boostMap,
				);

				expect(boostedResult?.score).toBe(
					input.baseScore * input.lastSpecificBoost,
				);
			},
		),
		{ numRuns: 100 },
	);
});
