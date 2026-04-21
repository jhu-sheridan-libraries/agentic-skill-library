<!-- forge:version 0.1.0 -->
---
name: karpathy-mode
displayName: Karpathy Mode
description: Behavioral guidelines to reduce common LLM coding mistakes. Use when writing, reviewing, or refactoring code to avoid overcomplication, make surgical changes, surface assumptions, and define verifiable success criteria.
keywords: ["karpathy","coding-guidelines","simplicity","surgical-changes","goal-driven","llm-behavior","best-practices"]
author: Andrej Karpathy (packaged by Forrest Chang)
---

# Karpathy Mode

Behavioral guidelines to reduce common LLM coding mistakes, derived from [Andrej Karpathy's observations](https://x.com/karpathy/status/2015883857489522876) on LLM coding pitfalls.

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

# Examples

Real-world code examples demonstrating the four principles. Each example shows what LLMs commonly do wrong and how to fix it.

---

## 1. Think Before Coding

### Hidden Assumptions

**User Request:** "Add a feature to export user data"

**What LLMs do wrong:** Silently assume export format, scope (all users?), file location, which fields to include, and delivery mechanism — then build 50 lines of code around those guesses.

**What should happen:** Surface the assumptions before writing code:
- Scope: all users or filtered? (privacy implications)
- Format: browser download, background job, or API endpoint?
- Fields: which user fields? (some may be sensitive)
- Volume: how many users? (affects approach)

Then propose the simplest viable approach and ask for confirmation.

### Multiple Interpretations

**User Request:** "Make the search faster"

**What LLMs do wrong:** Pick one interpretation silently and implement caching + async + indexes all at once.

**What should happen:** Present the interpretations with effort estimates:
1. Faster response time (indexes, caching) — ~2 hours
2. Higher throughput (async, connection pooling) — ~4 hours
3. Faster perceived speed (progressive loading) — ~3 hours

Then ask which aspect matters most.

---

## 2. Simplicity First

### Over-abstraction

**User Request:** "Add a function to calculate discount"

**What LLMs do wrong:** Build a `DiscountStrategy` ABC, `PercentageDiscount`, `FixedDiscount`, `DiscountConfig` dataclass, and `DiscountCalculator` class — 60+ lines requiring 30 lines of setup.

**What should happen:**
```python
def calculate_discount(amount: float, percent: float) -> float:
    """Calculate discount amount. percent should be 0-100."""
    return amount * (percent / 100)
```

Add complexity only when you actually need multiple discount types. If that requirement comes later, refactor then.

### Speculative Features

**User Request:** "Save user preferences to database"

**What LLMs do wrong:** Build a `PreferenceManager` with caching, validation, merging, and notification features nobody asked for.

**What should happen:**
```python
def save_preferences(db, user_id: int, preferences: dict):
    """Save user preferences to database."""
    db.execute(
        "UPDATE users SET preferences = ? WHERE id = ?",
        (json.dumps(preferences), user_id)
    )
```

Add caching when performance matters, validation when bad data appears, merging when the requirement emerges.

---

## 3. Surgical Changes

### Drive-by Refactoring

**User Request:** "Fix the bug where empty emails crash the validator"

**What LLMs do wrong:** While fixing the email bug, also "improve" email validation regex, add username length/format validation, change comments, and add a docstring.

**What should happen:** Only change the specific lines that fix empty email handling. Every changed line should trace directly to the user's request.

### Style Drift

**User Request:** "Add logging to the upload function"

**What LLMs do wrong:** While adding logging, also change quote style (`''` to `""`), add type hints, add a docstring, reformat whitespace, and restructure boolean return logic.

**What should happen:** Add only the logging lines. Match existing style — single quotes, no type hints, same boolean pattern, same spacing.

---

## 4. Goal-Driven Execution

### Vague vs. Verifiable

**User Request:** "Fix the authentication system"

**What LLMs do wrong:** "I'll review the code, identify issues, make improvements, and test." Then proceed without clear success criteria.

**What should happen:** Define verifiable steps:
1. Write test: change password → verify old session invalidated → test fails (reproduces bug)
2. Implement: invalidate sessions on password change → test passes
3. Edge cases: multiple sessions, concurrent changes → additional tests pass
4. Regression: existing auth tests still pass → full suite green

### Test-First Verification

**User Request:** "The sorting breaks when there are duplicate scores"

**What LLMs do wrong:** Immediately change sort logic without confirming the bug exists.

**What should happen:**
1. Write a test that reproduces the issue (run 10 times, observe inconsistent ordering)
2. Fix with stable sort (tiebreak on secondary field)
3. Verify test passes consistently
