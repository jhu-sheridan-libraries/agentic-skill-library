# Implementation Plan: Codeshop Spec Integration

## Overview

Add 6 spec-aware hooks to the codeshop knowledge artifact's `harness-config.kiro.spec-hooks` frontmatter, extend the `knowledge.md` body with Spec Mode Integration documentation in the Skill Router and Workflow Composition sections, and validate the integration with property-based and example-based tests. All changes target `skill-forge/knowledge/codeshop/knowledge.md` — no source code, adapter, or template changes are needed.

## Tasks

- [x] 1. Add spec-hooks array to knowledge.md frontmatter
  - [x] 1.1 Add the 6 spec-hook entries to `harness-config.kiro.spec-hooks` in `skill-forge/knowledge/codeshop/knowledge.md` frontmatter
    - Add the `spec-hooks` array under `harness-config.kiro` (after `format: power`)
    - Define hooks in precedence order: Plan Stress Test, Bugfix Triage Context, Domain Concept Validation, TDD Task Detection, Post-Task Code Review, Post-Task Commit Guidance
    - Each entry must have `name`, `version` ("1.0.0"), `description`, `when.type` (preTaskExecution or postTaskExecution), and `then.type` ("askAgent") with `then.prompt`
    - Each pre-task hook prompt must include: context statement, detection criteria with keyword list, match branch (load steering file), no-match branch (proceed normally), and closing either/or directive
    - Each post-task hook prompt must be unconditional and end with a concrete directive
    - Hook 1 (Plan Stress Test): preTaskExecution, detects first task (task 1 / task 1.1), loads `stress-test-plan.md`
    - Hook 2 (Bugfix Triage Context): preTaskExecution, detects bugfix keywords (bugfix, bug, fix, regression, defect, broken), loads `triage-bug.md`
    - Hook 3 (Domain Concept Validation): preTaskExecution, detects domain keywords (new type, new interface, new entity, new aggregate, bounded context, domain event, value object, new module, new model), loads `challenge-domain-model.md`
    - Hook 4 (TDD Task Detection): preTaskExecution, detects test keywords (test, spec, TDD, red-green, assertion, coverage, unit test, integration test, property test), loads `drive-tests.md`
    - Hook 5 (Post-Task Code Review): postTaskExecution, unconditional, loads `review-changes.md`
    - Hook 6 (Post-Task Commit Guidance): postTaskExecution, unconditional, loads `craft-commits.md`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 8.1, 8.2, 11.1, 11.2, 11.3_

  - [x] 1.2 Write property tests for spec-hook compilation (Properties 1–3)
    - Create `skill-forge/src/__tests__/codeshop-spec-hooks.property.test.ts`
    - Use `fast-check` with `bun:test` (follow patterns from `schema-roundtrip.property.test.ts`)
    - **Property 1: Spec-hook compilation cardinality** — For any array of N valid spec-hook entries, the Kiro adapter emits exactly N `.kiro.hook` files from the spec-hooks path
    - **Validates: Requirements 8.3, 12.1**
    - **Property 2: Spec-hook output schema validity** — For any valid spec-hook entry, the compiled `.kiro.hook` file contains valid JSON preserving all input fields unchanged
    - **Validates: Requirements 8.2, 12.2**
    - **Property 3: Hook name to filename kebab-case transformation** — For any hook name, the emitted filename equals `name.toLowerCase().replace(/\s+/g, "-") + ".kiro.hook"`
    - **Validates: Requirements 8.4, 12.3**

  - [x] 1.3 Write property test for canonical hook preservation (Property 4)
    - Add to `skill-forge/src/__tests__/codeshop-spec-hooks.property.test.ts`
    - **Property 4: Canonical hooks preserved alongside spec-hooks** — For any artifact with both canonical hooks and spec-hooks, the canonical `.kiro.hook` files are identical whether or not spec-hooks are present
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 12.4**

- [x] 2. Checkpoint - Verify frontmatter and property tests
  - Ensure all property tests pass (`bun test codeshop-spec-hooks.property`), ask the user if questions arise.

- [x] 3. Add Spec Mode Integration subsection to Skill Router in knowledge.md body
  - [x] 3.1 Add "Spec Mode Integration" subsection after the existing skill category tables in the Skill Router section
    - Add a table listing each spec-hook: hook name, Kiro event (preTaskExecution/postTaskExecution), codeshop workflow loaded, and detection criteria
    - Note that these hooks fire automatically during spec task execution and do not require manual invocation
    - Document precedence: Plan Stress Test fires first for the first task, then TDD Task Detection fires for test-related content; post-task hooks fire after all pre-task hooks
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 3.2 Add spec-driven chains to Workflow Composition section in knowledge.md body
    - Add "Spec-Driven Development Chain": `stress-test-plan` → `drive-tests` → `review-changes` → `craft-commits`
    - Add "Spec Bugfix Chain": `triage-bug` → `journal-debug` → `drive-tests`
    - Note that these chains are activated automatically by spec-hooks (unlike the manually-invoked chains)
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 4. Checkpoint - Verify knowledge.md body changes
  - Ensure the knowledge.md body contains the Spec Mode Integration subsection and the two spec-driven chains. Ask the user if questions arise.

- [x] 5. Write example-based unit tests
  - [x] 5.1 Create example-based unit tests for the 6 spec-hooks and knowledge.md content
    - Create `skill-forge/src/__tests__/codeshop-spec-hooks.test.ts`
    - Test each of the 6 spec-hooks has correct event type (`preTaskExecution` or `postTaskExecution`)
    - Test each spec-hook references the correct steering file in its prompt
    - Test each pre-task hook prompt contains both match and no-match branches
    - Test each hook prompt ends with a concrete either/or directive
    - Test the spec-hooks array has exactly 6 entries
    - Test the 8 canonical hooks in hooks.yaml are unchanged (count and names)
    - _Requirements: 1.1–1.4, 2.1–2.4, 3.1–3.4, 4.1–4.4, 5.1–5.4, 6.1–6.4, 7.1–7.5, 8.1–8.4, 11.1–11.3_

  - [x] 5.2 Write integration test for full build pipeline
    - Add to `skill-forge/src/__tests__/codeshop-spec-hooks.test.ts` (or separate file)
    - Run `bun run dev build --harness kiro` and verify `dist/kiro/codeshop/` contains all 14 hook files (8 canonical + 6 spec)
    - Verify each `.kiro.hook` file is valid JSON
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 6. Final checkpoint - Run all tests and verify build
  - Run `bun test` to ensure all tests pass (existing + new). Run `bun run dev build --harness kiro` and verify the output. Ask the user if questions arise.
  - Ensure the Onboarding section contains

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All changes target `skill-forge/knowledge/codeshop/knowledge.md` — no changes to `src/schemas.ts`, `src/adapters/kiro.ts`, or templates
- The Kiro adapter already handles `spec-hooks` compilation (see `kiroAdapter` spec-hooks loop in `kiro.ts`)
- Property tests exercise the `kiroAdapter` pure function directly with generated spec-hook entries
- Example tests parse the actual `knowledge.md` frontmatter and body to validate authored content
- `hooks.yaml` must remain unchanged — all 8 canonical hooks are preserved as-is
