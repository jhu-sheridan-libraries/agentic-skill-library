<!-- forge:version 0.1.6 -->
# Update

## Entry Criteria
- The grilling session is complete
- Terms have been resolved and decisions have been made
- `CONTEXT.md` has been updated inline during the session

## Steps

1. Review all changes made to `CONTEXT.md` during the session:
   - Verify each term has a clear, precise definition
   - Verify no implementation details have leaked into domain definitions
   - Verify consistency — no term contradicts another

2. Review any ADRs created during the session:
   - Verify each ADR meets the three-condition bar (hard to reverse, surprising without context, result of a real trade-off)
   - Verify ADR status is correctly set (proposed, accepted, or superseded)
   - Verify ADRs reference the relevant `CONTEXT.md` terms where applicable

3. If `CONTEXT-MAP.md` exists, verify that any new or changed contexts are reflected in the map.

4. Present a summary to the user:
   - Terms added or updated in `CONTEXT.md`
   - ADRs created or proposed
   - Any open questions that were deferred during the session

5. Ask the user to confirm the updates are accurate and complete.

## Exit Criteria
- `CONTEXT.md` is consistent and free of implementation details
- All ADRs meet the three-condition bar and are correctly formatted
- `CONTEXT-MAP.md` is up to date (if applicable)
- The user has confirmed the updates

## Next Phase
→ Workflow complete. Suggest natural next steps: load `define-glossary` to formalize the glossary, or load `refactor-architecture` to apply the refined language to architecture review.