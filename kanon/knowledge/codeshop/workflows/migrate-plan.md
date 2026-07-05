# Plan

## Entry Criteria
- Inventory complete with baseline checksums
- Source-of-truth mapping and exclusion list documented

## Steps
1. Define migration steps in dependency order — parent tables before child tables, respecting foreign key relationships. If circular dependencies exist, plan a multi-pass approach (migrate without constraints, then add constraints).
2. For each migration step, define:
   - **What data moves** — which table or collection, which rows (filters, date ranges)
   - **Transformation rules** — column renames, type conversions, default values for new columns, computed fields, data normalization
   - **Rollback criteria** — what condition triggers rollback for this step (checksum mismatch, constraint violation, timeout, error threshold)
   - **Rollback procedure** — how to reverse this specific step (truncate and re-import, restore from backup, reverse transformation)
   - **Verification checkpoint** — what to check after this step completes (row count match, checksum match, spot-check samples)
3. Define the migration window:
   - Downtime budget — how long can the system be unavailable?
   - Strategy — full downtime, read-only period, or zero-downtime (dual-write, shadow migration, blue-green)
   - If zero-downtime, define the cutover procedure and how to handle writes during migration
4. Define overall abort criteria — at what point do you abandon the migration entirely and restore from backup? (e.g., more than N steps failed, total time exceeded, data loss detected)

## Exit Criteria
- Ordered migration steps with dependency relationships
- Per-step transformation rules, rollback criteria, rollback procedures, and verification checkpoints
- Migration window defined with downtime strategy
- Overall abort criteria documented

## Next Phase
→ Load `migrate-dry-run.md`
