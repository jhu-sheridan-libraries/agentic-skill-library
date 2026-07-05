# ADR-0013: Centralized Format Registry as Single Source of Truth

## Status

Proposed

## Date

2026-04-11

## Context

With the introduction of per-harness output formats (ADR-0012), each harness now defines its own set of valid format values and a default. This format knowledge is needed in multiple places: schema validation (to reject invalid format values), adapters (to resolve the active format), the wizard (to show format options), and the catalog generator (to populate `formatByHarness`).

Without a centralized definition, format knowledge would be scattered across these four subsystems. Adding a new harness or changing a harness's valid formats would require coordinated edits in multiple files, increasing the risk of inconsistency.

This decision was motivated by the per-harness artifact type spec (`.kiro/specs/per-harness-artifact-type/`).

## Decision

Introduce a `src/format-registry.ts` module that exports:

1. **`HARNESS_FORMAT_REGISTRY`** — A static `Record<HarnessName, HarnessFormatDef>` mapping each harness to its valid formats and default. This is the single source of truth for format definitions.

2. **`resolveFormat(harness, harnessConfig)`** — A pure function that reads `harnessConfig.format`, handles backward compatibility (Kiro's `power: true` flag), and falls back to the registry default. Returns a `ResolveFormatResult` with the resolved format and an optional deprecation warning.

All consumers import from this module rather than defining their own format logic:
- `schemas.ts` uses the registry for `superRefine` validation
- Each adapter calls `resolveFormat()` at the top of its function
- The wizard reads `HARNESS_FORMAT_REGISTRY` to determine which harnesses need format prompts
- The catalog generator calls `resolveFormat()` to build `formatByHarness`

This follows the same pattern as ADR-0003 (adapters as pure functions) — `resolveFormat` is a pure function with no side effects, making it independently testable.

## Consequences

### Positive

- Adding a new harness or format requires editing only `format-registry.ts` — all consumers pick it up automatically
- Format validation, resolution, and prompting are guaranteed to stay in sync
- The `resolveFormat` function encapsulates backward compatibility logic (Kiro `power: true`) in one place
- Easy to test — the registry is a constant and `resolveFormat` is a pure function

### Negative

- Introduces a new module that all format-aware code depends on (tight coupling to the registry)
- The registry is static — if a future requirement needs dynamic format discovery (e.g., plugin-contributed formats), this design would need to evolve

### Neutral

- Single-format harnesses (cursor, claude-code, windsurf, cline) still call `resolveFormat()` for consistency, even though they always get their single default
