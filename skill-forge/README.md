# Skill Forge

Write knowledge once, compile to every AI coding assistant harness.

Skill Forge is a CLI tool that lets you author **knowledge artifacts** (skills, powers, rules, workflows, prompts, agents, templates, reference packs) in a single canonical format and compile them to any supported AI coding assistant.

## Quick Start

```bash
# Clone and install
git clone https://github.com/jhu-sheridan-libraries/skill-forge.git
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

# Install into your project
bun run dev install my-artifact --harness kiro --source .

# Scaffold a new knowledge artifact
bun run dev new my-artifact

# Guided walkthrough for first-time authors
bun run dev tutorial
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `forge build` | Compile knowledge artifacts to harness-native formats |
| `forge install [artifact]` | Install compiled artifacts into the current project |
| `forge new <name>` | Scaffold a new knowledge artifact |
| `forge tutorial` | Guided walkthrough for first-time artifact authors |
| `forge validate [path]` | Validate artifacts (add `--security` for injection/obfuscation checks) |
| `forge catalog generate` | Generate `catalog.json` |
| `forge catalog browse` | Browse the catalog in a local web UI |
| `forge catalog export` | Export a self-contained static site for GitHub Pages |
| `forge collection` | Manage knowledge collections (status, new, build) |
| `forge import <path>` | Import from external sources (Kiro powers/skills) |
| `forge publish` | Publish compiled artifacts to a release backend (GitHub, S3, HTTP) |
| `forge eval [artifact]` | Run eval tests against compiled artifacts |
| `forge guild` | Team-mode artifact distribution (init, sync, status, hook) |
| `forge help [command]` | Show help for any command |

## Supported Harnesses

| Harness | Output Formats |
|---------|---------------|
| **Kiro** | Steering files, hooks, powers, skills |
| **Claude Code** | CLAUDE.md, settings.json, MCP config |
| **GitHub Copilot** | Instructions, path-scoped instructions, AGENTS.md |
| **Cursor** | Rules, MCP config |
| **Windsurf** | Rules, workflows, MCP config |
| **Cline** | Toggleable rules, hook scripts, MCP config |
| **Amazon Q Developer** | Rules, agents, MCP config |

Each harness has a capability matrix declaring support levels (full, partial, none) for features like hooks, MCP servers, path scoping, and workflows. Unsupported features are handled via configurable degradation strategies (inline, comment, omit). Use `--strict` on build to treat unsupported capabilities as errors.

## Core Pipeline

```
source → parse → adapt → write
```

1. Artifacts live in `knowledge/<name>/` as `knowledge.md` (YAML frontmatter + Markdown body) with optional `hooks.yaml`, `mcp-servers.yaml`, and `workflows/` phase files.
2. The CLI parses frontmatter, validates with Zod schemas, and passes results to per-harness adapters.
3. Each adapter is a pure function that uses Nunjucks templates to produce harness-native output in `dist/<harness>/<artifact>/`.

## Project Structure

```
skill-forge/
├── knowledge/             # Canonical knowledge artifacts
│   └── <name>/            # Each artifact is a directory
│       ├── knowledge.md   #   YAML frontmatter + Markdown body
│       ├── hooks.yaml     #   Optional canonical hooks
│       ├── mcp-servers.yaml # Optional MCP server definitions
│       └── workflows/     #   Optional phase files (workflow type)
├── collections/           # Collection manifests (YAML, metadata only)
├── templates/
│   ├── harness-adapters/  # Per-harness Nunjucks output templates
│   ├── knowledge/         # Scaffold templates for `forge new`
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
├── forge.config.yaml      # Forge configuration (backends, workspace)
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
