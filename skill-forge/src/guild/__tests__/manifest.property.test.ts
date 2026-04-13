import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import { parseManifest, printManifest } from "../manifest";
import { SUPPORTED_HARNESSES } from "../../schemas";

/**
 * Property 1: Manifest round-trip
 *
 * For any valid Manifest object, serializing it to YAML via printManifest
 * and then parsing the result via parseManifest SHALL produce a Manifest
 * object that is deeply equal to the original.
 *
 * Validates: Requirements 3.1, 3.2, 3.3
 */

// --- Generators ---

/** Generate a non-empty identifier string (alphanumeric + hyphens, starts with letter). */
const identifierArb = fc.stringMatching(/^[a-z][a-z0-9-]{0,19}$/);

/** Generate a semver-like version pin string. */
const versionPinArb = fc.oneof(
  // Exact version: "1.2.3"
  fc.tuple(fc.integer({ min: 0, max: 99 }), fc.integer({ min: 0, max: 99 }), fc.integer({ min: 0, max: 99 }))
    .map(([a, b, c]) => `${a}.${b}.${c}`),
  // Caret range: "^1.0.0"
  fc.tuple(fc.integer({ min: 0, max: 99 }), fc.integer({ min: 0, max: 99 }), fc.integer({ min: 0, max: 99 }))
    .map(([a, b, c]) => `^${a}.${b}.${c}`),
  // Tilde range: "~1.2.0"
  fc.tuple(fc.integer({ min: 0, max: 99 }), fc.integer({ min: 0, max: 99 }), fc.integer({ min: 0, max: 99 }))
    .map(([a, b, c]) => `~${a}.${b}.${c}`),
);

/** Generate a non-empty subset of recognized harness names, or undefined. */
const harnessesArb = fc.oneof(
  fc.constant(undefined),
  fc
    .subarray([...SUPPORTED_HARNESSES], { minLength: 1 })
    .map((arr) => [...arr]),
);

/** Generate a single artifact manifest entry. */
const artifactEntryArb = fc.record({
  name: identifierArb,
  version: versionPinArb,
  mode: fc.constantFrom("required" as const, "optional" as const),
  harnesses: harnessesArb,
  backend: fc.oneof(fc.constant(undefined), identifierArb),
});

/** Generate a single collection manifest entry. */
const collectionEntryArb = fc.record({
  collection: identifierArb,
  version: versionPinArb,
  mode: fc.constantFrom("required" as const, "optional" as const),
  harnesses: harnessesArb,
  backend: fc.oneof(fc.constant(undefined), identifierArb),
});

/** Generate a manifest entry (artifact or collection). */
const manifestEntryArb = fc.oneof(artifactEntryArb, collectionEntryArb);

/** Generate a valid Manifest object with 0–10 entries. */
const manifestArb = fc.record({
  backend: fc.oneof(fc.constant(undefined), identifierArb),
  artifacts: fc.array(manifestEntryArb, { minLength: 0, maxLength: 10 }),
});

// --- Helpers ---

/** Strip undefined values from an object (recursively) to match YAML round-trip behavior. */
function stripUndefined(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(stripUndefined);
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (value !== undefined) {
        result[key] = stripUndefined(value);
      }
    }
    return result;
  }
  return obj;
}

// --- Property Test ---

describe("Feature: team-mode-distribution, Property 1: Manifest round-trip", () => {
  test("parseManifest(printManifest(m)) deeply equals m for any valid Manifest", () => {
    fc.assert(
      fc.property(manifestArb, (manifest) => {
        const yaml = printManifest(manifest);
        const warnings: string[] = [];
        const parsed = parseManifest(yaml, warnings);

        // No warnings should be emitted since we only use recognized harnesses
        expect(warnings).toEqual([]);

        // Strip undefined keys for comparison since YAML serialization drops them
        const expected = stripUndefined(manifest);
        const actual = stripUndefined(parsed);

        expect(actual).toEqual(expected);
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 2: Unknown top-level keys are preserved
 *
 * For any valid Manifest object augmented with arbitrary additional top-level
 * keys, parsing the printed YAML SHALL preserve all unknown keys in the
 * resulting object.
 *
 * Validates: Requirements 3.4
 */

describe("Feature: team-mode-distribution, Property 2: Unknown top-level keys preserved", () => {
  test("extra top-level keys survive round-trip through printManifest → parseManifest", () => {
    /** Generate a safe key that is not "backend" or "artifacts". */
    const extraKeyArb = identifierArb.filter(
      (k) => k !== "backend" && k !== "artifacts",
    );

    /** Generate a simple JSON-safe value (string, number, or boolean). */
    const extraValueArb = fc.oneof(
      fc.string({ minLength: 1, maxLength: 30 }),
      fc.integer({ min: -1000, max: 1000 }),
      fc.boolean(),
    );

    /** Generate 1–5 extra top-level key/value pairs. */
    const extraKeysArb = fc
      .uniqueArray(fc.tuple(extraKeyArb, extraValueArb), {
        minLength: 1,
        maxLength: 5,
        selector: ([k]) => k,
      })
      .map((pairs) => Object.fromEntries(pairs));

    /** Manifest with extra top-level keys. */
    const manifestWithExtrasArb = fc
      .tuple(manifestArb, extraKeysArb)
      .map(([manifest, extras]) => ({ ...manifest, ...extras }));

    fc.assert(
      fc.property(manifestWithExtrasArb, (manifest) => {
        const yamlStr = printManifest(manifest);
        const warnings: string[] = [];
        const parsed = parseManifest(yamlStr, warnings);

        // Every extra key (non-schema key) should be preserved
        for (const key of Object.keys(manifest)) {
          if (key === "backend" || key === "artifacts") continue;
          expect(parsed).toHaveProperty(key);
          expect((parsed as Record<string, unknown>)[key]).toEqual(
            (manifest as Record<string, unknown>)[key],
          );
        }
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 3: Mutual exclusivity of name and collection
 *
 * For any manifest entry object that has both a `name` field and a `collection`
 * field set, the manifest parser SHALL reject the entry with a validation error.
 *
 * Validates: Requirements 2.3, 2.11
 */

import yaml from "js-yaml";

describe("Feature: team-mode-distribution, Property 3: Mutual exclusivity of name and collection", () => {
  test("parseManifest rejects entries that have both name and collection set", () => {
    /** Generate an entry with both `name` and `collection` fields. */
    const bothFieldsEntryArb = fc.record({
      name: identifierArb,
      collection: identifierArb,
      version: versionPinArb,
      mode: fc.constantFrom("required" as const, "optional" as const),
    });

    /** Generate a manifest with 1–5 entries where at least one has both fields. */
    const invalidManifestArb = fc
      .tuple(
        bothFieldsEntryArb,
        fc.array(bothFieldsEntryArb, { minLength: 0, maxLength: 4 }),
      )
      .map(([first, rest]) => ({
        artifacts: [first, ...rest],
      }));

    fc.assert(
      fc.property(invalidManifestArb, (manifest) => {
        const yamlStr = yaml.dump(manifest, { lineWidth: -1, noRefs: true });
        expect(() => parseManifest(yamlStr)).toThrow(
          /has both "name" and "collection" fields set/,
        );
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 4: Unrecognized harness graceful degradation
 *
 * For any manifest entry containing a mix of recognized and unrecognized
 * harness names, parsing SHALL succeed, the result SHALL contain only the
 * recognized harness names, and a warning SHALL be emitted for each
 * unrecognized name.
 *
 * Validates: Requirements 3.5
 */

describe("Feature: team-mode-distribution, Property 4: Unrecognized harness graceful degradation", () => {
  test("parseManifest succeeds with only recognized harnesses kept and warnings for unrecognized ones", () => {
    /** Generate a random string that is NOT a recognized harness name. */
    const fakeHarnessArb = fc
      .stringMatching(/^[a-z][a-z0-9-]{1,15}$/)
      .filter((s) => !(SUPPORTED_HARNESSES as readonly string[]).includes(s));

    /** Generate a non-empty array with at least one fake harness and optionally some recognized ones. */
    const mixedHarnessesArb = fc
      .tuple(
        fc.array(fakeHarnessArb, { minLength: 1, maxLength: 4 }),
        fc.subarray([...SUPPORTED_HARNESSES], { minLength: 0, maxLength: 3 }),
      )
      .map(([fakes, recognized]) => [...recognized, ...fakes])
      .chain((arr) =>
        fc.shuffledSubarray(arr, { minLength: arr.length, maxLength: arr.length }),
      );

    /** Generate 1–5 artifact entries each with a mixed harness array. */
    const entriesArb = fc.array(
      fc.tuple(identifierArb, versionPinArb, mixedHarnessesArb).map(
        ([name, version, harnesses]) => ({ name, version, harnesses }),
      ),
      { minLength: 1, maxLength: 5 },
    );

    fc.assert(
      fc.property(entriesArb, (entries) => {
        const manifest = { artifacts: entries };
        const yamlStr = yaml.dump(manifest, { lineWidth: -1, noRefs: true });

        const warnings: string[] = [];
        const parsed = parseManifest(yamlStr, warnings);

        // Parsing must succeed (no throw — we got here)

        // Collect expected recognized and unrecognized harnesses per entry
        let expectedWarningCount = 0;
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const recognized = entry.harnesses.filter((h: string) =>
            (SUPPORTED_HARNESSES as readonly string[]).includes(h),
          );
          const unrecognized = entry.harnesses.filter(
            (h: string) => !(SUPPORTED_HARNESSES as readonly string[]).includes(h),
          );

          expectedWarningCount += unrecognized.length;

          const parsedEntry = parsed.artifacts[i];

          if (recognized.length > 0) {
            // Only recognized harnesses should remain
            expect(parsedEntry.harnesses).toBeDefined();
            expect(parsedEntry.harnesses!.sort()).toEqual(recognized.sort());
          } else {
            // All harnesses were unrecognized → harnesses set to undefined
            expect(parsedEntry.harnesses).toBeUndefined();
          }

          // Every unrecognized harness should have a corresponding warning
          for (const h of unrecognized) {
            const warningPattern = `Unrecognized harness "${h}" in entry "${entry.name}"`;
            expect(warnings.some((w) => w.includes(warningPattern))).toBe(true);
          }
        }

        // Total warnings should match total unrecognized harnesses
        expect(warnings.length).toBe(expectedWarningCount);
      }),
      { numRuns: 100 },
    );
  });
});
