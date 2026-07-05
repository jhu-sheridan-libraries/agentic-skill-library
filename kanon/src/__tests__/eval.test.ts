import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
	applyHarnessContext,
	discoverEvalConfigs,
	resolvePromptRefs,
} from "../eval";
import { createTemplateEnv } from "../template-engine";

const EVAL_CONTEXTS_DIR = resolve(
	import.meta.dir,
	"../../templates/eval-contexts",
);

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "eval-test-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

/** Write a minimal YAML eval config file */
async function writeEvalConfig(
	dir: string,
	filename: string,
	content: Record<string, unknown>,
): Promise<void> {
	await mkdir(dir, { recursive: true });
	const yaml = Object.entries(content)
		.map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
		.join("\n");
	await writeFile(join(dir, filename), yaml, "utf-8");
}

describe("Eval discovery", () => {
	/**
	 * Validates: Requirements 32.1, 32.2
	 * Eval discovery finds configs in artifact evals/ directories.
	 */
	test("discovers eval configs in knowledge/*/evals/ directories", async () => {
		const knowledgeDir = join(tempDir, "knowledge");
		const topLevelEvalsDir = join(tempDir, "evals");

		// Create two artifacts with evals
		await writeEvalConfig(
			join(knowledgeDir, "artifact-a", "evals"),
			"promptfooconfig.yaml",
			{ description: "Eval A", prompts: ["file://test.md"], tests: [] },
		);
		await writeEvalConfig(
			join(knowledgeDir, "artifact-b", "evals"),
			"suite.yml",
			{ description: "Eval B", prompts: ["file://other.md"], tests: [] },
		);

		const configs = await discoverEvalConfigs(knowledgeDir, topLevelEvalsDir);

		expect(configs.length).toBe(2);

		const names = configs.map((c) => c.artifactName).sort();
		expect(names).toEqual(["artifact-a", "artifact-b"]);

		// Each config should have parsed YAML content
		for (const cfg of configs) {
			expect(cfg.config).toBeDefined();
			expect(typeof cfg.config).toBe("object");
			expect(cfg.configFile).toContain("evals");
		}
	});

	/**
	 * Validates: Requirement 32.3
	 * Eval discovery finds configs in top-level evals/ directory.
	 */
	test("discovers eval configs in top-level evals/ directory", async () => {
		const knowledgeDir = join(tempDir, "knowledge");
		const topLevelEvalsDir = join(tempDir, "evals");

		await writeEvalConfig(topLevelEvalsDir, "cross-suite.yaml", {
			description: "Cross-artifact suite",
			prompts: ["file://dist/kiro/a/steering.md"],
			tests: [],
		});

		const configs = await discoverEvalConfigs(knowledgeDir, topLevelEvalsDir);

		expect(configs.length).toBe(1);
		expect(configs[0].artifactName).toBe("cross-artifact");
		expect(configs[0].configFile).toContain("cross-suite.yaml");
	});

	/**
	 * Validates: Requirement 32.4
	 * Top-level providers.yaml is skipped during discovery.
	 */
	test("skips providers.yaml in top-level evals/ directory", async () => {
		const knowledgeDir = join(tempDir, "knowledge");
		const topLevelEvalsDir = join(tempDir, "evals");

		await writeEvalConfig(topLevelEvalsDir, "providers.yaml", {
			providers: [{ id: "openai:gpt-4o" }],
		});
		await writeEvalConfig(topLevelEvalsDir, "real-suite.yaml", {
			description: "Real suite",
			tests: [],
		});

		const configs = await discoverEvalConfigs(knowledgeDir, topLevelEvalsDir);

		expect(configs.length).toBe(1);
		expect(configs[0].configFile).toContain("real-suite.yaml");
	});

	/**
	 * Validates: Requirement 33.2
	 * Filtering by artifact name returns only that artifact's configs.
	 */
	test("filters by artifact name when specified", async () => {
		const knowledgeDir = join(tempDir, "knowledge");
		const topLevelEvalsDir = join(tempDir, "evals");

		await writeEvalConfig(
			join(knowledgeDir, "target-artifact", "evals"),
			"config.yaml",
			{ description: "Target", tests: [] },
		);
		await writeEvalConfig(
			join(knowledgeDir, "other-artifact", "evals"),
			"config.yaml",
			{ description: "Other", tests: [] },
		);

		const configs = await discoverEvalConfigs(
			knowledgeDir,
			topLevelEvalsDir,
			"target-artifact",
		);

		expect(configs.length).toBe(1);
		expect(configs[0].artifactName).toBe("target-artifact");
	});

	/**
	 * Validates: Requirement 32.1
	 * Artifacts without evals/ subdirectory are skipped.
	 */
	test("returns empty when no eval configs exist", async () => {
		const knowledgeDir = join(tempDir, "knowledge");
		const topLevelEvalsDir = join(tempDir, "evals");

		// Create artifact without evals
		await mkdir(join(knowledgeDir, "no-evals-artifact"), { recursive: true });

		const configs = await discoverEvalConfigs(knowledgeDir, topLevelEvalsDir);
		expect(configs.length).toBe(0);
	});

	/**
	 * Validates: Requirement 32.1
	 * Both artifact-level and top-level configs are discovered together.
	 */
	test("discovers both artifact-level and top-level configs", async () => {
		const knowledgeDir = join(tempDir, "knowledge");
		const topLevelEvalsDir = join(tempDir, "evals");

		await writeEvalConfig(
			join(knowledgeDir, "my-skill", "evals"),
			"promptfooconfig.yaml",
			{ description: "Artifact eval", tests: [] },
		);
		await writeEvalConfig(topLevelEvalsDir, "integration.yaml", {
			description: "Integration eval",
			tests: [],
		});

		const configs = await discoverEvalConfigs(knowledgeDir, topLevelEvalsDir);

		expect(configs.length).toBe(2);
		const names = configs.map((c) => c.artifactName).sort();
		expect(names).toEqual(["cross-artifact", "my-skill"]);
	});
});

describe("Prompt resolver", () => {
	/**
	 * Validates: Requirement 33.1, 33.4
	 * resolvePromptRefs maps file:// refs to absolute dist paths.
	 */
	test("resolves file:// prompt refs to absolute paths", () => {
		const config = {
			prompts: [
				"file://dist/kiro/my-skill/steering/my-skill.md",
				"file://dist/cursor/my-skill/rules/my-skill.md",
			],
			tests: [],
		};

		const resolved = resolvePromptRefs(config, "dist");

		expect(Array.isArray(resolved.prompts)).toBe(true);
		const prompts = resolved.prompts as string[];
		for (const p of prompts) {
			expect(p.startsWith("file://")).toBe(true);
			// Should be resolved to absolute path
			expect(p.startsWith("file:///") || p.startsWith("file://C:")).toBe(true);
		}
	});

	/**
	 * Validates: Requirement 33.1
	 * Non-file:// prompts are left unchanged.
	 */
	test("leaves non-file:// prompts unchanged", () => {
		const config = {
			prompts: ["You are a helpful assistant.", "Inline prompt text"],
			tests: [],
		};

		const resolved = resolvePromptRefs(config, "dist");

		expect(resolved.prompts).toEqual([
			"You are a helpful assistant.",
			"Inline prompt text",
		]);
	});

	/**
	 * Validates: Requirement 33.1
	 * Config without prompts array is returned as-is.
	 */
	test("handles config without prompts array", () => {
		const config = { tests: [{ description: "test" }] };

		const resolved = resolvePromptRefs(config, "dist");

		expect(resolved.tests).toEqual([{ description: "test" }]);
		expect(resolved.prompts).toBeUndefined();
	});

	/**
	 * Validates: Requirement 33.1
	 * Mixed file:// and inline prompts are handled correctly.
	 */
	test("handles mixed file:// and inline prompts", () => {
		const config = {
			prompts: [
				"file://dist/kiro/skill/steering.md",
				"Inline prompt",
				"file://dist/cursor/skill/rules.md",
			],
			tests: [],
		};

		const resolved = resolvePromptRefs(config, "dist");
		const prompts = resolved.prompts as string[];

		// First and third should be resolved to absolute
		expect(
			prompts[0].startsWith("file:///") || prompts[0].startsWith("file://C:"),
		).toBe(true);
		expect(prompts[1]).toBe("Inline prompt");
		expect(
			prompts[2].startsWith("file:///") || prompts[2].startsWith("file://C:"),
		).toBe(true);
	});
});

describe("Harness context wrapping", () => {
	/**
	 * Validates: Requirements 38.1, 38.2, 38.3
	 * applyHarnessContext wraps prompt in harness-specific context template.
	 */
	test("wraps prompt in kiro harness context template", () => {
		const templateEnv = createTemplateEnv(EVAL_CONTEXTS_DIR);
		const prompt = "Follow TypeScript best practices.";

		const wrapped = applyHarnessContext(prompt, "kiro", templateEnv);

		// Should contain the original prompt
		expect(wrapped).toContain(prompt);
		// Should contain Kiro-specific context
		expect(wrapped).toContain("Kiro");
		expect(wrapped).toContain("steering file");
	});

	/**
	 * Validates: Requirements 38.1, 38.2
	 * applyHarnessContext wraps prompt in cursor context template.
	 */
	test("wraps prompt in cursor harness context template", () => {
		const templateEnv = createTemplateEnv(EVAL_CONTEXTS_DIR);
		const prompt = "Use strict TypeScript config.";

		const wrapped = applyHarnessContext(prompt, "cursor", templateEnv);

		expect(wrapped).toContain(prompt);
		expect(wrapped).toContain(".cursor/rules");
	});

	/**
	 * Validates: Requirements 38.1, 38.2
	 * applyHarnessContext wraps prompt in claude-code context template.
	 */
	test("wraps prompt in claude-code harness context template", () => {
		const templateEnv = createTemplateEnv(EVAL_CONTEXTS_DIR);
		const prompt = "Always use error handling.";

		const wrapped = applyHarnessContext(prompt, "claude-code", templateEnv);

		expect(wrapped).toContain(prompt);
		expect(wrapped).toContain("CLAUDE.md");
	});

	/**
	 * Validates: Requirement 38.4
	 * --no-context skips context wrapping: when no template env is available,
	 * the function returns the prompt as-is.
	 */
	test("returns prompt as-is when template does not exist", () => {
		// Create a template env pointing to an empty directory
		const emptyTemplateEnv = createTemplateEnv(
			join(tempDir, "empty-templates"),
		);
		const prompt = "Raw prompt without context.";

		const result = applyHarnessContext(prompt, "kiro", emptyTemplateEnv);

		// Should return the original prompt unchanged
		expect(result).toBe(prompt);
	});
});
