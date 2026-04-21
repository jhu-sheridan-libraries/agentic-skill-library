import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderTemper } from "../temper";

async function createTestArtifact(
	baseDir: string,
	name: string,
	opts: {
		hooks?: boolean;
		mcpServers?: boolean;
		harnesses?: string[];
	} = {},
) {
	const artifactDir = join(baseDir, name);
	await mkdir(artifactDir, { recursive: true });

	const harnesses = opts.harnesses ?? [
		"kiro",
		"claude-code",
		"copilot",
		"cursor",
		"windsurf",
		"cline",
		"qdeveloper",
	];

	const frontmatter = [
		"---",
		`name: ${name}`,
		`description: Test artifact`,
		`harnesses: [${harnesses.join(", ")}]`,
		`type: skill`,
		`version: "1.0.0"`,
		"---",
		"",
		"# Test Artifact",
		"",
		"This is a test artifact body.",
	].join("\n");

	await writeFile(join(artifactDir, "knowledge.md"), frontmatter, "utf-8");

	if (opts.hooks) {
		const hooks = [
			{
				name: "lint-on-save",
				event: "file_edited",
				condition: { file_patterns: ["*.ts"] },
				action: { type: "run_command", command: "bun run lint" },
			},
		];
		const yaml = await import("js-yaml");
		await writeFile(
			join(artifactDir, "hooks.yaml"),
			yaml.default.dump(hooks),
			"utf-8",
		);
	}

	if (opts.mcpServers) {
		const servers = [
			{
				name: "test-server",
				command: "npx",
				args: ["test-mcp-server"],
				env: { API_KEY: "test" },
			},
		];
		const yaml = await import("js-yaml");
		await writeFile(
			join(artifactDir, "mcp-servers.yaml"),
			yaml.default.dump(servers),
			"utf-8",
		);
	}
}

describe("renderTemper", () => {
	test("produces TemperOutput with system-prompt and steering sections for a basic artifact", async () => {
		const tmpDir = await mkdtemp(join(tmpdir(), "temper-test-"));
		await createTestArtifact(tmpDir, "my-skill");

		const result = await renderTemper({
			artifactName: "my-skill",
			harness: "kiro",
			knowledgeDirs: [tmpDir],
			templatesDir: "templates/harness-adapters",
		});

		expect(result.artifactName).toBe("my-skill");
		expect(result.harnessName).toBe("kiro");
		expect(result.sections.length).toBeGreaterThanOrEqual(2);

		const sectionTypes = result.sections.map((s) => s.type);
		expect(sectionTypes).toContain("system-prompt");
		expect(sectionTypes).toContain("steering");
	});

	test("includes hooks section when artifact has hooks", async () => {
		const tmpDir = await mkdtemp(join(tmpdir(), "temper-test-"));
		await createTestArtifact(tmpDir, "my-skill", { hooks: true });

		const result = await renderTemper({
			artifactName: "my-skill",
			harness: "kiro",
			knowledgeDirs: [tmpDir],
			templatesDir: "templates/harness-adapters",
		});

		const sectionTypes = result.sections.map((s) => s.type);
		expect(sectionTypes).toContain("hooks");
		expect(result.hooksTranslated).toBe(1);
	});

	test("includes mcp-servers section when artifact has MCP servers", async () => {
		const tmpDir = await mkdtemp(join(tmpdir(), "temper-test-"));
		await createTestArtifact(tmpDir, "my-skill", { mcpServers: true });

		const result = await renderTemper({
			artifactName: "my-skill",
			harness: "kiro",
			knowledgeDirs: [tmpDir],
			templatesDir: "templates/harness-adapters",
		});

		const sectionTypes = result.sections.map((s) => s.type);
		expect(sectionTypes).toContain("mcp-servers");
		expect(result.mcpServers).toContain("test-server");
	});

	test("includes degradation-report for harness with unsupported capabilities", async () => {
		const tmpDir = await mkdtemp(join(tmpdir(), "temper-test-"));
		await createTestArtifact(tmpDir, "my-skill", { hooks: true });

		// copilot does not support hooks natively
		const result = await renderTemper({
			artifactName: "my-skill",
			harness: "copilot",
			knowledgeDirs: [tmpDir],
			templatesDir: "templates/harness-adapters",
		});

		const sectionTypes = result.sections.map((s) => s.type);
		expect(sectionTypes).toContain("degradation-report");
		expect(result.degradations.length).toBeGreaterThan(0);
		expect(result.hooksDegraded).toBeGreaterThan(0);
	});

	test("returns error output when artifact not found", async () => {
		const tmpDir = await mkdtemp(join(tmpdir(), "temper-test-"));

		const result = await renderTemper({
			artifactName: "nonexistent",
			harness: "kiro",
			knowledgeDirs: [tmpDir],
			templatesDir: "templates/harness-adapters",
		});

		expect(result.sections[0].content).toContain("not found");
		expect(result.fileCount).toBe(0);
	});

	test("returns error output when harness not in artifact's harnesses list", async () => {
		const tmpDir = await mkdtemp(join(tmpdir(), "temper-test-"));
		await createTestArtifact(tmpDir, "my-skill", {
			harnesses: ["kiro", "cursor"],
		});

		const result = await renderTemper({
			artifactName: "my-skill",
			harness: "copilot",
			knowledgeDirs: [tmpDir],
			templatesDir: "templates/harness-adapters",
		});

		expect(result.sections[0].content).toContain("does not target harness");
		expect(result.fileCount).toBe(0);
	});

	test("no degradation-report when all features are natively supported", async () => {
		const tmpDir = await mkdtemp(join(tmpdir(), "temper-test-"));
		// Create artifact with hooks — kiro fully supports hooks
		await createTestArtifact(tmpDir, "my-skill", { hooks: true });

		const result = await renderTemper({
			artifactName: "my-skill",
			harness: "kiro",
			knowledgeDirs: [tmpDir],
			templatesDir: "templates/harness-adapters",
		});

		const sectionTypes = result.sections.map((s) => s.type);
		expect(sectionTypes).not.toContain("degradation-report");
		expect(result.degradations).toHaveLength(0);
	});

	test("fileCount reflects number of compiled output files", async () => {
		const tmpDir = await mkdtemp(join(tmpdir(), "temper-test-"));
		await createTestArtifact(tmpDir, "my-skill", {
			hooks: true,
			mcpServers: true,
		});

		const result = await renderTemper({
			artifactName: "my-skill",
			harness: "kiro",
			knowledgeDirs: [tmpDir],
			templatesDir: "templates/harness-adapters",
		});

		expect(result.fileCount).toBeGreaterThan(0);
	});
});
