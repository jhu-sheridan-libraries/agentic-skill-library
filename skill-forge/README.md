# Skill Forge

Write knowledge once, compile to every AI coding assistant harness.

Skill Forge is a CLI tool that lets you author **knowledge artifacts** (skills, powers, rules, workflows, prompts, agents, templates, reference packs) in a single canonical format and compile them to any supported AI coding assistant.

## Who is this for?

Three audiences, three entry points:

| You want to... | Start here |
|---|---|
| Install powers and skills in your project | [Using Skill Forge in Your Project](docs/getting-started/using-in-your-project.md) |
| Share a curated set of artifacts with your team | [Joining or Running a Guild](docs/getting-started/joining-a-guild.md) |
| Build, extend, or contribute to Skill Forge | [Developing Skill Forge](docs/getting-started/developing-skill-forge.md) |

New here? The [Getting Started overview](docs/getting-started/README.md) orients all three roles in about two minutes.

## Install

Requires [Bun](https://bun.sh) ≥ 1.0.

```bash
# Install globally from npm
bun add -g @thinkingsage/skill-forge

# Or run without installing
bunx @thinkingsage/skill-forge <command>

# Or clone and run from source
git clone https://github.com/thinkingsage/context-bazaar.git
cd context-bazaar/skill-forge
bun install
bun run dev <command>
```

## Quick Start

```bash
# Build all artifacts for all harnesses
forge build

# Build for a single harness
forge build --harness kiro

# Validate artifacts (including security checks)
forge validate
forge validate --security

# Browse the catalog in your browser
forge catalog browse

# Install into your project
forge install my-artifact --harness kiro --source .

# Scaffold a new knowledge artifact
forge new my-artifact

# Guided walkthrough for first-time authors
forge tutorial

# Team-mode: sync shared artifacts across a team
forge guild init my-artifact --version "^1.0.0"
forge guild sync
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
| `forge import <path>` | Import from external sources (Kiro powers/skills, Cursor rules, etc.) |
| `forge publish` | Publish compiled artifacts to a release backend (GitHub, S3, HTTP) |
| `forge eval [artifact]` | Run eval tests against compiled artifacts |
| `forge guild` | Team-mode artifact distribution (init, sync, status, hook) |
| `forge help [command]` | Show help for any command |

## Supported Harnesses

| Harness | Output Formats |
|---------|---------------|
| **Kiro** | Steering files, hooks, powers, skills |
| **Claude Code** | CLAUDE.md, settings.json, MCP config |
| **Codex** | AGENTS.md, repo-local skills, MCP config (config.toml) |
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
├── mcp-servers/
│   └── souk-compass/      # Semantic search MCP server (Solr-backed)
├── evals/                 # Cross-artifact eval configs
├── changes/               # Towncrier-style changelog fragments
├── docs/                  # Project documentation (getting-started, ADRs, rubrics)
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
│   └── __tests__/         #   All tests (unit, integration, property-based)
├── catalog.json           # Machine-readable artifact catalog (generated)
├── forge.config.yaml      # Forge configuration (backends, workspace)
└── package.json
```

## Souk Compass

Souk Compass is a standalone MCP server that provides semantic search over the artifact catalog. It uses Solr for vector and keyword search, with support for hybrid queries, chunked indexing, and an embedding cache. See [ADR-031](docs/adr/0031-souk-compass-standalone-mcp-server-for-semantic-search.md) and [ADR-034](docs/adr/0034-solr-10-upgrade-with-scalar-quantization.md) for design details.

```bash
# Build the Souk Compass MCP server
bun run build:souk-compass

# Configure in your MCP client (see .mcp.json for example)
```

## Development

```bash
# Run tests
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

Full contributor workflow — PR checklist, quality bar, adapter internals — is in [CONTRIBUTING.md](CONTRIBUTING.md).

## Documentation

All documentation lives under [`docs/`](docs/) unless otherwise noted. Every subdocument is indexed below.

### Getting Started

Role-based walkthroughs. Start here if you're new.

- [Getting Started overview](docs/getting-started/README.md) — pick your path
- [Using Skill Forge in Your Project](docs/getting-started/using-in-your-project.md) — install artifacts into an existing project
- [Joining or Running a Guild](docs/getting-started/joining-a-guild.md) — team-mode manifest-driven sync
- [Developing Skill Forge](docs/getting-started/developing-skill-forge.md) — clone-to-PR contributor guide

### Architecture Decision Records

The [ADR index](docs/adr/README.md) lists all 34 records and links the [template](docs/adr/template.md) for new ones. Quick jumps to frequently-referenced decisions:

- [ADR-003 — Adapters as pure functions](docs/adr/0003-adapters-as-pure-functions.md)
- [ADR-005 — Bun runtime and tooling](docs/adr/0005-bun-runtime-and-tooling.md)
- [ADR-017 — Pluggable backend abstraction](docs/adr/0017-pluggable-backend-abstraction-for-artifact-publishing.md)
- [ADR-023 — Manifest-driven distribution with global cache](docs/adr/0023-manifest-driven-artifact-distribution-with-global-cache.md)
- [ADR-028 — Capability matrix in adapters](docs/adr/0028-capability-matrix-in-adapters.md)
- [ADR-030 — Authoring-level version embedding](docs/adr/0030-authoring-level-version-embedding-and-manifests.md)
- [ADR-031 — Souk Compass standalone MCP server](docs/adr/0031-souk-compass-standalone-mcp-server-for-semantic-search.md)
- [ADR-034 — Solr 10 upgrade with scalar quantization](docs/adr/0034-solr-10-upgrade-with-scalar-quantization.md)

### Reference Guides

- [Kiro Progressive Steering](docs/kiro-progressive-steering.md) — `harness-config.kiro.inclusion`, `fileMatchPattern`, `--max-always`, config keys, and audit comment
- [Kiro Progressive Steering Rubric](docs/kiro-progressive-steering-rubric.md) — metrics, thresholds, and CLI for the `forge eval --rubric progressive-steering` quality gate

### Project Files

- [CONTRIBUTING.md](CONTRIBUTING.md) — code-level contributor guide (module map, adapter internals, testing patterns)
- [CHANGELOG.md](CHANGELOG.md) — compiled release notes
- [SECURITY.md](SECURITY.md) — security policy and responsible disclosure
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — community standards
- [CITATION.cff](CITATION.cff) — academic citation metadata
- [LICENSE](LICENSE) — MIT

## License

MIT
