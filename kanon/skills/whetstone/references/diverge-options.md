# Diverge Options

Generate 3-5 radically different approaches to a problem before converging on a solution. Structured brainstorming that prevents premature commitment to the first idea that seems reasonable.

## When to Use

- Before `draft-prd` — explore the solution space before formalizing
- Before `design-interface` — when you're not sure which direction to take
- When the user says "I'm not sure how to approach this" or "what are my options?"
- When a team is stuck on a single approach and needs fresh perspectives
- At the start of any greenfield feature where multiple valid architectures exist

## Philosophy

The first solution you think of is rarely the best one. It's the most obvious one — shaped by recency bias, familiarity, and whatever you built last. Divergent thinking deliberately generates alternatives before evaluating them, preventing the "hammer looking for nails" trap.

The key discipline: **generate before evaluating**. Do not critique options while generating them. Separate the creative phase from the analytical phase.

## Approach

### Step 1 — Frame the Problem

Before generating options, ensure the problem is well-defined:

1. **What job is being done?** (One sentence: "When [situation], I want to [motivation], so I can [outcome]")
2. **What are the hard constraints?** (Non-negotiable: budget, timeline, compatibility, regulatory)
3. **What are the soft constraints?** (Preferences: team familiarity, existing patterns, performance targets)
4. **What does success look like?** (Observable outcomes, not implementation details)

If the user hasn't articulated these clearly, ask before proceeding. Use the codebase to fill in technical constraints (existing stack, dependencies, patterns in use).

### Step 2 — Generate Options (3-5)

For each option, produce:

- **Name**: A memorable 2-3 word label
- **One-sentence pitch**: What makes this approach distinct
- **Key mechanism**: The core technical idea that differentiates it
- **Strengths**: What this approach does better than alternatives
- **Risks**: What could go wrong or what it sacrifices

**Generation strategies** (use at least 2):

- **Inversion**: What if we did the opposite of the obvious approach?
- **Analogy**: What would [different domain] do? (e.g., "How would a database solve this?" "How would a game engine handle this?")
- **Constraint removal**: What if [hard constraint] didn't exist? Then re-add it.
- **Scale shift**: What if this needed to handle 100x the load? What if it only needed to handle 1 user?
- **Time shift**: What would we build if we had 1 day? 1 year?
- **Existing pattern**: What pattern does the codebase already use for similar problems?

### Step 3 — Compare

Present options in a comparison table:

```
              │ Option A      │ Option B      │ Option C
──────────────┼───────────────┼───────────────┼──────────────
Complexity    │ Low           │ Medium        │ High
Performance   │ Good          │ Best          │ Good
Flexibility   │ Low           │ Medium        │ High
Team fit      │ High          │ Medium        │ Low
Time to build │ 2 days        │ 1 week        │ 2 weeks
Risk          │ Outgrow it    │ Over-engineer │ Never finish
```

### Step 4 — Recommend

After presenting all options:

1. State your recommendation with reasoning
2. Identify which option to prototype first (lowest-risk way to validate the approach)
3. Identify what would make you change your recommendation (what new information would shift the answer)

### Step 5 — Converge

Once the user picks a direction:

1. Confirm the choice
2. Identify the first vertical slice to implement
3. Suggest the next workflow: `draft-prd` (if formalizing), `design-interface` (if designing the API), or `drive-tests` (if jumping straight to implementation)

## Tips

- Do NOT generate 5 variations of the same idea. Each option should be architecturally distinct.
- Include at least one "weird" option — the one that seems impractical but might reveal something useful.
- If the codebase already has a pattern for similar problems, one option should be "follow the existing pattern" (with honest assessment of whether it fits).
- Time-box generation. If you can't find 3 distinct options in 5 minutes of thinking, the problem may be more constrained than it appears — that's useful information.

## Composing with Other Workflows

- `diverge-options` → `stress-test-plan`: Pick the top 2 options and grill each one
- `diverge-options` → `draft-prd`: Formalize the chosen option into a PRD
- `diverge-options` → `design-interface`: Design the API for the chosen approach
- `diverge-options` → `drive-tests`: Skip formalization and start building the chosen slice