# ADR-0063: Non-strict profile schemas for Zod 4 shape access

## Status

Accepted

## Date

2026-08-27

## Context

ADR-0053 established a key design rule for Rosetta Stone schemas: "Object schemas use `.strict()` unless an explicit extension map exists." Accordingly, `AcquisitionProfileSchema` and `TranslationProfileSchema` in `src/schemas.ts` were both declared with `.strict()`, rejecting any unknown fields in acquisition and translation profile configuration.

Under Zod 4, calling `.strict()` on an object schema changes the returned type such that the `.shape` property is no longer directly accessible on the schema. The rosetta-docs-generator and its tests introspect these profile schemas via `.shape` to enumerate fields and generate documentation. With `.strict()` applied, that introspection breaks at the type level.

A prior fix (commit `c352d76`) removed `.strict()` from `AcquisitionProfileSchema` to restore `.shape` access, but did so for only one of the two profile schemas despite the commit message stating both. This left the codebase in an inconsistent, half-migrated state: `AcquisitionProfileSchema` was non-strict while `TranslationProfileSchema` remained strict, and two config tests still asserted strict unknown-field rejection — one failing, one passing. The inconsistency surfaced as a failing test that blocked the v0.7.1 release.

## Decision

Both `AcquisitionProfileSchema` and `TranslationProfileSchema` are declared as plain (non-strict) Zod objects. Neither calls `.strict()`.

Consequences of this choice, made explicit:

- Both profile schemas expose `.shape` for the rosetta-docs-generator and its tests to introspect.
- Unknown fields in acquisition and translation profiles are no longer rejected. Zod's default object behavior strips unknown keys during parsing rather than raising a validation error, so unknown fields are silently dropped from the parsed result.
- The config tests that previously asserted strict rejection are updated to assert the non-strict contract: parsing succeeds and the unknown field is absent from the parsed output.
- This is a scoped, deliberate exception to the ADR-0053 rule "object schemas use `.strict()`", applying only to these two configuration profile schemas that require `.shape` introspection. The general ADR-0053 rule remains in force for all other Rosetta Stone schemas.

## Consequences

### Positive

- The rosetta-docs-generator can introspect both profile schemas via `.shape` under Zod 4.
- The two profile schemas are consistent with each other again, removing the half-migrated state.
- The config test suite reflects the actual validation contract, unblocking the release gate.

### Negative

- Unknown fields in acquisition/translation profiles are silently stripped rather than rejected, so a user typo in a profile key (e.g. `branchh` instead of `branch`) is no longer caught by schema validation and is quietly ignored.
- This narrows the ADR-0053 "strict by default" guarantee: the two profile schemas are now documented exceptions, so the rule is no longer universal across Rosetta Stone schemas.

### Neutral

- Field-level validation (types, required fields, path-safety refinements, credential checks) is unaffected; only unknown-key rejection changes.
- If Zod later restores `.shape` access on strict schemas, or the docs-generator switches to a different introspection mechanism, these schemas could be returned to `.strict()` and this ADR superseded.
