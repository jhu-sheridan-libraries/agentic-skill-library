<!-- forge:version 0.1.7 -->
# Sketch Modules

## Entry Criteria
- The codebase has been explored and the current state is understood
- Relevant modules, patterns, and conventions have been identified

## Steps
1. Sketch out the major modules you will need to build or modify to complete the implementation.
2. Actively look for opportunities to extract deep modules (see POWER.md Shared Concepts): modules that encapsulate significant functionality behind a simple, testable interface that rarely changes.
3. For each module, describe:
   - Its responsibility (what it does)
   - Its public interface (how callers interact with it)
   - Its dependencies (what it needs from other modules)
4. Check with the user that these modules match their expectations.
5. Check with the user which modules they want tests written for — focus testing effort on critical paths and complex logic.

A deep module (as opposed to a shallow module) is one which encapsulates a lot of functionality in a simple, testable interface which rarely changes. Prefer deep modules over shallow ones.

## Exit Criteria
- Major modules are sketched with responsibilities, interfaces, and dependencies
- Deep module opportunities have been identified and noted
- The user has confirmed the module design matches their expectations
- The user has confirmed which modules need tests

## Next Phase
→ Load `draft-prd-write-prd.md`