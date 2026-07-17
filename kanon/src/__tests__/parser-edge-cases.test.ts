import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	isParseError,
	loadKnowledgeArtifact,
	parseHooksYaml,
	parseKnowledgeMd,
	parseWorkflows,
} from "../parser";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "parser-edge-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("parseKnowledgeMd edge cases", () => {
	/**
	 * Validates: Requirement 2.3
	 * WHEN a knowledge.md file contains no frontmatter, THE Forge_CLI SHALL
	 * infer the artifact name from the parent directory name.
	 */
	test("knowledge.md with no frontmatter infers name from directory", async () => {
		const artifactDir = join(tempDir, "my-cool-artifact");
		await mkdir(artifactDir, { recursive: true });
		const filePath = join(artifactDir, "knowledge.md");
		await writeFile(filePath, "# Hello World\n\nSome body content here.");

		const result = await parseKnowledgeMd(filePath);
		expect(isParseError(result)).toBe(false);
		if (isParseError(result)) return;

		expect(result.data.frontmatter.name).toBe("my-cool-artifact");
		expect(result.data.body).toBe("# Hello World\n\nSome body content here.");
		// Defaults should be applied
		expect(result.data.frontmatter.harnesses).toHaveLength(8);
	});

	/**
	 * Validates: Requirement 22.3
	 * IF a knowledge.md file contains frontmatter with a --- delimiter but empty
	 * content between delimiters, THEN THE Forge_CLI SHALL treat the frontmatter
	 * as an empty mapping and apply defaults.
	 */
	test("knowledge.md with empty frontmatter (---\\n---) applies defaults", async () => {
		const artifactDir = join(tempDir, "empty-fm-artifact");
		await mkdir(artifactDir, { recursive: true });
		const filePath = join(artifactDir, "knowledge.md");
		await writeFile(filePath, "---\n---\nBody after empty frontmatter.");

		const result = await parseKnowledgeMd(filePath);
		expect(isParseError(result)).toBe(false);
		if (isParseError(result)) return;

		// Name inferred from directory
		expect(result.data.frontmatter.name).toBe("empty-fm-artifact");
		expect(result.data.body).toBe("Body after empty frontmatter.");
		// Defaults applied
		expect(result.data.frontmatter.version).toBe("0.1.0");
		expect(result.data.frontmatter.type).toBe("skill");
		expect(result.data.frontmatter.inclusion).toBe("always");
		expect(result.data.frontmatter.harnesses).toHaveLength(8);
	});

	/**
	 * Validates: Requirement 2.5
	 * IF the frontmatter contains invalid YAML syntax, THEN THE Forge_CLI SHALL
	 * return a ValidationError with the file path and line number of the syntax error.
	 */
	test("invalid YAML syntax returns ValidationError with file path", async () => {
		const artifactDir = join(tempDir, "bad-yaml");
		await mkdir(artifactDir, { recursive: true });
		const filePath = join(artifactDir, "knowledge.md");
		await writeFile(
			filePath,
			"---\nname: test\ninvalid: [unclosed bracket\n---\nBody text.",
		);

		const result = await parseKnowledgeMd(filePath);
		expect(isParseError(result)).toBe(true);
		if (!isParseError(result)) return;

		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.errors[0].filePath).toBe(filePath);
		expect(result.errors[0].message).toContain("YAML");
	});
});

describe("parseHooksYaml edge cases", () => {
	/**
	 * Validates: Requirement 3.5
	 * IF a hooks.yaml file references an event type not in the supported list,
	 * THEN THE Forge_CLI SHALL return a ValidationError identifying the unsupported event type.
	 */
	test("unsupported event type in hooks.yaml returns ValidationError", async () => {
		const filePath = join(tempDir, "hooks.yaml");
		await writeFile(
			filePath,
			`- name: bad-hook
  event: totally_unsupported_event
  action:
    type: ask_agent
    prompt: "do something"
`,
		);

		const result = await parseHooksYaml(filePath);
		expect(isParseError(result)).toBe(true);
		if (!isParseError(result)) return;

		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.errors[0].filePath).toBe(filePath);
	});
});

describe("parseWorkflows reference trees", () => {
	test("preserves nested paths and non-Markdown fixtures", async () => {
		const workflowsDir = join(tempDir, "workflows");
		await mkdir(join(workflowsDir, "course", "sample-data"), {
			recursive: true,
		});
		await writeFile(join(workflowsDir, "course", "module.md"), "# Module");
		await writeFile(
			join(workflowsDir, "course", "sample-data", "records.csv"),
			"id,value\nA,1\n",
		);

		const result = await parseWorkflows(workflowsDir);
		expect(result.data.map((workflow) => workflow.filename)).toEqual([
			"course/module.md",
			"course/sample-data/records.csv",
		]);
		expect(result.data[1]?.content).toBe("id,value\nA,1");
	});
});

describe("loadKnowledgeArtifact edge cases", () => {
	/**
	 * Validates: Requirement 1.5
	 * IF a directory under knowledge/ does not contain a knowledge.md file,
	 * THEN THE Forge_CLI SHALL skip that directory during build and emit a warning.
	 * Here we test that loadKnowledgeArtifact returns an error when knowledge.md is missing.
	 */
	test("missing knowledge.md in artifact directory returns error", async () => {
		const artifactDir = join(tempDir, "no-knowledge-md");
		await mkdir(artifactDir, { recursive: true });
		// Create hooks.yaml but no knowledge.md
		await writeFile(join(artifactDir, "hooks.yaml"), "[]");

		const result = await loadKnowledgeArtifact(artifactDir);
		expect(isParseError(result)).toBe(true);
		if (!isParseError(result)) return;

		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.errors[0].message).toContain("not found");
		expect(result.errors[0].filePath).toContain("knowledge.md");
	});

	/**
	 * Validates: Requirement 22.2
	 * THE Forge_CLI SHALL preserve all frontmatter fields during parsing,
	 * including fields not explicitly defined in the schema, passing them
	 * through to templates as extra context variables.
	 */
	test("extra frontmatter fields are preserved in extraFields", async () => {
		const artifactDir = join(tempDir, "extra-fields-artifact");
		await mkdir(artifactDir, { recursive: true });
		await writeFile(
			join(artifactDir, "knowledge.md"),
			`---
name: extra-fields-artifact
description: Test artifact
custom_field: custom_value
another_extra: 42
---
Body content.`,
		);

		const result = await loadKnowledgeArtifact(artifactDir);
		expect(isParseError(result)).toBe(false);
		if (isParseError(result)) return;

		expect(result.data.extraFields.custom_field).toBe("custom_value");
		expect(result.data.extraFields.another_extra).toBe(42);
	});
});

describe("loadKnowledgeArtifact body overrides", () => {
	test("loads body.<harness>.md into bodyOverrides", async () => {
		const artifactDir = join(tempDir, "with-override");
		await mkdir(artifactDir, { recursive: true });
		await writeFile(
			join(artifactDir, "knowledge.md"),
			"---\nname: with-override\ntype: skill\n---\n\nCanonical body.",
		);
		await writeFile(
			join(artifactDir, "body.claude-code.md"),
			"# Claude Code router\n\nLoad references/foo.md.",
		);

		const result = await loadKnowledgeArtifact(artifactDir);
		expect(isParseError(result)).toBe(false);
		if (isParseError(result)) return;

		expect(result.data.body).toBe("Canonical body.");
		expect(result.data.bodyOverrides["claude-code"]).toBe(
			"# Claude Code router\n\nLoad references/foo.md.",
		);
	});

	test("ignores unknown body.<foo>.md and warns", async () => {
		const artifactDir = join(tempDir, "bad-override");
		await mkdir(artifactDir, { recursive: true });
		await writeFile(
			join(artifactDir, "knowledge.md"),
			"---\nname: bad-override\ntype: skill\n---\n\nCanonical body.",
		);
		await writeFile(join(artifactDir, "body.notaharness.md"), "ignored");

		const result = await loadKnowledgeArtifact(artifactDir);
		expect(isParseError(result)).toBe(false);
		if (isParseError(result)) return;

		expect(result.data.bodyOverrides).toEqual({});
		expect(result.warnings.some((w) => w.includes("notaharness"))).toBe(true);
	});

	test("no override files yields empty bodyOverrides", async () => {
		const artifactDir = join(tempDir, "no-override");
		await mkdir(artifactDir, { recursive: true });
		await writeFile(
			join(artifactDir, "knowledge.md"),
			"---\nname: no-override\ntype: skill\n---\n\nCanonical body.",
		);

		const result = await loadKnowledgeArtifact(artifactDir);
		expect(isParseError(result)).toBe(false);
		if (isParseError(result)) return;
		expect(result.data.bodyOverrides).toEqual({});
	});
});
