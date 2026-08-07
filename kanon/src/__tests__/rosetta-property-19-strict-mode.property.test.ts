/**
 * Property 19: Strict mode promotes compatibility and undeclared loss uniformly
 *
 * **Validates: Requirements 7.6, 7.7**
 *
 * This property test verifies that for any compatibility evaluation result:
 * 1. `promoteInStrictMode()` promotes all compatibility-phase warning diagnostics to error severity
 * 2. Non-compatibility diagnostics (other phases) are NOT modified
 * 3. Promoted diagnostics have `blocking: true`
 * 4. The degradation records themselves are unchanged (only diagnostic severity changes)
 * 5. affectedCounts are unchanged
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import type {
	CanonicalCapability,
	DegradationStrategy,
	KnowledgeArtifact,
	RosettaCompatibilityEntry,
	RosettaSeverity,
	TranslationDiagnostic,
	TranslationPhase,
} from "../schemas";
import { CanonicalCapabilitySchema } from "../schemas";
import {
	evaluateCompatibility,
	identifyUsedCapabilities,
	promoteInStrictMode,
	type CompatibilityEvaluation,
	type EffectiveCompatibilityProfile,
} from "../rosetta/compatibility";
import { makeArtifact, makeFrontmatter } from "./test-helpers";

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

const ALL_CAPABILITIES: readonly CanonicalCapability[] =
	CanonicalCapabilitySchema.options;

const NON_COMPATIBILITY_PHASES: readonly TranslationPhase[] = [
	"request",
	"registry",
	"detection",
	"source-validation",
	"source-translation",
	"canonical-validation",
	"target-translation",
	"plan-validation",
	"redaction",
];

// ═══════════════════════════════════════════════════════════════════════════════
// Arbitraries
// ═══════════════════════════════════════════════════════════════════════════════

/** Generates a valid degradation strategy */
function arbDegradationStrategy(): fc.Arbitrary<DegradationStrategy> {
	return fc.constantFrom("inline", "comment", "omit");
}

/**
 * Generates a profile with a random subset of capabilities degraded.
 */
function arbRandomDegradedProfile(): fc.Arbitrary<EffectiveCompatibilityProfile> {
	return fc
		.subarray([...ALL_CAPABILITIES], { minLength: 1, maxLength: 6 })
		.chain((degradedCaps) =>
			fc
				.tuple(
					...degradedCaps.map(() =>
						fc.tuple(
							fc.constantFrom("partial" as const, "none" as const),
							arbDegradationStrategy(),
						),
					),
				)
				.map((entries) => {
					const profile: Record<string, RosettaCompatibilityEntry> = {};
					for (const cap of ALL_CAPABILITIES) {
						profile[cap] = { support: "full" };
					}
					for (let i = 0; i < degradedCaps.length; i++) {
						const [support, degradation] = entries[i];
						profile[degradedCaps[i]] = { support, degradation };
					}
					return Object.freeze(profile) as EffectiveCompatibilityProfile;
				}),
		);
}

/** Generates a hook entry */
function arbHook(): fc.Arbitrary<{
	name: string;
	event: "file_edited" | "file_created" | "file_deleted" | "agent_stop" | "prompt_submit" | "pre_tool_use" | "post_tool_use" | "pre_task" | "post_task" | "user_triggered";
	action: { type: "run_command"; command: string };
}> {
	return fc
		.tuple(
			fc.stringMatching(/^[a-z]{3,10}$/),
			fc.constantFrom(
				"file_edited" as const,
				"file_created" as const,
				"user_triggered" as const,
			),
			fc.stringMatching(/^[a-z]{3,10}$/),
		)
		.map(([name, event, command]) => ({
			name,
			event,
			action: { type: "run_command" as const, command },
		}));
}

/** Generates an MCP server entry */
function arbMcpServer(): fc.Arbitrary<{
	name: string;
	transport: "stdio";
	command: string;
	args: string[];
	env: Record<string, string>;
}> {
	return fc.record({
		name: fc.stringMatching(/^[a-z]{3,10}$/),
		transport: fc.constant("stdio" as const),
		command: fc.stringMatching(/^[a-z]{3,10}$/),
		args: fc.array(fc.stringMatching(/^[a-z]{2,6}$/), {
			minLength: 0,
			maxLength: 2,
		}),
		env: fc.constant({} as Record<string, string>),
	});
}

/** Generates a workflow entry */
function arbWorkflow(): fc.Arbitrary<{
	name: string;
	filename: string;
	content: string;
}> {
	return fc
		.tuple(
			fc.stringMatching(/^[a-z]{3,8}$/),
			fc.string({ minLength: 5, maxLength: 50 }),
		)
		.map(([slug, content]) => ({
			name: slug.charAt(0).toUpperCase() + slug.slice(1),
			filename: `${slug}.md`,
			content,
		}));
}

/**
 * Generates an artifact with varying content across all field groups.
 */
function arbArtifactWithVaryingContent(): fc.Arbitrary<KnowledgeArtifact> {
	return fc
		.record({
			hasBody: fc.boolean(),
			hooks: fc.array(arbHook(), { minLength: 0, maxLength: 3 }),
			mcpServers: fc.array(arbMcpServer(), { minLength: 0, maxLength: 3 }),
			workflows: fc.array(arbWorkflow(), { minLength: 0, maxLength: 3 }),
			bodyOverrideCount: fc.integer({ min: 0, max: 3 }),
			extraFieldCount: fc.integer({ min: 0, max: 3 }),
			inclusion: fc.constantFrom("always", "auto", "fileMatch", "manual"),
			filePatterns: fc.array(fc.stringMatching(/^\*\*\/\*\.[a-z]{2,4}$/), {
				minLength: 0,
				maxLength: 3,
			}),
			artifactType: fc.constantFrom(
				"skill",
				"power",
				"rule",
				"workflow",
				"agent",
				"prompt",
				"template",
				"reference-pack",
			),
		})
		.map(
			({
				hasBody,
				hooks,
				mcpServers,
				workflows,
				bodyOverrideCount,
				extraFieldCount,
				inclusion,
				filePatterns,
				artifactType,
			}) => {
				const bodyOverrides: Record<string, string> = {};
				for (let i = 0; i < bodyOverrideCount; i++) {
					bodyOverrides[`harness-${i}`] = `override content ${i}`;
				}

				const extraFields: Record<string, unknown> = {};
				for (let i = 0; i < extraFieldCount; i++) {
					extraFields[`x-extra-${i}`] = `value-${i}`;
				}

				return makeArtifact({
					frontmatter: makeFrontmatter({
						type: artifactType as any,
						inclusion: inclusion as any,
						file_patterns: filePatterns.length > 0 ? filePatterns : undefined,
					}),
					body: hasBody ? "# Content\n\nSome body text." : "",
					hooks,
					mcpServers: mcpServers,
					workflows,
					bodyOverrides,
					extraFields,
				});
			},
		);
}

/**
 * Generates a synthetic non-compatibility diagnostic with a random phase and severity.
 */
function arbNonCompatibilityDiagnostic(): fc.Arbitrary<TranslationDiagnostic> {
	return fc
		.record({
			phase: fc.constantFrom(...NON_COMPATIBILITY_PHASES),
			severity: fc.constantFrom(
				"info" as const,
				"warning" as const,
				"error" as const,
			),
			blocking: fc.boolean(),
			code: fc.stringMatching(/^RS_[A-Z]{4,10}$/),
		})
		.map(({ phase, severity, blocking, code }) => ({
			code,
			severity,
			phase,
			message: `Test diagnostic for phase ${phase}`,
			remediation: "No action required for test diagnostic.",
			blocking,
			unavailableDetails: [],
		}));
}

/**
 * Generates a CompatibilityEvaluation that includes both compatibility-phase
 * diagnostics (from evaluateCompatibility) and injected non-compatibility diagnostics.
 */
function arbEvaluationWithMixedDiagnostics(): fc.Arbitrary<{
	evaluation: CompatibilityEvaluation;
	nonCompatDiagnostics: TranslationDiagnostic[];
}> {
	return fc
		.tuple(
			arbArtifactWithVaryingContent(),
			arbRandomDegradedProfile(),
			fc.array(arbNonCompatibilityDiagnostic(), {
				minLength: 0,
				maxLength: 4,
			}),
		)
		.map(([artifact, profile, nonCompatDiagnostics]) => {
			const usedCapabilities = identifyUsedCapabilities(artifact);
			const baseEvaluation = evaluateCompatibility(
				profile,
				usedCapabilities,
				artifact,
			);

			// Mix in non-compatibility diagnostics to simulate a real evaluation
			// that has been combined with other phases
			const mixedEvaluation: CompatibilityEvaluation = {
				...baseEvaluation,
				diagnostics: [...baseEvaluation.diagnostics, ...nonCompatDiagnostics],
			};

			return { evaluation: mixedEvaluation, nonCompatDiagnostics };
		});
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 19: Strict mode promotes compatibility and undeclared loss uniformly", () => {
	it("promotes all compatibility-phase warning diagnostics to error severity", () => {
		fc.assert(
			fc.property(
				arbEvaluationWithMixedDiagnostics(),
				({ evaluation }) => {
					const promoted = promoteInStrictMode(evaluation);

					// Every compatibility-phase diagnostic that was a warning should now be an error
					for (const diagnostic of promoted.diagnostics) {
						if (diagnostic.phase === "compatibility") {
							// Find the original diagnostic by matching code + message
							const original = evaluation.diagnostics.find(
								(d) =>
									d.code === diagnostic.code &&
									d.message === diagnostic.message &&
									d.phase === "compatibility",
							);

							if (original && original.severity === "warning") {
								expect(diagnostic.severity).toBe("error");
							}
						}
					}

					// No compatibility-phase diagnostic should remain as "warning" after promotion
					const remainingWarnings = promoted.diagnostics.filter(
						(d) => d.phase === "compatibility" && d.severity === "warning",
					);
					expect(remainingWarnings.length).toBe(0);
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("does not modify non-compatibility diagnostics (other phases)", () => {
		fc.assert(
			fc.property(
				arbEvaluationWithMixedDiagnostics(),
				({ evaluation, nonCompatDiagnostics }) => {
					const promoted = promoteInStrictMode(evaluation);

					// Extract non-compatibility diagnostics from the promoted result
					const promotedNonCompat = promoted.diagnostics.filter(
						(d) => d.phase !== "compatibility",
					);

					// They should be exactly the same as the injected non-compat diagnostics
					expect(promotedNonCompat.length).toBe(nonCompatDiagnostics.length);

					for (let i = 0; i < nonCompatDiagnostics.length; i++) {
						const original = nonCompatDiagnostics[i];
						const afterPromotion = promotedNonCompat[i];

						// Severity unchanged
						expect(afterPromotion.severity).toBe(original.severity);
						// Phase unchanged
						expect(afterPromotion.phase).toBe(original.phase);
						// Blocking unchanged
						expect(afterPromotion.blocking).toBe(original.blocking);
						// Code unchanged
						expect(afterPromotion.code).toBe(original.code);
						// Message unchanged
						expect(afterPromotion.message).toBe(original.message);
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("promoted diagnostics have blocking: true", () => {
		fc.assert(
			fc.property(
				arbEvaluationWithMixedDiagnostics(),
				({ evaluation }) => {
					const promoted = promoteInStrictMode(evaluation);

					// All compatibility-phase diagnostics that were promoted from warning
					// should have blocking: true
					for (const diagnostic of promoted.diagnostics) {
						if (
							diagnostic.phase === "compatibility" &&
							diagnostic.severity === "error"
						) {
							expect(diagnostic.blocking).toBe(true);
						}
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("degradation records are unchanged after promotion", () => {
		fc.assert(
			fc.property(
				arbEvaluationWithMixedDiagnostics(),
				({ evaluation }) => {
					const promoted = promoteInStrictMode(evaluation);

					// Degradation records should be identical before and after
					expect(promoted.degradations).toEqual(evaluation.degradations);
					expect(promoted.degradations.length).toBe(
						evaluation.degradations.length,
					);

					for (let i = 0; i < evaluation.degradations.length; i++) {
						const before = evaluation.degradations[i];
						const after = promoted.degradations[i];
						expect(after.capability).toBe(before.capability);
						expect(after.action).toBe(before.action);
						expect(after.affectedValueCount).toBe(before.affectedValueCount);
						expect(after.canonicalPaths).toEqual(before.canonicalPaths);
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("affectedCounts are unchanged after promotion", () => {
		fc.assert(
			fc.property(
				arbEvaluationWithMixedDiagnostics(),
				({ evaluation }) => {
					const promoted = promoteInStrictMode(evaluation);

					// affectedCounts should be identical before and after
					expect(promoted.affectedCounts).toEqual(evaluation.affectedCounts);

					// Verify each key individually
					const keys = Object.keys(evaluation.affectedCounts);
					for (const key of keys) {
						expect(promoted.affectedCounts[key]).toBe(
							evaluation.affectedCounts[key],
						);
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("total diagnostic count is preserved (no diagnostics added or removed)", () => {
		fc.assert(
			fc.property(
				arbEvaluationWithMixedDiagnostics(),
				({ evaluation }) => {
					const promoted = promoteInStrictMode(evaluation);

					// The total number of diagnostics should be the same
					expect(promoted.diagnostics.length).toBe(
						evaluation.diagnostics.length,
					);
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("non-warning compatibility diagnostics (info, error) remain unchanged", () => {
		fc.assert(
			fc.property(
				arbArtifactWithVaryingContent(),
				arbRandomDegradedProfile(),
				(artifact, profile) => {
					const usedCapabilities = identifyUsedCapabilities(artifact);
					const baseEvaluation = evaluateCompatibility(
						profile,
						usedCapabilities,
						artifact,
					);

					// The compatibility diagnostics from evaluateCompatibility are warnings by default
					// (RS_COMPATIBILITY_PARTIAL and RS_COMPATIBILITY_NONE have defaultSeverity: "warning").
					// This test verifies that if there were info or error compatibility diagnostics
					// (edge case), they wouldn't be modified.
					const promoted = promoteInStrictMode(baseEvaluation);

					for (let i = 0; i < baseEvaluation.diagnostics.length; i++) {
						const original = baseEvaluation.diagnostics[i];
						const after = promoted.diagnostics[i];

						if (
							original.phase === "compatibility" &&
							original.severity !== "warning"
						) {
							// Non-warning compatibility diagnostics should be unchanged
							expect(after.severity).toBe(original.severity);
							expect(after.blocking).toBe(original.blocking);
						}
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});
});
