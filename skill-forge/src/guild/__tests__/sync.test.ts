import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GlobalCache } from "../global-cache";
import { sync } from "../sync";
import type { SyncOptions } from "../sync";
import { printManifest } from "../manifest";
import type { BackendConfig } from "../../backends/types";

/**
 * Unit tests for `guild sync` dry-run and harness filtering.
 * Requirements: 5.6, 5.7
 *
 * These tests use a real temp-dir GlobalCache and manifest files
 * to verify that --dry-run produces no file writes and --harness
 * filters materialization to a single harness.
 */

let tempDir: string;
let cacheDir: string;
let cache: GlobalCache;
let workDir: string;

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "guild-sync-test-"));
  cacheDir = join(tempDir, "cache");
  workDir = join(tempDir, "work");
  cache = new GlobalCache(cacheDir);
  await mkdir(workDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

/**
 * Seed the global cache with an artifact at a given version for specified harnesses.
 */
async function seedCache(
  artifactName: string,
  version: string,
  harnesses: string[],
): Promise<void> {
  for (const h of harnesses) {
    const srcDir = join(tempDir, "_seed", artifactName, version, h);
    await mkdir(srcDir, { recursive: true });
    await writeFile(join(srcDir, "rule.md"), `# ${artifactName} (${h})`);
    await cache.store(artifactName, version, h, srcDir, "test-backend");
  }
}

/**
 * Write a manifest file and return its path.
 */
async function writeManifest(
  dir: string,
  artifacts: Array<{ name: string; version: string; mode?: string; harnesses?: string[] }>,
): Promise<string> {
  const forgeDir = join(dir, ".forge");
  await mkdir(forgeDir, { recursive: true });
  const manifestPath = join(forgeDir, "manifest.yaml");
  const manifest = {
    artifacts: artifacts.map((a) => ({
      name: a.name,
      version: a.version,
      mode: a.mode ?? "required",
      ...(a.harnesses ? { harnesses: a.harnesses } : {}),
    })),
  };
  await writeFile(manifestPath, printManifest(manifest), "utf-8");
  return manifestPath;
}

// Provide a dummy config backends map so sync doesn't try to load forge.config.yaml
const emptyBackends = new Map<string, BackendConfig>();

// ---------------------------------------------------------------------------
// Tests: --dry-run (Req 5.6)
// ---------------------------------------------------------------------------

describe("guild sync — dry-run", () => {
  test("dry-run produces no file writes (Req 5.6)", async () => {
    await seedCache("my-skill", "1.0.0", ["kiro"]);

    const manifestPath = await writeManifest(workDir, [
      { name: "my-skill", version: "1.0.0", harnesses: ["kiro"] },
    ]);

    const result = await sync({
      manifestPath,
      dryRun: true,
      cache,
      configBackends: emptyBackends,
    });

    // Should have no errors
    expect(result.errors).toHaveLength(0);
    // filesWritten should be 0 in dry-run
    expect(result.filesWritten).toBe(0);
    // Warnings should contain dry-run messages
    expect(result.warnings.some((w) => w.includes("[dry-run]"))).toBe(true);
  });

  test("dry-run does not write sync-lock.json (Req 5.6)", async () => {
    await seedCache("my-skill", "1.0.0", ["kiro"]);

    const manifestPath = await writeManifest(workDir, [
      { name: "my-skill", version: "1.0.0", harnesses: ["kiro"] },
    ]);

    await sync({
      manifestPath,
      dryRun: true,
      cache,
      configBackends: emptyBackends,
    });

    const lockPath = join(workDir, ".forge", "sync-lock.json");
    expect(await pathExists(lockPath)).toBe(false);
  });

  test("dry-run lists files that would be materialized", async () => {
    await seedCache("my-skill", "1.0.0", ["kiro", "cursor"]);

    const manifestPath = await writeManifest(workDir, [
      { name: "my-skill", version: "1.0.0", harnesses: ["kiro", "cursor"] },
    ]);

    const result = await sync({
      manifestPath,
      dryRun: true,
      cache,
      configBackends: emptyBackends,
    });

    const dryRunWarnings = result.warnings.filter((w) => w.includes("[dry-run]"));
    expect(dryRunWarnings.length).toBeGreaterThan(0);
  });

  test("dry-run resolves entries correctly", async () => {
    await seedCache("skill-a", "1.0.0", ["kiro"]);
    await seedCache("skill-b", "2.0.0", ["kiro"]);

    const manifestPath = await writeManifest(workDir, [
      { name: "skill-a", version: "1.0.0", harnesses: ["kiro"] },
      { name: "skill-b", version: "2.0.0", harnesses: ["kiro"] },
    ]);

    const result = await sync({
      manifestPath,
      dryRun: true,
      cache,
      configBackends: emptyBackends,
    });

    expect(result.errors).toHaveLength(0);
    expect(result.resolved).toHaveLength(2);
    expect(result.resolved[0].name).toBe("skill-a");
    expect(result.resolved[1].name).toBe("skill-b");
  });
});

// ---------------------------------------------------------------------------
// Tests: --harness filtering (Req 5.7)
// ---------------------------------------------------------------------------

describe("guild sync — harness filtering", () => {
  test("--harness filters materialization to single harness (Req 5.7)", async () => {
    await seedCache("my-skill", "1.0.0", ["kiro", "cursor", "claude-code"]);

    const manifestPath = await writeManifest(workDir, [
      { name: "my-skill", version: "1.0.0", harnesses: ["kiro", "cursor", "claude-code"] },
    ]);

    const result = await sync({
      manifestPath,
      harness: "kiro",
      cache,
      configBackends: emptyBackends,
    });

    expect(result.errors).toHaveLength(0);
    expect(result.filesWritten).toBeGreaterThan(0);

    // Resolved entries should include all harnesses from the manifest,
    // but only kiro files should have been written
    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0].harnesses).toContain("kiro");
  });

  test("--harness with non-matching harness writes no files", async () => {
    await seedCache("my-skill", "1.0.0", ["kiro"]);

    const manifestPath = await writeManifest(workDir, [
      { name: "my-skill", version: "1.0.0", harnesses: ["kiro"] },
    ]);

    const result = await sync({
      manifestPath,
      harness: "cursor",
      cache,
      configBackends: emptyBackends,
    });

    expect(result.errors).toHaveLength(0);
    // No files should be written since the artifact only has kiro harness
    expect(result.filesWritten).toBe(0);
  });

  test("--harness combined with --dry-run shows only filtered harness", async () => {
    await seedCache("my-skill", "1.0.0", ["kiro", "cursor"]);

    const manifestPath = await writeManifest(workDir, [
      { name: "my-skill", version: "1.0.0", harnesses: ["kiro", "cursor"] },
    ]);

    const result = await sync({
      manifestPath,
      harness: "kiro",
      dryRun: true,
      cache,
      configBackends: emptyBackends,
    });

    expect(result.errors).toHaveLength(0);
    expect(result.filesWritten).toBe(0);

    // Dry-run warnings should only reference kiro paths
    const dryRunWarnings = result.warnings.filter((w) => w.includes("[dry-run]"));
    for (const w of dryRunWarnings) {
      expect(w).toContain("kiro");
      expect(w).not.toContain("cursor");
    }
  });
});
