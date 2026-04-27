<!-- forge:version 0.1.7 -->
# Fix Approach

## Entry Criteria
- The root cause has been identified
- The code path and related code are understood

## Steps
1. Determine the minimal change needed to fix the root cause — not a workaround, not a rewrite, just the smallest correct fix.
2. Identify which modules and interfaces are affected by the fix.
3. List the behaviors that need to be verified via tests:
   - The broken behavior that should be fixed
   - Adjacent behaviors that must not regress
   - Edge cases related to the root cause
4. Classify the issue:
   - **Regression**: Something that used to work and broke (check git history)
   - **Missing feature**: Expected behavior that was never implemented
   - **Design flaw**: The code works as written but the design is wrong
5. Assess risk — does this fix touch a critical path? Are there downstream effects?

## Exit Criteria
- The minimal fix is identified
- Affected modules and interfaces are listed
- Behaviors needing test verification are enumerated
- The issue is classified (regression, missing feature, or design flaw)
- Ready to design the TDD fix plan

## Next Phase
→ Load `triage-bug-tdd-plan.md`