# Trim Tests — Phase 2: Detect

Scan the test scope for duplication and anti-patterns.

## Entry Criteria

- Baseline inventory complete (test count, coverage known)
- Scope confirmed

## Steps

1. **Byte-identical scan**: For each pair of test functions in scope, compare bodies (ignoring whitespace and variable names). Flag exact or near-exact duplicates.

2. **Parametrize-inflation scan**: Find parametrized tests with high case counts (>20). For each, trace which code branches each case exercises. Flag cases that hit the same branch as another case.

3. **Language-guarantee scan**: Look for tests that assert on behavior guaranteed by the language or framework:
   - Type system guarantees (TypeScript: type narrowing, const immutability)
   - Standard library contracts (Array methods, Map behavior)
   - Framework guarantees (React: setState triggers re-render)

4. **AST-shape scan**: Look for tests that assert on code structure rather than behavior:
   - "Function X exists"
   - "Class Y has method Z"
   - "Module exports these names"

5. **Stale migration net scan**: Look for tests with names or comments referencing completed migrations, deprecated features, or removed code paths. Cross-reference with git history — if the migration commit is >3 months old and the guarded code hasn't changed since, the net is likely stale.

6. **Compile findings** into a detection report:
   ```
   Pattern                  │ Files │ Tests Affected │ Confidence
   ─────────────────────────┼───────┼────────────────┼───────────
   Byte-identical pairs     │     3 │             6  │ High
   Parametrize-inflation    │     2 │            47  │ Medium
   Language-guarantee       │     1 │             4  │ High
   Stale migration net      │     1 │             8  │ Medium
   ```

## Exit Criteria

- Detection report compiled with pattern, affected files, test count, and confidence level
- Ready to present plan to user

## Next Phase
→ Load `trim-tests-plan.md`
