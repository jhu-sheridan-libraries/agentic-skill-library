import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parseKnowledgeMd,
  parseHooksYaml,
  loadKnowledgeArtifact,
  isParseError,
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
    expect(result.data.frontmatter.harnesses).toHaveLength(7);
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
    expect(result.data.frontmatter.harnesses).toHaveLength(7);
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
