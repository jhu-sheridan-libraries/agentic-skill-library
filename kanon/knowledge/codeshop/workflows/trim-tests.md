# Trim Tests

Minimize test count while preserving coverage. Detect duplication, inflation, and anti-patterns in a test suite, then consolidate with explicit approval before any change.

Production code is read-only. This workflow only modifies test files.

## When to Use

- A test suite feels slow or noisy
- After a feature lands and tests have accumulated organically
- On periodic audit (weekly/monthly) to prevent test debt
- When overtesting is suspected — many tests but unclear what they prove
- Before `drive-tests` on an existing module — clean the slate first

## Prerequisites

- A test runner configured in the project
- The test suite passes (do not optimize a broken suite)
- Git working tree is clean (so changes are isolated and revertable)

## Philosophy

More tests ≠ better coverage. Test suites accumulate cruft: copy-pasted tests, parametrize-inflation (100 cases testing the same path), tests that verify language guarantees, and stale migration nets that outlived their purpose. Trimming removes noise without reducing signal.

The approval gate is non-negotiable. No test is deleted without explicit user consent.

## Phases

### Phase 1 — Inventory
Baseline the current state: count tests, measure coverage, record pass/fail status.
→ Load `trim-tests-inventory.md`

### Phase 2 — Detect
Scan for anti-patterns: byte-identical pairs, parametrize-inflation, language-guarantee tests, AST-shape tests, stale migration nets.
→ Load `trim-tests-detect.md`

### Phase 3 — Plan
Present findings as a ranked table. Each row: pattern detected, files affected, proposed action, estimated test reduction.
→ Load `trim-tests-plan.md`

### Phase 4 — Apply
After user approval, execute the plan with atomic commits per consolidation pattern.
→ Load `trim-tests-apply.md`

## Anti-Patterns to Detect

### Byte-Identical Pairs
Two tests with identical bodies (or bodies differing only in variable names). One is redundant.

### Parametrize-Inflation
A parametrized test with 50+ cases where most exercise the same code path. Reduce to representative cases covering distinct branches.

### Language-Guarantee Tests
Tests that verify behavior guaranteed by the language runtime (e.g., testing that `Array.push` adds an element, or that `const` prevents reassignment). These add noise without value.

### AST-Shape Tests
Tests that assert on the structure of code rather than its behavior (e.g., "this function has 3 parameters" or "this class has a method called X"). These break on any refactor.

### Stale Migration Nets
Tests written to guard a specific migration that has long since completed. The migration is done; the safety net can be removed.

## Approval Gate

After the Plan phase, present the plan and wait for one of:

1. **APPROVE** — execute the full plan
2. **APPROVE WITH EXCLUSIONS** — list specific rows to skip
3. **REJECT** — abort, keep findings as a deferred report
4. **REPLAN** — adjust scope or constraints and re-detect

Never assume approval. Never delete tests without explicit consent.

## Success Criteria

```
[ ] Baseline numbers recorded (test count, coverage %)
[ ] Plan presented before any change
[ ] Explicit approval received
[ ] Production files in diff: 0
[ ] Coverage % preserved (or drop justified and documented)
[ ] Atomic commits per consolidation pattern
[ ] Final report: before/after counts, coverage delta
```

## Composing with Other Workflows

- After `drive-tests` completes a feature → trim any test inflation that accumulated
- Before `plan-refactor` → trim stale tests so the refactor doesn't carry dead weight
- After `review-changes` flags test bloat → trim the specific files flagged
