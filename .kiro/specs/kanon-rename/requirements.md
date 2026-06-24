# Requirements Document

## Introduction

This spec covers the migration of the project's tool name from "Skill Forge" to "Kanon" (from Greek κανών — "rule, standard, measure"). The name directly references the tool's central abstraction: a canonical source format from which all harness-specific outputs derive. See ADR-0044 for the decision rationale.

The rename touches the directory structure, package identity, CLI binary name, documentation, CI/CD pipelines, steering files, and internal references across ~135 files. The migration is executed as a single coordinated change to avoid prolonged ambiguity, with a temporary deprecation alias (`forge` → `kanon`) for one release cycle.

The `context-bazaar` repository name is unaffected — it represents the marketplace/catalog concept and remains appropriate.

### Scope Boundaries

- **In scope**: Directory rename, package rename, binary rename, config file rename, all textual references, CI pipelines, MCP bridge paths, steering rules, knowledge artifacts
- **Out of scope**: Artifact format changes, schema changes, new features, Solr collection names, the `context-bazaar` repo name

## Requirements

### Functional Requirements

- **FR-1**: The top-level directory `skill-forge/` MUST be renamed to `kanon/`
- **FR-2**: The npm package name MUST change from `@thinkingsage/skill-forge` to `@thinkingsage/kanon`
- **FR-3**: The CLI binary MUST be invocable as `kanon` (e.g., `kanon build`, `kanon new`, `kanon catalog`)
- **FR-4**: A deprecated alias `forge` MUST remain functional for one release cycle, printing a deprecation notice directing users to `kanon`
- **FR-5**: The config file MUST be renamed from `forge.config.yaml` to `kanon.config.yaml`
- **FR-6**: The config loader MUST fall back to `forge.config.yaml` if `kanon.config.yaml` is not found, with a deprecation warning
- **FR-7**: The power directory `powers/skill-forge/` MUST be renamed to `powers/kanon/`
- **FR-8**: The self-referencing knowledge artifact `knowledge/skill-forge/` MUST be renamed to `knowledge/kanon/`
- **FR-9**: All prose references to "Skill Forge" in documentation MUST be updated to "Kanon"
- **FR-10**: All code references to `skill-forge`, `skill_forge` in imports, paths, and identifiers MUST be updated
- **FR-11**: All CI/CD workflow paths MUST be updated to reference `kanon/` instead of `skill-forge/`
- **FR-12**: The MCP bridge path in `.mcp.json` MUST be updated
- **FR-13**: The `.claude-plugin/plugin.json` paths MUST be updated
- **FR-14**: Hook files (`.kiro/hooks/`) referencing skill-forge paths MUST be updated
- **FR-15**: Steering files (`.kiro/steering/`) MUST be updated with new paths and names

### Non-Functional Requirements

- **NFR-1**: All 333+ existing tests MUST pass after the rename (`bun test`)
- **NFR-2**: TypeScript MUST compile without errors (`bun x tsc --noEmit`)
- **NFR-3**: Lint MUST pass (`bun run lint`)
- **NFR-4**: Full build MUST succeed (`bun run dev build`)
- **NFR-5**: The migration MUST be completed in a single PR to avoid extended ambiguity
- **NFR-6**: Git history MUST be preserved via `git mv` for directory renames
- **NFR-7**: The `.forge/` internal state directory name is unchanged (it's a generic forge concept)
- **NFR-8**: The CHANGELOG MUST document the rename with migration instructions for existing users
