<!-- forge:version 0.1.6 -->
# Draft Slices

## Entry Criteria
- The context has been gathered and the codebase explored
- Integration layers and dependencies are understood

## Steps
1. Break the plan into **tracer-bullet** issues. Each issue is a thin vertical slice that cuts through ALL integration layers end-to-end — NOT a horizontal slice of one layer.
2. Apply the vertical slice rules:
   - Each slice delivers a narrow but COMPLETE path through every layer (schema, API, UI, tests)
   - A completed slice is demoable or verifiable on its own
   - Prefer many thin slices over few thick ones
3. Classify each slice as one of:
   - **HITL** (Human-In-The-Loop): requires human interaction, such as an architectural decision, design review, or user feedback
   - **AFK** (Away From Keyboard): can be implemented and merged without human interaction
4. Prefer AFK over HITL where possible — maximize the work that can proceed autonomously.
5. Identify dependency relationships between slices: which slices must complete before others can start?
6. Order slices so that blockers come first and parallelism is maximized.

## Exit Criteria
- The plan is broken into vertical slices
- Each slice is classified as HITL or AFK
- Dependency relationships between slices are identified
- The breakdown is ready to present to the user for review

## Next Phase
→ Load `compose-issues-quiz-user.md`