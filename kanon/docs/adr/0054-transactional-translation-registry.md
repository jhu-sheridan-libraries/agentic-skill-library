# ADR-0054: Transactional translation registry with atomic registration and frozen snapshots

## Status

Accepted

## Date

2026-07-25

## Context

Rosetta Stone needs a single typed registry that replaces multiple independent format registries (`HARNESS_FORMAT_REGISTRY`, `adapterRegistry`, importer registry) with one authoritative source. Registration must be safe: a failed registration (duplicate identifiers, missing translators, invalid contracts) must not corrupt previously registered formats. Consumers need deterministic, frozen query results.

The design document (ADR-RS-002) specified "one immutable registry the source of truth" but did not prescribe the implementation pattern.

## Decision

Implement the registry as a builder/freeze pair:

1. **`createRegistryBuilder(version)`** produces a mutable builder that validates and commits registrations atomically.
2. **`register(extension)`** validates all constraints (contract version, unique IDs/aliases, direction-implied translators, variant consistency, detection rules, normalization uniqueness) *before* mutating state. On any failure, prior state is untouched.
3. **`freeze()`** produces an immutable `TranslationRegistrySnapshot` with deeply-frozen contracts, deterministic code-point ordering, and function-based query/resolve methods.
4. If diagnostic construction itself throws during validation, the builder returns a minimal `RegistryFailure` containing no untrusted values — never crashes.
5. Built-in format contracts are declared as static data in `src/rosetta/builtins/contracts.ts` and registered during application bootstrap.
6. Legacy `auto` is a selection alias (separate namespace), not a format contract.

## Consequences

### Positive

- Atomic registration: no half-registered formats can corrupt the registry
- Frozen snapshots: consumers cannot accidentally mutate shared state
- Deterministic queries: results are sorted by code-point order, stable across calls
- RegistryFailure fallback: the registry never panics, even on internal errors
- Static built-in catalog: all 12 formats are declared as data, easily auditable

### Negative

- Registration is all-or-nothing per contract; partial contract updates require re-registration
- The freeze boundary means late-registered extensions need a new builder/snapshot cycle
- Built-in contracts duplicate some data from `CAPABILITY_MATRIX` and `ASSET_HARNESS_COMPATIBILITY` (by design, to be reconciled during migration)

### Neutral

- The builder pattern is familiar from Rust/Go patterns for immutable data structures
- Legacy registries become projections or facades during the migration period
