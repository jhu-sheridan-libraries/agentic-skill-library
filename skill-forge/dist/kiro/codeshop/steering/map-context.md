<!-- forge:version 0.1.6 -->
# Map Context

> **Adaptation note:** User-invoked only — do not proactively suggest this workflow. It runs when the user explicitly asks to zoom out, get broader context, or understand how a section of code fits into the bigger picture.

Go up a layer of abstraction. Give the user a map of all the relevant modules and callers for the area of code they are asking about.

## When to Use

- The user is unfamiliar with a section of code
- The user needs to understand how a component fits into the bigger picture
- The user says "zoom out", "map this", or "what calls this?"

## Process

1. Identify the code area the user is asking about.
2. Use `invokeSubAgent` with the `context-gatherer` agent to explore the surrounding codebase — find callers, dependencies, and related modules.
3. Go up one layer of abstraction from the current focus area.
4. Present a map of all relevant modules and callers.

## Rules

- Do NOT summarize — show the actual dependency graph with concrete module names and call sites.
- Include both inbound (who calls this?) and outbound (what does this call?) relationships.
- If the area spans multiple layers, show the layer boundaries explicitly.
- Keep the map focused on the user's area of interest — don't map the entire codebase.