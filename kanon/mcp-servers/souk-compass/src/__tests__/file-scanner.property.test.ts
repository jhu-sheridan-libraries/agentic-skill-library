import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import fc from "fast-check";
import { matchesAny, scanDirectory } from "../file-scanner.js";
import {
	detectProjectType,
	getLanguagePreset,
	type ProjectType,
} from "../project-detector.js";

const PROJECT_TYPES = [
	"elixir",
	"java",
	"node",
	"python",
	"rust",
	"unknown",
] as const satisfies readonly ProjectType[];

const PROJECT_MARKERS: Readonly<
	Record<Exclude<ProjectType, "unknown">, string>
> = {
	elixir: "mix.exs",
	java: "pom.xml",
	node: "package.json",
	python: "pyproject.toml",
	rust: "Cargo.toml",
};

const EXPECTED_PRESETS: Readonly<Record<ProjectType, readonly string[]>> = {
	elixir: ["**/_build/**", "**/deps/**", "**/cover/**"],
	java: ["**/target/**", "**/build/**", "**/.gradle/**", "**/*.class"],
	node: [
		"**/node_modules/**",
		"**/dist/**",
		"**/build/**",
		"**/*.lock",
		"**/package-lock.json",
	],
	python: [
		"**/__pycache__/**",
		"**/.venv/**",
		"**/venv/**",
		"**/*.egg-info/**",
		"**/dist/**",
		"**/.tox/**",
	],
	rust: ["**/target/**"],
	unknown: [],
};

const EXPLICIT_EXCLUSIONS: readonly string[] = ["**/manually-excluded/**"];

const FIXTURE_PATHS: readonly string[] = [
	"src/keep.ts",
	"_build/generated.ts",
	"deps/library.ts",
	"cover/report.ts",
	"target/output.ts",
	"build/output.ts",
	".gradle/cache.ts",
	"node_modules/package/index.ts",
	"dist/bundle.ts",
	"__pycache__/module.ts",
	".venv/lib/module.ts",
	"venv/lib/module.ts",
	"package.egg-info/metadata.ts",
	".tox/environment.ts",
	"manually-excluded/skip.ts",
];

const PRESET_PROBES: Readonly<Record<ProjectType, readonly string[]>> = {
	elixir: ["_build/generated.ts", "deps/library.ts", "cover/report.ts"],
	java: [
		"target/output.ts",
		"build/output.ts",
		".gradle/cache.ts",
		"Generated.class",
	],
	node: [
		"node_modules/package/index.ts",
		"dist/bundle.ts",
		"build/output.ts",
		"package.lock",
		"package-lock.json",
	],
	python: [
		"__pycache__/module.ts",
		".venv/lib/module.ts",
		"venv/lib/module.ts",
		"package.egg-info/metadata.ts",
		"dist/bundle.ts",
		".tox/environment.ts",
	],
	rust: ["target/output.ts"],
	unknown: [],
};

async function createProjectFixture(projectType: ProjectType): Promise<string> {
	const rootPath: string = await mkdtemp(join(tmpdir(), "souk-file-scanner-"));
	const marker: string | undefined =
		projectType === "unknown" ? undefined : PROJECT_MARKERS[projectType];

	if (marker) {
		await writeFile(join(rootPath, marker), "marker\n");
	}

	await Promise.all(
		FIXTURE_PATHS.map(async (relativePath: string): Promise<void> => {
			const absolutePath = join(rootPath, relativePath);
			await mkdir(dirname(absolutePath), { recursive: true });
			await writeFile(absolutePath, "fixture\n");
		}),
	);

	return rootPath;
}

function expectedScannedPaths(exclusions: readonly string[]): string[] {
	return FIXTURE_PATHS.filter(
		(relativePath: string): boolean => !matchesAny(exclusions, relativePath),
	).sort();
}

// Feature: indexing-improvements, Property 1: Project detection determines exclusion list
// **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.3**
test("Property 1: project detection selects presets unless explicit exclusions override them", async () => {
	const roots = new Map<ProjectType, string>();

	try {
		await Promise.all(
			PROJECT_TYPES.map(async (projectType: ProjectType): Promise<void> => {
				roots.set(projectType, await createProjectFixture(projectType));
			}),
		);

		await fc.assert(
			fc.asyncProperty(
				fc.constantFrom(...PROJECT_TYPES),
				fc.boolean(),
				async (
					projectType: ProjectType,
					hasExplicitExclusions: boolean,
				): Promise<void> => {
					const rootPath: string | undefined = roots.get(projectType);
					expect(rootPath).toBeDefined();
					if (!rootPath) throw new Error(`Missing fixture for ${projectType}`);

					const detectedType: ProjectType = await detectProjectType(rootPath);
					expect(detectedType).toBe(projectType);

					const presetExclusions = getLanguagePreset(detectedType).exclude;
					const activeExclusions = hasExplicitExclusions
						? EXPLICIT_EXCLUSIONS
						: presetExclusions;
					const expectedExclusions = hasExplicitExclusions
						? EXPLICIT_EXCLUSIONS
						: EXPECTED_PRESETS[projectType];

					expect(activeExclusions).toEqual(expectedExclusions);
					for (const probePath of PRESET_PROBES[projectType]) {
						expect(matchesAny(activeExclusions, probePath)).toBe(
							!hasExplicitExclusions,
						);
					}

					const scanned = await scanDirectory({
						rootPath,
						include: ["**/*.ts"],
						exclude: hasExplicitExclusions
							? [...EXPLICIT_EXCLUSIONS]
							: undefined,
						presetExclusions: [...presetExclusions],
						maxFileSize: 1024,
					});

					expect(
						scanned
							.map(
								({ relativePath }: { relativePath: string }): string =>
									relativePath,
							)
							.sort(),
					).toEqual(expectedScannedPaths(activeExclusions));
				},
			),
			{ numRuns: 100 },
		);
	} finally {
		await Promise.all(
			[...roots.values()].map(
				(rootPath: string): Promise<void> =>
					rm(rootPath, { force: true, recursive: true }),
			),
		);
	}
});
