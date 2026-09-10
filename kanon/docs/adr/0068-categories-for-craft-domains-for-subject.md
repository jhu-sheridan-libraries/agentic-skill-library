# ADR-0068: Categories for Craft, Domains for Subject

## Status

Proposed

## Date

2026-09-08

## Context

Knowledge artifacts carry a single `categories` field drawn from a controlled
developer-tooling enum: `security`, `testing`, `code-style`, `devops`,
`documentation`, `architecture`, `debugging`, `performance`, `accessibility`,
`writing` (ADR-0007). That enum answers one question — *what engineering skill
does this artifact encode?* — and answers it well.

But it is the *only* classification axis available, so it is forced to carry a
second, unrelated question: *what is this artifact about?* A Johns Hopkins
promotions-CV skill (`jhsomcv`) is, in craft terms, `documentation`; its
*subject* is academic medicine. With only `categories`, the subject is
inexpressible, and the artifact reads as generic "documentation" — so a person
looking for "all Johns Hopkins artifacts" or "all healthcare artifacts" cannot
find it. Collapsing subject matter into the craft enum both loses a real filter
dimension and pressures the enum to grow domain terms it was never meant to hold.

The two questions are orthogonal: an artifact's craft (a debugging skill, a
writing skill) is independent of its subject (finance, academic libraries,
publishing). They belong on separate axes.

A secondary concern: subject matter is open-ended and cannot be enumerated
upfront, so a controlled enum is the wrong tool. But a purely freeform field
fragments — the existing `ecosystem` field already shows how `k8s` /
`kubernetes` / `kube` drift apart with no canonical form. A subject axis meant
for discovery needs openness *and* a nudge toward consistency.

A third concern surfaced while defining the model: the `harnesses` field
contains vendor names. If the governing invariant is "no vendor on an intrinsic
classification axis," `harnesses` would appear to violate it — unless the model
explicitly says what `harnesses` *is*.

This ADR is the Craft/Subject-axis half of the
`vendor-neutral-formats-categories` spec (Requirements 6–8, 12, 13) and the
companion to ADR-0067.

## Decision

**Separate the craft axis from the subject axis. Keep `categories` as the
controlled craft enum; add a curation-owned, freeform `domains` field for
subject matter, governed by a warning rather than a closed enum.**

1. **`categories` stays as-is** — a controlled `CategoryEnum`, invalid values
   remain schema errors, no existing value removed. It continues to mean
   *technical craft* only (ADR-0007 unchanged).
2. **Add `domains`** — an optional, default-empty array of freeform kebab-case
   strings answering *what is it about?* It is curation-owned: import does not
   populate it from upstream, and re-sync preserves an author's values. The two
   axes are independent — an artifact may declare any combination of Category
   and Domain values, and a `domains` value is never validated against
   `CategoryEnum` nor vice versa.
3. **Govern `domains` by warning, not by enum.** A `Known_Domains_Registry`
   lists recognized domains. A well-formed value not in the registry produces a
   *warning* (never an error), suggesting the closest known domain when one is
   near (steering `k8s` → `kubernetes`). Adding a recognized domain is a
   one-line append with no schema change. This is the same warn-on-non-canonical
   mechanism ADR-0007 chose for unresolved `depends`/`enhances` references,
   extended from "does it exist" to "is it canonical."
4. **Define `harnesses` as the Destination axis, not a classification.** It is
   the export-target allow-list — which harnesses an artifact may be built for —
   and is therefore the one frontmatter field that legitimately contains vendor
   names. It is explicitly exempted from the "no vendor in frontmatter"
   invariant, so the invariant does not contradict itself.
5. **Surface `domains` in the catalog and browse UI** as a facet distinct from
   `categories`, and render domain values distinctly in the artifact detail view.

The separation, governance, and `harnesses` placement are enforced by the
model-invariant check (the spec's Part C), which verifies that no intrinsic-axis
value is a harness name and that only the Destination/Origin fields carry vendor
identity.

Worked example (`jhsomcv`):

```yaml
categories: [documentation]                 # craft: it formats a document
domains: [academic, healthcare, publishing] # subject: what it is about
```

This is an additive schema change mirroring the existing `ecosystem` field; no
existing field's behavior changes and no harness output is affected by `domains`
on its own.

## Consequences

### Positive

- Craft and subject become independently filterable; "all healthcare artifacts"
  and "all debugging skills" are separate, answerable queries.
- The `categories` enum is relieved of pressure to grow domain terms, keeping the
  craft taxonomy coherent.
- `domains` stays open for genuinely new subjects while resisting the
  near-duplicate fragmentation that a purely freeform field (like `ecosystem`)
  suffers.
- Defining `harnesses` as the Destination axis removes the apparent
  self-contradiction in the "no vendor on intrinsic axes" invariant.

### Negative

- One more freeform field to curate; the `Known_Domains_Registry` must be
  maintained and its warnings triaged (mitigated: warnings never block, and
  adding a domain is trivial).
- Two adjacent array fields (`categories`, `domains`) invite author confusion
  about which holds what; mitigated by the worked example and author guidance.
- Existing artifacts gain a subject axis they have not populated yet; back-filling
  `domains` across the catalog is a separate curation task, not part of this ADR.

### Neutral

- `domains` defaults to empty and produces no harness output on its own, so the
  change is fully backward compatible — existing artifacts parse, validate,
  build, and catalog unchanged except for the added (empty) field.
- Keeping `domains` freeform-with-warning rather than a second enum is a
  deliberate departure from `categories`' controlled-enum treatment, justified by
  subject matter being open-ended where craft is bounded.
- The `harnesses` clarification changes no runtime behavior; it only states the
  field's place in the model.

## Links and References

- Spec: `.kiro/specs/vendor-neutral-formats-categories/` (Requirements 6–8, 12, 13; Design Part B)
- Extends: [ADR-0007](./0007-controlled-enum-for-categories.md) — controlled enum for categories, freeform-with-warning for open-ended fields
- Companion: ADR-0067 (format identifiers describe structure, not vendor) — the Structure-axis half of the same spec
- Superseded/completed by: ADR-0069 (complete axis inventory) — places `domains` on the Subject axis and `ecosystem`/`depends`/`enhances` on their own axes within the full model
- Implementation (planned): `kanon/src/schemas.ts` (`domains` on FrontmatterSchema + CatalogEntrySchema), `kanon/src/domains.ts` (`KNOWN_DOMAINS`, `closestKnownDomain`), `kanon/src/validate.ts` (governance warning + model-invariant check), `kanon/src/browse-ui.ts` (Domain facet)
