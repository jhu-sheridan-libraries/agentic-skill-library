/**
 * Vendor-Neutral AGENTS.md Importer — Compatibility Facade
 *
 * Preserves the `ImportParser` interface while delegating pure parsing to the
 * Rosetta Stone agents-native source translator. Consumes a single AGENTS.md
 * file and produces an ImportedFile.
 */

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { translateAgentsNative } from "../rosetta/builtins/sources/agents-native";
import type { SourceTranslatorContext } from "../rosetta/registry";
import type {
	FormatIdentifier,
	NormalizedRelativePath,
	SourceDocument,
} from "../schemas";
import type { ImportedFile, ImportParser } from "./types";

/**
 * Derives a kebab-case artifact name from a file path. Root AGENTS.md maps to
 * the stable name "agents".
 */
function deriveArtifactName(filePath: string): string {
	const parts = filePath.split("/");
	const base = basename(filePath);
	let name = base.replace(/\.[^.]+$/, "");
	if (name.toLowerCase() === "agents") {
		name = parts.length >= 2 ? parts[parts.length - 2] : "agents";
	}
	return (
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "") || "agents"
	);
}

/**
 * Vendor-neutral AGENTS.md import parser.
 * Delegates pure parsing to the Rosetta Stone agents-native source translator.
 */
export const parseAgents: ImportParser = async (
	filePath: string,
): Promise<ImportedFile> => {
	const raw = await readFile(filePath, "utf-8");
	const artifactName = deriveArtifactName(filePath);
	const base = basename(filePath);

	const documents: SourceDocument[] = [
		{
			path: base as NormalizedRelativePath,
			content: raw,
			executable: false,
		},
	];

	const context: SourceTranslatorContext = {
		format: {
			id: "agents" as FormatIdentifier,
		} as SourceTranslatorContext["format"],
		canonicalSchemaVersion: "1.0.0",
		options: {},
		callerContext: { artifactNameHint: artifactName },
	};

	const output = translateAgentsNative(documents, context);

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

export default parseAgents;
