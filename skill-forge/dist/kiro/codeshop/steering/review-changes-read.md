<!-- forge:version 0.1.6 -->
# Read

## Entry Criteria
- The PR description has been read and intent is understood
- The full diff has been skimmed for scope

## Steps

1. Read changed tests first — they explain expected behavior better than the implementation. For each test change:
   - What behavior is being added, changed, or removed?
   - Do the test names clearly describe the expected behavior?
   - Are edge cases covered?
   - Do the tests actually test what they claim to test?

2. Read the implementation — now verify it matches the tests and the description:
   - Does the code do what the tests expect?
   - Does the code do what the PR description says?
   - Are there behaviors in the code that are not covered by tests?
   - Are there any side effects that the tests do not exercise?

3. Look for specific issues:

   **Must address** (blocks merge):
   - Logic errors, off-by-ones, race conditions
   - Security issues: injection, auth bypasses, exposed secrets
   - Breaking changes without a migration path
   - Missing error handling at system boundaries

   **Should address** (request but don't block):
   - Missing tests for non-trivial logic
   - Inconsistencies with existing patterns in the codebase
   - Performance regressions visible from the code

   **Nit** (style preferences):
   - Style preferences not covered by the linter
   - Alternative approaches worth considering in future

4. If you find a contradiction between the tests and the implementation, flag it — one of them is wrong.

## Exit Criteria
- Changed tests have been read and understood
- Implementation has been verified against tests and PR description
- Issues have been identified and mentally classified by severity

## Next Phase
→ Load `review-changes-comment.md`