/**
 * Import Facade Integration Tests
 *
 * Validates that the refactored src/import.ts (legacy path-import facade)
 * correctly delegates to Rosetta Stone source translators and canonical
 * serializer while preserving all existing behavior:
 * - --all scanning, format/auto detection
 * - Collection injection
 * - Collision detection (skip on existing)
 * - Dry-run mode
 * - Destination directory override
 *
 * Requirements: 14.1, 14.3, 14.4, 14.10, 14.11
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	exists,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { importCommand } from "../import";

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

let tempDir: string;

beforeEach(async () => {
	tempDir = await mkdtemp(join(tmpdir(), "import-facade-test-"));
});

afterEach(async () => {
	await rm(tempDir, { recursive: true, force: true });
});

/**
 * Creates a kiro-power source directory with POWER.md and optional steering files.
 */
async function createPowerSource(
	name: string,
	opts?: { steering?: Record<string, string> },
): Promise<string> {
	const dir = join(tempDir, "sources", name);
	await mkdir(dir, { recursive: true });

	const powerMd = `---
name: ${name}
description: A test power
keywords:
  - test
  - example
author: tester
---
# ${name}

Power body content.
`;
	await writeFile(join(dir, "POWER.md"), powerMd, "utf-8");

	if (opts?.steering) {
		const steeringDir = join(dir, "steering");
		await mkdir(steeringDir, { recursive: true });
		for (const [file, content] of Object.entries(opts.steering)) {
			await writeFile(join(steeringDir, file), content, "utf-8");
		}
	}

	return dir;
}

/**
 * Creates a kiro-skill source directory with SKILL.md and optional references.
 */
async function createSkillSource(
	name: string,
	opts?: { references?: Record<string, string> },
): Promise<string> {
	const dir = join(tempDir, "sources", name);
	await mkdir(dir, { recursive: true });

	const skillMd = `---
name: ${name}
description: A test skill
keywords:
  - test
---
# ${name}

Skill body content.
`;
	await writeFile(join(dir, "SKILL.md"), skillMd, "utf-8");

	if (opts?.references) {
		const refsDir = join(dir, "references");
		await mkdir(refsDir, { recursive: true });
		for (const [file, content] of Object.entries(opts.references)) {
			await writeFile(join(refsDir, file), content, "utf-8");
		}
	}

	return dir;
}

/**
 * Creates a superpowers source directory with SKILL.md and companion .md files.
 */
async function createSuperpowersSource(
	name: string,
	opts?: { companions?: Record<string, string> },
): Promise<string> {
	const dir = join(tempDir, "sources", name);
	await mkdir(dir, { recursive: true });

	const skillMd = `---
name: ${name}
description: A superpowers skill
---
# ${name}

Superpowers body content.
`;
	await writeFile(join(dir, "SKILL.md"), skillMd, "utf-8");

	if (opts?.companions) {
		for (const [file, content] of Object.entries(opts.companions)) {
			await writeFile(join(dir, file), content, "utf-8");
		}
	}

	return dir;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("Import Facade — kiro-power format", () => {
	it("imports a kiro-power directory into canonical format", async () => {
		const sourceDir = await createPowerSource("my-power");
		const knowledgeDir = join(tempDir, "knowledge");

		await importCommand(sourceDir, {
			knowledgeDir,
			format: "kiro-power",
		});

		// Verify output was written
		const targetPath = join(knowledgeDir, "my-power");
		expect(await exists(targetPath)).toBe(true);
		expect(await exists(join(targetPath, "knowledge.md"))).toBe(true);
		expect(await exists(join(targetPath, "hooks.yaml"))).toBe(true);
		expect(await exists(join(targetPath, "mcp-servers.yaml"))).toBe(true);

		// Verify content is canonical
		const knowledgeMd = await readFile(
			join(targetPath, "knowledge.md"),
			"utf-8",
		);
		expect(knowledgeMd).toContain("name: my-power");
		expect(knowledgeMd).toContain("type: skill");
		expect(knowledgeMd).toContain("harness-config:");
		expect(knowledgeMd).toContain("format: power");
		expect(knowledgeMd).toContain("Power body content.");
	});

	it("copies steering files as workflows", async () => {
		const sourceDir = await createPowerSource("power-with-steering", {
			steering: {
				"guide.md": "# Guide\nSome guidance.",
				"setup.md": "# Setup\nSetup instructions.",
			},
		});
		const knowledgeDir = join(tempDir, "knowledge");

		await importCommand(sourceDir, {
			knowledgeDir,
			format: "kiro-power",
		});

		const targetPath = join(knowledgeDir, "power-with-steering");
		expect(await exists(join(targetPath, "workflows", "guide.md"))).toBe(true);
		expect(await exists(join(targetPath, "workflows", "setup.md"))).toBe(true);

		const guideContent = await readFile(
			join(targetPath, "workflows", "guide.md"),
			"utf-8",
		);
		expect(guideContent).toContain("# Guide");
	});

	it("skips if target already exists (collision)", async () => {
		const sourceDir = await createPowerSource("existing-power");
		const knowledgeDir = join(tempDir, "knowledge");

		// Pre-create the target
		await mkdir(join(knowledgeDir, "existing-power"), { recursive: true });

		// This should skip without error
		await importCommand(sourceDir, {
			knowledgeDir,
			format: "kiro-power",
		});

		// The existing directory should remain empty (no knowledge.md written)
		expect(
			await exists(join(knowledgeDir, "existing-power", "knowledge.md")),
		).toBe(false);
	});
});

describe("Import Facade — kiro-skill format", () => {
	it("imports a kiro-skill directory into canonical format", async () => {
		const sourceDir = await createSkillSource("my-skill");
		const knowledgeDir = join(tempDir, "knowledge");

		await importCommand(sourceDir, {
			knowledgeDir,
			format: "kiro-skill",
		});

		const targetPath = join(knowledgeDir, "my-skill");
		expect(await exists(targetPath)).toBe(true);

		const knowledgeMd = await readFile(
			join(targetPath, "knowledge.md"),
			"utf-8",
		);
		expect(knowledgeMd).toContain("name: my-skill");
		expect(knowledgeMd).toContain("type: skill");
		expect(knowledgeMd).toContain("Skill body content.");
	});

	it("maps references/ to workflows/", async () => {
		const sourceDir = await createSkillSource("skill-with-refs", {
			references: { "api-ref.md": "# API Reference\nSome API docs." },
		});
		const knowledgeDir = join(tempDir, "knowledge");

		await importCommand(sourceDir, {
			knowledgeDir,
			format: "kiro-skill",
		});

		const targetPath = join(knowledgeDir, "skill-with-refs");
		expect(await exists(join(targetPath, "workflows", "api-ref.md"))).toBe(
			true,
		);
	});
});

describe("Import Facade — superpowers format", () => {
	it("imports a superpowers directory into canonical format", async () => {
		const sourceDir = await createSuperpowersSource("my-superpowers-skill");
		const knowledgeDir = join(tempDir, "knowledge");

		await importCommand(sourceDir, {
			knowledgeDir,
			format: "superpowers",
		});

		const targetPath = join(knowledgeDir, "my-superpowers-skill");
		expect(await exists(targetPath)).toBe(true);

		const knowledgeMd = await readFile(
			join(targetPath, "knowledge.md"),
			"utf-8",
		);
		expect(knowledgeMd).toContain("name: my-superpowers-skill");
		expect(knowledgeMd).toContain("type: skill");
		expect(knowledgeMd).toContain("Superpowers body content.");
	});

	it("maps companion .md files to workflows", async () => {
		const sourceDir = await createSuperpowersSource("sp-with-companions", {
			companions: { "notes.md": "# Notes\nCompanion content." },
		});
		const knowledgeDir = join(tempDir, "knowledge");

		await importCommand(sourceDir, {
			knowledgeDir,
			format: "superpowers",
		});

		const targetPath = join(knowledgeDir, "sp-with-companions");
		expect(await exists(join(targetPath, "workflows", "notes.md"))).toBe(true);
	});
});

describe("Import Facade — auto detection", () => {
	it("detects kiro-power format from POWER.md", async () => {
		const sourceDir = await createPowerSource("auto-detected-power");
		const knowledgeDir = join(tempDir, "knowledge");

		await importCommand(sourceDir, {
			knowledgeDir,
			// format defaults to "auto"
		});

		const targetPath = join(knowledgeDir, "auto-detected-power");
		expect(await exists(targetPath)).toBe(true);
		const knowledgeMd = await readFile(
			join(targetPath, "knowledge.md"),
			"utf-8",
		);
		expect(knowledgeMd).toContain("harness-config:");
		expect(knowledgeMd).toContain("format: power");
	});

	it("detects kiro-skill format from SKILL.md", async () => {
		const sourceDir = await createSkillSource("auto-detected-skill");
		const knowledgeDir = join(tempDir, "knowledge");

		await importCommand(sourceDir, { knowledgeDir });

		expect(await exists(join(knowledgeDir, "auto-detected-skill"))).toBe(true);
	});

	it("skips unrecognized directories", async () => {
		const dir = join(tempDir, "sources", "unknown-dir");
		await mkdir(dir, { recursive: true });
		await writeFile(join(dir, "random.txt"), "not an artifact", "utf-8");

		const knowledgeDir = join(tempDir, "knowledge");

		// Should not throw — just skip
		await importCommand(dir, { knowledgeDir });

		// No artifact should have been created
		expect(await exists(knowledgeDir)).toBe(false);
	});
});

describe("Import Facade — --all mode", () => {
	it("imports all subdirectories", async () => {
		const sourcesDir = join(tempDir, "sources");
		await createPowerSource("power-one");
		await createSkillSource("skill-two");

		const knowledgeDir = join(tempDir, "knowledge");

		await importCommand(sourcesDir, {
			knowledgeDir,
			all: true,
		});

		expect(await exists(join(knowledgeDir, "power-one"))).toBe(true);
		expect(await exists(join(knowledgeDir, "skill-two"))).toBe(true);
	});
});

describe("Import Facade — dry-run mode", () => {
	it("does not write files in dry-run mode", async () => {
		const sourceDir = await createPowerSource("dry-run-power");
		const knowledgeDir = join(tempDir, "knowledge");

		await importCommand(sourceDir, {
			knowledgeDir,
			format: "kiro-power",
			dryRun: true,
		});

		// Nothing should have been written
		expect(await exists(join(knowledgeDir, "dry-run-power"))).toBe(false);
	});
});

describe("Import Facade — collections injection", () => {
	it("injects collections into the canonical artifact", async () => {
		const sourceDir = await createPowerSource("collection-power");
		const knowledgeDir = join(tempDir, "knowledge");

		await importCommand(sourceDir, {
			knowledgeDir,
			format: "kiro-power",
			collections: "neon-caravan,dev-tools",
		});

		const targetPath = join(knowledgeDir, "collection-power");
		const knowledgeMd = await readFile(
			join(targetPath, "knowledge.md"),
			"utf-8",
		);
		expect(knowledgeMd).toContain("neon-caravan");
		expect(knowledgeMd).toContain("dev-tools");
	});
});

describe("Import Facade — destination override", () => {
	it("writes to custom knowledge directory", async () => {
		const sourceDir = await createPowerSource("custom-dest-power");
		const customDir = join(tempDir, "custom-output");

		await importCommand(sourceDir, {
			knowledgeDir: customDir,
			format: "kiro-power",
		});

		expect(
			await exists(join(customDir, "custom-dest-power", "knowledge.md")),
		).toBe(true);
	});
});
