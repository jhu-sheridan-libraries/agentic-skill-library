# ADR-0040: DES-style hook execution with gate / postcondition / state

## Status

Proposed

## Date

2026-05-11

## Context

Canonical hooks (`hooks.yaml`) today are stateless and unconditional: each hook
binds an `event` (optionally filtered by `condition`) to a single `action`
(`ask_agent` or `run_command`). There is no way to express that a hook should
only fire when some precondition holds, to assert that an action produced the
intended result, or to share information between hooks in a run.

The DES-style hook execution requirement (Req 3 of the nWave forge integration)
introduces a discrete-event-simulation flavored execution model where hooks run
in declaration order over a shared state context:

- A **gate** is a boolean precondition expression; the action runs only when the
  gate evaluates true, otherwise the hook is skipped with a warning (Req 3.1, 3.2).
- A **postcondition** is a boolean expression evaluated after the action; a false
  postcondition halts the run with a non-zero result (Req 3.3, 3.4).
- **state** is a set of string/boolean key-value writes a hook contributes to the
  shared context; writes from earlier hooks are visible to later hooks' gate and
  postcondition expressions (Req 3.5, 3.9).

Expressions reference two kinds of symbols: declared **state keys** and a fixed
set of **built-in predicates** (`tests_pass`, `files_exist`, `lint_clean`).
Evaluation, reference collection, and reference validation are pure; predicate
resolution and action execution are I/O injected at the edges.

This is a new architectural pattern. Existing hook ADRs (and the import/adapter
ADRs that touch hooks) describe a stateless event→action mapping; none of them
cover conditional gating, postcondition assertions, a shared state context, or an
expression language. The schema additions land first (this decision); the pure
expression engine (`src/hooks/expression.ts`), the pure pipeline
(`src/hooks/pipeline.ts`), reference validation in `validate.ts`, and the Kiro
adapter gate→preamble translation build on them in subsequent tasks.

## Decision

Add a reusable value schema and extend the canonical hook schema in
`src/schemas.ts`:

- `HookStateValueSchema = z.union([z.string(), z.boolean()])` — the value type a
  hook may write into shared state. Restricting to string/boolean keeps
  expression comparisons against literals deterministic and avoids the ambiguity
  of comparing structured values.
- `CanonicalHookSchema` gains three **optional** fields:
  - `gate: z.string().optional()`
  - `postcondition: z.string().optional()`
  - `state: z.record(z.string(), HookStateValueSchema).optional()`

All three fields are optional so existing `hooks.yaml` files validate and compile
unchanged — a hook without `gate`, `postcondition`, or `state` behaves exactly as
it does today. This follows the optional-with-defaults, schema-additive,
backward-compatible approach established by ADR-0015 and reaffirmed by ADR-0039,
and keeps validation centralized in Zod per ADR-0002.

Gate and postcondition are stored as raw expression **strings** in the schema
rather than a pre-parsed AST. Parsing, reference collection, and evaluation are
the responsibility of the pure expression engine added in later tasks, keeping
the schema a thin data contract and leaving the grammar free to evolve without
schema churn.

The execution engine itself is designed as pure functions with predicate
resolution and action execution injected as callbacks (consistent with the
pure-core / thin-I/O-shell principle and ADR-0003's pure-adapter convention), so
ordering, gating, state threading, and halting logic are exhaustively testable
without I/O. That engine is out of scope for this schema decision but motivates
the shape chosen here.

## Consequences

### Positive

- Hooks gain conditional execution, result assertion, and inter-hook
  communication, expressed declaratively in the canonical format.
- Backward compatible: all three fields are optional, so existing artifacts and
  hook files validate and build unchanged.
- Restricting state values to string/boolean keeps the forthcoming expression
  language simple and deterministic, which is important for the property-based
  tests planned for the engine.
- Provides the schema foundation the pure expression engine, pipeline, reference
  validation, and Kiro gate-translation build on in later tasks.

### Negative

- The hook schema grows three fields ahead of the engine that gives them effect;
  until the expression engine and pipeline ship, the fields are inert data.
- Introduces an expression language surface that authors must learn, and that the
  forthcoming validator must guard (undefined state keys, unknown predicates).
- Harnesses without native conditional-hook support require degradation (e.g.
  the Kiro adapter renders a gate as a natural-language preamble), so semantics
  are approximate on those targets.

### Neutral

- `gate`, `postcondition`, and `state` join the canonical hook vocabulary
  alongside `event`, `condition`, and `action`; scaffold templates and docs may
  later surface them as commented stubs.
- Storing expressions as strings defers the grammar definition to the engine
  tasks, where it can be specified and tested in one place.
