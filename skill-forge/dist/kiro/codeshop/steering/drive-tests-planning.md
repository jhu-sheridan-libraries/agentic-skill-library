<!-- forge:version 0.1.6 -->
# Planning

## Entry Criteria
- The user has described a feature to build or a bug to fix using TDD
- There is a clear understanding of the problem domain
- A test runner is configured in the project

## Steps
1. Confirm with the user what interface changes are needed — what should the public API look like?
2. Confirm with the user which behaviors to test and prioritize them. You cannot test everything — focus testing effort on critical paths and complex logic, not every possible edge case.
3. Identify opportunities for deep modules (see POWER.md Shared Concepts): look for places where a small interface can hide significant implementation complexity.
4. Design interfaces for testability:
   - Accept dependencies, do not create them (dependency injection)
   - Return results, do not produce side effects
   - Keep the surface area small — fewer methods, simpler parameters
5. List the behaviors to test — describe observable behaviors, not implementation steps.
6. Get user approval on the plan before writing any code.

Ask: "What should the public interface look like? Which behaviors are most important to test?"

## Exit Criteria
- The user has approved the list of behaviors to test
- Interface changes are agreed upon
- Deep module opportunities have been identified
- The plan is prioritized and ready for the tracer bullet

## Next Phase
→ Load `drive-tests-tracer-bullet.md`