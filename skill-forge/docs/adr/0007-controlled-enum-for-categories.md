# ADR-0007: Controlled Enum for Categories, Freeform for Ecosystem and Dependencies

## Status

Proposed

## Date

2026-04-11

## Context

The catalog metadata evolution feature adds three new metadata dimensions to knowledge artifacts: categories, ecosystem targeting, and inter-artifact dependency graph. We needed to decide the validation strategy for each field — specifically whether to use a controlled vocabulary (enum) or freeform strings.

Categories represent a fixed domain taxonomy (testing, security, code-style, etc.) where consistency across the catalog is critical for faceted filtering. Ecosystem and dependency fields represent open-ended values — languages, frameworks, and artifact names — that cannot be enumerated upfront.

Spec: .kiro/specs/catalog-metadata-evolution/design.md

## Decision

Use a Zod enum (`CategoryEnum`) for the `categories` field with 9 initial values. Invalid category values produce schema validation errors. Use freeform kebab-case strings (regex `^[a-z0-9]+(-[a-z0-9]+)*$`) for `ecosystem`, `depends`, and `enhances` fields. The enum is extensible by appending values to the `CATEGORIES` tuple.

## Consequences

### Positive

- Category values are guaranteed consistent across all artifacts — no typos or near-duplicates
- Ecosystem and dependency fields can grow organically without schema changes
- Kebab-case regex ensures machine-readable, URL-safe values across all freeform fields

### Negative

- Adding a new category requires a code change to the `CATEGORIES` tuple
- No validation that ecosystem values are real languages/frameworks (author responsibility)

### Neutral

- The pattern is consistent with how Zod handles enums vs. string patterns elsewhere in the codebase (e.g., `HarnessNameSchema` is also an enum)
