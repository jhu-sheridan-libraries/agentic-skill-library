/**
 * Property 7: Inbound translation has complete source accounting
 *
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
 *
 * This property test verifies that for any source translator invocation:
 * 1. Every input document path is either in consumedPaths or preservedPaths (completeness)
 * 2. consumedPaths and preservedPaths are disjoint (no double-counting)
 * 3. The union of consumed + preserved covers all input document paths
 * 4. Paths in the output are sorted by code-point order
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";

import type {
	FormatContract,
	NormalizedRelativePath,
	SourceDocument,
} from "../schemas";
import type { SourceTranslatorContext } from "../rosetta/registry";
import { translateKiroPower } from "../rosetta/builtins/sources/kiro-power";
import { translateKiroSkill } from "../rosetta/builtins/sources/kiro-skill";
import { translateSuperpowers } from "../rosetta/builtins/sources/superpowers";
import {
	KIRO_POWER_CONTRACT,
	KIRO_SKILL_CONTRACT,
	SUPERPOWERS_CONTRACT,
} from "../rosetta/builtins/contracts";

// ═══════════════════════════════════════════════════════════════════════════════
// Generators
// ═══════════════════════════════════════════════════════════════════════════════

/** Generates valid YAML frontmatter content for a knowledge doc */
function arbFrontmatterContent(): fc.Arbitrary<string> {
	return fc
		.record({
			name: fc.stringMatching(/^[a-z][a-z0-9-]{1,15}$/),
			description: fc.string({ minLength: 1, maxLength: 60 }),
			keywords: fc.array(fc.stringMatching(/^[a-z]{2,8}$/), {
				minLength: 0,
				maxLength: 3,
			}),
		})
		.map(
			(fm) =>
				`---\nname: ${fm.name}\ndescription: "${fm.description.replace(/"/g, "")}"\nkeywords:\n${fm.keywords.map((k) => `  - ${k}`).join("\n")}\n---\n\n# Body\n\nSome content here.`,
		);
}

/** Generates a valid path segment (no traversal, no NUL) */
function arbPathSegment(): fc.Arbitrary<string> {
	return fc
		.stringMatching(/^[a-z0-9][a-z0-9._-]{0,11}$/)
		.filter(
			(s) => s.length > 0 && s !== "." && s !== ".." && !s.includes("\0"),
		);
}

/** Generates extra document paths that won't collide with known paths */
function arbExtraDocPath(
	excludePrefixes: string[],
): fc.Arbitrary<string> {
	return fc
		.tuple(arbPathSegment(), arbPathSegment())
		.map(([dir, file]) => `${dir}/${file}`)
		.filter(
			(p) =>
				!excludePrefixes.some((prefix) => p.startsWith(prefix)) &&
				p !== "POWER.md" &&
				p !== "SKILL.md",
		);
}

/** Generates a document set for kiro-power format */
function arbKiroPowerDocuments(): fc.Arbitrary<SourceDocument[]> {
	return fc
		.tuple(
			// POWER.md is always present
			arbFrontmatterContent(),
			// Optional steering files (0-3)
			fc.array(
				fc.tuple(
					arbPathSegment().map((s) => `steering/${s}.md`),
					fc.string({ minLength: 5, maxLength: 80 }),
				),
				{ minLength: 0, maxLength: 3 },
			),
			// Optional extra files (preserved, 0-2)
			fc.array(
				fc.tuple(
					arbExtraDocPath(["steering/"]),
					fc.string({ minLength: 1, maxLength: 40 }),
				),
				{ minLength: 0, maxLength: 2 },
			),
		)
		.map(([powerContent, steeringFiles, extraFiles]) => {
			const docs: SourceDocument[] = [
				{
					path: "POWER.md" as NormalizedRelativePath,
					content: powerContent,
					executable: false,
				},
			];

			// Deduplicate steering paths
			const seenPaths = new Set<string>(["POWER.md"]);
			for (const [path, content] of steeringFiles) {
				if (!seenPaths.has(path)) {
					seenPaths.add(path);
					docs.push({
						path: path as NormalizedRelativePath,
						content,
						executable: false,
					});
				}
			}

			for (const [path, content] of extraFiles) {
				if (!seenPaths.has(path)) {
					seenPaths.add(path);
					docs.push({
						path: path as NormalizedRelativePath,
						content,
						executable: false,
					});
				}
			}

			return docs;
		});
}

/** Generates a document set for kiro-skill format */
function arbKiroSkillDocuments(): fc.Arbitrary<SourceDocument[]> {
	return fc
		.tuple(
			// SKILL.md is always present
			arbFrontmatterContent(),
			// Optional references files (0-3)
			fc.array(
				fc.tuple(
					arbPathSegment().map((s) => `references/${s}.md`),
					fc.string({ minLength: 5, maxLength: 80 }),
				),
				{ minLength: 0, maxLength: 3 },
			),
			// Optional extra files (preserved, 0-2)
			fc.array(
				fc.tuple(
					arbExtraDocPath(["references/"]),
					fc.string({ minLength: 1, maxLength: 40 }),
				),
				{ minLength: 0, maxLength: 2 },
			),
		)
		.map(([skillContent, refFiles, extraFiles]) => {
			const docs: SourceDocument[] = [
				{
					path: "SKILL.md" as NormalizedRelativePath,
					content: skillContent,
					executable: false,
				},
			];

			const seenPaths = new Set<string>(["SKILL.md"]);
			for (const [path, content] of refFiles) {
				if (!seenPaths.has(path)) {
					seenPaths.add(path);
					docs.push({
						path: path as NormalizedRelativePath,
						content,
						executable: false,
					});
				}
			}

			for (const [path, content] of extraFiles) {
				if (!seenPaths.has(path)) {
					seenPaths.add(path);
					docs.push({
						path: path as NormalizedRelativePath,
						content,
						executable: false,
					});
				}
			}

			return docs;
		});
}

/** Generates a document set for superpowers format */
function arbSuperpowersDocuments(): fc.Arbitrary<SourceDocument[]> {
	return fc
		.tuple(
			// SKILL.md is always present
			arbFrontmatterContent(),
			// Optional companion .md files (0-3)
			fc.array(
				fc.tuple(
					arbPathSegment().map((s) => `${s}.md`),
					fc.string({ minLength: 5, maxLength: 80 }),
				),
				{ minLength: 0, maxLength: 3 },
			),
			// Optional non-md files (preserved, 0-2)
			fc.array(
				fc.tuple(
					fc
						.tuple(arbPathSegment(), fc.constantFrom(".txt", ".json", ".yaml"))
						.map(([name, ext]) => `${name}${ext}`),
					fc.string({ minLength: 1, maxLength: 40 }),
				),
				{ minLength: 0, maxLength: 2 },
			),
		)
		.map(([skillContent, companionFiles, extraFiles]) => {
			const docs: SourceDocument[] = [
				{
					path: "SKILL.md" as NormalizedRelativePath,
					content: skillContent,
					executable: false,
				},
			];

			const seenPaths = new Set<string>(["SKILL.md"]);
			for (const [path, content] of companionFiles) {
				if (!seenPaths.has(path) && path !== "SKILL.md") {
					seenPaths.add(path);
					docs.push({
						path: path as NormalizedRelativePath,
						content,
						executable: false,
					});
				}
			}

			for (const [path, content] of extraFiles) {
				if (!seenPaths.has(path)) {
					seenPaths.add(path);
					docs.push({
						path: path as NormalizedRelativePath,
						content,
						executable: false,
					});
				}
			}

			return docs;
		});
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/** Build a minimal SourceTranslatorContext for a given contract */
function makeContext(contract: FormatContract): SourceTranslatorContext {
	return {
		format: contract,
		canonicalSchemaVersion: "1.0.0",
		options: {},
		callerContext: { artifactNameHint: "test-artifact" },
	};
}

/** Check if an array is sorted by code-point order */
function isSortedByCodePoint(arr: readonly string[]): boolean {
	for (let i = 1; i < arr.length; i++) {
		if (arr[i - 1] > arr[i]) return false;
	}
	return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 7: Inbound translation has complete source accounting", () => {
	it("kiro-power: consumed ∪ preserved = all input paths", () => {
		fc.assert(
			fc.property(arbKiroPowerDocuments(), (docs) => {
				const context = makeContext(KIRO_POWER_CONTRACT);
				const result = translateKiroPower(docs, context);

				const allInputPaths = new Set(docs.map((d) => d.path));
				const consumed = new Set(result.consumedPaths);
				const preserved = new Set(result.preservedPaths);

				// Every input path must be in consumed or preserved
				for (const path of allInputPaths) {
					expect(consumed.has(path) || preserved.has(path)).toBe(true);
				}

				// Union must equal all input paths
				const union = new Set([...consumed, ...preserved]);
				expect(union.size).toBe(allInputPaths.size);
				for (const path of allInputPaths) {
					expect(union.has(path)).toBe(true);
				}
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("kiro-power: consumed ∩ preserved = ∅ (disjoint)", () => {
		fc.assert(
			fc.property(arbKiroPowerDocuments(), (docs) => {
				const context = makeContext(KIRO_POWER_CONTRACT);
				const result = translateKiroPower(docs, context);

				const consumed = new Set(result.consumedPaths);
				const preserved = new Set(result.preservedPaths);

				// No path should appear in both sets
				for (const path of consumed) {
					expect(preserved.has(path)).toBe(false);
				}
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("kiro-power: paths are sorted by code-point order", () => {
		fc.assert(
			fc.property(arbKiroPowerDocuments(), (docs) => {
				const context = makeContext(KIRO_POWER_CONTRACT);
				const result = translateKiroPower(docs, context);

				expect(isSortedByCodePoint(result.consumedPaths)).toBe(true);
				expect(isSortedByCodePoint(result.preservedPaths)).toBe(true);
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("kiro-skill: consumed ∪ preserved = all input paths", () => {
		fc.assert(
			fc.property(arbKiroSkillDocuments(), (docs) => {
				const context = makeContext(KIRO_SKILL_CONTRACT);
				const result = translateKiroSkill(docs, context);

				const allInputPaths = new Set(docs.map((d) => d.path));
				const consumed = new Set(result.consumedPaths);
				const preserved = new Set(result.preservedPaths);

				// Every input path must be in consumed or preserved
				for (const path of allInputPaths) {
					expect(consumed.has(path) || preserved.has(path)).toBe(true);
				}

				// Union must equal all input paths
				const union = new Set([...consumed, ...preserved]);
				expect(union.size).toBe(allInputPaths.size);
				for (const path of allInputPaths) {
					expect(union.has(path)).toBe(true);
				}
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("kiro-skill: consumed ∩ preserved = ∅ (disjoint)", () => {
		fc.assert(
			fc.property(arbKiroSkillDocuments(), (docs) => {
				const context = makeContext(KIRO_SKILL_CONTRACT);
				const result = translateKiroSkill(docs, context);

				const consumed = new Set(result.consumedPaths);
				const preserved = new Set(result.preservedPaths);

				for (const path of consumed) {
					expect(preserved.has(path)).toBe(false);
				}
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("kiro-skill: paths are sorted by code-point order", () => {
		fc.assert(
			fc.property(arbKiroSkillDocuments(), (docs) => {
				const context = makeContext(KIRO_SKILL_CONTRACT);
				const result = translateKiroSkill(docs, context);

				expect(isSortedByCodePoint(result.consumedPaths)).toBe(true);
				expect(isSortedByCodePoint(result.preservedPaths)).toBe(true);
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("superpowers: consumed ∪ preserved = all input paths", () => {
		fc.assert(
			fc.property(arbSuperpowersDocuments(), (docs) => {
				const context = makeContext(SUPERPOWERS_CONTRACT);
				const result = translateSuperpowers(docs, context);

				const allInputPaths = new Set(docs.map((d) => d.path));
				const consumed = new Set(result.consumedPaths);
				const preserved = new Set(result.preservedPaths);

				// Every input path must be in consumed or preserved
				for (const path of allInputPaths) {
					expect(consumed.has(path) || preserved.has(path)).toBe(true);
				}

				// Union must equal all input paths
				const union = new Set([...consumed, ...preserved]);
				expect(union.size).toBe(allInputPaths.size);
				for (const path of allInputPaths) {
					expect(union.has(path)).toBe(true);
				}
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("superpowers: consumed ∩ preserved = ∅ (disjoint)", () => {
		fc.assert(
			fc.property(arbSuperpowersDocuments(), (docs) => {
				const context = makeContext(SUPERPOWERS_CONTRACT);
				const result = translateSuperpowers(docs, context);

				const consumed = new Set(result.consumedPaths);
				const preserved = new Set(result.preservedPaths);

				for (const path of consumed) {
					expect(preserved.has(path)).toBe(false);
				}
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("superpowers: paths are sorted by code-point order", () => {
		fc.assert(
			fc.property(arbSuperpowersDocuments(), (docs) => {
				const context = makeContext(SUPERPOWERS_CONTRACT);
				const result = translateSuperpowers(docs, context);

				expect(isSortedByCodePoint(result.consumedPaths)).toBe(true);
				expect(isSortedByCodePoint(result.preservedPaths)).toBe(true);
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});
});
