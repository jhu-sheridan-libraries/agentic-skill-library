/**
 * Tests for Translation Application Policy and Cross-Request Collision Analysis
 *
 * Requirements: 4.8, 8.7, 9.1, 9.9, 13.5, 13.6
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TranslationPlan } from "../schemas";
import {
	type ApplicationPolicy,
	analyzeCollisions,
	applyCollisionPolicy,
	type CollisionEntry,
	evaluateApplicationPolicy,
	type LabeledPlan,
} from "../translation-application-policy";
import type { AllowedRoot } from "../translation-orchestrator";

// ═══════════════════════════════════════════════════════════════════════════════
// Test Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function makePlan(overrides?: Partial<TranslationPlan>): TranslationPlan {
	return {
		schemaVersion: "1.0",
		formatId: "kanon-canonical",
		canonicalSchemaVersion: "1.0.0",
		outputFiles: [
			{
				relativePath: "foo/bar.md",
				content: "hello",
				executable: false,
			},
		],
		operations: [
			{ kind: "write-file", relativePath: "foo/bar.md", outputFileIndex: 0 },
		],
		applicationState: "eligible",
		policyDiagnosticCodes: [],
		...overrides,
	};
}

function makePolicy(overrides?: Partial<ApplicationPolicy>): ApplicationPolicy {
	return {
		collisionPolicy: "error",
		allowedPolicyOverrideCodes: [],
		strict: false,
		...overrides,
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// evaluateApplicationPolicy
// ═══════════════════════════════════════════════════════════════════════════════

describe("evaluateApplicationPolicy", () => {
	test("eligible plan always proceeds", () => {
		const plan = makePlan({ applicationState: "eligible" });
		const policy = makePolicy();
		const result = evaluateApplicationPolicy(plan, policy);
		expect(result.proceed).toBe(true);
		expect(result.reason).toContain("eligible");
		expect(result.blockingCodes).toEqual([]);
		expect(result.overriddenCodes).toEqual([]);
	});

	test("withheld plan always blocks", () => {
		const plan = makePlan({
			applicationState: "withheld",
			policyDiagnosticCodes: ["RS_SOME_ERROR"],
		});
		const policy = makePolicy({
			allowedPolicyOverrideCodes: ["RS_SOME_ERROR"],
		});
		const result = evaluateApplicationPolicy(plan, policy);
		expect(result.proceed).toBe(false);
		expect(result.reason).toContain("withheld");
		expect(result.blockingCodes).toEqual(["RS_SOME_ERROR"]);
		expect(result.overriddenCodes).toEqual([]);
	});

	test("policy-required plan proceeds when all codes are allowed", () => {
		const plan = makePlan({
			applicationState: "policy-required",
			policyDiagnosticCodes: ["RS_CODE_A", "RS_CODE_B"],
		});
		const policy = makePolicy({
			allowedPolicyOverrideCodes: ["RS_CODE_A", "RS_CODE_B", "RS_CODE_C"],
		});
		const result = evaluateApplicationPolicy(plan, policy);
		expect(result.proceed).toBe(true);
		expect(result.blockingCodes).toEqual([]);
		expect(result.overriddenCodes).toEqual(["RS_CODE_A", "RS_CODE_B"]);
	});

	test("policy-required plan blocks when some codes are not allowed", () => {
		const plan = makePlan({
			applicationState: "policy-required",
			policyDiagnosticCodes: ["RS_CODE_A", "RS_CODE_B"],
		});
		const policy = makePolicy({
			allowedPolicyOverrideCodes: ["RS_CODE_A"],
		});
		const result = evaluateApplicationPolicy(plan, policy);
		expect(result.proceed).toBe(false);
		expect(result.blockingCodes).toEqual(["RS_CODE_B"]);
		expect(result.overriddenCodes).toEqual(["RS_CODE_A"]);
	});

	test("strict mode blocks all policy-required plans", () => {
		const plan = makePlan({
			applicationState: "policy-required",
			policyDiagnosticCodes: ["RS_CODE_A"],
		});
		const policy = makePolicy({
			strict: true,
			allowedPolicyOverrideCodes: ["RS_CODE_A"],
		});
		const result = evaluateApplicationPolicy(plan, policy);
		expect(result.proceed).toBe(false);
		expect(result.reason).toContain("Strict mode");
		expect(result.blockingCodes).toEqual(["RS_CODE_A"]);
		expect(result.overriddenCodes).toEqual([]);
	});

	test("blocking codes are sorted deterministically", () => {
		const plan = makePlan({
			applicationState: "policy-required",
			policyDiagnosticCodes: ["RS_ZZZ", "RS_AAA", "RS_MMM"],
		});
		const policy = makePolicy();
		const result = evaluateApplicationPolicy(plan, policy);
		expect(result.blockingCodes).toEqual(["RS_AAA", "RS_MMM", "RS_ZZZ"]);
	});

	test("overridden codes are sorted deterministically", () => {
		const plan = makePlan({
			applicationState: "policy-required",
			policyDiagnosticCodes: ["RS_ZZZ", "RS_AAA"],
		});
		const policy = makePolicy({
			allowedPolicyOverrideCodes: ["RS_ZZZ", "RS_AAA"],
		});
		const result = evaluateApplicationPolicy(plan, policy);
		expect(result.overriddenCodes).toEqual(["RS_AAA", "RS_ZZZ"]);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// analyzeCollisions
// ═══════════════════════════════════════════════════════════════════════════════

describe("analyzeCollisions", () => {
	let tempDir: string;
	let root: AllowedRoot;

	beforeEach(async () => {
		tempDir = join(
			tmpdir(),
			`policy-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		await mkdir(tempDir, { recursive: true });
		root = { resolvedPath: tempDir, label: "test-root" };
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("no collisions for non-overlapping plans", async () => {
		const plans: LabeledPlan[] = [
			{
				label: "plan-a",
				plan: makePlan({
					outputFiles: [
						{ relativePath: "a/file1.md", content: "a1", executable: false },
					],
					operations: [
						{
							kind: "write-file",
							relativePath: "a/file1.md",
							outputFileIndex: 0,
						},
					],
				}),
			},
			{
				label: "plan-b",
				plan: makePlan({
					outputFiles: [
						{ relativePath: "b/file1.md", content: "b1", executable: false },
					],
					operations: [
						{
							kind: "write-file",
							relativePath: "b/file1.md",
							outputFileIndex: 0,
						},
					],
				}),
			},
		];
		const result = await analyzeCollisions(plans, root, "error");
		expect(result.collisions).toEqual([]);
		expect(result.hasBlockingCollisions).toBe(false);
		expect(result.crossPlanCollisions).toBe(0);
		expect(result.filesystemCollisions).toBe(0);
	});

	test("detects cross-plan collisions", async () => {
		const plans: LabeledPlan[] = [
			{
				label: "plan-a",
				plan: makePlan({
					outputFiles: [
						{ relativePath: "shared/file.md", content: "a", executable: false },
					],
					operations: [
						{
							kind: "write-file",
							relativePath: "shared/file.md",
							outputFileIndex: 0,
						},
					],
				}),
			},
			{
				label: "plan-b",
				plan: makePlan({
					outputFiles: [
						{ relativePath: "shared/file.md", content: "b", executable: false },
					],
					operations: [
						{
							kind: "write-file",
							relativePath: "shared/file.md",
							outputFileIndex: 0,
						},
					],
				}),
			},
		];
		const result = await analyzeCollisions(plans, root, "error");
		expect(result.crossPlanCollisions).toBe(1);
		expect(result.collisions[0].kind).toBe("cross-plan");
		expect(result.collisions[0].path).toBe("shared/file.md");
		expect(result.hasBlockingCollisions).toBe(true);
	});

	test("detects filesystem collisions", async () => {
		// Create an existing file in the destination
		const dir = join(tempDir, "existing");
		await mkdir(dir, { recursive: true });
		await writeFile(join(dir, "file.md"), "existing content");

		const plans: LabeledPlan[] = [
			{
				label: "plan-a",
				plan: makePlan({
					outputFiles: [
						{
							relativePath: "existing/file.md",
							content: "new",
							executable: false,
						},
					],
					operations: [
						{
							kind: "write-file",
							relativePath: "existing/file.md",
							outputFileIndex: 0,
						},
					],
				}),
			},
		];
		const result = await analyzeCollisions(plans, root, "error");
		expect(result.filesystemCollisions).toBe(1);
		expect(result.collisions[0].kind).toBe("filesystem");
		expect(result.collisions[0].path).toBe("existing/file.md");
		expect(result.hasBlockingCollisions).toBe(true);
	});

	test("filesystem collision does not block under skip policy", async () => {
		const dir = join(tempDir, "existing");
		await mkdir(dir, { recursive: true });
		await writeFile(join(dir, "file.md"), "existing content");

		const plans: LabeledPlan[] = [
			{
				label: "plan-a",
				plan: makePlan({
					outputFiles: [
						{
							relativePath: "existing/file.md",
							content: "new",
							executable: false,
						},
					],
					operations: [
						{
							kind: "write-file",
							relativePath: "existing/file.md",
							outputFileIndex: 0,
						},
					],
				}),
			},
		];
		const result = await analyzeCollisions(plans, root, "skip");
		expect(result.filesystemCollisions).toBe(1);
		expect(result.hasBlockingCollisions).toBe(false);
	});

	test("analysis is deterministic regardless of plan insertion order", async () => {
		const planA: LabeledPlan = {
			label: "alpha",
			plan: makePlan({
				outputFiles: [
					{ relativePath: "shared.md", content: "a", executable: false },
				],
				operations: [
					{ kind: "write-file", relativePath: "shared.md", outputFileIndex: 0 },
				],
			}),
		};
		const planB: LabeledPlan = {
			label: "beta",
			plan: makePlan({
				outputFiles: [
					{ relativePath: "shared.md", content: "b", executable: false },
				],
				operations: [
					{ kind: "write-file", relativePath: "shared.md", outputFileIndex: 0 },
				],
			}),
		};

		const result1 = await analyzeCollisions([planA, planB], root, "error");
		const result2 = await analyzeCollisions([planB, planA], root, "error");

		expect(result1.collisions).toEqual(result2.collisions);
		expect(result1.crossPlanCollisions).toEqual(result2.crossPlanCollisions);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// applyCollisionPolicy
// ═══════════════════════════════════════════════════════════════════════════════

describe("applyCollisionPolicy", () => {
	const crossPlanCollision: CollisionEntry = {
		path: "shared/file.md",
		kind: "cross-plan",
		existingSource: "plan-a",
		newSource: "plan-b",
	};
	const fsCollision: CollisionEntry = {
		path: "existing/file.md",
		kind: "filesystem",
		existingSource: "/abs/path/existing/file.md",
		newSource: "plan-a",
	};

	test("error policy blocks all colliding files", () => {
		const allPaths = ["shared/file.md", "existing/file.md", "safe/file.md"];
		const result = applyCollisionPolicy(
			[crossPlanCollision, fsCollision],
			"error",
			allPaths,
		);
		expect(result.canProceed).toBe(false);
		expect(result.blockedFiles).toHaveLength(2);
		expect(result.filesToWrite).toHaveLength(1);
		expect(result.filesToWrite[0].path).toBe("safe/file.md");
	});

	test("skip policy skips filesystem collisions and blocks cross-plan", () => {
		const allPaths = ["shared/file.md", "existing/file.md", "safe/file.md"];
		const result = applyCollisionPolicy(
			[crossPlanCollision, fsCollision],
			"skip",
			allPaths,
		);
		expect(result.canProceed).toBe(false);
		expect(result.blockedFiles).toHaveLength(1);
		expect(result.blockedFiles[0].path).toBe("shared/file.md");
		expect(result.filesToSkip).toHaveLength(1);
		expect(result.filesToSkip[0].path).toBe("existing/file.md");
		expect(result.filesToWrite).toHaveLength(1);
	});

	test("replace policy overwrites filesystem collisions and blocks cross-plan", () => {
		const allPaths = ["shared/file.md", "existing/file.md", "safe/file.md"];
		const result = applyCollisionPolicy(
			[crossPlanCollision, fsCollision],
			"replace",
			allPaths,
		);
		expect(result.canProceed).toBe(false);
		expect(result.blockedFiles).toHaveLength(1);
		expect(result.blockedFiles[0].path).toBe("shared/file.md");
		expect(result.filesToWrite).toHaveLength(2);
		// safe/file.md and existing/file.md (replaced)
		const writePaths = result.filesToWrite.map((f) => f.path);
		expect(writePaths).toContain("existing/file.md");
		expect(writePaths).toContain("safe/file.md");
	});

	test("reconcile policy blocks cross-plan and replaces filesystem", () => {
		const allPaths = ["shared/file.md", "existing/file.md", "safe/file.md"];
		const result = applyCollisionPolicy(
			[crossPlanCollision, fsCollision],
			"reconcile",
			allPaths,
		);
		expect(result.canProceed).toBe(false);
		expect(result.blockedFiles).toHaveLength(1);
		expect(result.blockedFiles[0].path).toBe("shared/file.md");
		expect(result.filesToWrite).toHaveLength(2);
		const writePaths = result.filesToWrite.map((f) => f.path);
		expect(writePaths).toContain("existing/file.md");
		expect(writePaths).toContain("safe/file.md");
	});

	test("no collisions means all files are written and canProceed is true", () => {
		const allPaths = ["a.md", "b.md", "c.md"];
		const result = applyCollisionPolicy([], "error", allPaths);
		expect(result.canProceed).toBe(true);
		expect(result.filesToWrite).toHaveLength(3);
		expect(result.filesToSkip).toHaveLength(0);
		expect(result.blockedFiles).toHaveLength(0);
	});

	test("only filesystem collision with skip policy is not blocking", () => {
		const allPaths = ["existing/file.md"];
		const result = applyCollisionPolicy([fsCollision], "skip", allPaths);
		expect(result.canProceed).toBe(true);
		expect(result.filesToSkip).toHaveLength(1);
		expect(result.blockedFiles).toHaveLength(0);
	});

	test("results are sorted deterministically by path", () => {
		const allPaths = ["z.md", "a.md", "m.md"];
		const result = applyCollisionPolicy([], "error", allPaths);
		const paths = result.filesToWrite.map((f) => f.path);
		expect(paths).toEqual(["a.md", "m.md", "z.md"]);
	});
});
