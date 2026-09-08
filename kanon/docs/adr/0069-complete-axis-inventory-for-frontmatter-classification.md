# ADR-0069: Complete Axis Inventory for Frontmatter Classification

## Status

Proposed

## Date

2026-09-08

## Context

The `vendor-neutral-formats-categories` spec (proposed ADR-0067 and ADR-0068)
established a classification model for knowledge artifacts built on a small set
of axes — Structure, Craft, Subject, Origin, Destination — plus a
`checkModelInvariants` guard whose Property-12 test fails if a *new*
intrinsic-axis field is added without being registered. That model was correct
but partial: it named only the fields those two refactors touched
(`categories`, `domains`, source-format `harness`, `harnesses`, `provenance`,
`attribution`). Most of `FrontmatterSchema` was never placed on an axis.

Auditing the current `FrontmatterSchema` (`kanon/src/schemas.ts`), a real
artifact carries roughly thirty top-level fields — `type`, `ecosystem`,
`depends`, `enhances`, `maturity`, `version`, `trust`, `risk-level`, `license`,
`audience`, `model-assumptions`, `visibility`, `priority`, `successor`,
`replaces`, `migrations`, `inclusion`, `file_patterns`, `harness-config`,
`inherit-hooks`, `outcomes`, the presentation fields (`name`, `displayName`,
`description`, `keywords`, `author`, `id`, `collections`), and more — the great
majority of which the model did not account for. Two consequences follow:

1. The guard's promise ("no field escapes the model") was not literally true:
   its field set was a partial map, so it could only catch omissions among the
   handful of fields it already knew about.
2. Three fields have a real, currently-implicit home that deserves to be stated,
   and one of them (`type`) has a decision history that this ADR should ratify
   rather than re-open:
   - **`type`** is the artifact's structural kind. ADR-0014 (repurpose `type`
     as an asset taxonomy) and ADR-0051 (deprecate `power` as a taxonomy value)
     already established that `type` is a pure taxonomy *decoupled from output
     format*: `resolveFormat()` never reads `frontmatter.type`; output format
     lives in `harness-config.<harness>.format`. The vendor-flavored value
     `power` was deprecated precisely because it belonged to output format
     (a Destination concern), not to Structure.
   - **`ecosystem`** answers a third question distinct from Craft and Subject:
     the technical context an artifact applies *to* (languages, runtimes,
     frameworks).
   - **`depends`/`enhances`** describe edges *between* artifacts, not a property
     of a single artifact; ADR-0007 already gave them a warn-on-unresolved
     referential-integrity check.

The model is therefore correct in principle but incomplete in coverage. A
classification model that leaves most fields unclassified is neither a reliable
guard nor an honest description of the schema.

## Decision

Adopt a **complete, closed axis inventory**: define the full set of axes and map
**every** `FrontmatterSchema` field to exactly one of them in a single
authoritative registry, then extend the invariant guard to enforce that the map
is total.

**The ten axes, in two bands.** Intrinsic axes describe what an artifact *is*,
*does*, or is *about* and never name a vendor; Edge axes describe where it came
from and where it goes, and are the only place vendor identity legitimately
appears.

| Band | Axis | Question | Fields |
|---|---|---|---|
| Intrinsic | Structure | what kind of artifact? | `type` |
| Intrinsic | Craft | what engineering skill? | `categories` |
| Intrinsic | Subject | what is it about? | `domains` |
| Intrinsic | Applicability | what technical context does it apply to? | `ecosystem` |
| Intrinsic | Relation | how does it relate to other artifacts? | `depends`, `enhances` |
| Intrinsic | Governance | how should it be trusted/handled? | `trust`, `risk-level`, `license`, `audience`, `model-assumptions`, `visibility` |
| Intrinsic | Lifecycle | where is it in its life? | `maturity`, `version`, `successor`, `replaces`, `migrations` |
| Intrinsic | Presentation | how is it identified/displayed? | `name`, `displayName`, `description`, `keywords`, `author`, `id`, `priority`, `collections` |
| Edge | Origin | where did it come from? | `provenance`, `attribution` |
| Edge | Destination | which harness discovers it, in what form? | `harnesses`, `inclusion`, `file_patterns`, `harness-config`, `inherit-hooks`, `outcomes` |

**A single source of truth.** A `FIELD_AXIS` registry maps each field to its
axis. It is the one place the invariant check, the extensibility guard test, and
the documentation table all derive from, so they cannot drift. The prior spec's
hand-maintained `VENDOR_BEARING_FIELDS` set is replaced by an
`EDGE_OR_VENDOR_BEARING` set *derived* from `FIELD_AXIS` (the origin + destination
fields), which now correctly includes `inclusion`, `file_patterns`,
`harness-config`, `inherit-hooks`, and `outcomes` alongside `harnesses`.

**Three properties, each mechanically checked:**

- **Complete** — every `FrontmatterSchema` field appears in `FIELD_AXIS`
  (Total_Coverage). `checkModelInvariants` errors on any field missing from the
  registry or any registry entry that is not a schema field.
- **Orthogonal** — every field maps to exactly one axis; a field's value is never
  validated against another axis's vocabulary. INV-1 (no `Harness_Name` on an
  Intrinsic-axis field) now ranges over *all* intrinsic fields, not just
  `categories`/`domains`.
- **Closed under growth** — the extensibility guard is generalized from
  "intrinsic-axis fields" to "all fields": adding any field to
  `FrontmatterSchema` without a `FIELD_AXIS` entry fails the build.

**Ratifications and placements:**

- `type` **is Structure**, carries no output-format meaning, and any future
  `type` value that would encode a vendor or an output format is directed to the
  Destination axis instead. This ratifies and builds on ADR-0014 and ADR-0051;
  it does not re-open them.
- `ecosystem` is its own **Applicability** axis; `depends`/`enhances` are the
  **Relation** axis; both remain freeform kebab-case with unchanged schema and
  behavior, and both are Intrinsic (so a `Harness_Name` is never a valid value).
- `outcomes` is placed on **Destination** as an export-capability contract — it
  declares what the artifact does when exported, not a classification of the
  artifact. This is the one genuine judgment call and is recorded here so the
  placement is not read as an arbitrary catch-all.

This is a classification-and-enforcement change only. No field's Zod definition,
default, or runtime behavior changes; build and catalog output remain
byte-identical. The axes are documentation/enforcement constructs and are not
added as new persisted frontmatter fields.

The axis set is **closed**: introducing a new classification concept requires
either assigning it to an existing axis or an explicit decision to add an axis,
recorded in a future ADR.

## Consequences

### Positive

- The guard's promise becomes literally true: no field escapes the model, and no
  field can be added in future without being placed on an axis.
- Every field has a stated, principled home; the schema is described by one
  authoritative table instead of a five-axis model plus an unclassified
  remainder.
- INV-1 now protects the whole intrinsic surface — a `Harness_Name` cannot leak
  into `type`, `ecosystem`, `depends`, governance, lifecycle, or presentation
  fields, not just `categories`/`domains`.
- `EDGE_OR_VENDOR_BEARING` is derived rather than hand-maintained, closing the
  gap where delivery-shaping fields (`inclusion`, `harness-config`, …) were not
  recognized as legitimate homes for vendor values.
- Ratifies the latent intent of ADR-0014/0051 (`type` = structure, decoupled
  from output format) instead of leaving it implicit in the code.

### Negative

- `FIELD_AXIS` is a second artifact that must stay in sync with
  `FrontmatterSchema`. This is mitigated — indeed inverted into a benefit — by
  the Total_Coverage error and the generalized guard test, which fail loudly on
  any drift; but it is still one more thing a schema change must touch.
- The `outcomes` → Destination placement is a defensible judgment, not a forced
  one; a future reviewer may reasonably argue it is a capability axis of its own.
  Recorded here so that debate is explicit rather than silent.

### Neutral

- No behavior, schema, default, build output, or catalog output changes; this is
  purely how fields are classified and how that classification is enforced.
- Field-behavior decisions in ADR-0007 (categories enum; warn-on-unresolved
  references), ADR-0014 (`type` taxonomy), and ADR-0051 (`power` deprecation)
  are unchanged and remain in force; this ADR completes the model *around* them.
- The prior spec's ADR-0067 (format identifiers describe structure, not vendor)
  and ADR-0068 (categories for craft, domains for subject) are the two-axis
  antecedents this inventory generalizes.

## Links and References

- Spec: `.kiro/specs/complete-axis-inventory/` (requirements, design, tasks)
- Builds on: [ADR-0007](./0007-controlled-enum-for-categories.md) — categories enum and the warn-on-unresolved-reference pattern (Relation axis integrity)
- Builds on: [ADR-0014](./0014-repurpose-type-as-asset-taxonomy.md) — `type` as asset taxonomy, decoupled from output format
- Ratifies: [ADR-0051](./0051-deprecate-power-as-asset-taxonomy-value.md) — `power` is a Destination (output-format) concept, not a Structure value
- Generalizes: ADR-0067 and ADR-0068 (proposed by the `vendor-neutral-formats-categories` spec)
- Implementation (planned): `kanon/src/model-axes.ts` (`FIELD_AXIS`, `INTRINSIC_AXES`), `kanon/src/validate.ts` (`checkModelInvariants` Total_Coverage + generalized INV-1)
