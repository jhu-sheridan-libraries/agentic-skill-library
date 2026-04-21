import {
	afterEach,
	beforeEach,
	describe,
	expect,
	spyOn,
	test,
} from "bun:test";
import { exists, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { evalCommand, scaffoldEvals } from "../eval";

let tempDir: string;
let consoleErrorSpy: ReturnType<typeof spyOn>;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "eval-cov-"));
	consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
	consoleErrorSpy.mockRestore();
	await rm(tempDir, { recursive: true, force: true });
});

describe("scaffoldEvals", () => {
	test("creates evals directory and promptfooconfig.yaml", async () => {
		const artifactName = "test-scaffold";
		const evalsDir = join(tempDir, "knowledge", artifactName, "evals");
		const configPath = join(evalsDir, "promptfooconfig.yaml");

		// Temporarily override the working directory so scaffoldEvals writes
		// into our temp dir instead of the real knowledge/ folder.
		const origCwd = process.cwd();
		process.chdir(tempDir);
		try {
			await scaffoldEvals(artifactName);
		} finally {
			process.chdir(origCwd);
		}

		expect(await exists(evalsDir)).toBe(true);
		expect(await exists(configPath)).toBe(true);
	});

	test("config file contains the artifact name", async () => {
		const artifactName = "my-artifact";
		const configPath = join(
			tempDir,
			"knowledge",
			artifactName,
			"evals",
			"promptfooconfig.yaml",
		);

		const origCwd = process.cwd();
		process.chdir(tempDir);
		try {
			await scaffoldEvals(artifactName);
		} finally {
			process.chdir(origCwd);
		}

		const content = await readFile(configPath, "utf-8");
		expect(content).toContain(artifactName);
		expect(content).toContain(`Eval config for ${artifactName}`);
	});

	test("creates the directory recursively", async () => {
		const artifactName = "deep-artifact";
		const evalsDir = join(tempDir, "knowledge", artifactName, "evals");

		// knowledge/ doesn't exist yet — scaffoldEvals should create it recursively
		const origCwd = process.cwd();
		process.chdir(tempDir);
		try {
			await scaffoldEvals(artifactName);
		} finally {
			process.chdir(origCwd);
		}

		expect(await exists(evalsDir)).toBe(true);
	});
});

describe("evalCommand", () => {
	test("--init option calls scaffoldEvals and creates scaffold", async () => {
		const artifactName = "init-artifact";
		const configPath = join(
			tempDir,
			"knowledge",
			artifactName,
			"evals",
			"promptfooconfig.yaml",
		);

		const origCwd = process.cwd();
		process.chdir(tempDir);
		try {
			await evalCommand(undefined, { init: artifactName });
		} finally {
			process.chdir(origCwd);
		}

		expect(await exists(configPath)).toBe(true);
		const content = await readFile(configPath, "utf-8");
		expect(content).toContain(artifactName);
	});

	test("with no configs found returns gracefully without crashing", async () => {
		// Point to an empty temp dir — no knowledge/ or evals/ dirs exist
		const origCwd = process.cwd();
		process.chdir(tempDir);
		try {
			// Should not throw — just prints "No eval configs found." and returns []
			await evalCommand(undefined, {});
		} finally {
			process.chdir(origCwd);
		}

		// Verify it logged the "no configs" message
		const calls = consoleErrorSpy.mock.calls.flat().map(String);
		const noConfigMsg = calls.some((msg) => msg.includes("No eval configs"));
		expect(noConfigMsg).toBe(true);
	});
});
