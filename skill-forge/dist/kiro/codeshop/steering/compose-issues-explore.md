<!-- forge:version 0.1.6 -->
# Explore

## Entry Criteria
- The context has been gathered from the source material
- The scope of work is understood

## Steps
1. If you have not already explored the codebase, explore it now to understand the current state of the code.
2. Use Kiro's `invokeSubAgent` with the `context-gatherer` agent for broad exploration, or use direct file exploration tools (`readCode`, `grepSearch`, `listDirectory`) for targeted investigation.
3. Identify the integration layers the work will touch: schema, API, business logic, UI, tests.
4. Note existing patterns and conventions that the new issues should follow.
5. Identify any technical constraints or dependencies that will affect how the work is sliced.

This step is optional if the codebase has already been explored during a prior phase (e.g., if coming from `draft-prd`).

## Exit Criteria
- The current state of the codebase is understood
- Integration layers have been identified
- Technical constraints and dependencies are noted
- Ready to draft vertical slices

## Next Phase
→ Load `compose-issues-draft-slices.md`