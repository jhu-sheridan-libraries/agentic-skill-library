A harness is a living system. Keep it evolving from real feedback.

## 7-1. Collect Feedback

After every run, offer the user a chance to react ("anything to improve?",
"want to change the team or workflow?"). Don't force it; always provide it.

## 7-2. Route Feedback

| Feedback type | Fix target | Example |
|---------------|-----------|---------|
| Output quality | the relevant skill | "analysis too shallow" → add depth criteria |
| Agent role | the agent definition | "need security review" → add an agent |
| Workflow order | the orchestrator | "validate earlier" → reorder phases |
| Team composition | orchestrator + agents | "merge these two" → combine agents |
| Missing trigger | the skill description | "this phrasing didn't fire" → extend description |

## 7-3. Change History

Record every change in the always-loaded pointer's change-history table:

```markdown
| Date | Change | Target | Reason |
|------|--------|--------|--------|
| 2026-04-05 | Initial build | all | - |
| 2026-04-07 | Added QA agent | agents/qa | output-quality feedback |
```

This tracks the harness's direction and guards against regression.

## 7-4. Proactive Evolution Triggers

Propose evolution even without an explicit request when:

- The same kind of feedback repeats twice or more.
- An agent fails in a repeating pattern.
- The user keeps bypassing the orchestrator to work by hand.
