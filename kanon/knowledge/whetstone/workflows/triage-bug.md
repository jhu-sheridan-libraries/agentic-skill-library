# Triage Bug

Investigate a reported problem, find its root cause, and create a GitHub issue with a TDD fix plan. This is a mostly hands-off workflow — minimize questions to the user.

## Mandatory First Response

When a user reports a bug, your **first response MUST capture symptoms** before diagnosing. Even if the user provides partial information, you must explicitly gather:

1. **What was expected** — the correct behavior
2. **What actually happened** — the observed failure (error messages, status codes, visual symptoms)
3. **Reproduction steps** — how to trigger the bug reliably

If the user has not provided all three, ask for the missing ones. Do NOT skip to diagnosis, do NOT propose fixes, do NOT explore code until symptoms are captured.

## When to Use

- The user reports a bug or unexpected behavior
- The user wants to file an issue with a fix plan
- The user mentions "triage" or wants to investigate a problem
- A bug needs root cause analysis before fixing

## Prerequisites

- A description of the problem (or the user can provide one when prompted)
- `gh` CLI installed and authenticated (for creating the GitHub issue)

## Shared Concepts

This workflow relies on "vertical slices" and "durable issues" as defined in the POWER.md Shared Concepts section. The TDD fix plan uses vertical slices (one RED-GREEN cycle per slice), and the filed issue describes behaviors rather than file paths so it survives refactors.

## Adaptation Notes

- **Codebase exploration**: Where the original workflow used a Claude Code sub-agent for exploration, use Kiro's `invokeSubAgent` with the `context-gatherer` agent, or use direct file exploration tools (`readCode`, `grepSearch`, `listDirectory`).
- **`gh` CLI**: This workflow uses `gh issue create` to file the issue. Requires the `gh` CLI installed and authenticated in the user's environment. If `gh` is unavailable, present the issue content for the user to file manually.

## Phases

### Phase 1 — Capture
Get a brief description of the issue from the user. If they have not provided one, ask ONE question: "What's the problem you're seeing?" Do not ask follow-up questions yet — start investigating immediately.
→ Load `triage-bug-capture.md`

### Phase 2 — Diagnose
Deeply investigate the codebase to find where the bug manifests, what code path is involved, why it fails (root cause, not symptom), and what related code exists.
→ Load `triage-bug-diagnose.md`

### Phase 3 — Fix Approach
Determine the minimal change needed to fix the root cause, which modules/interfaces are affected, what behaviors need verification via tests, and whether this is a regression, missing feature, or design flaw.
→ Load `triage-bug-fix-approach.md`

### Phase 4 — TDD Plan
Create a concrete, ordered list of RED-GREEN cycles. Each cycle is one vertical slice: RED describes a test capturing broken/missing behavior, GREEN describes the minimal code change to pass.
→ Load `triage-bug-tdd-plan.md`

### Phase 5 — Create Issue
Create a GitHub issue with the standard template (Problem, Root Cause Analysis, TDD Fix Plan, Acceptance Criteria). Do NOT ask the user to review before creating — just create it and share the URL.
→ Load `triage-bug-create-issue.md`

## Durability Rules

These are **hard constraints** on all output from this workflow:

- **NEVER reference file paths or line numbers in issues.** Translate implementation details into behavioral descriptions. If the root cause is "race condition in src/checkout.ts line 42," the issue says "double charges during checkout when concurrent requests hit the payment handler." The file path goes stale; the behavior description survives refactors.
- Only suggest fixes that would survive radical codebase changes
- Describe behaviors and contracts, not internal structure
- Tests assert on observable outcomes (API responses, UI state, user-visible effects), not internal state
- A good issue reads like a spec; a bad one reads like a diff

## TDD Fix Approach

When planning a fix, **always start with a failing test**. The approach is:
1. Write a test that reproduces the bug (RED) — this test fails now and will pass after the fix
2. Write the minimal code change to make the test pass (GREEN)
3. Refactor if needed

Do NOT jump to implementation code before writing the test. The test comes first — always.
