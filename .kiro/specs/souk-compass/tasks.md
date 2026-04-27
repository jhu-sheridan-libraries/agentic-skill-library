# Implementation Plan: Souk Compass

## Overview

Souk Compass is a standalone MCP server providing Solr-backed semantic search over context-bazaar knowledge artifacts and user document collections. Implementation proceeds bottom-up: error types → schemas → config → Solr client → embedding providers → serialization → catalog reader → tool handlers → MCP server entry point → Solr infrastructure → .mcp.json wiring. Each step builds on the previous, with property-based and unit tests interleaved close to the code they validate.

## Tasks

- [x] 1. Scaffold project structure and dependencies
  - Create `skill-forge/mcp-servers/souk-compass/` directory with `package.json`, `tsconfig.json`, and `src/` subdirectories (`src/providers/`, `src/tools/`, `src/__tests__/`)
  - `package.json` should declare `"type": "module"`, Bun-compatible scripts, and dependencies: `@modelcontextprotocol/sdk`, `zod`, `@xenova/transformers` (or local embed HTTP fallback)
  - `tsconfig.json` should extend or mirror the project's strict ESNext + bundler module resolution settings
  - DevDependencies: `fast-check`, `@types/bun`
  - _Requirements: 6.1, 9.5_

- [x] 2. Implement error class and Zod schemas
  - [x] 2.1 Create `SoukCompassError` class in `src/errors.ts`
    - Extend `Error` with `code: string`, optional `httpStatus: number`, optional `solrMessage: string`, and `cause` support
    - Define error code constants: `SOLR_CONNECTION`, `SOLR_HTTP`, `SOLR_RESPONSE`, `EMBED_FAILURE`, `EMBED_INIT`, `SERIALIZATION`, `CONFIG_INVALID`, `SETUP_DOCKER`, `SETUP_PORT`
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 2.2 Create all Zod schemas in `src/schemas.ts`
    - `SoukCompassConfigSchema` — validates Solr URL, collection names, embed provider, embed dimensions with defaults
    - `SolrDocumentSchema` — validates upsert payload shape with `.passthrough()` for `metadata_*` dynamic fields
    - `SearchResultSchema` — validates parsed search results with score, artifact metadata, docSource
    - `ToolInputSchemas` object — one schema per tool: `compass_setup`, `compass_index_artifacts`, `compass_search`, `compass_index_document`, `compass_status`, `compass_health`
    - Export both schemas and inferred TypeScript types
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 2.3 Write property test: Configuration Validation Rejects Invalid Values
    - **Property 12: Configuration Validation Rejects Invalid Values**
    - Generate invalid URLs, negative numbers, unknown enum values and verify `SoukCompassConfigSchema` rejects them with Zod errors
    - **Validates: Requirements 7.7**

- [x] 3. Implement configuration loader
  - [x] 3.1 Create `src/config.ts` with `loadConfig()` function
    - Read env vars: `SOUK_COMPASS_SOLR_URL` (default `http://localhost:8983`), `SOUK_COMPASS_SOLR_COLLECTION` (default `context-bazaar`), `SOUK_COMPASS_USER_COLLECTION` (default `context-bazaar-user-docs`), `SOUK_COMPASS_EMBED_PROVIDER` (default `local`), `SOUK_COMPASS_EMBED_DIMENSIONS` (default `1024`)
    - Validate with `SoukCompassConfigSchema`, report clear errors to stderr for invalid values
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 3.2 Write property test: Configuration Env Var Precedence
    - **Property 11: Configuration Env Var Precedence**
    - Generate random valid config values, set as env vars, verify `loadConfig()` returns them; unset env vars and verify defaults
    - **Validates: Requirements 7.6**

- [x] 4. Checkpoint — Ensure schemas and config tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Solr vector client
  - [x] 5.1 Create `SoukVectorClient` class in `src/solr-client.ts`
    - Constructor accepts `baseUrl: string` and `collection: string`
    - `upsert(docId, text, embedding, metadata, options?)` — POST to `/solr/{collection}/update/json/docs`, auto-commit by default, optional `commit: false` for batch
    - `search(queryEmbedding, topK, filterQuery?)` — GET `/solr/{collection}/select` with `{!knn f=vector topK=N}` query and optional `fq` parameter
    - `delete(docId)` — POST delete-by-ID to `/solr/{collection}/update`
    - `commit()` — POST explicit commit to `/solr/{collection}/update?commit=true`
    - `health()` — GET `/solr/admin/cores?action=STATUS` and verify collection exists, return boolean
    - All HTTP via native Fetch API; wrap errors in `SoukCompassError` with HTTP status and Solr error body
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

  - [ ]* 5.2 Write property test: Solr Error Wrapping Preserves Context
    - **Property 8: Solr Error Wrapping Preserves Context**
    - Generate random HTTP status codes (400–599) and error body strings, verify `SoukCompassError` message includes both
    - **Validates: Requirements 1.7, 10.2**

  - [x] 5.3 Write unit tests for `SoukVectorClient`
    - Mock Fetch API to verify: upsert sends correct JSON payload, search constructs correct kNN query with fq, delete sends correct payload, health returns true/false, commit=false defers commit
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.8, 1.9_

- [x] 6. Implement embedding provider interface and providers
  - [x] 6.1 Create `EmbeddingProvider` interface in `src/embedding-provider.ts`
    - Properties: `readonly name: string`, `readonly dimensions: number`
    - Methods: `embed(text: string): Promise<number[]>`, `batchEmbed(texts: string[]): Promise<number[][]>`
    - Export `createEmbeddingProvider(config)` factory function that selects provider based on `SOUK_COMPASS_EMBED_PROVIDER`, falls back to local on cloud init failure with stderr warning
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.8, 2.9_

  - [x] 6.2 Create `LocalEmbeddingProvider` in `src/providers/local-provider.ts`
    - Implements `EmbeddingProvider` with `name = "transformers-local"`
    - Uses `@xenova/transformers` or configurable local HTTP API endpoint (`SOUK_COMPASS_LOCAL_EMBED_URL`)
    - Truncates input exceeding token limit by taking first portion that fits (no throw)
    - _Requirements: 2.5, 2.7_

  - [x] 6.3 Create `BedrockTitanProvider` in `src/providers/bedrock-provider.ts`
    - Implements `EmbeddingProvider` with `name = "bedrock-titan"`
    - Uses `amazon.titan-embed-text-v2:0` via Bedrock Runtime `InvokeModel` API
    - Truncates input exceeding 8192 tokens
    - _Requirements: 2.6, 2.7_

  - [ ]* 6.4 Write property test: Embedding Provider Truncation Safety
    - **Property 7: Embedding Provider Truncation Safety**
    - Generate strings of length 0 to 100,000 characters, verify `embed(text)` returns `number[]` of exactly `provider.dimensions` length without throwing
    - **Validates: Requirements 2.7**

  - [ ]* 6.5 Write property test: Embedding Error Wrapping Preserves Context
    - **Property 9: Embedding Error Wrapping Preserves Context**
    - Generate random provider names and error messages, verify resulting `SoukCompassError` includes both in its message
    - **Validates: Requirements 10.3**

  - [x] 6.6 Write unit tests for embedding provider factory
    - Verify: selects local by default, selects bedrock-titan when configured, falls back to local on init failure with stderr warning
    - _Requirements: 2.8, 2.9_

- [x] 7. Checkpoint — Ensure client and provider tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement serialization layer
  - [x] 8.1 Create serialization functions in `src/serialization.ts`
    - `toSolrDocument(entry: CatalogEntry, text: string, embedding: number[])` — converts catalog entry to Solr JSON, validates output against `SolrDocumentSchema`, sets `doc_source: "artifact"`, maps all metadata fields (`artifact_name`, `artifact_type`, `display_name`, `maturity`, `collection_names`, `keywords`, `author`, `version`)
    - `fromSolrDocument(doc: Record<string, unknown>)` — parses Solr response into typed `SearchResult`, validates against `SearchResultSchema`, throws `SoukCompassError` with code `SERIALIZATION` on missing required fields
    - `toUserSolrDocument(id, text, embedding, metadata?)` — sets `doc_source: "user"`, prefixes user metadata keys with `metadata_`
    - Import `CatalogEntry` type from `../../../src/schemas.js`
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [ ]* 8.2 Write property test: Serialization Round-Trip Preserves Artifact Identity
    - **Property 1: Serialization Round-Trip Preserves Artifact Identity**
    - Generate random `CatalogEntry` objects with random 1024-d float embeddings, verify `toSolrDocument` → `fromSolrDocument` preserves artifact name, type, maturity, and collections
    - **Validates: Requirements 11.3**

  - [ ]* 8.3 Write property test: toSolrDocument Output Passes Schema Validation
    - **Property 2: toSolrDocument Output Passes Schema Validation**
    - Generate random valid `CatalogEntry` with text and embedding, verify output passes `SolrDocumentSchema.parse()` without error
    - **Validates: Requirements 3.4, 11.4**

  - [ ]* 8.4 Write property test: fromSolrDocument Rejects Incomplete Documents
    - **Property 3: fromSolrDocument Rejects Incomplete Documents**
    - Generate Solr response objects with randomly omitted required fields (`id`, `text`, `doc_source`), verify `fromSolrDocument` throws `SoukCompassError` with code `SERIALIZATION`
    - **Validates: Requirements 11.5**

  - [ ]* 8.5 Write property test: fromSolrDocument Extracts All Required Search Result Fields
    - **Property 4: fromSolrDocument Extracts All Required Search Result Fields**
    - Generate complete Solr response objects with all fields, verify `SearchResult` includes artifact name, display name, type, score, description, maturity, collections
    - **Validates: Requirements 4.7**

  - [ ]* 8.6 Write property test: Embedding Text Format for Artifacts
    - **Property 5: Embedding Text Format for Artifacts**
    - Generate random displayName, description, body strings, verify embedding text equals `"{displayName}: {description}\n\n{body}"`
    - **Validates: Requirements 3.5**

  - [ ]* 8.7 Write property test: User Document Serialization Invariants
    - **Property 6: User Document Serialization Invariants**
    - Generate random ids, texts, embeddings, metadata maps, verify: `doc_source === "user"`, metadata keys prefixed with `metadata_`, id/text/vector match inputs
    - **Validates: Requirements 5.5**

- [x] 9. Implement catalog reader
  - [x] 9.1 Create `src/catalog-reader.ts`
    - `loadCatalog(pluginRoot: string): Promise<CatalogEntry[]>` — reads and parses `catalog.json` using existing `CatalogEntrySchema` from `skill-forge/src/schemas.ts`
    - `readArtifactContent(pluginRoot: string, entry: CatalogEntry): Promise<{ frontmatter, body }>` — reads `knowledge/<name>/knowledge.md`, parses frontmatter and body
    - _Requirements: 3.2, 3.3, 6.5_

- [x] 10. Checkpoint — Ensure serialization and catalog reader tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement tool handlers
  - [x] 11.1 Create `compass_setup` tool handler in `src/tools/compass-setup.ts`
    - `check` action (default): detect Docker availability, Solr reachability, collection existence, document counts
    - `start` action: execute `docker compose up -d` using bundled `docker-compose.yml`
    - `create_collections` action: create artifact + user doc collections via Solr Collections API
    - `stop` action: execute `docker compose down`
    - Return structured JSON for all actions; handle Docker not installed, port conflicts
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10_

  - [x] 11.2 Create `compass_index_artifacts` tool handler in `src/tools/compass-index.ts`
    - Accept `{ name?: string; all?: boolean }` input
    - Single artifact: load catalog entry, read knowledge.md, build embedding text as `"{displayName}: {description}\n\n{body}"`, generate embedding, `toSolrDocument`, upsert
    - All artifacts: iterate catalog with `commit: false` per upsert, explicit `commit()` at end
    - Return `{ indexed: N, errors: N, details: [...] }`; handle Solr unreachable gracefully
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 11.3 Create `compass_search` tool handler in `src/tools/compass-search.ts`
    - Accept `{ query, topK?, type?, collection?, maturity?, scope? }` input
    - Embed query text, build Solr filter query from optional params, search appropriate collection(s) based on `scope`
    - Parse results via `fromSolrDocument`, format with artifact name, display name, type, score, description, maturity, collections
    - Handle no results and Solr unreachable gracefully
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 5.6_

  - [x] 11.4 Create `compass_index_document` tool handler in `src/tools/compass-index-doc.ts`
    - Accept `{ id, text, metadata?, collection? }` input
    - Generate embedding, `toUserSolrDocument`, upsert into user document collection (or specified collection)
    - Handle Solr unreachable gracefully
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.7_

  - [x] 11.5 Create `compass_status` tool handler in `src/tools/compass-status.ts`
    - Query Solr for document counts in each configured collection, return totals
    - _Requirements: 6.4_

  - [x] 11.6 Create `compass_health` tool handler in `src/tools/compass-health.ts`
    - Check Solr connectivity and collection existence, return `{ solrReachable, collections: [{ name, exists }] }`
    - _Requirements: 6.3_

  - [ ]* 11.7 Write property test: MCP Error Boundary Converts SoukCompassError to Tool Error
    - **Property 10: MCP Error Boundary Converts SoukCompassError to Tool Error**
    - Generate random `SoukCompassError` instances with random codes and messages, verify error boundary returns `{ isError: true }` with error message in text
    - **Validates: Requirements 10.4**

  - [x] 11.8 Write unit tests for tool handlers
    - `compass_setup`: check returns structured status, start/stop invoke docker compose, create_collections calls Solr API, Docker not available → helpful message, port conflict → helpful message
    - `compass_index_artifacts`: single artifact indexing, all artifacts indexing, Solr unreachable → error, re-index overwrites
    - `compass_search`: basic query, topK, type/collection/maturity filters, scope parameter, no results → message, Solr unreachable → error
    - `compass_index_document`: basic indexing, custom collection, Solr unreachable → error
    - `compass_status`: returns document counts
    - `compass_health`: returns connectivity status
    - _Requirements: 3.1–3.8, 4.1–4.9, 5.1–5.7, 6.3, 6.4, 10.4, 10.5, 10.6, 12.1–12.10_

- [x] 12. Checkpoint — Ensure all tool handler tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Implement MCP server entry point and wiring
  - [x] 13.1 Create MCP server in `src/index.ts`
    - Load and validate config via `loadConfig()`
    - Create embedding provider via `createEmbeddingProvider(config)` with fallback
    - Create two `SoukVectorClient` instances (artifact collection + user doc collection)
    - Build `ToolContext` object shared across handlers
    - Register all 6 tools with `@modelcontextprotocol/sdk` `Server` using `ListToolsRequestSchema` and `CallToolRequestSchema`
    - Wrap each tool handler in error boundary: `SoukCompassError` → `{ isError: true, text }`, unknown error → log stderr + generic message
    - Connect via `StdioServerTransport`
    - Solr availability NOT checked at startup — errors surface on tool invocation
    - _Requirements: 6.1, 6.2, 7.8, 10.4, 10.5, 10.6_

  - [x] 13.2 Write unit tests for MCP server error boundary and tool registration
    - Verify: all 6 tools registered, `SoukCompassError` → `isError: true` response, unknown error → generic message + stderr log, server survives tool errors
    - _Requirements: 6.2, 10.4, 10.5, 10.6_

- [x] 14. Create Solr schema and Docker infrastructure
  - [x] 14.1 Create Solr schema at `solr/schema.xml`
    - Define fields: `id` (string, unique key), `text` (text_general, stored, indexed), `vector` (DenseVectorField, 1024 dimensions, cosine, HNSW with `hnswMaxConnections=16`, `hnswBeamWidth=100`), artifact metadata fields (`artifact_name`, `artifact_type`, `display_name`, `maturity`, `author`, `version`, `doc_source`), multi-valued fields (`collection_names`, `keywords`), dynamic fields (`metadata_*`)
    - _Requirements: 8.1, 8.3, 8.5_

  - [x] 14.2 Create `docker-compose.yml` in project root
    - Start `solr:9` image with schema pre-loaded, expose port 8983
    - Mount schema.xml into the container's configset
    - _Requirements: 8.4_

  - [x] 14.3 Create `solr/README.md` with setup instructions
    - Cover local Docker-based development and remote Solr deployment
    - _Requirements: 8.2_

- [x] 15. Update `.mcp.json` and build configuration
  - [x] 15.1 Update root `.mcp.json` to add souk-compass server entry
    - Add `"souk-compass"` entry alongside existing `"context-bazaar"` entry, pointing to `skill-forge/mcp-servers/souk-compass/dist/mcp-server.cjs` with env var defaults
    - _Requirements: 6.7_

  - [x] 15.2 Add build script for CJS bundle
    - Configure bundling (Bun build or rollup) to produce `dist/mcp-server.cjs` self-contained bundle for distribution
    - _Requirements: 6.6_

- [x] 16. Final checkpoint — Ensure all tests pass (Requirements 1–12)
  - Ensure all tests pass, ask the user if questions arise.

- [x] 17. Update Zod schemas and Solr schema for Requirements 13–18
  - [x] 17.1 Extend `SoukCompassConfigSchema` in `src/schemas.ts` with new config fields
    - Add `cacheTiers` (array of `"memory" | "sqlite" | "solr"`, default `["memory","sqlite","solr"]`), `cacheDbPath` (string, default `"~/.souk-compass/embed-cache.db"`), `embedCacheSize` (positive int, default 1000), `defaultMinScore` (optional float 0–1), `efSearchScaleFactor` (positive float, default 1.0)
    - _Requirements: 17.2, 17.4, 17.9, 18.4_

  - [x] 17.2 Extend `SolrDocumentSchema` with `content_hash`, `chunk_index`, `parent_artifact` fields
    - `content_hash`: optional string; `chunk_index`: optional non-negative int; `parent_artifact`: optional string
    - _Requirements: 14.3, 14.6, 15.3, 15.4, 15.8_

  - [x] 17.3 Extend `SearchResultSchema` with `snippet`, `chunkIndex`, `parentArtifact` fields
    - `snippet`: optional string; `chunkIndex`: optional non-negative int; `parentArtifact`: optional string
    - _Requirements: 15.7, 16.1, 16.5_

  - [x] 17.4 Add `CompassReindexInputSchema` and `CompassSearchInputSchema` extensions to `ToolInputSchemas`
    - `CompassReindexInputSchema`: `{ force?: boolean }` (default false)
    - Extend `CompassSearchInputSchema` with `mode` (enum `"vector" | "keyword" | "hybrid"`, default `"hybrid"`), `hybridWeight` (float 0–1, default 0.5), `snippetLength` (positive int, default 200), `minScore` (optional float 0–1)
    - Extend `CompassIndexArtifactsInputSchema` with `chunked` (boolean, default false)
    - Add `compass_reindex` entry to `ToolInputSchemas`
    - _Requirements: 13.1, 13.3, 14.5, 15.1, 16.4, 18.1_

  - [x] 17.5 Update `solr/schema.xml` with `content_hash`, `chunk_index`, `parent_artifact` fields
    - `content_hash` (string, stored, indexed), `chunk_index` (pint, stored, indexed), `parent_artifact` (string, stored, indexed)
    - _Requirements: 14.6, 15.8_

- [x] 18. Implement embedding cache (`CachedEmbeddingProvider`)
  - [x] 18.1 Create `src/embed-cache.ts` with `CachedEmbeddingProvider` class and `contentHash` utility
    - Implement `contentHash(text: string): string` using `createHash("sha256")` from `node:crypto`
    - `CachedEmbeddingProvider` implements `EmbeddingProvider` interface, wraps any concrete provider
    - Constructor accepts `inner: EmbeddingProvider`, `tiers`, `memoryCacheSize`, `sqliteDbPath`, optional `solrClient`
    - In-memory LRU tier: `Map<string, number[]>` keyed by content hash, move-to-end on access, evict first entry on overflow
    - SQLite tier: `bun:sqlite` with table `embeddings(content_hash TEXT PK, embedding BLOB, provider_name TEXT, dimensions INTEGER, created_at TEXT)`, auto-create DB + table on first use
    - Solr-as-cache tier: query `SoukVectorClient.findByContentHash(hash)`, extract `vector` field if found, silently skip if Solr unreachable
    - `embed(text)`: compute content hash, check tiers in order, return first hit; on complete miss call inner provider, write to memory + SQLite tiers
    - `batchEmbed(texts)`: per-text cache lookup, batch-embed only cache misses via inner provider
    - `getStats(): CacheTierStats` for `compass_status` reporting (hits, misses, size per tier)
    - Handle SQLite corruption: log warning to stderr, skip tier, continue
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8, 17.9, 17.10, 17.11, 17.12, 17.13, 17.14_

  - [ ]* 18.2 Write property test: Cache Tier Fallthrough Order
    - **Property 20: Cache Tier Fallthrough Order**
    - Generate random tier configurations and per-tier hit/miss states using mocked tiers, verify first hit tier wins and lower tiers + provider are not consulted; on complete miss verify provider called and result written to memory + SQLite
    - **Validates: Requirements 17.1, 17.10**

  - [ ]* 18.3 Write property test: LRU Eviction Policy
    - **Property 21: LRU Eviction Policy**
    - Generate random sequences of `embed()` calls with varying texts, verify in-memory cache never exceeds `memoryCacheSize` entries and the least-recently-used entry is evicted on overflow
    - **Validates: Requirements 17.2, 17.3**

  - [ ]* 18.4 Write property test: Content Hash is SHA-256 of Embedding Text
    - **Property 16: Content Hash is SHA-256 of Embedding Text**
    - Generate random displayName, description, body strings, build embedding text as `"{displayName}: {description}\n\n{body}"`, verify `contentHash(embeddingText)` equals independently computed SHA-256 hex digest
    - **Validates: Requirements 14.3**

  - [x] 18.5 Write unit tests for `CachedEmbeddingProvider`
    - Memory tier hit returns cached value; SQLite tier hit returns cached value; Solr-as-cache tier hit returns vector; complete miss calls provider and writes to memory + SQLite; tier order respected; LRU eviction at capacity; SQLite auto-creates DB; corrupted SQLite → warning + skip; Solr unreachable → skip tier; `getStats()` returns correct counts; `batchEmbed` checks cache per-text
    - _Requirements: 17.1, 17.3, 17.6, 17.7, 17.8, 17.10, 17.11, 17.13, 17.14_

- [x] 19. Implement chunker module
  - [x] 19.1 Create `src/chunker.ts` with `chunkMarkdown` and `buildChunkDocuments` functions
    - `chunkMarkdown(body, options?)`: split body at `## ` and `### ` heading boundaries, merge short chunks (< `minLength`, default 50) with next chunk, split oversized chunks (> `maxLength`) at paragraph boundaries (`\n\n`), assign sequential zero-based indices
    - `buildChunkDocuments(artifactName, chunks, embeddings, metadata)`: produce `SolrDocument[]` with `id: "{artifactName}__chunk_{N}"`, `chunk_index: N`, `parent_artifact: artifactName`, all parent metadata fields inherited
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

  - [ ]* 19.2 Write property test: Chunk Splitting Produces Correctly Structured Chunks
    - **Property 17: Chunk Splitting Produces Correctly Structured Chunks**
    - Generate random Markdown bodies with varying heading structures (`##`, `###`), verify: chunk IDs follow `"{artifactName}__chunk_{N}"` pattern with sequential indices, each chunk has `chunk_index` and `parent_artifact`, all parent metadata present, concatenating chunk texts reconstructs original body (modulo heading-boundary whitespace normalization)
    - **Validates: Requirements 15.2, 15.3, 15.4**

  - [ ]* 19.3 Write property test: Short Chunks Are Merged
    - **Property 18: Short Chunks Are Merged**
    - Generate Markdown bodies with very short sections (< 50 chars between headings), verify no output chunk (except possibly the last) has text shorter than `minLength`
    - **Validates: Requirements 15.5**

  - [x] 19.4 Write unit tests for chunker
    - Splits at `##` and `###` boundaries; merges short chunks (< 50 chars); splits oversized chunks at paragraph boundaries; chunk IDs follow pattern; `chunk_index` and `parent_artifact` set correctly; empty body → single chunk; body with no headings → single chunk
    - _Requirements: 15.2, 15.3, 15.4, 15.5, 15.6_

- [x] 20. Checkpoint — Ensure cache and chunker tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 21. Extend `SoukVectorClient` for hybrid search, threshold search, and snippets
  - [x] 21.1 Add `mode`, `hybridWeight`, `queryText`, `snippetLength` options to `search()` method
    - `"vector"` mode: existing `{!knn}` query (no BM25 components)
    - `"keyword"` mode: standard Solr `q` text query against `text` field, no embedding needed (`queryEmbedding` may be null)
    - `"hybrid"` mode: combined BM25 + kNN using Solr's `seedQuery` on knn parser / `{!rerank}` / `sum(mul(scale(...)))` function queries, weighted by `hybridWeight`
    - Highlighting: when `snippetLength` is set and mode is `"keyword"` or `"hybrid"`, add `hl=true&hl.fl=text&hl.snippets=1&hl.fragsize={snippetLength}` to Solr query
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 16.2_

  - [x] 21.2 Add `searchByThreshold()` method to `SoukVectorClient`
    - Uses Solr's `{!vectorSimilarity f=vector minReturn=N}` query parser for server-side score filtering
    - Accepts `queryEmbedding`, `topK`, `minScore`, optional `filterQuery` and `minTraverse`
    - _Requirements: 18.1, 18.2, 18.6_

  - [x] 21.3 Add `findByContentHash()` method to `SoukVectorClient`
    - Query Solr for documents matching a `content_hash` value, return first match or null
    - Used by Solr-as-cache tier in `CachedEmbeddingProvider`
    - _Requirements: 17.7_

  - [ ]* 21.4 Write property test: Hybrid Search Mode Query Construction
    - **Property 13: Hybrid Search Mode Query Construction**
    - Generate random modes (`"vector"`, `"keyword"`, `"hybrid"`) and `hybridWeight` values in [0.0, 1.0], verify: `"vector"` produces `{!knn}` without BM25, `"keyword"` produces standard `q` without kNN, `"hybrid"` produces combined query; at `hybridWeight=0.0` hybrid degenerates to pure keyword, at `hybridWeight=1.0` to pure vector
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.7**

  - [ ]* 21.5 Write property test: Filter Queries Apply Across All Modes
    - **Property 14: Filter Queries Apply Consistently Across All Search Modes**
    - Generate random mode + filter parameter combinations (`type`, `collection`, `maturity`), verify constructed Solr query includes corresponding `fq` parameters regardless of mode
    - **Validates: Requirements 13.6**

  - [x] 21.6 Write unit tests for extended `SoukVectorClient`
    - Hybrid mode constructs combined BM25+kNN query; keyword mode skips embedding; `searchByThreshold` uses `{!vectorSimilarity}` parser with `minReturn`; highlighting params added for keyword/hybrid; `findByContentHash` queries correct field; `earlyTermination`/`efSearchScaleFactor` defaults applied
    - _Requirements: 13.1, 13.2, 13.4, 13.5, 13.7, 16.2, 17.7, 18.1_

- [x] 22. Checkpoint — Ensure extended Solr client tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 23. Update serialization layer for chunks, snippets, and content hash
  - [x] 23.1 Update `toSolrDocument` to include `content_hash` field
    - Compute SHA-256 of embedding text via `contentHash()` from `embed-cache.ts`, store as `content_hash` in Solr document
    - _Requirements: 14.3_

  - [x] 23.2 Update `fromSolrDocument` to extract `snippet`, `chunkIndex`, `parentArtifact` fields
    - Parse optional `snippet` from Solr highlighting response or text truncation
    - Parse optional `chunkIndex` and `parentArtifact` from chunk documents
    - _Requirements: 15.7, 16.1, 16.5_

  - [ ]* 23.3 Write property test: Snippet Length Invariant
    - **Property 19: Snippet Length Invariant**
    - Generate random texts and `snippetLength` values, verify returned `snippet` field does not exceed `snippetLength` characters; in vector mode verify snippet is exactly `text.slice(0, snippetLength)`
    - **Validates: Requirements 16.1, 16.3, 16.4**

- [x] 24. Update tool handlers for Requirements 13–18
  - [x] 24.1 Update `compass_search` handler for hybrid search, snippets, and threshold
    - Add `mode`, `hybridWeight`, `snippetLength`, `minScore` parameter handling
    - `"keyword"` mode: skip embedding, call `search()` with `mode: "keyword"` and `queryText`
    - `"hybrid"` mode: embed query, call `search()` with `mode: "hybrid"`, `hybridWeight`, and `queryText`
    - `"vector"` mode: embed query, call `search()` with `mode: "vector"` (existing behavior)
    - Snippet generation: keyword/hybrid use Solr highlighting; vector uses text truncation to `snippetLength`
    - `minScore` handling: if set (tool param or `SOUK_COMPASS_DEFAULT_MIN_SCORE` env var), use `searchByThreshold()`; tool param takes precedence over env var
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 16.1, 16.2, 16.3, 16.4, 18.1, 18.2, 18.3, 18.4, 18.5_

  - [x] 24.2 Update `compass_index_artifacts` handler for chunked indexing and content hash
    - Add `chunked` parameter handling
    - When `chunked=true`: call `chunkMarkdown(body)`, `batchEmbed` chunk texts via `CachedEmbeddingProvider`, `buildChunkDocuments(name, chunks, embeddings, metadata)`, upsert each chunk document
    - When `chunked=false` (default): existing flow, but now include `content_hash` in Solr document via updated `toSolrDocument`
    - _Requirements: 14.3, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

  - [x] 24.3 Create `compass_reindex` tool handler in `src/tools/compass-reindex.ts`
    - Accept `{ force?: boolean }` input
    - Load `catalog.json`, query Solr for all existing artifact documents (`doc_source="artifact"`) fetching `id`, `version`, `content_hash`
    - For each catalog entry: build embedding text, compute SHA-256 `content_hash`, compare against Solr doc — classify as added/updated/unchanged
    - Solr docs not in catalog → removed (delete from Solr)
    - If `force=true`, treat all catalog entries as updated
    - Re-index added + updated artifacts (embed via `CachedEmbeddingProvider` + upsert with `content_hash`)
    - Batch mode: `commit=false` per upsert, explicit `commit()` at end
    - Return `{ added: N, updated: N, unchanged: N, removed: N }`
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x] 24.4 Update `compass_status` handler to include cache stats
    - Call `CachedEmbeddingProvider.getStats()` and include per-tier hit/miss/size in status response
    - _Requirements: 17.11_

  - [ ]* 24.5 Write property test: Reindex Change Detection and Summary Consistency
    - **Property 15: Reindex Change Detection and Summary Consistency**
    - Generate random catalog/Solr state pairs with varying version/hash matches, verify each artifact classified as exactly one of added/updated/unchanged/removed; verify `added + updated + unchanged = |catalog|` and `removed = |solr_artifacts| - (updated + unchanged)`
    - **Validates: Requirements 14.1, 14.2, 14.4**

  - [ ]* 24.6 Write property test: Similarity Threshold Filtering
    - **Property 22: Similarity Threshold Filtering**
    - Generate random result sets with random scores and `minScore` thresholds in [0.0, 1.0], verify all returned results have `score >= minScore` and results below threshold are excluded
    - **Validates: Requirements 18.1, 18.2**

  - [ ]* 24.7 Write property test: minScore Parameter Precedence
    - **Property 23: minScore Parameter Precedence Over Environment Variable**
    - Generate random `minScore` tool param and `SOUK_COMPASS_DEFAULT_MIN_SCORE` env var combinations (both set, only param, only env, neither), verify: tool param takes precedence when both set, env var used when only env set, no filtering when neither set
    - **Validates: Requirements 18.5**

  - [x] 24.8 Write unit tests for updated and new tool handlers
    - `compass_search`: mode=vector uses kNN; mode=keyword uses BM25 (no embed call); mode=hybrid uses combined query; `hybridWeight` boundaries (0.0 and 1.0); snippets from highlighting (keyword/hybrid); snippets from text truncation (vector); `snippetLength` parameter; `minScore` filtering; `minScore` precedence over env var
    - `compass_index_artifacts`: `chunked=true` produces chunk documents with correct IDs and metadata; `content_hash` included in Solr document
    - `compass_reindex`: detects added/updated/unchanged/removed artifacts; `force=true` re-indexes all; returns correct summary counts; version change detected; hash change detected
    - `compass_status`: returns cache stats per tier
    - _Requirements: 13.1–13.7, 14.1–14.5, 15.1–15.7, 16.1–16.4, 17.11, 18.1–18.5_

- [x] 25. Wire new components into MCP server entry point
  - [x] 25.1 Update `src/index.ts` to integrate `CachedEmbeddingProvider`, `compass_reindex`, and extended config
    - Wrap embedding provider in `CachedEmbeddingProvider` using config tiers, cache size, SQLite path, and Solr client
    - Register `compass_reindex` as 7th tool in MCP server (tools 8–11 added in task 32)
    - Pass `CachedEmbeddingProvider` (not raw provider) as `embeddingProvider` in `ToolContext`
    - Read `SOUK_COMPASS_DEFAULT_MIN_SCORE` into config for threshold search
    - _Requirements: 6.2, 14.1, 17.1, 17.9, 17.12, 18.4_

  - [x] 25.2 Update `.mcp.json` env vars for new config fields
    - Add `SOUK_COMPASS_CACHE_TIERS`, `SOUK_COMPASS_CACHE_DB`, `SOUK_COMPASS_EMBED_CACHE_SIZE`, `SOUK_COMPASS_EF_SEARCH_SCALE` to souk-compass server entry
    - _Requirements: 17.2, 17.4, 17.9_

- [x] 26. Checkpoint — Ensure all tests pass (Requirements 1–18)
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 27. Add Zod schemas for new tools (Requirements 19–24)
  - [x] 27.1 Add `CompassRecallInputSchema`, `CompassRememberInputSchema`, `CompassRecallMemoryInputSchema`, `CompassProfileWorkspaceInputSchema` to `src/schemas.ts`
    - `CompassRecallInputSchema`: `{ context: string, topK?: number (default 3), minScore?: number (default 0.6), exclude?: string[] (default []) }`
    - `CompassRememberInputSchema`: `{ note: string, category: enum("preference","convention","recommendation","observation","workflow"), tags?: string[] }`
    - `CompassRecallMemoryInputSchema`: `{ query: string, category?: string, tags?: string[], topK?: number (default 5) }`
    - `CompassProfileWorkspaceInputSchema`: `{ files: Array<{path: string, content: string}>, topK?: number (default 10), minScore?: number (default 0.4), persist?: boolean (default false) }`
    - Add all four to `ToolInputSchemas` object
    - _Requirements: 22.2, 22.4, 22.5, 22.7, 23.2, 23.5, 24.2, 24.5_

  - [x] 27.2 Extend `SearchResultSchema` with `rationale`, `matchReason`, `category`, `tags`, `createdAt` fields
    - `rationale`: optional string (for `compass_recall` results)
    - `matchReason`: optional string (for `compass_profile_workspace` results)
    - `category`: optional string (for memory results)
    - `tags`: optional array of strings (for memory results)
    - `createdAt`: optional string (for memory results)
    - _Requirements: 22.6, 23.9, 24.6_

  - [x] 27.3 Add `includeContent` parameter to `CompassSearchInputSchema`
    - `includeContent`: boolean, default false
    - _Requirements: 19.5_

- [x] 28. Implement serialization update and workspace profiler
  - [x] 28.1 Add `toMemoryDocument` function to `src/serialization.ts`
    - Accept `note: string`, `embedding: number[]`, `category: string`, `tags?: string[]`, `sessionId?: string`
    - Generate UUID v4 for `id`, set `doc_source: "memory"`, `metadata_category`, `metadata_tags` (comma-joined), `metadata_created_at` (ISO 8601), `metadata_session_id`
    - Validate output against `SolrDocumentSchema`
    - _Requirements: 23.3_

  - [ ]* 28.2 Write property test: Memory Document Serialization Invariants
    - **Property 26: Memory Document Serialization Invariants**
    - Generate random note strings, valid categories, and optional tags arrays, verify: `doc_source === "memory"`, `id` is valid UUID v4, `metadata_category` matches input, `metadata_tags` is comma-joined input tags, `metadata_created_at` is valid ISO 8601, `text` and `vector` match inputs
    - **Validates: Requirements 23.3**

  - [x] 28.3 Create `src/workspace-profiler.ts` with `generateWorkspaceDescription` and `generateMatchReason` functions
    - `generateWorkspaceDescription(files: WorkspaceFile[]): string` — parse `package.json` for name/deps/scripts, parse config files (`tsconfig.json`, `biome.json`, etc.) for tool names, scan file extensions for languages, extract tech mentions from `README.md`, concatenate into structured description string; function is pure and deterministic
    - `generateMatchReason(workspaceDescription: string, artifactKeywords: string[], artifactDescription: string): string` — generate a one-sentence explanation of why an artifact matched based on keyword overlap between workspace description and artifact keywords/description
    - _Requirements: 24.3, 24.6, 24.10_

  - [ ]* 28.4 Write property test: Workspace Description Generation is Deterministic
    - **Property 28: Workspace Description Generation is Deterministic**
    - Generate random workspace file sets (arrays of `{path, content}` objects), call `generateWorkspaceDescription` twice with the same input, verify identical output strings
    - **Validates: Requirements 24.10**

  - [x] 28.5 Write unit tests for `toMemoryDocument` and workspace profiler
    - `toMemoryDocument`: UUID generated, `doc_source` is `"memory"`, category stored, tags comma-joined, `created_at` is ISO 8601, session_id stored when provided
    - `generateWorkspaceDescription`: extracts project name from `package.json`, detects languages from dependencies, detects build tools from scripts, deterministic output, empty files → empty/minimal description
    - `generateMatchReason`: produces non-empty string, mentions overlapping keywords
    - _Requirements: 23.3, 24.3, 24.6, 24.10_

- [x] 29. Checkpoint — Ensure serialization and workspace profiler tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 30. Implement new tool handlers (Requirements 22–24)
  - [x] 30.1 Create `compass_recall` tool handler in `src/tools/compass-recall.ts`
    - Accept `{ context: string, topK?: number, minScore?: number, exclude?: string[] }` input
    - Embed context string, perform kNN search against artifact collection (topK default: 3, minScore default: 0.6)
    - Filter out artifacts in `exclude` array from results
    - For each match, generate `rationale` by concatenating artifact description with keyword matches against context
    - Return results: `artifact_name`, `display_name`, `type`, `relevance_score`, `description`, `rationale`
    - Return empty result set if no artifacts score above `minScore`; handle Solr unreachable gracefully
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7, 22.8, 22.9, 22.10_

  - [ ]* 30.2 Write property test: Recall Exclude Filtering
    - **Property 25: Recall Exclude Filtering**
    - Generate random search result sets and random `exclude` arrays of artifact names, verify no excluded `artifact_name` appears in output; output is a subset of unfiltered results minus excluded names
    - **Validates: Requirements 22.7**

  - [x] 30.3 Create `compass_remember` tool handler in `src/tools/compass-remember.ts`
    - Accept `{ note: string, category: string, tags?: string[] }` input
    - Embed note text, call `toMemoryDocument(note, embedding, category, tags, sessionId)`, upsert into user document collection
    - Return `{ id, category, tags, created_at }`; handle Solr unreachable gracefully
    - _Requirements: 23.1, 23.2, 23.3, 23.7, 23.10_

  - [x] 30.4 Create `compass_recall_memory` tool handler in `src/tools/compass-recall-memory.ts`
    - Accept `{ query: string, category?: string, tags?: string[], topK?: number }` input
    - Embed query, build filter query: always include `doc_source:"memory"`, add optional `metadata_category` and `metadata_tags` filters (AND logic)
    - Perform kNN search against user document collection (topK default: 5)
    - Parse results via `fromSolrDocument`, extract memory-specific fields (note text, category, tags, created_at, score)
    - _Requirements: 23.4, 23.5, 23.6, 23.8, 23.9_

  - [ ]* 30.5 Write property test: Recall Memory Filter Always Includes doc_source Constraint
    - **Property 27: Recall Memory Filter Always Includes doc_source Constraint**
    - Generate random query/category/tags combinations, verify constructed Solr filter query always includes `doc_source:"memory"`; additional category and tag filters are additive (AND) with the doc_source filter
    - **Validates: Requirements 23.6**

  - [x] 30.6 Create `compass_profile_workspace` tool handler in `src/tools/compass-profile-workspace.ts`
    - Accept `{ files: Array<{path, content}>, topK?: number, minScore?: number, persist?: boolean }` input
    - Call `generateWorkspaceDescription(files)` to build description string
    - Embed description, perform kNN search against artifact collection (topK default: 10, minScore default: 0.4)
    - For each match, call `generateMatchReason(description, artifact.keywords, artifact.description)` to produce `match_reason`
    - If `persist=true`, store workspace profile as memory note via `compass_remember` (category: `"workspace_profile"`)
    - If `files` is empty, return suggestion message listing recommended files to include
    - Return results: `artifact_name`, `display_name`, `type`, `relevance_score`, `description`, `match_reason`
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7, 24.8, 24.9_

  - [ ]* 30.7 Write unit tests for new tool handlers
    - `compass_recall`: basic context recall, topK parameter, minScore threshold (default 0.6), exclude filtering, rationale generation, empty results when below threshold, Solr unreachable → error
    - `compass_remember`: basic note persistence, category validation, tags stored as comma-joined, UUID generated for id, created_at is ISO 8601, session_id from env
    - `compass_recall_memory`: basic memory search, category filter, tags filter, `doc_source:"memory"` filter always present, topK parameter, result includes note text/category/tags/created_at/score
    - `compass_profile_workspace`: basic workspace profiling, package.json parsing, deterministic description, persist=true stores memory note, persist=false skips storage, empty files → suggestion message, match_reason generation, topK and minScore parameters
    - _Requirements: 22.1–22.10, 23.1–23.9, 24.1–24.9_

- [x] 31. Update `compass_search` for cross-tool chaining (Requirement 19)
  - [x] 31.1 Update `compass_search` handler to enrich results with chaining metadata
    - Ensure each result includes `artifact_name` (kebab-case, usable as input to `artifact_content`) and `artifact_path` (relative path to `knowledge.md`, e.g., `"knowledge/{name}/knowledge.md"`)
    - For chunked results, include `parent_artifact` name usable with `artifact_content`
    - Implement `includeContent` parameter: when true and ≤3 results, read and inline full `knowledge.md` body per result; when true and >3 results, inline first 500 chars per result + note to use `artifact_content`
    - Update tool description to mention that `artifact_name` can be passed to `artifact_content` for full content retrieval
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_

  - [ ]* 31.2 Write property test: includeContent Truncation Behavior
    - **Property 24: includeContent Truncation Behavior**
    - Generate random result sets of varying sizes (1–10) with random content lengths, verify: ≤3 results → full `knowledge.md` body in `content` field; >3 results → `content` field truncated to at most 500 characters
    - **Validates: Requirements 19.5, 19.6**

  - [ ]* 31.3 Write unit tests for cross-tool chaining
    - `artifact_name` and `artifact_path` present in results; `includeContent=false` omits content; `includeContent=true` with ≤3 results includes full content; `includeContent=true` with >3 results truncates to 500 chars; chunked results include `parent_artifact`
    - _Requirements: 19.1, 19.2, 19.3, 19.5, 19.6_

- [x] 32. Wire new tools into MCP server and update `compass_status`
  - [x] 32.1 Update `src/index.ts` to register all 11 tools
    - Register `compass_recall`, `compass_remember`, `compass_recall_memory`, `compass_profile_workspace` as tools 8–11 in MCP server
    - Wrap each in the existing error boundary (SoukCompassError → `{ isError: true }`, unknown → generic message)
    - Update tool descriptions: `compass_recall` instructs assistant to call proactively; `compass_remember` instructs assistant to call when discovering preferences/conventions; `compass_recall_memory` instructs assistant to call at session start; `compass_profile_workspace` instructs assistant to call when entering new workspace
    - _Requirements: 6.2, 22.8, 23.7, 23.8, 24.8_

  - [x] 32.2 Update `compass_status` handler to include memory note count
    - Query user document collection for `doc_source:"memory"` count, include in status response alongside collection stats and cache stats
    - _Requirements: 23.11_

  - [ ]* 32.3 Write unit tests for updated MCP server registration
    - Verify: all 11 tools registered, new tool handlers wrapped in error boundary, tool descriptions contain proactive usage instructions
    - _Requirements: 6.2, 22.8, 23.7, 23.8, 24.8_

- [x] 33. Create auto-reindex hook and update plugin bundling (Requirements 20–21)
  - [x] 33.1 Create `hooks/auto-reindex.json` hook configuration
    - `id`: `"souk-compass-auto-reindex"`, `name`: `"Auto-Reindex on Build"`, `eventType`: `"postToolUse"`, `hookAction`: `"askAgent"`, `toolTypes`: `"shell"`, `outputPrompt`: `"The catalog has been rebuilt. Run compass_reindex to update the semantic search index."`
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_

  - [x] 33.2 Update `.claude-plugin/plugin.json` for Souk Compass
    - Add `"semantic-search"`, `"vector-search"`, `"solr"`, `"embeddings"` to `keywords` array
    - Update `description` to mention semantic search capabilities
    - _Requirements: 21.2_

  - [x] 33.3 Update `.claude-plugin/marketplace.json` for Souk Compass
    - Add `"semantic-search"`, `"vector-search"`, `"solr"` to `tags` array
    - Update `description` to mention Souk Compass semantic search
    - _Requirements: 21.3_

  - [x] 33.4 Add `build:souk-compass` script to `package.json`
    - `bun build src/index.ts --target=node --outfile=dist/mcp-server.cjs --format=cjs` in souk-compass directory
    - _Requirements: 21.4_

  - [x] 33.5 Document auto-reindex hook in `solr/README.md`
    - Add section explaining the hook, how to enable/disable it, and its behavior when Solr is unavailable
    - _Requirements: 20.6_

  - [x] 33.6 Write unit tests for hook and plugin bundling
    - `hooks/auto-reindex.json` exists and is valid JSON with correct `eventType`, `hookAction`, `toolTypes`
    - `.mcp.json` contains souk-compass entry with expected env vars
    - `.claude-plugin/plugin.json` contains new keywords
    - `.claude-plugin/marketplace.json` contains new tags
    - _Requirements: 20.1, 20.2, 21.1, 21.2, 21.3, 21.5_

- [x] 34. Update `.mcp.json` env vars for new tools
  - Ensure souk-compass entry in `.mcp.json` includes all env vars needed for Requirements 19–24 (no new env vars beyond those already added in task 25.2, but verify completeness)
  - Verify `compass_setup` resolves paths correctly when `CLAUDE_PLUGIN_ROOT` is set (plugin context detection)
  - _Requirements: 21.1, 21.5, 21.6, 21.7, 21.8_

- [x] 35. Final checkpoint — Ensure all tests pass (Requirements 1–24)
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each major component
- Property tests validate the 28 universal correctness properties from the design document (P1–P12 in tasks 1–16, P13–P23 in tasks 17–26, P24–P28 in tasks 27–35)
- Unit tests validate specific examples, edge cases, and error conditions
- All code uses Bun + TypeScript (ESNext, strict mode), Zod v4 for validation, and fast-check for property-based tests
- The MCP server is independent of the existing context-bazaar bridge — both can start/stop independently
- Tasks 17–26 cover Requirements 13–18 (hybrid search, auto-reindex, chunk indexing, snippets, embedding cache, similarity threshold)
- Tasks 27–35 cover Requirements 19–24 (cross-tool chaining, auto-index hook, plugin bundling, contextual recall, memory persistence, workspace-aware matching)
- Dependency order for tasks 17–26: schemas/Solr schema (17) → cache (18) → chunker (19) → Solr client extensions (21) → serialization updates (23) → tool handler updates (24) → MCP wiring (25)
- Dependency order for tasks 27–35: new schemas (27) → serialization + workspace profiler (28) → new tool handlers (30) → cross-tool chaining updates (31) → MCP wiring for all 11 tools (32) → hook + plugin bundling (33) → env var verification (34)
- The MCP server entry point registers all 11 tools: compass_setup, compass_index_artifacts, compass_search, compass_index_document, compass_reindex, compass_status, compass_health, compass_recall, compass_remember, compass_recall_memory, compass_profile_workspace
