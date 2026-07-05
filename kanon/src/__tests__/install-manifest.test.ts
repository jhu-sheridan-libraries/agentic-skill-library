import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import {
	exists,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { install } from "../install";
import type { HarnessName } from "../schemas";
import { parseManifest } from "../versioning";

let tempDir: string;
let originalCwd: string;
let consoleErrorSpy: ReturnType<typeof spyOn>;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "install-manifest-"));
	originalCwd = process.cwd();
	process.chdir(tempDir);
	consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
	process.chdir(originalCwd);
	consoleErrorSpy.mockRestore();
	await rm(tempDir, { recursive: true, force: true });
});

async function seedDist(
	harness: HarnessName,
	artifactName: string,
	files: Record<string, string>,
): Promise<void> {
	for (const [relPath, content] of Object.entries(files)) {
		const fullPath = join(tempDir, "dist", harness, artifactName, relPath);
		const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
		await mkdir(dir, { recursive: true });
		await writeFile(fullPath, content, "utf-8");
	}
}

describe("install() version manifest writing", () => {
	test("writes .forge-manifest.json with correct fields after install", async () => {
		await seedDist("kiro", "my-skill", {
			"steering/my-skill.md": "<!-- forge:version 1.2.3 -->\n# My Skill",
			"hooks/lint.kiro.hook": '{"name":"lint"}',
		});

		await install({
			artifactName: "my-skill",
			harness: "kiro",
			force: true,
			source: tempDir,
		});

		const manifestPath = join(tempDir, ".kiro", ".forge-manifest.json");
		expect(await exists(manifestPath)).toBe(true);

		const content = await readFile(manifestPath, "utf-8");
		const manifest = parseManifest(content);

		expect(manifest.artifactName).toBe("my-skill");
		expect(manifest.version).toBe("1.2.3");
		expect(manifest.harnessName).toBe("kiro");
		expect(manifest.files).toContain("steering/my-skill.md");
		expect(manifest.files).toContain("hooks/lint.kiro.hook");
		expect(manifest.installedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	test("extracts version from markdown forge:version comment", async () => {
		await seedDist("cursor", "versioned-skill", {
			".cursor/rules/versioned-skill.md":
				"<!-- forge:version 2.0.1 -->\n# Versioned",
		});

		await install({
			artifactName: "versioned-skill",
			harness: "cursor",
			force: true,
			source: tempDir,
		});

		const manifestPath = join(tempDir, ".forge-manifest.json");
		expect(await exists(manifestPath)).toBe(true);

		const content = await readFile(manifestPath, "utf-8");
		const manifest = parseManifest(content);

		expect(manifest.version).toBe("2.0.1");
	});

	test("uses provided version option over extracted version", async () => {
		await seedDist("kiro", "explicit-ver", {
			"steering/explicit-ver.md": "<!-- forge:version 1.0.0 -->\n# Skill",
		});

		await install({
			artifactName: "explicit-ver",
			harness: "kiro",
			force: true,
			source: tempDir,
			version: "3.5.0",
		});

		const manifestPath = join(tempDir, ".kiro", ".forge-manifest.json");
		const content = await readFile(manifestPath, "utf-8");
		const manifest = parseManifest(content);

		expect(manifest.version).toBe("3.5.0");
	});

	test("defaults to 0.1.0 when no version found", async () => {
		await seedDist("kiro", "no-ver", {
			"steering/no-ver.md": "# No version comment here",
		});

		await install({
			artifactName: "no-ver",
			harness: "kiro",
			force: true,
			source: tempDir,
		});

		const manifestPath = join(tempDir, ".kiro", ".forge-manifest.json");
		const content = await readFile(manifestPath, "utf-8");
		const manifest = parseManifest(content);

		expect(manifest.version).toBe("0.1.0");
	});

	test("uses provided sourcePath in manifest", async () => {
		await seedDist("kiro", "src-path", {
			"steering/src-path.md": "# Content",
		});

		await install({
			artifactName: "src-path",
			harness: "kiro",
			force: true,
			source: tempDir,
			sourcePath: "knowledge/src-path",
		});

		const manifestPath = join(tempDir, ".kiro", ".forge-manifest.json");
		const content = await readFile(manifestPath, "utf-8");
		const manifest = parseManifest(content);

		expect(manifest.sourcePath).toBe("knowledge/src-path");
	});

	test("does not write manifest in dry-run mode", async () => {
		await seedDist("kiro", "dry-run-skill", {
			"steering/dry-run-skill.md": "# Dry run",
		});

		await install({
			artifactName: "dry-run-skill",
			harness: "kiro",
			dryRun: true,
			source: tempDir,
		});

		const manifestPath = join(tempDir, ".kiro", ".forge-manifest.json");
		expect(await exists(manifestPath)).toBe(false);
	});

	test("manifest conforms to VersionManifestSchema", async () => {
		await seedDist("kiro", "schema-test", {
			"steering/schema-test.md": "<!-- forge:version 1.0.0 -->\n# Schema test",
		});

		await install({
			artifactName: "schema-test",
			harness: "kiro",
			force: true,
			source: tempDir,
			sourcePath: "knowledge/schema-test",
		});

		const manifestPath = join(tempDir, ".kiro", ".forge-manifest.json");
		const content = await readFile(manifestPath, "utf-8");

		// parseManifest validates against VersionManifestSchema — should not throw
		const manifest = parseManifest(content);

		expect(manifest).toHaveProperty("artifactName");
		expect(manifest).toHaveProperty("version");
		expect(manifest).toHaveProperty("harnessName");
		expect(manifest).toHaveProperty("sourcePath");
		expect(manifest).toHaveProperty("installedAt");
		expect(manifest).toHaveProperty("files");
		expect(Array.isArray(manifest.files)).toBe(true);
	});
});
