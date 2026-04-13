import { beforeAll, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import type nunjucks from "nunjucks";
import { clineAdapter } from "../adapters/cline";
import { cursorAdapter } from "../adapters/cursor";
import { qdeveloperAdapter } from "../adapters/qdeveloper";
import { windsurfAdapter } from "../adapters/windsurf";
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

// =============================================================================
// Cursor Adapter Tests
// =============================================================================

describe("cursorAdapter", () => {
	/**
	 * Validates: Requirement 10.4
	 * Cursor adapter should map canonical inclusion modes to Cursor modes:
	 * always → always, fileMatch → auto, manual → agent-requested
	 */
	test("maps always inclusion to always", () => {
		const artifact = makeArtifact({
			frontmatter: makeFrontmatter({ inclusion: "always" }),
		});
		const result = cursorAdapter(artifact, templateEnv);

		const ruleFile = result.files.find(
			(f) => f.relativePath === ".cursor/rules/test-artifact.md",
		);
		expect(ruleFile).toBeDefined();
		expect(ruleFile?.content).toContain("inclusion: always");
	});

	test("maps fileMatch inclusion to auto", () => {
		const artifact = makeArtifact({
			frontmatter: makeFrontmatter({ inclusion: "fileMatch" }),
		});
		const result = cursorAdapter(artifact, templateEnv);

		const ruleFile = result.files.find(
			(f) => f.relativePath === ".cursor/rules/test-artifact.md",
		);
		expect(ruleFile).toBeDefined();
		expect(ruleFile?.content).toContain("inclusion: auto");
	});

	test("maps manual inclusion to agent-requested", () => {
		const artifact = makeArtifact({
			frontmatter: makeFrontmatter({ inclusion: "manual" }),
		});
		const result = cursorAdapter(artifact, templateEnv);

		const ruleFile = result.files.find(
			(f) => f.relativePath === ".cursor/rules/test-artifact.md",
		);
		expect(ruleFile).toBeDefined();
		expect(ruleFile?.content).toContain("inclusion: agent-requested");
	});

	/**
	 * Validates: Requirement 10.1
	 * Cursor adapter should respect harness-config.cursor.inclusion override.
	 */
	test("uses harness-config.cursor.inclusion override", () => {
		const artifact = makeArtifact({
			frontmatter: makeFrontmatter({
				inclusion: "always",
				"harness-config": { cursor: { inclusion: "manual" } },
			}),
		});
		const result = cursorAdapter(artifact, templateEnv);

		const ruleFile = result.files.find(
			(f) => f.relativePath === ".cursor/rules/test-artifact.md",
		);
		expect(ruleFile).toBeDefined();
		expect(ruleFile?.content).toContain("inclusion: agent-requested");
	});

	/**
	 * Validates: Requirement 10.1
	 * Cursor adapter should generate rule files at .cursor/rules/<artifact>.md with body content.
	 */
	test("generates rule file with artifact body", () => {
		const artifact = makeArtifact();
		const result = cursorAdapter(artifact, templateEnv);

		const ruleFile = result.files.find(
			(f) => f.relativePath === ".cursor/rules/test-artifact.md",
		);
		expect(ruleFile).toBeDefined();
		expect(ruleFile?.content).toContain("This is test content.");
	});

	/**
	 * Validates: Requirement 10.2
	 * Cursor adapter should generate .cursor/mcp.json from MCP server definitions.
	 */
	test("generates .cursor/mcp.json from MCP servers", () => {
		const artifact = makeArtifact({
			mcpServers: [
				{
					name: "my-server",
					command: "uvx",
					args: ["my-server@latest"],
					env: { API_KEY: "secret" },
				},
			],
		});

		const result = cursorAdapter(artifact, templateEnv);
		const mcpFile = result.files.find(
			(f) => f.relativePath === ".cursor/mcp.json",
		);
		expect(mcpFile).toBeDefined();

		const mcpJson = JSON.parse(mcpFile!.content);
		expect(mcpJson.mcpServers["my-server"]).toEqual({
			command: "uvx",
			args: ["my-server@latest"],
			env: { API_KEY: "secret" },
		});
	});

	/**
	 * Validates: Requirement 10.2
	 * Cursor adapter should not generate mcp.json when no MCP servers exist.
	 */
	test("does not generate mcp.json when no MCP servers", () => {
		const artifact = makeArtifact();
		const result = cursorAdapter(artifact, templateEnv);
		const mcpFile = result.files.find(
			(f) => f.relativePath === ".cursor/mcp.json",
		);
		expect(mcpFile).toBeUndefined();
	});

	/**
	 * Validates: Requirement 10.3
	 * Cursor adapter should skip hooks and emit a warning.
	 */
	test("skips hooks with warning", () => {
		const artifact = makeArtifact({
			hooks: [
				makeHook({
					name: "Lint Hook",
					event: "file_edited",
					action: { type: "run_command", command: "npm run lint" },
				}),
			],
		});

		const result = cursorAdapter(artifact, templateEnv);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0].harnessName).toBe("cursor");
		expect(result.warnings[0].message).toContain("does not support hooks");
	});

	/**
	 * Validates: Requirement 10.3
	 * Cursor adapter should not emit warning when no hooks exist.
	 */
	test("no warning when artifact has no hooks", () => {
		const artifact = makeArtifact({ hooks: [] });
		const result = cursorAdapter(artifact, templateEnv);
		expect(result.warnings).toHaveLength(0);
	});
});

// =============================================================================
// Windsurf Adapter Tests
// =============================================================================

describe("windsurfAdapter", () => {
	/**
	 * Validates: Requirement 11.1
	 * Windsurf adapter should generate rule files at .windsurf/rules/<artifact>.md.
	 */
	test("generates rule file with artifact body", () => {
		const artifact = makeArtifact();
		const result = windsurfAdapter(artifact, templateEnv);

		const ruleFile = result.files.find(
			(f) => f.relativePath === ".windsurf/rules/test-artifact.md",
		);
		expect(ruleFile).toBeDefined();
		expect(ruleFile?.content).toContain("This is test content.");
	});

	/**
	 * Validates: Requirement 11.2
	 * Windsurf adapter should copy workflows to .windsurf/workflows/.
	 */
	test("copies workflows to .windsurf/workflows/", () => {
		const artifact = makeArtifact({
			workflows: [
				{
					name: "Deploy",
					filename: "deploy.md",
					content: "# Deploy\nDeploy steps here.",
				},
				{
					name: "Setup",
					filename: "setup.md",
					content: "# Setup\nSetup steps here.",
				},
			],
		});

		const result = windsurfAdapter(artifact, templateEnv);
		const deployFile = result.files.find(
			(f) => f.relativePath === ".windsurf/workflows/deploy.md",
		);
		const setupFile = result.files.find(
			(f) => f.relativePath === ".windsurf/workflows/setup.md",
		);

		expect(deployFile).toBeDefined();
		expect(deployFile?.content).toContain("Deploy steps here.");
		expect(setupFile).toBeDefined();
		expect(setupFile?.content).toContain("Setup steps here.");
	});

	/**
	 * Validates: Requirement 11.2
	 * Windsurf adapter should not generate workflow files when no workflows exist.
	 */
	test("no workflow files when artifact has no workflows", () => {
		const artifact = makeArtifact({ workflows: [] });
		const result = windsurfAdapter(artifact, templateEnv);
		const wfFiles = result.files.filter((f) =>
			f.relativePath.includes("workflows/"),
		);
		expect(wfFiles).toHaveLength(0);
	});

	/**
	 * Validates: Requirement 11.3
	 * Windsurf adapter should generate .windsurf/mcp.json from MCP server definitions.
	 */
	test("generates .windsurf/mcp.json from MCP servers", () => {
		const artifact = makeArtifact({
			mcpServers: [
				{
					name: "docs-server",
					command: "npx",
					args: ["docs-server"],
					env: { PORT: "3000" },
				},
			],
		});

		const result = windsurfAdapter(artifact, templateEnv);
		const mcpFile = result.files.find(
			(f) => f.relativePath === ".windsurf/mcp.json",
		);
		expect(mcpFile).toBeDefined();

		const mcpJson = JSON.parse(mcpFile!.content);
		expect(mcpJson.mcpServers["docs-server"]).toEqual({
			command: "npx",
			args: ["docs-server"],
			env: { PORT: "3000" },
		});
	});

	/**
	 * Validates: Requirement 11.4
	 * Windsurf adapter should skip hooks and emit a warning.
	 */
	test("skips hooks with warning", () => {
		const artifact = makeArtifact({
			hooks: [
				makeHook({
					name: "Lint Hook",
					event: "file_edited",
					action: { type: "run_command", command: "npm run lint" },
				}),
			],
		});

		const result = windsurfAdapter(artifact, templateEnv);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0].harnessName).toBe("windsurf");
		expect(result.warnings[0].message).toContain("does not support hooks");
	});

	/**
	 * Validates: Requirement 11.4
	 * Windsurf adapter should not emit warning when no hooks exist.
	 */
	test("no warning when artifact has no hooks", () => {
		const artifact = makeArtifact({ hooks: [] });
		const result = windsurfAdapter(artifact, templateEnv);
		expect(result.warnings).toHaveLength(0);
	});
});

// =============================================================================
// Cline Adapter Tests
// =============================================================================

describe("clineAdapter", () => {
	/**
	 * Validates: Requirement 12.1
	 * Cline adapter should generate rule files at .clinerules/<artifact>.md.
	 */
	test("generates rule file with artifact body", () => {
		const artifact = makeArtifact();
		const result = clineAdapter(artifact, templateEnv);

		const ruleFile = result.files.find(
			(f) => f.relativePath === ".clinerules/test-artifact.md",
		);
		expect(ruleFile).toBeDefined();
		expect(ruleFile?.content).toContain("This is test content.");
	});

	/**
	 * Validates: Requirement 12.2, 12.3
	 * Cline adapter should translate run_command hooks to executable shell scripts
	 * with the executable flag set to true.
	 */
	test("generates executable hook scripts for run_command actions", () => {
		const artifact = makeArtifact({
			hooks: [
				makeHook({
					name: "Lint On Save",
					description: "Run linter on file save",
					event: "file_edited",
					action: { type: "run_command", command: "npm run lint" },
				}),
			],
		});

		const result = clineAdapter(artifact, templateEnv);
		const hookFile = result.files.find((f) =>
			f.relativePath.includes("hooks/"),
		);
		expect(hookFile).toBeDefined();
		expect(hookFile?.relativePath).toBe(".clinerules/hooks/lint-on-save.sh");
		expect(hookFile?.executable).toBe(true);
		expect(hookFile?.content).toContain("#!/bin/bash");
		expect(hookFile?.content).toContain("npm run lint");
		expect(hookFile?.content).toContain("Lint On Save");
	});

	/**
	 * Validates: Requirement 12.2
	 * Cline adapter should generate multiple hook scripts for multiple run_command hooks.
	 */
	test("generates multiple hook scripts", () => {
		const artifact = makeArtifact({
			hooks: [
				makeHook({
					name: "Lint",
					event: "file_edited",
					action: { type: "run_command", command: "npm run lint" },
				}),
				makeHook({
					name: "Test",
					event: "agent_stop",
					action: { type: "run_command", command: "npm test" },
				}),
			],
		});

		const result = clineAdapter(artifact, templateEnv);
		const hookFiles = result.files.filter((f) =>
			f.relativePath.includes("hooks/"),
		);
		expect(hookFiles).toHaveLength(2);
		expect(hookFiles.every((f) => f.executable === true)).toBe(true);
	});

	/**
	 * Validates: Requirement 12.2
	 * Cline adapter should emit a warning for ask_agent hooks (only run_command supported as scripts).
	 */
	test("emits warning for ask_agent hooks", () => {
		const artifact = makeArtifact({
			hooks: [
				makeHook({
					name: "Review Code",
					event: "prompt_submit",
					action: { type: "ask_agent", prompt: "Review the code" },
				}),
			],
		});

		const result = clineAdapter(artifact, templateEnv);
		const hookFiles = result.files.filter((f) =>
			f.relativePath.includes("hooks/"),
		);
		expect(hookFiles).toHaveLength(0);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0].harnessName).toBe("cline");
		expect(result.warnings[0].message).toContain("Review Code");
	});

	/**
	 * Validates: Requirement 12.4
	 * Cline adapter should generate VS Code MCP configuration from MCP server definitions.
	 */
	test("generates MCP configuration from MCP servers", () => {
		const artifact = makeArtifact({
			mcpServers: [
				{
					name: "my-mcp",
					command: "node",
					args: ["server.js"],
					env: { DEBUG: "true" },
				},
			],
		});

		const result = clineAdapter(artifact, templateEnv);
		const mcpFile = result.files.find(
			(f) => f.relativePath === ".clinerules/mcp.json",
		);
		expect(mcpFile).toBeDefined();

		const mcpJson = JSON.parse(mcpFile!.content);
		expect(mcpJson.mcpServers["my-mcp"]).toEqual({
			command: "node",
			args: ["server.js"],
			env: { DEBUG: "true" },
		});
	});

	/**
	 * Validates: Requirement 12.4
	 * Cline adapter should not generate mcp.json when no MCP servers exist.
	 */
	test("does not generate mcp.json when no MCP servers", () => {
		const artifact = makeArtifact();
		const result = clineAdapter(artifact, templateEnv);
		const mcpFile = result.files.find(
			(f) => f.relativePath === ".clinerules/mcp.json",
		);
		expect(mcpFile).toBeUndefined();
	});

	/**
	 * Validates: Requirement 21.2
	 * Cline adapter should preserve the exact command string in generated hook scripts.
	 */
	test("preserves command string fidelity in hook scripts", () => {
		const command = "npm run lint -- --fix && npm test";
		const artifact = makeArtifact({
			hooks: [
				makeHook({
					name: "Complex Cmd",
					event: "agent_stop",
					action: { type: "run_command", command },
				}),
			],
		});

		const result = clineAdapter(artifact, templateEnv);
		const hookFile = result.files.find((f) =>
			f.relativePath.includes("hooks/"),
		);
		expect(hookFile).toBeDefined();
		expect(hookFile?.content).toContain(command);
	});

	/**
	 * Validates: Requirement 12.2
	 * Cline adapter should not emit warnings when no hooks exist.
	 */
	test("no warnings when artifact has no hooks", () => {
		const artifact = makeArtifact({ hooks: [] });
		const result = clineAdapter(artifact, templateEnv);
		expect(result.warnings).toHaveLength(0);
	});
});

// =============================================================================
// Q Developer Adapter Tests
// =============================================================================

describe("qdeveloperAdapter", () => {
	/**
	 * Validates: Requirement 13.1
	 * Q Developer adapter should generate rule files at .q/rules/<artifact>.md.
	 */
	test("generates rule file with artifact body", () => {
		const artifact = makeArtifact();
		const result = qdeveloperAdapter(artifact, templateEnv);

		const ruleFile = result.files.find(
			(f) => f.relativePath === ".q/rules/test-artifact.md",
		);
		expect(ruleFile).toBeDefined();
		expect(ruleFile?.content).toContain("This is test content.");
	});

	/**
	 * Validates: Requirement 13.2
	 * Q Developer adapter should generate agent definition files from workflows.
	 */
	test("generates agent files from workflows", () => {
		const artifact = makeArtifact({
			workflows: [
				{
					name: "Deploy",
					filename: "deploy.md",
					content: "# Deploy\nDeploy steps here.",
				},
				{
					name: "Setup",
					filename: "setup.md",
					content: "# Setup\nSetup steps here.",
				},
			],
		});

		const result = qdeveloperAdapter(artifact, templateEnv);
		const deployAgent = result.files.find(
			(f) => f.relativePath === ".q/agents/deploy.md",
		);
		const setupAgent = result.files.find(
			(f) => f.relativePath === ".q/agents/setup.md",
		);

		expect(deployAgent).toBeDefined();
		expect(deployAgent?.content).toContain("Deploy steps here.");
		expect(setupAgent).toBeDefined();
		expect(setupAgent?.content).toContain("Setup steps here.");
	});

	/**
	 * Validates: Requirement 13.2
	 * Q Developer adapter should not generate agent files when no workflows exist.
	 */
	test("no agent files when artifact has no workflows", () => {
		const artifact = makeArtifact({ workflows: [] });
		const result = qdeveloperAdapter(artifact, templateEnv);
		const agentFiles = result.files.filter((f) =>
			f.relativePath.includes("agents/"),
		);
		expect(agentFiles).toHaveLength(0);
	});

	/**
	 * Validates: Requirement 13.4
	 * Q Developer adapter should generate MCP configuration from MCP server definitions.
	 */
	test("generates MCP configuration from MCP servers", () => {
		const artifact = makeArtifact({
			mcpServers: [
				{
					name: "q-server",
					command: "python",
					args: ["-m", "q_server"],
					env: { REGION: "us-east-1" },
				},
			],
		});

		const result = qdeveloperAdapter(artifact, templateEnv);
		const mcpFile = result.files.find((f) => f.relativePath === ".q/mcp.json");
		expect(mcpFile).toBeDefined();

		const mcpJson = JSON.parse(mcpFile!.content);
		expect(mcpJson.mcpServers["q-server"]).toEqual({
			command: "python",
			args: ["-m", "q_server"],
			env: { REGION: "us-east-1" },
		});
	});

	/**
	 * Validates: Requirement 13.3
	 * Q Developer adapter should skip hooks and emit a warning.
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

		const result = qdeveloperAdapter(artifact, templateEnv);
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0].harnessName).toBe("qdeveloper");
		expect(result.warnings[0].message).toContain("does not support hooks");
	});

	/**
	 * Validates: Requirement 13.3
	 * Q Developer adapter should not emit warning when no hooks exist.
	 */
	test("no warning when artifact has no hooks", () => {
		const artifact = makeArtifact({ hooks: [] });
		const result = qdeveloperAdapter(artifact, templateEnv);
		expect(result.warnings).toHaveLength(0);
	});
});
