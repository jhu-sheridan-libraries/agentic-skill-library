# Testing Guide

> Test obligations for new formats, extensions, and Rosetta Stone contributions.

## Test Categories

Rosetta Stone uses four test categories, all run with `bun test`:

| Category | File Pattern | Purpose |
|---|---|---|
| Property tests | `rosetta-property-*.property.test.ts` | Verify universal invariants across random inputs |
| Unit tests | `rosetta-*.test.ts` | Pin specific behavior and edge cases |
| Regression tests | `rosetta-legacy-*.test.ts` | Ensure behavioral equivalence with legacy paths |
| Architecture tests | `rosetta-architecture.test.ts` | Enforce import boundaries |

## Property Test Obligations

Every new format/extension must validate these properties:

### Source Translators

1. **Complete source accounting** (Property 7 pattern) — Every source document
   is consumed, preserved, or diagnosed. No silent data loss.

2. **Order-independent translation** (Property 9 pattern) — Permuting document
   order produces canonically equivalent artifacts.

3. **Round-trip stability** (Property 11 pattern) — If a pretty-printer is
   provided, `parse → print → parse` yields the same canonical artifact.

### Target Translators

4. **Format contract conformance** (Property 14 pattern) — Output plan satisfies
   the declared compatibility profile and variant contract.

5. **Extensional determinism** (Property 15 pattern) — Canonically equivalent
   input produces byte-identical output.

6. **Observable effective options** (Property 16 pattern) — Each declared option
   change is observable in the output.

### Example: Writing a Source Accounting Property Test

```typescript
import { describe, test, expect } from "bun:test";
import fc from "fast-check";
import { createRegistryBuilder, createEngine } from "../rosetta";

describe("my-format source accounting", () => {
  test("every source document is accounted for", () => {
    // Validates: Requirements 4.1, 4.2, 4.3, 4.4
    fc.assert(
      fc.property(
        myFormatDocumentArbitrary(),
        (documents) => {
          const result = engine.translate({
            mode: "inbound",
            documents,
            sourceFormat: "my-format",
          });

          if (result.status === "failure") return; // schema error, not accounting

          // Every input document must appear in accounting
          for (const doc of documents) {
            const accounted =
              result.diagnostics.some(d =>
                d.code === "RS_SOURCE_UNACCOUNTED" &&
                d.sourceLocation?.path === doc.path
              ) === false;
            expect(accounted).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

## Fixture Test Obligations

Pin representative inputs and expected outputs:

1. **Minimal valid input** — The smallest document set that produces a valid artifact
2. **Full-featured input** — Exercise all supported fields and capabilities
3. **Degradation cases** — Inputs triggering partial/none compatibility
4. **Error cases** — Invalid inputs that produce blocking diagnostics
5. **Legacy equivalence** — Compare output with the legacy adapter/importer path

## Architecture Boundary Compliance

The architecture test (`rosetta-architecture.test.ts`) scans imports in
`src/rosetta/**` and rejects:

- `node:fs` or any filesystem module
- `node:child_process` or subprocess execution
- `node:net`, `node:http`, `node:https`, or network access
- `process.env`, `process.cwd()`, or environment reads
- `Date.now()`, `Math.random()`, or non-deterministic APIs
- `@clack/prompts` or interactive I/O

Extensions must pass this scan. If your translator needs filesystem access,
it does not belong in `src/rosetta/` — put I/O in the shell layer.

## Running Tests

```bash
# Run all Rosetta Stone tests
bun test src/__tests__/rosetta-*.test.ts

# Run a specific property test
bun test --test-name-pattern="source accounting"

# Run the full suite
bun test

# Type check
bun x tsc --noEmit
```

## Fast-Check Configuration

Property tests use these defaults:

- **numRuns**: 100 minimum (higher for critical properties)
- **Shrinking**: Enabled — counterexamples are minimized automatically
- **Seed**: Not fixed — different runs explore different input space
- **Verbose**: Only on failure — shows the shrunk counterexample

When a property test fails, the framework reports the minimized counterexample.
This output must be preserved unmodified in test failure reports.

## Test Helpers

Use the shared arbitraries from `src/__tests__/rosetta-arbitraries.ts`:

```typescript
import {
  arbitraryArtifact,
  arbitrarySourceDocument,
  arbitraryFormatContract,
  arbitraryDiagnostic,
  arbitrarySensitiveCanary,
} from "./rosetta-arbitraries";
```

These generate valid, bounded inputs suitable for property testing without
producing pathological sizes that slow test execution.
