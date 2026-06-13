---
inclusion: always
description: "Testing patterns and strategies for writing reliable, maintainable test suites."
---

# Testing Patterns and Strategies

Apply these testing conventions to build reliable, maintainable test suites that catch regressions early.

## Test Structure

- Write tests before or alongside implementation to ensure coverage from the start.
- Use descriptive test names that explain the expected behaviour and context.
- Keep test assertions focused: one logical assertion per test case.
- Organize tests by feature or module, mirroring the source directory structure.

## Test Types

- Unit tests: verify individual functions and classes in isolation.
- Integration tests: verify interactions between modules and external dependencies.
- Property-based tests: generate random inputs to discover edge cases automatically.
- End-to-end tests: verify complete user workflows through the system.

## Best Practices for Maintainable Tests

- Avoid deeply nested test setups; prefer factory functions and builders.
- Use consistent file and directory naming conventions for test files.
- Cover the happy path, edge cases, and known failure modes.
- Prefer fail-fast behaviour: tests should fail clearly with informative messages.
- Log errors with sufficient context for debugging when tests report failures.

## Code Review for Tests

- Review test code with the same rigour as production code.
- Flag potential performance issues in test suites only when measurable.
- Ensure tests are deterministic: no reliance on timing, external state, or randomness without seeding.
- Approve when the test correctly verifies the documented behaviour.
