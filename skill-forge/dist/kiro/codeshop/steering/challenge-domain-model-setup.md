<!-- forge:version 0.1.7 -->
# Setup

## Entry Criteria
- User has requested a domain model grilling session or wants to stress-test a plan against their project's language and documented decisions
- The codeshop power is active and the challenge-domain-model workflow has been loaded

## Steps

1. Read existing domain documentation:
   - `CONTEXT.md` at the project root — this is the glossary of domain terms
   - If `CONTEXT-MAP.md` exists at the root, the repo has multiple bounded contexts. The map points to where each one lives. Read each context's `CONTEXT.md`.
   - Relevant ADRs in `docs/adr/` (and any context-scoped `docs/adr/` directories)

2. Identify the plan or design to challenge:
   - What has the user proposed or described?
   - What domain concepts does the plan touch?
   - Which existing terms in `CONTEXT.md` are relevant?
   - Are there ADRs that constrain or inform the plan?

3. If no `CONTEXT.md` or `docs/adr/` exists, proceed silently. These files are created lazily — only when you have something to write.

4. Prepare your first grilling question. Focus on the area where the plan's language diverges most from the existing domain model, or where terms are vaguest.

## Exit Criteria
- Existing `CONTEXT.md`, `CONTEXT-MAP.md`, and relevant ADRs have been read (or confirmed absent)
- The plan to challenge has been identified and its domain concepts catalogued
- You have a first grilling question ready

## Next Phase
→ Load `challenge-domain-model-session.md`