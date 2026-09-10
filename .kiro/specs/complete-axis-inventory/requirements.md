# Requirements Document

## Introduction

The `vendor-neutral-formats-categories` spec established a classification model with five axes — Structure, Craft, Subject, Origin, Destination — and a `checkModelInvariants` guard that fails if a *new* intrinsic-axis field is added without being registered. But that model classified only the fields that refactor touched. Most of `FrontmatterSchema` — `type`, `ecosystem`, `depends`, `enhances`, and the whole governance/lifecycle block (`maturity`, `trust`, `risk-level`, `audience`, `visibility`, `priority`, `license`, `successor`, `replaces`, …) — was never placed on an axis. The model is therefore *correct but incomplete*: a real artifact carries many fields the model does not account for, and the guard's field set is a partial map.

This spec **completes the axis inventory**. It defines the full, closed set of axes and assigns **every** frontmatter field to exactly one of them, so that:

- `type` is ratified as the **Structure** axis (finishing what ADR-0051 began when it moved the vendor-flavored `power` value off `type` and onto `harness-config.kiro.format`);
- `ecosystem` gets its own **Applicability** axis (the technical context an artifact applies *to* — languages, runtimes, frameworks), distinct from Craft (what skill it encodes) and Subject (what it is about);
- `depends`/`enhances` get their own **Relation** axis (edges to other artifacts), which is neither a property of the artifact nor a vendor concern;
- the governance/lifecycle/presentation fields are named as first-class axes (**Governance**, **Lifecycle**, **Presentation**) rather than an unclassified remainder;
- and the `checkModelInvariants` guard is extended to a **total** field-to-axis map, so the guard's promise ("no field escapes the model") becomes literally true.

The elegance target is a model that is **complete** (every field placed), **orthogonal** (each field on exactly one axis, each axis answering one question), and **closed under growth** (a new field cannot be added without assigning it an axis, enforced by the existing guard test). No field behavior changes; this is a classification and enforcement refactor, fully backward compatible.

## Glossary

- **Kanon_CLI**: The `kanon` (aka `forge`) TypeScript CLI on Bun (`import`, `build`, `install`, `validate`, `catalog`, `rosetta`, …).
- **Knowledge_Artifact**: A directory under `knowledge/` with a `knowledge.md` and optional supporting files — the harness-agnostic canonical source of truth.
- **FrontmatterSchema**: The Zod schema in `src/schemas.ts` validating `knowledge.md` YAML frontmatter.
- **Frontmatter_Field**: A single top-level key defined on FrontmatterSchema (e.g. `type`, `ecosystem`, `maturity`).
- **Classification_Model**: The complete, closed set of Axes plus the total mapping of every Frontmatter_Field to exactly one Axis.
- **Axis**: One dimension of the Classification_Model. Each Axis answers exactly one question about an artifact and owns a disjoint set of Frontmatter_Fields.
- **Intrinsic_Axis**: An Axis describing what an artifact *is*, *does*, or is *about* (Structure, Craft, Subject, Applicability, Relation), as opposed to Origin (where it came from) or Destination (where it is sent). Subject to the "no vendor" invariant.
- **Edge_Axis**: Origin or Destination — the two Axes at which vendor identity legitimately appears (recorded origin; export target).
- **Structure_Axis**: The Axis answering "what shape/kind of artifact is this?", owned by `type` (an `AssetType`), decoupled from output format per ADR-0051.
- **Craft_Axis**: The Axis answering "what engineering skill does it encode?", owned by `categories` (controlled enum).
- **Subject_Axis**: The Axis answering "what is it about?", owned by `domains` (freeform, governed by warning).
- **Applicability_Axis**: The Axis answering "what technical context does it apply to?", owned by `ecosystem` (freeform: languages, runtimes, frameworks).
- **Relation_Axis**: The Axis answering "how does it relate to other artifacts?", owned by `depends` and `enhances` (edges by artifact name).
- **Governance_Axis**: The Axis answering "how should it be trusted/handled?", owned by `trust`, `risk-level`, `license`, `audience`, `model-assumptions`, `visibility`.
- **Lifecycle_Axis**: The Axis answering "where is it in its life?", owned by `maturity`, `version`, `successor`, `replaces`, `migrations`.
- **Presentation_Axis**: The Axis answering "how is it identified and displayed?", owned by `name`, `displayName`, `description`, `keywords`, `author`, `id`, `priority`, `collections`.
- **Origin_Axis**: The Edge_Axis answering "where did it come from?", owned by `provenance` (machine) and `attribution` (curation).
- **Destination_Axis**: The Edge_Axis answering "which harness discovers it, and in what output form?", owned by `harnesses`, `inclusion`, `file_patterns`, `harness-config`, and `inherit-hooks`.
- **Model_Invariant**: A property the Classification_Model guarantees across all artifacts and contracts (INV-1 no vendor on an Intrinsic_Axis, INV-2 orthogonality, INV-3 vendor at the edge only — carried over from the prior spec).
- **Axis_Assignment**: The declaration, in one authoritative table/registry, of which Axis a given Frontmatter_Field belongs to.
- **Axis_Registry**: The single source of truth (a `FIELD_AXIS` map) mapping every Frontmatter_Field to its Axis, consumed by `checkModelInvariants` and its extensibility guard.
- **Model_Invariant_Check**: `checkModelInvariants` in `src/validate.ts`, extended by this spec to consult the Axis_Registry so its field coverage is total.
- **Total_Coverage**: The property that every Frontmatter_Field appears in the Axis_Registry exactly once — no field is unclassified and none is on two Axes.
- **ArtifactType / AssetType**: The `type` enum (`skill | rule | workflow | agent | prompt | template | reference-pack`, plus deprecated `power`).

## Requirements

### Requirement 1: A Complete, Closed Axis Set

**User Story:** As a maintainer, I want the classification model to define a complete, named set of axes rather than five axes plus an unclassified remainder, so that every artifact field has a principled home and the model is a coherent whole.

#### Acceptance Criteria

1. THE Classification_Model SHALL define exactly these Axes: Structure, Craft, Subject, Applicability, Relation, Governance, Lifecycle, Presentation, Origin, Destination.
2. THE Classification_Model SHALL designate Structure, Craft, Subject, Applicability, and Relation as Intrinsic_Axes, and Origin and Destination as Edge_Axes.
3. THE Classification_Model SHALL define each Axis as answering exactly one question, documented in a single authoritative table.
4. THE set of Axes SHALL be closed: introducing a new classification concept SHALL require either assigning it to an existing Axis or an explicit decision to add an Axis, recorded in an ADR.
5. THE Model_Invariants (INV-1, INV-2, INV-3) from the prior spec SHALL continue to hold unchanged under the completed Axis set.

### Requirement 2: Total Field-to-Axis Mapping

**User Story:** As a maintainer, I want every frontmatter field assigned to exactly one axis, so that the model leaves nothing unclassified and the invariant guard can make a total promise.

#### Acceptance Criteria

1. THE Axis_Registry SHALL map every Frontmatter_Field defined on FrontmatterSchema to exactly one Axis (Total_Coverage).
2. THE Axis_Registry SHALL NOT map any Frontmatter_Field to more than one Axis.
3. WHEN a Frontmatter_Field exists on FrontmatterSchema but is absent from the Axis_Registry, THE Model_Invariant_Check SHALL fail with an error naming the unclassified field.
4. WHEN the Axis_Registry maps a name that is not a Frontmatter_Field on FrontmatterSchema, THE Model_Invariant_Check SHALL fail with an error naming the stale entry.
5. THE Axis_Registry SHALL be the single source of truth consumed by the Model_Invariant_Check and its extensibility guard.

### Requirement 3: `type` Is the Structure Axis

**User Story:** As a maintainer applying the model, I want `type` ratified as the Structure axis and confirmed free of output-format meaning, so that structure classification is complete and does not leak into Destination.

#### Acceptance Criteria

1. THE Axis_Registry SHALL assign `type` to the Structure_Axis.
2. THE Structure_Axis SHALL describe the kind/shape of an artifact (an `AssetType`), independent of any harness output format.
3. THE `type` field SHALL NOT determine export output format; output format SHALL remain resolved from `harness-config.<harness>.format` on the Destination_Axis (ratifying ADR-0051).
4. THE deprecated `type` value `power` SHALL be documented as a Destination concept misfiled onto Structure, retained only as a backward-compatible alias for `skill`, consistent with ADR-0051.
5. IF a future `type` value would encode a vendor or an output format, THEN the model-naming guidance SHALL direct it to the Destination_Axis instead, and the Model_Invariant_Check SHALL treat a Harness_Name appearing as a `type` value as an INV-1 violation.

### Requirement 4: `ecosystem` Is the Applicability Axis

**User Story:** As a knowledge author, I want `ecosystem` recognized as its own axis for the technical context my artifact applies to, so that "applies to TypeScript/React" is not confused with the craft it teaches or the subject it concerns.

#### Acceptance Criteria

1. THE Axis_Registry SHALL assign `ecosystem` to the Applicability_Axis.
2. THE Applicability_Axis SHALL answer "what technical context (languages, runtimes, frameworks) does this artifact apply to?", distinct from Craft (skill encoded) and Subject (topic).
3. THE `ecosystem` field SHALL remain a freeform array of kebab-case strings, unchanged in schema and behavior.
4. THE Applicability_Axis SHALL be an Intrinsic_Axis subject to INV-1: no `ecosystem` value SHALL equal a Harness_Name (a harness is a Destination, not a technical context an artifact targets).
5. THE guidance SHALL distinguish Applicability from Destination with a worked example (e.g. `ecosystem: [react]` means "about/for React code"; it does not mean "install into a harness").

### Requirement 5: `depends` and `enhances` Are the Relation Axis

**User Story:** As a catalog consumer, I want inter-artifact relationships modeled as their own axis, so that composition edges are navigable and not mistaken for properties of a single artifact.

#### Acceptance Criteria

1. THE Axis_Registry SHALL assign `depends` and `enhances` to the Relation_Axis.
2. THE Relation_Axis SHALL answer "how does this artifact relate to other artifacts?", modeling directed edges by artifact `name`.
3. THE `depends` and `enhances` fields SHALL remain freeform arrays of kebab-case artifact-name strings, unchanged in schema and behavior.
4. THE Relation_Axis SHALL be an Intrinsic_Axis subject to INV-1: no `depends`/`enhances` value SHALL equal a Harness_Name.
5. THE existing warning behavior for unresolved `depends`/`enhances` references (ADR-0007) SHALL be preserved and documented as the Relation_Axis's referential-integrity check.

### Requirement 6: Governance, Lifecycle, and Presentation Axes

**User Story:** As a maintainer, I want the remaining governance, lifecycle, and presentation fields named as first-class axes rather than an unclassified leftover pile, so that the model is genuinely complete and each field's purpose is explicit.

#### Acceptance Criteria

1. THE Axis_Registry SHALL assign `trust`, `risk-level`, `license`, `audience`, `model-assumptions`, and `visibility` to the Governance_Axis.
2. THE Axis_Registry SHALL assign `maturity`, `version`, `successor`, `replaces`, and `migrations` to the Lifecycle_Axis.
3. THE Axis_Registry SHALL assign `name`, `displayName`, `description`, `keywords`, `author`, `id`, `priority`, and `collections` to the Presentation_Axis.
4. THE Governance, Lifecycle, and Presentation Axes SHALL be Intrinsic_Axes subject to INV-1 (no Harness_Name as a value on these fields).
5. THE placement of every field named in this requirement SHALL match its current schema semantics with no behavior change.

### Requirement 7: Destination Axis Accounts for Delivery Fields

**User Story:** As a maintainer, I want all export/delivery-shaping fields grouped on the Destination axis, so that "where and how does this get installed" is one coherent concept and INV-3 (vendor at the edge only) covers all of them.

#### Acceptance Criteria

1. THE Axis_Registry SHALL assign `harnesses`, `inclusion`, `file_patterns`, `harness-config`, and `inherit-hooks` to the Destination_Axis.
2. THE Destination_Axis SHALL be the sole Axis on which a Harness_Name or output-format value may legitimately appear (per INV-3 and the prior spec's Requirement 13).
3. THE `harness-config.<harness>.format` value SHALL remain the authority for output format, consistent with Requirement 3.3 and ADR-0051.
4. THE Model_Invariant_Check SHALL exempt the Destination_Axis fields from the "no Harness_Name in frontmatter" rule, since naming harnesses is their purpose.
5. THE `outcomes` field SHALL be assigned to an Axis and documented; IF it is determined to be a capability declaration rather than a classification, THEN it SHALL be assigned to the Destination_Axis as an export-capability contract, and this rationale SHALL be recorded.

### Requirement 8: Extend the Invariant Guard to Total Coverage

**User Story:** As a maintainer, I want the existing model-invariant guard to enforce that the axis map is total, so that no future field can be added without being placed on an axis.

#### Acceptance Criteria

1. THE Model_Invariant_Check SHALL consult the Axis_Registry as its single field-to-axis source.
2. THE Model_Invariant_Check SHALL enforce Total_Coverage: it SHALL fail if any FrontmatterSchema field is missing from the Axis_Registry or if any Axis_Registry entry is not a FrontmatterSchema field.
3. THE extensibility guard test (Property 12 from the prior spec) SHALL be generalized from "intrinsic-axis fields" to "all fields," so adding any field to FrontmatterSchema without an Axis_Assignment fails the test.
4. THE Model_Invariant_Check SHALL apply INV-1 to every Intrinsic_Axis field (not only `categories`/`domains`): no Intrinsic_Axis field value SHALL equal a Harness_Name.
5. THE severity split SHALL be preserved: a Total_Coverage or built-in-registry violation is an error; an authored-artifact metadata violation is a warning.

### Requirement 9: Backward Compatibility

**User Story:** As a maintainer of the existing catalog, I want every current artifact to parse, validate, build, and catalog unchanged, so that completing the model is a pure classification/enforcement refactor.

#### Acceptance Criteria

1. THE refactor SHALL make no change to any Frontmatter_Field's Zod definition, default, or runtime behavior.
2. FOR ALL existing valid Knowledge_Artifacts, parsing then validating after the refactor SHALL produce results identical to before, except for newly emitted INV-1/Total_Coverage diagnostics where a real violation exists.
3. WHEN the Kanon_CLI builds all artifacts for all harnesses, the emitted output files SHALL be byte-identical to before the refactor.
4. THE `kanon catalog generate` output SHALL be unchanged by this refactor.
5. THE Axis_Registry and axis names SHALL be documentation/enforcement constructs and SHALL NOT appear as new persisted frontmatter fields.

### Requirement 10: Documentation and Decision Record

**User Story:** As a contributor, I want the complete axis model documented in one place and recorded as a decision, so that I can see where any field belongs and why, and propose changes coherently.

#### Acceptance Criteria

1. THE contributor documentation SHALL present the complete Axis table (all ten Axes, their question, and their fields) in one authoritative place.
2. THE documentation SHALL state the placement rule: every Frontmatter_Field belongs to exactly one Axis, and vendor identity is confined to the Edge_Axes.
3. THE complete axis inventory SHALL be recorded in an Architecture Decision Record that supersedes or extends the relevant prior ADRs (0007, 0014, 0051) and links to the prior spec's ADRs.
4. THE ADR SHALL document the `outcomes` placement rationale (Requirement 7.5) and the `type`-is-Structure ratification (Requirement 3).
5. THE documentation SHALL include at least one worked artifact showing its fields sorted by Axis (e.g. a real catalog artifact annotated axis-by-axis).
