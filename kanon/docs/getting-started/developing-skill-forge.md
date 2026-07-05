# Developing Kanon

This guide walks a new contributor from a fresh clone to a working change in under 30 minutes. For the detailed reference — module map, adapter internals, testing patterns, capability matrix mechanics — see [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.0 — required runtime and package manager
- Node.js ≥ 20 — only needed if you're working on `bridge/mcp-server.cjs`
- A GitHub account with access to the repository
- Basic familiarity with TypeScript, Zod, and Nunjucks

## 1. Clone and Set Up

```bash
git clone https://github.com/jhu-sheridan-libraries/agentic-skill-forge.git
cd agentic-skill-forge/kanon
bun install
bun run dev --version   # sanity check — should print the current version
bun test                # all tests should pass
```

If `bun test` fails on a clean checkout, stop and open an issue — your environment isn't ready yet.

## 2. Take the Tour

Spend ten minutes running each of these so you know what they do before you change anything:

```bash
# Scaffold a throwaway artifact to see the directory shape
bun run dev new tour-example
ls knowledge/tour-example/

# Compile every artifact to every harness
bun run dev build

# See what the build produced
ls dist/kiro/adr/
ls dist/claude-code/adr/
ls dist/cursor/adr/

# Browse the catalog
bun run dev catalog browse
# (open http://localhost:3000 in a browser, then Ctrl+C when done)

# Validate — runs schema + capability matrix + security checks
bun run dev validate
bun run dev validate --security

# Clean up your throwaway
rm -rf knowledge/tour-example/ dist/
```

## 3. Understand the Pipeline

```
knowledge/<name>/          src/parser.ts            src/adapters/<harness>.ts
├── knowledge.md    ───►   parse + validate   ───►  pure function
├── hooks.yaml             with Zod schemas         uses Nunjucks template
├── mcp-servers.yaml       from src/schemas.ts      from templates/harness-adapters/
└── workflows/*.md                                           │
                                                             ▼
                                                   dist/<harness>/<artifact>/*
                                                             │
                                                             ▼
                                                   kanon install
                                                             │
                                                             ▼
                                                   .kiro/, CLAUDE.md, .cursor/, …
```

Three non-negotiable rules that keep the architecture clean (see [ADR-003](../adr/0003-adapters-as-pure-functions.md)):

1. **All schemas live in `src/schemas.ts`.** Never define a Zod schema in a feature module.
2. **Adapters are pure functions.** No I/O, no filesystem access. Given the same input they return the same output.
3. **Templates produce output, code doesn't.** Adapters call `renderTemplate()`; they never hand-build strings.

## 4. Make Your First Change

A realistic first contribution: you notice an adapter's frontmatter is missing a field. Here's the full loop.

### a. Find the failing spec or create one

If a spec already describes the change (as with `kiro-progressive-steering`), read its `design.md` and `tasks.md`. Otherwise, write one first — every non-trivial change goes through a spec.

### b. Write or update tests

Tests live in `src/__tests__/`. For adapter changes:

```typescript
// src/__tests__/adapters/kiro.test.ts
import { describe, test, expect } from "bun:test";
import { kiroAdapter } from "../../adapters/kiro";

test("kiro adapter emits description in steering frontmatter", () => {
  const artifact = makeArtifact({ description: "Test description" });
  const result = kiroAdapter(artifact, templateEnv);
  const steering = result.files.find(f => f.relativePath.includes("steering"));
  expect(steering.content).toContain('description: "Test description"');
});
```

Run the test — it should fail:

```bash
bun test src/__tests__/adapters/kiro.test.ts
```

### c. Make the change

Edit the adapter, the template, or the schema. For a template change:

```bash
$EDITOR templates/harness-adapters/kiro/steering.md.njk
```

Re-run tests until they pass:

```bash
bun test src/__tests__/adapters/kiro.test.ts
```

### d. Verify end-to-end

```bash
bun run dev build --harness kiro
head dist/kiro/<some-artifact>/steering/<some-file>.md
```

Confirm the emitted frontmatter looks right.

### e. Run the full suite

```bash
bun test                    # all tests
bun run lint                # Biome
bun x tsc --noEmit          # TypeScript check
bun run dev validate        # artifact validation
bun run dev validate --security  # security scans
```

All four must pass before opening a PR.

### f. Add a changelog fragment

```bash
bun run changelog:new --type fixed --message "Kiro adapter now emits description field for progressive steering"
```

Valid types: `added` `changed` `deprecated` `removed` `fixed` `security`.

### g. Commit and open a PR

```bash
git checkout -b fix/kiro-description-field
git add -p
git commit -m "fix(kiro): emit description field in steering frontmatter"
git push -u origin fix/kiro-description-field
gh pr create --fill
```

PR titles follow conventional commits. Titles under 70 characters. PR descriptions include: what changed, what tested, any blocked features.

## 5. Where to Go Deeper

| If you're working on... | Read |
|---|---|
| A new harness adapter | [CONTRIBUTING.md — Adding a Harness Adapter](../../CONTRIBUTING.md#adding-a-harness-adapter), [ADR-003](../adr/0003-adapters-as-pure-functions.md), [ADR-028](../adr/0028-capability-matrix-in-adapters.md) |
| A new install or publish backend | [CONTRIBUTING.md — Adding a Backend](../../CONTRIBUTING.md#adding-a-backend), [ADR-017](../adr/0017-pluggable-backend-abstraction-for-artifact-publishing.md) |
| The browse UI | [ADR-024](../adr/0024-browse-server-admin-crud-with-mutable-state.md), [ADR-025](../adr/0025-browse-ui-module-extraction.md) |
| Guild sync and manifests | [ADR-023](../adr/0023-manifest-driven-artifact-distribution-with-global-cache.md), [ADR-030](../adr/0030-authoring-level-version-embedding-and-manifests.md) |
| Semantic search | [ADR-031](../adr/0031-souk-compass-standalone-mcp-server-for-semantic-search.md), [ADR-034](../adr/0034-solr-10-upgrade-with-scalar-quantization.md) |
| An importer for an existing tool's format | [ADR-019](../adr/0019-forge-import-auto-detecting-kiro-format-importer.md), [ADR-029](../adr/0029-importers-module-for-multi-harness-parsers.md) |
| Progressive Kiro steering | `.kiro/specs/kiro-progressive-steering/` |

## 6. Getting Unstuck

| Symptom | Likely cause |
|---|---|
| `Capability matrix validation failed at module load` | Added a harness to `SUPPORTED_HARNESSES` without a matching row in `CAPABILITY_MATRIX`. See [CONTRIBUTING.md — Adding a Harness Adapter](../../CONTRIBUTING.md#adding-a-harness-adapter). |
| Tests pass locally but fail in CI | Usually a Bun version mismatch or a dependency caching issue. Check your `bun --version` matches `"engines"."bun"` in `package.json`. |
| `kanon validate` complains about an artifact you didn't touch | Another author's artifact drifted. Open an issue and check `git blame` — don't silently fix someone else's artifact in your PR. |
| Template change isn't reflected in `dist/` | Cached build. Delete `dist/` and re-run `bun run dev build`. |
| `kanon install` writes wrong paths | Check `HARNESS_INSTALL_PATHS` in `src/install.ts`. |

## Principles

Whenever you're unsure what "good" looks like:

- **Schemas first.** If you're adding a field, update the Zod schema before writing code that reads it.
- **Pure functions where possible.** Side effects belong at the edges (`build.ts`, `install.ts`, `publish.ts`).
- **No silent failures.** Surface problems as warnings or errors; never swallow them.
- **Tests before code.** Property-based tests where the shape of inputs isn't obvious.
- **ADRs for real decisions.** If two reasonable engineers could disagree, write it down.

Welcome aboard.
