# Register Outcomes

Declare the formal outcomes a piece of work will produce *before* writing code, so duplication is caught at design time instead of discovered after the fact. An outcome is a small, typed contract — a named result with an input shape, an output shape, and a few keywords. Once outcomes are registered across artifacts, an automated check compares every pair and flags overlap.

Think of it as a lightweight registry of "what this work promises to produce." Two pieces of work that promise the same shaped result for the same reason are almost certainly redundant.

## When to Use

- Before starting a new feature or module — declare what it will produce and check nothing already produces it
- During design review — make implicit contracts explicit and comparable
- When onboarding a body of work into a shared collection — detect spec-level duplication before merging
- When two teams may be solving the same problem independently — outcomes surface the overlap
- Before `design-interface` or `draft-prd` — outcomes give those workflows a concrete contract to design against

## When to Declare an Outcome

Declare an outcome when the work has a result worth contracting on. Good candidates:

- A transformation with a clear input and output (parse, normalize, render, compile)
- A query or lookup that returns a defined shape
- An invariant the system must uphold (a rule that is always true after an operation)

Do not declare an outcome for incidental helpers, internal glue, or anything whose shape is uninteresting to other work. The registry is most useful when it captures the *meaningful* promises, not every function.

Each outcome has one of three **kinds**:

- **specification** — a described behavior or transformation (most outcomes)
- **operation** — an action with side effects whose result shape still matters
- **invariant** — a property that must hold; input shape is the precondition, output shape is the guaranteed post-state

## The Outcome Shape

An outcome is a named record with these fields:

| Field | Shape | Notes |
|-------|-------|-------|
| id | string | Globally unique, kebab-case, `out-` prefix (e.g. `out-normalize-address`) |
| kind | union: specification \| operation \| invariant | See kinds above |
| input-shape | string | A type-shape expression (see notation below) |
| output-shape | string | A type-shape expression |
| summary | string | One short sentence, kept brief |
| keywords | list of string | A handful of lowercase tokens describing the domain |
| related | list of string | Optional. IDs of outcomes this one intentionally overlaps with |

## Type-Shape Notation

Shapes are written in a generic, language-neutral notation. Use only these constructs so that outcomes from any typed codebase compare cleanly:

- **Primitives**: `string`, `number`, `boolean`
- **Arrays / lists**: `string[]` — an ordered collection of one element type
- **Maps / dictionaries**: `map<string, number>` — keyed lookups
- **Tuples**: `(string, number)` — a fixed-length ordered group
- **Union types**: `string | number` — a value that is one of several types
- **Named record shapes**: `UserRecord`, `OrderLine` — a named structured value

Compose them freely: `(string, AddressRecord)[]`, `map<string, boolean>`, `OrderLine[] | null`.

Avoid anything tied to one language: no language-specific keywords, no concrete class or interface declarations, no syntax that only one ecosystem understands. The notation above is enough to express any contract worth registering.

## How Collision Detection Works

Detection runs over every unordered pair of outcomes in two tiers. Before any comparison, both shapes are **normalized** so that cosmetic differences do not hide real matches.

### Shape Normalization

Normalization canonicalizes a shape string through a fixed sequence of steps:

1. Strip leading and trailing whitespace.
2. Collapse internal runs of whitespace to a single space.
3. Lowercase everything.
4. Normalize the wrapped array form to the suffix form — a generic `array of T` is rewritten to `T[]`.
5. Strip parameter names from tuples — `(name: string, age: number)` becomes `(string, number)`.
6. Sort union members alphabetically — `string | number` and `number | string` both become `number | string`.

Normalization is deliberately *shallow*. It does **not**:

- Resolve aliases — a named shape is never treated as equal to the primitive it wraps (a `Path` is not a `string`).
- Erase generic parameters — `Result<string, Error>` is not the same as `Result<number, Error>`.
- Structurally compare records — `{ name: string }` is not the same as `UserRecord`.

This keeps the check honest: it catches things that are genuinely the same, and stays quiet about things that merely look similar.

### Tier 1 — Shape Match

Two outcomes match on Tier 1 when their normalized `(input-shape, output-shape)` tuples are exactly equal. Same input, same output, after normalization.

### Tier 2 — Keyword Overlap (Jaccard)

Two outcomes match on Tier 2 when their keyword sets are sufficiently similar. Keywords are first **tokenized**:

- Split each keyword on `-`, `_`, and whitespace.
- Drop tokens of 2 characters or fewer.
- Deduplicate into a set.

Similarity is then **Jaccard**: the size of the intersection divided by the size of the union of the two token sets. The score ranges from 0 (no shared tokens) to 1 (identical sets). Two empty sets score 0.

```
jaccard(A, B) = |A ∩ B| / |A ∪ B|
```

A pair matches on Tier 2 when the score is **≥ 0.4**.

## Verdict Matrix

The two tiers combine into a single verdict:

| Tier 1 (shapes) | Tier 2 (keywords) | Verdict |
|-----------------|-------------------|---------|
| match | match | **COLLISION** |
| match | no match | **AMBIGUOUS** |
| no match | match | **AMBIGUOUS** |
| no match | no match | **CLEAN** |

- **COLLISION** — both tiers match. The two outcomes promise the same shaped result for the same domain. Treated as an error.
- **AMBIGUOUS** — exactly one tier matches. The outcomes are suspiciously close: same shape but different vocabulary, or same vocabulary but different shape. Treated as a warning; worth a human glance.
- **CLEAN** — neither tier matches. No overlap.

Separately, **duplicate IDs** are always an error: outcome IDs must be globally unique across all artifacts, regardless of shape or keywords.

## Acknowledging Intentional Overlap

Sometimes two outcomes really do share a shape and vocabulary on purpose — two adapters that legitimately produce the same normalized result, for example. To record that the overlap is intended, have **both** outcomes list **each other's** id in their `related` field.

When a pair would be a COLLISION but each outcome names the other in `related`, the verdict is downgraded to **acknowledged-overlap** and no error is raised for that pair.

The acknowledgement must be mutual. If only one side lists the other, the COLLISION stands — this prevents a single author from silently suppressing a real conflict. Acknowledgement applies only to the specific pair; it does not exempt either outcome from colliding with a third.

## Resolution Workflow

When the check reports a finding, work through it like this:

1. **Read the finding.** A collision report names both outcome IDs, both artifact names, the matched shapes, and the Jaccard score. Start there.
2. **Decide if it is real.**
   - *Genuine duplication* — the two pieces of work produce the same result. Delete or merge one of them. This is the win the registry exists to deliver.
   - *Intentional overlap* — both are needed and the shared contract is deliberate. Acknowledge it with mutual `related` references.
   - *False alarm* — the shapes happen to coincide but the work is unrelated. Differentiate them: make the shapes more specific (named records instead of bare primitives) or adjust keywords so the vocabulary reflects the real difference.
3. **For AMBIGUOUS warnings,** confirm the near-miss is intended. Matching shapes with different keywords often means the same contract described two ways — align them or merge. Matching keywords with different shapes often means the same domain handled inconsistently — pick one shape.
4. **For duplicate IDs,** rename one. IDs are addresses; two things cannot share one.
5. **Re-run the check** until the only remaining findings are acknowledged-overlap or intentional CLEAN/AMBIGUOUS results.

## Tips

- Keep keywords in the domain vocabulary, not the implementation vocabulary. `address`, `postal`, `normalize` beats `util`, `helper`, `v2`.
- Prefer named record shapes over bare primitives for non-trivial results. `AddressRecord` collides less accidentally than `string`, and says more.
- A flurry of COLLISIONs early in a project is a good sign — it means the registry is catching duplication before code exists.
- Reserve `related` for overlap you can justify in one sentence. If you cannot, the honest move is to merge.
- Invariants are easy to forget to register. If a rule must always hold after an operation, it is an outcome worth contracting on.
