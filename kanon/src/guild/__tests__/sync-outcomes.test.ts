import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BackendConfig } from "../../backends/types";
import { GlobalCache } from "../global-cache";
import { printManifest } from "../manifest";
import { sync } from "../sync";

/**
 * Unit tests for `guild sync` outcomes collision detection integration (Req 2G).
 *
 * These tests verify that:
 * - COLLISION verdicts block materialization (Req 2G.2)
 * - --force downgrades collisions to warnings and proceeds (Req 2G.3)
 * - AMBIGUOUS verdicts are always warnings and never block (Req 2G.4)
 */

let tempDir: string;
let cacheDir: string;
let cache: GlobalCache;
let workDir: string;
let knowledgeDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "guild-sync-outcomes-"));
	cacheDir = join(tempDir, "cache");
	workDir = join(tempDir, "work");
	knowledgeDir = join(tempDir, "knowledge");
	cache = new GlobalCache(cacheDir);
	await mkdir(workDir, { recursive: true });
	await mkdir(knowledgeDir, { recursive: true });
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

/**
 * Seed the global cache with an artifact at a given version for specified harnesses.
 */
async function seedCache(
	artifactName: string,
	version: string,
	harnesses: string[],
): Promise<void> {
	for (const h of harnesses) {
		const srcDir = join(tempDir, "_seed", artifactName, version, h);
		await mkdir(srcDir, { recursive: true });
		await writeFile(join(srcDir, "rule.md"), `# ${artifactName} (${h})`);
		await cache.store(artifactName, version, h, srcDir, "test-backend");
	}
}

/**
 * Write a manifest file and return its path.
 */
async function writeManifest(
	dir: string,
	artifacts: Array<{
		name: string;
		version: string;
		mode?: string;
		harnesses?: string[];
	}>,
): Promise<string> {
	const forgeDir = join(dir, ".forge");
	await mkdir(forgeDir, { recursive: true });
	const manifestPath = join(forgeDir, "manifest.yaml");
	const manifest = {
		artifacts: artifacts.map((a) => ({
			name: a.name,
			version: a.version,
			mode: (a.mode ?? "required") as "optional" | "required",
			...(a.harnesses ? { harnesses: a.harnesses } : {}),
		})),
	};
	await writeFile(manifestPath, printManifest(manifest), "utf-8");
	return manifestPath;
}

/**
 * Write a knowledge artifact with outcomes in its frontmatter under the
 * knowledge source directory. The guild sync outcomes detection reads from
 * these knowledge source directories.
 */
async function writeKnowledgeArtifact(
	name: string,
	outcomes: Array<{
		id: string;
		kind: string;
		inputShape: string;
		outputShape: string;
		summary: string;
		keywords?: string[];
		related?: string[];
	}>,
): Promise<void> {
	const artifactDir = join(knowledgeDir, name);
	await mkdir(artifactDir, { recursive: true });

	const outcomesYaml = outcomes
		.map((o) => {
			let yaml = `  - id: "${o.id}"
    kind: ${o.kind}
    inputShape: "${o.inputShape}"
    outputShape: "${o.outputShape}"
    summary: "${o.summary}"`;
			if (o.keywords && o.keywords.length > 0) {
				yaml += `\n    keywords:\n${o.keywords.map((k) => `      - "${k}"`).join("\n")}`;
			}
			if (o.related && o.related.length > 0) {
				yaml += `\n    related:\n${o.related.map((r) => `      - "${r}"`).join("\n")}`;
			}
			return yaml;
		})
		.join("\n");

	await writeFile(
		join(artifactDir, "knowledge.md"),
		`---
name: ${name}
harnesses:
  - kiro
outcomes:
${outcomesYaml}
---
# ${name}

Body content.`,
	);
}

// Provide a dummy config backends map so sync doesn't try to load kanon.config.yaml
const emptyBackends = new Map<string, BackendConfig>();

// ---------------------------------------------------------------------------
// Tests: Outcomes collision blocks sync (Req 2G.2)
// ---------------------------------------------------------------------------

describe("guild sync — outcomes collision detection (Req 2G)", () => {
	test("COLLISION blocks materialization and reports error (Req 2G.2)", async () => {
		// Set up two artifacts with colliding outcomes (same shape + keyword overlap >= 0.4)
		await writeKnowledgeArtifact("skill-alpha", [
			{
				id: "out-transform-text",
				kind: "operation",
				inputShape: "string",
				outputShape: "string",
				summary: "Transform text content",
				keywords: ["transform", "text", "content", "modify"],
			},
		]);

		await writeKnowledgeArtifact("skill-beta", [
			{
				id: "out-modify-text",
				kind: "operation",
				inputShape: "string",
				outputShape: "string",
				summary: "Modify text content",
				keywords: ["transform", "text", "content", "update"],
			},
		]);

		// Seed cache so artifacts can be resolved
		await seedCache("skill-alpha", "1.0.0", ["kiro"]);
		await seedCache("skill-beta", "1.0.0", ["kiro"]);

		const manifestPath = await writeManifest(workDir, [
			{ name: "skill-alpha", version: "1.0.0", harnesses: ["kiro"] },
			{ name: "skill-beta", version: "1.0.0", harnesses: ["kiro"] },
		]);

		const result = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
			knowledgeSourceDirs: [knowledgeDir],
		});

		// Should have collision errors
		expect(result.errors.length).toBeGreaterThan(0);
		const collisionError = result.errors.find(
			(e) => e.includes("COLLISION") || e.includes("collision"),
		);
		expect(collisionError).toBeDefined();

		// Should NOT have written files (blocked before materialization)
		expect(result.filesWritten).toBe(0);
	});

	test("--force downgrades collision to warning and proceeds (Req 2G.3)", async () => {
		// Same colliding artifacts as above
		await writeKnowledgeArtifact("skill-alpha", [
			{
				id: "out-transform-text",
				kind: "operation",
				inputShape: "string",
				outputShape: "string",
				summary: "Transform text content",
				keywords: ["transform", "text", "content", "modify"],
			},
		]);

		await writeKnowledgeArtifact("skill-beta", [
			{
				id: "out-modify-text",
				kind: "operation",
				inputShape: "string",
				outputShape: "string",
				summary: "Modify text content",
				keywords: ["transform", "text", "content", "update"],
			},
		]);

		await seedCache("skill-alpha", "1.0.0", ["kiro"]);
		await seedCache("skill-beta", "1.0.0", ["kiro"]);

		const manifestPath = await writeManifest(workDir, [
			{ name: "skill-alpha", version: "1.0.0", harnesses: ["kiro"] },
			{ name: "skill-beta", version: "1.0.0", harnesses: ["kiro"] },
		]);

		const result = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
			knowledgeSourceDirs: [knowledgeDir],
			force: true,
		});

		// With --force, errors should be empty (downgraded to warnings)
		expect(result.errors).toHaveLength(0);

		// Collision should appear in warnings with --force marker
		const forceWarning = result.warnings.find(
			(w) => w.includes("--force") && w.includes("COLLISION"),
		);
		expect(forceWarning).toBeDefined();

		// Materialization should have proceeded (files written)
		expect(result.filesWritten).toBeGreaterThan(0);
	});

	test("AMBIGUOUS verdict produces warning without blocking (Req 2G.4)", async () => {
		// Two artifacts where only keyword overlap matches (shapes differ)
		await writeKnowledgeArtifact("skill-parse", [
			{
				id: "out-parse-json",
				kind: "operation",
				inputShape: "string",
				outputShape: "object",
				summary: "Parse JSON data",
				keywords: ["parse", "json", "data", "transform"],
			},
		]);

		await writeKnowledgeArtifact("skill-decode", [
			{
				id: "out-decode-json",
				kind: "operation",
				inputShape: "Buffer",
				outputShape: "Record<string, unknown>",
				summary: "Decode JSON data",
				keywords: ["parse", "json", "data", "decode"],
			},
		]);

		await seedCache("skill-parse", "1.0.0", ["kiro"]);
		await seedCache("skill-decode", "1.0.0", ["kiro"]);

		const manifestPath = await writeManifest(workDir, [
			{ name: "skill-parse", version: "1.0.0", harnesses: ["kiro"] },
			{ name: "skill-decode", version: "1.0.0", harnesses: ["kiro"] },
		]);

		const result = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
			knowledgeSourceDirs: [knowledgeDir],
		});

		// No errors — ambiguous is not blocking
		expect(result.errors).toHaveLength(0);

		// Should have an ambiguous warning
		const ambiguousWarning = result.warnings.find((w) =>
			w.includes("AMBIGUOUS"),
		);
		expect(ambiguousWarning).toBeDefined();

		// Materialization should have proceeded
		expect(result.filesWritten).toBeGreaterThan(0);
	});

	test("duplicate outcome IDs block sync (Req 2G.2)", async () => {
		// Two artifacts with the same outcome ID
		await writeKnowledgeArtifact("skill-dup-a", [
			{
				id: "out-same-id",
				kind: "specification",
				inputShape: "string",
				outputShape: "boolean",
				summary: "Check something",
				keywords: ["check"],
			},
		]);

		await writeKnowledgeArtifact("skill-dup-b", [
			{
				id: "out-same-id",
				kind: "operation",
				inputShape: "number",
				outputShape: "string",
				summary: "Convert something",
				keywords: ["convert"],
			},
		]);

		await seedCache("skill-dup-a", "1.0.0", ["kiro"]);
		await seedCache("skill-dup-b", "1.0.0", ["kiro"]);

		const manifestPath = await writeManifest(workDir, [
			{ name: "skill-dup-a", version: "1.0.0", harnesses: ["kiro"] },
			{ name: "skill-dup-b", version: "1.0.0", harnesses: ["kiro"] },
		]);

		const result = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
			knowledgeSourceDirs: [knowledgeDir],
		});

		// Duplicate ids are errors
		expect(result.errors.length).toBeGreaterThan(0);
		const dupError = result.errors.find((e) => e.includes("collision"));
		expect(dupError).toBeDefined();
		expect(dupError).toContain("out-same-id");

		// Should NOT have written files
		expect(result.filesWritten).toBe(0);
	});

	test("no outcomes produces no collision errors", async () => {
		// Artifacts without outcomes — sync proceeds normally
		const artifactDir = join(knowledgeDir, "skill-no-outcomes");
		await mkdir(artifactDir, { recursive: true });
		await writeFile(
			join(artifactDir, "knowledge.md"),
			`---
name: skill-no-outcomes
harnesses:
  - kiro
---
# No outcomes artifact

Body.`,
		);

		await seedCache("skill-no-outcomes", "1.0.0", ["kiro"]);

		const manifestPath = await writeManifest(workDir, [
			{ name: "skill-no-outcomes", version: "1.0.0", harnesses: ["kiro"] },
		]);

		const result = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
			knowledgeSourceDirs: [knowledgeDir],
		});

		expect(result.errors).toHaveLength(0);
		expect(result.filesWritten).toBeGreaterThan(0);
	});
});
