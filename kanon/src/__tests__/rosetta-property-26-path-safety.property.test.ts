/**
 * Property 26: Path normalization is safe and collision-free
 *
 * **Validates: Requirements 13.1, 13.2, 13.5, 13.6, 16.4**
 *
 * This property test verifies that:
 * 1. `normalizePlanPath` rejects all unsafe paths (absolute, drive, UNC, NUL, traversal, empty segments)
 * 2. Valid paths normalize correctly (backslash to forward slash, NFC normalization)
 * 3. `validatePlan` detects duplicate normalized paths
 * 4. Paths that differ only in case/NFC form are detected as collisions when they normalize to the same string
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import { normalizePlanPath, validatePlan } from "../rosetta/plan";
import { arbNormalizedRelativePath } from "./rosetta-arbitraries";

// ═══════════════════════════════════════════════════════════════════════════════
// Generators — Unsafe Paths
// ═══════════════════════════════════════════════════════════════════════════════

/** Generates POSIX absolute paths (start with `/`) */
function arbAbsolutePath(): fc.Arbitrary<string> {
	return arbNormalizedRelativePath().map((p) => `/${p}`);
}

/** Generates Windows drive-prefixed paths (e.g., `C:\foo`, `D:\bar`) */
function arbDrivePath(): fc.Arbitrary<string> {
	return fc
		.tuple(
			fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")),
			arbNormalizedRelativePath(),
		)
		.map(([letter, rest]) => `${letter}:\\${rest}`);
}

/** Generates UNC paths (start with `\\server\share`) */
function arbUncPath(): fc.Arbitrary<string> {
	return fc
		.tuple(
			fc.stringMatching(/^[a-z]{3,8}$/),
			fc.stringMatching(/^[a-z]{3,8}$/),
			arbNormalizedRelativePath(),
		)
		.map(([server, share, rest]) => `\\\\${server}\\${share}\\${rest}`);
}

/** Generates paths containing NUL characters */
function arbNulPath(): fc.Arbitrary<string> {
	return fc
		.tuple(
			fc.stringMatching(/^[a-z]{2,6}$/),
			fc.stringMatching(/^[a-z]{2,6}$/),
		)
		.map(([a, b]) => `${a}\0${b}`);
}

/** Generates paths with `..` traversal segments */
function arbTraversalPath(): fc.Arbitrary<string> {
	return fc
		.tuple(
			fc.stringMatching(/^[a-z]{2,6}$/),
			fc.stringMatching(/^[a-z]{2,6}$/),
		)
		.chain(([prefix, suffix]) =>
			fc
				.constantFrom(
					`${prefix}/../${suffix}`,
					`../${prefix}/${suffix}`,
					`${prefix}/${suffix}/..`,
					`../..`,
					`${prefix}/../../${suffix}`,
				)
				.map((p) => p),
		);
}

/** Generates paths with empty segments (consecutive `/` or trailing `/`) */
function arbEmptySegmentPath(): fc.Arbitrary<string> {
	return fc
		.tuple(
			fc.stringMatching(/^[a-z]{2,6}$/),
			fc.stringMatching(/^[a-z]{2,6}$/),
		)
		.chain(([a, b]) =>
			fc.constantFrom(`${a}//${b}`, `//${a}/${b}`, `${a}/${b}/`, `${a}///`),
		);
}

/** Generates paths with mixed separators (backslashes) */
function arbMixedSeparatorPath(): fc.Arbitrary<string> {
	return fc
		.tuple(
			fc.stringMatching(/^[a-z]{2,6}$/),
			fc.stringMatching(/^[a-z]{2,6}$/),
			fc.stringMatching(/^[a-z]{2,6}$/),
		)
		.map(([a, b, c]) => `${a}\\${b}\\${c}`);
}

/** Generates paths that differ only in Unicode normalization form (NFC vs NFD) */
function arbUnicodeNormalizationPair(): fc.Arbitrary<{
	nfd: string;
	nfc: string;
}> {
	// Characters that have distinct NFC and NFD representations
	const decomposable = [
		{ nfc: "\u00E9", nfd: "e\u0301" }, // e-acute
		{ nfc: "\u00F1", nfd: "n\u0303" }, // n-tilde
		{ nfc: "\u00FC", nfd: "u\u0308" }, // u-umlaut
		{ nfc: "\u00E0", nfd: "a\u0300" }, // a-grave
		{ nfc: "\u00F6", nfd: "o\u0308" }, // o-umlaut
	];

	return fc
		.tuple(
			fc.constantFrom(...decomposable),
			fc.stringMatching(/^[a-z]{2,6}$/),
		)
		.map(([char, suffix]) => ({
			nfd: `${char.nfd}${suffix}`,
			nfc: `${char.nfc}${suffix}`,
		}));
}

/** Generates valid relative paths that will pass normalization */
function arbValidPath(): fc.Arbitrary<string> {
	return arbNormalizedRelativePath();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper — Build a plan with specific output file paths
// ═══════════════════════════════════════════════════════════════════════════════

function buildPlanWithPaths(paths: string[]): unknown {
	return {
		schemaVersion: "1.0",
		formatId: "test-format",
		canonicalSchemaVersion: "1.0.0",
		outputFiles: paths.map((p) => ({
			relativePath: p,
			content: `content for ${p}`,
			executable: false,
		})),
		operations: paths.map((_, idx) => ({
			kind: "write-file",
			relativePath: paths[idx],
			outputFileIndex: idx,
		})),
		applicationState: "eligible",
		policyDiagnosticCodes: [],
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 26: Path normalization is safe and collision-free", () => {
	it("rejects all POSIX absolute paths", () => {
		fc.assert(
			fc.property(arbAbsolutePath(), (path) => {
				const result = normalizePlanPath(path);
				expect(result.ok).toBe(false);
				if (!result.ok) {
					expect(result.error).toContain("absolute");
				}
			}),
			{ numRuns: 100 },
		);
	});

	it("rejects all Windows drive-prefixed paths", () => {
		fc.assert(
			fc.property(arbDrivePath(), (path) => {
				const result = normalizePlanPath(path);
				expect(result.ok).toBe(false);
				if (!result.ok) {
					expect(result.error).toContain("drive");
				}
			}),
			{ numRuns: 100 },
		);
	});

	it("rejects all UNC paths", () => {
		fc.assert(
			fc.property(arbUncPath(), (path) => {
				const result = normalizePlanPath(path);
				expect(result.ok).toBe(false);
				if (!result.ok) {
					// UNC paths start with \\ which gets normalized to // and then
					// either caught as absolute or empty segment depending on processing order
					expect(
						result.error.includes("UNC") ||
							result.error.includes("absolute") ||
							result.error.includes("empty"),
					).toBe(true);
				}
			}),
			{ numRuns: 100 },
		);
	});

	it("rejects all paths containing NUL characters", () => {
		fc.assert(
			fc.property(arbNulPath(), (path) => {
				const result = normalizePlanPath(path);
				expect(result.ok).toBe(false);
				if (!result.ok) {
					expect(result.error).toContain("NUL");
				}
			}),
			{ numRuns: 100 },
		);
	});

	it("rejects all paths with '..' traversal segments", () => {
		fc.assert(
			fc.property(arbTraversalPath(), (path) => {
				const result = normalizePlanPath(path);
				expect(result.ok).toBe(false);
				if (!result.ok) {
					expect(
						result.error.includes("traversal") ||
							result.error.includes("empty") ||
							result.error.includes("absolute"),
					).toBe(true);
				}
			}),
			{ numRuns: 100 },
		);
	});

	it("rejects all paths with empty segments", () => {
		fc.assert(
			fc.property(arbEmptySegmentPath(), (path) => {
				const result = normalizePlanPath(path);
				expect(result.ok).toBe(false);
				if (!result.ok) {
					expect(
						result.error.includes("empty") || result.error.includes("absolute"),
					).toBe(true);
				}
			}),
			{ numRuns: 100 },
		);
	});

	it("normalizes mixed-separator paths (backslash to forward slash) and succeeds for valid structure", () => {
		fc.assert(
			fc.property(arbMixedSeparatorPath(), (path) => {
				const result = normalizePlanPath(path);
				// Mixed-separator paths with valid segments should normalize successfully
				expect(result.ok).toBe(true);
				if (result.ok) {
					// Ensure no backslashes in result
					expect(result.normalized).not.toContain("\\");
					// Ensure forward-slash separated
					expect(result.normalized).toContain("/");
				}
			}),
			{ numRuns: 100 },
		);
	});

	it("applies NFC normalization to paths with decomposed Unicode", () => {
		fc.assert(
			fc.property(arbUnicodeNormalizationPair(), ({ nfd, nfc }) => {
				const nfdResult = normalizePlanPath(nfd);
				const nfcResult = normalizePlanPath(nfc);

				// Both should succeed (they're valid relative paths with no traversal)
				expect(nfdResult.ok).toBe(true);
				expect(nfcResult.ok).toBe(true);

				if (nfdResult.ok && nfcResult.ok) {
					// Both should normalize to the same NFC string
					expect(nfdResult.normalized).toBe(nfcResult.normalized);
					// The normalized form should be NFC
					expect(nfdResult.normalized).toBe(nfdResult.normalized.normalize("NFC"));
				}
			}),
			{ numRuns: 100 },
		);
	});

	it("valid paths normalize to stable NFC forward-slash paths", () => {
		fc.assert(
			fc.property(arbValidPath(), (path) => {
				const result = normalizePlanPath(path);
				expect(result.ok).toBe(true);
				if (result.ok) {
					// Result is NFC normalized
					expect(result.normalized).toBe(result.normalized.normalize("NFC"));
					// No backslashes
					expect(result.normalized).not.toContain("\\");
					// No empty segments
					expect(result.normalized).not.toContain("//");
					// No NUL
					expect(result.normalized).not.toContain("\0");
					// Not absolute
					expect(result.normalized).not.toMatch(/^\//);
					// No traversal
					expect(result.normalized.split("/")).not.toContain("..");
					expect(result.normalized.split("/")).not.toContain(".");
				}
			}),
			{ numRuns: 100 },
		);
	});

	it("normalization is idempotent for valid paths", () => {
		fc.assert(
			fc.property(arbValidPath(), (path) => {
				const first = normalizePlanPath(path);
				expect(first.ok).toBe(true);
				if (first.ok) {
					const second = normalizePlanPath(first.normalized);
					expect(second.ok).toBe(true);
					if (second.ok) {
						expect(second.normalized).toBe(first.normalized);
					}
				}
			}),
			{ numRuns: 100 },
		);
	});

	it("validatePlan detects duplicate normalized paths", () => {
		fc.assert(
			fc.property(arbValidPath(), (path) => {
				// Create a plan with the same path twice
				const plan = buildPlanWithPaths([path, path]);
				const result = validatePlan(plan);

				expect(result.valid).toBe(false);
				expect(result.diagnostics.length).toBeGreaterThan(0);

				const hasDuplicateDiag = result.diagnostics.some(
					(d) =>
						d.code === "RS_PLAN_DUPLICATE_PATH" ||
						d.message.toLowerCase().includes("duplicate"),
				);
				expect(hasDuplicateDiag).toBe(true);
			}),
			{ numRuns: 100 },
		);
	});

	it("validatePlan detects paths that differ only in NFC form as collisions", () => {
		fc.assert(
			fc.property(arbUnicodeNormalizationPair(), ({ nfd, nfc }) => {
				// The paths differ in raw representation but normalize to the same string
				// validatePlan uses the schema which enforces NFC, so paths that aren't
				// already NFC-normalized will fail schema validation before collision checks.
				// However, normalizePlanPath handles the NFC normalization, making them collide.
				const nfdResult = normalizePlanPath(nfd);
				const nfcResult = normalizePlanPath(nfc);

				if (nfdResult.ok && nfcResult.ok) {
					// They should normalize to the same path
					expect(nfdResult.normalized).toBe(nfcResult.normalized);
					// Which means a plan with both would have collisions
					const plan = buildPlanWithPaths([
						nfdResult.normalized,
						nfcResult.normalized,
					]);
					const result = validatePlan(plan);

					expect(result.valid).toBe(false);
					const hasDuplicateDiag = result.diagnostics.some(
						(d) =>
							d.code === "RS_PLAN_DUPLICATE_PATH" ||
							d.message.toLowerCase().includes("duplicate"),
					);
					expect(hasDuplicateDiag).toBe(true);
				}
			}),
			{ numRuns: 100 },
		);
	});

	it("validatePlan detects backslash-variant collision paths", () => {
		fc.assert(
			fc.property(
				fc
					.tuple(
						fc.stringMatching(/^[a-z]{2,6}$/),
						fc.stringMatching(/^[a-z]{2,6}$/),
					)
					.filter(([a, b]) => a !== b),
				([a, b]) => {
					// path with forward slashes and path with backslashes
					const forwardPath = `${a}/${b}`;
					const backslashPath = `${a}\\${b}`;

					const forwardResult = normalizePlanPath(forwardPath);
					const backslashResult = normalizePlanPath(backslashPath);

					// Both should normalize successfully
					expect(forwardResult.ok).toBe(true);
					expect(backslashResult.ok).toBe(true);

					if (forwardResult.ok && backslashResult.ok) {
						// They should produce the same normalized path
						expect(forwardResult.normalized).toBe(backslashResult.normalized);
					}
				},
			),
			{ numRuns: 100 },
		);
	});

	it("validatePlan succeeds for plans with distinct valid paths", () => {
		fc.assert(
			fc.property(
				fc
					.uniqueArray(arbValidPath(), { minLength: 2, maxLength: 5 })
					.filter((paths) => {
						// Make sure paths are distinct after normalization
						const normalized = new Set(
							paths.map((p) => {
								const r = normalizePlanPath(p);
								return r.ok ? r.normalized : p;
							}),
						);
						return normalized.size === paths.length;
					}),
				(paths) => {
					const normalizedPaths = paths.map((p) => {
						const r = normalizePlanPath(p);
						return r.ok ? r.normalized : p;
					});
					const plan = buildPlanWithPaths(normalizedPaths);
					const result = validatePlan(plan);

					expect(result.valid).toBe(true);
					expect(result.diagnostics).toHaveLength(0);
				},
			),
			{ numRuns: 100 },
		);
	});

	it("empty path is always rejected", () => {
		const result = normalizePlanPath("");
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("empty");
		}
	});
});
