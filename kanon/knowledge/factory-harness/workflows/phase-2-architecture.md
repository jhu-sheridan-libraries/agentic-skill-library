Design the team: choose an execution mode, then a pattern.

## 2-1. Execution Mode

Two or more cooperating agents is the trigger to consider a team. Decision order:

1. Can this be an agent team? If 2+ agents collaborate, that is the default.
2. Choose **sub-agent** only when team communication is structurally unnecessary (result-passing only) and the coordination overhead outweighs the benefit.
3. If phases differ in character, go **hybrid** and state each phase's mode in the orchestrator.

How each mode runs is harness-specific — see `reference-harness-realization`.

## 2-2. Pattern Selection

Decompose the work into specialist areas, then pick the smallest pattern that
preserves quality. The six patterns and their decision tradeoffs are in
`reference-agent-design-patterns`:

- Pipeline — sequential dependent work.
- Fan-out/Fan-in — parallel independent work, later synthesis.
- Expert Pool — selective routing to a subset of specialists.
- Producer-Reviewer — generation plus an explicit review step.
- Supervisor — central agent manages a changing backlog.
- Hierarchical Delegation — recursive delegation down one shallow layer.

## 2-3. Agent Separation

Judge along four axes: specialization, parallelism, context pressure, reuse.
Prefer a few focused agents over many thin ones — coordination overhead grows
with team size. Defer dedup against existing agents to Phase 3.

## Output

- Chosen execution mode (and per-phase modes if hybrid).
- Chosen pattern.
- Role list, handoff plan, and artifact-naming convention.
