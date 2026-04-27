<!-- forge:version 0.1.6 -->
# Create Issue

## Entry Criteria
- The TDD fix plan is complete
- Root cause analysis is documented
- `gh` CLI is installed and authenticated

## Steps
1. Create a GitHub issue using `gh issue create` with the template below.
2. Do NOT ask the user to review before creating — just create it and share the URL.
3. If `gh` is unavailable, present the issue content for the user to file manually.

Use this template for the issue body:

```markdown
## Problem

A clear description of the bug or issue, including:
- What happens (actual behavior)
- What should happen (expected behavior)
- How to reproduce (if applicable)

## Root Cause Analysis

Describe what was found during investigation:
- The code path involved
- Why the current code fails
- Any contributing factors

Do NOT include specific file paths, line numbers, or implementation details that couple to current code layout. Describe modules, behaviors, and contracts instead. The issue should remain useful even after major refactors.

## TDD Fix Plan

A numbered list of RED-GREEN cycles:

1. **RED**: Write a test that [describes expected behavior]
   **GREEN**: [Minimal change to make it pass]

2. **RED**: Write a test that [describes next behavior]
   **GREEN**: [Minimal change to make it pass]

**REFACTOR**: [Any cleanup needed after all tests pass]

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] All new tests pass
- [ ] Existing tests still pass
```

4. After creating the issue, print the issue URL and a one-line summary of the root cause.

## Exit Criteria
- A GitHub issue has been created with the complete triage report
- The issue URL has been shared with the user
- The issue uses durable language (behaviors and contracts, not file paths)

## Next Phase
→ Workflow complete. See the Workflow Composition section in POWER.md for natural next steps (e.g., `drive-tests` to implement the fix using the TDD plan).