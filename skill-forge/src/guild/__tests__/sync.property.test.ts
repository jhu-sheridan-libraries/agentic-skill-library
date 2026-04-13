import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import fc from "fast-check";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { sync } from "../sync";
import { printManifest } from "../manifest";
import type { GlobalCacheAPI } from "../global-cache";

/**
 * Property 6: Mode-dependent sync behavior for missing artifacts
 *
 * For any manifest entry whose artifact is not present in the Global_Cache,
 * if the entry's mode is "required" then sync SHALL produce a fatal error
 * for that entry, and if the mode is "optional" then sync SHALL emit a
 * warning and continue without error.
 *
 * Validates: Requirements 2.4, 2.5, 5.8, 5.9
 */

// --- Generators ---

/** Generate a non-empty identifier string (min 4 chars to avoid substring collisions). */
const identifierArb = fc.stringMatching(/^[a-z][a-z0-9-]{3,19}$/);

/** Generate a semver version pin string. */
const versionPinArb = fc
  .tuple(
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 }),
  )
  .map(([a, b, c]) => `${a}.${b}.${c}`);

/** Generate a manifest entry with a random mode. */
const manifestEntryArb = fc
  .tuple(
    identifierArb,
    versionPinArb,
    fc.constantFrom("required" as const, "optional" as const),
  )
  .map(([name, version, mode]) => ({ name, version, mode }));

/** Generate 1–5 unique manifest entries (unique by name, no name is substring of another). */
const manifestEntriesArb = fc
  .uniqueArray(manifestEntryArb, {
    minLength: 1,
    maxLength: 5,
    selector: (e) => e.name,
  })
  .filter((entries) => {
    // Ensure no entry name is a substring of another entry's name
    for (let i = 0; i < entries.length; i++) {
      for (let j = 0; j < entries.length; j++) {
        if (i !== j && entries[j].name.includes(entries[i].name)) {
          return false;
        }
      }
    }
    return true;
  });

// --- Test setup ---

let tempDir: string;

describe("Feature: team-mode-distribution, Property 6: Mode-dependent sync behavior", () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "sync-prop6-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("required entries produce errors and optional entries produce warnings when artifacts are missing from cache", async () => {
    await fc.assert(
      fc.asyncProperty(manifestEntriesArb, async (entries) => {
        // Write manifest to temp directory
        const forgeDir = join(tempDir, ".forge");
        await mkdir(forgeDir, { recursive: true });

        const manifest = {
          artifacts: entries.map((e) => ({
            name: e.name,
            version: e.version,
            mode: e.mode,
          })),
        };

        const manifestPath = join(forgeDir, "manifest.yaml");
        await writeFile(manifestPath, printManifest(manifest), "utf-8");

        // Mock cache that always returns empty versions (simulating missing artifacts)
        const mockCache: GlobalCacheAPI = {
          root: join(tempDir, "cache"),
          listVersions: async () => [],
          distPath: (name, version, harness) =>
            join(tempDir, "cache", "artifacts", name, version, "dist", harness),
          has: async () => false,
          store: async () => {},
          readCollectionCatalog: async () => [],
          writeCatalogMeta: async () => {},
          readThrottleState: async () => null,
          writeThrottleState: async () => {},
        };

        const result = await sync({
          manifestPath,
          cache: mockCache,
          configBackends: new Map(),
        });

        const requiredEntries = entries.filter((e) => e.mode === "required");
        const optionalEntries = entries.filter((e) => e.mode === "optional");

        // Assert: each required entry produces an error containing its quoted name
        for (const entry of requiredEntries) {
          const hasError = result.errors.some((err) =>
            err.includes(`"${entry.name}"`),
          );
          expect(hasError).toBe(true);
        }

        // Assert: each optional entry produces a warning containing its quoted name
        for (const entry of optionalEntries) {
          const hasWarning = result.warnings.some((w) =>
            w.includes(`"${entry.name}"`),
          );
          expect(hasWarning).toBe(true);
        }

        // Assert: optional entries do NOT appear in errors (by quoted name)
        for (const entry of optionalEntries) {
          const hasError = result.errors.some((err) =>
            err.includes(`"${entry.name}"`),
          );
          expect(hasError).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 9: Individual entry takes precedence over collection-inherited
 *
 * For any manifest where artifact X is both individually declared (with settings S₁)
 * and a member of a referenced collection (with inherited settings S₂), the resolved
 * settings for X SHALL equal S₁.
 *
 * Validates: Requirements 11.3
 */

// --- Generators for Property 9 ---

/** Generate a non-empty identifier (min 4 chars, no substring collisions). */
const prop9IdentifierArb = fc.stringMatching(/^[a-z][a-z0-9-]{3,19}$/);

/** Generate an exact semver version string. */
const prop9VersionArb = fc
  .tuple(
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 }),
  )
  .map(([a, b, c]) => `${a}.${b}.${c}`);

/**
 * Generate a pair of distinct semver versions so the individual entry
 * and collection entry have different version pins.
 */
const prop9DistinctVersionsArb = fc
  .tuple(prop9VersionArb, prop9VersionArb)
  .filter(([a, b]) => a !== b);

/**
 * Generate test data for Property 9:
 * - overlappingName: artifact that appears both individually and in a collection
 * - collectionName: name of the collection
 * - individualVersion: version pin for the individual entry
 * - collectionVersion: version pin for the collection ref (inherited by members)
 * - individualMode: mode for the individual entry (always "optional" to distinguish from collection's "required")
 */
const prop9DataArb = fc
  .tuple(
    prop9IdentifierArb,
    prop9IdentifierArb,
    prop9DistinctVersionsArb,
  )
  .filter(([overlapping, collection]) => overlapping !== collection)
  .map(([overlappingName, collectionName, [individualVersion, collectionVersion]]) => ({
    overlappingName,
    collectionName,
    individualVersion,
    collectionVersion,
    individualMode: "optional" as const,
    collectionMode: "required" as const,
  }));

describe("Feature: team-mode-distribution, Property 9: Individual entry takes precedence over collection-inherited", () => {
  let prop9TempDir: string;

  beforeEach(async () => {
    prop9TempDir = await mkdtemp(join(tmpdir(), "sync-prop9-"));
  });

  afterEach(async () => {
    await rm(prop9TempDir, { recursive: true, force: true });
  });

  test("individual entry settings override collection-inherited settings for overlapping artifacts", async () => {
    await fc.assert(
      fc.asyncProperty(prop9DataArb, async (data) => {
        const {
          overlappingName,
          collectionName,
          individualVersion,
          collectionVersion,
          individualMode,
          collectionMode,
        } = data;

        // Write manifest with both an individual entry and a collection ref
        // whose members include the same artifact name
        const forgeDir = join(prop9TempDir, ".forge");
        await mkdir(forgeDir, { recursive: true });

        const manifest = {
          artifacts: [
            // Individual entry with distinct settings
            {
              name: overlappingName,
              version: individualVersion,
              mode: individualMode,
            },
            // Collection ref — its members will include overlappingName
            {
              collection: collectionName,
              version: collectionVersion,
              mode: collectionMode,
            },
          ],
        };

        const manifestPath = join(forgeDir, "manifest.yaml");
        await writeFile(manifestPath, printManifest(manifest), "utf-8");

        // Mock cache:
        // - readCollectionCatalog returns the overlapping artifact as a member
        // - listVersions returns the individual entry's version for the overlapping artifact
        const mockCache: GlobalCacheAPI = {
          root: join(prop9TempDir, "cache"),
          listVersions: async (artifactName: string) => {
            if (artifactName === overlappingName) {
              return [individualVersion];
            }
            return [];
          },
          distPath: (name, version, harness) =>
            join(prop9TempDir, "cache", "artifacts", name, version, "dist", harness),
          has: async () => false,
          store: async () => {},
          readCollectionCatalog: async (colName: string) => {
            if (colName === collectionName) {
              return [{ name: overlappingName }];
            }
            return [];
          },
          writeCatalogMeta: async () => {},
          readThrottleState: async () => null,
          writeThrottleState: async () => {},
        };

        const result = await sync({
          manifestPath,
          cache: mockCache,
          configBackends: new Map(),
          dryRun: true, // avoid file writes
        });

        // Find the resolved entry for the overlapping artifact
        const resolvedEntry = result.resolved.find(
          (e) => e.name === overlappingName,
        );

        // The overlapping artifact should be resolved (individual version is available)
        expect(resolvedEntry).toBeDefined();

        // Assert: individual entry's version takes precedence
        expect(resolvedEntry!.version).toBe(individualVersion);

        // Assert: individual entry's mode takes precedence ("optional", not "required")
        expect(resolvedEntry!.mode).toBe(individualMode);

        // Assert: there should be exactly one resolved entry for the overlapping artifact
        const matchingEntries = result.resolved.filter(
          (e) => e.name === overlappingName,
        );
        expect(matchingEntries).toHaveLength(1);
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 10: Sync-lock records collection source
 *
 * For any artifact that was resolved via collection expansion, its resolved
 * entry SHALL contain a `source` field equal to the originating collection name.
 *
 * Validates: Requirements 11.4
 */

// --- Generators for Property 10 ---

/** Generate a non-empty identifier (min 4 chars). */
const prop10IdentifierArb = fc.stringMatching(/^[a-z][a-z0-9-]{3,19}$/);

/** Generate an exact semver version string. */
const prop10VersionArb = fc
  .tuple(
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 }),
  )
  .map(([a, b, c]) => `${a}.${b}.${c}`);

/**
 * Generate test data for Property 10:
 * - collectionName: name of the collection
 * - collectionVersion: version pin for the collection ref
 * - memberNames: 1–5 unique member artifact names (distinct from collectionName)
 */
const prop10DataArb = fc
  .tuple(
    prop10IdentifierArb,
    prop10VersionArb,
    fc.uniqueArray(prop10IdentifierArb, { minLength: 1, maxLength: 5 }),
  )
  .filter(([collectionName, , members]) => {
    // Ensure collection name is not among member names
    if (members.includes(collectionName)) return false;
    // Ensure no member name is a substring of another
    for (let i = 0; i < members.length; i++) {
      for (let j = 0; j < members.length; j++) {
        if (i !== j && members[j].includes(members[i])) return false;
      }
    }
    return true;
  })
  .map(([collectionName, collectionVersion, memberNames]) => ({
    collectionName,
    collectionVersion,
    memberNames,
  }));

describe("Feature: team-mode-distribution, Property 10: Sync-lock records collection source", () => {
  let prop10TempDir: string;

  beforeEach(async () => {
    prop10TempDir = await mkdtemp(join(tmpdir(), "sync-prop10-"));
  });

  afterEach(async () => {
    await rm(prop10TempDir, { recursive: true, force: true });
  });

  test("each resolved entry from a collection expansion has source equal to the collection name", async () => {
    await fc.assert(
      fc.asyncProperty(prop10DataArb, async (data) => {
        const { collectionName, collectionVersion, memberNames } = data;

        // Write manifest with a single collection ref
        const forgeDir = join(prop10TempDir, ".forge");
        await mkdir(forgeDir, { recursive: true });

        const manifest = {
          artifacts: [
            {
              collection: collectionName,
              version: collectionVersion,
              mode: "required" as const,
            },
          ],
        };

        const manifestPath = join(forgeDir, "manifest.yaml");
        await writeFile(manifestPath, printManifest(manifest), "utf-8");

        // Mock cache:
        // - readCollectionCatalog returns the member names for the collection
        // - listVersions returns the collection version for each member
        const mockCache: GlobalCacheAPI = {
          root: join(prop10TempDir, "cache"),
          listVersions: async (artifactName: string) => {
            if (memberNames.includes(artifactName)) {
              return [collectionVersion];
            }
            return [];
          },
          distPath: (name, version, harness) =>
            join(prop10TempDir, "cache", "artifacts", name, version, "dist", harness),
          has: async () => false,
          store: async () => {},
          readCollectionCatalog: async (colName: string) => {
            if (colName === collectionName) {
              return memberNames.map((name) => ({ name }));
            }
            return [];
          },
          writeCatalogMeta: async () => {},
          readThrottleState: async () => null,
          writeThrottleState: async () => {},
        };

        const result = await sync({
          manifestPath,
          cache: mockCache,
          configBackends: new Map(),
          dryRun: true, // avoid file writes and CWD issues
        });

        // Assert: each member should be resolved
        expect(result.resolved).toHaveLength(memberNames.length);

        // Assert: each resolved entry from the collection has source === collectionName
        for (const memberName of memberNames) {
          const resolvedEntry = result.resolved.find(
            (e) => e.name === memberName,
          );
          expect(resolvedEntry).toBeDefined();
          expect(resolvedEntry!.source).toBe(collectionName);
        }
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 14: Artifact isolation in harness targets
 *
 * For any two distinct artifacts materialized to the same harness target,
 * their materialized file paths SHALL not overlap (each artifact occupies
 * its own subdirectory). Specifically, for any set of distinct artifact names
 * and any harness, `join(harnessBase, name)` produces paths where no path
 * is a prefix of another.
 *
 * Validates: Requirements 5.10
 */

// --- Generators for Property 14 ---

/** Mirror of the HARNESS_INSTALL_PATHS mapping from sync.ts */
const HARNESS_INSTALL_PATHS: Record<string, string> = {
  kiro: ".kiro",
  "claude-code": ".",
  copilot: ".",
  cursor: ".",
  windsurf: ".",
  cline: ".",
  qdeveloper: ".",
};

const harnessNames = Object.keys(HARNESS_INSTALL_PATHS);

/** Generate a harness name from the supported set. */
const prop14HarnessArb = fc.constantFrom(...harnessNames);

/** Generate a non-empty artifact identifier (min 3 chars to keep meaningful). */
const prop14ArtifactNameArb = fc.stringMatching(/^[a-z][a-z0-9-]{2,19}$/);

/**
 * Generate 2–5 distinct artifact names.
 * No name is a substring of another to avoid trivially overlapping identifiers
 * (the property is about path isolation, not name containment).
 */
const prop14ArtifactNamesArb = fc
  .uniqueArray(prop14ArtifactNameArb, { minLength: 2, maxLength: 5 })
  .filter((names) => {
    for (let i = 0; i < names.length; i++) {
      for (let j = 0; j < names.length; j++) {
        if (i !== j && names[j].includes(names[i])) return false;
      }
    }
    return true;
  });

describe("Feature: team-mode-distribution, Property 14: Artifact isolation in harness targets", () => {
  test("distinct artifact names targeting the same harness produce non-overlapping materialized paths", () => {
    fc.assert(
      fc.property(
        prop14ArtifactNamesArb,
        prop14HarnessArb,
        (artifactNames, harness) => {
          const harnessBase = HARNESS_INSTALL_PATHS[harness];

          // Compute materialized paths — mirrors sync.ts: join(harnessBase, entry.name)
          const paths = artifactNames.map((name) => join(harnessBase, name));

          // Assert: all paths are unique
          const uniquePaths = new Set(paths);
          expect(uniquePaths.size).toBe(paths.length);

          // Assert: no path is a prefix of another (neither startsWith the other + separator)
          for (let i = 0; i < paths.length; i++) {
            for (let j = 0; j < paths.length; j++) {
              if (i === j) continue;
              // Path A should not be a prefix of path B
              // Check both exact prefix and prefix-with-separator
              const isPrefix =
                paths[j].startsWith(paths[i] + "/") ||
                paths[j].startsWith(paths[i] + "\\") ||
                paths[i] === paths[j];
              expect(isPrefix).toBe(false);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
