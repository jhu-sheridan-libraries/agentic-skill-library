# Trim Tests — Phase 1: Inventory

Baseline the current state before making any changes.

## Entry Criteria

- Test suite passes (run it to confirm)
- Git working tree is clean
- Scope is defined (specific path, feature-id, or full suite)

## Steps

1. **Run the test suite** in the target scope. Record:
   - Total test count (passed + failed + skipped)
   - Coverage percentage (if coverage tooling is configured)
   - Execution time

2. **List all test files** in scope with their test counts:
   ```
   File                              │ Tests │ Lines
   ──────────────────────────────────┼───────┼──────
   tests/unit/test_parser.ts         │    42 │   890
   tests/unit/test_validator.ts      │    31 │   620
   ```

3. **Record the baseline** — these numbers are the contract. After trimming, coverage must not drop below this baseline (or any drop must be explicitly justified).

4. **Identify the largest files** — files with the most tests are the highest-leverage targets for consolidation.

## Exit Criteria

- Baseline numbers recorded and displayed to user
- Scope confirmed (user agrees on which files/directories to analyze)
- Ready to proceed to detection phase
