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
- **`sub_type` is inferred from artifact shape**, since Kanon does not store it. `category` is the artifact's first `categories` entry; the remaining categories plus `ecosystem` become `tags`.
- **Two scopes share the projection.** Bazaar-wide: `catalogCommand` in `src/catalog.ts` writes a top-level `registry.yaml` alongside `catalog.json` on every `kanon catalog generate`, so the two indices are produced from one scan and cannot drift. Collection-scoped: a thin CLI `scripts/generate-registry.ts` (`bun run build:registry`) renders one collection's members into that collection's own `registry.yaml`.

### `inferSubType` precedence is load-bearing

`inferSubType` returns the **first** matching branch, and the order is significant, not incidental. It MUST be evaluated as an ordered decision list:

1. `type === "agent"` → `"agent"`
2. else has MCP servers (`features.mcp`) → `"database"`
3. else has workflows (`features.workflows`) → `"pipeline"`
4. else → `"guide"`

The ordering is what makes the classification correct for real artifacts that match more than one predicate:

- `dataset-discovery` is `type: agent` **and** ships an MCP server. Because the `agent` check precedes the MCP check, it correctly projects to `agent`, not `database`. Reordering (2) before (1) would silently reclassify every agent that carries a data-access server.
- A prose-guide skill that happens to bundle a `workflows/` file matches the workflow predicate. Any such member whose intended sub_type is `guide` MUST match an earlier branch or be accepted as `pipeline`; the projection cannot distinguish "guide that ships a helper workflow" from "pipeline" on shape alone.

Because the correctness of the output depends on this order, the precedence MUST be pinned by a unit test on `inferSubType` (one case per branch, plus the agent-with-MCP and guide-with-workflow overlap cases) so a future refactor cannot reorder the branches without failing a test. This is called out explicitly because the order is otherwise only visible as line order in one function.

## Consequences

### Positive

- `catalog.json` and `registry.yaml` are generated from the same entries in one pass, so they cannot drift.
- SciAgent-Skills tooling can consume Kanon collections through the shared `registry.yaml` shape.
- The projection is pure and deterministic, so committed generated output stays stable and the mapping is unit-testable in isolation.
- A substantial collection can carry its own scoped index without a second source of truth.

### Negative

- `sub_type` is heuristic, not declared. An artifact whose shape does not match its intended SciAgent sub_type is mis-projected until the inference rules or the artifact shape change. In particular a prose guide that bundles a workflow projects to `pipeline`, and the heuristic cannot tell the two apart on shape alone.
- The correctness of the projection rests on the `inferSubType` branch order, a subtle invariant that must be defended by a test rather than by the type system.
- The bazaar-wide `registry.yaml` is now a second generated file that every `kanon catalog generate` writes and that must be committed alongside `catalog.json`.

### Neutral

- Reuses the existing catalog scan rather than introducing a new discovery path.
- Registry generation is additive; nothing that consumes `catalog.json` is affected.
- `registry.yaml` is a derived artifact — editing it by hand is a mistake the "generated, never hand-edited" rule is meant to prevent.

## Relationship to the type-system work

`inferSubType` is a **stopgap**: it exists only because Kanon has no first-class structure sub-classification to read. Two in-flight specs are completing the type/classification model:

- **`per-harness-artifact-type`** — decouples the taxonomy `type` from per-harness output format (continuing ADR-0012 → ADR-0014 → ADR-0051).
- **`complete-axis-inventory`** — ratifies `type` as the **Structure** axis and assigns every frontmatter field to a closed set of axes, enforced by the `checkModelInvariants` guard.

If either spec introduces a declared structure sub-classification (a real `sub_type`, or a finer Structure-axis value) that `registry.yaml` should read directly, this ADR's shape-inference heuristic SHOULD be replaced by reading that field, and this ADR marked **Superseded by** the ADR that lands it. Until then, the heuristic and its pinned branch-order test remain the source of `sub_type`.
