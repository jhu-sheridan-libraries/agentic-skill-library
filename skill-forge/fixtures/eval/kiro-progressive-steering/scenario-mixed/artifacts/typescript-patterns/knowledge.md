---
name: typescript-patterns
displayName: TypeScript Patterns
version: 1.0.0
description: TypeScript-specific patterns loaded when TypeScript files are in context.
keywords:
  - patterns
  - typescript
author: Eval Fixture
type: skill
inclusion: fileMatch
categories:
  - development
harnesses:
  - kiro
ecosystem: []
depends: []
enhances: []
maturity: stable
model-assumptions: []
harness-config:
  kiro:
    inclusion: fileMatch
    fileMatchPattern: "src/**/*.ts"
---

# TypeScript Patterns

When working with TypeScript files under `src/`:

- Prefer `interface` over `type` for object shapes that may be extended.
- Use `readonly` for properties that should not be reassigned after construction.
- Prefer discriminated unions over optional fields for state modeling.
- Use `satisfies` for type-safe object literals without widening.
- Avoid `any`; use `unknown` with type narrowing instead.
- Export types alongside their implementations for downstream consumers.
