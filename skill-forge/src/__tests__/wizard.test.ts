import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import type { WizardResult } from "../wizard";

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

// Import AFTER mocking — use await import to work with Bun mock.module
const {
	runWizard,
	promptFrontmatter,
	promptKnowledgeBody,
	promptHooks,
	promptMcpServers,
} = await import("../wizard");

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Return the names of prompt functions called (text, select, multiselect, confirm). */
function calledFns(): string[] {
	return promptCalls.map((c) => c.fn);
}

/** Find all calls to a specific prompt function. */
function callsTo(fn: string) {
	return promptCalls.filter((c) => c.fn === fn);
}

/** Extract the `message` field from the first arg of a prompt call. */
function messageOf(call: { fn: string; args: unknown[] }): string {
	return ((call.args[0] as Record<string, unknown>)?.message as string) ?? "";
}

// ─── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
	promptQueue = [];
	promptCalls = [];
});

// ─── Frontmatter prompt flow ───────────────────────────────────────────────────

describe("promptFrontmatter", () => {
	/**
	 * Validates: Requirements 2.5, 2.6
	 * When inclusion mode is "always", the file_patterns prompt must NOT appear.
	 */
	test("inclusion=always does NOT show file_patterns prompt", async () => {
		promptQueue = [
			"A test artifact", // description
			"react, testing", // keywords
			"Test Author", // author
			"skill", // type (select)
			"always", // inclusion (select)
			// NO file_patterns prompt expected
			["testing"], // categories (multiselect)
			["kiro"], // harnesses (multiselect)
			"steering", // format for kiro (multi-format)
			"typescript, bun", // ecosystem
		];

		const fm = await promptFrontmatter("test-art", "Test Art");

		expect(fm.inclusion).toBe("always");
		expect(fm.file_patterns).toBeUndefined();

		// Only 4 text prompts: description, keywords, author, ecosystem (no file_patterns)
		expect(callsTo("text").length).toBe(4);
		const textMessages = callsTo("text").map(messageOf);
		expect(textMessages.every((m) => !/file.?pattern/i.test(m))).toBe(true);
	});

	/**
	 * Validates: Requirements 2.5, 2.6
	 * When inclusion mode is "fileMatch", the file_patterns prompt MUST appear.
	 */
	test("inclusion=fileMatch shows file_patterns prompt", async () => {
		promptQueue = [
			"A test artifact", // description
			"react, testing", // keywords
			"Test Author", // author
			"skill", // type (select)
			"fileMatch", // inclusion (select)
			"**/*.ts, **/*.tsx", // file_patterns (text) — extra prompt
			["testing"], // categories (multiselect)
			["kiro"], // harnesses (multiselect)
			"steering", // format for kiro (multi-format)
			"typescript", // ecosystem
		];

		const fm = await promptFrontmatter("test-art", "Test Art");

		expect(fm.inclusion).toBe("fileMatch");
		expect(fm.file_patterns).toEqual(["**/*.ts", "**/*.tsx"]);

		// 5 text prompts: description, keywords, author, file_patterns, ecosystem
		expect(callsTo("text").length).toBe(5);
		const textMessages = callsTo("text").map(messageOf);
		expect(textMessages.some((m) => /file.?pattern/i.test(m))).toBe(true);
	});

	/**
	 * Validates: Requirement 2.6
	 * When inclusion mode is "manual", no file_patterns prompt appears.
	 */
	test("inclusion=manual does NOT show file_patterns prompt", async () => {
		promptQueue = [
			"A test artifact",
			"react",
			"Author",
			"skill", // type (select)
			"manual",
			["security"],
			["kiro", "cursor"],
			"steering", // format for kiro (multi-format)
			// cursor is single-format — no prompt
			"python",
		];

		const fm = await promptFrontmatter("my-rule", "My Rule");

		expect(fm.inclusion).toBe("manual");
		expect(fm.file_patterns).toBeUndefined();
		expect(callsTo("text").length).toBe(4);
	});
});

// ─── Hook prompt flow ──────────────────────────────────────────────────────────

describe("promptHooks", () => {
	/**
	 * Validates: Requirements 5.2, 5.3
	 * File-based events (file_edited, file_created, file_deleted) show file_patterns prompt.
	 */
	test("file event shows file_patterns prompt", async () => {
		promptQueue = [
			true, // "Would you like to add a hook?" → yes
			"file_edited", // event type (select)
			"**/*.ts", // file_patterns (text) — conditional
			"ask_agent", // action type (select)
			"Review the file", // agent prompt (text)
			"lint-hook", // hook name (text)
			false, // "Would you like to add another hook?" → no
		];

		const hooks = await promptHooks();

		expect(hooks).toHaveLength(1);
		expect(hooks[0].event).toBe("file_edited");
		expect(hooks[0].condition?.file_patterns).toEqual(["**/*.ts"]);

		// Verify file_patterns prompt was shown
		const textMessages = callsTo("text").map(messageOf);
		expect(textMessages.some((m) => /file.?pattern/i.test(m))).toBe(true);
	});

	/**
	 * Validates: Requirements 5.2, 5.3
	 * file_created event also shows file_patterns prompt.
	 */
	test("file_created event shows file_patterns prompt", async () => {
		promptQueue = [
			true,
			"file_created",
			"*.md",
			"run_command",
			"echo hello",
			"on-create",
			false,
		];

		const hooks = await promptHooks();

		expect(hooks).toHaveLength(1);
		expect(hooks[0].event).toBe("file_created");
		expect(hooks[0].condition?.file_patterns).toEqual(["*.md"]);
	});

	/**
	 * Validates: Requirements 5.2, 5.3
	 * file_deleted event also shows file_patterns prompt.
	 */
	test("file_deleted event shows file_patterns prompt", async () => {
		promptQueue = [
			true,
			"file_deleted",
			"*.log",
			"ask_agent",
			"Clean up references",
			"cleanup-hook",
			false,
		];

		const hooks = await promptHooks();

		expect(hooks).toHaveLength(1);
		expect(hooks[0].event).toBe("file_deleted");
		expect(hooks[0].condition?.file_patterns).toEqual(["*.log"]);
	});

	/**
	 * Validates: Requirements 5.4
	 * Tool-based events (pre_tool_use, post_tool_use) show tool_types prompt.
	 */
	test("pre_tool_use event shows tool_types prompt", async () => {
		promptQueue = [
			true,
			"pre_tool_use",
			"write, shell", // tool_types (text) — conditional
			"ask_agent",
			"Check before tool use",
			"pre-tool-check",
			false,
		];

		const hooks = await promptHooks();

		expect(hooks).toHaveLength(1);
		expect(hooks[0].event).toBe("pre_tool_use");
		expect(hooks[0].condition?.tool_types).toEqual(["write", "shell"]);

		// Verify tool_types prompt was shown
		const textMessages = callsTo("text").map(messageOf);
		expect(textMessages.some((m) => /tool.?type/i.test(m))).toBe(true);
	});

	/**
	 * Validates: Requirements 5.4
	 * post_tool_use event also shows tool_types prompt.
	 */
	test("post_tool_use event shows tool_types prompt", async () => {
		promptQueue = [
			true,
			"post_tool_use",
			"read",
			"run_command",
			"npm test",
			"post-tool-hook",
			false,
		];

		const hooks = await promptHooks();

		expect(hooks).toHaveLength(1);
		expect(hooks[0].event).toBe("post_tool_use");
		expect(hooks[0].condition?.tool_types).toEqual(["read"]);
	});

	/**
	 * Validates: Requirements 5.5, 5.6
	 * ask_agent action collects the prompt field.
	 */
	test("ask_agent action collects prompt field", async () => {
		promptQueue = [
			true,
			"prompt_submit", // event with no conditional fields
			"ask_agent",
			"Summarize the changes", // prompt (text)
			"summarize-hook",
			false,
		];

		const hooks = await promptHooks();

		expect(hooks).toHaveLength(1);
		expect(hooks[0].action).toEqual({
			type: "ask_agent",
			prompt: "Summarize the changes",
		});
	});

	/**
	 * Validates: Requirements 5.5, 5.7
	 * run_command action collects the command field.
	 */
	test("run_command action collects command field", async () => {
		promptQueue = [
			true,
			"agent_stop",
			"run_command",
			"npm run lint", // command (text)
			"lint-on-stop",
			false,
		];

		const hooks = await promptHooks();

		expect(hooks).toHaveLength(1);
		expect(hooks[0].action).toEqual({
			type: "run_command",
			command: "npm run lint",
		});
	});

	/**
	 * Validates: Requirements 5.1
	 * Declining to add hooks returns an empty array.
	 */
	test("declining hooks returns empty array", async () => {
		promptQueue = [false]; // "Would you like to add a hook?" → no

		const hooks = await promptHooks();

		expect(hooks).toEqual([]);
	});

	/**
	 * Validates: Requirement 5.2 (non-file, non-tool events)
	 * Events like prompt_submit, agent_stop, user_triggered do NOT show
	 * file_patterns or tool_types prompts.
	 */
	test("non-file non-tool event skips conditional prompts", async () => {
		promptQueue = [
			true,
			"user_triggered",
			"ask_agent",
			"Do something",
			"manual-hook",
			false,
		];

		const hooks = await promptHooks();

		expect(hooks).toHaveLength(1);
		expect(hooks[0].condition).toBeUndefined();

		// Only 2 text prompts: agent prompt + hook name (no file_patterns or tool_types)
		expect(callsTo("text").length).toBe(2);
	});
});

// ─── MCP server prompt flow ────────────────────────────────────────────────────

describe("promptMcpServers", () => {
	/**
	 * Validates: Requirement 6.1
	 * Declining to add MCP servers returns an empty array.
	 */
	test("declining MCP servers returns empty array", async () => {
		promptQueue = [false]; // "Would you like to add an MCP server?" → no

		const servers = await promptMcpServers();

		expect(servers).toEqual([]);
	});
});

// ─── Cancellation ──────────────────────────────────────────────────────────────

describe("cancellation", () => {
	const CANCEL = Symbol.for("cancel");

	/**
	 * Validates: Requirements 8.1, 8.2, 8.3
	 * Cancelling at the first frontmatter prompt (description) exits the process.
	 * No WizardResult is returned — process.exit(0) is called.
	 */
	test("cancel during frontmatter description exits process", async () => {
		promptQueue = [CANCEL]; // cancel at description

		const exitSpy = spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit");
		});

		try {
			await promptFrontmatter("test", "Test");
			expect.unreachable("should have thrown");
		} catch (e: unknown) {
			expect((e as Error).message).toBe("process.exit");
		}

		expect(exitSpy).toHaveBeenCalledWith(0);
		// Verify cancel message was displayed
		expect(calledFns()).toContain("cancel");

		exitSpy.mockRestore();
	});

	/**
	 * Validates: Requirements 8.1, 8.2, 8.3
	 * Cancelling at the inclusion select prompt exits the process.
	 */
	test("cancel during frontmatter inclusion exits process", async () => {
		promptQueue = [
			"A description",
			"keyword",
			"Author",
			CANCEL, // cancel at inclusion
		];

		const exitSpy = spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit");
		});

		try {
			await promptFrontmatter("test", "Test");
			expect.unreachable("should have thrown");
		} catch (e: unknown) {
			expect((e as Error).message).toBe("process.exit");
		}

		expect(exitSpy).toHaveBeenCalledWith(0);
		exitSpy.mockRestore();
	});

	/**
	 * Validates: Requirements 8.1, 8.2, 8.3
	 * Cancelling during the hooks confirm prompt exits the process.
	 */
	test("cancel during hooks confirm exits process", async () => {
		promptQueue = [CANCEL]; // cancel at "Would you like to add a hook?"

		const exitSpy = spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit");
		});

		try {
			await promptHooks();
			expect.unreachable("should have thrown");
		} catch (e: unknown) {
			expect((e as Error).message).toBe("process.exit");
		}

		expect(exitSpy).toHaveBeenCalledWith(0);
		exitSpy.mockRestore();
	});

	/**
	 * Validates: Requirements 8.1, 8.2, 8.3
	 * Cancelling during the MCP servers confirm prompt exits the process.
	 */
	test("cancel during MCP servers confirm exits process", async () => {
		promptQueue = [CANCEL];

		const exitSpy = spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit");
		});

		try {
			await promptMcpServers();
			expect.unreachable("should have thrown");
		} catch (e: unknown) {
			expect((e as Error).message).toBe("process.exit");
		}

		expect(exitSpy).toHaveBeenCalledWith(0);
		exitSpy.mockRestore();
	});

	/**
	 * Validates: Requirements 8.1, 8.2, 8.3
	 * Cancelling during knowledge body prompt exits the process.
	 */
	test("cancel during knowledge body exits process", async () => {
		promptQueue = [CANCEL];

		const exitSpy = spyOn(process, "exit").mockImplementation(() => {
			throw new Error("process.exit");
		});

		try {
			await promptKnowledgeBody();
			expect.unreachable("should have thrown");
		} catch (e: unknown) {
			expect((e as Error).message).toBe("process.exit");
		}

		expect(exitSpy).toHaveBeenCalledWith(0);
		exitSpy.mockRestore();
	});
});

// ─── runWizard full flow ───────────────────────────────────────────────────────

describe("runWizard", () => {
	/**
	 * Validates: Requirements 1.4, 8.1–8.3
	 * Full wizard flow with no hooks and no MCP servers returns a correct WizardResult.
	 */
	test("returns correct WizardResult with no hooks and no MCP servers", async () => {
		promptQueue = [
			// Frontmatter
			"My artifact description", // description
			"react, hooks", // keywords
			"Jane Doe", // author
			"skill", // type
			"always", // inclusion
			["testing", "security"], // categories
			["kiro", "cursor"], // harnesses
			"steering", // format for kiro (multi-format)
			// cursor is single-format — no prompt
			"typescript, react", // ecosystem
			// Knowledge body
			"# My Knowledge\nSome content here.", // body
			// Hooks
			false, // "Would you like to add a hook?" → no
			// MCP servers
			false, // "Would you like to add an MCP server?" → no
		];

		const result: WizardResult = await runWizard("my-artifact", "My Artifact");

		// Verify intro was called
		expect(calledFns()[0]).toBe("intro");

		// Verify frontmatter
		expect(result.frontmatter.name).toBe("my-artifact");
		expect(result.frontmatter.displayName).toBe("My Artifact");
		expect(result.frontmatter.description).toBe("My artifact description");
		expect(result.frontmatter.keywords).toEqual(["react", "hooks"]);
		expect(result.frontmatter.author).toBe("Jane Doe");
		expect(result.frontmatter.inclusion).toBe("always");
		expect(result.frontmatter.categories).toEqual(["testing", "security"]);
		expect(result.frontmatter.harnesses).toEqual(["kiro", "cursor"]);
		expect(result.frontmatter.ecosystem).toEqual(["typescript", "react"]);
		expect(result.frontmatter.version).toBe("0.1.0");
		expect(result.frontmatter.depends).toEqual([]);
		expect(result.frontmatter.enhances).toEqual([]);

		// Verify knowledge body
		expect(result.knowledgeBody).toBe("# My Knowledge\nSome content here.");

		// Verify empty hooks and MCP servers
		expect(result.hooks).toEqual([]);
		expect(result.mcpServers).toEqual([]);
	});

	/**
	 * Validates: Requirements 5.2–5.7, 6.1–6.7
	 * Full wizard flow with one hook and one MCP server.
	 */
	test("returns WizardResult with hooks and MCP servers", async () => {
		promptQueue = [
			// Frontmatter
			"Description",
			"key1",
			"Author",
			"skill", // type
			"manual",
			["devops"],
			["kiro"],
			"power", // format for kiro (non-default)
			"node",
			// Knowledge body
			"",
			// Hooks — add one hook
			true, // add a hook? → yes
			"file_edited", // event
			"**/*.ts", // file_patterns
			"run_command", // action type
			"npm test", // command
			"test-on-edit", // hook name
			false, // add another hook? → no
			// MCP servers — add one server
			true, // add an MCP server? → yes
			"my-server", // name
			"npx", // command
			"-y @my/server", // args (space-separated)
			"API_KEY=abc123", // env (KEY=VALUE)
			false, // add another server? → no
		];

		const result = await runWizard("my-power", "My Power");

		// Verify hook
		expect(result.hooks).toHaveLength(1);
		expect(result.hooks[0].name).toBe("test-on-edit");
		expect(result.hooks[0].event).toBe("file_edited");
		expect(result.hooks[0].condition?.file_patterns).toEqual(["**/*.ts"]);
		expect(result.hooks[0].action).toEqual({
			type: "run_command",
			command: "npm test",
		});

		// Verify MCP server
		expect(result.mcpServers).toHaveLength(1);
		expect(result.mcpServers[0].name).toBe("my-server");
		expect(result.mcpServers[0].command).toBe("npx");
		expect(result.mcpServers[0].args).toEqual(["-y", "@my/server"]);
		expect(result.mcpServers[0].env).toEqual({ API_KEY: "abc123" });
	});
});

// ─── Outro / summary (tested via newCommand integration) ──────────────────────

describe("newCommand outro", () => {
	/**
	 * Validates: Requirements 7.4, 7.5
	 * The outro message lists written files and suggests `forge build`.
	 * This is tested by verifying the p.outro call in the prompt log after
	 * a full wizard + file-write cycle via newCommand.
	 *
	 * Note: The outro is emitted by newCommand (in new.ts), not by runWizard.
	 * We verify the prompt call log includes an outro with the expected content.
	 */
	test("outro lists written files and suggests forge build", async () => {
		// We need to import newCommand with the mocked prompts
		// Set up a temp directory for the scaffold
		const { mkdtemp, rm, cp } = await import("node:fs/promises");
		const { join, resolve } = await import("node:path");
		const { tmpdir } = await import("node:os");

		const TEMPLATES_SRC = resolve(import.meta.dir, "../../templates/knowledge");
		const tempDir = await mkdtemp(join(tmpdir(), "wizard-test-"));
		const originalCwd = process.cwd();

		try {
			await cp(TEMPLATES_SRC, join(tempDir, "templates", "knowledge"), {
				recursive: true,
			});
			process.chdir(tempDir);

			// Reset prompt tracking
			promptQueue = [
				// Frontmatter
				"Test description",
				"test",
				"Author",
				"skill", // type
				"always",
				["testing"],
				["kiro"],
				"steering", // format for kiro (multi-format)
				"typescript",
				// Knowledge body
				"Some content",
				// Hooks
				false,
				// MCP servers
				false,
			];
			promptCalls = [];

			const { newCommand } = await import("../new");
			await newCommand("outro-test", {});

			// Find the outro call
			const outroCalls = callsTo("outro");
			expect(outroCalls.length).toBeGreaterThanOrEqual(1);

			const outroMessage = outroCalls[0].args[0] as string;
			expect(outroMessage).toContain("knowledge.md");
			expect(outroMessage).toContain("hooks.yaml");
			expect(outroMessage).toContain("mcp-servers.yaml");
			expect(outroMessage).toContain("forge build");
		} finally {
			process.chdir(originalCwd);
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});
