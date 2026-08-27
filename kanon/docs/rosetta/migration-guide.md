# Migration Guide

> Step-by-step guide for migrating legacy import, adapter, format, build, and sync
> interfaces to Rosetta Stone.

## Migration Overview

Rosetta Stone replaces five independent subsystems with one coherent component:

| Legacy Interface | Rosetta Stone Equivalent | Status |
|---|---|---|
| `src/import.ts` | Source translators + orchestrator | Facade complete |
| `src/importers/` | Harness-native source translators | Facade complete |
| `src/adapters/` | Target translators + template bundles | Routed through RS |
| `HARNESS_FORMAT_REGISTRY` | Registry format contracts | Projected from RS |
| `scripts/sync-upstream.sh` | Validated profiles + orchestrator | In progress |
| `scripts/sync-kiro-powers.sh` | Retired — use `sync-upstream.sh kiro-powers` | Removed |
| drift scripts (`compare-*`, `diff-*`) | `kanon rosetta backfill` + reconcile report | Removed |

## Migration Stages

Each legacy interface follows this progression:

### Stage 1: Characterize

Document the current behavior with fixture-based regression tests that pin
exact bytes, diagnostics, exit codes, and option behavior.

```bash
# Run regression tests for legacy interfaces
bun test src/__tests__/rosetta-legacy-*.test.ts
```

### Stage 2: Introduce Core

Implement the pure translation logic in `src/rosetta/` with property tests
and unit tests. The core runs independently of legacy code.

### Stage 3: Migrate Inbound

Replace internal parsing logic in `src/import.ts` and `src/importers/` with
calls to Rosetta Stone source translators via the `TranslationOrchestrator`.

```typescript
import { createEngine, createRegistryBuilder } from "./rosetta";

// Legacy import.ts now delegates to the engine
const result = engine.translate({
  mode: "inbound",
  documents: scannedDocuments,
  sourceFormat: detectedFormat,
});
```

### Stage 4: Migrate Outbound

Route `adapterRegistry` calls through target translators. Preload immutable
template bundles and map `TranslationPlan` output back to `AdapterResult`.

```typescript
import { createEngine } from "./rosetta";

// Legacy adapter call now delegates to the engine
const result = engine.translate({
  mode: "outbound",
  artifact: canonicalArtifact,
  targetFormat: "cursor",
  variant: "default",
  templateBundle: frozenBundle,
});
```

### Stage 5: Expose CLI

Add `kanon rosetta formats|detect|inspect|translate` commands that use the
engine directly, without legacy facades.

```bash
# New CLI commands available
kanon rosetta formats --json
kanon rosetta detect ./path/to/artifact
kanon rosetta translate ./artifact --from kiro-power --to cursor --dry-run
```

### Stage 6: Switch Defaults

Update `kanon build` and `kanon import` to use Rosetta Stone by default.
Legacy paths remain available during the compatibility window.

### Stage 7: Retire Facades

Remove compatibility facades and legacy-only code paths once the compatibility
window closes. This is the only stage that removes public API surface.

## Interface-Specific Migration

### `src/import.ts` (Path-Based Import)

**Before:** Hardcoded format detection, manual frontmatter mapping, inline
collision handling.

**After:** Compatibility facade preserving `--all`, `--format`, `--collection`,
`--knowledge-dir`, `--collision`, `--destination`, and `--dry-run` while
delegating to source translators.

Key behavioral preservation:
- `auto` detection uses the registry's format detector
- Collection filtering applied after canonical validation
- Collision policy evaluated by the orchestrator, not the translator
- Deprecation guidance emitted for `format: auto`

### `src/importers/` (Harness-Native Import)

**Before:** Per-harness scanner with inline parsing, confirmation prompts,
deterministic multi-file grouping.

**After:** Compatibility facade preserving scanning, harness filtering,
confirmation, `--force`, `--destination`, `--dry-run`, and parser exports.
Pure parsing delegated to registered source translators.

### `src/adapters/` (Target Adapters)

**Before:** Pure adapter functions receiving `KnowledgeArtifact` + Nunjucks
`Environment`, returning `AdapterResult` with files and warnings.

**After:** Target translators receive artifact + frozen template bundle +
resolved variant + effective compatibility actions. The adapter registry maps
`TranslationPlan` files/diagnostics back to `AdapterResult` for backward
compatibility.

### `HARNESS_FORMAT_REGISTRY` / `resolveFormat`

**Before:** Independent format declarations with variants, defaults, and
sorted valid choices.

**After:** Registry projections from frozen format contracts. Public types,
harness names, variants, defaults, and Kiro power deprecation behavior
preserved through projections.

### `scripts/sync-upstream.sh`

**Before:** Untyped configuration, inline Git operations, direct invocation
of `kanon import`.

**After:** Validated named profiles (`AcquisitionProfile` + `TranslationProfile`)
with pre-acquisition validation. Git operations remain in shell; the script
consults `kanon rosetta` for format/translation concerns.

```bash
# Legacy: untyped inline config
kanon import --all --format auto --source ./upstream/skills

# New: validated named profile
kanon rosetta translate ./upstream/skills --profile upstream-kiro --dry-run
```

### `scripts/sync-kiro-powers.sh` and the drift scripts (retired)

`scripts/sync-kiro-powers.sh` was superseded by the config-driven, multi-profile
`sync-upstream.sh` (ADR-0048) and is removed. Run the equivalent sync with the
named profile:

```bash
# Legacy: single-purpose script
./scripts/sync-kiro-powers.sh

# New: config-driven profile
./scripts/sync-upstream.sh kiro-powers
```

The four hand-maintained drift-comparison scripts
(`compare-kiro-powers.sh`, `compare-kiro-powers-full.sh`, `diff-kiro-body.sh`,
`diff-kiro-steering.sh`) are removed (ADR-0049). Their job — detecting how a
distilled artifact diverged from upstream — is now handled mechanically by the
provenance backfill plus the reconciliation report:

```bash
# One-time: record provenance for existing distilled artifacts
kanon rosetta backfill --dry-run   # preview
kanon rosetta backfill             # write provenance + seed the base cache

# Thereafter: re-sync reconciles curated artifacts against upstream by provenance
./scripts/sync-upstream.sh kiro-powers
```

## Compatibility Window

During migration, both paths coexist:

- Legacy commands continue to work with identical behavior
- New `kanon rosetta` commands provide the same capabilities with explicit contracts
- Deprecation diagnostics guide users to the new interface
- Regression tests verify behavioral equivalence

The compatibility window closes when:
1. All fixture regression tests pass through the new path
2. No external consumers depend on legacy-only behavior
3. A changelog fragment documents the removal
