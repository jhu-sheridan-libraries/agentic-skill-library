/**
 * Unit tests for the translation orchestrator.
 * Covers allowed-root resolution, containment checking, artifact scanning,
 * document reading, byte limits, and deterministic grouping.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	groupDocumentsForTranslation,
	isWithinRoot,
	readArtifactDocuments,
	resolveAllowedRoot,
	scanForArtifacts,
} from "../translation-orchestrator";

let tempDir: string;

beforeEach(async () => {
	tempDir = join(
		tmpdir(),
		`orchestrator-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	await mkdir(tempDir, { recursive: true });
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// resolveAllowedRoot
// ─────────────────────────────────────────────────────────────────────────────

describe("resolveAllowedRoot", () => {
	test("resolves an existing directory", async () => {
		const root = await resolveAllowedRoot(tempDir);
		expect(root.resolvedPath).toBeTruthy();
		expect(root.label).toBe(root.resolvedPath);
		// Should be frozen/immutable
		expect(Object.isFrozen(root)).toBe(true);
	});

	test("uses custom label when provided", async () => {
		const root = await resolveAllowedRoot(tempDir, "test-root");
		expect(root.label).toBe("test-root");
	});

	test("throws for non-existent path", async () => {
		await expect(
			resolveAllowedRoot(join(tempDir, "nonexistent")),
		).rejects.toThrow("does not exist");
	});

	test("throws for a file instead of directory", async () => {
		const filePath = join(tempDir, "file.txt");
		await writeFile(filePath, "content");
		await expect(resolveAllowedRoot(filePath)).rejects.toThrow(
			"not a directory",
		);
	});

	test("resolves through symlinks", async () => {
		const realDir = join(tempDir, "real");
		await mkdir(realDir);
		const linkPath = join(tempDir, "link");
		await symlink(realDir, linkPath);

		const root = await resolveAllowedRoot(linkPath);
		expect(root.resolvedPath).not.toContain("link");
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// isWithinRoot
// ─────────────────────────────────────────────────────────────────────────────

describe("isWithinRoot", () => {
	test("returns true for a path inside the root", async () => {
		const subDir = join(tempDir, "child");
		await mkdir(subDir);
		const root = await resolveAllowedRoot(tempDir);

		expect(await isWithinRoot(subDir, root)).toBe(true);
	});

	test("returns true for the root itself", async () => {
		const root = await resolveAllowedRoot(tempDir);
		expect(await isWithinRoot(tempDir, root)).toBe(true);
	});

	test("returns false for a path outside the root", async () => {
		const outsideDir = join(tmpdir(), `outside-${Date.now()}`);
		await mkdir(outsideDir, { recursive: true });
		const root = await resolveAllowedRoot(tempDir);

		try {
			expect(await isWithinRoot(outsideDir, root)).toBe(false);
		} finally {
			await rm(outsideDir, { recursive: true, force: true });
		}
	});

	test("detects symlink escape", async () => {
		const outsideDir = join(tmpdir(), `escape-target-${Date.now()}`);
		await mkdir(outsideDir, { recursive: true });

		const linkPath = join(tempDir, "escape-link");
		await symlink(outsideDir, linkPath);

		const root = await resolveAllowedRoot(tempDir);

		try {
			expect(await isWithinRoot(linkPath, root)).toBe(false);
		} finally {
			await rm(outsideDir, { recursive: true, force: true });
		}
	});

	test("returns false for non-existent path", async () => {
		const root = await resolveAllowedRoot(tempDir);
		expect(await isWithinRoot(join(tempDir, "noexist"), root)).toBe(false);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// readArtifactDocuments
// ─────────────────────────────────────────────────────────────────────────────

describe("readArtifactDocuments", () => {
	test("reads knowledge.md and optional files", async () => {
		const artifactDir = join(tempDir, "my-artifact");
		await mkdir(artifactDir);
		await writeFile(join(artifactDir, "knowledge.md"), "# Test\nBody here");
		await writeFile(join(artifactDir, "hooks.yaml"), "hooks: []");

		const root = await resolveAllowedRoot(tempDir);
		const group = await readArtifactDocuments(artifactDir, root);

		expect(group.artifactName).toBe("my-artifact");
		expect(group.documents.length).toBe(2);
		expect(group.documents.find((d) => d.path === "knowledge.md")).toBeTruthy();
		expect(group.documents.find((d) => d.path === "hooks.yaml")).toBeTruthy();
		expect(group.rootRelativePath).toBe("my-artifact");
		expect(group.totalBytes).toBeGreaterThan(0);
	});

	test("reads mcp-servers.yaml", async () => {
		const artifactDir = join(tempDir, "artifact-mcp");
		await mkdir(artifactDir);
		await writeFile(join(artifactDir, "knowledge.md"), "# Test");
		await writeFile(join(artifactDir, "mcp-servers.yaml"), "servers: []");

		const root = await resolveAllowedRoot(tempDir);
		const group = await readArtifactDocuments(artifactDir, root);

		expect(
			group.documents.find((d) => d.path === "mcp-servers.yaml"),
		).toBeTruthy();
	});

	test("reads workflow files recursively", async () => {
		const artifactDir = join(tempDir, "artifact-wf");
		await mkdir(join(artifactDir, "workflows"), { recursive: true });
		await writeFile(join(artifactDir, "knowledge.md"), "# Test");
		await writeFile(join(artifactDir, "workflows", "step-1.md"), "Step 1");
		await writeFile(join(artifactDir, "workflows", "step-2.md"), "Step 2");

		const root = await resolveAllowedRoot(tempDir);
		const group = await readArtifactDocuments(artifactDir, root);

		const wfDocs = group.documents.filter((d) =>
			d.path.startsWith("workflows/"),
		);
		expect(wfDocs.length).toBe(2);
		// Deterministic order
		expect(wfDocs[0].path).toBe("workflows/step-1.md");
		expect(wfDocs[1].path).toBe("workflows/step-2.md");
	});

	test("reads body override files", async () => {
		const artifactDir = join(tempDir, "artifact-body");
		await mkdir(artifactDir);
		await writeFile(join(artifactDir, "knowledge.md"), "# Test");
		await writeFile(join(artifactDir, "body.kiro.md"), "Kiro body");
		await writeFile(join(artifactDir, "body.cursor.md"), "Cursor body");

		const root = await resolveAllowedRoot(tempDir);
		const group = await readArtifactDocuments(artifactDir, root);

		const bodyDocs = group.documents.filter((d) => d.path.startsWith("body."));
		expect(bodyDocs.length).toBe(2);
		// Deterministic code-point order
		expect(bodyDocs[0].path).toBe("body.cursor.md");
		expect(bodyDocs[1].path).toBe("body.kiro.md");
	});

	test("throws on per-file byte limit violation", async () => {
		const artifactDir = join(tempDir, "artifact-big");
		await mkdir(artifactDir);
		// Write a file larger than the limit
		await writeFile(join(artifactDir, "knowledge.md"), "x".repeat(100));

		const root = await resolveAllowedRoot(tempDir);

		await expect(
			readArtifactDocuments(artifactDir, root, { maxBytesPerFile: 50 }),
		).rejects.toThrow("per-file byte limit");
	});

	test("throws on aggregate byte limit violation", async () => {
		const artifactDir = join(tempDir, "artifact-agg");
		await mkdir(artifactDir);
		await writeFile(join(artifactDir, "knowledge.md"), "x".repeat(60));
		await writeFile(join(artifactDir, "hooks.yaml"), "y".repeat(60));

		const root = await resolveAllowedRoot(tempDir);

		await expect(
			readArtifactDocuments(artifactDir, root, { maxTotalBytes: 100 }),
		).rejects.toThrow("Aggregate byte limit");
	});

	test("throws on symlink escape from artifact directory", async () => {
		const outsideDir = join(tmpdir(), `escape-art-${Date.now()}`);
		await mkdir(outsideDir, { recursive: true });
		await writeFile(join(outsideDir, "knowledge.md"), "# Escaped");

		// Create a symlink inside tempDir that points outside
		const linkPath = join(tempDir, "escaped-artifact");
		await symlink(outsideDir, linkPath);

		const root = await resolveAllowedRoot(tempDir);

		try {
			await expect(readArtifactDocuments(linkPath, root)).rejects.toThrow(
				"escapes allowed root",
			);
		} finally {
			await rm(outsideDir, { recursive: true, force: true });
		}
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// scanForArtifacts
// ─────────────────────────────────────────────────────────────────────────────

describe("scanForArtifacts", () => {
	test("finds artifacts with knowledge.md in subdirectories", async () => {
		// Create two artifact directories
		await mkdir(join(tempDir, "alpha"));
		await writeFile(join(tempDir, "alpha", "knowledge.md"), "# Alpha");
		await mkdir(join(tempDir, "beta"));
		await writeFile(join(tempDir, "beta", "knowledge.md"), "# Beta");

		const root = await resolveAllowedRoot(tempDir);
		const groups = await scanForArtifacts({ root });

		expect(groups.length).toBe(2);
		// Deterministic code-point ordering
		expect(groups[0].artifactName).toBe("alpha");
		expect(groups[1].artifactName).toBe("beta");
	});

	test("returns empty array when no artifacts found", async () => {
		const root = await resolveAllowedRoot(tempDir);
		const groups = await scanForArtifacts({ root });
		expect(groups.length).toBe(0);
	});

	test("respects exclude patterns", async () => {
		await mkdir(join(tempDir, "good"));
		await writeFile(join(tempDir, "good", "knowledge.md"), "# Good");
		await mkdir(join(tempDir, "node_modules"));
		await writeFile(join(tempDir, "node_modules", "knowledge.md"), "# Bad");

		const root = await resolveAllowedRoot(tempDir);
		const groups = await scanForArtifacts({
			root,
			exclude: ["node_modules"],
		});

		expect(groups.length).toBe(1);
		expect(groups[0].artifactName).toBe("good");
	});

	test("enforces aggregate byte limit across artifacts", async () => {
		await mkdir(join(tempDir, "a"));
		await writeFile(join(tempDir, "a", "knowledge.md"), "x".repeat(60));
		await mkdir(join(tempDir, "b"));
		await writeFile(join(tempDir, "b", "knowledge.md"), "y".repeat(60));

		const root = await resolveAllowedRoot(tempDir);

		await expect(
			scanForArtifacts({ root, maxTotalBytes: 100 }),
		).rejects.toThrow("Aggregate byte limit");
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// groupDocumentsForTranslation
// ─────────────────────────────────────────────────────────────────────────────

describe("groupDocumentsForTranslation", () => {
	test("sorts by artifact name using code-point comparison", () => {
		const groups = [
			{
				artifactName: "zebra",
				documents: [{ path: "knowledge.md", content: "z", executable: false }],
				rootRelativePath: "zebra",
				totalBytes: 1,
			},
			{
				artifactName: "alpha",
				documents: [{ path: "knowledge.md", content: "a", executable: false }],
				rootRelativePath: "alpha",
				totalBytes: 1,
			},
		];

		const result = groupDocumentsForTranslation(groups);

		expect(result.length).toBe(2);
		expect(result[0].callerContext.artifactNameHint).toBe("alpha");
		expect(result[1].callerContext.artifactNameHint).toBe("zebra");
	});

	test("includes artifactNameHint in callerContext", () => {
		const groups = [
			{
				artifactName: "my-skill",
				documents: [
					{ path: "knowledge.md", content: "content", executable: false },
				],
				rootRelativePath: "my-skill",
				totalBytes: 7,
			},
		];

		const result = groupDocumentsForTranslation(groups);

		expect(result[0].callerContext).toEqual({
			artifactNameHint: "my-skill",
		});
		expect(result[0].documents).toEqual(groups[0].documents);
	});

	test("does not mutate input array", () => {
		const groups = [
			{
				artifactName: "b",
				documents: [],
				rootRelativePath: "b",
				totalBytes: 0,
			},
			{
				artifactName: "a",
				documents: [],
				rootRelativePath: "a",
				totalBytes: 0,
			},
		];

		groupDocumentsForTranslation(groups);
		// Original array should remain unchanged
		expect(groups[0].artifactName).toBe("b");
		expect(groups[1].artifactName).toBe("a");
	});
});
