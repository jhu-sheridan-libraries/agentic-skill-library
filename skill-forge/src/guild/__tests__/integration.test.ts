import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	access,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BackendConfig } from "../../backends/types";
import { GlobalCache } from "../global-cache";
import type { Manifest } from "../manifest";
import { parseManifest, printManifest } from "../manifest";
import { sync } from "../sync";

/**
 * Integration tests: full install → init → sync pipeline with mock backends.
 * Requirements: 1.1, 4.1, 4.11, 5.1, 5.4
 *
 * These tests verify the end-to-end flow:
 *   1. Seed the global cache (simulating `forge install --global`)
 *   2. Create a manifest (simulating `forge guild init`)
 *   3. Run `sync()` (simulating `forge guild sync`)
 *   4. Verify artifacts are materialized into harness targets
 */

let tempDir: string;
let cacheDir: string;
let cache: GlobalCache;
let workDir: string;
let originalCwd: string;

const emptyBackends = new Map<string, BackendConfig>();

function expectDefined<T>(value: T | null | undefined, message: string): T {
	expect(value).toBeDefined();
	expect(value).not.toBeNull();
	if (value == null) {
		throw new Error(message);
	}
	return value;
}

async function pathExists(p: string): Promise<boolean> {
	try {
		await access(p);
		return true;
	} catch {
		return false;
	}
}

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "integration-test-"));
	cacheDir = join(tempDir, "cache");
	workDir = join(tempDir, "work");
	cache = new GlobalCache(cacheDir);
	await mkdir(workDir, { recursive: true });
	originalCwd = process.cwd();
	process.chdir(workDir);
});

afterEach(async () => {
	process.chdir(originalCwd);
	await rm(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Seed the global cache with an artifact (simulates `forge install --global`).
 * Creates dist files for each specified harness.
 */
async function seedGlobalCache(
	artifactName: string,
	version: string,
	harnesses: string[],
	fileContents?: Record<string, string>,
): Promise<void> {
	for (const h of harnesses) {
		const srcDir = join(tempDir, "_seed", artifactName, version, h);
		await mkdir(srcDir, { recursive: true });
		if (fileContents) {
			for (const [fileName, content] of Object.entries(fileContents)) {
				await writeFile(join(srcDir, fileName), content);
			}
		} else {
			await writeFile(
				join(srcDir, "rule.md"),
				`# ${artifactName} v${version} (${h})`,
			);
		}
		await cache.store(artifactName, version, h, srcDir, "test-backend");
	}
}

/**
 * Create a manifest in the work directory (simulates `forge guild init`).
 */
async function createManifest(manifest: Manifest): Promise<string> {
	const forgeDir = join(workDir, ".forge");
	await mkdir(forgeDir, { recursive: true });
	const manifestPath = join(forgeDir, "manifest.yaml");
	await writeFile(manifestPath, printManifest(manifest), "utf-8");
	return manifestPath;
}

// ---------------------------------------------------------------------------
// Tests: Full pipeline — install → init → sync (Req 1.1, 4.1, 4.11, 5.1, 5.4)
// ---------------------------------------------------------------------------

describe("integration: full install → init → sync pipeline", () => {
	test("single artifact: cache → manifest → sync materializes files (Req 1.1, 4.1, 5.1, 5.4)", async () => {
		// Step 1: Simulate `forge install --global my-skill`
		await seedGlobalCache("my-skill", "1.0.0", ["kiro"]);

		// Verify artifact is stored in cache at correct path (Req 1.1)
		const distPath = cache.distPath("my-skill", "1.0.0", "kiro");
		expect(await pathExists(distPath)).toBe(true);
		const cachedContent = await readFile(join(distPath, "rule.md"), "utf-8");
		expect(cachedContent).toContain("my-skill");

		// Step 2: Simulate `forge guild init my-skill` — create manifest (Req 4.1)
		const manifestPath = await createManifest({
			artifacts: [{ name: "my-skill", version: "1.0.0", mode: "required" }],
		});

		// Verify manifest was created with correct entry
		const manifestContent = await readFile(manifestPath, "utf-8");
		const parsed = parseManifest(manifestContent);
		expect(parsed.artifacts).toHaveLength(1);
		expect((parsed.artifacts[0] as { name: string }).name).toBe("my-skill");

		// Step 3: Simulate `forge guild sync` (Req 4.11, 5.1, 5.4)
		const result = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
		});

		expect(result.errors).toHaveLength(0);
		expect(result.filesWritten).toBeGreaterThan(0);
		expect(result.resolved).toHaveLength(1);
		expect(result.resolved[0].name).toBe("my-skill");
		expect(result.resolved[0].version).toBe("1.0.0");

		// Verify artifact materialized into kiro harness target (.kiro/my-skill/)
		const materializedPath = join(workDir, ".kiro", "my-skill", "rule.md");
		expect(await pathExists(materializedPath)).toBe(true);
		const materializedContent = await readFile(materializedPath, "utf-8");
		expect(materializedContent).toContain("my-skill");
	});

	test("multiple artifacts: all materialized into correct harness targets", async () => {
		// Install two artifacts
		await seedGlobalCache("skill-a", "1.0.0", ["kiro"]);
		await seedGlobalCache("skill-b", "2.0.0", ["kiro"]);

		// Create manifest with both
		const manifestPath = await createManifest({
			artifacts: [
				{ name: "skill-a", version: "1.0.0", mode: "required" },
				{ name: "skill-b", version: "2.0.0", mode: "required" },
			],
		});

		const result = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
		});

		expect(result.errors).toHaveLength(0);
		expect(result.resolved).toHaveLength(2);

		// Both artifacts should be materialized in separate subdirectories
		expect(await pathExists(join(workDir, ".kiro", "skill-a", "rule.md"))).toBe(
			true,
		);
		expect(await pathExists(join(workDir, ".kiro", "skill-b", "rule.md"))).toBe(
			true,
		);

		// Verify content isolation
		const contentA = await readFile(
			join(workDir, ".kiro", "skill-a", "rule.md"),
			"utf-8",
		);
		const contentB = await readFile(
			join(workDir, ".kiro", "skill-b", "rule.md"),
			"utf-8",
		);
		expect(contentA).toContain("skill-a");
		expect(contentB).toContain("skill-b");
	});

	test("multi-harness artifact: materialized to all harness targets (Req 5.4)", async () => {
		await seedGlobalCache("my-skill", "1.0.0", ["kiro", "cursor"]);

		const manifestPath = await createManifest({
			artifacts: [
				{
					name: "my-skill",
					version: "1.0.0",
					mode: "required",
					harnesses: ["kiro", "cursor"],
				},
			],
		});

		const result = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
		});

		expect(result.errors).toHaveLength(0);
		expect(result.filesWritten).toBeGreaterThanOrEqual(2);

		// kiro harness target: .kiro/my-skill/
		expect(
			await pathExists(join(workDir, ".kiro", "my-skill", "rule.md")),
		).toBe(true);
		// cursor harness target: ./my-skill/ (cursor maps to ".")
		expect(await pathExists(join(workDir, "my-skill", "rule.md"))).toBe(true);
	});

	test("sync writes sync-lock.json with resolved versions (Req 5.1)", async () => {
		await seedGlobalCache("my-skill", "1.2.3", ["kiro"]);

		const manifestPath = await createManifest({
			artifacts: [
				{
					name: "my-skill",
					version: "1.2.3",
					mode: "required",
					harnesses: ["kiro"],
				},
			],
		});

		await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
		});

		// Verify sync-lock.json was written
		const lockPath = join(workDir, ".forge", "sync-lock.json");
		expect(await pathExists(lockPath)).toBe(true);

		const lockContent = JSON.parse(await readFile(lockPath, "utf-8"));
		expect(lockContent.syncedAt).toBeDefined();
		expect(lockContent.entries).toHaveLength(1);
		expect(lockContent.entries[0].name).toBe("my-skill");
		expect(lockContent.entries[0].version).toBe("1.2.3");
	});

	test("sync writes .forge/.gitignore with generated paths", async () => {
		await seedGlobalCache("my-skill", "1.0.0", ["kiro"]);

		const manifestPath = await createManifest({
			artifacts: [
				{
					name: "my-skill",
					version: "1.0.0",
					mode: "required",
					harnesses: ["kiro"],
				},
			],
		});

		await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
		});

		const gitignorePath = join(workDir, ".forge", ".gitignore");
		expect(await pathExists(gitignorePath)).toBe(true);

		const gitignoreContent = await readFile(gitignorePath, "utf-8");
		expect(gitignoreContent).toContain(".kiro/my-skill");
	});

	test("semver range resolution picks highest matching version (Req 5.1, 5.4)", async () => {
		// Install multiple versions
		await seedGlobalCache("my-skill", "1.0.0", ["kiro"]);
		await seedGlobalCache("my-skill", "1.2.0", ["kiro"]);
		await seedGlobalCache("my-skill", "1.5.0", ["kiro"]);
		await seedGlobalCache("my-skill", "2.0.0", ["kiro"]);

		// Use a semver range that should pick 1.5.0 (highest ^1.0.0)
		const manifestPath = await createManifest({
			artifacts: [
				{
					name: "my-skill",
					version: "^1.0.0",
					mode: "required",
					harnesses: ["kiro"],
				},
			],
		});

		const result = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
		});

		expect(result.errors).toHaveLength(0);
		expect(result.resolved).toHaveLength(1);
		expect(result.resolved[0].version).toBe("1.5.0");

		// Verify the correct version's content was materialized
		const content = await readFile(
			join(workDir, ".kiro", "my-skill", "rule.md"),
			"utf-8",
		);
		expect(content).toContain("v1.5.0");
	});

	test("required artifact missing from cache produces fatal error (Req 5.1)", async () => {
		// Don't seed cache — artifact is missing
		const manifestPath = await createManifest({
			artifacts: [
				{
					name: "missing-skill",
					version: "1.0.0",
					mode: "required",
					harnesses: ["kiro"],
				},
			],
		});

		const result = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
		});

		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.errors[0]).toContain("missing-skill");
		expect(result.filesWritten).toBe(0);
	});

	test("optional artifact missing from cache produces warning, not error", async () => {
		await seedGlobalCache("present-skill", "1.0.0", ["kiro"]);

		const manifestPath = await createManifest({
			artifacts: [
				{
					name: "present-skill",
					version: "1.0.0",
					mode: "required",
					harnesses: ["kiro"],
				},
				{
					name: "missing-skill",
					version: "1.0.0",
					mode: "optional",
					harnesses: ["kiro"],
				},
			],
		});

		const result = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
		});

		// No fatal errors — optional missing is just a warning
		expect(result.errors).toHaveLength(0);
		expect(result.warnings.some((w) => w.includes("missing-skill"))).toBe(true);

		// Present skill should still be materialized
		expect(result.resolved).toHaveLength(1);
		expect(result.resolved[0].name).toBe("present-skill");
		expect(
			await pathExists(join(workDir, ".kiro", "present-skill", "rule.md")),
		).toBe(true);
	});

	test("artifact with multiple files is fully materialized", async () => {
		await seedGlobalCache("multi-file-skill", "1.0.0", ["kiro"], {
			"rule.md": "# Rule content",
			"prompt.md": "# Prompt content",
			"config.yaml": "key: value",
		});

		const manifestPath = await createManifest({
			artifacts: [
				{
					name: "multi-file-skill",
					version: "1.0.0",
					mode: "required",
					harnesses: ["kiro"],
				},
			],
		});

		const result = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
		});

		expect(result.errors).toHaveLength(0);
		expect(result.filesWritten).toBe(3);

		const destDir = join(workDir, ".kiro", "multi-file-skill");
		expect(await readFile(join(destDir, "rule.md"), "utf-8")).toBe(
			"# Rule content",
		);
		expect(await readFile(join(destDir, "prompt.md"), "utf-8")).toBe(
			"# Prompt content",
		);
		expect(await readFile(join(destDir, "config.yaml"), "utf-8")).toBe(
			"key: value",
		);
	});

	test("re-sync overwrites previously materialized files with updated cache", async () => {
		// First install and sync
		await seedGlobalCache("my-skill", "1.0.0", ["kiro"], {
			"rule.md": "# Original content",
		});

		const manifestPath = await createManifest({
			artifacts: [
				{
					name: "my-skill",
					version: "1.0.0",
					mode: "required",
					harnesses: ["kiro"],
				},
			],
		});

		await sync({ manifestPath, cache, configBackends: emptyBackends });

		let content = await readFile(
			join(workDir, ".kiro", "my-skill", "rule.md"),
			"utf-8",
		);
		expect(content).toBe("# Original content");

		// Install a new version and update manifest
		await seedGlobalCache("my-skill", "1.1.0", ["kiro"], {
			"rule.md": "# Updated content",
		});

		const updatedManifestPath = await createManifest({
			artifacts: [
				{
					name: "my-skill",
					version: "1.1.0",
					mode: "required",
					harnesses: ["kiro"],
				},
			],
		});

		const result = await sync({
			manifestPath: updatedManifestPath,
			cache,
			configBackends: emptyBackends,
		});

		expect(result.errors).toHaveLength(0);
		content = await readFile(
			join(workDir, ".kiro", "my-skill", "rule.md"),
			"utf-8",
		);
		expect(content).toBe("# Updated content");
	});
});

// ---------------------------------------------------------------------------
// Tests: Collection expansion end-to-end (Req 5.3, 11.1, 11.2, 11.3, 11.4)
// ---------------------------------------------------------------------------

describe("integration: collection expansion end-to-end with mock catalog", () => {
	test("collection ref is expanded into member artifacts during sync (Req 5.3, 11.1)", async () => {
		// Seed individual artifacts that are members of the collection
		await seedGlobalCache("skill-alpha", "1.0.0", ["kiro"]);
		await seedGlobalCache("skill-beta", "1.0.0", ["kiro"]);

		// Write catalog metadata for the collection
		await cache.writeCatalogMeta("my-collection", "1.0.0", [
			{ name: "skill-alpha" },
			{ name: "skill-beta" },
		]);

		// Create manifest with a collection ref
		const manifestPath = await createManifest({
			artifacts: [
				{
					collection: "my-collection",
					version: "1.0.0",
					mode: "required",
					harnesses: ["kiro"],
				},
			],
		});

		const result = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
		});

		expect(result.errors).toHaveLength(0);
		expect(result.resolved).toHaveLength(2);

		const names = result.resolved.map((r) => r.name).sort();
		expect(names).toEqual(["skill-alpha", "skill-beta"]);

		// Both members should be materialized
		expect(
			await pathExists(join(workDir, ".kiro", "skill-alpha", "rule.md")),
		).toBe(true);
		expect(
			await pathExists(join(workDir, ".kiro", "skill-beta", "rule.md")),
		).toBe(true);
	});

	test("expanded members inherit collection ref mode, harnesses, and backend (Req 11.2)", async () => {
		await seedGlobalCache("member-a", "2.0.0", ["kiro", "cursor"]);
		await seedGlobalCache("member-b", "2.0.0", ["kiro", "cursor"]);

		await cache.writeCatalogMeta("team-bundle", "2.0.0", [
			{ name: "member-a" },
			{ name: "member-b" },
		]);

		// Collection ref specifies optional mode and specific harnesses
		const manifestPath = await createManifest({
			artifacts: [
				{
					collection: "team-bundle",
					version: "2.0.0",
					mode: "optional",
					harnesses: ["kiro", "cursor"],
				},
			],
		});

		const result = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
		});

		expect(result.errors).toHaveLength(0);
		expect(result.resolved).toHaveLength(2);

		// Each resolved entry should inherit the collection's mode and harnesses
		for (const entry of result.resolved) {
			expect(entry.mode).toBe("optional");
			expect(entry.harnesses).toEqual(["kiro", "cursor"]);
		}

		// Materialized into both harness targets
		expect(
			await pathExists(join(workDir, ".kiro", "member-a", "rule.md")),
		).toBe(true);
		expect(
			await pathExists(join(workDir, ".kiro", "member-b", "rule.md")),
		).toBe(true);
		// cursor maps to "." so artifacts appear at ./member-a/ and ./member-b/
		expect(await pathExists(join(workDir, "member-a", "rule.md"))).toBe(true);
		expect(await pathExists(join(workDir, "member-b", "rule.md"))).toBe(true);
	});

	test("individual entry takes precedence over collection-inherited settings (Req 11.3)", async () => {
		await seedGlobalCache("shared-skill", "1.0.0", ["kiro"], {
			"rule.md": "# shared-skill individual",
		});
		await seedGlobalCache("shared-skill", "3.0.0", ["kiro"], {
			"rule.md": "# shared-skill collection v3",
		});
		await seedGlobalCache("only-in-collection", "3.0.0", ["kiro"]);

		await cache.writeCatalogMeta("overlap-collection", "3.0.0", [
			{ name: "shared-skill" },
			{ name: "only-in-collection" },
		]);

		// Manifest has both an individual entry for shared-skill AND a collection that includes it
		const manifestPath = await createManifest({
			artifacts: [
				// Individual entry: pinned to 1.0.0, required
				{
					name: "shared-skill",
					version: "1.0.0",
					mode: "required",
					harnesses: ["kiro"],
				},
				// Collection ref: version 3.0.0, optional
				{
					collection: "overlap-collection",
					version: "3.0.0",
					mode: "optional",
					harnesses: ["kiro"],
				},
			],
		});

		const result = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
		});

		expect(result.errors).toHaveLength(0);
		// Should have 2 resolved: shared-skill (individual) + only-in-collection (from collection)
		expect(result.resolved).toHaveLength(2);

		const sharedEntry = expectDefined(
			result.resolved.find((r) => r.name === "shared-skill"),
			"Expected resolved shared-skill entry",
		);
		const collectionOnly = expectDefined(
			result.resolved.find((r) => r.name === "only-in-collection"),
			"Expected resolved only-in-collection entry",
		);

		// Individual entry wins: version 1.0.0, mode required, no source
		expect(sharedEntry.version).toBe("1.0.0");
		expect(sharedEntry.mode).toBe("required");
		expect(sharedEntry.source).toBeUndefined();

		// Collection-only entry inherits collection settings
		expect(collectionOnly.version).toBe("3.0.0");
		expect(collectionOnly.mode).toBe("optional");
		expect(collectionOnly.source).toBe("overlap-collection");

		// Verify the individual version's content was materialized (not the collection version)
		const content = await readFile(
			join(workDir, ".kiro", "shared-skill", "rule.md"),
			"utf-8",
		);
		expect(content).toContain("individual");
	});

	test("sync-lock records expanded collection members with source field (Req 11.4)", async () => {
		await seedGlobalCache("lock-skill-a", "1.0.0", ["kiro"]);
		await seedGlobalCache("lock-skill-b", "1.0.0", ["kiro"]);

		await cache.writeCatalogMeta("lock-collection", "1.0.0", [
			{ name: "lock-skill-a" },
			{ name: "lock-skill-b" },
		]);

		const manifestPath = await createManifest({
			artifacts: [
				{
					collection: "lock-collection",
					version: "1.0.0",
					mode: "required",
					harnesses: ["kiro"],
				},
			],
		});

		await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
		});

		// Read sync-lock and verify source fields
		const lockPath = join(workDir, ".forge", "sync-lock.json");
		expect(await pathExists(lockPath)).toBe(true);

		const lockContent = JSON.parse(await readFile(lockPath, "utf-8"));
		expect(lockContent.entries).toHaveLength(2);

		for (const entry of lockContent.entries) {
			expect(entry.source).toBe("lock-collection");
			expect(entry.version).toBe("1.0.0");
		}

		const lockNames = lockContent.entries
			.map((e: { name: string }) => e.name)
			.sort();
		expect(lockNames).toEqual(["lock-skill-a", "lock-skill-b"]);
	});

	test("mixed manifest: individual + collection with sync-lock source only on collection members", async () => {
		await seedGlobalCache("standalone", "2.0.0", ["kiro"]);
		await seedGlobalCache("coll-member-x", "1.0.0", ["kiro"]);
		await seedGlobalCache("coll-member-y", "1.0.0", ["kiro"]);

		await cache.writeCatalogMeta("mixed-coll", "1.0.0", [
			{ name: "coll-member-x" },
			{ name: "coll-member-y" },
		]);

		const manifestPath = await createManifest({
			artifacts: [
				{
					name: "standalone",
					version: "2.0.0",
					mode: "required",
					harnesses: ["kiro"],
				},
				{
					collection: "mixed-coll",
					version: "1.0.0",
					mode: "required",
					harnesses: ["kiro"],
				},
			],
		});

		await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
		});

		const lockPath = join(workDir, ".forge", "sync-lock.json");
		const lockContent = JSON.parse(await readFile(lockPath, "utf-8"));
		expect(lockContent.entries).toHaveLength(3);

		const standaloneEntry = lockContent.entries.find(
			(e: { name: string }) => e.name === "standalone",
		);
		const memberX = lockContent.entries.find(
			(e: { name: string }) => e.name === "coll-member-x",
		);
		const memberY = lockContent.entries.find(
			(e: { name: string }) => e.name === "coll-member-y",
		);

		// Individual entry should NOT have source field
		expect(standaloneEntry.source).toBeUndefined();

		// Collection members should have source field
		expect(memberX.source).toBe("mixed-coll");
		expect(memberY.source).toBe("mixed-coll");
	});
});

// ---------------------------------------------------------------------------
// Tests: Auto-update with throttle behavior (Req 6.1, 6.2, 6.3, 6.4)
// ---------------------------------------------------------------------------

describe("integration: auto-update throttle behavior and sync pipeline", () => {
	test("autoUpdate skips remote check when throttle interval has not elapsed (Req 6.4)", async () => {
		// Write a recent throttle timestamp (just now)
		await cache.writeThrottleState(new Date());

		// Seed cache with an artifact so sync can resolve
		await seedGlobalCache("throttled-skill", "1.0.0", ["kiro"]);

		const manifestPath = await createManifest({
			artifacts: [
				{
					name: "throttled-skill",
					version: "1.0.0",
					mode: "required",
					harnesses: ["kiro"],
				},
			],
		});

		// Run sync with autoUpdate — should skip remote check due to throttle
		const result = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
			autoUpdate: true,
			throttleMinutes: 60,
		});

		// Sync should still succeed from cache
		expect(result.errors).toHaveLength(0);
		expect(result.resolved).toHaveLength(1);
		expect(result.resolved[0].name).toBe("throttled-skill");
		expect(result.resolved[0].version).toBe("1.0.0");

		// Artifact should be materialized
		expect(
			await pathExists(join(workDir, ".kiro", "throttled-skill", "rule.md")),
		).toBe(true);
	});

	test("autoUpdate proceeds when throttle interval has elapsed (Req 6.3, 6.4)", async () => {
		// Write an old throttle timestamp (2 hours ago)
		const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
		await cache.writeThrottleState(twoHoursAgo);

		await seedGlobalCache("update-skill", "1.0.0", ["kiro"]);

		const manifestPath = await createManifest({
			artifacts: [
				{
					name: "update-skill",
					version: "1.0.0",
					mode: "required",
					harnesses: ["kiro"],
				},
			],
		});

		// Run sync with autoUpdate — throttle has elapsed, so auto-update runs
		// (will silently fail on backend since no real backend exists, but throttle state gets updated)
		const result = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
			autoUpdate: true,
			throttleMinutes: 60,
		});

		expect(result.errors).toHaveLength(0);
		expect(result.resolved).toHaveLength(1);

		// Throttle state should have been updated to a recent timestamp (Req 6.3)
		const throttleState = await cache.readThrottleState();
		expect(throttleState).not.toBeNull();
		const elapsedSinceUpdate =
			Date.now() -
			expectDefined(
				throttleState,
				"Expected throttle state after autoUpdate",
			).getTime();
		// Should have been written within the last few seconds
		expect(elapsedSinceUpdate).toBeLessThan(10_000);
	});

	test("autoUpdate writes throttle state on first run with no prior state (Req 6.3)", async () => {
		// No prior throttle state exists
		const initialState = await cache.readThrottleState();
		expect(initialState).toBeNull();

		await seedGlobalCache("fresh-skill", "1.0.0", ["kiro"]);

		const manifestPath = await createManifest({
			artifacts: [
				{
					name: "fresh-skill",
					version: "1.0.0",
					mode: "required",
					harnesses: ["kiro"],
				},
			],
		});

		await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
			autoUpdate: true,
			throttleMinutes: 60,
		});

		// Throttle state should now exist (Req 6.3)
		const throttleState = await cache.readThrottleState();
		expect(throttleState).not.toBeNull();
		expect(throttleState?.getTime()).toBeGreaterThan(0);
	});

	test("sync with autoUpdate: true materializes artifacts from cache (Req 6.1)", async () => {
		// Pre-seed cache with artifacts
		await seedGlobalCache("auto-skill-a", "2.0.0", ["kiro"], {
			"rule.md": "# auto-skill-a content",
		});
		await seedGlobalCache("auto-skill-b", "1.5.0", ["kiro"], {
			"rule.md": "# auto-skill-b content",
		});

		const manifestPath = await createManifest({
			artifacts: [
				{
					name: "auto-skill-a",
					version: "2.0.0",
					mode: "required",
					harnesses: ["kiro"],
				},
				{
					name: "auto-skill-b",
					version: "1.5.0",
					mode: "required",
					harnesses: ["kiro"],
				},
			],
		});

		// Run sync with autoUpdate — auto-update silently fails (no backend), sync resolves from cache
		const result = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
			autoUpdate: true,
		});

		expect(result.errors).toHaveLength(0);
		expect(result.resolved).toHaveLength(2);
		expect(result.filesWritten).toBe(2);

		// Verify artifacts materialized correctly
		const contentA = await readFile(
			join(workDir, ".kiro", "auto-skill-a", "rule.md"),
			"utf-8",
		);
		expect(contentA).toBe("# auto-skill-a content");
		const contentB = await readFile(
			join(workDir, ".kiro", "auto-skill-b", "rule.md"),
			"utf-8",
		);
		expect(contentB).toBe("# auto-skill-b content");

		// Verify throttle state was written
		const throttleState = await cache.readThrottleState();
		expect(throttleState).not.toBeNull();
	});

	test("throttle state persists across consecutive sync calls (Req 6.3, 6.4)", async () => {
		await seedGlobalCache("persist-skill", "1.0.0", ["kiro"]);

		const manifestPath = await createManifest({
			artifacts: [
				{
					name: "persist-skill",
					version: "1.0.0",
					mode: "required",
					harnesses: ["kiro"],
				},
			],
		});

		// First sync with autoUpdate — writes throttle state
		await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
			autoUpdate: true,
			throttleMinutes: 60,
		});

		const firstThrottleState = await cache.readThrottleState();
		expect(firstThrottleState).not.toBeNull();

		// Second sync with autoUpdate immediately after — should skip remote check due to throttle
		// The throttle state should remain (not be overwritten since check was skipped)
		const result = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
			autoUpdate: true,
			throttleMinutes: 60,
		});

		expect(result.errors).toHaveLength(0);
		expect(result.resolved).toHaveLength(1);

		// Throttle state should still exist from the first call
		const secondThrottleState = await cache.readThrottleState();
		expect(secondThrottleState).not.toBeNull();
	});

	test("custom throttle interval is respected (Req 6.4)", async () => {
		// Write a throttle timestamp 5 minutes ago
		const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
		await cache.writeThrottleState(fiveMinutesAgo);

		await seedGlobalCache("custom-throttle-skill", "1.0.0", ["kiro"]);

		const manifestPath = await createManifest({
			artifacts: [
				{
					name: "custom-throttle-skill",
					version: "1.0.0",
					mode: "required",
					harnesses: ["kiro"],
				},
			],
		});

		// With 10-minute throttle, 5 minutes elapsed → should skip
		const result1 = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
			autoUpdate: true,
			throttleMinutes: 10,
		});

		expect(result1.errors).toHaveLength(0);
		// Throttle state should NOT have been updated (check was skipped)
		const stateAfterSkip = await cache.readThrottleState();
		expect(stateAfterSkip).not.toBeNull();
		// The timestamp should still be approximately 5 minutes ago
		const elapsedAfterSkip =
			Date.now() -
			expectDefined(
				stateAfterSkip,
				"Expected throttle state after skipped check",
			).getTime();
		expect(elapsedAfterSkip).toBeGreaterThan(4 * 60 * 1000);

		// With 3-minute throttle, 5 minutes elapsed → should proceed
		const result2 = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
			autoUpdate: true,
			throttleMinutes: 3,
		});

		expect(result2.errors).toHaveLength(0);
		// Throttle state should have been updated (check proceeded)
		const stateAfterProceed = await cache.readThrottleState();
		expect(stateAfterProceed).not.toBeNull();
		const elapsedAfterProceed =
			Date.now() -
			expectDefined(
				stateAfterProceed,
				"Expected throttle state after throttle interval elapsed",
			).getTime();
		expect(elapsedAfterProceed).toBeLessThan(10_000);
	});

	test("sync-lock and gitignore are written when autoUpdate is enabled", async () => {
		await seedGlobalCache("lock-auto-skill", "1.0.0", ["kiro"]);

		const manifestPath = await createManifest({
			artifacts: [
				{
					name: "lock-auto-skill",
					version: "1.0.0",
					mode: "required",
					harnesses: ["kiro"],
				},
			],
		});

		await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
			autoUpdate: true,
		});

		// Verify sync-lock.json was written
		const lockPath = join(workDir, ".forge", "sync-lock.json");
		expect(await pathExists(lockPath)).toBe(true);
		const lockContent = JSON.parse(await readFile(lockPath, "utf-8"));
		expect(lockContent.entries).toHaveLength(1);
		expect(lockContent.entries[0].name).toBe("lock-auto-skill");

		// Verify .forge/.gitignore was written
		const gitignorePath = join(workDir, ".forge", ".gitignore");
		expect(await pathExists(gitignorePath)).toBe(true);
		const gitignoreContent = await readFile(gitignorePath, "utf-8");
		expect(gitignoreContent).toContain(".kiro/lock-auto-skill");
	});
});

// ---------------------------------------------------------------------------
// Tests: Offline sync — cache-only, no network (Req 10.1, 10.2)
// ---------------------------------------------------------------------------

describe("integration: offline sync (cache-only, no network)", () => {
	test("sync without autoUpdate resolves from cache only, no errors (Req 10.1)", async () => {
		// Seed cache with an artifact
		await seedGlobalCache("offline-skill", "1.0.0", ["kiro"], {
			"rule.md": "# offline-skill v1.0.0",
		});

		const manifestPath = await createManifest({
			artifacts: [
				{
					name: "offline-skill",
					version: "1.0.0",
					mode: "required",
					harnesses: ["kiro"],
				},
			],
		});

		// Run sync WITHOUT autoUpdate and with no backends configured (simulates no network)
		const result = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
		});

		expect(result.errors).toHaveLength(0);
		expect(result.warnings).toHaveLength(0);
		expect(result.resolved).toHaveLength(1);
		expect(result.resolved[0].name).toBe("offline-skill");
		expect(result.resolved[0].version).toBe("1.0.0");
		expect(result.filesWritten).toBe(1);

		// Verify artifact materialized from cache
		const content = await readFile(
			join(workDir, ".kiro", "offline-skill", "rule.md"),
			"utf-8",
		);
		expect(content).toBe("# offline-skill v1.0.0");
	});

	test("sync with autoUpdate and unreachable backend falls back to cache silently (Req 10.2)", async () => {
		// Seed cache with an artifact
		await seedGlobalCache("fallback-skill", "2.0.0", ["kiro"], {
			"rule.md": "# fallback-skill v2.0.0",
		});

		const manifestPath = await createManifest({
			artifacts: [
				{
					name: "fallback-skill",
					version: "2.0.0",
					mode: "required",
					harnesses: ["kiro"],
				},
			],
		});

		// Run sync WITH autoUpdate but no backends configured (simulates unreachable backend)
		const result = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
			autoUpdate: true,
		});

		// Should succeed silently — no errors from the failed auto-update
		expect(result.errors).toHaveLength(0);
		expect(result.resolved).toHaveLength(1);
		expect(result.resolved[0].name).toBe("fallback-skill");
		expect(result.resolved[0].version).toBe("2.0.0");
		expect(result.filesWritten).toBe(1);

		// Verify artifact materialized from cache
		const content = await readFile(
			join(workDir, ".kiro", "fallback-skill", "rule.md"),
			"utf-8",
		);
		expect(content).toBe("# fallback-skill v2.0.0");
	});

	test("multiple artifacts resolved offline with semver ranges (Req 10.1)", async () => {
		// Seed cache with multiple artifacts at different versions
		await seedGlobalCache("alpha-skill", "1.0.0", ["kiro"], {
			"rule.md": "# alpha v1.0.0",
		});
		await seedGlobalCache("alpha-skill", "1.3.0", ["kiro"], {
			"rule.md": "# alpha v1.3.0",
		});
		await seedGlobalCache("alpha-skill", "2.0.0", ["kiro"], {
			"rule.md": "# alpha v2.0.0",
		});
		await seedGlobalCache("beta-skill", "0.5.0", ["kiro"], {
			"rule.md": "# beta v0.5.0",
		});
		await seedGlobalCache("beta-skill", "0.9.0", ["kiro"], {
			"rule.md": "# beta v0.9.0",
		});

		const manifestPath = await createManifest({
			artifacts: [
				{
					name: "alpha-skill",
					version: "^1.0.0",
					mode: "required",
					harnesses: ["kiro"],
				},
				{
					name: "beta-skill",
					version: "~0.5.0",
					mode: "required",
					harnesses: ["kiro"],
				},
			],
		});

		// Run sync without autoUpdate — purely offline
		const result = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
		});

		expect(result.errors).toHaveLength(0);
		expect(result.resolved).toHaveLength(2);

		// ^1.0.0 should pick 1.3.0 (highest in 1.x range)
		const alpha = expectDefined(
			result.resolved.find((r) => r.name === "alpha-skill"),
			"Expected resolved alpha-skill entry",
		);
		expect(alpha.version).toBe("1.3.0");

		// ~0.5.0 should pick 0.5.0 (0.9.0 is outside ~0.5.0 range)
		const beta = expectDefined(
			result.resolved.find((r) => r.name === "beta-skill"),
			"Expected resolved beta-skill entry",
		);
		expect(beta.version).toBe("0.5.0");

		// Verify correct versions materialized
		const alphaContent = await readFile(
			join(workDir, ".kiro", "alpha-skill", "rule.md"),
			"utf-8",
		);
		expect(alphaContent).toBe("# alpha v1.3.0");
		const betaContent = await readFile(
			join(workDir, ".kiro", "beta-skill", "rule.md"),
			"utf-8",
		);
		expect(betaContent).toBe("# beta v0.5.0");
	});

	test("sync-lock.json is written correctly after offline sync (Req 10.1, 10.3)", async () => {
		await seedGlobalCache("lock-offline-a", "1.0.0", ["kiro"]);
		await seedGlobalCache("lock-offline-b", "2.5.0", ["kiro"]);

		const manifestPath = await createManifest({
			artifacts: [
				{
					name: "lock-offline-a",
					version: "1.0.0",
					mode: "required",
					harnesses: ["kiro"],
				},
				{
					name: "lock-offline-b",
					version: "2.5.0",
					mode: "required",
					harnesses: ["kiro"],
				},
			],
		});

		const result = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
		});

		expect(result.errors).toHaveLength(0);
		expect(result.resolved).toHaveLength(2);

		// Verify sync-lock.json was written without network
		const lockPath = join(workDir, ".forge", "sync-lock.json");
		expect(await pathExists(lockPath)).toBe(true);

		const lockContent = JSON.parse(await readFile(lockPath, "utf-8"));
		expect(lockContent.syncedAt).toBeDefined();
		expect(lockContent.entries).toHaveLength(2);

		const lockA = lockContent.entries.find(
			(e: { name: string }) => e.name === "lock-offline-a",
		);
		const lockB = lockContent.entries.find(
			(e: { name: string }) => e.name === "lock-offline-b",
		);
		expect(lockA.version).toBe("1.0.0");
		expect(lockB.version).toBe("2.5.0");
	});
});

// ---------------------------------------------------------------------------
// Tests: Stale sync-lock re-resolution (Req 9.3)
// ---------------------------------------------------------------------------

describe("integration: stale sync-lock re-resolution", () => {
	test("stale version deleted, alternative available — re-resolves to next best match (Req 9.3)", async () => {
		// Seed cache with two versions
		await seedGlobalCache("stale-skill", "1.0.0", ["kiro"], {
			"rule.md": "# stale-skill v1.0.0",
		});
		await seedGlobalCache("stale-skill", "1.1.0", ["kiro"], {
			"rule.md": "# stale-skill v1.1.0",
		});

		// Create manifest with semver range
		const manifestPath = await createManifest({
			artifacts: [
				{
					name: "stale-skill",
					version: "^1.0.0",
					mode: "required",
					harnesses: ["kiro"],
				},
			],
		});

		// First sync — resolves to 1.1.0 (highest match)
		const result1 = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
		});
		expect(result1.errors).toHaveLength(0);
		expect(result1.resolved).toHaveLength(1);
		expect(result1.resolved[0].version).toBe("1.1.0");

		// Verify sync-lock records 1.1.0
		const lockPath = join(workDir, ".forge", "sync-lock.json");
		const lock1 = JSON.parse(await readFile(lockPath, "utf-8"));
		expect(lock1.entries[0].version).toBe("1.1.0");

		// Delete version 1.1.0 from cache (simulate cache cleanup)
		await rm(join(cacheDir, "artifacts", "stale-skill", "1.1.0"), {
			recursive: true,
			force: true,
		});

		// Second sync — should re-resolve to 1.0.0 (next best match)
		const result2 = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
		});
		expect(result2.errors).toHaveLength(0);
		expect(result2.resolved).toHaveLength(1);
		expect(result2.resolved[0].version).toBe("1.0.0");

		// Verify sync-lock is updated with new version
		const lock2 = JSON.parse(await readFile(lockPath, "utf-8"));
		expect(lock2.entries[0].version).toBe("1.0.0");

		// Verify the correct content was materialized
		const content = await readFile(
			join(workDir, ".kiro", "stale-skill", "rule.md"),
			"utf-8",
		);
		expect(content).toBe("# stale-skill v1.0.0");
	});

	test("stale version deleted, no alternative available (required) — produces fatal error (Req 9.3)", async () => {
		// Seed cache with a single version
		await seedGlobalCache("exact-skill", "1.0.0", ["kiro"], {
			"rule.md": "# exact-skill v1.0.0",
		});

		// Create manifest with exact pin
		const manifestPath = await createManifest({
			artifacts: [
				{
					name: "exact-skill",
					version: "1.0.0",
					mode: "required",
					harnesses: ["kiro"],
				},
			],
		});

		// First sync — resolves to 1.0.0
		const result1 = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
		});
		expect(result1.errors).toHaveLength(0);
		expect(result1.resolved).toHaveLength(1);
		expect(result1.resolved[0].version).toBe("1.0.0");

		// Delete version 1.0.0 from cache
		await rm(join(cacheDir, "artifacts", "exact-skill", "1.0.0"), {
			recursive: true,
			force: true,
		});

		// Second sync — should fail with error (required artifact, no version satisfies pin)
		const result2 = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
		});
		expect(result2.errors.length).toBeGreaterThan(0);
		expect(result2.errors[0]).toContain("exact-skill");
		expect(result2.resolved).toHaveLength(0);
	});

	test("stale version deleted, no alternative available (optional) — produces warning, not error (Req 9.3)", async () => {
		// Seed cache with a single version
		await seedGlobalCache("opt-skill", "1.0.0", ["kiro"], {
			"rule.md": "# opt-skill v1.0.0",
		});

		// Create manifest with exact pin and optional mode
		const manifestPath = await createManifest({
			artifacts: [
				{
					name: "opt-skill",
					version: "1.0.0",
					mode: "optional",
					harnesses: ["kiro"],
				},
			],
		});

		// First sync — resolves to 1.0.0
		const result1 = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
		});
		expect(result1.errors).toHaveLength(0);
		expect(result1.resolved).toHaveLength(1);
		expect(result1.resolved[0].version).toBe("1.0.0");

		// Delete version 1.0.0 from cache
		await rm(join(cacheDir, "artifacts", "opt-skill", "1.0.0"), {
			recursive: true,
			force: true,
		});

		// Second sync — should produce warning, not error
		const result2 = await sync({
			manifestPath,
			cache,
			configBackends: emptyBackends,
		});
		expect(result2.errors).toHaveLength(0);
		expect(result2.warnings.some((w) => w.includes("opt-skill"))).toBe(true);
		expect(result2.resolved).toHaveLength(0);
	});
});
