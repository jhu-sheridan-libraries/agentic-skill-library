# ADR-0035: Codebase Indexing as Separate Collection in Souk Compass

## Status

Proposed

## Date

2026-05-04

## Context

Souk Compass (ADR-031) provides semantic search over knowledge artifacts and user documents. However, developers frequently need to search their own project source code by meaning — finding relevant implementations, patterns, or configuration without knowing exact file paths or symbol names.

The existing `compass_index_document` tool can index individual text blobs, but it lacks the ability to walk a directory tree, filter by file type, chunk source files intelligently, and maintain a coherent index of an entire codebase. Mixing codebase vectors into the artifact or user-doc collections would pollute search results and make it impossible to scope queries to "just my code" vs "just skills/artifacts."

The question is whether codebase documents should share a collection with existing document types or live in their own dedicated collection.

## Decision

Introduce a **dedicated Solr collection** (`context-bazaar-codebase` by default, configurable via `SOUK_COMPASS_CODEBASE_COLLECTION`) for codebase vectors, with two new tools:

1. **`compass_index_folder`** — walks a directory, filters files by glob patterns and extension allowlist, chunks large files by line-count boundaries, batch-embeds chunks, and upserts into the codebase collection. Supports `clear: true` to wipe and rebuild, and idempotent upserts keyed by `codebase::<relative-path>::chunk_N`.

2. **`compass_search_codebase`** — searches exclusively against the codebase collection with the same vector/keyword/hybrid modes as `compass_search`, returning file paths, line ranges, and code snippets.

### Key design choices

- **Separate collection, shared schema**: The codebase collection reuses the same Solr configset (`souk-compass`) and field definitions as the artifact and user-doc collections. The `doc_source` field is extended with a `"codebase"` value. This avoids schema proliferation while keeping search scopes isolated.

- **Dedicated `SoukVectorClient` instance**: A third client (`codebaseSolrClient`) is initialized at startup alongside the artifact and user-doc clients, added to `ToolContext`. This keeps connection lifecycle and collection targeting explicit.

- **File-system walker with glob filtering**: The indexer uses simple glob matching (supporting `*`, `**`, `?`) and a text-extension allowlist to avoid indexing binaries, lock files, and generated output. Default excludes cover `node_modules`, `.git`, `dist`, and `build`.

- **Line-count-based chunking**: Unlike the heading-based markdown chunker used for artifacts, codebase files are split at line boundaries when they exceed `chunkMaxLength` (default 2000 chars). Each chunk's document ID encodes the file path and chunk index, and the text includes a header with file path and line range for retrieval context.

- **Batch processing with deferred commit**: Files are processed in batches of 20, embedded together, upserted without auto-commit, and a single explicit commit is issued at the end. This reduces Solr round-trips and avoids partial-index visibility during long indexing runs.

## Consequences

### Positive

- Codebase search results never pollute artifact or user-doc queries (and vice versa)
- The codebase collection can be dropped and rebuilt without affecting the skill index
- Shared configset means no additional Solr schema management
- Idempotent upserts by path-based IDs enable incremental re-indexing in the future
- The `clear` flag provides a simple full-rebuild escape hatch

### Negative

- A third Solr collection increases resource usage (memory, disk, segment merges)
- `compass_setup create_collections` now provisions three collections instead of two
- No cross-scope search yet — users cannot search artifacts and codebase in a single query (could be added later via `scope: "all"` expansion)

### Neutral

- The `doc_source` enum grows from three to four values; existing serialization and search logic is unaffected since codebase documents live in their own collection
- The glob matcher is a simple regex-based implementation, not a full minimatch — sufficient for common patterns but may diverge on edge cases

## Links and References

- Extends: [ADR-031](./0031-souk-compass-standalone-mcp-server-for-semantic-search.md) (Souk Compass architecture)
- Related: [ADR-032](./0032-solrcloud-mode-for-souk-compass.md) (SolrCloud mode)
- Implementation: `skill-forge/mcp-servers/souk-compass/src/tools/compass-index-folder.ts`, `compass-search-codebase.ts`
