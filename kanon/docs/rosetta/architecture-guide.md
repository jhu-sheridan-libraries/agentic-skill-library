# Architecture Guide

> Rosetta Stone functional core / imperative shell architecture.

## Overview

Rosetta Stone follows the **Functional Core / Imperative Shell** pattern. All schema
translation logic is pure: no filesystem, process, clock, random, Git, or network
access. Side effects live exclusively in the imperative shell layer that coordinates
I/O around the pure core.

## Layer Diagram (C4 Component Level)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Imperative Shell                              │
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ TranslationOrch- │  │ PlanApplier      │  │ CLI Commands     │  │
│  │ estrator         │  │ (staging, atomic │  │ (kanon rosetta)  │  │
│  │ (scan, read,     │  │  swap, modes)    │  │                  │  │
│  │  group, invoke)  │  │                  │  │                  │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘  │
│           │                      │                      │           │
├───────────┼──────────────────────┼──────────────────────┼───────────┤
│           ▼                      ▼                      ▼           │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                Pure Translation Boundary                     │    │
│  │                                                             │    │
│  │  ┌─────────┐ ┌──────────┐ ┌────────────┐ ┌─────────────┐  │    │
│  │  │ Request │ │ Registry │ │ Detector   │ │ Source      │  │    │
│  │  │ Guard   │ │ Snapshot │ │            │ │ Translators │  │    │
│  │  └────┬────┘ └────┬─────┘ └─────┬──────┘ └──────┬──────┘  │    │
│  │       │            │             │               │          │    │
│  │       ▼            ▼             ▼               ▼          │    │
│  │  ┌──────────────────────────────────────────────────────┐   │    │
│  │  │                 RosettaEngine                         │   │    │
│  │  │  (coordinates phases, derives status, redacts)       │   │    │
│  │  └──────────────────────────────────────────────────────┘   │    │
│  │       │            │             │               │          │    │
│  │       ▼            ▼             ▼               ▼          │    │
│  │  ┌─────────┐ ┌────────────┐ ┌──────────┐ ┌───────────┐    │    │
│  │  │ Compat- │ │ Target     │ │ Plan     │ │ Inspection│    │    │
│  │  │ ibility │ │ Translators│ │ Validator│ │ & Redact  │    │    │
│  │  └─────────┘ └────────────┘ └──────────┘ └───────────┘    │    │
│  │                                                             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Dependency Direction Rules

1. **Shell depends on Core** — The imperative shell imports from `src/rosetta/`.
   The pure core never imports from the shell.

2. **Core depends only on schemas** — Modules under `src/rosetta/` import from
   `src/schemas.ts` and from sibling modules within `src/rosetta/`. They never
   import `src/import.ts`, `src/build.ts`, `src/adapters/`, or any filesystem utility.

3. **Schemas are the single source of truth** — All data shapes live in
   `src/schemas.ts` as Zod schemas with inferred TypeScript types.

4. **Templates are data** — Nunjucks templates are loaded into an immutable
   in-memory bundle by the shell before translation. The core receives a frozen
   `ImmutableTemplateBundle` and never touches the filesystem.

## What Belongs in Each Layer

### Pure Core (`src/rosetta/`)

- Zod schema validation and type inference
- Request normalization and guard validation
- Format detection (rule evaluation, confidence ranking)
- Source translation (document parsing to `KnowledgeArtifact`)
- Canonical parsing and serialization
- Compatibility evaluation and degradation diagnostics
- Target translation (artifact to `TranslationPlan`)
- Plan validation (path safety, collision detection)
- Inspection report building
- Sensitive-value redaction and fingerprinting
- Diagnostic creation and sorting

### Imperative Shell

- **`src/translation-orchestrator.ts`** — Scans allowed roots, resolves symlinks,
  groups documents per artifact, enforces byte limits, passes in-memory documents
  to the engine.

- **`src/translation-plan-applier.ts`** — Validates destination parents, rejects
  symlink escapes, stages artifacts, sets executable modes, atomically swaps output.

- **`src/rosetta-commands.ts`** — CLI handlers for `kanon rosetta formats|detect|inspect|translate`.

- **`src/build.ts`** — Preloads template bundles, manages workspace overrides,
  shared MCP merge, dist policy, and output writes.

- **`src/import.ts`** / **`src/importers/`** — Legacy compatibility facades delegating
  to the core via the orchestrator.

## Registry and Sync Separation

The `TranslationRegistry` is a pure, frozen data structure. It holds format contracts,
translator references, and alias mappings — no I/O.

Sync acquisition (Git remotes, subtree pulls, checked-out prefixes) remains in shell
scripts and the orchestrator. The registry has no knowledge of Git, remotes, or branch
state. This separation ensures:

- Registry queries are deterministic and testable without fixtures
- Acquisition strategies can change without touching translation logic
- Profile validation halts before acquisition on invalid configuration

## Code Example: Using the Engine

```typescript
import {
  createRegistryBuilder,
  createEngine,
  BUILTIN_FORMAT_CONTRACTS,
} from "./rosetta";

// Build and freeze the registry (pure)
const builder = createRegistryBuilder();
for (const contract of BUILTIN_FORMAT_CONTRACTS) {
  builder.register({ contract });
}
const registry = builder.freeze();

// Create the engine (pure)
const engine = createEngine(registry);

// Translate (pure — no filesystem access)
const result = engine.translate({
  mode: "inbound",
  documents: [{ path: "POWER.md", content: "..." }],
  sourceFormat: "kiro-power",
});
```

## Architecture Boundary Enforcement

The test suite (`rosetta-architecture.test.ts`) scans all `src/rosetta/**` imports
and rejects any dependency on:

- `node:fs`, `node:path` filesystem operations
- `node:child_process` or subprocess execution
- `process.env`, `process.cwd()`, or environment access
- Network libraries or `fetch`
- `Date.now()`, `Math.random()`, or non-deterministic APIs
- `@clack/prompts` or interactive I/O
