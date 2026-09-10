# ADR-0069: Canonical Frontmatter Axis Inventory

## Status

Proposed

## Date

2026-09-10

## Context

Kanon recognizes roughly thirty top-level canonical frontmatter keys through `FrontmatterSchema` and `getKnownFrontmatterKeys()`. Those keys answer different questions: artifact identity, structural kind, semantic classification, technical applicability, relationships, governance, lifecycle, declared outcomes, source lineage, and harness distribution.

The earlier draft of this ADR attempted a complete inventory but did not match the implemented model. It included a nonexistent `domains` key, placed `outcomes` under Destination, treated presentation fields as one residual axis, assumed private Zod shape access, and proposed recursively rejecting harness-name strings across arbitrary intrinsic metadata. It also treated every passthrough field as if it belonged to the closed canonical schema, even though Kanon intentionally preserves unknown extension keys.

Two external repositories provide useful categorical counterexamples:

- Academic Research Skills separates functional skill identity from skill-scoped modes, spectrum, oversight, task type, data-access level, phase controls, install channels, and mechanism availability. The same content can have different active controls by channel.
- SciAgent-Skills separates one primary domain category, one behavioral subtype (`pipeline | toolkit | database | guide`), sparse cross-cutting tags, and bundled resource roles. Registry-to-file parity is checked in both directions.

These models reinforce an orthogonality rule: category, subtype, mode, control posture, harness representation, and delivery channel are independent dimensions. Kanon should classify only concepts it currently persists and should define an explicit extension rule for future dimensions.

The current architecture also establishes relevant boundaries:

- ADR-0014 makes `type` the canonical asset taxonomy rather than an output selector.
- ADR-0051 deprecates only `type: power`; Kiro power remains a harness-native format.
- ADR-0050 keeps asset-type compatibility separate from feature capability and degradation.
- Rosetta built-in contracts own harness format variants and defaults; `HARNESS_FORMAT_REGISTRY` is a projection.
- `getKnownFrontmatterKeys()` includes declared fields and recognized validated passthrough keys such as `harness-config`, while unknown passthrough keys remain `extraFields` for round-trip preservation.

## Decision

Adopt a closed ten-axis inventory for the canonical keys Kanon recognizes today.

| Axis | Question | Canonical keys |
|---|---|---|
| Identity | How is the artifact identified and described? | `name`, `displayName`, `description`, `keywords`, `author`, `id` |
| Structure | What canonical kind is it? | `type` |
| Classification | Which controlled semantic classes describe it? | `categories` |
| Applicability | Which technical contexts does it apply to? | `ecosystem` |
| Relation | How does it connect to other artifacts or groups? | `depends`, `enhances`, `collections` |
| Governance | How is it handled, trusted, exposed, and ordered? | `license`, `trust`, `risk-level`, `audience`, `model-assumptions`, `visibility`, `priority` |
| Lifecycle | What is its version and replacement state? | `version`, `maturity`, `migrations`, `successor`, `replaces` |
| Behavior | What result or operating contract does it declare? | `outcomes` |
| Origin | Where did it come from and how is it credited? | `provenance`, `attribution` |
| Distribution | Where and under what inclusion/format controls is it emitted? | `harnesses`, `inclusion`, `file_patterns`, `harness-config`, `inherit-hooks` |

### Canonical key boundary

`getKnownFrontmatterKeys()` is the authority for total coverage. It includes recognized keys implemented through passthrough plus refinement. The implementation must not navigate `FrontmatterSchema._def` or introduce another hand-maintained schema-key list.

Unknown passthrough keys are not canonical keys. They remain preserved in `extraFields` but are outside the closed axis inventory until a schema decision recognizes them.

### Total and orthogonal registry

A readonly `FIELD_AXIS` record maps every canonical key to exactly one axis. Inventory validation compares the key set of that record with `getKnownFrontmatterKeys()` in both directions:

- a recognized canonical key without an assignment is an error;
- a stale assignment without a recognized canonical key is an error;
- all differences are reported deterministically;
- no artifact-content scan is required to establish registry parity.

The registry is the machine authority. Documentation is derived from it or checked against it.

### No generic vendor-name scan

The inventory does not recursively inspect descriptions, authors, licenses, model assumptions, lifecycle text, outcomes, or other arbitrary strings for equality with a harness name. Terms such as `cursor` can be legitimate prose. Vendor-neutrality checks must target typed vocabularies or explicitly identified classification fields.

### Structural and distribution boundaries

`type` remains Structure and does not select output format. `harness-config.<harness>.format`, resolved from Rosetta contracts and defaults, remains Distribution. Asset compatibility and feature capability/degradation remain separate support planes under ADR-0050.

`outcomes` belongs to Behavior because it declares intrinsic expected results (`specification | operation | invariant`) that survive representation across harnesses. `collections` belongs to Relation because it records group membership rather than display identity.

### Future extension rules

Future concepts are placed by the question they answer, not by copying an external repository's field names:

| Future concept | Default axis | Required decision |
|---|---|---|
| `profile` / `sub_type` | Structure | Closed values, allowed asset types, and identity semantics |
| tags / domain facets | Classification | Cardinality, vocabulary, aliases, and overlap with categories |
| mode | Behavior | Scope, composite identity, triggers, and output contract |
| spectrum / oversight / task type | Behavior or Governance | Controlled values and per-artifact constraints |
| data-access level | Governance | Allowed values and artifact-specific restrictions |
| bundled resource roles | Structure below artifact level | File/directory authority and inventory rules |
| distribution channel | Distribution | Harness relationship, delivery support, controls, and degradation |

Adding a genuinely independent axis requires a new ADR. Adding a field to an existing axis requires updating `FIELD_AXIS` in the same change.

## Consequences

### Positive

- Every recognized canonical key has one stated purpose and a mechanically enforced assignment.
- Recognized passthrough keys are covered without relying on private Zod internals.
- Unknown extension keys retain round-trip compatibility without weakening the closed canonical inventory.
- Outcomes, categories, type, format, compatibility, capability, and future channels remain conceptually independent.
- The external repository lessons inform extension rules without importing fields or vocabularies that Kanon does not persist.
- Bidirectional parity follows the strongest inventory pattern used by both reference repositories.

### Negative

- `FIELD_AXIS` is an additional registry that schema changes must update.
- Category semantics remain Kanon-specific; the current `categories` field does not by itself distinguish primary domain, subtype, or tags.
- Distribution channel remains unmodeled until a concrete use case justifies schema growth.

### Neutral

- No frontmatter field, default, parser result, adapter output, compatibility level, capability degradation, or catalog value changes as a direct result of this decision.
- Axis names are documentation and enforcement constructs, not persisted metadata.
- ADR-0068's proposed `domains` split is not adopted because `domains` is not a current canonical key.

## Links and References

- Spec: `.kiro/specs/complete-axis-inventory/`
- Related spec: `.kiro/specs/per-harness-artifact-type/`
- Builds on: [ADR-0007](./0007-controlled-enum-for-categories.md)
- Ratifies: [ADR-0014](./0014-repurpose-type-as-asset-taxonomy.md)
- Builds on: [ADR-0050](./0050-agent-compatibility-and-degradation-reconciliation.md)
- Ratifies: [ADR-0051](./0051-deprecate-power-as-asset-taxonomy-value.md)
- Replaces the axis inventory proposed in the earlier revision of ADR-0069
- Does not adopt: [ADR-0068](./0068-categories-for-craft-domains-for-subject.md)
- Planned implementation: `kanon/src/model-axes.ts`, canonical key parity in parser/Rosetta, and targeted validation/tests
