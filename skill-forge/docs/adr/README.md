# Architecture Decision Records

[← Back to project README](../../README.md)

This directory contains Architecture Decision Records (ADRs) for the Skill Forge project.

ADRs document significant architectural decisions made during the project's development. Each record captures the context, decision, and consequences of a choice that affects the system's structure, dependencies, or behavior.

## Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [001](0001-use-nunjucks-for-templates.md) | Use Nunjucks for template rendering | Accepted | 2026-04-10 |
| [002](0002-use-zod-for-validation.md) | Use Zod for runtime validation and type inference | Accepted | 2026-04-10 |
| [003](0003-adapters-as-pure-functions.md) | Harness adapters as pure functions | Accepted | 2026-04-10 |
| [004](0004-use-gray-matter-for-frontmatter.md) | Use gray-matter for frontmatter parsing | Accepted | 2026-04-10 |
| [005](0005-bun-runtime-and-tooling.md) | Use Bun as runtime and build tool | Accepted | 2026-04-10 |
| [006](0006-commander-for-cli.md) | Use Commander.js for CLI framework | Accepted | 2026-04-10 |
| [007](0007-controlled-enum-for-categories.md) | Controlled enum for categories, freeform for ecosystem and dependencies | Proposed | 2026-04-11 |
| [008](0008-warnings-for-unresolved-dependencies.md) | Warnings (not errors) for unresolved dependency references | Proposed | 2026-04-11 |
| [009](0009-clack-prompts-for-interactive-cli.md) | Use @clack/prompts for interactive CLI flows | Proposed | 2026-04-11 |
| [010](0010-scaffold-first-overwrite-on-success.md) | Scaffold-first, overwrite-on-success pattern for interactive wizard | Proposed | 2026-04-11 |
| [011](0011-pure-function-help-renderer.md) | Pure-function help renderer | Proposed | 2026-04-11 |
| [012](0012-deprecate-global-type-for-per-harness-format.md) | Deprecate global type field in favor of per-harness format | Superseded by ADR-014 | 2026-04-11 |
| [013](0013-centralized-format-registry.md) | Centralized format registry as single source of truth | Proposed | 2026-04-11 |
| [014](0014-repurpose-type-as-asset-taxonomy.md) | Repurpose `type` field as asset taxonomy | Proposed | 2026-04-12 |
| [015](0015-knowledge-bazaar-shared-manifest-phase-1.md) | Knowledge bazaar shared manifest — Phase 1 governance and discovery fields | Proposed | 2026-04-12 |
| [016](0016-collection-membership-in-artifact-frontmatter.md) | Collection membership declared in artifact frontmatter | Proposed | 2026-04-12 |
| [017](0017-pluggable-backend-abstraction-for-artifact-publishing.md) | Pluggable backend abstraction for artifact publishing and installation | Proposed | 2026-04-12 |
| [018](0018-use-gh-cli-as-github-release-backend.md) | Use `gh` CLI as the GitHub release backend | Proposed | 2026-04-12 |
| [019](0019-forge-import-auto-detecting-kiro-format-importer.md) | `forge import` — auto-detecting importer for external Kiro format | Proposed | 2026-04-12 |
| [020](0020-mcp-bridge-as-claude-code-plugin-integration-layer.md) | MCP bridge as the Claude Code plugin integration layer | Proposed | 2026-04-12 |
| [021](0021-integrated-static-security-validation.md) | Integrated static security validation in `forge validate --security` | Proposed | 2026-04-12 |
| [022](0022-two-layer-artifact-security-review.md) | Two-layer artifact security review — static + LLM adversarial eval | Proposed | 2026-04-12 |
| [023](0023-manifest-driven-artifact-distribution-with-global-cache.md) | Manifest-driven artifact distribution with global cache | Proposed | 2026-04-13 |
| [024](0024-browse-server-admin-crud-with-mutable-state.md) | Browse server admin CRUD with mutable state and modular admin layers | Proposed | 2026-04-20 |
| [025](0025-browse-ui-module-extraction.md) | Extract browse UI template into dedicated module | Proposed | 2026-04-20 |
| [026](0026-workspace-config-extends-forge-config-yaml.md) | Workspace config extends forge.config.yaml | Proposed | 2026-04-21 |
| [027](0027-temper-renderer-reuses-browse-spa-patterns.md) | Temper renderer reuses Browse SPA patterns | Proposed | 2026-04-21 |
| [028](0028-capability-matrix-in-adapters.md) | Capability matrix co-located with adapters | Accepted | 2026-04-22 |
| [029](0029-importers-module-for-multi-harness-parsers.md) | Importers module for multi-harness parsers | Proposed | 2026-04-23 |
| [030](0030-authoring-level-version-embedding-and-manifests.md) | Authoring-level version embedding and manifests | Accepted | 2026-04-21 |
| [031](0031-souk-compass-standalone-mcp-server-for-semantic-search.md) | Souk Compass — standalone MCP server for semantic search | Proposed | 2026-04-24 |
| [032](0032-solrcloud-mode-for-souk-compass.md) | SolrCloud mode for Souk Compass local development | Accepted | 2026-04-24 |
| [033](0033-hash-based-deep-links-in-browse-spa.md) | Hash-based deep links in browse SPA | Accepted | 2026-04-27 |
| [034](0034-solr-10-upgrade-with-scalar-quantization.md) | Upgrade Souk Compass to Solr 10 with scalar quantized vectors | Accepted | 2026-05-03 |

## Creating a New ADR

Copy the template and fill it in:

```bash
cp docs/adr/template.md docs/adr/NNNN-short-title.md
```

Use the next available number. Keep titles short and descriptive.
