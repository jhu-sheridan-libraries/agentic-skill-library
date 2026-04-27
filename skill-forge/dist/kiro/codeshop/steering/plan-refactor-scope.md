<!-- forge:version 0.1.6 -->
# Scope

## Entry Criteria
- The interview phase is complete
- Implementation decisions have been made
- Technical details are resolved

## Steps
1. Work with the user to define the exact scope of the refactor.
2. Explicitly list what will change:
   - Which modules will be modified
   - Which interfaces will be updated
   - What new code will be written
3. Explicitly list what will NOT change:
   - Adjacent modules that remain untouched
   - Behaviors that must be preserved
   - APIs or contracts that stay stable
4. Identify boundary conditions — where does this refactor stop?
5. Call out any "slippery slope" areas where scope could creep.
6. Get the user's explicit agreement on the scope boundary.

Ask: "Here's what I think is in scope and out of scope. Does this match your expectations?"

## Exit Criteria
- In-scope changes are explicitly listed
- Out-of-scope items are explicitly listed
- The user has agreed on the scope boundary
- No ambiguity about what this refactor includes

## Next Phase
→ Load `plan-refactor-test-coverage.md`