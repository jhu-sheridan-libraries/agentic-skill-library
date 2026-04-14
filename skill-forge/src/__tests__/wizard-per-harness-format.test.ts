import { beforeEach, describe, expect, mock, test } from "bun:test";

// ─── Mock @clack/prompts ───────────────────────────────────────────────────────

/** Queue of return values for each prompt call, consumed in order. */
let promptQueue: unknown[] = [];
/** Track every prompt call: { fn, args } */
let promptCalls: { fn: string; args: unknown[] }[] = [];

function dequeue(fn: string, args: unknown[]) {
	promptCalls.push({ fn, args });
	if (promptQueue.length === 0) {
		throw new Error(`No more queued values for ${fn}`);
	}
	return promptQueue.shift();
}

mock.module("@clack/prompts", () => ({
	intro: (...args: unknown[]) => {
		promptCalls.push({ fn: "intro", args });
	},
	outro: (...args: unknown[]) => {
		promptCalls.push({ fn: "outro", args });
	},
	text: async (opts: unknown) => dequeue("text", [opts]),
	select: async (opts: unknown) => dequeue("select", [opts]),
	multiselect: async (opts: unknown) => dequeue("multiselect", [opts]),
	confirm: async (opts: unknown) => dequeue("confirm", [opts]),
	cancel: (...args: unknown[]) => {
		promptCalls.push({ fn: "cancel", args });
	},
	log: {
		info: () => {},
		step: () => {},
		error: (...args: unknown[]) => {
			promptCalls.push({ fn: "log.error", args });
		},
	},
	isCancel: (value: unknown) => value === Symbol.for("cancel"),
}));

const { promptFrontmatter } = await import("../wizard");

// ─── Helpers ───────────────────────────────────────────────────────────────────

function callsTo(fn: string) {
	return promptCalls.filter((c) => c.fn === fn);
}

function messageOf(call: { fn: string; args: unknown[] }): string {
	return ((call.args[0] as Record<string, unknown>)?.message as string) ?? "";
}

function optionsOf(call: { fn: string; args: unknown[] }): unknown[] {
	return (
		((call.args[0] as Record<string, unknown>)?.options as unknown[]) ?? []
	);
}

// ─── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
	promptQueue = [];
	promptCalls = [];
});

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("Wizard per-harness format prompting", () => {
	/**
	 * Validates: Requirement 1.3
	 * The global artifact type prompt is no longer shown.
	 */
	test("type prompt is shown by default; skipped when preSelectedType is passed", async () => {
		// --- Part 1: default call — type prompt IS shown ---
		promptQueue = [
			"A test artifact", // description
			"react, testing", // keywords
			"Test Author", // author
			"skill", // type select ← shown by default
			"always", // inclusion (select)
			["testing"], // categories (multiselect)
			["cursor"], // harnesses (multiselect)
			"typescript", // ecosystem
		];

		await promptFrontmatter("test-art", "Test Art");

		const selectCallsDefault = callsTo("select");
		const typePromptDefault = selectCallsDefault.find((c) =>
			messageOf(c).includes("What kind of artifact"),
		);
		expect(typePromptDefault).toBeDefined();

		// --- Part 2: preSelectedType bypasses the type prompt ---
		promptQueue = [];
		promptCalls = [];

		promptQueue = [
			"A test artifact", // description
			"react, testing", // keywords
			"Test Author", // author
			// NO type select — preSelectedType bypasses it
			"always", // inclusion (select)
			["testing"], // categories (multiselect)
			["cursor"], // harnesses (multiselect)
			"typescript", // ecosystem
		];

		const fm = await promptFrontmatter("test-art", "Test Art", "workflow");

		const selectCallsBypassed = callsTo("select");
		const typePromptBypassed = selectCallsBypassed.find((c) =>
			messageOf(c).includes("What kind of artifact"),
		);
		expect(typePromptBypassed).toBeUndefined();
		// Pre-selected type is used
		expect(fm.type).toBe("workflow");
	});

	/**
	 * Validates: Requirement 4.1
	 * Harness descriptions appear in the multi-select options.
	 */
	test("harness multi-select shows descriptive labels", async () => {
		promptQueue = [
			"A test artifact",
			"react",
			"Author",
			"skill", // type select
			"always",
			["testing"],
			["kiro"], // harnesses
			"steering", // format for kiro (multi-format)
			"typescript",
		];

		await promptFrontmatter("test-art", "Test Art");

		// Find the harness multiselect call
		const multiselectCalls = callsTo("multiselect");
		const harnessCall = multiselectCalls.find((c) =>
			messageOf(c).includes("AI coding tools"),
		);
		expect(harnessCall).toBeDefined();
		if (!harnessCall) {
			throw new Error("Expected harness multiselect prompt call");
		}

		const options = optionsOf(harnessCall) as {
			value: string;
			label: string;
		}[];
		// Check that labels contain descriptions
		const kiroOption = options.find((o) => o.value === "kiro");
		expect(kiroOption?.label).toContain(
			"Steering files or powers for Kiro IDE",
		);

		const copilotOption = options.find((o) => o.value === "copilot");
		expect(copilotOption?.label).toContain(
			"Instructions or agents for GitHub Copilot",
		);

		const cursorOption = options.find((o) => o.value === "cursor");
		expect(cursorOption?.label).toContain("Rule files for Cursor");

		const claudeOption = options.find((o) => o.value === "claude-code");
		expect(claudeOption?.label).toContain("CLAUDE.md for Claude Code");

		const windsurfOption = options.find((o) => o.value === "windsurf");
		expect(windsurfOption?.label).toContain("Rule files for Windsurf");

		const clineOption = options.find((o) => o.value === "cline");
		expect(clineOption?.label).toContain("Rule files for Cline");

		const qdevOption = options.find((o) => o.value === "qdeveloper");
		expect(qdevOption?.label).toContain(
			"Rules or agents for Amazon Q Developer",
		);
	});

	/**
	 * Validates: Requirements 4.2, 4.3
	 * Format prompts are shown only for multi-format harnesses.
	 */
	test("format prompts shown only for multi-format harnesses", async () => {
		promptQueue = [
			"A test artifact",
			"react",
			"Author",
			"skill", // type select
			"always",
			["testing"],
			["kiro", "cursor", "copilot"], // harnesses — kiro and copilot are multi-format
			"steering", // format for kiro
			"instructions", // format for copilot
			// NO format prompt for cursor (single-format)
			"typescript",
		];

		await promptFrontmatter("test-art", "Test Art");

		// Find select calls after the harness multiselect
		const selectCalls = callsTo("select");
		const formatCalls = selectCalls.filter((c) =>
			messageOf(c).includes("Output format for"),
		);

		// Should have format prompts for kiro and copilot, but not cursor
		expect(formatCalls).toHaveLength(2);
		expect(messageOf(formatCalls[0])).toContain("kiro");
		expect(messageOf(formatCalls[1])).toContain("copilot");
	});

	/**
	 * Validates: Requirement 4.6
	 * Default format selections omit the format field from harness-config.
	 */
	test("default format selections omit format from harness-config", async () => {
		promptQueue = [
			"A test artifact",
			"react",
			"Author",
			"skill", // type select
			"always",
			["testing"],
			["kiro", "copilot"], // harnesses
			"steering", // kiro default format
			"instructions", // copilot default format
			"typescript",
		];

		const fm = await promptFrontmatter("test-art", "Test Art");

		// harness-config should not be present since all formats are defaults
		expect((fm as Record<string, unknown>)["harness-config"]).toBeUndefined();
	});

	/**
	 * Validates: Requirements 4.5, 4.6
	 * Non-default format selections are written to harness-config.
	 */
	test("non-default format selections are written to harness-config", async () => {
		promptQueue = [
			"A test artifact",
			"react",
			"Author",
			"skill", // type select
			"always",
			["testing"],
			["kiro", "copilot", "qdeveloper"], // harnesses
			"power", // kiro non-default format
			"agent", // copilot non-default format
			"rule", // qdeveloper default format
			"typescript",
		];

		const fm = await promptFrontmatter("test-art", "Test Art");

		const harnessConfigField = (fm as Record<string, unknown>)[
			"harness-config"
		] as Record<string, Record<string, unknown>> | undefined;

		expect(harnessConfigField).toBeDefined();
		// kiro has non-default format
		expect(harnessConfigField?.kiro).toEqual({ format: "power" });
		// copilot has non-default format
		expect(harnessConfigField?.copilot).toEqual({ format: "agent" });
		// qdeveloper used default — should NOT be in harness-config
		expect(harnessConfigField?.qdeveloper).toBeUndefined();
	});

	/**
	 * Validates: Requirements 4.3
	 * Single-format harnesses (cursor, claude-code, windsurf, cline) skip format prompt.
	 */
	test("single-format harnesses skip format prompt entirely", async () => {
		promptQueue = [
			"A test artifact",
			"react",
			"Author",
			"skill", // type select
			"always",
			["testing"],
			["cursor", "claude-code", "windsurf", "cline"], // all single-format
			// NO format prompts expected
			"typescript",
		];

		await promptFrontmatter("test-art", "Test Art");

		const selectCalls = callsTo("select");
		const formatCalls = selectCalls.filter((c) =>
			messageOf(c).includes("Output format for"),
		);

		expect(formatCalls).toHaveLength(0);
	});

	/**
	 * Validates: Requirement 4.4
	 * Format prompt shows correct options with descriptions.
	 */
	test("format prompt shows valid options with descriptions", async () => {
		promptQueue = [
			"A test artifact",
			"react",
			"Author",
			"skill", // type select
			"always",
			["testing"],
			["kiro"],
			"steering", // format for kiro
			"typescript",
		];

		await promptFrontmatter("test-art", "Test Art");

		const selectCalls = callsTo("select");
		const kiroFormatCall = selectCalls.find((c) =>
			messageOf(c).includes("Output format for kiro"),
		);
		expect(kiroFormatCall).toBeDefined();
		if (!kiroFormatCall) {
			throw new Error("Expected kiro format select prompt call");
		}

		const options = optionsOf(kiroFormatCall) as {
			value: string;
			label: string;
			hint: string;
		}[];
		expect(options).toHaveLength(2);
		expect(options[0].value).toBe("steering");
		expect(options[0].hint).toContain("markdown knowledge file");
		expect(options[1].value).toBe("power");
		expect(options[1].hint).toContain("capability bundle");
	});
});
