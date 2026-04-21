import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type BuildOptions, build } from "../build";

const TEMPLATES_DIR = resolve(
	import.meta.dir,
	"../../templates/harness-adapters",
);

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "build-ws-test-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

/** Write a minimal knowledge artifact */
async function writeArtifact(
	dir: string,
	config: {
		name: string;
		harnesses?: string[];
		body?: string;
		harnessConfig?: string;
	},
): Promise<void> {
	const artifactDir = join(dir, config.name);
	await mkdir(artifactDir, { recursive: true });

	const harnesses = config.harnesses ?? ["kiro", "cursor"];
	const harnessConfigLine = config.harnessConfig ?? "";
	const frontmatter = [
		"---",
		`name: ${config.name}`,
		`description: "Test artifact"`,
		`harnesses: [${harnesses.map((h) => `"${h}"`).join(", ")}]`,
		harnessConfigLine,
		"---",
	].join("\n");

	await writeFile(
		join(artifactDir, "knowledge.md"),
		`${frontmatter}\n\n${config.body ?? "Test body content."}`,
		"utf-8",
	);
}

/** Write a workspace config YAML */
async function writeWorkspaceConfig(
	rootDir: string,
	config: string,
): Promise<void> {
	await writeFile(join(rootDir, "forge.config.yaml"), config, "utf-8");
}

function makeBuildOptions(overrides?: Partial<BuildOptions>): BuildOptions {
	return {
		distDir: join(tempDir, "dist"),
		templatesDir: TEMPLATES_DIR,
		mcpServersDir: join(tempDir, "mcp-servers"),
		workspaceRoot: tempDir,
		...overrides,
	};
}

describe("Workspace-aware build", () => {
	test("compiles artifacts per project according to harnesses config", async () => {
		// Set up knowledge source
		const knowledgeDir = join(tempDir, "knowledge");
		await writeArtifact(knowledgeDir, {
			name: "alpha-skill",
			harnesses: ["kiro", "cursor", "copilot"],
			body: "Alpha content.",
		});
		await writeArtifact(knowledgeDir, {
			name: "beta-skill",
			harnesses: ["kiro", "cursor", "copilot"],
			body: "Beta content.",
		});

		// Set up project directories
		await mkdir(join(tempDir, "packages/api"), { recursive: true });
		await mkdir(join(tempDir, "packages/web"), { recursive: true });
		await mkdir(join(tempDir, "mcp-servers"), { recursive: true });

		// Write workspace config
		await writeWorkspaceConfig(
			tempDir,
			`
knowledgeSources:
  - knowledge
projects:
  - name: api
    root: packages/api
    harnesses:
      - kiro
      - cursor
  - name: web
    root: packages/web
    harnesses:
      - copilot
`,
		);

		const result = await build(makeBuildOptions());

		expect(result.errors).toEqual([]);
		expect(result.artifactsCompiled).toBeGreaterThan(0);
		expect(result.filesWritten).toBeGreaterThan(0);

		// Verify dist has kiro and cursor dirs (from api project)
		const distEntries = await readdir(join(tempDir, "dist"));
		expect(distEntries).toContain("kiro");
		expect(distEntries).toContain("cursor");
		expect(distEntries).toContain("copilot");
	});

	test("resolves knowledgeSources relative to workspace root", async () => {
		// Create a nested knowledge source
		const nestedDir = join(tempDir, "libs/shared-knowledge");
		await writeArtifact(nestedDir, {
			name: "shared-skill",
			harnesses: ["kiro"],
			body: "Shared content.",
		});

		await mkdir(join(tempDir, "packages/api"), { recursive: true });
		await mkdir(join(tempDir, "mcp-servers"), { recursive: true });

		await writeWorkspaceConfig(
			tempDir,
			`
knowledgeSources:
  - libs/shared-knowledge
projects:
  - name: api
    root: packages/api
    harnesses:
      - kiro
`,
		);

		const result = await build(makeBuildOptions());

		expect(result.errors).toEqual([]);
		expect(result.artifactsCompiled).toBe(1);
		expect(result.filesWritten).toBeGreaterThan(0);
	});

	test("returns errors on artifact name conflicts across sources", async () => {
		// Create two sources with same artifact name
		const sourceA = join(tempDir, "source-a");
		const sourceB = join(tempDir, "source-b");
		await writeArtifact(sourceA, {
			name: "conflicting-skill",
			harnesses: ["kiro"],
		});
		await writeArtifact(sourceB, {
			name: "conflicting-skill",
			harnesses: ["kiro"],
		});

		await mkdir(join(tempDir, "packages/api"), { recursive: true });
		await mkdir(join(tempDir, "mcp-servers"), { recursive: true });

		await writeWorkspaceConfig(
			tempDir,
			`
knowledgeSources:
  - source-a
  - source-b
projects:
  - name: api
    root: packages/api
    harnesses:
      - kiro
`,
		);

		const result = await build(makeBuildOptions());

		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.errors[0].message).toContain("conflict");
		expect(result.errors[0].artifactName).toBe("conflicting-skill");
		expect(result.artifactsCompiled).toBe(0);
	});

	test("applies project overrides to harness-config", async () => {
		const knowledgeDir = join(tempDir, "knowledge");
		await writeArtifact(knowledgeDir, {
			name: "format-skill",
			harnesses: ["kiro"],
			harnessConfig: "harness-config:\n  kiro:\n    format: steering",
			body: "Format test.",
		});

		await mkdir(join(tempDir, "packages/api"), { recursive: true });
		await mkdir(join(tempDir, "mcp-servers"), { recursive: true });

		// Project overrides the format to "power"
		await writeWorkspaceConfig(
			tempDir,
			`
knowledgeSources:
  - knowledge
projects:
  - name: api
    root: packages/api
    harnesses:
      - kiro
    overrides:
      kiro:
        format: power
`,
		);

		const result = await build(makeBuildOptions());

		expect(result.errors).toEqual([]);
		expect(result.artifactsCompiled).toBe(1);

		// Verify the output uses power format (POWER.md instead of SKILL.md)
		const kiroDir = join(tempDir, "dist/kiro/format-skill");
		const files = await readdir(kiroDir);
		expect(files).toContain("POWER.md");
	});

	test("respects project artifacts include filter", async () => {
		const knowledgeDir = join(tempDir, "knowledge");
		await writeArtifact(knowledgeDir, {
			name: "included-skill",
			harnesses: ["kiro"],
		});
		await writeArtifact(knowledgeDir, {
			name: "excluded-skill",
			harnesses: ["kiro"],
		});

		await mkdir(join(tempDir, "packages/api"), { recursive: true });
		await mkdir(join(tempDir, "mcp-servers"), { recursive: true });

		await writeWorkspaceConfig(
			tempDir,
			`
knowledgeSources:
  - knowledge
projects:
  - name: api
    root: packages/api
    harnesses:
      - kiro
    artifacts:
      include:
        - included-skill
`,
		);

		const result = await build(makeBuildOptions());

		expect(result.errors).toEqual([]);
		expect(result.artifactsCompiled).toBe(1);

		const kiroDir = join(tempDir, "dist/kiro");
		const artifactDirs = await readdir(kiroDir);
		expect(artifactDirs).toContain("included-skill");
		expect(artifactDirs).not.toContain("excluded-skill");
	});

	test("respects project artifacts exclude filter", async () => {
		const knowledgeDir = join(tempDir, "knowledge");
		await writeArtifact(knowledgeDir, {
			name: "keep-skill",
			harnesses: ["kiro"],
		});
		await writeArtifact(knowledgeDir, {
			name: "drop-skill",
			harnesses: ["kiro"],
		});

		await mkdir(join(tempDir, "packages/api"), { recursive: true });
		await mkdir(join(tempDir, "mcp-servers"), { recursive: true });

		await writeWorkspaceConfig(
			tempDir,
			`
knowledgeSources:
  - knowledge
projects:
  - name: api
    root: packages/api
    harnesses:
      - kiro
    artifacts:
      exclude:
        - drop-skill
`,
		);

		const result = await build(makeBuildOptions());

		expect(result.errors).toEqual([]);
		expect(result.artifactsCompiled).toBe(1);

		const kiroDir = join(tempDir, "dist/kiro");
		const artifactDirs = await readdir(kiroDir);
		expect(artifactDirs).toContain("keep-skill");
		expect(artifactDirs).not.toContain("drop-skill");
	});

	test("falls back to single-directory behavior when no workspace config", async () => {
		const knowledgeDir = join(tempDir, "knowledge");
		await writeArtifact(knowledgeDir, {
			name: "solo-skill",
			harnesses: ["kiro"],
		});
		await mkdir(join(tempDir, "mcp-servers"), { recursive: true });

		// No forge.config.yaml — should use fallback
		const result = await build({
			knowledgeDirs: [knowledgeDir],
			distDir: join(tempDir, "dist"),
			templatesDir: TEMPLATES_DIR,
			mcpServersDir: join(tempDir, "mcp-servers"),
			workspaceRoot: tempDir,
		});

		expect(result.errors).toEqual([]);
		expect(result.artifactsCompiled).toBe(1);
		expect(result.filesWritten).toBeGreaterThan(0);
	});

	test("filters by --harness flag in workspace mode", async () => {
		const knowledgeDir = join(tempDir, "knowledge");
		await writeArtifact(knowledgeDir, {
			name: "multi-skill",
			harnesses: ["kiro", "cursor", "copilot"],
		});

		await mkdir(join(tempDir, "packages/api"), { recursive: true });
		await mkdir(join(tempDir, "mcp-servers"), { recursive: true });

		await writeWorkspaceConfig(
			tempDir,
			`
knowledgeSources:
  - knowledge
projects:
  - name: api
    root: packages/api
    harnesses:
      - kiro
      - cursor
      - copilot
`,
		);

		const result = await build(makeBuildOptions({ harness: "cursor" }));

		expect(result.errors).toEqual([]);
		expect(result.artifactsCompiled).toBe(1);

		const distEntries = await readdir(join(tempDir, "dist"));
		expect(distEntries).toContain("cursor");
		expect(distEntries).not.toContain("kiro");
		expect(distEntries).not.toContain("copilot");
	});
});
