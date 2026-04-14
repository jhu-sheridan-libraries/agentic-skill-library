# Requirements Document

## Introduction

This document specifies five major new capabilities for Skill Forge, extending the existing monorepo ("write knowledge once, compile to every AI coding assistant harness") with: (1) a machine-readable harness capability matrix with graceful degradation, (2) bidirectional sync via `forge import`, (3) artifact versioning and migration, (4) multi-repo/monorepo workspace support, and (5) an interactive playground/preview command.

These features build on the existing Forge_CLI, Knowledge_Artifact structure, Harness_Adapter architecture, and the seven supported harnesses (Kiro, Claude Code, GitHub Copilot, Cursor, Windsurf, Cline, Amazon Q Developer). They assume the existing `build`, `install`, `new`, `validate`, `catalog`, and `eval` commands are in place.

## Glossary

- **Forge_CLI**: The `forge` TypeScript CLI entry point (running on Bun) that provides subcommands for building, installing, importing, upgrading, and previewing Knowledge_Artifacts
- **Knowledge_Artifact**: A directory under `knowledge/` containing a `knowledge.md` file and optional `workflows/`, `hooks.yaml`, and `mcp-servers.yaml` — the harness-agnostic canonical source of truth for a single skill or power
- **Harness_Adapter**: A TypeScript module under `src/adapters/` that transforms a Knowledge_Artifact into a specific Harness's native file format using templates
- **Harness**: An AI coding assistant platform that consumes skills, rules, or powers in its own native format (Kiro, Claude Code, GitHub Copilot, Cursor, Windsurf, Cline, Amazon Q Developer)
- **Capability_Matrix**: A machine-readable JSON/TypeScript data structure that declares which features (hooks, MCP, path-scoping, workflows, toggleable rules, etc.) each Harness supports, along with degradation strategies for unsupported features
- **Degradation_Strategy**: A named approach for handling an unsupported harness feature during compilation — e.g., `inline` (embed instructions in the steering body), `comment` (add a comment noting the limitation), or `omit` (silently skip)
- **Harness_Capability**: A single feature dimension in the Capability_Matrix (e.g., `hooks`, `mcp`, `path_scoping`, `workflows`, `toggleable_rules`, `agents`)
- **Import_Parser**: A module that reads harness-native files (e.g., `.cursorrules`, `CLAUDE.md`, `.kiro/steering/*.md`) and extracts content and metadata into a canonical Knowledge_Artifact structure
- **Artifact_Version**: A semantic version string (`MAJOR.MINOR.PATCH`) tracked in a Knowledge_Artifact's frontmatter `version` field and in installed artifact metadata
- **Migration_Script**: A TypeScript function that transforms an installed artifact from one Artifact_Version to another, handling breaking schema or structural changes
- **Version_Manifest**: A JSON metadata file written alongside installed artifacts that records the installed Artifact_Version, source artifact name, harness name, and installation timestamp
- **Workspace_Config**: A `forge.config.ts` or `forge.config.yaml` file at the workspace root that defines multiple knowledge sources, shared MCP servers, per-project harness overrides, and artifact-to-package mappings for monorepo support
- **Workspace_Project**: A named project entry within a Workspace_Config that specifies a root directory, target harnesses, and an artifact include/exclude list
- **Playground_Renderer**: A module that compiles a Knowledge_Artifact for a specified harness and renders a human-readable preview of the "AI experience" — the system prompt, injected context, hooks, and MCP servers as the AI assistant would see them
- **Playground_Session**: A single invocation of `forge playground` that produces a rendered preview for one artifact-harness combination
- **Dist_Directory**: The top-level `dist/` directory containing generated per-harness output, organized as `dist/<harness-name>/<artifact-name>/`
- **Catalog**: A machine-readable `catalog.json` file at the repository root listing all Knowledge_Artifacts with metadata
- **Canonical_Hook**: A hook definition in `hooks.yaml` using a harness-agnostic YAML schema
- **MCP_Server_Definition**: A YAML declaration of an MCP server's name, command, arguments, and environment variables
- **Install_Target**: A local project directory where `forge install` copies compiled harness output


## Requirements

---

### Feature 1: Harness Capability Matrix + Graceful Degradation

---

### Requirement 1: Capability Matrix Data Structure

**User Story:** As a knowledge author, I want a machine-readable capability matrix that declares what each harness supports, so that the build system can make informed decisions about feature translation.

#### Acceptance Criteria

1. THE Forge_CLI SHALL include a Capability_Matrix data structure that maps each of the seven supported harnesses to a set of Harness_Capabilities with boolean or enum support levels
2. THE Capability_Matrix SHALL declare support status for the following Harness_Capabilities: `hooks`, `mcp`, `path_scoping`, `workflows`, `toggleable_rules`, `agents`, `file_match_inclusion`, and `system_prompt_merging`
3. THE Capability_Matrix SHALL be defined as a typed TypeScript constant validated by a Zod schema, co-located with the adapter registry in `src/adapters/`
4. FOR EACH Harness_Capability, THE Capability_Matrix SHALL declare one of: `full` (native support), `partial` (supported with limitations), or `none` (not supported)
5. THE Capability_Matrix SHALL be exported as a public API so that external tooling and the Playground_Renderer can query harness capabilities programmatically
6. FOR ALL harnesses in the Capability_Matrix, the set of harness names SHALL exactly match the set of harnesses in the adapter registry (no missing, no extra)

### Requirement 2: Graceful Degradation Strategies

**User Story:** As a knowledge author, I want unsupported features to degrade gracefully during compilation instead of being silently dropped, so that the compiled output preserves as much intent as possible.

#### Acceptance Criteria

1. THE Capability_Matrix SHALL associate a Degradation_Strategy with each `none` or `partial` capability entry, specifying how the Harness_Adapter should handle the unsupported feature
2. THE Forge_CLI SHALL support the following Degradation_Strategies: `inline` (embed the feature's instructions into the steering file body as prose), `comment` (insert a comment noting the unsupported feature), and `omit` (skip the feature entirely with a warning)
3. WHEN a Knowledge_Artifact uses a Harness_Capability that a target harness does not support, THE Harness_Adapter SHALL apply the configured Degradation_Strategy instead of silently skipping the feature
4. WHEN the `inline` Degradation_Strategy is applied, THE Harness_Adapter SHALL append a clearly delimited section to the steering file body containing the degraded feature's instructions (e.g., hook prompts rendered as "When X happens, do Y" prose)
5. WHEN a Degradation_Strategy is applied, THE Harness_Adapter SHALL emit a warning to stderr identifying the artifact, the harness, the unsupported capability, and the strategy used
6. THE Forge_CLI SHALL support a `--strict` flag on `forge build` that causes the build to fail with an error instead of degrading when any unsupported capability is encountered

### Requirement 3: Degradation Idempotency

**User Story:** As a knowledge author, I want degradation to produce stable output, so that repeated builds with the same input yield identical results.

#### Acceptance Criteria

1. FOR ALL Knowledge_Artifacts using features that require degradation, running `forge build` twice without modifying source files SHALL produce byte-identical output in the Dist_Directory
2. FOR ALL Degradation_Strategies, applying the strategy to the same input capability and artifact content SHALL produce identical output text (deterministic degradation)

### Requirement 4: Capability Matrix Validation

**User Story:** As a contributor, I want the capability matrix validated against the adapter registry, so that new harnesses or capabilities cannot be added without updating the matrix.

#### Acceptance Criteria

1. WHEN `forge validate` is run, THE Forge_CLI SHALL verify that every harness in the adapter registry has a corresponding entry in the Capability_Matrix
2. WHEN `forge validate` is run, THE Forge_CLI SHALL verify that every entry in the Capability_Matrix references a valid harness in the adapter registry
3. IF the Capability_Matrix is out of sync with the adapter registry, THEN THE Forge_CLI SHALL return a ValidationError identifying the missing or extra entries

---

### Feature 2: Bidirectional Sync / `forge import`

---

### Requirement 5: Import Command — Single Harness

**User Story:** As a developer with existing harness-native configuration files, I want to import them into canonical Knowledge_Artifact format, so that I can adopt Skill Forge without starting from scratch.

#### Acceptance Criteria

1. WHEN the user runs `forge import --harness <harness-name>`, THE Forge_CLI SHALL scan the current working directory for harness-native configuration files matching the specified harness's known file paths
2. THE Forge_CLI SHALL support importing from the following harness-native paths: `.kiro/steering/*.md` and `.kiro/hooks/*.kiro.hook` (Kiro), `CLAUDE.md` and `.claude/settings.json` (Claude Code), `.github/copilot-instructions.md` and `.github/instructions/*.instructions.md` (Copilot), `.cursor/rules/*.md` and `.cursorrules` (Cursor), `.windsurfrules` and `.windsurf/rules/*.md` (Windsurf), `.clinerules/*.md` (Cline), and `.q/rules/*.md` and `.amazonq/rules/*.md` (Q Developer)
3. FOR EACH detected harness-native file, THE Import_Parser SHALL extract the content body and any metadata (frontmatter, JSON fields) into a canonical Knowledge_Artifact structure with `knowledge.md`, and where applicable, `hooks.yaml` and `mcp-servers.yaml`
4. THE Forge_CLI SHALL write imported artifacts to `knowledge/<artifact-name>/` using the source file's name (kebab-cased, without extension) as the artifact name
5. IF a Knowledge_Artifact directory already exists for an imported file's name, THEN THE Forge_CLI SHALL prompt the user for confirmation before overwriting, unless `--force` is provided
6. THE Forge_CLI SHALL print a summary to stderr listing each file imported, the generated artifact name, and the destination path


### Requirement 6: Import Parser — Content Extraction

**User Story:** As a developer, I want the import parser to faithfully extract content and metadata from harness-native files, so that the resulting canonical artifact preserves the original intent.

#### Acceptance Criteria

1. WHEN importing a Markdown-based harness file (e.g., `CLAUDE.md`, `.cursorrules`, `.kiro/steering/*.md`), THE Import_Parser SHALL extract YAML frontmatter (if present) into the Knowledge_Artifact's frontmatter fields and the remaining Markdown body into the canonical body text
2. WHEN importing a JSON-based harness file (e.g., `.kiro.hook` files, `.claude/mcp.json`), THE Import_Parser SHALL parse the JSON and map fields to the corresponding canonical schema (Canonical_Hook for hooks, MCP_Server_Definition for MCP configs)
3. WHEN importing Kiro hook files (`.kiro.hook` JSON), THE Import_Parser SHALL reverse-map Kiro's `when.type` and `then.type` fields to canonical event and action types
4. WHEN importing Claude Code Stop hooks from `.claude/settings.json`, THE Import_Parser SHALL extract command entries and map them to Canonical_Hooks with `event: agent_stop` and `action: run_command`
5. IF an imported file contains content that cannot be mapped to the canonical schema, THEN THE Import_Parser SHALL preserve the unmapped content in the Knowledge_Artifact's `extraFields` and emit a warning to stderr identifying the unmapped content

### Requirement 7: Import Round-Trip Fidelity

**User Story:** As a developer, I want importing then building to produce output equivalent to the original harness-native files, so that I can trust the import did not lose information.

#### Acceptance Criteria

1. FOR ALL valid harness-native Markdown files, importing the file then building for the same harness SHALL produce output whose Markdown body content is semantically equivalent to the original file's body content (round-trip property)
2. FOR ALL valid Kiro hook files, importing the `.kiro.hook` JSON then building for Kiro SHALL produce a `.kiro.hook` JSON file with equivalent `when` and `then` fields (round-trip property)
3. FOR ALL valid MCP configuration files, importing the MCP JSON then building for the same harness SHALL produce an MCP JSON file with equivalent server entries (round-trip property)
4. THE Forge_CLI SHALL support a `--dry-run` flag on `forge import` that displays the canonical artifacts that would be generated without writing any files, enabling users to verify fidelity before committing

### Requirement 8: Import Auto-Detection

**User Story:** As a developer, I want the import command to auto-detect which harnesses are present in my project, so that I do not have to specify each one manually.

#### Acceptance Criteria

1. WHEN the user runs `forge import` without a `--harness` flag, THE Forge_CLI SHALL scan the current working directory for all known harness-native file paths across all seven supported harnesses
2. THE Forge_CLI SHALL present a summary of detected harness files grouped by harness and prompt the user to confirm which harnesses to import
3. WHEN the user confirms, THE Forge_CLI SHALL import files from all confirmed harnesses, merging content from multiple harnesses into a single Knowledge_Artifact when the files represent the same logical skill or rule
4. IF no harness-native files are detected, THEN THE Forge_CLI SHALL print a message to stderr indicating no importable files were found and suggest running `forge new` instead

---

### Feature 3: Artifact Versioning + Migration

---

### Requirement 9: Artifact Version Tracking

**User Story:** As a knowledge author, I want each artifact to carry a semantic version, so that consumers can track changes and know when updates are available.

#### Acceptance Criteria

1. THE Forge_CLI SHALL read the `version` field from each Knowledge_Artifact's frontmatter as a semantic version string in `MAJOR.MINOR.PATCH` format
2. WHEN `forge build` compiles an artifact, THE Forge_CLI SHALL embed the Artifact_Version in the compiled output as a comment or metadata field (e.g., `<!-- forge:version 1.2.0 -->` in Markdown files, `"_forgeVersion": "1.2.0"` in JSON files)
3. WHEN `forge install` installs an artifact, THE Forge_CLI SHALL write a Version_Manifest file (`.forge-manifest.json`) alongside the installed files recording the artifact name, version, harness name, source path, and installation timestamp
4. THE Forge_CLI SHALL include the `version` field in each artifact's `catalog.json` entry
5. IF a Knowledge_Artifact's frontmatter does not contain a `version` field, THEN THE Forge_CLI SHALL default to `0.1.0` and emit a warning suggesting the author add an explicit version

### Requirement 10: Version Manifest Serialization

**User Story:** As a developer, I want the version manifest to be reliably serialized and deserialized, so that tooling can safely read and write version tracking data.

#### Acceptance Criteria

1. FOR ALL valid Version_Manifest contents, serializing to JSON then deserializing SHALL produce an equivalent manifest object (round-trip property)
2. THE Version_Manifest SHALL be serialized as pretty-printed JSON with 2-space indentation
3. THE Version_Manifest SHALL contain the following fields: `artifactName`, `version`, `harnessName`, `sourcePath`, `installedAt` (ISO 8601 timestamp), and `files` (list of installed file paths relative to the Install_Target)

### Requirement 11: Upgrade Command

**User Story:** As a developer, I want a `forge upgrade` command that updates installed artifacts to the latest version, applying migrations for breaking changes automatically.

#### Acceptance Criteria

1. WHEN the user runs `forge upgrade`, THE Forge_CLI SHALL scan the current working directory for Version_Manifest files and compare each installed artifact's version against the latest version available in the source Knowledge_Directory or catalog
2. WHEN an installed artifact's version is older than the source version, THE Forge_CLI SHALL display the version difference and a summary of changes (from the artifact's changelog) and prompt the user to confirm the upgrade
3. WHEN the user confirms an upgrade, THE Forge_CLI SHALL rebuild the artifact for the installed harness and replace the installed files with the new compiled output, updating the Version_Manifest accordingly
4. WHEN a `--force` flag is provided, THE Forge_CLI SHALL skip confirmation prompts and upgrade all outdated artifacts
5. WHEN no outdated artifacts are found, THE Forge_CLI SHALL print a message to stderr indicating all artifacts are up to date
6. THE Forge_CLI SHALL support a `--dry-run` flag that displays the upgrade plan without modifying any files


### Requirement 12: Migration Scripts

**User Story:** As a knowledge author, I want to define migration scripts for breaking changes between artifact versions, so that consumers' installed artifacts are automatically transformed during upgrade.

#### Acceptance Criteria

1. THE Forge_CLI SHALL support an optional `migrations/` subdirectory within each Knowledge_Artifact containing TypeScript migration files named by version range (e.g., `1.0.0-to-2.0.0.ts`)
2. EACH Migration_Script SHALL export a default function that receives the installed artifact's file contents and Version_Manifest and returns the transformed file contents
3. WHEN `forge upgrade` detects a version gap that spans one or more Migration_Scripts, THE Forge_CLI SHALL execute the scripts in sequential version order (e.g., `1.0.0-to-2.0.0.ts` then `2.0.0-to-3.0.0.ts`)
4. IF a required Migration_Script is missing for a version gap, THEN THE Forge_CLI SHALL emit a warning and fall back to a clean reinstall of the latest version, noting that custom modifications may be lost
5. WHEN a Migration_Script throws an error, THE Forge_CLI SHALL abort the upgrade for that artifact, log the error to stderr, and leave the installed files unchanged

### Requirement 13: Artifact Changelog

**User Story:** As a developer, I want each artifact to have a changelog, so that I can review what changed between versions before upgrading.

#### Acceptance Criteria

1. THE Forge_CLI SHALL support an optional `CHANGELOG.md` file within each Knowledge_Artifact directory documenting changes per version
2. WHEN `forge upgrade` displays the version difference, THE Forge_CLI SHALL extract and display the relevant changelog entries between the installed version and the latest version
3. THE Forge_CLI SHALL include a `changelog` field in the `catalog.json` entry set to `true` when a Knowledge_Artifact contains a `CHANGELOG.md` file, and `false` otherwise
4. WHEN the user runs `forge catalog`, THE Forge_CLI SHALL display the latest version and whether a changelog is available for each artifact

### Requirement 14: Upgrade Idempotency

**User Story:** As a developer, I want running upgrade twice to have no additional effect, so that I can safely re-run the command without corrupting installed artifacts.

#### Acceptance Criteria

1. FOR ALL installed artifacts at the latest version, running `forge upgrade` SHALL produce no file changes and report all artifacts as up to date (idempotency property)
2. FOR ALL installed artifacts, running `forge upgrade` then immediately running `forge upgrade` again SHALL produce no file changes on the second run

---

### Feature 4: Multi-Repo / Monorepo Workspace Support

---

### Requirement 15: Workspace Configuration File

**User Story:** As a developer working in a monorepo, I want a workspace configuration file that defines multiple knowledge sources and per-project settings, so that I can manage artifact installation across packages from a single config.

#### Acceptance Criteria

1. THE Forge_CLI SHALL recognize a `forge.config.ts` or `forge.config.yaml` file at the workspace root as a Workspace_Config
2. THE Workspace_Config SHALL support the following top-level fields: `knowledgeSources` (list of paths to Knowledge_Directories), `sharedMcpServers` (path to shared MCP server definitions), `defaults` (default harness list and build options), and `projects` (list of Workspace_Project definitions)
3. EACH Workspace_Project entry SHALL support the following fields: `name` (project identifier), `root` (relative path to the project directory), `harnesses` (list of target harnesses for this project), `artifacts` (include/exclude list of artifact names), and `overrides` (per-harness configuration overrides)
4. THE Forge_CLI SHALL validate the Workspace_Config against a Zod schema and return a ValidationError with the file path and field path for any invalid entries
5. IF both `forge.config.ts` and `forge.config.yaml` exist, THEN THE Forge_CLI SHALL prefer `forge.config.ts` and emit a warning about the ambiguity

### Requirement 16: Workspace-Aware Build

**User Story:** As a developer in a monorepo, I want `forge build` to respect workspace configuration, so that each project gets only the artifacts and harnesses it needs.

#### Acceptance Criteria

1. WHEN a Workspace_Config is present and the user runs `forge build`, THE Forge_CLI SHALL compile artifacts for each Workspace_Project according to its `harnesses` and `artifacts` configuration
2. THE Forge_CLI SHALL resolve `knowledgeSources` paths relative to the workspace root and merge artifacts from all sources, using the artifact name as the deduplication key
3. IF two knowledge sources define an artifact with the same name, THEN THE Forge_CLI SHALL return an error identifying the conflicting sources and artifact name
4. THE Forge_CLI SHALL apply Workspace_Project `overrides` to the corresponding harness-config during compilation, merging them with the artifact's own `harness-config` frontmatter (project overrides take precedence)
5. WHEN no Workspace_Config is present, THE Forge_CLI SHALL fall back to the existing single-directory build behavior with no change in functionality

### Requirement 17: Workspace-Aware Install

**User Story:** As a developer in a monorepo, I want `forge install` to install artifacts into the correct project directories, so that each package gets its own harness configuration.

#### Acceptance Criteria

1. WHEN a Workspace_Config is present and the user runs `forge install`, THE Forge_CLI SHALL install artifacts into each Workspace_Project's `root` directory according to its configuration
2. THE Forge_CLI SHALL create harness-specific directories within each project's root (e.g., `packages/api/.kiro/steering/`, `packages/web/.cursor/rules/`)
3. WHEN the user runs `forge install --project <project-name>`, THE Forge_CLI SHALL install artifacts only for the specified Workspace_Project
4. WHEN the user runs `forge install` without `--project` in a workspace, THE Forge_CLI SHALL install artifacts for all Workspace_Projects and print a summary grouped by project
5. THE Forge_CLI SHALL write a Version_Manifest per project-harness-artifact combination to enable per-project upgrade tracking

### Requirement 18: Workspace Configuration Validation

**User Story:** As a developer, I want the workspace configuration validated early, so that misconfigured projects are caught before build or install.

#### Acceptance Criteria

1. WHEN `forge validate` is run in a directory containing a Workspace_Config, THE Forge_CLI SHALL validate the Workspace_Config in addition to validating Knowledge_Artifacts
2. THE Forge_CLI SHALL verify that all `root` paths in Workspace_Project entries point to existing directories
3. THE Forge_CLI SHALL verify that all artifact names in Workspace_Project `artifacts` include/exclude lists reference artifacts that exist in the configured `knowledgeSources`
4. THE Forge_CLI SHALL verify that all harness names in Workspace_Project `harnesses` lists are recognized supported harnesses
5. IF any Workspace_Config validation errors are found, THEN THE Forge_CLI SHALL report them alongside artifact validation errors with clear identification of the source (workspace config vs. artifact)

### Requirement 19: Workspace Config Serialization

**User Story:** As a developer, I want the workspace configuration to be reliably parsed and re-serialized, so that tooling can programmatically read and modify workspace settings.

#### Acceptance Criteria

1. FOR ALL valid `forge.config.yaml` files, parsing the YAML then serializing back to YAML then parsing again SHALL produce an equivalent Workspace_Config object (round-trip property)
2. FOR ALL valid `forge.config.ts` files, importing the TypeScript module SHALL produce a Workspace_Config object that passes Zod schema validation
3. THE Forge_CLI SHALL support both YAML and TypeScript config formats with identical semantics — any valid YAML config SHALL be expressible as an equivalent TypeScript config and vice versa

---

### Feature 5: Interactive Playground / Preview

---

### Requirement 20: Playground Command — Terminal Preview

**User Story:** As a knowledge author, I want to preview how a compiled artifact appears to the AI assistant in a specific harness, so that I can debug the "AI experience" without opening each IDE.

#### Acceptance Criteria

1. WHEN the user runs `forge playground <artifact-name> --harness <harness-name>`, THE Forge_CLI SHALL compile the specified artifact for the specified harness and render a human-readable preview to stdout
2. THE Playground_Renderer SHALL display the following sections in the preview: system prompt context (how the harness injects the steering content), the full compiled steering/rule file content, a list of hooks that would fire with their trigger conditions and actions, and a list of MCP servers that would be available with their commands and arguments
3. THE Playground_Renderer SHALL use the harness context templates from `templates/eval-contexts/` to simulate how each harness wraps steering content in its system prompt
4. THE Playground_Renderer SHALL use syntax highlighting and section delimiters (using `chalk`) to make the preview readable in the terminal
5. IF the specified artifact does not exist, THEN THE Forge_CLI SHALL return an error listing available artifacts from the catalog
6. IF the specified harness is not in the artifact's `harnesses` list, THEN THE Forge_CLI SHALL return an error indicating the artifact does not target that harness

### Requirement 21: Playground — Degradation Visibility

**User Story:** As a knowledge author, I want the playground to show me which features were degraded and how, so that I can understand the gap between the canonical artifact and the harness-specific output.

#### Acceptance Criteria

1. WHEN the Playground_Renderer displays a preview for a harness that required degradation, THE Playground_Renderer SHALL include a "Degradation Report" section listing each degraded capability, the Degradation_Strategy applied, and the resulting output
2. THE Degradation Report SHALL visually distinguish between `inline`, `comment`, and `omit` strategies using color-coded labels
3. WHEN no degradation was required, THE Playground_Renderer SHALL display a confirmation that all artifact features are natively supported by the target harness

### Requirement 22: Playground — Side-by-Side Comparison

**User Story:** As a knowledge author, I want to compare how the same artifact renders across multiple harnesses, so that I can identify gaps and inconsistencies.

#### Acceptance Criteria

1. WHEN the user runs `forge playground <artifact-name> --compare`, THE Forge_CLI SHALL compile the artifact for all harnesses in its `harnesses` list and display a side-by-side summary
2. THE side-by-side summary SHALL include for each harness: the number of files generated, the list of hooks translated (vs. degraded or omitted), the MCP servers configured, and the Degradation_Strategy applied for any unsupported capabilities
3. THE Forge_CLI SHALL support a `--compare --harness <h1> --harness <h2>` syntax to compare only specific harnesses

### Requirement 23: Playground — Web Preview

**User Story:** As a knowledge author, I want an optional web-based preview of the playground output, so that I can view rich formatting and share previews with collaborators.

#### Acceptance Criteria

1. WHEN the user runs `forge playground <artifact-name> --harness <harness-name> --web`, THE Forge_CLI SHALL start a local HTTP server and open a browser to a rendered HTML preview of the compiled artifact
2. THE web preview SHALL render the same sections as the terminal preview (system prompt context, steering content, hooks, MCP servers, degradation report) with syntax-highlighted code blocks and collapsible sections
3. THE web preview SHALL include a harness selector dropdown that re-renders the preview for a different harness without restarting the server
4. THE Forge_CLI SHALL print the local URL to stderr and keep the server running until the user terminates it with Ctrl+C
5. THE web preview SHALL use only bundled assets (no external CDN dependencies) so that it works offline

### Requirement 24: Playground Output Determinism

**User Story:** As a knowledge author, I want the playground terminal output to be deterministic, so that I can use it in automated diff checks and documentation generation.

#### Acceptance Criteria

1. FOR ALL valid artifact-harness combinations, running `forge playground <artifact-name> --harness <harness-name>` twice with the same source files SHALL produce identical stdout output (determinism property)
2. THE Playground_Renderer SHALL not include timestamps, random values, or terminal-width-dependent formatting in the stdout output when the `--no-color` flag is provided
3. THE Forge_CLI SHALL support a `--json` flag on `forge playground` that outputs the preview data as a structured JSON document to stdout instead of formatted text

---

### Cross-Cutting Requirements

---

### Requirement 25: CLI Command Registration

**User Story:** As a developer, I want the new commands integrated into the existing CLI structure, so that they are discoverable via `forge --help` and follow the same conventions.

#### Acceptance Criteria

1. THE Forge_CLI SHALL register `import` as a new subcommand with options `--harness <name>`, `--force`, and `--dry-run`
2. THE Forge_CLI SHALL register `upgrade` as a new subcommand with options `--force`, `--dry-run`, and `--project <name>`
3. THE Forge_CLI SHALL register `playground` as a new subcommand with options `--harness <name>`, `--compare`, `--web`, `--json`, and `--no-color`
4. THE Forge_CLI SHALL add a `--strict` flag to the existing `build` subcommand for strict degradation mode
5. THE Forge_CLI SHALL add a `--project <name>` flag to the existing `install` subcommand for workspace-aware installation
6. ALL new subcommands SHALL follow the existing CLI conventions: diagnostic output to stderr, machine-readable output to stdout, non-zero exit code on error

### Requirement 26: Schema Extensions

**User Story:** As a contributor, I want the Zod schemas extended to cover the new data structures, so that all new types are validated at parse time.

#### Acceptance Criteria

1. THE Forge_CLI SHALL define Zod schemas for: Capability_Matrix, Degradation_Strategy, Version_Manifest, Workspace_Config, Workspace_Project, and Playground output structure
2. THE Forge_CLI SHALL extend the existing FrontmatterSchema to include an optional `migrations` field (boolean indicating presence of migration scripts) and validate the `version` field as a semantic version string
3. THE Forge_CLI SHALL extend the existing CatalogEntrySchema to include `changelog` (boolean) and `migrations` (boolean) fields
4. FOR ALL new Zod schemas, parsing valid input then serializing then parsing again SHALL produce an equivalent object (round-trip property)

### Requirement 27: Error Handling for New Commands

**User Story:** As a developer, I want clear error messages from the new commands, so that I can diagnose and fix problems quickly.

#### Acceptance Criteria

1. IF the user runs `forge import` in a directory with no detectable harness-native files, THEN THE Forge_CLI SHALL print a message to stderr listing the file paths checked and suggest running `forge new` instead
2. IF the user runs `forge upgrade` in a directory with no Version_Manifest files, THEN THE Forge_CLI SHALL print a message to stderr indicating no installed artifacts were found and suggest running `forge install` first
3. IF the user runs `forge playground` with an artifact that has not been built, THEN THE Forge_CLI SHALL offer to run `forge build` automatically before rendering the preview
4. IF the user runs `forge install --project <name>` with a project name not defined in the Workspace_Config, THEN THE Forge_CLI SHALL return an error listing the available project names
5. ALL error messages from new commands SHALL include actionable suggestions for resolution