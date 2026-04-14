# Implementation Plan: Help Screen Improvements

## Overview

Introduce a `Help_Renderer` module with pure rendering functions, a `CommandMetadata` registry, a `TypoSuggester`, and a `forge help` command. Replace Commander.js default help output with styled, structured, deterministic help screens. All new code lives under `src/help/` and integrates into the existing `src/cli.ts`.

## Tasks

- [x] 1. Create command metadata types and registry
  - [x] 1.1 Create `src/help/metadata.ts` with `UsageExample`, `OptionGroup`, and `CommandHelpMeta` interfaces
    - Define the three TypeScript interfaces as specified in the design
    - Export the `commandMetaRegistry` record keyed by command name
    - Populate entries for `build`, `install`, `new`, `validate`, `catalog generate`, `catalog browse`, and `eval`
    - Set `showHarnessList: true` for `build`, `install`, and `eval`
    - Define `optionGroups` for `install` (Source Options + Behavior Options) and `eval` (Execution Options + Output Options)
    - Include at least two `UsageExample` entries per command
    - _Requirements: 2.1, 2.3, 3.1, 3.3, 3.4, 5.1, 5.2, 5.3_

- [x] 2. Implement help renderer pure functions
  - [x] 2.1 Create `src/help/renderer.ts` with `RenderOptions` interface and `renderRootHelp` function
    - Accept a commands list and `RenderOptions` (`useColor` boolean)
    - Render sections in order: description, Usage line, Commands table (aligned columns), Global Options, Getting Started tip
    - Apply chalk styling to section headers, command names, and option flags when `useColor: true`
    - Output plain text with zero ANSI codes when `useColor: false`
    - Define the supported harness list constant: `kiro, claude-code, copilot, cursor, windsurf, cline, qdeveloper`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 2.2 Implement `renderCommandHelp` function in `src/help/renderer.ts`
    - Accept command name, description, usage, options array, `CommandHelpMeta`, and `RenderOptions`
    - Render option groups when `optionGroups` are defined in metadata; fall back to flat list otherwise
    - Append harness names inline to `--harness` option description when `showHarnessList` is true
    - Render "Examples" section with muted-color comment lines and bright-color invocation lines
    - Output plain text with zero ANSI codes when `useColor: false`
    - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 5.4_

  - [x] 2.3 Implement `renderVersion` function in `src/help/renderer.ts`
    - Accept version string and `RenderOptions`
    - Output labeled fields: forge version, Bun runtime version (`Bun.version`), OS platform (`process.platform-process.arch`)
    - Gracefully show "unknown" for Bun version if `Bun.version` is unavailable
    - Output plain text with zero ANSI codes when `useColor: false`
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 2.4 Write property test: no-color rendering produces zero ANSI escape codes
    - **Property 1: No-color rendering produces zero ANSI escape codes**
    - **Validates: Requirements 1.5, 6.3**

  - [ ]* 2.5 Write property test: command table column alignment consistency
    - **Property 2: Command table column alignment consistency**
    - **Validates: Requirements 1.3**

  - [ ]* 2.6 Write property test: example rendering format
    - **Property 3: Example rendering format**
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 2.7 Write property test: option group structure
    - **Property 4: Option group structure**
    - **Validates: Requirements 3.1, 3.2**

  - [ ]* 2.8 Write property test: help output determinism
    - **Property 6: Help output determinism**
    - **Validates: Requirements 7.1**

- [x] 3. Checkpoint — Ensure renderer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement typo suggester
  - [x] 4.1 Create `src/help/typo-suggester.ts` with `suggestCommand` function
    - Use `fastest-levenshtein` (already available as transitive dependency) to compute distances
    - Return the closest matching command name if Levenshtein distance ≤ 2, otherwise return `null`
    - _Requirements: 9.2, 9.4_

  - [ ]* 4.2 Write property test: typo suggestion correctness
    - **Property 7: Typo suggestion correctness**
    - **Validates: Requirements 9.2, 9.4**

  - [ ]* 4.3 Write property test: unknown command error includes available commands
    - **Property 8: Unknown command error includes available commands**
    - **Validates: Requirements 4.4, 9.1, 9.3**

- [x] 5. Integrate help renderer and help command into CLI
  - [x] 5.1 Wire renderer into `src/cli.ts` — override `helpInformation()` on each command
    - Import renderer functions and metadata registry
    - Override `helpInformation()` on the root program and each subcommand to call `renderRootHelp` / `renderCommandHelp`
    - Detect `--no-color` in `process.argv` and set `chalk.level = 0` early; pass `useColor` accordingly
    - Override version output to use `renderVersion`
    - _Requirements: 1.1, 1.2, 1.5, 2.1, 3.1, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3_

  - [x] 5.2 Register `forge help [command]` subcommand in `src/cli.ts`
    - Accept an optional command name argument
    - When no argument: display root help via `renderRootHelp`
    - When valid command: display command help via `renderCommandHelp`
    - When unknown command: display error with typo suggestion (if distance ≤ 2) and list available commands
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 5.3 Adjust banner logic in `src/cli.ts`
    - Show banner only when `process.argv.length <= 2` AND no `--help` flag AND not the `help` command
    - Suppress banner on `forge --help`, `forge help`, and `forge <command> --help`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 5.4 Wire unknown command handling with typo suggestions in `src/cli.ts`
    - Use Commander's `.on('command:*')` or equivalent to catch unrecognized commands
    - Call `suggestCommand` and display error message with suggestion and available commands list
    - Exit with code 1
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 5.5 Write property test: help output equivalence across invocation paths
    - **Property 5: Help output equivalence across invocation paths**
    - **Validates: Requirements 4.2, 7.3**

- [x] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Add unit tests for help screens
  - [x] 7.1 Create `src/__tests__/help-renderer.test.ts` with example-based unit tests
    - Root help contains all required sections in order (description, Usage, Commands, Global Options, Getting Started)
    - Root help contains "Getting Started" tip with `forge new`
    - Color styling applied when `useColor: true`
    - Example comment lines use muted styling, invocations use bright styling
    - Metadata registry has examples for all 7 required commands
    - Install command has ≥ 2 option groups
    - Eval command has ≥ 2 option groups
    - Build/install/eval help shows all 7 harness names inline
    - Version output includes version number, Bun version, and platform
    - No timestamps in help output
    - Banner shown on bare `forge`, suppressed on `--help` and `help`
    - `forge help` with no args produces root help
    - _Requirements: 1.1, 1.2, 1.4, 2.3, 2.4, 3.3, 3.4, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 7.2, 8.1, 8.2, 8.3, 8.4_

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use `fast-check` (already in devDependencies) with a minimum of 100 iterations
- Property test file: `src/__tests__/help-renderer.property.test.ts`
- Unit test file: `src/__tests__/help-renderer.test.ts`
- `fastest-levenshtein` is already available as a transitive dependency — no new install needed
