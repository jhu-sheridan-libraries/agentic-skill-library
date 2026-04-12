import { join } from "node:path";
import { exists } from "node:fs/promises";
import type { ArtifactBackend } from "./types";
import type { CatalogEntry, HarnessName } from "../schemas";
import { generateCatalog } from "../catalog";

/**
 * Local filesystem backend — reads from an existing dist/ directory.
 * This is the default backend for `forge install` when no remote source is configured.
 */
export class LocalBackend implements ArtifactBackend {
  readonly label: string;

  constructor(private readonly basePath: string) {
    this.label = `local:${basePath}`;
  }

  async fetchCatalog(): Promise<CatalogEntry[]> {
    // Try catalog.json first (faster), fall back to scanning source dirs
    const catalogPath = join(this.basePath, "catalog.json");
    if (await exists(catalogPath)) {
      const raw = await Bun.file(catalogPath).text();
      return JSON.parse(raw) as CatalogEntry[];
    }
    // Fall back to generating from source
    return generateCatalog([
      join(this.basePath, "knowledge"),
      join(this.basePath, "packages"),
    ]);
  }

  async fetchArtifact(
    name: string,
    harness: HarnessName,
  ): Promise<string> {
    const artifactDistDir = join(this.basePath, "dist", harness, name);
    if (!(await exists(artifactDistDir))) {
      throw new Error(`Artifact "${name}" for harness "${harness}" not found at ${artifactDistDir}`);
    }
    // For local backend, return the path directly (no copy needed)
    return artifactDistDir;
  }

  async listVersions(): Promise<string[]> {
    // Local backend doesn't have versions; return current as "local"
    return ["local"];
  }
}
