<!-- forge:version 0.1.6 -->
# Plan Refactor

Create a detailed refactor plan with tiny commits via user interview, then file it as a GitHub issue.

## When to Use

- The user wants to plan a refactor
- The user wants to create a refactoring RFC
- The user wants to break a refactor into safe incremental steps

## Prerequisites

- A clear idea of the problem area to refactor
- `gh` CLI installed and authenticated (for filing the refactor plan as a GitHub issue)

## Adaptation Notes

- **`gh` CLI**: This workflow uses `gh issue create` to file the refactor plan as a GitHub issue. Requires the `gh` CLI installed and authenticated in the user's environment. If `gh` is unavailable, present the plan content for the user to file manually.

## Phases

### Phase 1 — Capture
Ask the user for a long, detailed description of the problem they want to solve and any potential ideas for solutions.
→ Load `plan-refactor-capture.md`

### Phase 2 — Explore
Explore the repo to verify the user's assertions and understand the current state of the codebase.
→ Load `plan-refactor-explore.md`

### Phase 3 — Interview
Ask whether the user has considered other options. Present alternatives. Interview the user about the implementation in extreme detail.
→ Load `plan-refactor-interview.md`

### Phase 4 — Scope
Hammer out the exact scope of the implementation. Work out what you plan to change and what you plan not to change.
→ Load `plan-refactor-scope.md`

### Phase 5 — Test Coverage
Check the codebase for test coverage of the affected area. If coverage is insufficient, ask the user about their testing plans.
→ Load `plan-refactor-test-coverage.md`

### Phase 6 — Commit Plan
Break the implementation into a plan of tiny commits. Each commit should leave the codebase in a working state. Follow Martin Fowler's advice: "make each refactoring step as small as possible, so that you can always see the program working."
→ Load `plan-refactor-commit-plan.md`

### Phase 7 — Create Issue
Create a GitHub issue with the refactor plan using the standard template (Problem Statement, Solution, Commits, Decision Document, Testing Decisions, Out of Scope, Further Notes).
→ Load `plan-refactor-create-issue.md`