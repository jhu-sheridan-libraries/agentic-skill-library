# ADR-0045: Preserve Nested Reference Trees in Workflow Files

## Status

Proposed

## Date

2026-07-13

## Context

Some upstream skills package progressive-disclosure references in nested directories and include non-Markdown practice fixtures such as CSV and TXT files. Kanon previously scanned only Markdown files directly under an artifact's `workflows/` directory. Importing those skills would either flatten their references, break the paths named by the skill, or omit the simulated data required by its exercises.

## Decision

Make workflow discovery recursive and preserve each file's relative path. Include regular files regardless of extension. Adapters receive the preserved path so harnesses that support workflow/reference files can reproduce the upstream tree. Workflow display names are derived from the relative path for catalog and pointer text; file contents remain unchanged.

## Consequences

### Positive

- Imported skills can retain their progressive-disclosure layout and fixture files.
- Reference paths in a skill remain valid after Codex compilation.
- Existing flat Markdown workflows continue to work unchanged.

### Negative

- Adapters that inline workflows may produce larger generated files when an artifact contains data fixtures.
- Contributors must review all files under `workflows/`, not only Markdown, for licensing and sensitive content.

### Neutral

- Workflow files remain part of the canonical artifact and are still validated as artifact content.
- This decision does not add dependency resolution or change harness capability declarations.
