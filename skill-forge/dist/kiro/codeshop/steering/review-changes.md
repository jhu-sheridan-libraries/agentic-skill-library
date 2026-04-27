<!-- forge:version 0.1.6 -->
# Review Changes

Code review as a craft — read with intent, comment with purpose, approve with confidence. Use when reviewing pull requests, merge requests, or any code changes. The goal is a better codebase, not a lower diff count.

## When to Use

- The user wants to review a pull request or diff
- The user mentions "review this," "code review," or "check this diff"
- The user asks for feedback on changes before merging

## Prerequisites

- A diff, pull request, or set of changes to review
- Optional: `gh` CLI installed and authenticated for PR-based workflows

## Core Principle

Code review is a collaboration, not an audit. Before leaving any comment, ask: does this improve the code, or does it reflect a personal preference? Both are valid — but label them differently.

## Phases

### Phase 1 — Orient
Read the PR description and skim the full diff to understand scope and intent before reviewing any individual file.
→ Load `review-changes-orient.md`

### Phase 2 — Read
Read changed tests first (they explain expected behavior), then read the implementation to verify it matches the tests and description.
→ Load `review-changes-read.md`

### Phase 3 — Comment
Classify each finding using the comment taxonomy. Leave specific, actionable comments with proposed alternatives.
→ Load `review-changes-comment.md`

### Phase 4 — Decide
Approve only when you could explain the code to a colleague, or request changes with specific actionable comments.
→ Load `review-changes-decide.md`

---

## Reference: Reading Order

1. **Read the PR description first** — understand intent before reading code. If there's no description, ask for one before reviewing.
2. **Skim the full diff** — orient yourself to the scope before diving into any file.
3. **Read changed tests first** — they often explain expected behaviour better than the implementation.
4. **Read the implementation** — now verify it matches the tests and the description.

---

## Reference: Comment Taxonomy

### Must Address (blocks merge)
- Logic errors, off-by-ones, race conditions
- Security issues: injection, auth bypasses, exposed secrets
- Breaking changes without a migration path
- Missing error handling at system boundaries

### Should Address (request but don't block)
- Missing tests for non-trivial logic
- Inconsistencies with existing patterns in the codebase
- Performance regressions visible from the code

### Nit (style preferences)
- Style preferences that aren't covered by the linter
- Alternative approaches that may be worth considering in future

### Leaving Good Comments

- Be specific — "this could throw" is less useful than "this throws if `user` is null, which happens when the session expires"
- Suggest, don't just criticise — include a proposed alternative when it's obvious
- Ask questions when unsure — "is this intentional?" opens dialogue better than an assertion
- Acknowledge good work — a review that only flags problems creates a negative feedback loop

### Examples

**Good comment:**
> `processOrder` throws if `user` is null, which happens when the session expires mid-checkout. Consider adding a null check with a redirect to login.

**Bad comment:**
> This could throw.

**Good nit:**
> nit: I'd name this `fetchActiveUsers` rather than `getUsers` — but not blocking.

---

## Reference: Approval Criteria

Only approve when you would be comfortable explaining this code to a colleague yourself. Rubber-stamp approvals devalue the review process for everyone.

### Best Practices

- Separate "must fix" from "nit" — label your comments so the author knows what blocks merge
- Review in one sitting when possible — context-switching mid-review leads to missed connections
- Time-box large PRs — if a PR is too big to review in 30 minutes, ask the author to split it
- Review your own PR first — catch the obvious issues before asking someone else to

### When to Request Changes

Request changes when any "must address" item exists. Be specific about what needs to change and why. Include a proposed alternative when the fix isn't obvious.

### When to Approve

Approve when:
- No "must address" items remain
- You understand the intent and the implementation matches it
- You could explain this code to a colleague
- Any "should address" items are acknowledged (fixed or explicitly deferred)