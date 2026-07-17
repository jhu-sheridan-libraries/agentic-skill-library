import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generatePluginSkills } from "../../scripts/generate-plugin-skills";

let tempDir: string;
let originalCwd: string;

beforeEach(async () => {
	originalCwd = process.cwd();
	tempDir = await mkdtemp(join(tmpdir(), "gen-skills-"));
	await mkdir(join(tempDir, "knowledge"), { recursive: true });
});

afterEach(async () => {
	process.chdir(originalCwd);
	await rm(tempDir, { recursive: true, force: true });
});

async function writePowerArtifact(
	name: string,
	harnesses: string[],
	override?: string,
) {
	const dir = join(tempDir, "knowledge", name);
	await mkdir(dir, { recursive: true });
	await writeFile(
		join(dir, "knowledge.md"),
		[
			"---",
			`name: ${name}`,
			"type: power",
			`harnesses: [${harnesses.join(", ")}]`,
			"maturity: stable",
			"---",
			"",
			"CANONICAL_POWER_BODY",
		].join("\n"),
	);
	if (override) {
		await writeFile(join(dir, "body.claude-code.md"), override);
	}
}

describe("generatePluginSkills", () => {
	test("emits a type: power artifact that targets claude-code, using its body override", async () => {
		await writePowerArtifact(
			"my-power",
			["kiro", "claude-code"],
			"CLAUDE_ROUTER_BODY",
		);
		await writePowerArtifact("kiro-only-power", ["kiro"]);

		// entry.path returned by generateCatalog is always relative (derived
		// from basename(sourceDir)), so loadKnowledgeArtifact requires cwd to
		// be the temp workspace regardless of whether sourceDirs is absolute.
		// Verified empirically — chdir is required; passing sourceDirs alone
		// (with absolute paths) is not sufficient.
		process.chdir(tempDir);
		const { written } = await generatePluginSkills({
			skillsDir: join(tempDir, "out-skills"),
			sourceDirs: ["knowledge"],
		});

		expect(written).toBe(1);
		const skill = await readFile(
			join(tempDir, "out-skills", "my-power", "SKILL.md"),
			"utf-8",
		);
		expect(skill).toContain("name: my-power");
		expect(skill).toContain("CLAUDE_ROUTER_BODY");
		expect(skill).not.toContain("CANONICAL_POWER_BODY");

		// kiro-only power is not emitted
		await expect(
			readFile(
				join(tempDir, "out-skills", "kiro-only-power", "SKILL.md"),
				"utf-8",
			),
		).rejects.toThrow();
	});
});
