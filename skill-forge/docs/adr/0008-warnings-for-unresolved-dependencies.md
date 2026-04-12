# ADR-0008: Warnings (Not Errors) for Unresolved Dependency References

## Status

Proposed

## Date

2026-04-11

## Context

Knowledge artifacts can declare `depends` and `enhances` relationships to other artifacts by name. During `forge validate`, we need to check whether referenced artifact names actually exist in the knowledge directory. The question is whether unresolved references should be errors (blocking, artifact marked invalid) or warnings (informational, artifact remains valid).

During incremental authoring, an author may declare a dependency on an artifact they haven't created yet, or one that lives in a different repository. Treating these as errors would block validation and break CI for legitimate workflows.

Spec: .kiro/specs/catalog-metadata-evolution/design.md

## Decision

Unresolved `depends` and `enhances` references emit warnings, not errors. The artifact's `valid` flag remains `true`. Warnings are displayed with `chalk.yellow` in CLI output and counted in the summary line. A `ValidationWarning` type was added to the schema alongside the existing `ValidationError` type.

Cross-artifact resolution happens in `validateAll()` (not `validateArtifact()`) since it requires the full set of artifact names.

## Consequences

### Positive

- Authors can declare forward references to artifacts they plan to create
- CI pipelines don't break due to missing optional dependencies
- Warnings still surface broken references for authors to investigate

### Negative

- Genuinely broken references won't block publishing — authors must pay attention to warnings
- Two-pass validation (per-artifact errors, then cross-artifact warnings) adds complexity to `validateAll()`

### Neutral

- The warning/error distinction mirrors common linter behavior (e.g., ESLint warnings vs. errors)
