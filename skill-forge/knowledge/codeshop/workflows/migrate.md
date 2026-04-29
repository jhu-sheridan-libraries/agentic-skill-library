# Migrate

Reliable data migration with checksum verification — inventory, plan, dry-run, execute, verify. Every step has a verification checkpoint; a migration without checksums is a hope, not a plan.

## When to Use

- The user wants to migrate data between schemas
- The user wants to run a database migration
- The user needs to transform data from one format to another
- The user wants to move data between systems

## Prerequisites

- Database access (or access to the data stores involved)
- Backup strategy in place (or ability to create one)
- Understanding of the data being migrated

## Shared Concepts

This workflow relies on "Migration Checksum Discipline" as defined in the POWER.md Shared Concepts section. Verification happens at three points — before (baseline), during (per-step checkpoints), after (full reconciliation). Checksums are not just row counts — they include aggregate hashes of key columns, referential integrity snapshots, and application-level smoke tests.

## Adaptation Notes

- **Codebase exploration**: Use Kiro's `invokeSubAgent` with the `context-gatherer` agent to investigate schemas and data structures, or use direct file exploration tools (`readCode`, `grepSearch`, `listDirectory`).
- **Database access**: This workflow assumes the user can run queries against source and destination databases. If direct access is unavailable, adapt verification steps to use application-level checks or exported data.

## Phases

### Phase 1 — Inventory
Catalog everything being migrated — tables, row counts, relationships, constraints, indexes. Establish baseline checksums and identify exclusions.
→ Load `migrate-inventory.md`

### Phase 2 — Plan
Define migration steps in dependency order with per-step rollback criteria, transformation rules, and verification checkpoints.
→ Load `migrate-plan.md`

### Phase 3 — Dry-Run
Execute the migration against a copy of the data. Compare checksums at every step boundary and validate the migration window estimate.
→ Load `migrate-dry-run.md`

### Phase 4 — Execute
Run the migration against production data step by step. Halt on checkpoint failure. Log everything for audit trail.
→ Load `migrate-execute.md`

### Phase 5 — Verify
Full checksum reconciliation, referential integrity validation, application smoke tests, and performance comparison.
→ Load `migrate-verify.md`

## Anti-Patterns

- **Big-bang migration** — Migrate everything at once with no checkpoints. One failure corrupts the entire dataset with no way to isolate the problem.
- **Skipping dry-run** — "It worked in my head." Dry-runs catch transformation edge cases, constraint violations, and timing issues that are invisible in planning.
- **No rollback plan** — "We'll figure it out if something goes wrong." By the time something goes wrong, you're under pressure and making bad decisions.
- **Row-count-only verification** — Row counts don't catch data corruption. 1000 rows in source and 1000 rows in destination means nothing if half the values are wrong.
- **Migrating without a backup** — YOLO is not a migration strategy.

## Checksum Discipline Summary

Verification happens at three points:

1. **Before (baseline)** — Establish checksums on the source data before any migration begins. This is your ground truth.
2. **During (per-step checkpoints)** — After each migration step, verify that the destination matches expectations. Do not proceed until the checkpoint passes.
3. **After (full reconciliation)** — Compare source and destination end-to-end. Row counts, aggregate checksums, spot-check samples, referential integrity, and application-level smoke tests.

Checksums are not just row counts. They include aggregate hashes of key columns (SUM of IDs, COUNT DISTINCT of unique fields), referential integrity snapshots (all foreign keys resolve), and application-level smoke tests (can the app read and write correctly?).
