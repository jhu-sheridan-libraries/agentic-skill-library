# Requirements Document

## Introduction

Skill Forge is a monorepo that serves as a universal skills-and-powers library for AI coding assistants. The core principle is "write knowledge once, compile to every harness format." Authors maintain canonical knowledge artifacts in a harness-agnostic `knowledge/` directory (Markdown + YAML), and a build tool (`forge`) compiles those artifacts into each target harness's native format under `dist/`. The system supports seven first-party harnesses: Kiro, Claude Code, GitHub Copilot, Cursor, Windsurf, Cline, and Amazon Q Developer.

The monorepo includes a CLI tool (`forge`), a template-driven adapter system for harness-specific transformations, a canonical hook format that translates across harnesses, shared MCP server composition, a machine-readable catalog, and a phased scaling path from local git clone through GitHub releases to community contributions.

The repository lives at `jhu-sheridan-libraries/agentic-skill-forge` and is built with TypeScript on the Bun runtime, using Bun's native bundler for standalone binary distribution.

## Glossary

- **Forge_CLI**: The `forge` TypeScript CLI entry point (running on Bun) that provides `build`, `install`, `new`, `validate`, and `catalog` subcommands
- **Knowledge_Artifact**: A directory under `knowledge/` containing a `knowledge.md` file and optional `workflows/`, `hooks.yaml`, and `mcp-servers.yaml` — the harness-agnostic canonical source of truth for a single skill or power
- **Knowledge_Directory**: The top-level `knowledge/` directory containing all Knowledge_Artifacts
- **Dist_Directory**: The top-level `dist/` directory containing generated per-harness output, organized as `dist/<harness-name>/<artifact-name>/`
- **Harness**: An AI coding assistant platform that consumes skills, rules, or powers in its own native format (e.g., Kiro, Claude Code, GitHub Copilot, Cursor, Windsurf, Cline, Amazon Q Developer)
- **Harness_Adapter**: A TypeScript module under `src/adapters/` that transforms a Knowledge_Artifact into a specific Harness's native file format using templates
- **Template**: A Nunjucks template file under `templates/harness-adapters/<harness-name>/` that defines the output structure for a specific Harness
- **Canonical_Hook**: A hook definition in `hooks.yaml` using a harness-agnostic YAML schema that specifies trigger events, conditions, and actions without referencing any specific harness format
- **MCP_Server_Definition**: A YAML file under `mcp-servers/` or within a Knowledge_Artifact's `mcp-servers.yaml` that declares an MCP server's name, command, arguments, and environment variables
- **Catalog**: A machine-readable `catalog.json` file at the repository root listing all Knowledge_Artifacts with metadata, type, keywords, and supported harnesses
- **Kiro_Harness**: The Kiro AI assistant, consuming `.kiro/steering/*.md` files (with frontmatter), `.kiro/hooks/*.kiro.hook` JSON files, and `POWER.md` + `steering/` + `mcp.json` for powers
- **Claude_Code_Harness**: The Claude Code assistant, consuming `CLAUDE.md`, `.claude/settings.json` (Stop hooks), and `.claude/mcp.json`
- **Copilot_Harness**: GitHub Copilot, consuming `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md` (path-scoped), and `AGENTS.md`
- **Cursor_Harness**: The Cursor editor assistant, consuming `.cursor/rules/*.md` or `.cursorrules` (with frontmatter), and `.cursor/mcp.json`
- **Windsurf_Harness**: The Windsurf assistant, consuming `.windsurfrules` or `.windsurf/rules/*.md`, `.windsurf/workflows/`, and `.windsurf/mcp.json`
- **Cline_Harness**: The Cline assistant, consuming `.clinerules/*.md` (toggleable), `.clinerules/hooks/` (executable scripts), and VS Code MCP configuration
- **QDeveloper_Harness**: Amazon Q Developer, consuming `.q/rules/*.md` or `.amazonq/rules/*.md`, `.q/agents/`, and MCP via IDE configuration
- **Build_Manifest**: The per-artifact metadata (harness compatibility, template overrides, feature flags) that controls how the Forge_CLI compiles a Knowledge_Artifact
- **Harness_Config**: An optional `harness-config` mapping in a Knowledge_Artifact's frontmatter that provides per-harness configuration overrides and harness-specific features (e.g., Kiro spec hooks, Cline toggleable states, Copilot path-scoped instructions, Cursor inclusion mode overrides)
- **Install_Target**: A local project directory where `forge install` copies compiled harness output from Dist_Directory into the project's native harness configuration paths

## Requirements

### Requirement 1: Knowledge Artifact Structure

**User Story:** As a knowledge author, I want a standardized directory structure for each artifact, so that I can write content once in a harness-agnostic format and have it compiled to any target.

#### Acceptance Criteria

1. THE Forge_CLI SHALL recognize a Knowledge_Artifact as a directory under `knowledge/` containing at minimum a `knowledge.md` file
2. THE Forge_CLI SHALL support an optional `workflows/` subdirectory within a Knowledge_Artifact containing additional Markdown workflow files
3. THE Forge_CLI SHALL support an optional `hooks.yaml` file within a Knowledge_Artifact defining Canonical_Hooks in harness-agnostic YAML format
4. THE Forge_CLI SHALL support an optional `mcp-servers.yaml` file within a Knowledge_Artifact declaring MCP_Server_Definitions
5. IF a directory under `knowledge/` does not contain a `knowledge.md` file, THEN THE Forge_CLI SHALL skip that directory during build and emit a warning to stderr
6. THE Forge_CLI SHALL treat the directory name of each Knowledge_Artifact as its canonical identifier (kebab-case)

### Requirement 2: Knowledge Markdown Authoring

**User Story:** As a knowledge author, I want to write canonical content in Markdown with optional YAML frontmatter, so that metadata and content coexist in a single readable file.

#### Acceptance Criteria

1. THE Forge_CLI SHALL parse `knowledge.md` files containing optional YAML frontmatter delimited by `---` lines at the top of the file
2. THE Forge_CLI SHALL extract frontmatter fields including `name`, `displayName`, `description`, `keywords`, `author`, `version`, `harnesses` (list of target harness names), and `harness-config` (optional per-harness configuration overrides)
3. WHEN a `knowledge.md` file contains no frontmatter, THE Forge_CLI SHALL infer the artifact name from the parent directory name and set `harnesses` to all seven supported harnesses
6. THE Forge_CLI SHALL parse the optional `harness-config` frontmatter field as a mapping of harness names to harness-specific configuration objects, passing each harness's config block to its corresponding Harness_Adapter during build
7. IF a `harness-config` key references a harness name not present in the `harnesses` list, THEN THE Forge_CLI SHALL emit a warning to stderr and ignore that config block
4. THE Forge_CLI SHALL preserve all Markdown content below the frontmatter as the canonical body text for template rendering
5. IF the frontmatter contains invalid YAML syntax, THEN THE Forge_CLI SHALL return a ValidationError with the file path and line number of the syntax error

### Requirement 3: Canonical Hook Format

**User Story:** As a knowledge author, I want to define hooks in a single YAML format, so that the build system can translate them to each harness's native hook mechanism.

#### Acceptance Criteria

1. THE Forge_CLI SHALL parse `hooks.yaml` files containing a list of hook definitions, each with fields: `name`, `description`, `event` (trigger type), `condition` (optional filter), and `action` (the response)
2. THE Forge_CLI SHALL support the following canonical event types: `file_edited`, `file_created`, `file_deleted`, `agent_stop`, `prompt_submit`, `pre_tool_use`, `post_tool_use`, `pre_task`, `post_task`, and `user_triggered`
3. THE Forge_CLI SHALL support the following canonical action types: `ask_agent` (with a `prompt` field) and `run_command` (with a `command` field)
4. WHEN the `condition` field specifies `file_patterns`, THE Forge_CLI SHALL pass those glob patterns to harnesses that support file-scoped triggers
5. IF a `hooks.yaml` file references an event type not in the supported list, THEN THE Forge_CLI SHALL return a ValidationError identifying the unsupported event type
6. FOR ALL valid Canonical_Hooks, parsing the YAML then serializing back to YAML then parsing again SHALL produce an equivalent hook definition (round-trip property)
7. Hooks defined in `hooks.yaml` SHALL represent cross-harness canonical hooks only; harness-specific hooks (e.g., Kiro spec hooks, Cline toggleable states) SHALL be defined in the `harness-config` frontmatter block of `knowledge.md`

### Requirement 4: MCP Server Composition

**User Story:** As a knowledge author, I want to declare MCP server dependencies in a shared format, so that each harness receives a correctly formatted MCP configuration during build.

#### Acceptance Criteria

1. THE Forge_CLI SHALL parse `mcp-servers.yaml` files containing a list of MCP_Server_Definitions, each with fields: `name`, `command`, `args` (list of strings), and `env` (mapping of environment variable names to values or references)
2. THE Forge_CLI SHALL also load shared MCP_Server_Definitions from the top-level `mcp-servers/` directory, where each YAML file defines one or more servers
3. WHEN a Knowledge_Artifact references an MCP server by name in `mcp-servers.yaml`, THE Forge_CLI SHALL resolve the definition from the artifact-local file first, then fall back to the shared `mcp-servers/` directory
4. THE Forge_CLI SHALL compose resolved MCP_Server_Definitions into each harness's native MCP configuration format during build (e.g., `.kiro/mcp.json`, `.claude/mcp.json`, `.cursor/mcp.json`)
5. IF an MCP server name referenced in a Knowledge_Artifact cannot be resolved, THEN THE Forge_CLI SHALL return a ValidationError identifying the unresolved server name

### Requirement 5: Forge Build — Full Build

**User Story:** As a knowledge author, I want to compile all knowledge artifacts into every supported harness format with a single command, so that the dist/ directory stays up to date.

#### Acceptance Criteria

1. WHEN the user runs `forge build`, THE Forge_CLI SHALL iterate over every Knowledge_Artifact in the Knowledge_Directory and compile each to every harness listed in its frontmatter `harnesses` field
2. THE Forge_CLI SHALL write compiled output to `dist/<harness-name>/<artifact-name>/` preserving the harness-specific directory structure
3. THE Forge_CLI SHALL clear the Dist_Directory before writing new output to prevent stale files from previous builds
4. THE Forge_CLI SHALL invoke the appropriate Harness_Adapter for each target harness, passing the parsed Knowledge_Artifact and resolved templates
5. THE Forge_CLI SHALL print a summary to stderr listing each artifact compiled, the harnesses targeted, and the total file count written
6. IF a Harness_Adapter encounters an error for a specific artifact, THEN THE Forge_CLI SHALL log the error to stderr, skip that artifact-harness combination, and continue building remaining artifacts

### Requirement 6: Forge Build — Single Harness

**User Story:** As a knowledge author, I want to compile artifacts for a single harness only, so that I can iterate quickly on one target format without rebuilding everything.

#### Acceptance Criteria

1. WHEN the user runs `forge build --harness <harness-name>`, THE Forge_CLI SHALL compile only the output for the specified harness across all applicable Knowledge_Artifacts
2. THE Forge_CLI SHALL clear only the `dist/<harness-name>/` subdirectory before writing, leaving other harness outputs untouched
3. IF the specified harness name does not match any supported harness, THEN THE Forge_CLI SHALL return an error listing the valid harness names
4. WHEN a Knowledge_Artifact's frontmatter `harnesses` list does not include the specified harness, THE Forge_CLI SHALL skip that artifact and emit a debug message

### Requirement 7: Kiro Harness Adapter

**User Story:** As a Kiro user, I want knowledge artifacts compiled into Kiro's native format, so that I can use them as steering files, hooks, and powers in my Kiro workspace.

#### Acceptance Criteria

1. THE Kiro Harness_Adapter SHALL generate steering files as `.md` files with YAML frontmatter containing an `inclusion` field set to `always`, `fileMatch`, or `manual` based on the Knowledge_Artifact's metadata or `harness-config.kiro.inclusion` override
2. WHEN a Knowledge_Artifact contains `hooks.yaml`, THE Kiro Harness_Adapter SHALL translate each Canonical_Hook into a `.kiro.hook` JSON file with fields: `name`, `version`, `when` (containing `type` and optional `patterns`), and `then` (containing `type` and `prompt` or `command`)
3. WHEN a Knowledge_Artifact contains `mcp-servers.yaml`, THE Kiro Harness_Adapter SHALL generate an `mcp.json` file in Kiro's expected format
4. THE Kiro Harness_Adapter SHALL generate a `POWER.md` file with YAML frontmatter containing `name`, `displayName`, `description`, `keywords`, and `author` extracted from the Knowledge_Artifact
5. WHEN a Knowledge_Artifact contains `workflows/`, THE Kiro Harness_Adapter SHALL copy workflow files into a `steering/` subdirectory within the Kiro output
6. WHEN `harness-config.kiro.spec-hooks` is defined, THE Kiro Harness_Adapter SHALL translate each spec hook into a `.kiro.hook` JSON file using the same format as canonical hooks, supporting Kiro-specific event types (`preTaskExecution`, `postTaskExecution`)
7. WHEN `harness-config.kiro.fileMatchPattern` is defined, THE Kiro Harness_Adapter SHALL include the pattern in the steering file's YAML frontmatter
8. WHEN `harness-config.kiro.power` is set to `true`, THE Kiro Harness_Adapter SHALL generate the full Kiro Power structure (`POWER.md` + `steering/` + optional `mcp.json`); WHEN set to `false` or absent, it SHALL generate only steering files and hooks

### Requirement 8: Claude Code Harness Adapter

**User Story:** As a Claude Code user, I want knowledge artifacts compiled into Claude Code's native format, so that I can use them as CLAUDE.md instructions, Stop hooks, and MCP configurations.

#### Acceptance Criteria

1. THE Claude_Code Harness_Adapter SHALL generate a `CLAUDE.md` file containing the Knowledge_Artifact's canonical body text, with workflow content appended as additional sections
2. WHEN a Knowledge_Artifact contains `hooks.yaml` with `agent_stop` events, THE Claude_Code Harness_Adapter SHALL translate those hooks into Stop hook entries in `.claude/settings.json` with `type: "command"` and the hook's command
3. WHEN a Knowledge_Artifact contains `hooks.yaml` with event types not supported by Claude Code (e.g., `file_edited`, `pre_task`), THE Claude_Code Harness_Adapter SHALL skip those hooks and emit a warning to stderr
4. WHEN a Knowledge_Artifact contains `mcp-servers.yaml`, THE Claude_Code Harness_Adapter SHALL generate a `.claude/mcp.json` file mapping server names to their command, args, and env
5. THE Claude_Code Harness_Adapter SHALL merge multiple Knowledge_Artifacts targeting Claude Code into a single `CLAUDE.md` with clearly delimited sections per artifact

### Requirement 9: GitHub Copilot Harness Adapter

**User Story:** As a GitHub Copilot user, I want knowledge artifacts compiled into Copilot's native format, so that I can use them as instruction files and agent definitions.

#### Acceptance Criteria

1. THE Copilot Harness_Adapter SHALL generate a `.github/copilot-instructions.md` file containing the Knowledge_Artifact's canonical body text
2. WHEN a Knowledge_Artifact specifies `file_patterns` in its frontmatter or `harness-config.copilot.path-scoped` entries, THE Copilot Harness_Adapter SHALL generate path-scoped instruction files at `.github/instructions/<artifact-name>.instructions.md` with `applyTo` frontmatter
3. WHEN a Knowledge_Artifact contains `workflows/` or `harness-config.copilot.agents-md` is set to `true`, THE Copilot Harness_Adapter SHALL generate an `AGENTS.md` file describing available agent workflows
4. WHEN a Knowledge_Artifact contains `hooks.yaml`, THE Copilot Harness_Adapter SHALL skip hook generation and emit a warning to stderr, as GitHub Copilot does not natively support hooks

### Requirement 10: Cursor Harness Adapter

**User Story:** As a Cursor user, I want knowledge artifacts compiled into Cursor's native format, so that I can use them as rule files and MCP configurations.

#### Acceptance Criteria

1. THE Cursor Harness_Adapter SHALL generate rule files at `.cursor/rules/<artifact-name>.md` with YAML frontmatter containing an `inclusion` field set to `always`, `auto`, `agent-requested`, or `manual` based on the Knowledge_Artifact's metadata or `harness-config.cursor.inclusion` override
2. WHEN a Knowledge_Artifact contains `mcp-servers.yaml`, THE Cursor Harness_Adapter SHALL generate a `.cursor/mcp.json` file in Cursor's expected format
3. WHEN a Knowledge_Artifact contains `hooks.yaml`, THE Cursor Harness_Adapter SHALL skip hook generation and emit a warning to stderr, as Cursor does not natively support hooks
4. THE Cursor Harness_Adapter SHALL map the Knowledge_Artifact's canonical inclusion modes to Cursor's supported modes: `always` → `always`, `fileMatch` → `auto`, `manual` → `agent-requested`

### Requirement 11: Windsurf Harness Adapter

**User Story:** As a Windsurf user, I want knowledge artifacts compiled into Windsurf's native format, so that I can use them as rule files, workflows, and MCP configurations.

#### Acceptance Criteria

1. THE Windsurf Harness_Adapter SHALL generate rule files at `.windsurf/rules/<artifact-name>.md` containing the Knowledge_Artifact's canonical body text
2. WHEN a Knowledge_Artifact contains `workflows/`, THE Windsurf Harness_Adapter SHALL copy workflow files into `.windsurf/workflows/`
3. WHEN a Knowledge_Artifact contains `mcp-servers.yaml`, THE Windsurf Harness_Adapter SHALL generate a `.windsurf/mcp.json` file in Windsurf's expected format
4. WHEN a Knowledge_Artifact contains `hooks.yaml`, THE Windsurf Harness_Adapter SHALL skip hook generation and emit a warning to stderr, as Windsurf does not natively support hooks

### Requirement 12: Cline Harness Adapter

**User Story:** As a Cline user, I want knowledge artifacts compiled into Cline's native format, so that I can use them as toggleable rule files, executable hook scripts, and MCP configurations.

#### Acceptance Criteria

1. THE Cline Harness_Adapter SHALL generate rule files at `.clinerules/<artifact-name>.md` containing the Knowledge_Artifact's canonical body text
2. WHEN a Knowledge_Artifact contains `hooks.yaml`, THE Cline Harness_Adapter SHALL translate each Canonical_Hook into an executable shell script under `.clinerules/hooks/` with the hook's command as the script body
3. THE Cline Harness_Adapter SHALL set the executable permission bit on generated hook scripts
4. WHEN a Knowledge_Artifact contains `mcp-servers.yaml`, THE Cline Harness_Adapter SHALL generate VS Code MCP configuration entries in the format expected by Cline's VS Code extension
5. WHEN `harness-config.cline.toggleable` is set to `true`, THE Cline Harness_Adapter SHALL generate the rule file in a format compatible with Cline's toggleable rule popover
6. WHEN `harness-config.cline.default-enabled` is defined, THE Cline Harness_Adapter SHALL set the rule's initial toggle state accordingly

### Requirement 13: Amazon Q Developer Harness Adapter

**User Story:** As an Amazon Q Developer user, I want knowledge artifacts compiled into Q Developer's native format, so that I can use them as rule files and agent definitions.

#### Acceptance Criteria

1. THE QDeveloper Harness_Adapter SHALL generate rule files at `.q/rules/<artifact-name>.md` containing the Knowledge_Artifact's canonical body text
2. WHEN a Knowledge_Artifact contains `workflows/`, THE QDeveloper Harness_Adapter SHALL generate agent definition files under `.q/agents/`
3. WHEN a Knowledge_Artifact contains `hooks.yaml`, THE QDeveloper Harness_Adapter SHALL skip hook generation and emit a warning to stderr, as Amazon Q Developer does not natively support hooks
4. WHEN a Knowledge_Artifact contains `mcp-servers.yaml`, THE QDeveloper Harness_Adapter SHALL generate MCP configuration in the format expected by the Q Developer IDE plugin

### Requirement 14: Harness Adapter Template System

**User Story:** As a knowledge author, I want harness adapters driven by templates, so that output formats can be customized without modifying adapter code.

#### Acceptance Criteria

1. THE Forge_CLI SHALL load Nunjucks templates from `templates/harness-adapters/<harness-name>/` for each Harness_Adapter
2. THE Forge_CLI SHALL pass the parsed Knowledge_Artifact (frontmatter fields, body text, hooks, MCP servers, workflow file contents, and the harness-specific `harness-config` block for the target harness) as template context variables
3. WHEN a template file does not exist for a harness, THE Forge_CLI SHALL fall back to a default template that outputs the canonical body text with a header comment indicating the source artifact
4. THE Forge_CLI SHALL support template inheritance, allowing harness-specific templates to extend a `base.md.njk` template
5. IF a Nunjucks template contains a syntax error, THEN THE Forge_CLI SHALL return a TemplateError with the template file path and the Nunjucks error message

### Requirement 15: Forge Install — Single Harness

**User Story:** As a developer, I want to install a compiled artifact into my project for a specific harness, so that my AI assistant picks up the knowledge immediately.

#### Acceptance Criteria

1. WHEN the user runs `forge install <artifact-name> --harness <harness-name>`, THE Forge_CLI SHALL copy the compiled output from `dist/<harness-name>/<artifact-name>/` into the current working directory at the harness's expected paths
2. THE Forge_CLI SHALL create any missing directories in the Install_Target required by the harness's file layout (e.g., `.kiro/steering/`, `.cursor/rules/`)
3. WHEN the Install_Target already contains files that would be overwritten, THE Forge_CLI SHALL prompt the user for confirmation before overwriting, unless `--force` is provided
4. THE Forge_CLI SHALL print a summary to stderr listing each file installed and its destination path
5. IF the specified artifact has not been built for the specified harness, THEN THE Forge_CLI SHALL return an error suggesting the user run `forge build --harness <harness-name>` first

### Requirement 16: Forge Install — All Harnesses

**User Story:** As a developer, I want to install a compiled artifact for all harnesses at once, so that every AI assistant in my project gets the same knowledge.

#### Acceptance Criteria

1. WHEN the user runs `forge install <artifact-name> --all`, THE Forge_CLI SHALL copy the compiled output for every harness that has a built artifact into the current working directory
2. THE Forge_CLI SHALL create any missing directories in the Install_Target required by each harness's file layout
3. WHEN the Install_Target already contains files that would be overwritten, THE Forge_CLI SHALL prompt the user for confirmation before overwriting, unless `--force` is provided
4. THE Forge_CLI SHALL print a summary to stderr listing each file installed, grouped by harness

### Requirement 17: Forge New — Scaffold Knowledge Artifact

**User Story:** As a knowledge author, I want to scaffold a new knowledge artifact from a template, so that I start with the correct directory structure and boilerplate.

#### Acceptance Criteria

1. WHEN the user runs `forge new <artifact-name>`, THE Forge_CLI SHALL create a new directory at `knowledge/<artifact-name>/` containing a `knowledge.md` file with frontmatter template, an empty `workflows/` directory, and stub `hooks.yaml` and `mcp-servers.yaml` files
2. THE Forge_CLI SHALL populate the `knowledge.md` frontmatter with `name` set to the artifact name, `displayName` as a title-cased version, `description` as a placeholder, `keywords` as an empty list, `author` as a placeholder, and `harnesses` listing all seven supported harnesses
3. THE Forge_CLI SHALL load scaffold templates from `templates/knowledge/` to generate the boilerplate files
4. IF a directory at `knowledge/<artifact-name>/` already exists, THEN THE Forge_CLI SHALL return an error indicating the artifact already exists and suggest using a different name
5. THE Forge_CLI SHALL print a confirmation to stderr with the path of the created artifact and next steps

### Requirement 18: Forge Validate

**User Story:** As a knowledge author, I want to validate my knowledge artifacts before building, so that I catch structural and content errors early.

#### Acceptance Criteria

1. WHEN the user runs `forge validate`, THE Forge_CLI SHALL validate every Knowledge_Artifact in the Knowledge_Directory
2. WHEN the user runs `forge validate <artifact-path>`, THE Forge_CLI SHALL validate only the specified Knowledge_Artifact
3. THE Forge_CLI SHALL verify that each Knowledge_Artifact contains a `knowledge.md` file with valid YAML frontmatter
4. THE Forge_CLI SHALL verify that `hooks.yaml` (if present) contains only supported event types and action types
5. THE Forge_CLI SHALL verify that `mcp-servers.yaml` (if present) contains valid server definitions with required fields (`name`, `command`)
6. THE Forge_CLI SHALL verify that all harness names in the frontmatter `harnesses` list are recognized
7. THE Forge_CLI SHALL print validation results to stderr with pass/fail status per artifact and a summary count
8. IF any validation errors are found, THEN THE Forge_CLI SHALL exit with a non-zero status code

### Requirement 19: Catalog Generation

**User Story:** As a consumer of the skill-forge library, I want a machine-readable catalog of all available artifacts, so that I can discover and search for knowledge programmatically.

#### Acceptance Criteria

1. WHEN the user runs `forge build`, THE Forge_CLI SHALL regenerate `catalog.json` at the repository root after compiling all artifacts
2. THE Forge_CLI SHALL include an entry for each Knowledge_Artifact containing: `name`, `displayName`, `description`, `keywords`, `author`, `version`, `harnesses` (list of supported harness names), `type` (skill, power, or rule), and `path` (relative path to the knowledge directory)
3. THE Forge_CLI SHALL sort catalog entries alphabetically by `name`
4. FOR ALL Knowledge_Artifacts in the Knowledge_Directory, the catalog SHALL contain exactly one entry per artifact with no duplicates and no missing entries
5. THE Forge_CLI SHALL output `catalog.json` as pretty-printed JSON with 2-space indentation

### Requirement 20: Catalog Serialization Round-Trip

**User Story:** As a developer, I want the catalog to be reliably serialized and deserialized, so that tooling can safely read and write catalog data.

#### Acceptance Criteria

1. FOR ALL valid catalog contents, serializing to JSON then deserializing SHALL produce an equivalent catalog object (round-trip property)
2. FOR ALL valid catalog entries, the serialized JSON SHALL be valid UTF-8 and parseable by the standard library `json` module
3. THE Forge_CLI SHALL serialize catalog entries with a consistent field order: `name`, `displayName`, `description`, `keywords`, `author`, `version`, `harnesses`, `type`, `path`

### Requirement 21: Hook Translation Fidelity

**User Story:** As a developer, I want hook translations to preserve the semantic intent of the canonical hook, so that behavior is consistent across harnesses that support hooks.

#### Acceptance Criteria

1. FOR ALL valid Canonical_Hooks with `event: agent_stop` and `action: run_command`, THE Kiro Harness_Adapter SHALL produce a `.kiro.hook` JSON file and THE Claude_Code Harness_Adapter SHALL produce a `.claude/settings.json` Stop hook entry that both execute the same command string
2. FOR ALL valid Canonical_Hooks with `event: agent_stop` and `action: run_command`, THE Cline Harness_Adapter SHALL produce an executable script that executes the same command string
3. FOR ALL valid Canonical_Hooks with `action: ask_agent`, THE Kiro Harness_Adapter SHALL produce a hook with `then.type` set to `askAgent` and `then.prompt` set to the canonical prompt text
4. WHEN a Canonical_Hook uses an event type not supported by a target harness, THE Harness_Adapter SHALL omit that hook from the output and log a warning identifying the skipped hook and the reason

### Requirement 22: Knowledge Artifact Frontmatter Serialization

**User Story:** As a developer, I want frontmatter parsing and serialization to be reliable, so that metadata is never lost or corrupted during the build process.

#### Acceptance Criteria

1. FOR ALL valid `knowledge.md` files with YAML frontmatter, parsing the frontmatter then serializing back to YAML then parsing again SHALL produce an equivalent metadata object (round-trip property)
2. THE Forge_CLI SHALL preserve all frontmatter fields during parsing, including fields not explicitly defined in the schema, passing them through to templates as extra context variables
3. IF a `knowledge.md` file contains frontmatter with a `---` delimiter but empty content between delimiters, THEN THE Forge_CLI SHALL treat the frontmatter as an empty mapping and apply defaults

### Requirement 23: MCP Server Definition Serialization

**User Story:** As a developer, I want MCP server definitions to be reliably parsed and composed into each harness format, so that MCP configurations are never corrupted.

#### Acceptance Criteria

1. FOR ALL valid MCP_Server_Definitions, parsing from YAML then serializing to each harness's MCP JSON format SHALL produce a valid JSON document parseable by the standard library `json` module
2. FOR ALL valid MCP_Server_Definitions, the composed MCP JSON SHALL contain the server's `command`, `args`, and `env` fields with values matching the canonical YAML source
3. THE Forge_CLI SHALL merge MCP_Server_Definitions from multiple Knowledge_Artifacts into a single MCP configuration file per harness without duplicate server entries

### Requirement 24: Build Idempotency

**User Story:** As a knowledge author, I want consecutive builds with unchanged input to produce identical output, so that I can trust the build is deterministic.

#### Acceptance Criteria

1. FOR ALL valid Knowledge_Directories, running `forge build` twice without modifying any source files SHALL produce byte-identical output in the Dist_Directory
2. FOR ALL valid Knowledge_Directories, running `forge build` twice without modifying any source files SHALL produce byte-identical `catalog.json` output
3. THE Forge_CLI SHALL not include timestamps, random values, or other non-deterministic content in generated output unless explicitly configured in the Knowledge_Artifact's frontmatter

### Requirement 25: Monorepo Directory Structure

**User Story:** As a contributor, I want the repository to follow a well-defined directory layout, so that I can navigate the codebase and understand where each component lives.

#### Acceptance Criteria

1. THE repository SHALL contain the following top-level directories: `knowledge/`, `dist/`, `mcp-servers/`, `templates/`, `src/`, and `.github/workflows/`
2. THE `templates/` directory SHALL contain `knowledge/` (scaffold templates) and `harness-adapters/` (per-harness output templates) subdirectories
3. THE `src/` directory SHALL contain the CLI entry point (`cli.ts`), core modules (`build.ts`, `validate.ts`, `catalog.ts`), and an `adapters/` subdirectory with one module per supported harness
4. THE `src/adapters/` directory SHALL contain one TypeScript module per supported harness: `kiro.ts`, `claude-code.ts`, `copilot.ts`, `cursor.ts`, `windsurf.ts`, `cline.ts`, and `qdeveloper.ts`
5. THE repository root SHALL contain `README.md`, `CONTRIBUTING.md`, `catalog.json`, `package.json`, `tsconfig.json`, `bunfig.toml`, and a `LICENSE` file

### Requirement 26: CI/CD Build Validation

**User Story:** As a maintainer, I want pull requests automatically validated, so that broken artifacts and invalid configurations are caught before merge.

#### Acceptance Criteria

1. THE GitHub Actions workflow SHALL run `forge validate` on every pull request that modifies files under `knowledge/`, `templates/`, or `scripts/`
2. THE GitHub Actions workflow SHALL run `forge build` and verify that the generated `dist/` directory matches the committed `dist/` directory, failing if there are uncommitted build differences
3. THE GitHub Actions workflow SHALL run the project's test suite including property-based tests
4. IF validation or build fails, THEN THE GitHub Actions workflow SHALL post a comment on the pull request summarizing the errors

### Requirement 27: Forge CLI Error Handling

**User Story:** As a knowledge author, I want clear and actionable error messages from the CLI, so that I can quickly diagnose and fix problems.

#### Acceptance Criteria

1. IF the user runs `forge build` with no Knowledge_Artifacts in the Knowledge_Directory, THEN THE Forge_CLI SHALL print a message to stderr indicating no artifacts were found and suggest running `forge new`
2. IF the user runs `forge install` with an artifact name that does not exist in the Dist_Directory, THEN THE Forge_CLI SHALL return an error listing available artifacts
3. IF a Nunjucks template references a variable not present in the template context, THEN THE Forge_CLI SHALL return a TemplateError identifying the missing variable and the template file
4. THE Forge_CLI SHALL exit with status code 0 on success and a non-zero status code on any error
5. THE Forge_CLI SHALL print all diagnostic and progress messages to stderr and reserve stdout for machine-readable output (e.g., JSON catalog data)

### Requirement 28: Scaling Phase 1 — Local Git Clone Workflow

**User Story:** As a developer, I want to use skill-forge by cloning the repository and running local commands, so that I can get started without any registry or package manager.

#### Acceptance Criteria

1. THE README SHALL document the workflow: clone the repository, run `forge build`, then run `forge install <artifact> --harness <harness>` from the target project directory
2. THE Forge_CLI SHALL support a `--source <path>` option on `forge install` to specify the skill-forge repository path when running from a different directory
3. THE Forge_CLI SHALL work without network access after the initial clone, using only local files for build and install operations

### Requirement 29: Scaling Phase 2 — GitHub Releases Distribution

**User Story:** As a developer, I want to install artifacts from GitHub releases without cloning the full repository, so that I can consume knowledge artifacts with minimal setup.

#### Acceptance Criteria

1. THE Forge_CLI SHALL support a `--from-release <tag>` option on `forge install` that downloads the specified artifact's pre-built dist files from a GitHub release asset
2. THE GitHub Actions workflow SHALL create a release asset containing the `dist/` directory and `catalog.json` on each tagged release
3. THE Forge_CLI SHALL cache downloaded release assets locally to avoid redundant downloads

### Requirement 30: Bun Packaging and Tooling

**User Story:** As a developer, I want the forge CLI packaged as a Bun/TypeScript tool, so that I can install it with `bun install` or run it directly with `bunx` and use it across projects.

#### Acceptance Criteria

1. THE repository SHALL include a `package.json` with a `bin` field defining the `forge` CLI entry point
2. THE `package.json` SHALL declare `bun` as the expected runtime and TypeScript as the primary language
3. THE `package.json` SHALL declare `nunjucks`, `js-yaml`, `gray-matter`, `zod`, `commander`, and `chalk` as core dependencies
4. THE Forge_CLI SHALL be installable via `bun install`, `bun link` (for local development), or runnable via `bunx @jhu-sheridan-libraries/skill-forge`
5. THE `package.json` SHALL declare development dependencies including `@types/bun`, `fast-check` (for property-based testing), `biome` (linting and formatting), and `typescript`
6. THE Forge_CLI SHALL support compilation to a standalone binary via `bun build --compile` for distribution without requiring Bun installed on the target machine

### Requirement 31: Interactive Installer

**User Story:** As a developer new to skill-forge, I want an interactive guided installer that walks me through selecting artifacts and harnesses, so that I can set up my project without memorizing CLI flags.

#### Acceptance Criteria

1. WHEN the user runs `forge install` with no arguments, THE Forge_CLI SHALL launch an interactive prompt-based installer
2. THE interactive installer SHALL present a searchable multi-select list of available Knowledge_Artifacts from the catalog, displaying each artifact's `displayName`, `description`, and `keywords`
3. AFTER the user selects one or more artifacts, THE interactive installer SHALL present a multi-select list of supported harnesses, pre-selecting harnesses detected in the current working directory (e.g., if `.kiro/` exists, pre-select Kiro; if `.cursor/` exists, pre-select Cursor)
4. THE interactive installer SHALL display a confirmation summary showing the selected artifacts, target harnesses, and files that will be created or overwritten before proceeding
5. WHEN the user confirms, THE interactive installer SHALL install all selected artifact-harness combinations and print a summary of installed files
6. THE interactive installer SHALL support a `--dry-run` flag that displays the confirmation summary and file list without writing any files
7. IF the Dist_Directory does not contain pre-built output for a selected artifact-harness combination, THE interactive installer SHALL offer to run `forge build` automatically before installing
8. THE interactive installer SHALL use Bun-compatible terminal UI prompts (e.g., `@clack/prompts` or `@inquirer/prompts`) for selection, confirmation, and progress display

### Requirement 32: Eval Test Suite Structure

**User Story:** As a knowledge author, I want to define behavioral eval tests alongside each knowledge artifact, so that I can verify the compiled steering files, hooks, and prompts produce the intended agent behavior.

#### Acceptance Criteria

1. THE Forge_CLI SHALL recognize an optional `evals/` subdirectory within each Knowledge_Artifact directory containing promptfoo-compatible YAML eval configuration files
2. EACH eval configuration file SHALL define `prompts` (referencing compiled harness output), `providers` (target LLM configurations), and `tests` (an array of test cases with `vars`, `assert`, and optional `description`)
3. THE Forge_CLI SHALL support a top-level `evals/` directory for cross-artifact eval suites that test interactions between multiple compiled artifacts
4. THE Forge_CLI SHALL support an `evals/providers.yaml` file at the repository root defining shared LLM provider configurations reusable across all eval files
5. WHEN a Knowledge_Artifact contains an `evals/` subdirectory, THE Forge_CLI SHALL include an `evals` field in the artifact's `catalog.json` entry set to `true`; otherwise set to `false`

### Requirement 33: Forge Eval Command

**User Story:** As a knowledge author, I want a single CLI command to run eval tests against compiled artifacts, so that I can validate prompt effectiveness without manually invoking external tools.

#### Acceptance Criteria

1. WHEN the user runs `forge eval`, THE Forge_CLI SHALL discover and execute all eval configuration files across all Knowledge_Artifacts and the top-level `evals/` directory
2. WHEN the user runs `forge eval <artifact-name>`, THE Forge_CLI SHALL execute only the eval files within the specified artifact's `evals/` subdirectory
3. WHEN the user runs `forge eval --harness <harness-name>`, THE Forge_CLI SHALL execute only eval files that reference compiled output for the specified harness
4. THE Forge_CLI SHALL invoke promptfoo programmatically (via its Node.js API) to execute eval configurations, passing resolved prompt file paths from the Dist_Directory
5. THE Forge_CLI SHALL print eval results to stderr with pass/fail status per test case, aggregate scores, and a summary count
6. IF any eval test case fails, THEN THE Forge_CLI SHALL exit with a non-zero status code
7. THE Forge_CLI SHALL support a `--threshold <score>` option that sets the minimum passing score (0.0–1.0) for LLM-graded assertions, defaulting to 0.7
8. THE Forge_CLI SHALL support a `--output <path>` option to write detailed eval results as JSON for downstream tooling

### Requirement 34: Eval Assertion Types

**User Story:** As a knowledge author, I want a rich set of assertion types for eval tests, so that I can validate both structural and semantic properties of agent responses to compiled prompts.

#### Acceptance Criteria

1. THE eval framework SHALL support deterministic assertions including `contains`, `not-contains`, `contains-any`, `contains-all`, `starts-with`, `regex`, and `equals` for exact output matching
2. THE eval framework SHALL support semantic similarity assertions (`similar`) that compare agent output against a reference string using embedding-based cosine similarity with a configurable threshold
3. THE eval framework SHALL support LLM-as-a-judge assertions (`llm-rubric`) that evaluate agent output against a natural-language rubric using a grader model
4. THE eval framework SHALL support structured output assertions (`is-json`, `contains-json`) for validating that agent responses include valid JSON when expected (e.g., hook file generation)
5. THE eval framework SHALL support custom assertion functions defined as inline JavaScript or TypeScript in the eval configuration for project-specific validation logic
6. THE eval framework SHALL support `cost` and `latency` assertions to validate that prompt configurations stay within acceptable performance bounds

### Requirement 35: Eval Test Case Scaffolding

**User Story:** As a knowledge author, I want eval test cases auto-generated from my compiled artifacts, so that I have a starting point for behavioral testing without writing everything from scratch.

#### Acceptance Criteria

1. WHEN the user runs `forge eval --init <artifact-name>`, THE Forge_CLI SHALL generate a starter `evals/` subdirectory within the specified Knowledge_Artifact
2. THE generated eval configuration SHALL include a `promptfooconfig.yaml` file with the artifact's compiled steering file content as the prompt, a default provider configuration, and placeholder test cases
3. FOR EACH harness in the artifact's `harnesses` list, THE generated eval configuration SHALL include at least one test case that validates the compiled output contains the artifact's core content
4. FOR EACH Canonical_Hook in the artifact's `hooks.yaml`, THE generated eval configuration SHALL include a test case that validates the hook's prompt or command appears in the compiled harness output
5. THE Forge_CLI SHALL print a message to stderr listing the generated files and suggesting next steps for customizing the eval suite

### Requirement 36: Eval CI/CD Integration

**User Story:** As a maintainer, I want eval tests to run automatically in CI, so that prompt regressions are caught before merge.

#### Acceptance Criteria

1. THE GitHub Actions workflow SHALL run `forge eval` on pull requests that modify files under `knowledge/`, `templates/`, or `evals/`
2. THE GitHub Actions workflow SHALL configure LLM provider credentials via GitHub Actions secrets (e.g., `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) and pass them as environment variables to the eval runner
3. THE GitHub Actions workflow SHALL support a `--ci` flag on `forge eval` that disables interactive output, uses machine-readable JSON output, and enforces the configured threshold strictly
4. IF any eval test fails in CI, THEN THE GitHub Actions workflow SHALL post a comment on the pull request summarizing the failed test cases, their expected vs. actual outputs, and the aggregate score
5. THE GitHub Actions workflow SHALL cache eval results keyed by the hash of the compiled dist output and eval configuration files, skipping re-evaluation when neither has changed
6. THE eval CI step SHALL run after the `forge build` and `forge validate` steps, ensuring compiled output is up-to-date before evaluation

### Requirement 37: Eval Provider Configuration

**User Story:** As a knowledge author, I want flexible LLM provider configuration for evals, so that I can test against different models and compare results across providers.

#### Acceptance Criteria

1. THE eval framework SHALL support configuring multiple LLM providers per eval file, enabling side-by-side comparison of how different models respond to the same compiled prompts
2. THE eval framework SHALL support provider configuration via the shared `evals/providers.yaml` file, per-artifact eval files, or inline provider definitions within test cases
3. THE eval framework SHALL support environment variable references in provider configurations (e.g., `${OPENAI_API_KEY}`) for secure credential management
4. THE eval framework SHALL support a `--provider <name>` flag on `forge eval` to run evals against a single specified provider, overriding the eval file's provider list
5. THE eval framework SHALL support Amazon Bedrock, OpenAI, and Anthropic as first-class provider types, with extensibility for additional providers via promptfoo's provider plugin system

### Requirement 38: Harness-Specific Eval Contexts

**User Story:** As a knowledge author, I want eval tests that simulate each harness's system prompt and context injection behavior, so that I can validate how my compiled artifacts perform within each harness's actual runtime environment.

#### Acceptance Criteria

1. THE eval framework SHALL support a `harness-context` field in eval test cases that wraps the compiled artifact content in a simulated harness system prompt (e.g., Kiro's steering file injection format, Cursor's rule file preamble)
2. THE Forge_CLI SHALL provide built-in harness context templates under `templates/eval-contexts/` for each supported harness, representing how each harness typically injects steering content into the LLM context
3. WHEN the user runs `forge eval --harness <harness-name>`, THE Forge_CLI SHALL automatically apply the corresponding harness context template to all test cases unless a test case explicitly overrides it
4. THE eval framework SHALL support a `--no-context` flag to run evals with raw compiled output only, without harness context wrapping, for baseline comparison
