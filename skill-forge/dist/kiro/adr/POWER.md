<!-- forge:version 0.4.1 -->
---
name: adr
displayName: Architecture Decision Records
description: Create, maintain, and cross-reference Architecture Decision Records (ADRs) using MADR format. Infers decisions from git context, detects duplicates, manages supersession chains, and keeps an index file up to date.
keywords: ["adr","architecture-decision-record","madr","decision-log"]
author: Steven J. Miklovic
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

## Changelog

# Changelog Integration

Maintain CHANGELOG.md alongside ADRs. Changelog entries are links to ADRs, not restatements.

## Detection Order
Stop at first match:
1. towncrier — `[tool.towncrier]` in `pyproject.toml`, `towncrier.toml`, `changes/`, `changelog.d/`
2. conventional-changelog — `.versionrc`, `.versionrc.json`, `"standard-version"` in `package.json`
3. release-please — `release-please-config.json`, `.release-please-manifest.json`
4. changesets — `.changeset/`
5. git-cliff — `cliff.toml`

Fragment tool found → use its format, stop. Do not edit CHANGELOG.md directly.

No tool → look for `CHANGELOG.md`, `CHANGES.md`, `HISTORY.md`, `NEWS.md` at root or `docs/`.

Nothing found → offer to create `CHANGELOG.md`. Confirm first.

## Bootstrap Template
```markdown
# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/)

## [Unreleased]

### Architecture Decisions
```
Only include section headers that have entries.

## ADR Entry Format
One line per ADR. Link only, no summary:
```markdown
- [ADR-{NNN}](docs/adr/ADR-{NNN}-{slug}.md): {Title}
```

Supersession:
```markdown
- ~~[ADR-003](docs/adr/ADR-003-slug.md): Old Title~~ — superseded by ADR-015
- [ADR-015](docs/adr/ADR-015-slug.md): New Title
```

Status promotions (Draft→Proposed→Accepted): no new entry.

## Versioning
All entries go under `[Unreleased]`. Release process moves them to version sections. ADR power does not manage releases.

## Bulk Generation
For existing ADRs, one line each. Show draft, confirm before writing.

## Paths
Relative from CHANGELOG.md to ADR file. Verify resolution.

## Generate From Diff

# ADR-from-Diff Generation

Auto-draft ADR from current git diff. Uses shared rules from POWER.md (git context, duplicate check, confirm before write, index, changelog).

## Workflow

### 1. Gather Diff
Run git context per POWER.md, plus:
```bash
git diff HEAD -- '*.tf' '*.py' '*.yaml' '*.yml' '*.toml' '*.json' '*.ts' '*.go' '*.rs'
```

### 2. Classify Changes

| Signal | Detection | Relevance |
|--------|-----------|-----------|
| New module/package | New `__init__.py`, new dir with multiple files | High |
| New dependency | Changes to `pyproject.toml`, `package.json`, `go.mod`, `Cargo.toml` | High |
| Interface change | Modified public API signatures, changed schemas | High |
| Config schema change | New env vars, new CLI options | Medium |
| Infrastructure change | New/modified `.tf`, IAM, S3, CI workflows | High |
| Pattern establishment | New base class, decorator, middleware, error hierarchy | High |
| File deletion | Removed modules/dependencies | Medium |
| Test-only / docs-only | Only tests or docs changed | Skip |

No high/medium signals → "No architectural changes detected." Stop.

### 3. Group
Related signals → single ADR. Group by: same component, same dependency+usage, same pattern across files.

### 4. Infer Details
- **Title**: from primary change
- **Context**: file paths + why it's a decision point
- **Drivers**: from commit messages, added vs removed code
- **Options**: implemented = chosen; "do nothing" always; replaced code = prior option; comments mentioning alternatives
- **Consequences**: new deps = maintenance; new patterns = consistency requirement; removed code = migration paid

### 5. Template
Multiple alternatives visible → full MADR. Single viable option → short-form. Unclear → full MADR.

### 6. Draft
1. Duplicate check per POWER.md
2. Draft with `<!-- REVIEW: ... -->` on uncertain sections
3. Present: "Drafted from recent changes. Review marked sections."
4. Confirm → write → index + changelog per POWER.md

## Limitations
- Cannot know alternatives never coded
- Inference quality depends on diff clarity
- Mark uncertainty with `<!-- REVIEW -->`

## Health Check

# ADR Health Check

Cross-reference ADRs against codebase. Produce actionable report. Do not auto-fix.

## 1. Load ADRs
For each ADR, extract: number, title, status, date, referenced file paths, dependencies, patterns, supersession links.

## 2. Checks (Accepted/Proposed ADRs only)

**File existence**: `test -f "{path}"`. Missing → **drifted**.

**Dependency presence**: grep project dependency file (`pyproject.toml`, `package.json`, `go.mod`, `Cargo.toml`, `*.tf`). Missing → **drifted**.

**Pattern survival**: `grep -r "{pattern}" -l` across source files. Zero matches → **potentially obsolete**.

**Git activity** (ADRs >6 months): `git log --since="6 months ago" --oneline -- {paths}`. Significant changes → **needs review**.

**Supersession integrity**: verify both sides of supersession links exist and statuses match. Mismatch → **broken reference**.

**Orphans**: Draft >30 days → **abandoned draft**. Proposed >60 days → **stalled proposal**.

## 3. Report Format
```markdown
# ADR Health Report — {date}

## Summary
Total: {N} | Healthy: {N} | Attention: {N}

## Issues

### 🔴 Drifted
- **ADR-NNN**: `{path}` missing since {commit}. Action: supersede or deprecate.

### 🟡 Needs Review
- **ADR-NNN**: `{path}` modified {N} times since written. Action: verify decision holds.

### 🟠 Potentially Obsolete
- **ADR-NNN**: `{pattern}` not found. Action: verify if renamed/replaced.

### ⚪ Stale Process
- **ADR-NNN** ({status}, {N} days): Promote, update, or delete.

### 🔗 Broken References
- **ADR-NNN**: supersession link inconsistent. Action: update statuses.

## Healthy
{list}
```

Present report. Let user decide actions.

## Specs Integration

# ADR ↔ Specs Integration

Uses shared rules from POWER.md (git context, duplicate check, index, cross-referencing, changelog).

## When to Create ADRs

**Design phase**: technology choices, architectural patterns, integration decisions, trade-offs → create ADR immediately.

**Pre-task**: extract architectural nouns from task + design doc → search existing ADRs. Match → reference. No match + significant decision → create ADR before starting the task.

**Post-task / session end**: per POWER.md agentStop hook. New modules/deps/patterns → create ADR before session closes.

> **Key principle:** Hooks must be *directive*, not *advisory*. "Suggest ADR" gets ignored during autonomous sessions. "Create ADR immediately" gets executed. See the Hook Design Anti-Patterns table in POWER.md.

## Linking

ADR → Spec (in Links section):
```markdown
- Spec: .kiro/specs/{name}/design.md
- Spec Task: .kiro/specs/{name}/tasks.md — Task {N}.{M}
```

Spec → ADR (in design doc):
```markdown
> See #[[file:docs/adr/ADR-{NNN}-title.md]]
```

## Spec-Aware Template Additions

Context section references spec:
```markdown
## Context and Problem Statement
Decision arose during **{spec-name}** (.kiro/specs/{name}/design.md).
{Motivating requirement or design section.}
```

Drivers reference requirements:
```markdown
## Decision Drivers
- Requirement {N}: {title} — {constraint}
- Design constraint: {from design doc}
```

Links include spec artifacts:
```markdown
## Links and References
- Spec: .kiro/specs/{name}/requirements.md — Req {N}
- Spec: .kiro/specs/{name}/design.md — {section}
- Spec: .kiro/specs/{name}/tasks.md — Task {N}.{M}
```

## Spec Review
Starting spec work → extract key terms → search ADRs → present:
> "Found {N} ADRs related to **{spec-name}**. Review before starting tasks."

## Impact Analysis
Spec design changes → find affected ADRs → classify: valid / needs update / supersede → present, user decides.

## Team Review

# Team Decision Workflow

Review checklist, reviewer suggestions, promotion. Uses shared rules from POWER.md (index, cross-referencing, changelog).

## Review Checklist (Proposed ADRs)

### Completeness
- [ ] Context states the problem
- [ ] Drivers are specific and traceable
- [ ] ≥2 alternatives (or short-form with no-alternatives rationale)
- [ ] "Do nothing" addressed
- [ ] Positive and negative consequences
- [ ] Implementation paths included

### Quality
- [ ] Balanced options analysis (no strawmen)
- [ ] Specific rationale (not "it's better")
- [ ] Realistic consequences
- [ ] No factual errors
- [ ] Drivers actually influenced decision

### Traceability
- [ ] Related ADR links valid and bidirectional
- [ ] Implementation paths exist in codebase
- [ ] Spec references valid (if linked)
- [ ] Supersession chain consistent

### Scope
- [ ] Right granularity
- [ ] Single decision per ADR
- [ ] Title reflects decision

Present pass/fail per item with specific feedback on failures.

## Reviewer Suggestion
```bash
git log --format='%aN' -- {path} | sort | uniq -c | sort -rn | head -5
```
For spec-linked ADRs, also: `git log --format='%aN' --diff-filter=A -- .kiro/specs/{name}/ | head -1`

## Promotion

### Propose → Accept
1. Checklist passes (or exceptions acknowledged).
2. Add to ADR: `**Accepted:** {date}`, `**Approved by:** {names}`.
3. Index + cross-refs + changelog per POWER.md.

### Propose → Withdraw
1. Status → Deprecated with `**Reason:** {why}`.
2. Index + related ADR updates.

### Accept → Supersede
1. New ADR with `Supersedes`. Old ADR gets `Superseded by`.
2. Index both + changelog per POWER.md.

## Batch Review
List all Proposed → checklist each → summary:
```
ADR-005 (12d): 14/16 pass. Issues: {specifics}.
ADR-009 (45d): 16/16 pass. Ready.
ADR-011 (90d): 10/16 pass. Stale.
```
User decides per ADR.

## Workflow

# ADR Workflow

Directory, naming, status, git context, index, cross-referencing, changelog, templates, and rules are defined in POWER.md. This file covers mode-specific workflows only.

## Modes

### Create (default)
1. Duplicate check: grep existing ADRs for key nouns. ≥2 overlap → offer: [1] Supersede [2] Amend [3] Unrelated. Wait for answer.
2. Template: unilateral decision → short-form. Otherwise → full MADR.
3. Draft → show → confirm → write.
4. Auto-assign next number.
5. Flag related/superseded ADRs.
6. Index + changelog check per POWER.md.

### Update
1. Load ADR, show content.
2. Show diff, confirm before writing.
3. Reversing decision → Superseded status.
4. Index + changelog check.

### Review
1. Table: number, title, status, date.
2. Highlight Draft/Proposed.
3. Stale: >6 months + covered files modified. Verify: `git log --since=6.months -- <paths>`.

### Cross-Reference
1. Find related ADRs by topic or number.
2. Direction: `supersedes`, `implements`, `relates to`.
3. Chain oldest→newest.

## Templates

### Full MADR
```markdown
# ADR-{NNN}: {Title}

**Date:** {YYYY-MM-DD}
**Status:** Proposed | Accepted | Deprecated | Superseded by [ADR-NNN](./ADR-NNN-title.md)
**Deciders:** {names/roles}
**Supersedes:** {ADR-NNN | N/A}

## Context and Problem Statement
{2-4 sentences}

## Decision Drivers
- {constraint}

## Considered Options
1. {Option A}
2. {Option B}
3. {Do nothing}

## Decision Outcome
**Chosen option:** {Option N}, because {rationale}.

### Positive Consequences
- {benefit}

### Negative Consequences
- {drawback}

## Options Analysis
### Option 1: {Title}
Pros: {list} | Cons: {list}
### Option 2: {Title}
Pros: {list} | Cons: {list}

## Links and References
- Relates to: [ADR-NNN](./ADR-NNN-title.md)
- Implementation: {path or PR}
- Branch: {branch name}
```

### Short-Form (no alternatives)
```markdown
# ADR-{NNN}: {Title}

**Date:** {YYYY-MM-DD}
**Status:** Draft | Proposed | Accepted
**Deciders:** {names/roles}
**Supersedes:** N/A

## Context and Problem Statement
{2-4 sentences}

## Decision
{1-3 sentences}

## Rationale for No Alternatives
{Why alternatives weren't viable}

## Consequences
- {consequence}

## Links and References
- Implementation: {path or PR}
- Branch: {branch name}
```

## Report
List all files created/updated: ADR + index + superseded ADRs + changelog entry. Note related ADRs to review.
