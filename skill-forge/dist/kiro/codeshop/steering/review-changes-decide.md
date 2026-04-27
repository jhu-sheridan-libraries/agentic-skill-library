<!-- forge:version 0.1.7 -->
# Decide

## Entry Criteria
- All findings are classified and comments are written
- The review is ready for a final verdict

## Steps

1. Make the approval decision:

   **Approve** when:
   - You could explain this code to a colleague yourself
   - All "must address" items have been resolved (or there are none)
   - The code does what the PR description says it does
   - Tests cover the important behaviors

   **Request changes** when:
   - There are unresolved "must address" items
   - The code does not match the stated intent
   - Critical test coverage is missing
   - Security or correctness issues are present

2. If requesting changes, ensure every comment is actionable:
   - State what needs to change
   - Explain why it needs to change
   - Propose an alternative where possible
   - Do not leave vague requests like "please fix" without specifics

3. Do not rubber-stamp. An approval that misses a security issue is worse than no review at all. If you are not confident in your understanding of the code, say so — ask questions rather than approving with uncertainty.

4. Post the review with the appropriate verdict and all comments.

## Exit Criteria
- A clear verdict has been given: approve or request changes
- All comments are posted with appropriate severity labels
- If changes are requested, every request is specific and actionable
- The author knows exactly what to do next

## Next Phase
→ Workflow complete. If the review surfaces a bug, suggest loading `triage-bug` to investigate. If the review surfaces a refactoring opportunity, suggest loading `plan-refactor` to detail the approach.