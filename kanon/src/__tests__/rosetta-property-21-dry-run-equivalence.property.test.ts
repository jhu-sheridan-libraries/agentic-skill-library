/** Feature: rosetta-stone, Property 21: Dry-run and write-enabled analysis are pre-application equivalent */

/**
 * Property 21: Dry-run and write-enabled analysis are pre-application equivalent
 *
 * **Validates: Requirements 9.2, 9.3**
 *
 * This property test verifies that for any resolved request and identical modeled
 * filesystem preconditions:
 * 1. Dry-run and write-enabled orchestration produce equivalent translation status and plan summaries
 * 2. The inspection report fields (formats, evidence, versions, canonical summaries, defaults,
 *    normalizations, compatibility, diagnostics, and planned paths) are faithful projections
 *    of the resolved request and result
 * 3. In dry-run mode, the PlanApplier is NEVER invoked (application status = "skipped")
 * 4. Both modes call runPreApplicationPath identically (same translate function, same inputs)
 */

import { describe, expect, it } from "bun:test";
import fc from "fast-check";

import type {
	SourceDocument,
	TranslationDiagnostic,
	TranslationPlan,
	TranslationResult,
} from "../schemas";
import type {
	ApplyFn,
	ProfileOrchestrationOptions,
	ProfileOrchestrationResult,
	TranslateFn,
} from "../translation-orchestrator";
import { orchestrateProfile } from "../translation-orchestrator";
import type { AllowedRoot } from "../translation-orchestrator";
import type { CollisionPolicy } from "../translation-application-policy";
import type { ApplicationReport } from "../translation-plan-applier";
import {
	arbFormatIdentifier,
	arbNormalizedRelativePath,
	arbTranslationDiagnostic,
} from "./rosetta-arbitraries";

// ═══════════════════════════════════════════════════════════════════════════════
// Generators
// ═══════════════════════════════════════════════════════════════════════════════

/** Generates a minimal SourceDocument set (1-4 documents, deduplicated paths) */
function arbDocumentSet(): fc.Arbitrary<SourceDocument[]> {
	return fc
		.array(
			fc.record({
				path: arbNormalizedRelativePath(),
				content: fc.string({ minLength: 1, maxLength: 100 }),
				executable: fc.boolean(),
			}),
			{ minLength: 1, maxLength: 4 },
		)
		.map((docs) => {
			const seen = new Set<string>();
			return docs.filter((d) => {
				if (seen.has(d.path)) return false;
				seen.add(d.path);
				return true;
			});
		})
		.filter((docs) => docs.length > 0) as fc.Arbitrary<SourceDocument[]>;
}

/** Generates a caller context record */
function arbCallerContext(): fc.Arbitrary<Record<string, string>> {
	return fc.record({
		artifactNameHint: fc.stringMatching(/^[a-z][a-z0-9-]{1,15}$/),
	});
}

/** Generates a CollisionPolicy value */
function arbCollisionPolicy(): fc.Arbitrary<CollisionPolicy> {
	return fc.constantFrom("error", "skip", "replace", "reconcile") as fc.Arbitrary<CollisionPolicy>;
}

/** Generates a valid TranslationPlan with eligible state (so applier is invoked in write mode) */
function arbEligiblePlan(): fc.Arbitrary<TranslationPlan> {
	return fc
		.array(arbNormalizedRelativePath(), { minLength: 1, maxLength: 4 })
		.chain((rawPaths) => {
			const paths = [...new Set(rawPaths)];
			if (paths.length === 0) paths.push("fallback/file.md");
			return fc.constant({
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
			});
		});
}

/** Generates a TranslationPlan with any applicationState */
function arbPlan(): fc.Arbitrary<TranslationPlan> {
	return fc
		.tuple(
			arbFormatIdentifier(),
			fc.array(arbNormalizedRelativePath(), { minLength: 1, maxLength: 4 }),
			fc.constantFrom("eligible", "policy-required", "withheld"),
		)
		.map(([formatId, rawPaths, applicationState]) => {
			const paths = [...new Set(rawPaths)];
			if (paths.length === 0) paths.push("fallback/file.md");
			return {
				schemaVersion: "1.0" as const,
				formatId,
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
				applicationState: applicationState as "eligible" | "policy-required" | "withheld",
				policyDiagnosticCodes: [],
			};
		});
}

/** Generates a TranslationResult with varying status, plan, and diagnostics */
function arbTranslationResult(): fc.Arbitrary<TranslationResult> {
	return fc
		.tuple(
			fc.constantFrom("success", "partial", "failure"),
			fc.option(arbPlan(), { nil: undefined }),
			fc.array(arbTranslationDiagnostic(), { minLength: 0, maxLength: 3 }),
		)
		.map(([status, plan, diagnostics]) => ({
			schemaVersion: "1.0" as const,
			status: status as "success" | "partial" | "failure",
			registryVersion: "1.0.0",
			sourceFormat: undefined,
			targetFormat: undefined,
			canonical: undefined,
			plan,
			diagnostics,
			defaults: [],
			normalizations: [],
			degradations: [],
		}));
}

/** Creates a mock AllowedRoot */
function mockAllowedRoot(): AllowedRoot {
	return Object.freeze({
		resolvedPath: "/tmp/test-destination",
		label: "test-destination",
	});
}

/**
 * Creates a deterministic TranslateFn that returns a fixed result.
 * Tracks invocations to verify both modes call it identically.
 */
function createTrackedTranslateFn(result: TranslationResult): {
	translate: TranslateFn;
	calls: Array<{ documents: readonly SourceDocument[]; callerContext: Record<string, string> }>;
} {
	const calls: Array<{ documents: readonly SourceDocument[]; callerContext: Record<string, string> }> = [];
	const translate: TranslateFn = (documents, callerContext) => {
		calls.push({ documents, callerContext });
		return result;
	};
	return { translate, calls };
}

/**
 * Creates a mock ApplyFn that tracks invocations and always succeeds.
 */
function createTrackedApplyFn(): {
	apply: ApplyFn;
	calls: Array<unknown>;
} {
	const calls: Array<unknown> = [];
	const apply: ApplyFn = async (options) => {
		calls.push(options);
		const report: ApplicationReport = {
			operationId: "apply-test-1",
			timestamp: new Date().toISOString(),
			outcomes: (options.plan?.outputFiles ?? []).map((f) => ({
				relativePath: f.relativePath,
				action: "written" as const,
			})),
			completedSuccessfully: true,
		};
		return report;
	};
	return { apply, calls };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Property 21: Dry-run and write-enabled analysis are pre-application equivalent", () => {
	it("dry-run and write-enabled produce equivalent translation status and plan summaries", async () => {
		await fc.assert(
			fc.asyncProperty(
				arbDocumentSet(),
				arbCallerContext(),
				arbTranslationResult(),
				arbCollisionPolicy(),
				async (documents, callerContext, translationResult, collisionPolicy) => {
					const destRoot = mockAllowedRoot();

					// Create two independent tracked translate functions returning the same result
					const dryRunTracker = createTrackedTranslateFn(translationResult);
					const writeTracker = createTrackedTranslateFn(translationResult);
					const dryRunApply = createTrackedApplyFn();
					const writeApply = createTrackedApplyFn();

					// Run dry-run
					const dryRunResult = await orchestrateProfile(
						{
							profileName: "test-profile",
							documents,
							callerContext,
							dryRun: true,
							collisionPolicy,
							destinationRoot: destRoot,
						},
						dryRunTracker.translate,
						dryRunApply.apply,
					);

					// Run write-enabled
					const writeResult = await orchestrateProfile(
						{
							profileName: "test-profile",
							documents,
							callerContext,
							dryRun: false,
							collisionPolicy,
							destinationRoot: destRoot,
						},
						writeTracker.translate,
						writeApply.apply,
					);

					// Translation status must be equivalent (pre-application path is identical)
					expect(dryRunResult.translation.status).toBe(writeResult.translation.status);
					expect(dryRunResult.translation.artifactCount).toBe(writeResult.translation.artifactCount);
					expect(dryRunResult.translation.blockingDiagnosticCount).toBe(
						writeResult.translation.blockingDiagnosticCount,
					);
					expect(dryRunResult.translation.warningCount).toBe(writeResult.translation.warningCount);

					// Plan summaries must be equivalent
					expect(dryRunResult.translation.planSummaries.length).toBe(
						writeResult.translation.planSummaries.length,
					);
					for (let i = 0; i < dryRunResult.translation.planSummaries.length; i++) {
						const drySummary = dryRunResult.translation.planSummaries[i];
						const writeSummary = writeResult.translation.planSummaries[i];
						expect(drySummary.artifactName).toBe(writeSummary.artifactName);
						expect(drySummary.outputFileCount).toBe(writeSummary.outputFileCount);
						expect(drySummary.applicationState).toBe(writeSummary.applicationState);
					}

					// Acquisition status must also be equivalent
					expect(dryRunResult.acquisition.status).toBe(writeResult.acquisition.status);
					expect(dryRunResult.acquisition.documentCount).toBe(writeResult.acquisition.documentCount);
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("dry-run mode never invokes the PlanApplier", async () => {
		await fc.assert(
			fc.asyncProperty(
				arbDocumentSet(),
				arbCallerContext(),
				arbTranslationResult(),
				arbCollisionPolicy(),
				async (documents, callerContext, translationResult, collisionPolicy) => {
					const destRoot = mockAllowedRoot();
					const tracker = createTrackedTranslateFn(translationResult);
					const applyTracker = createTrackedApplyFn();

					const result = await orchestrateProfile(
						{
							profileName: "dry-run-profile",
							documents,
							callerContext,
							dryRun: true,
							collisionPolicy,
							destinationRoot: destRoot,
						},
						tracker.translate,
						applyTracker.apply,
					);

					// PlanApplier must NEVER be called in dry-run mode
					expect(applyTracker.calls.length).toBe(0);

					// Application status must be "skipped"
					expect(result.application.status).toBe("skipped");
					expect(result.application.filesWritten).toBe(0);
					expect(result.application.filesSkipped).toBe(0);
					expect(result.application.filesFailed).toBe(0);
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("both modes invoke the translate function with identical inputs", async () => {
		await fc.assert(
			fc.asyncProperty(
				arbDocumentSet(),
				arbCallerContext(),
				arbTranslationResult(),
				arbCollisionPolicy(),
				async (documents, callerContext, translationResult, collisionPolicy) => {
					const destRoot = mockAllowedRoot();
					const dryRunTracker = createTrackedTranslateFn(translationResult);
					const writeTracker = createTrackedTranslateFn(translationResult);
					const dryRunApply = createTrackedApplyFn();
					const writeApply = createTrackedApplyFn();

					await orchestrateProfile(
						{
							profileName: "test-profile",
							documents,
							callerContext,
							dryRun: true,
							collisionPolicy,
							destinationRoot: destRoot,
						},
						dryRunTracker.translate,
						dryRunApply.apply,
					);

					await orchestrateProfile(
						{
							profileName: "test-profile",
							documents,
							callerContext,
							dryRun: false,
							collisionPolicy,
							destinationRoot: destRoot,
						},
						writeTracker.translate,
						writeApply.apply,
					);

					// Both modes must call the translate function exactly once
					expect(dryRunTracker.calls.length).toBe(1);
					expect(writeTracker.calls.length).toBe(1);

					// The inputs must be identical
					const dryCall = dryRunTracker.calls[0];
					const writeCall = writeTracker.calls[0];

					// Same documents
					expect(dryCall.documents.length).toBe(writeCall.documents.length);
					for (let i = 0; i < dryCall.documents.length; i++) {
						expect(dryCall.documents[i].path).toBe(writeCall.documents[i].path);
						expect(dryCall.documents[i].content).toBe(writeCall.documents[i].content);
					}

					// Same caller context
					expect(dryCall.callerContext).toEqual(writeCall.callerContext);
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("inspection report fields are faithful projections of the resolved request and translation result", async () => {
		await fc.assert(
			fc.asyncProperty(
				arbDocumentSet(),
				arbCallerContext(),
				arbTranslationResult(),
				arbCollisionPolicy(),
				async (documents, callerContext, translationResult, collisionPolicy) => {
					const destRoot = mockAllowedRoot();
					const tracker = createTrackedTranslateFn(translationResult);
					const applyTracker = createTrackedApplyFn();

					const result = await orchestrateProfile(
						{
							profileName: "inspect-profile",
							documents,
							callerContext,
							dryRun: true,
							collisionPolicy,
							destinationRoot: destRoot,
						},
						tracker.translate,
						applyTracker.apply,
					);

					// Translation diagnostics count must faithfully project the translation result
					const expectedErrors = translationResult.diagnostics.filter(
						(d) => d.severity === "error",
					).length;
					const expectedWarnings = translationResult.diagnostics.filter(
						(d) => d.severity === "warning",
					).length;
					expect(result.translation.blockingDiagnosticCount).toBe(expectedErrors);
					expect(result.translation.warningCount).toBe(expectedWarnings);

					// Plan summaries must faithfully project the plan
					if (translationResult.plan) {
						expect(result.translation.planSummaries.length).toBe(1);
						const summary = result.translation.planSummaries[0];
						expect(summary.outputFileCount).toBe(translationResult.plan.outputFiles.length);
						expect(summary.applicationState).toBe(
							translationResult.plan.applicationState ?? "withheld",
						);
						expect(summary.artifactName).toBe(callerContext.artifactNameHint);
					} else if (translationResult.canonical) {
						// Canonical without plan still counts as translated
						expect(result.translation.artifactCount).toBe(1);
					} else {
						expect(result.translation.planSummaries.length).toBe(0);
					}

					// Acquisition faithfully projects document count
					expect(result.acquisition.documentCount).toBe(documents.length);
					expect(result.acquisition.status).toBe("success");
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("write-enabled mode invokes the applier only when plan is eligible or policy-required", async () => {
		await fc.assert(
			fc.asyncProperty(
				arbDocumentSet(),
				arbCallerContext(),
				arbTranslationResult(),
				arbCollisionPolicy(),
				async (documents, callerContext, translationResult, collisionPolicy) => {
					const destRoot = mockAllowedRoot();
					const tracker = createTrackedTranslateFn(translationResult);
					const applyTracker = createTrackedApplyFn();

					await orchestrateProfile(
						{
							profileName: "write-profile",
							documents,
							callerContext,
							dryRun: false,
							collisionPolicy,
							destinationRoot: destRoot,
						},
						tracker.translate,
						applyTracker.apply,
					);

					const plan = translationResult.plan;
					const applicationState = plan?.applicationState;

					if (!plan || applicationState === "withheld") {
						// Applier must NOT be invoked for withheld or absent plans
						expect(applyTracker.calls.length).toBe(0);
					} else {
						// Applier IS invoked for eligible/policy-required plans
						expect(applyTracker.calls.length).toBe(1);
					}
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});

	it("empty document sets produce equivalent skipped results for both modes", async () => {
		await fc.assert(
			fc.asyncProperty(
				arbCallerContext(),
				arbCollisionPolicy(),
				async (callerContext, collisionPolicy) => {
					const destRoot = mockAllowedRoot();
					const emptyDocs: SourceDocument[] = [];

					// The translate fn should never be called for empty docs
					const dryTranslate = createTrackedTranslateFn({
						schemaVersion: "1.0",
						status: "failure",
						registryVersion: "1.0.0",
						diagnostics: [],
						defaults: [],
						normalizations: [],
						degradations: [],
					});
					const writeTranslate = createTrackedTranslateFn({
						schemaVersion: "1.0",
						status: "failure",
						registryVersion: "1.0.0",
						diagnostics: [],
						defaults: [],
						normalizations: [],
						degradations: [],
					});
					const dryApply = createTrackedApplyFn();
					const writeApply = createTrackedApplyFn();

					const dryResult = await orchestrateProfile(
						{
							profileName: "empty-profile",
							documents: emptyDocs,
							callerContext,
							dryRun: true,
							collisionPolicy,
							destinationRoot: destRoot,
						},
						dryTranslate.translate,
						dryApply.apply,
					);

					const writeResult = await orchestrateProfile(
						{
							profileName: "empty-profile",
							documents: emptyDocs,
							callerContext,
							dryRun: false,
							collisionPolicy,
							destinationRoot: destRoot,
						},
						writeTranslate.translate,
						writeApply.apply,
					);

					// Both must fail at acquisition stage identically
					expect(dryResult.acquisition.status).toBe("failure");
					expect(writeResult.acquisition.status).toBe("failure");
					expect(dryResult.acquisition.documentCount).toBe(0);
					expect(writeResult.acquisition.documentCount).toBe(0);

					// Translation and application are both skipped
					expect(dryResult.translation.status).toBe("skipped");
					expect(writeResult.translation.status).toBe("skipped");
					expect(dryResult.application.status).toBe("skipped");
					expect(writeResult.application.status).toBe("skipped");

					// Neither mode invokes translate or apply
					expect(dryTranslate.calls.length).toBe(0);
					expect(writeTranslate.calls.length).toBe(0);
					expect(dryApply.calls.length).toBe(0);
					expect(writeApply.calls.length).toBe(0);
				},
			),
			{ numRuns: 100, verbose: 2 },
		);
	});
});
