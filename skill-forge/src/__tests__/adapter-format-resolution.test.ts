import { beforeAll, describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import type nunjucks from "nunjucks";
import { claudeCodeAdapter } from "../adapters/claude-code";
import { clineAdapter } from "../adapters/cline";
import { copilotAdapter } from "../adapters/copilot";
import { cursorAdapter } from "../adapters/cursor";
import { kiroAdapter } from "../adapters/kiro";
import { qdeveloperAdapter } from "../adapters/qdeveloper";
import { windsurfAdapter } from "../adapters/windsurf";
import type { Frontmatter, KnowledgeArtifact } from "../schemas";
import { createTemplateEnv } from "../template-engine";

const TEMPLATES_DIR = resolve(
	import.meta.dir,
	"../../templates/harness-adapters",
);
let templateEnv: nunjucks.Environment;

beforeAll(() => {
	templateEnv = createTemplateEnv(TEMPLATES_DIR);
});

function makeFrontmatter(overrides: Partial<Frontmatter> = {}): Frontmatter {
	return {
		name: "test-artifact",
		description: "A test artifact",
		keywords: ["test"],
		author: "tester",
		version: "1.0.0",
		harnesses: [
			"kiro",
			"claude-code",
			"copilot",
			"cursor",
			"windsurf",
			"cline",
			"qdeveloper",
		],
		type: "skill",
		inclusion: "always",
		categories: [],
		ecosystem: [],
		depends: [],
		enhances: [],
		maturity: "experimental",
		"model-assumptions": [],
		collections: [],
		"inherit-hooks": false,
		...overrides,
	};
}

function makeArtifact(
	overrides: Partial<KnowledgeArtifact> = {},
): KnowledgeArtifact {
	return {
		name: "test-artifact",
		frontmatter: makeFrontmatter(),
		body: "# Test Artifact\n\nThis is test content.",
		hooks: [],
		mcpServers: [],
		workflows: [],
		sourcePath: "/tmp/knowledge/test-artifact",
		extraFields: {},
		...overrides,
	};
}

// =============================================================================
// Kiro Adapter Format Resolution Tests
// =============================================================================

describe("kiroAdapter format resolution", () => {
	test("produces power output when format is 'power'", () => {
		const artifact = makeArtifact({
			name: "my-power",
			frontmatter: makeFrontmatter({
				name: "my-power",
				description: "A power artifact",
				harnesses: ["kiro"],
				"harness-config": { kiro: { format: "power" } },
			}),
		});

		const result = kiroAdapter(artifact, templateEnv);
		const powerFile = result.files.find((f) => f.relativePath === "POWER.md");
		expect(powerFile).toBeDefined();

		// Steering file should be under steering/ subdirectory for powers
		const steeringFile = result.files.find(
			(f) => f.relativePath === "steering/my-power.md",
		);
		expect(steeringFile).toBeDefined();

		// No deprecation warning
		expect(result.warnings).toHaveLength(0);
	});

	test("produces steering output when format is 'steering'", () => {
		const artifact = makeArtifact({
			frontmatter: makeFrontmatter({
				harnesses: ["kiro"],
				"harness-config": { kiro: { format: "steering" } },
			}),
		});

		const result = kiroAdapter(artifact, templateEnv);
		const powerFile = result.files.find((f) => f.relativePath === "POWER.md");
		expect(powerFile).toBeUndefined();

		const steeringFile = result.files.find(
			(f) => f.relativePath === "test-artifact.md",
		);
		expect(steeringFile).toBeDefined();
	});

	test("produces steering output when format is omitted (default)", () => {
		const artifact = makeArtifact();
		const result = kiroAdapter(artifact, templateEnv);

		const powerFile = result.files.find((f) => f.relativePath === "POWER.md");
		expect(powerFile).toBeUndefined();

		const steeringFile = result.files.find(
			(f) => f.relativePath === "test-artifact.md",
		);
		expect(steeringFile).toBeDefined();
	});

	test("backward compat: power: true still produces power output with deprecation warning", () => {
		const artifact = makeArtifact({
			name: "legacy-power",
			frontmatter: makeFrontmatter({
				name: "legacy-power",
				description: "A legacy power",
				harnesses: ["kiro"],
				type: "power",
				"harness-config": { kiro: { power: true } },
			}),
		});

		const result = kiroAdapter(artifact, templateEnv);

		// Should produce power output
		const powerFile = result.files.find((f) => f.relativePath === "POWER.md");
		expect(powerFile).toBeDefined();

		const steeringFile = result.files.find(
			(f) => f.relativePath === "steering/legacy-power.md",
		);
		expect(steeringFile).toBeDefined();

		// Should have deprecation warning
		const deprecationWarning = result.warnings.find((w) =>
			w.message.includes("deprecated"),
		);
		expect(deprecationWarning).toBeDefined();
		expect(deprecationWarning?.harnessName).toBe("kiro");
		expect(deprecationWarning?.message).toContain("format");
	});
});

// =============================================================================
// Copilot Adapter Format Resolution Tests
// =============================================================================

describe("copilotAdapter format resolution", () => {
	test("produces AGENTS.md when format is 'agent'", () => {
		const artifact = makeArtifact({
			frontmatter: makeFrontmatter({
				harnesses: ["copilot"],
				"harness-config": { copilot: { format: "agent" } },
			}),
		});

		const result = copilotAdapter(artifact, templateEnv);
		const agentsFile = result.files.find((f) => f.relativePath === "AGENTS.md");
		expect(agentsFile).toBeDefined();
	});

	test("produces copilot-instructions.md when format is 'instructions'", () => {
		const artifact = makeArtifact({
			frontmatter: makeFrontmatter({
				harnesses: ["copilot"],
				"harness-config": { copilot: { format: "instructions" } },
			}),
		});

		const result = copilotAdapter(artifact, templateEnv);
		const instructionsFile = result.files.find(
			(f) => f.relativePath === ".github/copilot-instructions.md",
		);
		expect(instructionsFile).toBeDefined();
	});

	test("produces copilot-instructions.md when format is omitted (default)", () => {
		const artifact = makeArtifact();
		const result = copilotAdapter(artifact, templateEnv);

		const instructionsFile = result.files.find(
			(f) => f.relativePath === ".github/copilot-instructions.md",
		);
		expect(instructionsFile).toBeDefined();
	});

	test("does not produce AGENTS.md when format is 'instructions' and no workflows", () => {
		const artifact = makeArtifact({
			frontmatter: makeFrontmatter({
				harnesses: ["copilot"],
				"harness-config": { copilot: { format: "instructions" } },
			}),
		});

		const result = copilotAdapter(artifact, templateEnv);
		const agentsFile = result.files.find((f) => f.relativePath === "AGENTS.md");
		expect(agentsFile).toBeUndefined();
	});
});

// =============================================================================
// Q Developer Adapter Format Resolution Tests
// =============================================================================

describe("qdeveloperAdapter format resolution", () => {
	test("produces .q/agents/ output when format is 'agent'", () => {
		const artifact = makeArtifact({
			frontmatter: makeFrontmatter({
				harnesses: ["qdeveloper"],
				"harness-config": { qdeveloper: { format: "agent" } },
			}),
		});

		const result = qdeveloperAdapter(artifact, templateEnv);
		const agentFile = result.files.find(
			(f) => f.relativePath === ".q/agents/test-artifact.md",
		);
		expect(agentFile).toBeDefined();

		// Should NOT produce .q/rules/ when format is "agent"
		const ruleFile = result.files.find(
			(f) => f.relativePath === ".q/rules/test-artifact.md",
		);
		expect(ruleFile).toBeUndefined();
	});

	test("produces .q/rules/ output when format is 'rule'", () => {
		const artifact = makeArtifact({
			frontmatter: makeFrontmatter({
				harnesses: ["qdeveloper"],
				"harness-config": { qdeveloper: { format: "rule" } },
			}),
		});

		const result = qdeveloperAdapter(artifact, templateEnv);
		const ruleFile = result.files.find(
			(f) => f.relativePath === ".q/rules/test-artifact.md",
		);
		expect(ruleFile).toBeDefined();
	});

	test("produces .q/rules/ output when format is omitted (default)", () => {
		const artifact = makeArtifact();
		const result = qdeveloperAdapter(artifact, templateEnv);

		const ruleFile = result.files.find(
			(f) => f.relativePath === ".q/rules/test-artifact.md",
		);
		expect(ruleFile).toBeDefined();
	});

	test("still produces .q/agents/ from workflows when format is 'rule'", () => {
		const artifact = makeArtifact({
			frontmatter: makeFrontmatter({
				harnesses: ["qdeveloper"],
				"harness-config": { qdeveloper: { format: "rule" } },
			}),
			workflows: [
				{
					name: "Deploy",
					filename: "deploy.md",
					content: "# Deploy\nDeploy steps.",
				},
			],
		});

		const result = qdeveloperAdapter(artifact, templateEnv);
		const ruleFile = result.files.find(
			(f) => f.relativePath === ".q/rules/test-artifact.md",
		);
		expect(ruleFile).toBeDefined();

		const agentFile = result.files.find(
			(f) => f.relativePath === ".q/agents/deploy.md",
		);
		expect(agentFile).toBeDefined();
	});
});

// =============================================================================
// Single-Format Adapter Tests (after resolveFormat call)
// =============================================================================

describe("single-format adapters with resolveFormat", () => {
	test("cursor adapter still produces correct output", () => {
		const artifact = makeArtifact();
		const result = cursorAdapter(artifact, templateEnv);

		const ruleFile = result.files.find(
			(f) => f.relativePath === ".cursor/rules/test-artifact.md",
		);
		expect(ruleFile).toBeDefined();
		expect(ruleFile?.content).toContain("This is test content.");
	});

	test("claude-code adapter still produces correct output", () => {
		const artifact = makeArtifact();
		const result = claudeCodeAdapter(artifact, templateEnv);

		const claudeFile = result.files.find((f) => f.relativePath === "CLAUDE.md");
		expect(claudeFile).toBeDefined();
		expect(claudeFile?.content).toContain("This is test content.");
	});

	test("windsurf adapter still produces correct output", () => {
		const artifact = makeArtifact();
		const result = windsurfAdapter(artifact, templateEnv);

		const ruleFile = result.files.find(
			(f) => f.relativePath === ".windsurf/rules/test-artifact.md",
		);
		expect(ruleFile).toBeDefined();
		expect(ruleFile?.content).toContain("This is test content.");
	});

	test("cline adapter still produces correct output", () => {
		const artifact = makeArtifact();
		const result = clineAdapter(artifact, templateEnv);

		const ruleFile = result.files.find(
			(f) => f.relativePath === ".clinerules/test-artifact.md",
		);
		expect(ruleFile).toBeDefined();
		expect(ruleFile?.content).toContain("This is test content.");
	});
});
