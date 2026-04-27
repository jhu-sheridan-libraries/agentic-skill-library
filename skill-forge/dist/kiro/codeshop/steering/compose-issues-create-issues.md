<!-- forge:version 0.1.7 -->
# Create Issues

## Entry Criteria
- The user has approved the vertical slice breakdown
- `gh` CLI is installed and authenticated
- Dependency order is established

## Steps
1. Create GitHub issues in dependency order (blockers first) so you can reference real issue numbers in the "Blocked by" field.
2. For each approved slice, create a GitHub issue using `gh issue create` with the following body template:

```markdown
## Parent

#<parent-issue-number> (if the source was a GitHub issue; omit this section otherwise)

## What to build

A concise description of this vertical slice. Describe the end-to-end behavior, not layer-by-layer implementation. Use durable language — describe behaviors, not file paths (see POWER.md Shared Concepts on "durable issues").

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Blocked by

- Blocked by #<issue-number> (if any)

Or "None - can start immediately" if no blockers.
```

3. Do NOT close or modify any parent issue.
4. After all issues are created, present a summary showing each issue number, title, and dependency chain.
5. If `gh` is unavailable, present the issue content for the user to file manually.

## Exit Criteria
- All approved slices have been created as GitHub issues
- Issues are created in dependency order with correct blocker references
- Issue bodies use durable language (behaviors, not file paths)
- A summary of all created issues has been presented to the user

## Next Phase
→ Workflow complete. See the Workflow Composition section in POWER.md for natural next steps (e.g., `drive-tests` to implement each slice using TDD).