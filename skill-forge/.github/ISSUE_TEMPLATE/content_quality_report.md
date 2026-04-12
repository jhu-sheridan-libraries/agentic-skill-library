---
name: Content Quality Report
about: An artifact gives incorrect, outdated, or harmful guidance
labels: content, quality
---

## Affected artifact

| Field | Value |
|---|---|
| **Artifact name** | `kebab-case-name` |
| **Collection** | neon-caravan / byron-powers / none |
| **Harness where issue was observed** | kiro / claude-code / all / unsure |

## What the artifact says

_Quote the specific guidance that is wrong, outdated, or harmful. Exact text is more useful than a paraphrase._

```
paste excerpt from knowledge.md
```

## What actually happens

_Describe the behavior the artifact produces in an AI session. What does the assistant do when this guidance is active?_

## What it should say or do instead

_Describe the correct guidance, or the outcome a well-written artifact should produce. If you're not sure of the fix, say so — identifying the problem is still valuable._

## Severity

- [ ] **Incorrect** — the guidance produces wrong output (wrong commands, wrong patterns, incorrect facts)
- [ ] **Outdated** — was correct but no longer applies (deprecated API, changed tool behavior, stale convention)
- [ ] **Harmful** — the guidance could cause data loss, security issues, or significant wasted effort
- [ ] **Misleading** — technically accurate but leads practitioners in the wrong direction
- [ ] **Incomplete** — missing important caveats or edge cases that cause problems in practice

## Evidence

_What did you observe, try, or reference that confirms the guidance is wrong? A link, a counterexample, a doc reference, or a test case all help._

## Suggested fix

_Optional. If you know what the corrected guidance should be, paste a draft here. Even a rough version speeds up the fix._

```markdown
<!-- suggested replacement or addition -->
```

## Are you able to submit a PR with the fix?

- [ ] Yes
- [ ] No, but I can review one
- [ ] No
