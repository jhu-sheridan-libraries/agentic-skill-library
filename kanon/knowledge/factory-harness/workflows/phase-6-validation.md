Validate the generated harness before declaring it done.

## 6-1. Structure

- Every agent/role file is in the right native location.
- Every skill has valid frontmatter (`name`, `description`).
- Cross-references between agents and skills are consistent.
- No stray command/slash artifacts were created unless intended.

## 6-2. Execution-Mode Checks

- **Team** — verify communication paths, task dependencies, and team-size fit.
- **Sub-agent** — verify each worker's I/O wiring and result collection.
- **Hybrid** — verify each phase's mode is stated and that data crosses phase boundaries intact (a team's output feeds the next sub-agent's input).

## 6-3. Skill Execution Test

For each skill, write 2–3 realistic prompts and run them. Where possible run
with-skill vs without-skill in parallel to confirm the skill adds value.
Evaluate output qualitatively (review) and quantitatively (assertions where
objectively checkable). On problems, **generalize** the fix into the skill and
re-test until stable. Bundle any helper code the tests keep re-creating.

## 6-4. Trigger Validation

- 8–10 should-trigger queries (formal/casual, explicit/implicit).
- 8–10 should-NOT-trigger near-miss queries. A good near-miss has an ambiguous boundary (e.g. "extract the chart from this xlsx as PNG" — spreadsheet skill vs image converter), not an obviously unrelated query.
- Check for trigger collisions with existing skills.

## 6-5. Dry-Run

- The orchestrator's phase order is logical.
- No dead links in the data-handoff path.
- Every agent's input matches the prior phase's output.
- Each error scenario has a runnable fallback.

## 6-6. Test Scenarios

Add a `## Test Scenarios` section to the orchestrator with at least one normal
flow and one error flow.
