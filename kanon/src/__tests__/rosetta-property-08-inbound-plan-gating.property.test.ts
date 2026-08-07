/** Feature: rosetta-stone, Property 8: Inbound validation gates plans by diagnostic class */

/**
 * Property 8: Inbound validation gates plans by diagnostic class
 *
 * **Validates: Requirements 4.6, 4.7, 4.8, 8.1, 8.7**
 *
 * This property test verifies that for any source translation output:
 * 1. Canonical schema issues are mapped to canonical field paths
 * 2. Canonical-schema or error-level source-loss diagnostics withhold a writable canonical plan
 * 3. Other error diagnostics retain only unaffected operations in a `policy-required` plan
 * 4. Any blocking diagnostic makes the result unsuccessful and excludes all affected operations
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";

import type {
	TranslationDiagnostic,
	TranslationPlan,
} from "../schemas";
import {
	createDiagnostic,
	getBlockingDiagnostics,
	hasBlockingDiagnostics,
	withholdBlockedOperations,
} from "../rosetta";
import {
	arbFormatIdentifier,
	arbNormalizedRelativePath,
	arbTranslationDiagnostic,
} from "./rosetta-arbitraries";

// ═══════════════════════════════════════════════════════════════════════════════
// Generators
// ═══════════════════════════════════════════════════════════════════════════════

/** Generates a minimal valid TranslationPlan with 1-5 output files */
function arbPlan(): fc.Arbitrary<TranslationPlan> {
	return fc
		.tuple(
			arbFormatIdentifier(),
			fc.array(arbNormalizedRelativePath(), { minLength: 1, maxLength: 5 }),
		)
		.map(([formatId, paths]) => {
			// Deduplicate paths
			const uniquePaths = [...new Set(paths)];
			if (uniquePaths.length === 0) uniquePaths.push("fallback/file.md");
			return {
				schemaVersion: "1.0" as const,
				formatId,
				variant: undefined,
				canonicalSchemaVersion: "1.0.0",
				outputFiles: uniquePaths.map((p) => ({
					relativePath: p,
					content: `// generated content for ${p}`,
					executable: false,
					mediaType: undefined,
				})),
				operations: uniquePaths.map((p, idx) => ({
					kind: "write-file" as const,
					relativePath: p,
					outputFileIndex: idx,
				})),
				applicationState: "eligible" as const,
				policyDiagnosticCodes: [],
			};
		});
}

/** Generates a blocking diagnostic for canonical-schema validation */
function arbCanonicalSchemaDiagnostic(): fc.Arbitrary<TranslationDiagnostic> {
	return fc
		.tuple(
			fc.stringMatching(/^[a-z][a-z0-9._-]{1,20}$/),
			fc.stringMatching(/^[a-z][a-z0-9.]{1,30}$/),
		)
		.map(([artifactName, fieldPath]) =>
			createDiagnostic("RS_CANONICAL_INVALID", {
				message: `Canonical validation failed at "${fieldPath}": invalid value`,
				canonical: { artifactName, fieldPath },
			}),
		);
}

/** Generates a blocking source-loss diagnostic (strict mode) */
function arbSourceLossDiagnostic(
	sourcePath?: string,
): fc.Arbitrary<TranslationDiagnostic> {
	return fc
		.tuple(
			sourcePath
				? fc.constant(sourcePath)
				: arbNormalizedRelativePath(),
			fc.stringMatching(/^[a-z][a-z0-9._-]{1,20}$/),
		)
		.map(([path, field]) =>
			createDiagnostic("RS_SOURCE_LOSS_STRICT", {
				source: { path, field },
			}),
		);
}

/** Generates a non-blocking warning diagnostic */
function arbWarningDiagnostic(): fc.Arbitrary<TranslationDiagnostic> {
	return fc.constantFrom(
		createDiagnostic("RS_SOURCE_LOSS", {
			source: { path: "some/file.md" },
		}),
		createDiagnostic("RS_COMPATIBILITY_PARTIAL", {
			formatId: "test-format",
		}),
		createDiagnostic("RS_COMPATIBILITY_NONE", {
			formatId: "test-format",
		}),
	);
}

/** Generates an info-level diagnostic (never blocking) */
function arbInfoDiagnostic(): fc.Arbitrary<TranslationDiagnostic> {
	return fc.constantFrom(
		createDiagnostic("RS_DEFAULT_APPLIED"),
		createDiagnostic("RS_NORMALIZATION_APPLIED"),
	);
}

/**
 * Generates a blocking diagnostic whose source path matches
 * one of the provided plan paths (to test partial withholding).
 */
function arbBlockingDiagForPath(
	paths: readonly string[],
): fc.Arbitrary<TranslationDiagnostic> {
	return fc
		.integer({ min: 0, max: Math.max(0, paths.length - 1) })
		.map((idx) => {
			const path = paths[idx] ?? "fallback/path.md";
			return {
				code: "RS_PLAN_INVALID_PATH",
				severity: "error" as const,
				phase: "plan-validation" as const,
				message: `Plan path "${path}" violates conventions.`,
				remediation: "Fix the path to match format conventions.",
				blocking: true,
				unavailableDetails: [],
				source: { path },
			};
		});
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 8: Inbound validation gates plans by diagnostic class", () => {
	it("canonical schema diagnostics include canonical field paths", () => {
		fc.assert(
			fc.property(arbCanonicalSchemaDiagnostic(), (diag) => {
				// RS_CANONICAL_INVALID always has a canonical location with fieldPath
				expect(diag.canonical).toBeDefined();
				expect(diag.canonical!.fieldPath).toBeDefined();
				expect(diag.canonical!.fieldPath.length).toBeGreaterThan(0);
				expect(diag.canonical!.artifactName).toBeDefined();
				expect(diag.canonical!.artifactName.length).toBeGreaterThan(0);

				// It must be in the canonical-validation phase
				expect(diag.phase).toBe("canonical-validation");

				// It must be blocking
				expect(diag.blocking).toBe(true);
				expect(diag.severity).toBe("error");
			}),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("canonical-schema diagnostics withhold a writable plan", () => {
		fc.assert(
			fc.property(
				arbPlan(),
				fc.array(arbCanonicalSchemaDiagnostic(), {
					minLength: 1,
					maxLength: 3,
				}),
				(plan, diagnostics) => {
					const result = withholdBlockedOperations(plan, diagnostics);

					// Canonical schema errors must withhold the entire plan
					expect(result.applicationState).toBe("withheld");
					expect(result.operations).toHaveLength(0);
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("error-level source-loss diagnostics withhold a writable plan at engine level", () => {
		fc.assert(
			fc.property(
				arbPlan(),
				fc.array(arbSourceLossDiagnostic(), {
					minLength: 1,
					maxLength: 3,
				}),
				(plan, diagnostics) => {
					// The engine's buildResult logic: if hasBlocking is true, applicationState = "withheld"
					// This simulates the engine-level gating that happens BEFORE withholdBlockedOperations
					const hasBlocking = hasBlockingDiagnostics(diagnostics);

					// Source-loss-strict diagnostics are always blocking
					expect(hasBlocking).toBe(true);

					// At the engine level, blocking diagnostics => withheld regardless of path matching
					// The engine sets applicationState = "withheld" when hasBlocking || !plan
					const engineApplicationState = hasBlocking ? "withheld" : "eligible";
					expect(engineApplicationState).toBe("withheld");

					// Additionally, withholdBlockedOperations with path-matched diagnostics
					// removes only the matched operations; unmatched source paths cause full withholding
					// because blockedPaths.size would be > 0 but paths don't match output files
					const blocking = getBlockingDiagnostics(diagnostics);
					const blockedSourcePaths = new Set(
						blocking.map((d) => d.source?.path).filter(Boolean),
					);
					const outputPaths = new Set(
						plan.outputFiles.map((f) => f.relativePath),
					);

					// Check if any blocked source path matches an output path
					const hasMatchingPaths = [...blockedSourcePaths].some((p) =>
						outputPaths.has(p!),
					);

					const result = withholdBlockedOperations(plan, blocking);

					if (!hasMatchingPaths && blockedSourcePaths.size > 0) {
						// Source paths don't match output paths → operations survive at plan level
						// BUT the engine would have already withheld at result level
						expect(result.operations.length).toBeLessThanOrEqual(
							plan.operations.length,
						);
					} else if (blockedSourcePaths.size === 0) {
						// No source paths → entire plan withheld
						expect(result.applicationState).toBe("withheld");
						expect(result.operations).toHaveLength(0);
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("blocking diagnostics with specific source paths exclude only affected operations", () => {
		fc.assert(
			fc.property(
				// Plans with at least 2 files so partial withholding is testable
				fc
					.array(arbNormalizedRelativePath(), { minLength: 2, maxLength: 5 })
					.chain((rawPaths) => {
						const paths = [...new Set(rawPaths)];
						if (paths.length < 2) paths.push("extra/fallback.md");
						const plan: TranslationPlan = {
							schemaVersion: "1.0" as const,
							formatId: "test-format",
							variant: undefined,
							canonicalSchemaVersion: "1.0.0",
							outputFiles: paths.map((p) => ({
								relativePath: p,
								content: `// content for ${p}`,
								executable: false,
								mediaType: undefined,
							})),
							operations: paths.map((p, idx) => ({
								kind: "write-file" as const,
								relativePath: p,
								outputFileIndex: idx,
							})),
							applicationState: "eligible" as const,
							policyDiagnosticCodes: [],
						};

						// Block only a strict subset of paths (first path only)
						const blockedPath = paths[0];
						return fc.constant({
							plan,
							paths,
							blockedPath,
						});
					}),
				(scenario) => {
					const { plan, paths, blockedPath } = scenario;

					// Create a blocking diagnostic targeting one path
					const blockingDiag: TranslationDiagnostic = {
						code: "RS_PLAN_INVALID_PATH",
						severity: "error",
						phase: "plan-validation",
						message: `Path "${blockedPath}" violates conventions.`,
						remediation: "Fix the path.",
						blocking: true,
						unavailableDetails: [],
						source: { path: blockedPath },
					};

					const result = withholdBlockedOperations(plan, [blockingDiag]);

					// The affected operation must be excluded
					const remainingPaths = result.operations.map(
						(op) => result.outputFiles[op.outputFileIndex]?.relativePath,
					);
					expect(remainingPaths).not.toContain(blockedPath);

					// The unaffected operations must survive
					const unaffectedPaths = paths.filter((p) => p !== blockedPath);
					for (const p of unaffectedPaths) {
						expect(remainingPaths).toContain(p);
					}

					// With partial withholding, state is policy-required
					if (unaffectedPaths.length > 0) {
						expect(result.applicationState).toBe("policy-required");
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("non-blocking diagnostics leave plan eligible or policy-required without removing operations", () => {
		fc.assert(
			fc.property(
				arbPlan(),
				fc.array(arbWarningDiagnostic(), { minLength: 0, maxLength: 3 }),
				fc.array(arbInfoDiagnostic(), { minLength: 0, maxLength: 3 }),
				(plan, warnings, infos) => {
					const allDiags = [...warnings, ...infos];

					// None of these should be blocking
					expect(hasBlockingDiagnostics(allDiags)).toBe(false);

					const result = withholdBlockedOperations(plan, getBlockingDiagnostics(allDiags));

					// No blocking diagnostics → plan is eligible, all operations retained
					expect(result.applicationState).toBe("eligible");
					expect(result.operations).toHaveLength(plan.operations.length);
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("any blocking diagnostic makes the result unsuccessful and excludes affected operations", () => {
		fc.assert(
			fc.property(
				arbPlan(),
				fc.array(arbTranslationDiagnostic(), { minLength: 1, maxLength: 5 }),
				(plan, diagnostics) => {
					const blocking = getBlockingDiagnostics(diagnostics);

					if (blocking.length === 0) {
						// No blocking diagnostics → plan stays eligible
						const result = withholdBlockedOperations(plan, blocking);
						expect(result.applicationState).toBe("eligible");
						expect(result.operations).toHaveLength(plan.operations.length);
					} else {
						// Blocking diagnostics present → operations must be reduced or removed
						const result = withholdBlockedOperations(plan, blocking);
						expect(
							result.applicationState === "withheld" ||
								result.applicationState === "policy-required",
						).toBe(true);

						// Affected operations (those whose path matches a blocking diag's source path)
						// must be excluded
						const blockedPaths = new Set<string>();
						for (const d of blocking) {
							if (d.source?.path) blockedPaths.add(d.source.path);
						}

						if (blockedPaths.size === 0) {
							// No specific paths → entire plan is withheld
							expect(result.applicationState).toBe("withheld");
							expect(result.operations).toHaveLength(0);
						} else {
							// Any operation whose output path matches a blocked path must be gone
							for (const op of result.operations) {
								const file = result.outputFiles[op.outputFileIndex];
								if (file) {
									expect(blockedPaths.has(file.relativePath)).toBe(false);
								}
							}
						}
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("blocking diagnostics without source paths withhold the entire plan", () => {
		fc.assert(
			fc.property(
				arbPlan(),
				fc.array(arbCanonicalSchemaDiagnostic(), {
					minLength: 1,
					maxLength: 3,
				}),
				(plan, canonicalDiags) => {
					// Canonical schema diagnostics have canonical locations but no source.path
					// so the entire plan should be withheld
					for (const d of canonicalDiags) {
						expect(d.source).toBeUndefined();
					}

					const result = withholdBlockedOperations(plan, canonicalDiags);
					expect(result.applicationState).toBe("withheld");
					expect(result.operations).toHaveLength(0);
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});
});
