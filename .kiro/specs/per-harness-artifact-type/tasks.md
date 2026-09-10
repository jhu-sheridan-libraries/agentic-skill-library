# Implementation Plan: Per-Harness Artifact Type

## ⚠️ MANDATORY - READ BEFORE EVERY TASK ⚠️

**YOU MUST FOLLOW THESE RULES FOR EVERY TASK:**

1. **Shell Commands**: Use `controlPwshProcess` ONLY. NEVER use `executePwsh`.
2. **Gap Analysis**: Perform TWO gap analysis passes BEFORE marking any task complete.
3. **Show Your Work**: Gap analysis must be visible in your response.

If you skip any of these, you have violated the protocol.

---

## Overview

Reconcile the historically implemented per-harness format feature with the current nine-harness, Rosetta-driven architecture. Preserve canonical Asset_Type, derive native formats from contracts, and make compatibility and capability degradation explicit parallel dimensions. Existing implementation is a baseline to audit, not proof that stale historical tasks remain correct.

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

❌ Deprecating or removing canonical `type`

❌ Adding SciAgent subtype values to `AssetTypeSchema`

❌ Adding distribution-channel frontmatter

❌ Hand-authoring a second format registry beside Rosetta contracts

❌ Treating format availability as proof of full type or feature support

❌ Replacing type filtering with format filtering

❌ Changing output paths outside their owning Format_Contracts

**System Characteristics:**

✅ Nine supported harnesses

✅ Contract-derived variants and defaults

✅ Independent type compatibility, format, and feature capability planes

✅ Explicit degradation for non-full support

✅ Legacy Kiro compatibility with targeted warnings

✅ Type and format exposed as parallel catalog facets

## Context7 MCP Usage (CRITICAL)

**Before writing ANY code that uses a library, query Context7 for current documentation.**

**Required libraries to query Context7 for:**

- `zod` - Harness-keyed records and passthrough/refinement behavior
- `commander` - Only if command behavior or options change
- `@clack/prompts` - Wizard select and multiselect behavior

**Don't assume you know the API. Don't use outdated patterns. Check Context7 first.**

---

## Tasks

- [ ] 1. Baseline current authorities and superseded behavior
  - [ ] 1.1 Record the nine `SUPPORTED_HARNESSES`, current contract-projected variants/defaults, adapter registrations, capability rows, and compatibility policy
  - [ ] 1.2 Identify and remove remaining assumptions that top-level `type` is deprecated or that the wizard should omit canonical type
  - [ ] 1.3 Verify browse implementation references `browse-ui.ts` and current output paths come from Rosetta contracts
  - _Requirements: 1.1-1.6, 2.1-2.5, 7.5_

- [ ] 2. Enforce contract-to-format parity
  - [ ] 2.1 Add a pure query that identifies the one target/bidirectional built-in contract for each supported Harness
  - [ ] 2.2 Validate exactly one projected registry entry per supported Harness and no extras
  - [ ] 2.3 Validate projected variants/default equal contract variants/default
  - [ ] 2.4 Cover Codex and Gemini CLI explicitly in parity tests
  - _Requirements: 2.1-2.5, 8.1-8.3_

- [ ] 3. Reassert canonical type independence
  - [ ] 3.1 Confirm wizard prompts for canonical Asset_Type and excludes only deprecated `power`
  - [ ] 3.2 Remove any validation warning for ordinary top-level type without explicit format; retain targeted `type: power` guidance
  - [ ] 3.3 Test that varying Asset_Type across valid values never changes `resolveFormat()` for fixed harness config
  - [ ] 3.4 Confirm compatibility and content conventions still consume Asset_Type where intended
  - [ ]* 3.5 Add a property test over all Asset_Type/Harness pairs for format independence
  - _Requirements: 1.1-1.6, 3.4, 9.1-9.5_

- [ ] 4. Validate the three support planes
  - [ ] 4.1 Add supported-harness parity checks for adapter registry, format projection, capability matrix, and compatibility policy
  - [ ] 4.2 Test the compatibility matrix's omitted-cell default policy and document every intentional omission class
  - [ ] 4.3 Add contradiction checks that allow documented generic-output cases but reject accidental full-support overclaims
  - [ ] 4.4 Verify every non-full feature capability declares `inline`, `comment`, or `omit` degradation
  - [ ] 4.5 Verify strict and non-strict build behavior for `none` and `partial` type compatibility
  - _Requirements: 4.1-4.8, 8.1-8.5_

- [ ] 5. Harden harness-config validation and round trips
  - [ ] 5.1 Test all explicit valid variants and all nine defaults against the projected registry
  - [ ] 5.2 Test invalid diagnostics include harness, invalid value, and valid values
  - [ ] 5.3 Decide and implement the explicit policy for unsupported `harness-config` keys
  - [ ] 5.4 Preserve extra harness-specific keys through canonical parse/serialize and Rosetta round trips
  - [ ] 5.5 Verify explicit Kiro format overrides the legacy `power` flag and legacy-only config warns
  - _Requirements: 3.1-3.5, 5.1-5.5, 9.3-9.5_

- [ ] 6. Align wizard behavior
  - [ ] 6.1 Derive the harness list from `SUPPORTED_HARNESSES`
  - [ ] 6.2 Derive multi-format prompts from projected registry cardinality
  - [ ] 6.3 Confirm prompts appear for Kiro, Codex, Copilot, and Q Developer and are skipped for single-format harnesses
  - [ ] 6.4 Explain canonical type versus representation in prompt copy and generated examples
  - [ ] 6.5 Preserve omission of explicit default formats where configured
  - _Requirements: 6.1-6.6_

- [ ] 7. Align catalog and browse facets
  - [ ] 7.1 Constrain `formatByHarness` behavior to selected supported harnesses and resolved variants
  - [ ] 7.2 Test every catalog format value equals `resolveFormat()`
  - [ ] 7.3 Keep canonical type filtering and add/preserve format filtering as an independent facet
  - [ ] 7.4 Preserve graceful rendering for catalogs without `formatByHarness`
  - [ ] 7.5 Display compatibility/degradation context without implying native parity
  - _Requirements: 7.1-7.6_

- [ ] 8. Document the model and decision delta
  - [ ] 8.1 Publish a generated or checked nine-harness format/default table
  - [ ] 8.2 Publish the distinction among Asset_Type, future Artifact_Profile, Asset_Compatibility, Output_Format, Feature_Capability, and Distribution_Channel
  - [ ] 8.3 Document SciAgent category/subtype/tag separation and Academic Research Skills channel/control degradation as informing evidence, not imported schema
  - [ ] 8.4 Add or update an ADR superseding the old global-type-deprecation and static seven-harness decisions
  - [ ] 8.5 Add a changelog fragment
  - _Requirements: 8.5, 10.1-10.4_

- [ ] 9. Final verification
  - [ ] 9.1 Run targeted format registry, Rosetta contract, schema, wizard, compatibility, capability, catalog, browse, and adapter tests
  - [ ] 9.2 Run `bun x tsc --noEmit` and `bun run lint`
  - [ ] 9.3 Run `bun run dev validate` and `bun run dev validate --security`
  - [ ] 9.4 Build all harnesses and verify every emitted format matches its contract and selected configuration
  - [ ] 9.5 Perform two visible gap-analysis passes: first against all acceptance criteria, then against the reference-repository distinctions and non-requirements
  - _Requirements: 1.1-10.4_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2", "3", "4"] },
    { "id": 2, "tasks": ["5", "6", "7"] },
    { "id": 3, "tasks": ["8"] },
    { "id": 4, "tasks": ["9"] }
  ]
}
```

Tasks 2, 3, and 4 may proceed in parallel after task 1. Tasks 5 through 7 depend on the relevant authority checks. Task 9 depends on all prior tasks.

## Notes

- Existing checked history from the original spec is treated as baseline evidence, not current completion status.
- Property-based task 3.5 is optional; all nine harnesses and all canonical asset types still require deterministic coverage.
- Do not mark an implementation task complete until its two visible gap-analysis passes are complete.
