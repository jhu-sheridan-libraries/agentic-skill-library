<!-- forge:version 0.1.6 -->
# Compose Issues

Break a plan, spec, or PRD into independently-grabbable GitHub issues using tracer-bullet vertical slices.

## When to Use

- The user wants to convert a plan into GitHub issues
- The user wants to create implementation tickets from a PRD or spec
- The user wants to break down work into parallelizable issues

## Prerequisites

- A plan, spec, PRD, or GitHub issue to break down
- `gh` CLI installed and authenticated (for creating GitHub issues)

## Shared Concepts

This workflow relies on "vertical slices" and "durable issues" as defined in the POWER.md Shared Concepts section. Each issue is a thin end-to-end slice through all layers, and issue bodies describe behaviors rather than file paths so they survive refactors.

## Adaptation Notes

- **`gh` CLI**: This workflow uses `gh issue create` and `gh issue view` to create and read GitHub issues. Requires the `gh` CLI installed and authenticated in the user's environment. If `gh` is unavailable, present the issue content for the user to file manually.
- **Codebase exploration**: Where the original workflow used a Claude Code sub-agent for exploration, use Kiro's `invokeSubAgent` with the `context-gatherer` agent, or use direct file exploration tools (`readCode`, `grepSearch`, `listDirectory`).

## Phases

### Phase 1 — Gather Context
Work from whatever is already in the conversation context. If the user passes a GitHub issue number or URL, fetch it with `gh issue view`.
→ Load `compose-issues-gather-context.md`

### Phase 2 — Explore
If the codebase has not already been explored, explore it to understand the current state of the code and identify integration layers.
→ Load `compose-issues-explore.md`

### Phase 3 — Draft Slices
Break the plan into tracer-bullet issues. Each issue is a thin vertical slice cutting through ALL integration layers end-to-end. Classify each as HITL (requires human interaction) or AFK (can be merged without human interaction).
→ Load `compose-issues-draft-slices.md`

### Phase 4 — Quiz User
Present the proposed breakdown as a numbered list. Ask about granularity, dependency relationships, and HITL/AFK classification. Iterate until the user approves.
→ Load `compose-issues-quiz-user.md`

### Phase 5 — Create Issues
For each approved slice, create a GitHub issue using `gh issue create`. Create issues in dependency order so blockers can be referenced by real issue numbers.
→ Load `compose-issues-create-issues.md`

## Vertical Slice Rules

- Each slice delivers a narrow but COMPLETE path through every layer (schema, API, UI, tests)
- A completed slice is demoable or verifiable on its own
- Prefer many thin slices over few thick ones
- Maximize parallelism — multiple people or agents can grab different issues simultaneously