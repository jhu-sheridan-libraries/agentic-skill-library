import { beforeAll, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import type nunjucks from "nunjucks";
import { getCapabilities } from "../adapters/capabilities";
import { codexAdapter } from "../adapters/codex";
import { createTemplateEnv } from "../template-engine";
import { makeArtifact, makeFrontmatter } from "./test-helpers";

const TEMPLATES_DIR = resolve(
	import.meta.dir,
	"../../templates/harness-adapters",
);

let templateEnv: nunjucks.Environment;

beforeAll(() => {
	templateEnv = createTemplateEnv(TEMPLATES_DIR);
});

describe("codexAdapter", () => {
	test("emits AGENTS.md by default", () => {
		const artifact = makeArtifact({
			name: "codex-default",
			frontmatter: makeFrontmatter({
				name: "codex-default",
				harnesses: ["codex"],
			}),
			body: "# Codex Default\n\nUse this guidance.",
		});

		const result = codexAdapter(artifact, templateEnv);

		expect(result.files).toHaveLength(1);
		expect(result.files[0].relativePath).toBe("AGENTS.md");
		expect(result.files[0].content).toContain("Use this guidance.");
	});

	test("skill mode uses stable artifact names and preserves workflow references", () => {
		const artifact = makeArtifact({
			name: "stable-skill-name",
			frontmatter: makeFrontmatter({
				name: "frontmatter-skill-name",
				harnesses: ["codex"],
				description: "A Codex skill.",
				"harness-config": { codex: { format: "skill" } },
			}),
			workflows: [
				{
					name: "Plan",
					filename: "plan.md",
					content: "# Plan\n\nPlan the work.",
				},
			],
		});

		const result = codexAdapter(artifact, templateEnv);
		const paths = result.files.map((f) => f.relativePath);

		expect(paths).toContain(".codex/skills/stable-skill-name/SKILL.md");
		expect(paths).toContain(
			".codex/skills/stable-skill-name/references/plan.md",
		);
		expect(paths).toContain("AGENTS.md");

		const skill = result.files.find((f) => f.relativePath.endsWith("SKILL.md"));
		expect(skill?.content).toContain("name: stable-skill-name");

		const pointer = result.files.find((f) => f.relativePath === "AGENTS.md");
		expect(pointer?.content).toContain(
			".codex/skills/stable-skill-name/SKILL.md",
		);

		const reference = result.files.find((f) =>
			f.relativePath.endsWith("references/plan.md"),
		);
		expect(reference?.content).toContain("Plan the work.");
	});

	test("writes Codex MCP TOML for stdio and URL servers", () => {
		const artifact = makeArtifact({
			name: "mcp-skill",
			frontmatter: makeFrontmatter({
				name: "mcp-skill",
				harnesses: ["codex"],
			}),
			mcpServers: [
				{
					name: "local-tool",
					transport: "stdio",
					command: "npx",
					args: ["-y", "local-tool"],
					env: { API_KEY: "abc" },
					timeout: 3000,
				},
				{
					name: "stripe.api",
					transport: "sse",
					url: "https://mcp.stripe.com",
					env: { MODE: "test" },
					timeout: 5000,
				},
			],
		});

		const result = codexAdapter(artifact, templateEnv);
		const config = result.files.find(
			(f) => f.relativePath === ".codex/config.toml",
		);

		expect(config).toBeDefined();
		expect(config?.content).toContain("[mcp_servers.local-tool]");
		expect(config?.content).toContain('command = "npx"');
		expect(config?.content).toContain('args = ["-y", "local-tool"]');
		expect(config?.content).toContain('env = { API_KEY = "abc" }');
		expect(config?.content).toContain("startup_timeout_ms = 3000");
		expect(config?.content).toContain('[mcp_servers."stripe.api"]');
		expect(config?.content).toContain('url = "https://mcp.stripe.com"');
		expect(config?.content).toContain('env = { MODE = "test" }');
		expect(config?.content).toContain("startup_timeout_ms = 5000");
	});

	test("renders hooks as manual guidance with warnings", () => {
		const artifact = makeArtifact({
			name: "hooked-skill",
			frontmatter: makeFrontmatter({
				name: "hooked-skill",
				harnesses: ["codex"],
			}),
			hooks: [
				{
					name: "summarize",
					event: "post_task",
					action: {
						type: "ask_agent",
						prompt: "Summarize the completed work.",
					},
				},
			],
		});

		const result = codexAdapter(artifact, templateEnv, {
			capabilities: getCapabilities("codex"),
			strict: false,
		});
		const agents = result.files.find((f) => f.relativePath === "AGENTS.md");

		expect(agents?.content).toContain("## Automated Behaviors");
		expect(agents?.content).toContain("Summarize the completed work.");
		expect(
			result.warnings.some((w) => w.message.includes("manual guidance")),
		).toBe(true);
	});

	test("strict mode still emits files when hooks are degraded", () => {
		const artifact = makeArtifact({
			name: "strict-hooked-skill",
			frontmatter: makeFrontmatter({
				name: "strict-hooked-skill",
				harnesses: ["codex"],
			}),
			hooks: [
				{
					name: "summarize",
					event: "post_task",
					action: {
						type: "ask_agent",
						prompt: "Summarize the completed work.",
					},
				},
			],
		});

		const result = codexAdapter(artifact, templateEnv, {
			capabilities: getCapabilities("codex"),
			strict: true,
		});

		expect(result.files.some((f) => f.relativePath === "AGENTS.md")).toBe(true);
		expect(
			result.warnings.some((w) =>
				w.message.includes("Strict mode: capability hooks is degraded"),
			),
		).toBe(true);
	});
});
