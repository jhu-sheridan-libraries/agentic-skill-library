# Implementation Plan: Complete Axis Inventory

## ⚠️ MANDATORY - READ BEFORE EVERY TASK ⚠️

**YOU MUST FOLLOW THESE RULES FOR EVERY TASK:**

1. **Shell Commands**: Use `controlPwshProcess` ONLY. NEVER use `executePwsh`.
2. **Gap Analysis**: Perform TWO gap analysis passes BEFORE marking any task complete.
3. **Show Your Work**: Gap analysis must be visible in your response.

If you skip any of these, you have violated the protocol.

---

## Overview

Implement a total inventory over Kanon's recognized canonical frontmatter keys, using `getKnownFrontmatterKeys()` and a single `FIELD_AXIS` registry. Preserve schema and runtime behavior. The refreshed model is informed by Academic Research Skills' scoped behavior/control/channel dimensions and SciAgent-Skills' category/subtype/tag/resource separation, but it does not add those external fields to Kanon.

## Development Principles

**IMPORTANT**: Follow these principles strictly during implementation:

1. **Build ugly and working before making it clean**
   - Get it working first
   - Refactor later if needed
   - Don't optimize prematurely

2. **If something isn't specified, ask - don't invent**
   - No assumptions
   - No "improvements"
   - No "I noticed we could also..."

3. **Build exactly what's specified. Nothing more.**
   - No extra features
   - No extra abstractions
   - No extra config options

4. **Stop and ask if stuck for 10+ minutes**
   - Don't waste time debugging hallucinated APIs
   - Use Context7 to check library docs
   - Ask for clarification on ambiguous requirements

5. **Property tests are optional for MVP**
   - Tasks marked with `*` can be skipped
   - Focus on getting core functionality working
   - Add comprehensive tests in v2

## Non-Requirements (What NOT to Build)

❌ New frontmatter fields such as `domains`, `sub_type`, `tags`, `mode`, or `channel`

❌ Changes to category values, asset types, outcome kinds, or defaults

❌ Recursive vendor-name scanning across descriptions or other free text

❌ Catalog or browse facets for the new axis names

❌ Classification of arbitrary passthrough extension keys

❌ Adapter, format, compatibility, or degradation changes

**System Characteristics:**

✅ One authoritative field-to-axis map

✅ Bidirectional canonical-key parity

✅ Recognized passthrough keys included

✅ Unknown passthrough fields preserved but excluded

✅ Documentation and proposed ADR synchronized

## Context7 MCP Usage (CRITICAL)

**Before writing ANY code that uses a library, query Context7 for current documentation.**

**Required libraries to query Context7 for:**

- `zod` - Public object-key and refinement APIs if schema-key derivation must change
- `fast-check` - Only if optional property tests are implemented

**Don't assume you know the API. Don't use outdated patterns. Check Context7 first.**

---

## Tasks

- [ ] 1. Establish the canonical key boundary
  - [ ] 1.1 Add a focused parity test for `getKnownFrontmatterKeys()` covering declared optional/defaulted keys and recognized `harness-config`
  - [ ] 1.2 Replace or derive the parser's deprecated `KNOWN_FRONTMATTER_FIELDS` authority so parser and Rosetta classify known versus extra fields identically
  - [ ] 1.3 Verify unknown passthrough keys still round-trip through `extraFields`
  - _Requirements: 2.1-2.5, 8.6, 9.1_

- [ ] 2. Add the axis registry
  - [ ] 2.1 Create `src/model-axes.ts` with `AxisName`, `AxisDefinition`, and readonly `FIELD_AXIS`
  - [ ] 2.2 Map Identity, Structure, Classification, Applicability, and Relation fields exactly as designed
  - [ ] 2.3 Map Governance, Lifecycle, Behavior, Origin, and Distribution fields exactly as designed
  - [ ] 2.4 Derive grouped axis definitions from `FIELD_AXIS` or add an equality guard against duplicate hand-maintained field lists
  - _Requirements: 1.1-1.5, 3.1-3.7, 4.1-4.5, 5.1-5.4, 6.1-6.5, 7.1-7.5_

- [ ] 3. Implement deterministic inventory validation
  - [ ] 3.1 Add `validateAxisInventory(knownFields, fieldAxis)` as a pure function returning typed missing/stale diagnostics
  - [ ] 3.2 Report all differences once, sorted deterministically
  - [ ] 3.3 Wire the self-check into the narrowest existing validation or test boundary without generating duplicate per-artifact diagnostics
  - [ ] 3.4 Confirm the implementation does not inspect arbitrary field values for harness-name strings
  - _Requirements: 8.1-8.6_

- [ ] 4. Add targeted tests
  - [ ] 4.1 Test real Canonical_Key set equality with `FIELD_AXIS`
  - [ ] 4.2 Test missing and stale assignments, including multiple simultaneous differences
  - [ ] 4.3 Test recognized and unknown passthrough boundaries
  - [ ] 4.4 Test `type` changes do not alter per-harness `resolveFormat()` results
  - [ ]* 4.5 Add `fast-check` properties for finite set differences and unknown extension-key round trips
  - _Requirements: 2.1-2.5, 3.4, 8.1-8.6, 9.1-9.5_

- [ ] 5. Refresh documentation and ADR-0069
  - [ ] 5.1 Publish the authoritative ten-axis table and cardinality/source-of-truth notes
  - [ ] 5.2 Add the Kanon/Academic Research Skills/SciAgent-Skills comparison, clearly separating observations from Kanon decisions
  - [ ] 5.3 Add a worked Kanon artifact and a hypothetical profile/tag extension
  - [ ] 5.4 Update proposed ADR-0069 to remove `domains`, place `collections` on Relation and `outcomes` on Behavior, and use the canonical-key boundary
  - [ ] 5.5 Add a changelog fragment
  - _Requirements: 10.1-10.6_

- [ ] 6. Verify behavior preservation
  - [ ] 6.1 Run targeted axis, parser, Rosetta canonical, schema round-trip, and format-resolution tests
  - [ ] 6.2 Run `bun x tsc --noEmit` and `bun run lint`
  - [ ] 6.3 Run `bun run dev validate` and `bun run dev validate --security`
  - [ ] 6.4 Generate catalog and build all harnesses; confirm no semantic output change attributable to the inventory
  - [ ] 6.5 Perform two visible gap-analysis passes: first against every acceptance criterion, then against the reference-repository lessons and non-requirements
  - _Requirements: 9.1-9.5, 10.1-10.6_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3", "5"] },
    { "id": 3, "tasks": ["4"] },
    { "id": 4, "tasks": ["6"] }
  ]
}
```

Tasks 3 and 5 may proceed in parallel after task 2. Task 6 depends on all prior tasks.

## Notes

- Property-based task 4.5 is optional; deterministic unit coverage is required.
- Do not mark an implementation task complete until its two visible gap-analysis passes are complete.
- ADR-0069 is already Proposed but must be refreshed before acceptance.
