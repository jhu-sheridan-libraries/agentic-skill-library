# ADR-0048: Config-driven upstream marketplace sync

**Date:** 2026-07-18
**Status:** Proposed
**Deciders:** kanon maintainers
**Supersedes:** N/A

## Context and Problem Statement

The project had a single-purpose shell script (`scripts/sync-kiro-powers.sh`)
that pulled from one upstream repository (kirodotdev/powers) via git subtree
and ran `kanon import` with hardcoded arguments. As the ecosystem grew, other
skill marketplaces emerged — notably obra/superpowers — with different directory
layouts and metadata conventions. Adding a second bespoke sync script would
duplicate logic; adding a third would be unmaintainable.

We needed a mechanism to:

1. Declare any number of upstream marketplaces in a single config file.
2. Handle git subtree add/pull uniformly across all upstreams.
3. Map each marketplace's native format to kanon's canonical import pipeline.
4. Allow selective syncing (one upstream at a time) and first-time initialization.

## Decision Drivers

- Zero-friction addition of new upstream marketplaces (config change, not code)
- Reuse of the existing `kanon import` pipeline and its `--format` dispatch
- Preserve the subtree approach for version tracking without submodule complexity
- Support heterogeneous formats: Kiro powers, Kiro skills, superpowers SKILL.md

## Considered Options

1. **One script per marketplace** — each upstream gets its own sync script
2. **Config-driven generic sync script** — a single script reads upstream
   definitions from `kanon.config.yaml` and dispatches accordingly
3. **CLI subcommand (`kanon sync`)** — implement the sync logic in TypeScript
   as a first-class CLI command

## Decision Outcome

**Chosen option: Option 2 — config-driven generic sync script**, because it
provides immediate value with minimal code, keeps git subtree operations in
shell (where they're most natural), and delegates the format-specific work to
the already-extensible `kanon import --format` pipeline.

Option 3 was considered but deferred — wrapping git subtree in TypeScript adds
complexity without clear benefit, and the shell script is transparent to debug.

### Implementation

**Config schema** (`kanon.config.yaml` → `upstreams` key):

```yaml
upstreams:
  <name>:
    repo: <git-url>           # required
    branch: <branch>          # default: main
    prefix: <subtree-prefix>  # relative to repo root
    format: <import-format>   # kiro-power | kiro-skill | superpowers | auto
    collection: <name>        # collection to assign
    knowledgeDir: <path>      # target knowledge subdirectory
    skillsPath: <path>        # subdirectory within upstream containing skills
```

**Sync script** (`scripts/sync-upstream.sh`):
- Reads all upstream entries from config using `bun -e` + js-yaml
- For each entry: ensures git remote, runs subtree pull (or add with `--init`)
- Invokes `kanon import <path> --all --format <fmt> --collections <col>`
- Supports `--init`, `--pull-only`, `--import-only`, `--dry-run`, `--list`
- Can target a single upstream by name

**New import format** (`superpowers`):
- Added to `ImportFormat` union type
- `importSuperpowers()` parses `SKILL.md` with YAML frontmatter (name,
  description, keywords, requires)
- Maps to kanon `Frontmatter` with multi-harness defaults (claude-code, codex,
  cursor)
- Copies additional `.md` files in the skill directory as workflow references

### Positive Consequences

- Adding a new marketplace is a 6-line YAML addition + `sync-upstream.sh --init`
- The old `sync-kiro-powers.sh` can be retired (or kept as a thin wrapper)
- Format-specific import logic remains in TypeScript with type safety and tests
- `--dry-run` previews the full pipeline without side effects

### Negative Consequences / Trade-offs

- The sync script shells out to `bun -e` for YAML parsing — adds a bun
  dependency to the shell script (acceptable since bun is already required)
- Git subtree operations remain manual for first-time setup (mitigated by
  `--init` flag)
- The superpowers format mapping is opinionated: defaults to 3 harnesses and
  `trust: community` / `maturity: stable` — may need per-upstream override
  fields in the future

## Links and References

- Relates to: [ADR-0019](./0019-forge-import-auto-detecting-kiro-format-importer.md)
  (extends the import format system)
- Relates to: [ADR-0029](./0029-importers-module-for-multi-harness-parsers.md)
  (the importers module provides the parser infrastructure)
- Implementation: `kanon/scripts/sync-upstream.sh`, `kanon/src/import.ts`
- Config: `kanon/kanon.config.yaml` (upstreams section)
- Upstream: https://github.com/obra/superpowers
