#!/usr/bin/env bun

/**
 * Generates the discoverable Claude Code plugin skills committed at
 * `skills/`, referenced by `.claude-plugin/plugin.json`'s `skills` field.
 *
 * Unlike `kanon build`, this does not write to `dist/` (gitignored, cleared
 * on every build) — its output is committed, the same way `bridge/mcp-server.cjs`
 * is committed for the MCP integration. Re-run and commit after adding or
 * editing a knowledge artifact with `type: skill` and `harnesses: [claude-code, ...]`.
 *
 * Usage:
 *   bun run scripts/generate-plugin-skills.ts
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generateCatalog, SOURCE_DIRS } from "../src/catalog";
import { isParseError, loadKnowledgeArtifact } from "../src/parser";
import { createTemplateEnv, renderTemplate } from "../src/template-engine";

const SKILLS_DIR = "skills";
const TEMPLATES_DIR = join(
	import.meta.dir,
	"..",
	"templates",
	"harness-adapters",
);

async function main() {
	const entries = await generateCatalog([...SOURCE_DIRS]);
	const qualifying = entries.filter(
		(e) => e.type === "skill" && e.harnesses.includes("claude-code"),
	);

	await rm(SKILLS_DIR, { recursive: true, force: true });
	await mkdir(SKILLS_DIR, { recursive: true });

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
		const skillDir = join(SKILLS_DIR, artifact.name);
		await mkdir(skillDir, { recursive: true });

		const content = renderTemplate(templateEnv, "claude-code/skill.md.njk", {
			artifact,
		});
		await writeFile(join(skillDir, "SKILL.md"), content, "utf-8");

		if (artifact.workflows.length > 0) {
			const referencesDir = join(skillDir, "references");
			await mkdir(referencesDir, { recursive: true });
			for (const wf of artifact.workflows) {
				await writeFile(join(referencesDir, wf.filename), wf.content, "utf-8");
			}
		}

		written++;
	}

	console.log(`✓ Generated ${written} plugin skill(s) in ${SKILLS_DIR}/`);
}

main();
