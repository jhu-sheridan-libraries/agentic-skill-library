import { describe, expect, test } from "bun:test";
import {
	LANGUAGE_PRESETS,
	detectProjectType,
	getLanguagePreset,
} from "../project-detector.js";
import {
	createIgnoreMatcher,
	loadIgnoreFile,
	parseIgnoreFile,
} from "../ignore-parser.js";
import { RootConfigSchema, loadRootConfig } from "../root-config.js";

describe("project-detector", () => {
	test("LANGUAGE_PRESETS has all project types", () => {
		expect(Object.keys(LANGUAGE_PRESETS)).toEqual(
			expect.arrayContaining([
				"elixir",
				"java",
				"node",
				"python",
				"rust",
				"unknown",
			]),
		);
	});

	test("elixir preset contains _build, deps, cover", () => {
		const preset = getLanguagePreset("elixir");
		expect(preset.type).toBe("elixir");
		expect(preset.exclude).toContain("**/_build/**");
		expect(preset.exclude).toContain("**/deps/**");
		expect(preset.exclude).toContain("**/cover/**");
	});

	test("python preset contains __pycache__, .venv, venv, egg-info, dist, .tox", () => {
		const preset = getLanguagePreset("python");
		expect(preset.type).toBe("python");
		expect(preset.exclude).toContain("**/__pycache__/**");
		expect(preset.exclude).toContain("**/.venv/**");
		expect(preset.exclude).toContain("**/venv/**");
		expect(preset.exclude).toContain("**/*.egg-info/**");
		expect(preset.exclude).toContain("**/dist/**");
		expect(preset.exclude).toContain("**/.tox/**");
	});

	test("java preset contains target, build, .gradle, *.class", () => {
		const preset = getLanguagePreset("java");
		expect(preset.type).toBe("java");
		expect(preset.exclude).toContain("**/target/**");
		expect(preset.exclude).toContain("**/build/**");
		expect(preset.exclude).toContain("**/.gradle/**");
		expect(preset.exclude).toContain("**/*.class");
	});

	test("node preset contains node_modules, dist, build, lock files", () => {
		const preset = getLanguagePreset("node");
		expect(preset.type).toBe("node");
		expect(preset.exclude).toContain("**/node_modules/**");
		expect(preset.exclude).toContain("**/dist/**");
		expect(preset.exclude).toContain("**/build/**");
		expect(preset.exclude).toContain("**/*.lock");
		expect(preset.exclude).toContain("**/package-lock.json");
	});

	test("rust preset contains target", () => {
		const preset = getLanguagePreset("rust");
		expect(preset.type).toBe("rust");
		expect(preset.exclude).toContain("**/target/**");
	});

	test("unknown preset is empty", () => {
		const preset = getLanguagePreset("unknown");
		expect(preset.type).toBe("unknown");
		expect(preset.exclude).toEqual([]);
	});

	test("detectProjectType returns node for this project", async () => {
		const type = await detectProjectType(
			import.meta.dir + "/../..",
		);
		expect(type).toBe("node");
	});

	test("detectProjectType returns unknown for empty dir", async () => {
		const { mkdtemp } = await import("node:fs/promises");
		const { tmpdir } = await import("node:os");
		const dir = await mkdtemp(`${tmpdir()}/souk-test-`);
		const type = await detectProjectType(dir);
		expect(type).toBe("unknown");
		// cleanup
		const { rm } = await import("node:fs/promises");
		await rm(dir, { recursive: true });
	});
});

describe("ignore-parser", () => {
	test("parseIgnoreFile handles comments and blank lines", () => {
		const rules = parseIgnoreFile("# comment\n\n_build/\n");
		expect(rules).toHaveLength(1);
		expect(rules[0].pattern).toBe("_build");
		expect(rules[0].directoryOnly).toBe(true);
		expect(rules[0].negated).toBe(false);
	});

	test("parseIgnoreFile handles negation", () => {
		const rules = parseIgnoreFile("!important.txt\n");
		expect(rules).toHaveLength(1);
		expect(rules[0].negated).toBe(true);
		expect(rules[0].pattern).toBe("important.txt");
	});

	test("createIgnoreMatcher uses last-match-wins", () => {
		const rules = parseIgnoreFile("*.log\n!important.log\n");
		const matcher = createIgnoreMatcher(rules);
		expect(matcher("debug.log", false)).toBe(true);
		expect(matcher("important.log", false)).toBe(false);
	});

	test("createIgnoreMatcher respects directoryOnly", () => {
		const rules = parseIgnoreFile("build/\n");
		const matcher = createIgnoreMatcher(rules);
		expect(matcher("build", true)).toBe(true);
		expect(matcher("build", false)).toBe(false);
	});

	test("loadIgnoreFile returns empty for missing file", async () => {
		const rules = await loadIgnoreFile("/nonexistent/path");
		expect(rules).toEqual([]);
	});
});

describe("root-config", () => {
	test("RootConfigSchema validates correct config", () => {
		const result = RootConfigSchema.safeParse({
			boost: [{ pattern: "src/**", boost: 1.5 }],
		});
		expect(result.success).toBe(true);
	});

	test("RootConfigSchema rejects empty pattern", () => {
		const result = RootConfigSchema.safeParse({
			boost: [{ pattern: "", boost: 1.5 }],
		});
		expect(result.success).toBe(false);
	});

	test("RootConfigSchema rejects boost > 10", () => {
		const result = RootConfigSchema.safeParse({
			boost: [{ pattern: "src/**", boost: 11 }],
		});
		expect(result.success).toBe(false);
	});

	test("RootConfigSchema rejects negative boost", () => {
		const result = RootConfigSchema.safeParse({
			boost: [{ pattern: "src/**", boost: -1 }],
		});
		expect(result.success).toBe(false);
	});

	test("RootConfigSchema rejects boost of 0", () => {
		const result = RootConfigSchema.safeParse({
			boost: [{ pattern: "src/**", boost: 0 }],
		});
		expect(result.success).toBe(false);
	});

	test("RootConfigSchema allows empty boost array", () => {
		const result = RootConfigSchema.safeParse({ boost: [] });
		expect(result.success).toBe(true);
	});

	test("RootConfigSchema allows missing boost", () => {
		const result = RootConfigSchema.safeParse({});
		expect(result.success).toBe(true);
	});

	test("loadRootConfig returns null for missing file", async () => {
		const config = await loadRootConfig("/nonexistent/path");
		expect(config).toBeNull();
	});
});
