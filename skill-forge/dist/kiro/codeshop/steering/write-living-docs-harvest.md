<!-- forge:version 0.1.6 -->
# Harvest

## Entry Criteria
- Documentation needs are classified as Evergreen, Living, or Conversation
- "Do not document" items are identified and justified

## Steps

1. For each **Living** documentation item, identify the authoritative source already in the codebase and extract documentation from it rather than writing new prose from scratch:
   - **Test names and descriptions** → behavioral specifications ("what does this system do?")
   - **Type signatures and interfaces** → API contracts ("what can I call and what do I get back?")
   - **`CONTEXT.md` terms** → domain glossary ("what do these words mean here?")
   - **ADRs** → decision rationale ("why was it built this way?")
   - **Configuration files** → deployment and environment documentation
   - **Code structure** (module boundaries, directory layout) → architecture documentation

2. For each **Evergreen** item, check whether an authoritative source exists:
   - If yes, derive the documentation from it
   - If no, this is one of the few cases where writing original prose is justified — but keep it minimal and link to code where possible

3. For each **Conversation** item, do not write documentation. Instead, note where the knowledge transfer should happen (code review, pairing sessions, onboarding conversations).

4. As you harvest, apply the single-source-of-truth rule: if the same knowledge exists in multiple places, pick one authoritative source and plan to make the others reference it.

## Exit Criteria
- Living documentation items have identified authoritative sources
- Extracted knowledge is captured in a working format (notes, drafts, or direct edits)
- No new prose has been written where an authoritative source already exists
- Single source of truth is identified for each concept

## Next Phase
→ Load `write-living-docs-compose.md`