# ADR-0061: Discover Namespaced Artifact Evals

## Status

Accepted

## Date

2026-08-26

## Context

Kanon supports two canonical artifact layouts: a flat layout at
`knowledge/<artifact>/` and a collection-namespaced layout at
`knowledge/<namespace>/<artifact>/`. The build pipeline recognizes both
layouts, but the eval runner previously searched only the flat layout.

As a result, artifact-local eval configurations in collections such as
`knowledge/byron-powers/<artifact>/evals/` were silently skipped. The
`kanon eval --init <artifact>` scaffold also created a duplicate flat path
instead of adding evals to an existing namespaced artifact.

## Decision

Artifact-local eval discovery and scaffolding SHALL follow the same
one-level namespace traversal used by the build pipeline:

1. Treat `knowledge/<artifact>/` as an artifact when it contains
   `knowledge.md`.
2. Otherwise, inspect its immediate child directories and treat each child
   containing `knowledge.md` as a namespaced artifact.
3. Load eval configurations only from each resolved artifact's `evals/`
   directory.
4. Resolve `kanon eval --init <artifact>` to the first matching existing
   artifact directory before falling back to the legacy flat path.

Top-level `evals/` remain cross-artifact configurations. This decision does
not add arbitrary-depth recursive traversal or alter the existing leaf-name
CLI selection semantics.

## Consequences

### Positive

- Collection-namespaced artifacts can own and run their local eval suites.
- Eval discovery now matches build discovery, preventing a valid artifact
  from compiling successfully while its eval suite is invisible.
- `--init` extends an existing namespaced artifact instead of producing a
  duplicate flat directory.

### Negative

- A flat artifact and a namespaced artifact with the same leaf name remain
  ambiguous to name-only CLI selection; the current first-match behavior is
  retained until the CLI accepts fully qualified artifact paths.
- Artifact-facing commands need to maintain the shared flat-plus-one-level
  traversal contract as additional discovery code is added.

### Neutral

- Existing flat eval suites and top-level cross-artifact suites retain their
  current paths and behavior.
- Promptfoo execution, providers, rubrics, and evaluation thresholds are
  unchanged.

## Links and References

- Relates to [ADR-0022](./0022-two-layer-artifact-security-review.md), which
  establishes LLM rubric evals on compiled artifacts.
- Aligns with `collectArtifactPaths` in `kanon/src/build.ts`.
- Implementation: `kanon/src/eval.ts`.
