# ADR-0059: Root-Scoped Git Baselines for Incremental Codebase Indexing

**Date:** 2026-08-10
**Status:** Proposed
**Deciders:** Context Bazaar development team
**Supersedes:** N/A

## Context and Problem Statement

Codebase documents from multiple repositories share a Solr collection, while their document identifiers are relative to the indexed root. The indexing-improvements spec requires both content-hash deduplication and Git-aware reindexing, so each root needs durable state that survives MCP process restarts and identifies the exact Git range since its last successful index.

ADR-0058 establishes the policy modules and typed Git-diff fallback boundary, but intentionally leaves the reindex orchestrator as future work. It does not define where an indexed root's baseline commit lives, how it advances after a partial reindex, or the scope at which identical content is deduplicated.

## Decision Drivers

- One codebase collection can hold documents from several absolute repository roots.
- Reindexing must avoid re-embedding unchanged files and must remove documents for Git-deleted paths.
- Persistent index state must not require a second Solr collection or a process-local cache.
- Identical content in different repositories must remain independently searchable.
- Git failures must safely fall back to the existing content-hash scan.

## Considered Options

1. Store one root-metadata document in the shared codebase collection.
2. Store the Git baseline on every codebase document, scoped by `index_root`.
3. Keep no persistent Git baseline and always compare a full filesystem scan with indexed content hashes.

## Decision Outcome

**Chosen option:** Option 2 — store the Git baseline on every codebase document, scoped by `index_root`, because it persists state in the existing schema without adding a metadata document type or collection and keeps root lookup and cleanup queryable in Solr.

### Positive Consequences

- `index_commit` provides a durable per-root baseline for `git diff <stored>..HEAD` after MCP restarts.
- Reindexing can scan only Git-added and Git-modified paths and delete documents for Git-deleted paths.
- Root-scoped content-hash checks suppress duplicates within one index while preserving the same content in another repository.
- A full scan remains a safe fallback for non-Git roots, absent or unreachable baselines, oversized diffs, and timeouts.
- The shared collection retains a single schema and no new metadata lifecycle is introduced.

### Negative Consequences

- The root baseline is denormalized across all documents for that root; advancing it requires batched Solr atomic updates for retained documents.
- A failed baseline update can leave a stale commit and cause a later reindex to process a larger safe range.
- Deduplication means identical chunks within one root intentionally retain only one searchable document identity.

## Options Analysis

### Option 1: Separate Root-Metadata Document

**Pros:** One baseline write per root; avoids repeating the SHA on documents.
**Cons:** Adds a special document lifecycle and query contract to a collection otherwise containing searchable codebase content; requires cleanup and migration rules for root metadata.

### Option 2: Document-Level Root Baseline (Chosen)

**Pros:** Uses the existing document metadata model; a root query retrieves the baseline; indexed and retained documents converge on the same successful Git HEAD.
**Cons:** Repeats the SHA and requires batched updates after an incremental pass.

### Option 3: Full Content-Hash Scan Only

**Pros:** No Git metadata or schema field.
**Cons:** Re-reads and classifies every eligible file on every reindex, defeating the large-repository performance goal and providing no direct deletion list.

## Decision

- `index_root` partitions both document ownership and deduplication. A content hash is considered already indexed only when an existing document has the same `index_root`; matching content in another root is indexed independently.
- A successful Git-backed full index writes the current `HEAD` SHA to `index_commit` on every upserted codebase document.
- Reindexing obtains one stored `index_commit` for the requested root. When Git returns a change set, it scans only added and modified paths, deletes documents for deleted paths, and writes the current SHA to newly upserted and retained documents after the mutations complete.
- If a baseline cannot be used, reindexing performs the existing content-hash comparison and returns a structured fallback reason rather than failing the operation.

## Links and References

- Extends: [ADR-0035](./0035-codebase-indexing-as-separate-collection.md)
- Extends: [ADR-0058](./0058-composable-indexing-policy-pipeline.md)
- Spec: `kanon/mcp-servers/souk-compass/.kiro/specs/indexing-improvements/requirements.md` — Requirements 4 and 8
- Spec: `kanon/mcp-servers/souk-compass/.kiro/specs/indexing-improvements/design.md` — Data Models and Git Diff
- Implementation: `kanon/mcp-servers/souk-compass/solr/schema.xml`, `src/solr-client.ts`, `src/tools/compass-index-folder.ts`, and `src/tools/compass-reindex-folder.ts`
- Branch: `main`
