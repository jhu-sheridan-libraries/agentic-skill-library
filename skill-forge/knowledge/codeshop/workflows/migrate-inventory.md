# Inventory

## Entry Criteria
- The user has identified what is being migrated (databases, tables, collections, files, or systems)
- Source and destination are known

## Steps
1. Catalog everything being migrated:
   - Tables or collections (with schema definitions)
   - Row counts per table
   - Relationships — foreign keys, references, join tables
   - Constraints — unique, not-null, check, default values
   - Indexes (including composite and partial indexes)
2. Establish baseline checksums for each table or collection:
   - Aggregate row counts
   - Sum or hash of key columns (e.g., `SUM(id)`, `COUNT(DISTINCT email)`)
   - Referential integrity snapshot — verify all foreign keys resolve before migration begins
3. Document the source-of-truth for each entity — which system owns this data? If multiple systems have copies, which is authoritative?
4. Identify data that should NOT be migrated:
   - Archived or historical records (if not needed in the destination)
   - Soft-deleted rows
   - Test or seed data
   - Temporary or cached data that will be regenerated
5. Record the inventory in a structured document — this becomes the migration's ground truth for all subsequent phases.

## Exit Criteria
- Inventory document listing all entities, schemas, relationships, and constraints
- Baseline checksums recorded for every table or collection
- Source-of-truth mapping for each entity
- Exclusion list with rationale for each exclusion

## Next Phase
→ Load `migrate-plan.md`
