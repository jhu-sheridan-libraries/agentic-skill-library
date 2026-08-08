# ADR-0057: Solr backup repositories as the storage backend for snapshots

## Status

Accepted

## Date

2026-08-08

## Context

ADR-0056 added `compass_setup backup`, writing snapshots to `/var/solr/backups`.
That path was a **named Docker volume**, listed in the compose `volumes:` block.

`docker compose down -v` removes every volume in that block. So the snapshot was
destroyed by the same command that tore down the stack it existed to survive —
and the compose comment claiming a separate volume kept those decisions
independent was true only of `down` without `-v`. The one lifecycle a backup
feature is for was the one it did not support.

Six further gaps stood between that and "save, tear down, rebuild, restore":

1. **No transport off the machine.** No `repository` parameter was ever sent and
   `SOLR_MODULES` was unset, so only `LocalFileSystemRepository` was on the
   classpath. There was no organizational backend at all.
2. **`down -v` wipes ZooKeeper**, taking the uploaded configset with it — and
   `initialize` skipped the `upconfig` step whenever Solr was already reachable,
   which it is immediately after a rebuild.
3. **No manifest.** Nothing recorded which collection belonged to which tenant,
   which embedding model produced the vectors, or what the document counts were.
   Three restored indexes on a fresh machine are three anonymous indexes. Worse,
   `~/.souk-compass/tenants.json` was not captured, and its absence degrades
   *silently* into personal-only defaults.
4. **Restore lost topology.** Only `replicationFactor` was sent, so a two-shard,
   tlog-backed collection came back single-shard and NRT-only, reporting success.
5. **Backups blocked.** Both helpers accepted an `async` parameter, no caller
   passed it, and nothing polled `REQUESTSTATUS`.
6. **Asymmetric naming.** Backup suffixed each collection; restore took one
   verbatim name and restored a single collection.

## Decision

Use **Solr's own `BackupRepository`** as the storage-backend abstraction, declare
repositories in a generated `solr.xml`, and describe each snapshot with a
manifest this server transports.

### 1. Repositories, not a parallel abstraction

Solr already has the concept: a named, pluggable backend selected per operation
via `repository`. Three reasons not to build another one on top:

- **Solr must read the backup itself.** RESTORE reads from the repository; there
  is no API for handing Solr bytes. Any abstraction we invent bottoms out here.
- **The index never passes through this process.** Solr streams directly to the
  bucket; a server-side implementation would proxy gigabytes through Node.
- **No new dependency on the index path**, matching kanon's precedent of shelling
  out to `gh`/`aws` rather than taking SDKs (ADR-0017/0018).

| Tenant | Repository | Class |
|---|---|---|
| `personal` | `personal` | `LocalFileSystemRepository`, **host bind mount** |
| org | tenant id | `org.apache.solr.s3.S3BackupRepository` |

### 2. The host bind mount

`/var/solr/backups` becomes
`${SOUK_COMPASS_BACKUP_DIR:-${HOME}/.souk-compass/backups}` — a bind mount,
outside Docker's lifecycle. This single line is what makes the stated user story
work, with no credentials and no Solr modules. The `volumes:` block now carries a
comment stating that nothing which must survive a teardown may live in it.

### 3. `solr.xml` generated from the registry

`<backup><repository>` is a **solr.xml** construct, not a solrconfig.xml one, so
it cannot live in the already-mounted configset. The stock `solr.xml` is written
into `/var/solr` on first boot — inside the volume `down -v` destroys — so a
repository configured by hand inside the container dies with it. And which
repositories exist is a function of the tenant registry.

So `renderSolrXml(registry)` emits it, `compass_setup` writes it to the host
state directory before `docker compose up`, and it is bind-mounted read-only.
Pure function, unit-tested without Docker. Repositories are read once at boot, so
registry changes require a restart; the tool says so.

### 4. The snapshot manifest

Solr's backups are per-collection and know nothing about tenancy. The manifest
records the tenant→collection mapping, the resolved registry, the embedding
provider and dimensions, the memory schema version, and the per-collection facet
counts — reusing the query `compass_status` already runs, extracted to
`collection-report.ts`.

It travels host-side always, and to S3 via `aws s3 cp`. That makes `aws` a
documented prerequisite for org backends only; the personal path needs no CLI.
A missing manifest degrades restore to `LISTBACKUP` discovery with a warning
rather than blocking it.

### 5. The embedding guard

Restore refuses when the snapshot's provider or dimensions differ from the
configured ones, unless `force: true`. This is the highest-value check in the
feature: restoring vectors from another model produces an index that answers
every query, raises no error, and ranks by nothing. There is no later point at
which that becomes visible.

### 6. Async execution

`runAsyncCommand` submits with `async=<id>`, polls `REQUESTSTATUS`, then calls
`DELETESTATUS`. The delete is not tidying — Solr retains completed statuses and
rejects a request whose id already has one, so skipping it breaks the second
snapshot of the day. A timeout is reported as `running`, not `failed`: the
operation has not failed, and saying so would invite a colliding retry.

### 7. Tool split

`compass_setup` owns the container stack; a new `compass_backup` owns the data,
with `save`, `restore`, `list`, `verify`, `prune`. The `backup`/`restore` actions
added to `compass_setup` in ADR-0056 are removed — unreleased, so no
compatibility burden.

## Considered options

1. **Keep the named volume and document "don't use `-v`".** Zero work, and it
   makes the tool's correctness depend on a user remembering a flag. Rejected:
   the destructive command is the documented way to reset the stack.

2. **A server-side backend abstraction (upload the index ourselves).** Full
   control and any storage target. But RESTORE has to read the backup, so Solr
   needs repository access regardless — and this would stream gigabytes through
   Node to no benefit. Rejected.

3. **`@aws-sdk/client-s3` instead of the `aws` CLI.** In-process, no external
   dependency. Adds bundle weight to a server that marks `@aws-sdk/*` external,
   and breaks kanon's shell-out precedent, for a few kilobytes of JSON per
   snapshot. Rejected.

4. **GCS or a shared NFS mount for the org backend.** Both are viable and the
   repository abstraction admits either later; S3 was chosen as the default
   because kanon's config surface already describes S3 backends.

5. **Manifest stored inside Solr as a document.** It would then be backed up
   automatically. Circular — you need it before you can restore. Rejected.

## Consequences

### Positive

- Save, `docker compose down -v`, rebuild, restore now works, on the same machine
  or a different one.
- Org tenants get shared, off-machine snapshots; personal tenants keep a
  credential-free path that needs no Solr module.
- A restore is verified against recorded counts rather than assumed from Solr
  reporting the collection into existence.
- The embedding-model mismatch that silently ruins an index is refused.
- Restore preserves the full shard/replica topology.
- A wiped ZooKeeper is recoverable: the backup carries its configset, and
  `initialize` now always uploads.

### Negative

- `solr.xml` is generated, so hand edits are overwritten, and repository changes
  need a Solr restart.
- Host bind mounts bring ownership concerns: Docker creates a missing source as
  root, and Solr runs as uid 8983. `compass_setup` creates the directory `0777`
  and the README documents the tighter `chown 8983:8983`.
- `aws` becomes a prerequisite for org backends.
- Solr officially supports AWS S3 only; MinIO is documented as incompatible with
  `S3BackupRepository`.
- More moving parts in `compass_setup start`: host state, compose environment,
  configset upload.

### Neutral

- A zero-configuration install is unchanged apart from where backups land, which
  it previously had no working story for anyway.
- Snapshots are taken on demand; nothing is scheduled.
- `~/.souk-compass/embed-cache.db` is deliberately not backed up — a pure cache,
  keyed by provider, re-derivable at the cost of re-embedding time.

## Links and references

- Extends: [ADR-0056](./0056-tenant-scoped-durable-memory-records.md),
  [ADR-032](./0032-solrcloud-mode-for-souk-compass.md)
- Mirrors: [ADR-0017](./0017-pluggable-backend-abstraction-for-artifact-publishing.md),
  [ADR-0018](./0018-use-gh-cli-as-github-release-backend.md) (shell out, no SDK)
- Implementation: `kanon/mcp-servers/souk-compass/src/solr-xml.ts`,
  `src/backup-store.ts`, `src/solr-async.ts`, `src/tools/compass-backup.ts`
