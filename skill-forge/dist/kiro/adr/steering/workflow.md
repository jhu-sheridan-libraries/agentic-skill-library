<!-- forge:version 0.3.0 -->
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