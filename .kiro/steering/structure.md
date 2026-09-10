---
inclusion: always
---

# Project Structure

## Repository Layout

```
context-bazaar/                    # Root repo
├── kanon/                          # The kanon CLI tool (main codebase)
│   ├── src/                       # CLI and core modules
│   │   ├── cli.ts                 # CLI entry point (Commander-based)
│   │   ├── cli-deprecated.ts      # Deprecated `forge` binary entry point
│   │   ├── schemas.ts             # All Zod schemas (central data model / validation)
│   │   ├── parser.ts              # Frontmatter + body parser
│   │   ├── resolve-body.ts        # Body / body-override resolution
│   │   ├── build.ts               # Build pipeline orchestration
│   │   ├── validate.ts            # Artifact validation logic
│   │   ├── catalog.ts             # Catalog generation
│   │   ├── collections.ts         # Collection membership derivation
│   │   ├── collection-builder.ts  # Collection bundle builder
│   │   ├── collection-admin.ts    # Collection admin operations
│   │   ├── compatibility.ts       # Per-asset-type harness support matrix
│   │   ├── format-registry.ts     # Per-harness format definitions
│   │   ├── template-engine.ts     # Nunjucks template setup
│   │   ├── template-bundle-loader.ts
│   │   ├── file-writer.ts         # Output file writing
│   │   ├── config.ts              # Config loading (kanon.config.yaml, ~/.forge)
│   │   ├── workspace.ts           # Multi-project workspace config
│   │   ├── import.ts              # Import facade (Kiro powers/skills, harness-native)
│   │   ├── install.ts             # Install artifacts from backends
│   │   ├── publish.ts             # Publish artifacts to backends
│   │   ├── versioning.ts          # Version manifests / upgrade logic
│   │   ├── new.ts                 # Scaffold new artifacts
│   │   ├── wizard.ts              # Interactive artifact creation wizard
│   │   ├── tutorial.ts            # Guided first-run walkthrough
│   │   ├── browse.ts / browse-ui.ts  # Catalog browser + UI
│   │   ├── temper.ts              # Preview compiled AI experience per harness
│   │   ├── eval.ts                # Eval runner (promptfoo)
│   │   ├── mcp-bridge.ts          # MCP server bridge entry point
│   │   ├── binary-assets.ts       # Binary workflow asset handling
│   │   ├── base-cache.ts          # Shared cache primitive
│   │   ├── admin.ts / manifest-admin.ts  # Admin + manifest admin commands
│   │   ├── spec-coordination.ts   # `kanon spec` multi-agent Kiro Spec coordination
│   │   ├── attribution*.ts        # Upstream attribution (report, backfill, core)
│   │   ├── provenance-backfill*.ts # Provenance backfill (+ CLI)
│   │   ├── reconcile-*.ts         # Three-way reconciliation orchestrator + renderer
│   │   ├── translation-*.ts       # Translation orchestration, policy, plan applier
│   │   ├── rosetta-*.ts           # Rosetta CLI entry points + docs generator
│   │   ├── adapters/              # Per-harness compiler adapters (pure functions)
│   │   │   ├── types.ts           # HarnessAdapter type, OutputFile, AdapterResult
│   │   │   ├── index.ts           # Adapter registry (maps harness name → adapter fn)
│   │   │   ├── capabilities.ts    # Adapter capability declarations
│   │   │   ├── degradation.ts     # Capability degradation strategies
│   │   │   ├── kiro.ts / kiro-frontmatter.ts / kiro-inclusion.ts
│   │   │   ├── claude-code.ts / codex.ts / copilot.ts / cursor.ts
│   │   │   └── windsurf.ts / cline.ts / qdeveloper.ts
│   │   ├── importers/             # Per-harness inbound importers (incl. gemini-cli)
│   │   ├── backends/              # Pluggable install/publish backends (github/http/s3/local)
│   │   ├── rosetta/               # Rosetta Stone bidirectional translation engine
│   │   │   ├── engine.ts / engine-bootstrap.ts / plan.ts / resolution.ts
│   │   │   ├── registry.ts / contracts.ts / detector.ts / compatibility.ts
│   │   │   ├── canonical.ts / reconcile.ts / diagnostics.ts / redaction.ts
│   │   │   ├── source-accounting.ts / provenance-digest.ts / request-guard.ts
│   │   │   └── builtins/          # Built-in format contracts
│   │   ├── outcomes/              # Outcomes registry (registry/normalize/collision)
│   │   ├── mutation/              # Mutation operators + runner (delta/history)
│   │   ├── hooks/                 # Hook expression + pipeline evaluation
│   │   ├── guild/                 # Manifest-driven distribution & sync (has its own cli.ts)
│   │   ├── eval/rubrics/          # Eval scoring rubrics
│   │   ├── help/                  # CLI help + man-page rendering
│   │   └── __tests__/             # Nearly all tests live here (unit, integration, property-based)
│   ├── tests/                     # A small number of top-level tests (e.g. tutorial-expansion)
│   ├── knowledge/                 # Canonical knowledge artifacts
│   │   └── <artifact-name>/       # Each artifact is a directory
│   │       ├── knowledge.md       # YAML frontmatter + Markdown body
│   │       ├── hooks.yaml         # Optional canonical hooks
│   │       ├── mcp-servers.yaml   # Optional MCP server definitions
│   │       └── workflows/         # Optional phase files for workflow type
│   ├── skills/ powers/            # Additional source artifact directories
│   ├── collections/               # Collection manifests (YAML, metadata only)
│   ├── mcp-servers/               # Bundled MCP server projects (e.g. souk-compass)
│   ├── upstream/                  # Vendored upstream sources for imported artifacts
│   ├── templates/
│   │   ├── harness-adapters/      # Per-harness Nunjucks output templates
│   │   ├── knowledge/             # Scaffold templates for `kanon new`
│   │   └── eval-contexts/         # Harness context simulation for evals
│   ├── bridge/                    # Compiled MCP server (CJS)
│   ├── scripts/                   # Release, changelog, and plugin-skill helpers
│   ├── dist/                      # Compiled harness output (generated, gitignored)
│   ├── catalog.json               # Generated artifact index (gitignored, built in CI)
│   ├── docs/adr/                  # Architecture Decision Records
│   ├── changes/                   # Towncrier-style changelog fragments
│   └── evals/                     # Cross-artifact eval configs
├── .claude-plugin/                # Claude Code plugin manifests
├── .codex-plugin/                 # Codex plugin manifest
├── .kiro/                         # Kiro workspace config
│   ├── steering/                  # Steering files (this directory)
│   └── specs/                     # Feature specs
└── .mcp.json                      # MCP server configuration
```

## Key Patterns

- **One adapter per harness**: Each file in `src/adapters/` handles a single harness (compile / outbound). Registered in `adapters/index.ts`.
- **One importer per harness**: Each file in `src/importers/` handles a single harness (import / inbound). Registered in `importers/index.ts`.
- **One backend per protocol**: Each file in `src/backends/` handles a single install/publish backend type.
- **Rosetta is contract-driven**: Format behavior lives in versioned contracts under `rosetta/builtins/`; the engine dispatches by direction and phase rather than hardcoding per-harness logic.
- **Command groups can self-register**: Sub-command groups like `guild` and `rosetta` expose a `register*Commands(program)` function that `cli.ts` calls, keeping the entry point thin.
- **Central data model**: `src/schemas.ts` is the single source of truth for all shapes — `SUPPORTED_HARNESSES`, `AssetTypeSchema`, `Frontmatter`, `KnowledgeArtifact`, `CatalogEntry`, plus governance, outcome, and Rosetta schemas.
- **Tests mostly colocated**: The bulk of tests live in `src/__tests__/` (subsystems like `guild/` have their own `__tests__/`). A few live in the top-level `tests/`. Property-based tests use the `.property.test.ts` suffix.
- **Generated output**: `dist/` and `catalog.json` are build artifacts — gitignored, built in CI, attached to releases.
- **ADRs for decisions**: Architectural choices are documented in `docs/adr/` with sequential numbering.
