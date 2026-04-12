# ADR-0015: Knowledge Bazaar Shared Manifest — Phase 1 Governance and Discovery Fields

**Date:** 2026-04-12
**Status:** Proposed
**Deciders:** skill-forge maintainers
**Supersedes:** N/A

## Context and Problem Statement

Skill Forge is evolving from a single-harness compilation tool into a knowledge
bazaar — a typed, discoverable package registry for AI coding harness
configurations. The current manifest carries authoring metadata (name, version,
keywords) but lacks the governance and discovery vocabulary needed to support:

- Maturity signaling (is this experimental or production-grade?)
- Trust classification (official/partner/community/experimental governance lanes)
- Risk assessment (does this artifact invoke MCP servers or execute commands?)
- Audience targeting (beginner vs. advanced)
- Model assumptions (which AI providers/models this artifact targets)
- Lifecycle links (deprecation successor, what this artifact replaces)
- Namespaced identity (scoped `@org/name` IDs for multi-vendor registries)

Without these fields, the catalog cannot support faceted discovery, trust-based
filtering, or deprecation lifecycle management.

## Decision Drivers

- Phase 1 of the bazaar roadmap is schema-additive: zero breaking changes to
  existing artifacts
- All new fields must have sensible defaults so existing artifacts need no edits
- Governance enforcement (e.g. `official` requires allowlisted author) belongs
  in Phase 3 validation — Phase 1 only defines the vocabulary
- Field names must be kebab-case, consistent with existing schema conventions
- The catalog browser should be able to surface maturity and trust metadata
  immediately without waiting for Phase 3

## Considered Options

1. **Add all bazaar fields in Phase 1 as optional with defaults** — chosen
2. **Defer all bazaar fields until Phase 3** — leaner early schema
3. **Use a nested `bazaar:` block** — namespace isolation for new fields

## Decision Outcome

**Chosen option: Option 1 — add all fields in Phase 1 as optional with defaults**,
because Phase 1 is the schema definition phase of the roadmap. Adding the
vocabulary now allows artifact authors to start tagging their content while
validation, enforcement, and collection features are built in later phases.
The `.passthrough()` on `FrontmatterSchema` already tolerates unknown fields,
so adding optional fields with defaults is zero-risk for existing consumers.

The following optional fields are added to `FrontmatterSchema` and
`CatalogEntrySchema`:

| Field | Type | Default | Purpose |
|---|---|---|---|
| `id` | `@org/name` string | (omitted) | Namespaced registry identity |
| `license` | SPDX string | (omitted) | License for redistribution |
| `maturity` | `experimental\|beta\|stable\|deprecated` | `experimental` | Lifecycle stage |
| `trust` | `official\|partner\|community\|experimental` | (omitted) | Governance lane |
| `risk-level` | `low\|medium\|high` | (omitted) | Execution risk signal |
| `audience` | `beginner\|intermediate\|advanced` | (omitted) | Skill level targeting |
| `model-assumptions` | `string[]` | `[]` | AI model/provider hints |
| `successor` | artifact name | (omitted) | Replacement when `maturity: deprecated` |
| `replaces` | artifact name | (omitted) | What this artifact supersedes |

A lifecycle validation rule is added immediately: `maturity: deprecated` without
`successor` produces a warning during `forge validate`. All other enforcement
(trust lane allowlists, MCP security warnings for high-risk artifacts) is
deferred to Phase 3.

Option 3 (nested `bazaar:` block) was rejected because Zod's `.passthrough()`
schema already handles unknown fields gracefully, and a flat namespace is
consistent with how `harness-config` uses hyphened top-level keys. Nesting
would also require structural changes to the parser and scaffold template.

### Positive Consequences

- Artifact authors can start enriching content with governance metadata
  immediately after Phase 1 ships
- The catalog browser can show maturity badges and trust lane labels without
  waiting for Phase 3
- Phase 3 enforcement (trust lane rules, MCP security warnings, governance
  gates) has a fully defined schema to build against
- All new fields default to safe values — no existing artifact is invalidated

### Negative Consequences / Trade-offs

- The manifest schema grows by 9 fields before enforcement logic exists; fields
  may be ignored or misused until Phase 3 validates them
- `maturity: experimental` is the default, which means all existing artifacts
  are implicitly labeled experimental (accurate, but authors may not have
  consciously chosen this label)
- The `formatByHarness` field in `CatalogEntrySchema` was changed from
  `Record<HarnessName, string | undefined>` to `Record<string, string>` as part
  of this work — a minor type relaxation that improves ergonomics without
  changing runtime behavior

## Options Analysis

### Option 1: Add all fields in Phase 1
**Pros:** Authors can start tagging now; schema stable before enforcement code;
catalog browser gets immediate value
**Cons:** Fields sit without enforcement until Phase 3; schema breadth may
confuse authors unfamiliar with the bazaar roadmap

### Option 2: Defer to Phase 3
**Pros:** Leaner schema in early phases; no unused fields
**Cons:** Phase 3 would require editing all existing artifacts to add fields;
validation and collection features must bootstrap their own schema mid-flight

### Option 3: Nested `bazaar:` block
**Pros:** Namespace isolation; clear separation from authoring fields
**Cons:** Inconsistent with existing flat schema conventions (`harness-config`
is already a nested block for a different purpose); harder to query in the
catalog JSON; requires parser changes

## Links and References

- Relates to: [ADR-0007](./0007-controlled-enum-for-categories.md) (controlled
  enums — `maturity`, `trust`, `risk-level`, `audience` follow the same pattern)
- Relates to: [ADR-0014](./0014-repurpose-type-as-asset-taxonomy.md) (both are
  Phase 1 bazaar schema additions; type taxonomy is the asset classification
  axis, these fields are the governance/discovery axis)
- Relates to: [ADR-0002](./0002-use-zod-for-validation.md) (all new fields
  implemented as Zod schemas following established patterns)
- Implementation: `skill-forge/src/schemas.ts` — `MaturitySchema`,
  `TrustLaneSchema`, `RiskLevelSchema`, `AudienceSchema`, new fields on
  `FrontmatterSchema` and `CatalogEntrySchema`
- Implementation: `skill-forge/src/catalog.ts` — new fields propagated to
  catalog entries
- Implementation: `skill-forge/src/validate.ts` — `maturity: deprecated`
  lifecycle warning
- Implementation: `skill-forge/src/browse.ts` — maturity badges and trust lane
  labels in catalog UI
- Implementation: `skill-forge/templates/knowledge/knowledge.md.njk` —
  commented-out stubs for new fields in scaffold template
- Branch: main
