# Requirements Document

## Introduction

This document specifies improvements to the `--help` screens of the Forge_CLI tool. The current CLI, built with Commander.js on Bun/TypeScript, uses default Commander help output with minimal formatting. These requirements define a richer, more informative, and visually polished help experience — including styled output with chalk, usage examples per command, grouped options, and a dedicated `forge help` command that provides contextual guidance. The goal is to make the CLI self-documenting and approachable for new users while remaining useful for experienced ones.

## Glossary

- **Forge_CLI**: The `forge` TypeScript CLI entry point (running on Bun) that provides subcommands for building, installing, validating, cataloging, evaluating, and scaffolding Knowledge_Artifacts
- **Help_Renderer**: A module responsible for formatting and rendering help output to the terminal, applying chalk styling, section layout, and usage examples
- **Help_Section**: A named block of content within a help screen (e.g., "Usage", "Commands", "Options", "Examples", "Aliases")
- **Command_Help**: The help output displayed when a user runs `forge <command> --help` or `forge help <command>`
- **Root_Help**: The help output displayed when a user runs `forge --help` or `forge` with no arguments
- **Usage_Example**: A concrete invocation string shown in help output to illustrate how a command is used (e.g., `forge build --harness kiro`)
- **Option_Group**: A logical grouping of related options within a command's help screen (e.g., "Output Options", "Filter Options")
- **Supported_Harness**: One of the seven AI coding assistant platforms: Kiro, Claude Code, Copilot, Cursor, Windsurf, Cline, Q Developer
- **Banner**: The ASCII art gradient header displayed when `forge` is run with no arguments

## Requirements

---

### Requirement 1: Styled Root Help Screen

**User Story:** As a developer, I want the root help screen to be visually organized and styled with colors, so that I can quickly understand what commands are available and how to get started.

#### Acceptance Criteria

1. WHEN the user runs `forge --help`, THE Help_Renderer SHALL display the Root_Help with the following Help_Sections in order: a brief description, a "Usage" line, a "Commands" table, a "Global Options" section, and a "Getting Started" tip
2. THE Help_Renderer SHALL apply chalk color styling to section headers, command names, and option flags to visually distinguish them from description text
3. THE Help_Renderer SHALL display each command in the "Commands" table with its name left-aligned and its description right-padded, using consistent column widths
4. THE Help_Renderer SHALL display a "Getting Started" tip at the bottom of Root_Help suggesting `forge new <name>` for first-time users
5. WHEN the `--no-color` flag is provided, THE Help_Renderer SHALL output plain text without any ANSI color codes

---

### Requirement 2: Per-Command Usage Examples

**User Story:** As a developer, I want each command's help screen to include concrete usage examples, so that I can understand how to invoke the command without reading external documentation.

#### Acceptance Criteria

1. WHEN the user runs `forge <command> --help`, THE Help_Renderer SHALL display an "Examples" Help_Section after the options listing containing at least two Usage_Examples for that command
2. EACH Usage_Example SHALL consist of a comment line (prefixed with `#`) describing the intent and an invocation line showing the full command
3. THE Help_Renderer SHALL display Usage_Examples for the following commands: `build`, `install`, `new`, `validate`, `catalog generate`, `catalog browse`, and `eval`
4. THE Help_Renderer SHALL style the comment lines in a muted color and the invocation lines in a bright color to visually separate intent from syntax

---

### Requirement 3: Grouped Options Display

**User Story:** As a developer, I want command options to be grouped by purpose, so that I can find the option I need without scanning a flat list.

#### Acceptance Criteria

1. WHEN a command has more than three options, THE Help_Renderer SHALL organize options into named Option_Groups (e.g., "Output Options", "Filter Options", "Behavior Options")
2. EACH Option_Group SHALL display a group header label followed by the options belonging to that group, each with its flag(s) and description
3. THE Help_Renderer SHALL display the `install` command's options in at least two Option_Groups: one for source/target options (`--source`, `--from-release`, `--harness`) and one for behavior options (`--force`, `--dry-run`, `--all`)
4. THE Help_Renderer SHALL display the `eval` command's options in at least two Option_Groups: one for execution options (`--harness`, `--provider`, `--threshold`) and one for output options (`--output`, `--ci`, `--no-context`)

---

### Requirement 4: Dedicated `forge help` Command

**User Story:** As a developer, I want a `forge help <command>` syntax as an alternative to `--help`, so that I can access help using a natural command pattern.

#### Acceptance Criteria

1. THE Forge_CLI SHALL register a `help` command that accepts an optional command name argument
2. WHEN the user runs `forge help <command>`, THE Forge_CLI SHALL display the same Command_Help output as `forge <command> --help`
3. WHEN the user runs `forge help` with no argument, THE Forge_CLI SHALL display the Root_Help output
4. IF the user runs `forge help <unknown-command>`, THEN THE Forge_CLI SHALL display an error message listing the available commands

---

### Requirement 5: Harness List in Relevant Commands

**User Story:** As a developer, I want commands that accept a `--harness` flag to show the list of valid harness names in their help output, so that I do not have to look up valid values elsewhere.

#### Acceptance Criteria

1. WHEN the user runs `forge build --help`, THE Help_Renderer SHALL display the list of Supported_Harness names as valid values for the `--harness` option
2. WHEN the user runs `forge install --help`, THE Help_Renderer SHALL display the list of Supported_Harness names as valid values for the `--harness` option
3. WHEN the user runs `forge eval --help`, THE Help_Renderer SHALL display the list of Supported_Harness names as valid values for the `--harness` option
4. THE Help_Renderer SHALL format the harness list inline with the option description (e.g., `--harness <name>  Build for a single harness (kiro, claude-code, copilot, cursor, windsurf, cline, qdeveloper)`)

---

### Requirement 6: Version and Environment Info

**User Story:** As a developer, I want `forge --version` to display the version along with runtime environment details, so that I can include this information in bug reports.

#### Acceptance Criteria

1. WHEN the user runs `forge --version`, THE Forge_CLI SHALL display the Forge_CLI version number, the Bun runtime version, and the operating system platform
2. THE Forge_CLI SHALL format the version output as a single block with labeled fields (e.g., `forge v0.1.0`, `bun v1.x.x`, `platform darwin-arm64`)
3. WHEN the `--no-color` flag is provided, THE Forge_CLI SHALL output the version information as plain text without ANSI color codes

---

### Requirement 7: Help Output Determinism

**User Story:** As a developer, I want the help output to be deterministic, so that I can use it in automated documentation generation and snapshot tests.

#### Acceptance Criteria

1. FOR ALL commands, running `forge <command> --help --no-color` twice with the same CLI version SHALL produce identical stdout output (determinism property)
2. THE Help_Renderer SHALL not include timestamps, terminal-width-dependent wrapping, or random values in help output when `--no-color` is provided
3. FOR ALL commands, the help output produced by `forge <command> --help` SHALL be equivalent to the output produced by `forge help <command>` (equivalence property)

---

### Requirement 8: Banner Integration with Help

**User Story:** As a developer, I want the banner to appear only when running `forge` with no arguments, and not when requesting help, so that help output remains clean and parseable.

#### Acceptance Criteria

1. WHEN the user runs `forge` with no arguments, THE Forge_CLI SHALL display the Banner followed by the Root_Help
2. WHEN the user runs `forge --help`, THE Forge_CLI SHALL display the Root_Help without the Banner
3. WHEN the user runs `forge help`, THE Forge_CLI SHALL display the Root_Help without the Banner
4. WHEN the user runs `forge <command> --help`, THE Forge_CLI SHALL display the Command_Help without the Banner

---

### Requirement 9: Error Suggestions in Help Context

**User Story:** As a developer, I want the CLI to suggest the closest matching command when I mistype a command name, so that I can recover from typos without consulting help.

#### Acceptance Criteria

1. WHEN the user runs `forge <unknown-command>`, THE Forge_CLI SHALL display an error message indicating the command is not recognized
2. WHEN the unknown command name has a Levenshtein distance of 2 or less from a valid command name, THE Forge_CLI SHALL suggest the closest matching command in the error message (e.g., `Did you mean "build"?`)
3. THE Forge_CLI SHALL display the list of available commands after the error message to aid discovery
4. IF no close match exists, THEN THE Forge_CLI SHALL display only the error message and the available commands list without a suggestion
