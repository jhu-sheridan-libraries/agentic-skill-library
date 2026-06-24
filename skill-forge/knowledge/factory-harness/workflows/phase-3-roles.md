Define each stable role as a file. Never bury a role in an inline prompt — a
role must persist as a file to be reusable next session.

## 3-0. Dedup First

Before creating an agent, check the existing roster (`.claude/agents/`,
`.codex/skills/` role briefs, Kiro steering). Repeated harness builds accumulate
overlapping roles under different names. Reuse or generalize instead of cloning.

## Required Sections

Each role definition includes: core role, working principles, input/output
protocol, error handling, and collaboration. In team mode add a **Team
Communication Protocol** section naming who it sends to/receives from and the
scope of work it may request.

## Re-invocation Behavior

State what the role does when prior outputs already exist: read the previous
result and improve it; if the user gave feedback, change only the affected part.

## Model

Use the strongest reasoning model available — harness quality tracks the
agents' reasoning quality.

## QA Roles

If the harness includes QA:

- Give QA an execution-capable type (it must run validation scripts, not just read).
- QA's value is **cross-boundary comparison** — read both sides of an interface (e.g. API response and the front-end hook) and compare their shapes.
- Run QA **incrementally** after each module, not once at the end.
- See `reference-agent-design-patterns` for the QA methodology and bug patterns.

## Output

- Role inventory, file layout, and a per-role input/output contract.
