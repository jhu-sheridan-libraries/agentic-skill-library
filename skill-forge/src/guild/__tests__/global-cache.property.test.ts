import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fc from "fast-check";
import { mkdtemp, rm, mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GlobalCache } from "../global-cache";

/**
 * Property 11: Idempotent global install
 *
 * For any artifact name and version that already exists in the Global_Cache,
 * calling store for the same name, version, and harness twice SHALL not modify
 * the cached files and the meta.json SHALL not be corrupted (harness not
 * duplicated).
 *
 * Validates: Requirements 1.4
 */

// --- Generators ---

/** Generate a kebab-case artifact name. */
const artifactNameArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,19}$/);

/** Generate a semver version string. */
const versionArb = fc
  .tuple(
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 }),
  )
  .map(([a, b, c]) => `${a}.${b}.${c}`);

/** Generate a harness name. */
const harnessArb = fc.constantFrom("kiro", "claude-code", "cursor", "copilot");

/** Generate a backend label. */
const backendArb = fc.constantFrom("github", "s3", "local", "http");

// --- Helpers ---

/** Recursively collect all relative file paths under a directory. */
async function collectFiles(
  dir: string,
  base = "",
): Promise<string[]> {
  const results: string[] = [];
  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      results.push(...(await collectFiles(join(dir, entry.name), rel)));
    } else {
      results.push(rel);
    }
  }
  return results;
}

/** Read all files under a directory and return a map of relative path → content. */
async function snapshotDir(dir: string): Promise<Map<string, string>> {
  const snapshot = new Map<string, string>();
  const files = await collectFiles(dir);
  for (const rel of files) {
    const content = await readFile(join(dir, rel), "utf-8");
    snapshot.set(rel, content);
  }
  return snapshot;
}

// --- Test ---

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "gc-prop11-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("Feature: team-mode-distribution, Property 11: Idempotent global install", () => {
  test("storing the same artifact+version+harness twice does not modify cached files and does not duplicate harness in meta.json", async () => {
    await fc.assert(
      fc.asyncProperty(
        artifactNameArb,
        versionArb,
        harnessArb,
        backendArb,
        async (name, version, harness, backend) => {
          // Create a fresh cache root for each iteration to avoid cross-contamination
          const cacheRoot = join(tempDir, `${name}-${version}-${harness}`);
          const cache = new GlobalCache(cacheRoot);

          // Create a temp source directory with a test file
          const srcDir = join(cacheRoot, "_src");
          await mkdir(srcDir, { recursive: true });
          await writeFile(join(srcDir, "rule.md"), `# ${name} v${version}`);

          // First store
          await cache.store(name, version, harness, srcDir, backend);

          // Snapshot the entire version directory after first store
          const versionDir = join(
            cacheRoot,
            "artifacts",
            name,
            version,
          );
          const snapshotAfterFirst = await snapshotDir(versionDir);

          // Read meta.json after first store
          const metaPath = join(versionDir, "meta.json");
          const metaAfterFirst = JSON.parse(await readFile(metaPath, "utf-8"));

          // Second store — same name, version, harness, source, backend
          await cache.store(name, version, harness, srcDir, backend);

          // Snapshot the entire version directory after second store
          const snapshotAfterSecond = await snapshotDir(versionDir);

          // Read meta.json after second store
          const metaAfterSecond = JSON.parse(await readFile(metaPath, "utf-8"));

          // Assert: same set of files
          expect([...snapshotAfterSecond.keys()].sort()).toEqual(
            [...snapshotAfterFirst.keys()].sort(),
          );

          // Assert: file contents are identical
          for (const [path, content] of snapshotAfterFirst) {
            // Skip meta.json for content comparison — we check it structurally below
            if (path === "meta.json") continue;
            expect(snapshotAfterSecond.get(path)).toBe(content);
          }

          // Assert: meta.json harness is NOT duplicated
          const harnessOccurrences = metaAfterSecond.harnesses.filter(
            (h: string) => h === harness,
          );
          expect(harnessOccurrences).toHaveLength(1);

          // Assert: meta.json structural fields are unchanged
          expect(metaAfterSecond.name).toBe(metaAfterFirst.name);
          expect(metaAfterSecond.version).toBe(metaAfterFirst.version);
          expect(metaAfterSecond.backend).toBe(metaAfterFirst.backend);
          expect(metaAfterSecond.harnesses).toEqual(metaAfterFirst.harnesses);
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 12: Version coexistence in global cache
 *
 * For any artifact name with version A already in the Global_Cache,
 * installing version B (where A ≠ B) SHALL result in both versions
 * A and B being present in the cache.
 *
 * Validates: Requirements 1.5
 */

describe("Feature: team-mode-distribution, Property 12: Version coexistence in global cache", () => {
  test("installing two distinct versions of the same artifact results in both being present in the cache", async () => {
    await fc.assert(
      fc.asyncProperty(
        artifactNameArb,
        versionArb,
        versionArb,
        harnessArb,
        backendArb,
        async (name, v1, v2, harness, backend) => {
          // Ensure the two versions are distinct
          fc.pre(v1 !== v2);

          // Create a fresh cache root for each iteration
          const cacheRoot = join(tempDir, `${name}-${v1}-${v2}`);
          const cache = new GlobalCache(cacheRoot);

          // Create source directories with distinct content for each version
          const srcDir1 = join(cacheRoot, "_src1");
          await mkdir(srcDir1, { recursive: true });
          await writeFile(join(srcDir1, "rule.md"), `# ${name} v${v1}`);

          const srcDir2 = join(cacheRoot, "_src2");
          await mkdir(srcDir2, { recursive: true });
          await writeFile(join(srcDir2, "rule.md"), `# ${name} v${v2}`);

          // Install version 1
          await cache.store(name, v1, harness, srcDir1, backend);

          // Install version 2
          await cache.store(name, v2, harness, srcDir2, backend);

          // Assert: both versions exist in the cache
          expect(await cache.has(name, v1)).toBe(true);
          expect(await cache.has(name, v2)).toBe(true);

          // Assert: listVersions contains both versions
          const versions = await cache.listVersions(name);
          expect(versions).toContain(v1);
          expect(versions).toContain(v2);
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 13: Cache path construction
 *
 * For any valid artifact name, version string, and harness name,
 * the constructed cache path SHALL match the pattern
 * `<cache-root>/artifacts/<name>/<version>/dist/<harness>/`.
 *
 * Validates: Requirements 1.6
 */

describe("Feature: team-mode-distribution, Property 13: Cache path construction", () => {
  test("distPath() matches <root>/artifacts/<name>/<version>/dist/<harness>/", () => {
    fc.assert(
      fc.property(
        artifactNameArb,
        versionArb,
        harnessArb,
        (name, version, harness) => {
          const cacheRoot = join(tempDir, "cache-p13");
          const cache = new GlobalCache(cacheRoot);

          const result = cache.distPath(name, version, harness);
          const expected = join(cacheRoot, "artifacts", name, version, "dist", harness);

          expect(result).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });
});
