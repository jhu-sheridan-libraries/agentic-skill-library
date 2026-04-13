import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import { resolveVersion } from "../version-resolver";

/**
 * Property 5: Version resolution picks highest satisfying version
 *
 * For any non-empty list of semver version strings and any valid semver range
 * pin, `resolveVersion` SHALL return the highest version that satisfies the
 * range, or null if no version satisfies it.
 *
 * Validates: Requirements 5.2
 */

// --- Generators ---

/** Generate a semver version string (major.minor.patch). */
const semverArb = fc
  .tuple(
    fc.integer({ min: 0, max: 30 }),
    fc.integer({ min: 0, max: 30 }),
    fc.integer({ min: 0, max: 30 }),
  )
  .map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

/** Generate a list of 1–20 semver version strings. */
const versionListArb = fc.array(semverArb, { minLength: 1, maxLength: 20 });

/** Generate a semver range pin: exact ("1.2.3"), caret ("^1.0.0"), or tilde ("~1.2.0"). */
const semverPinArb = fc.oneof(
  // Exact version
  semverArb,
  // Caret range: ^major.minor.patch
  semverArb.map((v) => `^${v}`),
  // Tilde range: ~major.minor.patch
  semverArb.map((v) => `~${v}`),
);

// --- Test ---

describe("Feature: team-mode-distribution, Property 5: Version resolution picks highest satisfying version", () => {
  test("resolveVersion returns the highest satisfying version or null", () => {
    fc.assert(
      fc.property(
        versionListArb,
        semverPinArb,
        (versions, pin) => {
          const result = resolveVersion("test-artifact", pin, versions);

          // Independently compute the expected result using Bun.semver
          const satisfying = versions.filter((v) =>
            Bun.semver.satisfies(v, pin),
          );
          const sorted = [...satisfying].sort(Bun.semver.order);
          const expectedHighest =
            sorted.length > 0 ? sorted[sorted.length - 1] : null;

          // Assert the resolved version matches our independent computation
          expect(result.resolvedVersion).toBe(expectedHighest);

          // Assert metadata fields are correct
          expect(result.name).toBe("test-artifact");
          expect(result.requestedVersion).toBe(pin);
          expect(result.availableVersions).toEqual(versions);
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 19: Unsatisfied version pin error content
 *
 * For any artifact name, version pin, and set of available versions where no
 * version satisfies the pin, the resolution result SHALL contain the artifact
 * name, the requested version pin, and the available versions — providing
 * enough information to construct a useful error message.
 *
 * Validates: Requirements 9.1
 */

/** Generate a non-empty artifact name. */
const artifactNameArb = fc
  .stringMatching(/^[a-z][a-z0-9-]{0,29}$/)
  .filter((s) => s.length > 0);

describe("Feature: team-mode-distribution, Property 19: Unsatisfied version pin error content", () => {
  test("unsatisfied pin result contains artifact name, requested pin, and available versions (non-empty list)", () => {
    fc.assert(
      fc.property(
        artifactNameArb,
        versionListArb,
        semverPinArb,
        (name, versions, pin) => {
          // Pre-condition: no version in the list satisfies the pin
          const hasSatisfying = versions.some((v) =>
            Bun.semver.satisfies(v, pin),
          );
          fc.pre(!hasSatisfying);

          const result = resolveVersion(name, pin, versions);

          // Resolution must be null (unsatisfied)
          expect(result.resolvedVersion).toBeNull();

          // Result contains the artifact name
          expect(result.name).toBe(name);

          // Result contains the requested version pin
          expect(result.requestedVersion).toBe(pin);

          // Result contains the available versions so error messages can list them
          expect(result.availableVersions).toEqual(versions);
          expect(result.availableVersions.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  test("unsatisfied pin result contains artifact name, requested pin, and empty available versions", () => {
    fc.assert(
      fc.property(
        artifactNameArb,
        semverPinArb,
        (name, pin) => {
          const result = resolveVersion(name, pin, []);

          // Resolution must be null (no versions at all)
          expect(result.resolvedVersion).toBeNull();

          // Result contains the artifact name
          expect(result.name).toBe(name);

          // Result contains the requested version pin
          expect(result.requestedVersion).toBe(pin);

          // Result contains empty available versions
          expect(result.availableVersions).toEqual([]);
        },
      ),
      { numRuns: 100 },
    );
  });
});
