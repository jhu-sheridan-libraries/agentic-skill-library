import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { GlobalCache } from "../global-cache";
import { printManifest } from "../manifest";
import type { SyncLock } from "../sync";

/**
 * Unit tests for `guild status` output formatting.
 * Requirements: 9.2, 11.6
 *
 * These tests verify that the status command displays:
 * - A table with version pin, resolved version, and up-to-date status (Req 9.2)
 * - Collection members grouped under their collection name (Req 11.6)
 *
 * Since guildStatus() calls process.exit and writes to console directly,
 * we test the underlying data assembly logic by replicating the status
 * row-building logic and verifying the output structure.
 */

let tempDir: string;
let cacheDir: string;
let cache: GlobalCache;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "guild-status-test-"));
  cacheDir = join(tempDir, "cache");
  cache = new GlobalCache(cacheDir);
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helper: build status rows (mirrors guildStatus logic)
// ---------------------------------------------------------------------------

interface StatusRow {
  name: string;
  versionPin: string;
  resolvedVersion: string;
  upToDate: boolean;
  source?: string;
}

async function buildStatusRows(
  manifestYaml: string,
  syncLock: SyncLock | null,
  testCache: GlobalCache,
): Promise<StatusRow[]> {
  const { parseManifest, isCollectionRef } = await import("../manifest");
  const manifest = parseManifest(manifestYaml);
  const rows: StatusRow[] = [];

  for (const entry of manifest.artifacts) {
    if (isCollectionRef(entry)) {
      const col = entry as { collection: string; version: string; mode: string };
      const members = await testCache.readCollectionCatalog(col.collection, col.version);

      for (const member of members) {
        const lockEntry = syncLock?.entries.find(
          (e) => e.name === member.name && e.source === col.collection,
        );
        const resolvedVersion = lockEntry?.version ?? "missing";
        const latestVersions = await testCache.listVersions(member.name);
        const sorted = latestVersions.sort();
        const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;
        const upToDate =
          resolvedVersion !== "missing" && latest !== null && resolvedVersion === latest;

        rows.push({
          name: member.name,
          versionPin: col.version,
          resolvedVersion,
          upToDate,
          source: col.collection,
        });
      }
    } else {
      const art = entry as { name: string; version: string };
      const lockEntry = syncLock?.entries.find(
        (e) => e.name === art.name && !e.source,
      );
      const resolvedVersion = lockEntry?.version ?? "missing";
      const latestVersions = await testCache.listVersions(art.name);
      const sorted = latestVersions.sort();
      const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;
      const upToDate =
        resolvedVersion !== "missing" && latest !== null && resolvedVersion === latest;

      rows.push({
        name: art.name,
        versionPin: art.version,
        resolvedVersion,
        upToDate,
      });
    }
  }

  return rows;
}

async function seedCacheVersion(name: string, version: string): Promise<void> {
  const srcDir = join(tempDir, "_seed", name, version);
  await mkdir(srcDir, { recursive: true });
  await writeFile(join(srcDir, "file.md"), "content");
  await cache.store(name, version, "kiro", srcDir, "test");
}

// ---------------------------------------------------------------------------
// Tests: Table output with resolved/missing versions (Req 9.2)
// ---------------------------------------------------------------------------

describe("guild status — table output", () => {
  test("shows resolved version from sync-lock (Req 9.2)", async () => {
    await seedCacheVersion("my-skill", "1.2.3");

    const manifestYaml = printManifest({
      artifacts: [{ name: "my-skill", version: "^1.0.0", mode: "required" }],
    });

    const syncLock: SyncLock = {
      syncedAt: "2025-01-15T10:30:00Z",
      entries: [
        { name: "my-skill", version: "1.2.3", harnesses: ["kiro"], backend: "github" },
      ],
    };

    const rows = await buildStatusRows(manifestYaml, syncLock, cache);

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("my-skill");
    expect(rows[0].versionPin).toBe("^1.0.0");
    expect(rows[0].resolvedVersion).toBe("1.2.3");
    expect(rows[0].upToDate).toBe(true);
  });

  test("shows 'missing' when artifact not in sync-lock (Req 9.2)", async () => {
    const manifestYaml = printManifest({
      artifacts: [{ name: "missing-skill", version: "^1.0.0", mode: "required" }],
    });

    const rows = await buildStatusRows(manifestYaml, null, cache);

    expect(rows).toHaveLength(1);
    expect(rows[0].resolvedVersion).toBe("missing");
    expect(rows[0].upToDate).toBe(false);
  });

  test("shows not up-to-date when resolved version differs from latest cached", async () => {
    await seedCacheVersion("my-skill", "1.0.0");
    await seedCacheVersion("my-skill", "2.0.0");

    const manifestYaml = printManifest({
      artifacts: [{ name: "my-skill", version: "^1.0.0", mode: "required" }],
    });

    const syncLock: SyncLock = {
      syncedAt: "2025-01-15T10:30:00Z",
      entries: [
        { name: "my-skill", version: "1.0.0", harnesses: ["kiro"], backend: "github" },
      ],
    };

    const rows = await buildStatusRows(manifestYaml, syncLock, cache);

    expect(rows).toHaveLength(1);
    expect(rows[0].resolvedVersion).toBe("1.0.0");
    expect(rows[0].upToDate).toBe(false);
  });

  test("handles multiple artifacts in status output", async () => {
    await seedCacheVersion("skill-a", "1.0.0");
    await seedCacheVersion("skill-b", "2.0.0");

    const manifestYaml = printManifest({
      artifacts: [
        { name: "skill-a", version: "1.0.0", mode: "required" },
        { name: "skill-b", version: "^2.0.0", mode: "optional" },
      ],
    });

    const syncLock: SyncLock = {
      syncedAt: "2025-01-15T10:30:00Z",
      entries: [
        { name: "skill-a", version: "1.0.0", harnesses: ["kiro"], backend: "github" },
        { name: "skill-b", version: "2.0.0", harnesses: ["kiro"], backend: "github" },
      ],
    };

    const rows = await buildStatusRows(manifestYaml, syncLock, cache);

    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("skill-a");
    expect(rows[1].name).toBe("skill-b");
  });
});

// ---------------------------------------------------------------------------
// Tests: Collection member grouping (Req 11.6)
// ---------------------------------------------------------------------------

describe("guild status — collection member grouping", () => {
  test("groups collection members under collection name (Req 11.6)", async () => {
    // Seed collection catalog
    await cache.writeCatalogMeta("neon-caravan", "1.0.0", [
      { name: "prompt-engineering" },
      { name: "code-review" },
    ]);

    // Seed cache versions for members
    await seedCacheVersion("prompt-engineering", "1.0.0");
    await seedCacheVersion("code-review", "1.0.0");

    const manifestYaml = printManifest({
      artifacts: [
        { collection: "neon-caravan", version: "1.0.0", mode: "required" },
      ],
    });

    const syncLock: SyncLock = {
      syncedAt: "2025-01-15T10:30:00Z",
      entries: [
        { name: "prompt-engineering", version: "1.0.0", source: "neon-caravan", harnesses: ["kiro"], backend: "github" },
        { name: "code-review", version: "1.0.0", source: "neon-caravan", harnesses: ["kiro"], backend: "github" },
      ],
    };

    const rows = await buildStatusRows(manifestYaml, syncLock, cache);

    expect(rows).toHaveLength(2);
    // Both should have source set to the collection name
    expect(rows[0].source).toBe("neon-caravan");
    expect(rows[1].source).toBe("neon-caravan");
    expect(rows[0].name).toBe("prompt-engineering");
    expect(rows[1].name).toBe("code-review");
  });

  test("individual entries have no source field", async () => {
    await seedCacheVersion("standalone-skill", "1.0.0");

    const manifestYaml = printManifest({
      artifacts: [{ name: "standalone-skill", version: "1.0.0", mode: "required" }],
    });

    const syncLock: SyncLock = {
      syncedAt: "2025-01-15T10:30:00Z",
      entries: [
        { name: "standalone-skill", version: "1.0.0", harnesses: ["kiro"], backend: "github" },
      ],
    };

    const rows = await buildStatusRows(manifestYaml, syncLock, cache);

    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBeUndefined();
  });

  test("mixed individual and collection entries are both represented", async () => {
    await cache.writeCatalogMeta("my-collection", "1.0.0", [
      { name: "member-a" },
    ]);
    await seedCacheVersion("member-a", "1.0.0");
    await seedCacheVersion("standalone", "2.0.0");

    const manifestYaml = printManifest({
      artifacts: [
        { name: "standalone", version: "2.0.0", mode: "required" },
        { collection: "my-collection", version: "1.0.0", mode: "required" },
      ],
    });

    const syncLock: SyncLock = {
      syncedAt: "2025-01-15T10:30:00Z",
      entries: [
        { name: "standalone", version: "2.0.0", harnesses: ["kiro"], backend: "github" },
        { name: "member-a", version: "1.0.0", source: "my-collection", harnesses: ["kiro"], backend: "github" },
      ],
    };

    const rows = await buildStatusRows(manifestYaml, syncLock, cache);

    expect(rows).toHaveLength(2);
    // First is individual (no source)
    expect(rows[0].source).toBeUndefined();
    expect(rows[0].name).toBe("standalone");
    // Second is from collection
    expect(rows[1].source).toBe("my-collection");
    expect(rows[1].name).toBe("member-a");
  });

  test("collection members show 'missing' when not in sync-lock", async () => {
    await cache.writeCatalogMeta("my-collection", "1.0.0", [
      { name: "member-a" },
    ]);

    const manifestYaml = printManifest({
      artifacts: [
        { collection: "my-collection", version: "1.0.0", mode: "required" },
      ],
    });

    const rows = await buildStatusRows(manifestYaml, null, cache);

    expect(rows).toHaveLength(1);
    expect(rows[0].resolvedVersion).toBe("missing");
    expect(rows[0].upToDate).toBe(false);
    expect(rows[0].source).toBe("my-collection");
  });
});
