# ADR-0056: Tenant-scoped, durable memory records for Solr Compass

## Status

Accepted

## Date

2026-08-08

## Context

Solr Compass positions itself as a *library* rather than a notebook: shared,
curated, and durable. The data model did not yet support any of the three
claims.

**One flat namespace.** Three collection names came from environment variables
(`SOUK_COMPASS_SOLR_COLLECTION`, `_USER_COLLECTION`, `_CODEBASE_COLLECTION`) and
every document went into one of them. There was no notion of whose record a
document was. Sharing an index with a team therefore meant every participant
pointing at the same collections and seeing everything, with no way to keep a
personal note separate from an org convention, no way to consume an org index
read-only, and no way to say what happens when the two disagree.

**Memory was a text blob plus three strings.** A note was stored with a random
UUID and `metadata_category`, `metadata_tags`, `metadata_created_at` as dynamic
`string` fields. Consequences:

- Restating something across five sessions produced five separate records that
  all matched the same query and could not be told apart.
- Nothing could stop being true. There was no supersession, no retraction, no
  expiry — only insert, and delete-if-you-know-the-id.
- `metadata_tags` was a comma-joined string queried with `*tag*` wildcards, so
  tag `ci` also matched `cicd`.
- `metadata_created_at` was a `string`, so "what did we know in June" and
  "prefer the recent note" were not expressible as queries.
- Nothing recorded which session, agent, or repository produced a note.

**Durability was asserted, not configured.** `createCollection` hardcoded
`numShards=1&replicationFactor=1` — a single copy on a single disk, the one
topology under which none of the replication story holds. There was no backup
path, and nothing reported whether the replicas a collection was created with
were actually running.

The positioning notes name these as the known gaps and instruct that the copy
not claim them until they exist.

## Decision

Introduce **tenants** as the unit of ownership and **memory records** as the unit
of remembered knowledge, and make collection topology and snapshots explicit.

### 1. Tenancy: isolation by collection, attribution by field

A tenant is `personal` (always present) or one entry per org. Each owns up to
three collections, one per partition (`artifacts`, `memory`, `codebase`), named
`{prefix}-{tenantId}-{partition}` unless overridden.

Isolation is by **collection**, not by a filter over a shared one, because in
Solr the things that matter for this are per-collection and not per-document:
BACKUP/RESTORE name a collection, replication factor is a property of a
collection, `RuleBasedAuthorizationPlugin` grants read and write per collection,
and removing a tenant is a DELETE rather than a delete-by-query that can miss.

Documents nevertheless carry `tenant_id`, `tenant_scope`, and `partition`. That
is defence in depth: it makes a mis-routed write visible, permits two tenants to
share a collection deliberately, and attributes a hit when one query spans
several tenants.

A tenant may declare its own `solrUrl`, so an org index can live on a different
SolrCloud. Reads therefore **federate client-side** — one query per distinct
(Solr URL, collection) pair, merged here — rather than using Solr's
multi-collection query parameter, which cannot cross clusters.

The registry is `~/.souk-compass/tenants.json` or `SOUK_COMPASS_TENANTS`. A
missing file is the ordinary personal-only install; malformed content is an
error rather than a silent fallback, since falling back would route org writes
into a personal collection.

### 2. Memory records: identity, lifecycle, time, provenance

- **Identity.** `logical_id` (derived from tenant plus normalised note, or
  supplied) plus `revision`, with document id `{logicalId}::r{revision}`.
  Restating a known fact is a no-op; a changed statement becomes the next
  revision.
- **Lifecycle.** `status` ∈ `active | superseded | retracted`, plus
  `superseded_by` and `supersedes`. Nothing is deleted. Supersession says "this
  changed"; retraction (`compass_forget`) says "this was mistaken". Both remain
  queryable.
- **Time.** `valid_from` / `valid_until` as `pdate`, so validity is a range
  query and `asOf` can ask what was believed at a past instant. `created_at` and
  `updated_at` likewise.
- **Typing.** `memory_type` ∈ `semantic | episodic | procedural`, defaulted from
  `category`, governs decay: episodic records lose ranking weight with age
  (90-day half-life), semantic and procedural do not, pinned records never do.
  Decay affects ranking only — nothing is dropped for being old.
- **Categories.** `decision` and `constraint` added to the original five; both
  were previously filed under the catch-all `observation`.
- **Tags.** A real multi-valued field, matched exactly.
- **Provenance.** `source_session`, `source_agent`, `source_repo`, `author`.
- **Versioning.** `schema_version` (currently 2). Absent reads as 1.

### 3. Conflict resolution by tenant precedence

When two records speak to the same subject — two revisions, or two tenants — the
winner is decided by tenant precedence, then revision, then recency of
`valid_from`. Personal defaults to 100 and org to 50, so a local decision
outranks an org-wide default; an org publishing binding policy raises its own
precedence above 100.

The losers are **reported, not dropped**: `compass_recall_memory` returns them as
`shadowed`. An agent that only sees the winner cannot tell the user "your own
note overrides the org convention here", which is the thing most worth saying.

### 4. Durability made explicit

- `numShards`, `replicationFactor`, `tlogReplicas`, `pullReplicas` are
  configurable process-wide and per tenant, and are applied at creation —
  the only cheap opportunity, since `numShards` cannot be changed afterwards.
- `compass_setup` gains `backup` and `restore`. Replication survives a node
  failing; it does not survive a bad reindex or a mistaken delete, both of which
  replicate faithfully. Code can be reindexed from source after such an event;
  memory has no source to reindex from.
- `compass_status`, `compass_setup check`, and `compass_tenants --verify` report
  *live* replica counts against the requested `replicationFactor`. A collection
  created with three replicas and running on one answers every query correctly
  right up until that node fails, and nothing previously reported it.

### 5. Backward compatibility

- The personal tenant maps to the existing `context-bazaar*` collection names,
  so no existing index is orphaned.
- Every lifecycle filter admits documents missing the field: absent `status` and
  `valid_from` read as "active, valid from the beginning of time". A filter
  requiring them would make an upgrade look exactly like losing every note.
- Untagged documents are admitted by the personal tenant filter — everything
  written before tenancy was written by this user on this machine.
- Typed fields are dual-written alongside the pre-v2 `metadata_*` mirrors, so a
  rollback to the previous server still finds its fields. The mirrors can be
  dropped once no deployment predates schema version 2.
- `compass_status` reports `unmigratedCollections` so the size of an unfinished
  migration is visible rather than blended into the personal total.

## Considered options

1. **One shared collection, separated by a `tenant_id` filter.** Simplest to
   provision, and the only isolation is every caller remembering the filter. No
   per-tenant backup, no per-tenant replication, no per-collection authorization,
   and deleting a tenant becomes a delete-by-query. Rejected: it gives the
   appearance of separation without any of its properties.

2. **Collection per tenant with no `tenant_id` field.** Structurally sufficient
   while every collection stays unshared, but a mis-routed write becomes
   invisible, federated results become unattributable, and two tenants can never
   deliberately share a collection. Rejected as unnecessarily brittle for one
   string per document.

3. **Solr's multi-collection query parameter for federated reads.** One request
   instead of N. Works only within a single cluster, which rules out the org
   index that lives elsewhere — the case tenancy exists to serve. Rejected.

4. **Hard-delete on supersession.** Cheaper to store and to query. Loses the
   history that distinguishes an archive from a cache, and makes a mistaken
   deletion unrecoverable without a snapshot. Rejected.

5. **Age-based eviction rather than decay.** Simpler than a scoring adjustment.
   Deletes true records for being old, which is exactly the "notebook" behaviour
   this design rejects. Rejected in favour of decay, which changes ranking only.

## Consequences

### Positive

- Personal and org knowledge coexist in one server with real Solr-level
  isolation, and one query can span both.
- Contradictions resolve deterministically and visibly rather than by whichever
  record happened to rank higher.
- Memory stops accumulating duplicates; a corpus stays worth consulting.
- "What did we know in June", "what has been retracted", and "which of these is
  the org's position" become queries rather than guesses.
- Replication, sharding, and snapshots are configured and reported, so the
  durability claim is checkable.
- A half-migrated collection is detectable, by the same argument that already
  justifies `embed_provider`.

### Negative

- More fields, and a schema that must be re-uploaded to ZooKeeper with a
  collection RELOAD before the new ones exist.
- A write is now up to three round trips (lookup revisions, write, supersede)
  where it was one.
- Dual-writing `metadata_*` mirrors costs storage until the mirrors are dropped.
- Tenant precedence is a policy knob that can be set wrongly; a mis-set
  precedence silently changes which record wins.
- Collection count grows with tenants — three per tenant.

### Neutral

- A zero-configuration install is unchanged: one implicit personal tenant, the
  same three collection names, the same single-replica topology.
- Backup and restore are exposed but not scheduled; running them is still the
  operator's decision.

## Links and references

- Extends: [ADR-031](./0031-souk-compass-standalone-mcp-server-for-semantic-search.md),
  [ADR-032](./0032-solrcloud-mode-for-souk-compass.md),
  [ADR-035](./0035-codebase-indexing-as-separate-collection.md)
- Implementation: `kanon/mcp-servers/souk-compass/src/tenancy.ts`,
  `src/memory-model.ts`, `src/collections.ts`
- Schema: `kanon/mcp-servers/souk-compass/solr/configset/conf/schema.xml`
