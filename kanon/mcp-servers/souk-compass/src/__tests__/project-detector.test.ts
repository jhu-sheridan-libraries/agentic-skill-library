import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	LANGUAGE_PRESETS,
	detectProjectType,
	getLanguagePreset,
	type ProjectType,
} from "../project-detector.js";

interface MarkerCase {
	marker: string;
	expectedType: ProjectType;
}

const markerCases: readonly MarkerCase[] = [
	{ marker: "mix.exs", expectedType: "elixir" },
	{ marker: "package.json", expectedType: "node" },
	{ marker: "Cargo.toml", expectedType: "rust" },
	{ marker: "pyproject.toml", expectedType: "python" },
	{ marker: "requirements.txt", expectedType: "python" },
	{ marker: "pom.xml", expectedType: "java" },
	{ marker: "build.gradle", expectedType: "java" },
	{ marker: "build.gradle.kts", expectedType: "java" },
];

const expectedPresets: Record<ProjectType, string[]> = {
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

async function withMarkerFiles(
	markerFiles: readonly string[],
	assertion: (rootPath: string) => Promise<void>,
): Promise<void> {
	const rootPath: string = await mkdtemp(join(tmpdir(), "souk-project-detector-"));

	try {
		await Promise.all(
			markerFiles.map((markerFile: string) =>
				writeFile(join(rootPath, markerFile), ""),
			),
		);
		await assertion(rootPath);
	} finally {
		await rm(rootPath, { force: true, recursive: true });
	}
}

describe("project-detector", () => {
	for (const { marker, expectedType } of markerCases) {
		test(`detects ${expectedType} projects from ${marker}`, async () => {
			await withMarkerFiles([marker], async (rootPath: string): Promise<void> => {
				expect(await detectProjectType(rootPath)).toBe(expectedType);
			});
		});
	}

	test("gives mix.exs priority over package.json", async () => {
		await withMarkerFiles(
			["mix.exs", "package.json"],
			async (rootPath: string): Promise<void> => {
				expect(await detectProjectType(rootPath)).toBe("elixir");
			},
		);
	});

	test("returns unknown when no project marker exists", async () => {
		await withMarkerFiles([], async (rootPath: string): Promise<void> => {
			expect(await detectProjectType(rootPath)).toBe("unknown");
		});
	});

	test("returns the expected exclusion preset for every project type", () => {
		for (const [type, expectedExclude] of Object.entries(expectedPresets)) {
			const projectType: ProjectType = type as ProjectType;
			const preset = getLanguagePreset(projectType);

			expect(preset.type).toBe(projectType);
			expect(preset.exclude).toEqual(expectedExclude);
			expect(LANGUAGE_PRESETS[projectType]).toEqual(expectedExclude);
		}
	});
});
