<!-- forge:version 0.1.6 -->
# Session

## Entry Criteria
- Existing domain documentation has been read
- The plan to challenge has been identified
- A first grilling question is ready

## Steps

1. Interview the user relentlessly about every aspect of the plan. Walk down each branch of the design tree, resolving dependencies between decisions one by one. For each question, provide your recommended answer.

2. Ask questions one at a time, waiting for feedback on each before continuing. If a question can be answered by exploring the codebase, explore the codebase instead.

3. Apply these techniques throughout the session:

   **Challenge against the glossary** — When the user uses a term that conflicts with the existing language in `CONTEXT.md`, call it out immediately. _"Your glossary defines 'cancellation' as X, but you seem to mean Y — which is it?"_

   **Sharpen fuzzy language** — When the user uses vague or overloaded terms, propose a precise canonical term. _"You're saying 'account' — do you mean the Customer or the User? Those are different things."_

   **Discuss concrete scenarios** — When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

   **Cross-reference with code** — When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: _"Your code cancels entire Orders, but you just said partial cancellation is possible — which is right?"_

4. Update `CONTEXT.md` inline as terms are resolved — do not batch these up. Capture decisions as they happen. See the challenge-domain-model steering file for context format details.

5. Do not couple `CONTEXT.md` to implementation details. Only include terms that are meaningful to domain experts.

6. Offer ADRs sparingly — only when all three conditions are true:
   - **Hard to reverse** — the cost of changing your mind later is meaningful
   - **Surprising without context** — a future reader will wonder "why did they do it this way?"
   - **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

   If any of the three is missing, skip the ADR. See the challenge-domain-model steering file for ADR format details.

## Exit Criteria
- Every branch of the plan's design tree has been explored through conversation
- Fuzzy or conflicting terms have been resolved to precise canonical terms
- `CONTEXT.md` has been updated inline with resolved terms
- ADRs have been offered (and created if accepted) for qualifying decisions
- The user and agent have reached a shared understanding of the plan's domain implications

## Next Phase
→ Load `challenge-domain-model-update.md`