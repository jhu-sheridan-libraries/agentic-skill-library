# ADR-0071: Generated registry.yaml as a SciAgent-compatible index

## Status

Proposed

## Date

2026-09-10

## Context

Kanon's authoritative machine index is `catalog.json` — a rich, generated record of every artifact used by the browse UI and the MCP bridge. A sibling project, SciAgent-Skills, indexes its entries with a lighter, human-readable `registry.yaml` (one entry per artifact: `name`, `type`, `sub_type`, `category`, `path`, `description`, `date_added`, and optional `tags`).

The `archimedes-delight` collection adapts six guided skills from that SciAgent-Skills set. To keep the two ecosystems interoperable — and to give a substantial collection its own lightweight, browsable index — Kanon needed to emit a `registry.yaml` in the SciAgent shape. Hand-authoring such a file would guarantee drift from `catalog.json`, since the two would be maintained independently. Kanon also has no `sub_type` field, so the SciAgent-required `sub_type` has to be derived rather than stored.

## Decision

Generate `registry.yaml` as a pure projection of the same parsed catalog entries that produce `catalog.json`, never hand-edit it, and share one projection module across both output scopes.

- **Pure projection module `src/registry.ts`** holds `toRegistryEntry`, `renderBazaarRegistry`, and `renderCollectionRegistry`. It has no I/O — it maps `CatalogEntry` values to SciAgent-style registry entries and renders YAML, keeping it deterministic and unit-testable, consistent with the pure-core / thin-shell pattern used elsewhere (ADR-0003, ADR-0041).
- **`sub_type` is inferred from artifact shape**, since Kanon does not store it: `type: agent` → `agent`; has MCP servers → `database`; has workflows → `pipeline`; otherwise → `guide`. `category` is the artifact's first `categories` entry; the remaining categories plus `ecosystem` become `tags`.
- **Two scopes share the projection.** Bazaar-wide: `catalogCommand` in `src/catalog.ts` writes a top-level `registry.yaml` alongside `catalog.json` on every `kanon catalog generate`, so the two indices are produced from one scan and cannot drift. Collection-scoped: a thin CLI `scripts/generate-registry.ts` (`bun run build:registry`) renders one collection's members into that collection's own `registry.yaml`.

## Consequences

### Positive

- `catalog.json` and `registry.yaml` are generated from the same entries in one pass, so they cannot drift.
- SciAgent-Skills tooling can consume Kanon collections through the shared `registry.yaml` shape.
- The projection is pure and deterministic, so committed generated output stays stable and the mapping is unit-testable in isolation.
- A substantial collection can carry its own scoped index without a second source of truth.

### Negative

- `sub_type` is heuristic, not declared. An artifact whose shape does not match its intended SciAgent sub_type is mis-projected until the inference rules or the artifact shape change.
- The bazaar-wide `registry.yaml` is now a second generated file that every `kanon catalog generate` writes and that must be committed alongside `catalog.json`.

### Neutral

- Reuses the existing catalog scan rather than introducing a new discovery path.
- Registry generation is additive; nothing that consumes `catalog.json` is affected.
- `registry.yaml` is a derived artifact — editing it by hand is a mistake the "generated, never hand-edited" rule is meant to prevent.
