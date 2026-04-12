import { readdir, readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { exists } from "node:fs/promises";
import yaml from "js-yaml";
import { CollectionSchema, type Collection, type CatalogEntry, type ValidationWarning } from "./schemas";

/**
 * Load all collection manifests from a directory.
 * Each `<name>.yaml` file is parsed against CollectionSchema.
 * Files that fail validation are skipped with a console warning.
 */
export async function loadCollections(collectionsDir: string): Promise<Collection[]> {
  if (!(await exists(collectionsDir))) return [];

  const entries = await readdir(collectionsDir);
  const yamlFiles = entries
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .filter((f) => f !== ".gitkeep")
    .sort();

  const collections: Collection[] = [];

  for (const file of yamlFiles) {
    const filePath = join(collectionsDir, file);
    let raw: string;
    try {
      raw = await readFile(filePath, "utf-8");
    } catch {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = yaml.load(raw);
    } catch {
      console.error(`Warning: Skipping ${file} — invalid YAML`);
      continue;
    }

    // Infer name from filename if not set in the manifest
    if (parsed && typeof parsed === "object" && !("name" in parsed)) {
      (parsed as Record<string, unknown>).name = basename(file, ".yaml").replace(/\.yml$/, "");
    }

    const result = CollectionSchema.safeParse(parsed);
    if (!result.success) {
      console.error(`Warning: Skipping ${file} — schema validation failed: ${result.error.issues.map((i) => i.message).join(", ")}`);
      continue;
    }

    collections.push(result.data);
  }

  return collections;
}

/**
 * Returns warnings for artifact catalog entries that declare a collection name
 * not backed by any manifest in collectionsDir.
 *
 * This is a soft check — artifacts may be authored before a collection manifest
 * exists, so this is a warning rather than an error.
 */
export function validateArtifactCollectionRefs(
  entries: CatalogEntry[],
  collections: Collection[],
): ValidationWarning[] {
  const knownCollectionNames = new Set(collections.map((c) => c.name));
  const warnings: ValidationWarning[] = [];

  for (const entry of entries) {
    for (const collectionRef of entry.collections) {
      if (!knownCollectionNames.has(collectionRef)) {
        warnings.push({
          field: "collections",
          message: `Artifact declares collection "${collectionRef}" but no matching manifest found in collections/`,
          filePath: `${entry.path}/knowledge.md`,
        });
      }
    }
  }

  return warnings;
}

/**
 * Summarize collection membership across all catalog entries.
 * Returns a map from collection name → array of artifact names that belong to it.
 */
export function buildCollectionMembership(
  entries: CatalogEntry[],
): Map<string, string[]> {
  const membership = new Map<string, string[]>();

  for (const entry of entries) {
    for (const collectionName of entry.collections) {
      if (!membership.has(collectionName)) {
        membership.set(collectionName, []);
      }
      membership.get(collectionName)!.push(entry.name);
    }
  }

  return membership;
}
