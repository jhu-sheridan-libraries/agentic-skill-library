<!-- forge:version 0.1.7 -->
# Reconcile

## Entry Criteria
- Documentation artifacts are assembled and pass the Living Documentation Checklist
- Sources of truth are identified for each concept

## Steps

1. For each documentation artifact, verify consistency with its authoritative source:
   - Has the source changed since the doc was last updated?
   - Does the doc accurately reflect the current state of the source?
   - Are there any claims in the doc that contradict the code, tests, or configuration?

2. For any drift found:
   - If the doc is **derived** and the source is authoritative → update the doc to match the source
   - If the doc is **orphaned** and no source exists → either promote it to authoritative (if the knowledge is valuable) or mark it as stale with a warning
   - If the source and doc disagree and it is unclear which is correct → flag for the user to resolve

3. For stale documentation:
   - Add a visible "stale" marker with a link to the authoritative source
   - Or delete it if the authoritative source is sufficient on its own
   - Do not silently leave stale docs in place — they are worse than no docs

4. Check for documentation anti-patterns:
   - **Information Graveyard** — docs written once and never updated. Add reconciliation triggers or delete.
   - **Human Dedication** — relying on one person to keep docs current. Automate or derive instead.
   - **Speculative Documentation** — documenting what might be needed rather than what is actually asked about. Delete speculative sections.
   - **Comprehensive Documentation** — attempting to document everything. Apply the "default is don't" principle.

5. Present a reconciliation summary to the user:
   - Docs updated to match sources
   - Docs marked as stale or deleted
   - Anti-patterns identified and addressed
   - Remaining drift risks and recommended reconciliation schedule

## Exit Criteria
- All derived documentation is consistent with its authoritative source
- Stale documentation is updated, marked, or deleted
- Documentation anti-patterns are identified and addressed
- The user has reviewed the reconciliation summary

## Next Phase
→ Workflow complete. Suggest natural next steps: load `challenge-domain-model` to ensure terminology is precise, or schedule a periodic reconciliation review.