<!-- forge:version 0.1.7 -->
# Grilling Loop

## Entry Criteria
- The user has selected a deepening candidate from the presented list
- The candidate's files, problem, and solution are understood

## Steps

1. Drop into a grilling conversation with the user. Walk the design tree together:
   - What are the constraints on this module?
   - What are its dependencies — and which are essential vs accidental?
   - What is the shape of the deepened module — what sits behind the seam?
   - What tests survive the refactor? Which need rewriting?
   - What does the interface look like from the caller's perspective?

2. Apply side effects inline as decisions crystallize:

   - **Naming a deepened module after a concept not in `CONTEXT.md`?** Add the term to `CONTEXT.md` right there — same discipline as the challenge-domain-model workflow. See the challenge-domain-model steering file for context format details. Create the file lazily if it does not exist.

   - **Sharpening a fuzzy term during the conversation?** Update `CONTEXT.md` immediately — do not batch these up.

   - **User rejects the candidate with a load-bearing reason?** Offer an ADR, framed as: _"Want me to record this as an ADR so future architecture reviews don't re-suggest it?"_ Only offer when the reason would actually be needed by a future explorer. Skip ephemeral reasons ("not worth it right now") and self-evident ones. See the challenge-domain-model steering file for ADR format details.

   - **Want to explore alternative interfaces for the deepened module?** Use the interface design principles from the refactor-architecture steering file appendix, or load the design-interface workflow for a full parallel-alternatives session.

3. Continue the grilling loop until the user is satisfied with the design direction or decides to move on.

## Exit Criteria
- The design direction for the selected candidate has been explored through conversation
- `CONTEXT.md` has been updated with any new or sharpened terms
- ADRs have been offered (and created if accepted) for load-bearing decisions
- The user has a clear picture of the deepened module's shape, interface, and test implications

## Next Phase
→ Workflow complete. Suggest natural next steps: load `plan-refactor` to detail the implementation approach, or load `compose-issues` to break the refactor into work items.