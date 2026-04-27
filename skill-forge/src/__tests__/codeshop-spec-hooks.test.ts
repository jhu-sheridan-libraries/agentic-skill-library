import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import yaml from "js-yaml";

/**
 * Example-based unit tests for the 6 codeshop spec-hooks and knowledge.md content.
 *
 * Validates: Requirements 1.1–1.4, 2.1–2.4, 3.1–3.4, 4.1–4.4, 5.1–5.4,
 *            6.1–6.4, 7.1–7.5, 8.1–8.4, 11.1–11.3
 */

const SKILL_FORGE_ROOT = path.resolve(import.meta.dir, "../..");
const KNOWLEDGE_DIR = path.join(SKILL_FORGE_ROOT, "knowledge", "codeshop");
const KNOWLEDGE_MD = path.join(KNOWLEDGE_DIR, "knowledge.md");
const HOOKS_YAML = path.join(KNOWLEDGE_DIR, "hooks.yaml");

// --- Parse source artifacts once ---

const knowledgeRaw = fs.readFileSync(KNOWLEDGE_MD, "utf-8");
const { data: frontmatter } = matter(knowledgeRaw);
const specHooks: Array<{
	name: string;
	version: string;
	description: string;
	when: { type: string };
	then: { type: string; prompt: string };
}> = frontmatter["harness-config"]?.kiro?.["spec-hooks"] ?? [];

const canonicalHooks = yaml.load(
	fs.readFileSync(HOOKS_YAML, "utf-8"),
) as Array<{ name: string; event: string }>;

// --- Expected hook metadata (precedence order from design) ---

const EXPECTED_HOOKS = [
	{
		name: "Plan Stress Test",
		eventType: "preTaskExecution",
		steeringFile: "stress-test-plan",
	},
	{
		name: "Bugfix Triage Context",
		eventType: "preTaskExecution",
		steeringFile: "triage-bug",
	},
	{
		name: "Domain Concept Validation",
		eventType: "preTaskExecution",
		steeringFile: "challenge-domain-model",
	},
	{
		name: "TDD Task Detection",
		eventType: "preTaskExecution",
		steeringFile: "drive-tests",
	},
	{
		name: "Post-Task Code Review",
		eventType: "postTaskExecution",
		steeringFile: "review-changes",
	},
	{
		name: "Post-Task Commit Guidance",
		eventType: "postTaskExecution",
		steeringFile: "craft-commits",
	},
];

const EXPECTED_CANONICAL_HOOKS = [
	"Map Context",
	"Define Glossary",
	"Challenge Domain Model",
	"Architectural Change Detection",
	"Unfiled Issue Reminder",
	"Domain Context File Guidance",
	"ADR File Guidance",
	"Glossary File Guidance",
];

// Helper: find a spec-hook by name
function findHook(name: string) {
	return specHooks.find((h) => h.name === name);
}

describe("codeshop spec-hooks — example-based tests", () => {
	// ── Cardinality ────────────────────────────────────────────────────
	test("spec-hooks array has exactly 6 entries", () => {
		expect(specHooks.length).toBe(6);
	});

	// ── Event types ────────────────────────────────────────────────────
	describe("each spec-hook has the correct event type", () => {
		for (const expected of EXPECTED_HOOKS) {
			test(`${expected.name} → ${expected.eventType}`, () => {
				const hook = findHook(expected.name);
				expect(hook).toBeDefined();
				expect(hook!.when.type).toBe(expected.eventType);
			});
		}
	});

	// ── Steering file references ───────────────────────────────────────
	describe("each spec-hook references the correct steering file", () => {
		for (const expected of EXPECTED_HOOKS) {
			test(`${expected.name} prompt references ${expected.steeringFile}`, () => {
				const hook = findHook(expected.name);
				expect(hook).toBeDefined();
				expect(hook!.then.prompt).toContain(expected.steeringFile);
			});
		}
	});

	// ── Match / no-match branches (pre-task hooks only) ────────────────
	describe("each pre-task hook prompt contains match and no-match branches", () => {
		const preTaskHooks = EXPECTED_HOOKS.filter(
			(h) => h.eventType === "preTaskExecution",
		);

		for (const expected of preTaskHooks) {
			test(`${expected.name} has conditional branches`, () => {
				const hook = findHook(expected.name);
				expect(hook).toBeDefined();
				const prompt = hook!.then.prompt;

				// Match branch: "If the task matches" or "If the task is the first task"
				const hasMatchBranch =
					/if the task (matches|is the first)/i.test(prompt);
				expect(hasMatchBranch).toBe(true);

				// No-match branch: "If the task does not match" or "If the task is not the first"
				const hasNoMatchBranch =
					/if the task (does not match|is not the first)/i.test(prompt);
				expect(hasNoMatchBranch).toBe(true);
			});
		}
	});

	// ── Either/or directive ────────────────────────────────────────────
	describe("each hook prompt ends with a concrete either/or directive", () => {
		const preTaskHooks = EXPECTED_HOOKS.filter(
			(h) => h.eventType === "preTaskExecution",
		);
		const postTaskHooks = EXPECTED_HOOKS.filter(
			(h) => h.eventType === "postTaskExecution",
		);

		for (const expected of preTaskHooks) {
			test(`${expected.name} (pre-task) contains an either/or directive`, () => {
				const hook = findHook(expected.name);
				expect(hook).toBeDefined();
				const prompt = hook!.then.prompt;

				// Pre-task hooks have conditional logic and use "Either ... or ..."
				expect(prompt.toLowerCase()).toContain("either");
			});
		}

		for (const expected of postTaskHooks) {
			test(`${expected.name} (post-task) ends with a concrete directive`, () => {
				const hook = findHook(expected.name);
				expect(hook).toBeDefined();
				const prompt = hook!.then.prompt.trim();

				// Post-task hooks are unconditional — they end with a direct
				// imperative like "Load the X workflow and confirm/present..."
				// Extract the last line/paragraph as the closing directive
				const lastParagraph = prompt.split("\n\n").pop()!.trim();
				expect(lastParagraph.length).toBeGreaterThan(0);
				// The closing directive should reference the steering file
				expect(lastParagraph.toLowerCase()).toContain(expected.steeringFile);
			});
		}
	});

	// ── Canonical hooks in hooks.yaml are unchanged ────────────────────
	describe("canonical hooks in hooks.yaml are preserved", () => {
		test("hooks.yaml has exactly 8 canonical hooks", () => {
			expect(canonicalHooks.length).toBe(8);
		});

		test("all 8 canonical hook names are present", () => {
			const names = canonicalHooks.map((h) => h.name);
			for (const expected of EXPECTED_CANONICAL_HOOKS) {
				expect(names).toContain(expected);
			}
		});
	});
});

// ────────────────────────────────────────────────────────────────────────
// Integration test: full build pipeline
// Validates: Requirements 12.1, 12.2, 12.3, 12.4
// ────────────────────────────────────────────────────────────────────────

/** Convert a hook name to the kebab-case filename the adapter produces. */
function toHookFilename(name: string): string {
	return `${name.toLowerCase().replace(/\s+/g, "-")}.kiro.hook`;
}

describe("codeshop spec-hooks — build pipeline integration", () => {
	const DIST_CODESHOP = path.join(SKILL_FORGE_ROOT, "dist", "kiro", "codeshop");

	// Derive expected canonical hook filenames from hooks.yaml
	const expectedCanonicalFiles = canonicalHooks.map((h) =>
		toHookFilename(h.name),
	);

	// Derive expected spec-hook filenames from knowledge.md frontmatter
	const expectedSpecFiles = specHooks.map((h) => toHookFilename(h.name));

	const expectedAllFiles = [...expectedCanonicalFiles, ...expectedSpecFiles];

	// Run the build once before all tests in this describe block
	let buildRan = false;
	let buildError: string | null = null;

	function ensureBuild() {
		if (buildRan) return;
		buildRan = true;
		const result = Bun.spawnSync(["bun", "run", "dev", "build", "--harness", "kiro"], {
			cwd: SKILL_FORGE_ROOT,
			stdout: "pipe",
			stderr: "pipe",
		});
		if (result.exitCode !== 0) {
			buildError = result.stderr.toString();
		}
	}

	test("build completes successfully", () => {
		ensureBuild();
		expect(buildError).toBeNull();
	});

	test(`dist/kiro/codeshop/ contains all ${expectedAllFiles.length} hook files (${expectedCanonicalFiles.length} canonical + ${expectedSpecFiles.length} spec)`, () => {
		ensureBuild();
		const files = fs.readdirSync(DIST_CODESHOP).filter((f) =>
			f.endsWith(".kiro.hook"),
		);
		const fileSet = new Set(files);

		// Verify every expected file is present
		for (const expected of expectedAllFiles) {
			expect(fileSet.has(expected)).toBe(true);
		}

		// Verify total count matches
		expect(files.length).toBe(expectedAllFiles.length);
	});

	test("each .kiro.hook file contains valid JSON", () => {
		ensureBuild();
		const hookFiles = fs.readdirSync(DIST_CODESHOP).filter((f) =>
			f.endsWith(".kiro.hook"),
		);

		for (const file of hookFiles) {
			const content = fs.readFileSync(path.join(DIST_CODESHOP, file), "utf-8");
			expect(() => JSON.parse(content)).not.toThrow();
		}
	});
});
