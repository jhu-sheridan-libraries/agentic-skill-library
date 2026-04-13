import { z } from "zod";
import yaml from "js-yaml";
import { SUPPORTED_HARNESSES, HarnessNameSchema } from "../schemas";

// --- Schemas ---

export const ManifestEntryModeSchema = z.enum(["required", "optional"]);

/** An individual artifact reference in the manifest. */
export const ArtifactManifestEntrySchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  mode: ManifestEntryModeSchema.default("required"),
  harnesses: z.array(z.string()).optional(),
  backend: z.string().optional(),
});

/** A collection reference in the manifest. */
export const CollectionManifestEntrySchema = z.object({
  collection: z.string().min(1),
  version: z.string().min(1),
  mode: ManifestEntryModeSchema.default("required"),
  harnesses: z.array(z.string()).optional(),
  backend: z.string().optional(),
});

export const ManifestEntrySchema = z.union([
  ArtifactManifestEntrySchema,
  CollectionManifestEntrySchema,
]);

export const ManifestSchema = z.object({
  backend: z.string().optional(),
  artifacts: z.array(ManifestEntrySchema).default([]),
}).passthrough();

export type ManifestEntryMode = z.infer<typeof ManifestEntryModeSchema>;
export type ArtifactManifestEntry = z.infer<typeof ArtifactManifestEntrySchema>;
export type CollectionManifestEntry = z.infer<typeof CollectionManifestEntrySchema>;
export type ManifestEntry = z.infer<typeof ManifestEntrySchema>;
export type Manifest = z.infer<typeof ManifestSchema>;

// --- Recognized harness set for filtering ---

const RECOGNIZED_HARNESSES = new Set<string>(SUPPORTED_HARNESSES);

// --- Functions ---

/**
 * Parse YAML string into a validated Manifest.
 *
 * Accepts an optional `warnings` array — unrecognized harness names
 * are filtered out and a warning string is pushed for each one.
 * Entries with both `name` and `collection` set are rejected.
 */
export function parseManifest(
  yamlContent: string,
  warnings?: string[],
): Manifest {
  // 1. YAML parse — catch syntax errors with line/column info
  let raw: unknown;
  try {
    raw = yaml.load(yamlContent);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "mark" in err) {
      const mark = (err as { mark: { line?: number; column?: number } }).mark;
      const line = mark.line != null ? mark.line + 1 : "?";
      const col = mark.column != null ? mark.column + 1 : "?";
      const msg =
        err instanceof Error ? err.message : String(err);
      throw new Error(
        `YAML syntax error at line ${line}, column ${col}: ${msg}`,
      );
    }
    throw err;
  }

  // Handle empty YAML (null/undefined)
  if (raw == null) {
    raw = {};
  }

  // 2. Reject entries that have both `name` and `collection` set
  if (
    raw &&
    typeof raw === "object" &&
    "artifacts" in raw &&
    Array.isArray((raw as Record<string, unknown>).artifacts)
  ) {
    const artifacts = (raw as Record<string, unknown>).artifacts as unknown[];
    for (let i = 0; i < artifacts.length; i++) {
      const entry = artifacts[i];
      if (
        entry &&
        typeof entry === "object" &&
        "name" in entry &&
        "collection" in entry
      ) {
        throw new Error(
          `Manifest entry at index ${i} has both "name" and "collection" fields set — each entry must have exactly one`,
        );
      }
    }
  }

  // 3. Zod validation
  const result = ManifestSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Manifest validation failed: ${issues}`);
  }

  const manifest = result.data;

  // 4. Filter harnesses — emit warnings for unrecognized names (Req 3.5)
  for (const entry of manifest.artifacts) {
    if (entry.harnesses) {
      const filtered: string[] = [];
      for (const h of entry.harnesses) {
        if (RECOGNIZED_HARNESSES.has(h)) {
          filtered.push(h);
        } else {
          const entryLabel =
            "name" in entry ? entry.name : (entry as CollectionManifestEntry).collection;
          const msg = `Unrecognized harness "${h}" in entry "${entryLabel}" — skipping`;
          warnings?.push(msg);
        }
      }
      (entry as { harnesses?: string[] }).harnesses =
        filtered.length > 0 ? filtered : undefined;
    }
  }

  return manifest;
}

/** Serialize a Manifest object to YAML string. */
export function printManifest(manifest: Manifest): string {
  return yaml.dump(manifest, { lineWidth: -1, noRefs: true });
}

/** Check if a ManifestEntry is a collection reference. */
export function isCollectionRef(
  entry: ManifestEntry,
): entry is CollectionManifestEntry {
  return "collection" in entry && typeof entry.collection === "string";
}
