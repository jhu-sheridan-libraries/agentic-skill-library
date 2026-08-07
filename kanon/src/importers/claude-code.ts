/**
 * Claude Code Importer — Compatibility Facade
 *
 * Preserves the public `parseClaudeCode` interface while delegating pure parsing
 * to the Rosetta Stone claude-code-native source translator. Handles multi-file
 * grouping (CLAUDE.md, settings.json, mcp.json) deterministically.
 *
 * For supplementary files (settings.json, mcp.json) that lack a primary CLAUDE.md,
 * a synthetic primary document is injected so the translator can produce a valid
 * candidate with extracted hooks/MCP servers.
 *
 * Requirements: 14.2, 14.10, 14.11
 */

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { translateClaudeCodeNative } from "../rosetta/builtins/sources/claude-code-native";
import type { SourceTranslatorContext } from "../rosetta/registry";
import type {
	FormatIdentifier,
	NormalizedRelativePath,
	SourceDocument,
} from "../schemas";
import type { ImportedFile, ImportParser } from "./types";

/**
 * Derives a kebab-case artifact name from a file path.
 */
function deriveArtifactName(filePath: string): string {
	const base = basename(filePath);
	const name = base.replace(/\.[^.]+$/, "");
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/**
 * Claude Code import parser.
 * Handles CLAUDE.md, .claude/settings.json, and .claude/mcp.json.
 * Delegates pure parsing to the Rosetta Stone claude-code-native source translator.
 */
export const parseClaudeCode: ImportParser = async (
	filePath: string,
): Promise<ImportedFile> => {
	const raw = await readFile(filePath, "utf-8");
	const base = basename(filePath);

	// Derive artifact name based on file type
	let artifactName: string;
	if (base.endsWith("settings.json")) {
		artifactName = "claude-settings";
	} else if (base.endsWith("mcp.json")) {
		artifactName = "claude-mcp";
	} else {
		artifactName = deriveArtifactName(filePath);
	}

	// Build SourceDocument set for Rosetta Stone.
	// For supplementary files (settings.json, mcp.json) we inject a synthetic
	// CLAUDE.md so the translator can produce a candidate.
	const documents: SourceDocument[] = [];

	if (base.endsWith("settings.json") || base.endsWith("mcp.json")) {
		// Inject a minimal synthetic CLAUDE.md as the primary document
		documents.push({
			path: "CLAUDE.md" as NormalizedRelativePath,
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

	// Build translator context with the artifact name hint
	const context: SourceTranslatorContext = {
		format: {
			id: "claude-code" as FormatIdentifier,
		} as SourceTranslatorContext["format"],
		canonicalSchemaVersion: "1.0.0",
		options: {},
		callerContext: { artifactNameHint: artifactName },
	};

	// Delegate to Rosetta Stone
	const output = translateClaudeCodeNative(documents, context);

	// Map SourceTranslationOutput back to ImportedFile shape
	if (output.candidate) {
		const candidate = output.candidate as Record<string, unknown>;
		const frontmatter = (candidate.frontmatter ?? {}) as Record<
			string,
			unknown
		>;
		const {
			name: _n,
			type: _t,
			harnesses: _h,
			...restFrontmatter
		} = frontmatter;

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

export default parseClaudeCode;
