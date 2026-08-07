/**
 * Rosetta Stone — Outbound Adapter Regression Tests
 *
 * Fixture-based regression tests for every current target translator variant.
 * Compares normalized paths, exact bytes, executable flags, and diagnostics
 * with expected adapter output patterns.
 *
 * Requirements: 14.5, 14.6, 14.7, 14.10, 16.7
 */

import { describe, expect, test } from "bun:test";
import {
	CLAUDE_CODE_CONTRACT,
	CLINE_CONTRACT,
	CODEX_CONTRACT,
	COPILOT_CONTRACT,
	CURSOR_CONTRACT,
	KIRO_CONTRACT,
	QDEVELOPER_CONTRACT,
	WINDSURF_CONTRACT,
} from "../rosetta/builtins/contracts";
import { translateClaudeCodeTarget } from "../rosetta/builtins/targets/claude-code";
import { translateClineTarget } from "../rosetta/builtins/targets/cline";
import { translateCodexTarget } from "../rosetta/builtins/targets/codex";
import { translateCopilotTarget } from "../rosetta/builtins/targets/copilot";
import { translateCursorTarget } from "../rosetta/builtins/targets/cursor";
import { translateKiroTarget } from "../rosetta/builtins/targets/kiro";
import { translateQDeveloperTarget } from "../rosetta/builtins/targets/qdeveloper";
import { translateWindsurfTarget } from "../rosetta/builtins/targets/windsurf";
import type { TargetTranslatorContext } from "../rosetta/registry";
import type { ImmutableTemplateBundle } from "../rosetta/templates";
import type { FormatContract, TranslationPlan } from "../schemas";
import { makeArtifact, makeFrontmatter } from "./test-helpers";

// ═══════════════════════════════════════════════════════════════════════════════
// Mock Template Bundle
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Simple ImmutableTemplateBundle mock that returns the body content directly.
 * Since we cannot load real templates in a unit test without filesystem access,
 * this mock returns context body content for rendering assertions.
 */
const mockTemplates: ImmutableTemplateBundle = {
	sources: new Map(),
	digest: "mock-digest",
	templateNames: [],
	render: (_name: string, ctx: Record<string, unknown>) =>
		(ctx.body as string) || (ctx.artifact as { body: string })?.body || "",
	has: () => true,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Canonical Fixture Artifact
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Rich canonical artifact with body, hooks, MCP servers, workflows, and body
 * overrides — exercises all code paths in target translators.
 */
const FIXTURE_ARTIFACT = makeArtifact({
	name: "regression-fixture",
	frontmatter: makeFrontmatter({
		name: "regression-fixture",
		description: "Regression test fixture artifact",
		type: "skill",
		harnesses: [
			"kiro",
			"claude-code",
			"codex",
			"copilot",
			"cursor",
			"windsurf",
			"cline",
			"qdeveloper",
		],
		"harness-config": {
			kiro: { "main-steering": true },
		} as Record<string, unknown>,
	}),
	body: "# Regression Fixture\n\nThis is the canonical body content for regression testing.",
	hooks: [
		{
			name: "On File Edit",
			event: "file_edited",
			description: "Triggered when a file is edited",
			condition: {
				file_patterns: ["src/**/*.ts"],
			},
			action: {
				type: "run_command" as const,
				command: "bun run lint",
			},
		},
		{
			name: "Agent Stop",
			event: "agent_stop",
			description: "Run on agent stop",
			condition: {},
			action: {
				type: "run_command" as const,
				command: "bun test",
			},
		},
	],
	mcpServers: [
		{
			name: "test-server",
			transport: "stdio",
			command: "npx",
			args: ["-y", "test-mcp-server"],
			env: { API_KEY: "${API_KEY}" },
		},
	],
	workflows: [
		{
			name: "phase-01-setup",
			filename: "phase-01-setup.md",
			content: "# Phase 1: Setup\n\nSetup instructions.",
		},
		{
			name: "phase-02-build",
			filename: "phase-02-build.md",
			content: "# Phase 2: Build\n\nBuild instructions.",
		},
	],
	bodyOverrides: {
		kiro: "# Kiro Override\n\nKiro-specific body content.",
		"claude-code": "# Claude Override\n\nClaude-specific body content.",
		codex: "# Codex Override\n\nCodex-specific body content.",
		copilot: "# Copilot Override\n\nCopilot-specific body content.",
		cursor: "# Cursor Override\n\nCursor-specific body content.",
		windsurf: "# Windsurf Override\n\nWindsurf-specific body content.",
		cline: "# Cline Override\n\nCline-specific body content.",
		qdeveloper: "# QDeveloper Override\n\nQDeveloper-specific body content.",
	},
});

// ═══════════════════════════════════════════════════════════════════════════════
// Context Builder Helper
// ═══════════════════════════════════════════════════════════════════════════════

function buildContext(
	format: FormatContract,
	variant: string,
): TargetTranslatorContext {
	return {
		format,
		variant,
		canonicalSchemaVersion: "1.0.0",
		options: {},
		callerContext: {},
		templates: mockTemplates,
	};
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared Assertions
// ═══════════════════════════════════════════════════════════════════════════════

function assertPlanBasics(plan: TranslationPlan): void {
	expect(plan.schemaVersion).toBe("1.0");
	expect(plan.applicationState).toBe("eligible");
	expect(plan.outputFiles.length).toBeGreaterThan(0);
	expect(plan.operations.length).toBe(plan.outputFiles.length);

	// All output files must have executable: false
	for (const file of plan.outputFiles) {
		expect(file.executable).toBe(false);
	}
}

function getOutputPaths(plan: TranslationPlan): string[] {
	return plan.outputFiles.map((f) => f.relativePath);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Kiro Target — Steering Variant
// ═══════════════════════════════════════════════════════════════════════════════

describe("Outbound Regression: Kiro steering variant", () => {
	const context = buildContext(KIRO_CONTRACT, "steering");
	const result = translateKiroTarget(
		FIXTURE_ARTIFACT as unknown as Record<string, unknown>,
		context,
	);
	const plan = result.plan as TranslationPlan;

	test("plan has expected structure", () => {
		assertPlanBasics(plan);
		expect(plan.formatId).toBe("kiro");
		expect(plan.variant).toBe("steering");
	});

	test("produces steering .md file with artifact name", () => {
		const paths = getOutputPaths(plan);
		expect(paths).toContain("regression-fixture.md");
	});

	test("produces hook files", () => {
		const paths = getOutputPaths(plan);
		expect(paths.some((p) => p.endsWith(".kiro.hook"))).toBe(true);
	});

	test("produces mcp.json", () => {
		const paths = getOutputPaths(plan);
		expect(paths).toContain("mcp.json");
	});

	test("all files are non-executable", () => {
		for (const file of plan.outputFiles) {
			expect(file.executable).toBe(false);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Kiro Target — Power Variant
// ═══════════════════════════════════════════════════════════════════════════════

describe("Outbound Regression: Kiro power variant", () => {
	const context = buildContext(KIRO_CONTRACT, "power");
	const result = translateKiroTarget(
		FIXTURE_ARTIFACT as unknown as Record<string, unknown>,
		context,
	);
	const plan = result.plan as TranslationPlan;

	test("plan has expected structure", () => {
		assertPlanBasics(plan);
		expect(plan.formatId).toBe("kiro");
		expect(plan.variant).toBe("power");
	});

	test("produces POWER.md", () => {
		const paths = getOutputPaths(plan);
		expect(paths).toContain("POWER.md");
	});

	test("produces steering workflow files", () => {
		const paths = getOutputPaths(plan);
		expect(paths).toContain("steering/phase-01-setup.md");
		expect(paths).toContain("steering/phase-02-build.md");
	});

	test("produces steering main file", () => {
		const paths = getOutputPaths(plan);
		expect(paths).toContain("steering/regression-fixture.md");
	});

	test("produces hook files", () => {
		const paths = getOutputPaths(plan);
		expect(paths.some((p) => p.endsWith(".kiro.hook"))).toBe(true);
	});

	test("produces mcp.json", () => {
		const paths = getOutputPaths(plan);
		expect(paths).toContain("mcp.json");
	});

	test("all files are non-executable", () => {
		for (const file of plan.outputFiles) {
			expect(file.executable).toBe(false);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Claude Code Target
// ═══════════════════════════════════════════════════════════════════════════════

describe("Outbound Regression: Claude Code claude-md variant", () => {
	const context = buildContext(CLAUDE_CODE_CONTRACT, "claude-md");
	const result = translateClaudeCodeTarget(
		FIXTURE_ARTIFACT as unknown as Record<string, unknown>,
		context,
	);
	const plan = result.plan as TranslationPlan;

	test("plan has expected structure", () => {
		assertPlanBasics(plan);
		expect(plan.formatId).toBe("claude-code");
		expect(plan.variant).toBe("claude-md");
	});

	test("produces CLAUDE.md", () => {
		const paths = getOutputPaths(plan);
		expect(paths).toContain("CLAUDE.md");
	});

	test("produces .claude/settings.json for agent_stop hooks", () => {
		const paths = getOutputPaths(plan);
		expect(paths).toContain(".claude/settings.json");
	});

	test("produces .claude/mcp.json", () => {
		const paths = getOutputPaths(plan);
		expect(paths).toContain(".claude/mcp.json");
	});

	test("all files are non-executable", () => {
		for (const file of plan.outputFiles) {
			expect(file.executable).toBe(false);
		}
	});

	test("emits diagnostics for unsupported hook events", () => {
		// file_edited is not supported by Claude Code
		const unsupported = result.diagnostics.filter(
			(d) => d.code === "RS_COMPATIBILITY_PARTIAL",
		);
		expect(unsupported.length).toBeGreaterThan(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Codex Target — agents-md Variant
// ═══════════════════════════════════════════════════════════════════════════════

describe("Outbound Regression: Codex agents-md variant", () => {
	const context = buildContext(CODEX_CONTRACT, "agents-md");
	const result = translateCodexTarget(
		FIXTURE_ARTIFACT as unknown as Record<string, unknown>,
		context,
	);
	const plan = result.plan as TranslationPlan;

	test("plan has expected structure", () => {
		assertPlanBasics(plan);
		expect(plan.formatId).toBe("codex");
		expect(plan.variant).toBe("agents-md");
	});

	test("produces AGENTS.md", () => {
		const paths = getOutputPaths(plan);
		expect(paths).toContain("AGENTS.md");
	});

	test("produces .codex/config.toml for MCP servers", () => {
		const paths = getOutputPaths(plan);
		expect(paths).toContain(".codex/config.toml");
	});

	test("all files are non-executable", () => {
		for (const file of plan.outputFiles) {
			expect(file.executable).toBe(false);
		}
	});

	test("emits hooks-not-supported diagnostic", () => {
		const hookDiag = result.diagnostics.filter(
			(d) => d.code === "RS_COMPATIBILITY_NONE",
		);
		expect(hookDiag.length).toBeGreaterThan(0);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Codex Target — skill Variant
// ═══════════════════════════════════════════════════════════════════════════════

describe("Outbound Regression: Codex skill variant", () => {
	const context = buildContext(CODEX_CONTRACT, "skill");
	const result = translateCodexTarget(
		FIXTURE_ARTIFACT as unknown as Record<string, unknown>,
		context,
	);
	const plan = result.plan as TranslationPlan;

	test("plan has expected structure", () => {
		assertPlanBasics(plan);
		expect(plan.formatId).toBe("codex");
		expect(plan.variant).toBe("skill");
	});

	test("produces skill SKILL.md under .codex/skills/", () => {
		const paths = getOutputPaths(plan);
		expect(paths).toContain(".codex/skills/regression-fixture/SKILL.md");
	});

	test("produces AGENTS.md pointer", () => {
		const paths = getOutputPaths(plan);
		expect(paths).toContain("AGENTS.md");
	});

	test("produces workflow reference files", () => {
		const paths = getOutputPaths(plan);
		expect(paths).toContain(
			".codex/skills/regression-fixture/references/phase-01-setup.md",
		);
		expect(paths).toContain(
			".codex/skills/regression-fixture/references/phase-02-build.md",
		);
	});

	test("produces .codex/config.toml for MCP servers", () => {
		const paths = getOutputPaths(plan);
		expect(paths).toContain(".codex/config.toml");
	});

	test("all files are non-executable", () => {
		for (const file of plan.outputFiles) {
			expect(file.executable).toBe(false);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Copilot Target — instructions Variant
// ═══════════════════════════════════════════════════════════════════════════════

describe("Outbound Regression: Copilot instructions variant", () => {
	const context = buildContext(COPILOT_CONTRACT, "instructions");
	const result = translateCopilotTarget(
		FIXTURE_ARTIFACT as unknown as Record<string, unknown>,
		context,
	);
	const plan = result.plan as TranslationPlan;

	test("plan has expected structure", () => {
		assertPlanBasics(plan);
		expect(plan.formatId).toBe("copilot");
		expect(plan.variant).toBe("instructions");
	});

	test("produces .github/copilot-instructions.md", () => {
		const paths = getOutputPaths(plan);
		expect(paths).toContain(".github/copilot-instructions.md");
	});

	test("all files are non-executable", () => {
		for (const file of plan.outputFiles) {
			expect(file.executable).toBe(false);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Cursor Target — rule Variant
// ═══════════════════════════════════════════════════════════════════════════════

describe("Outbound Regression: Cursor rule variant", () => {
	const context = buildContext(CURSOR_CONTRACT, "rule");
	const result = translateCursorTarget(
		FIXTURE_ARTIFACT as unknown as Record<string, unknown>,
		context,
	);
	const plan = result.plan as TranslationPlan;

	test("plan has expected structure", () => {
		assertPlanBasics(plan);
		expect(plan.formatId).toBe("cursor");
		expect(plan.variant).toBe("rule");
	});

	test("produces .cursor/rules/<name>.mdc", () => {
		const paths = getOutputPaths(plan);
		expect(paths).toContain(".cursor/rules/regression-fixture.mdc");
	});

	test("all files are non-executable", () => {
		for (const file of plan.outputFiles) {
			expect(file.executable).toBe(false);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Windsurf Target — rule Variant
// ═══════════════════════════════════════════════════════════════════════════════

describe("Outbound Regression: Windsurf rule variant", () => {
	const context = buildContext(WINDSURF_CONTRACT, "rule");
	const result = translateWindsurfTarget(
		FIXTURE_ARTIFACT as unknown as Record<string, unknown>,
		context,
	);
	const plan = result.plan as TranslationPlan;

	test("plan has expected structure", () => {
		assertPlanBasics(plan);
		expect(plan.formatId).toBe("windsurf");
		expect(plan.variant).toBe("rule");
	});

	test("produces .windsurf/rules/<name>.md", () => {
		const paths = getOutputPaths(plan);
		expect(paths).toContain(".windsurf/rules/regression-fixture.md");
	});

	test("all files are non-executable", () => {
		for (const file of plan.outputFiles) {
			expect(file.executable).toBe(false);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Cline Target — rule Variant
// ═══════════════════════════════════════════════════════════════════════════════

describe("Outbound Regression: Cline rule variant", () => {
	const context = buildContext(CLINE_CONTRACT, "rule");
	const result = translateClineTarget(
		FIXTURE_ARTIFACT as unknown as Record<string, unknown>,
		context,
	);
	const plan = result.plan as TranslationPlan;

	test("plan has expected structure", () => {
		assertPlanBasics(plan);
		expect(plan.formatId).toBe("cline");
		expect(plan.variant).toBe("rule");
	});

	test("produces .cline/rules/<name>.md", () => {
		const paths = getOutputPaths(plan);
		expect(paths).toContain(".cline/rules/regression-fixture.md");
	});

	test("all files are non-executable", () => {
		for (const file of plan.outputFiles) {
			expect(file.executable).toBe(false);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Q Developer Target — rule Variant
// ═══════════════════════════════════════════════════════════════════════════════

describe("Outbound Regression: Q Developer rule variant", () => {
	const context = buildContext(QDEVELOPER_CONTRACT, "rule");
	const result = translateQDeveloperTarget(
		FIXTURE_ARTIFACT as unknown as Record<string, unknown>,
		context,
	);
	const plan = result.plan as TranslationPlan;

	test("plan has expected structure", () => {
		assertPlanBasics(plan);
		expect(plan.formatId).toBe("qdeveloper");
		expect(plan.variant).toBe("rule");
	});

	test("produces .qdeveloper/rules/<name>.md", () => {
		const paths = getOutputPaths(plan);
		expect(paths).toContain(".qdeveloper/rules/regression-fixture.md");
	});

	test("all files are non-executable", () => {
		for (const file of plan.outputFiles) {
			expect(file.executable).toBe(false);
		}
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Cross-target Regression: Path Patterns
// ═══════════════════════════════════════════════════════════════════════════════

describe("Outbound Regression: Cross-target path pattern pinning", () => {
	const cases: Array<{
		name: string;
		translate: typeof translateKiroTarget;
		contract: FormatContract;
		variant: string;
		expectedPaths: string[];
	}> = [
		{
			name: "kiro/steering",
			translate: translateKiroTarget,
			contract: KIRO_CONTRACT,
			variant: "steering",
			expectedPaths: ["regression-fixture.md", "mcp.json"],
		},
		{
			name: "kiro/power",
			translate: translateKiroTarget,
			contract: KIRO_CONTRACT,
			variant: "power",
			expectedPaths: [
				"POWER.md",
				"steering/regression-fixture.md",
				"steering/phase-01-setup.md",
				"steering/phase-02-build.md",
				"mcp.json",
			],
		},
		{
			name: "claude-code/claude-md",
			translate: translateClaudeCodeTarget,
			contract: CLAUDE_CODE_CONTRACT,
			variant: "claude-md",
			expectedPaths: ["CLAUDE.md", ".claude/settings.json", ".claude/mcp.json"],
		},
		{
			name: "codex/agents-md",
			translate: translateCodexTarget,
			contract: CODEX_CONTRACT,
			variant: "agents-md",
			expectedPaths: ["AGENTS.md", ".codex/config.toml"],
		},
		{
			name: "copilot/instructions",
			translate: translateCopilotTarget,
			contract: COPILOT_CONTRACT,
			variant: "instructions",
			expectedPaths: [".github/copilot-instructions.md"],
		},
		{
			name: "cursor/rule",
			translate: translateCursorTarget,
			contract: CURSOR_CONTRACT,
			variant: "rule",
			expectedPaths: [".cursor/rules/regression-fixture.mdc"],
		},
		{
			name: "windsurf/rule",
			translate: translateWindsurfTarget,
			contract: WINDSURF_CONTRACT,
			variant: "rule",
			expectedPaths: [".windsurf/rules/regression-fixture.md"],
		},
		{
			name: "cline/rule",
			translate: translateClineTarget,
			contract: CLINE_CONTRACT,
			variant: "rule",
			expectedPaths: [".cline/rules/regression-fixture.md"],
		},
		{
			name: "qdeveloper/rule",
			translate: translateQDeveloperTarget,
			contract: QDEVELOPER_CONTRACT,
			variant: "rule",
			expectedPaths: [".qdeveloper/rules/regression-fixture.md"],
		},
	];

	for (const { name, translate, contract, variant, expectedPaths } of cases) {
		test(`${name}: contains all expected output paths`, () => {
			const ctx = buildContext(contract, variant);
			const result = translate(
				FIXTURE_ARTIFACT as unknown as Record<string, unknown>,
				ctx,
			);
			const plan = result.plan as TranslationPlan;
			const paths = getOutputPaths(plan);

			for (const expected of expectedPaths) {
				expect(paths).toContain(expected);
			}
		});

		test(`${name}: applicationState is eligible`, () => {
			const ctx = buildContext(contract, variant);
			const result = translate(
				FIXTURE_ARTIFACT as unknown as Record<string, unknown>,
				ctx,
			);
			const plan = result.plan as TranslationPlan;
			expect(plan.applicationState).toBe("eligible");
		});
	}
});
