import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	detectHarnessFiles,
	HARNESS_NATIVE_PATHS,
	importerRegistry,
} from "../importers/index";
import { SUPPORTED_HARNESSES } from "../schemas";

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "importers-test-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

describe("HARNESS_NATIVE_PATHS", () => {
	test("has entries for all 7 supported harnesses", () => {
		for (const harness of SUPPORTED_HARNESSES) {
			expect(HARNESS_NATIVE_PATHS[harness]).toBeDefined();
			expect(HARNESS_NATIVE_PATHS[harness].length).toBeGreaterThan(0);
		}
	});

	test("all paths are non-empty strings", () => {
		for (const harness of SUPPORTED_HARNESSES) {
			for (const path of HARNESS_NATIVE_PATHS[harness]) {
				expect(typeof path).toBe("string");
				expect(path.length).toBeGreaterThan(0);
			}
		}
	});
});

describe("importerRegistry", () => {
	test("has entries for all 7 supported harnesses", () => {
		for (const harness of SUPPORTED_HARNESSES) {
			expect(importerRegistry[harness]).toBeDefined();
			expect(importerRegistry[harness].nativePaths).toBeDefined();
			expect(typeof importerRegistry[harness].parse).toBe("function");
		}
	});

	test("nativePaths match HARNESS_NATIVE_PATHS", () => {
		for (const harness of SUPPORTED_HARNESSES) {
			expect(importerRegistry[harness].nativePaths).toEqual(
				HARNESS_NATIVE_PATHS[harness],
			);
		}
	});

	test("parsers are callable functions (not stubs)", async () => {
		for (const harness of SUPPORTED_HARNESSES) {
			const parser = importerRegistry[harness].parse;
			expect(typeof parser).toBe("function");
			// Real parsers will throw file-not-found errors (not "not yet implemented")
			await expect(parser("/fake/path")).rejects.not.toThrow(
				"not yet implemented",
			);
		}
	});
});

describe("detectHarnessFiles", () => {
	test("returns empty arrays when no harness files exist", async () => {
		const result = await detectHarnessFiles(tempDir);
		for (const harness of SUPPORTED_HARNESSES) {
			expect(result[harness]).toEqual([]);
		}
	});

	test("detects CLAUDE.md for claude-code", async () => {
		await writeFile(join(tempDir, "CLAUDE.md"), "# Claude instructions");
		const result = await detectHarnessFiles(tempDir);
		expect(result["claude-code"]).toContain("CLAUDE.md");
	});

	test("detects .cursorrules for cursor", async () => {
		await writeFile(join(tempDir, ".cursorrules"), "# Cursor rules");
		const result = await detectHarnessFiles(tempDir);
		expect(result.cursor).toContain(".cursorrules");
	});

	test("detects .windsurfrules for windsurf", async () => {
		await writeFile(join(tempDir, ".windsurfrules"), "# Windsurf rules");
		const result = await detectHarnessFiles(tempDir);
		expect(result.windsurf).toContain(".windsurfrules");
	});

	test("detects .cursor/rules/*.md for cursor", async () => {
		await mkdir(join(tempDir, ".cursor", "rules"), { recursive: true });
		await writeFile(join(tempDir, ".cursor", "rules", "my-rule.md"), "# Rule");
		const result = await detectHarnessFiles(tempDir);
		expect(result.cursor).toContain(".cursor/rules/my-rule.md");
	});

	test("detects .kiro/steering/*.md for kiro", async () => {
		await mkdir(join(tempDir, ".kiro", "steering"), { recursive: true });
		await writeFile(join(tempDir, ".kiro", "steering", "guide.md"), "# Guide");
		const result = await detectHarnessFiles(tempDir);
		expect(result.kiro).toContain(".kiro/steering/guide.md");
	});

	test("detects .github/copilot-instructions.md for copilot", async () => {
		await mkdir(join(tempDir, ".github"), { recursive: true });
		await writeFile(
			join(tempDir, ".github", "copilot-instructions.md"),
			"# Copilot",
		);
		const result = await detectHarnessFiles(tempDir);
		expect(result.copilot).toContain(".github/copilot-instructions.md");
	});

	test("detects .clinerules/*.md for cline", async () => {
		await mkdir(join(tempDir, ".clinerules"), { recursive: true });
		await writeFile(join(tempDir, ".clinerules", "rule.md"), "# Rule");
		const result = await detectHarnessFiles(tempDir);
		expect(result.cline).toContain(".clinerules/rule.md");
	});

	test("detects .q/rules/*.md for qdeveloper", async () => {
		await mkdir(join(tempDir, ".q", "rules"), { recursive: true });
		await writeFile(join(tempDir, ".q", "rules", "rule.md"), "# Rule");
		const result = await detectHarnessFiles(tempDir);
		expect(result.qdeveloper).toContain(".q/rules/rule.md");
	});

	test("detects .amazonq/rules/*.md for qdeveloper", async () => {
		await mkdir(join(tempDir, ".amazonq", "rules"), { recursive: true });
		await writeFile(join(tempDir, ".amazonq", "rules", "rule.md"), "# Rule");
		const result = await detectHarnessFiles(tempDir);
		expect(result.qdeveloper).toContain(".amazonq/rules/rule.md");
	});

	test("detects .windsurf/rules/*.md for windsurf", async () => {
		await mkdir(join(tempDir, ".windsurf", "rules"), { recursive: true });
		await writeFile(
			join(tempDir, ".windsurf", "rules", "my-rule.md"),
			"# Rule",
		);
		const result = await detectHarnessFiles(tempDir);
		expect(result.windsurf).toContain(".windsurf/rules/my-rule.md");
	});

	test("detects .claude/settings.json for claude-code", async () => {
		await mkdir(join(tempDir, ".claude"), { recursive: true });
		await writeFile(
			join(tempDir, ".claude", "settings.json"),
			'{"commands": []}',
		);
		const result = await detectHarnessFiles(tempDir);
		expect(result["claude-code"]).toContain(".claude/settings.json");
	});

	test("detects multiple files across harnesses", async () => {
		// Set up files for multiple harnesses
		await writeFile(join(tempDir, "CLAUDE.md"), "# Claude");
		await writeFile(join(tempDir, ".cursorrules"), "# Cursor");
		await writeFile(join(tempDir, ".windsurfrules"), "# Windsurf");
		await mkdir(join(tempDir, ".clinerules"), { recursive: true });
		await writeFile(join(tempDir, ".clinerules", "rule.md"), "# Cline");

		const result = await detectHarnessFiles(tempDir);
		expect(result["claude-code"].length).toBe(1);
		expect(result.cursor.length).toBe(1);
		expect(result.windsurf.length).toBe(1);
		expect(result.cline.length).toBe(1);
	});

	test("detects .github/instructions/*.instructions.md for copilot", async () => {
		await mkdir(join(tempDir, ".github", "instructions"), { recursive: true });
		await writeFile(
			join(tempDir, ".github", "instructions", "coding.instructions.md"),
			"# Coding",
		);
		const result = await detectHarnessFiles(tempDir);
		expect(result.copilot).toContain(
			".github/instructions/coding.instructions.md",
		);
	});

	test("does not match non-matching files", async () => {
		// A .md file in .cursor/rules/ should match, but a .txt should not
		await mkdir(join(tempDir, ".cursor", "rules"), { recursive: true });
		await writeFile(
			join(tempDir, ".cursor", "rules", "notes.txt"),
			"not a rule",
		);
		const result = await detectHarnessFiles(tempDir);
		expect(result.cursor).not.toContain(".cursor/rules/notes.txt");
	});
});
