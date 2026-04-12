import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, readFile, cp, exists } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import matter from "gray-matter";
import { newCommand } from "../new";

const TEMPLATES_SRC = resolve(import.meta.dir, "../../templates/knowledge");

let tempDir: string;
let originalCwd: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "new-test-"));
  // Copy scaffold templates into the temp dir so newCommand can find them
  await cp(TEMPLATES_SRC, join(tempDir, "templates", "knowledge"), { recursive: true });
  originalCwd = process.cwd();
  process.chdir(tempDir);
});

afterEach(async () => {
  process.chdir(originalCwd);
  await rm(tempDir, { recursive: true, force: true });
});

describe("forge new", () => {
  /**
   * Validates: Requirements 17.1, 17.3
   * Scaffold creates the correct directory structure:
   * knowledge/<name>/knowledge.md, workflows/, hooks.yaml, mcp-servers.yaml
   */
  test("scaffold creates correct directory structure", async () => {
    await newCommand("my-test-artifact", { yes: true });

    const artifactDir = join(tempDir, "knowledge", "my-test-artifact");

    // knowledge.md exists
    expect(await exists(join(artifactDir, "knowledge.md"))).toBe(true);
    // workflows/ directory exists
    expect(await exists(join(artifactDir, "workflows"))).toBe(true);
    // hooks.yaml exists
    expect(await exists(join(artifactDir, "hooks.yaml"))).toBe(true);
    // mcp-servers.yaml exists
    expect(await exists(join(artifactDir, "mcp-servers.yaml"))).toBe(true);
  });

  /**
   * Validates: Requirement 17.2
   * Frontmatter should have: name, displayName (title-cased), description (placeholder),
   * keywords (empty), author (placeholder), harnesses (all 7)
   */
  test("scaffold populates frontmatter correctly", async () => {
    await newCommand("code-review", { yes: true });

    const knowledgeMd = await readFile(
      join(tempDir, "knowledge", "code-review", "knowledge.md"),
      "utf-8",
    );
    const { data } = matter(knowledgeMd);

    expect(data.name).toBe("code-review");
    expect(data.displayName).toBe("Code Review");
    expect(data.description).toContain("TODO");
    expect(data.keywords).toEqual([]);
    expect(data.author).toContain("TODO");
    expect(data.harnesses).toEqual([
      "kiro",
      "claude-code",
      "copilot",
      "cursor",
      "windsurf",
      "cline",
      "qdeveloper",
    ]);
  });

  /**
   * Validates: Requirements 8.1, 8.2, 8.3, 8.4
   * Scaffold includes new metadata fields (categories, ecosystem, depends, enhances)
   * with YAML comments, and parsed frontmatter defaults them to empty arrays.
   */
  test("scaffold includes new metadata fields with YAML comments", async () => {
    await newCommand("meta-test", { yes: true });

    const raw = await readFile(
      join(tempDir, "knowledge", "meta-test", "knowledge.md"),
      "utf-8",
    );

    // Verify YAML comments are present in the raw file content
    expect(raw).toContain("# Categories: testing, security, code-style, devops, documentation, architecture, debugging, performance, accessibility");
    expect(raw).toContain("# Ecosystem: freeform kebab-case values");
    expect(raw).toContain("# Depends: artifact names this artifact depends on");
    expect(raw).toContain("# Enhances: artifact names this artifact enhances");

    // Verify parsed frontmatter has the four new fields as empty arrays
    const { data } = matter(raw);
    expect(data.categories).toEqual([]);
    expect(data.ecosystem).toEqual([]);
    expect(data.depends).toEqual([]);
    expect(data.enhances).toEqual([]);
  });

  /**
   * Validates: Requirement 17.4
   * Error when artifact directory already exists.
   */
  test("error when artifact directory already exists", async () => {
    // Create the directory first
    await mkdir(join(tempDir, "knowledge", "existing-artifact"), { recursive: true });

    // Mock process.exit to capture the exit call instead of terminating
    const originalExit = process.exit;
    let exitCode: number | undefined;
    process.exit = ((code?: number) => {
      exitCode = code;
      throw new Error(`process.exit(${code})`);
    }) as never;

    try {
      await newCommand("existing-artifact", { yes: true });
    } catch (e: unknown) {
      // Expected — process.exit throws
      expect((e as Error).message).toBe("process.exit(1)");
    } finally {
      process.exit = originalExit;
    }

    expect(exitCode).toBe(1);
  });
});

/**
 * ─── CLI Flag Routing Tests ────────────────────────────────────────────────────
 * Validates: Requirements 1.1, 1.2, 1.3
 */

describe("CLI flag routing", () => {
  /**
   * Validates: Requirement 1.2
   * --yes flag skips the wizard: scaffold files retain template defaults (TODO placeholders).
   */
  test("--yes flag skips wizard and retains template defaults", async () => {
    await newCommand("skip-wizard-test", { yes: true });

    const knowledgeMd = await readFile(
      join(tempDir, "knowledge", "skip-wizard-test", "knowledge.md"),
      "utf-8",
    );
    const { data, content } = matter(knowledgeMd);

    // Template defaults should be present — wizard was NOT invoked
    expect(data.description).toContain("TODO");
    expect(data.author).toContain("TODO");
    expect(data.keywords).toEqual([]);
    expect(content).toContain("TODO");
  });

  /**
   * Validates: Requirement 1.3
   * Existing directory produces an error message mentioning the artifact name.
   */
  test("existing directory error message mentions artifact name", async () => {
    await mkdir(join(tempDir, "knowledge", "duplicate-name"), { recursive: true });

    const originalExit = process.exit;
    const originalError = console.error;
    const errorMessages: string[] = [];

    console.error = ((...args: unknown[]) => {
      errorMessages.push(args.map(String).join(" "));
    }) as typeof console.error;

    process.exit = ((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as never;

    try {
      await newCommand("duplicate-name", { yes: true });
    } catch {
      // Expected — process.exit throws
    } finally {
      process.exit = originalExit;
      console.error = originalError;
    }

    const combined = errorMessages.join("\n");
    expect(combined).toContain("duplicate-name");
    expect(combined).toContain("already exists");
  });
});


