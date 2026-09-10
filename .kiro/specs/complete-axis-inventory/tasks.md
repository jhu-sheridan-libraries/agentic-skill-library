# Implementation Plan: Complete Axis Inventory

## Overview

Close the classification model: name the full 10-axis set, map **every** `FrontmatterSchema` field to exactly one axis in a single `FIELD_AXIS` registry, and extend the `checkModelInvariants` guard so total coverage is mechanically enforced. This is a classification-and-enforcement refactor only — no field's Zod definition, default, or runtime behavior changes, and all build/catalog output stays byte-identical. Implementation is TypeScript + Zod on Bun, tested with `fast-check` property tests and `bun:test` unit tests. Depends on the `vendor-neutral-formats-categories` spec (which introduced `checkModelInvariants`, the `domains`/`skill-md` work, and the Property-12 guard this generalizes).

Each property test carries the comment `Feature: complete-axis-inventory, Property {N}: {title}`.

## Tasks

- [ ] 1. Define the axis model and the `FIELD_AXIS` registry
  - [ ] 1.1 Add the `Axis` type, `INTRINSIC_AXES` set, and `FIELD_AXIS` map (`src/model-axes.ts`)
    - `Axis` union of the ten axes; `INTRINSIC_AXES` = the eight intrinsic axes; `FIELD_AXIS` mapping every current `FrontmatterSchema` field to exactly one axis per the design table
    - Derive `EDGE_OR_VENDOR_BEARING` from `FIELD_AXIS` (origin + destination fields), replacing the prior spec's hard-coded `VENDOR_BEARING_FIELDS`
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.5_
  - [ ] 1.2 Assign the Intrinsic-axis fields
    - `type`→structure; `categories`→craft; `domains`→subject; `ecosystem`→applicability; `depends`/`enhances`→relation
    - `trust`/`risk-level`/`license`/`audience`/`model-assumptions`/`visibility`→governance; `maturity`/`version`/`successor`/`replaces`/`migrations`→lifecycle; `name`/`displayName`/`description`/`keywords`/`author`/`id`/`priority`/`collections`→presentation
    - _Requirements: 3.1, 4.1, 5.1, 6.1, 6.2, 6.3_
  - [ ] 1.3 Assign the Edge-axis fields
    - `provenance`/`attribution`→origin; `harnesses`/`inclusion`/`file_patterns`/`harness-config`/`inherit-hooks`/`outcomes`→destination
    - _Requirements: 7.1, 7.5_

- [ ] 2. Derive the schema field set for coverage checking
  - [ ] 2.1 Add `frontmatterFieldNames()` reading `FrontmatterSchema._def.shape()` keys (`src/model-axes.ts` or `src/schemas.ts`)
    - Authoritative list of declared fields; used by the coverage check and the guard test so there is no second hand-maintained list
    - _Requirements: 2.1, 8.2_

- [ ] 3. Extend `checkModelInvariants` to consult the registry (`src/validate.ts`)
  - [ ] 3.1 Add the Total_Coverage check (ERROR)
    - Error naming any `FrontmatterSchema` field missing from `FIELD_AXIS`; error naming any `FIELD_AXIS` key that is not a schema field
    - _Requirements: 2.3, 2.4, 8.1, 8.2, 8.5_
  - [ ] 3.2 Generalize INV-1 to all Intrinsic-axis fields (WARNING for authored metadata)
    - For every field whose `FIELD_AXIS` axis ∈ `INTRINSIC_AXES`, warn if any value equals a `Harness_Name`; treat a `Harness_Name` as a `type` value as an INV-1 violation
    - Preserve the built-in-registry `harness` self-check as an ERROR (unchanged from prior spec)
    - _Requirements: 3.5, 4.4, 5.4, 6.4, 8.4, 8.5_
  - [ ] 3.3 Wire `EDGE_OR_VENDOR_BEARING` (from 1.1) as the INV-3 exemption set
    - Vendor/`Harness_Name` values permitted only on origin+destination fields; confirm `inclusion`/`file_patterns`/`harness-config`/`inherit-hooks`/`outcomes` are now exempt alongside `harnesses`
    - _Requirements: 7.2, 7.4_

- [ ] 4. Generalize the extensibility guard (Property 2)
  - [ ] 4.1 Update the guard test to compare the full field set, not just intrinsic fields
    - Assert `frontmatterFieldNames()` set equals `Object.keys(FIELD_AXIS)` set; adding any field without a `FIELD_AXIS` entry fails
    - **Property 2: Closed under growth**
    - File: `src/__tests__/axis-inventory.property.test.ts`
    - **Validates: Requirements 1.4, 8.2, 8.3**
  - [ ] 4.2 Write property test: Total coverage (Property 1)
    - **Property 1: Total coverage — every field is on exactly one axis**
    - Schema field-set === `FIELD_AXIS` key-set; no field mapped twice; injected mismatch errors
    - File: `src/__tests__/axis-inventory.property.test.ts`
    - **Validates: Requirements 1.1, 2.1, 2.2, 2.3, 2.4**

- [ ] 5. Checkpoint — model + guard green
  - Run `bun test`, `bun x tsc --noEmit`, `bun run lint`; confirm `checkModelInvariants` reports clean Total_Coverage over the real corpus and that removing/adding a `FIELD_AXIS` entry fails the guard. Ask the user if questions arise.
  - _Requirements: 2.1, 8.1, 8.2_

- [ ] 6. Ratify and verify `type` as the Structure axis
  - [ ] 6.1 Confirm no output-format meaning on `type`
    - Audit that `resolveFormat` / adapters never branch on `frontmatter.type` for output format (ratifying ADR-0051); add a guard/comment if any coupling is found
    - _Requirements: 3.2, 3.3, 7.3_
  - [ ] 6.2 Write property test: `type` carries no output-format meaning (Property 5)
    - **Property 5: `type` carries no output-format meaning**
    - Vary `type` across valid `AssetType` values; assert resolved export format (from `harness-config.<harness>.format` + fallbacks) is unchanged
    - File: `src/__tests__/type-structure.test.ts`
    - **Validates: Requirements 3.2, 3.3, 7.3**
  - [ ] 6.3 Document `power` as a Destination concept misfiled onto Structure
    - Kept as a backward-compat alias for `skill`; captured in the ADR (see task 9)
    - _Requirements: 3.4_

- [ ] 7. Intrinsic-axis and edge tests
  - [ ] 7.1 Write property test: No vendor on any intrinsic axis (Property 3)
    - **Property 3: No vendor on any intrinsic axis**
    - Inject a `Harness_Name` on each intrinsic field in turn; assert each is flagged (warning for authored metadata)
    - Extend `src/__tests__/model-invariants.property.test.ts`
    - **Validates: Requirements 3.5, 4.4, 5.4, 6.4, 8.4**
  - [ ] 7.2 Write property test: Vendor confined to edge fields (Property 4)
    - **Property 4: Vendor confined to edge fields**
    - Assert `EDGE_OR_VENDOR_BEARING` derived from `FIELD_AXIS` exactly equals the origin+destination field set
    - In `model-invariants.property.test.ts`
    - **Validates: Requirements 7.1, 7.2, 7.4**
  - [ ] 7.3 Example tests: axis presence/banding, ecosystem/relation placements, unresolved-ref warning preserved
    - All 10 axes present with correct intrinsic/edge banding; `ecosystem`→applicability (harness value warns); `depends`/`enhances`→relation and the ADR-0007 unresolved-reference warning still fires
    - File: `src/__tests__/axis-inventory.test.ts` (+ `validate.test.ts` for the reference warning)
    - _Requirements: 1.1, 1.2, 4.1, 4.4, 5.1, 5.5_
  - [ ] 7.4 Example test: `outcomes` placed on Destination as a capability contract
    - _Requirements: 7.5_

- [ ] 8. Backward compatibility verification (Property 6)
  - [ ] 8.1 Write test + CI diff: placement preserves behavior
    - **Property 6: Placement preserves behavior (backward compatibility)**
    - No Zod definition/default/behavior changed; full `bun run dev build` (all harnesses) and `bun run dev catalog generate` before/after diff empty; existing artifacts validate identically except genuine new INV-1/coverage diagnostics
    - File: `src/__tests__/backcompat-axes.test.ts` + whole-catalog CI diff
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**

- [ ] 9. Documentation and decision record
  - [ ] 9.1 Add the authoritative axis table to contributor docs
    - One place listing all ten axes, their question, and their fields; state the placement rule (every field on exactly one axis; vendor only on Edge axes)
    - _Requirements: 10.1, 10.2, 6.5, 9.5_
  - [ ] 9.2 Write property test: Axis map is single-sourced (Property 7)
    - **Property 7: Axis map is single-sourced**
    - Docs axis table field→axis assignments equal `FIELD_AXIS`; mismatch fails
    - File: `src/__tests__/axis-docs-sync.test.ts`
    - **Validates: Requirements 10.1, 10.2**
  - [ ] 9.3 Add the worked-artifact example (fields sorted by axis)
    - Annotate a real catalog artifact (e.g. `jhsomcv`) axis-by-axis in the docs
    - _Requirements: 10.5_
  - [x] 9.4 Write ADR-0069 — "Complete axis inventory for frontmatter classification"
    - Drafted at `kanon/docs/adr/0069-complete-axis-inventory-for-frontmatter-classification.md` (Status: Proposed) and added to the ADR index
    - Records the 10-axis model and total-mapping rule; ratifies `type`=Structure (builds on ADR-0014, ratifies ADR-0051); documents `ecosystem`/`depends`/`enhances`/`outcomes` placements and the `outcomes`→Destination rationale; builds on ADR-0007; generalizes the prior spec's ADR-0067/0068
    - _Requirements: 1.4, 3.4, 7.5, 10.3, 10.4_
  - [ ] 9.5 Add a changelog fragment
    - One `added` fragment for the complete axis model + total-coverage guard
    - _Requirements: 10.3_

- [ ] 10. Final verification — the model is complete, orthogonal, and closed
  - Full `bun test` (property tests ≥100 runs) and `bun x tsc --noEmit` pass; `bun run dev validate` (+`--security`) clean for all artifacts; `checkModelInvariants` reports clean Total_Coverage; whole-catalog build+catalog before/after diff empty; confirm P1 (complete), P2 (closed under growth), P3/P4 (vendor only at edge), P5 (`type` no output-format meaning), P6 (backward compat), P7 (docs single-sourced) all pass.
  - _Requirements: 1.1, 2.1, 8.2, 8.3, 9.3, 9.4_
