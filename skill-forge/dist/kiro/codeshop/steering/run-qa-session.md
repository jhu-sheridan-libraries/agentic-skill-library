<!-- forge:version 0.1.7 -->
# Run QA Session

Interactive QA session where the user reports bugs or issues conversationally, and the agent files GitHub issues. Explores the codebase in the background for context and domain language.

## When to Use

- The user wants to report bugs or do QA
- The user wants to file issues conversationally
- The user mentions "QA session" or wants to walk through problems they have encountered

## Prerequisites

- `gh` CLI installed and authenticated (for filing GitHub issues)
- Optionally, a `UBIQUITOUS_LANGUAGE.md` file for domain language reference

## Shared Concepts

This workflow relies on "durable issues" and "domain language discipline" as defined in the POWER.md Shared Concepts section. Issues describe behaviors (not file paths) so they survive refactors, and all issue text uses the project's domain language from CONTEXT.md or UBIQUITOUS_LANGUAGE.md.

## Adaptation Notes

- **Codebase exploration**: Where the original workflow used a Claude Code sub-agent for background exploration, use Kiro's `invokeSubAgent` with the `context-gatherer` agent, or use direct file exploration tools (`readCode`, `grepSearch`, `listDirectory`).
- **`gh` CLI**: This workflow uses `gh issue create` to file issues. Requires the `gh` CLI installed and authenticated in the user's environment. If `gh` is unavailable, present the issue content for the user to file manually.

## Phases

### Phase 1 — Listen
Let the user describe the problem in their own words. Ask at most 2-3 short clarifying questions focused on expected vs actual behavior, reproduction steps, and consistency. Do not over-interview.
→ Load `run-qa-session-listen.md`

### Phase 2 — Explore
While talking to the user, explore the relevant codebase area in the background. The goal is NOT to find a fix — it is to learn the domain language, understand what the feature is supposed to do, and identify the user-facing behavior boundary.
→ Load `run-qa-session-explore.md`

### Phase 3 — Scope
Assess whether this is a single issue or needs to be broken down into multiple issues. Break down when the fix spans multiple independent areas or has clearly separable concerns.
→ Load `run-qa-session-scope.md`

### Phase 4 — File Issue
Create issues with `gh issue create`. Do NOT ask the user to review first — just file and share URLs. Use the appropriate template (single issue or breakdown).
→ Load `run-qa-session-file-issue.md`

### Phase 5 — Continue
Keep going until the user says they are done. Each issue is independent — do not batch them. After filing, print all issue URLs and ask: "Next issue, or are we done?"
→ Load `run-qa-session-continue.md`

## Issue Rules

- No file paths or line numbers — these go stale
- Use the project's domain language (check UBIQUITOUS_LANGUAGE.md if it exists)
- Describe behaviors, not code — "the sync service fails to apply the patch" not "applyPatch() throws on line 42"
- Reproduction steps are mandatory — if you cannot determine them, ask the user
- Keep it concise — a developer should be able to read the issue in 30 seconds