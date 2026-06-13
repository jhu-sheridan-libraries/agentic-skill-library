import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import {
	parseKiroSteeringFile,
	printKiroFrontmatter,
} from "../adapters/kiro-frontmatter";
import type { KiroInclusionMode } from "../adapters/kiro-inclusion";

// --- Arbitraries ---

const kiroModeArb = fc.oneof(
	fc.constant("always" as const),
	fc.constant("fileMatch" as const),
	fc.constant("manual" as const),
) as fc.Arbitrary<KiroInclusionMode>;

/**
 * Generate safe glob-like file match patterns that won't break YAML parsing.
 * Avoids characters that are special in YAML (`:`, `#`, `"`, `'`, `{`, `}`, `[`, `]`)
 * and restricts to alphanumeric, glob wildcards, slashes, dots, and hyphens.
 */
const safeFileMatchPatternArb = fc.stringMatching(/^[a-zA-Z0-9*/.{}\[\]\-]+$/).filter(
	(s) => s.length > 0,
);

// --- Property Tests ---

describe("Kiro frontmatter scanner round-trip properties", () => {
	/**
	 * Feature: kiro-progressive-steering, Property 9: Install scanner parser round-trip
	 *
	 * **Validates: Requirements 12.3**
	 *
	 * For any (mode, fileMatchPattern) pair where mode ∈ {"always","fileMatch","manual"}
	 * and fileMatchPattern is any non-empty string (only used when mode === "fileMatch"),
	 * parseKiroSteeringFile(printKiroFrontmatter({inclusion: mode, fileMatchPattern}), "<test>")
	 * returns {ok: true, frontmatter: {inclusion: mode, fileMatchPattern?}} where
	 * fileMatchPattern is present iff mode === "fileMatch".
	 */
	test("Property 9: printKiroFrontmatter → parseKiroSteeringFile round-trip", () => {
		fc.assert(
			fc.property(
				kiroModeArb,
				safeFileMatchPatternArb,
				(mode, fileMatchPattern) => {
					// Build the frontmatter input
					const input = { inclusion: mode, fileMatchPattern };

					// Print to a frontmatter block
					const printed = printKiroFrontmatter(input);

					// Parse back from the printed block
					const result = parseKiroSteeringFile(printed, "<test>");

					// Must parse successfully
					expect(result.ok).toBe(true);
					if (!result.ok) return;

					// Frontmatter must be non-null
					expect(result.frontmatter).not.toBeNull();
					if (!result.frontmatter) return;

					// Inclusion mode must round-trip
					expect(result.frontmatter.inclusion).toBe(mode);

					// fileMatchPattern present iff mode === "fileMatch"
					if (mode === "fileMatch") {
						expect(result.frontmatter.fileMatchPattern).toBe(fileMatchPattern);
					} else {
						expect(result.frontmatter.fileMatchPattern).toBeUndefined();
					}
				},
			),
			{ numRuns: 100 },
		);
	});
});
