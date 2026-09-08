# Kanon

[![npm version](https://img.shields.io/npm/v/@thinkingsage/kanon?label=npm)](https://www.npmjs.com/package/@thinkingsage/kanon)
[![CI](https://img.shields.io/github/actions/workflow/status/jhu-sheridan-libraries/agentic-skill-library/ci.yml?label=CI)](https://github.com/jhu-sheridan-libraries/agentic-skill-library/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/jhu-sheridan-libraries/agentic-skill-library?label=License)](LICENSE)

Write knowledge once, compile to every AI coding assistant harness.

Kanon is a CLI tool that lets you author **knowledge artifacts** (skills, powers, rules, workflows, prompts, agents, templates, reference packs) in a single canonical format and compile them to any supported AI coding assistant.

## Installation

Kanon runs on [Bun](https://bun.sh) (≥ 1.4.2). Pick one:

```bash
# Run without installing (scoped package name)
bunx @thinkingsage/kanon --help

# Install globally
bun add -g @thinkingsage/kanon
kanon --help

# From source (for development or to hack on Kanon itself)
git clone https://github.com/jhu-sheridan-libraries/agentic-skill-library.git
cd agentic-skill-library/kanon
bun install
bun run dev --help          # `bun run dev` === `bun run src/cli.ts`
```

> **Note:** the bare npm name `kanon` is an unrelated package — always install the scoped `@thinkingsage/kanon`. When working from a source checkout, invoke the CLI with `bun run dev <command>` rather than a global `kanon`.

## Quick Start

```bash
# Scaffold a new knowledge artifact (interactive wizard)
kanon new my-artifact

# Compile all artifacts for all harnesses
kanon build

# Compile for a single harness
kanon build --harness kiro
kanon build --harness codex

# Validate artifacts (add --security for injection/obfuscation checks)
kanon validate
kanon validate --security

# Browse the catalog in your browser
kanon catalog browse

# Install a compiled artifact into the current project
kanon install my-artifact --harness kiro --source .
```

From a source checkout, prefix each command with `bun run dev` (e.g. `bun run dev build --harness kiro`).

## End-to-End Walkthrough

Author an artifact once, compile it, and install it into a project — the full `source → parse → adapt → write` loop.

### 1. Author

Scaffold a new artifact. The wizard prompts for type, harnesses, and metadata; pass `--yes` to skip it and take template defaults.

```bash
kanon new commit-conventions
```

This creates `knowledge/commit-conventions/knowledge.md` (plus optional `hooks.yaml`, `mcp-servers.yaml`, and a `workflows/` directory). Edit the frontmatter and body — see [the worked example](#a-worked-knowledgemd) below.

### 2. Validate

Check the artifact against the Zod schemas, and optionally run the security scan (prompt-injection markers, obfuscation, dangerous hook commands):

```bash
kanon validate knowledge/commit-conventions
kanon validate --security
```

### 3. Build

Compile to harness-native output under `dist/<harness>/<artifact>/`:

```bash
kanon build --harness claude-code    # one harness
kanon build                          # all harnesses
kanon build --strict                 # fail on any unsupported-capability warning
```

For example, `--harness kiro` emits a steering file (and hooks / MCP config when declared); `--harness claude-code` emits a `CLAUDE.md` fragment; `--harness codex` emits `AGENTS.md` and a native skill.

### 4. Install

Copy the compiled output into a target project's harness-native location:

```bash
cd ~/my-project
kanon install commit-conventions --harness kiro --source /path/to/kanon
```

The artifact now lives at `.kiro/steering/commit-conventions.md` (Kiro), `CLAUDE.md` (Claude Code), and so on — wherever that harness reads its rules.

## A Worked `knowledge.md`

An artifact is a directory containing `knowledge.md`: YAML frontmatter (metadata, validated by Zod) plus a Markdown body (the actual instructions the AI assistant reads).

```markdown
---
name: commit-conventions
displayName: Commit Message Conventions
description: Enforce Conventional Commits with an imperative subject and a scoped type.
keywords:
  - git
  - commits
  - conventional-commits
author: Your Name
version: 0.1.0
harnesses:
  - kiro
  - claude-code
  - codex
type: skill
inclusion: always
categories:
  - code-style
ecosystem: []
maturity: experimental
license: MIT
---

# Commit Message Conventions

## Overview

Write commit messages that follow Conventional Commits so history stays
machine-parseable and changelogs generate cleanly.

## Best Practices

- Start the subject with a type: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.
- Keep the subject imperative and under 72 characters.
- Put motivation and context in the body, wrapped at 72 columns.

## Examples

    feat(parser): support namespaced artifact layouts
    fix(build): mark chromium-bidi external so --compile succeeds
```

Key frontmatter fields:

| Field | Purpose |
|-------|---------|
| `name` / `displayName` | Kebab-case identifier and human-readable title |
| `harnesses` | Which assistants this artifact compiles to |
| `type` | `skill` · `power` · `rule` · `workflow` · `agent` · `prompt` · `template` · `reference-pack` |
| `inclusion` | Kiro loading mode: `always` · `auto` (fileMatch) · `manual` |
| `categories` / `ecosystem` | Catalog facets for browse/filter |

Unknown frontmatter fields are preserved (the schema uses `.passthrough()`), so harness-specific config under `harness-config:` survives round-trips.

## CLI Commands

| Command | Description |
|---------|-------------|
| `kanon build` | Compile knowledge artifacts to harness-native formats |
| `kanon install [artifact]` | Install compiled artifacts into the current project |
| `kanon new <name>` | Scaffold a new knowledge artifact |
| `kanon tutorial` | Guided walkthrough for first-time artifact authors |
| `kanon validate [path]` | Validate artifacts (add `--security` for injection/obfuscation checks) |
| `kanon catalog generate` | Generate `catalog.json` |
| `kanon catalog browse` | Browse the catalog in a local web UI |
| `kanon catalog export` | Export a self-contained static site for GitHub Pages |
| `kanon collection` | Manage knowledge collections (status, new, build) |
| `kanon import <path>` | Import from external sources (Kiro powers/skills) |
| `kanon publish` | Publish compiled artifacts to a release backend (GitHub, S3, HTTP) |
| `kanon eval [artifact]` | Run eval tests against compiled artifacts |
| `kanon guild` | Team-mode artifact distribution (init, sync, status, hook) |
| `kanon help [command]` | Show help for any command |

The deprecated `forge` alias remains available for one release, so existing Skill Forge commands such as `forge build --harness codex` and `forge install my-artifact --harness codex --source .` continue to work while projects migrate to `kanon`.

## Supported Harnesses

| Harness | Output Formats |
|---------|---------------|
| **Kiro** | Steering files, hooks, powers, skills |
| **Claude Code** | CLAUDE.md, settings.json, MCP config |
| **OpenAI Codex** | AGENTS.md, native skills, MCP config |
| **GitHub Copilot** | Instructions, path-scoped instructions, AGENTS.md |
| **Cursor** | Rules, MCP config |
| **Windsurf** | Rules, workflows, MCP config |
| **Cline** | Toggleable rules, hook scripts, MCP config |
| **Amazon Q Developer** | Rules, agents, MCP config |

Each harness has a capability matrix declaring support levels (full, partial, none) for features like hooks, MCP servers, path scoping, and workflows. Unsupported features are handled via configurable degradation strategies (inline, comment, omit). Codex has no declarative event hooks, so hook definitions are rendered as manual guidance with warnings. Use `--strict` on build to surface unsupported capabilities explicitly.

## Core Pipeline

```
source → parse → adapt → write
```

1. Artifacts live in `knowledge/<name>/` as `knowledge.md` (YAML frontmatter + Markdown body) with optional `hooks.yaml`, `mcp-servers.yaml`, and `workflows/` phase files.
2. The CLI parses frontmatter, validates with Zod schemas, and passes results to per-harness adapters.
3. Each adapter is a pure function that uses Nunjucks templates to produce harness-native output in `dist/<harness>/<artifact>/`.

## Project Structure

```
kanon/
├── knowledge/             # Canonical knowledge artifacts
│   └── <name>/            # Each artifact is a directory
│       ├── knowledge.md   #   YAML frontmatter + Markdown body
│       ├── hooks.yaml     #   Optional canonical hooks
│       ├── mcp-servers.yaml # Optional MCP server definitions
│       └── workflows/     #   Optional phase files (workflow type)
├── collections/           # Collection manifests (YAML, metadata only)
├── templates/
│   ├── harness-adapters/  # Per-harness Nunjucks output templates
│   ├── knowledge/         # Scaffold templates for `kanon new`
│   └── eval-contexts/     # Harness context simulation for evals
├── dist/                  # Compiled per-harness output (generated)
├── bridge/                # Compiled MCP server bridge (CJS, for Claude Code plugin)
├── mcp-servers/           # Shared MCP server definitions
├── evals/                 # Cross-artifact eval configs
├── changes/               # Towncrier-style changelog fragments
├── docs/adr/              # Architecture Decision Records
├── scripts/               # Build and release scripts
├── .forge/                # Guild manifest and sync state
├── src/                   # CLI and core modules
│   ├── cli.ts             #   CLI entry point (Commander-based)
│   ├── schemas.ts         #   All Zod schemas (central validation)
│   ├── parser.ts          #   Frontmatter + body parser
│   ├── build.ts           #   Build pipeline orchestration
│   ├── validate.ts        #   Artifact validation logic
│   ├── catalog.ts         #   Catalog generation
│   ├── browse.ts          #   Catalog browser server + static export
│   ├── browse-ui.ts       #   Catalog browser SPA (inline HTML/CSS/JS)
│   ├── install.ts         #   Install artifacts from backends
│   ├── publish.ts         #   Publish artifacts to backends
│   ├── import.ts          #   Import from existing Kiro powers/skills
│   ├── versioning.ts      #   Version embedding and manifests
│   ├── workspace.ts       #   Workspace config for monorepo support
│   ├── eval.ts            #   Eval runner (promptfoo)
│   ├── mcp-bridge.ts      #   MCP server bridge entry point
│   ├── adapters/          #   Per-harness compiler adapters (pure functions)
│   ├── backends/          #   Pluggable install/publish backends (GitHub, S3, HTTP, local)
│   ├── guild/             #   Manifest-driven distribution and sync
│   ├── importers/         #   Multi-harness import parsers
│   ├── help/              #   CLI help rendering
│   └── __tests__/         #   All tests
├── catalog.json           # Machine-readable artifact catalog (generated)
├── kanon.config.yaml      # Kanon configuration (backends, workspace)
└── package.json
```

## Development

```bash
# Run tests (all must pass)
bun test

# Type check
bun x tsc --noEmit

# Lint and format
bun run lint
bun run lint:fix
bun run format

# Compile the MCP bridge
bun run build:bridge

# Create a changelog fragment
bun run changelog:new --type added --message "description"

# Compile changelog
bun run changelog:compile
```

## Architecture Decisions

Key design choices are documented as [Architecture Decision Records](docs/adr/README.md) (30 ADRs and counting).

## License

MIT
