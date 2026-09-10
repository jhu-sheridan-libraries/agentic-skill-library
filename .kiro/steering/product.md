---
inclusion: always
---

# Product Overview

Kanon is a CLI tool that lets you author **knowledge artifacts** (skills, powers, rules, workflows, prompts, agents, templates, reference packs) in a single canonical format and compile them to any supported AI coding assistant harness.

The repository is called **context-bazaar** and contains both the kanon CLI and a catalog of artifacts organized into themed collections.

## Core Pipeline

**source → parse → adapt → write**

1. Artifacts live in `kanon/knowledge/<name>/` as `knowledge.md` (YAML frontmatter + Markdown body) with optional `hooks.yaml`, `mcp-servers.yaml`, and `workflows/` phase files.
2. The CLI parses frontmatter, validates with Zod schemas, and passes results to per-harness adapters.
3. Each adapter is a pure function that uses Nunjucks templates to produce harness-native output in `dist/<harness>/<artifact>/`.

## Supported Harnesses

Kiro, Claude Code, Codex, GitHub Copilot, Cursor, Windsurf, Cline, Amazon Q Developer, Gemini CLI — nine harnesses total. The canonical list is `SUPPORTED_HARNESSES` in `src/schemas.ts`; treat that constant as the source of truth.

## Rosetta Stone (bidirectional translation)

Beyond the one-way compile pipeline, the **Rosetta** subsystem (`src/rosetta/`, `kanon rosetta`) provides bidirectional, format-aware translation between harness-native formats and the canonical model. It detects a document's source format, inspects a translation without writing files (dry run), and translates in both directions (inbound source → canonical, outbound canonical → target). Each format is described by a versioned **format contract** with a capability matrix, detection rules, and a security policy; translation runs through explicit phases (request → registry → detection → resolution → plan → apply) and emits diagnostics.

## Provenance & Attribution

Imported artifacts carry **provenance** and **upstream attribution**. `kanon import` records where an artifact came from; `kanon attribute` generates a NOTICES-style report grouped by license, and `kanon attribute backfill` adds attribution blocks to imported artifacts without touching the `author` field. Three-way reconciliation keeps curation-owned and upstream-owned frontmatter fields in sync.

## Key Concepts

- **Knowledge artifact**: A canonical source file that compiles to multiple harness formats.
- **Harness**: An AI coding assistant target with its own file format and conventions.
- **Asset type**: `skill | power | rule | workflow | agent | prompt | template | reference-pack`. `power` is a deprecated alias for `skill` — canonical going forward is `type: skill` plus an explicit `harness-config.kiro.format: "power"` (see ADR-0051).
- **Collection**: A group of related artifacts. Membership is declared in each artifact's frontmatter (`collections: [...]`), not in the collection manifest.
- **Catalog**: Machine-readable index (`catalog.json`) of all artifacts.
- **Adapter**: A pure function that transforms a parsed artifact into harness-specific output files.
- **Outcome**: A declared, testable result an artifact is expected to produce (`specification | operation | invariant`), tracked in an outcomes registry with globally unique `out-` prefixed IDs.
- **Format contract**: A versioned Rosetta description of a harness format — capability matrix, detection rules, direction, and security policy.
- **Provenance / attribution**: Recorded origin and license lineage for imported artifacts.
