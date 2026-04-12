# ADR-0019: `forge import` — Auto-detecting Importer for External Kiro Format

**Date:** 2026-04-12
**Status:** Proposed
**Deciders:** skill-forge maintainers
**Supersedes:** N/A

## Context and Problem Statement

Skill-forge compiles knowledge artifacts *to* Kiro's native format
(`POWER.md` + `steering/`) but had no path for the reverse — ingesting
existing Kiro powers or skills into the skill-forge canonical format.
Users with existing power collections (e.g. byron-powers, with 4 powers
and 41 workflow files) needed a way to bring that content into the bazaar
without manually rewriting every frontmatter field and recreating the
directory structure.

## Decision Drivers

- Minimize conversion friction — existing collections should import in
  one command, not require file-by-file editing
- The format mapping must be deterministic and auditable (no silent data
  loss or field omissions)
- The importer should be extensible: Kiro power is the first format, but
  `kiro-skill` and future formats should slot in without redesign
- Dry-run mode is required so users can preview before committing

## Considered Options

1. **Document the format mapping, leave conversion manual** — publish a
   guide; users copy files themselves
2. **Single-format importer, hardcoded for kiro-power** — fast to ship,
   handles the immediate need
3. **Auto-detecting multi-format importer** — detect source format from
   file presence (`POWER.md` vs `SKILL.md`), map frontmatter and copy
   workflow files in one pass

## Decision Outcome

**Chosen option: Option 3 — auto-detecting multi-format importer**,
because it is the only option that handles batch imports cleanly, extends
to new source formats without CLI surface changes, and reduces the
import of a 4-power collection from ~40 manual file operations to one
command.

Auto-detection keys:
- `POWER.md` present → `kiro-power` format (`steering/` → `workflows/`)
- `SKILL.md` present → `kiro-skill` format (`references/` → `workflows/`)

The `--format` flag allows explicit override when auto-detection is
ambiguous. `--all` scans a parent directory for all importable
subdirectories.

### Positive Consequences

- `forge import ~/my-powers --all --collections my-collection` imports
  an entire power library in one invocation
- `--dry-run` previews what would be created without writing anything
- New source formats (e.g. Copilot instructions, Cursor rules) extend
  the importer by implementing one function and registering a detection
  key — no CLI changes required
- Imported artifacts are immediately valid skill-forge knowledge
  artifacts: `forge validate` and `forge build` work without edits

### Negative Consequences / Trade-offs

- Imported artifacts default to `harnesses: [kiro]` for powers and
  `harnesses: [claude-code]` for skills — authors must manually extend
  for other harnesses if desired
- The frontmatter mapping is opinionated: `maturity: stable`,
  `trust: community`, `audience: intermediate` are applied as defaults.
  Authors may want to review and override these after import.
- No reverse path: `forge export` (compiling back to Kiro native format)
  is handled by the existing build pipeline, not the importer

## Options Analysis

### Option 1: Document and leave manual
**Pros:** Zero implementation cost
**Cons:** A 4-power collection takes ~40 file operations; error-prone for
steering file renaming and frontmatter field mapping

### Option 2: Hardcoded kiro-power importer
**Pros:** Simpler code path; ships faster
**Cons:** A second format (kiro-skill) would require a fork of the
importer logic; no clear extension point

### Option 3: Auto-detecting importer (chosen)
**Pros:** One command handles any supported format; extensible;
dry-run included
**Cons:** Detection heuristic could misfire for unusual directory layouts
(mitigated by `--format` override)

## Links and References

- Relates to: [ADR-0017](./0017-pluggable-backend-abstraction-for-artifact-publishing.md)
  (import is the inbound side of the same distribution concern)
- Implementation: `skill-forge/src/import.ts`
- Branch: main
