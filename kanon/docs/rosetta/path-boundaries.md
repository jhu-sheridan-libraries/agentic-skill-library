# Path Boundaries

> Two-stage path validation, allowed roots, symlink resolution, and unsafe path
> rejection in Rosetta Stone.

## Overview

Rosetta Stone validates paths at two stages:

1. **Pure lexical validation** — Inside the translation boundary, without filesystem
2. **Impure realpath validation** — In the orchestrator/applier, with filesystem access

This two-stage approach keeps the pure core free of I/O while still preventing
filesystem escapes when plans are applied.

## Stage 1: Pure Lexical Validation

The plan validator (`src/rosetta/plan.ts`) normalizes and validates every output
path purely — no filesystem access needed.

### Normalization Rules

```typescript
import { normalizePlanPath } from "./rosetta";

// Normalization applies:
// 1. Unicode NFC normalization
// 2. Backslash → forward slash conversion
// 3. Segment splitting and validation
// 4. Recombination with forward slashes
const result = normalizePlanPath("sub\\dir/file.md");
// → { ok: true, normalized: "sub/dir/file.md" }
```

### Rejection Criteria (Lexical)

The following are rejected with `RS_UNSAFE_PATH` or `RS_PLAN_INVALID_PATH`:

| Pattern | Example | Reason |
|---|---|---|
| Traversal segments | `../escape/file` | Could escape allowed root |
| Current-dir segments | `./redundant/path` | Ambiguous, normalize away |
| Empty segments | `dir//file` | Malformed path |
| Absolute paths | `/etc/passwd` | Must be relative to root |
| Drive-letter prefixes | `C:\file` | Platform-specific absolute |
| UNC paths | `\\server\share` | Network path, never valid |
| NUL characters | `file\x00.md` | Filesystem injection |
| Non-NFC Unicode | `file\u0065\u0301` | Normalize to NFC first |

### Collision Detection

After normalization, the plan validator checks for duplicate paths:

```typescript
import { validatePlan } from "./rosetta";

const result = validatePlan(plan);
// If two output files normalize to the same path:
// → RS_PATH_COLLISION diagnostic (blocking)
```

Collision detection is case-sensitive. Platform-specific case folding is handled
by the applier in stage 2.

## Stage 2: Impure Realpath Validation

The `TranslationOrchestrator` and `PlanApplier` perform filesystem-aware checks
after the pure core has produced a validated plan.

### Allowed Roots

Every orchestration operation specifies an `allowedRoot` — the directory tree
within which reads and writes are permitted:

```typescript
// The orchestrator resolves source roots before reads
// and rejects any path that resolves outside the allowed root
const orchestrator = new TranslationOrchestrator({
  allowedRoot: "/workspace/kanon/knowledge",
});
```

### Symlink Resolution

Before reading source documents or writing output:

1. Resolve the real path of the target using `realpath`
2. Verify the resolved path starts with the allowed root
3. Reject if the symlink escapes the boundary

```
allowed root: /workspace/kanon/knowledge/
symlink:      /workspace/kanon/knowledge/link → /etc/secrets
result:       REJECTED (resolves outside allowed root)
```

### Destination Parent Validation

The plan applier validates that every output file's parent directory:

1. Exists or can be created within the allowed root
2. Does not resolve (via symlinks) outside the allowed root
3. Is not itself a symlink to an external location

## Path Safety Guarantees

The two-stage approach provides these guarantees:

1. **No traversal** — `..` segments are rejected at the lexical stage
2. **No absolute escape** — Absolute paths are rejected lexically
3. **No symlink escape** — Symlinks are resolved and bounds-checked
4. **No NUL injection** — NUL bytes are rejected before any filesystem operation
5. **Deterministic normalization** — Unicode NFC + forward slashes ensure
   the same logical path always produces the same normalized string
6. **Collision safety** — Two plan files cannot target the same normalized path

## Code Example: Full Path Lifecycle

```typescript
import { normalizePlanPath, validatePlan, createPlan } from "./rosetta";

// 1. Target translator produces relative paths
const outputFiles = [
  { path: "skills/my-skill.md", content: "...", executable: false },
];

// 2. Plan validator normalizes and checks (pure)
const planResult = createPlan({ outputFiles, operations: [...] });
// Rejects traversal, absolute, NUL, collisions

// 3. Orchestrator applies against allowed root (impure)
// Resolves symlinks, checks parent directories, stages atomically
```
