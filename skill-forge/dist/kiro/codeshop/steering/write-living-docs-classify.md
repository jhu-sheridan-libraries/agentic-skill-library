<!-- forge:version 0.1.6 -->
# Classify

## Entry Criteria
- Documentation inventory is complete
- Each source is classified as authoritative, derived, stale, or orphaned

## Steps

1. For each documentation need (not each existing doc — think about what *should* be documented), apply Martraire's three principles:
   - **Long-period interest** — is this knowledge relevant for months or years, not just this sprint?
   - **Large audience** — do multiple people or teams need this knowledge?
   - **Valuable or critical** — would losing this knowledge cause real harm?

   Knowledge that fails all three tests should be explicitly marked as **"do not document"**. The default is don't — documentation has a maintenance cost.

2. Categorize each documentation item that passes the filter:
   - **Evergreen** — stable knowledge that changes rarely (project vision, core architecture, onboarding). Traditional docs are acceptable here.
   - **Living** — changes with the code and must be derived from an authoritative source (API docs from types, behavior docs from tests, domain glossary from CONTEXT.md). Manual maintenance will fail.
   - **Conversation** — best transferred through discussion, pairing, or code review. Writing it down produces low-value prose that nobody reads. Skip it.

3. For items marked "do not document," verify they match one of these criteria:
   - Can be recreated cheaply when needed
   - Volatile predictions that will be wrong soon
   - Rarely needed by anyone
   - Raw diagnostic output better served by tooling

## Exit Criteria
- Every documentation need has been evaluated against the three principles
- Items are categorized as Evergreen, Living, Conversation, or "do not document"
- The "do not document" items have explicit justification

## Next Phase
→ Load `write-living-docs-harvest.md`