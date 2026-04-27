<!-- forge:version 0.1.6 -->
# Create Issue

## Entry Criteria
- The commit plan is complete and approved by the user
- All decisions are documented
- `gh` CLI is installed and authenticated

## Steps
1. Create a GitHub issue using `gh issue create` with the refactor plan template below.
2. Do NOT ask the user to review before creating — just create it and share the URL.
3. If `gh` is unavailable, present the issue content for the user to file manually.

Use this template for the issue body:

```markdown
## Problem Statement

The problem that the developer is facing, from the developer's perspective.

## Solution

The solution to the problem, from the developer's perspective.

## Commits

A LONG, detailed implementation plan. Write the plan in plain English, breaking down the implementation into the tiniest commits possible. Each commit should leave the codebase in a working state.

## Decision Document

A list of implementation decisions that were made. This can include:
- The modules that will be built/modified
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets. They may end up being outdated very quickly.

## Testing Decisions

A list of testing decisions that were made. Include:
- A description of what makes a good test (only test external behavior, not implementation details)
- Which modules will be tested
- Prior art for the tests (i.e. similar types of tests in the codebase)

## Out of Scope

A description of the things that are out of scope for this refactor.

## Further Notes (optional)

Any further notes about the refactor.
```

4. After creating the issue, print the issue URL and a one-line summary of the refactor plan.

## Exit Criteria
- A GitHub issue has been created with the complete refactor plan
- The issue URL has been shared with the user
- The issue uses durable language (behaviors and contracts, not file paths)

## Next Phase
→ Workflow complete. See the Workflow Composition section in POWER.md for natural next steps (e.g., `compose-issues` to break the plan into implementation issues, or `drive-tests` to begin implementing).