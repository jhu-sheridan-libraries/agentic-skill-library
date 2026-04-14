# Requirements Document

## Introduction

The `forge new` command currently scaffolds a knowledge artifact directory with template files and then prints manual "next steps" instructions. This feature replaces that passive output with an interactive guided experience using `@clack/prompts`, allowing authors to populate frontmatter metadata, optionally configure hooks and MCP servers, and write the knowledge body — all within the CLI session. The non-interactive path is preserved via a `--yes` flag for CI and scripting use cases.

Additionally, a `forge tutorial` command provides a guided first-run walkthrough for new users — especially researchers with no development background — that teaches the full artifact authoring workflow: creating an artifact via the interactive wizard, understanding the generated files, and building the artifact with `forge build`.

## Glossary

- **Interactive_Wizard**: The `@clack/prompts`-based interactive prompt flow that guides the user through artifact configuration after scaffolding
- **Forge_CLI**: The Commander.js-based command-line interface entry point (`forge`)
- **Artifact**: A knowledge artifact consisting of `knowledge.md`, `hooks.yaml`, `mcp-servers.yaml`, and an optional `workflows/` directory inside `knowledge/<name>/`
- **Frontmatter**: The YAML metadata block at the top of `knowledge.md`, validated by `FrontmatterSchema`
- **Knowledge_Body**: The Markdown content section of `knowledge.md` that follows the YAML frontmatter
- **Hook**: An event-driven automation definition in `hooks.yaml`, validated by `CanonicalHookSchema`
- **MCP_Server**: An MCP server definition in `mcp-servers.yaml`, validated by `McpServerDefinitionSchema`
- **Template_Engine**: The Nunjucks-based rendering system that generates scaffold files from `.njk` templates
- **Scaffold**: The initial directory and file structure created by `forge new` before interactive prompts begin
- **Tutorial_Runner**: The `@clack/prompts`-based guided walkthrough launched by `forge tutorial` that teaches new users the artifact authoring workflow
- **Tutorial_Step**: A single stage in the tutorial flow, consisting of an explanation message and an optional interactive action (e.g., running the wizard or building the artifact)
- **Sample_Artifact**: A pre-defined example artifact named `hello-world` that the Tutorial_Runner creates to demonstrate the workflow

## Requirements

### Requirement 1: Interactive Wizard Entry Point

**User Story:** As an artifact author, I want `forge new <name>` to launch an interactive wizard after scaffolding, so that I can configure my artifact without manually editing files.

#### Acceptance Criteria

1. WHEN the user runs `forge new <artifact-name>` without the `--yes` flag, THE Forge_CLI SHALL create the Scaffold directory and then launch the Interactive_Wizard
2. WHEN the user runs `forge new <artifact-name> --yes`, THE Forge_CLI SHALL create the Scaffold using template defaults and skip the Interactive_Wizard
3. WHEN the user runs `forge new <artifact-name>` and an artifact with that name already exists, THE Forge_CLI SHALL display an error message and exit with a non-zero exit code without launching the Interactive_Wizard
4. THE Interactive_Wizard SHALL display an intro banner using `@clack/prompts` that identifies the artifact being configured

### Requirement 2: Frontmatter Metadata Collection

**User Story:** As an artifact author, I want the wizard to prompt me for each frontmatter field, so that I can populate metadata without memorizing the schema.

#### Acceptance Criteria

1. THE Interactive_Wizard SHALL prompt the user for a description using a text input
2. THE Interactive_Wizard SHALL prompt the user for keywords using a text input that accepts comma-separated values
3. THE Interactive_Wizard SHALL prompt the user for an author name using a text input
4. THE Interactive_Wizard SHALL prompt the user to select an artifact type from the options defined in `ArtifactTypeSchema` (skill, power, rule) using a select prompt
5. THE Interactive_Wizard SHALL prompt the user to select an inclusion mode from the options defined in `InclusionModeSchema` (always, fileMatch, manual) using a select prompt
6. WHEN the user selects the "fileMatch" inclusion mode, THE Interactive_Wizard SHALL prompt the user for file patterns using a text input that accepts comma-separated glob patterns
7. THE Interactive_Wizard SHALL prompt the user to select categories from the options defined in `CATEGORIES` using a multi-select prompt
8. THE Interactive_Wizard SHALL prompt the user to select target harnesses from the options defined in `SUPPORTED_HARNESSES` using a multi-select prompt with all harnesses pre-selected
9. THE Interactive_Wizard SHALL prompt the user for ecosystem tags using a text input that accepts comma-separated kebab-case values

### Requirement 3: Frontmatter Validation

**User Story:** As an artifact author, I want the wizard to validate my inputs against the Zod schemas, so that I produce a valid artifact on the first try.

#### Acceptance Criteria

1. WHEN the user provides input for a frontmatter field, THE Interactive_Wizard SHALL validate the input against the corresponding field in `FrontmatterSchema`
2. IF the user provides an invalid value for a frontmatter field, THEN THE Interactive_Wizard SHALL display a validation error message and re-prompt the user for that field
3. WHEN the user provides comma-separated keywords, THE Interactive_Wizard SHALL parse them into a trimmed string array before validation
4. WHEN the user provides comma-separated ecosystem tags, THE Interactive_Wizard SHALL validate each tag matches the kebab-case pattern `^[a-z0-9]+(-[a-z0-9]+)*$`

### Requirement 4: Knowledge Body Editing

**User Story:** As an artifact author, I want to provide the initial knowledge body content during the wizard, so that I do not have to open a separate editor.

#### Acceptance Criteria

1. THE Interactive_Wizard SHALL prompt the user for the Knowledge_Body content using a text input
2. WHEN the user provides Knowledge_Body content, THE Interactive_Wizard SHALL replace the default "TODO" placeholder in `knowledge.md` with the user-provided content
3. WHEN the user leaves the Knowledge_Body prompt empty, THE Interactive_Wizard SHALL retain the default "TODO" placeholder in `knowledge.md`

### Requirement 5: Optional Hook Configuration

**User Story:** As an artifact author, I want the wizard to optionally guide me through adding hooks, so that I can set up event-driven automations without consulting documentation.

#### Acceptance Criteria

1. THE Interactive_Wizard SHALL ask the user whether they want to add a hook using a confirm prompt
2. WHEN the user confirms they want to add a hook, THE Interactive_Wizard SHALL prompt the user to select an event type from the options defined in `CanonicalEventSchema` using a select prompt
3. WHEN the user selects a file-based event (file_edited, file_created, file_deleted), THE Interactive_Wizard SHALL prompt the user for file patterns using a text input
4. WHEN the user selects a tool-based event (pre_tool_use, post_tool_use), THE Interactive_Wizard SHALL prompt the user for tool types using a text input
5. THE Interactive_Wizard SHALL prompt the user to select an action type (ask_agent, run_command) using a select prompt
6. WHEN the user selects the "ask_agent" action type, THE Interactive_Wizard SHALL prompt the user for the agent prompt string using a text input
7. WHEN the user selects the "run_command" action type, THE Interactive_Wizard SHALL prompt the user for the shell command string using a text input
8. THE Interactive_Wizard SHALL prompt the user for a hook name using a text input
9. WHEN the user finishes configuring a hook, THE Interactive_Wizard SHALL ask whether the user wants to add another hook
10. THE Interactive_Wizard SHALL validate each completed hook against `CanonicalHookSchema` before writing

### Requirement 6: Optional MCP Server Configuration

**User Story:** As an artifact author, I want the wizard to optionally guide me through adding MCP server definitions, so that I can bundle tool integrations with my artifact.

#### Acceptance Criteria

1. THE Interactive_Wizard SHALL ask the user whether they want to add an MCP server using a confirm prompt
2. WHEN the user confirms they want to add an MCP server, THE Interactive_Wizard SHALL prompt the user for the server name using a text input
3. THE Interactive_Wizard SHALL prompt the user for the server command using a text input
4. THE Interactive_Wizard SHALL prompt the user for command arguments using a text input that accepts space-separated values
5. THE Interactive_Wizard SHALL prompt the user for environment variables using a text input that accepts `KEY=VALUE` pairs separated by commas
6. WHEN the user finishes configuring an MCP server, THE Interactive_Wizard SHALL ask whether the user wants to add another MCP server
7. THE Interactive_Wizard SHALL validate each completed MCP server definition against `McpServerDefinitionSchema` before writing

### Requirement 7: File Writing and Summary

**User Story:** As an artifact author, I want the wizard to write all my inputs to the correct files and show a summary, so that I have confidence the artifact is ready.

#### Acceptance Criteria

1. WHEN the Interactive_Wizard completes all prompts, THE Interactive_Wizard SHALL write the collected frontmatter and Knowledge_Body to `knowledge.md` using the Template_Engine
2. WHEN the user configured one or more hooks, THE Interactive_Wizard SHALL write the hooks array to `hooks.yaml` as valid YAML
3. WHEN the user configured one or more MCP servers, THE Interactive_Wizard SHALL write the MCP server definitions to `mcp-servers.yaml` as valid YAML
4. WHEN the Interactive_Wizard finishes writing files, THE Interactive_Wizard SHALL display an outro summary listing each file that was written and its path
5. THE Interactive_Wizard SHALL display a final message suggesting the user run `forge build` to compile the artifact

### Requirement 8: Cancellation Handling

**User Story:** As an artifact author, I want to be able to cancel the wizard at any prompt without corrupting my artifact, so that I can safely abort if I change my mind.

#### Acceptance Criteria

1. WHEN the user sends a cancel signal (Ctrl+C or Escape) at any prompt, THE Interactive_Wizard SHALL display a cancellation message and exit gracefully
2. WHEN the user cancels the Interactive_Wizard, THE Interactive_Wizard SHALL retain the Scaffold files with their template defaults intact
3. THE Interactive_Wizard SHALL not write partial user input to any artifact file upon cancellation

### Requirement 9: Tutorial Command Entry Point

**User Story:** As a new user with no development background, I want to run `forge tutorial` to launch a guided walkthrough, so that I can learn how Skill Forge works before authoring my own artifacts.

#### Acceptance Criteria

1. WHEN the user runs `forge tutorial`, THE Forge_CLI SHALL launch the Tutorial_Runner
2. THE Tutorial_Runner SHALL display a welcome message that explains what Skill Forge is and what artifacts are, using plain non-technical language
3. THE Tutorial_Runner SHALL explain the three core artifact files (knowledge.md, hooks.yaml, mcp-servers.yaml) and their purpose before starting the hands-on walkthrough
4. IF a Sample_Artifact named `hello-world` already exists in the `knowledge/` directory, THEN THE Tutorial_Runner SHALL prompt the user to confirm overwriting it or choose a different name

### Requirement 10: Tutorial Walkthrough Flow

**User Story:** As a new user, I want the tutorial to walk me through creating, understanding, and building a sample artifact step by step, so that I gain confidence in the full workflow.

#### Acceptance Criteria

1. THE Tutorial_Runner SHALL guide the user through creating a Sample_Artifact by launching the Interactive_Wizard with pre-filled suggestions for each field
2. WHEN the Interactive_Wizard completes during the tutorial, THE Tutorial_Runner SHALL display an explanation of each generated file (knowledge.md, hooks.yaml, mcp-servers.yaml) and what the user's inputs produced
3. THE Tutorial_Runner SHALL explain the purpose of the `workflows/` directory and when a user might add workflow files
4. WHEN the file explanation step completes, THE Tutorial_Runner SHALL prompt the user to run `forge build` and then execute the build on the Sample_Artifact
5. WHEN the build completes, THE Tutorial_Runner SHALL explain what the build produced and where the compiled output is located
6. THE Tutorial_Runner SHALL use friendly, jargon-free language throughout and define technical terms (YAML, frontmatter, harness) inline when first used

### Requirement 11: Tutorial Progress and Completion

**User Story:** As a new user, I want to see my progress through the tutorial and be able to exit at any point, so that I feel in control and can resume later.

#### Acceptance Criteria

1. THE Tutorial_Runner SHALL display a progress indicator showing the current step and total number of steps (e.g., "Step 2 of 5")
2. WHEN the user sends a cancel signal (Ctrl+C or Escape) at any tutorial prompt, THE Tutorial_Runner SHALL display a friendly exit message and exit gracefully
3. WHEN the user cancels the tutorial after the Sample_Artifact has been created, THE Tutorial_Runner SHALL retain the Sample_Artifact files on disk
4. WHEN the tutorial completes all steps, THE Tutorial_Runner SHALL display a completion summary listing what was accomplished
5. WHEN the tutorial completes, THE Tutorial_Runner SHALL suggest next steps including creating a real artifact with `forge new` and reading the documentation
