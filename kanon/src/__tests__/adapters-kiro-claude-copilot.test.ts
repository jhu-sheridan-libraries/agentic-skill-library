import { beforeAll, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import type nunjucks from "nunjucks";
import { claudeCodeAdapter } from "../adapters/claude-code";
import { copilotAdapter } from "../adapters/copilot";
import { kiroAdapter } from "../adapters/kiro";
import { resolveKiroInclusion } from "../adapters/kiro-inclusion";
import type { CanonicalHook } from "../schemas";
import { createTemplateEnv } from "../template-engine";
import { makeArtifact, makeFrontmatter } from "./test-helpers";

// --- Shared test fixtures ---

const TEMPLATES_DIR = resolve(
	import.meta.dir,
	"../../templates/harness-adapters",
);
let templateEnv: nunjucks.Environment;

beforeAll(() => {
	templateEnv = createTemplateEnv(TEMPLATES_DIR);
});

function makeHook(overrides: Partial<CanonicalHook> = {}): CanonicalHook {
	return {
		name: "Test Hook",
		description: "A test hook",
		event: "agent_stop",
		action: { type: "run_command", command: "npm run lint" },
		...overrides,
	};
}

function expectFileContent(
	file: { content: string } | undefined,
	relativePath: string,
): string {
	expect(file).toBeDefined();
	if (!file) {
		throw new Error(`Expected generated file ${relativePath}`);
	}
	return file.content;
}

// =============================================================================
// Kiro Adapter Tests
// =============================================================================

describe("kiroAdapter", () => {
	/**
	 * Validates: Requirement 7.2
	 * Kiro adapter should translate canonical hooks into .kiro.hook JSON files
	 * with correct name, version, when, and then fields.
	 */
	test("generates correct hook JSON structure", () => {
		const artifact = makeArtifact({
			hooks: [
				makeHook({
					name: "Lint On Save",
					event: "file_edited",
					condition: { file_patterns: ["*.ts", "*.tsx"] },
					action: { type: "run_command", command: "npm run lint" },
				}),
			],
		});

		const result = kiroAdapter(artifact, templateEnv);
		const hookFile = result.files.find((f) =>
			f.relativePath.endsWith(".kiro.hook"),
		);
		expect(hookFile).toBeDefined();
		expect(hookFile?.relativePath).toBe("lint-on-save.kiro.hook");

		const hookJson = JSON.parse(
			expectFileContent(hookFile, "lint-on-save.kiro.hook"),
		);
		expect(hookJson.name).toBe("Lint On Save");
		expect(hookJson.version).toBe("1.0.0");
		expect(hookJson.when).toEqual({
			type: "fileEdited",
			patterns: ["*.ts", "*.tsx"],
		});
		expect(hookJson.then).toEqual({
			type: "runCommand",
			command: "npm run lint",
		});
	});

	/**
	 * Validates: Requirement 7.2
	 * Kiro adapter should generate ask_agent hooks with prompt in the then field.
	 */
	test("generates ask_agent hook with prompt", () => {
		const artifact = makeArtifact({
			hooks: [
				makeHook({
					name: "Review Code",
					event: "prompt_submit",
					action: {
						type: "ask_agent",
						prompt: "Review the code for best practices",
					},
				}),
			],
		});

		const result = kiroAdapter(artifact, templateEnv);
		const hookFile = result.files.find((f) =>
			f.relativePath.endsWith(".kiro.hook"),
		);
		expect(hookFile).toBeDefined();

		const hookJson = JSON.parse(
			expectFileContent(hookFile, "<generated>.kiro.hook"),
		);
		expect(hookJson.then).toEqual({
			type: "askAgent",
			prompt: "Review the code for best practices",
		});
	});

	/**
	 * Validates: Requirement 7.2
	 * Kiro adapter should map all canonical events to their Kiro equivalents.
	 */
	test("maps all canonical events to Kiro events", () => {
		const eventMap: Record<string, string> = {
			file_edited: "fileEdited",
			file_created: "fileCreated",
			file_deleted: "fileDeleted",
			agent_stop: "agentStop",
			prompt_submit: "promptSubmit",
			pre_tool_use: "preToolUse",
			post_tool_use: "postToolUse",
			pre_task: "preTaskExecution",
			post_task: "postTaskExecution",
			user_triggered: "userTriggered",
		};

		for (const [canonical, kiro] of Object.entries(eventMap)) {
			const artifact = makeArtifact({
				hooks: [
					makeHook({
						name: `Hook ${canonical}`,
						event: canonical as CanonicalHook["event"],
						action: { type: "run_command", command: "echo test" },
					}),
				],
			});

			const result = kiroAdapter(artifact, templateEnv);
			const hookFile = result.files.find((f) =>
				f.relativePath.endsWith(".kiro.hook"),
			);
			expect(hookFile).toBeDefined();

			const hookJson = JSON.parse(
				expectFileContent(hookFile, "<generated>.kiro.hook"),
			);
			expect(hookJson.when.type).toBe(kiro);
		}
	});

	/**
	 * Validates: Requirement 7.1
	 * Kiro adapter should generate a steering .md file with inclusion frontmatter.
	 */
	test("generates steering file with inclusion frontmatter", () => {
		const artifact = makeArtifact();
		const result = kiroAdapter(artifact, templateEnv);

		const steeringFile = result.files.find(
			(f) => f.relativePath === "test-artifact.md",
		);
		expect(steeringFile).toBeDefined();
		expect(steeringFile?.content).toContain("inclusion: always");
	});

	/**
	 * Validates: Requirement 7.3
	 * Kiro adapter should generate mcp.json from MCP server definitions.
	 */
	test("generates mcp.json from MCP servers", () => {
		const artifact = makeArtifact({
			mcpServers: [
				{
					name: "my-server",
					transport: "stdio" as const,
					command: "uvx",
					args: ["my-server@latest"],
					env: { LOG_LEVEL: "ERROR" },
				},
			],
		});

		const result = kiroAdapter(artifact, templateEnv);
		const mcpFile = result.files.find((f) => f.relativePath === "mcp.json");
		expect(mcpFile).toBeDefined();

		const mcpJson = JSON.parse(expectFileContent(mcpFile, "mcp.json"));
		expect(mcpJson.mcpServers["my-server"]).toEqual({
			command: "uvx",
			args: ["my-server@latest"],
			env: { LOG_LEVEL: "ERROR" },
		});
	});

	/**
	 * Validates: Requirement 7.4, 7.8
	 * Kiro adapter should generate POWER.md when harness-config.kiro.power is true.
	 */
	test("generates POWER.md when power config is true", () => {
		const artifact = makeArtifact({
			name: "test-power",
			frontmatter: makeFrontmatter({
				name: "test-power",
				displayName: "Test Power",
				description: "A test power",
				harnesses: ["kiro"],
				type: "power",
				"harness-config": { kiro: { power: true } },
			}),
		});

		const result = kiroAdapter(artifact, templateEnv);
		const powerFile = result.files.find((f) => f.relativePath === "POWER.md");
		expect(powerFile).toBeDefined();
		expect(powerFile?.content).toContain("test-power");

		// Steering file should be under steering/ subdirectory for powers
		const steeringFile = result.files.find(
			(f) => f.relativePath === "steering/test-power.md",
		);
		expect(steeringFile).toBeDefined();
	});

	/**
	 * Validates: Requirement 7.5
	 * Kiro adapter should copy workflows to steering/ when power mode is enabled.
	 */
	test("copies workflows to steering/ for powers", () => {
		const artifact = makeArtifact({
			frontmatter: makeFrontmatter({
				name: "test-power",
				harnesses: ["kiro"],
				type: "power",
				"harness-config": { kiro: { power: true } },
			}),
			workflows: [
				{
					name: "Setup",
					filename: "setup.md",
					content: "# Setup\nDo the setup.",
				},
			],
		});

		const result = kiroAdapter(artifact, templateEnv);
		const wfFile = result.files.find(
			(f) => f.relativePath === "steering/setup.md",
		);
		expect(wfFile).toBeDefined();
		expect(wfFile?.content).toBe("# Setup\nDo the setup.");
	});

	/**
	 * Validates: Requirement 7.6
	 * Kiro adapter should handle spec-hooks from harness-config.
	 */
	test("generates spec-hooks from harness-config", () => {
		const artifact = makeArtifact({
			frontmatter: makeFrontmatter({
				harnesses: ["kiro"],
				"harness-config": {
					kiro: {
						"spec-hooks": [
							{
								name: "Pre Task Check",
								version: "1.0.0",
								when: { type: "preTaskExecution" },
								// biome-ignore lint/suspicious/noThenProperty: hook schema uses "then" key
								then: {
									type: "askAgent",
									prompt: "Review task before starting",
								},
							},
						],
					},
				},
			}),
		});

		const result = kiroAdapter(artifact, templateEnv);
		const specHookFile = result.files.find(
			(f) => f.relativePath === "pre-task-check.kiro.hook",
		);
		expect(specHookFile).toBeDefined();

		const hookJson = JSON.parse(
			expectFileContent(specHookFile, "pre-task-check.kiro.hook"),
		);
		expect(hookJson.name).toBe("Pre Task Check");
		expect(hookJson.when.type).toBe("preTaskExecution");
	});

	/**
	 * Validates: Requirement 7.2
	 * Kiro adapter should include tool_types in the when field for pre/post tool use hooks.
	 */
	test("includes tool_types in hook when condition", () => {
		const artifact = makeArtifact({
			hooks: [
				makeHook({
					name: "Tool Guard",
					event: "pre_tool_use",
					condition: { tool_types: ["write", "shell"] },
					action: { type: "ask_agent", prompt: "Verify this operation" },
				}),
			],
		});

		const result = kiroAdapter(artifact, templateEnv);
		const hookFile = result.files.find((f) =>
			f.relativePath.endsWith(".kiro.hook"),
		);
		const hookJson = JSON.parse(
			expectFileContent(hookFile, "<generated>.kiro.hook"),
		);
		expect(hookJson.when.toolTypes).toEqual(["write", "shell"]);
	});
});

// =============================================================================
// Claude Code Adapter Tests
// =============================================================================

describe("claudeCodeAdapter", () => {
	/**
	 * Validates: Requirement 8.2
	 * Claude Code adapter should translate agent_stop + run_command hooks
	 * into .claude/settings.json Stop hook entries.
	 */
	test("translates agent_stop hooks to settings.json", () => {
		const artifact = makeArtifact({
			hooks: [
				makeHook({
					name: "Post Run Lint",
					event: "agent_stop",
					action: { type: "run_command", command: "npm run lint" },
				}),
				makeHook({
					name: "Post Run Test",
					event: "agent_stop",
					action: { type: "run_command", command: "npm test" },
				}),
			],
		});

		const result = claudeCodeAdapter(artifact, templateEnv);
		const settingsFile = result.files.find(
			(f) => f.relativePath === ".claude/settings.json",
		);
		expect(settingsFile).toBeDefined();

		const settings = JSON.parse(
			expectFileContent(settingsFile, ".claude/settings.json"),
		);
		expect(settings.hooks.stop).toHaveLength(2);
		expect(settings.hooks.stop[0]).toEqual({
			type: "command",
			command: "npm run lint",
		});
		expect(settings.hooks.stop[1]).toEqual({
			type: "command",
			command: "npm test",
		});
	});

	/**
	 * Validates: Requirement 8.3
	 * Claude Code adapter should skip unsupported events and emit warnings.
	 */
	test("skips unsupported events with warnings", () => {
		const artifact = makeArtifact({
			hooks: [
				makeHook({
					name: "File Hook",
					event: "file_edited",
					action: { type: "run_command", command: "echo hi" },
				}),
				makeHook({
					name: "Pre Task",
					event: "pre_task",
					action: { type: "ask_agent", prompt: "check" },
				}),
				makeHook({
					name: "Stop Hook",
					event: "agent_stop",
					action: { type: "run_command", command: "npm test" },
				}),
			],
		});

		const result = claudeCodeAdapter(artifact, templateEnv);

		// Should have warnings for file_edited and pre_task
		expect(result.warnings).toHaveLength(2);
		expect(result.warnings[0].message).toContain("file_edited");
		expect(result.warnings[0].message).toContain("not supported");
		expect(result.warnings[1].message).toContain("pre_task");

		// Should still generate settings.json for the supported agent_stop hook
		const settingsFile = result.files.find(
			(f) => f.relativePath === ".claude/settings.json",
		);
		expect(settingsFile).toBeDefined();
	});

	/**
	 * Validates: Requirement 8.1
	 * Claude Code adapter should generate CLAUDE.md with the artifact body.
	 */
	test("generates CLAUDE.md with artifact body", () => {
		const artifact = makeArtifact();
		const result = claudeCodeAdapter(artifact, templateEnv);

		const claudeFile = result.files.find((f) => f.relativePath === "CLAUDE.md");
		expect(claudeFile).toBeDefined();
		expect(claudeFile?.content).toContain("This is test content.");
	});

	/**
	 * Validates: Requirement 8.4
	 * Claude Code adapter should generate .claude/mcp.json from MCP servers.
	 */
	test("generates .claude/mcp.json from MCP servers", () => {
		const artifact = makeArtifact({
			mcpServers: [
				{
					name: "docs-server",
					transport: "stdio" as const,
					command: "uvx",
					args: ["docs-server@latest"],
					env: {},
				},
			],
		});

		const result = claudeCodeAdapter(artifact, templateEnv);
		const mcpFile = result.files.find(
			(f) => f.relativePath === ".claude/mcp.json",
		);
		expect(mcpFile).toBeDefined();

		const mcpJson = JSON.parse(expectFileContent(mcpFile, ".claude/mcp.json"));
		expect(mcpJson.mcpServers["docs-server"]).toEqual({
			command: "uvx",
			args: ["docs-server@latest"],
			env: {},
		});
	});

	/**
	 * Validates: Requirement 8.2
	 * Claude Code adapter should not generate settings.json when no agent_stop hooks exist.
	 */
	test("does not generate settings.json when no agent_stop hooks", () => {
		const artifact = makeArtifact({
			hooks: [
				makeHook({
					name: "File Hook",
					event: "file_edited",
					action: { type: "run_command", command: "echo hi" },
				}),
			],
		});

		const result = claudeCodeAdapter(artifact, templateEnv);
		const settingsFile = result.files.find(
			(f) => f.relativePath === ".claude/settings.json",
		);
		expect(settingsFile).toBeUndefined();
	});

	/**
	 * Validates: Requirement 21.1
	 * agent_stop + run_command hooks should produce the same command string in Claude Code output.
	 */
	test("preserves command string fidelity for agent_stop hooks", () => {
		const command = "npm run lint -- --fix && npm test";
		const artifact = makeArtifact({
			hooks: [
				makeHook({
					name: "Complex Command",
					event: "agent_stop",
					action: { type: "run_command", command },
				}),
			],
		});

		const result = claudeCodeAdapter(artifact, templateEnv);
		const settingsFile = result.files.find(
			(f) => f.relativePath === ".claude/settings.json",
		);
		const settings = JSON.parse(
			expectFileContent(settingsFile, ".claude/settings.json"),
		);
		expect(settings.hooks.stop[0].command).toBe(command);
	});
});

// =============================================================================
// Copilot Adapter Tests
// =============================================================================

describe("copilotAdapter", () => {
	/**
	 * Validates: Requirement 9.1
	 * Copilot adapter should generate .github/copilot-instructions.md.
	 */
	test("generates copilot-instructions.md with artifact body", () => {
		const artifact = makeArtifact();
		const result = copilotAdapter(artifact, templateEnv);

		const instructionsFile = result.files.find(
			(f) => f.relativePath === ".github/copilot-instructions.md",
		);
		expect(instructionsFile).toBeDefined();
		expect(instructionsFile?.content).toContain("This is test content.");
	});

	/**
	 * Validates: Requirement 9.2
	 * Copilot adapter should generate path-scoped instructions when file_patterns are set.
	 */
	test("generates path-scoped instructions from file_patterns", () => {
		const artifact = makeArtifact({
			name: "ts-standards",
			frontmatter: makeFrontmatter({
				name: "ts-standards",
				harnesses: ["copilot"],
				file_patterns: ["**/*.ts", "**/*.tsx"],
			}),
		});

		const result = copilotAdapter(artifact, templateEnv);
		const scopedFile = result.files.find(
			(f) =>
				f.relativePath === ".github/instructions/ts-standards.instructions.md",
		);
		expect(scopedFile).toBeDefined();
		expect(scopedFile?.content).toContain("applyTo");
		expect(scopedFile?.content).toContain("**/*.ts, **/*.tsx");
		expect(scopedFile?.content).toContain("Test Artifact");
	});

	/**
	 * Validates: Requirement 9.2
	 * Copilot adapter should generate path-scoped instructions from harness-config.copilot.path-scoped.
	 */
	test("generates path-scoped instructions from harness-config", () => {
		const artifact = makeArtifact({
			name: "py-standards",
			frontmatter: makeFrontmatter({
				name: "py-standards",
				harnesses: ["copilot"],
				"harness-config": {
					copilot: { "path-scoped": ["**/*.py", "**/*.pyi"] },
				},
			}),
		});

		const result = copilotAdapter(artifact, templateEnv);
		const scopedFile = result.files.find(
			(f) =>
				f.relativePath === ".github/instructions/py-standards.instructions.md",
		);
		expect(scopedFile).toBeDefined();
		expect(scopedFile?.content).toContain("applyTo");
		expect(scopedFile?.content).toContain("**/*.py, **/*.pyi");
		expect(scopedFile?.content).toContain("Test Artifact");
	});

	/**
	 * Validates: Requirement 9.3
	 * Copilot adapter should generate AGENTS.md when workflows exist.
	 */
	test("generates AGENTS.md when workflows exist", () => {
		const artifact = makeArtifact({
			workflows: [
				{
					name: "Deploy",
					filename: "deploy.md",
					content: "# Deploy\nDeploy steps.",
				},
			],
		});

		const result = copilotAdapter(artifact, templateEnv);
		const agentsFile = result.files.find((f) => f.relativePath === "AGENTS.md");
		expect(agentsFile).toBeDefined();
	});

	/**
	 * Validates: Requirement 9.3
	 * Copilot adapter should generate AGENTS.md when agents-md config is true.
	 */
	test("generates AGENTS.md when agents-md config is true", () => {
		const artifact = makeArtifact({
			frontmatter: makeFrontmatter({
				harnesses: ["copilot"],
				"harness-config": { copilot: { "agents-md": true } },
			}),
		});

		const result = copilotAdapter(artifact, templateEnv);
		const agentsFile = result.files.find((f) => f.relativePath === "AGENTS.md");
		expect(agentsFile).toBeDefined();
	});

	/**
	 * Validates: Requirement 9.4
	 * Copilot adapter should skip hooks and emit a warning.
	 */
	test("skips hooks with warning", () => {
		const artifact = makeArtifact({
			hooks: [
				makeHook({
					name: "Some Hook",
					event: "agent_stop",
					action: { type: "run_command", command: "echo hi" },
				}),
			],
		});

		const result = copilotAdapter(artifact, templateEnv);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0].harnessName).toBe("copilot");
		expect(result.warnings[0].message).toContain("does not support hooks");
	});

	/**
	 * Validates: Requirement 9.4
	 * Copilot adapter should not emit hook warning when no hooks exist.
	 */
	test("no warning when artifact has no hooks", () => {
		const artifact = makeArtifact({ hooks: [] });
		const result = copilotAdapter(artifact, templateEnv);
		expect(result.warnings).toHaveLength(0);
	});

	/**
	 * Validates: Requirement 9.2
	 * Copilot adapter should not generate path-scoped file when no patterns are set.
	 */
	test("does not generate path-scoped instructions without patterns", () => {
		const artifact = makeArtifact();
		const result = copilotAdapter(artifact, templateEnv);
		const scopedFile = result.files.find((f) =>
			f.relativePath.includes(".instructions.md"),
		);
		expect(scopedFile).toBeUndefined();
	});
});

// =============================================================================
// Kiro Progressive Steering Tests
// =============================================================================

describe("kiroAdapter — progressive steering", () => {
	/**
	 * Validates: Requirement 13.1
	 * Each of the three Kiro inclusion modes generates correct frontmatter.
	 */
	describe("inclusion mode frontmatter emission", () => {
		test('mode "always" emits inclusion: always', () => {
			const artifact = makeArtifact({
				frontmatter: makeFrontmatter({
					harnesses: ["kiro"],
					"harness-config": { kiro: { inclusion: "always" } },
				}),
			});

			const result = kiroAdapter(artifact, templateEnv);
			const steeringFile = result.files.find(
				(f) => f.relativePath === "test-artifact.md",
			);
			expect(steeringFile).toBeDefined();
			expect(steeringFile?.content).toContain("inclusion: always");
			expect(steeringFile?.content).not.toContain("fileMatchPattern");
		});

		test('mode "fileMatch" emits inclusion: fileMatch and fileMatchPattern', () => {
			const artifact = makeArtifact({
				frontmatter: makeFrontmatter({
					harnesses: ["kiro"],
					"harness-config": {
						kiro: { inclusion: "fileMatch", fileMatchPattern: "src/**/*.ts" },
					},
				}),
			});

			const result = kiroAdapter(artifact, templateEnv);
			const steeringFile = result.files.find(
				(f) => f.relativePath === "test-artifact.md",
			);
			expect(steeringFile).toBeDefined();
			expect(steeringFile?.content).toContain("inclusion: fileMatch");
			expect(steeringFile?.content).toContain(
				'fileMatchPattern: "src/**/*.ts"',
			);
		});

		test('mode "manual" emits inclusion: manual', () => {
			const artifact = makeArtifact({
				frontmatter: makeFrontmatter({
					harnesses: ["kiro"],
					"harness-config": { kiro: { inclusion: "manual" } },
				}),
			});

			const result = kiroAdapter(artifact, templateEnv);
			const steeringFile = result.files.find(
				(f) => f.relativePath === "test-artifact.md",
			);
			expect(steeringFile).toBeDefined();
			expect(steeringFile?.content).toContain("inclusion: manual");
			expect(steeringFile?.content).not.toContain("fileMatchPattern");
		});
	});

	/**
	 * Validates: Requirement 2.6
	 * Precedence: harness-config.kiro.inclusion overrides top-level inclusion.
	 */
	test("precedence: harness-config.kiro.inclusion overrides top-level", () => {
		const artifact = makeArtifact({
			frontmatter: makeFrontmatter({
				harnesses: ["kiro"],
				inclusion: "fileMatch",
				"harness-config": { kiro: { inclusion: "manual" } },
			}),
		});

		const result = kiroAdapter(artifact, templateEnv);
		const steeringFile = result.files.find(
			(f) => f.relativePath === "test-artifact.md",
		);
		expect(steeringFile).toBeDefined();
		expect(steeringFile?.content).toContain("inclusion: manual");
		expect(steeringFile?.content).not.toContain("fileMatchPattern");

		// Also verify through the resolver directly
		const resolved = resolveKiroInclusion(artifact);
		expect(resolved.mode).toBe("manual");
		expect(resolved.source).toBe("harness-config");
	});

	/**
	 * Validates: Requirement 2.4 (Requirement 13.1 — suppression rule)
	 * fileMatchPattern is suppressed when mode is "always" even if configured.
	 */
	test("suppression: mode always with fileMatchPattern configured → no pattern in output", () => {
		const artifact = makeArtifact({
			frontmatter: makeFrontmatter({
				harnesses: ["kiro"],
				"harness-config": {
					kiro: { inclusion: "always", fileMatchPattern: "src/**" },
				},
			}),
		});

		const result = kiroAdapter(artifact, templateEnv);
		const steeringFile = result.files.find(
			(f) => f.relativePath === "test-artifact.md",
		);
		expect(steeringFile).toBeDefined();
		expect(steeringFile?.content).toContain("inclusion: always");
		expect(steeringFile?.content).not.toContain("fileMatchPattern");
	});

	/**
	 * Validates: Requirement 2.4 (Requirement 13.1 — suppression rule)
	 * fileMatchPattern is suppressed when mode is "manual" even if configured.
	 */
	test("suppression: mode manual with fileMatchPattern configured → no pattern in output", () => {
		const artifact = makeArtifact({
			frontmatter: makeFrontmatter({
				harnesses: ["kiro"],
				"harness-config": {
					kiro: { inclusion: "manual", fileMatchPattern: "src/**" },
				},
			}),
		});

		const result = kiroAdapter(artifact, templateEnv);
		const steeringFile = result.files.find(
			(f) => f.relativePath === "test-artifact.md",
		);
		expect(steeringFile).toBeDefined();
		expect(steeringFile?.content).toContain("inclusion: manual");
		expect(steeringFile?.content).not.toContain("fileMatchPattern");
	});

	/**
	 * Validates: Requirement 2.6
	 * Power-format applies the same inclusion precedence for each mode.
	 */
	describe("power-format with each mode", () => {
		test('power-format: mode "always" → steering/<name>.md has inclusion: always', () => {
			const artifact = makeArtifact({
				name: "my-power",
				frontmatter: makeFrontmatter({
					name: "my-power",
					harnesses: ["kiro"],
					type: "power",
					"harness-config": {
						kiro: { power: true, inclusion: "always" },
					},
				}),
			});

			const result = kiroAdapter(artifact, templateEnv);
			const steeringFile = result.files.find(
				(f) => f.relativePath === "steering/my-power.md",
			);
			expect(steeringFile).toBeDefined();
			expect(steeringFile?.content).toContain("inclusion: always");
		});

		test('power-format: mode "fileMatch" → steering/<name>.md has correct frontmatter', () => {
			const artifact = makeArtifact({
				name: "my-power",
				frontmatter: makeFrontmatter({
					name: "my-power",
					harnesses: ["kiro"],
					type: "power",
					"harness-config": {
						kiro: {
							power: true,
							inclusion: "fileMatch",
							fileMatchPattern: "**/*.py",
						},
					},
				}),
			});

			const result = kiroAdapter(artifact, templateEnv);
			const steeringFile = result.files.find(
				(f) => f.relativePath === "steering/my-power.md",
			);
			expect(steeringFile).toBeDefined();
			expect(steeringFile?.content).toContain("inclusion: fileMatch");
			expect(steeringFile?.content).toContain('fileMatchPattern: "**/*.py"');
		});

		test('power-format: mode "manual" → steering/<name>.md has inclusion: manual', () => {
			const artifact = makeArtifact({
				name: "my-power",
				frontmatter: makeFrontmatter({
					name: "my-power",
					harnesses: ["kiro"],
					type: "power",
					"harness-config": {
						kiro: { power: true, inclusion: "manual" },
					},
				}),
			});

			const result = kiroAdapter(artifact, templateEnv);
			const steeringFile = result.files.find(
				(f) => f.relativePath === "steering/my-power.md",
			);
			expect(steeringFile).toBeDefined();
			expect(steeringFile?.content).toContain("inclusion: manual");
			expect(steeringFile?.content).not.toContain("fileMatchPattern");
		});
	});

	/**
	 * Validates: Requirement 11.1
	 * Audit comment for each mode is correctly formatted.
	 */
	describe("audit comment text", () => {
		test('mode "always" → audit comment: <!-- forge:kiro-inclusion: always -->', () => {
			const artifact = makeArtifact({
				frontmatter: makeFrontmatter({
					harnesses: ["kiro"],
					"harness-config": { kiro: { inclusion: "always" } },
				}),
			});

			const result = kiroAdapter(artifact, templateEnv);
			const steeringFile = result.files.find(
				(f) => f.relativePath === "test-artifact.md",
			);
			expect(steeringFile?.content).toContain(
				"<!-- forge:kiro-inclusion: always -->",
			);
		});

		test('mode "fileMatch" + pattern → audit comment includes fileMatchPattern', () => {
			const artifact = makeArtifact({
				frontmatter: makeFrontmatter({
					harnesses: ["kiro"],
					"harness-config": {
						kiro: { inclusion: "fileMatch", fileMatchPattern: "src/**" },
					},
				}),
			});

			const result = kiroAdapter(artifact, templateEnv);
			const steeringFile = result.files.find(
				(f) => f.relativePath === "test-artifact.md",
			);
			expect(steeringFile?.content).toContain(
				"<!-- forge:kiro-inclusion: fileMatch fileMatchPattern=src/** -->",
			);
		});

		test('mode "manual" → audit comment: <!-- forge:kiro-inclusion: manual -->', () => {
			const artifact = makeArtifact({
				frontmatter: makeFrontmatter({
					harnesses: ["kiro"],
					"harness-config": { kiro: { inclusion: "manual" } },
				}),
			});

			const result = kiroAdapter(artifact, templateEnv);
			const steeringFile = result.files.find(
				(f) => f.relativePath === "test-artifact.md",
			);
			expect(steeringFile?.content).toContain(
				"<!-- forge:kiro-inclusion: manual -->",
			);
		});
	});

	/**
	 * Validates: Requirement 10.3
	 * Power-format workflow file without inclusion triggers a warning.
	 */
	test("workflow-file warning: missing inclusion emits AdapterWarning", () => {
		const artifact = makeArtifact({
			name: "my-power",
			frontmatter: makeFrontmatter({
				name: "my-power",
				harnesses: ["kiro"],
				type: "power",
				"harness-config": { kiro: { power: true, inclusion: "manual" } },
			}),
			workflows: [
				{
					name: "Setup",
					filename: "setup.md",
					content: "# Setup\nDo the setup steps.",
				},
			],
		});

		const result = kiroAdapter(artifact, templateEnv);
		expect(result.warnings.length).toBeGreaterThan(0);
		const wfWarning = result.warnings.find((w) =>
			w.message.includes("setup.md"),
		);
		expect(wfWarning).toBeDefined();
		expect(wfWarning?.message).toContain("missing an inclusion mode");
	});

	/**
	 * Validates: Requirement 10.4
	 * progressiveWorkflowsStrict: workflow with inclusion "always" → error + file omitted.
	 */
	test("progressiveWorkflowsStrict: always-inclusion workflow → error + omitted", () => {
		const artifact = makeArtifact({
			name: "strict-power",
			frontmatter: makeFrontmatter({
				name: "strict-power",
				harnesses: ["kiro"],
				type: "power",
				"harness-config": {
					kiro: {
						power: true,
						inclusion: "manual",
						progressiveWorkflowsStrict: true,
					},
				},
			}),
			workflows: [
				{
					name: "Bad Workflow",
					filename: "bad-workflow.md",
					content:
						"---\ninclusion: always\n---\n# Bad Workflow\nThis is always-on.",
				},
			],
		});

		const result = kiroAdapter(artifact, templateEnv);

		// The workflow file should be omitted from output
		const wfFile = result.files.find(
			(f) => f.relativePath === "steering/bad-workflow.md",
		);
		expect(wfFile).toBeUndefined();

		// An error should be emitted
		expect(result.errors).toBeDefined();
		expect(result.errors?.length).toBeGreaterThan(0);
		const wfError = result.errors?.find((e) =>
			e.message.includes("bad-workflow.md"),
		);
		expect(wfError).toBeDefined();
		expect(wfError?.artifactName).toBe("strict-power");
		expect(wfError?.harnessName).toBe("kiro");
	});
});
