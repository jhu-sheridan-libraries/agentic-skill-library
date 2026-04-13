import { beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import fc from "fast-check";

// ─── Mock @clack/prompts ───────────────────────────────────────────────────────

/** Captured log.step calls for Property 11 verification. */
let logStepCalls: string[] = [];
/** Captured log.info calls for unit test verification. */
let logInfoCalls: string[] = [];
/** Captured note calls for unit test verification. */
let noteCalls: { message: string; title?: string }[] = [];
/** Queue of return values for prompt calls (confirm, text), consumed in order. */
let promptQueue: unknown[] = [];

function dequeue(fn: string) {
	if (promptQueue.length === 0) return fn === "confirm" ? false : "";
	return promptQueue.shift();
}

mock.module("@clack/prompts", () => ({
	intro: () => {},
	outro: () => {},
	text: async () => dequeue("text"),
	select: async () => dequeue("select"),
	multiselect: async () => dequeue("multiselect"),
	confirm: async () => dequeue("confirm"),
	cancel: () => {},
	note: (message: string, title?: string) => {
		noteCalls.push({ message, title });
	},
	log: {
		info: (msg: string) => {
			logInfoCalls.push(msg);
		},
		step: (msg: string) => {
			logStepCalls.push(msg);
		},
		error: () => {},
		warning: () => {},
	},
	isCancel: (value: unknown) => value === Symbol.for("cancel"),
}));

// Import AFTER mocking
const {
	buildTutorialSteps,
	showProgress,
	resolveArtifactName,
	showWelcome,
	showCompletion,
	TUTORIAL_DEFAULTS,
} = await import("../tutorial");

// ─── Arbitraries ───────────────────────────────────────────────────────────────

/** Artifact name: non-empty, no path separators, no null bytes, trimmed. */
const artifactNameArb = fc
	.string({ minLength: 1, maxLength: 40 })
	.filter(
		(s) =>
			s.trim().length > 0 &&
			!s.includes("\0") &&
			!s.includes("/") &&
			!s.includes("\\") &&
			s.trim() === s,
	);

// ─── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
	logStepCalls = [];
	logInfoCalls = [];
	noteCalls = [];
	promptQueue = [];
});

// ─── Property Tests ────────────────────────────────────────────────────────────

describe("Tutorial property tests", () => {
	/**
	 * Feature: interactive-new-command
	 * Property 10: Tutorial step sequence is complete and ordered
	 *
	 * **Validates: Requirements 10.1, 11.1**
	 *
	 * For any artifact name, buildTutorialSteps SHALL return an array where
	 * every step has a non-empty title and non-empty explanation, the array
	 * length equals the expected total number of steps (7), and no two steps
	 * share the same title.
	 */
	test("Property 10: Tutorial step sequence is complete and ordered", () => {
		fc.assert(
			fc.property(artifactNameArb, (name) => {
				const steps = buildTutorialSteps(name);

				// Array length equals expected total (7 steps)
				expect(steps.length).toBe(7);

				// Every step has a non-empty title and non-empty explanation
				for (const step of steps) {
					expect(step.title.trim().length).toBeGreaterThan(0);
					expect(step.explanation.trim().length).toBeGreaterThan(0);
				}

				// No two steps share the same title
				const titles = steps.map((s) => s.title);
				const uniqueTitles = new Set(titles);
				expect(uniqueTitles.size).toBe(titles.length);
			}),
			{ numRuns: 100 },
		);
	});

	/**
	 * Feature: interactive-new-command
	 * Property 11: Tutorial progress indicator is bounded
	 *
	 * **Validates: Requirement 11.1**
	 *
	 * For any current step number and total step count where 1 <= current <= total,
	 * showProgress SHALL produce output containing both the current step number
	 * and the total, and the current step SHALL never exceed the total.
	 */
	test("Property 11: Tutorial progress indicator is bounded", () => {
		fc.assert(
			fc.property(
				fc.integer({ min: 1, max: 100 }),
				fc.integer({ min: 1, max: 100 }),
				(current, total) => {
					// Ensure current <= total
					const actualTotal = Math.max(current, total);
					const actualCurrent = Math.min(current, total);

					logStepCalls = [];
					showProgress(actualCurrent, actualTotal);

					// showProgress should have produced exactly one log.step call
					expect(logStepCalls.length).toBe(1);

					const output = logStepCalls[0];

					// Output contains both the current step number and the total
					expect(output).toContain(String(actualCurrent));
					expect(output).toContain(String(actualTotal));

					// Current never exceeds total (invariant from our input constraint)
					expect(actualCurrent).toBeLessThanOrEqual(actualTotal);
				},
			),
			{ numRuns: 100 },
		);
	});

	/**
	 * Feature: interactive-new-command
	 * Property 12: Tutorial artifact name resolution handles conflicts
	 *
	 * **Validates: Requirement 9.4**
	 *
	 * For any default artifact name, when the knowledge/ directory does not
	 * contain a directory with that name, resolveArtifactName SHALL return
	 * the original default name unchanged.
	 */
	test("Property 12: Tutorial artifact name resolution handles conflicts", async () => {
		await fc.assert(
			fc.asyncProperty(artifactNameArb, async (name) => {
				// Use a temp directory where knowledge/<name> does not exist
				const tempDir = await mkdtemp(join(tmpdir(), "tutorial-prop12-"));
				const originalCwd = process.cwd();

				try {
					process.chdir(tempDir);

					const result = await resolveArtifactName(name);

					// When no conflict exists, the original name is returned unchanged
					expect(result).toBe(name);
				} finally {
					process.chdir(originalCwd);
					await rm(tempDir, { recursive: true, force: true });
				}
			}),
			{ numRuns: 100 },
		);
	});
});

// ─── Unit Tests ────────────────────────────────────────────────────────────────

describe("Tutorial unit tests", () => {
	/**
	 * Validates: Requirements 9.2
	 * Welcome message contains "Skill Forge" and "artifact".
	 */
	test("showWelcome mentions Skill Forge and artifact", () => {
		showWelcome();

		const allInfoText = logInfoCalls.join(" ");
		const allNoteText = noteCalls.map((n) => n.message).join(" ");
		const combined = `${allInfoText} ${allNoteText}`;

		expect(combined).toContain("Skill Forge");
		expect(combined.toLowerCase()).toContain("artifact");
	});

	/**
	 * Validates: Requirements 9.3, 10.6
	 * Concepts step (step[1]) explains all three file types.
	 */
	test("concepts step explains knowledge.md, hooks.yaml, and mcp-servers.yaml", () => {
		const steps = buildTutorialSteps("test-artifact");
		const conceptsStep = steps[1];

		expect(conceptsStep.explanation).toContain("knowledge.md");
		expect(conceptsStep.explanation).toContain("hooks.yaml");
		expect(conceptsStep.explanation).toContain("mcp-servers.yaml");
	});

	/**
	 * Validates: Requirement 11.1
	 * Progress shows correct "Step N of M" for specific values.
	 */
	test("showProgress displays correct step indicators", () => {
		showProgress(1, 7);
		expect(logStepCalls[0]).toContain("1");
		expect(logStepCalls[0]).toContain("7");

		logStepCalls = [];
		showProgress(4, 7);
		expect(logStepCalls[0]).toContain("4");
		expect(logStepCalls[0]).toContain("7");

		logStepCalls = [];
		showProgress(7, 7);
		expect(logStepCalls[0]).toContain("7");
	});

	/**
	 * Validates: Requirement 11.4, 11.5
	 * Completion summary mentions `forge new`.
	 */
	test("showCompletion mentions forge new", () => {
		showCompletion();

		const allNoteText = noteCalls.map((n) => n.message).join(" ");
		expect(allNoteText).toContain("forge new");
	});

	/**
	 * Validates: Requirements 10.1, 11.1
	 * buildTutorialSteps returns steps with the artifact name embedded.
	 */
	test("buildTutorialSteps embeds artifact name in explanations", () => {
		const steps = buildTutorialSteps("my-cool-artifact");

		// At least one step should reference the artifact name
		const hasArtifactName = steps.some((s) =>
			s.explanation.includes("my-cool-artifact"),
		);
		expect(hasArtifactName).toBe(true);
	});

	/**
	 * Validates: Requirement 10.1
	 * TUTORIAL_DEFAULTS has expected hello-world artifact name.
	 */
	test("TUTORIAL_DEFAULTS uses hello-world as default artifact name", () => {
		expect(TUTORIAL_DEFAULTS.artifactName).toBe("hello-world");
	});

	/**
	 * Validates: Requirement 9.4
	 * Existing hello-world directory with overwrite confirmed returns original name.
	 */
	test("resolveArtifactName with existing dir and overwrite returns original name", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "tutorial-resolve-"));
		const originalCwd = process.cwd();

		try {
			// Create knowledge/hello-world directory
			await mkdir(join(tempDir, "knowledge", "hello-world"), {
				recursive: true,
			});
			process.chdir(tempDir);

			// Queue: confirm overwrite → true
			promptQueue = [true];

			const result = await resolveArtifactName("hello-world");
			expect(result).toBe("hello-world");
		} finally {
			process.chdir(originalCwd);
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	/**
	 * Validates: Requirement 9.4
	 * Existing hello-world directory with decline prompts for rename.
	 */
	test("resolveArtifactName with existing dir and decline prompts for new name", async () => {
		const tempDir = await mkdtemp(join(tmpdir(), "tutorial-resolve-"));
		const originalCwd = process.cwd();

		try {
			// Create knowledge/hello-world directory
			await mkdir(join(tempDir, "knowledge", "hello-world"), {
				recursive: true,
			});
			process.chdir(tempDir);

			// Queue: confirm overwrite → false, then text → "my-artifact"
			promptQueue = [false, "my-artifact"];

			const result = await resolveArtifactName("hello-world");
			expect(result).toBe("my-artifact");
		} finally {
			process.chdir(originalCwd);
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});
