<!-- forge:version 0.1.7 -->
# Commit Plan

## Entry Criteria
- The scope is agreed upon
- Test coverage has been assessed
- Implementation decisions are documented

## Steps
1. Break the implementation into a plan of tiny commits.
2. Follow Martin Fowler's advice: "make each refactoring step as small as possible, so that you can always see the program working."
3. Each commit must leave the codebase in a working state — all tests pass, no broken imports, no half-finished migrations.
4. Order commits to minimize risk:
   - Start with preparatory refactors (extract, rename, move) that do not change behavior
   - Then introduce new abstractions or interfaces
   - Then migrate callers incrementally
   - Then remove old code
5. For each commit, describe:
   - What changes in this commit
   - Why this order (what depends on what)
   - What should still work after this commit
6. Identify any commits that are higher risk and flag them.
7. Present the full commit plan to the user for review.

## Exit Criteria
- The implementation is broken into tiny, ordered commits
- Each commit leaves the codebase in a working state
- The commit order respects dependencies
- The user has reviewed and approved the commit plan

## Next Phase
→ Load `plan-refactor-create-issue.md`