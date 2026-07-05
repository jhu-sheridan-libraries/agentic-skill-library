# ADR-0029: Importers Module for Multi-Harness Parsers

## Status

Proposed

## Date

2026-04-23

## Context

The existing `src/import.ts` handles importing Kiro powers (`POWER.md`) and
Kiro skills (`SKILL.md`) with auto-detection, `--all`, `--dry-run`, `--format`,
`--collections`, and `--knowledge-dir` options (see ADR-0019).

The 10-star features spec extends import to support all 7 harness-native formats.
The design document initially stated "Import extends `src/import.ts`" to keep
import logic centralized. However, adding 6 additional harness parsers — each
with distinct file detection, content extraction, and field mapping logic —
would make `src/import.ts` unwieldy (currently ~250 lines, would grow to 800+).

Additionally, the multi-harness import introduces new type abstractions
(`ImportedFile`, `ImportParser`, `ImporterRegistry`) that are conceptually
distinct from the existing `ImportResult` and `ImportOptions` types which
describe CLI-level results (files written, workflows copied, skip reasons).

## Decision

Introduce a `src/importers/` module containing:

- `types.ts` — shared interfaces for the multi-harness import system
  (`ImportedFile`, `ImportResult`, `ImportParser`, `ImporterRegistry`)
- `index.ts` — the importer registry, auto-detection, and orchestration
- Per-harness parser files (`kiro.ts`, `claude-code.ts`, `copilot.ts`, etc.)

The existing `src/import.ts` remains as the CLI command handler and delegates
to `src/importers/` for multi-harness scanning and parsing. This follows the
same pattern as `src/adapters/` (per-harness output adapters) and
`src/backends/` (per-protocol install/publish backends).

## Consequences

### Positive

- Each harness parser is isolated in its own file — easy to test and maintain
- The `ImporterRegistry` type mirrors the `adapterRegistry` pattern, providing
  consistency across the codebase
- `src/import.ts` stays focused on CLI orchestration and Kiro-specific legacy
  import paths
- New harness parsers can be added without modifying existing parser files

### Negative

- Two import-related modules (`src/import.ts` and `src/importers/`) may cause
  initial confusion — mitigated by clear naming and the ADR
- The `ImportResult` type in `src/importers/types.ts` is distinct from the
  existing `ImportResult` in `src/import.ts` (the former describes parsed
  content, the latter describes CLI output) — naming collision requires care

### Neutral

- Follows established patterns: `src/adapters/` for output, `src/importers/`
  for input, `src/backends/` for transport
