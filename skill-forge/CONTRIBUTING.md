# Contributing to Skill Forge

Code-level guide for working on the forge CLI tool itself. For adding knowledge artifacts, collections, and the contributor workflow (PR checklist, changelog fragments, quality bar), see the [repository-level CONTRIBUTING guide](../CONTRIBUTING.md).

## Setup

```bash
bun install
bun run dev --version   # verify
bun test                # all tests must pass
```

Requires Bun ≥ 1.0. Node.js ≥ 20 is needed only for the MCP bridge (`bridge/mcp-server.cjs`).

## Module Map

```
src/
├── cli.ts                 # Commander entry point — all commands registered here
├── schemas.ts             # Every Zod schema lives here (frontmatter, catalog, workspace, etc.)
├── parser.ts              # Frontmatter + body parser (gray-matter → Zod validation)
├── build.ts               # Build orchestrator (single-dir and workspace-aware paths)
├── validate.ts            # Artifact + security + capability-matrix validation
├── catalog.ts             # Catalog generation (scans knowledge/ and packages/)
├── browse.ts              # HTTP server, route handlers, static export
├── browse-ui.ts           # Inline SPA (~2400 lines of HTML/CSS/JS as a template string)
├── install.ts             # Install from dist or remote backends (workspace-aware)
├── publish.ts             # Publish to GitHub, S3, or HTTP backends
├── import.ts              # Import from Kiro powers/skills
├── versioning.ts          # Version embedding, manifests, semver comparison
├── workspace.ts           # Workspace config loader (extends forge.config.yaml)
├── format-registry.ts     # Per-harness output format definitions
├── compatibility.ts       # Asset-type × harness compatibility matrix
├── template-engine.ts     # Nunjucks environment factory
├── file-writer.ts         # Output file writing utilities
├── config.ts              # forge.config.yaml loader
├── new.ts                 # Scaffold new artifacts
├── wizard.ts              # Interactive artifact creation (clack prompts)
├── tutorial.ts            # Guided first-time walkthrough
├── eval.ts                # Eval runner (promptfoo integration)
├── mcp-bridge.ts          # MCP server bridge (compiled to CJS)
├── admin.ts               # CRUD operations for browse server mutations
├── collection-admin.ts    # Collection CRUD
├── collection-builder.ts  # Collection bundle builder
├── collections.ts         # Collection loading and validation
├── manifest-admin.ts      # Guild manifest CRUD
├── asset-conventions.ts   # Per-type naming and structure conventions
├── adapters/              # Per-harness compiler adapters
│   ├── types.ts           #   HarnessAdapter, AdapterResult, AdapterContext
│   ├── index.ts           #   Registry: harness name → adapter function
│   ├── capabilities.ts    #   Capability matrix + query functions
│   ├── degradation.ts     #   Degradation engine (inline/comment/omit)
│   └── <harness>.ts       #   One file per harness (7 total)
├── backends/              # Pluggable install/publish backends
│   ├── types.ts           #   ArtifactBackend interface, config types
│   ├── index.ts           #   Backend resolver
│   └── <protocol>.ts      #   github.ts, s3.ts, http.ts, local.ts
├── guild/                 # Manifest-driven team distribution
├── importers/             # Multi-harness import parsers
├── help/                  # CLI help rendering (pure functions)
└── __tests__/             # All tests
```

## Key Conventions

### Schemas are centralized

All Zod schemas live in `src/schemas.ts`. Don't define validation schemas in feature modules — import from schemas. Types are inferred with `z.infer<>`.

### Adapters are pure functions

An adapter receives a parsed `KnowledgeArtifact`, a Nunjucks `Environment`, and an optional `AdapterContext` (capabilities + strict mode). It returns `AdapterResult` with output files and warnings. No I/O, no side effects, no filesystem access.

```typescript
// src/adapters/types.ts
export type HarnessAdapter = (
  artifact: KnowledgeArtifact,
  templateEnv: nunjucks.Environment,
  context?: AdapterContext,
) => AdapterResult;
```

### Templates drive output

Adapters don't build output strings by hand. They call `renderTemplate()` with a Nunjucks `.njk` template from `templates/harness-adapters/<harness>/`. Templates inherit from `_base/base.md.njk` where appropriate.

### Backends implement a common interface

Every install/publish backend implements `ArtifactBackend` from `src/backends/types.ts`: `fetchCatalog()`, `fetchArtifact()`, `listVersions()`. Config shapes are discriminated unions keyed by `type`.

### Names are kebab-case everywhere

Artifact names, collection names, directory names, harness names — all kebab-case. The `name` field in frontmatter must match the directory name.

## Adding a Harness Adapter

To add support for a new AI coding assistant:

1. **Register the harness name** in `src/schemas.ts`:
   ```typescript
   export const SUPPORTED_HARNESSES = [
     "kiro", "claude-code", ..., "my-harness",
   ] as const;
   ```

2. **Add a format entry** in `src/format-registry.ts`:
   ```typescript
   "my-harness": { formats: ["rule"], default: "rule" },
   ```

3. **Add a capability row** in `src/adapters/capabilities.ts`:
   ```typescript
   "my-harness": {
     hooks: { support: "none", degradation: "inline" },
     mcp: { support: "full" },
     // ... all 8 capabilities must be declared
   },
   ```

4. **Create the adapter** at `src/adapters/my-harness.ts`. Follow the pattern in `cursor.ts` (simplest adapter):
   - Check capabilities and apply degradation via `applyDegradation()`
   - Resolve format via `resolveFormat()`
   - Render templates via `renderTemplate()`
   - Return `{ files, warnings }`

5. **Create templates** in `templates/harness-adapters/my-harness/`. At minimum, a rule/steering template.

6. **Register in the adapter index** at `src/adapters/index.ts`:
   ```typescript
   import { myHarnessAdapter } from "./my-harness";
   export const adapterRegistry: Record<HarnessName, HarnessAdapter> = {
     ...,
     "my-harness": myHarnessAdapter,
   };
   ```

7. **Add install paths** in `src/install.ts` (`HARNESS_INSTALL_PATHS`).

8. **Add compatibility entries** in `src/compatibility.ts`.

9. **Write tests** — at minimum: adapter unit test, build integration test, install path test.

10. **Run `forge validate`** — the capability matrix sync check will catch any missing registrations.

## Adding a Backend

To add a new install/publish transport:

1. Define the config type in `src/backends/types.ts` and add it to the `BackendConfig` union.
2. Create `src/backends/my-backend.ts` implementing `ArtifactBackend`.
3. Register in `src/backends/index.ts`.
4. Add config examples to `forge.config.yaml` documentation.

## Testing

```bash
bun test                          # run all tests
bun test --filter "browse"        # run tests matching a pattern
bun test src/__tests__/build.test.ts  # run a single file
```

### Test organization

All tests live in `src/__tests__/`. Naming conventions:

| Pattern | Purpose |
|---|---|
| `*.test.ts` | Unit and integration tests |
| `*.property.test.ts` | Property-based tests (fast-check) |

There are currently 7 property-based test suites covering schema round-trips, build idempotency, catalog round-trips, admin CRUD, collection admin, manifest admin, and dependency validation.

### Writing tests

- Use Bun's built-in test runner (`import { describe, test, expect } from "bun:test"`)
- Use `spyOn` for mocking — no external mock libraries
- Temp directories for filesystem tests: `mkdtemp(join(tmpdir(), "prefix-"))`, clean up in `afterAll`
- Property tests use `fast-check`: `fc.assert(fc.property(fc.string(), (s) => { ... }))`

### Type checking

```bash
bun x tsc --noEmit
```

Ignore `Dirent<NonSharedBuffer>` errors in test files — that's a Bun type definition issue. All other errors must be resolved.

## Linting and Formatting

```bash
bun run lint        # check with Biome
bun run lint:fix    # auto-fix
bun run format      # format with Biome
```

Biome is configured in `biome.json`. It covers `src/`, `scripts/`, `evals/`, `collections/`, and config files. Templates (`.njk`) and knowledge artifacts (`.md`) are not linted.

## Build Artifacts

| Command | Output | When to run |
|---|---|---|
| `bun run dev build` | `dist/<harness>/<artifact>/` | After changing adapters, templates, or schemas |
| `bun run dev catalog generate` | `catalog.json` | After changing knowledge artifacts |
| `bun run build:bridge` | `bridge/mcp-server.cjs` | After changing `src/mcp-bridge.ts` |

`dist/` and `catalog.json` are generated — never edit them by hand.

## Changelog Fragments

Every substantive change needs a fragment:

```bash
bun run changelog:new --type added --message "Added support for X"
```

Valid types: `added` `changed` `deprecated` `removed` `fixed` `security`

Fragments live in `changes/` and are compiled into `CHANGELOG.md` at release time:

```bash
bun run changelog:compile         # compile and clear fragments
bun run changelog:draft           # preview without clearing
```

## Architecture Decision Records

Structural decisions are documented in `docs/adr/` (30 ADRs). Before making a change that introduces a new pattern, module, or integration approach, check whether an existing ADR covers it. If you're making a decision with real trade-offs:

```bash
cp docs/adr/template.md docs/adr/NNNN-short-title.md
```

Update the index table in `docs/adr/README.md`. Key ADRs to know:

| ADR | What it covers |
|---|---|
| [003](docs/adr/0003-adapters-as-pure-functions.md) | Why adapters have no side effects |
| [013](docs/adr/0013-centralized-format-registry.md) | Single source of truth for harness formats |
| [017](docs/adr/0017-pluggable-backend-abstraction-for-artifact-publishing.md) | Backend interface design |
| [025](docs/adr/0025-browse-ui-module-extraction.md) | Why browse-ui.ts is a separate module |
| [026](docs/adr/0026-workspace-config-extends-forge-config-yaml.md) | Workspace config in forge.config.yaml |
| [028](docs/adr/0028-capability-matrix-in-adapters.md) | Capability matrix co-located with adapters |
| [030](docs/adr/0030-authoring-level-version-embedding-and-manifests.md) | Version embedding and manifests |

## Common Pitfalls

- **`String.replace()` with dynamic content** — If the replacement string contains `$` characters (e.g. from user content), use a replacer function instead of a string to avoid `$'`/`` $` ``/`$&` expansion. See the `generateStaticHtmlPage` fix in `browse-ui.ts`.
- **Forgetting capability matrix entries** — Adding a harness to `SUPPORTED_HARNESSES` without adding a row to `CAPABILITY_MATRIX` will fail at module load time (Zod validation) and at `forge validate` (sync check).
- **Mutating shared artifacts in workspace builds** — The workspace build clones artifacts before applying project overrides. Don't mutate the original `loadedArtifacts` map entries.
- **Template autoescape is off** — Nunjucks is configured with `autoescape: false` because output is Markdown/JSON, not HTML. Be careful if generating HTML content in templates.
