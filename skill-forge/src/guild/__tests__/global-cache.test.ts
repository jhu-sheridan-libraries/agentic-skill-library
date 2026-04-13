import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GlobalCache } from "../global-cache";

let tempDir: string;
let cache: GlobalCache;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "global-cache-test-"));
  cache = new GlobalCache(tempDir);
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("GlobalCache", () => {
  test("root returns the configured root path", () => {
    expect(cache.root).toBe(tempDir);
  });

  test("has() returns false for non-existent artifact", async () => {
    expect(await cache.has("no-such-artifact", "1.0.0")).toBe(false);
  });

  test("listVersions() returns empty array for non-existent artifact", async () => {
    expect(await cache.listVersions("no-such-artifact")).toEqual([]);
  });

  test("distPath() constructs correct path", () => {
    const p = cache.distPath("my-skill", "1.2.3", "kiro");
    expect(p).toBe(join(tempDir, "artifacts", "my-skill", "1.2.3", "dist", "kiro"));
  });

  test("store() copies files and writes meta.json", async () => {
    // Create a source directory with a test file
    const srcDir = join(tempDir, "_src");
    await mkdir(srcDir, { recursive: true });
    await writeFile(join(srcDir, "rule.md"), "# Test Rule");

    await cache.store("my-skill", "1.0.0", "kiro", srcDir, "github");

    // Verify file was copied
    const copied = await readFile(
      join(cache.distPath("my-skill", "1.0.0", "kiro"), "rule.md"),
      "utf-8",
    );
    expect(copied).toBe("# Test Rule");

    // Verify meta.json
    const metaRaw = await readFile(
      join(tempDir, "artifacts", "my-skill", "1.0.0", "meta.json"),
      "utf-8",
    );
    const meta = JSON.parse(metaRaw);
    expect(meta.name).toBe("my-skill");
    expect(meta.version).toBe("1.0.0");
    expect(meta.backend).toBe("github");
    expect(meta.harnesses).toEqual(["kiro"]);
    expect(meta.installedAt).toBeTruthy();
  });

  test("store() appends harness to existing meta.json", async () => {
    const srcDir = join(tempDir, "_src");
    await mkdir(srcDir, { recursive: true });
    await writeFile(join(srcDir, "file.md"), "content");

    await cache.store("my-skill", "1.0.0", "kiro", srcDir, "github");
    await cache.store("my-skill", "1.0.0", "cursor", srcDir, "github");

    const metaRaw = await readFile(
      join(tempDir, "artifacts", "my-skill", "1.0.0", "meta.json"),
      "utf-8",
    );
    const meta = JSON.parse(metaRaw);
    expect(meta.harnesses).toEqual(["kiro", "cursor"]);
  });

  test("has() returns true after store()", async () => {
    const srcDir = join(tempDir, "_src");
    await mkdir(srcDir, { recursive: true });
    await writeFile(join(srcDir, "f.md"), "x");

    await cache.store("my-skill", "2.0.0", "kiro", srcDir, "local");
    expect(await cache.has("my-skill", "2.0.0")).toBe(true);
  });

  test("listVersions() returns stored versions", async () => {
    const srcDir = join(tempDir, "_src");
    await mkdir(srcDir, { recursive: true });
    await writeFile(join(srcDir, "f.md"), "x");

    await cache.store("my-skill", "1.0.0", "kiro", srcDir, "local");
    await cache.store("my-skill", "2.0.0", "kiro", srcDir, "local");

    const versions = await cache.listVersions("my-skill");
    expect(versions.sort()).toEqual(["1.0.0", "2.0.0"]);
  });

  test("readCollectionCatalog() returns empty array when no catalog exists", async () => {
    const entries = await cache.readCollectionCatalog("my-collection", "1.0.0");
    expect(entries).toEqual([]);
  });

  test("writeCatalogMeta() and readCollectionCatalog() round-trip", async () => {
    const entries = [{ name: "skill-a" }, { name: "skill-b" }];
    await cache.writeCatalogMeta("my-collection", "1.0.0", entries);

    const result = await cache.readCollectionCatalog("my-collection", "1.0.0");
    expect(result).toEqual(entries);
  });

  test("readThrottleState() returns null when no file exists", async () => {
    expect(await cache.readThrottleState()).toBeNull();
  });

  test("writeThrottleState() and readThrottleState() round-trip", async () => {
    const ts = new Date("2025-01-15T10:30:00.000Z");
    await cache.writeThrottleState(ts);

    const result = await cache.readThrottleState();
    expect(result).toEqual(ts);
  });
});
