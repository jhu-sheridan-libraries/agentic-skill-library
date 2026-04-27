import { describe, expect, test } from "bun:test";
import { toMemoryDocument } from "../serialization.js";
import {
	generateMatchReason,
	generateWorkspaceDescription,
	type WorkspaceFile,
} from "../workspace-profiler.js";

// ---------------------------------------------------------------------------
// toMemoryDocument
// ---------------------------------------------------------------------------

describe("toMemoryDocument", () => {
	const embedding = [0.1, 0.2, 0.3, 0.4];

	test("generates a valid UUID v4 for id", () => {
		const doc = toMemoryDocument("test note", embedding, "preference");
		const uuidV4Regex =
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
		expect(doc.id).toMatch(uuidV4Regex);
	});

	test("sets doc_source to 'memory'", () => {
		const doc = toMemoryDocument("note", embedding, "observation");
		expect(doc.doc_source).toBe("memory");
	});

	test("stores category in metadata_category", () => {
		const doc = toMemoryDocument("note", embedding, "convention");
		expect((doc as Record<string, unknown>).metadata_category).toBe(
			"convention",
		);
	});

	test("comma-joins tags into metadata_tags", () => {
		const doc = toMemoryDocument("note", embedding, "preference", [
			"git",
			"workflow",
			"ci",
		]);
		expect((doc as Record<string, unknown>).metadata_tags).toBe(
			"git,workflow,ci",
		);
	});

	test("stores empty string for metadata_tags when no tags provided", () => {
		const doc = toMemoryDocument("note", embedding, "preference");
		expect((doc as Record<string, unknown>).metadata_tags).toBe("");
	});

	test("sets metadata_created_at as valid ISO 8601", () => {
		const before = new Date().toISOString();
		const doc = toMemoryDocument("note", embedding, "preference");
		const after = new Date().toISOString();
		const createdAt = (doc as Record<string, unknown>)
			.metadata_created_at as string;
		// Must parse as a valid date
		expect(Number.isNaN(Date.parse(createdAt))).toBe(false);
		// Must be between before and after
		expect(createdAt >= before).toBe(true);
		expect(createdAt <= after).toBe(true);
	});

	test("stores session_id when provided", () => {
		const doc = toMemoryDocument(
			"note",
			embedding,
			"preference",
			[],
			"session-abc-123",
		);
		expect((doc as Record<string, unknown>).metadata_session_id).toBe(
			"session-abc-123",
		);
	});

	test("omits metadata_session_id when not provided", () => {
		const doc = toMemoryDocument("note", embedding, "preference");
		expect(
			(doc as Record<string, unknown>).metadata_session_id,
		).toBeUndefined();
	});

	test("stores note text and embedding vector", () => {
		const doc = toMemoryDocument("my note", embedding, "preference");
		expect(doc.text).toBe("my note");
		expect(doc.vector).toEqual(embedding);
	});
});

// ---------------------------------------------------------------------------
// generateWorkspaceDescription
// ---------------------------------------------------------------------------

describe("generateWorkspaceDescription", () => {
	test("extracts project name from package.json", () => {
		const files: WorkspaceFile[] = [
			{
				path: "package.json",
				content: JSON.stringify({ name: "my-cool-project" }),
			},
		];
		const desc = generateWorkspaceDescription(files);
		expect(desc).toContain("Project: my-cool-project");
	});

	test("detects dependencies from package.json", () => {
		const files: WorkspaceFile[] = [
			{
				path: "package.json",
				content: JSON.stringify({
					dependencies: { zod: "^3.0.0", express: "^4.0.0" },
				}),
			},
		];
		const desc = generateWorkspaceDescription(files);
		// Dependencies are sorted alphabetically for deterministic output
		expect(desc).toContain("Dependencies: express, zod");
	});

	test("detects build tools from scripts in package.json", () => {
		const files: WorkspaceFile[] = [
			{
				path: "package.json",
				content: JSON.stringify({
					scripts: { build: "tsc", test: "bun test", lint: "biome check" },
				}),
			},
		];
		const desc = generateWorkspaceDescription(files);
		// Scripts are sorted alphabetically for deterministic output
		expect(desc).toContain("Scripts: build, lint, test");
	});

	test("detects TypeScript from tsconfig.json", () => {
		const files: WorkspaceFile[] = [{ path: "tsconfig.json", content: "{}" }];
		const desc = generateWorkspaceDescription(files);
		expect(desc).toContain("TypeScript");
	});

	test("detects Biome from biome.json", () => {
		const files: WorkspaceFile[] = [{ path: "biome.json", content: "{}" }];
		const desc = generateWorkspaceDescription(files);
		expect(desc).toContain("Biome");
	});

	test("detects languages from file extensions", () => {
		const files: WorkspaceFile[] = [
			{ path: "src/index.ts", content: "" },
			{ path: "main.py", content: "" },
		];
		const desc = generateWorkspaceDescription(files);
		expect(desc).toContain("TypeScript");
		expect(desc).toContain("Python");
	});

	test("produces deterministic output for same input", () => {
		const files: WorkspaceFile[] = [
			{
				path: "package.json",
				content: JSON.stringify({
					name: "test-proj",
					dependencies: { zod: "1.0" },
				}),
			},
			{ path: "tsconfig.json", content: "{}" },
		];
		const desc1 = generateWorkspaceDescription(files);
		const desc2 = generateWorkspaceDescription(files);
		expect(desc1).toBe(desc2);
	});

	test("returns empty string for empty files array", () => {
		const desc = generateWorkspaceDescription([]);
		expect(desc).toBe("");
	});

	test("handles malformed package.json gracefully", () => {
		const files: WorkspaceFile[] = [
			{ path: "package.json", content: "not valid json" },
		];
		// Should not throw
		const desc = generateWorkspaceDescription(files);
		expect(typeof desc).toBe("string");
	});
});

// ---------------------------------------------------------------------------
// generateMatchReason
// ---------------------------------------------------------------------------

describe("generateMatchReason", () => {
	test("produces a non-empty string", () => {
		const reason = generateMatchReason(
			"TypeScript project using Bun",
			["typescript", "bun"],
			"A tool for TypeScript projects",
		);
		expect(reason.length).toBeGreaterThan(0);
	});

	test("mentions overlapping keywords", () => {
		const reason = generateMatchReason(
			"TypeScript project using Bun and Zod",
			["typescript", "zod"],
			"Schema validation library",
		);
		expect(reason).toContain("typescript");
		expect(reason).toContain("zod");
	});

	test("falls back to description word overlap when no keyword match", () => {
		const reason = generateMatchReason(
			"project using express framework",
			["react", "vue"],
			"A framework for building express applications",
		);
		// Should find overlap on words like "express", "framework"
		expect(reason.length).toBeGreaterThan(0);
	});

	test("returns fallback message when no overlap found", () => {
		const reason = generateMatchReason("abc xyz", ["qwerty"], "mnop");
		expect(reason).toBe("Semantically similar to workspace profile");
	});
});
