# ADR-0041: Outcomes registry as a pure-core / thin-I/O-shell

## Status

Proposed

## Date

2026-06-12

## Context

The outcomes-registry requirement (Req 2 of the nWave forge integration) introduces
collision detection over the formal **outcomes** that artifacts declare in their
frontmatter. The same detection must run from two different I/O contexts —
`forge validate` (cross-artifact) and `forge guild sync` (manifest-resolved
artifacts) — and must surface deterministic, exactly-reproducible verdicts
(COLLISION / AMBIGUOUS / CLEAN) that drive exit codes. It also needs to be
exhaustively testable with property-based tests, since the comparison logic
(shape normalization, keyword tokenization, Jaccard similarity, the verdict
matrix, acknowledged-overlap downgrade, and duplicate-id detection) is subtle and
correctness-critical.

The algorithm has several independent concerns:

- **Shape normalization** — canonicalizing a type-shape string (trim, collapse
  whitespace, lowercase, `Array<T>` → `T[]`, strip tuple parameter names, sort
  top-level union members) so two shapes compare equal when they are spec-level
  equivalent, while deliberately *not* resolving aliases, erasing generics, or
  structurally comparing objects.
- **Collision detection** — the two-tier match (exact normalized shape tuple, plus
  keyword Jaccard ≥ threshold) and the verdict matrix.
- **Registry aggregation + check** — flattening outcomes across artifacts,
  detecting duplicate IDs, and running pairwise detection with acknowledged-overlap
  downgrade.

None of the existing ADRs cover this. ADR-0039 covers visibility/priority catalog
governance and ADR-0040 covers the DES-style hook schema; both are siblings under
the same spec but address unrelated surfaces. The pure-adapter convention
(ADR-0003) and the Zod-first validation convention (ADR-0002) establish the
house style this decision extends into a new `src/outcomes/` core.

## Decision

Implement the outcomes registry as a **pure core** under `src/outcomes/`, split
into three single-responsibility modules with no I/O and no side effects:

- `src/outcomes/normalize.ts` — `normalizeShape(shape: string): string`, a pure,
  deterministic, idempotent canonicalizer. Sub-steps are applied in a fixed order:
  trim → collapse whitespace → lowercase → `Array<T>` → `T[]` → strip tuple
  parameter names → sort top-level union members. Union sorting and array
  rewriting operate only on the relevant top-level/recursive constructs; nested
  generic parameters, aliases, and object shapes are left structurally intact
  (Req 2D.2 non-goals).
- `src/outcomes/collision.ts` — `tokenizeKeywords`, `jaccardSimilarity`,
  `shapesMatch`, `keywordsMatch`, `computeVerdict`, `isAcknowledged`. Pure
  comparison primitives over the normalized representation.
- `src/outcomes/registry.ts` — `aggregateOutcomes` and the single deterministic
  entry point `runRegistryCheck(refs, threshold?)` that performs duplicate-id
  detection first, then pairwise detection with acknowledged-overlap downgrade.

The surrounding command code (`validate.ts`, `guild/sync.ts`, `catalog.ts`) owns
all I/O — reading artifacts, threading exit codes, applying `--force` policy — and
calls into this pure core. `runRegistryCheck` is the single source of truth so
validate and guild sync cannot diverge.

This decision records the architecture of the whole `src/outcomes/` pure core so
that the three implementing tasks (normalize, collision, registry) share one ADR
rather than fragmenting the rationale across three near-identical records.

## Consequences

### Positive

- The comparison logic is deterministic and free of I/O, so it can be verified
  exhaustively with property-based tests (idempotency of normalization, symmetry
  and range of Jaccard, symmetry of the verdict, mutual-reference requirement for
  acknowledged overlap).
- A single `runRegistryCheck` entry point guarantees `forge validate` and
  `forge guild sync` apply identical collision semantics; only exit-code and
  `--force` policy differ at the I/O edges.
- Splitting normalization, collision, and registry into separate modules keeps
  each function small, named, and independently testable, matching the pure
  conventions of ADR-0003.

### Negative

- Shape normalization is intentionally syntactic, not semantic: it will not catch
  collisions that differ only by alias or generic instantiation, and may treat
  two genuinely different shapes as equal if their canonical forms coincide. This
  is an accepted trade-off (Req 2D.2) to keep the core pure and deterministic.
- A new top-level `src/outcomes/` directory adds surface area that future
  contributors must learn alongside `src/adapters/` and `src/backends/`.

### Neutral

- The pure core depends only on the `Outcome` type already defined in
  `src/schemas.ts`; it adds no new runtime dependencies.
- The threshold for keyword Jaccard is a parameter (default 0.4) rather than a
  hard-coded constant, leaving room for future tuning without changing the
  module contract.
