# Souk Compass — Solr Setup

Local and remote Solr setup for the Souk Compass semantic search server.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

## Architecture

Souk Compass runs Solr 10 in **SolrCloud mode** (single node) backed by ZooKeeper. This enables the Collections API for programmatic collection management via the `compass_setup` MCP tool.

Components:
- **souk-compass-solr** — Solr 10 in SolrCloud mode (port 8983)
- **souk-compass-zoo** — ZooKeeper 3.9 for cluster coordination (port 2181)

## Quick Start

From the `kanon/mcp-servers/souk-compass/` directory:

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

Or create collections manually — there are three (see
[ADR 0035](../../../docs/adr/0035-codebase-indexing-as-separate-collection.md)
for why codebase content is kept separate):

```bash
for c in context-bazaar context-bazaar-user-docs context-bazaar-codebase; do
  curl "http://localhost:8983/solr/admin/collections?action=CREATE&name=$c&numShards=1&replicationFactor=1&collection.configName=souk-compass&wt=json"
done
```

Verify it's running:

```bash
curl "http://localhost:8983/solr/admin/info/system?wt=json" | python3 -c "import sys,json; print(json.load(sys.stdin).get('mode'))"
# Should print: solrcloud
```

## Automated Setup

The `compass_setup` MCP tool handles the full lifecycle. For first use, prefer the idempotent one-call initializer:

```
compass_setup { "action": "initialize" }          # Pull images if absent, start containers, upload configset, create collections, verify readiness
compass_setup { "action": "check" }               # Verify status without changing anything
compass_setup { "action": "stop" }                # Stop containers
```

`initialize` first checks whether Solr and all configured collections are already ready. If they are, it makes no changes. Otherwise, Docker Compose automatically downloads the pinned `solr:10.0.0` and `zookeeper:3.9.3` images when absent, starts the containers, uploads the `souk-compass` configset, creates missing collections, and returns a final status report.

The lower-level actions remain available for troubleshooting:

```
compass_setup { "action": "start" }               # Start containers + upload configset
compass_setup { "action": "create_collections" }  # Create configured collections
```

The `start` action automatically uploads the `souk-compass` configset to ZooKeeper after the containers are healthy.

## Required JVM setting

`docker-compose.yml` sets:

```yaml
SOLR_OPTS: "-Dsolr.jetty.request.header.size=65536"
```

This is not optional. A kNN query inlines the full 1024-dimension query vector
into the request URI — roughly 22 KB — and Jetty's default limit is 8192 bytes,
so every vector and hybrid search fails with **HTTP 414 URI Too Long** without
it. Keyword search is unaffected, which makes the failure look selective rather
than systemic. If you run a Solr you did not start from this compose file, set
the same property there. Measured cost of raising it: none (kNN stays at 5–7 ms
warm; the JVM's own GC and heap defaults are untouched because `SOLR_OPTS` is
additive).

## Configset

The custom schema lives in `solr/configset/conf/`:
- `schema.xml` — Field definitions including the 1024-dim dense vector field and
  `embed_provider`, which records the model that produced each vector
- `solrconfig.xml` — Solr configuration (autocommit, request handlers)

A copy of `schema.xml` is also kept at `solr/schema.xml` for reference. Keep the
two in step — the container mounts `solr/configset/`, so that is the copy that
actually reaches ZooKeeper.

The configset is mounted into the Solr container and uploaded to ZooKeeper on startup. Collections reference it by name (`souk-compass`) via the `collection.configName` parameter.

### Changing the schema on a running cluster

Editing `schema.xml` has no effect until the configset is re-uploaded and the
collections reload. Nothing warns you if you skip this; queries simply behave as
though the field does not exist.

```bash
docker exec souk-compass-solr solr zk upconfig \
  -n souk-compass \
  -d /opt/solr/server/solr/configsets/souk-compass/conf \
  -z zoo:2181

for c in context-bazaar context-bazaar-user-docs context-bazaar-codebase; do
  curl "http://localhost:8983/solr/admin/collections?action=RELOAD&name=$c&wt=json"
done

# Confirm the field landed
curl "http://localhost:8983/solr/context-bazaar/schema/fields/embed_provider?wt=json"
```

Adding a field is safe for existing documents; they simply carry no value for it.
Changing `vectorDimension` or the similarity function is not — that requires a
full reindex.

## Indexing More Than One Repository

The codebase collection is shared by every repository you index. Isolation comes
from `index_root`, the absolute folder each document was indexed from, rather
than from separate collections.

```
compass_index_folder   { path: "/repos/my-app" }
compass_index_folder   { path: "/repos/other-service" }

compass_search_codebase { query: "...", root: "/repos/my-app" }   # one repo
compass_search_codebase { query: "..." }                          # all repos
```

Search results carry a `root`, so a cross-repository hit is attributable.
`compass_status` reports `indexedRoots` — a per-repository document count — which
is the only way to see what is currently indexed.

Both destructive operations are scoped to the root you name:

- `compass_index_folder { clear: true }` deletes only that root's documents.
- `compass_reindex_folder` deletes only documents belonging to that root, and
  reports anything it declined to remove as `skippedRemovals`.

Neither will touch another repository. Documents predating `index_root` cannot be
attributed to any root, so they are never deleted automatically; `compass_status`
counts them as `untrackedRootDocs`, and the way to clear them is a one-off
`delete` by `*:*` followed by a reindex.

### Separate collections, if you want them

The three folder tools accept a `collection` argument to target a different Solr
collection entirely — genuine isolation, at the cost of provisioning and of
losing cross-repository search. The collection must exist first; the tools refuse
a name they cannot find rather than creating it, so a typo does not silently
become an empty collection that returns nothing.

```bash
compass_setup { "action": "create_collection", "name": "codebase-my-app" }
compass_index_folder { "path": "/repos/my-app", "collection": "codebase-my-app" }
```

Note that `SOUK_COMPASS_CODEBASE_COLLECTION` sets the default for a whole server
process, whereas `collection` is per call — so one server can serve several
repositories without any per-project MCP configuration.

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
3. Dense vector search enabled — requires Solr 10+ (schema uses `ScalarQuantizedDenseVectorField`, introduced in Solr 10)
4. Network access from the machine running the MCP server

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `SOUK_COMPASS_SOLR_URL` | `http://localhost:8983` | Solr base URL |
| `SOUK_COMPASS_SOLR_COLLECTION` | `context-bazaar` | Artifact collection name |
| `SOUK_COMPASS_USER_COLLECTION` | `context-bazaar-user-docs` | User document collection name |
| `SOUK_COMPASS_CODEBASE_COLLECTION` | `context-bazaar-codebase` | Codebase collection name |
| `SOUK_COMPASS_EMBED_PROVIDER` | `local` | Embedding provider (`local`, `bedrock-titan`) |
| `SOUK_COMPASS_EMBED_DIMENSIONS` | `1024` | Embedding vector dimensions |
| `SOUK_COMPASS_CACHE_TIERS` | `memory,sqlite,solr` | Embedding cache tiers, in lookup order |
| `SOUK_COMPASS_CACHE_DB` | `~/.souk-compass/embed-cache.db` | SQLite cache path |
| `SOUK_COMPASS_EMBED_CACHE_SIZE` | `1000` | In-memory LRU entries |
| `SOUK_COMPASS_DEFAULT_MIN_SCORE` | unset | Default similarity floor, 0–1 |
| `SOUK_COMPASS_EF_SEARCH_SCALE` | `1.0` | HNSW candidate multiplier |
| `SOUK_COMPASS_FILTERED_SEARCH_THRESHOLD` | unset | ACORN threshold, integer 0–100 |
| `SOUK_COMPASS_TENANTS` | unset | Tenant registry as inline JSON. Wins over the file |
| `SOUK_COMPASS_TENANT_REGISTRY` | `~/.souk-compass/tenants.json` | Tenant registry path |
| `SOUK_COMPASS_DEFAULT_TENANT` | `personal` | Tenant used when a call names none |
| `SOUK_COMPASS_COLLECTION_PREFIX` | `souk` | Prefix for derived collection names |
| `SOUK_COMPASS_NUM_SHARDS` | `1` | Shards per collection, at creation |
| `SOUK_COMPASS_REPLICATION_FACTOR` | `1` | NRT replicas per shard, at creation |
| `SOUK_COMPASS_TLOG_REPLICAS` | `0` | Transaction-log-only replicas |
| `SOUK_COMPASS_PULL_REPLICAS` | `0` | Read-only replicas |
| `SOUK_COMPASS_PLATFORM` | `local` | `local` or `aws`. Selects embeddings and org storage together |
| `SOUK_COMPASS_REGION` | `$AWS_REGION` | One region for Bedrock, Solr's S3 repository and this server |
| `SOUK_COMPASS_S3_BUCKET` | unset | Default bucket for org tenants that declare none |
| `SOUK_COMPASS_HOME` | `~/.souk-compass` | Host state: registry, generated solr.xml, backups |
| `SOUK_COMPASS_BACKUP_DIR` | `~/.souk-compass/backups` | **Host** snapshot directory, bind-mounted into Solr |
| `SOUK_COMPASS_BACKUP_LOCATION` | `/var/solr/backups` | Container-side path Solr writes snapshots to |
| `AWS_ACCESS_KEY_ID` etc. | unset | Passed through to Solr for S3 backup repositories |

## Tenants

A **tenant** is the unit of ownership: `personal` for you, one entry per org you
share an index with. Each owns up to three collections, one per partition
(`artifacts`, `memory`, `codebase`).

With no configuration there is exactly one tenant — `personal` — mapped to the
three `context-bazaar*` collection names above. An existing index needs no
migration.

Declare orgs in `~/.souk-compass/tenants.json`:

```json
{
  "tenants": [
    { "id": "acme", "scope": "org", "displayName": "Acme Platform" },
    { "id": "upstream", "scope": "org", "access": "read" },
    { "id": "policy", "scope": "org", "precedence": 500,
      "durability": { "replicationFactor": 3 } }
  ]
}
```

- `id` is a lowercase slug. It becomes part of collection names
  (`souk-acme-memory`) and part of Solr filter queries, which is why it is
  constrained.
- `access: "read"` refuses writes at the tool boundary — the shape of an org
  index you consume and someone else curates.
- `precedence` decides who wins when two tenants disagree. Personal defaults to
  100 and org to 50, so a local decision outranks an org default. Raise an org
  above 100 when it publishes binding policy rather than suggestions.
- `solrUrl` lets a tenant's index live on a different SolrCloud entirely; reads
  federate across clusters.
- `collections` names a partition's collection explicitly. Two tenants may
  deliberately share one — `compass_tenants` flags that, because there the
  `tenant_id` filter is the only thing separating them.

Isolation is by collection rather than by a filter over one shared collection,
because backup, replication factor, and Solr's per-collection authorization are
all properties of a collection (see
[ADR-0056](../../../docs/adr/0056-tenant-scoped-durable-memory-records.md)).

```
compass_tenants { "verify": true }                       # who is reachable, and how healthy
compass_remember { "note": "...", "category": "convention", "tenant": "acme" }
compass_recall_memory { "query": "...", "tenants": "all" }   # personal + every org
```

## Memory records

A memory note is a record with an identity and a lifecycle, not an insert.

- **Revisions.** Restating something already recorded is a no-op. A changed
  statement about the same subject becomes revision *n+1* and marks the previous
  one `superseded` — retained, pointing forward at its replacement.
- **Retraction.** `compass_forget` marks a record `retracted` rather than
  deleting it, so a mistake stays auditable and cannot be resurrected by a later
  reindex.
- **Validity.** `validFrom` / `validUntil` bound when a record was true.
  `compass_recall_memory { asOf }` asks what was believed at a past instant.
- **Decay.** Episodic records (observations, decisions) lose ranking weight with
  age — 90-day half-life by default. Semantic and procedural records do not, and
  `pinned` records never do. Decay changes ranking only; nothing is dropped.
- **Conflicts.** When two tenants disagree, the higher-precedence record wins and
  the loser is returned as `shadowed` rather than silently dropped.
- **Provenance.** Session, agent, repository, and author are recorded per record.

Pre-v2 notes keep working: absent `status` and `valid_from` read as "active,
valid from the beginning of time", and untagged documents belong to `personal`.
`compass_status` reports `unmigratedCollections` so an unfinished migration is
visible rather than blended into the personal totals.

## Durability

Replication is configured at creation and cannot be changed afterwards for
`numShards`, so it is worth setting before the first index:

```bash
export SOUK_COMPASS_REPLICATION_FACTOR=3
compass_setup { "action": "create_collections" }
```

`compass_status` and `compass_setup { "action": "check" }` compare *live* replica
counts against the requested `replicationFactor` and report `underReplicated`. A
collection created with three replicas and running on one answers every query
correctly right up until that node fails; a document count cannot tell you that.

Replication does not survive a bad reindex or a mistaken delete — both replicate
faithfully. Code can be reindexed from source afterwards; memory cannot, because
it has no source. That is what snapshots are for.

## Snapshots: save, tear down, rebuild, restore

The supported lifecycle:

```bash
compass_backup { "action": "save", "snapshotId": "2026-08-08" }

docker compose down -v            # index, ZooKeeper, all cluster state gone

compass_setup  { "action": "start" }
compass_backup { "action": "restore", "snapshotId": "2026-08-08" }
compass_backup { "action": "verify",  "snapshotId": "2026-08-08" }
```

Use `start`, not `initialize`, before a restore. Both bring the containers up and
upload the configset, but `initialize` also **creates** the collections — and
Solr restores only into a collection that does not exist, so every restore would
then be refused. `initialize` is for a first run; `start` is for a rebuild you
intend to restore into.

This works because snapshots are **not** stored in a Docker volume.
`docker compose down -v` removes every named volume, so a snapshot kept in one
is destroyed by the very command it exists to survive. The backup path is a host
bind mount instead — `~/.souk-compass/backups` by default, or
`SOUK_COMPASS_BACKUP_DIR`.

Two other things `down -v` destroys are handled for you. ZooKeeper's copy of the
configset goes with it, but Solr's backup image includes the configset, and
`RESTORE` re-uploads it. And `compass_setup initialize` now uploads the configset
even when Solr is already reachable — which it is immediately after a rebuild.

### Platform profiles

Embeddings and snapshot storage are one decision. Titan runs in Bedrock and org
snapshots go to S3 — same cloud, same region, same credentials — so selecting the
platform selects both:

```bash
export SOUK_COMPASS_PLATFORM=aws
export SOUK_COMPASS_REGION=us-east-1
export SOUK_COMPASS_S3_BUCKET=org-snapshots
```

| | `local` (default) | `aws` |
|---|---|---|
| Embeddings | local MiniLM | `bedrock-titan` |
| Org tenant snapshots | host directory | S3, each tenant under its own prefix |
| Personal snapshots | host directory | **host directory** |
| Region | n/a | one value, everywhere |

It sets **defaults only** — an explicit `SOUK_COMPASS_EMBED_PROVIDER` or a
tenant's own `backup.s3` block still wins. And **personal deliberately stays on
local disk**: that credential-free path is what makes `docker compose down -v`
survivable with no AWS setup at all, and a profile should not quietly remove it.
Give the personal tenant an explicit `backup.s3` block to move it to a bucket.

Two configurations are refused rather than half-applied: an unrecognised platform
name, and `platform: aws` with org tenants but no bucket — which would silently
put every org's snapshots on one laptop's disk.

> Switching an existing install to `aws` changes the embedding model, and vectors
> from different models are not comparable. Reindex afterwards, and check
> `compass_status` for `providerMismatch`.

### Storage backends

Each tenant names a Solr **backup repository**. Solr reads and writes the index
itself, so the repository is the storage backend; this server only transports the
snapshot manifest.

The manifest moves through `Bun.file()`, which returns the same `Blob` interface
for a host path and an `s3://` URI — so local and remote are one code path, and
no external tool is required. Bun's S3 client reads credentials from
`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` (or the `S3_*` equivalents) only. If
your credentials come from `AWS_PROFILE`, SSO or an instance role instead, the
server falls back to the `aws` CLI, which understands those — so install it if
that is your setup. Each result reports the `transport` it used.

| Backend | For | Needs |
|---|---|---|
| `LocalFileSystemRepository` | personal | nothing — a host directory |
| `S3BackupRepository` | an org, or a second machine | a bucket, AWS credentials, the `aws` CLI |

Declare an org backend in `~/.souk-compass/tenants.json`:

```json
{
  "tenants": [
    {
      "id": "acme",
      "scope": "org",
      "backup": {
        "s3": { "bucket": "acme-solr-backups", "region": "us-east-1" }
      }
    }
  ]
}
```

`compass_setup start` generates `~/.souk-compass/solr.xml` from the registry and
bind-mounts it, so you never hand-edit XML — and sets `SOLR_MODULES` to whatever
the declared repositories need. **Repositories are read once, at boot**: after
changing the registry, restart Solr.

**Credentials never go in the registry.** Solr uses the AWS credential chain from
its own container, so `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`,
`AWS_SESSION_TOKEN` and `AWS_REGION` are passed through from your environment by
the compose file. A credential-shaped value in the registry is rejected at load
time.

Solr officially supports AWS S3 only. MinIO is documented as incompatible with
`S3BackupRepository`; Adobe's S3Mock is the recommended local test double.

### What a snapshot records

Alongside Solr's per-collection backups, each snapshot writes a manifest to
`<location>/_manifests/<snapshotId>.json` — pushed to the bucket too, for an S3
repository. It holds the tenant→collection mapping, the resolved tenant registry,
the embedding provider and dimensions, the memory schema version, and the
per-collection document counts.

That is what makes a restore on a *different* machine work. Solr's backups are
three anonymous indexes without it, and `tenants.json` is not otherwise part of
the snapshot — its absence would degrade silently into personal-only defaults.
`restore` writes the registry back if none is present, and never overwrites one.

The manifest is also why a restore can be checked. Solr reports RESTORE
successful the moment the collection exists, which is some way short of "holds
what it held"; `verify` compares live counts against the recorded ones.

### The embedding-model guard

`restore` refuses a snapshot built with a different embedding provider or vector
width. Restoring Titan vectors onto the `local` provider yields an index that
answers every query, raises no error, and ranks by nothing — there is no later
point at which that becomes visible. Override with `force: true` only if you
intend to reindex afterwards.

### Retention

```
compass_backup { "action": "list" }
compass_backup { "action": "prune", "keep": 5 }
```

Retention is "keep the newest N backup points", not "delete older than" —
snapshots are taken by hand, and a time rule can leave you with none after a
quiet month.

### Known trap: bind-mount ownership

Docker creates a missing bind-mount source as a **root-owned** directory, and
Solr runs as uid 8983 — so backups then fail with a permission error that reads
like a bug. `compass_setup initialize` creates `~/.souk-compass/backups` itself
with mode `0777` before starting the containers. If you prefer tighter
permissions, create it yourself:

```bash
mkdir -p ~/.souk-compass/backups && sudo chown 8983:8983 ~/.souk-compass/backups
```

### Not included

`~/.souk-compass/embed-cache.db` is deliberately not snapshotted. It is a pure
cache keyed by embedding provider; losing it costs re-embedding time, not data.

## Choosing an Embedding Provider

`local` is the default so the server works with no cloud credentials. It runs
`Xenova/all-MiniLM-L6-v2` on CPU via `onnxruntime`, which means:

- **A 512-token ceiling (~1,970 characters on this corpus).** Anything past it is
  silently discarded — it contributes nothing to the vector while still appearing
  indexed. Long chunks match only their opening.
- **384 native dimensions, zero-padded to 1024** to fit the schema. The padding
  is harmless for cosine ranking but wastes distance computation and vector
  storage.
- **`node_modules` must be present on disk.** `onnxruntime`'s native binding
  cannot be bundled, so a packaged build still needs the dependency installed.

`bedrock-titan` uses `amazon.titan-embed-text-v2:0`: 1024 native dimensions
(no padding), unit-normalised, and an 8,192-token context window. It needs
`@aws-sdk/client-bedrock-runtime`, working AWS credentials, and `AWS_REGION`.
Model access must be enabled for the account — check with:

```bash
aws bedrock list-foundation-models --by-output-modality EMBEDDING \
  --query 'modelSummaries[?contains(modelId,`titan-embed-text`)].modelId' --output text
```

### Switching providers requires a full reindex

Vectors from different models occupy different spaces and are not comparable.
Querying a Titan-built index with the local provider returns plausible-looking
scores that are meaningless, and raises no error. Three guards exist, but they
mitigate rather than remove the hazard:

- The embedding cache is keyed by provider and dimensionality, so a stale cache
  cannot serve the previous model's vectors.
- Provider initialisation failure is fatal rather than falling back to `local`.
- Each document records `embed_provider`, and `compass_status` reports
  `providerMismatch` naming any collection that disagrees with the configured
  provider.

When you switch, clear and reindex **every** collection: the provider is global,
not per-collection. Check `compass_status` afterwards and confirm
`providerMismatch` is absent and no `untaggedDocs` remain.

## Auto-Reindex Hook

Souk Compass includes a `postToolUse` hook at `hooks/auto-reindex.json` that automatically triggers `compass_reindex` after shell commands complete (e.g., `kanon build`). This keeps the Solr index synchronized with the catalog without manual intervention.

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
