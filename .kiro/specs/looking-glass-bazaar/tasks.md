# Implementation Plan: Gnomon — Solr-Backed Semantic Search MCP Server

## Overview

Incremental implementation of the Gnomon MCP server at `kanon/mcp-servers/gnomon/`. The plan starts with foundational types and schemas, builds outward through the Solr client, embedding module, and serialization layer, then wires everything into MCP tool handlers. Property-based tests validate correctness properties alongside each component.

## Tasks

- [ ] 1. Project scaffolding and core types
  - [ ] 1.1 Create project structure and package.json
    - Create `kanon/mcp-servers/gnomon/` directory with `src/`, `src/__tests__/`, `solr/`
    - Initialize `package.json` with Bun scripts, dependencies (`@modelcontextprotocol/sdk`, `zod`, `@aws-sdk/client-bedrock-runtime`), devDependencies (`fast-check`, `@types/bun`, `typescript`)
    - Create `tsconfig.json` (ESNext, strict, bundler resolution, ESM)
    - _Requirements: 5.1, 5.6_

  - [ ] 1.2 Implement GnomonError class (`src/errors.ts`)
    - Define `ErrorCodes` const object with all error code strings
    - Implement `GnomonError` extending `Error` with `code`, optional `httpStatus`, `solrMessage`
    - Export `ErrorCode` type
    - _Requirements: 9.1, 9.2, 9.3_

  - [ ] 1.3 Implement Zod schemas (`src/schemas.ts`)
    - Define `GnomonConfigSchema`, `EmbedConfigSchema`, `SolrDocumentSchema`, `SearchResultSchema`
    - Define `ToolInputSchemas` object with schemas for all four MCP tools
    - Export inferred TypeScript types for each schema
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 1.4 Write unit tests for schemas
    - Test schema acceptance of valid inputs and rejection of invalid inputs
    - Test default values apply correctly
    - Test multiValued fields accept both string and array forms
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 2. Configuration module
  - [ ] 2.1 Implement configuration loader (`src/config.ts`)
    - Read `GNOMON_*` environment variables
    - Strip `undefined` entries before Zod parsing so defaults apply
    - Validate with `GnomonConfigSchema`, throw descriptive error on failure
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ]* 2.2 Write property test for configuration resolution
    - **Property 6: Configuration Resolution**
    - Generate random subsets of env vars with valid/invalid values
    - Verify set vars produce parsed values, unset vars produce defaults, invalid vars throw
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**

  - [ ]* 2.3 Write unit tests for config loader
    - Test all defaults apply when no env vars set
    - Test each env var overrides its default
    - Test invalid URL throws with field name in message
    - Test non-numeric dimensions throws
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

- [ ] 3. Serialization layer
  - [ ] 3.1 Implement serialization module (`src/serialization.ts`)
    - Implement `buildEmbeddingText(displayName, description, body)` returning `"{displayName}: {description}\n\n{body}"`
    - Implement `toSolrDocument(entry, text, embedding)` converting CatalogEntry to validated SolrDocument
    - Implement `fromSolrDocument(doc)` parsing Solr response into validated SearchResult, throwing GnomonError on missing fields
    - _Requirements: 3.5, 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 3.2 Write property tests for serialization
    - **Property 1: Serialization Round-Trip** — generate random CatalogEntry + embedding, verify round-trip preserves artifactName, type, maturity, collections
    - **Property 2: toSolrDocument Produces Schema-Valid Documents** — verify output passes SolrDocumentSchema.parse()
    - **Property 3: fromSolrDocument Rejects Incomplete Documents** — generate docs with missing required fields, verify GnomonError with SERIALIZATION code
    - **Property 4: Embedding Text Format** — generate random strings, verify format `"{displayName}: {description}\n\n{body}"`
    - **Validates: Requirements 10.3, 1.10, 3.4, 10.1, 10.4, 10.5, 3.5**

  - [ ]* 3.3 Write unit tests for serialization
    - Test specific catalog entries serialize correctly
    - Test fromSolrDocument with a known Solr response
    - Test buildEmbeddingText concatenation
    - _Requirements: 10.1, 10.2, 10.3_

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Solr vector client
  - [ ] 5.1 Implement SolrVectorClient (`src/solr-client.ts`)
    - Constructor accepting baseUrl and collection name
    - Implement `upsert()` using Fetch API POST to `/solr/{collection}/update/json/docs` with optional commit
    - Implement `search()` using kNN query syntax with optional filter query (fq)
    - Implement `delete()` using Solr delete-by-id
    - Implement `health()` checking Solr admin status and collection existence
    - Implement `commit()` for explicit commit after batch ops
    - Implement `count()` querying numFound with `*:*`
    - Wrap HTTP errors in GnomonError with SOLR_CONNECTION or SOLR_HTTP codes
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

  - [ ]* 5.2 Write property test for filter query construction
    - **Property 5: Filter Parameters in Solr Queries**
    - Generate random subsets of {type, collection, maturity} filters
    - Verify constructed filter string contains correct clauses for present params and no clauses for absent ones
    - **Validates: Requirements 1.8, 4.4, 4.5, 4.6**

  - [ ]* 5.3 Write unit tests for SolrVectorClient
    - Mock fetch for upsert (verify JSON payload, commit param, URL)
    - Mock fetch for search (verify kNN query syntax, fq parameter)
    - Mock fetch for delete (verify delete-by-id payload)
    - Mock fetch for health (verify admin endpoint check)
    - Test error wrapping for connection failures and HTTP errors
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [ ] 6. Embedding module
  - [ ] 6.1 Implement embedding functions (`src/embeddings.ts`)
    - Implement `embed(text, config)` using BedrockRuntimeClient InvokeModel
    - Implement `batchEmbed(texts, config)` reusing client instance
    - Truncation: approximate token count as `text.length / 4`, truncate to 32768 chars if exceeded
    - Wrap Bedrock failures in GnomonError with EMBED_FAILURE code including AWS error details
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [ ]* 6.2 Write property test for input truncation
    - **Property 8: Input Truncation for Embeddings**
    - Generate strings of varying lengths (0 to 100K chars)
    - Verify embed() does not throw due to input length (mock Bedrock to succeed)
    - **Validates: Requirements 2.7**

  - [ ]* 6.3 Write unit tests for embeddings
    - Mock BedrockRuntimeClient for successful invocation
    - Verify model ID and dimensions passed correctly
    - Test truncation triggers at >32768 chars
    - Test Bedrock failure wraps as GnomonError with EMBED_FAILURE
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [ ] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. MCP server and tool handlers
  - [ ] 8.1 Implement MCP server entry point (`src/index.ts`)
    - Create MCP Server with name "gnomon", version "0.1.0"
    - Load and validate config at startup (fatal on invalid config, graceful on Solr unavailable)
    - Register tools: `artifact_index`, `artifact_search`, `index_status`, `solr_health`
    - Connect via StdioServerTransport
    - Each tool handler: validate input with Zod, execute logic, catch errors and return isError responses
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.8, 9.4, 9.5, 9.6_

  - [ ] 8.2 Implement `artifact_index` tool handler
    - Read catalog.json from plugin root (CLAUDE_PLUGIN_ROOT or relative path)
    - Index single artifact by name or all artifacts with `{all: true}`
    - Read knowledge.md, build embedding text, generate embedding, upsert to Solr
    - Return summary with indexed count and error details for partial failures
    - Return only error message on complete failure or Solr unreachable
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

  - [ ] 8.3 Implement `artifact_search` tool handler
    - Embed query text, perform kNN search with topK
    - Build filter query from optional type, collection, maturity params
    - Parse results via fromSolrDocument, return SearchResult array
    - Return "no results" message when empty, error on Solr unreachable
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_

  - [ ] 8.4 Implement `index_status` and `solr_health` tool handlers
    - `index_status`: query Solr for document count, return total
    - `solr_health`: call SolrVectorClient.health(), report connectivity and collection status
    - _Requirements: 5.3, 5.4_

  - [ ]* 8.5 Write property test for MCP error resilience
    - **Property 7: MCP Error Resilience**
    - Generate random error types (GnomonError, TypeError, generic Error) thrown in tool handlers
    - Verify tool returns isError: true with text description and server remains running
    - **Validates: Requirements 9.4, 9.6**

  - [ ]* 8.6 Write unit tests for MCP server
    - Test tool registration (all four tools listed)
    - Test artifact_index with mocked dependencies (success, partial failure, complete failure)
    - Test artifact_search with mocked embedding and Solr (results, no results, Solr down)
    - Test index_status and solr_health with mocked client
    - Test error handling returns isError: true without crashing
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 9.4, 9.5, 9.6_

- [ ] 9. Solr schema and Docker setup
  - [ ] 9.1 Create Solr schema definition (`solr/schema.xml`)
    - Define all fields: id, text, vector (DenseVectorField, 1024 dims, HNSW, cosine), artifact_name, artifact_type, collection_names (multiValued), keywords (multiValued), maturity, author, version
    - Set HNSW defaults: hnswMaxConnections=16, hnswBeamWidth=100
    - _Requirements: 7.1, 7.3_

  - [ ] 9.2 Create docker-compose.yml and setup docs
    - docker-compose.yml starting Solr 10 with schema pre-loaded
    - `solr/README.md` with setup instructions for local Docker dev and remote deployment
    - _Requirements: 7.2, 7.4_

- [ ] 10. Integration wiring and bundle
  - [ ] 10.1 Create CJS bundle build script
    - Add build script to package.json compiling to `dist/mcp-server.cjs` (self-contained CJS bundle)
    - Verify bundle runs standalone with `node dist/mcp-server.cjs`
    - _Requirements: 5.6_

  - [ ] 10.2 Update `.mcp.json` with Gnomon server entry
    - Add gnomon entry alongside existing context-bazaar bridge
    - Configure command, args, and default env vars
    - _Requirements: 5.7_

- [ ] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (8 properties total)
- Unit tests validate specific examples and edge cases
- The Solr schema and Docker setup (task 9) can proceed in parallel with MCP server implementation
- All code uses TypeScript with Bun runtime, Zod v4 for validation, and fast-check for property tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "2.1", "3.1", "9.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "3.2", "3.3", "9.2"] },
    { "id": 4, "tasks": ["5.1", "6.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "6.2", "6.3"] },
    { "id": 6, "tasks": ["8.1"] },
    { "id": 7, "tasks": ["8.2", "8.3", "8.4"] },
    { "id": 8, "tasks": ["8.5", "8.6", "10.1", "10.2"] }
  ]
}
```
