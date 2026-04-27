<!-- forge:version 0.1.6 -->
# Listen

## Entry Criteria
- The user wants to report bugs, do QA, or file issues conversationally
- A QA session has been initiated

## Steps
1. Let the user describe the problem in their own words. Do not interrupt.
2. Ask at most 2-3 short clarifying questions, focused on:
   - What they expected vs what actually happened
   - Steps to reproduce (if not obvious from the description)
   - Whether the problem is consistent or intermittent
3. Do NOT over-interview. If the description is clear enough to file an issue, move on.
4. Capture the key details:
   - Actual behavior observed
   - Expected behavior
   - Reproduction context (if provided)

## Exit Criteria
- The user has described the problem
- Clarifying questions (if any) have been answered
- Enough context exists to explore the codebase and file an issue

## Next Phase
→ Load `run-qa-session-explore.md`