import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import fc from "fast-check";
import { scanDirectory } from "../file-scanner.js";
import { createIgnoreMatcher, parseIgnoreFile } from "../ignore-parser.js";

interface GeneratedPath {
	directories: string[];
	fileName: string;
	relativePath: string;
}

interface MatchingRule {
	negated: boolean;
	recursive: boolean;
}

interface LastMatchInput {
	path: GeneratedPath;
	middleRules: MatchingRule[];
	lastRule: MatchingRule;
}

interface ExclusionInput {
	path: GeneratedPath;
	hasExplicitExclude: boolean;
	isIgnoredByFile: boolean;
}

const directorySegmentsArbitrary: fc.Arbitrary<string[]> = fc.array(
	fc.constantFrom("src", "lib", "fixtures", "cache", "nested"),
	{ minLength: 1, maxLength: 3 },
);

const generatedPathArbitrary: fc.Arbitrary<GeneratedPath> = fc
	.tuple(
		directorySegmentsArbitrary,
		fc.constantFrom("entry.ts", "module.ts", "fixture.ts", "value.ts"),
	)
	.map(
		([directories, fileName]: [string[], string]): GeneratedPath => ({
			directories,
			fileName,
			relativePath: `${directories.join("/")}/${fileName}`,
		}),
	);

const matchingRuleArbitrary: fc.Arbitrary<MatchingRule> = fc.record({
	negated: fc.boolean(),
	recursive: fc.boolean(),
});

const lastMatchInputArbitrary: fc.Arbitrary<LastMatchInput> = fc.record({
	path: generatedPathArbitrary,
	middleRules: fc.array(matchingRuleArbitrary, { minLength: 0, maxLength: 6 }),
	lastRule: matchingRuleArbitrary,
});

const exclusionInputArbitrary: fc.Arbitrary<ExclusionInput> = fc.record({
	path: generatedPathArbitrary,
	hasExplicitExclude: fc.boolean(),
	isIgnoredByFile: fc.boolean(),
});

function formatRule(path: GeneratedPath, rule: MatchingRule): string {
	const pattern = rule.recursive ? `**/${path.fileName}` : path.relativePath;
	return `${rule.negated ? "!" : ""}${pattern}`;
}

// Feature: indexing-improvements, Property 7: Gitignore pattern matching with negation (last-match-wins)
// **Validates: Requirements 7.2, 7.3, 7.5**
test("Property 7: the last matching ignore rule determines inclusion", (): void => {
	fc.assert(
		fc.property(lastMatchInputArbitrary, (input: LastMatchInput): void => {
			const matchingRules: MatchingRule[] = [
				{ negated: false, recursive: false },
				{ negated: true, recursive: true },
				...input.middleRules,
				input.lastRule,
			];
			const content = [
				"# Generated property input",
				`other/${input.path.relativePath}`,
				`!ignored/${input.path.relativePath}`,
				...matchingRules.map((rule: MatchingRule): string =>
					formatRule(input.path, rule),
				),
			].join("\n");
			const isIgnored = createIgnoreMatcher(parseIgnoreFile(content));

			expect(isIgnored(input.path.relativePath, false)).toBe(
				!input.lastRule.negated,
			);
		}),
		{ numRuns: 100 },
	);
});

// Feature: indexing-improvements, Property 8: Ignore file union with explicit excludes
// **Validates: Requirements 7.2, 7.3, 7.4, 7.5**
test("Property 8: explicit exclusions and ignore rules compose as a union", async (): Promise<void> => {
	await fc.assert(
		fc.asyncProperty(
			exclusionInputArbitrary,
			async (input: ExclusionInput): Promise<void> => {
				const rootPath = await mkdtemp(join(tmpdir(), "souk-ignore-property-"));
				const targetPath = join(rootPath, input.path.relativePath);
				const explicitExclusions = input.hasExplicitExclude
					? [input.path.relativePath]
					: [`other/${input.path.relativePath}`];
				const ignoreContent = input.isIgnoredByFile
					? input.path.relativePath
					: `${input.path.relativePath}\n!${input.path.relativePath}`;

				try {
					await mkdir(dirname(targetPath), { recursive: true });
					await writeFile(
						targetPath,
						"export const indexed = true;\n",
						"utf-8",
					);

					const results = await scanDirectory({
						rootPath,
						include: ["**/*.ts"],
						exclude: explicitExclusions,
						ignoreRules: parseIgnoreFile(ignoreContent),
						maxFileSize: 1024,
					});
					const shouldBeExcluded =
						input.hasExplicitExclude || input.isIgnoredByFile;

					expect(results).toHaveLength(shouldBeExcluded ? 0 : 1);
					if (!shouldBeExcluded) {
						expect(results[0]?.relativePath).toBe(input.path.relativePath);
					}
				} finally {
					await rm(rootPath, { recursive: true, force: true });
				}
			},
		),
		{ numRuns: 100 },
	);
});
