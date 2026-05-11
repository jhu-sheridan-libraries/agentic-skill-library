# Trim Tests — Phase 3: Plan

Present the consolidation plan and wait for approval.

## Entry Criteria

- Detection report complete with findings

## Steps

1. **Rank findings by leverage** — sort by (tests removed × confidence). High-confidence, high-count items first.

2. **Present the plan as a table**:
   ```
   # │ Pattern              │ File                    │ Action              │ Tests Removed
   ──┼──────────────────────┼─────────────────────────┼─────────────────────┼──────────────
   1 │ Parametrize-inflation│ test_validator.ts       │ Reduce 47→8 cases   │ 39
   2 │ Stale migration net  │ test_migration_v2.ts    │ Delete file          │ 8
   3 │ Byte-identical       │ test_parser.ts          │ Remove 3 duplicates  │ 3
   4 │ Language-guarantee   │ test_types.ts           │ Remove 4 tests       │ 4
   ```

3. **Show projected impact**:
   - Tests before: {baseline}
   - Tests after: {baseline - total removed}
   - Reduction: {percentage}%
   - Coverage impact: None expected (or: "Row 2 may reduce coverage by ~1% — migration code path no longer tested")

4. **Wait for approval**. Present options:
   - **APPROVE** — execute all rows
   - **APPROVE WITH EXCLUSIONS** — "Skip rows 2 and 4"
   - **REJECT** — abort, save findings as a report for later
   - **REPLAN** — "Only do high-confidence items" or "Expand scope to include X"

5. **Do not proceed without explicit approval.**

## Exit Criteria

- User has responded with APPROVE, APPROVE WITH EXCLUSIONS, REJECT, or REPLAN
- If REJECT: save report, workflow ends
- If REPLAN: return to Phase 2 with adjusted constraints
- If APPROVE/APPROVE WITH EXCLUSIONS: proceed to Phase 4 with the approved rows
