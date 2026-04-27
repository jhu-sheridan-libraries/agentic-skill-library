---
name: karpathy-mode
displayName: Karpathy Mode
description: Behavioral guidelines to reduce common LLM coding mistakes. Use when writing, reviewing, or refactoring code to avoid overcomplication, make surgical changes, surface assumptions, and define verifiable success criteria.
keywords:
  - karpathy
  - coding-guidelines
  - simplicity
  - surgical-changes
  - goal-driven
  - llm-behavior
  - best-practices
author: Andrej Karpathy (packaged by Forrest Chang)
version: 0.2.0
harnesses:
  - kiro
  - claude-code
  - copilot
  - cursor
  - windsurf
  - cline
  - qdeveloper
type: skill
inclusion: always
categories:
  - code-style
ecosystem: []
depends: []
enhances: []
maturity: experimental
model-assumptions: []
collections: [jhu, neon-caravan]
inherit-hooks: false
---
# Karpathy Mode

## Overview

Behavioral guidelines to reduce common LLM coding mistakes, derived from [Andrej Karpathy's observations](https://x.com/karpathy/status/2015883857489522876) on LLM coding pitfalls. Use when writing, reviewing, or refactoring code to avoid overcomplication, make surgical changes, surface assumptions, and define verifiable success criteria.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Anti-Patterns Summary

| Principle | Anti-Pattern | Fix |
|-----------|-------------|-----|
| Think Before Coding | Silently assumes file format, fields, scope | List assumptions explicitly, ask for clarification |
| Simplicity First | Strategy pattern for single discount calculation | One function until complexity is actually needed |
| Surgical Changes | Reformats quotes, adds type hints while fixing bug | Only change lines that fix the reported issue |
| Goal-Driven | "I'll review and improve the code" | "Write test for bug X → make it pass → verify no regressions" |

## Key Insight

Good code is code that solves today's problem simply, not tomorrow's problem prematurely. LLMs are exceptionally good at looping until they meet specific goals — don't tell them what to do, give them success criteria and watch them go.

## Examples

**Good goal-driven execution:**
```
Task: "Fix the date parsing bug"
Plan:
1. Write a test that reproduces the bug → verify: test fails
2. Fix the parser to handle the edge case → verify: test passes
3. Run full suite → verify: no regressions
```

**Bad goal-driven execution:**
```
Task: "Fix the date parsing bug"
Action: Rewrite the entire date module with a new API, add timezone support,
        refactor all callers, update documentation
```

## Troubleshooting

**Agent keeps adding unrequested features:** Restate the task with explicit boundaries: "Only change X. Do not modify Y or Z."

**Agent reformats adjacent code:** Remind it of the surgical changes principle: every changed line must trace to the user's request.

**Agent can't define success criteria:** The task is too vague. Break it into smaller, verifiable steps.