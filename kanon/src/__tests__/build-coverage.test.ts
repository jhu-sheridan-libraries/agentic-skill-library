import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type BuildOptions, build, buildCommand } from "../build";

const TEMPLATES_DIR = resolve(
	import.meta.dir,
	"../../templates/harness-adapters",
);

let tempDir: string;
let consoleErrorSpy: ReturnType<typeof spyOn>;
let processExitSpy: ReturnType<typeof spyOn>;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "build-cov-"));
	consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
	processExitSpy = spyOn(process, "exit").mockImplementation(((
		code?: number,
	) => {
		throw new Error(`process.exit(${code})`);
	}) as typeof process.exit);
});

afterEach(async () => {
	consoleErrorSpy.mockRestore();
	processExitSpy.mockRestore();
	await rm(tempDir, { recursive: true, force: true });
});

function makeBuildOptions(overrides?: Partial<BuildOptions>): BuildOptions {
	return {
		knowledgeDirs: [join(tempDir, "knowledge")],
		distDir: join(tempDir, "dist"),
		templatesDir: TEMPLATES_DIR,
		mcpServersDir: join(tempDir, "mcp-servers"),
		...overrides,
	};
}

describe("build() coverage — error paths", () => {
	test("empty source directory reports 0 artifacts", async () => {
		const opts = makeBuildOptions();
		// Create an empty knowledge dir
		await mkdir(opts.knowledgeDirs?.[0] ?? "", { recursive: true });
		await mkdir(opts.mcpServersDir, { recursive: true });

		const result = await build(opts);

		expect(result.artifactsCompiled).toBe(0);
		expect(result.filesWritten).toBe(0);
		expect(result.errors).toEqual([]);
	});

	test("malformed knowledge.md (invalid YAML frontmatter) reports error and continues", async () => {
		const opts = makeBuildOptions();
		const knowledgeDir = opts.knowledgeDirs?.[0] ?? "";
		await mkdir(knowledgeDir, { recursive: true });
		await mkdir(opts.mcpServersDir, { recursive: true });

		// Create a malformed artifact — frontmatter with invalid field values
		const brokenDir = join(knowledgeDir, "malformed-artifact");
		await mkdir(brokenDir, { recursive: true });
		await writeFile(
			join(brokenDir, "knowledge.md"),
			`---
name: malformed-artifact
type: completely-invalid-type
harnesses: [kiro]
---
Some body content.`,
			"utf-8",
		);

		const result = await build(opts);

		// Should report errors for the malformed artifact
		expect(result.errors.length).toBeGreaterThan(0);
		const errorNames = result.errors.map((e) => e.artifactName);
		expect(errorNames).toContain("malformed-artifact");
	});

	test("non-existent source directory returns 0 artifacts", async () => {
		const opts = makeBuildOptions({
			knowledgeDirs: [join(tempDir, "does-not-exist")],
		});
		await mkdir(opts.mcpServersDir, { recursive: true });

		const result = await build(opts);

		expect(result.artifactsCompiled).toBe(0);
		expect(result.filesWritten).toBe(0);
	});
});

describe("buildCommand() coverage — error paths", () => {
	test("--harness with invalid name calls process.exit(1)", async () => {
		const origCwd = process.cwd();
		process.chdir(tempDir);

		// Create knowledge dir so the "no source dir" check doesn't fire first
		await mkdir(join(tempDir, "knowledge"), { recursive: true });

		try {
			await buildCommand({ harness: "invalid-harness-name" });
		} catch {
			// expected — mock throws to halt execution
		} finally {
			process.chdir(origCwd);
		}

		expect(processExitSpy).toHaveBeenCalledWith(1);

		// Should have logged an error about unknown harness
		const calls = consoleErrorSpy.mock.calls.flat().map(String);
		const unknownMsg = calls.some((msg: string) =>
			msg.includes("Unknown harness"),
		);
		expect(unknownMsg).toBe(true);
	});

	test("no source directories calls process.exit(1)", async () => {
		const origCwd = process.cwd();
		// chdir to temp where neither knowledge/ nor packages/ exist
		process.chdir(tempDir);

		try {
			await buildCommand({});
		} catch {
			// expected — mock throws to halt execution
		} finally {
			process.chdir(origCwd);
		}

		expect(processExitSpy).toHaveBeenCalledWith(1);

		const calls = consoleErrorSpy.mock.calls.flat().map(String);
		const noSourceMsg = calls.some(
			(msg: string) =>
				msg.includes("No knowledge/") || msg.includes("packages/"),
		);
		expect(noSourceMsg).toBe(true);
	});
});
