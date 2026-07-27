# Requirements Document

## Introduction

Kanon currently translates external content into canonical artifacts through two inbound paths: the path-based import flow in `src/import.ts` for Kiro powers, Kiro skills, and Superpowers skills, and the harness-native importer registry in `src/importers/`. Kanon translates canonical artifacts into harness-native output through `src/adapters/`, while `src/format-registry.ts` separately resolves target formats. Upstream acquisition is orchestrated by `scripts/sync-upstream.sh` and `scripts/sync-kiro-powers.sh`, which parse untyped `upstreams` configuration, perform Git subtree operations, and then invoke the import CLI.

Rosetta Stone will surface these capabilities as one coherent schema-translation component. The component will translate inbound upstream and harness-native source formats into the canonical `KnowledgeArtifact` model and translate canonical `KnowledgeArtifact` values into outbound harness-native formats. Rosetta Stone will provide one discoverable typed registry, explicit format contracts, deterministic translation plans, validation and compatibility diagnostics, inspection tooling, and migration paths for current importers, adapters, CLI options, configuration, and sync scripts. Git acquisition, filesystem orchestration, and output writing will remain outside the pure schema-translation boundary.

## Glossary

- **Kanon**: The CLI and library that authors, validates, and compiles knowledge artifacts.
- **Rosetta_Stone**: The Kanon component that coordinates format discovery, validation, and schema translation without acquiring repositories or writing translation outputs.
- **KnowledgeArtifact**: The canonical typed Kanon model containing frontmatter, Markdown body, hooks, MCP server definitions, workflows, source metadata, extra fields, and per-harness body overrides.
- **Canonical_Artifact_Directory**: The serialized Kanon representation containing `knowledge.md` and optional `hooks.yaml`, `mcp-servers.yaml`, `workflows/`, and per-harness body files.
- **Canonical_Equivalence**: Equality of two `KnowledgeArtifact` values after applying only normalization rules declared by the selected Format_Contract, including deterministic ordering and documented defaults.
- **Source_Format**: A named external or harness-native representation accepted as input to Rosetta_Stone, including current `kiro-power`, `kiro-skill`, `superpowers`, and harness-native representations.
- **Target_Format**: A named harness-native representation produced from a `KnowledgeArtifact`, including the formats currently declared by `HARNESS_FORMAT_REGISTRY`.
- **Format_Identifier**: A stable kebab-case name that uniquely identifies a Source_Format or Target_Format.
- **Format_Contract**: Versioned metadata that declares a format's identifier, direction, harness association, aliases, detection rules, path conventions, schema or grammar reference, canonical compatibility, defaults, and Lifecycle_Status.
- **Direction**: A Format_Contract capability value of `source`, `target`, or `bidirectional`.
- **Lifecycle_Status**: A Format_Contract state of `experimental`, `active`, `deprecated`, or `retired`.
- **Translation_Registry**: The typed Rosetta_Stone catalog of Format_Contracts and associated Source_Translator or Target_Translator implementations.
- **Source_Translator**: A pure translator that parses a Source_Document and returns a validated `KnowledgeArtifact` candidate plus Translation_Diagnostics.
- **Target_Translator**: A pure translator that accepts a validated `KnowledgeArtifact` and returns an ordered Translation_Plan plus Translation_Diagnostics.
- **Source_Document**: An in-memory input file set with normalized relative paths and text or byte content supplied to a Source_Translator.
- **Output_File**: A relative path, content payload, and executable flag proposed by a Target_Translator.
- **Translation_Plan**: An ordered set of Output_Files and planned artifact operations that a Translation_Orchestrator may inspect or apply.
- **Translation_Request**: A typed value containing Source_Documents or a `KnowledgeArtifact`, selected formats, format options, canonical schema version, Strict_Mode, and caller-supplied context.
- **Translation_Result**: A typed value containing translation status, canonical data or a Translation_Plan, and ordered Translation_Diagnostics.
- **Translation_Orchestrator**: The impure Kanon boundary that scans and reads source files, invokes Rosetta_Stone, evaluates Application_Policy, checks filesystem state, and applies a Translation_Plan.
- **Application_Policy**: Caller-supplied rules that determine whether non-blocking Translation_Diagnostics permit a Translation_Orchestrator to apply a Translation_Plan.
- **Blocking_Error**: An error Translation_Diagnostic that prevents application because of schema violation, data loss, invalid configuration, unsafe path, failed redaction, or another Format_Contract rule marked as blocking.
- **Dry_Run**: An execution mode that produces detection, validation, diagnostics, inspection, and a Translation_Plan without applying filesystem changes.
- **Pretty_Printer**: A pure serializer paired with a Source_Translator that renders the parsed value back into deterministic Source_Documents for the same Format_Contract.
- **Configuration_Validator**: The Kanon service that validates Acquisition_Profiles and Translation_Profiles before acquisition or translation.
- **Effective_Translation_Option**: A resolved translation option whose value affects generated Output_File paths or content.
- **Registry_Failure**: A typed registration failure returned when Translation_Diagnostic construction is unavailable.
- **Rosetta_Stone_Test_Suite**: The Bun test collection that verifies Rosetta_Stone unit, property, regression, and integration behavior.
- **Format_Detector**: The Rosetta_Stone service that evaluates Source_Documents against registered detection rules and returns ranked Detection_Candidates.
- **Detection_Candidate**: A Format_Identifier, confidence score from 0 through 1, and evidence list describing matched format characteristics.
- **Explicit_Format_Selection**: A caller-supplied Format_Identifier that bypasses automatic selection while retaining format validation.
- **Translation_Diagnostic**: A structured result containing a stable code, severity, phase, format identifier, source or canonical location, message, remediation, and optional degradation details.
- **Severity**: A Translation_Diagnostic classification of `info`, `warning`, or `error`.
- **Compatibility_Profile**: Format_Contract metadata that classifies each canonical capability as `full`, `partial`, or `none` and declares the applicable Degradation_Action for `partial` or `none` support.
- **Canonical_Capability**: A translatable `KnowledgeArtifact` feature such as frontmatter, body, hooks, MCP servers, workflows, body overrides, extra fields, or asset type.
- **Degradation_Action**: A declared `inline`, `comment`, or `omit` transformation used when a Target_Format cannot preserve a Canonical_Capability natively.
- **Strict_Mode**: Translation behavior that promotes compatibility loss and undeclared source-field loss to errors.
- **Inspection_Report**: A human-readable or Machine_Readable_Output summary of detection, selection, validation, compatibility, normalization, diagnostics, and the Translation_Plan.
- **Machine_Readable_Output**: Versioned JSON output with stable field names and deterministic ordering.
- **Translation_Profile**: Declarative project configuration that selects source and target formats, source subpaths, canonical destination metadata, collections, strictness, and format-specific options.
- **Acquisition_Profile**: Declarative project configuration for repository URL, branch, Git remote, and checked-out prefix used by acquisition orchestration.
- **Sync_Orchestrator**: The shell script or future Kanon service that performs Git acquisition, reads Acquisition_Profiles, supplies acquired Source_Documents to Rosetta_Stone, and applies approved Translation_Plans.
- **Allowed_Root**: A caller-approved filesystem directory within which orchestration may read Source_Documents or apply Translation_Plans.
- **Translation_CLI**: The `kanon rosetta` command namespace for registry discovery, detection, translation, and inspection.
- **Legacy_Import_Interface**: The current `kanon import` behaviors implemented by `src/import.ts` and `src/importers/`.
- **Legacy_Target_Interface**: The current `adapterRegistry`, `HARNESS_FORMAT_REGISTRY`, `resolveFormat`, and build adapter behaviors.
- **Compatibility_Facade**: A migration layer that preserves a legacy public interface while delegating schema translation to Rosetta_Stone.
- **Canonical_Parser**: The parser that converts a Canonical_Artifact_Directory into a validated `KnowledgeArtifact`.
- **Canonical_Serializer**: The pretty printer that converts a validated `KnowledgeArtifact` into a deterministic Canonical_Artifact_Directory Translation_Plan.
- **Pure_Translation_Boundary**: The execution boundary inside which translation performs no filesystem writes, Git operations, network requests, subprocess execution, environment mutation, clock reads, or random-value generation.
- **Sensitive_Value**: A credential, token, private key, password, or credential-like configuration value identified by Kanon's security validation rules.
- **Registry_Extension**: A Source_Translator, Target_Translator, and Format_Contract added without changing Rosetta_Stone orchestration logic.
- **Provenance_Record**: Machine-managed canonical metadata recording the upstream source, source format, source revision, and Base_Digest from which a `KnowledgeArtifact` was most recently distilled.
- **Base_Digest**: A deterministic fingerprint of the normalized `KnowledgeArtifact` produced by translating a specific upstream revision, used as the common ancestor for reconciliation.
- **Base_Artifact**: The `KnowledgeArtifact` reconstructed for the recorded upstream revision, serving as the common ancestor in a Three_Way_Reconciliation.
- **Ours_Artifact**: The current curated `KnowledgeArtifact` in the canonical knowledge tree.
- **Theirs_Artifact**: The `KnowledgeArtifact` produced by translating the freshly acquired upstream revision.
- **Field_Ownership_Policy**: Declarative per-upstream configuration classifying each Canonical_Capability or frontmatter field as `curation-owned`, `upstream-owned`, `merge-by-union`, or `machine-owned`, and thereby the reconciliation rule that applies to it.
- **Three_Way_Reconciliation**: A pure, field-level merge of Base_Artifact, Ours_Artifact, and Theirs_Artifact under a Field_Ownership_Policy that yields a merged `KnowledgeArtifact` plus Reconciliation_Diagnostics.
- **Reconciliation_Outcome**: The per-field and per-artifact classification of a Three_Way_Reconciliation as `clean`, `fast-forward`, `merged`, `conflict`, `orphaned`, or `new`.
- **Reconciliation_Report**: A deterministic, Machine_Readable_Output-capable summary of Reconciliation_Outcomes across every Provenance_Record-bearing artifact for an upstream.
- **Reconciliation_Conflict**: A Reconciliation_Outcome in which an upstream-owned field diverged from Base_Artifact in both Ours_Artifact and Theirs_Artifact, requiring human or agent resolution.
- **Curation_Loss**: Overwriting or discarding a curation-owned field value present in Ours_Artifact with a value derived from Theirs_Artifact.

## Requirements

### Requirement 1: Unified Translation Model

**User Story:** As a Kanon maintainer, I want inbound and outbound schema translations exposed through one component, so that format behavior has one coherent contract and vocabulary.

#### Acceptance Criteria

1. THE Rosetta_Stone SHALL expose Source_Format to `KnowledgeArtifact` translation and `KnowledgeArtifact` to Target_Format translation through the Translation_Registry.
2. THE Rosetta_Stone SHALL represent each translation outcome as validated canonical data or a Translation_Plan plus Translation_Diagnostics.
3. THE Rosetta_Stone SHALL preserve Git acquisition, filesystem scanning, user prompting, and output application outside the Pure_Translation_Boundary.
4. IF Git acquisition, filesystem scanning, user prompting, or output application enters the Pure_Translation_Boundary, THEN THE Rosetta_Stone SHALL fail the complete translation operation before invoking a translator.
5. WHEN a caller requests a Source_Format as a Target_Format, THE Rosetta_Stone SHALL accept the request only when the corresponding Format_Contract declares `target` or `bidirectional` Direction.
6. WHEN a caller requests a Target_Format as a Source_Format, THE Rosetta_Stone SHALL accept the request only when the corresponding Format_Contract declares `source` or `bidirectional` Direction.

### Requirement 2: Discoverable Typed Translation Registry

**User Story:** As a CLI user or extension author, I want to discover all supported formats and capabilities, so that I can select a valid translation without reading implementation files.

#### Acceptance Criteria

1. THE Translation_Registry SHALL expose every registered Format_Contract through a typed programmatic query.
2. WHEN a Format_Contract registration succeeds, THE Translation_Registry SHALL expose the Format_Contract through the typed programmatic query before making the Format_Identifier available for selection.
3. THE Translation_Registry SHALL assign one unique Format_Identifier to each Format_Contract.
4. THE Translation_Registry SHALL require each Format_Contract to declare Direction, harness association when applicable, aliases, Lifecycle_Status, contract version, canonical schema version range, detection rules, path conventions, schema or grammar reference, and Compatibility_Profile.
5. WHEN registration introduces a duplicate Format_Identifier or alias, THE Translation_Registry SHALL reject the conflicting registration with an error Translation_Diagnostic naming both registrations.
6. IF Translation_Diagnostic construction fails after detection of a duplicate Format_Identifier or alias, THEN THE Translation_Registry SHALL reject the conflicting registration and return a Registry_Failure.
7. WHEN a Registry_Extension declares an unsupported contract version, THE Translation_Registry SHALL reject the Registry_Extension with an error Translation_Diagnostic identifying the supported contract versions.
8. WHEN the Translation_CLI lists formats, THE Translation_CLI SHALL report Format_Identifier, Direction, harness association, aliases, Lifecycle_Status, and supported canonical schema versions for each Format_Contract.
9. THE Translation_Registry SHALL include Format_Contracts for every format currently exposed by the Legacy_Import_Interface and Legacy_Target_Interface.

### Requirement 3: Format Detection and Selection

**User Story:** As an artifact importer, I want explainable automatic detection and explicit format selection, so that ambiguous source layouts do not silently choose the wrong translator.

#### Acceptance Criteria

1. WHEN the Format_Detector receives Source_Documents, THE Format_Detector SHALL return Detection_Candidates ordered by descending confidence score and then by Format_Identifier.
2. THE Format_Detector SHALL include matched paths, markers, and metadata signatures as evidence for each Detection_Candidate.
3. WHEN exactly one Detection_Candidate meets the registered selection threshold, THE Rosetta_Stone SHALL select the corresponding Source_Format.
4. IF no Detection_Candidate meets the registered selection threshold, THEN THE Rosetta_Stone SHALL return an error Translation_Diagnostic with the evaluated Format_Identifiers and evidence summary.
5. IF multiple Detection_Candidates share the highest qualifying confidence score, THEN THE Rosetta_Stone SHALL return an ambiguity error Translation_Diagnostic with the tied Format_Identifiers and selection remediation.
6. WHEN a caller supplies an Explicit_Format_Selection, THE Rosetta_Stone SHALL use the selected Source_Format after validating the selected Format_Identifier and Direction.
7. IF Source_Documents violate the selected Format_Contract's required path or marker rules, THEN THE Rosetta_Stone SHALL block Source_Format selection and return an error Translation_Diagnostic identifying each missing or conflicting rule.
8. WHEN detection evaluates the same Source_Documents and registry version more than once, THE Format_Detector SHALL return identical ordered Detection_Candidates and evidence.

### Requirement 4: Inbound Translation to Canonical KnowledgeArtifact

**User Story:** As a Kanon contributor, I want every inbound format translated into the canonical model with explicit preservation and loss reporting, so that imported artifacts can be validated and compiled consistently.

#### Acceptance Criteria

1. WHEN a Source_Translator receives Source_Documents that satisfy the selected Format_Contract, THE Source_Translator SHALL return a `KnowledgeArtifact` candidate covering every mappable source field and file.
2. WHEN source data maps to `KnowledgeArtifact` frontmatter, body, hooks, MCP servers, workflows, body overrides, or extra fields, THE Source_Translator SHALL place the source data in the corresponding canonical field.
3. WHEN source data has no declared canonical mapping, THE Source_Translator SHALL preserve the source data in `extraFields` or return a Translation_Diagnostic naming the source location and loss behavior.
4. WHEN a Source_Translator creates default canonical values, THE Source_Translator SHALL return an info Translation_Diagnostic naming each default and the governing Format_Contract rule.
5. IF parsed source content violates the Source_Format schema or grammar, THEN THE Source_Translator SHALL return error Translation_Diagnostics with source paths and field or syntax locations.
6. IF the resulting `KnowledgeArtifact` candidate violates the canonical schema, THEN THE Source_Translator SHALL return error Translation_Diagnostics mapped to canonical field paths.
7. IF inbound validation identifies a canonical schema violation or source-data loss classified as error severity, THEN THE Rosetta_Stone SHALL withhold a writable Canonical_Artifact_Directory Translation_Plan.
8. WHEN inbound error Translation_Diagnostics identify neither a canonical schema violation nor source-data loss, THE Rosetta_Stone SHALL retain the Canonical_Artifact_Directory Translation_Plan for inspection and permit application only when Application_Policy authorizes the diagnostic codes.
9. THE Source_Translator SHALL preserve Source_Document ordering independence by producing Canonically_Equivalent results for every permutation of the same Source_Document set.

### Requirement 5: Canonical Parsing, Serialization, and Round Trips

**User Story:** As an artifact author, I want canonical parsing and serialization to preserve artifact meaning, so that inspection and migration do not alter valid artifacts.

#### Acceptance Criteria

1. WHEN the Canonical_Parser receives a Canonical_Artifact_Directory, THE Canonical_Parser SHALL validate `knowledge.md`, optional `hooks.yaml`, optional `mcp-servers.yaml`, optional `workflows/`, and optional per-harness body files against the canonical schema and declared file grammar.
2. WHEN the Canonical_Serializer receives a valid `KnowledgeArtifact`, THE Canonical_Serializer SHALL produce a deterministic Canonical_Artifact_Directory Translation_Plan.
3. WHEN the Canonical_Serializer serializes a valid `KnowledgeArtifact` and the Canonical_Parser parses the resulting Canonical_Artifact_Directory, THE Canonical_Parser SHALL produce a Canonically_Equivalent `KnowledgeArtifact`.
4. WHEN a Source_Translator parses valid Source_Documents, the Pretty_Printer serializes the parsed value, and the Source_Translator parses the serialized Source_Documents, THE Source_Translator SHALL produce a Canonically_Equivalent `KnowledgeArtifact` under the Format_Contract normalization rules.
5. THE Canonical_Serializer SHALL preserve unknown frontmatter fields through the `extraFields` mapping.
6. THE Canonical_Serializer SHALL order generated files, YAML keys governed by the canonical contract, and diagnostics according to documented deterministic ordering rules.

### Requirement 6: Outbound Harness-Native Translation

**User Story:** As an artifact author, I want canonical artifacts translated into selected harness-native formats, so that one artifact can target each supported coding assistant format.

#### Acceptance Criteria

1. WHEN a Target_Translator receives a valid `KnowledgeArtifact` and Target_Format, THE Target_Translator SHALL return an ordered Translation_Plan and Translation_Diagnostics.
2. WHEN a Target_Format supports multiple variants, THE Rosetta_Stone SHALL resolve an explicit variant before the Format_Contract default variant.
3. WHEN a Target_Format variant is omitted, THE Rosetta_Stone SHALL select the default currently declared by `HARNESS_FORMAT_REGISTRY` for the associated harness.
4. IF a requested Target_Format or variant is absent from the Translation_Registry, THEN THE Rosetta_Stone SHALL return an error Translation_Diagnostic listing valid Format_Identifiers or variants for the associated harness.
5. THE Target_Translator SHALL translate canonical body, hooks, MCP servers, workflows, body overrides, and harness configuration according to the selected Compatibility_Profile.
6. THE Target_Translator SHALL return Output_Files with normalized relative paths, deterministic content, deterministic ordering, and explicit executable flags.
7. WHEN a Target_Translator receives Canonically_Equivalent `KnowledgeArtifact` values and identical translation options, THE Target_Translator SHALL return byte-identical Translation_Plans and identical ordered Translation_Diagnostics.
8. WHEN at least one Effective_Translation_Option differs between two requests, THE Target_Translator SHALL return non-byte-identical Translation_Plans that reflect the changed option.

### Requirement 7: Compatibility and Degradation Diagnostics

**User Story:** As an artifact author, I want precise compatibility and degradation reporting before output is written, so that I can assess fidelity for each target harness.

#### Acceptance Criteria

1. THE Format_Contract SHALL classify every Canonical_Capability as `full`, `partial`, or `none` for the associated Target_Format.
2. THE Format_Contract SHALL declare a Degradation_Action for every `partial` or `none` Canonical_Capability classification.
3. WHEN a Target_Translator encounters a used Canonical_Capability classified as `partial`, THE Target_Translator SHALL return a warning Translation_Diagnostic containing every available value among canonical field, target format, Degradation_Action, and expected semantic change.
4. IF a `partial` compatibility Translation_Diagnostic cannot include canonical field, target format, Degradation_Action, or expected semantic change, THEN THE Target_Translator SHALL identify each unavailable detail in the Translation_Diagnostic.
5. WHEN a Target_Translator encounters a used Canonical_Capability classified as `none`, THE Target_Translator SHALL return a warning Translation_Diagnostic identifying the omitted canonical field, target format, and remediation.
6. WHEN Strict_Mode detects any compatibility violation, THE Rosetta_Stone SHALL promote every compatibility Translation_Diagnostic for the Translation_Request to error severity.
7. WHEN Strict_Mode encounters unmapped Source_Format data outside a declared lossless preservation channel, THE Rosetta_Stone SHALL return an error Translation_Diagnostic for each unmapped source location.
8. WHEN translation uses a Degradation_Action, THE Inspection_Report SHALL count affected canonical values by Canonical_Capability and Degradation_Action.
9. THE Rosetta_Stone SHALL align target compatibility outcomes with Kanon's current asset compatibility and harness capability declarations until a documented migration changes a declaration.

### Requirement 8: Validation and Structured Diagnostics

**User Story:** As a CLI and library consumer, I want consistent validation and diagnostics across translation phases, so that failures can be corrected programmatically or interactively.

#### Acceptance Criteria

1. WHEN a translation phase is active, THE Rosetta_Stone SHALL validate the Translation_Request, selected Format_Contract, source representation, canonical representation, compatibility outcome, or Translation_Plan applicable to the active phase boundary.
2. THE Rosetta_Stone SHALL return each Translation_Diagnostic with code, Severity, phase, Format_Identifier, message, and remediation.
3. WHEN a Translation_Diagnostic refers to source data, THE Rosetta_Stone SHALL include the normalized source path and available field, line, or syntax location.
4. WHEN a Translation_Diagnostic refers to canonical data, THE Rosetta_Stone SHALL include the canonical field path and artifact name.
5. WHEN multiple Translation_Diagnostics are returned, THE Rosetta_Stone SHALL order Translation_Diagnostics by severity, phase, normalized path, field location, and diagnostic code.
6. WHEN Machine_Readable_Output is requested, THE Rosetta_Stone SHALL emit diagnostics using a versioned JSON schema and stable diagnostic codes.
7. IF validation returns a Blocking_Error, THEN THE Rosetta_Stone SHALL mark the Translation_Result unsuccessful and exclude the affected output operations.

### Requirement 9: Dry-Run and Inspection

**User Story:** As an operator, I want to inspect detection and translation before changing files, so that I can verify format selection, mappings, and output impact.

#### Acceptance Criteria

1. WHEN Dry_Run is requested, THE Translation_Orchestrator SHALL perform detection, parsing, canonical validation, target translation, compatibility analysis, path validation, and collision analysis without writing files.
2. WHEN Dry_Run and write-enabled execution receive the same inputs and filesystem preconditions, THE Translation_Orchestrator SHALL produce equivalent Inspection_Reports and Translation_Plans before application.
3. THE Inspection_Report SHALL include selected formats, detection confidence and evidence, Format_Contract versions, canonical artifact summaries, defaults, normalizations, compatibility counts, Translation_Diagnostics, and planned Output_File paths.
4. WHEN requested by a terminal user, THE Translation_CLI SHALL render a human-readable Inspection_Report.
5. WHEN Machine_Readable_Output is requested, THE Translation_CLI SHALL render the Inspection_Report as versioned JSON without terminal color sequences.
6. WHEN inspection includes Output_File content and complete redaction is guaranteed, THE Inspection_Report SHALL redact Sensitive_Values while preserving affected field names and source locations.
7. IF complete Sensitive_Value redaction cannot be guaranteed for Output_File content, THEN THE Inspection_Report SHALL exclude the complete Output_File content payload.
8. WHEN inspection excludes Output_File content, THE Inspection_Report SHALL exclude content-derived Sensitive_Value field names and source locations.
9. WHEN Dry_Run detects an existing destination, THE Inspection_Report SHALL identify the collision policy and the affected normalized destination path.

### Requirement 10: CLI and Declarative Configuration Integration

**User Story:** As a Kanon user, I want Rosetta Stone available through CLI commands and typed project configuration, so that translation is repeatable locally and in automation.

#### Acceptance Criteria

1. THE Translation_CLI SHALL provide commands to list formats, detect Source_Formats, inspect translations, and execute translations.
2. WHEN the Translation_CLI receives an Explicit_Format_Selection, THE Translation_CLI SHALL validate the Format_Identifier against the requested Direction before translation.
3. WHEN the Translation_CLI resolves source or target options, THE Translation_CLI SHALL treat absent Translation_Profile options as empty defaults, apply documented command-argument precedence, and report the resolved values in the Inspection_Report.
4. THE Configuration_Validator SHALL validate Translation_Profiles and Acquisition_Profiles through typed schemas.
5. THE Configuration_Validator SHALL require each Translation_Profile source format and target format to resolve through the Translation_Registry.
6. THE Configuration_Validator SHALL distinguish repository URL, branch, remote, and checkout prefix fields as Acquisition_Profile metadata from source format, source subpath, canonical destination, collection, strictness, and format-option fields as Translation_Profile metadata.
7. IF configuration contains unknown Format_Identifiers, invalid format options, or incompatible canonical schema versions, THEN THE Configuration_Validator SHALL halt acquisition and translation and return field-addressed error Translation_Diagnostics.
8. WHEN a Translation_Profile omits a target variant, THE Configuration_Validator SHALL resolve the current registered default and expose the resolved variant in inspection output.

### Requirement 11: Sync and Acquisition Separation

**User Story:** As a maintainer of upstream synchronization, I want Git acquisition separated from schema translation, so that repository operations can evolve without changing translation logic.

#### Acceptance Criteria

1. THE Sync_Orchestrator SHALL perform Git remote, subtree initialization, subtree pull, and checkout-prefix operations outside the Pure_Translation_Boundary.
2. WHEN acquisition completes, THE Sync_Orchestrator SHALL pass acquired Source_Documents and a Translation_Profile to Rosetta_Stone without passing Git credentials or Git process handles.
3. WHERE pull-only mode is selected, THE Sync_Orchestrator SHALL complete acquisition without invoking Rosetta_Stone translation.
4. WHERE import-only mode is selected, THE Sync_Orchestrator SHALL invoke Rosetta_Stone translation without executing Git acquisition operations.
5. WHERE Dry_Run is selected without pull-only mode, THE Sync_Orchestrator SHALL inspect translation without applying the Translation_Plan.
6. IF acquisition fails, THEN THE Sync_Orchestrator SHALL report the acquisition failure without invoking Source_Translators or Target_Translators for the failed Acquisition_Profile.
7. WHEN multiple Acquisition_Profiles are synchronized, THE Sync_Orchestrator SHALL isolate acquisition status from translation status for each profile in the summary.
8. THE Rosetta_Stone SHALL accept Source_Documents independently of repository provider, branch strategy, or Git subtree usage.

### Requirement 12: Deterministic Pure Translation Boundaries

**User Story:** As a library consumer, I want translation logic to be deterministic and side-effect free, so that results are reproducible and easy to test.

#### Acceptance Criteria

1. THE Source_Translator SHALL operate within the Pure_Translation_Boundary after Source_Documents enter Rosetta_Stone.
2. THE Target_Translator SHALL operate within the Pure_Translation_Boundary and return Output_Files instead of writing Output_Files.
3. THE Format_Detector SHALL operate within the Pure_Translation_Boundary after Source_Documents enter Rosetta_Stone.
4. WHEN the same Source_Documents, Format_Contracts, canonical schema version, and translation options are supplied more than once, THE Rosetta_Stone SHALL return Canonically_Equivalent results and identical ordered Translation_Diagnostic content excluding operation identifiers or timestamps added by the Translation_Orchestrator.
5. WHEN the same `KnowledgeArtifact`, Format_Contracts, canonical schema version, and translation options are supplied more than once, THE Rosetta_Stone SHALL return byte-identical Translation_Plans and identical ordered Translation_Diagnostic content excluding operation identifiers or timestamps added by the Translation_Orchestrator.
6. THE Rosetta_Stone SHALL require callers to supply every context value that can affect translation through an explicit Translation_Request.
7. THE Rosetta_Stone SHALL exclude filesystem state, environment variables, current time, random values, network state, and Git state from implicit translation inputs.

### Requirement 13: Security and Path Boundaries

**User Story:** As a repository operator, I want translation constrained to approved paths and safe content handling, so that imported content cannot escape workspace boundaries or expose credentials.

#### Acceptance Criteria

1. THE Rosetta_Stone SHALL accept only normalized relative Source_Document and Output_File paths within translation requests and plans.
2. IF a Source_Document or Output_File path is absolute, contains traversal outside the logical root, or normalizes outside the logical root, THEN THE Rosetta_Stone SHALL return an error Translation_Diagnostic naming the rejected path.
3. WHEN an Translation_Orchestrator reads Source_Documents, THE Translation_Orchestrator SHALL resolve symbolic links and verify each resolved source path remains within the source Allowed_Root.
4. WHEN an Translation_Orchestrator applies a Translation_Plan, THE Translation_Orchestrator SHALL resolve parent paths and verify each destination remains within the destination Allowed_Root.
5. WHEN every Output_File path passes individual path validation, THE Rosetta_Stone SHALL check the normalized destination paths for collisions.
6. IF two individually valid Output_Files normalize to the same destination path, THEN THE Rosetta_Stone SHALL reject the Translation_Plan with a collision error Translation_Diagnostic.
7. THE Source_Translator SHALL treat Source_Document content as data without executing embedded commands, scripts, templates, or instructions.
8. THE Target_Translator SHALL treat canonical content as data without executing embedded commands, scripts, templates supplied by source content, or instructions.
9. WHEN Source_Documents contain Sensitive_Values, THE Rosetta_Stone SHALL preserve or reject Sensitive_Values according to the Format_Contract and return redacted Translation_Diagnostics.
10. IF complete Translation_Diagnostic redaction cannot be guaranteed, THEN THE Rosetta_Stone SHALL abort the complete translation operation without returning unredacted diagnostic content.
11. THE Inspection_Report SHALL omit raw Sensitive_Values from human-readable and Machine_Readable_Output representations.
12. THE Translation_Profile SHALL accept credential references through approved configuration mechanisms without embedding credential values in committed project configuration.

### Requirement 14: Migration and Backward Compatibility

**User Story:** As an existing Kanon user, I want current imports, builds, adapters, and sync scripts to continue working during migration, so that Rosetta Stone adoption does not break established automation.

#### Acceptance Criteria

1. WHEN `kanon import <path> --all --format <format> --collections <names> --knowledge-dir <dir> --dry-run` uses a currently supported option combination, THE Compatibility_Facade SHALL preserve the Legacy_Import_Interface's source selection, collection assignment, destination selection, collision behavior, and dry-run behavior.
2. WHEN `kanon import` runs without a path or with `--harness`, THE Compatibility_Facade SHALL preserve current harness-native scanning, explicit harness filtering, force handling, confirmation behavior, and destination selection.
3. WHEN legacy Source_Format identifiers can be preserved without a registry conflict, THE Compatibility_Facade SHALL preserve `kiro-power`, `kiro-skill`, `superpowers`, and `auto` as canonical identifiers or declared aliases.
4. IF a registry conflict prevents preservation of a legacy Source_Format identifier, THEN THE Compatibility_Facade SHALL continue migration with a warning Translation_Diagnostic naming the replacement Format_Identifier.
5. THE Compatibility_Facade SHALL preserve current harness names, target variants, and default target variants exposed by `HARNESS_FORMAT_REGISTRY`.
6. WHEN legacy `harness-config` selects a valid target variant, THE Compatibility_Facade SHALL resolve the same target variant produced by the Legacy_Target_Interface.
7. WHEN legacy `harness-config.kiro.power: true` omits `format`, THE Compatibility_Facade SHALL select Kiro `power` output and emit the existing deprecation guidance.
8. WHEN `scripts/sync-upstream.sh` processes a current `upstreams` entry, THE Sync_Orchestrator SHALL preserve `repo`, `branch`, `prefix`, `format`, `collection`, `knowledgeDir`, and `skillsPath` behavior through validated Acquisition_Profile and Translation_Profile mappings.
9. WHEN `scripts/sync-kiro-powers.sh` invokes import behavior, THE Sync_Orchestrator SHALL preserve Kiro power format selection, `kiro-official` collection assignment, destination selection, pull-only behavior, import-only behavior, and dry-run behavior.
10. WHEN a legacy interface delegates to Rosetta_Stone, THE Compatibility_Facade SHALL emit equivalent canonical artifacts or harness-native Output_Files for repository regression fixtures.
11. WHERE a legacy field or command is deprecated, THE Compatibility_Facade SHALL emit a stable deprecation diagnostic with replacement syntax and the planned removal policy.

### Requirement 15: Extensibility for Formats and Harnesses

**User Story:** As an extension author, I want to add a format or harness through a documented contract, so that new translators do not require changes to central orchestration logic.

#### Acceptance Criteria

1. THE Translation_Registry SHALL accept a Registry_Extension that supplies a valid Format_Contract and the translators required by the declared Direction.
2. WHEN a Registry_Extension is registered, THE Translation_CLI SHALL expose the Registry_Extension through the same list, detect, inspect, and translate flows as built-in formats.
3. THE Registry_Extension SHALL declare detection rules, format options, schema or grammar reference, canonical version compatibility, Compatibility_Profile, diagnostics, normalization rules, and security constraints.
4. WHEN Registry_Extension registration is attempted without a translator required by the declared Direction, THE Translation_Registry SHALL reject the active registration attempt with an error Translation_Diagnostic.
5. IF a Registry_Extension declares `partial` or `none` support without a Degradation_Action, THEN THE Translation_Registry SHALL reject registration with an error Translation_Diagnostic.
6. WHEN a new harness is registered, THE Rosetta_Stone SHALL permit one or more Target_Formats and Source_Formats without requiring changes to format detection or translation orchestration.
7. WHEN a Format_Contract alias or Lifecycle_Status changes, THE Translation_Registry SHALL preserve explicit version and deprecation metadata for Machine_Readable_Output consumers.

### Requirement 16: Verification and Property-Based Correctness

**User Story:** As a Kanon maintainer, I want automated correctness checks across translation boundaries, so that schema edge cases and regressions are detected before release.

#### Acceptance Criteria

1. THE Rosetta_Stone_Test_Suite SHALL include property-based tests generating valid `KnowledgeArtifact` values for Canonical_Serializer and Canonical_Parser round-trip equivalence.
2. THE Rosetta_Stone_Test_Suite SHALL include property-based tests generating valid Source_Documents for each Source_Translator and corresponding Pretty_Printer round-trip equivalence.
3. THE Rosetta_Stone_Test_Suite SHALL include property-based tests for Source_Document permutation invariance, repeated-translation determinism, and Output_File ordering determinism.
4. THE Rosetta_Stone_Test_Suite SHALL include property-based tests generating absolute paths, traversal segments, separator variants, normalization collisions, and symbolic-link orchestration fixtures for path-boundary enforcement.
5. THE Rosetta_Stone_Test_Suite SHALL include property-based tests for detection stability, explicit selection precedence, and ambiguous detection reporting.
6. THE Rosetta_Stone_Test_Suite SHALL include registry invariant tests covering unique identifiers, unique aliases, Direction implementation completeness, valid defaults, canonical version compatibility, and complete Compatibility_Profiles.
7. THE Rosetta_Stone_Test_Suite SHALL include fixture-based regression tests for every current legacy importer and outbound adapter format.
8. THE Rosetta_Stone_Test_Suite SHALL include CLI integration tests for human-readable output, Machine_Readable_Output, Dry_Run, Strict_Mode, configuration precedence, and legacy command compatibility.
9. THE Rosetta_Stone_Test_Suite SHALL use mocked or local fixtures for pure translation properties and representative integration tests for Git acquisition orchestration.
10. WHEN any property-based test fails, THE Rosetta_Stone_Test_Suite SHALL report the minimized counterexample produced by the property-testing framework.

### Requirement 17: Documentation and Operational Guidance

**User Story:** As a Kanon user or contributor, I want Rosetta Stone documentation and migration guidance, so that I can configure translations and extend the registry correctly.

#### Acceptance Criteria

1. THE Kanon documentation SHALL describe the Rosetta_Stone architecture, Pure_Translation_Boundary, Translation_Registry, and separation from the Sync_Orchestrator.
2. THE Kanon documentation SHALL provide CLI examples for format listing, detection, explicit selection, inspection, Dry_Run, Strict_Mode, Machine_Readable_Output, inbound translation, and outbound translation.
3. THE Kanon documentation SHALL define the Translation_Profile and Acquisition_Profile fields with validation rules, defaults, precedence, and security constraints.
4. THE Kanon documentation SHALL publish the registered Format_Identifiers, aliases, Directions, target variants, detection rules, canonical version ranges, Compatibility_Profiles, and Lifecycle_Statuses.
5. THE Kanon documentation SHALL provide a migration guide for `src/import.ts`, `src/importers/`, `adapterRegistry`, `HARNESS_FORMAT_REGISTRY`, `kanon import`, `sync-upstream.sh`, `sync-kiro-powers.sh`, and current `upstreams` configuration.
6. THE Kanon documentation SHALL provide an extension guide containing the Format_Contract, translator interfaces, diagnostic conventions, required property tests, fixture tests, and registration checks.
7. THE Kanon documentation SHALL explain canonical and source round-trip normalization rules and every declared lossy Degradation_Action.
8. THE Kanon documentation SHALL document path boundaries, symbolic-link checks, Sensitive_Value redaction, and the prohibition on command execution from translated content.

### Requirement 18: Curation-Preserving Re-Synchronization

**User Story:** As a maintainer of distilled upstream artifacts, I want re-synchronization to carry upstream improvements into curated artifacts without discarding my curation, so that maintaining a growing set of third-party collections does not require manual per-artifact diffing or re-editing.

#### Acceptance Criteria

1. WHEN a Source_Translator produces a `KnowledgeArtifact` during acquisition-driven import, THE Rosetta_Stone SHALL populate a Provenance_Record containing the upstream identifier, source subpath, Source_Format, source revision, contract identifier and version, and Base_Digest.
2. THE Rosetta_Stone SHALL compute the Base_Digest deterministically from the normalized Theirs_Artifact so that identical upstream revisions and translation options yield an identical Base_Digest.
3. WHEN an artifact carrying a Provenance_Record is re-synchronized and its recorded Base_Digest equals the freshly translated Theirs_Artifact digest, THE Reconciliation_Report SHALL classify the artifact `clean` and THE Sync_Orchestrator SHALL make no change to the artifact.
4. WHEN an upstream-owned field differs between Base_Artifact and Theirs_Artifact and is identical between Base_Artifact and Ours_Artifact, THE Three_Way_Reconciliation SHALL apply the Theirs_Artifact value and classify the field `fast-forward`.
5. WHEN an upstream-owned field differs between Base_Artifact and Theirs_Artifact and also differs between Base_Artifact and Ours_Artifact, THE Three_Way_Reconciliation SHALL preserve the Ours_Artifact value, classify the field `conflict`, and return a field-addressed Reconciliation_Diagnostic identifying the Base_Artifact, Ours_Artifact, and Theirs_Artifact values.
6. THE Three_Way_Reconciliation SHALL preserve the Ours_Artifact value for every curation-owned field regardless of Theirs_Artifact changes, and SHALL never produce Curation_Loss without an explicit caller override.
7. WHEN a field is classified merge-by-union, THE Three_Way_Reconciliation SHALL produce the union of Ours_Artifact and Theirs_Artifact members minus members removed from Base_Artifact to Theirs_Artifact, in a deterministic order.
8. THE Three_Way_Reconciliation SHALL recompute machine-owned fields, including the Provenance_Record and Base_Digest, from the reconciled result and the new source revision.
9. WHEN an Ours_Artifact carries a Provenance_Record whose source subpath is absent from the acquired upstream, THE Reconciliation_Report SHALL classify the artifact `orphaned` and SHALL not delete or overwrite the artifact.
10. WHEN an acquired upstream artifact has no Ours_Artifact counterpart by Provenance_Record identity, THE Reconciliation_Report SHALL classify it `new`.
11. WHERE the Base_Artifact for a recorded revision cannot be reconstructed, THE Three_Way_Reconciliation SHALL degrade to a two-way merge of Ours_Artifact and Theirs_Artifact and classify affected fields with a distinct reduced-confidence Reconciliation_Diagnostic rather than silently overwriting.
12. THE Three_Way_Reconciliation SHALL operate within the Pure_Translation_Boundary, consuming Base_Artifact, Ours_Artifact, Theirs_Artifact, and a Field_Ownership_Policy as explicit inputs and returning a merged `KnowledgeArtifact` and Reconciliation_Diagnostics without filesystem, Git, or clock access.
13. WHEN the same Base_Artifact, Ours_Artifact, Theirs_Artifact, and Field_Ownership_Policy are supplied more than once, THE Three_Way_Reconciliation SHALL return a Canonically_Equivalent merged `KnowledgeArtifact` and identical ordered Reconciliation_Diagnostics.
14. THE Configuration_Validator SHALL validate each Field_Ownership_Policy through a typed schema and SHALL reject a policy that classifies an unknown field or omits a classification for a reconcilable Canonical_Capability.
15. THE Reconciliation_Report SHALL be renderable as a human-readable summary and as Machine_Readable_Output with stable ordering by Reconciliation_Outcome, upstream identifier, and artifact name.
16. IF the Provenance_Record of an Ours_Artifact fails Base_Digest self-verification because it was hand-edited, THEN THE Rosetta_Stone SHALL return a warning Reconciliation_Diagnostic and treat the artifact under the reduced-confidence two-way path.
17. WHERE an artifact has no Provenance_Record, THE Sync_Orchestrator SHALL fall back to the existing collision behavior and SHALL exclude the artifact from Three_Way_Reconciliation.
18. WHEN a Reconciliation_Conflict occurs in one field, THE Three_Way_Reconciliation SHALL still apply the resolved value for every non-conflicting field of the same artifact, classify the artifact `conflict`, and confine human resolution to the conflicting fields identified in the Reconciliation_Diagnostics.
