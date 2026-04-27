<!-- forge:version 0.1.6 -->
# Explore

## Entry Criteria
- The user has provided a detailed problem description
- The problem area in the codebase is identified

## Steps
1. Explore the codebase to verify the user's assertions about the current state.
2. Use Kiro's `invokeSubAgent` with the `context-gatherer` agent for broad exploration, or use direct file exploration tools (`readCode`, `grepSearch`, `listDirectory`) for targeted investigation.
3. Identify the modules, interfaces, and dependencies involved in the problem area.
4. Check whether the user's description matches reality — note any discrepancies.
5. Look for existing patterns, conventions, and architectural decisions that constrain the refactor.
6. Note any surprises or complications the user may not be aware of.

## Exit Criteria
- The current state of the affected codebase area is understood
- The user's assertions have been verified or corrected
- Modules, interfaces, and dependencies are mapped
- Ready to discuss alternatives with the user

## Next Phase
→ Load `plan-refactor-interview.md`