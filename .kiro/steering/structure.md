---
inclusion: always
---

# Project Structure

## Repository Layout

```
context-bazaar/                    # Root repo
├── skill-forge/                   # The forge CLI tool (main codebase)
│   ├── src/                       # CLI and core modules
│   │   ├── cli.ts                 # CLI entry point (Commander-based)
│   │   ├── schemas.ts             # All Zod schemas (central validation)
│   │   ├── parser.ts              # Frontmatter + body parser
│   │   ├── build.ts               # Build pipeline orchestration
│   │   ├── validate.ts            # Artifact validation logic
│   │   ├── catalog.ts             # Catalog generation
│   │   ├── format-registry.ts     # Per-harness format definitions
│   │   ├── template-engine.ts     # Nunjucks template setup
│   │   ├── file-writer.ts         # Output file writing
│   │   ├── import.ts              # Import from existing Kiro powers/skills
│   │   ├── install.ts             # Install artifacts from backends
│   │   ├── publish.ts             # Publish artifacts to backends
│   │   ├── new.ts                 # Scaffold new artifacts
│   │   ├── wizard.ts              # Interactive artifact creation wizard
│   │   ├── browse.ts              # Catalog browser
│   │   ├── eval.ts                # Eval runner (promptfoo)
│   │   ├── mcp-bridge.ts          # MCP server bridge entry point
│   │   ├── adapters/              # Per-harness compiler adapters (pure functions)
│   │   │   ├── types.ts           # HarnessAdapter type, OutputFile, AdapterResult
│   │   │   ├── index.ts           # Adapter registry (maps harness name → adapter fn)
│   │   │   ├── kiro.ts
│   │   │   ├── claude-code.ts
│   │   │   ├── copilot.ts
│   │   │   ├── cursor.ts
│   │   │   ├── windsurf.ts
│   │   │   ├── cline.ts
│   │   │   └── qdeveloper.ts
│   │   ├── backends/              # Pluggable install/publish backends
│   │   │   ├── types.ts           # Backend interface
│   │   │   ├── github.ts          # GitHub Releases backend (uses gh CLI)
│   │   │   ├── http.ts            # HTTP backend
│   │   │   ├── s3.ts              # S3 backend
│   │   │   └── local.ts           # Local filesystem backend
│   │   ├── guild/                 # Manifest-driven distribution & sync
│   │   ├── help/                  # CLI help rendering
│   │   └── __tests__/             # All tests (unit, integration, property-based)
│   ├── knowledge/                 # Canonical knowledge artifacts
│   │   └── <artifact-name>/       # Each artifact is a directory
│   │       ├── knowledge.md       # YAML frontmatter + Markdown body
│   │       ├── hooks.yaml         # Optional canonical hooks
│   │       ├── mcp-servers.yaml   # Optional MCP server definitions
│   │       └── workflows/         # Optional phase files for workflow type
│   ├── collections/               # Collection manifests (YAML, metadata only)
│   ├── templates/
│   │   ├── harness-adapters/      # Per-harness Nunjucks output templates
│   │   ├── knowledge/             # Scaffold templates for `forge new`
│   │   └── eval-contexts/         # Harness context simulation for evals
│   ├── bridge/                    # Compiled MCP server (CJS)
│   ├── dist/                      # Compiled harness output (generated, gitignored per-harness)
│   ├── catalog.json               # Generated artifact index
│   ├── docs/adr/                  # Architecture Decision Records
│   ├── changes/                   # Towncrier-style changelog fragments
│   └── evals/                     # Cross-artifact eval configs
├── .claude-plugin/                # Claude Code plugin manifests
├── .kiro/                         # Kiro workspace config
│   ├── steering/                  # Steering files (this directory)
│   └── specs/                     # Feature specs
└── .mcp.json                      # MCP server configuration
```

## Key Patterns

- **One adapter per harness**: Each file in `src/adapters/` handles a single harness. Registered in `adapters/index.ts`.
- **One backend per protocol**: Each file in `src/backends/` handles a single install/publish backend type.
- **Tests colocated**: All tests live in `src/__tests__/`. Property-based tests use `.property.test.ts` suffix.
- **Generated output**: `dist/` and `catalog.json` are build artifacts — never edit manually.
- **ADRs for decisions**: Architectural choices are documented in `docs/adr/` with sequential numbering.
