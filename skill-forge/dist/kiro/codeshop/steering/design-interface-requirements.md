<!-- forge:version 0.1.7 -->
# Requirements

## Entry Criteria
- The user wants to design an API, module interface, or public surface area
- There is a module or component that needs its interface defined

## Steps
1. Gather requirements by understanding the full context before designing anything.
2. Work through this checklist with the user:
   - [ ] What problem does this module solve?
   - [ ] Who are the callers? (other modules, external users, tests)
   - [ ] What are the key operations?
   - [ ] Any constraints? (performance, compatibility, existing patterns)
   - [ ] What should be hidden inside vs exposed?
3. Identify opportunities for deep modules (see POWER.md Shared Concepts): places where a small interface can hide significant implementation complexity.
4. Note any existing patterns or conventions in the codebase that the interface should follow.
5. Summarize the requirements back to the user for confirmation.

Ask: "What does this module need to do? Who will use it?"

## Exit Criteria
- The problem the module solves is clearly defined
- Callers and their needs are identified
- Key operations are listed
- Constraints are documented
- The boundary between hidden and exposed is understood
- Requirements are confirmed with the user

## Next Phase
→ Load `design-interface-generate.md`