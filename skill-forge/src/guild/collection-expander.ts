// ---------------------------------------------------------------------------
// Collection Expander — expand collection refs into individual artifact refs
// ---------------------------------------------------------------------------

import type { GlobalCacheAPI } from "./global-cache";

/**
 * An individual artifact reference produced by expanding a collection.
 * Inherits mode, harnesses, and backend from the originating collection ref.
 */
export interface ExpandedArtifact {
  name: string;
  version: string;
  mode: "required" | "optional";
  harnesses?: string[];
  backend?: string;
  source: string; // originating collection name
}

/**
 * Expand a collection ref into individual artifact refs by reading the
 * collection's cached catalog metadata from the GlobalCache.
 *
 * Each member inherits the collection ref's version, mode, harnesses, and
 * backend. The `source` field is set to the originating collection name.
 *
 * Returns an empty array if the collection has no members.
 */
export async function expandCollection(
  collectionName: string,
  version: string,
  mode: "required" | "optional",
  harnesses: string[] | undefined,
  backend: string | undefined,
  cache: GlobalCacheAPI,
): Promise<ExpandedArtifact[]> {
  const members = await cache.readCollectionCatalog(collectionName, version);

  return members.map((entry) => ({
    name: entry.name,
    version,
    mode,
    ...(harnesses ? { harnesses } : {}),
    ...(backend ? { backend } : {}),
    source: collectionName,
  }));
}
