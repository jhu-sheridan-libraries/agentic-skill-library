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
version: 0.2.0
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
trust: community
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

## Steering Files
- **workflow** — Create, update, review, cross-reference
- **generate-from-diff** — Auto-draft ADR from git diff
- **health-check** — Staleness detection, codebase cross-reference
- **team-review** — Review checklist, reviewer suggestions, promotion workflow
- **specs-integration** — ADR ↔ Kiro spec linking
- **changelog** — CHANGELOG.md for projects without fragment tools

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
1. Fragment tool found → use its format. See `changelog` steering for detection list.
2. CHANGELOG.md exists → append link. See `changelog` steering for format.
3. Nothing → offer to bootstrap. See `changelog` steering.

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
