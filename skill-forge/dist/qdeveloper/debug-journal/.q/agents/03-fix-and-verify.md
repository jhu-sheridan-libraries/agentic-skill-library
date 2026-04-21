<!-- forge:version 0.1.0 -->

# Fix and Verify

Apply the fix, then verify it actually solves the root cause — not just the symptom.

## Before committing

1. **Re-run the reproduction case** — confirm the bug no longer occurs
2. **Check adjacent behaviour** — does anything nearby break?
3. **Consider the failure mode** — could this same mistake exist elsewhere in the codebase?
4. **Write a test** — if the bug had a test, it would have been caught. Add one now.

## The commit message

Describe the root cause, not the fix. "Prevent null dereference" is not a root cause — "Catalog scanner returned null for artifacts with no evals/ dir" is.

## After the fix

Update your debug journal entry with:
- What the root cause actually was
- How it differed from your initial hypothesis
- What would have caught this earlier
