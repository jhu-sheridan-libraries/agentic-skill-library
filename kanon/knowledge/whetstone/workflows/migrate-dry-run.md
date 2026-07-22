# Dry-Run

## Entry Criteria
- Migration plan approved by the user
- A copy of the data is available (staging database, snapshot, or representative subset)

## Steps
1. Execute the migration against a copy of the data — never against production. Use a staging database, a snapshot restore, or a representative subset that covers edge cases.
2. Run each migration step in plan order. At every step boundary:
   - Run the step's verification checkpoint
   - Compare checksums between source and destination
   - Record pass/fail and any discrepancies
3. Measure execution time for each step. Compare against the migration window estimate:
   - If total time exceeds the window, identify bottlenecks (large tables, complex transformations, index rebuilds)
   - Adjust the plan — add batching, parallelize independent steps, defer index creation
4. Document discrepancies found during the dry-run:
   - Data that didn't migrate cleanly (encoding issues, truncation, precision loss)
   - Constraint violations (orphaned foreign keys, duplicate unique values)
   - Transformation edge cases (null handling, empty strings, boundary values)
5. Adjust the plan based on findings. Update transformation rules, add data cleanup steps, or revise the migration order.
6. If the dry-run reveals fundamental problems (wrong assumptions about data shape, missing relationships, incompatible schemas), return to the Plan phase rather than patching around the issues.

## Exit Criteria
- Dry-run executed against a data copy with all steps completed
- Checksum comparison report for every step boundary
- All discrepancies resolved or documented with mitigation plans
- Migration window estimate validated against measured execution times
- Plan updated with any adjustments from dry-run findings

## Next Phase
→ Load `migrate-execute.md`
