#!/usr/bin/env bun

/**
 * Generates the discoverable Claude Code plugin skills committed at
 * `skills/`, referenced by `.claude-plugin/plugin.json`'s `skills` field.
 *
 * Unlike `kanon build`, this does not write to `dist/` (gitignored, cleared
 * on every build) — its output is committed, the same way `bridge/mcp-server.cjs`
 * is committed for the MCP integration. Re-run and commit after adding or
 * editing a knowledge artifact with `type: skill` or `type: power` and
 * `harnesses: [claude-code, ...]`.
 *
 * Usage:
 *   bun run scripts/generate-plugin-skills.ts
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generateCatalog, SOURCE_DIRS } from "../src/catalog";
import { isParseError, loadKnowledgeArtifact } from "../src/parser";
import { resolveBody } from "../src/resolve-body";
import { createTemplateEnv, renderTemplate } from "../src/template-engine";

const DEFAULT_SKILLS_DIR = "skills";
const TEMPLATES_DIR = join(
	import.meta.dir,
	"..",
	"templates",
	"harness-adapters",
);

export async function generatePluginSkills(
	opts: { skillsDir?: string; sourceDirs?: string[] } = {},
): Promise<{ written: number }> {
	const skillsDir = opts.skillsDir ?? DEFAULT_SKILLS_DIR;
	const sources = opts.sourceDirs ?? [...SOURCE_DIRS];
	const entries = await generateCatalog(sources);
	const qualifying = entries.filter(
		(e) =>
			(e.type === "skill" || e.type === "power") &&
			e.harnesses.includes("claude-code"),
	);

	await rm(skillsDir, { recursive: true, force: true });
	await mkdir(skillsDir, { recursive: true });

	const templateEnv = createTemplateEnv(TEMPLATES_DIR);
	let written = 0;

	for (const entry of qualifying) {
		const result = await loadKnowledgeArtifact(entry.path);
		if (isParseError(result)) {
			console.error(
				`✗ Skipping ${entry.name}: ${result.errors.map((e) => e.message).join("; ")}`,
			);
			continue;
		}
		const artifact = result.data;
		const skillDir = join(skillsDir, artifact.name);
		await mkdir(skillDir, { recursive: true });

		const content = renderTemplate(templateEnv, "claude-code/skill.md.njk", {
			artifact: { ...artifact, body: resolveBody(artifact, "claude-code") },
		});
		await writeFile(join(skillDir, "SKILL.md"), content, "utf-8");

		if (artifact.workflows.length > 0) {
			const referencesDir = join(skillDir, "references");
			await mkdir(referencesDir, { recursive: true });
			for (const wf of artifact.workflows) {
				const outPath = join(referencesDir, wf.filename);
				const outDir = outPath.substring(0, outPath.lastIndexOf("/"));
				await mkdir(outDir, { recursive: true });
				await writeFile(outPath, wf.content, "utf-8");
			}
		}

		written++;
	}

	const indexContent = renderTemplate(
		templateEnv,
		"claude-code/skill-library-index.md.njk",
		{ qualifying },
	);
	const indexDir = join(skillsDir, "skill-library");
	await mkdir(indexDir, { recursive: true });
	await writeFile(join(indexDir, "SKILL.md"), indexContent, "utf-8");
	written++;

	return { written };
}

async function main() {
	const { written } = await generatePluginSkills();
	console.log(
		`✓ Generated ${written} plugin skill(s) in ${DEFAULT_SKILLS_DIR}/`,
	);
}

if (import.meta.main) {
	main();
}
