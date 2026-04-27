<!-- forge:version 0.4.0 -->
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