<!-- forge:version 0.1.6 -->
# Explore

## Entry Criteria
- The user has described a feature or problem in the conversation context
- There is enough context to understand what needs to be built

## Steps
1. Explore the repository to understand the current state of the codebase, if you have not already done so.
2. Identify existing modules, patterns, and conventions relevant to the feature:
   - What modules exist that will be modified?
   - What patterns does the codebase follow (naming, architecture, testing)?
   - What conventions are established (file structure, API style, error handling)?
3. Note the integration layers: where does data flow in and out? What are the system boundaries?
4. Identify any existing tests and testing patterns — these inform the Testing Decisions section of the PRD.
5. Look for prior art: has something similar been built before in this codebase?

Do NOT interview the user during this phase — synthesize what you already know from the conversation context and codebase exploration.

## Exit Criteria
- The current state of the codebase is understood
- Relevant modules, patterns, and conventions have been identified
- Integration layers and system boundaries are clear
- Ready to sketch the module design

## Next Phase
→ Load `draft-prd-sketch-modules.md`