/**
 * Codex Importer — Compatibility Facade
 *
 * Preserves the public `parseCodex` interface while delegating pure parsing
 * to the Rosetta Stone codex-native source translator. Handles multi-file
 * grouping (AGENTS.md, SKILL.md files, config.toml) deterministically.
 *
 * For config.toml files (which are supplementary and lack a primary markdown
 * document), a synthetic AGENTS.md is injected so the translator can produce
 * a valid candidate with MCP servers extracted.
 *
 * Requirements: 14.2, 14.10, 14.11
 */

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { FormatIdentifier, NormalizedRelativePath, SourceDocument } from "../schemas";
import type { SourceTranslatorContext } from "../rosetta/registry";
import { translateCodexNative } from "../rosetta/builtins/sources/codex-native";
import type { ImportedFile, ImportParser } from "./types";

/**
 * Derives a kebab-case artifact name from a file path.
 * For SKILL.md files, prefers the parent directory name.
 */
function deriveArtifactName(filePath: string): string {
	const parts = filePath.split("/");
	const base = basename(filePath);
	let name = base.replace(/\.[^.]+$/, "");
	// `.codex/skills/<name>/SKILL.md` → use the skill directory name
	if (name.toLowerCase() === "skill" && parts.length >= 2) {
		name = parts[parts.length - 2];
	}
	// `AGENTS.md` → use a stable, descriptive name
	if (name.toLowerCase() === "agents") {
		name = "codex-agents";
	}
	// `config.toml` → use "codex-mcp" as the artifact name
	if (base === "config.toml") {
		return "codex-mcp";
	}
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/**
 * Codex import parser.
 * Handles AGENTS.md, SKILL.md files under .codex/skills and .agents/skills,
 * and `.codex/config.toml`.
 * Delegates pure parsing to the Rosetta Stone codex-native source translator.
 */
export const parseCodex: ImportParser = async (
	filePath: string,
): Promise<ImportedFile> => {
	const raw = await readFile(filePath, "utf-8");
	const artifactName = deriveArtifactName(filePath);
	const base = basename(filePath);

	// Build SourceDocument set for Rosetta Stone.
	// For config.toml (supplementary file), we inject a synthetic primary
	// document so the translator can produce a candidate with MCP servers.
	const documents: SourceDocument[] = [];

	if (base === "config.toml") {
		// Inject a minimal synthetic AGENTS.md as the primary document
		documents.push({
			path: "AGENTS.md" as NormalizedRelativePath,
			content: "",
			executable: false,
		});
		documents.push({
			path: base as NormalizedRelativePath,
			content: raw,
			executable: false,
		});
	} else {
		documents.push({
			path: base as NormalizedRelativePath,
			content: raw,
			executable: false,
		});
	}

	// Build translator context
	const context: SourceTranslatorContext = {
		format: { id: "codex" as FormatIdentifier } as SourceTranslatorContext["format"],
		canonicalSchemaVersion: "1.0.0",
		options: {},
		callerContext: { artifactNameHint: artifactName },
	};

	// Delegate to Rosetta Stone
	const output = translateCodexNative(documents, context);

	// Map SourceTranslationOutput back to ImportedFile shape
	if (output.candidate) {
		const candidate = output.candidate as Record<string, unknown>;
		const frontmatter = (candidate.frontmatter ?? {}) as Record<string, unknown>;
		const { name: _n, type: _t, harnesses: _h, ...restFrontmatter } = frontmatter;

		return {
			sourcePath: filePath,
			artifactName,
			body: (candidate.body as string) ?? "",
			frontmatter: restFrontmatter,
			hooks: (candidate.hooks as ImportedFile["hooks"]) ?? [],
			mcpServers: (candidate.mcpServers as ImportedFile["mcpServers"]) ?? [],
			extraFields: (candidate.extraFields as Record<string, unknown>) ?? {},
		};
	}

	// Fallback: if translation produced no candidate, return minimal result
	return {
		sourcePath: filePath,
		artifactName,
		body: "",
		frontmatter: {},
		hooks: [],
		mcpServers: [],
		extraFields: {},
	};
};

export default parseCodex;
