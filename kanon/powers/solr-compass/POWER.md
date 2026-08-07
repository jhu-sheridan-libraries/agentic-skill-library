---
name: SolrCompass
displayName: Solr Compass
description: Solr-backed semantic search, codebase retrieval, and cross-session memory for context bazaar knowledge artifacts through a guided MCP workflow.
keywords: ["context compass","apache solr","semantic search","vector retrieval","codebase indexing","mcp memory"]
author: JHU Sheridan Libraries
---
<!-- forge:version 0.1.2 -->

# Solr Compass

## Overview

Solr Compass is a standalone MCP server that adds Apache Solr-backed semantic retrieval to context-bazaar. It indexes canonical knowledge artifacts, user documents, and source trees into separate collections, then searches them with vector, BM25 keyword, or hybrid ranking.

Use this power when a task needs meaning-based artifact discovery, semantic code search, workspace-aware recommendations, or durable memory notes. Solr Compass is independent of the context-bazaar catalog bridge: use Compass to discover relevant artifacts, then use `artifact_content` from the catalog bridge when full canonical content is needed.

The default embedding provider is local and requires no cloud credentials. An optional Amazon Titan provider is available for users with AWS credentials and Bedrock model access.

## Activation Bootstrap

Whenever this power is activated for a task that needs Compass tools:

1. The MCP configuration launches the exact package `@stevenjmiklovic/solrcompass@0.1.0` with `bunx --bun`. On first use, explain that Bun may download the package and its dependencies; subsequent launches use Bun's cache.
2. Call `compass_setup` with action `check` before any search, indexing, recall, or memory operation.
3. If Solr is reachable and all configured collections exist, continue immediately without changing the environment.
4. If Docker is unavailable, explain that Docker Desktop is required, provide `https://www.docker.com/products/docker-desktop/`, and wait for the user to install and start it. Do not attempt an unrelated package-manager installation.
5. If Solr is unreachable or collections are missing, tell the user in one sentence that initialization may download the pinned `solr:10.0.0` and `zookeeper:3.9.3` images, start local containers, upload the configset, and create persistent local collections. Unless the user declines, call:

   ```text
   compass_setup { "action": "initialize" }
   ```

6. If initialization succeeds, continue with the requested Compass workflow. Do not ask the user to run separate Docker or collection commands.
7. If initialization fails, use the structured `error`, `start`, `collections`, and `status` fields to explain the specific remedy. Retry only after the reported prerequisite or conflict is resolved.

The `initialize` action is idempotent. On later activations it returns immediately with `changed: false` when Solr and all three collections are already ready.

## Safety and Operating Rules

- Announce first-run package and container downloads before they occur; proceed unless the user declines.
- Ask before stopping Docker containers, clearing indexed content, force-reindexing, or deleting Docker volumes.
- Treat `compass_remember` as durable storage. Do not store credentials, tokens, private keys, passwords, regulated personal data, or other secrets.
- Scope codebase searches with `root` when more than one repository is indexed.
- Use `compass_reindex` and `compass_reindex_folder` for incremental updates; use forced or clearing operations only when necessary.
- After changing embedding providers, fully reindex every collection. Vectors from different models are not comparable.

## Onboarding

### Prerequisites

- Bun 1.0 or later on `PATH`
- Docker Desktop for the bundled local SolrCloud environment; activation detects when it is unavailable

No context-bazaar checkout, package installation, or absolute MCP server path is required. Kiro launches the version-pinned npm package through `bunx --bun`.

The local provider downloads its embedding model on first use and can take longer to initialize during the first MCP connection.

### Optional Content Root

Package assets and catalog content resolve independently. Solr Compass always locates its bundled Docker Compose and configset files from the installed npm package.

Artifact indexing expects a Kanon content directory containing `catalog.json` and `knowledge/`. Resolution order is:

1. `SOUK_COMPASS_CONTENT_ROOT`, when explicitly configured
2. `${CLAUDE_PLUGIN_ROOT}/kanon` in a Claude plugin installation
3. `kanon/` under the MCP process working directory, or the working directory itself when it is already named `kanon`

Set `SOUK_COMPASS_CONTENT_ROOT` only when the catalog lives elsewhere. Document and codebase search do not require a context-bazaar catalog.

### Initialize Local Solr

Activation performs the normal first-run flow automatically:

```text
compass_setup { "action": "check" }
compass_setup { "action": "initialize" }
```

`initialize` uses Docker Compose to download `solr:10.0.0` and `zookeeper:3.9.3` when absent, start Solr in single-node SolrCloud mode, upload the bundled `souk-compass` configset, create all three configured collections, and return final readiness status:

- `context-bazaar` for knowledge artifacts
- `context-bazaar-user-docs` for user documents and memory notes
- `context-bazaar-codebase` for indexed source trees

Manual Docker and lower-level `start` or `create_collections` actions are troubleshooting fallbacks, not normal onboarding steps.

## Common Workflows

### Discover and Read Knowledge Artifacts

1. Index all artifacts after generating `catalog.json`:

   ```text
   compass_index_artifacts { "all": true, "chunked": true }
   ```

2. Search using hybrid ranking:

   ```text
   compass_search {
     "query": "How should a TypeScript CLI validate YAML configuration?",
     "scope": "artifacts",
     "mode": "hybrid",
     "topK": 5
   }
   ```

3. Use the returned `artifact_name` with the context-bazaar bridge's `artifact_content` tool to load the full artifact.

4. After artifacts change, update only changed records:

   ```text
   compass_reindex { "force": false }
   ```

Use `includeContent: true` only when inline full content is useful; metadata-only search results keep tool output smaller.

### Search User Documents

Index a document with a stable unique identifier:

```text
compass_index_document {
  "id": "architecture-notes-2026-08",
  "text": "The service isolates indexing from catalog retrieval...",
  "metadata": {
    "project": "context-bazaar",
    "kind": "architecture-notes"
  }
}
```

Search documents only:

```text
compass_search {
  "query": "Why is semantic indexing a separate service?",
  "scope": "documents",
  "mode": "hybrid",
  "topK": 5
}
```

Use `scope: "all"` when both canonical artifacts and user documents may answer the question.

### Index and Search a Codebase

Index a repository with an explicit path:

```text
compass_index_folder {
  "path": "/absolute/path/to/repository",
  "chunked": true
}
```

Search only that repository:

```text
compass_search_codebase {
  "query": "Where does the build pipeline dispatch harness adapters?",
  "root": "/absolute/path/to/repository",
  "mode": "hybrid",
  "topK": 10
}
```

Incrementally synchronize it later:

```text
compass_reindex_folder {
  "path": "/absolute/path/to/repository"
}
```

Default exclusions cover dependency, VCS, dist, build, and lock files. Add `include`, `exclude`, or `maxFileSize` only when the defaults do not fit the repository.

For hard isolation, create and name a dedicated collection:

```text
compass_setup { "action": "create_collection", "name": "codebase-my-service" }
compass_index_folder {
  "path": "/absolute/path/to/my-service",
  "collection": "codebase-my-service"
}
```

The collection must exist before indexing; Souk Compass will not silently create a misspelled collection.

### Recall Relevant Guidance

At the start of a substantial task or after a context switch:

```text
compass_recall {
  "context": "Adding a Kiro harness adapter to a Bun TypeScript CLI",
  "topK": 3,
  "minScore": 0.6
}
```

Use the returned artifact names to load only the relevant guidance. Pass already-used names through `exclude` to avoid repetitive suggestions.

### Store and Recall Memory

Persist a non-sensitive project convention:

```text
compass_remember {
  "note": "This repository runs build, validation, and tests with Bun from the kanon directory.",
  "category": "convention",
  "tags": ["context-bazaar", "bun"]
}
```

Recall it in a later session:

```text
compass_recall_memory {
  "query": "How does this repository run validation?",
  "tags": ["context-bazaar"],
  "topK": 5
}
```

Memory notes share the user-document collection and persist as long as that Solr data volume exists.

### Profile a Workspace

Send only small, representative configuration files rather than the entire workspace:

```text
compass_profile_workspace {
  "files": [
    {
      "path": "package.json",
      "content": "{\"type\":\"module\",\"scripts\":{\"test\":\"bun test\"}}"
    },
    {
      "path": "tsconfig.json",
      "content": "{\"compilerOptions\":{\"strict\":true}}"
    }
  ],
  "topK": 5,
  "persist": false
}
```

Set `persist: true` only after confirming the selected file content contains no secrets or sensitive values.

## Tool Reference

### Environment and Status

| Tool | Purpose | Mutates state |
|---|---|---|
| `compass_setup` | Check, start, stop, and provision local Solr collections | Depending on action |
| `compass_health` | Check Solr connectivity and required collections | No |
| `compass_status` | Report counts, indexed roots, and embedding-provider consistency | No |

### Artifact and Document Retrieval

| Tool | Purpose | Mutates state |
|---|---|---|
| `compass_index_artifacts` | Index one or all catalog artifacts | Yes |
| `compass_search` | Search artifacts, user documents, or both | No |
| `compass_index_document` | Store a user-provided document | Yes |
| `compass_reindex` | Incrementally synchronize catalog artifacts | Yes |

### Codebase Retrieval

| Tool | Purpose | Mutates state |
|---|---|---|
| `compass_index_folder` | Index and chunk source files under one root | Yes |
| `compass_search_codebase` | Search indexed source with path and root filters | No |
| `compass_reindex_folder` | Incrementally synchronize one indexed root | Yes |

### Recall and Memory

| Tool | Purpose | Mutates state |
|---|---|---|
| `compass_recall` | Find artifacts relevant to the current task context | No |
| `compass_remember` | Persist a categorized memory note | Yes |
| `compass_recall_memory` | Search durable memory notes | No |
| `compass_profile_workspace` | Match representative workspace files to artifacts | Only with `persist: true` |

## Embedding Providers

### Local Provider

`SOUK_COMPASS_EMBED_PROVIDER=local` is the default. It uses `Xenova/all-MiniLM-L6-v2` on CPU, pads its native 384 dimensions to the 1024-dimension schema, and needs no external credentials. Keep chunks concise because the model has a 512-token input ceiling.

### Amazon Titan

Set `SOUK_COMPASS_EMBED_PROVIDER=bedrock-titan` to use `amazon.titan-embed-text-v2:0`. This requires AWS credentials, `AWS_REGION`, and Bedrock model access. Titan produces native 1024-dimensional vectors and supports longer input.

Changing providers requires a full reindex of artifact, document, memory, and codebase collections. Run `compass_status` afterward and confirm there is no `providerMismatch` and no untagged content.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `SOUK_COMPASS_SOLR_URL` | `http://localhost:8983` | Solr base URL |
| `SOUK_COMPASS_SOLR_COLLECTION` | `context-bazaar` | Artifact collection |
| `SOUK_COMPASS_USER_COLLECTION` | `context-bazaar-user-docs` | User document and memory collection |
| `SOUK_COMPASS_CODEBASE_COLLECTION` | `context-bazaar-codebase` | Codebase collection |
| `SOUK_COMPASS_EMBED_PROVIDER` | `local` | `local` or `bedrock-titan` |
| `SOUK_COMPASS_EMBED_DIMENSIONS` | `1024` | Vector dimensions; must match the schema |
| `SOUK_COMPASS_CACHE_TIERS` | `memory,sqlite,solr` | Embedding cache lookup order |
| `SOUK_COMPASS_CACHE_DB` | `~/.souk-compass/embed-cache.db` | SQLite cache path |
| `SOUK_COMPASS_EMBED_CACHE_SIZE` | `1000` | In-memory cache entry count |
| `SOUK_COMPASS_DEFAULT_MIN_SCORE` | unset | Optional default similarity floor from 0 to 1 |
| `SOUK_COMPASS_EF_SEARCH_SCALE` | `1.0` | HNSW candidate multiplier |
| `SOUK_COMPASS_FILTERED_SEARCH_THRESHOLD` | unset | Optional ACORN threshold from 0 to 100 |

For a remote SolrCloud deployment, change the URL and collection variables, ensure the `souk-compass` configset is installed, and preserve the 1024-dimension schema.

## MCP Launch

Kiro launches the exact npm package through the generated MCP configuration:

```text
bunx --bun @stevenjmiklovic/solrcompass@0.1.0
```

No source checkout, absolute server path, or package installation is required. Reconnect the server from Kiro's MCP Server view after changing its environment configuration.

## Troubleshooting

### MCP Server Does Not Connect

1. Confirm Bun is available with `bun --version`.
2. Run the configured command directly:

   ```bash
   bunx --bun @stevenjmiklovic/solrcompass@0.1.0
   ```

3. Reconnect the server from Kiro's MCP Server view and inspect its logs.

A successfully running stdio MCP server normally waits without printing user-facing output. Stop the direct diagnostic process with Control-C.

### Docker or Solr Is Unavailable

- Start Docker Desktop and wait for `docker info` to succeed.
- Run `compass_setup` with action `check` to distinguish Docker, Solr, and missing-collection failures.
- If port 8983 is occupied, stop the conflicting service or point `SOUK_COMPASS_SOLR_URL` at the intended Solr instance.
- Run `docker compose ps` from `kanon/mcp-servers/souk-compass/` to inspect container state.

### Collections Are Missing

Run:

```text
compass_setup { "action": "create_collections" }
```

If collection creation reports a missing configset, run `compass_setup` with action `start` again or upload the configset manually before retrying.

### Vector or Hybrid Search Returns HTTP 414

The bundled Compose file raises Jetty's request-header limit to 65536 bytes because a 1024-dimension kNN vector exceeds Jetty's default URI limit. Apply the equivalent `-Dsolr.jetty.request.header.size=65536` setting to any external Solr deployment.

### Search Results Are Empty or Irrelevant

- Confirm the intended collection has documents with `compass_status`.
- Remove or lower `minScore` while diagnosing.
- Compare `keyword`, `vector`, and `hybrid` modes.
- Confirm `root`, `path`, type, collection, and maturity filters are not over-restrictive.
- Check `providerMismatch`; if present, restore the original provider or fully reindex with the current provider.

### Schema Changes Do Not Appear

Re-upload the configset and reload the affected collections. A changed vector dimension or similarity function requires deleting and fully rebuilding indexed vectors, not just reloading the collection.

### Local Embeddings Miss the End of Long Content

The local model truncates after 512 tokens. Enable chunking when indexing artifacts and codebases, shorten user documents, or use the Titan provider for longer input.

## Shutdown and Data Removal

Stop the local containers without deleting indexed data:

```text
compass_setup { "action": "stop" }
```

To remove persisted Solr and ZooKeeper data, run this manually from the Souk Compass package directory only after explicit confirmation:

```bash
docker compose down -v
```

The `-v` operation is destructive and removes indexed artifacts, documents, codebase content, and memory notes stored in the local Docker volumes.
