<!-- forge:version 0.1.7 -->
# Compose

## Entry Criteria
- Authoritative sources have been identified for each documentation item
- Extracted knowledge is captured in working format
- Single source of truth is identified for each concept

## Steps

1. Assemble harvested knowledge into the appropriate documentation format, following these rules:

   - **One source of truth per concept** — use references, not copies. If the API contract lives in the type definitions, the README should link to them, not duplicate them.
   - **Annotate the rationale** — document the "why," not just the "how." The code already shows the mechanism; documentation should explain the reasoning.
   - **Filter by audience** — internal docs stay near the code (inline comments, CONTEXT.md, ADRs). External docs are embellished and published separately (README, API docs, guides).
   - **Version each published snapshot** — when publishing external documentation, tag it with the version it describes.

2. For Living documentation, set up the derivation pipeline:
   - Can this doc be generated from the source? (e.g., API docs from types)
   - If not fully generated, can it reference the source with a "last verified" date?
   - What is the reconciliation trigger? (e.g., "re-check when types change")

3. For Evergreen documentation, write or update the prose:
   - Keep it concise — if it takes more than a page, it probably needs splitting
   - Include "last reviewed" dates so staleness is visible
   - Link to authoritative sources for any claims that could drift

4. Apply the Living Documentation Checklist to each artifact:
   - [ ] **Collaborative** — can multiple stakeholders contribute?
   - [ ] **Insightful** — does it expose uncertainty and complexity, not just happy paths?
   - [ ] **Reliable** — is it derived from or reconciled with an authoritative source?
   - [ ] **Low-effort** — is it automated or derived, not manually maintained?

## Exit Criteria
- Documentation artifacts are assembled with one source of truth per concept
- Rationale is annotated alongside mechanism
- Audience filtering is applied (internal vs external)
- Living Documentation Checklist passes for each artifact

## Next Phase
→ Load `write-living-docs-reconcile.md`