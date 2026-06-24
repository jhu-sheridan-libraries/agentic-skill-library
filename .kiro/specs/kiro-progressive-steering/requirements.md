# Requirements Document

## Introduction

Kiro supports three steering inclusion modes that together form what we call **Progressive Steering**: `always` (loaded into every agent interaction), `fileMatch` (loaded only when a file matching a glob is in context), and `manual` (loaded only when a user references the steering file via `#`). Progressive Steering means choosing the lightest inclusion mode that still delivers the steering at the right moment, so every prompt is not bloated with always-on context.

Skill Forge's Kiro adapter and Nunjucks templates support the three modes mechanically — `templates/harness-adapters/kiro/steering.md.njk` renders the `inclusion:` and `fileMatchPattern:` frontmatter fields — but the rest of the pipeline does not help authors pick the right mode, does not validate it, and does not surface the distribution of inclusion modes on build or install. The default when `inclusion` is absent is `always`, which turns every steering file shipped via Skill Forge into global context whether or not it needs to be. That defeats the value Kiro's Progressive Steering is designed to offer.

This feature closes that gap across the Skill Forge build pipeline, install pipeline, Kiro adapter (for both `steering` and `power` formats), validator, and interactive `new`/wizard flow. The goal is that by the time a Kiro artifact lands in a consumer's `.kiro/steering/` directory, its inclusion mode is a deliberate choice by the author, validated and summarized by the tooling, rather than an accidental `always`.

## Glossary

- **Kiro**: The Kiro IDE harness, registered as the `"kiro"` `HarnessName` in `src/schemas.ts`. Consumes steering files under `.kiro/steering/`, hooks under `.kiro/hooks/`, and optionally a `POWER.md` power bundle at the repo root.
- **Steering_File**: A markdown file installed under `.kiro/steering/<name>.md` whose YAML frontmatter carries an `inclusion` mode and (optionally) a `fileMatchPattern`.
- **Inclusion_Mode**: One of the three Kiro steering modes: `always`, `fileMatch`, or `manual`. Modelled in `src/schemas.ts` as `InclusionModeSchema` (which also accepts a fourth value `auto` used by other harnesses). For Kiro steering output, only `always`, `fileMatch`, and `manual` are valid.
- **Progressive_Inclusion_Mode**: Any `Inclusion_Mode` other than `always`. Specifically `fileMatch` and `manual`. Steering files using a Progressive_Inclusion_Mode do not contribute to every agent prompt.
- **Progressive_Steering**: The practice of picking the lightest `Inclusion_Mode` that still delivers a steering file at the right moment, and the tooling that helps authors and installers apply that practice.
- **File_Match_Pattern**: The glob expression emitted as `fileMatchPattern:` in a Kiro steering file's frontmatter. Only meaningful when `inclusion: fileMatch`. Today sourced from `harness-config.kiro.fileMatchPattern` in an artifact's frontmatter.
- **Kiro_Adapter**: The pure function `kiroAdapter` in `src/adapters/kiro.ts` that emits Kiro output files for a `KnowledgeArtifact`.
- **Steering_Template**: The Nunjucks template `templates/harness-adapters/kiro/steering.md.njk` that renders the YAML frontmatter for a steering file.
- **Power_Format**: The Kiro output format selected via `harness-config.kiro.format: "power"`, which emits `POWER.md` at the install root and emits steering files under a nested `steering/` directory (both artifact-generated and workflow-copied files).
- **Steering_Format**: The default Kiro output format, which emits a single `<artifact-name>.md` steering file per artifact (no POWER.md).
- **Build_Pipeline**: The `build`/`buildCommand` flow in `src/build.ts` that reads artifacts, dispatches to adapters, and writes to `dist/<harness>/<artifact>/`.
- **Install_Pipeline**: The `install`/`installCommand` flow in `src/install.ts` that copies files from `dist/<harness>/<artifact>/` into the consumer's `HARNESS_INSTALL_PATHS[harness]` (`.kiro` for Kiro).
- **Validator**: The `validateArtifact`/`validateAll` flow in `src/validate.ts`.
- **Wizard**: The interactive `new` flow in `src/wizard.ts` invoked by `src/new.ts` to scaffold a new knowledge artifact.
- **Inclusion_Summary**: A per-Kiro-artifact-set breakdown of how many steering files use each `Inclusion_Mode`, printed by the Build_Pipeline and Install_Pipeline.
- **Artifact**: A knowledge artifact as defined by `KnowledgeArtifactSchema` in `src/schemas.ts`.

## Requirements

### Requirement 1: Authors Declare Kiro Inclusion Mode Explicitly in harness-config

**User Story:** As a knowledge artifact author, I want the Kiro inclusion mode to live inside `harness-config.kiro` alongside other Kiro-specific settings, so that my Kiro-specific Progressive_Steering choices do not leak into other harnesses' output and I can audit them in one place.

#### Acceptance Criteria

1. THE FrontmatterSchema SHALL accept an optional `harness-config.kiro.inclusion` field whose value is one of `"always"`, `"fileMatch"`, or `"manual"`.
2. THE FrontmatterSchema SHALL accept an optional `harness-config.kiro.fileMatchPattern` field whose value is a non-empty string when present.
3. WHEN `harness-config.kiro.inclusion` is set to a value other than `"always"`, `"fileMatch"`, or `"manual"`, THE Validator SHALL produce a validation error naming the field, the invalid value, and the three valid values.
4. WHEN `harness-config.kiro.inclusion` is `"fileMatch"` and `harness-config.kiro.fileMatchPattern` is absent or an empty string, THE Validator SHALL produce a validation error explaining that `fileMatchPattern` is required when `inclusion` is `fileMatch`.
5. WHEN `harness-config.kiro.inclusion` is `"always"` or `"manual"` and `harness-config.kiro.fileMatchPattern` is present, THE Validator SHALL produce a validation warning that `fileMatchPattern` is ignored unless `inclusion` is `fileMatch`.
6. WHEN both top-level `inclusion` and `harness-config.kiro.inclusion` are present on an artifact, THE Kiro_Adapter SHALL use `harness-config.kiro.inclusion` as the Kiro output value and SHALL NOT modify the top-level `inclusion` field for other adapters.

### Requirement 2: Kiro Adapter Resolves Inclusion from harness-config with Defined Precedence

**User Story:** As an author, I want a single documented rule for how the Kiro adapter picks an inclusion mode, so that I can predict the emitted frontmatter without reading the template.

#### Acceptance Criteria

1. THE Kiro_Adapter SHALL resolve the emitted `inclusion` value using this precedence, highest first: (a) `harness-config.kiro.inclusion`, (b) top-level `frontmatter.inclusion`, (c) the default specified by Requirement 8.
2. THE Kiro_Adapter SHALL pass the resolved `inclusion` value and the resolved `fileMatchPattern` value explicitly into the Steering_Template render context rather than relying on the template to read `artifact.frontmatter.inclusion` directly.
3. WHEN the resolved `inclusion` is `"fileMatch"`, THE Kiro_Adapter SHALL resolve `fileMatchPattern` from `harness-config.kiro.fileMatchPattern` and SHALL pass it to the Steering_Template.
4. WHEN the resolved `inclusion` is `"always"` or `"manual"`, THE Kiro_Adapter SHALL NOT emit a `fileMatchPattern:` line in the Steering_File frontmatter regardless of what `harness-config.kiro.fileMatchPattern` contains.
5. THE Steering_Template SHALL emit exactly one `inclusion:` line in the frontmatter block, whose value is the resolved `Inclusion_Mode`.
6. WHEN the Kiro_Adapter emits a Steering_File in Power_Format (under `steering/<artifact-name>.md`), THE adapter SHALL apply the same precedence and emission rules from criteria 1 through 5 as it does for Steering_Format.

### Requirement 3: Round-Trip Correctness for Frontmatter Inclusion Rendering

**User Story:** As a maintainer, I want parsing an artifact's Kiro inclusion choice, rendering it through the Steering_Template, and re-parsing the emitted YAML to yield the same inclusion mode, so that I can trust the adapter preserves authored intent.

#### Acceptance Criteria

1. FOR ALL valid combinations of `harness-config.kiro.inclusion` in `{"always", "fileMatch", "manual"}` and any non-empty string `fileMatchPattern` when applicable, parsing the Steering_Template output as YAML frontmatter SHALL yield an `inclusion` field equal to the input `harness-config.kiro.inclusion`.
2. FOR ALL valid combinations where input `inclusion` is `"fileMatch"`, parsing the emitted YAML SHALL yield a `fileMatchPattern` field equal to the input `harness-config.kiro.fileMatchPattern`.
3. FOR ALL valid combinations where input `inclusion` is `"always"` or `"manual"`, parsing the emitted YAML SHALL NOT contain a `fileMatchPattern` field.
4. FOR ALL artifacts with `harness-config.kiro.inclusion` absent and top-level `frontmatter.inclusion` present, parsing the emitted YAML SHALL yield an `inclusion` field equal to the top-level `frontmatter.inclusion`.

### Requirement 4: Reference-Pack and Power Conventions Extended to Kiro

**User Story:** As an author of a `reference-pack` or a Kiro `power` artifact, I want the Validator to reinforce the Progressive_Steering convention for those asset types specifically, so that the tools that are most often abused as always-on context are flagged.

#### Acceptance Criteria

1. WHERE an artifact targets the Kiro harness AND the artifact's `type` is `reference-pack`, THE Validator SHALL produce a validation warning when `harness-config.kiro.inclusion` resolves to `"always"`, referencing the existing `reference-pack-must-be-manual` asset convention rule.
2. WHERE an artifact targets the Kiro harness AND `harness-config.kiro.format` is `"power"`, THE Validator SHALL produce a validation warning when `harness-config.kiro.inclusion` for that artifact resolves to `"always"`, recommending `fileMatch` or `manual` because the POWER.md is the primary always-on surface and steering files under `steering/` are meant to be progressively disclosed.
3. WHERE an artifact targets the Kiro harness AND `harness-config.kiro.format` is `"power"` AND the artifact has any workflow files copied under `steering/`, THE Validator SHALL produce a validation warning if the Kiro inclusion mode resolves to `"always"`, because workflow files are intended to be referenced on-demand per power conventions.
4. THE validation warnings from criteria 1 through 3 SHALL be downgradable to informational by a future mechanism but SHALL default to warnings.

### Requirement 5: Build Pipeline Emits an Inclusion Summary for Kiro

**User Story:** As an author running `forge build`, I want a summary of how many compiled Kiro steering files use each Inclusion_Mode, so that I can see at a glance whether my build is Progressive_Steering-friendly.

#### Acceptance Criteria

1. WHEN `forge build` compiles at least one artifact for the Kiro harness, THE Build_Pipeline SHALL print an Inclusion_Summary to stderr that lists, for the Kiro harness, the count of compiled Steering_Files grouped by resolved `Inclusion_Mode` (`always`, `fileMatch`, `manual`).
2. THE Inclusion_Summary SHALL include the total number of Kiro Steering_Files compiled and the percentage of those using a Progressive_Inclusion_Mode.
3. WHEN `forge build --harness kiro` is run with no artifacts targeting Kiro, THE Build_Pipeline SHALL NOT print an Inclusion_Summary.
4. THE Inclusion_Summary SHALL NOT alter the exit code of `forge build`.
5. THE Inclusion_Summary SHALL distinguish Power_Format artifacts from Steering_Format artifacts in the count, so authors can see which always-on files come from powers versus bare steering.

### Requirement 6: Build Pipeline Warns When Always-On Share Exceeds a Threshold

**User Story:** As an author, I want a build-time warning when the proportion of `always` inclusion Kiro files is high, so that I am nudged to apply Progressive_Steering without the build failing.

#### Acceptance Criteria

1. WHEN more than fifty percent of compiled Kiro Steering_Files resolve to `inclusion: "always"` AND at least two Kiro Steering_Files are compiled, THE Build_Pipeline SHALL emit a warning through the existing `AdapterWarning` channel naming each artifact that contributes to the `always` count.
2. THE threshold value from criterion 1 SHALL be configurable via `forge.config.yaml` under `kiro.progressiveSteering.alwaysWarnThreshold` as a number between 0 and 1, with a default of 0.5.
3. WHEN `kiro.progressiveSteering.alwaysWarnThreshold` is set to 1, THE Build_Pipeline SHALL NOT emit the warning from criterion 1 regardless of the computed ratio.
4. WHEN `forge build --strict` is used AND the threshold from criterion 1 is exceeded, THE Build_Pipeline SHALL treat the warning as an error and exit with a non-zero code.
5. THE warning SHALL be separate from per-artifact validation warnings and SHALL NOT be produced by the Validator.

### Requirement 7: Install Pipeline Surfaces Inclusion Distribution and Gates Always-On Installs

**User Story:** As an operator running `forge install`, I want to see the inclusion-mode distribution of the Kiro steering files that are about to be installed into my repo's `.kiro/` and I want an opt-in safeguard against flooding my repo with always-on steering, so that I can keep my Kiro agent prompts lean.

#### Acceptance Criteria

1. WHEN the Install_Pipeline installs one or more files to a Kiro install destination, THE Install_Pipeline SHALL parse the installed Steering_Files' YAML frontmatter and print an Inclusion_Summary grouped by resolved `Inclusion_Mode` to stderr after the install, covering the files just written.
2. WHEN `--dry-run` is used with a Kiro install target, THE Install_Pipeline SHALL still compute and print the Inclusion_Summary for the files that would be written.
3. THE Install_Pipeline SHALL accept a new option `--max-always <N>` that limits the number of newly installed Kiro Steering_Files with `inclusion: "always"` per `forge install` invocation.
4. WHEN the number of `always` Kiro Steering_Files that would be written exceeds the value of `--max-always`, THE Install_Pipeline SHALL abort the install with a non-zero exit code, SHALL name each file that would exceed the limit, and SHALL NOT modify the filesystem except for files already copied before the limit was reached (those SHALL be listed in the error message).
5. THE Install_Pipeline SHALL support `--max-always 0` to mean "reject any install that would add a new always-on Kiro steering file" and SHALL NOT apply the limit when `--max-always` is absent.
6. WHEN a target Kiro Steering_File lacks a parseable `inclusion:` field in its frontmatter, THE Install_Pipeline SHALL treat it as `"always"` for the purposes of the Inclusion_Summary and `--max-always` check, and SHALL emit a warning that the file is missing an explicit inclusion mode.

### Requirement 8: Default Inclusion Mode Is Preserved but Surfaced

**User Story:** As an existing artifact author, I want my existing artifacts to keep building without changes, so that this feature is not a breaking change, while the pipeline still makes clear that their inclusion is defaulted.

#### Acceptance Criteria

1. WHEN an artifact targeting Kiro has no `harness-config.kiro.inclusion` and no top-level `frontmatter.inclusion`, THE Kiro_Adapter SHALL emit `inclusion: always` in the Steering_File frontmatter.
2. WHEN an artifact relies on the default inclusion described in criterion 1, THE Validator SHALL emit an informational warning recommending that the author set `harness-config.kiro.inclusion` explicitly, citing Progressive_Steering.
3. THE informational warning from criterion 2 SHALL be suppressible per artifact by setting `harness-config.kiro.inclusion: "always"` explicitly.
4. THE behaviour of any non-Kiro harness adapter SHALL NOT change as a result of this feature.

### Requirement 9: Wizard and `forge new` Prompt for Kiro Inclusion Progressively

**User Story:** As an author running `forge new`, I want the Wizard to prompt me for the Kiro inclusion mode only when the artifact actually targets Kiro, so that I make a Progressive_Steering choice up front without being nagged about Kiro when I am not using it.

#### Acceptance Criteria

1. WHEN the Wizard's multi-select of harnesses includes `"kiro"`, THE Wizard SHALL prompt the author to select a Kiro inclusion mode from `"always"`, `"fileMatch"`, `"manual"`, with descriptive hints explaining each mode.
2. WHEN the Wizard's harness multi-select does not include `"kiro"`, THE Wizard SHALL NOT prompt for a Kiro inclusion mode.
3. WHEN the author selects `"fileMatch"` in the Wizard's Kiro inclusion prompt, THE Wizard SHALL prompt the author for a non-empty `fileMatchPattern` string and SHALL reject empty input.
4. WHEN the author selects an asset `type` of `"power"` AND Kiro is a selected harness, THE Wizard SHALL set the default selection of the Kiro inclusion prompt to `"manual"` and SHALL display a hint explaining that powers typically disclose their steering progressively.
5. WHEN the author selects an asset `type` of `"reference-pack"` AND Kiro is a selected harness, THE Wizard SHALL set the default selection of the Kiro inclusion prompt to `"manual"` and SHALL display a hint citing the `reference-pack-must-be-manual` convention.
6. THE Wizard SHALL write the author's Kiro inclusion selection into the emitted frontmatter under `harness-config.kiro.inclusion`, and SHALL write any `fileMatchPattern` selection under `harness-config.kiro.fileMatchPattern`, rather than the top-level `inclusion` and `file_patterns` fields.

### Requirement 10: POWER.md Builds Treat Steering Files Progressively

**User Story:** As an author of a Kiro power, I want the POWER.md build to be the always-on surface and the steering files under `steering/` to follow Progressive_Steering, so that my power is discoverable without its internal workflows filling every prompt.

#### Acceptance Criteria

1. WHEN the Kiro_Adapter emits in Power_Format, THE emitted `POWER.md` SHALL NOT itself carry an `inclusion:` frontmatter line, because `POWER.md` is not a steering file.
2. WHEN the Kiro_Adapter emits a Steering_File under `steering/<artifact-name>.md` in Power_Format, THE adapter SHALL apply the precedence from Requirement 2 to that Steering_File's frontmatter.
3. WHEN the Kiro_Adapter copies a workflow file under `steering/<workflow-filename>` in Power_Format, THE adapter SHALL NOT alter the workflow file's existing frontmatter, but SHALL emit an `AdapterWarning` for any copied workflow file whose frontmatter either lacks `inclusion:` or sets `inclusion: always`.
4. WHERE an author opts in via `harness-config.kiro.progressiveWorkflowsStrict: true`, THE Kiro_Adapter SHALL treat the warning from criterion 3 as an error and SHALL NOT emit the offending workflow file.

### Requirement 11: Documentation Emitted in Build Artifacts

**User Story:** As a consumer of compiled Skill Forge output, I want a record of the Progressive_Steering choices baked into each compiled artifact, so that I can audit what I installed.

#### Acceptance Criteria

1. THE Kiro_Adapter SHALL include a single-line HTML comment in each emitted Steering_File body naming the resolved `Inclusion_Mode` and (when applicable) the resolved `fileMatchPattern`, in the form `<!-- forge:kiro-inclusion: <mode> [fileMatchPattern=<glob>] -->`.
2. THE Kiro_Adapter SHALL place the comment from criterion 1 immediately after the closing `---` of the frontmatter block and before the `Generated by Skill Forge` comment emitted by the base template.
3. THE comment SHALL NOT change the behaviour of Kiro at runtime, only act as a persistent audit marker.

### Requirement 12: Parser and Round-Trip for the Install Inclusion Scanner

**User Story:** As a maintainer, I want the Install_Pipeline's inclusion scanner to use a well-tested parser for steering frontmatter, so that the Inclusion_Summary and `--max-always` checks are trustworthy even on hand-edited files.

#### Acceptance Criteria

1. THE Install_Pipeline SHALL use a frontmatter parser that reads the YAML block between the first pair of `---` lines of a Steering_File and extracts the `inclusion` and `fileMatchPattern` fields.
2. THE Install_Pipeline SHALL include a pretty-printer that serializes an `Inclusion_Mode` plus optional `fileMatchPattern` back into a Kiro steering frontmatter block.
3. FOR ALL valid `Inclusion_Mode` values with any valid string `fileMatchPattern` when applicable, parsing the pretty-printed frontmatter block SHALL produce the same `Inclusion_Mode` and `fileMatchPattern` as the input (round-trip property).
4. WHEN the Install_Pipeline's parser encounters a malformed YAML frontmatter block, THE parser SHALL return a descriptive error identifying the file path and the approximate line, and THE Install_Pipeline SHALL treat that file as unparseable for summary purposes per Requirement 7 criterion 6.

### Requirement 13: Test Coverage

**User Story:** As a maintainer, I want this feature's behaviour to be locked in by both example tests and property tests, so that future refactors of the Kiro adapter, install pipeline, and validator do not silently regress Progressive_Steering.

#### Acceptance Criteria

1. THE test suite SHALL include unit tests covering, for the Kiro_Adapter: each of the three `Inclusion_Mode` values, the precedence rule from Requirement 2 with both top-level and `harness-config.kiro.inclusion` set, the `fileMatchPattern` suppression rule from Requirement 2 criterion 4, and Power_Format emission.
2. THE test suite SHALL include property tests covering the round-trip property from Requirement 3 using `fast-check`, generating arbitrary valid `Inclusion_Mode` values and arbitrary non-empty strings for `fileMatchPattern`.
3. THE test suite SHALL include property tests covering the Install_Pipeline parser round-trip from Requirement 12 criterion 3.
4. THE test suite SHALL include unit tests covering the Validator rules from Requirement 1 criteria 3 through 5, Requirement 4, and Requirement 8 criterion 2.
5. THE test suite SHALL include integration tests covering the Build_Pipeline Inclusion_Summary format and the threshold warning from Requirement 6, using 1 to 3 representative example artifact sets rather than property-based tests (behaviour does not vary meaningfully with input beyond the boundary conditions).
6. THE test suite SHALL include integration tests covering the Install_Pipeline `--max-always` gating from Requirement 7 with representative examples for `--max-always 0`, a limit that is not exceeded, and a limit that is exceeded (the exit-code-and-filesystem behaviour does not vary meaningfully with input beyond these boundaries).

### Requirement 14: Backward Compatibility

**User Story:** As an operator with existing Skill Forge deployments, I want this feature to ship without breaking my current build and install scripts, so that I can adopt Progressive_Steering incrementally.

#### Acceptance Criteria

1. WHEN an existing artifact has no `harness-config.kiro` section AND no top-level `inclusion` field, THE Build_Pipeline output for Kiro SHALL be byte-identical to the pre-feature output except for the audit comment introduced by Requirement 11.
2. WHEN an existing artifact has a top-level `inclusion` field and no `harness-config.kiro.inclusion`, THE Build_Pipeline output for Kiro SHALL carry the same emitted `inclusion:` value as before this feature.
3. WHEN `forge install` is invoked without `--max-always`, THE Install_Pipeline SHALL NOT reject any install that would have succeeded before this feature.
4. THE default value of `kiro.progressiveSteering.alwaysWarnThreshold` from Requirement 6 criterion 2 SHALL be explicitly documented in `forge.config.yaml` sample documentation so that operators can override it without trial and error.
