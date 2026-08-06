import { readFile } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import { type CatalogEntry, CatalogSchema } from "../../../src/schemas.js";

/**
 * Load and validate the catalog from the configured content root.
 */
export async function loadCatalog(
	contentRoot: string,
): Promise<CatalogEntry[]> {
	const catalogPath = join(contentRoot, "catalog.json");
	const raw = await readFile(catalogPath, "utf-8");
	const parsed = JSON.parse(raw);
	return CatalogSchema.parse(parsed);
}

/**
 * Read a knowledge artifact's content, parsing frontmatter and body.
 */
export async function readArtifactContent(
	contentRoot: string,
	entry: CatalogEntry,
): Promise<{ frontmatter: Record<string, unknown>; body: string }> {
	// Use the catalog's recorded path. Not every artifact sits at
	// knowledge/<name>/: imported collections nest them, e.g.
	// knowledge/kiro-official/<name>/. Deriving the path from the name instead
	// fails with ENOENT for those, which shows up as artifacts silently missing
	// from search rather than as an obvious error.
	const relativePath = entry.path ?? join("knowledge", entry.name);
	const filePath = join(contentRoot, relativePath, "knowledge.md");
	const raw = await readFile(filePath, "utf-8");
	const parsed = matter(raw);
	return { frontmatter: parsed.data, body: parsed.content };
}
