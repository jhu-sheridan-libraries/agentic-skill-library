<!-- forge:version 0.1.7 -->
# Refactor

## Entry Criteria
- All tests from the incremental loop pass (you are GREEN)
- All planned behaviors have been implemented and tested
- Never enter this phase while RED — get to GREEN first

## Steps
1. Review the code written during the incremental loop and look for refactor candidates:
   - **Duplication** → Extract function or class
   - **Long methods** → Break into private helpers (keep tests on the public interface)
   - **Shallow modules** → Combine or deepen (move complexity behind simpler interfaces)
   - **Feature envy** → Move logic to where the data lives
   - **Primitive obsession** → Introduce value objects
   - **Existing code** the new code reveals as problematic — consider what the new code teaches you about the codebase
2. Apply SOLID principles where they arise naturally — do not force them.
3. After each refactor step, run all tests. They MUST still pass. If a test breaks during refactoring, the test was coupled to implementation — fix the test or reconsider the refactor.
4. Look for opportunities to deepen modules: can you reduce the number of methods? Simplify parameters? Hide more complexity inside?
5. Repeat until the code is clean and all tests pass.

**Critical rule**: Never refactor while RED. If a test is failing, fix the code to make it pass before refactoring. Refactoring happens only when all tests are GREEN.

## Exit Criteria
- All tests still pass after refactoring
- Duplication has been extracted
- Modules are as deep as practical
- The code is clean and ready for review

## Next Phase
→ Workflow complete. See the Workflow Composition section in POWER.md for natural next steps (e.g., `review-changes` → `craft-commits`).