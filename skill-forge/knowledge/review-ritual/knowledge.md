---
name: review-ritual
displayName: Review Ritual
description: Code review as a craft — read with intent, comment with purpose, approve with confidence.
keywords: [code-review, quality, collaboration, feedback]
author: skill-forge
version: 0.1.0
type: skill
inclusion: always
categories: [testing]
ecosystem: []
collections: [neon-caravan]
maturity: stable
trust: community
---

Code review is a collaboration, not an audit. The goal is a better codebase, not a lower diff count.

## The reviewer's contract

Before leaving any comment, ask: does this improve the code, or does it reflect a personal preference? Both are valid — but label them differently. "nit:" for style preferences, no prefix for bugs or safety issues.

## Reading order

1. **Read the PR description first** — understand intent before reading code. If there's no description, ask for one before reviewing.
2. **Skim the full diff** — orient yourself to the scope before diving into any file.
3. **Read changed tests first** — they often explain expected behaviour better than the implementation.
4. **Read the implementation** — now verify it matches the tests and the description.

## What to look for

**Must address** (block merge):
- Logic errors, off-by-ones, race conditions
- Security issues: injection, auth bypasses, exposed secrets
- Breaking changes without a migration path
- Missing error handling at system boundaries

**Should address** (request but don't block):
- Missing tests for non-trivial logic
- Inconsistencies with existing patterns in the codebase
- Performance regressions visible from the code

**Optional** (note as nit):
- Style preferences that aren't covered by the linter
- Alternative approaches that may be worth considering in future

## Leaving good comments

- Be specific — "this could throw" is less useful than "this throws if `user` is null, which happens when the session expires"
- Suggest, don't just criticise — include a proposed alternative when it's obvious
- Ask questions when unsure — "is this intentional?" opens dialogue better than an assertion
- Acknowledge good work — a review that only flags problems creates a negative feedback loop

## Approving

Only approve when you would be comfortable explaining this code to a colleague yourself. Rubber-stamp approvals devalue the review process for everyone.
