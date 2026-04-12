import { describe, test, expect, mock } from "bun:test";
import fc from "fast-check";

// Mock @clack/prompts so wizard module can load without interactive prompts
mock.module("@clack/prompts", () => ({
  intro: () => {},
  outro: () => {},
  text: async () => "",
  select: async () => "",
  multiselect: async () => [],
  confirm: async () => false,
  cancel: () => {},
  note: () => {},
  log: { info: () => {}, step: () => {}, error: () => {}, warning: () => {} },
  isCancel: () => false,
}));

const { parseCommaSeparated, parseKeyValuePairs } = await import("../wizard");

// --- Arbitraries ---

/** A non-empty token that contains no commas and is not pure whitespace */
const tokenArb = () =>
  fc
    .string({ minLength: 1, maxLength: 20 })
    .filter((s) => !s.includes(",") && s.trim().length > 0)
    .map((s) => s.trim());

/** Optional whitespace padding (spaces and tabs) */
const wsArb = () =>
  fc.array(fc.constantFrom(" ", "\t"), { maxLength: 5 }).map((a) => a.join(""));

// --- Property Tests ---

describe("Feature: interactive-new-command — parseCommaSeparated", () => {
  /**
   * Feature: interactive-new-command, Property 1: Comma-separated parsing preserves all tokens
   *
   * **Validates: Requirements 2.2, 3.3**
   *
   * For any string containing comma-separated values (with arbitrary whitespace
   * around commas), parseCommaSeparated SHALL produce an array where every element
   * is trimmed and non-empty, no non-whitespace token from the original input is
   * lost, and the array length equals the number of non-empty segments.
   */
  test("Property 1: Comma-separated parsing preserves all tokens", () => {
    fc.assert(
      fc.property(
        fc.array(tokenArb(), { minLength: 1, maxLength: 10 }),
        fc.array(wsArb(), { minLength: 20, maxLength: 20 }),
        (tokens, pads) => {
          // Build an input string with arbitrary whitespace around commas
          const input = tokens
            .map((t, i) => `${pads[i * 2] ?? ""}${t}${pads[i * 2 + 1] ?? ""}`)
            .join(",");

          const result = parseCommaSeparated(input);

          // 1. Every element is trimmed and non-empty
          for (const elem of result) {
            expect(elem).toBe(elem.trim());
            expect(elem.length).toBeGreaterThan(0);
          }

          // 2. No non-whitespace token is lost — every original token appears in the result
          for (const token of tokens) {
            expect(result).toContain(token);
          }

          // 3. Array length equals the number of input tokens
          expect(result.length).toBe(tokens.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 1 supplement: empty segments are dropped.
   *
   * **Validates: Requirements 2.2, 3.3**
   *
   * For any input that is empty, all-whitespace, or consists only of commas
   * and whitespace, parseCommaSeparated SHALL return an empty array.
   */
  test("Property 1: empty / whitespace-only input yields empty array", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(",", " ", "\t"), { maxLength: 20 }).map((a) => a.join("")),
        (input) => {
          const result = parseCommaSeparated(input);
          expect(result).toEqual([]);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Space-separated parsing helper ---

/**
 * Parses a space-separated string into a trimmed, non-empty array.
 * Mirrors the inline pattern used in the wizard for MCP server args.
 */
function parseSpaceSeparated(input: string): string[] {
  return input
    .split(" ")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// --- Additional Arbitraries ---

/** A non-empty token that contains no spaces and is not pure whitespace */
const spaceTokenArb = () =>
  fc
    .string({ minLength: 1, maxLength: 20 })
    .filter((s) => !s.includes(" ") && s.trim().length > 0)
    .map((s) => s.trim());

/** A non-empty key that contains no '=' or ',' characters */
const kvKeyArb = () =>
  fc
    .string({ minLength: 1, maxLength: 15 })
    .filter((s) => !s.includes("=") && !s.includes(",") && s.trim().length > 0)
    .map((s) => s.trim());

/** A value that contains no ',' characters */
const kvValueArb = () =>
  fc
    .string({ maxLength: 20 })
    .filter((s) => !s.includes(","))
    .map((s) => s.trim());

// --- Property Tests: Space-separated parsing ---

describe("Feature: interactive-new-command — parseSpaceSeparated", () => {
  /**
   * Feature: interactive-new-command, Property 6: Space-separated parsing preserves all tokens
   *
   * **Validates: Requirements 6.4**
   *
   * For any string containing space-separated values, parsing SHALL produce
   * an array where every element is non-empty and no non-whitespace token
   * from the original input is lost.
   */
  test("Property 6: Space-separated parsing preserves all tokens", () => {
    fc.assert(
      fc.property(
        fc.array(spaceTokenArb(), { minLength: 1, maxLength: 10 }),
        (tokens) => {
          // Build an input string by joining tokens with spaces
          const input = tokens.join(" ");

          const result = parseSpaceSeparated(input);

          // 1. Every element is non-empty
          for (const elem of result) {
            expect(elem.length).toBeGreaterThan(0);
          }

          // 2. No token is lost — every original token appears in the result
          for (const token of tokens) {
            expect(result).toContain(token);
          }

          // 3. Array length equals the number of input tokens
          expect(result.length).toBe(tokens.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 6 supplement: empty / whitespace-only input yields empty array.
   *
   * **Validates: Requirements 6.4**
   */
  test("Property 6: empty / whitespace-only input yields empty array", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constant(" "), { maxLength: 20 }).map((a) => a.join("")),
        (input) => {
          const result = parseSpaceSeparated(input);
          expect(result).toEqual([]);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Property Tests: KEY=VALUE round-trip ---

describe("Feature: interactive-new-command — parseKeyValuePairs round-trip", () => {
  /**
   * Feature: interactive-new-command, Property 7: KEY=VALUE parsing round-trip
   *
   * **Validates: Requirements 6.5**
   *
   * For any record of string key-value pairs (where keys contain no '=' or ','
   * characters and values contain no ',' characters), serializing to
   * KEY=VALUE comma-separated format and parsing back with parseKeyValuePairs
   * SHALL produce an equivalent record.
   */
  test("Property 7: KEY=VALUE parsing round-trip", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(kvKeyArb(), kvValueArb()),
          { minLength: 1, maxLength: 8 },
        ),
        (entries) => {
          // Deduplicate keys — last one wins (matches parseKeyValuePairs behavior)
          const expected: Record<string, string> = {};
          for (const [key, value] of entries) {
            expected[key] = value;
          }

          // Serialize to KEY=VALUE comma-separated format
          const serialized = Object.entries(expected)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ");

          // Parse back
          const result = parseKeyValuePairs(serialized);

          // Round-trip: parsed result should equal the expected record
          expect(result).toEqual(expected);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 7 supplement: entries without '=' are silently skipped.
   *
   * **Validates: Requirements 6.5**
   */
  test("Property 7: entries without '=' are silently skipped", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.string({ minLength: 1, maxLength: 15 }).filter((s) => !s.includes("=") && !s.includes(",")),
          { minLength: 1, maxLength: 5 },
        ),
        (noEqEntries) => {
          const input = noEqEntries.join(", ");
          const result = parseKeyValuePairs(input);
          expect(result).toEqual({});
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Unit Tests: Edge Cases ---

describe("parseCommaSeparated — edge cases", () => {
  /**
   * **Validates: Requirements 2.2, 3.3**
   */

  test("empty string returns empty array", () => {
    expect(parseCommaSeparated("")).toEqual([]);
  });

  test("all-whitespace input returns empty array", () => {
    expect(parseCommaSeparated("   ")).toEqual([]);
    expect(parseCommaSeparated("\t\t")).toEqual([]);
    expect(parseCommaSeparated("  \t  ")).toEqual([]);
  });

  test("single value without commas returns single-element array", () => {
    expect(parseCommaSeparated("react")).toEqual(["react"]);
    expect(parseCommaSeparated("  react  ")).toEqual(["react"]);
  });

  test("trailing commas are ignored", () => {
    expect(parseCommaSeparated("a,b,")).toEqual(["a", "b"]);
    expect(parseCommaSeparated("a,b,,,")).toEqual(["a", "b"]);
  });

  test("leading commas are ignored", () => {
    expect(parseCommaSeparated(",a,b")).toEqual(["a", "b"]);
    expect(parseCommaSeparated(",,,a")).toEqual(["a"]);
  });

  test("multiple consecutive commas produce no empty elements", () => {
    expect(parseCommaSeparated("a,,,b")).toEqual(["a", "b"]);
    expect(parseCommaSeparated(",,,")).toEqual([]);
  });
});

describe("parseKeyValuePairs — edge cases", () => {
  /**
   * **Validates: Requirements 6.4, 6.5**
   */

  test("empty string returns empty record", () => {
    expect(parseKeyValuePairs("")).toEqual({});
  });

  test("all-whitespace input returns empty record", () => {
    expect(parseKeyValuePairs("   ")).toEqual({});
    expect(parseKeyValuePairs("\t\t")).toEqual({});
  });

  test("entries without '=' are silently skipped", () => {
    expect(parseKeyValuePairs("noequals")).toEqual({});
    expect(parseKeyValuePairs("foo,bar")).toEqual({});
  });

  test("keys with special characters (dots, dashes, underscores)", () => {
    expect(parseKeyValuePairs("my.key=val")).toEqual({ "my.key": "val" });
    expect(parseKeyValuePairs("my-key=val")).toEqual({ "my-key": "val" });
    expect(parseKeyValuePairs("my_key=val")).toEqual({ "my_key": "val" });
    expect(parseKeyValuePairs("a.b-c_d=x")).toEqual({ "a.b-c_d": "x" });
  });

  test("values containing '=' signs are preserved", () => {
    expect(parseKeyValuePairs("key=a=b")).toEqual({ key: "a=b" });
    expect(parseKeyValuePairs("k=x=y=z")).toEqual({ k: "x=y=z" });
  });

  test("mixed valid and invalid entries", () => {
    expect(parseKeyValuePairs("good=val, bad, also=ok")).toEqual({
      good: "val",
      also: "ok",
    });
  });
});
