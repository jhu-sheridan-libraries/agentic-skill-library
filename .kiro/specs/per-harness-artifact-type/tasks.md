# Implementation Plan: Per-Harness Artifact Type

## Overview

Replace the global `type` field with per-harness output format configuration. Implementation proceeds bottom-up: format registry → schema validation → adapters → catalog → wizard → browse SPA → deprecation warnings. Each step builds on the previous, and all code is wired together by the final tasks.

## Tasks

- [x] 1. Create the Format Registry module
  - [x] 1.1 Create `src/format-registry.ts` with `HarnessFormatDef` interface, `HARNESS_FORMAT_REGISTRY` constant, and `ResolveFormatResult` interface
    - Define the `HarnessFormatDef` type with `formats` (readonly string array) and `default` (string)
    - Define `HARNESS_FORMAT_REGISTRY` mapping each `HarnessName` to its valid formats and default, exactly as specified in the design: kiro (`steering`, `power`), cursor (`rule`), copilot (`instructions`, `agent`), claude-code (`claude-md`), windsurf (`rule`), cline (`rule`), qdeveloper (`rule`, `agent`)
    - Export the `ResolveFormatResult` interface with `format: string` and optional `deprecationWarning: string`
    - _Requirements: 2.1, 2.2_

  - [x] 1.2 Implement `resolveFormat()` function in `src/format-registry.ts`
    - Accept `harness: HarnessName` and `harnessConfig: Record<string, unknown> | undefined`
    - Read `harnessConfig.format` if present and return it
    - Handle Kiro backward compatibility: if harness is `kiro` and `harnessConfig.power === true` without a `format` field, resolve to `"power"` and return a `deprecationWarning` suggesting migration to `format: power`
    - Fall back to `HARNESS_FORMAT_REGISTRY[harness].default` when no `format` is specified
    - _Requirements: 2.3, 3.1, 3.2, 7.3_

  - [x] 1.3 Write unit tests for `resolveFormat()` and `HARNESS_FORMAT_REGISTRY`
    - Test that each harness returns its default format when no config is provided
    - Test explicit `format` field is returned as-is
    - Test Kiro `power: true` backward compatibility returns `format: "power"` with deprecation warning
    - Test Kiro `format: "power"` without `power: true` returns no deprecation warning
    - Test fallback to default for all seven harnesses
    - _Requirements: 2.2, 2.3, 3.1, 3.2, 7.3_

- [x] 2. Update schema validation for per-harness formats
  - [x] 2.1 Add `superRefine` to `FrontmatterSchema` in `src/schemas.ts` for per-harness format validation
    - Import `HARNESS_FORMAT_REGISTRY` from `src/format-registry.ts`
    - Add a `.superRefine()` pass that iterates `harness-config` keys; for each key that has a `format` field, validate it against `HARNESS_FORMAT_REGISTRY[harness].formats`
    - Produce a descriptive Zod error identifying the harness name, the invalid value, and the list of valid values
    - Ensure `.passthrough()` is preserved so existing harness-specific fields are not stripped
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 2.4_

  - [x] 2.2 Add `formatByHarness` to `CatalogEntrySchema` in `src/schemas.ts`
    - Add `formatByHarness: z.record(HarnessNameSchema, z.string()).optional()` to `CatalogEntrySchema`
    - Keep the existing `type` field unchanged for backward compatibility
    - _Requirements: 5.1, 5.2_

  - [x] 2.3 Write unit tests for schema validation changes
    - Test that valid `format` values per harness pass validation
    - Test that invalid `format` values produce descriptive errors with harness name and valid options
    - Test that omitting `format` passes validation (defaults apply)
    - Test that `CatalogEntrySchema` accepts entries with `formatByHarness`
    - Test that passthrough preserves extra harness-config fields alongside `format`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.2_

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update adapters to use `resolveFormat()`
  - [x] 4.1 Update the Kiro adapter (`src/adapters/kiro.ts`) to use `resolveFormat()`
    - Import `resolveFormat` from `../format-registry`
    - Replace `const isPower = kiroConfig.power === true` with `const { format, deprecationWarning } = resolveFormat("kiro", kiroConfig)`
    - Branch on `format === "power"` instead of `isPower`
    - Log or surface `deprecationWarning` if present (via adapter warnings)
    - _Requirements: 3.3, 3.6, 7.3_

  - [x] 4.2 Update the Copilot adapter (`src/adapters/copilot.ts`) to use `resolveFormat()`
    - Import `resolveFormat` from `../format-registry`
    - Call `resolveFormat("copilot", copilotConfig)` at the top
    - When `format` is `"agent"`, produce `AGENTS.md` output (currently conditional on `workflows.length > 0 || copilotConfig["agents-md"] === true`); when `"instructions"`, produce `copilot-instructions.md` output
    - _Requirements: 3.4_

  - [x] 4.3 Update the Q Developer adapter (`src/adapters/qdeveloper.ts`) to use `resolveFormat()`
    - Import `resolveFormat` from `../format-registry`
    - Call `resolveFormat("qdeveloper", qdeveloperConfig)` at the top
    - When `format` is `"agent"`, produce `.q/agents/` output; when `"rule"`, produce `.q/rules/` output
    - _Requirements: 3.5_

  - [x] 4.4 Update single-format adapters (cursor, claude-code, windsurf, cline) to call `resolveFormat()` for consistency
    - In each of `src/adapters/cursor.ts`, `src/adapters/claude-code.ts`, `src/adapters/windsurf.ts`, `src/adapters/cline.ts`: import `resolveFormat` and call it at the top of the adapter function
    - These always resolve to their single default format — no branching needed
    - _Requirements: 3.1, 3.2_

  - [x] 4.5 Write unit tests for adapter format resolution
    - Test Kiro adapter produces power output when `format: "power"` and steering output when `format: "steering"` or omitted
    - Test Kiro adapter backward compat: `power: true` still produces power output with deprecation warning
    - Test Copilot adapter produces `AGENTS.md` when `format: "agent"` and `copilot-instructions.md` when `format: "instructions"` or omitted
    - Test Q Developer adapter produces `.q/agents/` when `format: "agent"` and `.q/rules/` when `format: "rule"` or omitted
    - Test single-format adapters still produce correct output after the `resolveFormat` call
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 7.1_

- [x] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Update the Wizard for per-harness format prompting
  - [x] 6.1 Remove the global artifact type prompt from `src/wizard.ts`
    - Remove the `p.select` call for `artifactType` ("What kind of artifact is this?")
    - Remove the `type` assignment from the constructed `frontmatter` object (let schema default to `"skill"`)
    - _Requirements: 1.3_

  - [x] 6.2 Add harness descriptions to the harness multi-select in `src/wizard.ts`
    - Replace the plain `label: h` options with descriptive labels, e.g. `"kiro — Steering files or powers for Kiro IDE"`, `"copilot — Instructions or agents for GitHub Copilot"`, etc.
    - Import `HARNESS_FORMAT_REGISTRY` from `../format-registry` for reference
    - _Requirements: 4.1_

  - [x] 6.3 Add per-harness format prompts after harness selection in `src/wizard.ts`
    - After the harness multi-select, loop over selected harnesses
    - For each harness where `HARNESS_FORMAT_REGISTRY[harness].formats.length > 1`, prompt with `p.select` showing the valid format options with descriptions
    - Skip the prompt for single-format harnesses (cursor, claude-code, windsurf, cline)
    - Write non-default format selections into `harness-config.<harness>.format` in the generated frontmatter
    - Omit the `format` field when the user selects the default format to keep frontmatter minimal
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 6.4 Write unit tests for wizard changes
    - Test that the global type prompt is no longer called
    - Test that harness descriptions appear in the multi-select options
    - Test that format prompts are shown only for multi-format harnesses
    - Test that default format selections omit the `format` field from harness-config
    - Test that non-default format selections are written to harness-config
    - _Requirements: 1.3, 4.1, 4.2, 4.3, 4.5, 4.6_

- [x] 7. Update the Catalog generator
  - [x] 7.1 Update `src/catalog.ts` to populate `formatByHarness` in catalog entries
    - Import `HARNESS_FORMAT_REGISTRY` and `resolveFormat` from `./format-registry`
    - For each artifact, build `formatByHarness` by calling `resolveFormat` for each harness in the artifact's `harnesses` array, reading from the artifact's `harness-config`
    - Include `formatByHarness` in the `CatalogEntry` alongside the existing `type` field
    - _Requirements: 5.1, 5.2, 5.3, 7.4_

  - [x] 7.2 Write unit tests for catalog `formatByHarness` generation
    - Test that `formatByHarness` is populated with defaults when no `format` fields exist
    - Test that explicit `format` values are reflected in `formatByHarness`
    - Test that the `type` field is still present for backward compatibility
    - _Requirements: 5.1, 5.2, 5.3, 7.4_

- [x] 8. Update the Browse SPA
  - [x] 8.1 Update card view in `src/browse.ts` to display per-harness format labels
    - Replace the current `[harness]` labels with `[harness:format]` pairs using `formatByHarness` data (e.g., `[kiro:power]`, `[cursor:rule]`)
    - Fall back to just `[harness]` if `formatByHarness` is not present (backward compat with old catalog data)
    - _Requirements: 6.1_

  - [x] 8.2 Update detail view in `src/browse.ts` to show full `formatByHarness` mapping
    - In the detail view, display the `formatByHarness` mapping with descriptions of what each format produces
    - _Requirements: 6.2_

  - [x] 8.3 Replace the type filter with a format filter in `src/browse.ts`
    - Remove the `type-skill`, `type-power`, `type-rule` checkboxes
    - Collect all unique format values across all catalog entries' `formatByHarness` fields
    - Add format filter checkboxes that match artifacts where at least one harness uses the selected format
    - Update `filterAndRender()` to use the new format filter logic
    - _Requirements: 6.3_

  - [x] 8.4 Write unit tests for Browse SPA changes
    - Test that card rendering includes `harness:format` labels when `formatByHarness` is present
    - Test that the format filter correctly filters artifacts by format value
    - Test backward compatibility when `formatByHarness` is absent
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 9. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Add deprecation warning in validation
  - [x] 10.1 Update `src/validate.ts` to emit deprecation warning for top-level `type` without per-harness format
    - During `forge validate`, check if an artifact has a top-level `type` field set to a non-default value but no `format` in any `harness-config` section
    - If so, emit a deprecation warning advising migration to per-harness `format` fields
    - Surface format validation errors from the schema `superRefine` through the existing parse error path
    - _Requirements: 1.2, 7.1_

  - [x] 10.2 Write unit tests for validation deprecation warnings
    - Test that a deprecation warning is emitted when `type` is set without any `format` in harness-config
    - Test that no warning is emitted when `format` fields are present in harness-config
    - Test that no warning is emitted when `type` is omitted (defaults to `"skill"`)
    - _Requirements: 1.2, 7.1, 7.2_

- [x] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The design has no Correctness Properties section, so property-based tests are not included; unit tests cover all testing needs
- The format registry is the single source of truth — all other components import from it
