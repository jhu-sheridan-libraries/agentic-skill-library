/**
 * Rosetta Stone — Inbound Regression Tests
 *
 * Fixture-based tests covering kiro-power, kiro-skill, superpowers,
 * and every current harness-native importer. Compares canonical-normalized
 * artifacts and diagnostics against pinned expected values to detect
 * unintentional changes.
 *
 * Requirements: 14.1, 14.2, 14.10, 16.7
 */

import { describe, expect, it } from "bun:test";

import type {
	FormatContract,
	NormalizedRelativePath,
	SourceDocument,
} from "../schemas";
import type { SourceTranslatorContext } from "../rosetta/registry";
import { translateKiroPower } from "../rosetta/builtins/sources/kiro-power";
import { translateKiroSkill } from "../rosetta/builtins/sources/kiro-skill";
import { translateSuperpowers } from "../rosetta/builtins/sources/superpowers";
import { translateKiroNative } from "../rosetta/builtins/sources/kiro-native";
import { translateClaudeCodeNative } from "../rosetta/builtins/sources/claude-code-native";
import { translateCodexNative } from "../rosetta/builtins/sources/codex-native";
import {
	KIRO_POWER_CONTRACT,
	KIRO_SKILL_CONTRACT,
	SUPERPOWERS_CONTRACT,
	KIRO_CONTRACT,
	CLAUDE_CODE_CONTRACT,
	CODEX_CONTRACT,
} from "../rosetta/builtins/contracts";

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function makeContext(
	contract: FormatContract,
	artifactNameHint = "test-artifact",
): SourceTranslatorContext {
	return {
		format: contract,
		canonicalSchemaVersion: "1.0.0",
		options: {},
		callerContext: { artifactNameHint },
	};
}

function doc(path: string, content: string): SourceDocument {
	return {
		path: path as NormalizedRelativePath,
		content,
		executable: false,
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════════════

const KIRO_POWER_FIXTURE: SourceDocument[] = [
	doc(
		"POWER.md",
		`---
name: my-power
description: "A test power for regression"
keywords:
  - testing
  - regression
globs:
  - "**/*.ts"
alwaysApply: true
---

# My Power

This is the body of the power.`,
	),
	doc("steering/setup.md", "# Setup\n\nSetup instructions here."),
	doc("steering/workflow.md", "# Workflow\n\nWorkflow steps here."),
];

const KIRO_SKILL_FIXTURE: SourceDocument[] = [
	doc(
		"SKILL.md",
		`---
name: my-skill
description: "A test skill for regression"
keywords:
  - testing
  - skill
---

# My Skill

This is the body of the skill.`,
	),
	doc(
		"references/getting-started.md",
		"# Getting Started\n\nReference content.",
	),
	doc("references/advanced.md", "# Advanced\n\nAdvanced reference."),
];

const SUPERPOWERS_FIXTURE: SourceDocument[] = [
	doc(
		"SKILL.md",
		`---
name: my-superpower
description: "A test superpower for regression"
keywords:
  - superpower
requires:
  - base-skill
---

# My Superpower

This is the body of the superpower.`,
	),
	doc("companion-guide.md", "# Companion Guide\n\nAdditional guidance."),
	doc("advanced-usage.md", "# Advanced Usage\n\nAdvanced content."),
];

const KIRO_NATIVE_FIXTURE: SourceDocument[] = [
	doc(
		"steering.md",
		`---
name: my-steering
description: "Test Kiro steering file"
type: skill
harnesses:
  - kiro
---

# Steering Content

Follow these guidelines.`,
	),
	doc(
		"hooks/on-save.kiro.hook",
		JSON.stringify({
			name: "lint-on-save",
			event: "fileEdited",
			action: { type: "run_command", command: "bun run lint" },
			condition: { file_patterns: ["**/*.ts"] },
		}),
	),
	doc(
		"mcp.json",
		JSON.stringify({
			mcpServers: {
				"my-server": {
					command: "node",
					args: ["server.js"],
					env: { PORT: "3000" },
				},
			},
		}),
	),
];

const CLAUDE_CODE_FIXTURE: SourceDocument[] = [
	doc(
		"CLAUDE.md",
		`---
name: my-claude-rules
---

# Claude Code Rules

Follow these rules when coding.`,
	),
	doc(
		".claude/settings.json",
		JSON.stringify({
			commands: ["bun run lint", "bun test"],
			permissions: { allow: ["read", "write"] },
		}),
	),
	doc(
		".claude/mcp.json",
		JSON.stringify({
			mcpServers: {
				"context7": {
					command: "npx",
					args: ["-y", "@context7/mcp"],
					env: {},
				},
				"docs-server": {
					url: "https://docs.example.com/mcp",
					type: "http",
				},
			},
		}),
	),
];

const CODEX_FIXTURE: SourceDocument[] = [
	doc(
		"AGENTS.md",
		`---
name: my-codex-agent
---

# Codex Agent

Instructions for the codex agent.`,
	),
	doc(
		".codex/config.toml",
		`[mcp_servers.analyzer]
command = "python"
args = ["analyze.py", "--verbose"]
env = { API_KEY = "ref:secret" }

[mcp_servers.formatter]
command = "prettier"
args = ["--write"]
`,
	),
];

// ═══════════════════════════════════════════════════════════════════════════════
// Tests: kiro-power
// ═══════════════════════════════════════════════════════════════════════════════

describe("Inbound Regression: kiro-power", () => {
	const context = makeContext(KIRO_POWER_CONTRACT, "my-power");
	const result = translateKiroPower(KIRO_POWER_FIXTURE, context);

	it("produces a candidate artifact", () => {
		expect(result.candidate).toBeDefined();
	});

	it("pins candidate.name", () => {
		expect(result.candidate!.name).toBe("my-power");
	});

	it("pins candidate.frontmatter.type", () => {
		expect((result.candidate as any).frontmatter.type).toBe("skill");
	});

	it("pins candidate.frontmatter.harnesses", () => {
		expect((result.candidate as any).frontmatter.harnesses).toEqual(["kiro"]);
	});

	it("pins candidate.frontmatter.harness-config", () => {
		expect((result.candidate as any).frontmatter["harness-config"]).toEqual({
			kiro: { format: "power" },
		});
	});

	it("pins workflow count and filenames", () => {
		const workflows = (result.candidate as any).workflows;
		expect(workflows).toHaveLength(2);
		expect(workflows[0].filename).toBe("setup.md");
		expect(workflows[1].filename).toBe("workflow.md");
	});

	it("maps globs to file_patterns", () => {
		expect((result.candidate as any).frontmatter.file_patterns).toEqual([
			"**/*.ts",
		]);
	});

	it("maps alwaysApply to inclusion: always", () => {
		expect((result.candidate as any).frontmatter.inclusion).toBe("always");
	});

	it("consumed paths include POWER.md and steering files", () => {
		expect(result.consumedPaths).toContain("POWER.md");
		expect(result.consumedPaths).toContain("steering/setup.md");
		expect(result.consumedPaths).toContain("steering/workflow.md");
	});

	it("preserved paths are empty for this fixture", () => {
		expect(result.preservedPaths).toHaveLength(0);
	});

	it("emits RS_DEFAULT_APPLIED diagnostics", () => {
		const defaultDiags = result.diagnostics.filter(
			(d) => d.code === "RS_DEFAULT_APPLIED",
		);
		expect(defaultDiags.length).toBeGreaterThan(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Tests: kiro-skill
// ═══════════════════════════════════════════════════════════════════════════════

describe("Inbound Regression: kiro-skill", () => {
	const context = makeContext(KIRO_SKILL_CONTRACT, "my-skill");
	const result = translateKiroSkill(KIRO_SKILL_FIXTURE, context);

	it("produces a candidate artifact", () => {
		expect(result.candidate).toBeDefined();
	});

	it("pins candidate.name", () => {
		expect(result.candidate!.name).toBe("my-skill");
	});

	it("pins candidate.frontmatter.type", () => {
		expect((result.candidate as any).frontmatter.type).toBe("skill");
	});

	it("pins candidate.frontmatter.harnesses", () => {
		expect((result.candidate as any).frontmatter.harnesses).toEqual(["kiro"]);
	});

	it("pins workflow count and filenames", () => {
		const workflows = (result.candidate as any).workflows;
		expect(workflows).toHaveLength(2);
		expect(workflows[0].filename).toBe("advanced.md");
		expect(workflows[1].filename).toBe("getting-started.md");
	});

	it("consumed paths include SKILL.md and references files", () => {
		expect(result.consumedPaths).toContain("SKILL.md");
		expect(result.consumedPaths).toContain("references/advanced.md");
		expect(result.consumedPaths).toContain("references/getting-started.md");
	});

	it("preserved paths are empty for this fixture", () => {
		expect(result.preservedPaths).toHaveLength(0);
	});

	it("emits RS_DEFAULT_APPLIED diagnostics for defaults", () => {
		const defaultDiags = result.diagnostics.filter(
			(d) => d.code === "RS_DEFAULT_APPLIED",
		);
		expect(defaultDiags.length).toBeGreaterThan(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Tests: superpowers
// ═══════════════════════════════════════════════════════════════════════════════

describe("Inbound Regression: superpowers", () => {
	const context = makeContext(SUPERPOWERS_CONTRACT, "my-superpower");
	const result = translateSuperpowers(SUPERPOWERS_FIXTURE, context);

	it("produces a candidate artifact", () => {
		expect(result.candidate).toBeDefined();
	});

	it("pins candidate.name", () => {
		expect(result.candidate!.name).toBe("my-superpower");
	});

	it("pins candidate.frontmatter.type", () => {
		expect((result.candidate as any).frontmatter.type).toBe("skill");
	});

	it("pins candidate.frontmatter.harnesses", () => {
		expect((result.candidate as any).frontmatter.harnesses).toEqual([
			"claude-code",
			"codex",
			"cursor",
		]);
	});

	it("pins workflow count and filenames", () => {
		const workflows = (result.candidate as any).workflows;
		expect(workflows).toHaveLength(2);
		expect(workflows[0].filename).toBe("advanced-usage.md");
		expect(workflows[1].filename).toBe("companion-guide.md");
	});

	it("maps requires to depends", () => {
		expect((result.candidate as any).frontmatter.depends).toEqual([
			"base-skill",
		]);
	});

	it("consumed paths include SKILL.md and companion files", () => {
		expect(result.consumedPaths).toContain("SKILL.md");
		expect(result.consumedPaths).toContain("advanced-usage.md");
		expect(result.consumedPaths).toContain("companion-guide.md");
	});

	it("preserved paths are empty for this fixture", () => {
		expect(result.preservedPaths).toHaveLength(0);
	});

	it("emits RS_DEFAULT_APPLIED diagnostics", () => {
		const defaultDiags = result.diagnostics.filter(
			(d) => d.code === "RS_DEFAULT_APPLIED",
		);
		expect(defaultDiags.length).toBeGreaterThan(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Tests: kiro-native
// ═══════════════════════════════════════════════════════════════════════════════

describe("Inbound Regression: kiro-native", () => {
	const context = makeContext(KIRO_CONTRACT, "my-steering");
	const result = translateKiroNative(KIRO_NATIVE_FIXTURE, context);

	it("produces a candidate artifact", () => {
		expect(result.candidate).toBeDefined();
	});

	it("pins candidate.name", () => {
		expect(result.candidate!.name).toBe("my-steering");
	});

	it("pins candidate.frontmatter.type", () => {
		expect((result.candidate as any).frontmatter.type).toBe("skill");
	});

	it("pins candidate.frontmatter.harnesses", () => {
		expect((result.candidate as any).frontmatter.harnesses).toEqual(["kiro"]);
	});

	it("pins hook count", () => {
		const hooks = (result.candidate as any).hooks;
		expect(hooks).toHaveLength(1);
		expect(hooks[0].name).toBe("lint-on-save");
		expect(hooks[0].event).toBe("file_edited");
	});

	it("pins MCP server count and names", () => {
		const mcpServers = (result.candidate as any).mcpServers;
		expect(mcpServers).toHaveLength(1);
		expect(mcpServers[0].name).toBe("my-server");
		expect(mcpServers[0].transport).toBe("stdio");
		expect(mcpServers[0].command).toBe("node");
	});

	it("consumed paths include steering, hook, and mcp files", () => {
		expect(result.consumedPaths).toContain("steering.md");
		expect(result.consumedPaths).toContain("hooks/on-save.kiro.hook");
		expect(result.consumedPaths).toContain("mcp.json");
	});

	it("preserved paths are empty for this fixture", () => {
		expect(result.preservedPaths).toHaveLength(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Tests: claude-code-native
// ═══════════════════════════════════════════════════════════════════════════════

describe("Inbound Regression: claude-code-native", () => {
	const context = makeContext(CLAUDE_CODE_CONTRACT, "my-claude-rules");
	const result = translateClaudeCodeNative(CLAUDE_CODE_FIXTURE, context);

	it("produces a candidate artifact", () => {
		expect(result.candidate).toBeDefined();
	});

	it("pins candidate.name", () => {
		expect(result.candidate!.name).toBe("my-claude-rules");
	});

	it("pins candidate.frontmatter.type", () => {
		expect((result.candidate as any).frontmatter.type).toBe("rule");
	});

	it("pins candidate.frontmatter.harnesses", () => {
		expect((result.candidate as any).frontmatter.harnesses).toEqual([
			"claude-code",
		]);
	});

	it("pins hook count from settings.json commands", () => {
		const hooks = (result.candidate as any).hooks;
		expect(hooks).toHaveLength(2);
		expect(hooks[0].event).toBe("agent_stop");
		expect(hooks[0].action.command).toBe("bun run lint");
		expect(hooks[1].action.command).toBe("bun test");
	});

	it("pins MCP server count and names", () => {
		const mcpServers = (result.candidate as any).mcpServers;
		expect(mcpServers).toHaveLength(2);
		const names = mcpServers.map((s: any) => s.name).sort();
		expect(names).toEqual(["context7", "docs-server"]);
	});

	it("pins MCP transport types", () => {
		const mcpServers = (result.candidate as any).mcpServers;
		const context7 = mcpServers.find((s: any) => s.name === "context7");
		const docsServer = mcpServers.find((s: any) => s.name === "docs-server");
		expect(context7.transport).toBe("stdio");
		expect(docsServer.transport).toBe("http");
	});

	it("consumed paths include CLAUDE.md, settings, and mcp files", () => {
		expect(result.consumedPaths).toContain("CLAUDE.md");
		expect(result.consumedPaths).toContain(".claude/settings.json");
		expect(result.consumedPaths).toContain(".claude/mcp.json");
	});

	it("preserved paths are empty for this fixture", () => {
		expect(result.preservedPaths).toHaveLength(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Tests: codex-native
// ═══════════════════════════════════════════════════════════════════════════════

describe("Inbound Regression: codex-native", () => {
	const context = makeContext(CODEX_CONTRACT, "my-codex-agent");
	const result = translateCodexNative(CODEX_FIXTURE, context);

	it("produces a candidate artifact", () => {
		expect(result.candidate).toBeDefined();
	});

	it("pins candidate.name", () => {
		expect(result.candidate!.name).toBe("my-codex-agent");
	});

	it("pins candidate.frontmatter.type", () => {
		expect((result.candidate as any).frontmatter.type).toBe("rule");
	});

	it("pins candidate.frontmatter.harnesses", () => {
		expect((result.candidate as any).frontmatter.harnesses).toEqual(["codex"]);
	});

	it("pins MCP server count and names", () => {
		const mcpServers = (result.candidate as any).mcpServers;
		expect(mcpServers).toHaveLength(2);
		const names = mcpServers.map((s: any) => s.name).sort();
		expect(names).toEqual(["analyzer", "formatter"]);
	});

	it("pins MCP server details", () => {
		const mcpServers = (result.candidate as any).mcpServers;
		const analyzer = mcpServers.find((s: any) => s.name === "analyzer");
		expect(analyzer.transport).toBe("stdio");
		expect(analyzer.command).toBe("python");
		expect(analyzer.args).toEqual(["analyze.py", "--verbose"]);
	});

	it("consumed paths include AGENTS.md and config.toml", () => {
		expect(result.consumedPaths).toContain("AGENTS.md");
		expect(result.consumedPaths).toContain(".codex/config.toml");
	});

	it("preserved paths are empty for this fixture", () => {
		expect(result.preservedPaths).toHaveLength(0);
	});
});
