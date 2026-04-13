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
import { install } from "../install";
import type { HarnessName } from "../schemas";

let tempDir: string;
let originalCwd: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "install-test-"));
	originalCwd = process.cwd();
	process.chdir(tempDir);
});

afterEach(async () => {
	process.chdir(originalCwd);
	await rm(tempDir, { recursive: true, force: true });
});

/**
 * Helper: create a fake dist directory with pre-built artifact files
 * for the given harness(es).
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

describe("Install module", () => {
	/**
	 * Validates: Requirements 15.1, 15.2, 15.4
	 * Single harness install copies compiled output from dist/<harness>/<artifact>/
	 * into the current working directory at the harness's expected paths,
	 * creating missing directories as needed.
	 */
	test("single harness install copies correct files", async () => {
		await seedDist("kiro", "my-skill", {
			"steering/my-skill.md": "# My Skill steering",
			"hooks/lint.kiro.hook": '{"name":"lint"}',
		});

		await install({
			artifactName: "my-skill",
			harness: "kiro",
			force: true,
			source: tempDir,
		});

		// Kiro installs to .kiro/ prefix
		const steeringContent = await readFile(
			join(tempDir, ".kiro", "steering", "my-skill.md"),
			"utf-8",
		);
		expect(steeringContent).toBe("# My Skill steering");

		const hookContent = await readFile(
			join(tempDir, ".kiro", "hooks", "lint.kiro.hook"),
			"utf-8",
		);
		expect(hookContent).toBe('{"name":"lint"}');
	});

	/**
	 * Validates: Requirements 16.1, 16.2, 16.4
	 * --all installs for every built harness, creating directories as needed,
	 * and prints a summary grouped by harness.
	 */
	test("--all installs for every built harness", async () => {
		// Seed dist for two harnesses
		await seedDist("kiro", "my-skill", {
			"steering/my-skill.md": "# Kiro steering",
		});
		await seedDist("cursor", "my-skill", {
			".cursor/rules/my-skill.md": "# Cursor rule",
		});

		await install({
			artifactName: "my-skill",
			all: true,
			force: true,
			source: tempDir,
		});

		// Kiro files installed
		expect(
			await exists(join(tempDir, ".kiro", "steering", "my-skill.md")),
		).toBe(true);

		// Cursor files installed (cursor installs to "." prefix)
		expect(await exists(join(tempDir, ".cursor", "rules", "my-skill.md"))).toBe(
			true,
		);
	});

	/**
	 * Validates: Requirements 15.1, 15.4
	 * --dry-run produces a plan without actually writing files.
	 */
	test("--dry-run produces plan without writing files", async () => {
		await seedDist("kiro", "my-skill", {
			"steering/my-skill.md": "# Steering content",
			"hooks/lint.kiro.hook": '{"name":"lint"}',
		});

		await install({
			artifactName: "my-skill",
			harness: "kiro",
			dryRun: true,
			source: tempDir,
		});

		// Files should NOT have been written
		expect(
			await exists(join(tempDir, ".kiro", "steering", "my-skill.md")),
		).toBe(false);
		expect(
			await exists(join(tempDir, ".kiro", "hooks", "lint.kiro.hook")),
		).toBe(false);
	});

	/**
	 * Validates: Requirement 15.5
	 * Error when artifact not built — should exit with error suggesting
	 * the user run `forge build`.
	 */
	test("error when artifact not built", async () => {
		// Don't seed any dist — artifact doesn't exist
		const originalExit = process.exit;
		let exitCode: number | undefined;
		process.exit = ((code?: number) => {
			exitCode = code;
			throw new Error(`process.exit(${code})`);
		}) as never;

		try {
			await install({
				artifactName: "nonexistent-skill",
				harness: "kiro",
				source: tempDir,
			});
		} catch (e: unknown) {
			expect((e as Error).message).toBe("process.exit(1)");
		} finally {
			process.exit = originalExit;
		}

		expect(exitCode).toBe(1);
	});
});
