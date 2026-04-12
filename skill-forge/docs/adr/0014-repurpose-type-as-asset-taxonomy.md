# ADR-0014: Repurpose `type` Field as Asset Taxonomy

**Date:** 2026-04-12
**Status:** Proposed
**Deciders:** skill-forge maintainers
**Supersedes:** [ADR-0012](./0012-deprecate-global-type-for-per-harness-format.md)

## Context and Problem Statement

ADR-0012 proposed deprecating the top-level `type` field because it was being
conflated with harness output format — `"power"` in `type` was functioning as
an output-format hint for Kiro rather than a meaningful asset classification.
ADR-0012 correctly moved output format to `harness-config.<harness>.format`.

However, as the project evolves toward a knowledge bazaar (a multi-asset
package registry), a genuine need for asset taxonomy emerges: distinguishing
workflows from agents from prompts from reference packs is necessary for
discovery, type-aware validation, collection curation, and multi-harness
publishing. Deleting `type` would remove a natural home for this concern.

The real problem ADR-0012 solved — output format conflation — is already
resolved by the format registry. What remains is a clean field to carry asset
classification.

## Decision Drivers

- The bazaar plan requires typed packages: powers, skills, workflows, agents,
  prompts, templates, reference-packs
- Type-aware validation rules differ per asset type (e.g. `reference-pack`
  must use `inclusion: manual`; `workflow` should have a `workflows/` dir)
- Discovery metadata depends on asset type (audience, risk-level interpretations
  vary by type)
- ADR-0012's core fix (format in `harness-config`) is already implemented and
  orthogonal to this field

## Considered Options

1. **Repurpose `type` as asset taxonomy** — expand the enum, remove the
   deprecation warning, keep output format in `harness-config`
2. **Follow ADR-0012 and fully remove `type`** — add a separate `asset-type`
   field for taxonomy
3. **Do nothing** — keep `type` with 3 values and add a separate `asset-type`
   field alongside it

## Decision Outcome

**Chosen option: Option 1 — repurpose `type` as asset taxonomy**, because:
- The field already exists and has the right semantics when decoupled from
  output format
- Adding a separate `asset-type` alongside `type` (Option 3) would create
  confusion and duplication
- Renaming to `asset-type` (Option 2 variant) breaks backward compatibility
  with no benefit since the existing values (`skill`, `power`, `rule`) remain
  valid taxonomy terms

The `type` enum is expanded to:
`skill | power | rule | workflow | agent | prompt | template | reference-pack`

The deprecation warning in `validate.ts` that fired when `type != "skill"`
without a per-harness format is removed. Output format continues to live
exclusively in `harness-config.<harness>.format`. `ArtifactTypeSchema` is
kept as a backward-compatible alias of the new `AssetTypeSchema`.

### Positive Consequences

- `type` carries real semantic weight: authors classify what kind of artifact
  they are publishing, not which harness output to target
- Type-aware validation rules can be expressed per asset type
- Discovery and collection features in later bazaar phases have a typed anchor
- Existing artifacts continue to work unchanged (`"skill"` remains the default)

### Negative Consequences / Trade-offs

- ADR-0012 is superseded after having been proposed but before being accepted —
  the decision cycle was short
- The deprecation warning emitted by ADR-0012's implementation is removed,
  meaning authors who relied on it to guide migration to `format` lose the
  nudge (mitigated: per-harness format is the only way to control output, so
  the migration is complete for any artifact that was using it)

## Options Analysis

### Option 1: Repurpose `type` as asset taxonomy
**Pros:** No new field, clean extension of existing schema, backward-compat
**Cons:** ADR-0012 must be superseded; asset type and output format are now
fully orthogonal (good architecture, but requires discipline to keep separate)

### Option 2: Remove `type`, add `asset-type`
**Pros:** Clean break, unambiguous naming
**Cons:** Breaking change; migration burden for existing artifacts; no benefit
over repurposing since the existing values remain valid taxonomy terms

### Option 3: Keep `type` at 3 values + add separate `asset-type`
**Pros:** Strict backward compat at schema level
**Cons:** Two fields with overlapping semantics; confusing for authors

## Links and References

- Supersedes: [ADR-0012](./0012-deprecate-global-type-for-per-harness-format.md)
- Relates to: [ADR-0007](./0007-controlled-enum-for-categories.md) (pattern for controlled enums)
- Relates to: [ADR-0013](./0013-centralized-format-registry.md) (output format stays in registry, orthogonal to type)
- Implementation: `skill-forge/src/schemas.ts` — `AssetTypeSchema`, `ArtifactTypeSchema` alias
- Implementation: `skill-forge/src/validate.ts` — deprecation warning removed
- Branch: main
