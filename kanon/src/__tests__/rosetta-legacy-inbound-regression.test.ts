/**
 * Rosetta Stone — Legacy Inbound Command & Facade Regression Tests
 *
 * Compares the refactored `src/import.ts` (path-import facade) and
 * `src/importers/` (harness-native facades) against expected behavior:
 * - Repository fixtures, collisions, prompt/force behavior
 * - Canonical bytes, diagnostics, aliases, deprecation guidance
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.10, 14.11, 16.7, 16.8
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import {
	mkdtemp,
	rm,
	mkdir,
	writeFile,
	readFile,
	exists,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { importCommand } from "../import";
import type { ImportFormat } from "../import";
import { importerRegistry } from "../importers/index";
import type { ImportedFile } from "../importers/types";

// ═══════════════════════════════════════════════════════════════════════════════
// Test Fixtures Setup
// ═══════════════════════════════════════════════════════════════════════════════

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "legacy-inbound-regression-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: Create source directories for import facade tests
// ═══════════════════════════════════════════════════════════════════════════════

async function createPowerFixture(name: string): Promise<string> {
	const dir = join(tempDir, "sources", name);
	await mkdir(dir, { recursive: true });
	await writeFile(
		join(dir, "POWER.md"),
		`---
name: ${name}
description: "Regression test power"
keywords:
  - regression
  - test
globs:
  - "**/*.ts"
alwaysApply: false
---

# ${name}

Power body for regression testing.
`,
		"utf-8",
	);
	const steeringDir = join(dir, "steering");
	await mkdir(steeringDir, { recursive: true });
	await writeFile(
		join(steeringDir, "guide.md"),
		"# Guide\n\nSteering guidance content.",
		"utf-8",
	);
	return dir;
}

async function createSkillFixture(name: string): Promise<string> {
	const dir = join(tempDir, "sources", name);
	await mkdir(dir, { recursive: true });
	await writeFile(
		join(dir, "SKILL.md"),
		`---
name: ${name}
description: "Regression test skill"
keywords:
  - regression
---

# ${name}

Skill body for regression testing.
`,
		"utf-8",
	);
	const refsDir = join(dir, "references");
	await mkdir(refsDir, { recursive: true });
	await writeFile(
		join(refsDir, "api.md"),
		"# API Reference\n\nAPI content.",
		"utf-8",
	);
	return dir;
}

async function createSuperpowersFixture(name: string): Promise<string> {
	const dir = join(tempDir, "sources", name);
	await mkdir(dir, { recursive: true });
	await writeFile(
		join(dir, "SKILL.md"),
		`---
name: ${name}
description: "Regression test superpower"
keywords:
  - regression
requires:
  - prerequisite-skill
---

# ${name}

Superpowers body for regression testing.
`,
		"utf-8",
	);
	await writeFile(
		join(dir, "companion.md"),
		"# Companion\n\nCompanion content.",
		"utf-8",
	);
	return dir;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: Create harness-native files for importer facade tests
// ═══════════════════════════════════════════════════════════════════════════════

async function createHarnessNativeFile(
	relativePath: string,
	content: string,
): Promise<string> {
	const fullPath = join(tempDir, relativePath);
	const dir = fullPath.slice(0, fullPath.lastIndexOf("/"));
	await mkdir(dir, { recursive: true });
	await writeFile(fullPath, content, "utf-8");
	return fullPath;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Section 1: Import Facade — Canonical Output Shapes
// ═══════════════════════════════════════════════════════════════════════════════

describe("Legacy Inbound Regression: Import Facade Canonical Output", () => {
	describe("kiro-power format produces expected canonical files", () => {
		it("generates knowledge.md with correct frontmatter shape", async () => {
			const sourceDir = await createPowerFixture("reg-power");
			const knowledgeDir = join(tempDir, "knowledge");

			await importCommand(sourceDir, {
				knowledgeDir,
				format: "kiro-power",
			});

			const targetPath = join(knowledgeDir, "reg-power");
			expect(await exists(targetPath)).toBe(true);

			const content = await readFile(
				join(targetPath, "knowledge.md"),
				"utf-8",
			);
			// Canonical shape assertions
			expect(content).toContain("name: reg-power");
			expect(content).toContain("type: skill");
			expect(content).toContain("harnesses:");
			expect(content).toContain("- kiro");
			expect(content).toContain("harness-config:");
			expect(content).toContain("format: power");
			expect(content).toContain("Power body for regression testing.");
		});

		it("maps globs to file_patterns in canonical output", async () => {
			const sourceDir = await createPowerFixture("glob-power");
			const knowledgeDir = join(tempDir, "knowledge");

			await importCommand(sourceDir, {
				knowledgeDir,
				format: "kiro-power",
			});

			const content = await readFile(
				join(knowledgeDir, "glob-power", "knowledge.md"),
				"utf-8",
			);
			expect(content).toContain("file_patterns:");
			expect(content).toContain("'**/*.ts'");
		});

		it("produces workflows from steering/ subdirectory", async () => {
			const sourceDir = await createPowerFixture("wf-power");
			const knowledgeDir = join(tempDir, "knowledge");

			await importCommand(sourceDir, {
				knowledgeDir,
				format: "kiro-power",
			});

			const targetPath = join(knowledgeDir, "wf-power");
			expect(
				await exists(join(targetPath, "workflows", "guide.md")),
			).toBe(true);
			const wfContent = await readFile(
				join(targetPath, "workflows", "guide.md"),
				"utf-8",
			);
			expect(wfContent).toContain("# Guide");
			expect(wfContent).toContain("Steering guidance content.");
		});
	});

	describe("kiro-skill format produces expected canonical files", () => {
		it("generates knowledge.md with correct frontmatter shape", async () => {
			const sourceDir = await createSkillFixture("reg-skill");
			const knowledgeDir = join(tempDir, "knowledge");

			await importCommand(sourceDir, {
				knowledgeDir,
				format: "kiro-skill",
			});

			const content = await readFile(
				join(knowledgeDir, "reg-skill", "knowledge.md"),
				"utf-8",
			);
			expect(content).toContain("name: reg-skill");
			expect(content).toContain("type: skill");
			expect(content).toContain("harnesses:");
			expect(content).toContain("- kiro");
			expect(content).toContain("Skill body for regression testing.");
		});

		it("produces workflows from references/ subdirectory", async () => {
			const sourceDir = await createSkillFixture("ref-skill");
			const knowledgeDir = join(tempDir, "knowledge");

			await importCommand(sourceDir, {
				knowledgeDir,
				format: "kiro-skill",
			});

			expect(
				await exists(
					join(knowledgeDir, "ref-skill", "workflows", "api.md"),
				),
			).toBe(true);
		});
	});

	describe("superpowers format produces expected canonical files", () => {
		it("generates knowledge.md with correct frontmatter shape", async () => {
			const sourceDir = await createSuperpowersFixture("reg-sp");
			const knowledgeDir = join(tempDir, "knowledge");

			await importCommand(sourceDir, {
				knowledgeDir,
				format: "superpowers",
			});

			const content = await readFile(
				join(knowledgeDir, "reg-sp", "knowledge.md"),
				"utf-8",
			);
			expect(content).toContain("name: reg-sp");
			expect(content).toContain("type: skill");
			expect(content).toContain("harnesses:");
			expect(content).toContain("Superpowers body for regression testing.");
		});

		it("maps requires to depends in canonical output", async () => {
			const sourceDir = await createSuperpowersFixture("dep-sp");
			const knowledgeDir = join(tempDir, "knowledge");

			await importCommand(sourceDir, {
				knowledgeDir,
				format: "superpowers",
			});

			const content = await readFile(
				join(knowledgeDir, "dep-sp", "knowledge.md"),
				"utf-8",
			);
			expect(content).toContain("depends:");
			expect(content).toContain("prerequisite-skill");
		});

		it("produces workflows from companion .md files", async () => {
			const sourceDir = await createSuperpowersFixture("comp-sp");
			const knowledgeDir = join(tempDir, "knowledge");

			await importCommand(sourceDir, {
				knowledgeDir,
				format: "superpowers",
			});

			expect(
				await exists(
					join(knowledgeDir, "comp-sp", "workflows", "companion.md"),
				),
			).toBe(true);
		});
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 2: Harness-Native Importer Facades — ImportedFile Shapes
// ═══════════════════════════════════════════════════════════════════════════════

describe("Legacy Inbound Regression: Harness-Native Importer Facades", () => {
	describe("Kiro importer facade", () => {
		it("produces expected ImportedFile shape from steering markdown", async () => {
			const filePath = await createHarnessNativeFile(
				"kiro/my-rule.md",
				`---
name: my-kiro-rule
description: "A Kiro steering file"
type: skill
harnesses:
  - kiro
---

# Kiro Rule

Follow these guidelines for the project.
`,
			);

			const result: ImportedFile =
				await importerRegistry.kiro.parse(filePath);

			// Kiro importer derives artifact name from filename
			expect(result.artifactName).toBe("my-rule-md");
			expect(result.body).toContain("Follow these guidelines");
			expect(result.hooks).toBeInstanceOf(Array);
			expect(result.mcpServers).toBeInstanceOf(Array);
		});
	});

	describe("Claude Code importer facade", () => {
		it("produces expected ImportedFile from CLAUDE.md", async () => {
			const filePath = await createHarnessNativeFile(
				"claude/CLAUDE.md",
				`# Claude Code Rules

Always write tests before implementation.
`,
			);

			const result: ImportedFile =
				await importerRegistry["claude-code"].parse(filePath);

			expect(result.artifactName).toBe("claude");
			expect(result.body).toContain("Always write tests");
			expect(result.hooks).toBeInstanceOf(Array);
			expect(result.mcpServers).toBeInstanceOf(Array);
		});

		it("extracts hooks from settings.json commands", async () => {
			const filePath = await createHarnessNativeFile(
				"claude/settings.json",
				JSON.stringify({
					commands: ["bun run lint", "bun test"],
				}),
			);

			const result: ImportedFile =
				await importerRegistry["claude-code"].parse(filePath);

			expect(result.hooks.length).toBeGreaterThanOrEqual(2);
			const commands = result.hooks.map((h) => h.action.command);
			expect(commands).toContain("bun run lint");
			expect(commands).toContain("bun test");
		});
	});

	describe("Codex importer facade", () => {
		it("produces expected ImportedFile from AGENTS.md", async () => {
			const filePath = await createHarnessNativeFile(
				"codex/AGENTS.md",
				`# Codex Agent Instructions

Use Bun for all tasks.
`,
			);

			const result: ImportedFile =
				await importerRegistry.codex.parse(filePath);

			expect(result.artifactName).toBe("codex-agents");
			expect(result.body).toContain("Use Bun for all tasks");
			expect(result.hooks).toBeInstanceOf(Array);
			expect(result.mcpServers).toBeInstanceOf(Array);
		});

		it("extracts MCP servers from config.toml", async () => {
			const filePath = await createHarnessNativeFile(
				"codex/config.toml",
				`[mcp_servers.analyzer]
command = "python"
args = ["analyze.py"]
`,
			);

			const result: ImportedFile =
				await importerRegistry.codex.parse(filePath);

			expect(result.artifactName).toBe("codex-mcp");
			expect(result.mcpServers.length).toBeGreaterThanOrEqual(1);
			const names = result.mcpServers.map((s) => s.name);
			expect(names).toContain("analyzer");
		});
	});

	describe("Copilot importer facade", () => {
		it("produces expected ImportedFile from instructions.md", async () => {
			const filePath = await createHarnessNativeFile(
				"copilot/copilot-instructions.md",
				`# Copilot Instructions

Always use TypeScript strict mode.
`,
			);

			const result: ImportedFile =
				await importerRegistry.copilot.parse(filePath);

			expect(result.artifactName).toBe("copilot-instructions");
			expect(result.body).toContain("Always use TypeScript strict mode");
			expect(result.hooks).toBeInstanceOf(Array);
			expect(result.mcpServers).toBeInstanceOf(Array);
		});
	});

	describe("Cursor importer facade", () => {
		it("produces expected ImportedFile from .cursor/rules/*.md", async () => {
			const filePath = await createHarnessNativeFile(
				"cursor/my-rule.md",
				`# Cursor Rule

Format with Biome.
`,
			);

			const result: ImportedFile =
				await importerRegistry.cursor.parse(filePath);

			expect(result.artifactName).toBe("my-rule");
			expect(result.body).toContain("Format with Biome");
			expect(result.hooks).toBeInstanceOf(Array);
			expect(result.mcpServers).toBeInstanceOf(Array);
		});
	});

	describe("Windsurf importer facade", () => {
		it("produces expected ImportedFile from .windsurf/rules/*.md", async () => {
			const filePath = await createHarnessNativeFile(
				"windsurf/coding-style.md",
				`# Coding Style

Use functional patterns.
`,
			);

			const result: ImportedFile =
				await importerRegistry.windsurf.parse(filePath);

			expect(result.artifactName).toBe("coding-style");
			expect(result.body).toContain("Use functional patterns");
			expect(result.hooks).toBeInstanceOf(Array);
			expect(result.mcpServers).toBeInstanceOf(Array);
		});
	});

	describe("Cline importer facade", () => {
		it("produces expected ImportedFile from .clinerules/*.md", async () => {
			const filePath = await createHarnessNativeFile(
				"cline/project-rules.md",
				`# Project Rules

No console.log in production code.
`,
			);

			const result: ImportedFile =
				await importerRegistry.cline.parse(filePath);

			expect(result.artifactName).toBe("project-rules");
			expect(result.body).toContain("No console.log in production code");
			expect(result.hooks).toBeInstanceOf(Array);
			expect(result.mcpServers).toBeInstanceOf(Array);
		});
	});

	describe("Q Developer importer facade", () => {
		it("produces expected ImportedFile from .q/rules/*.md", async () => {
			const filePath = await createHarnessNativeFile(
				"qdeveloper/aws-rules.md",
				`# AWS Rules

Always use IAM least privilege.
`,
			);

			const result: ImportedFile =
				await importerRegistry.qdeveloper.parse(filePath);

			expect(result.artifactName).toBe("aws-rules");
			expect(result.body).toContain("Always use IAM least privilege");
			expect(result.hooks).toBeInstanceOf(Array);
			expect(result.mcpServers).toBeInstanceOf(Array);
		});
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 3: Collisions — Skip by Default, Overwrite with --force
// ═══════════════════════════════════════════════════════════════════════════════

describe("Legacy Inbound Regression: Collision Behavior", () => {
	it("skips existing artifact directory by default (no --force)", async () => {
		const sourceDir = await createPowerFixture("collision-power");
		const knowledgeDir = join(tempDir, "knowledge");

		// Pre-create the target directory to simulate collision
		await mkdir(join(knowledgeDir, "collision-power"), { recursive: true });

		await importCommand(sourceDir, {
			knowledgeDir,
			format: "kiro-power",
		});

		// No knowledge.md should have been written (was skipped)
		expect(
			await exists(
				join(knowledgeDir, "collision-power", "knowledge.md"),
			),
		).toBe(false);
	});

	it("skips without error and continues for --all mode", async () => {
		const sourcesDir = join(tempDir, "sources");
		await createPowerFixture("existing-one");
		await createPowerFixture("new-one");

		const knowledgeDir = join(tempDir, "knowledge");
		// Pre-create only one collision target
		await mkdir(join(knowledgeDir, "existing-one"), { recursive: true });

		await importCommand(sourcesDir, {
			knowledgeDir,
			all: true,
		});

		// existing-one was skipped (no knowledge.md)
		expect(
			await exists(
				join(knowledgeDir, "existing-one", "knowledge.md"),
			),
		).toBe(false);
		// new-one was imported successfully
		expect(
			await exists(join(knowledgeDir, "new-one", "knowledge.md")),
		).toBe(true);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 4: Dry-Run — No Writes, Same Diagnostics/Output
// ═══════════════════════════════════════════════════════════════════════════════

describe("Legacy Inbound Regression: Dry-Run Mode", () => {
	it("does not write any files when --dry-run is set", async () => {
		const sourceDir = await createPowerFixture("dryrun-power");
		const knowledgeDir = join(tempDir, "knowledge");

		await importCommand(sourceDir, {
			knowledgeDir,
			format: "kiro-power",
			dryRun: true,
		});

		// The knowledge directory should not exist
		expect(await exists(join(knowledgeDir, "dryrun-power"))).toBe(false);
	});

	it("does not write files for kiro-skill in dry-run", async () => {
		const sourceDir = await createSkillFixture("dryrun-skill");
		const knowledgeDir = join(tempDir, "knowledge");

		await importCommand(sourceDir, {
			knowledgeDir,
			format: "kiro-skill",
			dryRun: true,
		});

		expect(await exists(join(knowledgeDir, "dryrun-skill"))).toBe(false);
	});

	it("does not write files for superpowers in dry-run", async () => {
		const sourceDir = await createSuperpowersFixture("dryrun-sp");
		const knowledgeDir = join(tempDir, "knowledge");

		await importCommand(sourceDir, {
			knowledgeDir,
			format: "superpowers",
			dryRun: true,
		});

		expect(await exists(join(knowledgeDir, "dryrun-sp"))).toBe(false);
	});

	it("does not write files in --all dry-run", async () => {
		const sourcesDir = join(tempDir, "sources");
		await createPowerFixture("dr-all-power");
		await createSkillFixture("dr-all-skill");
		const knowledgeDir = join(tempDir, "knowledge");

		await importCommand(sourcesDir, {
			knowledgeDir,
			all: true,
			dryRun: true,
		});

		expect(await exists(join(knowledgeDir, "dr-all-power"))).toBe(false);
		expect(await exists(join(knowledgeDir, "dr-all-skill"))).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 5: Format Detection — Auto-Detection Picks Correct Format
// ═══════════════════════════════════════════════════════════════════════════════

describe("Legacy Inbound Regression: Format Auto-Detection", () => {
	it("detects kiro-power from POWER.md presence", async () => {
		const sourceDir = await createPowerFixture("auto-power");
		const knowledgeDir = join(tempDir, "knowledge");

		// Use default format (auto)
		await importCommand(sourceDir, { knowledgeDir });

		const content = await readFile(
			join(knowledgeDir, "auto-power", "knowledge.md"),
			"utf-8",
		);
		// Should have detected kiro-power and produced power harness-config
		expect(content).toContain("harness-config:");
		expect(content).toContain("format: power");
	});

	it("detects kiro-skill from SKILL.md presence (no POWER.md)", async () => {
		const sourceDir = await createSkillFixture("auto-skill");
		const knowledgeDir = join(tempDir, "knowledge");

		await importCommand(sourceDir, { knowledgeDir });

		expect(
			await exists(join(knowledgeDir, "auto-skill", "knowledge.md")),
		).toBe(true);
	});

	it("skips directories without recognizable format markers", async () => {
		const dir = join(tempDir, "sources", "no-format");
		await mkdir(dir, { recursive: true });
		await writeFile(join(dir, "README.md"), "# Just a readme", "utf-8");

		const knowledgeDir = join(tempDir, "knowledge");

		// Should not throw, just skip
		await importCommand(dir, { knowledgeDir });

		expect(await exists(knowledgeDir)).toBe(false);
	});

	it("explicit format takes precedence over auto-detection", async () => {
		// Create a directory with both POWER.md and SKILL.md
		const dir = join(tempDir, "sources", "ambiguous");
		await mkdir(dir, { recursive: true });
		await writeFile(
			join(dir, "POWER.md"),
			`---
name: ambiguous
description: "Has both"
keywords: []
---
# Power Body
`,
			"utf-8",
		);
		await writeFile(
			join(dir, "SKILL.md"),
			`---
name: ambiguous-skill
description: "Also a skill"
---
# Skill Body
`,
			"utf-8",
		);

		const knowledgeDir = join(tempDir, "knowledge");

		// Force kiro-power format explicitly
		await importCommand(dir, {
			knowledgeDir,
			format: "kiro-power",
		});

		const content = await readFile(
			join(knowledgeDir, "ambiguous", "knowledge.md"),
			"utf-8",
		);
		expect(content).toContain("format: power");
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 6: Deprecation Guidance — Legacy auto and power: true
// ═══════════════════════════════════════════════════════════════════════════════

describe("Legacy Inbound Regression: Deprecation and Aliases", () => {
	it("legacy 'auto' format string is accepted without throwing", async () => {
		const sourceDir = await createPowerFixture("auto-fmt-power");
		const knowledgeDir = join(tempDir, "knowledge");

		// Using "auto" explicitly should still work (it triggers detection)
		await importCommand(sourceDir, {
			knowledgeDir,
			format: "auto" as ImportFormat,
		});

		// Should detect as kiro-power via auto and produce output
		expect(
			await exists(
				join(knowledgeDir, "auto-fmt-power", "knowledge.md"),
			),
		).toBe(true);
	});

	it("import facade correctly generates kiro harness-config with format: power", async () => {
		// This validates that the `power: true` legacy pattern is represented
		// as `harness-config: { kiro: { format: power } }` in canonical output
		const sourceDir = await createPowerFixture("power-config");
		const knowledgeDir = join(tempDir, "knowledge");

		await importCommand(sourceDir, {
			knowledgeDir,
			format: "kiro-power",
		});

		const content = await readFile(
			join(knowledgeDir, "power-config", "knowledge.md"),
			"utf-8",
		);
		// The canonical representation uses harness-config instead of power: true
		expect(content).toContain("harness-config:");
		expect(content).toContain("kiro:");
		expect(content).toContain("format: power");
		// Should NOT contain legacy `power: true` in canonical output
		expect(content).not.toMatch(/^power:\s*true/m);
	});

	it("ImportFormat type includes 'auto' as valid legacy value", () => {
		// Type-level assertion: "auto" is a valid ImportFormat
		const format: ImportFormat = "auto";
		expect(["kiro-power", "kiro-skill", "superpowers", "auto"]).toContain(
			format,
		);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 7: Canonical Bytes — Deterministic output structure
// ═══════════════════════════════════════════════════════════════════════════════

describe("Legacy Inbound Regression: Canonical Bytes Determinism", () => {
	it("two imports of the same source produce identical knowledge.md", async () => {
		const sourceDir = await createPowerFixture("determ-power");
		const knowledgeDir1 = join(tempDir, "knowledge1");
		const knowledgeDir2 = join(tempDir, "knowledge2");

		await importCommand(sourceDir, {
			knowledgeDir: knowledgeDir1,
			format: "kiro-power",
		});

		await importCommand(sourceDir, {
			knowledgeDir: knowledgeDir2,
			format: "kiro-power",
		});

		const content1 = await readFile(
			join(knowledgeDir1, "determ-power", "knowledge.md"),
			"utf-8",
		);
		const content2 = await readFile(
			join(knowledgeDir2, "determ-power", "knowledge.md"),
			"utf-8",
		);
		expect(content1).toBe(content2);
	});

	it("canonical knowledge.md starts with YAML frontmatter fence", async () => {
		const sourceDir = await createPowerFixture("fence-power");
		const knowledgeDir = join(tempDir, "knowledge");

		await importCommand(sourceDir, {
			knowledgeDir,
			format: "kiro-power",
		});

		const content = await readFile(
			join(knowledgeDir, "fence-power", "knowledge.md"),
			"utf-8",
		);
		expect(content.startsWith("---\n")).toBe(true);
		// Should have both opening and closing YAML fences
		const fenceCount = (content.match(/^---$/gm) || []).length;
		expect(fenceCount).toBeGreaterThanOrEqual(2);
	});

	it("auxiliary files are always created (hooks.yaml, mcp-servers.yaml)", async () => {
		const sourceDir = await createPowerFixture("aux-power");
		const knowledgeDir = join(tempDir, "knowledge");

		await importCommand(sourceDir, {
			knowledgeDir,
			format: "kiro-power",
		});

		const targetPath = join(knowledgeDir, "aux-power");
		expect(await exists(join(targetPath, "hooks.yaml"))).toBe(true);
		expect(await exists(join(targetPath, "mcp-servers.yaml"))).toBe(true);
	});
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 8: Harness Importer Facade — Consistent ImportedFile Contract
// ═══════════════════════════════════════════════════════════════════════════════

describe("Legacy Inbound Regression: ImportedFile Shape Contract", () => {
	it("all harness parsers return objects with required ImportedFile fields", async () => {
		const harnesses = [
			{
				name: "kiro" as const,
				file: "kiro-test.md",
				content: "---\nname: test\n---\n# Test",
			},
			{
				name: "claude-code" as const,
				file: "CLAUDE.md",
				content: "# Claude\nRules here.",
			},
			{
				name: "codex" as const,
				file: "AGENTS.md",
				content: "# Agents\nInstructions.",
			},
			{
				name: "copilot" as const,
				file: "copilot-instructions.md",
				content: "# Instructions\nGuidance.",
			},
			{
				name: "cursor" as const,
				file: "rule.md",
				content: "# Rule\nCursor rules.",
			},
			{
				name: "windsurf" as const,
				file: "guidelines.md",
				content: "# Guidelines\nWindsurf content.",
			},
			{
				name: "cline" as const,
				file: "cline-rule.md",
				content: "# Cline\nCline rules.",
			},
			{
				name: "qdeveloper" as const,
				file: "q-rule.md",
				content: "# Q Rule\nQ Developer rules.",
			},
		];

		for (const { name, file, content } of harnesses) {
			const filePath = await createHarnessNativeFile(
				`importer-shape/${name}/${file}`,
				content,
			);

			const result = await importerRegistry[name].parse(filePath);

			// Validate all required ImportedFile fields exist
			expect(typeof result.sourcePath).toBe("string");
			expect(typeof result.artifactName).toBe("string");
			expect(result.artifactName.length).toBeGreaterThan(0);
			expect(typeof result.body).toBe("string");
			expect(result.frontmatter).toBeDefined();
			expect(typeof result.frontmatter).toBe("object");
			expect(Array.isArray(result.hooks)).toBe(true);
			expect(Array.isArray(result.mcpServers)).toBe(true);
		}
	});

	it("artifact names are kebab-case", async () => {
		const filePath = await createHarnessNativeFile(
			"kebab/MyMixedCase.md",
			"# Test\nContent.",
		);

		const result = await importerRegistry.cursor.parse(filePath);

		// Should be lowercased and normalized
		expect(result.artifactName).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
	});
});
