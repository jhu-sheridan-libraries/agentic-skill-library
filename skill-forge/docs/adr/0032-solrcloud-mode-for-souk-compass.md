# ADR-0032: SolrCloud Mode for Souk Compass Local Development

## Status

Accepted

## Date

2026-04-24

## Context

ADR-031 established Souk Compass as a standalone MCP server backed by Apache Solr 9.x, with a bundled `docker-compose.yml` for local development. The initial implementation ran Solr in standalone mode using `solr-precreate` to create a single core at container startup.

This approach had a critical limitation: the `compass_setup` tool's `create_collections` action uses the Solr Collections API (`/solr/admin/collections?action=CREATE`), which requires SolrCloud mode. In standalone mode, collections must be created via the Cores API (`/solr/admin/cores?action=CREATE`), which has a different parameter surface and does not support configset references. This meant the `compass_setup` tool could not programmatically create collections, forcing manual `docker exec` workarounds.

Additionally, the standalone health check (`/solr/admin/cores?action=STATUS`) returns core names like `context-bazaar` directly, but SolrCloud uses shard-qualified names like `context-bazaar_shard1_replica_n1`, breaking collection existence checks.

## Decision Drivers

- The `compass_setup` tool must be able to create and manage collections programmatically via the Collections API
- Schema management should use configsets uploaded to ZooKeeper, enabling consistent schema application across collections
- The health check must work reliably in both standalone and SolrCloud deployments
- Local development overhead should remain minimal (single `docker compose up -d`)

## Decision

Run Solr in SolrCloud mode with a single node, backed by a ZooKeeper instance, for both local development and as the reference deployment topology.

### Key Changes

1. **SolrCloud with ZooKeeper** — `docker-compose.yml` defines two services: `solr` (Solr 9 with `ZK_HOST=zoo:2181`) and `zoo` (ZooKeeper 3.9 with a health check). Solr depends on ZooKeeper being healthy before starting.

2. **Configset-based schema management** — The custom schema and solrconfig live in `solr/configset/conf/` and are volume-mounted into the Solr container. On startup, the `compass_setup start` action uploads the configset to ZooKeeper via `solr zk upconfig`. Collections reference it by name (`collection.configName=souk-compass`).

3. **SolrCloud-compatible schema** — The schema includes required SolrCloud internal fields (`_version_` as `plong`, `_root_` as `string`, `_nest_path_`) with explicit `multiValued="false"` to satisfy SolrCloud's validation requirements.

4. **Ping-based health check** — `SoukVectorClient.health()` uses `/solr/{collection}/admin/ping` instead of the Cores API. This works in both standalone and SolrCloud modes and directly verifies the target collection is responsive.

5. **Collections API for provisioning** — `compass_setup create_collections` uses `/solr/admin/collections?action=CREATE` with `collection.configName=souk-compass`, `numShards=1`, and `replicationFactor=1`.

## Considered Options

1. **Stay with standalone mode** — Keep `solr-precreate` and add a Cores API fallback in `compass_setup`. Simpler Docker setup (no ZooKeeper), but the tool would need two code paths for collection management and couldn't use configsets.

2. **SolrCloud with embedded ZooKeeper** — Solr supports an embedded ZK mode (`-DzkRun`), eliminating the separate container. However, embedded ZK is deprecated in Solr 9.x and not recommended for any use.

3. **SolrCloud with external ZooKeeper (chosen)** — Separate ZooKeeper container with health checks. Adds one container but provides the standard SolrCloud experience, configset management, and Collections API support.

## Consequences

### Positive

- `compass_setup create_collections` works out of the box — no fallback code paths needed
- Schema changes are applied consistently via configset upload, not filesystem hacks
- Health checks are mode-agnostic (ping works everywhere)
- The local topology mirrors production SolrCloud deployments
- Future scaling (multiple shards, replicas) requires only parameter changes

### Negative

- Local development now requires two containers (Solr + ZooKeeper) instead of one
- Startup is slightly slower due to ZooKeeper health check (~6s)
- First-time setup requires a configset upload step before collections can be created
- ZooKeeper adds ~50MB memory overhead

## Links and References

- Extends: [ADR-031](./0031-souk-compass-standalone-mcp-server-for-semantic-search.md) (Souk Compass architecture)
- Implementation: `skill-forge/mcp-servers/souk-compass/docker-compose.yml`
- Configset: `skill-forge/mcp-servers/souk-compass/solr/configset/conf/`
