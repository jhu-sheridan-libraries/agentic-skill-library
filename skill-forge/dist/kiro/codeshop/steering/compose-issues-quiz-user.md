<!-- forge:version 0.1.6 -->
# Quiz User

## Entry Criteria
- Vertical slices have been drafted with HITL/AFK classification
- Dependency relationships between slices are identified

## Steps
1. Present the proposed breakdown as a numbered list. For each slice, show:
   - **Title**: short descriptive name
   - **Type**: HITL / AFK
   - **Blocked by**: which other slices (if any) must complete first
   - **User stories covered**: which user stories this addresses (if the source material has them)
2. Ask the user:
   - Does the granularity feel right? (too coarse / too fine)
   - Are the dependency relationships correct?
   - Should any slices be merged or split further?
   - Are the correct slices marked as HITL and AFK?
3. Iterate on the breakdown based on user feedback. Repeat until the user approves.
4. Do NOT proceed to issue creation until the user explicitly approves the breakdown.

## Exit Criteria
- The user has reviewed the breakdown
- Granularity, dependencies, and HITL/AFK classification are approved
- The breakdown is finalized and ready for issue creation

## Next Phase
→ Load `compose-issues-create-issues.md`