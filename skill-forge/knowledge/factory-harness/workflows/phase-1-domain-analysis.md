Understand the domain before designing the team.

## Steps

1. Identify the domain/project from the request and the repository.
2. Enumerate the core task types (generate, validate, edit, analyze, research, review).
3. Using the Phase 0 audit, note conflicts and overlaps with existing agents/skills.
4. Explore the codebase if one exists — tech stack, data models, key modules, existing docs.
5. Capture the expected final deliverables, constraints, quality bar, and failure tolerance.
6. **Detect user proficiency** from conversational cues and tune your tone. Do not use unexplained jargon (`assertion`, `JSON schema`) with a less technical user.
7. If the request is an iterative-experiment workflow, define the mutable surface, the immutable evaluation surface, the baseline requirement, and the metric before generating anything.

## Output

- A concise domain summary.
- A task inventory.
- Reuse notes for any existing material worth preserving.

Hold these in `_workspace/01_analysis_domain.md` (or the harness equivalent) so later phases and re-runs can read them.
