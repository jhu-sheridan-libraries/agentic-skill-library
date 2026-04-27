<!-- forge:version 0.1.7 -->
# Tracer Bullet

## Entry Criteria
- The planning phase is complete and the user has approved the behavior list
- The first (highest-priority) behavior has been identified
- The test runner is configured and working

## Steps
1. Pick the single most important behavior from the approved plan.
2. Write ONE test that confirms ONE thing about the system end-to-end. This is the tracer bullet — it proves the path works through all layers.
3. Run the test. It MUST fail (RED). If it passes, the test is not testing new behavior — revisit.
4. Write the minimal code to make the test pass (GREEN). Do not add anything beyond what this single test requires.
5. Run the test again. It MUST pass.
6. Verify the test describes behavior, not implementation:
   - Uses the public interface only
   - Would survive an internal refactor
   - Reads like a specification ("user can checkout with valid cart")

```
RED:   Write test for first behavior → test fails
GREEN: Write minimal code to pass → test passes
```

## Exit Criteria
- One test exists and passes
- The test exercises a real code path through the public API
- The tracer bullet proves the end-to-end path works
- No speculative features have been added

## Next Phase
→ Load `drive-tests-incremental-loop.md`