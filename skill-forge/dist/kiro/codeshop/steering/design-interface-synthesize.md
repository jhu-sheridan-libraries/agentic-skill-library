<!-- forge:version 0.1.7 -->
# Synthesize

## Entry Criteria
- All designs have been compared on simplicity, flexibility, efficiency, depth, and ease of use
- The user has absorbed the trade-offs

## Steps
1. The best design often combines insights from multiple options. Guide the user toward synthesis.
2. Ask the user:
   - "Which design best fits your primary use case?"
   - "Any elements from other designs worth incorporating?"
3. If the user picks one design outright, confirm it and note any trade-offs they are accepting.
4. If the user wants to combine elements, help them merge the best parts:
   - Take the interface shape from one design
   - Incorporate a specific method or pattern from another
   - Ensure the combined design is still coherent and deep (not a shallow Frankenstein)
5. Validate the final design against the original requirements from Phase 1.
6. Present the synthesized interface with its signature, usage example, and what it hides.

## Exit Criteria
- The user has chosen or synthesized a final interface design
- The design satisfies the original requirements
- The interface is coherent and deep (small surface, significant hidden complexity)
- The design is documented and ready for implementation

## Next Phase
→ Workflow complete. See the Workflow Composition section in POWER.md for natural next steps (e.g., `drive-tests` to implement the interface using TDD).