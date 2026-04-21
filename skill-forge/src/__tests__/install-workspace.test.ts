import { afterEach, beforeEach, describe, expect, test } from "bun:test";
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
import yaml from "js-yaml";
import type { HarnessName, WorkspaceConfig } from "../schemas";

let tempDir: string;
let originalCwd: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "install-ws-test-"));
	originalCwd = process.cwd();
	process.chdir(tempDir);
});

afterEach(async () => {
	process.chdir(originalCwd);
	await rm(tempDir, { recursive: true, force: true });
});

/**
 * Helper: create a fake dist directory with pre-built artifact files.
 */
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

/**
 * Helper: write a workspace config YAML file.
 */
async function writeWorkspaceConfig(config: WorkspaceConfig): Promise<void> {
	const yamlStr = yaml.dump(config, { indent: 2, lineWidth: -1, noRefs: true });
	await writeFile(join(tempDir, "forge.config.yaml"), yamlStr, "utf-8");
}

describe("Workspace-aware install", () => {
	/**
	 * Validates: Requirements 17.1, 17.2, 17.5
	 * When workspace config is present, install into each project's root directory
	 * and write per-project version manifests.
	 */
	test("installs into each project root with version manifests", async () => {
		// Create project directories
		await mkdir(join(tempDir, "packages/api"), { recursive: true });
		await mkdir(join(tempDir, "packages/web"), { recursive: true });

		// Create knowledge source dir (required by workspace config validation)
		await mkdir(join(tempDir, "knowledge"), { recursive: true });

		// Write workspace config
		await writeWorkspaceConfig({
			knowledgeSources: ["knowledge"],
			projects: [
				{ name: "api", root: "packages/api", harnesses: ["kiro"] },
				{ name: "web", root: "packages/web", harnesses: ["cursor"] },
			],
		});

		// Seed dist for both harnesses
		await seedDist("kiro", "my-skill", {
			"steering/my-skill.md": "<!-- forge:version 1.2.3 -->\n# Kiro steering",
		});
		await seedDist("cursor", "my-skill", {
			".cursor/rules/my-skill.md":
				"<!-- forge:version 1.2.3 -->\n# Cursor rule",
		});

		// Import and call installCommand
		const { installCommand } = await import("../install");
		await installCommand("my-skill", { force: true });

		// Verify kiro files installed in api project
		const kiroFile = join(tempDir, "packages/api/.kiro/steering/my-skill.md");
		expect(await exists(kiroFile)).toBe(true);
		const kiroContent = await readFile(kiroFile, "utf-8");
		expect(kiroContent).toContain("# Kiro steering");

		// Verify cursor files installed in web project
		const cursorFile = join(tempDir, "packages/web/.cursor/rules/my-skill.md");
		expect(await exists(cursorFile)).toBe(true);
		const cursorContent = await readFile(cursorFile, "utf-8");
		expect(cursorContent).toContain("# Cursor rule");

		// Verify version manifests written per project
		const kiroManifest = join(
			tempDir,
			"packages/api/.kiro/.forge-manifest.json",
		);
		expect(await exists(kiroManifest)).toBe(true);
		const kiroManifestData = JSON.parse(await readFile(kiroManifest, "utf-8"));
		expect(kiroManifestData.artifactName).toBe("my-skill");
		expect(kiroManifestData.version).toBe("1.2.3");
		expect(kiroManifestData.harnessName).toBe("kiro");

		const cursorManifest = join(tempDir, "packages/web/.forge-manifest.json");
		expect(await exists(cursorManifest)).toBe(true);
		const cursorManifestData = JSON.parse(
			await readFile(cursorManifest, "utf-8"),
		);
		expect(cursorManifestData.artifactName).toBe("my-skill");
		expect(cursorManifestData.harnessName).toBe("cursor");
	});

	/**
	 * Validates: Requirement 17.3
	 * --project flag installs only for the specified project.
	 */
	test("--project flag installs only for specified project", async () => {
		await mkdir(join(tempDir, "packages/api"), { recursive: true });
		await mkdir(join(tempDir, "packages/web"), { recursive: true });
		await mkdir(join(tempDir, "knowledge"), { recursive: true });

		await writeWorkspaceConfig({
			knowledgeSources: ["knowledge"],
			projects: [
				{ name: "api", root: "packages/api", harnesses: ["kiro"] },
				{ name: "web", root: "packages/web", harnesses: ["kiro"] },
			],
		});

		await seedDist("kiro", "my-skill", {
			"steering/my-skill.md": "# Kiro steering",
		});

		const { installCommand } = await import("../install");
		await installCommand("my-skill", { project: "api", force: true });

		// API project should have the file
		expect(
			await exists(join(tempDir, "packages/api/.kiro/steering/my-skill.md")),
		).toBe(true);

		// Web project should NOT have the file
		expect(
			await exists(join(tempDir, "packages/web/.kiro/steering/my-skill.md")),
		).toBe(false);
	});

	/**
	 * Validates: Requirement 17.4
	 * Without --project, installs for all projects (summary tested via no errors).
	 */
	test("without --project installs for all projects", async () => {
		await mkdir(join(tempDir, "packages/api"), { recursive: true });
		await mkdir(join(tempDir, "packages/web"), { recursive: true });
		await mkdir(join(tempDir, "knowledge"), { recursive: true });

		await writeWorkspaceConfig({
			knowledgeSources: ["knowledge"],
			projects: [
				{ name: "api", root: "packages/api", harnesses: ["kiro"] },
				{ name: "web", root: "packages/web", harnesses: ["kiro"] },
			],
		});

		await seedDist("kiro", "my-skill", {
			"steering/my-skill.md": "# Kiro steering",
		});

		const { installCommand } = await import("../install");
		await installCommand("my-skill", { force: true });

		// Both projects should have the file
		expect(
			await exists(join(tempDir, "packages/api/.kiro/steering/my-skill.md")),
		).toBe(true);
		expect(
			await exists(join(tempDir, "packages/web/.kiro/steering/my-skill.md")),
		).toBe(true);
	});

	/**
	 * Validates: Requirement 17.3
	 * --project with unknown name produces an error.
	 */
	test("--project with unknown name errors", async () => {
		await mkdir(join(tempDir, "packages/api"), { recursive: true });
		await mkdir(join(tempDir, "knowledge"), { recursive: true });

		await writeWorkspaceConfig({
			knowledgeSources: ["knowledge"],
			projects: [{ name: "api", root: "packages/api", harnesses: ["kiro"] }],
		});

		await seedDist("kiro", "my-skill", {
			"steering/my-skill.md": "# Kiro steering",
		});

		const { installCommand } = await import("../install");
		const originalExit = process.exit;
		let exitCode: number | undefined;
		process.exit = ((code?: number) => {
			exitCode = code;
			throw new Error(`process.exit(${code})`);
		}) as never;

		try {
			await installCommand("my-skill", { project: "nonexistent", force: true });
		} catch (e: unknown) {
			expect((e as Error).message).toBe("process.exit(1)");
		} finally {
			process.exit = originalExit;
		}

		expect(exitCode).toBe(1);
	});

	/**
	 * Validates: Requirement 17.1
	 * Artifact include/exclude filters are respected per project.
	 */
	test("respects project artifact include/exclude filters", async () => {
		await mkdir(join(tempDir, "packages/api"), { recursive: true });
		await mkdir(join(tempDir, "packages/web"), { recursive: true });
		await mkdir(join(tempDir, "knowledge"), { recursive: true });

		await writeWorkspaceConfig({
			knowledgeSources: ["knowledge"],
			projects: [
				{
					name: "api",
					root: "packages/api",
					harnesses: ["kiro"],
					artifacts: { include: ["my-skill"] },
				},
				{
					name: "web",
					root: "packages/web",
					harnesses: ["kiro"],
					artifacts: { exclude: ["my-skill"] },
				},
			],
		});

		await seedDist("kiro", "my-skill", {
			"steering/my-skill.md": "# Kiro steering",
		});

		const { installCommand } = await import("../install");
		await installCommand("my-skill", { force: true });

		// API includes my-skill
		expect(
			await exists(join(tempDir, "packages/api/.kiro/steering/my-skill.md")),
		).toBe(true);

		// Web excludes my-skill
		expect(
			await exists(join(tempDir, "packages/web/.kiro/steering/my-skill.md")),
		).toBe(false);
	});
});
