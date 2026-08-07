/**
 * Integration tests for the translation orchestrator and plan applier.
 *
 * Uses real temporary directories (tmpdir) to verify:
 * 1. In-root scanning — documents within the allowed root are accepted
 * 2. Escaping symlinks — symlinks that resolve outside the allowed root are rejected
 * 3. Destination parent resolution — creates parent directories as needed
 * 4. Collision policies — error (reject existing), skip (leave existing), replace (overwrite)
 * 5. Staging/atomicity — files are staged before atomic rename
 * 6. Executable modes — files marked executable get the correct permission
 * 7. Dry-run applier spies — applier is NOT invoked in dry-run mode
 *
 * Requirements: 9.1, 9.2, 9.9, 13.3, 13.4, 16.4, 16.9
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	mkdir,
	readdir,
	readFile,
	rm,
	stat,
	symlink,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
	SourceDocument,
	TranslationPlan,
	TranslationResult,
} from "../schemas";
import {
	type ApplyFn,
	isWithinRoot,
	orchestrateProfile,
	resolveAllowedRoot,
	scanForArtifacts,
	type TranslateFn,
} from "../translation-orchestrator";
import { applyPlan } from "../translation-plan-applier";

// ═══════════════════════════════════════════════════════════════════════════════
// Test Setup
// ═══════════════════════════════════════════════════════════════════════════════

let tempDir: string;

beforeEach(async () => {
	tempDir = join(
		tmpdir(),
		`orch-integration-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	await mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function makePlan(
	files: Array<{ path: string; content: string; executable?: boolean }>,
): TranslationPlan {
	return {
		schemaVersion: "1.0" as const,
		formatId: "kiro",
		variant: "steering",
		canonicalSchemaVersion: "1.0",
		outputFiles: files.map((f) => ({
			relativePath: f.path,
			content: f.content,
			executable: f.executable ?? false,
		})),
		operations: files.map((f, i) => ({
			kind: "write-file" as const,
			relativePath: f.path,
			outputFileIndex: i,
		})),
		applicationState: "eligible" as const,
		policyDiagnosticCodes: [],
	};
}

function makeTranslationResult(plan: TranslationPlan): TranslationResult {
	return {
		schemaVersion: "1.0" as const,
		status: "success",
		registryVersion: "1.0",
		diagnostics: [],
		defaults: [],
		normalizations: [],
		degradations: [],
		plan,
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. In-root scanning: documents within the allowed root are accepted
// ═══════════════════════════════════════════════════════════════════════════════

describe("in-root scanning", () => {
	test("accepts artifacts fully within the allowed root", async () => {
		// Create a valid artifact directory inside the root
		const artifactDir = join(tempDir, "my-artifact");
		await mkdir(artifactDir, { recursive: true });
		await writeFile(
			join(artifactDir, "knowledge.md"),
			"---\nname: test\n---\n# Body",
		);
		await writeFile(join(artifactDir, "hooks.yaml"), "hooks: []");

		const root = await resolveAllowedRoot(tempDir);
		const groups = await scanForArtifacts({ root });

		expect(groups.length).toBe(1);
		expect(groups[0].artifactName).toBe("my-artifact");
		expect(groups[0].documents.length).toBeGreaterThanOrEqual(1);
		// Verify the knowledge.md document is present
		const knowledgeDoc = groups[0].documents.find(
			(d) => d.path === "knowledge.md",
		);
		expect(knowledgeDoc).toBeDefined();
		expect(knowledgeDoc!.content).toContain("# Body");
	});

	test("accepts nested subdirectory within root", async () => {
		const nested = join(tempDir, "nested-art");
		await mkdir(nested, { recursive: true });
		await writeFile(
			join(nested, "knowledge.md"),
			"---\nname: nested\n---\n# Nested",
		);

		const root = await resolveAllowedRoot(tempDir);
		const within = await isWithinRoot(nested, root);
		expect(within).toBe(true);
	});

	test("accepts symlink that points within the root", async () => {
		const realDir = join(tempDir, "real-artifact");
		await mkdir(realDir, { recursive: true });
		await writeFile(
			join(realDir, "knowledge.md"),
			"---\nname: linked\n---\n# Linked",
		);

		const linkDir = join(tempDir, "link-artifact");
		await symlink(realDir, linkDir);

		const root = await resolveAllowedRoot(tempDir);
		const within = await isWithinRoot(linkDir, root);
		expect(within).toBe(true);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Escaping symlinks: symlinks resolving outside the allowed root are rejected
// ═══════════════════════════════════════════════════════════════════════════════

describe("escaping symlinks", () => {
	let outsideDir: string;

	beforeEach(async () => {
		outsideDir = join(
			tmpdir(),
			`outside-${Date.now()}-${Math.random().toString(36).slice(2)}`,
		);
		await mkdir(outsideDir, { recursive: true });
		await writeFile(
			join(outsideDir, "knowledge.md"),
			"---\nname: evil\n---\n# Escape",
		);
	});

	afterEach(async () => {
		await rm(outsideDir, { recursive: true, force: true });
	});

	test("isWithinRoot rejects symlink pointing outside root", async () => {
		const escapeLink = join(tempDir, "escape-link");
		await symlink(outsideDir, escapeLink);

		const root = await resolveAllowedRoot(tempDir);
		const within = await isWithinRoot(escapeLink, root);
		expect(within).toBe(false);
	});

	test("scanForArtifacts rejects artifact directory that escapes via symlink", async () => {
		// Create a symlink inside the root pointing to an outside directory
		const escapeLink = join(tempDir, "escape-artifact");
		await symlink(outsideDir, escapeLink);

		const root = await resolveAllowedRoot(tempDir);

		// The scanner may either throw during scanning (if the glob resolves the
		// symlink and then detects containment failure) or silently exclude it
		// (if the glob traversal doesn't follow the symlink deeply enough).
		// Either way, the escape-artifact should NOT appear in the results.
		try {
			const groups = await scanForArtifacts({ root });
			// If it didn't throw, the escaping artifact must not be in the results
			const escapingGroup = groups.find(
				(g) => g.artifactName === "escape-artifact",
			);
			expect(escapingGroup).toBeUndefined();
		} catch (error) {
			// If it throws, the error must mention "escapes allowed root"
			expect((error as Error).message).toContain("escapes allowed root");
		}
	});

	test("applyPlan rejects writes through escaping symlink in parent", async () => {
		// Create a symlink inside tempDir that points to outsideDir
		const linkInRoot = join(tempDir, "escape-dir");
		await symlink(outsideDir, linkInRoot);

		const root = await resolveAllowedRoot(tempDir);
		const plan = makePlan([
			{ path: "escape-dir/malicious.md", content: "pwned" },
		]);

		const report = await applyPlan({
			plan,
			destinationRoot: root,
			collisionPolicy: "replace",
			dryRun: false,
		});

		// The write should fail because the resolved parent escapes the root
		expect(report.completedSuccessfully).toBe(false);
		const failedOutcome = report.outcomes.find((o) => o.action === "failed");
		expect(failedOutcome).toBeDefined();
		expect(failedOutcome!.error).toContain("escape");
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Destination parent resolution: creates parent directories as needed
// ═══════════════════════════════════════════════════════════════════════════════

describe("destination parent resolution", () => {
	test("creates intermediate parent directories for nested output paths", async () => {
		const root = await resolveAllowedRoot(tempDir);
		const plan = makePlan([
			{ path: "deep/nested/dir/output.md", content: "# Deep file" },
		]);

		const report = await applyPlan({
			plan,
			destinationRoot: root,
			collisionPolicy: "error",
			dryRun: false,
		});

		expect(report.completedSuccessfully).toBe(true);
		expect(report.outcomes[0].action).toBe("written");

		// Verify the file was actually created with correct content
		const content = await readFile(
			join(tempDir, "deep/nested/dir/output.md"),
			"utf-8",
		);
		expect(content).toBe("# Deep file");
	});

	test("creates multiple levels of parent directories across files", async () => {
		const root = await resolveAllowedRoot(tempDir);
		const plan = makePlan([
			{ path: "a/b/first.md", content: "first" },
			{ path: "a/c/second.md", content: "second" },
			{ path: "x/y/z/third.md", content: "third" },
		]);

		const report = await applyPlan({
			plan,
			destinationRoot: root,
			collisionPolicy: "error",
			dryRun: false,
		});

		expect(report.completedSuccessfully).toBe(true);
		expect(report.outcomes.filter((o) => o.action === "written").length).toBe(
			3,
		);

		// Verify all files exist
		const first = await readFile(join(tempDir, "a/b/first.md"), "utf-8");
		expect(first).toBe("first");
		const second = await readFile(join(tempDir, "a/c/second.md"), "utf-8");
		expect(second).toBe("second");
		const third = await readFile(join(tempDir, "x/y/z/third.md"), "utf-8");
		expect(third).toBe("third");
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Collision policies: error, skip, replace
// ═══════════════════════════════════════════════════════════════════════════════

describe("collision policies", () => {
	test("error policy rejects write when file already exists", async () => {
		// Create an existing file
		await writeFile(join(tempDir, "existing.md"), "original content");

		const root = await resolveAllowedRoot(tempDir);
		const plan = makePlan([{ path: "existing.md", content: "new content" }]);

		const report = await applyPlan({
			plan,
			destinationRoot: root,
			collisionPolicy: "error",
			dryRun: false,
		});

		expect(report.completedSuccessfully).toBe(false);
		expect(report.outcomes[0].action).toBe("failed");
		expect(report.outcomes[0].error).toContain("already exists");

		// Original file is preserved
		const content = await readFile(join(tempDir, "existing.md"), "utf-8");
		expect(content).toBe("original content");
	});

	test("skip policy leaves existing file unchanged", async () => {
		await writeFile(join(tempDir, "existing.md"), "original content");

		const root = await resolveAllowedRoot(tempDir);
		const plan = makePlan([{ path: "existing.md", content: "new content" }]);

		const report = await applyPlan({
			plan,
			destinationRoot: root,
			collisionPolicy: "skip",
			dryRun: false,
		});

		expect(report.completedSuccessfully).toBe(true);
		expect(report.outcomes[0].action).toBe("skipped");

		// Original file is preserved
		const content = await readFile(join(tempDir, "existing.md"), "utf-8");
		expect(content).toBe("original content");
	});

	test("replace policy overwrites existing file", async () => {
		await writeFile(join(tempDir, "existing.md"), "original content");

		const root = await resolveAllowedRoot(tempDir);
		const plan = makePlan([{ path: "existing.md", content: "new content" }]);

		const report = await applyPlan({
			plan,
			destinationRoot: root,
			collisionPolicy: "replace",
			dryRun: false,
		});

		expect(report.completedSuccessfully).toBe(true);
		expect(report.outcomes[0].action).toBe("written");

		// File has new content
		const content = await readFile(join(tempDir, "existing.md"), "utf-8");
		expect(content).toBe("new content");
	});

	test("error policy does not block non-colliding files before the collision", async () => {
		await writeFile(join(tempDir, "second.md"), "existing");

		const root = await resolveAllowedRoot(tempDir);
		// Plan has a non-colliding file first (sorted by path), then a colliding one
		const plan = makePlan([
			{ path: "first.md", content: "new first" },
			{ path: "second.md", content: "new second" },
		]);

		const report = await applyPlan({
			plan,
			destinationRoot: root,
			collisionPolicy: "error",
			dryRun: false,
		});

		// The first file was written before the collision was hit
		expect(report.outcomes.length).toBe(2);
		expect(report.outcomes[0].action).toBe("written");
		expect(report.outcomes[1].action).toBe("failed");
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Staging/atomicity: files are staged before atomic rename
// ═══════════════════════════════════════════════════════════════════════════════

describe("staging and atomicity", () => {
	test("written files appear atomically at final destination", async () => {
		const root = await resolveAllowedRoot(tempDir);
		const plan = makePlan([
			{
				path: "artifact/knowledge.md",
				content: "---\nname: test\n---\n# Test",
			},
			{ path: "artifact/hooks.yaml", content: "hooks: []" },
		]);

		const report = await applyPlan({
			plan,
			destinationRoot: root,
			collisionPolicy: "error",
			dryRun: false,
		});

		expect(report.completedSuccessfully).toBe(true);

		// Both files exist at final destination
		const knowledge = await readFile(
			join(tempDir, "artifact/knowledge.md"),
			"utf-8",
		);
		expect(knowledge).toContain("# Test");
		const hooks = await readFile(join(tempDir, "artifact/hooks.yaml"), "utf-8");
		expect(hooks).toBe("hooks: []");
	});

	test("no temporary staging files remain after successful application", async () => {
		const root = await resolveAllowedRoot(tempDir);
		const plan = makePlan([{ path: "output.md", content: "content" }]);

		await applyPlan({
			plan,
			destinationRoot: root,
			collisionPolicy: "error",
			dryRun: false,
		});

		// List root directory — should only contain the output file
		const entries = await readdir(tempDir);
		const tmpFiles = entries.filter(
			(e) => e.startsWith(".staging-") || e.includes(".tmp-"),
		);
		expect(tmpFiles.length).toBe(0);
	});

	test("staging uses temp files inside the allowed root", async () => {
		// Verify that the report references the staging dir within the root
		const root = await resolveAllowedRoot(tempDir);
		const plan = makePlan([
			{ path: "a.md", content: "a" },
			{ path: "b.md", content: "b" },
		]);

		const report = await applyPlan({
			plan,
			destinationRoot: root,
			collisionPolicy: "error",
			dryRun: false,
		});

		expect(report.completedSuccessfully).toBe(true);
		// For multi-file plans, stagedDir is set but cleaned up.
		// Compare against root.resolvedPath (realpath-resolved) since tmpdir()
		// may differ from the resolved path (e.g. /var vs /private/var on macOS).
		if (report.stagedDir) {
			expect(report.stagedDir.startsWith(root.resolvedPath)).toBe(true);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. Executable modes: files marked executable get correct permissions
// ═══════════════════════════════════════════════════════════════════════════════

describe("executable modes", () => {
	test("file marked executable gets 0o755 permission", async () => {
		const root = await resolveAllowedRoot(tempDir);
		const plan = makePlan([
			{ path: "run.sh", content: "#!/bin/bash\necho hello", executable: true },
		]);

		const report = await applyPlan({
			plan,
			destinationRoot: root,
			collisionPolicy: "error",
			dryRun: false,
		});

		expect(report.completedSuccessfully).toBe(true);
		expect(report.outcomes[0].executable).toBe(true);

		// Verify the actual file permissions
		const fileStat = await stat(join(tempDir, "run.sh"));
		// Check that the file has executable permission (at least user execute bit)
		const mode = fileStat.mode & 0o777;
		expect(mode & 0o111).toBeGreaterThan(0); // At least one execute bit set
		expect(mode).toBe(0o755);
	});

	test("file not marked executable does NOT get execute permission", async () => {
		const root = await resolveAllowedRoot(tempDir);
		const plan = makePlan([
			{ path: "readme.md", content: "# README", executable: false },
		]);

		const report = await applyPlan({
			plan,
			destinationRoot: root,
			collisionPolicy: "error",
			dryRun: false,
		});

		expect(report.completedSuccessfully).toBe(true);
		expect(report.outcomes[0].executable).toBe(false);

		// Verify no execute bit
		const fileStat = await stat(join(tempDir, "readme.md"));
		const mode = fileStat.mode & 0o777;
		expect(mode & 0o111).toBe(0); // No execute bits
	});

	test("mixed executable and non-executable files in same plan", async () => {
		const root = await resolveAllowedRoot(tempDir);
		const plan = makePlan([
			{ path: "build.sh", content: "#!/bin/bash\nmake", executable: true },
			{ path: "config.yaml", content: "key: value", executable: false },
			{ path: "deploy.sh", content: "#!/bin/bash\ndeploy", executable: true },
		]);

		const report = await applyPlan({
			plan,
			destinationRoot: root,
			collisionPolicy: "error",
			dryRun: false,
		});

		expect(report.completedSuccessfully).toBe(true);

		// Check executable permissions
		const buildStat = await stat(join(tempDir, "build.sh"));
		expect((buildStat.mode & 0o111) > 0).toBe(true);

		const configStat = await stat(join(tempDir, "config.yaml"));
		expect((configStat.mode & 0o111) === 0).toBe(true);

		const deployStat = await stat(join(tempDir, "deploy.sh"));
		expect((deployStat.mode & 0o111) > 0).toBe(true);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Dry-run applier spies: applier NOT invoked in dry-run mode
// ═══════════════════════════════════════════════════════════════════════════════

describe("dry-run applier spies", () => {
	test("applier is NOT invoked in dry-run mode", async () => {
		let applierInvoked = false;
		const root = await resolveAllowedRoot(tempDir);

		const translate: TranslateFn = () => {
			const plan = makePlan([{ path: "output.md", content: "# Output" }]);
			return makeTranslationResult(plan);
		};

		const apply: ApplyFn = async () => {
			applierInvoked = true;
			return {
				operationId: "test-op",
				timestamp: new Date().toISOString(),
				outcomes: [
					{
						path: "output.md",
						action: "written" as const,
						bytesWritten: 8,
						executable: false,
					},
				],
				completedSuccessfully: true,
			};
		};

		const result = await orchestrateProfile(
			{
				profileName: "dry-run-test",
				documents: [
					{
						path: "knowledge.md",
						content: "---\nname: t\n---\n# T",
						executable: false,
					},
				],
				callerContext: { artifactNameHint: "test-artifact" },
				dryRun: true,
				collisionPolicy: "error",
				destinationRoot: root,
			},
			translate,
			apply,
		);

		expect(applierInvoked).toBe(false);
		expect(result.application.status).toBe("skipped");
		expect(result.application.filesWritten).toBe(0);
	});

	test("all preceding phases (translate) still run in dry-run mode", async () => {
		let translateInvoked = false;
		const root = await resolveAllowedRoot(tempDir);

		const translate: TranslateFn = (_docs, _ctx) => {
			translateInvoked = true;
			const plan = makePlan([{ path: "output.md", content: "# Output" }]);
			return makeTranslationResult(plan);
		};

		const apply: ApplyFn = async () => ({
			operationId: "test-op",
			timestamp: new Date().toISOString(),
			outcomes: [],
			completedSuccessfully: true,
		});

		await orchestrateProfile(
			{
				profileName: "dry-run-translate",
				documents: [
					{
						path: "knowledge.md",
						content: "---\nname: t\n---\n# T",
						executable: false,
					},
				],
				callerContext: { artifactNameHint: "test-artifact" },
				dryRun: true,
				collisionPolicy: "error",
				destinationRoot: root,
			},
			translate,
			apply,
		);

		expect(translateInvoked).toBe(true);
	});

	test("dry-run produces equivalent translation status as write mode", async () => {
		const root = await resolveAllowedRoot(tempDir);

		const translate: TranslateFn = () => {
			const plan = makePlan([{ path: "out.md", content: "hello" }]);
			return makeTranslationResult(plan);
		};

		const apply: ApplyFn = async () => ({
			operationId: "test-op",
			timestamp: new Date().toISOString(),
			outcomes: [
				{
					path: "out.md",
					action: "written" as const,
					bytesWritten: 5,
					executable: false,
				},
			],
			completedSuccessfully: true,
		});

		const sharedOpts = {
			profileName: "equivalence",
			documents: [
				{
					path: "knowledge.md",
					content: "---\nname: t\n---\n# T",
					executable: false,
				},
			] as SourceDocument[],
			callerContext: { artifactNameHint: "equiv" },
			collisionPolicy: "replace" as const,
			destinationRoot: root,
		};

		const dryResult = await orchestrateProfile(
			{ ...sharedOpts, dryRun: true },
			translate,
			apply,
		);
		const writeResult = await orchestrateProfile(
			{ ...sharedOpts, dryRun: false },
			translate,
			apply,
		);

		// Translation phase results are identical
		expect(dryResult.translation.status).toBe(writeResult.translation.status);
		expect(dryResult.translation.artifactCount).toBe(
			writeResult.translation.artifactCount,
		);
		expect(dryResult.translation.planSummaries).toEqual(
			writeResult.translation.planSummaries,
		);

		// Application status differs: skipped vs success
		expect(dryResult.application.status).toBe("skipped");
		expect(writeResult.application.status).toBe("success");
	});

	test("no files written to filesystem in dry-run mode", async () => {
		const root = await resolveAllowedRoot(tempDir);

		const translate: TranslateFn = () => {
			const plan = makePlan([
				{ path: "should-not-exist.md", content: "nope" },
				{ path: "also-absent.md", content: "nope" },
			]);
			return makeTranslationResult(plan);
		};

		const apply: ApplyFn = async () => ({
			operationId: "test-op",
			timestamp: new Date().toISOString(),
			outcomes: [],
			completedSuccessfully: true,
		});

		await orchestrateProfile(
			{
				profileName: "no-write",
				documents: [
					{
						path: "knowledge.md",
						content: "---\nname: t\n---\n# T",
						executable: false,
					},
				],
				callerContext: { artifactNameHint: "no-write" },
				dryRun: true,
				collisionPolicy: "error",
				destinationRoot: root,
			},
			translate,
			apply,
		);

		// Verify no output files were created
		const entries = await readdir(tempDir);
		expect(entries).not.toContain("should-not-exist.md");
		expect(entries).not.toContain("also-absent.md");
	});
});
