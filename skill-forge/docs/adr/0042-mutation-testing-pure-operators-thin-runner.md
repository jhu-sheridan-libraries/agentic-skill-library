# ADR-0042: Mutation testing as pure operators + delta/history core with a thin I/O runner

## Status

Proposed

## Date

2026-06-12

## Context

The mutation-testing requirement (Req 5 of the nWave forge integration) introduces
`forge eval --mutation`, which verifies that the test suite actually *kills* bugs
rather than merely covering lines. The feature has several distinct concerns that
mix deterministic computation with unavoidable I/O:

- **Mutant generation** — given a source file, produce a bounded, deterministic set
  of single-site mutations using five operators (statement deletion, conditional
  boundary, arithmetic replacement, string-literal modification, return-value
  alteration), capped at 50 per file (Req 5.3).
- **Delta selection** — given the adapter files and the files changed since the
  last recorded run, decide which modules to mutate (Req 5.6).
- **History serialization** — serialize/parse one JSON record per line for the
  `mutation-history.jsonl` trend log (Req 5.8).
- **Run orchestration** — discover adapter files, apply each mutant, run `bun test`
  with a per-mutant timeout, classify killed/survived, compute the kill rate,
  report survivors, and persist the run (Req 5.1, 5.2, 5.4, 5.5, 5.9, 5.10).

The first three concerns are pure and correctness-critical; the fourth is
inherently I/O-bound (subprocess execution, `git diff`, filesystem writes, clocks).
No existing ADR covers mutation testing. ADR-0041 establishes the pure-core /
thin-I/O-shell pattern for the outcomes registry, and ADR-0003 establishes pure
functions as the house style for adapters. This decision extends that same pattern
to a new `src/mutation/` subsystem.

## Decision

Implement the mutation-testing subsystem under `src/mutation/` as a **pure core**
plus a **thin I/O runner**, mirroring ADR-0041:

- `src/mutation/operators.ts` — `generateMutants(filePath, source, operators, cap?)`
  and the `Mutant` interface. Pure, deterministic, and capped (default 50 per
  file). Each operator locates candidate sites in the source and emits a mutant
  whose `mutatedSource` differs from the original at **exactly one** site.
  Operators scan a *masked* view of the source (string literals and comments
  blanked out) so that relational/arithmetic operators are never matched inside
  strings or comments, keeping generation deterministic and well-targeted.
- `src/mutation/delta.ts` — `selectDeltaTargets(adapterFiles, changedFiles)`, the
  pure intersection used by the `--delta` strategy.
- `src/mutation/history.ts` — `serializeRecord` / `parseHistory` (pure JSONL
  round-trip) plus an `appendRecord` I/O helper.
- `src/mutation/runner.ts` — the only I/O surface: adapter discovery, applying
  mutants, spawning `bun test` with a 30s timeout, kill/survive classification,
  `computeKillRate`, survivor reporting, and `git diff` / history persistence.

The pure core (operators, delta, history serialization) carries the
correctness-critical logic and can be verified exhaustively with property-based
tests (cap never exceeded, single-site difference, determinism). The runner owns
clocks, subprocesses, git, and the filesystem, and threads the kill-rate threshold
exit code.

This ADR records the architecture of the whole `src/mutation/` subsystem so the
implementing tasks (operators, delta, history, runner, CLI wiring) share one ADR
rather than fragmenting the rationale across several near-identical records.

## Consequences

### Positive

- Mutant generation, delta selection, and history serialization are deterministic
  and I/O-free, so they can be verified with property-based tests (operator output
  is bounded by the cap, every mutant differs at exactly one site, and identical
  inputs always yield identical mutants).
- Confining subprocess execution, `git`, clocks, and filesystem writes to
  `runner.ts` keeps the rest of the subsystem trivially testable and matches the
  pure conventions of ADR-0003 and ADR-0041.
- A single `Mutant` shape produced by the pure operators drives both test
  execution and survivor reporting, so the report cannot drift from what was run.

### Negative

- The operators use a lightweight masked-source scan rather than a full TypeScript
  AST. This is deterministic and dependency-free, but it relies on the
  Biome-formatted house style (spaces around binary operators, semicolon-terminated
  statements) and can miss or mis-target sites in unusual formatting. Mutants that
  happen to be syntactically invalid simply fail to compile and are counted as
  killed, so correctness of the kill-rate is preserved even when a mutant is
  low-quality.
- A new top-level `src/mutation/` directory adds surface area that future
  contributors must learn alongside `src/adapters/`, `src/backends/`, and
  `src/outcomes/`.

### Neutral

- The mutant cap (default 50 per file) and the kill-rate threshold (default 0.80)
  are parameters rather than hard-coded constants, leaving room for tuning without
  changing the module contracts.
- The pure core depends only on the `MutationOperator` type already defined in
  `src/config.ts`; it adds no new runtime dependencies.
