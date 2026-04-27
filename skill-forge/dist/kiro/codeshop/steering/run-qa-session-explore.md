<!-- forge:version 0.1.6 -->
# Explore

## Entry Criteria
- The user has described the problem
- Enough context exists to identify the relevant codebase area

## Steps
1. Explore the relevant codebase area in the background using Kiro's `invokeSubAgent` with the `context-gatherer` agent, or use direct file exploration tools (`readCode`, `grepSearch`, `listDirectory`) for targeted investigation.
2. The goal is NOT to find a fix. The goal is to:
   - Learn the domain language used in that area (check `UBIQUITOUS_LANGUAGE.md` if it exists)
   - Understand what the feature is supposed to do
   - Identify the user-facing behavior boundary
3. This context helps write a better issue — but the issue itself should NOT reference specific files, line numbers, or internal implementation details.
4. Note the domain terms that should be used when writing the issue.

## Exit Criteria
- The relevant codebase area has been explored
- Domain language for the area is understood
- The feature's intended behavior is clear
- Ready to assess scope

## Next Phase
→ Load `run-qa-session-scope.md`