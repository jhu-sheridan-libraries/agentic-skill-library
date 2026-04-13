import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import { normalizePath } from "../path-utils";

/**
 * Property 17: Path normalization to forward slashes
 *
 * For any file path string (including those containing backslash separators),
 * the normalized path SHALL contain only forward slashes as separators.
 *
 * Validates: Requirements 8.3
 */

// --- Generators ---

/** Generate a path segment (alphanumeric + hyphens/underscores/dots). */
const segmentArb = fc.stringMatching(/^[a-zA-Z0-9._-]{1,15}$/);

/** Generate a separator — either forward slash or backslash. */
const separatorArb = fc.constantFrom("/", "\\");

/**
 * Generate a path with mixed separators by interleaving segments and separators.
 * Produces strings like "foo\\bar/baz\\qux" or ".forge\\artifacts/name/1.0.0".
 */
const mixedPathArb = fc
  .tuple(
    fc.array(segmentArb, { minLength: 1, maxLength: 8 }),
    fc.array(separatorArb, { minLength: 1, maxLength: 7 }),
  )
  .map(([segments, seps]) => {
    let path = segments[0];
    for (let i = 1; i < segments.length; i++) {
      path += seps[(i - 1) % seps.length] + segments[i];
    }
    return path;
  });

// --- Tests ---

describe("Feature: team-mode-distribution, Property 17: Path normalization to forward slashes", () => {
  test("normalized output contains no backslashes", () => {
    fc.assert(
      fc.property(mixedPathArb, (path) => {
        const result = normalizePath(path);
        expect(result).not.toContain("\\");
      }),
      { numRuns: 100 },
    );
  });

  test("all forward slashes from the input are preserved", () => {
    fc.assert(
      fc.property(mixedPathArb, (path) => {
        const result = normalizePath(path);

        // Count forward slashes in input
        const inputForwardSlashes = (path.match(/\//g) || []).length;
        // Count backslashes in input (these become forward slashes)
        const inputBackslashes = (path.match(/\\/g) || []).length;
        // Total forward slashes in output should equal input forward slashes + input backslashes
        const outputForwardSlashes = (result.match(/\//g) || []).length;

        expect(outputForwardSlashes).toBe(inputForwardSlashes + inputBackslashes);
      }),
      { numRuns: 100 },
    );
  });

  test("non-separator characters are unchanged", () => {
    fc.assert(
      fc.property(mixedPathArb, (path) => {
        const result = normalizePath(path);

        // Stripping all separators from both should yield the same string
        const inputWithoutSeps = path.replace(/[/\\]/g, "");
        const outputWithoutSeps = result.replace(/[/\\]/g, "");

        expect(outputWithoutSeps).toBe(inputWithoutSeps);
      }),
      { numRuns: 100 },
    );
  });
});
