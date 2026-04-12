---
name: Artifact Submission
about: Propose a new knowledge artifact for the bazaar
labels: artifact, needs-review
---

## Artifact identity

| Field | Value |
|---|---|
| **Name** | `kebab-case-name` |
| **Display name** | Human Readable Title |
| **Type** | skill / power / workflow / agent / prompt / template / reference-pack |
| **Proposed collection** | neon-caravan / byron-powers / new: ___ / none |

## What problem does this artifact solve

_When an AI coding assistant has this artifact in context, what does it do better or differently? Be specific about the task and the improvement._

## Target domain and audience

_What domain is this for (e.g. TypeScript, Git workflow, technical writing, security review)? Who benefits — beginner, intermediate, or advanced practitioners?_

## Harness targets

- [ ] All harnesses (default)
- [ ] Specific: kiro / claude-code / copilot / cursor / windsurf / cline / qdeveloper

_If kiro-only, note why (e.g. power format, steering-specific behavior)._

## Content preview

_Paste the key sections of your `knowledge.md` body, or a representative excerpt. Full frontmatter not required here — just enough to evaluate the guidance quality._

```markdown
<!-- paste excerpt -->
```

## Quality self-assessment

_Answer honestly. Reviewers will check._

- [ ] I have tested this artifact in at least one AI coding session and it produced the expected behavior
- [ ] The guidance is specific enough that an AI assistant can act on it without ambiguity
- [ ] The content is original or properly attributed (see CODE_OF_CONDUCT.md)
- [ ] `forge validate` passes on my local branch
- [ ] `forge build` produces output for the declared harnesses

## Why this belongs in context-bazaar

_What makes this artifact broadly useful to the community rather than specific to your setup or workflow? If it's domain-specific, which community would adopt it?_

## Related artifacts or collections

_Are there existing artifacts this enhances, depends on, or overlaps with? Check `forge catalog browse` first._
