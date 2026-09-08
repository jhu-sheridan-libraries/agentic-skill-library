# ADR-0065: Unify `kanon import` and `rosetta translate` on one engine

**Date:** 2026-09-08
**Status:** Accepted
**Deciders:** kanon maintainers
**Relates to:** [ADR-0019](./0019-forge-import-auto-detecting-kiro-format-importer.md), [ADR-0048](./0048-config-driven-upstream-marketplace-sync.md), [ADR-0049](./0049-curation-preserving-upstream-reconciliation.md), [ADR-0064](./0064-structured-upstream-attribution.md), Rosetta Stone spec (`.kiro/specs/rosetta-stone/`)

## Context and Problem Statement

There were two front doors into the canonical `knowledge/` tree, and they were
two *parallel* translation paths rather than one:

- **`kanon import`** (`src/import.ts`) — the convenience importer for the three
  path-based Kiro/superpowers formats. Its `translateViaRosetta` called the
  source translators **by hand** (`translateKiroPower` / `translateKiroSkill` /
  `translateSuperpowers`), then `serializeCanonical`. It did NOT go through the
  engine, so it skipped the engine's request guard, registry-driven format
  resolution, and canonical-schema validation.

- **`kanon rosetta translate`** (`src/rosetta-cli.ts`) — the general translation
  command. It built a `TranslationRequest` and called
  `engine.translate(request)`, which runs the full pipeline (guard → registry
  resolution → source translation → canonical validation → plan). The batch
  re-sync path (`sync-upstream.sh`, per ADR-0048) drives *this* command.

The two doors shared the underlying translator functions but not the engine, so
behavior could drift: anything added to the engine pipeline (validation,
diagnostics, future defaulting) reached `rosetta translate` but not `import`,
and vice versa. ADR-0064's attribution work exposed the concrete cost — the
attribution capture wired into `import.ts` never ran on the `sync-upstream.sh`
batch path, because that path is `rosetta translate`, a different door.

## Decision

**`kanon import` becomes a thin shell over the shared Rosetta Stone engine.**
Its `translateViaRosetta` now builds an inbound `TranslationRequest` and calls
`getSharedEngine().translate()` — the identical engine instance
`rosetta translate` uses — instead of invoking the source translators directly.

Two supporting changes make this a single seam rather than two engine copies:

1. **Shared engine bootstrap** (`src/rosetta/engine-bootstrap.ts`). The cached
   `getSharedRegistry()` / `getSharedTemplates()` / `getSharedEngine()` factory
   is extracted here. `rosetta-cli.ts` and `import.ts` both import it, so there
   is one registry snapshot and one engine instance process-wide. `rosetta-cli`
   keeps thin local `getRegistry()` / `getTemplates()` aliases only where it
   reads `registry.version` / passes `registrySnapshot`.

2. **The facade owns only post-translation decoration.** For an inbound request
   the engine returns the validated `canonical` `KnowledgeArtifact` and **no
   plan** (a plan is only built on the outbound/transcode target phase). The
   import facade takes that validated artifact and applies the concerns that are
   genuinely the importer's: CLI-injected `collections`, the machine-managed
   `provenance` record for acquisition imports (ADR-0049), the attribution block
   (ADR-0064, first-import-only), and then `serializeCanonical`. The imperative
   shell — `--all` scanning, format/auto detection, collision/skip, dry-run,
   destination override — stays in `import.ts`.

## Considered Options

- **Option A (chosen)** — make `import` a shell over `engine.translate`. One
  engine, one validated-canonical seam, both CLIs converge. Largest change,
  correct end state.
- **Option B** — lift attribution/provenance into the engine's plan step so both
  doors emit them, but leave `import` calling translators by hand. Closes the
  ADR-0064 batch gap but leaves the two translation paths structurally distinct.
- **Option C** — document the two paths and rely on the backfill command for
  corpus-wide credit. No integration; the drift risk stays.

## Consequences

- **Positive** — `import` now inherits the engine's request guard and
  canonical-schema validation for free; a canonical-invalid candidate is
  reported as a skip rather than written. The two doors cannot silently diverge
  because they share one engine and one registry snapshot. A convergence test
  (`import-engine-convergence.test.ts`) pins byte-identical canonical output
  between the import facade and a direct `engine.translate` + `serializeCanonical`
  run of the same source.
- **Neutral** — the batch `sync-upstream.sh` path is still `rosetta translate`.
  This ADR unifies the *engine*, not the two CLI shells; wiring attribution into
  the `rosetta translate` write path (so the batch path captures attribution
  without a separate backfill) remains a follow-up, now cheap because both doors
  share the engine seam.
- **Negative** — `import.ts` and `rosetta-cli.ts` now both depend on
  `engine-bootstrap.ts`; the bootstrap's cached snapshot is process-wide, so a
  test that mutates templates on disk must call `resetSharedEngineCache()` to
  avoid a stale snapshot (that reset seam is provided for exactly this case).

## Links

- `src/rosetta/engine-bootstrap.ts` — the shared bootstrap
- `src/import.ts` — `translateViaRosetta` now drives `getSharedEngine()`
- `src/rosetta-cli.ts` — delegates registry/engine to the shared bootstrap
- `src/__tests__/import-engine-convergence.test.ts` — the convergence invariant
