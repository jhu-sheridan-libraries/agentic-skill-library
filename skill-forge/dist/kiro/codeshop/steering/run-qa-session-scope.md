<!-- forge:version 0.1.6 -->
# Scope

## Entry Criteria
- The problem has been described and clarified
- The relevant codebase area has been explored

## Steps
1. Assess whether this is a single issue or needs to be broken down into multiple issues.
2. Break down when:
   - The fix spans multiple independent areas (e.g., "the form validation is wrong AND the success message is missing AND the redirect is broken")
   - There are clearly separable concerns that different people could work on in parallel
   - The user describes something with multiple distinct failure modes or symptoms
3. Keep as a single issue when:
   - It is one behavior that is wrong in one place
   - The symptoms are all caused by the same root behavior
4. If breaking down, identify:
   - The individual sub-issues
   - Dependency order (which issues block which)
   - Which issues can be worked on in parallel
5. Communicate the scope decision to the user before filing.

## Exit Criteria
- The scope is assessed: single issue or breakdown
- If breakdown: sub-issues are identified with dependency order
- The user understands the scope decision
- Ready to file the issue(s)

## Next Phase
→ Load `run-qa-session-file-issue.md`