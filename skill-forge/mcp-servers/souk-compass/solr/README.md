# Souk Compass — Solr Setup

Local and remote Solr setup for the Souk Compass semantic search server.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

## Architecture

Souk Compass runs Solr 9 in **SolrCloud mode** (single node) backed by ZooKeeper. This enables the Collections API for programmatic collection management via the `compass_setup` MCP tool.

Components:
- **souk-compass-solr** — Solr 9 in SolrCloud mode (port 8983)
- **souk-compass-zoo** — ZooKeeper 3.9 for cluster coordination (port 2181)

## Quick Start

From the `skill-forge/mcp-servers/souk-compass/` directory:

```bash
# Start SolrCloud + ZooKeeper
docker compose up -d

# Upload the souk-compass configset to ZooKeeper
docker exec souk-compass-solr solr zk upconfig \
  -n souk-compass \
  -d /opt/solr/server/solr/configsets/souk-compass/conf \
  -z zoo:2181

# Create collections (via MCP tool or curl)
compass_setup { "action": "create_collections" }
```

Or create collections manually:

```bash
curl "http://localhost:8983/solr/admin/collections?action=CREATE&name=context-bazaar&numShards=1&replicationFactor=1&collection.configName=souk-compass&wt=json"
curl "http://localhost:8983/solr/admin/collections?action=CREATE&name=context-bazaar-user-docs&numShards=1&replicationFactor=1&collection.configName=souk-compass&wt=json"
```

Verify it's running:

```bash
curl "http://localhost:8983/solr/admin/info/system?wt=json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('mode'))"
# Should print: solrcloud
```

## Automated Setup

The `compass_setup` MCP tool handles the full lifecycle:

```
compass_setup { "action": "start" }              # Start containers + upload configset
compass_setup { "action": "create_collections" }  # Create both collections
compass_setup { "action": "check" }               # Verify status
compass_setup { "action": "stop" }                # Stop containers
```

The `start` action automatically uploads the `souk-compass` configset to ZooKeeper after the containers are healthy.

## Configset

The custom schema lives in `solr/configset/conf/`:
- `schema.xml` — Field definitions including the 1024-dim dense vector field
- `solrconfig.xml` — Solr configuration (autocommit, request handlers)

A copy of `schema.xml` is also kept at `solr/schema.xml` for reference.

The configset is mounted into the Solr container and uploaded to ZooKeeper on startup. Collections reference it by name (`souk-compass`) via the `collection.configName` parameter.

## Stopping Solr

```bash
docker compose down
```

To remove persisted data as well:

```bash
docker compose down -v
```

## Remote Solr Deployment

For production or shared team use, point Souk Compass at a remote SolrCloud instance by setting environment variables:

```bash
export SOUK_COMPASS_SOLR_URL=https://solr.example.com:8983
export SOUK_COMPASS_SOLR_COLLECTION=context-bazaar
export SOUK_COMPASS_USER_COLLECTION=context-bazaar-user-docs
```

Ensure the remote Solr instance has:
1. The `souk-compass` configset uploaded
2. Both collections created with `collection.configName=souk-compass`
3. Dense vector search enabled (Solr 9.x+)
4. Network access from the machine running the MCP server

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SOUK_COMPASS_SOLR_URL` | `http://localhost:8983` | Solr base URL |
| `SOUK_COMPASS_SOLR_COLLECTION` | `context-bazaar` | Artifact collection name |
| `SOUK_COMPASS_USER_COLLECTION` | `context-bazaar-user-docs` | User document collection name |
| `SOUK_COMPASS_EMBED_PROVIDER` | `local` | Embedding provider (`local`, `bedrock-titan`) |
| `SOUK_COMPASS_EMBED_DIMENSIONS` | `1024` | Embedding vector dimensions |

## Auto-Reindex Hook

Souk Compass includes a `postToolUse` hook at `hooks/auto-reindex.json` that automatically triggers `compass_reindex` after shell commands complete (e.g., `forge build`). This keeps the Solr index synchronized with the catalog without manual intervention.

### How It Works

1. After any shell tool execution completes, the hook fires an `askAgent` action.
2. The agent is prompted to run `compass_reindex`, which uses content-hash change detection to re-index only artifacts that have been added, updated, or removed.
3. Unchanged artifacts are skipped — no redundant embedding generation or Solr writes.

### Enabling / Disabling

The hook is active by default when the plugin is installed. To disable automatic re-indexing:

- Remove or rename `hooks/auto-reindex.json`
- Or set the hook's `eventType` to an unused value

### Behavior When Solr Is Unavailable

If Solr is not running when the hook fires, `compass_reindex` returns a non-fatal error message. The hook does not block subsequent operations — the build process and other tools continue to function normally. The index can be updated later by running `compass_reindex` manually once Solr is available.
