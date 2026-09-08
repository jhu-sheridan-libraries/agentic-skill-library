# Requirements Document

## Introduction

This feature refactors two vocabularies in Kanon that currently conflate an artifact's intrinsic nature with the vendor that happens to consume it.

First, **source format identifiers** carry a vendor qualifier where no real vendor distinction exists. The `kiro-skill` source format names the `SKILL.md` + `references/` convention — an Anthropic Agent Skills / `obra/superpowers` layout that Kiro merely reads — as if Kiro owned it, encoding the claim in both the identifier and a `harness: "kiro"` field. Meanwhile `superpowers`, the honestly vendor-neutral name (`harness: null`), is the deprecated one. This refactor establishes that a source format is identified by its observable structure, and that vendor only becomes relevant when an artifact is **exported** to a harness — i.e. installed into a vendor-specific location such as `~/.claude/skills/` so that harness picks it up. (This realizes the decision proposed in ADR-0066.)

Second, **knowledge categories** are a single closed enum drawn entirely from a developer-tooling taxonomy (`testing`, `security`, `code-style`, …). Domain artifacts — a Johns Hopkins promotions-CV skill, a library reference-interview practice — have no honest home and are forced into `documentation`. This refactor separates the technical-craft axis (kept as a controlled enum) from a subject-matter axis (a new curation-owned `domains` field), so an artifact can be filed by what it *is about* as well as by the *technical skill* it encodes.

The unifying principle: **classify canonical artifacts by structure and subject, not by vendor; let vendor bind only at export/install time.** This refactor fixes the two axes that violate it today (source formats, categories) and adds a mechanical guard so the principle stays enforced as the model grows. It must be backward compatible — existing artifacts, imports, and re-syncs continue to work — and must not break recorded provenance.

## Glossary

- **Kanon_CLI**: The `kanon` (aka `forge`) TypeScript CLI entry point running on Bun, providing `import`, `build`, `install`, `validate`, `catalog`, `rosetta`, and related subcommands.
- **Knowledge_Artifact**: A directory under `knowledge/` containing a `knowledge.md` file and optional supporting files — the harness-agnostic canonical source of truth for one skill, power, or other artifact.
- **Rosetta_Engine**: The translation engine under `src/rosetta/` that parses source documents into a canonical `KnowledgeArtifact` (inbound) and renders a canonical artifact into harness-native output (outbound).
- **Format_Contract**: A `FormatContract` record (validated by `FormatContractSchema` in `src/schemas.ts`) describing one representation format: its `id`, `direction` (`source` | `target` | `bidirectional`), nullable `harness`, `aliases`, `lifecycle`, `pathConventions`, and `detection` rules.
- **Source_Format**: A `Format_Contract` whose `direction` is `source` — a format Kanon reads *from* during import (currently `kiro-power`, `kiro-skill`, `superpowers`).
- **Target_Format**: A `Format_Contract` whose `direction` is `target` or `bidirectional` — a format Kanon writes *to* during build/export (e.g. `codex`, `claude-code`, `kiro`).
- **Skill_Md_Structure**: The artifact structure consisting of a required `SKILL.md` file plus companion files (references, scripts, assets) at arbitrary relative paths. Read by Claude Code, Codex, and Kiro; owned by none of them.
- **Skill_Md_Format**: The proposed vendor-neutral `Source_Format` (id `skill-md`, `harness: null`) that recognizes Skill_Md_Structure, replacing `kiro-skill` and `superpowers`.
- **Format_Alias**: A deprecated identifier that resolves to a current Format_Contract, declared either in a contract's `aliases` array or in the `SELECTION_ALIASES` table, and which emits a migration diagnostic when selected.
- **Provenance_Contract_Id**: The `contract` string recorded in an imported artifact's `provenance` block (e.g. `kiro-skill@1`), used by re-sync and three-way reconciliation to identify the source format an artifact was distilled from.
- **Vendor_Qualifier**: A harness/vendor name embedded in a format identifier or asserted via a contract's `harness` field (e.g. the `kiro` in `kiro-skill`).
- **Export**: The act of rendering a Knowledge_Artifact to a Target_Format and placing the output where a specific harness discovers it — i.e. `kanon build` followed by `kanon install`.
- **Install_Path_Map**: The `HARNESS_INSTALL_PATHS` mapping in `src/install.ts` from a `HarnessName` to the root directory its exported files are installed under (`kiro` → `.kiro`, others → `.`).
- **FrontmatterSchema**: The Zod schema in `src/schemas.ts` validating `knowledge.md` YAML frontmatter.
- **CatalogEntrySchema**: The Zod schema in `src/schemas.ts` defining each entry in generated `catalog.json`.
- **Category**: A value from the controlled `CategoryEnum` describing the technical-craft axis of an artifact (e.g. `testing`, `security`).
- **CategoryEnum**: The Zod enum in `src/schemas.ts` defining allowed Category values.
- **Domain**: A curation-owned subject-matter label describing what an artifact is *about* (e.g. `academic`, `healthcare`, `publishing`), independent of the technical skill it encodes.
- **Validator**: The `src/validate.ts` module that checks Knowledge_Artifacts against schemas and emits errors and warnings.
- **Format_Registry**: The registry (`src/rosetta/registry.ts`) that registers Format_Contracts, enforces id/alias uniqueness, resolves selectors to contracts, and emits lifecycle diagnostics.
- **Classification_Axis**: One of the intrinsic dimensions by which the canonical model describes an artifact — Structure, Craft, and Subject — as distinct from the origin/destination edges. Each answers one question and lives on one field or mechanism.
- **Intrinsic_Axis**: A Classification_Axis (Structure, Craft, Subject) that describes what an artifact *is* or is *about*, as opposed to where it came from (Origin) or where it is sent (Destination).
- **Model_Invariant**: One of the three properties the unified model guarantees across all artifacts and contracts — no vendor on an Intrinsic_Axis (except a genuinely vendor-owned Structure), axis orthogonality, and vendor confined to the export/install edge.
- **Harness_Name**: A value of the `HarnessName` enum (`kiro`, `claude-code`, `codex`, `copilot`, `cursor`, `windsurf`, `cline`, `qdeveloper`, `gemini-cli`) — the identifier of a harness Kanon can export to.
- **Harnesses_Field**: The `harnesses` array in a Knowledge_Artifact's frontmatter listing the Harness_Names an artifact may be exported to — an export-target allow-list on the Destination axis, not a classification.
- **Known_Domains_Registry**: A curated list of recognized Domain values used to warn (not reject) on unrecognized domains, preventing near-duplicate drift (e.g. `k8s` vs `kubernetes`) while keeping the field open.

## Requirements

### Requirement 1: Vendor-Neutral Skill Source Format

**User Story:** As a knowledge author importing a `SKILL.md`-based skill, I want to select a format whose name describes the artifact's structure rather than a vendor, so that the format identifier does not falsely assert that one harness owns a cross-harness convention.

#### Acceptance Criteria

1. THE Format_Registry SHALL provide a Source_Format with the identifier `skill-md` whose `direction` is `source` and whose `harness` is `null`.
2. THE `skill-md` Format_Contract SHALL declare `pathConventions` requiring a `SKILL.md` file and permitting companion files at arbitrary relative paths.
3. THE `skill-md` Format_Contract SHALL declare a `lifecycle.status` of `active`.
4. WHEN the Kanon_CLI runs import with `--format skill-md` on a directory containing a `SKILL.md`, THE Rosetta_Engine SHALL translate it into a canonical Knowledge_Artifact using the `skill-md` translator.
5. WHEN format auto-detection runs on a directory whose only recognized marker is `SKILL.md`, THE Rosetta_Engine SHALL resolve the source format to `skill-md`.
6. THE `skill-md` translator SHALL produce a canonical Knowledge_Artifact whose body comes from `SKILL.md`, whose `references/*.md` companions map to workflow files with the `references/` prefix stripped, and whose remaining companion files are preserved by relative path.

### Requirement 2: Retire Vendor-Qualified Skill Formats via Aliases

**User Story:** As an existing user with scripts and documentation referencing `--format kiro-skill` or `--format superpowers`, I want those identifiers to keep working while steering me to the neutral name, so that the rename does not break my workflows.

#### Acceptance Criteria

1. THE Format_Registry SHALL resolve the selector `kiro-skill` to the `skill-md` Format_Contract.
2. THE Format_Registry SHALL resolve the selector `superpowers` to the `skill-md` Format_Contract.
3. WHEN a user selects `kiro-skill` or `superpowers` as a source format, THE Kanon_CLI SHALL emit a deprecation diagnostic naming `skill-md` as the replacement.
4. THE Format_Registry SHALL NOT register `kiro-skill` or `superpowers` as independent Source_Formats with their own translators.
5. WHEN a user selects `kiro-skill` or `superpowers`, THE Rosetta_Engine SHALL produce output byte-identical to selecting `skill-md` on the same source (aside from diagnostics).
6. THE deprecated identifiers SHALL be scheduled for removal in a future major version, documented in each alias's removal policy.

### Requirement 3: Vendor Qualifier Only Where a Real Vendor Distinction Exists

**User Story:** As a maintainer of the format registry, I want a stated rule for when a format identifier may carry a vendor name, so that future formats are named consistently and misattribution does not recur.

#### Acceptance Criteria

1. THE format-naming rule SHALL permit a Vendor_Qualifier in a Source_Format identifier only when that vendor defines or exclusively owns the recognized structure.
2. THE `kiro-power` Source_Format SHALL retain its identifier and `harness: "kiro"` because `POWER.md` + `steering/` is a Kiro-native structure.
3. FOR ALL registered Source_Formats, IF a format recognizes a structure that more than one harness reads, THEN its `harness` field SHALL be `null`.
4. THE Kanon_CLI validation of the built-in format registry SHALL fail if a Source_Format asserts a `harness` for a structure documented as multi-harness.
5. THE format-naming rule SHALL be recorded as an Architecture Decision Record.

### Requirement 4: Vendor Binds at Export and Install, Not in the Canonical Model

**User Story:** As a knowledge author, I want a single canonical artifact that installs into each harness's own discovery location, so that "Claude picks it up from `~/.claude/skills/`" is an export concern and not baked into how the artifact is authored or categorized.

#### Acceptance Criteria

1. THE canonical Knowledge_Artifact frontmatter SHALL NOT require any field that names the vendor an artifact was imported from.
2. WHEN the Kanon_CLI exports an artifact to a harness, THE Kanon_CLI SHALL determine the install location from the Install_Path_Map keyed by the target `HarnessName`, not from the artifact's source format.
3. WHEN an artifact of Skill_Md_Structure is exported to Claude Code, THE Kanon_CLI SHALL place the compiled skill where Claude Code discovers personal skills (a `SKILL.md` under the harness's skills directory).
4. WHEN the same artifact is exported to Codex, THE Kanon_CLI SHALL place the compiled skill under the Codex skills directory (`.codex/skills/<name>/`).
5. FOR ALL harnesses, the choice of export/install location SHALL depend only on the Target_Format and Install_Path_Map, so that one canonical artifact can be exported to any subset of harnesses without re-authoring.
6. THE Provenance_Contract_Id and any `attribution` block SHALL remain the only record of an artifact's origin; neither SHALL influence export/install destination selection.

### Requirement 5: Provenance and Re-Sync Continuity Across the Rename

**User Story:** As an operator who imported skills under the old format names, I want re-sync and reconciliation to keep working after the rename, so that upgrading Kanon does not orphan my existing artifacts.

#### Acceptance Criteria

1. THE Kanon_CLI SHALL record `skill-md@1` as the Provenance_Contract_Id for artifacts imported via `skill-md` (including via the `kiro-skill`/`superpowers` aliases) going forward.
2. WHEN re-sync or reconciliation reads an artifact whose recorded Provenance_Contract_Id is `kiro-skill@1` or `superpowers@1`, THE Kanon_CLI SHALL resolve it as equivalent to `skill-md@1`.
3. FOR ALL artifacts imported before the rename, re-syncing after the rename SHALL recompute a base digest that verifies against the recorded base without requiring the artifact to be re-imported.
4. THE Kanon_CLI SHALL NOT rewrite existing recorded Provenance_Contract_Id values on disk as a side effect of an unrelated command.
5. IF a future migration rewrites recorded Provenance_Contract_Id values, THEN it SHALL be an explicit, opt-in command that reports every file it changes.

### Requirement 6: Domain Taxonomy for Subject Matter

**User Story:** As a knowledge author of a domain-specific artifact, I want to label what my artifact is *about* separately from the technical skill it encodes, so that a medical-CV skill is not mislabeled as generic "documentation."

#### Acceptance Criteria

1. THE FrontmatterSchema SHALL include a `domains` field defined as an array of strings with a default of an empty array.
2. THE FrontmatterSchema SHALL require each `domains` value to be a non-empty, lowercase, alphanumeric string allowing hyphens (matching `^[a-z0-9]+(-[a-z0-9]+)*$`).
3. WHEN a `knowledge.md` file omits the `domains` field, THE Kanon_CLI SHALL default the field to an empty array.
4. THE `domains` field SHALL be curation-owned: an import SHALL NOT populate or overwrite it from upstream content, and a re-sync SHALL preserve an author's `domains` values.
5. IF a `knowledge.md` file specifies a `domains` value that does not match the required pattern, THEN THE Kanon_CLI SHALL return a ValidationError identifying the invalid value.
6. THE `domains` field SHALL accept zero or more values, and its ordering SHALL be preserved through parsing and catalog generation.

### Requirement 7: Categories Remain the Technical-Craft Axis

**User Story:** As a catalog consumer filtering by engineering concern, I want `categories` to keep meaning "the technical skill this artifact encodes," so that separating out subject matter does not dilute the existing craft taxonomy.

#### Acceptance Criteria

1. THE CategoryEnum SHALL remain a controlled enum, and invalid `categories` values SHALL remain schema-validation errors.
2. THE refactor SHALL NOT remove any existing CategoryEnum value.
3. THE `categories` field SHALL remain independent of `domains`: an artifact MAY declare any combination of zero or more Category values and zero or more Domain values.
4. WHEN the same subject can be expressed as both a craft concern and a subject-matter concern, THE guidance SHALL direct the craft aspect to `categories` and the subject aspect to `domains`.
5. THE Kanon_CLI SHALL continue to validate `categories` against the CategoryEnum exactly as before this refactor.

### Requirement 8: Catalog and Browse Expose Domains

**User Story:** As a person browsing the catalog, I want to filter and see artifacts by subject-matter domain, so that I can find all Johns Hopkins or all publishing artifacts regardless of their technical category.

#### Acceptance Criteria

1. THE CatalogEntrySchema SHALL include a `domains` field defined as an array of strings.
2. WHEN the Kanon_CLI generates `catalog.json`, THE Kanon_CLI SHALL populate each entry's `domains` from the corresponding Knowledge_Artifact's frontmatter.
3. FOR ALL valid catalog contents, serializing to JSON then deserializing SHALL produce an equivalent catalog object with the `domains` field intact (round-trip property).
4. THE catalog browse UI SHALL offer a facet for filtering artifacts by Domain.
5. WHEN an artifact declares one or more Domain values, THE artifact detail view SHALL display them distinctly from Category values.

### Requirement 9: Backward Compatibility

**User Story:** As a maintainer of the existing 66-artifact catalog, I want every current artifact to parse, validate, build, and catalog unchanged after this refactor, so that the change is safe to land incrementally.

#### Acceptance Criteria

1. WHEN a `knowledge.md` file omits the `domains` field, THE Kanon_CLI SHALL parse the artifact successfully with `domains` defaulting to an empty array.
2. FOR ALL existing valid Knowledge_Artifacts, parsing then validating after the refactor SHALL produce a valid result with no new errors attributable to this change.
3. WHEN the Kanon_CLI builds all artifacts for all harnesses after the refactor, the set of emitted output files SHALL be unchanged except for additions attributable solely to new `domains` metadata (which produces no harness output on its own).
4. THE `kanon catalog generate` output for an unchanged artifact SHALL differ only by the added `domains` field.
5. THE refactor SHALL preserve all existing frontmatter fields and their behavior.

### Requirement 10: Documentation and Scaffolding

**User Story:** As a new contributor, I want the docs, scaffold, and help output to reflect the neutral format name and the domains field, so that I learn the correct vocabulary from the start.

#### Acceptance Criteria

1. THE `kanon new` scaffold SHALL generate a `knowledge.md` with a `domains` field present as an empty array with a guiding YAML comment.
2. THE CONTRIBUTING guide and import documentation SHALL reference `--format skill-md` and SHALL mark `kiro-skill` and `superpowers` as deprecated aliases.
3. THE `rosetta formats` command output SHALL list `skill-md` as active and SHALL present `kiro-skill` and `superpowers` as deprecated aliases of it.
4. THE guidance for authors SHALL explain the distinction between `categories` (technical craft) and `domains` (subject matter) with at least one worked example.
5. THE format-naming rule (Requirement 3) and the categories/domains split SHALL each be captured in an Architecture Decision Record and linked from the ADR index.


### Requirement 11: Model Invariants Are Enforced Across the Whole Model

**User Story:** As a maintainer, I want the unified model's invariants checked mechanically across every artifact and format contract, not just for the two axes this refactor touches, so that a future change cannot silently reintroduce a vendor onto an intrinsic axis or blur two axes together.

#### Acceptance Criteria

1. THE Validator SHALL provide a model-invariant check that runs over all registered Format_Contracts and all Knowledge_Artifacts in one pass.
2. THE model-invariant check SHALL enforce Model_Invariant "no vendor on an Intrinsic_Axis": no `categories` value and no `domains` value SHALL equal a Harness_Name, and no Source_Format SHALL assert a non-null `harness` unless its recognized structure is genuinely owned by that vendor (of the built-in Source_Formats, only `kiro-power`).
3. THE model-invariant check SHALL enforce Model_Invariant "axis orthogonality": a `domains` value SHALL NOT be validated against the CategoryEnum, and a `categories` value SHALL NOT be validated against the Domain pattern, and neither field SHALL be derived from the source format.
4. THE model-invariant check SHALL enforce Model_Invariant "vendor at the edge only": no frontmatter field other than `harnesses`, `provenance`, and `attribution` SHALL contain a Harness_Name value, so that vendor identity appears only on the Destination axis or as recorded origin.
5. IF the model-invariant check finds a violation in the built-in Format_Contract registry, THEN THE Kanon_CLI SHALL fail (error), because the built-in registry is code the project controls.
6. IF the model-invariant check finds a violation in a Knowledge_Artifact's authored metadata, THEN THE Validator SHALL emit a warning identifying the artifact, the axis, and the offending value, without necessarily failing the whole validation run.
7. THE model-invariant check SHALL be covered by a test that fails if a new intrinsic-axis field is added without being accounted for, so the guardrail keeps pace with the schema.

### Requirement 12: Domain Governance by Warning

**User Story:** As a curator, I want unrecognized `domains` values to be flagged against a known-domains list without being rejected, so that the subject axis stays open for genuinely new domains but does not fragment into near-duplicates the way a freeform field does.

#### Acceptance Criteria

1. THE project SHALL maintain a Known_Domains_Registry of recognized Domain values.
2. WHEN the user runs `kanon validate`, THE Validator SHALL compare each artifact's `domains` values against the Known_Domains_Registry.
3. IF a `domains` value is well-formed (matches the kebab-case pattern) but is not present in the Known_Domains_Registry, THEN THE Validator SHALL emit a warning naming the unrecognized value and the artifact that declares it.
4. THE Validator SHALL NOT treat an unrecognized-but-well-formed `domains` value as a validation error (the artifact SHALL remain valid).
5. THE warning message SHALL suggest the closest known domain when a near match exists, to steer authors toward the canonical form rather than a synonym.
6. THE Known_Domains_Registry SHALL be extensible by adding an entry, and adding a new recognized domain SHALL NOT require changing the FrontmatterSchema.
7. THE Known_Domains_Registry SHALL be documented so authors can see the recognized domains and propose additions.

### Requirement 13: Harnesses Is the Destination Axis, Not a Classification

**User Story:** As a maintainer applying the model's "no vendor on intrinsic axes" invariant, I want the `harnesses` field explicitly defined as a Destination-axis export allow-list, so that the presence of vendor names in `harnesses` is understood as legitimate rather than flagged as a leak, and the model does not contradict itself.

#### Acceptance Criteria

1. THE `harnesses` field SHALL be defined as the Destination-axis export-target allow-list: the set of Harness_Names an artifact may be exported to.
2. THE model-invariant check (Requirement 11) SHALL exempt `harnesses` from the "no Harness_Name in frontmatter" rule, because `harnesses` is the one field whose purpose is to name Destination harnesses.
3. THE `harnesses` field SHALL NOT be treated as a Classification_Axis: it SHALL NOT participate in Craft or Subject filtering, and it SHALL NOT influence Structure determination.
4. WHEN the Kanon_CLI exports an artifact, THE choice of which harnesses to build SHALL be constrained by the `harnesses` allow-list, and the install destination for each SHALL still be resolved from the Install_Path_Map per Requirement 4.
5. THE distinction between `harnesses` (Destination allow-list) and the removed source-format `harness` field (a false Structure claim) SHALL be documented so the two are not conflated.
