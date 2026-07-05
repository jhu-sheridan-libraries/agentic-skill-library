# ADR-0003: Harness Adapters as Pure Functions

## Status

Accepted

## Date

2026-04-10

## Context

Each of the seven harness adapters transforms a `KnowledgeArtifact` into harness-native output files. We need to decide whether adapters handle their own file I/O or return data for the build orchestrator to write.

## Decision

Each harness adapter is a pure function with the signature:

```typescript
(artifact: KnowledgeArtifact, templateEnv: nunjucks.Environment) => AdapterResult
```

Adapters return `OutputFile[]` (relative paths + content) and `AdapterWarning[]`. They perform no file system operations. The build orchestrator in `src/build.ts` handles all I/O: clearing dist directories, writing files, and setting executable permissions.

## Consequences

### Positive

- Adapters are independently testable without filesystem mocking
- Build orchestrator has full control over write ordering, error handling, and cleanup
- Easy to add new adapters — just implement the function signature
- Warnings are collected and reported centrally rather than scattered across stderr calls

### Negative

- Adapters can't make I/O-dependent decisions (e.g., checking if a file exists in the target)
- All output must fit in memory (not a concern for text-based config files)

### Neutral

- The `executable` flag on `OutputFile` delegates permission-setting to the orchestrator (used by Cline hook scripts)
