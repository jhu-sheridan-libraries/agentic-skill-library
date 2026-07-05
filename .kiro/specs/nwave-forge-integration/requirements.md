# Requirements Document

## Introduction

This spec covers the integration of nWave methodology concepts into the Kanon ecosystem. It spans two categories: (A) new codeshop knowledge skills that document decision frameworks for rigor tuning and outcome registration, and (B) architectural enhancements to the Forge CLI inspired by nWave's DES execution model, catalog governance, and mutation testing strategy.

Three nWave-inspired items (analyze-hotspots, trim-tests, diverge-options) have already been added directly to codeshop as steering files. The remaining five items require structured implementation through this spec.

## Glossary

- **Forge**: The Kanon CLI tool (`kanon/`) that compiles knowledge artifacts to harness-native formats.
- **Codeshop**: A knowledge artifact (`kanon/knowledge/codeshop/`) containing developer workflow skills compiled as a Kiro power.
- **Knowledge_Skill**: A workflow steering file within a knowledge artifact that documents a decision framework or methodology for developers.
- **Adapter**: A pure function in `kanon/src/adapters/` that transforms a parsed knowledge artifact into harness-specific output files.
- **Catalog**: The generated `catalog.json` index of all knowledge artifacts, produced by `kanon catalog`.
- **Hook**: An event-driven automation defined in `hooks.yaml` that triggers agent actions in response to IDE events.
- **Rigor_Profile**: A named configuration (lean/standard/thorough/exhaustive) that scales quality practices up or down based on task criticality.
- **Outcomes_Registry**: The aggregated set of outcome declarations across all artifacts, used for collision detection during validate and guild sync.
- **Collision_Detection**: The process of comparing a proposed outcome's normalized type shapes and keywords against existing outcomes to identify spec-level duplication. Uses a two-tier algorithm (shape match + keyword Jaccard).
- **Acknowledged_Overlap**: A COLLISION verdict that has been intentionally suppressed by both outcomes declaring each other in their `related` fields. Not an error.
- **Shape_Normalization**: The process of canonicalizing type-shape strings before comparison: lowercase, collapse whitespace, sort union members, normalize Array syntax, strip parameter names.
- **DES**: Discrete Event Simulation — nWave's execution model where hooks validate preconditions, enforce gates, and track state across build steps.
- **Mutation_Testing**: A testing technique that introduces small code changes (mutants) to verify that the test suite detects them (kills them).
- **Kill_Rate**: The percentage of introduced mutants that are detected by the test suite; higher is better.
- **Nightly_Delta_Strategy**: Running mutation testing only on modules changed since the last run, reducing CI cost while maintaining coverage.
- **Frontmatter**: The YAML metadata block at the top of a `knowledge.md` file, validated by Zod schemas.
- **Collection_Manifest**: A YAML file in `kanon/collections/` that defines metadata for a group of related artifacts.
- **Jaccard_Similarity**: A set-similarity metric (intersection over union) used to compare keyword overlap between outcomes.

## Requirements

### Requirement 1: Rigor Profiles Knowledge Skill

**User Story:** As a developer using codeshop, I want a decision framework for choosing the right level of quality rigor for a given task, so that I can avoid over-engineering trivial changes and under-testing critical ones.

#### Acceptance Criteria

1. THE Knowledge_Skill SHALL include a file at `kanon/knowledge/codeshop/workflows/tune-rigor.md` that documents four named rigor profiles: lean, standard, thorough, and exhaustive.
2. WHEN a developer activates the tune-rigor skill, THE Knowledge_Skill SHALL provide a decision matrix that maps four task dimensions (criticality rated low/medium/high/critical, blast radius rated single-file/module/system-wide, reversibility rated trivial/moderate/difficult, and audience rated self/team/public) to a single recommended rigor profile.
3. THE Knowledge_Skill SHALL define for each profile which quality practices are included: TDD depth (unit-only vs acceptance+unit), review passes (zero, single, or double), refactoring pass (yes/no), and mutation testing (yes/no).
4. THE Knowledge_Skill SHALL define for each profile which quality practices are excluded, stating each omitted practice by name and a one-sentence rationale for why it is safe to omit at that rigor level.
5. IF a task scores high or critical on criticality OR system-wide on blast radius (e.g., security-sensitive code, public APIs, or long-lived core modules), THEN THE Knowledge_Skill SHALL recommend thorough or exhaustive rigor with a justification that references at least one task dimension value driving the recommendation.
6. IF a task scores low on criticality AND single-file on blast radius AND trivial on reversibility (e.g., configuration changes, documentation, or spike prototypes), THEN THE Knowledge_Skill SHALL recommend lean rigor with a justification that references at least one task dimension value driving the recommendation.
7. IF a task's dimension scores map to more than one candidate profile according to the decision matrix, THEN THE Knowledge_Skill SHALL specify a conflict-resolution rule that selects the higher rigor profile.
8. THE Knowledge_Skill SHALL be language-agnostic and tool-agnostic, referencing no specific programming language, test framework, or CLI command in its guidance.
9. THE Knowledge_Skill SHALL document the methodology without prescribing specific tools or commands, consistent with the codeshop shared-concepts style (prose guidance that any test runner or review process can satisfy).

### Requirement 2: Outcomes Registry — Hybrid Architecture

**User Story:** As a developer, I want a methodology for registering formal outcomes before writing code, with automated collision detection integrated into validate and guild sync, so that I can detect spec-level duplication at design time and avoid building redundant functionality.

#### 2A: Methodology (Steering File)

1. THE Forge SHALL include a knowledge skill file at `kanon/knowledge/codeshop/workflows/register-outcomes.md` that documents the outcomes registration pattern, collision detection algorithm, and resolution workflow.
2. THE Knowledge_Skill SHALL be language-agnostic, using type-shape notation limited to generic constructs available in all typed languages (e.g., primitives, arrays/lists, maps/dictionaries, tuples, union types, and named record shapes) without referencing language-specific syntax.

#### 2B: Outcome Data Model

1. THE outcome data model SHALL consist of: a unique identifier matching `^out-[a-z0-9]+(-[a-z0-9]+)*$` (maximum 64 characters), kind (specification/operation/invariant), input-shape (type expression string), output-shape (type expression string), summary (maximum 120 characters), and keywords (up to 6 lowercase tokens, each maximum 24 characters).
2. EACH outcome declaration SHALL support an optional `related` field containing an array of outcome IDs that acknowledge intentional overlap with other outcomes, downgrading a COLLISION verdict to acknowledged-overlap for those specific pairs.

#### 2C: Artifact-Level Declaration (Frontmatter)

1. THE Forge SHALL extend the frontmatter schema to support an optional `outcomes` array field where each entry conforms to the outcome data model defined in 2B.
2. WHEN an artifact declares outcomes in frontmatter, THE Forge SHALL validate each outcome entry against the outcome data model schema during `kanon validate`.
3. THE outcome ID format SHALL follow skill-forge's kebab-case convention (`out-kebab-case`), matching the pattern `^out-[a-z0-9]+(-[a-z0-9]+)*$` with a maximum length of 64 characters.

#### 2D: Shape Normalization

1. THE Forge SHALL normalize shape strings before comparison by: (a) stripping leading/trailing whitespace, (b) collapsing internal whitespace to a single space, (c) lowercasing everything, (d) sorting union members alphabetically (`string | number` → `number | string`), (e) normalizing `Array<T>` to `T[]`, and (f) stripping parameter names from tuples (`(name: string, age: number)` → `(string, number)`).
2. THE Forge SHALL NOT resolve type aliases (`Path` ≠ `string`), erase generic type parameters (`Result<T, E>` ≠ `Result<string, Error>`), or structurally compare object shapes (`{name: string}` ≠ `UserRecord`).

#### 2E: Collision Detection Algorithm

1. THE Forge SHALL implement Tier-1 detection as an exact match on the normalized (input-shape, output-shape) tuple.
2. THE Forge SHALL implement Tier-2 detection as Jaccard similarity over tokenized keyword sets (split on `-`, `_`, whitespace; drop tokens ≤ 2 chars; threshold ≥ 0.4).
3. THE verdict matrix SHALL be: COLLISION (both tiers match), AMBIGUOUS (exactly one tier matches), CLEAN (neither matches).
4. WHEN two outcomes declare each other in their `related` fields, THE Forge SHALL downgrade a COLLISION verdict to acknowledged-overlap and suppress the error for that pair.

#### 2F: Validate Integration (Cross-Artifact)

1. WHEN `kanon validate` runs, THE Forge SHALL aggregate all outcomes declared across all artifacts and run pairwise collision detection.
2. IF a COLLISION is detected between two outcomes that do NOT reference each other via `related`, THEN `kanon validate` SHALL report an error with both outcome IDs, their artifact names, the matching shapes, and the Jaccard score, and SHALL exit with non-zero status.
3. IF an AMBIGUOUS verdict is detected, THEN `kanon validate` SHALL report a warning with both outcome IDs and their artifact names, but SHALL NOT block validation.
4. THE Forge SHALL detect duplicate outcome IDs across artifacts and report them as errors (IDs must be globally unique).

#### 2G: Guild Sync Integration

1. WHEN `kanon guild sync` resolves artifacts from the manifest, THE Forge SHALL aggregate outcomes from all resolved artifacts and run pairwise collision detection before materializing files.
2. IF a COLLISION is detected during guild sync between two manifest artifacts that do NOT reference each other via `related`, THEN guild sync SHALL print the collision details and exit with non-zero status.
3. WHEN the `--force` flag is provided to guild sync, THE Forge SHALL print collision warnings but proceed with materialization regardless of COLLISION verdicts.
4. AMBIGUOUS verdicts during guild sync SHALL be reported as warnings and SHALL NOT block sync.

#### 2H: Catalog Integration

1. WHEN generating `catalog.json`, THE Forge SHALL include each artifact's declared outcomes in the catalog entry as an `outcomes` array.
2. THE catalog outcomes array SHALL include for each outcome: `id`, `kind`, `inputShape`, `outputShape`, and `keywords` — enabling external tools and the souk-compass discovery feature to search by outcome shape or keywords.

### Requirement 3: DES-Style Hook Execution Enforcement

**User Story:** As a forge maintainer, I want hooks that can validate preconditions, enforce gates, and track execution state across build steps, so that the build pipeline can enforce quality invariants automatically.

#### Acceptance Criteria

1. THE Forge SHALL extend the canonical hook schema to support a `gate` field containing a string expression that references state keys or built-in predicates (tests_pass, files_exist, lint_clean), where the gate evaluates to true (pass) or false (fail).
2. IF a hook defines a gate condition that evaluates to false, THEN THE Forge SHALL skip the hook's action and emit a warning to the build log indicating the hook name and the gate expression that failed.
3. THE Forge SHALL extend the canonical hook schema to support a `postcondition` field containing a string expression in the same syntax as the gate field, specifying an assertion to verify after the hook action completes.
4. IF a hook's postcondition evaluates to false after action execution, THEN THE Forge SHALL report the failure to the build log with the hook name, the postcondition expression, and the actual evaluated result, and SHALL halt the current build run with a non-zero exit status.
5. THE Forge SHALL extend the canonical hook schema to support a `state` field that declares a map of string keys to string or boolean values, allowing hooks to read from and write to a shared execution context that persists across all hook invocations within a single build run and is discarded when the build run completes.
6. WHEN compiling hooks for the Kiro adapter, THE Forge SHALL translate gate conditions into the hook's prompt preamble as natural-language precondition checks instructing the agent to verify each referenced predicate before proceeding with the hook action.
7. IF a gate or postcondition expression references a state key that is not declared in any hook's state field or a predicate name that is not in the built-in set (tests_pass, files_exist, lint_clean), THEN THE Forge SHALL reject the hook file with a validation error identifying the undefined reference and its location.
8. WHEN a hook's gate evaluates to true, THE Forge SHALL execute the hook action and then evaluate the postcondition if one is defined, processing gate, action, and postcondition in that fixed order.
9. THE Forge SHALL evaluate hooks within a single build run in the order they are declared in the hooks file, ensuring that state writes from earlier hooks are visible to gate and postcondition expressions of later hooks.

### Requirement 4: Enhanced Catalog Metadata

**User Story:** As a forge user browsing the catalog, I want artifacts to have visibility flags, priority ordering, and classification metadata, so that I can filter and discover relevant artifacts efficiently.

#### Acceptance Criteria

1. THE Forge SHALL extend the frontmatter schema to support a `visibility` field with values `public`, `private`, or `unlisted`, defaulting to `public` when the field is omitted or not specified.
2. THE Forge SHALL extend the frontmatter schema to support a `priority` field accepting an integer from 1 to 100 inclusive, defaulting to 50 when the field is omitted, used for ordering within catalog listings.
3. THE Forge SHALL extend the collection manifest schema to support `visibility` and `priority` fields with the same allowed values, defaults, and validation rules as artifact frontmatter.
4. WHEN generating the catalog, THE Forge SHALL include `visibility`, `priority`, `maturity`, and `audience` fields in each catalog entry's JSON representation.
5. WHEN an artifact has `visibility: private`, THE Forge SHALL exclude the artifact entirely from the generated `catalog.json` output.
6. WHEN an artifact has `visibility: unlisted`, THE Forge SHALL include the artifact in `catalog.json` with a `visibility` field set to `"unlisted"` so that browse commands can filter it from default listings.
7. THE Forge SHALL sort catalog entries in `catalog.json` first by priority descending (higher values first), then alphabetically by name ascending for entries with equal priority values.
8. WHEN the `kanon catalog browse` command runs without the `--all` flag, THE Forge SHALL hide artifacts with `visibility: private` and hide artifacts with `visibility: unlisted` from the default listing.
9. WHEN the `kanon catalog browse` command runs with the `--all` flag, THE Forge SHALL display all artifacts including those with `visibility: unlisted`, but SHALL continue to hide artifacts with `visibility: private`.
10. IF the `priority` field in frontmatter contains a value outside the range 1 to 100 inclusive or a non-integer value, THEN THE Forge SHALL reject the artifact with a validation error indicating the priority value is invalid.

### Requirement 5: Mutation Testing Integration

**User Story:** As a forge maintainer, I want a `kanon eval --mutation` mode that runs mutation testing on adapter functions, so that I can verify the test suite catches real bugs and not just achieves coverage.

#### Acceptance Criteria

1. THE Forge SHALL provide a `kanon eval --mutation` command that runs mutation testing on adapter source files in `kanon/src/adapters/`.
2. WHEN `kanon eval --mutation` runs, THE Forge SHALL identify adapter source files by scanning `kanon/src/adapters/` for TypeScript files that export functions matching the `HarnessAdapter` type signature, excluding `types.ts`, `index.ts`, and `capabilities.ts`.
3. THE Forge SHALL generate mutants by applying mutation operators configured via a `mutationOperators` array in `forge.config.yaml`, defaulting to all five operators (statement deletion, conditional boundary changes, arithmetic operator replacement, string literal modification, and return value alteration) when no configuration is present, generating at most 50 mutants per adapter source file.
4. WHEN a mutant is generated, THE Forge SHALL run the project test suite via `bun test` against the mutated code and record whether the mutant was killed (at least one test failed) or survived (all tests still pass), applying a timeout of 30 seconds per mutant test run after which the mutant is marked as killed.
5. THE Forge SHALL report a kill rate as the percentage of killed mutants over total generated mutants, and exit with code 1 if the kill rate falls below the threshold specified by the `--threshold` CLI flag (a decimal between 0.0 and 1.0, default: 0.80).
6. WHEN the `--delta` flag is provided, THE Forge SHALL apply the nightly-delta strategy: only mutate adapter modules that have changed since the last recorded mutation run in `kanon/evals/mutation-history.jsonl`, using `git diff` to identify changed files.
7. IF the `--delta` flag is provided and no prior mutation run exists in `kanon/evals/mutation-history.jsonl`, THEN THE Forge SHALL fall back to a full mutation run across all adapter source files and emit a warning indicating no baseline was found.
8. THE Forge SHALL persist mutation run results to `kanon/evals/mutation-history.jsonl` as one JSON object per line containing fields: `ts` (ISO 8601 timestamp), `sha` (short git commit hash), `killRate` (decimal), `totalMutants` (integer), `killed` (integer), `survived` (integer), and `operators` (array of operator names used), enabling trend tracking via `kanon eval --mutation --trend`.
9. IF a mutant survives, THEN THE Forge SHALL report the surviving mutant's file path, line number, the mutation operator applied, and the original and mutated code showing up to 3 lines of context above and below the mutation point.
10. IF no adapter source files are found in `kanon/src/adapters/`, THEN THE Forge SHALL exit with code 1 and print an error message indicating no adapter files were detected.
