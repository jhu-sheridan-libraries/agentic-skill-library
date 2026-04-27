# Requirements Document

## Introduction

Souk Compass is a Solr-backed semantic search capability for the context-bazaar, exposed as an MCP server that provides vector indexing and semantic search over the bazaar's knowledge artifacts and optionally user-provided document collections. The name follows the bazaar theme — Souk Compass is the tool that orients you semantically in the marketplace, finding relevant knowledge artifacts by meaning rather than exact keyword match.

The implementation adapts the "Looking Glass" concept from a companion project (Apache Solr 9.x with DenseVectorField / HNSW indexing) into the context-bazaar ecosystem. Key adaptations: Bun + TypeScript runtime, MCP server interface (not CLI), pluggable embedding providers (local-first with optional cloud providers), and indexing of knowledge artifacts from the bazaar catalog plus user-supplied document collections.

Souk Compass runs as a standalone MCP server in `skill-forge/mcp-servers/souk-compass/`, separate from the existing catalog bridge. It connects to a local or remote Solr 9.x instance, generates embeddings via a pluggable provider interface, and provides tools for indexing artifacts, indexing user documents, and performing semantic queries. Configuration follows the project's existing pattern: environment variables with sensible defaults.

Beyond core vector search, Souk Compass supports hybrid search combining BM25 keyword relevance with kNN vector similarity for improved result quality, chunk-level indexing of long artifacts for finer-grained retrieval, search result snippets for quick relevance previews, an in-memory LRU embedding cache to avoid redundant API calls, automatic re-indexing on catalog changes, and configurable similarity score thresholds to filter low-relevance noise.

As a Claude Code plugin, Souk Compass serves as a skill-related memory bank: it proactively recalls relevant artifacts based on the assistant's working context, persists observations and user preferences across sessions via plugin-level memory, matches workspace characteristics against the artifact catalog for project-aware recommendations, and chains seamlessly with the existing catalog bridge for end-to-end artifact discovery and retrieval.

### Relationship to Existing Specs

This spec supersedes the earlier `looking-glass-bazaar` spec by introducing a pluggable embedding provider (rather than Bedrock-only), user document collection support, and bazaar-themed naming throughout. The Solr vector store client and MCP server architecture remain structurally similar but are renamed and extended.

## Glossary

- **Souk_Compass**: The MCP server that provides Solr-backed semantic search over context-bazaar knowledge artifacts and user document collections
- **Solr_Instance**: An Apache Solr 9.x server with Dense Vector Search support (DenseVectorField with HNSW indexing), either local (Docker) or remote
- **Vector_Store_Client**: The `SoukVectorClient` TypeScript class that handles document upsert, kNN queries, deletion, commit, and health checks against a Solr_Instance
- **Embedding**: A fixed-length float array (1024 dimensions by default) representing the semantic content of a text passage
- **Embedding_Provider**: An interface for generating embeddings from text; concrete implementations include a local provider (transformers.js or local API) and optional cloud providers (Bedrock Titan, OpenAI)
- **kNN_Query**: A k-nearest-neighbors query against Solr's DenseVectorField, returning the top-k most semantically similar documents
- **Knowledge_Artifact**: A canonical source file in `knowledge/<name>/knowledge.md` containing YAML frontmatter and Markdown body, as defined by the existing `KnowledgeArtifactSchema`
- **Catalog_Entry**: A record in `catalog.json` representing a parsed artifact's metadata, as defined by the existing `CatalogEntrySchema`
- **User_Document**: A user-supplied document (Markdown, plain text, or other supported format) indexed into a separate Solr collection for personal semantic search
- **Document_Collection**: A named Solr collection holding either indexed artifacts (the default bazaar collection) or user-provided documents
- **MCP_Server**: A Model Context Protocol server that exposes tools to AI coding assistants via stdio transport
- **Index_Document**: A Solr document containing text content, an embedding vector, and metadata fields
- **Filter_Query**: A Solr filter query (fq parameter) used to restrict search results by metadata fields
- **MCP_Bridge**: The existing `mcp-bridge.ts` server that exposes `catalog_list`, `artifact_content`, and `collection_list` tools
- **Hybrid_Search**: A search mode combining BM25 keyword relevance with kNN vector similarity for improved result quality
- **BM25**: Best Matching 25 — Solr's default probabilistic text relevance scoring algorithm
- **Chunk**: A segment of a knowledge artifact body, split at heading boundaries, indexed as a separate Solr document with a reference to its parent artifact
- **Content_Hash**: A SHA-256 hash of the embedding text used for change detection and embedding cache keys
- **Embedding_Cache**: A multi-tier cache (in-memory LRU → SQLite on-disk → Solr-as-cache) that stores embeddings keyed by content hash to avoid redundant embedding API calls, persisting across sessions and optionally shared via Solr
- **SQLite_Cache**: The on-disk persistence tier of the Embedding_Cache, using Bun's built-in `bun:sqlite` to store content-hash-to-embedding mappings that survive MCP server restarts
- **Solr_As_Cache**: The team-sharing tier of the Embedding_Cache, which checks existing Solr documents for matching `content_hash` fields and reuses their stored vectors instead of re-embedding
- **Snippet**: A short text excerpt from a search result highlighting the relevant portion of the matched document
- **Contextual_Recall**: The process of proactively searching the artifact index based on the assistant's current working context (file types, task description, tool usage) to surface relevant skills and workflows without explicit user queries
- **Memory_Note**: A structured observation or preference indexed by the assistant into the user document collection, enabling cross-session recall of user preferences, project conventions, and past recommendations
- **Workspace_Profile**: An embedding-based representation of a user's workspace derived from project files (package.json, config files, source structure), used to match relevant artifacts by comparing workspace embeddings against artifact embeddings
- **Cross_Tool_Chaining**: The pattern where `compass_search` results include sufficient metadata (artifact name, type, path) for the assistant to seamlessly invoke `artifact_content` from the catalog bridge to retrieve full artifact content
- **Auto_Index_Hook**: A hook that triggers `compass_reindex` after `forge build` completes, keeping the Solr index synchronized with the catalog without manual intervention
- **Plugin_Memory**: The persistent knowledge layer formed by the combination of the Solr index, SQLite embedding cache, and user document collection, enabling the assistant to retain and recall context across Claude Code sessions

## Requirements

### Requirement 1: Solr Vector Store Client

**User Story:** As a developer, I want a reusable TypeScript client for Solr vector operations, so that both artifact search and user document search can share the same indexing and query infrastructure.

#### Acceptance Criteria

1. THE Souk_Compass SHALL provide a `SoukVectorClient` class in `solr-client.ts` that accepts a Solr base URL and collection name
2. THE `SoukVectorClient` SHALL implement an `upsert(docId: string, text: string, embedding: number[], metadata: Record<string, string>)` method that indexes a document with its text content, embedding vector, and metadata fields into the Solr collection via the Solr JSON update API
3. THE `SoukVectorClient` SHALL implement a `search(queryEmbedding: number[], topK: number, filterQuery?: string)` method that performs a kNN query against the collection's vector field and returns the top-k most similar documents with their scores, text, and metadata
4. THE `SoukVectorClient` SHALL implement a `delete(docId: string)` method that removes a document from the collection by ID
5. THE `SoukVectorClient` SHALL implement a `health()` method that checks connectivity to the Solr_Instance and returns a boolean indicating whether the instance is reachable and the configured collection exists
6. THE `SoukVectorClient` SHALL use the Fetch API for HTTP communication with the Solr JSON API
7. IF a Solr request fails due to a connection error, HTTP error status, or malformed response, THEN THE `SoukVectorClient` SHALL throw a `SoukCompassError` with a descriptive message including the HTTP status code and Solr error body when available
8. THE `search` method SHALL support an optional `filterQuery` parameter that passes a Solr filter query (fq) to restrict results by metadata fields (e.g., `artifact_type:skill`, `maturity:stable`)
9. THE `SoukVectorClient` SHALL commit documents on upsert by default, with an optional `commit` parameter set to `false` for batch operations followed by an explicit `commit()` call
10. THE `SoukVectorClient` SHALL expect the Solr collection schema to contain at minimum: `id` (string, unique key), `text` (text_general, stored), `vector` (DenseVectorField, 1024 dimensions, HNSW algorithm, cosine similarity), and metadata fields appropriate for knowledge artifacts and user documents

### Requirement 2: Pluggable Embedding Provider

**User Story:** As a developer, I want a pluggable embedding provider interface with at least one local implementation, so that Souk Compass works without cloud credentials and can be extended with cloud providers when available.

#### Acceptance Criteria

1. THE Souk_Compass SHALL define an `EmbeddingProvider` interface in `embedding-provider.ts` with a method `embed(text: string): Promise<number[]>` that returns an embedding vector for the given text
2. THE `EmbeddingProvider` interface SHALL include a `batchEmbed(texts: string[]): Promise<number[][]>` method that generates embeddings for multiple texts
3. THE `EmbeddingProvider` interface SHALL include a `dimensions(): number` property that returns the dimensionality of the embedding vectors produced by the provider
4. THE `EmbeddingProvider` interface SHALL include a `name(): string` property that returns a human-readable identifier for the provider (e.g., `"transformers-local"`, `"bedrock-titan"`)
5. THE Souk_Compass SHALL provide at least one concrete `EmbeddingProvider` implementation that runs locally without cloud credentials, using either transformers.js or a configurable local HTTP embedding API endpoint
6. THE Souk_Compass SHALL provide an optional `BedrockTitanProvider` implementation that uses the `amazon.titan-embed-text-v2:0` model via the Bedrock Runtime API for users who have AWS credentials configured
7. IF input text exceeds the provider's maximum token limit, THEN THE `EmbeddingProvider` implementation SHALL truncate the input by taking the first portion that fits rather than throwing an error
8. THE Souk_Compass SHALL select the active Embedding_Provider based on the `SOUK_COMPASS_EMBED_PROVIDER` environment variable, falling back to the local provider when the variable is not set
9. IF the configured Embedding_Provider fails to initialize (e.g., missing credentials for a cloud provider), THEN THE Souk_Compass SHALL log a warning to stderr and fall back to the local provider

### Requirement 3: Artifact Indexing

**User Story:** As a user, I want Souk Compass to index knowledge artifacts from the bazaar catalog into Solr, so that I can later search them semantically by meaning.

#### Acceptance Criteria

1. THE Souk_Compass MCP server SHALL expose a `compass_index_artifacts` tool that indexes one or more knowledge artifacts into the configured Solr collection
2. WHEN the `compass_index_artifacts` tool is invoked with an artifact name, THE Souk_Compass SHALL read the artifact's `knowledge.md` content, generate an embedding from the combined frontmatter description and Markdown body, and upsert it into Solr
3. WHEN the `compass_index_artifacts` tool is invoked with `{"all": true}`, THE Souk_Compass SHALL index every artifact listed in `catalog.json`
4. THE Index_Document for each artifact SHALL contain: `id` (artifact name), `text` (description + body concatenated), `vector` (embedding), and metadata fields: `artifact_name`, `artifact_type`, `display_name`, `maturity`, `collection_names` (comma-joined), `keywords` (comma-joined), `author`, and `version`
5. THE embedding text for an artifact SHALL be constructed as `"{displayName}: {description}\n\n{body}"` where body is the Markdown content after frontmatter
6. WHEN an artifact that already exists in Solr is re-indexed, THE Souk_Compass SHALL overwrite the existing document using upsert semantics
7. THE `compass_index_artifacts` tool SHALL return a summary indicating how many artifacts were indexed and whether any errors occurred
8. IF Solr is unreachable during indexing, THEN THE `compass_index_artifacts` tool SHALL return an error message describing the connectivity failure rather than crashing the server

### Requirement 4: Semantic Search Tool

**User Story:** As a user, I want to search the bazaar's knowledge artifacts by meaning using natural language queries, so that I can discover relevant skills, powers, and workflows even when I do not know the exact keywords.

#### Acceptance Criteria

1. THE Souk_Compass MCP server SHALL expose a `compass_search` tool that performs semantic search over indexed artifacts
2. WHEN the `compass_search` tool is invoked with a query string, THE Souk_Compass SHALL embed the query text using the active Embedding_Provider, perform a kNN search against the Solr collection, and return matching artifacts with their relevance scores
3. THE `compass_search` tool SHALL accept a `topK` parameter (default: 5) controlling how many results to return
4. THE `compass_search` tool SHALL accept an optional `type` parameter that adds a Solr Filter_Query restricting results to a specific artifact type (skill, power, workflow, prompt, agent, template, reference-pack)
5. THE `compass_search` tool SHALL accept an optional `collection` parameter that adds a Solr Filter_Query restricting results to artifacts belonging to a specific bazaar collection
6. THE `compass_search` tool SHALL accept an optional `maturity` parameter that adds a Solr Filter_Query restricting results to artifacts with a specific maturity level (experimental, beta, stable, deprecated)
7. THE search results SHALL include for each match: artifact name, display name, type, relevance score, description, maturity, and collection memberships
8. IF no results match the query, THEN THE `compass_search` tool SHALL return a message indicating no semantically similar artifacts were found
9. IF Solr is unreachable, THEN THE `compass_search` tool SHALL return an error message describing the connectivity failure rather than crashing the server

### Requirement 5: User Document Collection Indexing

**User Story:** As a user, I want to index my own documents into Souk Compass so that I can perform semantic search over personal notes, project documentation, or reference materials alongside bazaar artifacts.

#### Acceptance Criteria

1. THE Souk_Compass MCP server SHALL expose a `compass_index_document` tool that indexes a user-provided document into a configurable Solr Document_Collection
2. THE `compass_index_document` tool SHALL accept parameters: `id` (unique document identifier), `text` (document content), and optional `metadata` (key-value pairs for filtering)
3. WHEN the `compass_index_document` tool is invoked, THE Souk_Compass SHALL generate an embedding for the provided text and upsert the document into the user document Solr collection
4. THE `compass_index_document` tool SHALL accept an optional `collection` parameter specifying which Solr Document_Collection to index into (default: the configured user document collection)
5. THE user document Index_Document SHALL contain: `id` (provided identifier), `text` (document content), `vector` (embedding), `doc_source` set to `"user"`, and any user-provided metadata fields prefixed with `metadata_`
6. THE `compass_search` tool SHALL accept an optional `scope` parameter with values `"artifacts"`, `"documents"`, or `"all"` (default: `"artifacts"`) to control whether the search queries the artifact collection, the user document collection, or both
7. IF Solr is unreachable during user document indexing, THEN THE `compass_index_document` tool SHALL return an error message describing the connectivity failure rather than crashing the server

### Requirement 6: MCP Server Setup

**User Story:** As a user, I want Souk Compass to run as an MCP server alongside the existing context-bazaar bridge, so that I can use semantic search tools directly from my AI coding assistant.

#### Acceptance Criteria

1. THE Souk_Compass SHALL be implemented as a standalone MCP server in `skill-forge/mcp-servers/souk-compass/` using the `@modelcontextprotocol/sdk` package with stdio transport
2. THE Souk_Compass MCP server SHALL register the following tools: `compass_setup`, `compass_index_artifacts`, `compass_search`, `compass_index_document`, `compass_status`, and `compass_health`
3. THE `compass_health` tool SHALL check connectivity to the configured Solr_Instance and report whether the instance is reachable and the configured collections exist
4. THE `compass_status` tool SHALL query Solr for the count of indexed documents in each configured collection and return the totals
5. THE Souk_Compass MCP server SHALL read `catalog.json` from the plugin root directory (resolved via `CLAUDE_PLUGIN_ROOT` environment variable or relative path) to discover available artifacts for indexing
6. THE Souk_Compass MCP server SHALL be compilable to a self-contained CJS bundle (similar to the existing `bridge/mcp-server.cjs`) for distribution with the Claude plugin
7. THE project's `.mcp.json` SHALL be updated to include the Souk Compass server entry alongside the existing context-bazaar bridge entry

### Requirement 7: Configuration

**User Story:** As a user, I want to configure Souk Compass connection details and embedding provider through environment variables, so that setup is consistent and works with both local and remote Solr instances.

#### Acceptance Criteria

1. THE Souk_Compass SHALL read the Solr base URL from the `SOUK_COMPASS_SOLR_URL` environment variable (default: `http://localhost:8983`)
2. THE Souk_Compass SHALL read the artifact Solr collection name from the `SOUK_COMPASS_SOLR_COLLECTION` environment variable (default: `context-bazaar`)
3. THE Souk_Compass SHALL read the user document Solr collection name from the `SOUK_COMPASS_USER_COLLECTION` environment variable (default: `context-bazaar-user-docs`)
4. THE Souk_Compass SHALL read the embedding provider identifier from the `SOUK_COMPASS_EMBED_PROVIDER` environment variable (default: `local`)
5. THE Souk_Compass SHALL read the embedding dimensions from the `SOUK_COMPASS_EMBED_DIMENSIONS` environment variable (default: `1024`)
6. THE configuration precedence SHALL be: environment variable value when set, otherwise the default value
7. THE Souk_Compass SHALL validate all configuration values at startup using a Zod schema and report clear error messages for invalid values to stderr
8. IF the Solr URL is not reachable at startup, THEN THE Souk_Compass SHALL start normally and report errors only when tools are invoked — Solr availability is not required for server startup

### Requirement 8: Solr Collection Schema

**User Story:** As a developer deploying Souk Compass, I want a documented Solr schema and setup instructions, so that I can provision the Solr collections correctly for both local development and production use.

#### Acceptance Criteria

1. THE project SHALL include a Solr schema definition file at `skill-forge/mcp-servers/souk-compass/solr/schema.xml` defining the required fields: `id` (string, unique key), `text` (text_general, stored, indexed), `vector` (DenseVectorField, 1024 dimensions, HNSW algorithm, cosine similarity), `artifact_name` (string, stored, indexed), `artifact_type` (string, stored, indexed), `display_name` (string, stored), `collection_names` (string, multiValued, stored, indexed), `keywords` (string, multiValued, stored, indexed), `maturity` (string, stored, indexed), `author` (string, stored, indexed), `version` (string, stored, indexed), `doc_source` (string, stored, indexed), and dynamic fields `metadata_*` (string, stored, indexed)
2. THE project SHALL include a `skill-forge/mcp-servers/souk-compass/solr/README.md` with setup instructions covering local Docker-based development using the official `solr:9` image and remote Solr deployment
3. THE schema SHALL define the vector field with HNSW parameters: `hnswMaxConnections=16` and `hnswBeamWidth=100` as sensible defaults
4. THE project SHALL include a `docker-compose.yml` in `skill-forge/mcp-servers/souk-compass/` that starts a local Solr 9.x instance with the schema pre-loaded for development use
5. THE schema SHALL support both the artifact collection and the user document collection using the same field definitions, differentiated by the `doc_source` field

### Requirement 9: Zod Schemas for Souk Compass Types

**User Story:** As a developer, I want all Souk Compass data shapes validated with Zod schemas, so that the module follows the project's convention of centralized schema-driven validation.

#### Acceptance Criteria

1. THE Souk_Compass SHALL define a `SoukCompassConfigSchema` using Zod that validates the Solr URL, artifact collection name, user document collection name, embedding provider identifier, and embedding dimensions
2. THE Souk_Compass SHALL define a `SolrDocumentSchema` using Zod that validates the shape of documents upserted to Solr, including id, text, vector, and all metadata fields
3. THE Souk_Compass SHALL define a `SearchResultSchema` using Zod that validates individual search results returned from Solr, including score, artifact name, display name, type, description, maturity, and collections
4. THE Souk_Compass SHALL define a `ToolInputSchemas` object containing Zod schemas for each MCP tool's input parameters (`compass_setup`, `compass_index_artifacts`, `compass_search`, `compass_index_document`, `compass_status`, `compass_health`)
5. ALL Zod schemas SHALL be co-located in `skill-forge/mcp-servers/souk-compass/src/schemas.ts` and export both the schema and the inferred TypeScript type

### Requirement 10: Error Handling and Graceful Degradation

**User Story:** As a user, I want Souk Compass to handle errors gracefully and never break the rest of context-bazaar, so that the semantic search capability is a safe optional enhancement.

#### Acceptance Criteria

1. THE Souk_Compass SHALL define a `SoukCompassError` class that extends `Error` with a `code` property for programmatic error identification
2. IF Solr returns an HTTP error response, THEN THE Souk_Compass SHALL include the HTTP status code and Solr error message in the `SoukCompassError`
3. IF the Embedding_Provider fails to generate an embedding, THEN THE Souk_Compass SHALL include the provider name and underlying error message in the `SoukCompassError`
4. WHEN an MCP tool invocation encounters a `SoukCompassError`, THE MCP server SHALL return the error as a tool result with `isError: true` and a human-readable description rather than crashing the server process
5. IF an unexpected error occurs during tool execution, THEN THE Souk_Compass SHALL catch the error, log it to stderr, and return a generic error message to the MCP client
6. THE Souk_Compass SHALL continue running after any tool-level error — individual tool failures SHALL NOT terminate the MCP server process
7. IF the Souk_Compass MCP server fails to start (e.g., invalid configuration), THEN the existing context-bazaar MCP bridge SHALL continue to function independently — the two servers have no runtime dependency on each other

### Requirement 11: Solr Document Serialization and Round-Trip

**User Story:** As a developer, I want to serialize and deserialize Souk Compass index documents to and from Solr's JSON format reliably, so that documents survive round-trip indexing and retrieval without data loss.

#### Acceptance Criteria

1. THE Souk_Compass SHALL provide a `toSolrDocument(entry: CatalogEntry, text: string, embedding: number[])` function that converts a catalog entry, its text content, and embedding into the Solr JSON document format expected by the upsert endpoint
2. THE Souk_Compass SHALL provide a `fromSolrDocument(doc: Record<string, unknown>)` function that parses a Solr response document back into a typed `SearchResult` object
3. FOR ALL valid CatalogEntry inputs with valid embeddings, converting to a Solr document via `toSolrDocument` and then parsing back via `fromSolrDocument` SHALL produce a `SearchResult` containing the same artifact name, type, description, maturity, and collection memberships as the original entry (round-trip property)
4. THE `toSolrDocument` function SHALL validate its output against the `SolrDocumentSchema` before returning
5. THE `fromSolrDocument` function SHALL validate its output against the `SearchResultSchema` and throw a `SoukCompassError` if the Solr response document is missing required fields
6. THE Souk_Compass SHALL provide a `toUserSolrDocument(id: string, text: string, embedding: number[], metadata?: Record<string, string>)` function that converts a user document into the Solr JSON format with `doc_source` set to `"user"`

### Requirement 12: Assisted Solr Setup

**User Story:** As a user, I want the AI assistant to help me set up a local Solr instance through a conversational flow, so that I can get Souk Compass running without leaving my editor or reading setup docs.

#### Acceptance Criteria

1. THE Souk_Compass MCP server SHALL expose a `compass_setup` tool that checks the current Solr environment and can provision a local instance
2. WHEN `compass_setup` is invoked with no arguments (or `{"action": "check"}`), THE tool SHALL check whether Docker is available, whether a Solr container is already running on the configured port, and whether the required collections exist, returning a structured status report
3. WHEN `compass_setup` is invoked with `{"action": "start"}`, THE tool SHALL execute `docker compose up -d` using the bundled `docker-compose.yml` to start a local Solr 9.x instance with the pre-configured schema
4. WHEN `compass_setup` is invoked with `{"action": "create_collections"}`, THE tool SHALL create the artifact and user document collections in the running Solr instance using the bundled schema configuration via the Solr Collections API
5. WHEN `compass_setup` is invoked with `{"action": "stop"}`, THE tool SHALL execute `docker compose down` to stop the local Solr instance
6. THE `compass_setup` status report SHALL include: Docker availability (boolean), Solr reachability (boolean), Solr URL checked, list of existing collections with document counts, and any missing collections that need to be created
7. IF Docker is not installed or not running, THEN THE `compass_setup` tool SHALL return a clear message suggesting the user install Docker Desktop and providing a link to the Docker installation page
8. IF the configured Solr port is already in use by a non-Solr process, THEN THE `compass_setup` tool SHALL report the conflict and suggest changing the `SOUK_COMPASS_SOLR_URL` port
9. THE `compass_setup` tool SHALL NOT require any arguments for the initial check — invoking it with an empty input SHALL default to the `check` action
10. ALL `compass_setup` actions SHALL return structured JSON results so the AI assistant can interpret the state and guide the user through next steps conversationally


### Requirement 13: Hybrid Search (BM25 + kNN)

**User Story:** As a user, I want to combine keyword-based text search with vector similarity search in a single query, so that results benefit from both exact keyword matches and semantic similarity for improved relevance.

#### Acceptance Criteria

1. THE `compass_search` tool SHALL accept a `mode` parameter with values `"vector"`, `"keyword"`, or `"hybrid"` (default: `"hybrid"`) that controls the search strategy
2. WHEN the `mode` is `"hybrid"`, THE `compass_search` tool SHALL combine BM25 text relevance scoring with kNN vector similarity using Solr's score boosting mechanism (combining the standard `q` parameter with `{!knn}` via boost query or re-ranking)
3. THE `compass_search` tool SHALL accept a `hybridWeight` parameter (float, 0.0 to 1.0, default: 0.5) that controls the balance between keyword and vector scores — 0.0 produces pure keyword scoring and 1.0 produces pure vector scoring
4. WHEN the `mode` is `"keyword"`, THE `compass_search` tool SHALL perform a standard Solr BM25 text search against the `text` field without generating an embedding for the query
5. WHEN the `mode` is `"vector"`, THE `compass_search` tool SHALL perform a pure kNN vector search using the embedded query, consistent with the existing search behavior
6. THE `compass_search` tool SHALL apply all existing filter parameters (`type`, `collection`, `maturity`, `scope`) consistently across all three search modes
7. THE Vector_Store_Client `search` method SHALL be extended to accept a `mode` parameter and a `hybridWeight` parameter, constructing the appropriate Solr query for each mode

### Requirement 14: Auto-Reindex on Build

**User Story:** As a user, I want Souk Compass to detect when catalog artifacts have changed and re-index only the changed artifacts, so that the search index stays fresh without redundant full re-indexing.

#### Acceptance Criteria

1. THE Souk_Compass MCP server SHALL expose a `compass_reindex` tool that compares the current `catalog.json` against the Solr index and re-indexes only changed or new artifacts
2. THE `compass_reindex` tool SHALL detect changes by comparing artifact version numbers and Content_Hash values between `catalog.json` entries and the corresponding Solr documents
3. WHEN an artifact is indexed, THE Souk_Compass SHALL store a `content_hash` metadata field in the Solr document containing the SHA-256 hash of the embedding text used to generate the artifact's embedding
4. THE `compass_reindex` tool SHALL return a structured summary containing counts for added, updated, unchanged, and removed artifacts
5. WHEN the `compass_reindex` tool is invoked with `{"force": true}`, THE tool SHALL re-index all artifacts in `catalog.json` regardless of change detection results
6. THE Solr schema SHALL include a `content_hash` field defined as a string type, stored and indexed

### Requirement 15: Chunk-Level Indexing

**User Story:** As a user, I want long knowledge artifacts to be split into smaller chunks and indexed separately, so that semantic search retrieves the most relevant section of a large document rather than matching the entire document as a single unit.

#### Acceptance Criteria

1. THE `compass_index_artifacts` tool SHALL accept an optional `chunked` parameter (boolean, default: false) that enables chunk-level indexing of artifact bodies
2. WHEN chunked indexing is enabled, THE Souk_Compass SHALL split the artifact body into Chunk segments at Markdown heading boundaries (`##` or `###`), with each Chunk inheriting the parent artifact's metadata fields
3. THE Souk_Compass SHALL assign each Chunk document an `id` of `"{artifact_name}__chunk_{N}"` where N is the zero-based chunk index
4. EACH Chunk document SHALL include a `chunk_index` metadata field (integer) and a `parent_artifact` metadata field (string) pointing to the original artifact name
5. IF a Chunk is shorter than a configurable minimum length (default: 50 characters), THEN THE Souk_Compass SHALL merge that Chunk with the subsequent Chunk
6. IF a Chunk exceeds the active Embedding_Provider's maximum token limit, THEN THE Souk_Compass SHALL further split that Chunk at paragraph boundaries
7. WHEN the `compass_search` tool returns results from chunked artifacts, THE search results SHALL include the `chunk_index` and `parent_artifact` fields for each chunked result
8. THE Solr schema SHALL include a `chunk_index` field (pint, stored, indexed) and a `parent_artifact` field (string, stored, indexed)

### Requirement 16: Search Result Snippets

**User Story:** As a user, I want search results to include a short text excerpt showing the relevant portion of the matched document, so that I can quickly assess result relevance without reading the full document.

#### Acceptance Criteria

1. THE `compass_search` tool SHALL return a `snippet` field for each search result containing a relevant text excerpt of up to 200 characters by default
2. WHEN the search `mode` is `"keyword"` or `"hybrid"`, THE Souk_Compass SHALL generate snippets using Solr's built-in highlighting feature (`hl=true`, `hl.fl=text`, `hl.snippets=1`)
3. WHEN the search `mode` is `"vector"`, THE Souk_Compass SHALL generate snippets by extracting the first characters of the document's `text` field up to the configured Snippet length, since Solr highlighting does not apply to vector-only queries
4. THE `compass_search` tool SHALL accept an optional `snippetLength` parameter (integer, default: 200) that controls the maximum character length of returned snippets
5. THE `SearchResultSchema` SHALL be updated to include an optional `snippet` field of type string

### Requirement 17: Embedding Cache with Persistent Storage

**User Story:** As a user, I want Souk Compass to cache embeddings across sessions and optionally share them with my team, so that re-indexing unchanged artifacts and repeated queries avoid redundant embedding API calls — even after restarting the MCP server or when colleagues work with the same Solr instance.

#### Acceptance Criteria

1. THE Souk_Compass SHALL implement a three-tier Embedding_Cache with lookup order: in-memory LRU → SQLite on-disk → Solr-as-cache, falling through to the Embedding_Provider only on a complete miss
2. THE in-memory tier SHALL be an LRU cache keyed by the SHA-256 Content_Hash of the input text, with a configurable maximum size (default: 1000 entries) controlled by the `SOUK_COMPASS_EMBED_CACHE_SIZE` environment variable
3. WHEN the in-memory cache exceeds its maximum size, THE Souk_Compass SHALL evict the least-recently-used entry (LRU eviction policy)
4. THE SQLite tier SHALL persist embeddings to a local SQLite database at a configurable path (default: `~/.souk-compass/embed-cache.db`) controlled by the `SOUK_COMPASS_CACHE_DB` environment variable, using Bun's built-in `bun:sqlite` module
5. THE SQLite database SHALL store records with columns: `content_hash` (TEXT PRIMARY KEY), `embedding` (BLOB — the float array serialized as a binary buffer), `provider_name` (TEXT), `dimensions` (INTEGER), `created_at` (TEXT — ISO 8601 timestamp)
6. WHEN an embedding is generated by the Embedding_Provider, THE Souk_Compass SHALL write it to both the in-memory cache and the SQLite database
7. THE Solr-as-cache tier SHALL check whether a Solr document with a matching `content_hash` field already exists in the configured collection, and if so, extract and return its `vector` field instead of calling the Embedding_Provider
8. THE Solr-as-cache tier SHALL be enabled by default when Solr is reachable, and silently skipped when Solr is unavailable — it SHALL NOT block or error if Solr is down
9. THE `SOUK_COMPASS_CACHE_TIERS` environment variable SHALL control which tiers are active, accepting a comma-separated list of `"memory"`, `"sqlite"`, `"solr"` (default: `"memory,sqlite,solr"`)
10. WHEN `embed()` or `batchEmbed()` is called, THE Souk_Compass SHALL check each active tier in order and return the first cache hit without consulting lower tiers or the Embedding_Provider
11. THE `compass_status` tool SHALL report Embedding_Cache statistics per tier: hit count, miss count, and current size (entry count for memory and SQLite, document count for Solr)
12. THE Embedding_Cache SHALL be transparent to the `EmbeddingProvider` interface — it wraps any concrete provider without changing the interface contract
13. IF the SQLite database file does not exist at startup, THE Souk_Compass SHALL create it automatically with the required schema
14. IF the SQLite database is corrupted or unreadable, THE Souk_Compass SHALL log a warning to stderr, skip the SQLite tier, and continue with the remaining tiers

### Requirement 18: Similarity Threshold

**User Story:** As a user, I want to set a minimum relevance score threshold for search results, so that low-relevance noise is filtered out and only meaningfully similar results are returned.

#### Acceptance Criteria

1. THE `compass_search` tool SHALL accept an optional `minScore` parameter (float, 0.0 to 1.0) that filters out results with a Solr score below the specified threshold
2. WHEN `minScore` is provided, THE `compass_search` tool SHALL exclude results whose score falls below the threshold value from the response
3. WHEN `minScore` is not provided and no global default is configured, THE `compass_search` tool SHALL return all top-k results regardless of score, preserving backward compatibility with existing behavior
4. THE `SoukCompassConfig` SHALL support a `SOUK_COMPASS_DEFAULT_MIN_SCORE` environment variable for setting a global default similarity threshold (default: unset, meaning no threshold is applied)
5. WHEN both the `minScore` tool parameter and the `SOUK_COMPASS_DEFAULT_MIN_SCORE` environment variable are set, THE tool parameter SHALL take precedence over the environment variable
6. THE similarity threshold filtering SHALL be applied client-side after Solr returns results, since Solr kNN queries do not natively support score thresholds

### Requirement 19: Cross-Tool Chaining with Catalog Bridge

**User Story:** As an AI assistant, I want Souk Compass search results to include enough metadata to seamlessly chain into the catalog bridge's `artifact_content` tool, so that I can discover artifacts semantically and then retrieve their full content in a single conversational flow without the user needing to know artifact names.

#### Acceptance Criteria

1. THE `compass_search` tool results SHALL include for each artifact match: `artifact_name` (the kebab-case name usable as input to `artifact_content`), `artifact_path` (the relative path to the artifact's `knowledge.md` file), `artifact_type`, `display_name`, `description`, `maturity`, `collections`, `relevance_score`, and `snippet`
2. THE `compass_search` result format SHALL be designed so that the AI assistant can directly pass the `artifact_name` field as the `name` parameter to the catalog bridge's `artifact_content` tool without transformation
3. WHEN `compass_search` returns results from chunked artifacts, THE result SHALL include the `parent_artifact` name (usable with `artifact_content`) in addition to the chunk-specific fields, so the assistant can retrieve the full parent artifact
4. THE `compass_search` tool description registered in the MCP server SHALL explicitly mention that result artifact names can be passed to `artifact_content` for full content retrieval, guiding the assistant toward the chaining pattern
5. THE `compass_search` tool SHALL accept an optional `includeContent` parameter (boolean, default: false) that, when true, reads and includes the full `knowledge.md` body inline in each result — enabling single-tool retrieval for simple use cases without requiring a second `artifact_content` call
6. WHEN `includeContent` is true and the result set exceeds 3 artifacts, THE tool SHALL truncate inline content to the first 500 characters per artifact and append a note suggesting the assistant use `artifact_content` for the full text, preventing oversized responses

### Requirement 20: Auto-Index Hook

**User Story:** As a user, I want the Souk Compass search index to stay synchronized with the catalog automatically after builds, so that I always search over the latest artifacts without manually triggering re-indexing.

#### Acceptance Criteria

1. THE project SHALL include a hook configuration file at `skill-forge/mcp-servers/souk-compass/hooks/auto-reindex.json` that triggers `compass_reindex` after `forge build` completes
2. THE hook SHALL be configured as a `postToolUse` hook that fires after the `forge build` shell command completes, invoking `compass_reindex` via an `askAgent` action with the prompt "The catalog has been rebuilt. Run compass_reindex to update the semantic search index."
3. THE hook SHALL only trigger when the build command exits successfully (exit code 0)
4. THE `compass_reindex` tool (from Requirement 14) SHALL serve as the hook's target, using content-hash change detection to re-index only changed artifacts
5. IF Solr is not running when the hook fires, THE `compass_reindex` tool SHALL return a non-fatal error message and the hook SHALL NOT block subsequent operations
6. THE hook configuration SHALL be documented in the `solr/README.md` setup instructions, explaining how to enable or disable automatic re-indexing

### Requirement 21: Claude Code Plugin Bundling

**User Story:** As a Claude Code user, I want to install Souk Compass as part of the context-bazaar plugin with a single install, so that semantic search is available alongside catalog browsing without separate setup steps.

#### Acceptance Criteria

1. THE Souk Compass MCP server SHALL be bundled into the existing context-bazaar Claude Code plugin by adding its server entry to the root `.mcp.json` file alongside the existing `context-bazaar` bridge entry
2. THE `.claude-plugin/plugin.json` SHALL be updated to include Souk Compass in its `keywords` array (adding `"semantic-search"`, `"vector-search"`, `"solr"`, `"embeddings"`) and update the `description` to mention semantic search capabilities
3. THE `.claude-plugin/marketplace.json` SHALL be updated to add `"semantic-search"`, `"vector-search"`, `"solr"` to the plugin's `tags` array and update the plugin `description` to mention Souk Compass semantic search
4. THE Souk Compass MCP server CJS bundle SHALL be built and placed at `skill-forge/mcp-servers/souk-compass/dist/mcp-server.cjs` as part of the project's build process, alongside the existing `bridge/mcp-server.cjs`
5. THE `.mcp.json` Souk Compass entry SHALL include sensible default environment variables (`SOUK_COMPASS_SOLR_URL`, `SOUK_COMPASS_SOLR_COLLECTION`, `SOUK_COMPASS_EMBED_PROVIDER`) so the plugin works with a local Solr instance out of the box
6. IF Solr is not available when the plugin loads, THE Souk Compass MCP server SHALL start normally and return helpful error messages when tools are invoked, explaining that Solr setup is required and suggesting `compass_setup` as the first step
7. THE `compass_setup` tool SHALL detect whether it is running inside a Claude Code plugin context (via `CLAUDE_PLUGIN_ROOT` environment variable) and resolve paths to the bundled `docker-compose.yml` and `schema.xml` relative to the plugin root
8. THE plugin SHALL NOT require Solr to be running for the catalog bridge tools (`catalog_list`, `artifact_content`, `collection_list`) to function — the two MCP servers are independent processes with no shared state at runtime

### Requirement 22: Contextual Skill Recall

**User Story:** As an AI assistant, I want a tool that suggests relevant skills and workflows based on the current working context, so that I can proactively recommend useful artifacts to the user without them needing to search explicitly.

#### Acceptance Criteria

1. THE Souk_Compass MCP server SHALL expose a `compass_recall` tool that accepts a context description and returns the most relevant knowledge artifacts for that context
2. THE `compass_recall` tool SHALL accept a `context` parameter (string) describing the current working situation — this may include the task being performed, file types being edited, technologies in use, or any other contextual information the assistant deems relevant
3. THE `compass_recall` tool SHALL embed the context string using the active Embedding_Provider and perform a semantic search against the artifact collection, returning the top matches
4. THE `compass_recall` tool SHALL accept an optional `topK` parameter (default: 3) — a lower default than `compass_search` since recall results are proactive suggestions, not explicit search results
5. THE `compass_recall` tool SHALL accept an optional `minScore` parameter (default: 0.6) — a higher default threshold than `compass_search` to ensure only strongly relevant artifacts are suggested proactively
6. THE `compass_recall` results SHALL include for each match: `artifact_name`, `display_name`, `type`, `relevance_score`, `description`, and a `rationale` field containing a one-sentence explanation of why this artifact is relevant to the provided context (generated by concatenating the artifact's description with its keyword matches against the context)
7. THE `compass_recall` tool SHALL filter out artifacts the assistant has already recommended in the current session by accepting an optional `exclude` parameter (array of artifact names to skip)
8. THE `compass_recall` tool description registered in the MCP server SHALL instruct the assistant to call this tool proactively when starting new tasks, switching contexts, or when the user asks for help with a workflow — not only when the user explicitly asks for artifact recommendations
9. IF no artifacts score above the `minScore` threshold, THE `compass_recall` tool SHALL return an empty result set rather than low-relevance suggestions
10. IF Solr is unreachable, THE `compass_recall` tool SHALL return an error message describing the connectivity failure rather than crashing the server

### Requirement 23: Plugin-Level Memory Persistence

**User Story:** As an AI assistant using the Claude Code plugin, I want to persist observations, user preferences, and contextual notes across sessions, so that I can recall what worked before and provide increasingly personalized recommendations over time.

#### Acceptance Criteria

1. THE Souk_Compass MCP server SHALL expose a `compass_remember` tool that indexes a Memory_Note into the user document collection for cross-session recall
2. THE `compass_remember` tool SHALL accept parameters: `note` (string — the observation or preference to remember), `category` (string — one of `"preference"`, `"convention"`, `"recommendation"`, `"observation"`, `"workflow"`), and optional `tags` (array of strings for filtering)
3. THE Memory_Note Index_Document SHALL contain: `id` (auto-generated UUID), `text` (the note content), `vector` (embedding of the note), `doc_source` set to `"memory"`, and metadata fields: `metadata_category` (the category), `metadata_tags` (comma-joined tags), `metadata_created_at` (ISO 8601 timestamp), `metadata_session_id` (current session identifier if available)
4. THE Souk_Compass MCP server SHALL expose a `compass_recall_memory` tool that performs semantic search over previously stored Memory_Notes
5. THE `compass_recall_memory` tool SHALL accept a `query` parameter (string) and optional `category` filter, `tags` filter, and `topK` parameter (default: 5)
6. THE `compass_recall_memory` tool SHALL search only documents with `doc_source: "memory"` in the user document collection, using the same embedding + kNN pipeline as `compass_search`
7. THE `compass_remember` tool description SHALL instruct the assistant to call it when it discovers user preferences (e.g., "user prefers verbose commit messages"), project conventions (e.g., "this project uses Biome not ESLint"), successful workflow patterns (e.g., "user liked combining commit-craft with review-ritual for PRs"), or any observation worth recalling in future sessions
8. THE `compass_recall_memory` tool description SHALL instruct the assistant to call it at the start of new sessions or when switching to a new task context, to retrieve relevant past observations
9. WHEN the `compass_recall_memory` tool returns results, EACH result SHALL include the note text, category, tags, creation timestamp, and relevance score
10. THE Memory_Notes SHALL persist in the same Solr user document collection as user-indexed documents, differentiated by the `doc_source: "memory"` field, and benefit from the same three-tier embedding cache
11. THE `compass_status` tool SHALL report the count of Memory_Notes (documents with `doc_source: "memory"`) alongside other collection statistics

### Requirement 24: Workspace-Aware Skill Matching

**User Story:** As an AI assistant, I want to analyze the user's workspace and match it against the artifact catalog, so that I can recommend skills and workflows that are specifically relevant to the technologies, patterns, and structure of the current project.

#### Acceptance Criteria

1. THE Souk_Compass MCP server SHALL expose a `compass_profile_workspace` tool that analyzes the current workspace and generates a Workspace_Profile for skill matching
2. THE `compass_profile_workspace` tool SHALL accept a `files` parameter (array of objects with `path` and `content` fields) representing key workspace files to analyze — the assistant is responsible for selecting which files to include (e.g., `package.json`, `tsconfig.json`, `.eslintrc`, `Dockerfile`, `README.md`)
3. THE `compass_profile_workspace` tool SHALL generate a workspace description string by extracting: project name, detected languages/frameworks (from package.json dependencies, file extensions), build tools (from scripts, config files), detected patterns (monorepo structure, test framework, CI/CD config), and any explicit technology mentions
4. THE `compass_profile_workspace` tool SHALL embed the workspace description and perform a semantic search against the artifact collection, returning artifacts whose content is most relevant to the workspace's technology stack and patterns
5. THE `compass_profile_workspace` tool SHALL accept an optional `topK` parameter (default: 10) and an optional `minScore` parameter (default: 0.4) — a lower threshold than `compass_recall` since workspace matching is broader
6. THE `compass_profile_workspace` results SHALL include for each match: `artifact_name`, `display_name`, `type`, `relevance_score`, `description`, and a `match_reason` field indicating which workspace characteristics triggered the match (e.g., `"TypeScript project with Biome linter"`)
7. THE `compass_profile_workspace` tool SHALL optionally store the Workspace_Profile as a Memory_Note (with category `"workspace_profile"`) so it can be recalled in future sessions without re-analyzing the workspace
8. THE `compass_profile_workspace` tool description SHALL instruct the assistant to call it when first entering a new workspace, when the user asks "what skills would help with this project?", or when significant project configuration changes are detected
9. IF the `files` parameter is empty or contains no analyzable content, THE tool SHALL return a message suggesting which files the assistant should include (e.g., "Include package.json, tsconfig.json, or other config files for better workspace analysis")
10. THE workspace description generation SHALL be deterministic — the same set of input files SHALL always produce the same description string, enabling content-hash-based caching of the workspace embedding
