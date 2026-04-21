# ADR-0024: Browse Server Admin CRUD with Mutable State and Modular Admin Layers

## Status

Proposed

## Date

2026-04-20

## Context

The `forge catalog browse` server was read-only — it loaded catalog entries once at startup and served them as static JSON. Adding CRUD capabilities for artifacts, collections, and manifest entries required two architectural decisions:

1. **How to handle in-memory state after mutations.** The server needs to reflect changes immediately without a restart. The catalog entries, loaded from disk at startup, become stale after a create/update/delete operation.

2. **Where to put mutation logic.** The existing `browse.ts` handles HTTP routing and HTML generation. Adding file-system mutation logic (create directories, write YAML, validate schemas) directly into the route handler would violate separation of concerns and make the code untestable in isolation.

A secondary concern was backward compatibility: the existing `handleRequest(req, catalogEntries, htmlPage)` signature is used by dozens of tests that pass plain `CatalogEntry[]` arrays. Changing the signature must not break them.

## Decision

### Mutable state wrapper

Introduce a `BrowseState` interface passed by reference to `handleRequest`:

```typescript
interface BrowseState {
  catalogEntries: CatalogEntry[];
  collectionsDir: string;
  forgeDir: string;
  knowledgeDir: string;
}
```

After each successful mutation, `refreshCatalog(state)` re-scans the knowledge directory and updates `state.catalogEntries` in place. `refreshCollections(state)` does the same for collections. This is a synchronous-refresh model — the mutation completes, the data is re-scanned from disk, and the response includes the updated entry.

For backward compatibility, `handleRequest` accepts `BrowseState | CatalogEntry[]` as its second parameter. When a plain array is passed (test shorthand), mutation routes return 500 since there is no knowledge directory to write to.

### Modular admin layers

Three new modules encapsulate mutation logic, each exporting pure validation/serialization functions and async file-operation functions:

- `admin.ts` — artifact CRUD (`validateArtifactInput`, `serializeFrontmatter`, `createArtifact`, `updateArtifact`, `deleteArtifact`)
- `collection-admin.ts` — collection CRUD (`validateCollectionInput`, `serializeCollection`, `parseCollectionFile`, `listCollections`, `getCollection`, `createCollection`, `updateCollection`, `deleteCollection`)
- `manifest-admin.ts` — manifest entry management (`readManifest`, `readSyncLock`, `computeSyncStatus`, `validateManifestEntry`, `addManifestEntry`, `editManifestEntry`, `removeManifestEntry`)

Each module reuses existing schemas (`FrontmatterSchema`, `CollectionSchema`, `ManifestEntrySchema`) and serialization utilities (`js-yaml`, `gray-matter`, `parseManifest`/`printManifest`). The route handler in `browse.ts` delegates to these modules and calls the appropriate refresh helper afterward.

### Shared UI design system

The frontend SPA extends the existing vanilla JS approach with a formalized design system: CSS custom properties (design tokens), reusable component patterns (cards, forms, badges, toasts, modals, tabs), and parameterized render functions (`renderCard`, `renderForm`, `renderBadge`, `showToast`, `showModal`, `showView`). No framework is introduced — the UI remains a single inline `<script>` block in the HTML template string.

## Consequences

### Positive

- Mutation logic is independently testable — admin modules export pure functions that can be unit-tested without an HTTP server
- The mutable state wrapper is a minimal change — one interface, two refresh helpers — that avoids the complexity of event-driven or pub/sub state management
- Backward compatibility is preserved for all existing tests via the union type parameter
- The design system enforces visual consistency across artifact, collection, and manifest views without introducing a build step or framework dependency
- Reuses existing Zod schemas and YAML utilities — no new validation or serialization dependencies

### Negative

- The synchronous refresh model re-scans the entire knowledge directory after every mutation, which could become slow with very large catalogs (acceptable for the current scale of local development)
- The `BrowseState | CatalogEntry[]` union type adds a runtime check in every route handler
- The inline SPA grows significantly (~1000 lines of JS) — at some point extracting to a separate file or introducing a lightweight build step may be warranted

### Neutral

- The admin modules follow the same pattern as existing modules (`parser.ts`, `catalog.ts`) — functions that take directory paths and return typed results
- Error handling uses typed errors (`(error as any).type = "validation" | "conflict" | "not-found"`) mapped to HTTP status codes by a shared `handleMutationError` helper

## Links and References

- Relates to: [ADR-0002](./0002-use-zod-for-validation.md) (Zod schemas reused for admin validation)
- Relates to: [ADR-0003](./0003-adapters-as-pure-functions.md) (pure function pattern extended to admin validation/serialization)
- Relates to: [ADR-0016](./0016-collection-membership-in-artifact-frontmatter.md) (collection membership resolved via frontmatter `collections` field)
- Relates to: [ADR-0023](./0023-manifest-driven-artifact-distribution-with-global-cache.md) (manifest schemas and parsers reused for manifest admin)
- Spec: .kiro/specs/catalog-admin-management/design.md
- Spec: .kiro/specs/catalog-admin-management/requirements.md
- Implementation: `skill-forge/src/admin.ts`, `skill-forge/src/collection-admin.ts`, `skill-forge/src/manifest-admin.ts`, `skill-forge/src/browse.ts`
