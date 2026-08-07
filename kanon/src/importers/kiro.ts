/**
 * Kiro Importer — Compatibility Facade
 *
 * Preserves the public `parseKiro` interface while delegating pure parsing
 * to the Rosetta Stone kiro-native source translator. Handles multi-file
 * grouping (steering markdown + hook files) deterministically.
 *
 * Requirements: 14.2, 14.10, 14.11
 */

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { translateKiroNative } from "../rosetta/builtins/sources/kiro-native";
import type { SourceTranslatorContext } from "../rosetta/registry";
import type {
	FormatIdentifier,
	NormalizedRelativePath,
	SourceDocument,
} from "../schemas";
import type { ImportedFile, ImportParser } from "./types";

/**
 * Derives a kebab-case artifact name from a file path.
 * Uses the filename without extension, already expected to be kebab-case.
 */
function deriveArtifactName(filePath: string): string {
	const base = basename(filePath);
	const name =
		base.replace(/\.kiro\.hook$/, "") || base.replace(/\.[^.]+$/, "");
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/**
 * Kiro import parser.
 * Handles .kiro/steering/*.md (frontmatter + body) and .kiro/hooks/*.kiro.hook (JSON → CanonicalHook).
 * Delegates pure parsing to the Rosetta Stone kiro-native source translator.
 */
export const parseKiro: ImportParser = async (
	filePath: string,
): Promise<ImportedFile> => {
	const raw = await readFile(filePath, "utf-8");
	const artifactName = deriveArtifactName(filePath);

	// Determine the relative path for the document based on file type
	const base = basename(filePath);
	const relativePath = base as NormalizedRelativePath;

	// Build SourceDocument for Rosetta Stone
	const documents: SourceDocument[] = [
		{
			path: relativePath,
			content: raw,
			executable: false,
		},
	];

	// Build translator context
	const context: SourceTranslatorContext = {
		format: {
			id: "kiro" as FormatIdentifier,
		} as SourceTranslatorContext["format"],
		canonicalSchemaVersion: "1.0.0",
		options: {},
		callerContext: { artifactNameHint: artifactName },
	};

	// Delegate to Rosetta Stone
	const output = translateKiroNative(documents, context);

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
		body: raw.trim(),
		frontmatter: {},
		hooks: [],
		mcpServers: [],
		extraFields: {},
	};
};

export default parseKiro;
