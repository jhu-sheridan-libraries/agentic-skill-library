---
name: adr
displayName: Architecture Decision Records
description: Create, maintain, and cross-reference Architecture Decision Records (ADRs) using MADR format. Infers decisions from git context, detects duplicates, manages supersession chains, and keeps an index file up to date.
keywords:
  - adr
  - architecture-decision-record
  - madr
  - decision-log
author: Steven J. Miklovic
version: 0.4.0
harnesses:
  - kiro
type: power
inclusion: manual
categories:
  - architecture
  - documentation
ecosystem: []
depends: []
enhances: []
maturity: stable
trust: official
audience: intermediate
model-assumptions: []
collections:
  - neon-caravan
  - jhu
inherit-hooks: false
harness-config:
  kiro:
    format: power
---
# ADR Power

## Overview

Architecture Decision Records (ADRs) capture significant architectural choices — the context, the decision, and the consequences. This power automates ADR creation, maintenance, and cross-referencing using MADR format. It infers decisions from git context, detects duplicates, manages supersession chains, and keeps an index file up to date.

Use this power when your project makes architectural choices that future contributors need to understand: new module structures, integration patterns, technology selections, or data flow changes.

## Steering Files

- **workflow** — Core ADR operations: create, update, review, cross-reference. Start here for any ADR task. Includes both MADR templates (full and short-form).
- **generate-from-diff** — Auto-draft an ADR by analyzing `git diff`. Use when you've made changes and want the power to infer the architectural decision from code changes rather than describing it manually.
- **health-check** — Audit all ADRs for staleness, broken references, drifted implementations, and orphaned drafts. Use periodically (e.g. monthly) or before releases to ensure ADR accuracy.
- **team-review** — Structured review checklist, reviewer suggestions via git blame, and promotion workflow (Proposed→Accepted). Use when ADRs are ready for team sign-off.
- **specs-integration** — Bidirectional linking between ADRs and Kiro specs. Use when working within the specs workflow to ensure architectural decisions are captured alongside requirements and design docs.
- **changelog** — Detect and integrate with your project's changelog tool (towncrier, changesets, conventional-changelog, release-please, git-cliff, or plain CHANGELOG.md). Use after creating any ADR to maintain changelog entries.

## Shared Definitions

All steering files reference these. Defined once here.

### Directory
Search: `docs/adr/` → `docs/decisions/` → `docs/architecture/decisions/` → `docs/`. None → propose `docs/adr/`, confirm first.

### Naming
`ADR-{NNN}-{kebab-case-title}.md`

### Status
`Draft → Proposed → Accepted → Deprecated | Superseded by ADR-NNN`

### Git Context
Run before any drafting or analysis:
```bash
git log --oneline -20
git diff --stat HEAD~5..HEAD 2>/dev/null || git diff --stat HEAD
git rev-parse --abbrev-ref HEAD
```

### Index Maintenance
After every ADR write, update `README.md` in ADR directory:
- Exists → append/update row. Status change → update existing row.
- Missing → create with full table. Confirm first.
```markdown
| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](./ADR-001-title.md) | Title | Accepted | YYYY-MM-DD |
```

### Cross-Referencing
- Supersession: update both files.
- Relation: add to Links of both.
- Verify all referenced ADR numbers exist.

### Changelog Check
After every ADR write:
1. Fragment tool found (towncrier, changesets, conventional-changelog, release-please, git-cliff, or custom `changes/` directory) → use its native format. See `changelog` steering for full detection order and per-tool format guidance.
2. No fragment tool but CHANGELOG.md (or CHANGES.md, HISTORY.md, NEWS.md) exists → append link entry. See `changelog` steering for format.
3. Nothing found → offer to bootstrap CHANGELOG.md. See `changelog` steering.

### Templates
See `workflow` steering, section 5.

## Rules
1. Git context before drafting
2. Duplicate-check before creating
3. Never silently rewrite accepted decisions
4. Supersession updates both ADRs
5. No dangling references
6. Update index after every write
7. Draft → confirm → write (never skip confirmation)
8. Changelog entries are links, not restatements

## Hooks

> **Design principle — directive, not advisory.** Hook prompts must tell the agent to **do** something (create the ADR, confirm coverage) rather than "keep in mind" or "flag for the user." Advisory prompts are ignored during long autonomous sessions like "run all tasks." Every hook prompt should end with a concrete action the agent must take before proceeding.

> **`askAgent` vs `runCommand` for task hooks.** Use `askAgent` when the hook needs the agent to **take action** (create files, make decisions). Use `runCommand` only for diagnostic output that doesn't require agent action. Note: `askAgent` prompts appear as `<HOOK_INSTRUCTION>` blocks in the conversation — write them as clear directives, not internal notes.

> **Path discovery:** ADR directories may live in subdirectories (e.g. monorepos). Hooks search both the workspace root and common subdirectory prefixes. The search pattern iterates `for base in . */; do` to cover both layouts.

### agentStop — ADR Enforcement
Uses `askAgent` (not `runCommand`) so the agent can actually create missing ADRs before the session closes. A `runCommand` hook can only print diagnostics — it cannot trigger file creation.
```json
{"name":"ADR Enforcement on Session End","version":"2.0.0","when":{"type":"agentStop"},"then":{"type":"askAgent","prompt":"Before this session ends, check if any architectural decisions from this session are undocumented:\n\n1. Run: git diff --stat HEAD (or git -C <subdir> diff --stat HEAD) to see what changed.\n2. Filter for architectural files (src/, lib/, commands/, modules/ — excluding tests).\n3. If architectural files changed, scan the ADR index (e.g. docs/adr/README.md) for existing ADRs.\n4. Read the design.md of any active spec whose files were touched.\n5. If you find NEW architectural patterns, module structures, or integration approaches that are NOT covered by existing ADRs:\n   a. Create the ADR(s) immediately at docs/adr/NNNN-short-title.md\n   b. Update the README.md index table\n   c. Create changelog fragments if the project uses them\n6. If all changes are covered by existing ADRs, report: 'All architectural decisions documented — no new ADRs needed.'\n\nDo NOT just list what changed. Either create missing ADRs or confirm coverage."}}
```

### preTaskExecution — ADR + Spec Context Check
Directive `askAgent` prompt that checks for undocumented architectural decisions and creates ADRs **before** the task starts. The prompt explicitly requires action (create or confirm), not just acknowledgment.
```json
{"name":"ADR + Spec Context Check","version":"2.0.0","when":{"type":"preTaskExecution"},"then":{"type":"askAgent","prompt":"Before starting this task, do the following:\n\n1. Read the active spec's design.md and identify the key architectural decisions relevant to THIS task.\n2. Scan the ADR index (e.g. docs/adr/README.md) to check if those decisions are already documented.\n3. If this task introduces a NEW architectural pattern, module structure, data flow, or integration approach that is NOT covered by an existing ADR:\n   a. Create the ADR immediately (next sequential number)\n   b. Update the README.md index table\n   c. Create a changelog fragment if the project uses them\n   d. Then proceed with the task implementation.\n4. If all architectural decisions are already covered by existing ADRs, proceed with the task — no action needed.\n\nDo NOT just acknowledge this reminder. Either create the ADR or confirm that existing ADRs cover the decisions."}}
```

### fileCreated — New Module Check (optional)
```json
{"name":"ADR New Module Check","version":"1.0.0","when":{"type":"fileCreated","patterns":["**/modules/**/*.tf","**/src/**/commands/*.py","**/src/**/__init__.py"]},"then":{"type":"askAgent","prompt":"New architectural file created. Check if this introduces a new module, component, or integration pattern not covered by existing ADRs. If it does, create the ADR immediately. If it's a standard addition to an existing pattern, proceed without action."}}
```

### userTriggered — Generate from Diff / Health Check / Team Review
```json
{"name":"Generate ADR from Diff","version":"1.0.0","when":{"type":"userTriggered"},"then":{"type":"askAgent","prompt":"Read generate-from-diff steering from adr power. Analyze git diff, classify changes, draft ADR with REVIEW markers, present for confirmation."}}
```
```json
{"name":"ADR Health Check","version":"1.0.0","when":{"type":"userTriggered"},"then":{"type":"askAgent","prompt":"Read health-check steering from adr power. Run full health check on all ADRs. Present actionable report."}}
```
```json
{"name":"ADR Team Review","version":"1.0.0","when":{"type":"userTriggered"},"then":{"type":"askAgent","prompt":"Read team-review steering from adr power. List Proposed ADRs, run checklist, suggest reviewers, present batch summary."}}
```

### Conditional Steering (optional `.kiro/steering/`)
```yaml
---
inclusion: fileMatch
fileMatchPattern: "docs/adr/**,docs/decisions/**,docs/architecture/**"
---
```
```yaml
---
inclusion: fileMatch
fileMatchPattern: ".kiro/specs/**"
---
```

### Hook Design Anti-Patterns

These patterns cause hooks to be ignored during autonomous sessions:

| Anti-pattern | Why it fails | Fix |
|---|---|---|
| "Keep in mind" / "flag for the user" | Agent treats it as advisory context, not an action | "Create the ADR immediately" / "Do NOT just acknowledge" |
| `runCommand` for agentStop | Shell script can only print text — cannot trigger file creation | Use `askAgent` so the agent can create files |
| "Suggest ADR if needed" | Agent interprets "suggest" as optional | "Check if covered. If not, create the ADR." |
| No explicit termination condition | Agent doesn't know when the hook is satisfied | End with "Either create missing ADRs or confirm coverage" |
| Passive voice ("ADRs should be reviewed") | No clear actor or action | Active imperative ("Review ADRs. Create if missing.") |

### Hook Portability Notes

- All `askAgent` hooks are portable across platforms since they delegate logic to the agent.
- The `fileCreated` hook's `patterns` array should be customized per project. The defaults (`**/modules/**/*.tf`, `**/src/**/commands/*.py`) assume Terraform/Python — adjust for your stack.
- For `runCommand` hooks that need shell logic, prefer simple POSIX-compatible commands (`git`, `grep`, `test`) over language-specific inline scripts. If complex logic is needed, extract it to a script file in the repo and reference it from the hook.

## Examples

**Creating an ADR after introducing a new module:**
```
You added src/backends/s3.ts — a new S3 backend for artifact publishing.
→ Create ADR: "0018-s3-backend-for-artifact-publishing.md"
→ Update README.md index table
→ Create changelog fragment
```

**Superseding an existing ADR:**
```
ADR-012 chose global type fields. ADR-014 repurposes type as taxonomy.
→ ADR-012 status changes to "Superseded by ADR-014"
→ ADR-014 links back to ADR-012
→ Both index rows updated
```

## Configuration

No additional configuration required beyond git. The power works with any project that has a git repository. It auto-discovers the ADR directory location and adapts to your project's changelog tooling.

Optional customization:
- **ADR directory**: defaults to `docs/adr/`. Override by creating your preferred directory (`docs/decisions/`, `docs/architecture/decisions/`) before first use.
- **Hook file patterns**: the `fileCreated` hook ships with Terraform/Python patterns. Edit the `patterns` array to match your project's architectural file types (e.g. `**/cdk/**/*.ts`, `**/helm/**/*.yaml`, `**/*.proto`).
- **Changelog tool**: auto-detected. See `changelog` steering for the full detection order. No manual config needed.

## Troubleshooting

**ADR directory not found:**
The power searches `docs/adr/` → `docs/decisions/` → `docs/architecture/decisions/` → `docs/`. If none exist, it proposes `docs/adr/` and asks for confirmation. In monorepos, the search also checks immediate subdirectories (`*/docs/adr/`).

**Duplicate ADR detected:**
If a new ADR covers the same decision as an existing one, the power flags the overlap and offers three options: supersede the old ADR, amend it in place, or proceed as unrelated. Choose based on whether the decision has changed (supersede) or just needs clarification (amend).

**Index out of sync:**
Run the health-check steering workflow to detect missing index entries, stale statuses, and dangling cross-references. This produces an actionable report without auto-fixing.

**Numbering conflicts in team environments:**
When multiple team members create ADRs concurrently, number collisions can occur. The power auto-assigns the next sequential number based on existing files at write time. If a conflict is detected after merge, renumber the later ADR and update all cross-references.

**Merge conflicts in README.md index:**
The index table is append-only by convention. Git merge conflicts typically occur in the table rows. Resolve by keeping both rows and verifying the ADR numbers are correct. Run health-check after resolving to validate.

**Hook not firing / being ignored:**
Ensure the hook JSON is valid (check `.kiro/hooks/` directory). Common issues: missing `version` field, incorrect `type` value, or the hook file not ending in `.kiro.hook`. For `agentStop` hooks, note they only fire when the agent session actually ends — not on individual message completions.

**Changelog tool not detected:**
The detection order checks specific files and directories (see `changelog` steering). If your project uses a non-standard location or tool, the power falls back to looking for `CHANGELOG.md` at the project root. You can manually create the file to establish the pattern.
