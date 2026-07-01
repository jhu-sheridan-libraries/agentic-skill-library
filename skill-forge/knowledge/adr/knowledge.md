---
name: adr
displayName: Architecture Decision Records
description: Create, maintain, and cross-reference Architecture Decision Records (ADRs) in MADR format. Infers decisions from git context, detects duplicates, manages supersession chains, and keeps the index up to date.
keywords:
  - adr
  - architecture-decision-record
  - madr
  - decision-log
  - documentation
author: Steven J. Miklovic
version: 0.5.0
harnesses:
  - kiro
type: power
inclusion: auto
categories:
  - architecture
  - documentation
ecosystem: []
depends: []
enhances: []
maturity: stable
trust: official
license: MIT
audience: intermediate
model-assumptions: []
collections:
  - neon-caravan
  - jh-drcc
inherit-hooks: false
harness-config:
  kiro:
    format: power
    inline-workflows: false
    main-steering: false
---
# ADR Power

## Overview

Architecture Decision Records capture significant architectural choices — context, decision, and consequences — in MADR format. This power creates, maintains, and cross-references ADRs: it reads git context, detects duplicates, manages supersession chains, and keeps the index current. Use it when a project makes choices future contributors must understand: module structures, integration patterns, technology selections, or data-flow changes. No configuration beyond a git repository; the ADR directory and changelog tool are auto-discovered.

## Steering Files

Read the matching file when its task arises.

| File | Read when |
|------|-----------|
| `workflow` | Any create / update / review / cross-reference task. Includes the MADR templates (full and short-form). Start here. |
| `generate-from-diff` | Drafting an ADR from `git diff` instead of a manual description. |
| `health-check` | Auditing all ADRs for drift, staleness, broken references, and orphaned drafts. |
| `team-review` | Running the review checklist and promotion workflow (Proposed→Accepted). |
| `specs-integration` | Linking ADRs with Kiro specs (requirements / design / tasks). |
| `changelog` | Recording an ADR in the project's changelog tool after a write. |
| `hooks` | Installing native Kiro hooks that auto-enforce ADR creation. |

## Shared Definitions

All steering files reference these.

### Directory
Search order: `docs/adr/` → `docs/decisions/` → `docs/architecture/decisions/` → `docs/`. In monorepos, also check immediate subdirectories (`*/docs/adr/`). None found → propose `docs/adr/`, confirm before creating.

### Naming
`ADR-{NNN}-{kebab-case-title}.md`. Auto-assign the next sequential number from existing files at write time.

### Status
`Draft → Proposed → Accepted → Deprecated | Superseded by ADR-NNN`. Reversing an accepted decision is never an in-place edit — supersede it with a new ADR.

### Git Context
Run before any drafting or analysis:
```bash
git log --oneline -20
git diff --stat HEAD~5..HEAD 2>/dev/null || git diff --stat HEAD
git rev-parse --abbrev-ref HEAD
```

### Duplicate Check
Before creating, grep existing ADRs for the decision's key nouns. ≥2 overlaps → offer: supersede the old ADR, amend it, or proceed as unrelated. Wait for the choice before writing.

### Index Maintenance
After every ADR write, update `README.md` in the ADR directory. Exists → append/update the row (status change → update the existing row). Missing → create with the full table, confirm first.
```markdown
| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](./ADR-001-title.md) | Title | Accepted | YYYY-MM-DD |
```

### Cross-Referencing
Supersession updates both files. Relations are added to the Links section of both. Verify every referenced ADR number exists.

### Changelog Check
After every ADR write: fragment tool present (towncrier, changesets, conventional-changelog, release-please, git-cliff, or a `changes/` dir) → use its native format. Else `CHANGELOG.md`/`CHANGES.md`/`HISTORY.md`/`NEWS.md` present → append a link entry. Else → offer to bootstrap `CHANGELOG.md`. Entries are links, never restatements:
```markdown
- [ADR-{NNN}](docs/adr/ADR-{NNN}-{slug}.md): {Title}
```
See `changelog` steering for per-tool formats.

### Templates
Full and short-form MADR templates are in `workflow` steering.

## Rules
1. Git context before drafting.
2. Duplicate-check before creating.
3. Never silently rewrite an accepted decision.
4. Supersession updates both ADRs.
5. No dangling references.
6. Update the index after every write.
7. Draft → confirm → write. Never skip confirmation.
8. Changelog entries are links, not restatements.

## Hooks

Enforcement comes from two automatic hooks; see `hooks` steering for installable native JSON.
- **Session end** (`Stop`): create ADRs for undocumented architectural changes before the session closes.
- **Pre-task** (`PreTaskExec`): create ADRs for new decisions a spec task introduces before implementing.

Hook prompts must be directive — instruct the agent to create the ADR or confirm coverage, not to "suggest" or "keep in mind." Advisory prompts are ignored during autonomous runs.

## Examples

New module → new ADR:
```
Added src/backends/s3.ts (new S3 publishing backend).
→ Create docs/adr/ADR-018-s3-backend-for-artifact-publishing.md
→ Update README.md index row
→ Add changelog fragment
```

Supersession:
```
ADR-012 chose global type fields; ADR-014 repurposes type as taxonomy.
→ ADR-012 status → "Superseded by ADR-014"
→ ADR-014 links back to ADR-012
→ Update both index rows
```

## Edge Cases
- **Duplicate decision**: offer supersede / amend / proceed-as-unrelated. Wait for the choice.
- **Numbering conflict after merge**: renumber the later ADR, update all cross-references.
- **Index merge conflict**: keep both rows, verify numbers, run `health-check`.
- **Hook not firing**: validate the JSON, confirm the `trigger` value, ensure the file is in `.kiro/hooks/`.

## License, Privacy & Support

---
**License:** MIT (SPDX: `MIT`)
**Privacy Policy:** This power runs entirely on the local machine. It reads git history and repository files and writes ADR, index, and changelog files into the repo. It collects no telemetry and transmits no data to any external service. Statement and source: https://github.com/thinkingsage/context-bazaar
**Support:** https://github.com/thinkingsage/context-bazaar/issues
**Author:** Steven J. Miklovic
**MCP servers:** None — this is a knowledge-only power.
