---
inclusion: always
---

# Product Overview

Skill Forge is a CLI tool that lets you author **knowledge artifacts** (skills, powers, rules, workflows, prompts, agents, templates, reference packs) in a single canonical format and compile them to any supported AI coding assistant harness.

The repository is called **context-bazaar** and contains both the forge CLI and a catalog of artifacts organized into themed collections.

## Core Pipeline

**source → parse → adapt → write**

1. Artifacts live in `skill-forge/knowledge/<name>/` as `knowledge.md` (YAML frontmatter + Markdown body) with optional `hooks.yaml`, `mcp-servers.yaml`, and `workflows/` phase files.
2. The CLI parses frontmatter, validates with Zod schemas, and passes results to per-harness adapters.
3. Each adapter is a pure function that uses Nunjucks templates to produce harness-native output in `dist/<harness>/<artifact>/`.

## Supported Harnesses

Kiro, Claude Code, GitHub Copilot, Cursor, Windsurf, Cline, Amazon Q Developer.

## Key Concepts

- **Knowledge artifact**: A canonical source file that compiles to multiple harness formats.
- **Harness**: An AI coding assistant target with its own file format and conventions.
- **Collection**: A group of related artifacts. Membership is declared in each artifact's frontmatter, not in the collection manifest.
- **Catalog**: Machine-readable index (`catalog.json`) of all artifacts.
- **Adapter**: A pure function that transforms a parsed artifact into harness-specific output files.
