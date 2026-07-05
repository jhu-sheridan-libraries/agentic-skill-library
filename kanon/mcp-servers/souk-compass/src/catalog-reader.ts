import { readFile } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import { type CatalogEntry, CatalogSchema } from "../../../src/schemas.js";

/**
 * Load and validate the catalog from the plugin root directory.
 */
export async function loadCatalog(pluginRoot: string): Promise<CatalogEntry[]> {
	const catalogPath = join(pluginRoot, "catalog.json");
	const raw = await readFile(catalogPath, "utf-8");
	const parsed = JSON.parse(raw);
	return CatalogSchema.parse(parsed);
}

/**
 * Read a knowledge artifact's content, parsing frontmatter and body.
 */
export async function readArtifactContent(
	pluginRoot: string,
	entry: CatalogEntry,
): Promise<{ frontmatter: Record<string, unknown>; body: string }> {
	const filePath = join(pluginRoot, "knowledge", entry.name, "knowledge.md");
	const raw = await readFile(filePath, "utf-8");
	const parsed = matter(raw);
	return { frontmatter: parsed.data, body: parsed.content };
}
