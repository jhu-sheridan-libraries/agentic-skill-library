/**
 * Gemini CLI Importer — Compatibility Facade
 *
 * Preserves the public `parseGeminiCli` interface while delegating pure parsing
 * to the Rosetta Stone gemini-cli-native source translator. Handles GEMINI.md
 * and .gemini/settings.json.
 *
 * For supplementary files (settings.json) that lack a primary GEMINI.md, a
 * synthetic primary document is injected so the translator can produce a valid
 * candidate with extracted MCP servers.
 *
 * Requirements: 14.2, 14.10, 14.11
 */

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { translateGeminiCliNative } from "../rosetta/builtins/sources/gemini-cli-native";
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
 * Gemini CLI import parser.
 * Handles GEMINI.md and .gemini/settings.json.
 * Delegates pure parsing to the Rosetta Stone gemini-cli-native source translator.
 */
export const parseGeminiCli: ImportParser = async (
	filePath: string,
): Promise<ImportedFile> => {
	const raw = await readFile(filePath, "utf-8");
	const base = basename(filePath);

	// Derive artifact name based on file type
	const artifactName = base.endsWith("settings.json")
		? "gemini-settings"
		: deriveArtifactName(filePath);

	// Build SourceDocument set for Rosetta Stone.
	// For supplementary files (settings.json) we inject a synthetic GEMINI.md
	// so the translator can produce a candidate.
	const documents: SourceDocument[] = [];

	if (base.endsWith("settings.json")) {
		documents.push({
			path: "GEMINI.md" as NormalizedRelativePath,
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
			id: "gemini-cli" as FormatIdentifier,
		} as SourceTranslatorContext["format"],
		canonicalSchemaVersion: "1.0.0",
		options: {},
		callerContext: { artifactNameHint: artifactName },
	};

	// Delegate to Rosetta Stone
	const output = translateGeminiCliNative(documents, context);

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

export default parseGeminiCli;
