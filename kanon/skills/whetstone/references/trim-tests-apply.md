# Trim Tests — Phase 4: Apply

Execute the approved plan with atomic commits.

## Entry Criteria

- User has approved the plan (full or with exclusions)
- Approved rows are known

## Steps

1. **For each approved row**, in order:
   a. Make the change (delete tests, reduce parametrize cases, remove file)
   b. Run the test suite — confirm all remaining tests pass
   c. If tests fail: revert the change, flag the row as "blocked — dependency detected", continue to next row
   d. If tests pass: commit with a descriptive message:
      ```
      test(trim): remove byte-identical duplicates in test_parser.ts

      Removed 3 tests that were exact copies of existing tests.
      Coverage preserved. Baseline: 42 tests → 39 tests.
      ```

2. **After all rows are applied**, run the full test suite one final time.

3. **Measure final state**:
   - Test count (after)
   - Coverage percentage (after)
   - Execution time (after)

4. **Present final report**:
   ```
   Trim Tests — Final Report
   ─────────────────────────────────────
   Tests before:     {baseline}
   Tests after:      {final}
   Removed:          {delta} ({percentage}%)
   Coverage before:  {baseline_cov}%
   Coverage after:   {final_cov}%
   Blocked rows:     {count} (dependency detected)
   Commits:          {commit_count}
   ```

5. **If any rows were blocked**, explain why and suggest follow-up (the dependency may indicate a design issue worth investigating with `refactor-architecture`).

## Exit Criteria

- All approved changes applied (or blocked with explanation)
- Test suite passes
- Coverage preserved (or drop documented)
- Final report presented
- Atomic commits in git history