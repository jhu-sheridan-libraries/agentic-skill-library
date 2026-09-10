# Requirements Document

## Contract and Context

Apply the Kiro Spec Requirements contract (anchors: Cockburn Use Cases, EARS, Gherkin): frame each capability by actor and goal, express normative behavior as EARS acceptance criteria, and use Given/When/Then examples where a concrete boundary needs pinning.

This refresh is grounded in three current models:

- Kanon's `FrontmatterSchema`, `getKnownFrontmatterKeys()`, catalog projection, outcomes model, and Rosetta format contracts.
- Academic Research Skills' separation of skill, scoped mode, spectrum, oversight, task type, data-access level, relationships, distribution channel, and enforcement mechanism.
- SciAgent-Skills' separation of one primary domain category, behavioral subtype (`pipeline | toolkit | database | guide`), sparse cross-cutting tags, bundled-resource roles, and registry-to-file parity.

The reference repositories demonstrate the same core rule: a useful inventory keeps independent questions on independent axes. A semantic subtype is not an output format; a harness is not an install channel; support is not a Boolean; and a category is not a substitute for tags, modes, controls, or relationships.

## Introduction

Kanon currently has a rich canonical model, but no single total inventory explaining what each recognized top-level frontmatter key means. The previous draft attempted a ten-axis inventory, but it was stale against the actual data model: it included nonexistent `domains`, treated `outcomes` as delivery metadata, relied on private Zod internals, assumed invariant code that is not present, and proposed scanning arbitrary prose for harness names.

This specification defines a complete inventory for the canonical keys Kanon recognizes today. It is a classification and enforcement refactor: no frontmatter field, default, adapter output, or catalog value changes. It also documents how future subtype, tag, mode, control, and distribution-channel concepts should be placed without conflating them with harness-native formats.

## Glossary

- **Canonical_Key**: A recognized top-level canonical frontmatter key returned by `getKnownFrontmatterKeys()`. This includes declared Zod keys and recognized validated passthrough keys such as `harness-config`.
- **Extra_Field**: An unknown passthrough key preserved for round trips but not part of the closed canonical inventory.
- **Axis**: One independent question answered by one or more Canonical_Keys.
- **Axis_Registry**: The authoritative mapping from each Canonical_Key to exactly one Axis.
- **Asset_Type**: Kanon's canonical structural kind: `skill | power | rule | workflow | agent | prompt | template | reference-pack`; `power` is a deprecated alias for `skill`.
- **Category**: Kanon's controlled semantic classification. Category meaning is repository-local; it MUST NOT be assumed to be a subtype, domain hierarchy, or harness format.
- **Artifact_Profile**: A potential future semantic subtype such as SciAgent's `pipeline | toolkit | database | guide`. Kanon does not currently persist this field.
- **Behavior_Control**: A declaration of expected result or operational posture, such as outcomes, modes, oversight, task type, or data-access level.
- **Harness**: One of the nine values in `SUPPORTED_HARNESSES`.
- **Output_Format**: A harness-native variant resolved from Rosetta contracts and `harness-config.<harness>.format`.
- **Distribution_Channel**: A delivery mechanism such as plugin, copied skills, repository clone, or wrapper package. It is distinct from Harness and is not currently a Kanon frontmatter field.
- **Total_Coverage**: Equality between the Axis_Registry key set and the Canonical_Key set.

## Requirements

### Requirement 1: Define a Complete Current Axis Set

**User Story:** As a maintainer, I want one orthogonal model for the metadata Kanon recognizes today, so that every canonical key has a principled home.

#### Acceptance Criteria

1. THE Classification_Model SHALL define exactly these Axes: Identity, Structure, Classification, Applicability, Relation, Governance, Lifecycle, Behavior, Origin, and Distribution.
2. THE Classification_Model SHALL document one question answered by each Axis.
3. THE Classification_Model SHALL assign every Canonical_Key to exactly one Axis.
4. THE Classification_Model SHALL NOT invent persisted fields to make an axis appear populated.
5. WHEN a genuinely independent concept cannot fit an existing Axis without changing that Axis's question, THE maintainer SHALL record an ADR before adding a new Axis.

### Requirement 2: Use the Recognized Canonical Key Set

**User Story:** As a schema maintainer, I want coverage based on Kanon's public canonical-key helper, so that declared, optional, defaulted, and validated passthrough keys are handled consistently.

#### Acceptance Criteria

1. THE coverage check SHALL use `getKnownFrontmatterKeys()` as the source of Canonical_Keys.
2. THE coverage check SHALL include `harness-config`, `migrations`, `outcomes`, and `file_patterns` when returned by the helper.
3. THE coverage check SHALL NOT use `FrontmatterSchema._def` or another private Zod API.
4. THE coverage check SHALL NOT require arbitrary Extra_Fields to appear in the Axis_Registry.
5. WHEN the parser's deprecated `KNOWN_FRONTMATTER_FIELDS` list disagrees with `getKnownFrontmatterKeys()`, THE implementation SHALL remove the duplicate authority or derive it from the canonical helper.

### Requirement 3: Map Identity, Structure, and Classification Separately

**User Story:** As an artifact author, I want identity, structural kind, and semantic classification kept independent, so that changing how an artifact is described does not change what it is or how it is delivered.

#### Acceptance Criteria

1. THE Axis_Registry SHALL assign `name`, `displayName`, `description`, `keywords`, `author`, and `id` to Identity.
2. THE Axis_Registry SHALL assign `type` to Structure.
3. THE Axis_Registry SHALL assign `categories` to Classification.
4. THE `type` value SHALL remain independent of `harness-config.<harness>.format`.
5. THE `categories` field SHALL retain its current controlled vocabulary and cardinality.
6. THE documentation SHALL explain that SciAgent's primary category and subtype are separate axes, while Academic Research Skills uses a functional skill taxonomy plus scoped modes; Kanon SHALL therefore avoid treating categories as a universal domain or subtype system.
7. IF Kanon later adds `profile`, `sub_type`, `tags`, or domain facets, THEN the design SHALL specify their cardinality and authority explicitly rather than overloading `type` or `categories`.

### Requirement 4: Map Applicability and Relations

**User Story:** As a catalog consumer, I want technical applicability and graph relationships modeled separately from classification, so that I can filter context and traverse composition without category overload.

#### Acceptance Criteria

1. THE Axis_Registry SHALL assign `ecosystem` to Applicability.
2. THE Axis_Registry SHALL assign `depends`, `enhances`, and `collections` to Relation.
3. THE Relation Axis SHALL distinguish directed dependency/enhancement edges from grouping membership.
4. WHEN a relation target is unresolved, THE existing validation behavior SHALL remain unchanged.
5. THE documentation SHALL identify stable IDs and normalized arrays as the preferred design if relation semantics are expanded, reflecting the reference repositories' inconsistent scalar/list and prose-only relationships.

### Requirement 5: Map Governance and Lifecycle

**User Story:** As a curator, I want handling policy separated from lifecycle state, so that trust and risk do not become synonyms for maturity or version.

#### Acceptance Criteria

1. THE Axis_Registry SHALL assign `license`, `trust`, `risk-level`, `audience`, `model-assumptions`, `visibility`, and `priority` to Governance.
2. THE Axis_Registry SHALL assign `version`, `maturity`, `migrations`, `successor`, and `replaces` to Lifecycle.
3. THE refactor SHALL preserve every current schema definition and default for these fields.
4. THE documentation SHALL note that future task type, data-access level, spectrum, and oversight fields require explicit vocabularies and may need per-artifact constraints in addition to enum membership.

### Requirement 6: Treat Outcomes as Behavior

**User Story:** As an outcome registry consumer, I want outcomes classified as intrinsic behavior contracts, so that expected results are not mistaken for harness delivery configuration.

#### Acceptance Criteria

1. THE Axis_Registry SHALL assign `outcomes` to Behavior.
2. THE Behavior Axis SHALL answer "what result or operating posture does the artifact declare?"
3. THE outcome kinds `specification`, `operation`, and `invariant` SHALL remain unchanged.
4. THE Behavior Axis SHALL be independent of Harness, Output_Format, and Distribution_Channel.
5. THE documentation SHALL use Academic Research Skills' scoped modes, spectrum, oversight, task type, and data-access level as examples of possible future Behavior or Governance fields, not as values to copy into Kanon without a schema decision.

### Requirement 7: Separate Origin from Distribution

**User Story:** As an importer and publisher, I want source lineage separate from target delivery, so that provenance and attribution are not mixed with harness configuration.

#### Acceptance Criteria

1. THE Axis_Registry SHALL assign `provenance` and `attribution` to Origin.
2. THE Axis_Registry SHALL assign `harnesses`, `inclusion`, `file_patterns`, `harness-config`, and `inherit-hooks` to Distribution.
3. THE Distribution Axis SHALL contain target harness and delivery-shaping configuration only.
4. THE model SHALL treat Harness, Output_Format, and Distribution_Channel as distinct concepts.
5. THE refactor SHALL NOT add a Distribution_Channel field; any later addition SHALL define channel-specific support and degradation independently of Harness.

### Requirement 8: Enforce Total Coverage Without False Positives

**User Story:** As a maintainer, I want a guard that catches inventory drift without interpreting arbitrary prose as categorical data.

#### Acceptance Criteria

1. THE model check SHALL fail when a Canonical_Key is absent from the Axis_Registry.
2. THE model check SHALL fail when the Axis_Registry contains a stale key that is not a Canonical_Key.
3. THE model check SHALL report every missing and stale key in one deterministic result.
4. THE model check SHALL NOT recursively scan free-text Identity, Governance, Lifecycle, or Behavior values for strings equal to harness names.
5. WHEN vendor neutrality requires enforcement, THE implementation SHALL validate typed vocabularies or explicitly identified classification fields rather than arbitrary text.
6. THE guard SHALL enforce bidirectional set equality, following the inventory-parity pattern used by Academic Research Skills and SciAgent-Skills.

### Requirement 9: Preserve Runtime Behavior

**User Story:** As a Kanon user, I want the inventory to document and guard the model without changing existing artifacts or generated files.

#### Acceptance Criteria

1. THE change SHALL NOT alter `FrontmatterSchema` field definitions, defaults, parsing, or serialization.
2. THE change SHALL NOT alter adapter selection, format resolution, compatibility, or capability degradation.
3. THE change SHALL NOT alter catalog content.
4. FOR the existing corpus, parse, validate, build, and catalog results SHALL remain equivalent before and after the refactor, except for deterministic inventory self-check failures caused by implementation drift.
5. THE Axis names SHALL NOT become persisted frontmatter.

### Requirement 10: Document Extension Rules and Reference-Repository Lessons

**User Story:** As a contributor, I want clear extension rules, so that future subtype, tag, mode, resource, and channel additions preserve orthogonality.

#### Acceptance Criteria

1. THE contributor documentation SHALL publish the authoritative Axis table and current field assignments.
2. THE documentation SHALL state the cardinality and source of truth for every current Axis.
3. THE documentation SHALL include a comparison table covering Kanon, Academic Research Skills, and SciAgent-Skills.
4. THE comparison SHALL distinguish observed source-repository facts from Kanon design decisions.
5. THE documentation SHALL include one worked Kanon artifact and one hypothetical future profile/tag extension.
6. THE existing ADR-0069 SHALL be refreshed to match this specification before its status changes from Proposed.

## Boundary Scenarios

### Scenario: Recognized Passthrough Key

```gherkin
Given `harness-config` is validated as a recognized passthrough key
When total coverage is checked
Then `harness-config` is included in the canonical key set
And it is assigned to Distribution
```

### Scenario: Unknown Preserved Extension

```gherkin
Given an artifact contains an unknown passthrough key `x-lab-note`
When total coverage is checked
Then the artifact still round-trips the key
And the Axis Registry is not required to classify it
```

### Scenario: Category Is Not Output Format

```gherkin
Given an artifact has `type: skill` and `categories: [writing]`
And its Codex format is `skill`
When only the category changes
Then its canonical type and Codex format do not change
```
