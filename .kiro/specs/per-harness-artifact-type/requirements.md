# Requirements Document

## Contract and Context

Apply the Kiro Spec Requirements contract (anchors: Cockburn Use Cases, EARS, Gherkin): frame each capability by actor and goal, express normative behavior as EARS acceptance criteria, and use Given/When/Then examples for boundary cases.

This specification refreshes the historically completed per-harness-format work against the current Kanon architecture. The original spec correctly introduced `harness-config.<harness>.format`, but incorrectly deprecated canonical `type`, covered only seven harnesses, predated Rosetta format contracts, and conflated output format with support.

The reference repositories reinforce the corrected model:

- SciAgent-Skills has one canonical artifact kind (`skill`) with independent semantic subtype/category/tag axes; different harness integrations do not change those semantics.
- Academic Research Skills separates canonical skills/modes from install channels and records mechanism availability as Active, Conditional, or Absent rather than claiming Boolean parity.

## Introduction

Kanon needs a per-harness artifact model with three independent dimensions:

1. **Canonical Asset Type** — what the artifact is (`AssetTypeSchema`).
2. **Harness-Native Output Format** — which representation a Rosetta contract/adaptor emits.
3. **Support and Degradation** — how faithfully a harness represents an asset type and individual capabilities.

A fourth concept, **Distribution Channel**, may later distinguish plugin, copy, repository, or wrapper delivery, but it is not currently persisted and is outside this feature.

## Glossary

- **Asset_Type**: Canonical structural taxonomy from `AssetTypeSchema`.
- **Artifact_Profile**: A semantic subtype within an Asset_Type, such as SciAgent's pipeline/toolkit/database/guide. Kanon does not currently persist this concept.
- **Harness**: One of the nine values in `SUPPORTED_HARNESSES`.
- **Format_Contract**: A versioned Rosetta contract that defines harness variants, default variant, direction, capability profile, detection, and security policy.
- **Output_Format**: A variant key from a Harness's target/bidirectional Format_Contract.
- **Asset_Compatibility**: Build-level `full | partial | none` support for one `(Asset_Type, Harness)` pair.
- **Feature_Capability**: Feature-level support for hooks, MCP, path scoping, workflows, toggleable rules, agents, file-match inclusion, or system-prompt merging.
- **Degradation_Strategy**: `inline | comment | omit` behavior required when Feature_Capability support is not full.
- **Distribution_Channel**: A delivery mechanism distinct from Harness, such as plugin or copied skill tree.
- **Resolved_Format**: The explicit format, legacy Kiro fallback, or contract default selected by `resolveFormat()`.

## Requirements

### Requirement 1: Preserve Canonical Asset Type

**User Story:** As an artifact author, I want canonical type to describe what my artifact is across all harnesses, so that semantic identity survives translation.

#### Acceptance Criteria

1. THE FrontmatterSchema SHALL retain `type` with its current default and canonical values.
2. THE Wizard SHALL continue to prompt for canonical Asset_Type and SHALL exclude deprecated `power` from new authoring choices.
3. THE system SHALL deprecate only the `power` Asset_Type value, not the `type` field.
4. THE Asset_Type SHALL participate in compatibility checks and content conventions.
5. THE Asset_Type SHALL NOT select Output_Format.
6. IF a semantic Artifact_Profile is added later, THEN it SHALL remain independent of Output_Format and SHALL define which Asset_Types permit it.

### Requirement 2: Derive Formats from Rosetta Contracts

**User Story:** As a format maintainer, I want one versioned source of truth for each harness's variants, so that schema, wizard, catalog, adapters, and translation cannot drift.

#### Acceptance Criteria

1. THE built-in Rosetta Format_Contracts SHALL be the authority for Harness format variants and defaults.
2. THE `HARNESS_FORMAT_REGISTRY` SHALL remain a projection over target or bidirectional built-in contracts, not an independent hand-authored matrix.
3. THE current variant set SHALL be:
   - `kiro`: `steering` (default), `power`
   - `claude-code`: `claude-md` (default)
   - `codex`: `agents-md` (default), `skill`
   - `copilot`: `instructions` (default), `agent`
   - `cursor`: `rule` (default)
   - `windsurf`: `rule` (default)
   - `cline`: `rule` (default)
   - `qdeveloper`: `rule` (default), `agent`
   - `gemini-cli`: `gemini-md` (default)
4. WHEN a built-in target contract adds, removes, or changes a variant, THEN registry, schema validation, wizard choices, and catalog resolution SHALL observe the same change without a second variant edit.
5. THE contract SHALL own output-path and capability semantics; this specification SHALL NOT duplicate volatile path templates as a second authority.

### Requirement 3: Resolve Format Deterministically

**User Story:** As a build consumer, I want deterministic format precedence, so that the same canonical artifact always selects the same harness representation.

#### Acceptance Criteria

1. WHEN `harness-config.<harness>.format` is present, THE resolver SHALL use it.
2. WHEN Kiro format is absent and `harness-config.kiro.power` is `true`, THE resolver SHALL use `power` and emit a deprecation warning.
3. WHEN neither explicit nor legacy configuration applies, THE resolver SHALL use the contract default.
4. THE resolver SHALL NOT read Asset_Type, categories, ecosystem, or Artifact_Profile.
5. FOR every supported Harness, THE resolved value SHALL be a variant in that Harness's projected registry entry.

### Requirement 4: Keep Three Support Dimensions Independent

**User Story:** As a maintainer, I want type compatibility, format selection, and feature capability modeled independently, so that the system can describe degradation honestly.

#### Acceptance Criteria

1. THE `ASSET_HARNESS_COMPATIBILITY` matrix SHALL answer whether one Asset_Type has `full`, `partial`, or `none` build-level support on one Harness.
2. THE Format_Contract SHALL answer which native Output_Format is emitted.
3. THE `CAPABILITY_MATRIX` SHALL answer feature-level support and required degradation.
4. THE system SHALL NOT infer full Asset_Compatibility merely because a Harness has an Output_Format.
5. THE system SHALL NOT infer feature parity from Asset_Compatibility.
6. WHEN compatibility is `none`, THE strict build SHALL fail or skip according to existing build policy.
7. WHEN support is `partial` or a feature is not full, THE system SHALL surface the declared degradation instead of simulating parity.
8. A `full` Asset_Compatibility entry SHALL NOT contradict a `none` or `partial` native capability required to represent that Asset_Type without an explicitly documented rationale.

### Requirement 5: Validate Harness Configuration

**User Story:** As an author, I want invalid format configuration rejected with actionable diagnostics, so that errors are caught before output is written.

#### Acceptance Criteria

1. THE FrontmatterSchema SHALL validate each explicit format against the projected registry entry for that Harness.
2. WHEN a format is invalid, THE diagnostic SHALL name the Harness, invalid value, and valid values.
3. THE schema SHALL preserve additional harness-specific keys through passthrough behavior.
4. WHEN a `harness-config` key is not a supported Harness, THE validation policy SHALL be explicit and tested rather than silently treating it as a supported target.
5. THE parser and Rosetta canonical round trip SHALL preserve valid format and harness-specific configuration.

### Requirement 6: Author Canonical Type and Format Separately

**User Story:** As a wizard user, I want to choose semantic type first and representation second, so that the prompts teach the model rather than collapse it.

#### Acceptance Criteria

1. THE Wizard SHALL prompt for Asset_Type independently of Harness selection.
2. THE Wizard SHALL prompt for Output_Format only for selected Harnesses with multiple variants.
3. THE Wizard SHALL derive format choices and defaults from the projected registry.
4. THE Wizard SHALL omit explicit default formats when minimal frontmatter is desired.
5. THE Wizard SHALL explain that format controls representation and does not change Asset_Type.
6. THE Wizard SHALL include all nine supported Harnesses.

### Requirement 7: Expose Parallel Catalog Facets

**User Story:** As a catalog consumer, I want canonical type and resolved format visible together, so that I can distinguish semantics from representation.

#### Acceptance Criteria

1. THE CatalogEntry SHALL retain canonical `type` as a first-class field.
2. THE CatalogEntry SHALL expose `formatByHarness` for every Harness selected by the artifact.
3. THE keys of `formatByHarness` SHALL be supported Harness names selected by the artifact.
4. THE values of `formatByHarness` SHALL equal `resolveFormat()` results.
5. THE Browse UI SHALL present type and per-harness format as parallel facets; it SHALL NOT replace type filtering with format filtering.
6. WHEN older catalog data lacks `formatByHarness`, THE Browse UI SHALL degrade gracefully.

### Requirement 8: Maintain Registry and Matrix Parity

**User Story:** As a platform maintainer, I want every supported harness represented in each relevant authority, so that adding a harness cannot leave silent gaps.

#### Acceptance Criteria

1. THE Harness set in adapters, Rosetta target contracts, format projection, capability matrix, and compatibility matrix SHALL be checked against `SUPPORTED_HARNESSES`.
2. WHEN one authority is missing or has an extra Harness, THE parity check SHALL report both set differences.
3. THE format projection SHALL contain exactly one target/bidirectional contract per supported Harness.
4. THE compatibility model SHALL define an explicit default policy and tests SHALL prove that omitted cells receive only the intended value.
5. THE documentation SHALL publish a generated or checked matrix of Harness, variants/default, Asset_Compatibility by type, and notable capability degradation.

### Requirement 9: Preserve Backward Compatibility

**User Story:** As an existing artifact author, I want old configuration to keep working while deprecated concepts receive precise migration guidance.

#### Acceptance Criteria

1. WHEN `type` is omitted, THE schema SHALL retain its current default behavior.
2. WHEN `type: power` is used, THE validator SHALL emit the existing targeted deprecation guidance toward `type: skill` plus Kiro `format: power`.
3. WHEN legacy `harness-config.kiro.power: true` is used without explicit format, THE resolver SHALL preserve power output and emit migration guidance.
4. Explicit `format` SHALL take precedence over the legacy Kiro flag.
5. Existing valid artifacts SHALL parse, round-trip, resolve, build, and catalog without unintended semantic changes.

### Requirement 10: Distinguish Harness from Distribution Channel

**User Story:** As a future distribution maintainer, I want harness and channel kept separate, so that plugin, copy, repository, and wrapper installations can report different controls honestly.

#### Acceptance Criteria

1. THIS feature SHALL NOT add Distribution_Channel to current frontmatter.
2. THE design SHALL reserve Distribution_Channel as an independent future concept, not a new Harness or Output_Format value.
3. IF channels are added later, THEN each channel SHALL declare native, adapted, knowledge-only, or unsupported artifact delivery plus active, conditional, or absent control mechanisms.
4. Channel-specific degradation SHALL NOT alter canonical Asset_Type or Artifact_Profile.

## Boundary Scenarios

### Scenario: Same Type, Different Formats

```gherkin
Given an artifact has `type: skill`
And Kiro format is `power`
And Codex format is `skill`
When the artifact is cataloged
Then its canonical type remains `skill`
And `formatByHarness` records both native formats
```

### Scenario: Format Does Not Prove Capability

```gherkin
Given a harness has a valid rule-like output format
And its agent capability is `none`
When an agent artifact is evaluated
Then format availability does not upgrade agent compatibility
And the declared compatibility/degradation policy is applied
```

### Scenario: Legacy Kiro Flag

```gherkin
Given Kiro format is omitted
And `harness-config.kiro.power` is true
When format is resolved
Then the result is `power`
And a migration warning is returned
```
