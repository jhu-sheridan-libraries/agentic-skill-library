<!-- forge:version 0.1.6 -->
# Test Coverage

## Entry Criteria
- The scope of the refactor is agreed upon
- The affected modules and interfaces are identified

## Steps
1. Examine the codebase for existing test coverage of the affected area.
2. Identify what is well-tested, what has gaps, and what has no coverage at all.
3. Look at the types of tests present — unit tests, integration tests, end-to-end tests.
4. Assess whether existing tests will catch regressions during the refactor.
5. If test coverage is insufficient, ask the user about their testing plans:
   - Will they add tests before refactoring (recommended)?
   - Will they add tests as part of the refactor?
   - Are there areas they consider too risky to refactor without tests?
6. Note any tests that will need to be updated as part of the refactor.
7. Identify prior art — similar types of tests in the codebase that can serve as patterns.

Ask (if coverage is insufficient): "Test coverage in this area is thin. What's your plan for testing — add tests first, or as part of the refactor?"

## Exit Criteria
- Test coverage of the affected area has been assessed
- Testing gaps are identified
- The user has a plan for testing (if coverage is insufficient)
- Tests that need updating are noted

## Next Phase
→ Load `plan-refactor-commit-plan.md`