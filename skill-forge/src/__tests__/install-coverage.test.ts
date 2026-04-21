import {
	afterEach,
	beforeEach,
	describe,
	expect,
	spyOn,
	test,
} from "bun:test";
import { exists, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { install } from "../install";
import type { HarnessName } from "../schemas";

let tempDir: string;
let originalCwd: string;
let consoleErrorSpy: ReturnType<typeof spyOn>;
let processExitSpy: ReturnType<typeof spyOn>;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "install-cov-"));
	originalCwd = process.cwd();
	process.chdir(tempDir);
	consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
	processExitSpy = spyOn(process, "exit").mockImplementation(((
		code?: number,
	) => {
		throw new Error(`process.exit(${code})`);
	}) as typeof process.exit);
});

afterEach(async () => {
	process.chdir(originalCwd);
	consoleErrorSpy.mockRestore();
	processExitSpy.mockRestore();
	await rm(tempDir, { recursive: true, force: true });
});

/** Seed a fake dist directory with files for a given harness + artifact. */
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

describe("install() coverage", () => {
	test("--dry-run lists files without writing them", async () => {
		await seedDist("kiro", "test-artifact", {
			"steering/test-artifact.md": "# Test steering",
		});

		await install({
			artifactName: "test-artifact",
			harness: "kiro",
			dryRun: true,
			source: tempDir,
		});

		// The destination file should NOT exist
		expect(
			await exists(join(tempDir, ".kiro", "steering", "test-artifact.md")),
		).toBe(false);

		// Console output should mention dry-run
		const calls = consoleErrorSpy.mock.calls.flat().map(String);
		const dryRunMsg = calls.some((msg) => msg.includes("dry-run"));
		expect(dryRunMsg).toBe(true);
	});

	test("error when artifact not built calls process.exit(1)", async () => {
		// No dist seeded — artifact doesn't exist
		try {
			await install({
				artifactName: "nonexistent-artifact",
				harness: "kiro",
				source: tempDir,
			});
		} catch {
			// expected — mock throws to halt execution
		}

		expect(processExitSpy).toHaveBeenCalledWith(1);
	});

	test("--all installs for all built harnesses", async () => {
		await seedDist("kiro", "multi-artifact", {
			"steering/multi-artifact.md": "# Kiro steering",
		});
		await seedDist("cursor", "multi-artifact", {
			".cursor/rules/multi-artifact.md": "# Cursor rule",
		});

		await install({
			artifactName: "multi-artifact",
			all: true,
			force: true,
			source: tempDir,
		});

		// Kiro files installed under .kiro/
		expect(
			await exists(join(tempDir, ".kiro", "steering", "multi-artifact.md")),
		).toBe(true);

		// Cursor files installed under ./ (cursor install path is ".")
		expect(
			await exists(join(tempDir, ".cursor", "rules", "multi-artifact.md")),
		).toBe(true);
	});

	test("--force overwrites existing files", async () => {
		await seedDist("kiro", "force-artifact", {
			"steering/force-artifact.md": "# Updated content",
		});

		// Pre-create the destination file with old content
		const destPath = join(tempDir, ".kiro", "steering", "force-artifact.md");
		await mkdir(join(tempDir, ".kiro", "steering"), { recursive: true });
		await writeFile(destPath, "# Old content", "utf-8");

		await install({
			artifactName: "force-artifact",
			harness: "kiro",
			force: true,
			source: tempDir,
		});

		const content = await readFile(destPath, "utf-8");
		expect(content).toBe("# Updated content");
	});

	test("without --force skips existing files", async () => {
		await seedDist("kiro", "skip-artifact", {
			"steering/skip-artifact.md": "# New content",
		});

		// Pre-create the destination file
		const destPath = join(tempDir, ".kiro", "steering", "skip-artifact.md");
		await mkdir(join(tempDir, ".kiro", "steering"), { recursive: true });
		await writeFile(destPath, "# Existing content", "utf-8");

		await install({
			artifactName: "skip-artifact",
			harness: "kiro",
			source: tempDir,
		});

		// File should still have the old content
		const content = await readFile(destPath, "utf-8");
		expect(content).toBe("# Existing content");

		// Should have logged a skip message
		const calls = consoleErrorSpy.mock.calls.flat().map(String);
		const skipMsg = calls.some((msg) => msg.includes("Skipping"));
		expect(skipMsg).toBe(true);
	});

	test("missing artifact name calls process.exit(1)", async () => {
		try {
			await install({
				harness: "kiro",
				source: tempDir,
			});
		} catch {
			// expected — mock throws to halt execution
		}

		expect(processExitSpy).toHaveBeenCalledWith(1);
	});

	test("no --harness and no --all calls process.exit(1)", async () => {
		try {
			await install({
				artifactName: "some-artifact",
				source: tempDir,
			});
		} catch {
			// expected — mock throws to halt execution
		}

		expect(processExitSpy).toHaveBeenCalledWith(1);
	});
});
