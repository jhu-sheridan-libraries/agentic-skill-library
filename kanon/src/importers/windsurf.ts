/**
 * Windsurf Importer — Compatibility Facade
 *
 * Preserves the public `parseWindsurf` interface while delegating pure parsing
 * to the Rosetta Stone windsurf-native source translator.
 *
 * Requirements: 14.2, 14.10, 14.11
 */

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { FormatIdentifier, NormalizedRelativePath, SourceDocument } from "../schemas";
import type { SourceTranslatorContext } from "../rosetta/registry";
import { translateWindsurfNative } from "../rosetta/builtins/sources/windsurf-native";
import type { ImportedFile, ImportParser } from "./types";

/**
 * Derives a kebab-case artifact name from a file path.
 */
function deriveArtifactName(filePath: string): string {
	const base = basename(filePath);
	if (base === ".windsurfrules") return "windsurfrules";
	const name = base.replace(/\.md$/, "");
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/**
 * Windsurf import parser.
 * Handles .windsurfrules and .windsurf/rules/*.md.
 * Delegates pure parsing to the Rosetta Stone windsurf-native source translator.
 */
export const parseWindsurf: ImportParser = async (
	filePath: string,
): Promise<ImportedFile> => {
	const raw = await readFile(filePath, "utf-8");
	const artifactName = deriveArtifactName(filePath);

	// Build SourceDocument for Rosetta Stone
	const documents: SourceDocument[] = [
		{
			path: basename(filePath) as NormalizedRelativePath,
			content: raw,
			executable: false,
		},
	];

	// Build translator context
	const context: SourceTranslatorContext = {
		format: { id: "windsurf" as FormatIdentifier } as SourceTranslatorContext["format"],
		canonicalSchemaVersion: "1.0.0",
		options: {},
		callerContext: { artifactNameHint: artifactName },
	};

	// Delegate to Rosetta Stone
	const output = translateWindsurfNative(documents, context);

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
		body: raw.trim(),
		frontmatter: {},
		hooks: [],
		mcpServers: [],
		extraFields: {},
	};
};

export default parseWindsurf;
