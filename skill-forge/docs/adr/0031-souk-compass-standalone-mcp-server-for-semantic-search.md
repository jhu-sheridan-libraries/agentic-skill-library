# ADR-0031: Souk Compass — Standalone MCP Server for Semantic Search

## Status

Proposed

## Date

2026-04-24

## Context

The context-bazaar ecosystem provides a catalog of knowledge artifacts discoverable via the existing MCP bridge (`catalog_list`, `artifact_content`, `collection_list`). However, discovery is limited to exact name lookups and metadata filtering — there is no way to find artifacts by meaning. Users who describe a problem in natural language cannot surface relevant skills, workflows, or reference packs unless they already know the artifact name or type.

Apache Solr 9.x introduced DenseVectorField with HNSW indexing, enabling cosine-similarity kNN queries alongside traditional BM25 text search. Combining these capabilities with a pluggable embedding provider creates a semantic search layer that can index the bazaar catalog and user-supplied documents, returning results ranked by meaning rather than keyword overlap.

The question is how to integrate this capability: extend the existing catalog bridge, or run a separate MCP server.

## Decision Drivers

- Semantic search involves heavy dependencies (embedding models, Solr connectivity, SQLite caching) that the catalog bridge does not need
- A Solr outage or embedding failure should not prevent users from listing or reading artifacts via the catalog bridge
- The embedding provider choice (local vs. cloud) is a per-user configuration concern orthogonal to catalog operations
- Team-level embedding cache sharing via Solr requires its own connection lifecycle

## Considered Options

1. **Extend the existing catalog bridge** — add semantic search tools to `src/mcp-bridge.ts` and bundle everything into a single `bridge/mcp-server.cjs`
2. **Standalone MCP server** — create `skill-forge/mcp-servers/souk-compass/` as an independent package with its own entry point, dependencies, and CJS bundle
3. **Library module consumed by the bridge** — implement search logic as a library in `src/` and import it from the bridge

## Decision Outcome

**Chosen option: Option 2 — Standalone MCP server**, because it isolates failure domains, keeps the catalog bridge simple, and allows independent versioning and deployment of the semantic search capability.

### Key Architectural Decisions

#### 1. Standalone MCP server process

Souk Compass runs as its own stdio MCP server registered alongside the catalog bridge in `.mcp.json`. Each server starts and stops independently. A Solr outage or embedding model crash terminates only the Souk Compass process — the catalog bridge continues serving `catalog_list`, `artifact_content`, and `collection_list` without interruption.

#### 2. Pluggable embedding provider interface

An `EmbeddingProvider` interface (`embed`, `batchEmbed`, `name`, `dimensions`) decouples embedding generation from the rest of the system. A local provider using `@xenova/transformers` works out of the box with zero cloud credentials. An optional Bedrock Titan provider is available for users with AWS access. The factory function selects the provider based on `SOUK_COMPASS_EMBED_PROVIDER` and falls back to local on cloud init failure, logged to stderr.

#### 3. Solr 9.x with DenseVectorField and HNSW

Apache Solr is chosen for vector storage because it provides both kNN vector search and BM25 text search in a single engine, enabling hybrid search without a separate vector database. The schema uses `DenseVectorField` with cosine similarity and HNSW indexing (`hnswMaxConnections=16`, `hnswBeamWidth=100`). A bundled `docker-compose.yml` starts a pre-configured Solr 9.x instance for local development, and the `compass_setup` tool automates provisioning.

#### 4. Multi-tier embedding cache

A `CachedEmbeddingProvider` wraps any concrete provider with three cache tiers, checked in order:

1. **In-memory LRU** — `Map<contentHash, number[]>` with configurable capacity (default 1000), move-to-end on access, evict-first on overflow
2. **SQLite on-disk** — `bun:sqlite` database at `~/.souk-compass/embed-cache.db`, auto-created on first use, survives MCP server restarts
3. **Solr-as-cache** — queries existing Solr documents by `content_hash` field, reusing stored vectors; enables team-level cache sharing when multiple developers index the same artifacts

On a complete miss, the inner provider is called and the result is written to the memory and SQLite tiers. The Solr tier is read-only from the cache's perspective — vectors enter Solr through normal indexing. Content hashes are SHA-256 digests of the embedding text.

#### 5. Shared Solr schema

Both the artifact collection and user document collection use identical field definitions (`id`, `text`, `vector`, metadata fields, dynamic `metadata_*` fields). The `doc_source` field (`"artifact"`, `"user"`, `"memory"`) differentiates document types. This simplifies schema management, enables cross-collection queries via the `scope` parameter, and allows memory notes to coexist with user documents.

### Positive Consequences

- Catalog bridge remains simple and fast — no Solr dependency, no embedding model loading
- Souk Compass can be disabled or removed without affecting core bazaar functionality
- Independent versioning: Souk Compass can ship breaking changes without touching the bridge
- The pluggable provider interface supports future embedding backends (OpenAI, Cohere, local Ollama) without architectural changes
- Multi-tier cache eliminates redundant embedding API calls across sessions and team members
- Hybrid search (BM25 + kNN) improves relevance over pure vector search

### Negative Consequences / Trade-offs

- Two MCP server processes run instead of one, increasing resource usage
- Cross-tool chaining between Souk Compass (`compass_search`) and the catalog bridge (`artifact_content`) relies on convention (shared `artifact_name` field) rather than a typed contract
- Solr is a heavyweight dependency for local development — Docker is required
- The SQLite cache introduces a second persistence layer beyond Solr

## Links and References

- Extends: [ADR-020](./0020-mcp-bridge-as-claude-code-plugin-integration-layer.md) (MCP bridge architecture)
- Related: [ADR-005](./0005-bun-runtime-and-tooling.md) (Bun runtime)
- Related: [ADR-002](./0002-use-zod-for-validation.md) (Zod validation convention)
- Implementation: `skill-forge/mcp-servers/souk-compass/`
- Spec: `.kiro/specs/souk-compass/`
