---
inclusion: always
---

# Tech Stack & Build System

The package is `@thinkingsage/kanon` (currently v0.8.0). The primary binary is `kanon`; `forge` is a deprecated alias kept for backward compatibility.

## Runtime & Tooling

- **Runtime**: Bun (≥ 1.0)
- **Language**: TypeScript (ESNext, strict mode, bundler module resolution)
- **Package manager**: Bun (`bun install`, `bun.lock`)
- **Test runner**: Bun test (`bun test`)
- **Linter/Formatter**: Biome (`biome check`, `biome format`)
- **Templating**: Nunjucks (`.njk` templates)
- **Validation**: Zod v4 schemas
- **CLI framework**: Commander
- **Interactive prompts**: @clack/prompts
- **Terminal styling**: chalk
- **Frontmatter parsing**: gray-matter
- **YAML**: js-yaml
- **Token counting**: tiktoken
- **Property-based testing**: fast-check (devDependency)
- **Eval framework**: promptfoo

## Common Commands

All commands run from the `kanon/` directory:

```bash
# Install dependencies
bun install

# Run CLI in dev mode (alias for `bun run src/cli.ts`)
bun run dev <command>

# Build all artifacts for all harnesses
bun run dev build

# Build for a single harness
bun run dev build --harness kiro

# Validate artifacts
bun run dev validate

# Run security validation
bun run dev validate --security

# Browse / export the catalog
bun run dev catalog generate
bun run dev catalog browse
bun run dev catalog export

# Scaffold a new artifact (or run the guided tutorial)
bun run dev new my-artifact --type skill
bun run dev tutorial

# Import from an external source, then report/backfill attribution
bun run dev import <path>
bun run dev attribute
bun run dev attribute backfill

# Rosetta Stone — bidirectional format translation
bun run dev rosetta formats
bun run dev rosetta detect <path>
bun run dev rosetta inspect <path> --from <id>
bun run dev rosetta translate <path> --from <id> --to <id>

# Preview the compiled AI experience for an artifact-harness pair
bun run dev temper <artifact>

# Coordinate multi-agent work on Kiro Specs
bun run dev spec list
bun run dev spec status [spec]

# Install / upgrade / publish
bun run dev install [artifact]
bun run dev upgrade
bun run dev publish

# Run the test suite (170+ files, 2400+ cases — all must pass)
bun test

# Type check (ignore Dirent<NonSharedBuffer> errors in test files — Bun type def issue)
bun x tsc --noEmit

# Lint
bun run lint        # check
bun run lint:fix    # auto-fix

# Format
bun run format

# Compile the MCP bridge
bun run build:bridge

# Changelog fragment
bun run changelog:new --type added --message "description"

# Compile / preview the changelog
bun run changelog:compile
bun run changelog:draft
```

## Module System

- ESM (`"type": "module"` in package.json)
- The MCP bridge (`bridge/mcp-server.cjs`) is built as CJS for Node.js compatibility

## Key Conventions

- Adapters are **pure functions** — no side effects, no I/O. They receive a parsed artifact and a Nunjucks environment, return `AdapterResult` with files and warnings.
- Schemas are defined centrally in `src/schemas.ts` using Zod; `SUPPORTED_HARNESSES` and `AssetTypeSchema` there are the source of truth for the harness and asset-type lists.
- Templates live in `templates/harness-adapters/<harness>/` as `.njk` files.
- Names use **kebab-case** everywhere: artifact names, collection names, directory names.
- Every substantive change requires a **changelog fragment** in `kanon/changes/`.
- **Testing and validation are performed with Bun** — `bun test` for the suite, `bun run dev validate` for artifacts, and `bun x tsc --noEmit` for type checks. One-off checks and ad-hoc validation scripts also use Bun (`bun run <script>.ts` or `bun -e`), not Python or other runtimes. This repo has no Python project (no `pyproject.toml`); do not introduce one for validation tasks.
