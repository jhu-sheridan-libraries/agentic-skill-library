# AGENTS.md

This file provides guidance to coding agents (Codex, and any other AGENTS.md-aware tool) when working with code in this repository.

## Repository layout

```
context-bazaar/          ← repo root (git remote is still named agentic-skill-*)
├── kanon/                ← the kanon CLI tool (TypeScript, Bun)
│   ├── src/              ← all source code (see Architecture below for subsystems)
│   ├── knowledge/        ← canonical knowledge artifacts
│   ├── skills/ powers/   ← additional committed source artifacts
│   ├── collections/      ← collection manifests (*.yaml)
│   ├── mcp-servers/      ← bundled MCP server projects (e.g. souk-compass)
│   ├── upstream/         ← vendored upstream sources for imported artifacts
│   ├── dist/             ← compiled harness output (git-ignored in practice)
│   ├── templates/        ← Nunjucks templates for harness adapters
│   ├── bridge/           ← compiled MCP server (bridge/mcp-server.cjs)
│   ├── docs/adr/         ← Architecture Decision Records
│   ├── changes/          ← towncrier-style changelog fragments
│   ├── scripts/          ← release and changelog helpers
│   └── evals/            ← cross-artifact eval configs
├── .claude-plugin/       ← Claude Code plugin manifests
├── .codex-plugin/        ← Codex plugin manifest
├── .mcp.json             ← MCP server config (points to bridge/mcp-server.cjs)
├── README.md
├── CONTRIBUTING.md
└── CODE_OF_CONDUCT.md
```

All development commands run from `kanon/`.

## Commands

```bash
cd kanon

bun run dev <command>          # run kanon CLI without building
bun test                       # run all tests
bun test --test-name-pattern="<regex>"  # run a single test or suite
bun run lint                   # biome check
bun run lint:fix               # biome check --write
bun run format                 # biome format --write
bun run build                  # compile kanon binary
bun run build:bridge           # rebuild MCP bridge (bridge/mcp-server.cjs)
bun run build:skills           # regenerate committed plugin skills (skills/)
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

Adapters are the **outbound** (canonical → harness) half. The **inbound** half lives in `src/importers/<harness>.ts` — one importer per harness (including `gemini-cli`), registered in `importers/index.ts` and driven by `kanon import`.

### Rosetta Stone (bidirectional translation)

`src/rosetta/` is a contract-driven translation engine, exposed via `kanon rosetta` (registered from `rosetta-cli.ts`). It detects a document's source format, inspects a translation as a dry run, and translates in both directions (inbound source → canonical, outbound canonical → target). Each format is a versioned **format contract** under `rosetta/builtins/` with a capability matrix, detection rules, direction, and security policy. The engine dispatches by direction and runs explicit phases (request → registry → detection → resolution → plan → apply), emitting diagnostics rather than hardcoding per-harness logic.

### Provenance & attribution

Imported artifacts carry recorded origin (provenance) and license lineage (attribution). `kanon import` records where an artifact came from; `kanon attribute` emits a NOTICES report grouped by license and `kanon attribute backfill` adds attribution blocks without touching `author`. Three-way reconciliation (`reconcile-*.ts`, `translation-*.ts`) keeps curation-owned and upstream-owned frontmatter fields in sync.

### Outcomes registry

`src/outcomes/` tracks declared, testable results an artifact should produce (`specification | operation | invariant`) with globally unique `out-`-prefixed IDs, plus normalization and collision detection.

### Spec coordination

`kanon spec` (`spec-coordination.ts`) coordinates multi-agent work on Kiro Specs under `.kiro/specs/` via a `COORDINATION.md` + `tasks.md` protocol (list / status / next / claim / release / done / reconcile / handoff).

### The type system

`src/schemas.ts` is the single source of truth for every data shape. All schemas use Zod and export both the schema and the inferred TypeScript type. The key types:

- `Frontmatter` — artifact metadata (name, type, harnesses, maturity, trust, collections, …)
- `KnowledgeArtifact` — parsed artifact including body, hooks, mcpServers, workflows
- `CatalogEntry` — the shape written to `catalog.json`
- `AssetTypeSchema` — `skill | power | rule | workflow | agent | prompt | template | reference-pack` (`power` is a deprecated alias for `skill`; see ADR-0051)
- `HarnessNameSchema` (from `SUPPORTED_HARNESSES`) — `kiro | claude-code | codex | copilot | cursor | windsurf | cline | qdeveloper | gemini-cli`

`FrontmatterSchema` uses `.passthrough()` so unknown fields survive round-trips. New frontmatter fields must be added to both `FrontmatterSchema` and `KNOWN_FRONTMATTER_FIELDS` in `parser.ts`.

### The catalog

`kanon catalog generate` runs `generateCatalog(["knowledge", "packages"])` → writes `catalog.json`. The catalog is the primary artifact index; the browse UI and MCP bridge both read from it. It must be regenerated after any `knowledge/` change.

### Harness compatibility

`src/compatibility.ts` declares which asset types each harness supports fully, partially, or not at all. `kanon build --strict` treats partial/none as errors; without the flag they produce warnings. The kiro-only artifacts (powers) should declare `harnesses: [kiro]` — building them for all harnesses generates expected partial-support warnings.

### Collections

Collection manifests in `collections/*.yaml` are **metadata only** — no member list. Membership is declared by artifacts in their own frontmatter: `collections: [neon-caravan]`. `buildCollectionMembership()` in `collections.ts` derives the map at runtime. This is by design (ADR-0016) — deleting an artifact automatically removes it from collections.

### The MCP bridge

`src/mcp-bridge.ts` is compiled to `bridge/mcp-server.cjs` (bundled, self-contained, ~0.5 MB). It exposes three MCP tools: `catalog_list`, `artifact_content`, `collection_list`. Rebuild with `bun run build:bridge` after any change to the bridge source. The compiled file is committed so plugin users don't need a build step.

### Plugin skills

`.claude-plugin/plugin.json`'s `skills` field points at `kanon/skills/`, a committed directory of real `SKILL.md` files — distinct from `dist/claude-code/`, which is gitignored build output cleared on every `kanon build` and therefore never present in a plugin install. `scripts/generate-plugin-skills.ts` (`bun run build:skills`) selects artifacts with `type: skill` and `claude-code` in `harnesses`, and renders them via `templates/harness-adapters/claude-code/skill.md.njk`. Regenerate and commit `kanon/skills/` after adding or editing a qualifying artifact. See ADR-0046.

### Test helpers

`src/__tests__/test-helpers.ts` exports `makeFrontmatter()`, `makeArtifact()`, and `makeCatalogEntry()` with all required fields defaulted. **Always use these** when constructing test fixtures — `Frontmatter` has ~20 required fields and manually constructing them causes type errors.

## Changelog and ADR discipline

The Kiro hooks in `.kiro/hooks/` enforce two conventions:

1. **Changelog fragments**: every substantive change needs a fragment in `changes/` (`bun run changelog:new`). Fragments are compiled into `CHANGELOG.md` at release.

2. **ADRs**: changes to `.ts`, `.json`, `.yaml`, `.njk`, schema, config, module, or adapter files should be assessed for architectural significance. If a real decision with trade-offs was made, document it in `kanon/docs/adr/` using the next sequential number (the highest is currently `0070-*.md`, so the next is `0071`). The full index lives at `docs/adr/README.md` — check it for the current highest number before creating a new ADR.

## Configuration boundaries

`kanon.config.yaml` (per-repo) — backend names, S3 buckets, governance allowlists. **May be committed.** No credentials.

`~/.forge/config.yaml` (user-global) — credentials, tokens, personal overrides. **Must never be committed.** Gitignored at the repo root level.

Use `${ENV_VAR}` syntax in `kanon.config.yaml` to reference credentials at runtime without storing them. `kanon validate --security` warns on credential-like values hardcoded in `mcp-servers.yaml`.

## kanon publish flow

`kanon publish [--dry-run]` runs the full release pipeline: validate → rebuild bridge → build all harnesses → generate catalog → create release manifest → package per-harness tarballs → `gh release create`. The `--dry-run` flag stops before any upload.
