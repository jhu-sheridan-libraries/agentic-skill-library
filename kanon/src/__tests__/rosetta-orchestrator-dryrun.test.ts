/**
 * Unit tests for dry-run/write orchestration and per-profile status isolation.
 *
 * Covers:
 * - Same pre-application path for dry-run and write modes
 * - PlanApplier NOT invoked in dry-run mode
 * - PlanApplier invoked in write mode
 * - Artifact plans combined only after individual validation
 * - Per-profile status isolation (one failure doesn't block others)
 * - OrchestrationResult separates acquisition/translation/application status
 *
 * Requirements: 9.1, 9.2, 9.9, 11.5, 11.6, 11.7
 */

import { describe, expect, test } from "bun:test";
import type {
	SourceDocument,
	TranslationPlan,
	TranslationResult,
} from "../schemas";
import {
	type AllowedRoot,
	type ApplyFn,
	orchestrateProfile,
	orchestrateProfiles,
	type TranslateFn,
} from "../translation-orchestrator";
import type { ApplicationReport } from "../translation-plan-applier";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeDocument(path: string, content = "test"): SourceDocument {
	return { path, content, executable: false };
}

function makePlan(opts?: {
	applicationState?: "eligible" | "policy-required" | "withheld";
	fileCount?: number;
}): TranslationPlan {
	const { applicationState = "eligible", fileCount = 1 } = opts ?? {};
	const outputFiles = Array.from({ length: fileCount }, (_, i) => ({
		relativePath: `output-${i}.md`,
		content: `content-${i}`,
		executable: false,
	}));
	return {
		schemaVersion: "1.0" as const,
		formatId: "kiro",
		variant: "steering",
		canonicalSchemaVersion: "1.0",
		outputFiles,
		operations: [],
		applicationState,
		policyDiagnosticCodes: [],
	};
}

function makeTranslationResult(opts?: {
	status?: "success" | "partial" | "failure";
	plan?: TranslationPlan;
	hasBlockingErrors?: boolean;
}): TranslationResult {
	const { status = "success", plan, hasBlockingErrors = false } = opts ?? {};
	return {
		schemaVersion: "1.0" as const,
		status,
		registryVersion: "1.0",
		diagnostics: hasBlockingErrors
			? [
					{
						code: "RS_CANONICAL_INVALID",
						severity: "error" as const,
						phase: "canonical-validation" as const,
						formatId: "kiro",
						message: "Blocking error",
						remediation: "Fix the issue",
						blocking: true,
						unavailableDetails: [],
					},
				]
			: status === "partial"
				? [
						{
							code: "RS_COMPAT_PARTIAL",
							severity: "warning" as const,
							phase: "compatibility" as const,
							formatId: "kiro",
							message: "Partial support",
							remediation: "Check output",
							blocking: false,
							unavailableDetails: [],
						},
					]
				: [],
		defaults: [],
		normalizations: [],
		degradations: [],
		...(plan ? { plan } : {}),
	};
}

function makeAllowedRoot(label = "test-root"): AllowedRoot {
	return Object.freeze({
		resolvedPath: "/tmp/test-destination",
		label,
	});
}

function makeSuccessReport(fileCount = 1): ApplicationReport {
	return {
		operationId: "apply-1",
		timestamp: new Date().toISOString(),
		outcomes: Array.from({ length: fileCount }, (_, i) => ({
			path: `output-${i}.md`,
			action: "written" as const,
			bytesWritten: 10,
			executable: false,
		})),
		completedSuccessfully: true,
	};
}

function makeFailureReport(failedAt: string): ApplicationReport {
	return {
		operationId: "apply-2",
		timestamp: new Date().toISOString(),
		outcomes: [
			{
				path: failedAt,
				action: "failed" as const,
				error: "Write failed",
				executable: false,
			},
		],
		completedSuccessfully: false,
		failedAt,
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// Dry-run mode: applier NOT invoked
// ─────────────────────────────────────────────────────────────────────────────

describe("dry-run mode", () => {
	test("does NOT invoke applier in dry-run", async () => {
		let applierCalled = false;
		const translate: TranslateFn = () =>
			makeTranslationResult({ plan: makePlan() });
		const apply: ApplyFn = async () => {
			applierCalled = true;
			return makeSuccessReport();
		};

		const result = await orchestrateProfile(
			{
				profileName: "test-profile",
				documents: [makeDocument("knowledge.md")],
				callerContext: { artifactNameHint: "my-artifact" },
				dryRun: true,
				collisionPolicy: "error",
				destinationRoot: makeAllowedRoot(),
			},
			translate,
			apply,
		);

		expect(applierCalled).toBe(false);
		expect(result.application.status).toBe("skipped");
		expect(result.application.filesWritten).toBe(0);
	});

	test("runs pre-application path even in dry-run", async () => {
		let translateCalled = false;
		const translate: TranslateFn = (_docs, _ctx) => {
			translateCalled = true;
			return makeTranslationResult({ plan: makePlan() });
		};
		const apply: ApplyFn = async () => makeSuccessReport();

		await orchestrateProfile(
			{
				profileName: "test",
				documents: [makeDocument("knowledge.md")],
				callerContext: { artifactNameHint: "art" },
				dryRun: true,
				collisionPolicy: "error",
				destinationRoot: makeAllowedRoot(),
			},
			translate,
			apply,
		);

		expect(translateCalled).toBe(true);
	});

	test("reports translation status even in dry-run", async () => {
		const translate: TranslateFn = () =>
			makeTranslationResult({ status: "partial", plan: makePlan() });
		const apply: ApplyFn = async () => makeSuccessReport();

		const result = await orchestrateProfile(
			{
				profileName: "test",
				documents: [makeDocument("knowledge.md")],
				callerContext: { artifactNameHint: "art" },
				dryRun: true,
				collisionPolicy: "error",
				destinationRoot: makeAllowedRoot(),
			},
			translate,
			apply,
		);

		expect(result.translation.status).toBe("partial");
		expect(result.translation.warningCount).toBe(1);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Write mode: applier IS invoked
// ─────────────────────────────────────────────────────────────────────────────

describe("write mode", () => {
	test("invokes applier when plan is eligible", async () => {
		let applierCalled = false;
		const translate: TranslateFn = () =>
			makeTranslationResult({ plan: makePlan() });
		const apply: ApplyFn = async () => {
			applierCalled = true;
			return makeSuccessReport();
		};

		const result = await orchestrateProfile(
			{
				profileName: "test",
				documents: [makeDocument("knowledge.md")],
				callerContext: { artifactNameHint: "art" },
				dryRun: false,
				collisionPolicy: "replace",
				destinationRoot: makeAllowedRoot(),
			},
			translate,
			apply,
		);

		expect(applierCalled).toBe(true);
		expect(result.application.status).toBe("success");
		expect(result.application.filesWritten).toBe(1);
	});

	test("does NOT invoke applier when plan is withheld", async () => {
		let applierCalled = false;
		const translate: TranslateFn = () =>
			makeTranslationResult({
				status: "failure",
				hasBlockingErrors: true,
				plan: makePlan({ applicationState: "withheld" }),
			});
		const apply: ApplyFn = async () => {
			applierCalled = true;
			return makeSuccessReport();
		};

		const result = await orchestrateProfile(
			{
				profileName: "test",
				documents: [makeDocument("knowledge.md")],
				callerContext: { artifactNameHint: "art" },
				dryRun: false,
				collisionPolicy: "error",
				destinationRoot: makeAllowedRoot(),
			},
			translate,
			apply,
		);

		expect(applierCalled).toBe(false);
		expect(result.application.status).toBe("failure");
		expect(result.application.error).toContain("withheld");
	});

	test("reports application failure correctly", async () => {
		const translate: TranslateFn = () =>
			makeTranslationResult({ plan: makePlan() });
		const apply: ApplyFn = async () => makeFailureReport("output-0.md");

		const result = await orchestrateProfile(
			{
				profileName: "test",
				documents: [makeDocument("knowledge.md")],
				callerContext: { artifactNameHint: "art" },
				dryRun: false,
				collisionPolicy: "replace",
				destinationRoot: makeAllowedRoot(),
			},
			translate,
			apply,
		);

		expect(result.application.status).toBe("failure");
		expect(result.application.filesFailed).toBe(1);
		expect(result.application.error).toContain("output-0.md");
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Same pre-application path for dry-run and write
// ─────────────────────────────────────────────────────────────────────────────

describe("pre-application path equivalence", () => {
	test("dry-run and write receive same inputs in translate call", async () => {
		const translateCalls: Array<{
			docs: readonly SourceDocument[];
			ctx: Record<string, string>;
		}> = [];

		const translate: TranslateFn = (docs, ctx) => {
			translateCalls.push({ docs, ctx });
			return makeTranslationResult({ plan: makePlan() });
		};
		const apply: ApplyFn = async () => makeSuccessReport();

		const sharedOpts = {
			profileName: "test",
			documents: [makeDocument("knowledge.md", "# Hello")],
			callerContext: { artifactNameHint: "my-skill" },
			collisionPolicy: "replace" as const,
			destinationRoot: makeAllowedRoot(),
		};

		// Run dry-run
		await orchestrateProfile({ ...sharedOpts, dryRun: true }, translate, apply);
		// Run write
		await orchestrateProfile(
			{ ...sharedOpts, dryRun: false },
			translate,
			apply,
		);

		expect(translateCalls.length).toBe(2);
		// Same documents and context passed to both
		expect(translateCalls[0].docs).toEqual(translateCalls[1].docs);
		expect(translateCalls[0].ctx).toEqual(translateCalls[1].ctx);
	});

	test("translation status is identical for same inputs in both modes", async () => {
		const translate: TranslateFn = () =>
			makeTranslationResult({ status: "partial", plan: makePlan() });
		const apply: ApplyFn = async () => makeSuccessReport();

		const opts = {
			profileName: "test",
			documents: [makeDocument("knowledge.md")],
			callerContext: { artifactNameHint: "art" },
			collisionPolicy: "replace" as const,
			destinationRoot: makeAllowedRoot(),
		};

		const dryResult = await orchestrateProfile(
			{ ...opts, dryRun: true },
			translate,
			apply,
		);
		const writeResult = await orchestrateProfile(
			{ ...opts, dryRun: false },
			translate,
			apply,
		);

		// Translation status must be identical
		expect(dryResult.translation.status).toBe(writeResult.translation.status);
		expect(dryResult.translation.warningCount).toBe(
			writeResult.translation.warningCount,
		);
		expect(dryResult.translation.planSummaries).toEqual(
			writeResult.translation.planSummaries,
		);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Per-profile status isolation
// ─────────────────────────────────────────────────────────────────────────────

describe("per-profile status isolation", () => {
	test("one profile failure does not block other profiles", async () => {
		let callCount = 0;
		const translate: TranslateFn = (_docs, ctx) => {
			callCount++;
			if (ctx.artifactNameHint === "failing") {
				return makeTranslationResult({
					status: "failure",
					hasBlockingErrors: true,
				});
			}
			return makeTranslationResult({ plan: makePlan() });
		};
		const apply: ApplyFn = async () => makeSuccessReport();

		const result = await orchestrateProfiles({
			profiles: [
				{
					profileName: "failing",
					documents: [makeDocument("knowledge.md")],
					callerContext: { artifactNameHint: "failing" },
					dryRun: false,
					collisionPolicy: "replace",
					destinationRoot: makeAllowedRoot(),
				},
				{
					profileName: "succeeding",
					documents: [makeDocument("knowledge.md")],
					callerContext: { artifactNameHint: "succeeding" },
					dryRun: false,
					collisionPolicy: "replace",
					destinationRoot: makeAllowedRoot(),
				},
			],
			translate,
			apply,
		});

		// Both profiles were processed
		expect(callCount).toBe(2);
		expect(result.profiles.length).toBe(2);

		// Find the results (sorted by profile name)
		const failingProfile = result.profiles.find(
			(p) => p.profileName === "failing",
		);
		const succeedingProfile = result.profiles.find(
			(p) => p.profileName === "succeeding",
		);

		expect(failingProfile?.translation.status).toBe("failure");
		expect(succeedingProfile?.translation.status).toBe("success");
		expect(succeedingProfile?.application.status).toBe("success");
		expect(result.overallStatus).toBe("partial");
	});

	test("acquisition failure skips translation and application for that profile only", async () => {
		let translateCallCount = 0;
		const translate: TranslateFn = () => {
			translateCallCount++;
			return makeTranslationResult({ plan: makePlan() });
		};
		const apply: ApplyFn = async () => makeSuccessReport();

		const result = await orchestrateProfiles({
			profiles: [
				{
					profileName: "empty-profile",
					documents: [], // No documents = acquisition failure
					callerContext: { artifactNameHint: "empty" },
					dryRun: false,
					collisionPolicy: "replace",
					destinationRoot: makeAllowedRoot(),
				},
				{
					profileName: "good-profile",
					documents: [makeDocument("knowledge.md")],
					callerContext: { artifactNameHint: "good" },
					dryRun: false,
					collisionPolicy: "replace",
					destinationRoot: makeAllowedRoot(),
				},
			],
			translate,
			apply,
		});

		// Translate was only called for the good profile
		expect(translateCallCount).toBe(1);

		const emptyProfile = result.profiles.find(
			(p) => p.profileName === "empty-profile",
		);
		const goodProfile = result.profiles.find(
			(p) => p.profileName === "good-profile",
		);

		expect(emptyProfile?.acquisition.status).toBe("failure");
		expect(emptyProfile?.translation.status).toBe("skipped");
		expect(emptyProfile?.application.status).toBe("skipped");

		expect(goodProfile?.acquisition.status).toBe("success");
		expect(goodProfile?.translation.status).toBe("success");
		expect(goodProfile?.application.status).toBe("success");
	});

	test("profiles are processed in deterministic order by name", async () => {
		const processOrder: string[] = [];
		const translate: TranslateFn = (_docs, ctx) => {
			processOrder.push(ctx.artifactNameHint ?? "unknown");
			return makeTranslationResult({ plan: makePlan() });
		};
		const apply: ApplyFn = async () => makeSuccessReport();

		await orchestrateProfiles({
			profiles: [
				{
					profileName: "zebra",
					documents: [makeDocument("knowledge.md")],
					callerContext: { artifactNameHint: "zebra" },
					dryRun: true,
					collisionPolicy: "error",
					destinationRoot: makeAllowedRoot(),
				},
				{
					profileName: "alpha",
					documents: [makeDocument("knowledge.md")],
					callerContext: { artifactNameHint: "alpha" },
					dryRun: true,
					collisionPolicy: "error",
					destinationRoot: makeAllowedRoot(),
				},
			],
			translate,
			apply,
		});

		// Sorted by profile name (code-point)
		expect(processOrder).toEqual(["alpha", "zebra"]);
	});

	test("separates acquisition, translation, and application status", async () => {
		const translate: TranslateFn = () =>
			makeTranslationResult({ status: "partial", plan: makePlan() });
		const apply: ApplyFn = async () => makeSuccessReport();

		const result = await orchestrateProfile(
			{
				profileName: "test",
				documents: [makeDocument("knowledge.md")],
				callerContext: { artifactNameHint: "art" },
				dryRun: false,
				collisionPolicy: "replace",
				destinationRoot: makeAllowedRoot(),
			},
			translate,
			apply,
		);

		// Each phase has independent status
		expect(result.acquisition.status).toBe("success");
		expect(result.translation.status).toBe("partial");
		expect(result.application.status).toBe("success");
		// Per-profile results have profile name
		expect(result.acquisition.profileName).toBe("test");
		expect(result.translation.profileName).toBe("test");
		expect(result.application.profileName).toBe("test");
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Plans combined only after validation
// ─────────────────────────────────────────────────────────────────────────────

describe("plan combination after validation", () => {
	test("only successfully validated plans appear in combinedPlanSummaries", async () => {
		let callIdx = 0;
		const translate: TranslateFn = () => {
			callIdx++;
			if (callIdx === 1) {
				// First profile: success with plan
				return makeTranslationResult({ plan: makePlan({ fileCount: 3 }) });
			}
			// Second profile: failure
			return makeTranslationResult({
				status: "failure",
				hasBlockingErrors: true,
			});
		};
		const apply: ApplyFn = async () => makeSuccessReport(3);

		const result = await orchestrateProfiles({
			profiles: [
				{
					profileName: "alpha",
					documents: [makeDocument("knowledge.md")],
					callerContext: { artifactNameHint: "alpha-art" },
					dryRun: true,
					collisionPolicy: "error",
					destinationRoot: makeAllowedRoot(),
				},
				{
					profileName: "beta",
					documents: [makeDocument("knowledge.md")],
					callerContext: { artifactNameHint: "beta-art" },
					dryRun: true,
					collisionPolicy: "error",
					destinationRoot: makeAllowedRoot(),
				},
			],
			translate,
			apply,
		});

		// Only the successful profile's plan is in the combined summaries
		expect(result.combinedPlanSummaries.length).toBe(1);
		expect(result.combinedPlanSummaries[0].artifactName).toBe("alpha-art");
		expect(result.combinedPlanSummaries[0].outputFileCount).toBe(3);
	});

	test("plan summaries include applicationState per artifact", async () => {
		const translate: TranslateFn = () =>
			makeTranslationResult({
				plan: makePlan({ applicationState: "policy-required", fileCount: 2 }),
			});
		const apply: ApplyFn = async () => makeSuccessReport(2);

		const result = await orchestrateProfile(
			{
				profileName: "test",
				documents: [makeDocument("knowledge.md")],
				callerContext: { artifactNameHint: "art" },
				dryRun: true,
				collisionPolicy: "error",
				destinationRoot: makeAllowedRoot(),
			},
			translate,
			apply,
		);

		expect(result.translation.planSummaries.length).toBe(1);
		expect(result.translation.planSummaries[0].applicationState).toBe(
			"policy-required",
		);
		expect(result.translation.planSummaries[0].outputFileCount).toBe(2);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// Overall status derivation
// ─────────────────────────────────────────────────────────────────────────────

describe("overall status derivation", () => {
	test("all success → overall success", async () => {
		const translate: TranslateFn = () =>
			makeTranslationResult({ plan: makePlan() });
		const apply: ApplyFn = async () => makeSuccessReport();

		const result = await orchestrateProfiles({
			profiles: [
				{
					profileName: "a",
					documents: [makeDocument("knowledge.md")],
					callerContext: { artifactNameHint: "a" },
					dryRun: true,
					collisionPolicy: "error",
					destinationRoot: makeAllowedRoot(),
				},
				{
					profileName: "b",
					documents: [makeDocument("knowledge.md")],
					callerContext: { artifactNameHint: "b" },
					dryRun: true,
					collisionPolicy: "error",
					destinationRoot: makeAllowedRoot(),
				},
			],
			translate,
			apply,
		});

		expect(result.overallStatus).toBe("success");
	});

	test("all failure → overall failure", async () => {
		const translate: TranslateFn = () =>
			makeTranslationResult({ status: "failure", hasBlockingErrors: true });
		const apply: ApplyFn = async () => makeSuccessReport();

		const result = await orchestrateProfiles({
			profiles: [
				{
					profileName: "a",
					documents: [makeDocument("knowledge.md")],
					callerContext: { artifactNameHint: "a" },
					dryRun: false,
					collisionPolicy: "error",
					destinationRoot: makeAllowedRoot(),
				},
				{
					profileName: "b",
					documents: [makeDocument("knowledge.md")],
					callerContext: { artifactNameHint: "b" },
					dryRun: false,
					collisionPolicy: "error",
					destinationRoot: makeAllowedRoot(),
				},
			],
			translate,
			apply,
		});

		expect(result.overallStatus).toBe("failure");
	});

	test("empty profiles → success", async () => {
		const translate: TranslateFn = () => makeTranslationResult();
		const apply: ApplyFn = async () => makeSuccessReport();

		const result = await orchestrateProfiles({
			profiles: [],
			translate,
			apply,
		});

		expect(result.overallStatus).toBe("success");
		expect(result.profiles.length).toBe(0);
		expect(result.dryRun).toBe(false);
	});
});
