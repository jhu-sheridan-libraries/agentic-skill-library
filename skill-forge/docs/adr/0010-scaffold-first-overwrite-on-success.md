# ADR-0010: Scaffold-First, Overwrite-on-Success Pattern for Interactive Wizard

**Date:** 2026-04-11
**Status:** Proposed
**Deciders:** Steven Murawski
**Supersedes:** N/A

## Context and Problem Statement

Decision arose during **interactive-new-command** (.kiro/specs/interactive-new-command/design.md).

When `forge new` launches the interactive wizard, the user may cancel at any prompt (Ctrl+C or Escape). We needed a strategy that ensures the user always ends up with valid files — either template defaults (on cancellation) or their custom input (on completion) — without risk of partial writes or corrupted artifacts.

## Decision Drivers

- Requirement 8.1: Cancel at any prompt without corrupting the artifact
- Requirement 8.2: Retain scaffold files with template defaults on cancellation
- Requirement 8.3: No partial user input written on cancellation
- Requirement 1.1: Scaffold directory created before wizard starts

## Considered Options

1. Scaffold-first, overwrite-on-success
2. Collect all input first, write files only at the end
3. Write files incrementally as each prompt completes

## Decision Outcome

**Chosen option:** Scaffold-first, overwrite-on-success, because it provides the strongest cancellation safety guarantee with minimal complexity.

The pattern works in three phases:
1. Scaffold files are written with template defaults before the wizard starts
2. The wizard collects all data in memory (the `WizardResult` object)
3. Files are only overwritten after the wizard completes successfully

If the user cancels at any point, the in-memory `WizardResult` is discarded and scaffold files remain untouched with valid template defaults.

### Positive Consequences

- Users always have valid files regardless of when they cancel
- No cleanup logic needed — scaffold files serve as the fallback
- Simple mental model: scaffold is the "safe state," wizard success overwrites it

### Negative Consequences

- Files are written twice on the happy path (scaffold then overwrite)
- Template rendering runs even when the wizard will replace the output

### Neutral

- The double-write cost is negligible for the small files involved (3 YAML/markdown files)

## Links and References

- Spec: .kiro/specs/interactive-new-command/requirements.md — Req 8
- Spec: .kiro/specs/interactive-new-command/design.md — Cancellation Safety section
- Implementation: src/new.ts, src/wizard.ts, src/file-writer.ts
