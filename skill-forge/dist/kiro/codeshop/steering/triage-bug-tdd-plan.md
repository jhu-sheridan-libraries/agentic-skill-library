<!-- forge:version 0.1.6 -->
# TDD Plan

## Entry Criteria
- The fix approach is determined
- Affected modules and behaviors are identified
- The issue classification is clear

## Steps
1. Create a concrete, ordered list of RED-GREEN cycles. Each cycle is one vertical slice (see POWER.md Shared Concepts on "vertical slices").
2. For each cycle:
   - **RED**: Describe a specific test that captures the broken or missing behavior. The test must fail before the fix.
   - **GREEN**: Describe the minimal code change to make that test pass.
3. Follow these rules:
   - Tests verify behavior through public interfaces, not implementation details
   - One test at a time, vertical slices (NOT all tests first, then all code)
   - Each test should survive internal refactors
   - Tests assert on observable outcomes (API responses, UI state, user-visible effects), not internal state
4. Include a final REFACTOR step if cleanup is needed after all tests pass.
5. Ensure durability — only suggest fixes that would survive radical codebase changes. Describe behaviors and contracts, not internal structure. A good plan reads like a spec; a bad one reads like a diff.

## Exit Criteria
- An ordered list of RED-GREEN cycles is complete
- Each cycle is a vertical slice with a clear test and minimal fix
- Tests target observable behavior, not implementation details
- A refactor step is included if needed
- The plan is durable — it describes behaviors, not file paths

## Next Phase
→ Load `triage-bug-create-issue.md`