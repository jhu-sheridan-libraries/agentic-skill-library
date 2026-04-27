<!-- forge:version 0.1.7 -->
# Gather Context

## Entry Criteria
- The user has a plan, spec, PRD, or GitHub issue to break down into implementation issues
- `gh` CLI is installed and authenticated (if GitHub issues need to be fetched)

## Steps
1. Work from whatever is already in the conversation context — a plan, spec, PRD, or discussion.
2. If the user passes a GitHub issue number or URL as an argument, fetch it with `gh issue view <number>` (include `--comments` to get the full discussion).
3. Identify the scope of work: what needs to be built, what are the acceptance criteria, what are the constraints?
4. Note any existing decisions, architectural choices, or dependencies mentioned in the source material.
5. If the source material references other issues or documents, fetch those as well to build a complete picture.

## Exit Criteria
- The full context of the plan is understood
- Source material has been gathered (conversation context, GitHub issues, specs)
- The scope of work is clear enough to begin breaking it down

## Next Phase
→ Load `compose-issues-explore.md`