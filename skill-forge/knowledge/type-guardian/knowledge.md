---
name: type-guardian
displayName: Type Guardian
description: TypeScript type discipline — keep the compiler working for you, not against you.
keywords: [typescript, types, safety, strictness]
author: skill-forge
version: 0.2.0
type: skill
inclusion: always
categories: [code-style]
ecosystem: [typescript]
collections: [neon-caravan]
maturity: stable
trust: community
---

## Overview

Type Guardian enforces TypeScript type discipline — keeping the compiler working for you, not against you. Use it when writing, reviewing, or refactoring TypeScript code. These rules keep the type system useful rather than decorative.

TypeScript's value is proportional to how seriously you take it.

## Strictness baseline

Always enable `strict: true`. It subsumes `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, and others. If a codebase has `strict: false`, treat every type annotation as a suggestion, not a guarantee.

## Prefer explicit over inferred at boundaries

Infer freely inside functions. Be explicit at:
- Function return types on exported functions
- Public class properties
- Anything that crosses a module or API boundary

```typescript
// ✓ — inferred internally, explicit at boundary
export function parseVersion(raw: string): Version {
  const parts = raw.split('.').map(Number);
  return { major: parts[0], minor: parts[1], patch: parts[2] };
}
```

## Never reach for `any`

`any` is an escape hatch that silences the compiler without fixing anything.

- Use `unknown` when the type genuinely isn't known yet — it forces you to narrow before use
- Use `satisfies` to validate a value against a type while preserving a narrower inferred type
- Use generics when the type varies but the shape is consistent

## Discriminated unions over optional fields

Optional fields suggest "sometimes this exists" — discriminated unions make the condition explicit and exhaustion-checkable.

```typescript
// ✗
interface Result { data?: Data; error?: string; }

// ✓
type Result =
  | { ok: true;  data: Data }
  | { ok: false; error: string };
```

## `as` is a smell

A type assertion (`value as Foo`) overrides the compiler. Use it only when you have information the compiler cannot — e.g. after a runtime check that TypeScript can't see. Document why with a comment.

## Utility types as vocabulary

Know `Partial<T>`, `Required<T>`, `Readonly<T>`, `Pick<T, K>`, `Omit<T, K>`, `Record<K, V>`, `ReturnType<F>`, `Parameters<F>`, and `Extract`/`Exclude`. Using them signals intent and stays in sync with the base type automatically.

## Examples

**Discriminated union replacing optional fields:**
```typescript
// Before: unclear when data vs error exists
interface Result { data?: Data; error?: string; }

// After: exhaustion-checkable, no ambiguity
type Result =
  | { ok: true;  data: Data }
  | { ok: false; error: string };
```

**Using `unknown` instead of `any`:**
```typescript
// Before: silences the compiler
function parse(input: any) { return input.name; }

// After: forces narrowing before use
function parse(input: unknown): string {
  if (typeof input === 'object' && input !== null && 'name' in input) {
    return String((input as { name: unknown }).name);
  }
  throw new Error('Invalid input');
}
```

## Troubleshooting

**"Type 'X' is not assignable to type 'Y'":** Don't reach for `as`. Check if the source type is genuinely compatible. If not, narrow with a type guard or adjust the type definition.

**Strict mode breaks existing code:** Enable strict incrementally — start with `noImplicitAny`, then `strictNullChecks`, then full `strict: true`. Fix errors in batches.

**Utility type confusion:** `Pick` selects fields, `Omit` removes them, `Partial` makes all optional, `Required` makes all required. If you're manually redefining a subset of an existing type, there's probably a utility type for it.
