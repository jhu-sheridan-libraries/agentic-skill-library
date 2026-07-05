Decision guidance for execution mode, the six team patterns, agent separation,
and reuse.

## Execution Mode Comparison

| | Agent team | Sub-agent | Hybrid |
|---|-----------|-----------|--------|
| Coordination | self-organizing, live | none (result only) | per phase |
| Best for | discovery sharing, conflict debate, gap-filling | bounded parallel work | mixed-character phases |
| Cost | comms overhead | no shared context | both, managed per phase |

Default to a team for 2+ collaborating agents. Drop to sub-agents only when
comms add nothing. Go hybrid when phases genuinely differ.

## The Six Patterns

- **Pipeline** — each phase depends on the previous artifact. Sequential orchestrator + `_workspace/` handoffs.
- **Fan-out/Fan-in** — specialists work independently, then a synthesis step merges. Bounded parallel workers + a final synthesizer.
- **Expert Pool** — only the relevant specialists are invoked per request. Routing rules + reusable specialist skills.
- **Producer-Reviewer** — output quality is enforced by a paired reviewer with a bounded revision loop.
- **Supervisor** — one coordinator owns a changing backlog and redistributes work with explicit reassignment rules.
- **Hierarchical Delegation** — a top-level goal splits into sub-goals coordinated one shallow layer down. Keep it shallow.

## Agent Separation Criteria

Split a role out when it scores high on:

- **Specialization** — distinct expertise/instructions.
- **Parallelism** — can run independently of siblings.
- **Context pressure** — its context would crowd out others.
- **Reuse** — useful across multiple workflows.

If none apply strongly, keep it folded into an existing agent.

## Reuse Design

When a candidate overlaps an existing agent/skill:

- **Identical** — reuse as-is.
- **Superset** — generalize the existing one to cover both.
- **Partial overlap** — extract the shared part into a skill both use.
- **Coincidental name clash** — rename for clarity; keep separate.

## QA Methodology

QA's failures are usually at **boundaries**, not within a module. Read both
sides of each interface and compare shapes (request/response vs consumer
expectation; schema vs serializer; config vs reader). Run QA incrementally per
module. Give QA execution capability so it can run validators, not just read.
Typical boundary bugs: field-name drift, optional/required mismatch, null
handling, enum divergence, unit/format mismatch, off-by-one pagination,
timezone/encoding assumptions.
