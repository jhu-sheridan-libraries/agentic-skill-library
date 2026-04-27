<!-- forge:version 0.1.6 -->
# Audit

## Entry Criteria
- User wants to improve, create, or review project documentation
- The codeshop power is active and the write-living-docs workflow has been loaded

## Steps

1. Inventory existing documentation sources in the codebase:
   - README files (root and per-package)
   - `CONTEXT.md` and `CONTEXT-MAP.md` (domain glossary)
   - ADRs in `docs/adr/` (decision rationale)
   - Inline doc comments (JSDoc, docstrings, etc.)
   - Test descriptions and test file names (behavioral specifications)
   - Configuration files (deployment and environment documentation)
   - Type definitions and interfaces (API contracts)
   - Generated docs (API docs, changelogs, etc.)
   - Wiki pages, Notion docs, or other external documentation

2. For each source, classify it as:
   - **Authoritative** — this is the single source of truth for the knowledge it contains. Changes here are the canonical update.
   - **Derived** — this was generated from or summarizes an authoritative source. It may be stale.
   - **Stale** — this was once accurate but has drifted from its source. It may be actively misleading.
   - **Orphaned** — no clear authoritative source exists. The knowledge lives only here.

3. Note which documentation sources overlap — where the same concept is documented in multiple places. These are drift risks.

## Exit Criteria
- A complete inventory of documentation sources exists
- Each source is classified as authoritative, derived, stale, or orphaned
- Overlap and drift risks are identified

## Next Phase
→ Load `write-living-docs-classify.md`