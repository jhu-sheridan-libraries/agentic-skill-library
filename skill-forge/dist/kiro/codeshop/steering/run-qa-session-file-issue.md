<!-- forge:version 0.1.7 -->
# File Issue

## Entry Criteria
- The scope is determined (single issue or breakdown)
- Domain language for the area is understood
- `gh` CLI is installed and authenticated

## Steps
1. Create issues with `gh issue create`. Do NOT ask the user to review first — just file and share URLs.
2. If `gh` is unavailable, present the issue content for the user to file manually.

### For a single issue, use this template:

```markdown
## What happened

[Describe the actual behavior the user experienced, in plain language]

## What I expected

[Describe the expected behavior]

## Steps to reproduce

1. [Concrete, numbered steps a developer can follow]
2. [Use domain terms from the codebase, not internal module names]
3. [Include relevant inputs, flags, or configuration]

## Additional context

[Any extra observations from the user or from codebase exploration that help frame the issue — use domain language but do not cite files]
```

### For a breakdown (multiple issues):

Create issues in dependency order (blockers first) so you can reference real issue numbers.

```markdown
## Parent issue

#<parent-issue-number> (if you created a tracking issue) or "Reported during QA session"

## What's wrong

[Describe this specific behavior problem — just this slice, not the whole report]

## What I expected

[Expected behavior for this specific slice]

## Steps to reproduce

1. [Steps specific to THIS issue]

## Blocked by

- #<issue-number> (if this issue cannot be fixed until another is resolved)

Or "None — can start immediately" if no blockers.

## Additional context

[Any extra observations relevant to this slice]
```

3. Follow these rules for all issue bodies (see POWER.md Shared Concepts on "durable issues"):
   - No file paths or line numbers — these go stale
   - Use the project's domain language (check `UBIQUITOUS_LANGUAGE.md` if it exists)
   - Describe behaviors, not code
   - Reproduction steps are mandatory — if you cannot determine them, ask the user
   - Keep it concise — a developer should be able to read the issue in 30 seconds
4. When creating a breakdown:
   - Prefer many thin issues over few thick ones
   - Mark blocking relationships honestly
   - Create issues in dependency order so you can reference real issue numbers
   - Maximize parallelism

## Exit Criteria
- All issues have been filed via `gh issue create`
- Issue URLs have been shared with the user
- Issues use durable language (behaviors, not file paths)
- Blocking relationships are documented (if breakdown)

## Next Phase
→ Load `run-qa-session-continue.md`