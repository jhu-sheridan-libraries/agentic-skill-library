<!-- forge:version 0.1.7 -->
# Incremental Loop

## Entry Criteria
- The tracer bullet test exists and passes
- There are remaining behaviors on the approved plan to implement

## Steps

For each remaining behavior on the plan, repeat this cycle:

1. **RED** — Write the next test for the next behavior on the list. Run it. It MUST fail. If it passes, the behavior is already implemented or the test is wrong — investigate before proceeding.
2. **GREEN** — Write the minimal code to make the test pass. Only enough code to satisfy the current test. Do not anticipate future tests or add speculative features.
3. Run all tests. All MUST pass — the new test and all previous tests.
4. Verify the new test against the checklist:
   - Test describes behavior, not implementation
   - Test uses public interface only
   - Test would survive internal refactor
   - Code is minimal for this test
   - No speculative features added
5. Move to the next behavior and repeat.

Rules:
- One test at a time — do NOT write multiple tests before implementing
- Only enough code to pass the current test
- Do not anticipate future tests
- Keep tests focused on observable behavior
- This is vertical slicing: RED→GREEN for each behavior, not all REDs then all GREENs

```
RED→GREEN: test1→impl1
RED→GREEN: test2→impl2
RED→GREEN: test3→impl3
```

## Exit Criteria
- All behaviors from the approved plan have been implemented
- All tests pass
- Each test verifies one behavior through the public interface
- No speculative code has been added beyond what the tests require

## Next Phase
→ Load `drive-tests-refactor.md`