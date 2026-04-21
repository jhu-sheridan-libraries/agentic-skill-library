# ADR 0028: Capability Matrix Co-Located with Adapters

## Status

Accepted

## Date

2026-04-22

## Context

Skill Forge needs a machine-readable capability matrix declaring what each harness supports beyond output formats (hooks, MCP, path_scoping, workflows, toggleable_rules, agents, file_match_inclusion, system_prompt_merging) and how to handle unsupported features via degradation strategies.

The design document originally suggested `src/capability-matrix.ts` co-located with `src/format-registry.ts`. However, the capability matrix is consumed primarily by the adapter layer during compilation, and the degradation engine (`src/adapters/degradation.ts`) will live in the adapters directory. Co-locating the matrix with the adapters keeps related concerns together.

Existing per-harness metadata modules:
- `src/format-registry.ts` — output format definitions per harness
- `src/compatibility.ts` — asset-type compatibility per harness
- `src/adapters/` — per-harness compilation logic

## Decision

Place the capability matrix in `src/adapters/capabilities.ts`:

1. **Typed TypeScript constant validated by Zod** — The matrix is a `Record<HarnessName, Record<HarnessCapabilityName, CapabilityEntry>>` validated at module load time using the `CapabilityEntrySchema` from `src/schemas.ts`.
2. **Co-located with adapters** — Since the matrix is consumed by adapters during build and the degradation engine lives in `src/adapters/degradation.ts`, placing it in `src/adapters/capabilities.ts` keeps the dependency graph tight.
3. **Extends per-harness metadata story** — Alongside `format-registry.ts` (formats) and `compatibility.ts` (asset-type support), this module declares feature-level capabilities per harness.

## Consequences

- Adapters can import capabilities without reaching outside their directory boundary.
- The `validateMatrixSync()` function ensures the matrix stays in sync with the adapter registry and format registry.
- External consumers (temper, browse API, validate) import from `src/adapters/capabilities.ts`.
