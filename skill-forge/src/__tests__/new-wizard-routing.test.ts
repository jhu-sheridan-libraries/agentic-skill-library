/**
 * ─── Wizard Integration Tests (mocked wizard) ─────────────────────────────────
 * Validates: Requirement 1.1
 * Tests that `newCommand` correctly routes to runWizard/writeWizardResult
 * based on the --yes flag.
 *
 * Uses spyOn to intercept wizard and file-writer calls without polluting
 * the global module cache via mock.module.
 */
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Mock @clack/prompts to prevent interactive prompts during tests
mock.module("@clack/prompts", () => ({
	intro: () => {},
	outro: () => {},
	cancel: () => {},
	note: () => {},
	text: async () => "",
	select: async () => "",
	multiselect: async () => [],
	confirm: async () => false,
	log: { info: () => {}, step: () => {}, error: () => {}, warning: () => {} },
	isCancel: () => false,
}));

const TEMPLATES_SRC = resolve(import.meta.dir, "../../templates/knowledge");

import * as fileWriterModule from "../file-writer";
import { newCommand } from "../new";
// Import the real modules
import * as wizardModule from "../wizard";

// ─── Track calls ───────────────────────────────────────────────────────────────

let wizardCalls: { artifactName: string; displayName: string }[] = [];
let writerCalls: { artifactDir: string }[] = [];

let tempDir: string;
let originalCwd: string;
let wizardSpy: ReturnType<typeof spyOn>;
let writerSpy: ReturnType<typeof spyOn>;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "new-wizard-routing-"));
	await cp(TEMPLATES_SRC, join(tempDir, "templates", "knowledge"), {
		recursive: true,
	});
	originalCwd = process.cwd();
	process.chdir(tempDir);
	wizardCalls = [];
	writerCalls = [];

	wizardSpy = spyOn(wizardModule, "runWizard").mockImplementation(
		async (artifactName: string, displayName: string) => {
			wizardCalls.push({ artifactName, displayName });
			return {
				frontmatter: {
					name: artifactName,
					displayName,
					version: "0.1.0",
					description: "Wizard description",
					keywords: ["test"],
					author: "Wizard Author",
					type: "skill" as const,
					inclusion: "always" as const,
					categories: [],
					harnesses: ["kiro" as const],
					ecosystem: [],
					depends: [],
					enhances: [],
					maturity: "experimental" as const,
					"model-assumptions": [],
					collections: [],
					"inherit-hooks": false,
				},
				knowledgeBody: "Wizard body content",
				hooks: [],
				mcpServers: [],
			};
		},
	);

	writerSpy = spyOn(fileWriterModule, "writeWizardResult").mockImplementation(
		async (artifactDir: string) => {
			writerCalls.push({ artifactDir });
			return [
				join(artifactDir, "knowledge.md"),
				join(artifactDir, "hooks.yaml"),
				join(artifactDir, "mcp-servers.yaml"),
			];
		},
	);
});

afterEach(async () => {
	wizardSpy.mockRestore();
	writerSpy.mockRestore();
	process.chdir(originalCwd);
	await rm(tempDir, { recursive: true, force: true });
});

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("wizard invocation routing", () => {
	/**
	 * Validates: Requirement 1.1
	 * Without --yes, the wizard is launched after scaffolding.
	 */
	test("no --yes flag launches wizard", async () => {
		await newCommand("wizard-launch-test", {});

		expect(wizardCalls).toHaveLength(1);
		expect(wizardCalls[0].artifactName).toBe("wizard-launch-test");
		expect(wizardCalls[0].displayName).toBe("Wizard Launch Test");
	});

	/**
	 * Validates: Requirement 1.1
	 * Passing yes: false explicitly still launches the wizard.
	 */
	test("yes: false launches wizard", async () => {
		await newCommand("explicit-false-test", { yes: false });

		expect(wizardCalls).toHaveLength(1);
		expect(wizardCalls[0].artifactName).toBe("explicit-false-test");
	});

	/**
	 * Validates: Requirement 1.1
	 * writeWizardResult is called after the wizard completes.
	 */
	test("wizard result is written via writeWizardResult", async () => {
		await newCommand("writer-test", { yes: false });

		expect(writerCalls).toHaveLength(1);
		expect(writerCalls[0].artifactDir).toContain("writer-test");
	});

	/**
	 * Validates: Requirement 1.2
	 * With --yes, neither runWizard nor writeWizardResult is called.
	 */
	test("--yes flag skips wizard entirely", async () => {
		await newCommand("no-wizard-test", { yes: true });

		expect(wizardCalls).toHaveLength(0);
		expect(writerCalls).toHaveLength(0);
	});
});
