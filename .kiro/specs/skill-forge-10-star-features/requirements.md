# Requirements Document

## Introduction

This document specifies eight major new capabilities for Skill Forge, extending the existing monorepo ("write knowledge once, compile to every AI coding assistant harness") with: (1) a machine-readable harness capability matrix with graceful degradation, (2) bidirectional sync via `forge import`, (3) artifact versioning and migration, (4) multi-repo/monorepo workspace support, (5) an interactive temper/preview command, (6) admin UX integration bringing capabilities, temper, import, versioning, and workspace features into the Browse_SPA, (7) dependency graph visualization in the admin UI, and (8) a build dashboard in the admin UI.

These features build on the existing Forge_CLI, Knowledge_Artifact structure, Harness_Adapter architecture, and the seven supported harnesses (Kiro, Claude Code, GitHub Copilot, Cursor, Windsurf, Cline, Amazon Q Developer). They assume the existing `build`, `install`, `new`, `validate`, `catalog`, `eval`, `import`, `tutorial`, `help`, `guild`, `publish`, and `collection` commands are in place.

### Implementation Status Summary

Several related specs have been fully implemented that overlap with features described here:

- **per-harness-artifact-type** (COMPLETED): Implemented `HARNESS_FORMAT_REGISTRY` in `src/format-registry.ts` with `resolveFormat()`, per-harness `format` field in `harness-config`, schema validation via `superRefine`, updated all 7 adapters, wizard, catalog (`formatByHarness`), and browse SPA. This is the foundation for Feature 1's capability matrix — it tracks output format capabilities per harness.
- **team-mode-distribution** (COMPLETED): Implemented global artifact cache (`~/.forge/artifacts/`), manifest system (`.forge/manifest.yaml`), `forge guild init/sync/status/hook install` commands, version resolution with semver ranges, collection expansion, auto-update with throttle, backend integration, sync-lock, and shell hook integration. This provides partial infrastructure for Features 3 and 4.
- **interactive-new-command** (COMPLETED): Implemented interactive wizard for `forge new` using `@clack/prompts`, frontmatter collection, hook/MCP config, `forge tutorial`, and `--yes` flag.
- **catalog-browse** (COMPLETED): Implemented `forge catalog browse` with local HTTP server, SPA with search/filtering/detail views.
- **catalog-admin-management** (COMPLETED): Full CRUD for artifacts, collections, and manifest entries via browse server. Tabbed navigation (Artifacts | Collections | Manifest), design system with cards/forms/badges/toasts/modals, mutable `BrowseState` with live catalog refresh. This provides the foundation for Features 6, 7, and 8 — the admin UI integration layer.
- **catalog-metadata-evolution** (COMPLETED): Categories (controlled enum), ecosystem (freeform), dependency graph (`depends`/`enhances`), cross-artifact validation.
- **help-screen-improvements** (COMPLETED): Help renderer, command metadata registry, typo suggester, `forge help`.
- **skill-forge-monorepo** (COMPLETED): The foundational spec implementing the entire core pipeline including `forge import` for Kiro powers/skills.

## Glossary

- **Forge_CLI**: The `forge` TypeScript CLI entry point (running on Bun) that provides subcommands for building, installing, importing, upgrading, and previewing Knowledge_Artifacts
- **Knowledge_Artifact**: A directory under `knowledge/` containing a `knowledge.md` file and optional `workflows/`, `hooks.yaml`, and `mcp-servers.yaml` — the harness-agnostic canonical source of truth for a single skill or power
- **Harness_Adapter**: A TypeScript module under `src/adapters/` that transforms a Knowledge_Artifact into a specific Harness's native file format using templates
- **Harness**: An AI coding assistant platform that consumes skills, rules, or powers in its own native format (Kiro, Claude Code, GitHub Copilot, Cursor, Windsurf, Cline, Amazon Q Developer)
- **Format_Registry**: The existing `HARNESS_FORMAT_REGISTRY` in `src/format-registry.ts` that maps each harness to its valid output formats and defaults — the foundation for the broader Capability_Matrix
- **Capability_Matrix**: A machine-readable JSON/TypeScript data structure that extends the Format_Registry to declare which features (hooks, MCP, path-scoping, workflows, toggleable rules, etc.) each Harness supports, along with degradation strategies for unsupported features
- **Degradation_Strategy**: A named approach for handling an unsupported harness feature during compilation — e.g., `inline` (embed instructions in the steering body), `comment` (add a comment noting the limitation), or `omit` (silently skip)
- **Harness_Capability**: A single feature dimension in the Capability_Matrix (e.g., `hooks`, `mcp`, `path_scoping`, `workflows`, `toggleable_rules`, `agents`)
- **Import_Parser**: The existing module (`src/import.ts`) that reads harness-native files and extracts content and metadata into a canonical Knowledge_Artifact structure — currently supports Kiro powers (`POWER.md`) and Kiro skills (`SKILL.md`) via auto-detection
- **Artifact_Version**: A semantic version string (`MAJOR.MINOR.PATCH`) tracked in a Knowledge_Artifact's frontmatter `version` field and in installed artifact metadata
- **Migration_Script**: A TypeScript function that transforms an installed artifact from one Artifact_Version to another, handling breaking schema or structural changes
- **Version_Manifest**: A JSON metadata file written alongside installed artifacts that records the installed Artifact_Version, source artifact name, harness name, and installation timestamp
- **Guild_System**: The existing `forge guild` command group (`src/guild/`) that provides manifest-driven artifact distribution with global cache, version resolution, sync, and auto-update — distinct from per-artifact versioning
- **Global_Cache**: The existing directory `~/.forge/artifacts/` where globally installed artifacts are stored, managed by the Guild_System
- **Manifest**: The existing YAML file (`.forge/manifest.yaml`) that declares which artifacts a repo requires, managed by the Guild_System
- **Workspace_Config**: A `forge.config.ts` or `forge.config.yaml` file at the workspace root that defines multiple knowledge sources, shared MCP servers, per-project harness overrides, and artifact-to-package mappings for monorepo support
- **Workspace_Project**: A named project entry within a Workspace_Config that specifies a root directory, target harnesses, and an artifact include/exclude list
- **Temper_Renderer**: A module that compiles a Knowledge_Artifact for a specified harness and renders a human-readable preview of the "AI experience" — the system prompt, injected context, hooks, and MCP servers as the AI assistant would see them
- **Temper_Session**: A single invocation of `forge temper` that produces a rendered preview for one artifact-harness combination
- **Dist_Directory**: The top-level `dist/` directory containing generated per-harness output, organized as `dist/<harness-name>/<artifact-name>/`
- **Catalog**: A machine-readable `catalog.json` file at the repository root listing all Knowledge_Artifacts with metadata
- **Canonical_Hook**: A hook definition in `hooks.yaml` using a harness-agnostic YAML schema
- **MCP_Server_Definition**: A YAML declaration of an MCP server's name, command, arguments, and environment variables
- **Install_Target**: A local project directory where `forge install` copies compiled harness output
- **Browse_SPA**: The existing single-page catalog browser served by `forge catalog browse`, which could be leveraged for web-based temper previews
- **Admin_UI**: The mutation-capable interface within the Browse_SPA that provides CRUD operations for artifacts, collections, and manifest entries — implemented by the catalog-admin-management spec with tabbed navigation, card/form design system, and mutable server state
- **Capability_Badge**: A color-coded visual indicator in the Admin_UI showing a harness's support level (full/partial/none) for a specific Harness_Capability
- **Inline_Temper**: A preview panel rendered within the Admin_UI's artifact detail view that shows the compiled "AI experience" for a selected harness, replacing the need for a separate `forge temper --web` server
- **Import_Scanner**: The component within the Admin_UI that scans the workspace for harness-native files and presents them for import, backed by the `POST /api/import` endpoint
- **Dependency_Graph**: An interactive visual representation of artifact relationships (depends/enhances edges) rendered as inline SVG within the Admin_UI
- **Build_Dashboard**: A panel within the Admin_UI that triggers and monitors `forge build` operations, displaying progress, warnings (including degradation), errors, and build history

## Requirements

---

### Feature 1: Harness Capability Matrix + Graceful Degradation

> **Status**: The Format_Registry (`src/format-registry.ts`) provides the foundation — it tracks output format capabilities per harness with `HARNESS_FORMAT_REGISTRY` and `resolveFormat()`. All 7 adapters already use `resolveFormat()`. What remains is extending this to a full Capability_Matrix covering non-format capabilities (hooks, MCP, path_scoping, workflows, toggleable_rules, agents, file_match_inclusion, system_prompt_merging) and implementing degradation strategies.

---

### Requirement 1: Capability Matrix Data Structure

**User Story:** As a knowledge author, I want a machine-readable capability matrix that extends the existing Format_Registry to declare what each harness supports beyond output formats, so that the build system can make informed decisions about feature translation.

#### Acceptance Criteria

1. THE Forge_CLI SHALL include a Capability_Matrix data structure that extends the existing Format_Registry to map each of the seven supported harnesses to a set of Harness_Capabilities with boolean or enum support levels
2. THE Capability_Matrix SHALL declare support status for the following Harness_Capabilities: `hooks`, `mcp`, `path_scoping`, `workflows`, `toggleable_rules`, `agents`, `file_match_inclusion`, and `system_prompt_merging`
3. THE Capability_Matrix SHALL be defined as a typed TypeScript constant validated by a Zod schema, co-located with the Format_Registry in `src/` (e.g., `src/capability-matrix.ts`)
4. FOR EACH Harness_Capability, THE Capability_Matrix SHALL declare one of: `full` (native support), `partial` (supported with limitations), or `none` (not supported)
5. THE Capability_Matrix SHALL be exported as a public API so that external tooling and the Temper_Renderer can query harness capabilities programmatically
6. FOR ALL harnesses in the Capability_Matrix, the set of harness names SHALL exactly match the set of harnesses in the adapter registry and the Format_Registry (no missing, no extra)

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

**User Story:** As a contributor, I want the capability matrix validated against the adapter registry and Format_Registry, so that new harnesses or capabilities cannot be added without updating the matrix.

#### Acceptance Criteria

1. WHEN `forge validate` is run, THE Forge_CLI SHALL verify that every harness in the adapter registry and Format_Registry has a corresponding entry in the Capability_Matrix
2. WHEN `forge validate` is run, THE Forge_CLI SHALL verify that every entry in the Capability_Matrix references a valid harness in the adapter registry
3. IF the Capability_Matrix is out of sync with the adapter registry or Format_Registry, THEN THE Forge_CLI SHALL return a ValidationError identifying the missing or extra entries

---

### Feature 2: Bidirectional Sync / `forge import`

> **Status**: The `forge import` command exists in `src/import.ts` and is registered in the CLI. It currently supports importing from Kiro powers (`POWER.md`) and Kiro skills (`SKILL.md`) with auto-detection, `--all` for batch import, `--dry-run`, `--format`, `--collections`, and `--knowledge-dir` options. What remains is extending import to support the other 6 harness-native formats (Claude Code, Copilot, Cursor, Windsurf, Cline, Q Developer), adding `--harness` filtering, and implementing round-trip fidelity for non-Kiro formats.

---

### Requirement 5: Import Command — Multi-Harness Extension

**User Story:** As a developer with existing harness-native configuration files beyond Kiro, I want to import them into canonical Knowledge_Artifact format, so that I can adopt Skill Forge without starting from scratch regardless of which AI assistant I currently use.

#### Acceptance Criteria

1. ~~WHEN the user runs `forge import --harness <harness-name>`, THE Forge_CLI SHALL scan the current working directory for harness-native configuration files matching the specified harness's known file paths~~ **[PARTIALLY COMPLETED]** — The `forge import <path>` command exists with `--format` for Kiro sources. The `--harness` flag for scanning the current directory for non-Kiro harness-native files has NOT been implemented.
2. THE Forge_CLI SHALL extend the existing Import_Parser to support importing from the following additional harness-native paths (beyond the already-supported Kiro `POWER.md` and `SKILL.md`): `CLAUDE.md` and `.claude/settings.json` (Claude Code), `.github/copilot-instructions.md` and `.github/instructions/*.instructions.md` (Copilot), `.cursor/rules/*.md` and `.cursorrules` (Cursor), `.windsurfrules` and `.windsurf/rules/*.md` (Windsurf), `.clinerules/*.md` (Cline), and `.q/rules/*.md` and `.amazonq/rules/*.md` (Q Developer)
3. FOR EACH detected harness-native file, THE Import_Parser SHALL extract the content body and any metadata (frontmatter, JSON fields) into a canonical Knowledge_Artifact structure with `knowledge.md`, and where applicable, `hooks.yaml` and `mcp-servers.yaml`
4. ~~THE Forge_CLI SHALL write imported artifacts to `knowledge/<artifact-name>/` using the source file's name (kebab-cased, without extension) as the artifact name~~ **[COMPLETED]** — The existing `importCommand` writes to the configured `knowledgeDir` (default: `knowledge/`) using the source directory name.
5. IF a Knowledge_Artifact directory already exists for an imported file's name, THEN THE Forge_CLI SHALL prompt the user for confirmation before overwriting, unless `--force` is provided
6. ~~THE Forge_CLI SHALL print a summary to stderr listing each file imported, the generated artifact name, and the destination path~~ **[COMPLETED]** — The existing `importCommand` prints a summary with ✓/⚠ markers, artifact names, and target paths.


### Requirement 6: Import Parser — Content Extraction for Non-Kiro Harnesses

**User Story:** As a developer, I want the import parser to faithfully extract content and metadata from harness-native files beyond Kiro, so that the resulting canonical artifact preserves the original intent.

#### Acceptance Criteria

1. WHEN importing a Markdown-based harness file (e.g., `CLAUDE.md`, `.cursorrules`, `.windsurfrules`, `.github/copilot-instructions.md`), THE Import_Parser SHALL extract YAML frontmatter (if present) into the Knowledge_Artifact's frontmatter fields and the remaining Markdown body into the canonical body text
2. WHEN importing a JSON-based harness file (e.g., `.claude/settings.json` for Claude Code hooks), THE Import_Parser SHALL parse the JSON and map fields to the corresponding canonical schema (Canonical_Hook for hooks, MCP_Server_Definition for MCP configs)
3. WHEN importing Claude Code hooks from `.claude/settings.json`, THE Import_Parser SHALL extract command entries and map them to Canonical_Hooks with `event: agent_stop` and `action: run_command`
4. IF an imported file contains content that cannot be mapped to the canonical schema, THEN THE Import_Parser SHALL preserve the unmapped content in the Knowledge_Artifact's `extraFields` and emit a warning to stderr identifying the unmapped content

### Requirement 7: Import Round-Trip Fidelity

**User Story:** As a developer, I want importing then building to produce output equivalent to the original harness-native files, so that I can trust the import did not lose information.

#### Acceptance Criteria

1. FOR ALL valid harness-native Markdown files, importing the file then building for the same harness SHALL produce output whose Markdown body content is semantically equivalent to the original file's body content (round-trip property)
2. FOR ALL valid Kiro hook files, importing the `.kiro.hook` JSON then building for Kiro SHALL produce a `.kiro.hook` JSON file with equivalent `when` and `then` fields (round-trip property)
3. FOR ALL valid MCP configuration files, importing the MCP JSON then building for the same harness SHALL produce an MCP JSON file with equivalent server entries (round-trip property)
4. ~~THE Forge_CLI SHALL support a `--dry-run` flag on `forge import` that displays the canonical artifacts that would be generated without writing any files, enabling users to verify fidelity before committing~~ **[COMPLETED]** — The existing `importCommand` supports `--dry-run`.

### Requirement 8: Import Auto-Detection for Non-Kiro Harnesses

**User Story:** As a developer, I want the import command to auto-detect which harnesses are present in my project beyond Kiro, so that I do not have to specify each one manually.

#### Acceptance Criteria

1. WHEN the user runs `forge import` without a `--harness` flag (and without a `<path>` argument), THE Forge_CLI SHALL scan the current working directory for all known harness-native file paths across all seven supported harnesses
2. THE Forge_CLI SHALL present a summary of detected harness files grouped by harness and prompt the user to confirm which harnesses to import
3. WHEN the user confirms, THE Forge_CLI SHALL import files from all confirmed harnesses, merging content from multiple harnesses into a single Knowledge_Artifact when the files represent the same logical skill or rule
4. IF no harness-native files are detected, THEN THE Forge_CLI SHALL print a message to stderr listing the file paths checked and suggest running `forge new` instead

---

### Feature 3: Artifact Versioning + Migration

> **Status**: The Guild_System (team-mode-distribution spec) provides version resolution with semver ranges at the distribution level — the Manifest tracks version pins, the Sync_Engine resolves versions from the Global_Cache, and the sync-lock records resolved versions. However, this is distribution-level versioning (which version of a compiled artifact to install), NOT authoring-level versioning. What remains is artifact-level versioning: a `version` field in frontmatter (the schema already has `version` defaulting to `"0.1.0"`), Version_Manifest files alongside installed artifacts, `forge upgrade` command, migration scripts, per-artifact changelogs, and upgrade idempotency.

---

### Requirement 9: Artifact Version Tracking

**User Story:** As a knowledge author, I want each artifact to carry a semantic version that is embedded in compiled output and tracked at install time, so that consumers can track changes and know when updates are available.

#### Acceptance Criteria

1. ~~THE Forge_CLI SHALL read the `version` field from each Knowledge_Artifact's frontmatter as a semantic version string in `MAJOR.MINOR.PATCH` format~~ **[COMPLETED]** — The `FrontmatterSchema` already includes `version: z.string().default("0.1.0")` and the `CatalogEntrySchema` includes `version`.
2. WHEN `forge build` compiles an artifact, THE Forge_CLI SHALL embed the Artifact_Version in the compiled output as a comment or metadata field (e.g., `<!-- forge:version 1.2.0 -->` in Markdown files, `"_forgeVersion": "1.2.0"` in JSON files)
3. WHEN `forge install` installs an artifact, THE Forge_CLI SHALL write a Version_Manifest file (`.forge-manifest.json`) alongside the installed files recording the artifact name, version, harness name, source path, and installation timestamp
4. ~~THE Forge_CLI SHALL include the `version` field in each artifact's `catalog.json` entry~~ **[COMPLETED]** — The `CatalogEntrySchema` already includes `version`.
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

> **Status**: The Guild_System's manifest (`.forge/manifest.yaml`) provides some workspace-like functionality — it declares artifact dependencies per repo with version pins, and `forge guild sync` materializes them into harness-specific locations. However, the full workspace config with multiple knowledge sources, per-project settings, workspace-aware build/install, and monorepo package mapping has NOT been implemented. The existing `forge.config.yaml` currently only defines backends for publish/install, not workspace project structure.

---

### Requirement 15: Workspace Configuration File

**User Story:** As a developer working in a monorepo, I want a workspace configuration file that defines multiple knowledge sources and per-project settings, so that I can manage artifact installation across packages from a single config.

#### Acceptance Criteria

1. THE Forge_CLI SHALL recognize a `forge.config.ts` or `forge.config.yaml` file at the workspace root as a Workspace_Config (extending the existing `forge.config.yaml` which currently defines backends)
2. THE Workspace_Config SHALL support the following top-level fields (in addition to the existing `backends` field): `knowledgeSources` (list of paths to Knowledge_Directories), `sharedMcpServers` (path to shared MCP server definitions), `defaults` (default harness list and build options), and `projects` (list of Workspace_Project definitions)
3. EACH Workspace_Project entry SHALL support the following fields: `name` (project identifier), `root` (relative path to the project directory), `harnesses` (list of target harnesses for this project), `artifacts` (include/exclude list of artifact names), and `overrides` (per-harness configuration overrides)
4. THE Forge_CLI SHALL validate the Workspace_Config against a Zod schema and return a ValidationError with the file path and field path for any invalid entries
5. IF both `forge.config.ts` and `forge.config.yaml` exist, THEN THE Forge_CLI SHALL prefer `forge.config.ts` and emit a warning about the ambiguity

### Requirement 16: Workspace-Aware Build

**User Story:** As a developer in a monorepo, I want `forge build` to respect workspace configuration, so that each project gets only the artifacts and harnesses it needs.

#### Acceptance Criteria

1. WHEN a Workspace_Config with `projects` is present and the user runs `forge build`, THE Forge_CLI SHALL compile artifacts for each Workspace_Project according to its `harnesses` and `artifacts` configuration
2. THE Forge_CLI SHALL resolve `knowledgeSources` paths relative to the workspace root and merge artifacts from all sources, using the artifact name as the deduplication key
3. IF two knowledge sources define an artifact with the same name, THEN THE Forge_CLI SHALL return an error identifying the conflicting sources and artifact name
4. THE Forge_CLI SHALL apply Workspace_Project `overrides` to the corresponding harness-config during compilation, merging them with the artifact's own `harness-config` frontmatter (project overrides take precedence)
5. WHEN no Workspace_Config `projects` field is present, THE Forge_CLI SHALL fall back to the existing single-directory build behavior with no change in functionality

### Requirement 17: Workspace-Aware Install

**User Story:** As a developer in a monorepo, I want `forge install` to install artifacts into the correct project directories, so that each package gets its own harness configuration.

#### Acceptance Criteria

1. WHEN a Workspace_Config with `projects` is present and the user runs `forge install`, THE Forge_CLI SHALL install artifacts into each Workspace_Project's `root` directory according to its configuration
2. THE Forge_CLI SHALL create harness-specific directories within each project's root (e.g., `packages/api/.kiro/steering/`, `packages/web/.cursor/rules/`)
3. WHEN the user runs `forge install --project <project-name>`, THE Forge_CLI SHALL install artifacts only for the specified Workspace_Project
4. WHEN the user runs `forge install` without `--project` in a workspace, THE Forge_CLI SHALL install artifacts for all Workspace_Projects and print a summary grouped by project
5. THE Forge_CLI SHALL write a Version_Manifest per project-harness-artifact combination to enable per-project upgrade tracking

### Requirement 18: Workspace Configuration Validation

**User Story:** As a developer, I want the workspace configuration validated early, so that misconfigured projects are caught before build or install.

#### Acceptance Criteria

1. WHEN `forge validate` is run in a directory containing a Workspace_Config with `projects`, THE Forge_CLI SHALL validate the Workspace_Config in addition to validating Knowledge_Artifacts
2. THE Forge_CLI SHALL verify that all `root` paths in Workspace_Project entries point to existing directories
3. THE Forge_CLI SHALL verify that all artifact names in Workspace_Project `artifacts` include/exclude lists reference artifacts that exist in the configured `knowledgeSources`
4. THE Forge_CLI SHALL verify that all harness names in Workspace_Project `harnesses` lists are recognized supported harnesses
5. IF any Workspace_Config validation errors are found, THEN THE Forge_CLI SHALL report them alongside artifact validation errors with clear identification of the source (workspace config vs. artifact)

### Requirement 19: Workspace Config Serialization

**User Story:** As a developer, I want the workspace configuration to be reliably parsed and re-serialized, so that tooling can programmatically read and modify workspace settings.

#### Acceptance Criteria

1. FOR ALL valid `forge.config.yaml` files with workspace fields, parsing the YAML then serializing back to YAML then parsing again SHALL produce an equivalent Workspace_Config object (round-trip property)
2. FOR ALL valid `forge.config.ts` files, importing the TypeScript module SHALL produce a Workspace_Config object that passes Zod schema validation
3. THE Forge_CLI SHALL support both YAML and TypeScript config formats with identical semantics — any valid YAML config SHALL be expressible as an equivalent TypeScript config and vice versa

---

### Feature 5: Interactive Temper / Preview

> **Status**: The Browse_SPA infrastructure (`forge catalog browse`) provides a local HTTP server with SPA rendering that could be leveraged for the web preview mode. The `forge temper` command itself has NOT been implemented.

---

### Requirement 20: Temper Command — Terminal Preview

**User Story:** As a knowledge author, I want to preview how a compiled artifact appears to the AI assistant in a specific harness, so that I can debug the "AI experience" without opening each IDE.

#### Acceptance Criteria

1. WHEN the user runs `forge temper <artifact-name> --harness <harness-name>`, THE Forge_CLI SHALL compile the specified artifact for the specified harness and render a human-readable preview to stdout
2. THE Temper_Renderer SHALL display the following sections in the preview: system prompt context (how the harness injects the steering content), the full compiled steering/rule file content, a list of hooks that would fire with their trigger conditions and actions, and a list of MCP servers that would be available with their commands and arguments
3. THE Temper_Renderer SHALL use the harness context templates from `templates/eval-contexts/` to simulate how each harness wraps steering content in its system prompt
4. THE Temper_Renderer SHALL use syntax highlighting and section delimiters (using `chalk`) to make the preview readable in the terminal
5. IF the specified artifact does not exist, THEN THE Forge_CLI SHALL return an error listing available artifacts from the catalog
6. IF the specified harness is not in the artifact's `harnesses` list, THEN THE Forge_CLI SHALL return an error indicating the artifact does not target that harness

### Requirement 21: Temper — Degradation Visibility

**User Story:** As a knowledge author, I want the temper preview to show me which features were degraded and how, so that I can understand the gap between the canonical artifact and the harness-specific output.

#### Acceptance Criteria

1. WHEN the Temper_Renderer displays a preview for a harness that required degradation, THE Temper_Renderer SHALL include a "Degradation Report" section listing each degraded capability, the Degradation_Strategy applied, and the resulting output
2. THE Degradation Report SHALL visually distinguish between `inline`, `comment`, and `omit` strategies using color-coded labels
3. WHEN no degradation was required, THE Temper_Renderer SHALL display a confirmation that all artifact features are natively supported by the target harness

### Requirement 22: Temper — Side-by-Side Comparison

**User Story:** As a knowledge author, I want to compare how the same artifact renders across multiple harnesses, so that I can identify gaps and inconsistencies.

#### Acceptance Criteria

1. WHEN the user runs `forge temper <artifact-name> --compare`, THE Forge_CLI SHALL compile the artifact for all harnesses in its `harnesses` list and display a side-by-side summary
2. THE side-by-side summary SHALL include for each harness: the number of files generated, the list of hooks translated (vs. degraded or omitted), the MCP servers configured, and the Degradation_Strategy applied for any unsupported capabilities
3. THE Forge_CLI SHALL support a `--compare --harness <h1> --harness <h2>` syntax to compare only specific harnesses

### Requirement 23: Temper — Web Preview

**User Story:** As a knowledge author, I want an optional web-based preview of the temper output, so that I can view rich formatting and share previews with collaborators.

#### Acceptance Criteria

1. WHEN the user runs `forge temper <artifact-name> --harness <harness-name> --web`, THE Forge_CLI SHALL start a local HTTP server (leveraging patterns from the existing Browse_SPA infrastructure) and open a browser to a rendered HTML preview of the compiled artifact
2. THE web preview SHALL render the same sections as the terminal preview (system prompt context, steering content, hooks, MCP servers, degradation report) with syntax-highlighted code blocks and collapsible sections
3. THE web preview SHALL include a harness selector dropdown that re-renders the preview for a different harness without restarting the server
4. THE Forge_CLI SHALL print the local URL to stderr and keep the server running until the user terminates it with Ctrl+C
5. THE web preview SHALL use only bundled assets (no external CDN dependencies) so that it works offline

### Requirement 24: Temper Output Determinism

**User Story:** As a knowledge author, I want the temper terminal output to be deterministic, so that I can use it in automated diff checks and documentation generation.

#### Acceptance Criteria

1. FOR ALL valid artifact-harness combinations, running `forge temper <artifact-name> --harness <harness-name>` twice with the same source files SHALL produce identical stdout output (determinism property)
2. THE Temper_Renderer SHALL not include timestamps, random values, or terminal-width-dependent formatting in the stdout output when the `--no-color` flag is provided
3. THE Forge_CLI SHALL support a `--json` flag on `forge temper` that outputs the preview data as a structured JSON document to stdout instead of formatted text

---

### Cross-Cutting Requirements

> **Status**: Several cross-cutting items have been completed by other specs. The CLI already registers `import`, `help`, `tutorial`, `guild` (init/sync/status/hook install), `catalog browse`, `catalog export`, `collection`, `publish`, and `eval` commands. The schemas already include `categories`, `ecosystem`, `depends`, `enhances`, `formatByHarness`, `collections`, and bazaar governance fields. What remains is registering `upgrade` and `temper` commands, and adding schemas for Capability_Matrix, Degradation_Strategy, Version_Manifest, and Workspace_Config.

---

### Requirement 25: CLI Command Registration

**User Story:** As a developer, I want the new commands integrated into the existing CLI structure, so that they are discoverable via `forge help` and follow the same conventions.

#### Acceptance Criteria

1. ~~THE Forge_CLI SHALL register `import` as a new subcommand with options `--harness <name>`, `--force`, and `--dry-run`~~ **[PARTIALLY COMPLETED]** — `forge import <path>` is registered with `--all`, `--format`, `--dry-run`, `--collections`, and `--knowledge-dir`. The `--harness` flag for scanning the current directory and `--force` for overwrite confirmation still need to be added.
2. THE Forge_CLI SHALL register `upgrade` as a new subcommand with options `--force`, `--dry-run`, and `--project <name>`
3. THE Forge_CLI SHALL register `temper` as a new subcommand with options `--harness <name>`, `--compare`, `--web`, `--json`, and `--no-color`
4. ~~THE Forge_CLI SHALL add a `--strict` flag to the existing `build` subcommand for strict degradation mode~~ **[COMPLETED]** — The `build` command already has `--strict` registered ("Treat compatibility warnings as errors").
5. THE Forge_CLI SHALL add a `--project <name>` flag to the existing `install` subcommand for workspace-aware installation
6. ALL new subcommands SHALL follow the existing CLI conventions: diagnostic output to stderr, machine-readable output to stdout, non-zero exit code on error

### Requirement 26: Schema Extensions

**User Story:** As a contributor, I want the Zod schemas extended to cover the new data structures, so that all new types are validated at parse time.

#### Acceptance Criteria

1. THE Forge_CLI SHALL define Zod schemas for: Capability_Matrix, Degradation_Strategy, Version_Manifest, Workspace_Config, and Workspace_Project
2. ~~THE Forge_CLI SHALL extend the existing FrontmatterSchema to include an optional `migrations` field (boolean indicating presence of migration scripts) and validate the `version` field as a semantic version string~~ **[PARTIALLY COMPLETED]** — The `version` field exists in `FrontmatterSchema` as `z.string().default("0.1.0")`. The `migrations` boolean field still needs to be added.
3. THE Forge_CLI SHALL extend the existing CatalogEntrySchema to include `changelog` (boolean) and `migrations` (boolean) fields
4. FOR ALL new Zod schemas, parsing valid input then serializing then parsing again SHALL produce an equivalent object (round-trip property)

### Requirement 27: Error Handling for New Commands

**User Story:** As a developer, I want clear error messages from the new commands, so that I can diagnose and fix problems quickly.

#### Acceptance Criteria

1. ~~IF the user runs `forge import` in a directory with no detectable harness-native files, THEN THE Forge_CLI SHALL print a message to stderr listing the file paths checked and suggest running `forge new` instead~~ **[PARTIALLY COMPLETED]** — The existing `importCommand` handles missing files per source directory with skip messages. The broader "no harness-native files detected" message for the auto-detection mode (Requirement 8) still needs to be implemented.
2. IF the user runs `forge upgrade` in a directory with no Version_Manifest files, THEN THE Forge_CLI SHALL print a message to stderr indicating no installed artifacts were found and suggest running `forge install` first
3. IF the user runs `forge temper` with an artifact that has not been built, THEN THE Forge_CLI SHALL offer to run `forge build` automatically before rendering the preview
4. IF the user runs `forge install --project <name>` with a project name not defined in the Workspace_Config, THEN THE Forge_CLI SHALL return an error listing the available project names
5. ALL error messages from new commands SHALL include actionable suggestions for resolution


---

### Feature 6: Admin UX Integration

> **Status**: The catalog-admin-management spec implemented a full admin UI in the Browse_SPA with tabbed navigation (Artifacts | Collections | Manifest), CRUD endpoints, design system (cards, forms, badges, toasts, modals), and mutable `BrowseState` with live catalog refresh. Features 1–5 of this spec define CLI-level capabilities (capability matrix, import, versioning, workspace, temper) but have NO integration with the admin UI. This feature bridges that gap — surfacing capability data, temper previews, import actions, version info, and workspace management directly in the Browse_SPA.

---

### Requirement 28: Capability Matrix Display in Admin UI

**User Story:** As a knowledge author, I want to see per-harness capability support levels in the artifact detail view, so that I can understand at a glance which features will degrade for each target harness.

#### Acceptance Criteria

1. WHEN the user views an artifact's detail view in the Admin_UI, THE Admin_UI SHALL display a "Harness Capabilities" section showing each harness listed in the artifact's `harnesses` field
2. FOR EACH harness in the artifact's target list, THE Admin_UI SHALL display Capability_Badges for each Harness_Capability (hooks, mcp, path_scoping, workflows, toggleable_rules, agents, file_match_inclusion, system_prompt_merging) with color-coded indicators: green for `full`, yellow for `partial`, red for `none`
3. WHEN a Capability_Badge shows `partial` or `none`, THE Admin_UI SHALL display the configured Degradation_Strategy (inline, comment, or omit) as a tooltip or secondary label on the badge
4. THE Admin_API SHALL expose a `GET /api/capabilities` endpoint that returns the full Capability_Matrix as JSON
5. THE Admin_API SHALL expose a `GET /api/capabilities/:harness` endpoint that returns the capability entries for a single harness as JSON
6. THE Admin_UI SHALL render the capability section as a compact matrix grid (harnesses as columns, capabilities as rows) when the artifact targets three or more harnesses

### Requirement 29: Inline Temper Preview in Admin UI

**User Story:** As a knowledge author, I want to preview how an artifact compiles for a specific harness directly within the browse UI, so that I do not need to run a separate CLI command or server.

#### Acceptance Criteria

1. WHEN the user clicks a "Preview" button on an artifact's detail view in the Admin_UI, THE Admin_UI SHALL display an Inline_Temper panel showing the compiled output for the artifact's first target harness
2. THE Inline_Temper SHALL include a harness selector dropdown allowing the user to switch between all harnesses in the artifact's `harnesses` list, re-rendering the preview for the selected harness
3. THE Inline_Temper SHALL display the following sections: compiled steering/rule file content with syntax highlighting, hooks (translated and degraded), MCP servers configured, and a degradation report listing any applied strategies
4. THE Admin_API SHALL expose a `POST /api/temper` endpoint that accepts `{ artifactName: string, harness: string }` and returns a TemperOutput JSON object containing sections, degradations, file count, hooks translated/degraded, and MCP server list
5. WHEN the selected harness requires degradation for the artifact, THE Inline_Temper SHALL display the degradation report with color-coded strategy labels (green for inline, yellow for comment, red for omit)
6. THE Inline_Temper SHALL render within the existing artifact detail view layout without navigating away or opening a new browser tab

### Requirement 30: Import Action in Admin UI

**User Story:** As a developer, I want to trigger artifact import from the browse UI, so that I can onboard existing harness-native files without switching to the terminal.

#### Acceptance Criteria

1. THE Admin_UI SHALL display an "Import" button in the top-level navigation or toolbar area of the Artifacts tab
2. WHEN the user clicks the "Import" button, THE Admin_UI SHALL call the `POST /api/import/scan` endpoint and display detected harness-native files grouped by harness with checkboxes for selection
3. THE Admin_API SHALL expose a `POST /api/import/scan` endpoint that scans the workspace for all known harness-native file paths (as defined in HARNESS_NATIVE_PATHS) and returns detected files grouped by harness as JSON
4. THE Admin_API SHALL expose a `POST /api/import` endpoint that accepts `{ files: string[], harness?: string, force?: boolean }` and imports the specified files into canonical Knowledge_Artifacts, returning the list of created artifact names
5. WHEN the import completes successfully, THE Admin_UI SHALL refresh the catalog data and display a success notification listing the imported artifact names
6. IF an import would overwrite an existing artifact and `force` is not set, THEN THE Admin_API SHALL return a conflict response listing the conflicting artifact names, and THE Admin_UI SHALL display a confirmation dialog before retrying with `force: true`
7. THE Admin_UI SHALL display a "Dry Run" toggle that, when enabled, calls the import endpoint with a `dryRun: true` parameter and shows what would be imported without writing files

### Requirement 31: Version and Upgrade Display in Admin UI

**User Story:** As a developer, I want to see version information and trigger upgrades from the artifact detail view, so that I can manage artifact lifecycle without the CLI.

#### Acceptance Criteria

1. WHEN the user views an artifact's detail view in the Admin_UI, THE Admin_UI SHALL display the artifact's current version prominently (from the `version` frontmatter field)
2. WHEN a `CHANGELOG.md` file exists in the artifact's directory, THE Admin_UI SHALL display a "Changelog" section showing the changelog entries, with the most recent version's entries expanded by default
3. THE Admin_API SHALL expose a `GET /api/versions/:name` endpoint that returns version information for a named artifact: current source version, installed version (from Version_Manifest if present), whether an upgrade is available, and changelog entries (if CHANGELOG.md exists)
4. WHEN the installed version (from Version_Manifest) is older than the source version, THE Admin_UI SHALL display an "Upgrade Available" badge and an "Upgrade" button on the artifact detail view
5. THE Admin_API SHALL expose a `POST /api/upgrade/:name` endpoint that triggers an upgrade for the specified artifact (rebuild + reinstall + update Version_Manifest) and returns the new version information
6. WHEN the user clicks the "Upgrade" button, THE Admin_UI SHALL call the upgrade endpoint, display a progress indicator, and refresh the version display on completion
7. IF no Version_Manifest exists for the artifact (not installed), THEN THE Admin_UI SHALL display "Not installed" instead of an installed version and hide the upgrade button

### Requirement 32: Workspace Tab in Admin UI

**User Story:** As a developer working in a monorepo, I want to view and manage workspace projects from the browse UI, so that I can understand and modify artifact assignments without editing config files.

#### Acceptance Criteria

1. WHEN a Workspace_Config with `projects` is detected, THE Admin_UI SHALL display a "Workspace" tab in the top-level navigation alongside the existing Artifacts, Collections, and Manifest tabs
2. WHEN the user navigates to the Workspace tab, THE Admin_UI SHALL display a list of Workspace_Projects showing each project's name, root path, target harnesses, and artifact count (included artifacts)
3. WHEN the user clicks a project in the list, THE Admin_UI SHALL display a project detail view showing: the full artifact include/exclude list, per-harness overrides, and the resolved set of artifacts that would be installed for this project
4. THE Admin_API SHALL expose a `GET /api/workspace` endpoint that reads the Workspace_Config and returns the parsed workspace data (knowledge sources, defaults, projects) as JSON
5. THE Admin_API SHALL expose a `PUT /api/workspace/projects/:name` endpoint that accepts updated project fields (harnesses, artifacts include/exclude, overrides) and writes the modified Workspace_Config back to disk
6. WHEN the user edits a project's configuration in the Admin_UI, THE Admin_UI SHALL call the workspace project update endpoint and display a success notification on completion
7. IF no Workspace_Config with `projects` exists, THEN THE Admin_UI SHALL hide the Workspace tab entirely
8. THE Admin_UI SHALL display validation errors inline if the user attempts to save a project configuration that references non-existent artifacts or unsupported harnesses

---

### Feature 7: Dependency Graph Visualization

> **Status**: The catalog-metadata-evolution spec added `depends` and `enhances` fields to artifact frontmatter, and the catalog-admin-management spec provides artifact detail views with navigation. What remains is rendering the dependency relationships as an interactive visual graph within the Admin_UI.

---

### Requirement 33: Dependency Graph Rendering

**User Story:** As a knowledge author, I want to see an interactive visual graph of artifact dependencies, so that I can understand how artifacts relate to each other and identify dependency chains.

#### Acceptance Criteria

1. THE Admin_UI SHALL include a "Dependencies" view accessible from a tab or navigation element in the Artifacts section
2. THE Dependency_Graph SHALL render artifacts as nodes and `depends`/`enhances` relationships as directed edges, using inline SVG rendering with no external library dependencies
3. THE Dependency_Graph SHALL visually distinguish between `depends` edges (solid lines) and `enhances` edges (dashed lines) using different line styles and colors
4. THE Dependency_Graph SHALL label each node with the artifact's displayName and use the artifact's type as a visual shape or color indicator
5. THE Admin_API SHALL expose a `GET /api/graph` endpoint that returns the dependency graph data as JSON: an array of nodes (artifact name, displayName, type) and an array of edges (source, target, relationship type)
6. THE Dependency_Graph SHALL use a force-directed or hierarchical layout algorithm implemented in inline JavaScript (no external dependencies) to position nodes without overlap

### Requirement 34: Dependency Graph Interaction

**User Story:** As a knowledge author, I want to interact with the dependency graph by clicking nodes and filtering, so that I can explore specific dependency chains and navigate to artifact details.

#### Acceptance Criteria

1. WHEN the user clicks a node in the Dependency_Graph, THE Admin_UI SHALL navigate to that artifact's detail view
2. WHEN the user hovers over a node in the Dependency_Graph, THE Admin_UI SHALL highlight the node and all its direct edges (both incoming and outgoing) while dimming unrelated nodes
3. THE Admin_UI SHALL provide a filter control on the Dependency_Graph view allowing the user to filter by artifact type, showing only nodes matching the selected type(s) and their connecting edges
4. THE Dependency_Graph SHALL support pan and zoom interactions (mouse drag to pan, scroll to zoom) for navigating large graphs
5. WHEN the dependency graph contains no edges (no artifacts declare `depends` or `enhances`), THE Admin_UI SHALL display a message indicating no dependency relationships exist and suggest adding `depends` or `enhances` fields to artifact frontmatter

### Requirement 35: Artifact-Scoped Dependency View

**User Story:** As a knowledge author, I want to see the dependency context for a specific artifact in its detail view, so that I can understand what it depends on and what depends on it without viewing the full graph.

#### Acceptance Criteria

1. WHEN the user views an artifact's detail view, THE Admin_UI SHALL display a "Dependencies" section showing the artifact's direct dependencies (artifacts it `depends` on) and direct dependents (artifacts that `depends` on it)
2. THE Admin_UI SHALL display the artifact's `enhances` relationships separately from `depends` relationships, with clear labels distinguishing the two
3. WHEN the user clicks a dependency or dependent artifact name in the detail view, THE Admin_UI SHALL navigate to that artifact's detail view
4. IF an artifact declares a dependency on an artifact name that does not exist in the catalog, THEN THE Admin_UI SHALL display the missing dependency with a warning indicator

---

### Feature 8: Build Dashboard

> **Status**: The `forge build` command exists in `src/build.ts` and compiles artifacts for target harnesses. The Browse_SPA provides the UI infrastructure. What remains is exposing build operations through the Admin_API and rendering build progress, results, and history in the Admin_UI.

---

### Requirement 36: Build Trigger from Admin UI

**User Story:** As a knowledge author, I want to trigger a build from the browse UI, so that I can compile artifacts and see results without switching to the terminal.

#### Acceptance Criteria

1. THE Admin_UI SHALL display a "Build" button in the top-level navigation or toolbar area
2. WHEN the user clicks the "Build" button, THE Admin_UI SHALL call the `POST /api/build` endpoint and display a build progress panel
3. THE Admin_API SHALL expose a `POST /api/build` endpoint that accepts optional `{ harness?: string, artifacts?: string[], strict?: boolean }` parameters and triggers a build operation, returning a build result object
4. THE build result object SHALL contain: status (success/failure), total artifacts compiled, total files written, warnings (including degradation warnings with artifact name, harness, capability, and strategy), and errors (with artifact name, harness, and error message)
5. WHEN the build completes, THE Admin_UI SHALL display the build result with a summary banner (green for success, red for failure) and expandable sections for warnings and errors
6. WHEN the build includes degradation warnings, THE Admin_UI SHALL display each warning with the artifact name, harness, degraded capability, and strategy applied, using the same color coding as the Capability_Badges

### Requirement 37: Build Status and History

**User Story:** As a knowledge author, I want to see the results of recent builds, so that I can track build health over time and review past warnings.

#### Acceptance Criteria

1. THE Admin_API SHALL expose a `GET /api/build/status` endpoint that returns the most recent build result (or null if no build has been run in the current server session)
2. THE Admin_UI SHALL display the most recent build status as a compact indicator in the navigation bar (green checkmark for success, red X for failure, gray dash for no build)
3. THE Browse_Server SHALL retain build results in memory for the duration of the server session (up to the 10 most recent builds)
4. THE Admin_UI SHALL display a build history list in the Build panel showing timestamp, status, artifact count, and warning/error counts for each retained build
5. WHEN the user clicks a build history entry, THE Admin_UI SHALL expand the entry to show its full warnings and errors

### Requirement 38: Build Configuration in Admin UI

**User Story:** As a knowledge author, I want to configure build parameters from the UI before triggering a build, so that I can target specific harnesses or artifacts without CLI flags.

#### Acceptance Criteria

1. THE Admin_UI SHALL display build configuration options before triggering a build: a harness filter (checkboxes for each supported harness, defaulting to all), an artifact filter (searchable multi-select from catalog), and a strict mode toggle
2. WHEN the user selects specific harnesses or artifacts, THE Admin_UI SHALL pass these as parameters to the `POST /api/build` endpoint
3. WHEN strict mode is enabled and the build encounters an unsupported capability, THE Admin_API SHALL return the build result with status "failure" and the unsupported capability listed in the errors array
4. THE Admin_UI SHALL persist the user's last build configuration in browser localStorage so that repeated builds use the same settings by default
