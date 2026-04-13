import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import { resolveEntryBackend } from "../backend-resolver";
import type { BackendConfig } from "../../backends/types";

/**
 * Property 7: Backend resolution precedence chain
 *
 * For any combination of entry-level backend, manifest-level backend, and
 * config-level default backend, the resolved backend for a manifest entry
 * SHALL be the first non-undefined value in the order:
 * entry-level → manifest-level → config-level.
 *
 * Feature: team-mode-distribution, Property 7: Backend resolution precedence chain
 *
 * Validates: Requirements 2.9, 12.1
 */

/** Generate an optional backend name string. */
const optionalBackendArb = fc.option(
  fc.stringMatching(/^[a-z][a-z0-9-]{2,15}$/),
  { nil: undefined },
);

describe("Feature: team-mode-distribution, Property 7: Backend resolution precedence chain", () => {
  test("resolved backend is the first non-undefined in [entry, manifest, configDefault]", () => {
    fc.assert(
      fc.property(
        optionalBackendArb,
        optionalBackendArb,
        optionalBackendArb,
        (entryBackend, manifestBackend, configDefault) => {
          // Build configBackends map containing all non-undefined names
          const configBackends = new Map<string, BackendConfig>();
          const minimalConfig: BackendConfig = { type: "local", path: "/tmp" };

          for (const name of [entryBackend, manifestBackend, configDefault]) {
            if (name !== undefined) {
              configBackends.set(name, minimalConfig);
            }
          }

          // If configDefault is provided, ensure it's the first key in the map
          // by rebuilding with configDefault first (Map preserves insertion order)
          if (configDefault !== undefined) {
            const rebuilt = new Map<string, BackendConfig>();
            rebuilt.set(configDefault, minimalConfig);
            for (const [k, v] of configBackends) {
              if (k !== configDefault) rebuilt.set(k, v);
            }
            // Use rebuilt map so firstKey matches configDefault
            const result = resolveEntryBackend(entryBackend, manifestBackend, rebuilt);
            const expected = entryBackend ?? manifestBackend ?? configDefault;

            if (expected === undefined) {
              expect(result).toBeNull();
            } else {
              expect(result).not.toBeNull();
              expect(result!.name).toBe(expected);
            }
          } else {
            const result = resolveEntryBackend(entryBackend, manifestBackend, configBackends);
            const expected = entryBackend ?? manifestBackend ?? undefined;

            if (expected === undefined) {
              expect(result).toBeNull();
            } else {
              expect(result).not.toBeNull();
              expect(result!.name).toBe(expected);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
