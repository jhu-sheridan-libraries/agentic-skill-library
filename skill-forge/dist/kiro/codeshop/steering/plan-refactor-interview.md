<!-- forge:version 0.1.6 -->
# Interview

## Entry Criteria
- The codebase has been explored and the current state is understood
- The user's assertions have been verified

## Steps
1. Ask the user whether they have considered other approaches to solving this problem.
2. Present alternative options you identified during exploration — different architectural approaches, simpler solutions, or partial refactors that address the core pain.
3. Interview the user about the implementation in extreme detail:
   - Which modules will be built or modified?
   - What interfaces will change?
   - What are the technical clarifications needed?
   - Are there schema changes, API contract changes, or architectural decisions to make?
   - What specific interactions between components will change?
4. Be thorough — surface every ambiguity and resolve it now, not during implementation.
5. Document each decision as it is made.

Ask: "Have you considered other approaches? Here are some alternatives I see..." then proceed to detailed implementation questions.

## Exit Criteria
- Alternative approaches have been discussed
- The user has made clear implementation decisions
- Technical details are resolved (interfaces, schemas, contracts, interactions)
- All ambiguities have been surfaced and addressed

## Next Phase
→ Load `plan-refactor-scope.md`