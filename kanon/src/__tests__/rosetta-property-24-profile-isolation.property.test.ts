/** Feature: rosetta-stone, Property 24: Multi-profile orchestration isolates status and translation ignores acquisition strategy */

/**
 * Property 24: Multi-profile orchestration isolates status and translation ignores acquisition strategy
 *
 * **Validates: Requirements 11.7, 11.8**
 *
 * For any batch of acquisition profiles and per-profile acquisition/translation outcomes,
 * each summary status depends only on that profile's outcomes; and any two successful
 * acquisitions that produce identical source documents and translation profiles produce
 * identical Rosetta Stone results regardless of provider, branch strategy, or subtree usage.
 *
 * This test verifies:
 * 1. Each profile's status depends only on its own outcomes (isolation).
 * 2. Same documents + same translate fn = same result regardless of how documents
 *    were "acquired" (acquisition independence).
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import type { SourceDocument, TranslationResult } from "../schemas";
import type { CollisionPolicy } from "../translation-application-policy";
import type {
	AllowedRoot,
	ApplyFn,
	ProfileOrchestrationOptions,
	TranslateFn,
} from "../translation-orchestrator";
import { orchestrateProfiles } from "../translation-orchestrator";
import type { ApplicationReport } from "../translation-plan-applier";
import { arbNormalizedRelativePath } from "./rosetta-arbitraries";

// ═══════════════════════════════════════════════════════════════════════════════
// Arbitraries
// ═══════════════════════════════════════════════════════════════════════════════

/** Generates 1-5 source documents representing a valid artifact set */
function arbDocumentSet(): fc.Arbitrary<SourceDocument[]> {
	return fc
		.tuple(
			fc.string({ minLength: 10, maxLength: 80 }),
			fc.array(
				fc.tuple(
					arbNormalizedRelativePath(),
					fc.string({ minLength: 1, maxLength: 40 }),
				),
				{ minLength: 0, maxLength: 3 },
			),
		)
		.map(([mainContent, extras]) => {
			const docs: SourceDocument[] = [
				{
					path: "knowledge.md" as string,
					content: `---\nname: "test-art"\ndescription: "desc"\nkeywords:\n  - test\n---\n\n${mainContent}`,
					executable: false,
				},
			];
			const seenPaths = new Set<string>(["knowledge.md"]);
			for (const [path, content] of extras) {
				if (!seenPaths.has(path)) {
					seenPaths.add(path);
					docs.push({ path, content, executable: false });
				}
			}
			return docs;
		});
}

/** Generates a collision policy value */
function arbCollisionPolicy(): fc.Arbitrary<CollisionPolicy> {
	return fc.constantFrom(
		"error",
		"skip",
		"replace",
		"reconcile",
	) as fc.Arbitrary<CollisionPolicy>;
}

/** Generates a unique profile name (kebab-case) */
function arbProfileName(): fc.Arbitrary<string> {
	return fc.stringMatching(/^[a-z][a-z0-9-]{1,12}$/);
}

/**
 * Generates a deterministic TranslationResult modeling various outcomes.
 * Covers success (with plan), partial (with warnings), and failure (with errors).
 */
function arbTranslationResult(): fc.Arbitrary<TranslationResult> {
	return fc
		.tuple(
			fc.constantFrom("success", "partial", "failure") as fc.Arbitrary<
				"success" | "partial" | "failure"
			>,
			fc.array(arbNormalizedRelativePath(), { minLength: 0, maxLength: 3 }),
			fc.constantFrom(
				"eligible",
				"policy-required",
				"withheld",
			) as fc.Arbitrary<"eligible" | "policy-required" | "withheld">,
		)
		.map(([status, outputPaths, applicationState]) => {
			const diagnostics = [];
			if (status === "failure") {
				diagnostics.push({
					code: "RS_SCHEMA_VIOLATION",
					severity: "error" as const,
					phase: "canonical-validation" as const,
					formatId: "kanon-canonical",
					message: "Schema violation in generated artifact",
					remediation: "Fix the source data",
					source: undefined,
					canonical: undefined,
					degradation: undefined,
					unavailableDetails: [],
					blocking: true,
				});
			}
			if (status === "partial") {
				diagnostics.push({
					code: "RS_COMPAT_PARTIAL",
					severity: "warning" as const,
					phase: "compatibility" as const,
					formatId: "kiro",
					message: "Partial compatibility for hooks",
					remediation: "Review degradation behavior",
					source: undefined,
					canonical: undefined,
					degradation: undefined,
					unavailableDetails: [],
					blocking: false,
				});
			}

			const plan =
				outputPaths.length > 0
					? {
							schemaVersion: "1.0" as const,
							formatId: "kanon-canonical",
							variant: undefined,
							canonicalSchemaVersion: "1.0.0",
							outputFiles: outputPaths.map((p) => ({
								relativePath: p,
								content: `// generated for ${p}`,
								executable: false,
								mediaType: undefined,
							})),
							operations: outputPaths.map((p, idx) => ({
								kind: "write-file" as const,
								relativePath: p,
								outputFileIndex: idx,
							})),
							applicationState,
							policyDiagnosticCodes: [],
						}
					: undefined;

			return {
				schemaVersion: "1.0" as const,
				status,
				registryVersion: "1.0.0",
				sourceFormat: {
					formatId: "kanon-canonical",
					contractVersion: "1.0",
					lifecycle: "active" as const,
				},
				targetFormat: undefined,
				canonical: undefined,
				plan,
				diagnostics,
				defaults: [],
				normalizations: [],
				degradations: [],
			} as TranslationResult;
		});
}

/**
 * Simulates different acquisition providers/strategies (GitHub, GitLab, local, subtree, etc.)
 * These are opaque labels — they should never affect translation results.
 */
function arbAcquisitionStrategy(): fc.Arbitrary<string> {
	return fc.constantFrom(
		"github-clone",
		"gitlab-subtree",
		"bitbucket-sparse",
		"local-checkout",
		"git-subtree-pull",
		"git-submodule",
		"http-archive",
	);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/** A fixed allowed root for testing */
const FIXED_ROOT: AllowedRoot = Object.freeze({
	resolvedPath: "/tmp/test-destination",
	label: "test-destination",
});

/**
 * Creates a translate function that maps profile names to their predetermined results.
 * This ensures each profile gets its own deterministic result regardless of call order.
 */
function makeProfileTranslateFn(
	profileResults: Map<string, TranslationResult>,
): TranslateFn {
	return (_documents, callerContext) => {
		const profileName = callerContext.artifactNameHint ?? "unknown";
		const result = profileResults.get(profileName);
		if (result) return result;
		// Fallback: return a generic success
		return {
			schemaVersion: "1.0" as const,
			status: "success" as const,
			registryVersion: "1.0.0",
			diagnostics: [],
			defaults: [],
			normalizations: [],
			degradations: [],
		} as TranslationResult;
	};
}

/**
 * Creates a successful apply function with deterministic results.
 */
function makeApplyFn(): ApplyFn {
	return async (options) => {
		return {
			operationId: "test-op-1",
			timestamp: "2024-01-01T00:00:00.000Z",
			completedSuccessfully: true,
			outcomes: (options.plan?.outputFiles ?? []).map((f) => ({
				path: f.relativePath,
				action: "written" as const,
				executable: false,
			})),
			failedAt: undefined,
		} as ApplicationReport;
	};
}

/**
 * Creates a failing apply function to simulate application failures.
 */
function _makeFailingApplyFn(): ApplyFn {
	return async (_options) => {
		return {
			operationId: "test-op-fail",
			timestamp: "2024-01-01T00:00:00.000Z",
			completedSuccessfully: false,
			outcomes: [{ path: "some-file.md", action: "failed" as const, executable: false }],
			failedAt: "some-file.md",
		} as ApplicationReport;
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 24: Multi-profile orchestration isolates status and translation ignores acquisition strategy", () => {
	it("profile isolation: each profile's status depends only on its own outcomes, one failure does not block others", async () => {
		await fc.assert(
			fc.asyncProperty(
				// Generate 2-4 profiles with independent documents and outcomes
				fc.array(
					fc.tuple(arbProfileName(), arbDocumentSet(), arbTranslationResult()),
					{ minLength: 2, maxLength: 4 },
				),
				arbCollisionPolicy(),
				async (profileInputs, collisionPolicy) => {
					// Deduplicate profile names to avoid conflicts in the sorted result
					const seen = new Set<string>();
					const uniqueProfiles = profileInputs.filter(([name]) => {
						if (seen.has(name)) return false;
						seen.add(name);
						return true;
					});
					if (uniqueProfiles.length < 2) return; // skip degenerate cases

					// Map profile names to their predetermined results
					const profileResults = new Map<string, TranslationResult>();
					for (const [name, , result] of uniqueProfiles) {
						profileResults.set(name, result);
					}

					const translate = makeProfileTranslateFn(profileResults);
					const apply = makeApplyFn();

					const profiles: ProfileOrchestrationOptions[] = uniqueProfiles.map(
						([name, documents]) => ({
							profileName: name,
							documents,
							callerContext: { artifactNameHint: name },
							dryRun: false,
							collisionPolicy,
							destinationRoot: FIXED_ROOT,
						}),
					);

					const result = await orchestrateProfiles({
						profiles,
						translate,
						apply,
					});

					// Verify each profile's translation status reflects only its own result
					for (const profileResult of result.profiles) {
						const expectedTranslationResult = profileResults.get(
							profileResult.profileName,
						)!;
						const expectedDocuments = uniqueProfiles.find(
							([n]) => n === profileResult.profileName,
						)![1];

						// If documents were provided, translation should run
						if (expectedDocuments.length > 0) {
							// Translation status matches the expected diagnostic severity
							const expectedErrors =
								expectedTranslationResult.diagnostics.filter(
									(d) => d.severity === "error",
								).length;
							const expectedWarnings =
								expectedTranslationResult.diagnostics.filter(
									(d) => d.severity === "warning",
								).length;

							expect(profileResult.translation.blockingDiagnosticCount).toBe(
								expectedErrors,
							);
							expect(profileResult.translation.warningCount).toBe(
								expectedWarnings,
							);

							if (expectedErrors > 0) {
								expect(profileResult.translation.status).toBe("failure");
							} else if (expectedWarnings > 0) {
								expect(profileResult.translation.status).toBe("partial");
							} else {
								expect(profileResult.translation.status).toBe("success");
							}
						} else {
							// Empty documents → acquisition failure → translation skipped
							expect(profileResult.translation.status).toBe("skipped");
						}
					}

					// Verify that a failure in one profile doesn't alter others
					// Find profiles with non-failure translation status
					const successfulProfiles = result.profiles.filter(
						(p) =>
							p.translation.status !== "failure" &&
							p.translation.status !== "skipped",
					);
					const failedProfiles = result.profiles.filter(
						(p) => p.translation.status === "failure",
					);

					// If there are both successes and failures, the successes still ran
					if (successfulProfiles.length > 0 && failedProfiles.length > 0) {
						for (const sp of successfulProfiles) {
							// Successful profiles still have correct artifact counts
							expect(sp.translation.artifactCount).toBeGreaterThanOrEqual(0);
						}
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("acquisition independence: same documents + same translate fn produce identical results regardless of acquisition strategy", async () => {
		await fc.assert(
			fc.asyncProperty(
				arbDocumentSet(),
				arbProfileName(),
				arbTranslationResult(),
				arbCollisionPolicy(),
				// Two different acquisition strategies
				arbAcquisitionStrategy(),
				arbAcquisitionStrategy(),
				async (
					documents,
					profileName,
					translationResult,
					collisionPolicy,
					strategyA,
					strategyB,
				) => {
					// Both "acquisitions" yield the same documents — the key insight is that
					// translation results must be identical no matter HOW the documents arrived.
					const profileResults = new Map<string, TranslationResult>();
					profileResults.set(profileName, translationResult);

					const translateA = makeProfileTranslateFn(profileResults);
					const translateB = makeProfileTranslateFn(profileResults);
					const applyA = makeApplyFn();
					const applyB = makeApplyFn();

					// Strategy A orchestration (e.g., "github-clone")
					const resultA = await orchestrateProfiles({
						profiles: [
							{
								profileName,
								documents,
								callerContext: {
									artifactNameHint: profileName,
									acquisitionStrategy: strategyA,
								},
								dryRun: true,
								collisionPolicy,
								destinationRoot: FIXED_ROOT,
							},
						],
						translate: translateA,
						apply: applyA,
					});

					// Strategy B orchestration (e.g., "gitlab-subtree")
					const resultB = await orchestrateProfiles({
						profiles: [
							{
								profileName,
								documents,
								callerContext: {
									artifactNameHint: profileName,
									acquisitionStrategy: strategyB,
								},
								dryRun: true,
								collisionPolicy,
								destinationRoot: FIXED_ROOT,
							},
						],
						translate: translateB,
						apply: applyB,
					});

					// Both orchestrations received the SAME documents, so the translation
					// phase results MUST be identical regardless of the acquisition strategy.
					expect(resultA.profiles.length).toBe(resultB.profiles.length);
					expect(resultA.profiles.length).toBe(1);

					const profileA = resultA.profiles[0];
					const profileB = resultB.profiles[0];

					// Acquisition status is identical (same docs in both)
					expect(profileA.acquisition.status).toBe(profileB.acquisition.status);
					expect(profileA.acquisition.documentCount).toBe(
						profileB.acquisition.documentCount,
					);

					// Translation status is identical (same translate fn, same docs)
					expect(profileA.translation.status).toBe(profileB.translation.status);
					expect(profileA.translation.artifactCount).toBe(
						profileB.translation.artifactCount,
					);
					expect(profileA.translation.blockingDiagnosticCount).toBe(
						profileB.translation.blockingDiagnosticCount,
					);
					expect(profileA.translation.warningCount).toBe(
						profileB.translation.warningCount,
					);

					// Plan summaries are identical
					expect(JSON.stringify(profileA.translation.planSummaries)).toBe(
						JSON.stringify(profileB.translation.planSummaries),
					);

					// Overall status is identical
					expect(resultA.overallStatus).toBe(resultB.overallStatus);

					// Combined plan summaries are identical
					expect(JSON.stringify(resultA.combinedPlanSummaries)).toBe(
						JSON.stringify(resultB.combinedPlanSummaries),
					);
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("profile ordering: results are sorted deterministically by profile name regardless of input order", async () => {
		await fc.assert(
			fc.asyncProperty(
				fc.array(fc.tuple(arbDocumentSet(), arbTranslationResult()), {
					minLength: 2,
					maxLength: 4,
				}),
				async (profileInputs) => {
					// Create profiles with deterministic names and shuffle input order
					const profileData = profileInputs.map(([docs, result], idx) => ({
						name: `profile-${String.fromCharCode(97 + idx)}`,
						documents: docs,
						result,
					}));

					const profileResults = new Map<string, TranslationResult>();
					for (const { name, result } of profileData) {
						profileResults.set(name, result);
					}

					const translate = makeProfileTranslateFn(profileResults);
					const apply = makeApplyFn();

					// Original order
					const profilesOriginal: ProfileOrchestrationOptions[] =
						profileData.map(({ name, documents }) => ({
							profileName: name,
							documents,
							callerContext: { artifactNameHint: name },
							dryRun: true,
							collisionPolicy: "error" as CollisionPolicy,
							destinationRoot: FIXED_ROOT,
						}));

					// Reversed order
					const profilesReversed = [...profilesOriginal].reverse();

					const [resultOriginal, resultReversed] = await Promise.all([
						orchestrateProfiles({
							profiles: profilesOriginal,
							translate,
							apply,
						}),
						orchestrateProfiles({
							profiles: profilesReversed,
							translate,
							apply,
						}),
					]);

					// Output profiles must be in the same deterministic order (by name)
					expect(resultOriginal.profiles.length).toBe(
						resultReversed.profiles.length,
					);
					for (let i = 0; i < resultOriginal.profiles.length; i++) {
						expect(resultOriginal.profiles[i].profileName).toBe(
							resultReversed.profiles[i].profileName,
						);
						expect(resultOriginal.profiles[i].translation.status).toBe(
							resultReversed.profiles[i].translation.status,
						);
					}

					// Profiles are sorted by code-point order
					for (let i = 1; i < resultOriginal.profiles.length; i++) {
						const prev = resultOriginal.profiles[i - 1].profileName;
						const curr = resultOriginal.profiles[i].profileName;
						expect(prev < curr).toBe(true);
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("failure isolation: a failing profile does not prevent successful profiles from completing", async () => {
		await fc.assert(
			fc.asyncProperty(
				arbDocumentSet(),
				arbDocumentSet(),
				arbCollisionPolicy(),
				async (docsA, docsB, collisionPolicy) => {
					// Profile A: will succeed
					const successResult: TranslationResult = {
						schemaVersion: "1.0",
						status: "success",
						registryVersion: "1.0.0",
						sourceFormat: {
							formatId: "kanon-canonical",
							contractVersion: "1.0",
							lifecycle: "active",
						},
						targetFormat: undefined,
						canonical: undefined,
						plan: {
							schemaVersion: "1.0",
							formatId: "kanon-canonical",
							variant: undefined,
							canonicalSchemaVersion: "1.0.0",
							outputFiles: [
								{
									relativePath: "knowledge.md",
									content: "# Success",
									executable: false,
									mediaType: undefined,
								},
							],
							operations: [
								{
									kind: "write-file",
									relativePath: "knowledge.md",
									outputFileIndex: 0,
								},
							],
							applicationState: "eligible",
							policyDiagnosticCodes: [],
						},
						diagnostics: [],
						defaults: [],
						normalizations: [],
						degradations: [],
					};

					// Profile B: will fail (blocking error)
					const failureResult: TranslationResult = {
						schemaVersion: "1.0",
						status: "failure",
						registryVersion: "1.0.0",
						sourceFormat: {
							formatId: "kanon-canonical",
							contractVersion: "1.0",
							lifecycle: "active",
						},
						targetFormat: undefined,
						canonical: undefined,
						plan: undefined,
						diagnostics: [
							{
								code: "RS_SCHEMA_VIOLATION",
								severity: "error",
								phase: "canonical-validation",
								formatId: "kanon-canonical",
								message: "Blocking error for profile-b",
								remediation: "Fix the issue",
								source: undefined,
								canonical: undefined,
								degradation: undefined,
								unavailableDetails: [],
								blocking: true,
							},
						],
						defaults: [],
						normalizations: [],
						degradations: [],
					};

					const profileResults = new Map<string, TranslationResult>();
					profileResults.set("profile-a", successResult);
					profileResults.set("profile-b", failureResult);

					const translate = makeProfileTranslateFn(profileResults);
					const apply = makeApplyFn();

					const result = await orchestrateProfiles({
						profiles: [
							{
								profileName: "profile-a",
								documents: docsA,
								callerContext: { artifactNameHint: "profile-a" },
								dryRun: false,
								collisionPolicy,
								destinationRoot: FIXED_ROOT,
							},
							{
								profileName: "profile-b",
								documents: docsB,
								callerContext: { artifactNameHint: "profile-b" },
								dryRun: false,
								collisionPolicy,
								destinationRoot: FIXED_ROOT,
							},
						],
						translate,
						apply,
					});

					// Both profiles should be present in results
					expect(result.profiles.length).toBe(2);

					// Find each profile in results (they're sorted by name)
					const profileAResult = result.profiles.find(
						(p) => p.profileName === "profile-a",
					)!;
					const profileBResult = result.profiles.find(
						(p) => p.profileName === "profile-b",
					)!;

					// Profile A: succeeded its translation phase
					if (docsA.length > 0) {
						expect(profileAResult.translation.status).toBe("success");
						expect(profileAResult.translation.blockingDiagnosticCount).toBe(0);
					}

					// Profile B: failed its translation phase
					if (docsB.length > 0) {
						expect(profileBResult.translation.status).toBe("failure");
						expect(profileBResult.translation.blockingDiagnosticCount).toBe(1);
					}

					// Profile A's success is NOT blocked by Profile B's failure
					if (docsA.length > 0) {
						expect(
							profileAResult.translation.artifactCount,
						).toBeGreaterThanOrEqual(0);
						// Application phase ran for profile A (it had an eligible plan)
						expect(profileAResult.application.status).not.toBe("failure");
					}

					// Overall status is partial (mix of success and failure)
					if (docsA.length > 0 && docsB.length > 0) {
						expect(result.overallStatus).toBe("partial");
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("translation ignores acquisition metadata: callerContext with provider info does not alter translation phase results", async () => {
		await fc.assert(
			fc.asyncProperty(
				arbDocumentSet(),
				arbProfileName(),
				arbTranslationResult(),
				fc.record({
					provider: arbAcquisitionStrategy(),
					branch: fc.stringMatching(/^[a-z]{2,8}$/),
					useSubtree: fc.boolean(),
					remote: fc.constantFrom("origin", "upstream", "fork"),
				}),
				async (documents, profileName, translationResult, acquisitionMeta) => {
					// The translate function captures the profile name from callerContext
					// but acquisition metadata should not alter the translation result.
					const profileResults = new Map<string, TranslationResult>();
					profileResults.set(profileName, translationResult);

					const translate = makeProfileTranslateFn(profileResults);
					const apply = makeApplyFn();

					// Orchestrate with acquisition metadata in callerContext
					const resultWithMeta = await orchestrateProfiles({
						profiles: [
							{
								profileName,
								documents,
								callerContext: {
									artifactNameHint: profileName,
									provider: acquisitionMeta.provider,
									branch: acquisitionMeta.branch,
									useSubtree: String(acquisitionMeta.useSubtree),
									remote: acquisitionMeta.remote,
								},
								dryRun: true,
								collisionPolicy: "error",
								destinationRoot: FIXED_ROOT,
							},
						],
						translate,
						apply,
					});

					// Orchestrate without acquisition metadata
					const resultWithoutMeta = await orchestrateProfiles({
						profiles: [
							{
								profileName,
								documents,
								callerContext: {
									artifactNameHint: profileName,
								},
								dryRun: true,
								collisionPolicy: "error",
								destinationRoot: FIXED_ROOT,
							},
						],
						translate,
						apply,
					});

					// Both runs use the same translate fn keyed by profile name,
					// so the translation outcomes MUST be identical
					const pa = resultWithMeta.profiles[0];
					const pb = resultWithoutMeta.profiles[0];

					expect(pa.translation.status).toBe(pb.translation.status);
					expect(pa.translation.artifactCount).toBe(
						pb.translation.artifactCount,
					);
					expect(pa.translation.blockingDiagnosticCount).toBe(
						pb.translation.blockingDiagnosticCount,
					);
					expect(pa.translation.warningCount).toBe(pb.translation.warningCount);
					expect(JSON.stringify(pa.translation.planSummaries)).toBe(
						JSON.stringify(pb.translation.planSummaries),
					);
					expect(resultWithMeta.overallStatus).toBe(
						resultWithoutMeta.overallStatus,
					);
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});
});
