import { describe, expect, test } from "bun:test";
import { applyBoostMap, patternSpecificity } from "../boost-map.js";
import type { BoostEntry } from "../root-config.js";

interface SearchResultFixture {
	[key: string]: unknown;
	label: string;
	path: string;
	score: number;
}

describe("patternSpecificity", (): void => {
	test("counts literal characters while excluding glob wildcards", (): void => {
		expect(patternSpecificity("plain")).toBe(5);
		expect(patternSpecificity("**/*.ts")).toBe(4);
		expect(patternSpecificity("src/**/*.ts")).toBe(8);
		expect(patternSpecificity("a?b*")).toBe(2);
	});
});

describe("applyBoostMap", (): void => {
	test("returns equivalent results with unmodified scores for an empty boost map", (): void => {
		const results: SearchResultFixture[] = [
			{ label: "source", path: "src/index.ts", score: 4 },
			{ label: "documentation", path: "docs/guide.md", score: 3 },
		];

		const boosted = applyBoostMap(results, []);

		expect(boosted).toEqual(results);
		expect(boosted).not.toBe(results);
	});

	test("uses the most-specific matching pattern", (): void => {
		const results: SearchResultFixture[] = [
			{ label: "module", path: "src/core/module.ts", score: 10 },
		];
		const boostMap: BoostEntry[] = [
			{ pattern: "**/*.ts", boost: 1.1 },
			{ pattern: "src/**/*.ts", boost: 1.5 },
		];

		const boosted = applyBoostMap(results, boostMap);

		expect(boosted).toEqual([
			{ label: "module", path: "src/core/module.ts", score: 15 },
		]);
	});

	test("uses the later pattern when matching patterns have equal specificity", (): void => {
		const results: SearchResultFixture[] = [
			{ label: "alias", path: "src/aliases", score: 6 },
		];
		const boostMap: BoostEntry[] = [
			{ pattern: "src/a*", boost: 0.5 },
			{ pattern: "src/*s", boost: 3 },
		];

		const boosted = applyBoostMap(results, boostMap);

		expect(boosted).toEqual([
			{ label: "alias", path: "src/aliases", score: 18 },
		]);
	});

	test("multiplies scores and reorders results by their boosted scores", (): void => {
		const results: SearchResultFixture[] = [
			{ label: "documentation", path: "docs/guide.md", score: 8 },
			{ label: "source", path: "src/index.ts", score: 7 },
			{ label: "unchanged", path: "CHANGELOG.md", score: 10 },
		];
		const boostMap: BoostEntry[] = [
			{ pattern: "docs/**", boost: 0.5 },
			{ pattern: "src/**", boost: 2 },
		];

		const boosted = applyBoostMap(results, boostMap);

		expect(boosted).toEqual([
			{ label: "source", path: "src/index.ts", score: 14 },
			{ label: "unchanged", path: "CHANGELOG.md", score: 10 },
			{ label: "documentation", path: "docs/guide.md", score: 4 },
		]);
	});

	test("preserves relative order for results with equal boosted scores", (): void => {
		const results: SearchResultFixture[] = [
			{ label: "first", path: "docs/first.md", score: 5 },
			{ label: "second", path: "docs/second.md", score: 5 },
			{ label: "other", path: "CHANGELOG.md", score: 6 },
		];
		const boostMap: BoostEntry[] = [{ pattern: "docs/**", boost: 2 }];

		const boosted = applyBoostMap(results, boostMap);

		expect(boosted.map((result) => result.label)).toEqual([
			"first",
			"second",
			"other",
		]);
	});

	test("does not mutate input results while applying boosts", (): void => {
		const results: SearchResultFixture[] = [
			{ label: "source", path: "src/index.ts", score: 4 },
			{ label: "documentation", path: "docs/guide.md", score: 5 },
		];
		const originalResults: SearchResultFixture[] = results.map(
			(result: SearchResultFixture): SearchResultFixture => ({ ...result }),
		);

		const boosted = applyBoostMap(results, [{ pattern: "src/**", boost: 2 }]);

		expect(results).toEqual(originalResults);
		expect(boosted[0]).not.toBe(results[0]);
		expect(boosted).toEqual([
			{ label: "source", path: "src/index.ts", score: 8 },
			{ label: "documentation", path: "docs/guide.md", score: 5 },
		]);
	});
});
