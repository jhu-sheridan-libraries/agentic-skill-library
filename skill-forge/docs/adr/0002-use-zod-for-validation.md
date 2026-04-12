# ADR-0002: Use Zod for Runtime Validation and Type Inference

## Status

Accepted

## Date

2026-04-10

## Context

Knowledge artifacts are authored as YAML frontmatter and YAML config files. We need to validate this user-authored input at runtime before it enters the adapter pipeline. We also want TypeScript types derived from the same source of truth to avoid schema/type drift.

Alternatives considered: Joi, Yup, io-ts, manual validation.

## Decision

Use Zod schemas as the single source of truth for all data models. All parsed YAML and frontmatter passes through Zod validation before entering the adapter pipeline. TypeScript types are inferred from schemas via `z.infer<>`.

Key schemas: `FrontmatterSchema` (with `.passthrough()` for unknown fields), `CanonicalHookSchema`, `McpServerDefinitionSchema`, `KnowledgeArtifactSchema`, `CatalogEntrySchema`.

## Consequences

### Positive

- Single source of truth for validation rules and TypeScript types
- Clear, path-aware error messages for invalid input
- `.passthrough()` preserves unknown frontmatter fields for template context without schema changes
- Discriminated unions (`CanonicalActionSchema`) provide exhaustive type narrowing

### Negative

- Adds a runtime dependency (~50KB)
- Contributors need to learn Zod's API for schema changes

### Neutral

- Zod is widely adopted in the TypeScript ecosystem and well-documented
