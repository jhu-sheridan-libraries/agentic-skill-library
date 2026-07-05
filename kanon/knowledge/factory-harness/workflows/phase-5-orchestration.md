The orchestrator is a special skill that weaves individual agents and skills
into one workflow. Individual skills say "what each agent does"; the
orchestrator says "who collaborates, when, in what order". On an existing
harness, modify the orchestrator rather than creating a new one.

## 5-1. Data-Handoff Protocol

Name how data moves between agents:

| Strategy | Mechanism | Best for |
|----------|-----------|----------|
| Message-based | Native team messaging | Real-time coordination, feedback |
| Task-based | Shared task list | Progress tracking, dependencies |
| File-based | Agreed paths in `_workspace/` | Large/structured artifacts, audit trail |
| Return-value | Worker return message | Sub-agent result collection |

Recommended (team): task-based (coordination) + file-based (artifacts) +
message-based (live comms). Recommended (sub-agent): return-value +
file-based. The native mechanism per harness is in
`reference-harness-realization`.

File-based rules:

- Stage intermediate artifacts under `_workspace/`.
- Name them `{phase}_{role}_{artifact}.{ext}` (e.g. `01_analyst_requirements.md`).
- Emit only final artifacts to the user's path; preserve `_workspace/` for audit and re-runs.

## 5-2. Error Handling

Retry once; on a second failure, proceed without that result and note the gap
in the report. Never delete conflicting data — keep both and cite sources.

## 5-3. Team Size

| Scale | Members | Tasks/member |
|-------|---------|--------------|
| Small (5–10 tasks) | 2–3 | 3–5 |
| Medium (10–20) | 3–5 | 4–6 |
| Large (20+) | 5–7 | 4–5 |

Three focused members beat five scattered ones.

## 5-4. Register the Pointer

Record a minimal pointer in the harness's always-loaded file (`CLAUDE.md`,
`AGENTS.md`, or Kiro steering): goal, trigger rule, and a change-history table.
Do **not** duplicate the agent/skill roster or directory tree there — those
live in the files themselves.

## 5-5. Follow-up Support

1. Put follow-up phrasings in the orchestrator description ("re-run", "update", "improve the previous result").
2. Add a context-check at the start of the workflow: existing `_workspace/` + partial-edit request → partial re-run; existing `_workspace/` + new input → fresh run (move old to `_workspace_prev/`); no `_workspace/` → initial run.
3. Ensure each role definition states its behavior when prior outputs exist.

## Output

- An orchestrator naming execution mode, handoff protocol, error handling, and test scenarios.
