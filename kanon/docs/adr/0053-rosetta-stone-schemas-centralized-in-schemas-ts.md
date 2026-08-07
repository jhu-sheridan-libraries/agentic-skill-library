# ADR-0053: Rosetta Stone schemas centralized in schemas.ts

## Status

Accepted

## Date

2026-07-24

## Context

Rosetta Stone introduces a large family of new data models: format contracts, translation requests, detection evidence, translation plans, diagnostics, compatibility profiles, machine-output envelopes, profiles, and provenance records. These schemas must be consumed by the registry, translators, orchestration, CLI, and machine output — every layer of the system.

The project already centralizes all public Zod schemas in `src/schemas.ts` (ADR-002). We needed to decide whether Rosetta Stone schemas should follow the same pattern or live in a separate module closer to their implementation (e.g., `src/rosetta/schemas.ts`).

## Decision

All Rosetta Stone public data shapes are defined in `src/schemas.ts` alongside existing Kanon schemas, using Zod `.strict()` objects with inferred TypeScript types exported for each schema. Rosetta modules may compose but never redefine public shapes.

Primitive schemas (identifiers, paths, versions), domain objects (format contracts, detection rules, translation diagnostics), request/result envelopes, profiles, and provenance all live in the single central schema file.

Key design rules:
- Object schemas use `.strict()` unless an explicit extension map exists
- Compatibility profiles enforce completeness via Zod refinement against the `CanonicalCapabilitySchema` enum
- The `NormalizedRelativePathSchema` uses `superRefine` to validate path safety (no traversal, NFC, forward-slash only)
- Recursive `JsonValueSchema` uses `z.lazy()` for JSON-compatible values
- Translation requests use `z.discriminatedUnion("mode", ...)` for type-safe dispatch
- Existing schemas (`SupportLevelSchema`, `DegradationStrategySchema`, `KnowledgeArtifactSchema`) are reused where semantically appropriate

## Consequences

### Positive

- Single import path for all public types across the entire codebase
- Type inference works seamlessly — consumers import one module
- Schema co-location makes cross-referencing and refinement composition straightforward
- Consistent validation strategy (strict objects, refined enums) across old and new schemas
- Registry, translators, and CLI share exact same types without adapter layers

### Negative

- `schemas.ts` grows substantially (~900 additional lines for Rosetta Stone)
- Contributors must scroll past unrelated schemas when editing
- Merge conflicts are more likely in a single large file

### Neutral

- Internal implementation modules (registry, detector, translators) re-export types from schemas but define no public shapes of their own
- The schema file is append-only for Rosetta Stone; existing schemas are never modified
