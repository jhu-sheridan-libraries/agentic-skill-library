import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import { autoUpdate } from "../auto-updater";
import type { GlobalCacheAPI } from "../global-cache";

/**
 * Property 15: Throttle skips remote check within interval
 *
 * For any current timestamp and last-sync timestamp where the elapsed time
 * is less than the configured throttle interval, the auto-updater SHALL skip
 * the remote version check and resolve from the existing cache.
 *
 * Validates: Requirements 6.4
 */

describe("Feature: team-mode-distribution, Property 15: Throttle skips remote check within interval", () => {
  test("auto-updater skips remote check when elapsed time < throttle interval", async () => {
    await fc.assert(
      fc.asyncProperty(
        // throttleMinutes: 1–120
        fc.integer({ min: 1, max: 120 }),
        // elapsedMinutes: 0 to throttleMinutes-1 (fractional for finer granularity)
        fc.integer({ min: 1, max: 120 }),
        fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
        async (throttleMinutes, rawElapsed, fraction) => {
          // Ensure elapsedMinutes is strictly less than throttleMinutes
          const elapsedMinutes = Math.min(rawElapsed, throttleMinutes - 1) * fraction;
          const elapsedMs = elapsedMinutes * 60 * 1000;

          // Compute lastCheckDate so that Date.now() - lastCheckDate < intervalMs
          const now = Date.now();
          const lastCheckDate = new Date(now - elapsedMs);

          let writeThrottleCalled = false;

          const mockCache: GlobalCacheAPI = {
            root: "/mock/.forge",
            readThrottleState: async () => lastCheckDate,
            writeThrottleState: async () => {
              writeThrottleCalled = true;
            },
            listVersions: async () => [],
            distPath: () => "",
            has: async () => false,
            store: async () => {},
            readCollectionCatalog: async () => [],
            writeCatalogMeta: async () => {},
          };

          const result = await autoUpdate([], undefined, {
            throttleMinutes,
            cache: mockCache,
            configBackends: new Map(),
          });

          // Assert: skipped is true (throttle kicked in)
          expect(result.skipped).toBe(true);

          // Assert: no artifacts were updated
          expect(result.updated).toEqual([]);

          // Assert: writeThrottleState was NOT called (check was skipped entirely)
          expect(writeThrottleCalled).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
