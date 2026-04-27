<!-- forge:version 0.1.7 -->
# Write PRD

## Entry Criteria
- The codebase has been explored
- Module design has been sketched and confirmed with the user
- The user has confirmed which modules need tests

## Steps
1. Write the PRD using the template below.
2. Ensure user stories are extensive — cover all aspects of the feature, not just the happy path.
3. Implementation decisions describe modules and interfaces, NOT specific file paths or code snippets (these become outdated quickly).
4. Testing decisions focus on external behavior, not implementation details. Include which modules will be tested and prior art for similar tests in the codebase.
5. Submit the PRD as a GitHub issue using `gh issue create`.
   - If `gh` is unavailable, present the PRD content for the user to file manually.

### PRD Template

```markdown
## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A LONG, numbered list of user stories. Each user story should be in the format:

1. As an <actor>, I want a <feature>, so that <benefit>

This list should be extremely extensive and cover all aspects of the feature.

## Implementation Decisions

A list of implementation decisions that were made:
- The modules that will be built/modified
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets.

## Testing Decisions

A list of testing decisions:
- A description of what makes a good test (only test external behavior, not implementation details)
- Which modules will be tested
- Prior art for the tests (similar types of tests in the codebase)

## Out of Scope

A description of the things that are out of scope for this PRD.

## Further Notes

Any further notes about the feature.
```

## Exit Criteria
- The PRD is complete with all template sections filled in
- User stories are extensive and cover all aspects of the feature
- Implementation decisions describe modules and interfaces, not file paths
- The PRD has been submitted as a GitHub issue (or presented for manual filing)

## Next Phase
→ Workflow complete. See the Workflow Composition section in POWER.md for natural next steps (e.g., `compose-issues` to break the PRD into implementation tickets).