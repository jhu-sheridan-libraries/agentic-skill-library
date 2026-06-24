# Requirements Document

## Introduction

This feature adds a Solr-backed semantic search capability to the context-bazaar, exposed as a Claude Code MCP server called the **Divining Rod**. The Divining Rod lets Claude Code users semantically search the bazaar's knowledge artifact catalog — finding relevant skills, powers, workflows, and prompts by meaning rather than keyword matching. It indexes artifact content into Apache Solr 9.x using dense vector embeddings, then serves kNN search results through MCP tools that integrate naturally alongside the existing `catalog_list` / `artifact_content` / `collection_list` tools.

The Divining Rod runs as a standalone MCP server in `skill-forge/mcp-servers/divining-rod/`, separate from the existing catalog bridge. It connects to a local or remote Solr instance, generates embeddings via Amazon Bedrock Titan Embeddings (1024-dimensional vectors), and provides tools for indexing artifacts and performing semantic queries. Configuration follows the project's existing pattern: environment variables with sensible defaults.

## Glossary

- **Divining_Rod**: The MCP server that provides Solr-backed semantic search over context-bazaar knowledge artifacts
- **Solr_Instance**: An Apache Solr 9.x server with Dense Vector Search support (DenseVectorField with HNSW indexing), either local or remote
- **Vector_Store_Client**: The TypeScript client class that handles document upsert, kNN queries, health checks, and deletion against a Solr instance
- **Embedding**: A fixed-length float array (1024 dimensions for Titan Embed V2) representing the semantic content of a text passage
- **Embedding_Provider**: The module responsible for generating embeddings from text, using Amazon Bedrock Titan Embeddings as the default provider
- **kNN_Query**: A k-nearest-neighbors query against Solr's DenseVectorField, returning the top-k most semantically similar documents
- **Knowledge_Artifact**: A canonical source file in `knowledge/<name>/knowledge.md` containing YAML frontmatter and Markdown body, as defined by the existing `KnowledgeArtifactSchema`
- **Catalog_Entry**: A record in `catalog.json` representing a parsed artifact's metadata, as defined by the existing `CatalogEntrySchema`
- **MCP_Server**: A Model Context Protocol server that exposes tools to Claude Code via stdio transport
- **Index_Document**: A Solr document containing an artifact's text content, embedding vector, and metadata fields
- **Filter_Query**: A Solr filter query (fq parameter) used to restrict search results by metadata fields
- **Collection**: A Solr collection (logical index) that holds indexed artifact documents with text, metadata, and vector fields

## Requirements

### Requirement 1: Solr Vector Store Client

**User Story:** As a developer, I want a reusable TypeScript client for Solr vector operations, so that the Divining Rod MCP server can index and query artifact embeddings against any Solr 9.x instance.

#### Acceptance Criteria

1. THE Divining_Rod SHALL provide a `SolrVectorClient` class in `solr-client.ts` that accepts a Solr base URL and collection name
2. THE `SolrVectorClient` SHALL implement an `upsert(docId: string, text: string, embedding: number[], metadata: Record<string, string>)` method that indexes a document with its text content, embedding vector, and metadata fields into the Solr collection
3. THE `SolrVectorClient` SHALL implement a `search(queryEmbedding: number[], topK: number, filterQuery?: string)` method that performs a kNN query against the collection's vector field and returns the top-k most similar documents with their scores, text, and metadata
4. THE `SolrVectorClient` SHALL implement a `delete(docId: string)` method that removes a document from the collection by ID
5. THE `SolrVectorClient` SHALL implement a `health()` method that checks connectivity to the Solr instance and returns a boolean indicating whether the instance is reachable and the configured collection exists
6. THE `SolrVectorClient` SHALL use the Fetch API for HTTP communication with the Solr JSON API
7. IF a Solr request fails due to a connection error, HTTP error, or malformed response, THEN THE `SolrVectorClient` SHALL throw a `DiviningRodError` with a descriptive message including the HTTP status code and Solr error body when available
8. THE `search` method SHALL support an optional `filterQuery` parameter that passes a Solr filter query (fq) to restrict results by metadata fields
9. THE `SolrVectorClient` SHALL commit documents on upsert by default, with an optional `commit` parameter set to `false` for batch operations followed by an explicit `commit()` call
10. THE `SolrVectorClient` SHALL expect the Solr collection schema to contain at minimum: `id` (string, unique key), `text` (text_general, stored), `vector` (DenseVectorField, 1024 dimensions, HNSW algorithm, cosine similarity), `artifact_name` (string, stored, indexed), `artifact_type` (string, stored, indexed), `collection_names` (string, multiValued, stored, indexed), and `maturity` (string, stored, indexed)

### Requirement 2: Embedding Generation

**User Story:** As a developer, I want a module that generates text embeddings using Amazon Bedrock Titan, so that artifact content can be converted to vectors for indexing and semantic querying.

#### Acceptance Criteria

1. THE Divining_Rod SHALL provide an `embed(text: string, config: EmbedConfig)` function in `embeddings.ts` that generates an embedding vector from input text using the Bedrock Titan Embeddings model
2. THE `embed` function SHALL use the `amazon.titan-embed-text-v2:0` model via the Bedrock Runtime `InvokeModel` API
3. THE `embed` function SHALL return an array of numbers representing the 1024-dimensional embedding vector
4. THE `embed` function SHALL accept an `EmbedConfig` object containing the AWS region and optional credentials configuration
5. IF the Bedrock invocation fails, THEN THE `embed` function SHALL throw a `DiviningRodError` with a descriptive error message including the underlying AWS error
6. THE `embed` function SHALL accept an optional `dimensions` parameter (default: 1024) to support future model variants
7. IF input text exceeds the model's maximum token limit (8192 tokens for Titan V2), THEN THE `embed` function SHALL truncate the input by taking the first portion that fits rather than throwing an error
8. THE Divining_Rod SHALL provide a `batchEmbed(texts: string[], config: EmbedConfig)` function that generates embeddings for multiple texts, reusing the same Bedrock client instance for efficiency
9. THE `EmbedConfig` schema SHALL be defined using Zod in a `schemas.ts` file within the Divining Rod module

### Requirement 3: Artifact Indexing

**User Story:** As a Claude Code user, I want the Divining Rod to index knowledge artifacts from the bazaar catalog into Solr, so that I can later search them semantically.

#### Acceptance Criteria

1. THE Divining_Rod MCP server SHALL expose an `artifact_index` tool that indexes one or more knowledge artifacts into the configured Solr collection
2. WHEN the `artifact_index` tool is invoked with an artifact name, THE Divining_Rod SHALL read the artifact's `knowledge.md` content, generate an embedding from the combined frontmatter description and Markdown body, and upsert it into Solr
3. WHEN the `artifact_index` tool is invoked with `{"all": true}`, THE Divining_Rod SHALL index every artifact listed in `catalog.json`
4. THE Index_Document for each artifact SHALL contain: `id` (artifact name), `text` (description + body concatenated), `vector` (embedding), and metadata fields: `artifact_name`, `artifact_type`, `maturity`, `collection_names` (comma-joined), `keywords` (comma-joined), `author`, and `version`
5. THE embedding text for an artifact SHALL be constructed as `"{displayName}: {description}\n\n{body}"` where body is the Markdown content after frontmatter
6. WHEN an artifact that already exists in Solr is re-indexed, THE Divining_Rod SHALL overwrite the existing document (upsert semantics)
7. THE `artifact_index` tool SHALL return a summary indicating how many artifacts were indexed and whether any errors occurred
8. IF Solr is unreachable during indexing, THEN THE `artifact_index` tool SHALL return an error message describing the connectivity failure

### Requirement 4: Semantic Search Tool

**User Story:** As a Claude Code user, I want to search the bazaar's knowledge artifacts by meaning using natural language queries, so that I can discover relevant skills, powers, and workflows even when I don't know the exact keywords.

#### Acceptance Criteria

1. THE Divining_Rod MCP server SHALL expose an `artifact_search` tool that performs semantic search over indexed artifacts
2. WHEN the `artifact_search` tool is invoked with a query string, THE Divining_Rod SHALL embed the query text, perform a kNN search against the Solr collection, and return matching artifacts with their relevance scores
3. THE `artifact_search` tool SHALL accept a `topK` parameter (default: 5) controlling how many results to return
4. THE `artifact_search` tool SHALL accept an optional `type` parameter that adds a Solr filter query restricting results to a specific artifact type (skill, power, workflow, prompt, agent, template, reference-pack)
5. THE `artifact_search` tool SHALL accept an optional `collection` parameter that adds a Solr filter query restricting results to artifacts belonging to a specific collection
6. THE `artifact_search` tool SHALL accept an optional `maturity` parameter that adds a Solr filter query restricting results to artifacts with a specific maturity level (experimental, beta, stable, deprecated)
7. THE search results SHALL include for each match: artifact name, display name, type, relevance score, description, maturity, and collection memberships
8. IF no results match the query, THEN THE `artifact_search` tool SHALL return a message indicating no semantically similar artifacts were found
9. IF Solr is unreachable, THEN THE `artifact_search` tool SHALL return an error message describing the connectivity failure

### Requirement 5: MCP Server Setup

**User Story:** As a Claude Code user, I want the Divining Rod to run as an MCP server alongside the existing context-bazaar bridge, so that I can use semantic search tools directly from my assistant.

#### Acceptance Criteria

1. THE Divining_Rod SHALL be implemented as a standalone MCP server in `skill-forge/mcp-servers/divining-rod/` using the `@modelcontextprotocol/sdk` package with stdio transport
2. THE Divining_Rod MCP server SHALL register the following tools: `artifact_index`, `artifact_search`, `index_status`, and `solr_health`
3. THE `solr_health` tool SHALL check connectivity to the configured Solr instance and report whether the instance is reachable and the collection exists
4. THE `index_status` tool SHALL query Solr for the count of indexed documents and return the total number of artifacts currently in the index
5. THE Divining_Rod MCP server SHALL read `catalog.json` from the plugin root directory (resolved via `CLAUDE_PLUGIN_ROOT` environment variable or relative path) to discover available artifacts
6. THE Divining_Rod MCP server SHALL be compilable to a self-contained CJS bundle (similar to the existing `bridge/mcp-server.cjs`) for distribution with the Claude plugin
7. THE project's `.mcp.json` SHALL be updated to include the Divining Rod server entry alongside the existing context-bazaar bridge entry

### Requirement 6: Configuration

**User Story:** As a user, I want to configure the Divining Rod's Solr connection and embedding settings through environment variables, so that setup is consistent and works with both local and remote Solr instances.

#### Acceptance Criteria

1. THE Divining_Rod SHALL read the Solr base URL from the `DIVINING_ROD_SOLR_URL` environment variable (default: `http://localhost:8983`)
2. THE Divining_Rod SHALL read the Solr collection name from the `DIVINING_ROD_SOLR_COLLECTION` environment variable (default: `context-bazaar`)
3. THE Divining_Rod SHALL read the AWS region for Bedrock from the `DIVINING_ROD_AWS_REGION` environment variable (default: `us-east-1`)
4. THE Divining_Rod SHALL read the embedding model ID from the `DIVINING_ROD_EMBED_MODEL` environment variable (default: `amazon.titan-embed-text-v2:0`)
5. THE Divining_Rod SHALL read the embedding dimensions from the `DIVINING_ROD_EMBED_DIMENSIONS` environment variable (default: `1024`)
6. THE configuration precedence SHALL be: environment variable value when set, otherwise the default value
7. THE Divining_Rod SHALL validate all configuration values at startup using a Zod schema and report clear error messages for invalid values
8. IF the Solr URL is not reachable at startup, THEN THE Divining_Rod SHALL start normally and report errors only when tools are invoked — Solr availability is not required for server startup

### Requirement 7: Solr Collection Schema

**User Story:** As a developer deploying the Divining Rod, I want a documented Solr schema and setup instructions, so that I can provision the Solr collection correctly for both local development and production use.

#### Acceptance Criteria

1. THE project SHALL include a Solr schema definition file at `skill-forge/mcp-servers/divining-rod/solr/schema.xml` defining the required fields: `id` (string, unique key), `text` (text_general, stored, indexed), `vector` (DenseVectorField, 1024 dimensions, HNSW algorithm, cosine similarity), `artifact_name` (string, stored, indexed), `artifact_type` (string, stored, indexed), `collection_names` (string, multiValued, stored, indexed), `keywords` (string, multiValued, stored, indexed), `maturity` (string, stored, indexed), `author` (string, stored, indexed), and `version` (string, stored, indexed)
2. THE project SHALL include a `skill-forge/mcp-servers/divining-rod/solr/README.md` with setup instructions covering local Docker-based development using the official `solr:9` image and remote Solr deployment
3. THE schema SHALL define the vector field with HNSW parameters: `hnswMaxConnections=16` and `hnswBeamWidth=100` as defaults
4. THE project SHALL include a `docker-compose.yml` in `skill-forge/mcp-servers/divining-rod/` that starts a local Solr 9.x instance with the schema pre-loaded for development use

### Requirement 8: Zod Schemas for Divining Rod Types

**User Story:** As a developer, I want all Divining Rod data shapes validated with Zod schemas, so that the module follows the project's convention of centralized schema-driven validation.

#### Acceptance Criteria

1. THE Divining_Rod SHALL define a `DiviningRodConfigSchema` using Zod that validates the Solr URL, collection name, AWS region, embedding model ID, and embedding dimensions
2. THE Divining_Rod SHALL define a `SolrDocumentSchema` using Zod that validates the shape of documents upserted to Solr, including id, text, vector, and all metadata fields
3. THE Divining_Rod SHALL define a `SearchResultSchema` using Zod that validates individual search results returned from Solr, including score, artifact name, display name, type, description, maturity, and collections
4. THE Divining_Rod SHALL define an `EmbedConfigSchema` using Zod that validates the embedding provider configuration (region, model ID, dimensions)
5. THE Divining_Rod SHALL define a `ToolInputSchemas` object containing Zod schemas for each MCP tool's input parameters (`artifact_index`, `artifact_search`, `index_status`, `solr_health`)
6. ALL Zod schemas SHALL be co-located in `skill-forge/mcp-servers/divining-rod/src/schemas.ts` and export both the schema and the inferred TypeScript type

### Requirement 9: Error Handling

**User Story:** As a Claude Code user, I want the Divining Rod to handle errors gracefully and return informative messages, so that I understand what went wrong when a search or indexing operation fails.

#### Acceptance Criteria

1. THE Divining_Rod SHALL define a `DiviningRodError` class that extends `Error` with a `code` property for programmatic error identification
2. IF Solr returns an HTTP error response, THEN THE Divining_Rod SHALL include the HTTP status code and Solr error message in the `DiviningRodError`
3. IF the Bedrock embedding call fails, THEN THE Divining_Rod SHALL include the AWS error type and message in the `DiviningRodError`
4. WHEN an MCP tool invocation encounters a `DiviningRodError`, THE MCP server SHALL return the error as a tool result with `isError: true` and a human-readable description rather than crashing the server process
5. IF an unexpected error occurs during tool execution, THEN THE Divining_Rod SHALL catch the error, log it to stderr, and return a generic error message to the MCP client
6. THE Divining_Rod SHALL continue running after any tool-level error — individual tool failures SHALL NOT terminate the MCP server process

### Requirement 10: Pretty-Printer and Round-Trip for Solr Documents

**User Story:** As a developer, I want to serialize Divining Rod index documents to and from Solr's JSON format reliably, so that documents survive round-trip indexing and retrieval without data loss.

#### Acceptance Criteria

1. THE Divining_Rod SHALL provide a `toSolrDocument(artifact: CatalogEntry, text: string, embedding: number[])` function that converts a catalog entry, its text content, and embedding into the Solr JSON document format expected by the upsert endpoint
2. THE Divining_Rod SHALL provide a `fromSolrDocument(doc: Record<string, unknown>)` function that parses a Solr response document back into a typed `SearchResult` object
3. FOR ALL valid CatalogEntry inputs with valid embeddings, converting to a Solr document via `toSolrDocument` and then parsing back via `fromSolrDocument` SHALL produce a `SearchResult` containing the same artifact name, type, description, maturity, and collection memberships as the original entry (round-trip property)
4. THE `toSolrDocument` function SHALL validate its output against the `SolrDocumentSchema` before returning
5. THE `fromSolrDocument` function SHALL validate its output against the `SearchResultSchema` and throw a `DiviningRodError` if the Solr response document is missing required fields
