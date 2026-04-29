# Execute

## Entry Criteria
- Dry-run passed with a clean checksum report
- All discrepancies from the dry-run resolved
- Migration window scheduled and communicated

## Steps
1. Create a backup before starting — or verify that a recent backup exists and is restorable. Test the restore procedure if it has not been tested recently. Do not proceed without a verified backup.
2. Execute the migration against production data, following the plan step by step. Do not skip steps or change the order.
3. At each step boundary, run the verification checkpoint:
   - Compare checksums between source and destination for the migrated data
   - Verify constraints are satisfied (foreign keys resolve, unique values are unique)
   - Do NOT proceed to the next step until the current step's checkpoint passes
4. If any checkpoint fails its rollback criteria:
   - Halt the migration immediately
   - Execute the rollback procedure for the failed step
   - Assess whether the failure is isolated (retry after fix) or systemic (abort entirely)
5. Log every step with timestamps for audit trail:
   - What migration step ran
   - When it started and completed
   - Checksums before and after
   - Pass/fail result
   - Any warnings or anomalies
6. If overall abort criteria are met (defined in the Plan phase), stop the migration and restore from backup. Do not attempt partial recovery under abort conditions.

## Exit Criteria
- Migration complete with all checkpoints passed — OR rolled back with documented reason
- Audit log recording every step, timestamp, checksum, and pass/fail result
- If rolled back: root cause documented, plan updated for next attempt

## Next Phase
→ Load `migrate-verify.md`
