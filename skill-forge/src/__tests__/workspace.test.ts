import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessName, WorkspaceConfig } from "../schemas";
import {
	loadWorkspaceConfig,
	mergeKnowledgeSources,
	parseWorkspaceConfigYaml,
	serializeWorkspaceConfig,
	validateWorkspaceConfig,
} from "../workspace";

describe("loadWorkspaceConfig", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "workspace-test-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("returns null when no config files exist", async () => {
		const result = await loadWorkspaceConfig(tempDir);
		expect(result).toBeNull();
	});

	test("returns null when forge.config.yaml has no workspace fields", async () => {
		await writeFile(
			join(tempDir, "forge.config.yaml"),
			"install:\n  backends: {}\n",
		);
		const result = await loadWorkspaceConfig(tempDir);
		expect(result).toBeNull();
	});

	test("loads workspace config from forge.config.yaml", async () => {
		const yamlContent = `
knowledgeSources:
  - knowledge
projects:
  - name: api
    root: packages/api
    harnesses:
      - kiro
      - cursor
`;
		await writeFile(join(tempDir, "forge.config.yaml"), yamlContent);
		const result = await loadWorkspaceConfig(tempDir);
		expect(result).not.toBeNull();
		expect(result?.config.knowledgeSources).toEqual(["knowledge"]);
		expect(result?.config.projects).toHaveLength(1);
		expect(result?.config.projects[0].name).toBe("api");
		expect(result?.source).toContain("forge.config.yaml");
	});

	test("prefers forge.config.ts over forge.config.yaml when both exist", async () => {
		const yamlContent = `
knowledgeSources:
  - knowledge
projects:
  - name: yaml-project
    root: packages/yaml
    harnesses:
      - kiro
`;
		await writeFile(join(tempDir, "forge.config.yaml"), yamlContent);

		const tsContent = `export default {
  knowledgeSources: ["knowledge"],
  projects: [{ name: "ts-project", root: "packages/ts", harnesses: ["cursor"] }],
};`;
		await writeFile(join(tempDir, "forge.config.ts"), tsContent);

		const result = await loadWorkspaceConfig(tempDir);
		expect(result).not.toBeNull();
		expect(result?.config.projects[0].name).toBe("ts-project");
		expect(result?.source).toContain("forge.config.ts");
	});

	test("throws on invalid workspace config in YAML", async () => {
		const yamlContent = `
knowledgeSources: "not-an-array"
projects: []
`;
		await writeFile(join(tempDir, "forge.config.yaml"), yamlContent);
		await expect(loadWorkspaceConfig(tempDir)).rejects.toThrow();
	});
});

describe("validateWorkspaceConfig", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "workspace-validate-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("returns no errors for valid config with existing paths", async () => {
		await mkdir(join(tempDir, "knowledge"), { recursive: true });
		await mkdir(join(tempDir, "packages/api"), { recursive: true });

		const config: WorkspaceConfig = {
			knowledgeSources: ["knowledge"],
			projects: [{ name: "api", root: "packages/api", harnesses: ["kiro"] }],
		};

		const knownArtifacts = new Set(["my-skill"]);
		const errors = await validateWorkspaceConfig(
			config,
			tempDir,
			knownArtifacts,
		);
		expect(errors).toHaveLength(0);
	});

	test("reports error for non-existent root path", async () => {
		await mkdir(join(tempDir, "knowledge"), { recursive: true });

		const config: WorkspaceConfig = {
			knowledgeSources: ["knowledge"],
			projects: [
				{ name: "api", root: "packages/nonexistent", harnesses: ["kiro"] },
			],
		};

		const errors = await validateWorkspaceConfig(config, tempDir, new Set());
		expect(errors.length).toBeGreaterThan(0);
		expect(errors[0].field).toContain("root");
		expect(errors[0].message).toContain("does not exist");
	});

	test("reports error for unknown harness name", async () => {
		await mkdir(join(tempDir, "knowledge"), { recursive: true });
		await mkdir(join(tempDir, "packages/api"), { recursive: true });

		const config: WorkspaceConfig = {
			knowledgeSources: ["knowledge"],
			projects: [
				{
					name: "api",
					root: "packages/api",
					harnesses: ["kiro", "unknown-harness" as unknown as HarnessName],
				},
			],
		};

		const errors = await validateWorkspaceConfig(config, tempDir, new Set());
		expect(errors.length).toBeGreaterThan(0);
		expect(errors.some((e) => e.message.includes("Unknown harness"))).toBe(
			true,
		);
	});

	test("reports error for unknown artifact in include list", async () => {
		await mkdir(join(tempDir, "knowledge"), { recursive: true });
		await mkdir(join(tempDir, "packages/api"), { recursive: true });

		const config: WorkspaceConfig = {
			knowledgeSources: ["knowledge"],
			projects: [
				{
					name: "api",
					root: "packages/api",
					harnesses: ["kiro"],
					artifacts: { include: ["nonexistent-artifact"] },
				},
			],
		};

		const knownArtifacts = new Set(["my-skill"]);
		const errors = await validateWorkspaceConfig(
			config,
			tempDir,
			knownArtifacts,
		);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors.some((e) => e.message.includes("Unknown artifact"))).toBe(
			true,
		);
	});

	test("reports error for non-existent knowledge source", async () => {
		await mkdir(join(tempDir, "packages/api"), { recursive: true });

		const config: WorkspaceConfig = {
			knowledgeSources: ["nonexistent-dir"],
			projects: [{ name: "api", root: "packages/api", harnesses: ["kiro"] }],
		};

		const errors = await validateWorkspaceConfig(config, tempDir, new Set());
		expect(errors.some((e) => e.field === "knowledgeSources")).toBe(true);
	});

	test("reports error for unknown harness in defaults", async () => {
		await mkdir(join(tempDir, "knowledge"), { recursive: true });
		await mkdir(join(tempDir, "packages/api"), { recursive: true });

		const config: WorkspaceConfig = {
			knowledgeSources: ["knowledge"],
			defaults: {
				harnesses: ["kiro", "bad-harness" as unknown as HarnessName],
			},
			projects: [{ name: "api", root: "packages/api", harnesses: ["kiro"] }],
		};

		const errors = await validateWorkspaceConfig(config, tempDir, new Set());
		expect(errors.some((e) => e.field === "defaults.harnesses")).toBe(true);
	});
});

describe("mergeKnowledgeSources", () => {
	let tempDir: string;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "workspace-merge-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	test("merges artifacts from multiple sources with no conflicts", async () => {
		// Create two knowledge sources with different artifacts
		await mkdir(join(tempDir, "source-a/skill-one"), { recursive: true });
		await writeFile(
			join(tempDir, "source-a/skill-one/knowledge.md"),
			"---\nname: skill-one\n---\n",
		);
		await mkdir(join(tempDir, "source-b/skill-two"), { recursive: true });
		await writeFile(
			join(tempDir, "source-b/skill-two/knowledge.md"),
			"---\nname: skill-two\n---\n",
		);

		const result = await mergeKnowledgeSources(
			["source-a", "source-b"],
			tempDir,
		);
		expect(result.artifacts.size).toBe(2);
		expect(result.artifacts.has("skill-one")).toBe(true);
		expect(result.artifacts.has("skill-two")).toBe(true);
		expect(result.conflicts).toHaveLength(0);
	});

	test("detects name conflicts across sources", async () => {
		await mkdir(join(tempDir, "source-a/shared-skill"), { recursive: true });
		await writeFile(
			join(tempDir, "source-a/shared-skill/knowledge.md"),
			"---\nname: shared-skill\n---\n",
		);
		await mkdir(join(tempDir, "source-b/shared-skill"), { recursive: true });
		await writeFile(
			join(tempDir, "source-b/shared-skill/knowledge.md"),
			"---\nname: shared-skill\n---\n",
		);

		const result = await mergeKnowledgeSources(
			["source-a", "source-b"],
			tempDir,
		);
		expect(result.conflicts).toHaveLength(1);
		expect(result.conflicts[0].name).toBe("shared-skill");
		expect(result.conflicts[0].sources).toEqual(["source-a", "source-b"]);
	});

	test("skips directories without knowledge.md", async () => {
		await mkdir(join(tempDir, "source-a/valid-skill"), { recursive: true });
		await writeFile(
			join(tempDir, "source-a/valid-skill/knowledge.md"),
			"---\nname: valid-skill\n---\n",
		);
		await mkdir(join(tempDir, "source-a/not-a-skill"), { recursive: true });
		// No knowledge.md in not-a-skill

		const result = await mergeKnowledgeSources(["source-a"], tempDir);
		expect(result.artifacts.size).toBe(1);
		expect(result.artifacts.has("valid-skill")).toBe(true);
		expect(result.artifacts.has("not-a-skill")).toBe(false);
	});

	test("skips hidden directories", async () => {
		await mkdir(join(tempDir, "source-a/.hidden"), { recursive: true });
		await writeFile(
			join(tempDir, "source-a/.hidden/knowledge.md"),
			"---\nname: hidden\n---\n",
		);

		const result = await mergeKnowledgeSources(["source-a"], tempDir);
		expect(result.artifacts.size).toBe(0);
	});

	test("handles non-existent source directories gracefully", async () => {
		const result = await mergeKnowledgeSources(["nonexistent"], tempDir);
		expect(result.artifacts.size).toBe(0);
		expect(result.conflicts).toHaveLength(0);
	});
});

describe("serializeWorkspaceConfig", () => {
	test("serializes a valid config to YAML", () => {
		const config: WorkspaceConfig = {
			knowledgeSources: ["knowledge", "packages"],
			projects: [
				{ name: "api", root: "packages/api", harnesses: ["kiro", "cursor"] },
			],
		};

		const yamlStr = serializeWorkspaceConfig(config);
		expect(yamlStr).toContain("knowledgeSources:");
		expect(yamlStr).toContain("- knowledge");
		expect(yamlStr).toContain("- packages");
		expect(yamlStr).toContain("projects:");
		expect(yamlStr).toContain("name: api");
	});
});

describe("parseWorkspaceConfigYaml", () => {
	test("parses valid YAML into WorkspaceConfig", () => {
		const yamlStr = `
knowledgeSources:
  - knowledge
projects:
  - name: web
    root: packages/web
    harnesses:
      - copilot
      - windsurf
`;
		const config = parseWorkspaceConfigYaml(yamlStr);
		expect(config.knowledgeSources).toEqual(["knowledge"]);
		expect(config.projects).toHaveLength(1);
		expect(config.projects[0].name).toBe("web");
		expect(config.projects[0].harnesses).toEqual(["copilot", "windsurf"]);
	});

	test("throws on invalid YAML", () => {
		expect(() => parseWorkspaceConfigYaml("invalid: [")).toThrow();
	});

	test("throws on YAML that doesn't match schema", () => {
		const yamlStr = `
knowledgeSources: "not-an-array"
`;
		expect(() => parseWorkspaceConfigYaml(yamlStr)).toThrow();
	});

	test("round-trip: serialize then parse produces equivalent config", () => {
		const config: WorkspaceConfig = {
			knowledgeSources: ["knowledge"],
			sharedMcpServers: "shared/mcp.yaml",
			defaults: { harnesses: ["kiro", "cursor"] },
			projects: [
				{
					name: "api-server",
					root: "packages/api",
					harnesses: ["kiro", "claude-code"],
					artifacts: { include: ["security-rules"], exclude: ["debug-tools"] },
				},
				{
					name: "web-client",
					root: "packages/web",
					harnesses: ["cursor", "copilot"],
				},
			],
		};

		const yamlStr = serializeWorkspaceConfig(config);
		const parsed = parseWorkspaceConfigYaml(yamlStr);
		expect(parsed).toEqual(config);
	});
});
