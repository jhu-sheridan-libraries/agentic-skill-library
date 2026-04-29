# Verify

## Entry Criteria
- Migration executed with all steps completed
- All per-step checkpoints passed during execution

## Steps
1. Full checksum reconciliation between source and destination:
   - Row counts per table — source vs destination
   - Aggregate checksums — `SUM(id)`, `COUNT(DISTINCT key_column)`, hash of critical fields
   - Spot-check random samples — select N random records from source, verify they exist and match in destination
2. Referential integrity validation:
   - All foreign keys resolve — no orphaned child records
   - No dangling references to records that were excluded from migration
   - All unique constraints satisfied
   - All check constraints pass
3. Application-level smoke tests:
   - Can the application read migrated data correctly? Do queries return expected results?
   - Can the application write new data? Do inserts, updates, and deletes succeed?
   - Do application workflows that depend on the migrated data function end-to-end?
   - Check edge cases: empty fields, maximum-length values, special characters, timezone-sensitive dates
4. Performance baseline comparison:
   - Run key queries against the destination and compare execution times to pre-migration baselines
   - Check that indexes are in place and being used (explain plans)
   - Identify any performance regressions and determine if they require immediate action or can be addressed post-migration
5. Sign-off checklist:
   - [ ] Checksums match between source and destination
   - [ ] Referential integrity validated — no orphaned records
   - [ ] Application reads and writes work correctly
   - [ ] Performance is acceptable compared to baseline
   - [ ] Audit log is complete and archived

## Exit Criteria
- Verification report containing: checksum reconciliation results, referential integrity validation, application smoke test results, performance comparison, and sign-off checklist
- All sign-off items checked — or exceptions documented with remediation plan
