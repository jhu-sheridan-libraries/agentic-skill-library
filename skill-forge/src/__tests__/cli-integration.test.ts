import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile, readFile, cp, exists } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const CLI_PATH = resolve(import.meta.dir, "../cli.ts");
const TEMPLATES_SRC = resolve(import.meta.dir, "../../templates");

let tempDir: string;
let originalCwd: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "cli-integration-"));
  // Copy templates into the temp dir so CLI commands can find them
  await cp(TEMPLATES_SRC, join(tempDir, "templates"), { recursive: true });
  // Create mcp-servers directory (expected by build)
  await mkdir(join(tempDir, "mcp-servers"), { recursive: true });
  originalCwd = process.cwd();
  process.chdir(tempDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

/** Run the forge CLI as a subprocess and return exit code + output */
async function runForge(...args: string[]): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
}> {
  const proc = Bun.spawn(["bun", "run", CLI_PATH, ...args], {
    cwd: tempDir,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, NO_COLOR: "1" },
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;

  return { exitCode, stdout, stderr };
}

/** Write a minimal knowledge artifact to disk inside the temp dir */
async function writeArtifact(config: {
  name: string;
  description?: string;
  harnesses?: string[];
  body?: string;
  hooks?: Array<{
    name: string;
    event: string;
    action: { type: string; prompt?: string; command?: string };
  }>;
}): Promise<void> {
  const knowledgeDir = join(tempDir, "knowledge");
  await mkdir(knowledgeDir, { recursive: true });

  const artifactDir = join(knowledgeDir, config.name);
  await mkdir(artifactDir, { recursive: true });

  const harnesses = config.harnesses ?? [
    "kiro", "claude-code", "copilot", "cursor",
    "windsurf", "cline", "qdeveloper",
  ];
  const frontmatter = [
    "---",
    `name: ${config.name}`,
    `description: "${config.description ?? "Test artifact"}"`,
    `harnesses: [${harnesses.map((h) => `"${h}"`).join(", ")}]`,
    "---",
  ].join("\n");

  await writeFile(
    join(artifactDir, "knowledge.md"),
    `${frontmatter}\n\n${config.body ?? "# Test Artifact\n\nThis is test content."}`,
    "utf-8",
  );

  if (config.hooks && config.hooks.length > 0) {
    const hooksYaml = config.hooks
      .map((h) => {
        const actionField =
          h.action.type === "ask_agent"
            ? `  action:\n    type: ask_agent\n    prompt: "${h.action.prompt ?? ""}"`
            : `  action:\n    type: run_command\n    command: "${h.action.command ?? ""}"`;
        return `- name: "${h.name}"\n  event: ${h.event}\n${actionField}`;
      })
      .join("\n");
    await writeFile(join(artifactDir, "hooks.yaml"), hooksYaml, "utf-8");
  }
}

describe("forge build — CLI integration", () => {
  /**
   * Validates: Requirements 27.1, 27.4, 27.5
   * `forge build` end-to-end with a sample knowledge artifact:
   * - Exits 0 on success
   * - Produces files in dist/
   * - Prints diagnostics to stderr
   */
  test("forge build compiles a sample artifact and exits 0", async () => {
    await writeArtifact({
      name: "test-skill",
      description: "Integration test skill",
      harnesses: ["kiro", "cursor"],
      body: "# Test Skill\n\nFollow these coding standards.",
    });

    const { exitCode, stderr } = await runForge("build");

    expect(exitCode).toBe(0);
    // Summary should appear on stderr (Req 27.5)
    expect(stderr).toContain("Build complete");

    // Verify dist output was created
    expect(await exists(join(tempDir, "dist", "kiro", "test-skill"))).toBe(true);
    expect(await exists(join(tempDir, "dist", "cursor", "test-skill"))).toBe(true);
  });

  /**
   * Validates: Requirements 27.1, 27.4
   * `forge build` with no knowledge artifacts prints a helpful message and exits non-zero.
   */
  test("forge build with no artifacts exits non-zero with helpful message", async () => {
    // No knowledge directory at all
    const { exitCode, stderr } = await runForge("build");

    expect(exitCode).not.toBe(0);
    // Should suggest `forge new`
    expect(stderr).toContain("forge new");
  });

  /**
   * Validates: Requirements 6.3, 27.4
   * `forge build --harness invalid` exits non-zero with valid harness list.
   */
  test("forge build with invalid harness name exits non-zero", async () => {
    await mkdir(join(tempDir, "knowledge"), { recursive: true });

    const { exitCode, stderr } = await runForge("build", "--harness", "nonexistent");

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("nonexistent");
    // Should list valid harness names
    expect(stderr).toContain("kiro");
  });
});

describe("forge validate — CLI integration", () => {
  /**
   * Validates: Requirements 18.7, 18.8, 27.4
   * `forge validate` returns exit code 0 when all artifacts are valid.
   */
  test("forge validate exits 0 for valid artifacts", async () => {
    await writeArtifact({
      name: "valid-skill",
      description: "A valid skill",
      harnesses: ["kiro"],
      body: "Valid content.",
    });

    const { exitCode, stderr } = await runForge("validate");

    expect(exitCode).toBe(0);
    // Should show pass status on stderr
    expect(stderr).toContain("valid-skill");
    expect(stderr).toContain("passed");
  });

  /**
   * Validates: Requirements 18.8, 27.4
   * `forge validate` returns non-zero exit code when artifacts have errors.
   */
  test("forge validate exits non-zero for invalid artifacts", async () => {
    const knowledgeDir = join(tempDir, "knowledge");
    const artifactDir = join(knowledgeDir, "bad-skill");
    await mkdir(artifactDir, { recursive: true });

    // Write knowledge.md with an unrecognized harness
    await writeFile(
      join(artifactDir, "knowledge.md"),
      `---
name: bad-skill
harnesses:
  - kiro
  - totally-fake-harness
---
Body content.`,
    );

    const { exitCode, stderr } = await runForge("validate");

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("bad-skill");
    expect(stderr).toContain("failed");
  });

  /**
   * Validates: Requirements 18.2, 27.4
   * `forge validate <path>` validates a single artifact.
   */
  test("forge validate with specific path validates single artifact", async () => {
    await writeArtifact({
      name: "specific-skill",
      harnesses: ["kiro"],
      body: "Specific content.",
    });

    const artifactPath = join("knowledge", "specific-skill");
    const { exitCode, stderr } = await runForge("validate", artifactPath);

    expect(exitCode).toBe(0);
    expect(stderr).toContain("specific-skill");
  });
});

describe("forge new — CLI integration", () => {
  /**
   * Validates: Requirements 17.1, 17.5, 27.4
   * `forge new <name>` creates the expected directory structure and exits 0.
   */
  test("forge new creates expected directory structure", async () => {
    const { exitCode, stderr } = await runForge("new", "my-new-skill");

    expect(exitCode).toBe(0);
    // Should print confirmation to stderr (Req 17.5)
    expect(stderr).toContain("my-new-skill");

    // Verify directory structure
    const artifactDir = join(tempDir, "knowledge", "my-new-skill");
    expect(await exists(join(artifactDir, "knowledge.md"))).toBe(true);
    expect(await exists(join(artifactDir, "workflows"))).toBe(true);
    expect(await exists(join(artifactDir, "hooks.yaml"))).toBe(true);
    expect(await exists(join(artifactDir, "mcp-servers.yaml"))).toBe(true);

    // Verify frontmatter in knowledge.md
    const content = await readFile(join(artifactDir, "knowledge.md"), "utf-8");
    expect(content).toContain("name: my-new-skill");
  });

  /**
   * Validates: Requirements 17.4, 27.4
   * `forge new <name>` exits non-zero when artifact already exists.
   */
  test("forge new exits non-zero when artifact already exists", async () => {
    // Create the artifact directory first
    await mkdir(join(tempDir, "knowledge", "existing-skill"), { recursive: true });

    const { exitCode, stderr } = await runForge("new", "existing-skill");

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("existing-skill");
  });
});

describe("forge catalog — CLI integration", () => {
  /**
   * Validates: Requirements 19.1, 19.3, 19.5, 27.4, 27.5
   * `forge catalog generate` produces valid JSON in catalog.json and exits 0.
   */
  test("forge catalog generate produces valid JSON", async () => {
    await writeArtifact({
      name: "alpha-skill",
      description: "Alpha skill",
      harnesses: ["kiro", "cursor"],
    });
    await writeArtifact({
      name: "beta-skill",
      description: "Beta skill",
      harnesses: ["kiro"],
    });

    const { exitCode, stderr } = await runForge("catalog", "generate");

    expect(exitCode).toBe(0);
    // Diagnostics on stderr (Req 27.5)
    expect(stderr).toContain("catalog.json");

    // Verify catalog.json was created and is valid JSON
    const catalogPath = join(tempDir, "catalog.json");
    expect(await exists(catalogPath)).toBe(true);

    const catalogContent = await readFile(catalogPath, "utf-8");
    const catalog = JSON.parse(catalogContent);

    // Should be an array
    expect(Array.isArray(catalog)).toBe(true);
    expect(catalog.length).toBe(2);

    // Should be sorted alphabetically (Req 19.3)
    expect(catalog[0].name).toBe("alpha-skill");
    expect(catalog[1].name).toBe("beta-skill");

    // Should have 2-space indentation (Req 19.5)
    expect(catalogContent).toContain("  ");
    expect(catalogContent.startsWith("[\n")).toBe(true);

    // Each entry should have expected fields
    for (const entry of catalog) {
      expect(entry).toHaveProperty("name");
      expect(entry).toHaveProperty("displayName");
      expect(entry).toHaveProperty("description");
      expect(entry).toHaveProperty("harnesses");
      expect(entry).toHaveProperty("type");
      expect(entry).toHaveProperty("path");
    }
  });

  /**
   * Validates: Requirement 19.4
   * `forge catalog generate` with no artifacts produces an empty array.
   */
  test("forge catalog generate with no artifacts produces empty catalog", async () => {
    await mkdir(join(tempDir, "knowledge"), { recursive: true });

    const { exitCode } = await runForge("catalog", "generate");

    expect(exitCode).toBe(0);

    const catalogContent = await readFile(join(tempDir, "catalog.json"), "utf-8");
    const catalog = JSON.parse(catalogContent);
    expect(catalog).toEqual([]);
  });
});
