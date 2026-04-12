# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

```
agentic-skill-forge/
├── skill-forge/          ← the forge CLI tool (TypeScript, Bun)
│   ├── src/              ← all source code
│   ├── knowledge/        ← canonical knowledge artifacts
│   ├── collections/      ← collection manifests (*.yaml)
│   ├── dist/             ← compiled harness output (git-ignored in practice)
│   ├── templates/        ← Nunjucks templates for harness adapters
│   ├── bridge/           ← compiled MCP server (bridge/mcp-server.cjs)
│   ├── changes/          ← towncrier-style changelog fragments
│   ├── scripts/          ← release and changelog helpers
│   └── evals/            ← cross-artifact eval configs
├── .claude-plugin/       ← Claude Code plugin manifests
├── .mcp.json             ← MCP server config (points to bridge/mcp-server.cjs)
├── README.md
├── CONTRIBUTING.md
└── CODE_OF_CONDUCT.md
```

All development commands run from `skill-forge/`.

## Commands

```bash
cd skill-forge

bun run dev <command>          # run forge CLI without building
bun test                       # run all tests
bun test --test-name-pattern="<regex>"  # run a single test or suite
bun run lint                   # biome check
bun run lint:fix               # biome check --write
bun run format                 # biome format --write
bun run build                  # compile forge binary
bun run build:bridge           # rebuild MCP bridge (bridge/mcp-server.cjs)
bun run changelog:new --type added --message "..."  # add a changelog fragment
bun run changelog:draft        # preview next CHANGELOG.md entry
bun run release                # interactive version bump + tag
```

`bun run dev` is an alias for `bun run src/cli.ts`. Use it instead of a compiled binary during development.

## Architecture

### The compile pipeline

The core loop is: **source** (`knowledge/`) → **parse** (`parser.ts`) → **adapt** (`adapters/`) → **write** (`dist/`).

Each artifact in `knowledge/<name>/` contains `knowledge.md` (frontmatter + body), optional `hooks.yaml`, `mcp-servers.yaml`, and `workflows/*.md`. `build.ts` scans all source dirs, loads each artifact via `loadKnowledgeArtifact()`, merges shared MCP servers, then calls the appropriate adapter for each target harness.

Adapters live in `src/adapters/<harness>.ts` and are pure functions: `(artifact: KnowledgeArtifact, templateEnv: Environment) => AdapterResult`. Each adapter uses Nunjucks templates from `templates/harness-adapters/<harness>/` to produce files that land in `dist/<harness>/<artifact-name>/`.

The scan logic in `catalog.ts` and `build.ts` handles two directory layouts:
- **Flat**: `knowledge/<artifact>/knowledge.md`
- **Namespaced**: `packages/@org/<artifact>/knowledge.md`

### The type system

`src/schemas.ts` is the single source of truth for every data shape. All schemas use Zod and export both the schema and the inferred TypeScript type. The key types:

- `Frontmatter` — artifact metadata (name, type, harnesses, maturity, trust, collections, …)
- `KnowledgeArtifact` — parsed artifact including body, hooks, mcpServers, workflows
- `CatalogEntry` — the shape written to `catalog.json`
- `AssetTypeSchema` — `skill | power | rule | workflow | agent | prompt | template | reference-pack`
- `HarnessNameSchema` — `kiro | claude-code | copilot | cursor | windsurf | cline | qdeveloper`

`FrontmatterSchema` uses `.passthrough()` so unknown fields survive round-trips. New frontmatter fields must be added to both `FrontmatterSchema` and `KNOWN_FRONTMATTER_FIELDS` in `parser.ts`.

### The catalog

`forge catalog generate` runs `generateCatalog(["knowledge", "packages"])` → writes `catalog.json`. The catalog is the primary artifact index; the browse UI and MCP bridge both read from it. It must be regenerated after any `knowledge/` change.

### Harness compatibility

`src/compatibility.ts` declares which asset types each harness supports fully, partially, or not at all. `forge build --strict` treats partial/none as errors; without the flag they produce warnings. The kiro-only artifacts (powers) should declare `harnesses: [kiro]` — building them for all harnesses generates expected partial-support warnings.

### Collections

Collection manifests in `collections/*.yaml` are **metadata only** — no member list. Membership is declared by artifacts in their own frontmatter: `collections: [neon-caravan]`. `buildCollectionMembership()` in `collections.ts` derives the map at runtime. This is by design (ADR-0016) — deleting an artifact automatically removes it from collections.

### The MCP bridge

`src/mcp-bridge.ts` is compiled to `bridge/mcp-server.cjs` (bundled, self-contained, ~0.5 MB). It exposes three MCP tools: `catalog_list`, `artifact_content`, `collection_list`. Rebuild with `bun run build:bridge` after any change to the bridge source. The compiled file is committed so plugin users don't need a build step.

### Test helpers

`src/__tests__/test-helpers.ts` exports `makeFrontmatter()`, `makeArtifact()`, and `makeCatalogEntry()` with all required fields defaulted. **Always use these** when constructing test fixtures — `Frontmatter` has ~20 required fields and manually constructing them causes type errors.

## Changelog and ADR discipline

The Kiro hooks in `.kiro/hooks/` enforce two conventions:

1. **Changelog fragments**: every substantive change needs a fragment in `changes/` (`bun run changelog:new`). Fragments are compiled into `CHANGELOG.md` at release.

2. **ADRs**: changes to `.ts`, `.json`, `.yaml`, `.njk`, schema, config, module, or adapter files should be assessed for architectural significance. If a real decision with trade-offs was made, document it in `skill-forge/docs/adr/` (next number after `0020-*.md`). ADR-0001 through ADR-0020 are in the index at `docs/adr/README.md`.

## forge publish flow

`forge publish [--dry-run]` runs the full release pipeline: validate → rebuild bridge → build all harnesses → generate catalog → create release manifest → package per-harness tarballs → `gh release create`. The `--dry-run` flag stops before any upload.
