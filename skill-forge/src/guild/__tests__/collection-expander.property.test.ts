import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import type { GlobalCacheAPI, CatalogEntry } from "../global-cache";
import { expandCollection } from "../collection-expander";

/**
 * Property 8: Collection expansion with setting inheritance
 *
 * For any collection ref with mode M, harnesses H, and backend B,
 * and a collection with N members, expansion SHALL produce exactly
 * N artifact refs, each with mode M, harnesses H, backend B, and
 * source set to the originating collection name.
 *
 * Validates: Requirements 5.3, 11.1, 11.2
 */

// --- Constants ---

const SUPPORTED_HARNESSES = [
  "kiro",
  "claude-code",
  "copilot",
  "cursor",
  "windsurf",
  "cline",
  "qdeveloper",
] as const;

// --- Generators ---

/** Generate a kebab-case collection name. */
const collectionNameArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,19}$/);

/** Generate a semver version string. */
const versionArb = fc
  .tuple(
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 }),
  )
  .map(([a, b, c]) => `${a}.${b}.${c}`);

/** Generate a mode value. */
const modeArb = fc.constantFrom("required" as const, "optional" as const);

/** Generate an optional array of harness names (subset of supported). */
const harnessesArb = fc.option(
  fc.subarray([...SUPPORTED_HARNESSES], { minLength: 1 }),
  { nil: undefined },
);

/** Generate an optional backend string. */
const backendArb = fc.option(
  fc.constantFrom("github", "s3", "local", "http"),
  { nil: undefined },
);

/** Generate a kebab-case member name. */
const memberNameArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,19}$/);

/** Generate 1–15 unique member names. */
const membersArb = fc
  .array(memberNameArb, { minLength: 1, maxLength: 15 })
  .map((names) => [...new Set(names)])
  .filter((names) => names.length >= 1);

// --- Helpers ---

/** Create a mock GlobalCacheAPI that returns the given members from readCollectionCatalog. */
function createMockCache(members: CatalogEntry[]): GlobalCacheAPI {
  return {
    root: "/mock/cache",
    listVersions: async () => [],
    distPath: () => "",
    has: async () => false,
    store: async () => {},
    readCollectionCatalog: async () => members,
    writeCatalogMeta: async () => {},
    readThrottleState: async () => null,
    writeThrottleState: async () => {},
  };
}

// --- Test ---

describe("Feature: team-mode-distribution, Property 8: Collection expansion with setting inheritance", () => {
  test("expansion produces exactly N refs each inheriting parent settings", async () => {
    await fc.assert(
      fc.asyncProperty(
        collectionNameArb,
        versionArb,
        modeArb,
        harnessesArb,
        backendArb,
        membersArb,
        async (collectionName, version, mode, harnesses, backend, memberNames) => {
          const catalogEntries: CatalogEntry[] = memberNames.map((name) => ({ name }));
          const cache = createMockCache(catalogEntries);

          const result = await expandCollection(
            collectionName,
            version,
            mode,
            harnesses,
            backend,
            cache,
          );

          // Assert: exactly N expanded artifacts
          expect(result).toHaveLength(memberNames.length);

          // Assert: each expanded artifact inherits parent settings
          for (let i = 0; i < result.length; i++) {
            const artifact = result[i];

            // Name matches the member
            expect(artifact.name).toBe(memberNames[i]);

            // Version inherited from collection ref
            expect(artifact.version).toBe(version);

            // Mode inherited from collection ref
            expect(artifact.mode).toBe(mode);

            // Harnesses inherited (present only if defined)
            if (harnesses !== undefined) {
              expect(artifact.harnesses).toEqual(harnesses);
            } else {
              expect(artifact.harnesses).toBeUndefined();
            }

            // Backend inherited (present only if defined)
            if (backend !== undefined) {
              expect(artifact.backend).toBe(backend);
            } else {
              expect(artifact.backend).toBeUndefined();
            }

            // Source set to collection name
            expect(artifact.source).toBe(collectionName);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
