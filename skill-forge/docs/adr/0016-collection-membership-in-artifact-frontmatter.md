# ADR-0016: Collection Membership Declared in Artifact Frontmatter

**Date:** 2026-04-12
**Status:** Proposed
**Deciders:** skill-forge maintainers
**Supersedes:** N/A

## Context and Problem Statement

Skill Forge needs a "collection" concept — curated bundles like "AWS", "incident
response", "frontend" — so the bazaar can support discovery without forcing
everything into one flat namespace. The central design question is: where does
collection membership live? Two entities could own the list: the collection
manifest, or the artifact itself.

The naive approach (collection manifests enumerate their member artifacts) creates
a second source of truth that can drift from the artifact catalog independently.
When an artifact is renamed or deleted, the collection manifest silently becomes
stale, and there is no single file to edit that keeps both in sync.

## Decision Drivers

- No stale cross-references — deleting or renaming an artifact should
  automatically remove it from all collections
- Consistent with existing frontmatter-first conventions (`categories`,
  `ecosystem`, `depends`, `enhances` are all declared on the artifact)
- Collection manifests should be usable by third-party curators who can
  describe a collection without editing every member artifact
- Authors should be able to publish to a collection by editing only their
  own artifact

## Considered Options

1. **Option A — Membership in artifact frontmatter**: Artifacts declare
   `collections: [aws]`. Collection manifests are metadata-only (no member
   list). Membership is derived from the catalog at build time.
2. **Option B — Predicate/query-based collections**: Collection manifests
   define filter expressions (`ecosystem: [aws]`). Membership is computed
   dynamically.
3. **Option C — Hybrid filter + explicit overrides**: Base filter plus
   `include:`/`exclude:` lists in the collection manifest.
4. **Option D — Explicit member lists with strict build-time validation**:
   Collection manifests enumerate artifact names; `forge build` fails hard on
   any unresolved reference.

## Decision Outcome

**Chosen option: Option A — membership in artifact frontmatter**, because it
eliminates the stale-reference problem at its root rather than detecting it after
the fact. Artifact frontmatter is already the canonical source of truth for all
classification metadata, and `collections: [...]` follows the same pattern as
`categories`, `depends`, and `enhances`.

Collection manifests (`collections/*.yaml`) are metadata-only: they define
`displayName`, `description`, `trust` lane, and `tags` but contain no member
list. `forge validate` warns when an artifact declares a collection name with no
matching manifest (to catch typos), but the manifest is optional — artifacts can
opt into undeclared collections without blocking builds.

### Positive Consequences

- Deleting an artifact automatically removes it from all collections — no
  manifest update required
- `buildCollectionMembership()` derives a `Map<collectionName → artifactNames[]>`
  from the catalog in a single pass — no join or cross-file resolution needed
- Consistent with the existing pattern: all artifact classification is
  co-located with the artifact
- Third-party curators can still define a collection manifest for metadata
  (description, trust lane) without enumerating members

### Negative Consequences / Trade-offs

- Curation by a third party requires artifact authors to opt in by editing
  their own frontmatter; a curator cannot unilaterally add an artifact to a
  collection without a pull request to that artifact's `knowledge.md`
- An artifact author can add themselves to a collection by editing only their
  own file — collection "owners" have no veto mechanism in Phase 3 (deferred
  to Phase 4 governance config)

## Options Analysis

### Option A: Artifact frontmatter (chosen)
**Pros:** No stale refs; consistent with existing schema patterns; single file
to edit for membership
**Cons:** Third-party curation requires touching artifacts; no collection-owner
veto

### Option B: Query-based
**Pros:** Zero stale refs; bulk curation via tags
**Cons:** Curation intent is lost (a filter match ≠ a deliberate editorial
decision); one-off inclusions require polluting artifact metadata with
collection-specific tags; computed membership requires running the catalog build
to inspect

### Option C: Hybrid filter + overrides
**Pros:** Handles both bulk and one-off curation
**Cons:** Two membership mechanisms increase cognitive overhead; `include:`/
`exclude:` bring back the stale-reference risk for explicit entries

### Option D: Explicit lists with strict validation
**Pros:** Explicit curation; no ambiguity
**Cons:** Two files to keep in sync; build fails on any rename/delete; catalog
cannot be generated without manifests being up to date

## Links and References

- Relates to: [ADR-0015](./0015-knowledge-bazaar-shared-manifest-phase-1.md)
  (collections field introduced as part of bazaar manifest)
- Relates to: [ADR-0007](./0007-controlled-enum-for-categories.md) (same
  frontmatter-first classification pattern)
- Implementation: `skill-forge/src/collections.ts` — `loadCollections`,
  `validateArtifactCollectionRefs`, `buildCollectionMembership`
- Implementation: `skill-forge/src/collection-builder.ts`
- Implementation: `skill-forge/src/schemas.ts` — `CollectionSchema`,
  `collections` field on `FrontmatterSchema` and `CatalogEntrySchema`
- Branch: main
