<!-- forge:version 0.2.0 -->
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