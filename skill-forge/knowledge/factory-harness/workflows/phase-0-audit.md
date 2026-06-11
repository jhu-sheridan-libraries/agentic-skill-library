When the harness skill triggers, audit the current state **before** generating anything.

## Steps

1. Read the harness's native locations for the running harness:
   - Claude Code — `.claude/agents/`, `.claude/skills/`, `CLAUDE.md`
   - Codex — `.codex/skills/` (and `.agents/skills/`), `AGENTS.md`, `.codex/config.toml`
   - Kiro — `.kiro/steering/`, any installed power, `.kiro/specs/`, `.kiro/hooks`
2. Branch into an execution mode:
   - **New build** — no agents/skills present → run Phases 1–7 fully.
   - **Extend** — a harness exists and new agents/skills are requested → run only the phases the change needs (matrix below).
   - **Maintain** — audit, fix, or sync an existing harness → go to the Maintenance Workflow.
3. Compare the actual agent/skill files against what the orchestrator and the always-loaded pointer claim. Flag any **drift**.
4. Summarize the audit for the user and confirm the execution plan before proceeding.

## Phase Selection Matrix (Extend)

| Change | P1 | P2 | P3 | P4 | P5 | P6 |
|--------|----|----|----|----|----|----|
| Add agent | skip | placement only | required (incl. dedup) | only if a new skill is needed | update orchestrator | required |
| Add/modify skill | skip | skip | skip | required (incl. dedup) | only if wiring changes | required |
| Architecture change | skip | required | affected agents only | affected skills only | required | required |

## Maintenance Workflow

1. **Audit** — diff the agent/skill files against the orchestrator's roster; produce a drift list; report it.
2. **Incremental change** — apply one add/modify/remove at a time; after each, immediately sync.
3. **Record** — append to the change-history table (date, change, target, reason).
4. **Verify** — structure-check the touched artifacts; trigger-check if triggers changed; for large changes (architecture, 3+ agents) also run execution and dry-run tests; confirm the pointer file matches reality.
