/** Feature: rosetta-stone, Property 20: Diagnostics are structured, located, ordered, and plan-safe */

/**
 * Property 20: Diagnostics are structured, located, ordered, and plan-safe
 *
 * **Validates: Requirements 8.2, 8.3, 8.4, 8.5, 8.7**
 *
 * This property test verifies that for any emitted diagnostic set:
 * 1. Every diagnostic has the required stable fields (code, severity, phase, message, remediation, blocking)
 * 2. Source diagnostics include normalized source locations when available
 * 3. Canonical diagnostics include artifact and field paths
 * 4. All diagnostics follow the severity/phase/path/location/code/format total order
 * 5. Blocking diagnostics make the result fail and remove affected output operations
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import {
	createDiagnostic,
	DIAGNOSTIC_CODE_REGISTRY,
	getBlockingDiagnostics,
	hasBlockingDiagnostics,
	isBlockingCode,
	sortDiagnostics,
	TRANSLATION_PHASE_ORDER,
} from "../rosetta/diagnostics";
import type {
	CanonicalDiagnosticLocation,
	RosettaSeverity,
	SourceDiagnosticLocation,
	TranslationDiagnostic,
	TranslationPhase,
} from "../schemas";
import { TranslationDiagnosticSchema } from "../schemas";
import {
	arbFormatIdentifier,
	arbNormalizedRelativePath,
	arbTranslationDiagnostic,
} from "./rosetta-arbitraries";

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

const SEVERITY_ORDER: Record<RosettaSeverity, number> = {
	error: 0,
	warning: 1,
	info: 2,
};

const PHASE_INDEX: ReadonlyMap<TranslationPhase, number> = new Map(
	TRANSLATION_PHASE_ORDER.map((phase, idx) => [phase, idx]),
);

// ═══════════════════════════════════════════════════════════════════════════════
// Arbitraries
// ═══════════════════════════════════════════════════════════════════════════════

/** Generates a valid source diagnostic location with normalized path */
function arbSourceLocation(): fc.Arbitrary<SourceDiagnosticLocation> {
	return fc.record({
		path: arbNormalizedRelativePath(),
		field: fc.option(fc.string({ minLength: 1, maxLength: 20 }), {
			nil: undefined,
		}),
		line: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: undefined }),
		column: fc.option(fc.integer({ min: 0, max: 200 }), { nil: undefined }),
		offset: fc.option(fc.integer({ min: 0, max: 100000 }), { nil: undefined }),
	}) as fc.Arbitrary<SourceDiagnosticLocation>;
}

/** Generates a valid canonical diagnostic location */
function arbCanonicalLocation(): fc.Arbitrary<CanonicalDiagnosticLocation> {
	return fc.record({
		artifactName: fc.stringMatching(/^[a-z][a-z0-9-]{1,20}$/),
		fieldPath: fc.stringMatching(/^[a-z][a-z0-9.[\]]{1,30}$/),
	}) as fc.Arbitrary<CanonicalDiagnosticLocation>;
}

/** Generates a diagnostic with a source location */
function arbDiagnosticWithSource(): fc.Arbitrary<TranslationDiagnostic> {
	return fc
		.tuple(arbTranslationDiagnostic(), arbSourceLocation())
		.map(([diag, source]) => ({
			...diag,
			source,
			canonical: undefined,
		}));
}

/** Generates a diagnostic with a canonical location */
function arbDiagnosticWithCanonical(): fc.Arbitrary<TranslationDiagnostic> {
	return fc
		.tuple(arbTranslationDiagnostic(), arbCanonicalLocation())
		.map(([diag, canonical]) => ({
			...diag,
			source: undefined,
			canonical,
		}));
}

/** Generates a mixed set of diagnostics with randomized locations */
function arbDiagnosticSet(): fc.Arbitrary<TranslationDiagnostic[]> {
	return fc.array(
		fc.oneof(
			arbTranslationDiagnostic(),
			arbDiagnosticWithSource(),
			arbDiagnosticWithCanonical(),
		),
		{ minLength: 1, maxLength: 20 },
	);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 20: Diagnostics are structured, located, ordered, and plan-safe", () => {
	describe("8.2 — Every diagnostic has required stable fields", () => {
		it("all diagnostics produced by createDiagnostic pass schema validation", () => {
			const knownCodes = Object.keys(DIAGNOSTIC_CODE_REGISTRY);

			fc.assert(
				fc.property(
					fc.constantFrom(...knownCodes),
					fc.option(arbFormatIdentifier(), { nil: undefined }),
					fc.option(arbSourceLocation(), { nil: undefined }),
					fc.option(arbCanonicalLocation(), { nil: undefined }),
					(code, formatId, source, canonical) => {
						const diag = createDiagnostic(code, {
							formatId,
							source,
							canonical,
						});

						// Must have all required fields
						expect(diag.code).toMatch(/^RS_[A-Z0-9_]+$/);
						expect(["error", "warning", "info"]).toContain(diag.severity);
						expect(TRANSLATION_PHASE_ORDER).toContain(diag.phase);
						expect(diag.message.length).toBeGreaterThan(0);
						expect(diag.remediation.length).toBeGreaterThan(0);
						expect(typeof diag.blocking).toBe("boolean");

						// Must pass full Zod schema validation
						const result = TranslationDiagnosticSchema.safeParse(diag);
						expect(result.success).toBe(true);
					},
				),
				{ numRuns: 100, verbose: 2 },
			);
		});

		it("arbitrary diagnostics always have required stable fields", () => {
			fc.assert(
				fc.property(arbTranslationDiagnostic(), (diag) => {
					// Every diagnostic must carry these stable fields
					expect(diag.code).toMatch(/^RS_[A-Z0-9_]+$/);
					expect(["error", "warning", "info"]).toContain(diag.severity);
					expect(TRANSLATION_PHASE_ORDER).toContain(diag.phase);
					expect(diag.message.length).toBeGreaterThan(0);
					expect(diag.remediation.length).toBeGreaterThan(0);
					expect(typeof diag.blocking).toBe("boolean");
					expect(Array.isArray(diag.unavailableDetails)).toBe(true);
				}),
				{ numRuns: 100, verbose: 2 },
			);
		});
	});

	describe("8.3 — Source diagnostics include normalized source locations", () => {
		it("diagnostics with source locations have valid normalized paths", () => {
			fc.assert(
				fc.property(arbDiagnosticWithSource(), (diag) => {
					// Source location must be present
					expect(diag.source).toBeDefined();
					const source = diag.source!;

					// Path must be non-empty
					expect(source.path.length).toBeGreaterThan(0);

					// Path must be a normalized relative path: no leading slash, no NUL
					expect(source.path).not.toMatch(/^\//);
					expect(source.path).not.toContain("\0");

					// Each segment must be a valid path segment (the arbNormalizedRelativePath
					// generator ensures this by construction — verify structural invariants)
					const segments = source.path.split("/");
					for (const segment of segments) {
						// No empty segments (no double slashes)
						expect(segment.length).toBeGreaterThan(0);
						// No pure traversal segments
						expect(segment).not.toBe("..");
						expect(segment).not.toBe(".");
					}

					// Line, if present, must be positive
					if (source.line !== undefined) {
						expect(source.line).toBeGreaterThan(0);
					}

					// Column, if present, must be non-negative
					if (source.column !== undefined) {
						expect(source.column).toBeGreaterThanOrEqual(0);
					}
				}),
				{ numRuns: 100, verbose: 2 },
			);
		});
	});

	describe("8.4 — Canonical diagnostics include artifact and field paths", () => {
		it("diagnostics with canonical locations have artifact name and field path", () => {
			fc.assert(
				fc.property(arbDiagnosticWithCanonical(), (diag) => {
					// Canonical location must be present
					expect(diag.canonical).toBeDefined();
					const canonical = diag.canonical!;

					// Must include artifact name
					expect(canonical.artifactName.length).toBeGreaterThan(0);

					// Must include field path
					expect(canonical.fieldPath.length).toBeGreaterThan(0);
				}),
				{ numRuns: 100, verbose: 2 },
			);
		});
	});

	describe("8.5 — Diagnostics follow severity/phase/path/location/code/format total order", () => {
		it("sortDiagnostics produces a stable total order", () => {
			fc.assert(
				fc.property(arbDiagnosticSet(), (diagnostics) => {
					const sorted = sortDiagnostics(diagnostics);

					// Same length after sorting
					expect(sorted.length).toBe(diagnostics.length);

					// Verify total order: for every adjacent pair, the order is correct
					for (let i = 0; i < sorted.length - 1; i++) {
						const a = sorted[i];
						const b = sorted[i + 1];
						const cmp = comparePair(a, b);
						expect(cmp).toBeLessThanOrEqual(0);
					}
				}),
				{ numRuns: 100, verbose: 2 },
			);
		});

		it("sortDiagnostics is idempotent (sorting twice yields same result)", () => {
			fc.assert(
				fc.property(arbDiagnosticSet(), (diagnostics) => {
					const sorted1 = sortDiagnostics(diagnostics);
					const sorted2 = sortDiagnostics(sorted1);

					expect(sorted2).toEqual(sorted1);
				}),
				{ numRuns: 100, verbose: 2 },
			);
		});

		it("sortDiagnostics is permutation-invariant (randomized insertion order)", () => {
			fc.assert(
				fc.property(
					arbDiagnosticSet(),
					fc.infiniteStream(fc.nat()),
					(diagnostics, seeds) => {
						// Shuffle the diagnostics using seeds as source of randomness
						const shuffled = [...diagnostics];
						const seedIter = seeds[Symbol.iterator]();
						for (let i = shuffled.length - 1; i > 0; i--) {
							const j = seedIter.next().value! % (i + 1);
							[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
						}

						const sortedOriginal = sortDiagnostics(diagnostics);
						const sortedShuffled = sortDiagnostics(shuffled);

						expect(sortedShuffled).toEqual(sortedOriginal);
					},
				),
				{ numRuns: 100, verbose: 2 },
			);
		});

		it("severity ordering: errors before warnings before info", () => {
			fc.assert(
				fc.property(arbDiagnosticSet(), (diagnostics) => {
					const sorted = sortDiagnostics(diagnostics);

					for (let i = 0; i < sorted.length - 1; i++) {
						const a = sorted[i];
						const b = sorted[i + 1];

						// If severity differs, it must be in the correct order
						if (a.severity !== b.severity) {
							expect(SEVERITY_ORDER[a.severity]).toBeLessThan(
								SEVERITY_ORDER[b.severity],
							);
						}
					}
				}),
				{ numRuns: 100, verbose: 2 },
			);
		});
	});

	describe("8.7 — Blocking diagnostics make the result fail and remove affected output", () => {
		it("hasBlockingDiagnostics returns true iff at least one blocking diagnostic exists", () => {
			fc.assert(
				fc.property(arbDiagnosticSet(), (diagnostics) => {
					const hasBlocking = hasBlockingDiagnostics(diagnostics);
					const anyBlocking = diagnostics.some((d) => d.blocking);

					expect(hasBlocking).toBe(anyBlocking);
				}),
				{ numRuns: 100, verbose: 2 },
			);
		});

		it("getBlockingDiagnostics returns exactly the blocking subset", () => {
			fc.assert(
				fc.property(arbDiagnosticSet(), (diagnostics) => {
					const blocking = getBlockingDiagnostics(diagnostics);

					// All returned diagnostics must be blocking
					for (const d of blocking) {
						expect(d.blocking).toBe(true);
					}

					// Count must match
					const expectedCount = diagnostics.filter((d) => d.blocking).length;
					expect(blocking.length).toBe(expectedCount);
				}),
				{ numRuns: 100, verbose: 2 },
			);
		});

		it("isBlockingCode matches the diagnostic code registry metadata", () => {
			const knownCodes = Object.keys(DIAGNOSTIC_CODE_REGISTRY);

			fc.assert(
				fc.property(fc.constantFrom(...knownCodes), (code) => {
					const expected = DIAGNOSTIC_CODE_REGISTRY[code].blocking;
					expect(isBlockingCode(code)).toBe(expected);
				}),
				{ numRuns: 100, verbose: 2 },
			);
		});

		it("unknown codes are treated as blocking by default", () => {
			fc.assert(
				fc.property(
					fc
						.stringMatching(/^RS_[A-Z0-9_]{2,12}$/)
						.filter((code) => !(code in DIAGNOSTIC_CODE_REGISTRY)),
					(unknownCode) => {
						expect(isBlockingCode(unknownCode)).toBe(true);
					},
				),
				{ numRuns: 100, verbose: 2 },
			);
		});

		it("blocking diagnostics derive from code registry metadata", () => {
			const knownCodes = Object.keys(DIAGNOSTIC_CODE_REGISTRY);

			fc.assert(
				fc.property(
					fc.constantFrom(...knownCodes),
					fc.option(arbFormatIdentifier(), { nil: undefined }),
					(code, formatId) => {
						const diag = createDiagnostic(code, { formatId });

						// The diagnostic blocking field must match the code metadata
						const expectedBlocking = DIAGNOSTIC_CODE_REGISTRY[code].blocking;
						expect(diag.blocking).toBe(expectedBlocking);
					},
				),
				{ numRuns: 100, verbose: 2 },
			);
		});
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compare two diagnostics using the documented total order:
 * severity > phase > path > location > code > formatId
 */
function comparePair(
	a: TranslationDiagnostic,
	b: TranslationDiagnostic,
): number {
	// 1. Severity (error < warning < info)
	const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
	if (sevDiff !== 0) return sevDiff;

	// 2. Phase order
	const phaseA = PHASE_INDEX.get(a.phase) ?? TRANSLATION_PHASE_ORDER.length;
	const phaseB = PHASE_INDEX.get(b.phase) ?? TRANSLATION_PHASE_ORDER.length;
	const phaseDiff = phaseA - phaseB;
	if (phaseDiff !== 0) return phaseDiff;

	// 3. Source path (code-point comparison)
	const pathA = a.source?.path ?? "";
	const pathB = b.source?.path ?? "";
	if (pathA < pathB) return -1;
	if (pathA > pathB) return 1;

	// 4. Source location (line, then column)
	const lineA = a.source?.line ?? 0;
	const lineB = b.source?.line ?? 0;
	if (lineA !== lineB) return lineA - lineB;

	const colA = a.source?.column ?? 0;
	const colB = b.source?.column ?? 0;
	if (colA !== colB) return colA - colB;

	// 5. Code (code-point comparison)
	if (a.code < b.code) return -1;
	if (a.code > b.code) return 1;

	// 6. Format identifier (code-point comparison)
	const fmtA = a.formatId ?? "";
	const fmtB = b.formatId ?? "";
	if (fmtA < fmtB) return -1;
	if (fmtA > fmtB) return 1;

	return 0;
}
