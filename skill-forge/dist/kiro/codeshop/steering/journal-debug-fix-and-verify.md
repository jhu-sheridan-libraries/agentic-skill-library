<!-- forge:version 0.1.6 -->
# Fix and Verify

## Entry Criteria
- The bug is isolated to a specific layer and code path
- A concrete hypothesis about root cause exists
- A minimal reproduction case is available

## Steps

1. Apply the fix, then verify it solves the root cause — not just the symptom:

   - **Re-run the reproduction case** — confirm the bug no longer occurs
   - **Check adjacent behavior** — does anything nearby break? Run the full test suite, not just the failing test.
   - **Check for the same mistake elsewhere** — could this same bug exist in other parts of the codebase? Search for similar patterns.
   - **Write a regression test** — if the bug had a test, it would have been caught. Add one now. The test should fail without the fix and pass with it.

2. Write a commit message that describes the root cause, not the fix. _"Prevent null dereference"_ is not a root cause — _"Catalog scanner returned null for artifacts with no evals/ dir"_ is.

3. Update the debug journal entry with:
   - What the root cause actually was
   - How it differed from your initial hypothesis
   - What would have caught this earlier (missing test, missing validation, unclear contract)

## Exit Criteria
- The reproduction case passes with the fix applied
- Adjacent behavior is verified (full test suite passes)
- A regression test exists that fails without the fix
- The commit message describes the root cause
- The debug journal entry is updated with lessons learned

## Next Phase
→ Workflow complete. Suggest natural next steps: load `drive-tests` if additional test coverage is needed, or load `review-changes` to review the fix before merging.