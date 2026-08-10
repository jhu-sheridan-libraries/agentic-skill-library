# Solr Compass

Solr Compass is a Bun-powered MCP server for Apache Solr-backed semantic search, codebase retrieval, and cross-session memory.

## Requirements

- Bun 1.3.14 or later
- Docker Desktop for the bundled local SolrCloud environment

## Kiro MCP configuration

Pin the package version so MCP startup is reproducible:

```json
{
  "mcpServers": {
    "solr-compass": {
      "command": "bunx",
      "args": ["--bun", "@stevenjmiklovic/solrcompass@0.1.0"]
    }
  }
}
```

On first use, call the idempotent initializer:

```text
compass_setup { "action": "initialize" }
```

It downloads the pinned `solr:10.0.0` and `zookeeper:3.9.3` images when absent, starts the local containers, uploads the bundled configset, and creates the configured collections. Later calls return without changing an already-ready environment.

## Content root

Docker Compose and the Solr configset resolve from the installed package. Catalog artifact indexing resolves `catalog.json` and `knowledge/` separately in this order:

1. `SOUK_COMPASS_CONTENT_ROOT`
2. `${CLAUDE_PLUGIN_ROOT}/kanon`
3. The current directory when named `kanon`, otherwise its `kanon/` child

Codebase search, user documents, and memory do not require catalog content.

## Tenants

Records belong to a **tenant**: `personal` for you, one entry per org you share
an index with. With no configuration there is exactly one — `personal` — using
the same collection names as before, so an existing index needs no migration.

Declare orgs in `~/.souk-compass/tenants.json` (or `SOUK_COMPASS_TENANTS`):

```json
{
  "tenants": [
    { "id": "acme", "scope": "org" },
    { "id": "upstream", "scope": "org", "access": "read" }
  ]
}
```

Each tenant owns its own Solr collections, so backup, replication, and Solr's
per-collection authorization apply per tenant rather than to one shared pile. A
tenant may live on a different SolrCloud; reads federate across clusters.

```text
compass_tenants       { "verify": true }
compass_remember      { "note": "...", "category": "convention", "tenant": "acme" }
compass_recall_memory { "query": "...", "tenants": "all" }
```

When a personal record and an org record disagree, the higher-precedence one
wins — personal by default — and the other comes back as `shadowed` rather than
disappearing.

## Memory records

A note has an identity and a lifecycle, not just an insertion point:

- Restating something already recorded is a no-op; a changed statement becomes
  the next revision and marks the previous one `superseded`, retained.
- `compass_forget` marks a record `retracted` rather than deleting it.
- `validFrom` / `validUntil` bound when a record was true;
  `compass_recall_memory { asOf }` asks what was believed at a past instant.
- Observations and decisions lose ranking weight with age; conventions,
  preferences, constraints, and workflows do not, and `pinned` records never do.

## Snapshots — save, tear down, rebuild, restore

```text
compass_backup { "action": "save", "snapshotId": "2026-08-08" }
```

```bash
docker compose down -v          # index, ZooKeeper, all cluster state gone
```

```text
compass_setup  { "action": "start" }
compass_backup { "action": "restore", "snapshotId": "2026-08-08" }
compass_backup { "action": "verify",  "snapshotId": "2026-08-08" }
```

Use `start` rather than `initialize` before a restore: both start the stack and
upload the configset, but `initialize` also creates the collections, and Solr
restores only into a collection that does not exist.

This works because snapshots live in a **host directory**
(`~/.souk-compass/backups`), not a Docker volume — `down -v` removes every named
volume, so a snapshot kept in one would be destroyed by the command it exists to
survive.

Each tenant names a Solr backup repository, which is the storage backend. A
personal tenant uses the local filesystem repository and needs no credentials. An
org tenant declares a bucket and Solr streams directly to it:

```json
{
  "tenants": [
    {
      "id": "acme",
      "scope": "org",
      "backup": { "s3": { "bucket": "acme-solr-backups", "region": "us-east-1" } }
    }
  ]
}
```

Credentials never appear in the registry — Solr uses the AWS credential chain
from its own container. `compass_setup` generates `solr.xml` from the registry,
so no XML is hand-edited; restart Solr after changing a repository.

Since embeddings already run on Bedrock, selecting the platform selects both:

```bash
export SOUK_COMPASS_PLATFORM=aws        # Bedrock embeddings + S3 org snapshots
export SOUK_COMPASS_REGION=us-east-1    # one region for all of it
export SOUK_COMPASS_S3_BUCKET=org-snapshots
```

Defaults only — explicit settings still win — and the personal tenant stays on
local disk so the credential-free teardown-and-rebuild path keeps working.
Switching an existing install changes the embedding model, so reindex afterwards.

A snapshot carries a manifest recording the tenant→collection mapping, the
registry, the embedding model, and the document counts. That is what lets a
*different* machine restore, and what lets `verify` check that a restore actually
recovered the documents rather than merely creating collections. Restoring a
snapshot built with a different embedding model is refused: it would produce an
index that answers every query and ranks by nothing.

## Durability

`SOUK_COMPASS_REPLICATION_FACTOR`, `_NUM_SHARDS`, `_TLOG_REPLICAS`, and
`_PULL_REPLICAS` set collection topology at creation — `numShards` cannot be
changed afterwards. `compass_status` compares live replica counts against what
was requested and reports `underReplicated`.

Replication survives a node failing; it does not survive a bad reindex or a
mistaken delete, both of which replicate faithfully. Code can be reindexed from
source afterwards; memory cannot, which is why snapshots exist.

See [`solr/README.md`](./solr/README.md) for the full configuration reference,
[ADR-0056](../../docs/adr/0056-tenant-scoped-durable-memory-records.md) for the
memory model and [ADR-0057](../../docs/adr/0057-backup-repositories-as-storage-backends.md)
for the backup design.

## Development

Run commands from this directory:

```bash
bun install --frozen-lockfile
bun test
bun run typecheck
bun run lint
bun run build
npm pack --dry-run
```

Publishing is a separate release action and requires npm authentication and explicit confirmation.

## License

MIT
