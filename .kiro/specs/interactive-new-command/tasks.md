# Implementation Plan: Interactive New Command

## Overview

Transform `forge new` into a guided interactive wizard using `@clack/prompts`, add a `forge tutorial` command for first-time users, and wire everything together with validation, file writing, and comprehensive tests. Each task builds incrementally — utility functions first, then the wizard, then file writing, then CLI integration, then the tutorial.

## Tasks

- [x] 1. Create utility parsing functions and wizard module skeleton
  - [x] 1.1 Create `src/wizard.ts` with the `WizardResult` interface, `parseCommaSeparated`, `parseKeyValuePairs`, `validateField`, and `handleCancel` utility functions
    - Export `WizardResult` interface matching the design (frontmatter, knowledgeBody, hooks, mcpServers)
    - `parseCommaSeparated(input: string): string[]` — split on commas, trim each element, filter empties
    - `parseKeyValuePairs(input: string): Record<string, string>` — parse `KEY=VALUE,KEY=VALUE` format into a record
    - `validateField<T>(schema, value)` — run Zod `.safeParse()`, return parsed value or error message string
    - `handleCancel(value)` — check `p.isCancel(value)`, call `p.cancel()`, exit process
    - _Requirements: 2.2, 3.1, 3.3, 3.4, 6.4, 6.5, 8.1_

  - [x] 1.2 Write property tests for `parseCommaSeparated`
    - **Property 1: Comma-separated parsing preserves all tokens**
    - **Validates: Requirements 2.2, 3.3**
    - Create `src/__tests__/wizard-parsing.test.ts`
    - Use fast-check to generate random strings with commas and whitespace
    - Assert: every non-whitespace token is preserved, all elements are trimmed and non-empty, array length equals number of non-empty segments

  - [x] 1.3 Write property tests for space-separated parsing and KEY=VALUE parsing
    - **Property 6: Space-separated parsing preserves all tokens**
    - **Validates: Requirements 6.4**
    - **Property 7: KEY=VALUE parsing round-trip**
    - **Validates: Requirements 6.5**
    - Add to `src/__tests__/wizard-parsing.test.ts`
    - Use fast-check to generate random space-separated strings and random key-value records
    - Assert: round-trip consistency for KEY=VALUE pairs, all tokens preserved for space-separated parsing

  - [x] 1.4 Write unit tests for parsing edge cases
    - Add to `src/__tests__/wizard-parsing.test.ts`
    - Test: empty input, all-whitespace input, single value (no commas), trailing commas, keys/values with special characters
    - _Requirements: 2.2, 3.3, 6.4, 6.5_

- [x] 2. Implement wizard prompt functions
  - [x] 2.1 Implement `promptFrontmatter(name, displayName)` in `src/wizard.ts`
    - Collect description, keywords, author, artifact type, inclusion mode, conditional file_patterns, categories, harnesses, ecosystem tags
    - Use `p.text`, `p.select`, `p.multiselect` from `@clack/prompts`
    - Validate each field inline using `validateField` with the corresponding Zod schema field
    - Pre-select all harnesses by default
    - Only show file_patterns prompt when inclusion mode is `fileMatch`
    - _Requirements: 2.1–2.9, 3.1–3.4_

  - [x] 2.2 Implement `promptKnowledgeBody()` in `src/wizard.ts`
    - Use `p.text` to collect markdown body content
    - Allow empty input (retains TODO placeholder)
    - _Requirements: 4.1–4.3_

  - [x] 2.3 Implement `promptHooks()` and `promptSingleHook()` in `src/wizard.ts`
    - `promptHooks()`: loop asking `p.confirm` to add hooks, call `promptSingleHook()` for each
    - `promptSingleHook()`: collect event type via `p.select` from `CanonicalEventSchema`, conditional file_patterns or tool_types, action type via `p.select`, action payload, and hook name
    - Validate assembled hook against `CanonicalHookSchema`
    - On validation failure, display friendly error and offer retry or skip
    - _Requirements: 5.1–5.10_

  - [x] 2.4 Implement `promptMcpServers()` and `promptSingleMcpServer()` in `src/wizard.ts`
    - `promptMcpServers()`: loop asking `p.confirm` to add MCP servers, call `promptSingleMcpServer()` for each
    - `promptSingleMcpServer()`: collect name, command, args (space-separated → array), env (KEY=VALUE pairs → record)
    - Validate assembled server against `McpServerDefinitionSchema`
    - On validation failure, display friendly error and offer retry or skip
    - _Requirements: 6.1–6.7_

  - [x] 2.5 Implement `runWizard(artifactName, displayName)` in `src/wizard.ts`
    - Orchestrate: intro banner → `promptFrontmatter` → `promptKnowledgeBody` → `promptHooks` → `promptMcpServers` → return `WizardResult`
    - Handle cancellation at every prompt via `handleCancel`
    - _Requirements: 1.4, 8.1–8.3_

  - [x] 2.6 Write property tests for frontmatter and hook/MCP server validation
    - **Property 2: Valid frontmatter passes schema validation**
    - **Validates: Requirements 3.1, 3.4**
    - **Property 4: Hook assembly produces schema-valid objects**
    - **Validates: Requirements 5.10**
    - **Property 5: MCP server assembly produces schema-valid objects**
    - **Validates: Requirements 6.7**
    - Create `src/__tests__/wizard-validation.test.ts`
    - Use fast-check to generate random valid/invalid frontmatter, hook, and MCP server objects
    - Assert: valid objects pass schema, invalid objects fail

  - [x] 2.7 Write unit tests for wizard prompt flow
    - Create `src/__tests__/wizard.test.ts`
    - Mock `@clack/prompts` to simulate user input sequences
    - Test: fileMatch shows file_patterns prompt, file events show file_patterns, tool events show tool_types, ask_agent shows prompt field, run_command shows command field
    - Test: cancellation at each major prompt group verifies no file writes
    - Test: outro lists written files and suggests `forge build`
    - _Requirements: 2.5, 2.6, 5.2–5.7, 8.1–8.3_

- [x] 3. Implement file writer module
  - [x] 3.1 Create `src/file-writer.ts` with `writeWizardResult`, `buildKnowledgeMd`, `buildHooksYaml`, `buildMcpServersYaml`
    - `buildKnowledgeMd(result)`: serialize frontmatter to YAML via `js-yaml`, combine with body into gray-matter-compatible markdown string
    - `buildHooksYaml(hooks)`: serialize hooks array to YAML via `js-yaml`; empty array → `[]`
    - `buildMcpServersYaml(servers)`: serialize MCP servers array to YAML via `js-yaml`; empty array → `[]`
    - `writeWizardResult(artifactDir, result)`: write knowledge.md, hooks.yaml, mcp-servers.yaml; return list of written file paths
    - _Requirements: 7.1–7.3_

  - [x] 3.2 Write property tests for file writer
    - **Property 3: Knowledge body content replaces placeholder**
    - **Validates: Requirements 4.2**
    - **Property 8: knowledge.md gray-matter round-trip**
    - **Validates: Requirements 7.1**
    - **Property 9: YAML serialization round-trip for hooks and MCP servers**
    - **Validates: Requirements 7.2, 7.3**
    - Create `src/__tests__/file-writer.test.ts`
    - Use fast-check to generate random WizardResult objects, hook arrays, and MCP server arrays
    - Assert: body replaces TODO placeholder, gray-matter round-trip produces equivalent data, YAML round-trip produces equivalent arrays

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Integrate wizard into `forge new` command
  - [x] 5.1 Modify `src/new.ts` to accept `NewCommandOptions` with `--yes` flag and call `runWizard` + `writeWizardResult`
    - Update `newCommand` signature to `(artifactName: string, options: NewCommandOptions)`
    - After scaffold creation, call `runWizard()` unless `--yes` is set
    - On wizard success, call `writeWizardResult()` to overwrite scaffold files
    - Display outro summary listing written files and suggesting `forge build`
    - _Requirements: 1.1–1.3, 7.4, 7.5_

  - [x] 5.2 Modify `src/cli.ts` to add `--yes` option to the `new` command
    - Add `.option("--yes", "Skip interactive wizard, use template defaults")` to the `new` command definition
    - _Requirements: 1.2_

  - [x] 5.3 Write unit tests for CLI flag routing
    - Add to `src/__tests__/new.test.ts`
    - Test: `--yes` skips wizard; no flag launches wizard; existing directory errors
    - _Requirements: 1.1–1.3_

- [x] 6. Implement tutorial module
  - [x] 6.1 Create `src/tutorial.ts` with `TutorialStep` and `TutorialDefaults` interfaces, `TUTORIAL_DEFAULTS` constant, and `buildTutorialSteps` function
    - Define `TutorialStep` interface with `title`, `explanation`, and optional `action`
    - Define `TutorialDefaults` with `artifactName`, `description`, `keywords`, `author`
    - Export `TUTORIAL_DEFAULTS` constant with `hello-world` defaults
    - Implement `buildTutorialSteps(artifactName)` as a pure function returning the ordered step array
    - _Requirements: 10.1, 11.1_

  - [x] 6.2 Implement `showWelcome`, `showProgress`, `explainGeneratedFiles`, `explainBuildOutput`, `showCompletion`, and `resolveArtifactName` in `src/tutorial.ts`
    - `showWelcome()`: display Skill Forge overview using `p.log.info` and `p.note`, define "artifact" in plain language
    - `showProgress(current, total)`: output "Step N of M" using `p.log.step`
    - `explainGeneratedFiles(artifactDir)`: read each file and display annotated explanations using `p.note`
    - `explainBuildOutput()`: explain build output location and harness consumption
    - `showCompletion()`: display completion summary, suggest `forge new` for real artifacts
    - `resolveArtifactName(defaultName)`: check if `knowledge/<name>` exists, prompt for overwrite or alternative name
    - Internal helpers: `explainConcept(term, definition)`, `waitForContinue(message?)`, `runTutorialBuild(artifactName)`
    - _Requirements: 9.2–9.4, 10.2–10.6, 11.1, 11.4, 11.5_

  - [x] 6.3 Implement `tutorialCommand()` entry point in `src/tutorial.ts`
    - Orchestrate: resolve artifact name → show welcome → iterate through `buildTutorialSteps` calling `showProgress` and each step's action → show completion
    - Handle cancellation at every prompt via `handleCancel`
    - Catch build errors gracefully, suggest `forge validate`
    - _Requirements: 9.1, 10.1, 10.4, 11.2, 11.3_

  - [x] 6.4 Register `forge tutorial` command in `src/cli.ts`
    - Import `tutorialCommand` from `./tutorial`
    - Add `.command("tutorial").description("Guided walkthrough for first-time artifact authors").action(tutorialCommand)`
    - _Requirements: 9.1_

  - [x] 6.5 Write property tests for tutorial functions
    - **Property 10: Tutorial step sequence is complete and ordered**
    - **Validates: Requirements 10.1, 11.1**
    - **Property 11: Tutorial progress indicator is bounded**
    - **Validates: Requirement 11.1**
    - **Property 12: Tutorial artifact name resolution handles conflicts**
    - **Validates: Requirement 9.4**
    - Create `src/__tests__/tutorial.test.ts`
    - Use fast-check to generate random artifact names and (current, total) pairs
    - Assert: step array has non-empty titles/explanations, unique titles, correct length; progress indicator is bounded; name resolution returns default when no conflict

  - [x] 6.6 Write unit tests for tutorial flow
    - Add to `src/__tests__/tutorial.test.ts`
    - Mock `@clack/prompts` and `runWizard`
    - Test: welcome message contains "Skill Forge" and "artifact"; concepts step explains all three file types; tutorial calls `runWizard` with correct artifact name; build failure is caught gracefully; cancellation exits cleanly; progress shows correct "Step N of M"; existing `hello-world` prompts for overwrite/rename
    - _Requirements: 9.1–9.4, 10.1–10.6, 11.1–11.5_

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate the 12 correctness properties from the design document
- Unit tests validate specific examples, edge cases, and prompt flow logic
- All code is TypeScript, using Bun runtime, `@clack/prompts`, `js-yaml`, `gray-matter`, `zod`, `chalk`, and `fast-check`
