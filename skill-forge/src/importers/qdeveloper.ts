import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import matter from "gray-matter";
import type { ImportedFile, ImportParser } from "./types";

/**
 * Derives a kebab-case artifact name from a file path.
 */
function deriveArtifactName(filePath: string): string {
	const base = basename(filePath);
	const name = base.replace(/\.md$/, "");
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/**
 * Q Developer import parser.
 * Handles .q/rules/*.md and .amazonq/rules/*.md files.
 * All files are markdown with optional YAML frontmatter.
 */
export const parseQDeveloper: ImportParser = async (
	filePath: string,
): Promise<ImportedFile> => {
	const raw = await readFile(filePath, "utf-8");
	const parsed = matter(raw);

	return {
		sourcePath: filePath,
		artifactName: deriveArtifactName(filePath),
		body: parsed.content.trim(),
		frontmatter: { ...parsed.data },
		hooks: [],
		mcpServers: [],
		extraFields: {},
	};
};

export default parseQDeveloper;
