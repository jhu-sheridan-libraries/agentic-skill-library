# Skill Forge & Context Bazaar

[![CI](https://img.shields.io/github/actions/workflow/status/jhu-sheridan-libraries/agentic-skill-forge/ci.yml?label=CI)](https://github.com/jhu-sheridan-libraries/agentic-skill-forge/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/thinkingsage/context-bazaar/graph/badge.svg?token=D6AVIGVORS)](https://codecov.io/gh/thinkingsage/context-bazaar)
[![CodeQL](https://img.shields.io/github/actions/workflow/status/jhu-sheridan-libraries/agentic-skill-forge/codeql.yml?label=CodeQL)](https://github.com/jhu-sheridan-libraries/agentic-skill-forge/actions/workflows/codeql.yml)
[![Security Audit](https://github.com/jhu-sheridan-libraries/agentic-skill-forge/actions/workflows/audit.yml/badge.svg)](https://github.com/jhu-sheridan-libraries/agentic-skill-forge/actions/workflows/audit.yml)
[![License](https://img.shields.io/github/license/jhu-sheridan-libraries/agentic-skill-forge?label=License)](LICENSE)

Knowledge artifacts for AI coding assistants. Author once, compile to every harness.

## What Is This?

AI coding assistants (Claude Code, Kiro, Copilot, Cursor, Windsurf, Cline, Q Developer) each use a different format for rules, context, and configuration. Context Bazaar lets you author a **knowledge artifact** in a single canonical format and compile it to any supported harness with the **Skill Forge** CLI.

This repository contains the forge tool and a catalog of 41 artifacts organized into themed collections.

## Key Concepts

| Concept | Description |
|---|---|
| **Knowledge artifact** | A skill, prompt, workflow, power, agent, rule, template, or reference pack. Lives in `skill-forge/knowledge/<name>/`. |
| **Harness** | An AI coding assistant target (e.g. Kiro, Claude Code, Copilot). Each has its own file format and conventions. |
| **Collection** | A group of related artifacts. Membership is declared in each artifact's frontmatter. |
| **Catalog** | Machine-readable index (`catalog.json`) of all artifacts. Powers the browse UI and MCP bridge. |
| **Capability matrix** | Per-harness declaration of feature support levels (full, partial, none) with degradation strategies for unsupported features. |
| **Skill Forge** | The CLI that validates, builds, catalogs, imports, installs, and publishes artifacts. |

## Supported Harnesses

| Harness | Compiled Output |
|---|---|
| **Kiro** | Steering files, hooks, powers, skills |
| **Claude Code** | CLAUDE.md, settings.json, MCP config |
| **GitHub Copilot** | Instructions, path-scoped rules, AGENTS.md |
| **Cursor** | Rules, MCP config |
| **Windsurf** | Rules, workflows, MCP config |
| **Cline** | Toggleable rules, hook scripts, MCP config |
| **Amazon Q Developer** | Rules, agents, MCP config |

## Collections

| Collection | Artifacts | Focus |
|---|---|---|
| **Kiro Official** | 26 | Upstream powers from Kiro — AWS, observability, infrastructure, partner integrations |
| **Byron Powers** | 8 | Literary and publishing workflows — novelists, technical authors, agents, proofreading |
| **Neon Caravan** | 6 | Craft-focused developer workflows — commits, debugging, code review, type discipline |
| **JHU** | 1 | Johns Hopkins University Sheridan Libraries artifacts |

Browse the full catalog with `bun run dev catalog browse` or see the [deployed catalog site](https://jhu-sheridan-libraries.github.io/agentic-skill-forge/).

## Repository Structure

```
context-bazaar/
├── skill-forge/             ← the forge CLI tool (TypeScript, Bun)
│   ├── src/                 ← CLI and core modules
│   │   ├── adapters/        ← per-harness compiler adapters (pure functions)
│   │   ├── backends/        ← pluggable install/publish backends (GitHub, S3, HTTP, local)
│   │   ├── guild/           ← manifest-driven team distribution and sync
│   │   ├── importers/       ← multi-harness import parsers
│   │   └── help/            ← CLI help rendering
│   ├── knowledge/           ← canonical knowledge artifacts
│   ├── collections/         ← collection manifests (metadata only)
│   ├── templates/           ← Nunjucks templates for harness output
│   ├── bridge/              ← compiled MCP server (CJS, for Claude Code plugin)
│   ├── dist/                ← compiled harness output (generated)
│   ├── evals/               ← cross-artifact eval configs
│   ├── changes/             ← towncrier-style changelog fragments
│   ├── docs/adr/            ← architecture decision records
│   ├── scripts/             ← build and release scripts
│   ├── .forge/              ← guild manifest and sync state
│   ├── catalog.json         ← machine-readable artifact index (generated)
│   └── forge.config.yaml    ← forge configuration (backends, workspace)
├── .claude-plugin/          ← Claude Code plugin manifests
├── .kiro/                   ← Kiro workspace config (steering, specs)
├── .github/                 ← CI/CD workflows, issue templates, PR template
├── .mcp.json                ← MCP server config
├── CLAUDE.md                ← Claude Code project instructions
├── CONTRIBUTING.md          ← how to add artifacts and contribute
├── PLUGIN_USAGE.md          ← Claude Code plugin install and usage
└── CODE_OF_CONDUCT.md
```

## Quick Start

### Use as a Claude Code plugin

See [Plugin Usage](PLUGIN_USAGE.md) for installation instructions. No build step required.

### Develop locally

```bash
cd skill-forge
bun install

# Build all artifacts for all harnesses
bun run dev build

# Build for a single harness
bun run dev build --harness kiro

# Validate artifacts (including security checks)
bun run dev validate
bun run dev validate --security

# Browse the catalog in your browser
bun run dev catalog browse

# Export a static catalog site for GitHub Pages
bun run dev catalog export --output dist/web

# Scaffold a new artifact
bun run dev new my-artifact --type skill

# Guided walkthrough for first-time authors
bun run dev tutorial

# Install into your project
bun run dev install my-artifact --harness kiro --source .

# Publish to a release backend
bun run dev publish

# Team distribution
bun run dev guild sync
```

## How It Works

The core pipeline is: **source** → **parse** → **adapt** → **write**.

1. Each artifact in `knowledge/<name>/` contains a `knowledge.md` file (YAML frontmatter + Markdown body), with optional `hooks.yaml`, `mcp-servers.yaml`, and `workflows/` phase files.
2. The forge CLI parses the frontmatter and body, validates against Zod schemas, and passes the result to per-harness **adapters**.
3. Each adapter is a pure function that receives the parsed artifact plus a capability context, uses Nunjucks templates to produce harness-native output, and applies degradation strategies for unsupported features.

Artifact types: `skill` · `power` · `rule` · `workflow` · `agent` · `prompt` · `template` · `reference-pack`

## Documentation

| Document | Description |
|---|---|
| [Skill Forge README](skill-forge/README.md) | CLI commands, project structure, development guide |
| [Plugin Usage](PLUGIN_USAGE.md) | Claude Code plugin installation and MCP tools |
| [Contributing](CONTRIBUTING.md) | How to add artifacts, run tests, and submit PRs |
| [Architecture Decision Records](skill-forge/docs/adr/README.md) | 30 ADRs documenting design rationale and key technical choices |
| [Changelog](skill-forge/CHANGELOG.md) | Release history |

## License

[MIT License](LICENSE)
