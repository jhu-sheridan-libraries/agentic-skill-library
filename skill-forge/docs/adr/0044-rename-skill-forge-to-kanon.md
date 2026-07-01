# ADR-0044: Rename Skill Forge to Kanon

## Status

Proposed

## Date

2026-06-23

## Context

The project name "Skill Forge" is generic and doesn't clearly convey what the tool does — authoring canonical knowledge artifacts and compiling them to multiple AI coding assistant harness formats. The name shares vocabulary with dozens of unrelated tools (game skill trees, resume builders, etc.), making it hard to search for and remember.

We want a name that:

1. Suggests the core concept (canonical source format → many targets).
2. Is short, typeable, and memorable as a CLI command.
3. Is distinctive enough to avoid namespace collisions.
4. Has intellectual weight appropriate for a research/academic context.

## Decision

Rename the tool from **Skill Forge** to **Kanon** (from Greek κανών — "rule, standard, measure").

The name directly references the tool's central abstraction: a **canonical** source format from which all harness-specific outputs derive. It's 5 characters, easy to type, and produces natural CLI ergonomics (`kanon build`, `kanon new`, `kanon catalog`).

### Migration scope

- Directory: `skill-forge/` → `kanon/`
- Package name: `skill-forge` → `kanon`
- CLI binary: `forge` → `kanon`
- Internal references: all imports, docs, steering, ADRs, CI workflows
- Repository name: `context-bazaar` remains unchanged (it's the marketplace/catalog concept)
- The `knowledge/` directory and artifact format are unaffected

### Migration strategy

The rename will be executed as a single coordinated PR to avoid prolonged ambiguity. A deprecation alias (`forge` → `kanon`) may be provided temporarily.

## Consequences

### Positive

- Distinctive, searchable name with clear etymological connection to purpose
- Short CLI command reduces typing friction
- Academic/research credibility (Greek philosophical tradition)
- No known npm/crate/PyPI conflicts for `kanon` in the dev-tools space

### Negative

- One-time migration cost across all files, docs, CI, and steering
- Contributors with muscle memory for `forge` need brief adjustment period
- External references (blog posts, READMEs linking to the tool) will need updating

### Neutral

- The `context-bazaar` repository name is unaffected
- Artifact format and schema remain identical — this is purely a tooling/branding change
