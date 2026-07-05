# Implementation Plan: Kiro Progressive Steering

## Overview

Convert the feature design into a series of prompts for a code-generation LLM that will implement each step with incremental progress. Each prompt builds on the previous ones and ends with wiring everything together, so there is no hanging or orphaned code. Tasks follow the dependency graph from the design:

1. Schema foundations and the `AdapterResult.errors[]` channel.
2. Pure modules (resolver, frontmatter scanner) that everything else depends on.
3. Template refactor and Kiro adapter wiring.
4. Validator, wizard, and config surface.
5. Build and install pipeline integrations.
6. Evaluation rubric and fixtures.
7. Back-compat regression guard and documentation.

Language: TypeScript (consistent with the existing Kanon codebase). Tests run under `bun test`; property tests use `fast-check` and live under `src/__tests__/*.property.test.ts`.

Optional sub-tasks are postfixed with `*` per the spec-workflow conventions; they can be skipped for a faster MVP. Every non-optional property test is one that Requirement 13 explicitly mandates (P1, P2, P3, P5, P6, P9).

## Tasks

- [x] 1. Extend schemas for Kiro progressive inclusion
  - [x] 1.1 Add `KiroProgressiveInclusionSchema` and `KiroHarnessConfigSchema` to `src/schemas.ts`
    - Add `KiroProgressiveInclusionSchema = z.enum(["always", "fileMatch", "manual"])` and its inferred type.
    - Add `KiroHarnessConfigSchema` covering `format`, `power`, `inclusion`, `fileMatchPattern` (non-empty string), `progressiveWorkflowsStrict`, and `spec-hooks`, with `.passthrough()`.
    - Wire `KiroHarnessConfigSchema` into the existing `FrontmatterSchema.superRefine` so issues surface under the path `["harness-config", "kiro", ...]` while keeping `harness-config` as `.passthrough()` for other harnesses.
    - Export `KiroProgressiveInclusion` type for downstream consumers.
    - _Requirements: 1.1, 1.2, 8.4, 14.1_

  - [x] 1.2 Write property test for schema enforcement
    - **Property 5: Schema rejects invalid inclusion and empty fileMatchPattern**
    - **Validates: Requirements 1.1, 1.2**
    - File: `src/__tests__/kiro-progressive-steering.property.test.ts` (new `.property.test.ts`).
    - Generate arbitrary strings for `inclusion` and arbitrary values (including `""`, `null`, numbers) for `fileMatchPattern`; assert `FrontmatterSchema.safeParse` accepts iff value is one of the three Kiro modes / a non-empty string respectively.

- [x] 2. Add error channel to `AdapterResult`
  - [x] 2.1 Extend `src/adapters/types.ts` with `AdapterError` and optional `AdapterResult.errors[]`
    - Add `AdapterError` interface with `artifactName`, `harnessName`, `message`, optional `field`.
    - Add optional `errors?: AdapterError[]` to `AdapterResult` so existing adapters compile unchanged.
    - _Requirements: 10.4_

  - [x] 2.2 Write unit tests for `AdapterResult` back-compat
    - Construct `AdapterResult` values without `errors` and confirm the type check passes and other adapters' fixtures continue to satisfy the interface.
    - _Requirements: 8.4, 14.1_

- [x] 3. Implement the pure inclusion resolver
  - [x] 3.1 Create `src/adapters/kiro-inclusion.ts`
    - Export `KiroInclusionMode`, `KiroInclusionSource`, `ResolvedKiroInclusion`, `resolveKiroInclusion(artifact)`.
    - Precedence: `harness-config.kiro.inclusion` (valid Kiro mode) → top-level `frontmatter.inclusion` (when one of `always|fileMatch|manual`; treat `auto` as unset) → default `always`.
    - Resolve `fileMatchPattern` only when `mode === "fileMatch"`, from `harness-config.kiro.fileMatchPattern`; otherwise `undefined`.
    - Return `source` field indicating which level resolved the value (`"harness-config"`, `"top-level"`, or `"default"`).
    - _Requirements: 2.1, 2.2, 2.4, 8.1, 14.2_

  - [x] 3.2 Write property test for resolver precedence
    - **Property 1: Resolver precedence**
    - **Validates: Requirements 1.6, 2.1, 8.1, 14.2**
    - File: `src/__tests__/kiro-progressive-steering.property.test.ts`.
    - Generate `optional<KiroProgressiveInclusion>` × `optional<InclusionMode>` pairs, assert `resolveKiroInclusion(artifact).mode` matches the precedence rule and `source` field is correct.

- [x] 4. Implement the Kiro frontmatter scanner and pretty-printer
  - [x] 4.1 Create `src/adapters/kiro-frontmatter.ts`
    - Export `KiroSteeringFrontmatter`, `ParseResult` (`ParseOk | ParseErr`), `parseKiroSteeringFile(content, filePath)`, `printKiroFrontmatter(fm)`.
    - Use `gray-matter` + `js-yaml` for parsing; narrowly validate parsed object with Zod (`KiroProgressiveInclusionSchema` + non-empty `fileMatchPattern`).
    - On parse error, return `{ok: false, filePath, approxLine, message}` carrying `mark.line` from `js-yaml` YAMLException when available.
    - In `printKiroFrontmatter`, suppress `fileMatchPattern` when `inclusion !== "fileMatch"` regardless of caller input.
    - _Requirements: 12.1, 12.2, 12.4_

  - [x] 4.2 Write property test for scanner round-trip
    - **Property 9: Install scanner parser round-trip**
    - **Validates: Requirements 12.3**
    - File: `src/__tests__/kiro-frontmatter.property.test.ts` (new `.property.test.ts`).
    - Generate `(mode, fileMatchPattern)` pairs; assert `parseKiroSteeringFile(printKiroFrontmatter(...), "<test>")` returns `{ok: true, frontmatter: {inclusion, fileMatchPattern?}}` with `fileMatchPattern` present iff `mode === "fileMatch"`.

  - [x] 4.3 Write example test for malformed frontmatter
    - Single fixture with a broken `---` block; assert parser returns `{ok: false, ...}` with descriptive message and file path.
    - _Requirements: 12.4_

- [x] 5. Refactor the Kiro steering template
  - [x] 5.1 Rewrite `templates/harness-adapters/kiro/steering.md.njk` to consume explicit render context
    - Replace `artifact.frontmatter.inclusion | default("always")` with the new `{{ inclusion }}` variable.
    - Gate `fileMatchPattern:` emission on the new `{{ fileMatchPattern }}` variable when `inclusion == "fileMatch"`.
    - Override the `header` block so `{{ auditComment | safe }}` is emitted immediately after the closing `---` and before the `Generated by Kanon` comment.
    - Leave `power.md.njk` untouched (Req 10.1).
    - _Requirements: 2.2, 2.5, 10.1, 11.2_

- [x] 6. Checkpoint — resolver, scanner, schema and template ready
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Wire the Kiro adapter to use the resolver, audit comment, and workflow inspection
  - [x] 7.1 Update both steering-format and power-format branches in `src/adapters/kiro.ts`
    - Call `resolveKiroInclusion(artifact)` and pass `inclusion`, `fileMatchPattern`, `auditComment` into `renderTemplate("kiro/steering.md.njk", ...)` for both emission paths.
    - Implement local `buildAuditComment(resolved)` helper per Req 11 format rules (`<!-- forge:kiro-inclusion: <mode> [fileMatchPattern=<glob>] -->`).
    - In the power-format branch, after copying each workflow file: run `parseKiroSteeringFile` on it; emit an `AdapterWarning` when `inclusion` is missing or `"always"`; when `harness-config.kiro.progressiveWorkflowsStrict === true`, push an `AdapterError` to `result.errors` (naming the workflow file via `field`) and omit the file from `files[]`.
    - _Requirements: 2.1, 2.3, 2.4, 2.6, 10.1, 10.2, 10.3, 10.4, 11.1, 11.2, 11.3_

  - [x] 7.2 Write property test for steering-format template round-trip
    - **Property 2: Steering-format template round-trip**
    - **Validates: Requirements 2.2, 2.3, 2.5, 3.1, 3.2, 3.4**
    - File: `src/__tests__/kiro-progressive-steering.property.test.ts`.
    - Generate `(mode, fileMatchPattern)` pairs, render `steering.md.njk` via the real Nunjucks env, parse emitted YAML with `js-yaml`, assert round-trip equality and conditional presence of `fileMatchPattern`.

  - [x] 7.3 Write property test for `fileMatchPattern` suppression
    - **Property 3: fileMatchPattern suppression**
    - **Validates: Requirements 2.4, 3.3**
    - File: `src/__tests__/kiro-progressive-steering.property.test.ts`.
    - Restrict generator to `mode ∈ {always, manual}` with any non-empty `fileMatchPattern` on the input; assert emitted YAML never contains `fileMatchPattern`.

  - [x] 7.4 Write property test for power-format steering file parity
    - **Property 4: Power-format steering file applies the same rules**
    - **Validates: Requirements 2.6, 10.2**
    - File: `src/__tests__/kiro-progressive-steering.property.test.ts`.
    - Same generator as Property 2 with `harness-config.kiro.format = "power"`; assert the file emitted at `steering/<artifact-name>.md` satisfies the same round-trip.

  - [x] 7.5 Write property test for the audit comment
    - **Property 7: Audit comment emitted exactly once**
    - **Validates: Requirements 11.1, 11.2**
    - File: `src/__tests__/kiro-progressive-steering.property.test.ts`.
    - Regex-match the emitted body for exactly one `<!-- forge:kiro-inclusion: ... -->` line and confirm its captures equal `resolveKiroInclusion(artifact)`.

  - [x] 7.6 Write property test for POWER.md inclusion absence
    - **Property 8: POWER.md carries no inclusion**
    - **Validates: Requirements 10.1**
    - File: `src/__tests__/kiro-progressive-steering.property.test.ts`.
    - For arbitrary power-format artifacts, grep the emitted `POWER.md` for `^inclusion:` and assert zero matches.

  - [x] 7.7 Extend adapter example tests
    - Update `src/__tests__/adapters-kiro-claude-copilot.test.ts` with cases for: each of the three Kiro modes, precedence with both top-level and `harness-config.kiro.inclusion` set, `fileMatchPattern` suppression for `always`/`manual`, power-format with each mode, audit comment text for each mode, workflow-file warning and `progressiveWorkflowsStrict` error+omission.
    - _Requirements: 13.1, 2.6, 10.3, 10.4, 11.1_

- [x] 8. Checkpoint — adapter emits deterministic, audited frontmatter
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Add validator rules and asset conventions for Kiro progressive steering
  - [x] 9.1 Add rule keys to `src/asset-conventions.ts`
    - Add `kiro-power-should-be-progressive`, `kiro-power-workflow-should-be-progressive`, and `kiro-default-inclusion-informational` to `ASSET_CONVENTION_RULES` with the messages from the design.
    - _Requirements: 4.2, 4.3, 8.2_

  - [x] 9.2 Extend `validateArtifact` in `src/validate.ts`
    - Scope all new checks to `fm.harnesses.includes("kiro")`.
    - Req 1.4 error: `inclusion === "fileMatch"` with absent/empty `fileMatchPattern` → `ValidationError` on `harness-config.kiro.fileMatchPattern`.
    - Req 1.5 warning: `inclusion ∈ {always, manual}` with non-empty `fileMatchPattern` → `ValidationWarning` on the same field.
    - Req 4.1: `type === "reference-pack"` and resolved Kiro inclusion `"always"` → warning citing `reference-pack-must-be-manual`, using `resolveKiroInclusion`.
    - Req 4.2 and 4.3: power-format + resolved `"always"` → `kiro-power-should-be-progressive` warning; additionally emit `kiro-power-workflow-should-be-progressive` warning when the artifact ships workflow files.
    - Req 8.2: when `resolveKiroInclusion` returns `{source: "default"}`, emit an informational warning using `kiro-default-inclusion-informational`.
    - Do not implement threshold or audit-comment checks here (build-pipeline concerns, Req 6.5).
    - _Requirements: 1.4, 1.5, 4.1, 4.2, 4.3, 4.4, 8.2, 8.3_

  - [x] 9.3 Write property test for validator cross-field rule
    - **Property 6: Validator cross-field rule for fileMatch**
    - **Validates: Requirements 1.4, 1.5**
    - File: `src/__tests__/kiro-progressive-steering.property.test.ts`.
    - Generate the full cross product of `(mode, fmp presence, fmp content)`; assert errors/warnings appear on `harness-config.kiro.fileMatchPattern` exactly in the spec-defined cases.

  - [x] 9.4 Extend validator example tests
    - Update `src/__tests__/validate.test.ts` with cases for Req 1.3 (invalid enum surfaces via zod), 1.4, 1.5, 4.1, 4.2, 4.3, and 8.2 (informational default warning; suppressed when `inclusion` is explicitly `"always"`).
    - _Requirements: 13.4_

- [x] 10. Update the wizard with a conditional Kiro inclusion prompt
  - [x] 10.1 Extend `promptFrontmatter` in `src/wizard.ts`
    - After the harness multi-select and any Kiro format prompt, when `harnesses` includes `"kiro"`, prompt `p.select` for `always | fileMatch | manual` with hints.
    - Set the initial value to `"manual"` when `selectedType` is `power` or `reference-pack` (with the appropriate hint text), else `"always"`.
    - When the user selects `"fileMatch"`, prompt `p.text` for a non-empty `fileMatchPattern` and reject empty input.
    - Write results under `harness-config.kiro.inclusion` (and `harness-config.kiro.fileMatchPattern` when applicable). Do not alter the top-level `inclusion`/`file_patterns` fields.
    - Skip the block entirely when Kiro is not in the harness selection.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 10.2 Extend wizard example tests
    - Update `src/__tests__/wizard.test.ts` with cases: prompt appears only when Kiro is selected, fileMatch path prompts for and rejects empty pattern, defaults for `power` and `reference-pack` types, emitted frontmatter writes under `harness-config.kiro.*` and leaves top-level `inclusion` untouched.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 11. Add the `kiro.progressiveSteering.alwaysWarnThreshold` config surface
  - [x] 11.1 Extend `ForgeConfigSchema` in `src/config.ts`
    - Add optional `kiro.progressiveSteering.alwaysWarnThreshold` with `z.number().min(0).max(1).default(0.5)` and a wrapping default object.
    - _Requirements: 6.2, 14.4_

  - [x] 11.2 Update the sample `forge.config.yaml`
    - Add a documented `kiro.progressiveSteering.alwaysWarnThreshold: 0.5` block with a comment explaining the 0..1 range, the default, and that setting to `1` disables the warning.
    - _Requirements: 6.2, 6.3, 14.4_

  - [x] 11.3 Write unit tests for config parsing
    - Cases: no `kiro` block → `undefined`; partial `kiro` block defaults `alwaysWarnThreshold` to `0.5`; out-of-range values rejected by Zod.
    - _Requirements: 6.2, 14.4_

- [x] 12. Wire the build pipeline: summary, threshold warning, and aggregate `errors[]`
  - [x] 12.1 Compute and emit the Kiro inclusion summary in `src/build.ts`
    - In both `build()` and `buildWithWorkspace()`, piggyback on the existing file-write iteration: for each `h === "kiro"` file whose relative path matches `<name>.md` or `steering/<name>.md`, record `{artifactName, mode: resolveKiroInclusion(artifact).mode, format: resolveFormat(...).format}`. Workflow-copied files are excluded.
    - After iteration, if non-empty, print an `Inclusion_Summary` to stderr grouped by mode, include totals, progressive ratio, and distinguish `power` vs `steering` formats. Do not alter exit code.
    - Attach the computed summary to the new optional `BuildResult.kiroInclusionSummary` field.
    - Append `result.errors ?? []` from each adapter into the aggregate build `errors: BuildError[]`.
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 10.4_

  - [x] 12.2 Implement the always-share threshold warning
    - Load `ForgeConfig` in `buildCommand` and plumb `config.kiro?.progressiveSteering?.alwaysWarnThreshold ?? 0.5` into `BuildOptions.kiroAlwaysWarnThreshold`.
    - When `alwaysCount / total` > threshold **and** `total >= 2`, emit an `AdapterWarning` naming each contributing artifact. When threshold `=== 1`, never emit. When `--strict`, promote the warning into a `BuildError` so `buildCommand` exits non-zero.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 12.3 Write integration tests for build summary and threshold warning
    - File: `src/__tests__/kiro-progressive-steering.test.ts` (new), supplementing or extending `src/__tests__/build.test.ts`.
    - Fixture A: mixed inclusion modes → summary shape and stderr lines.
    - Fixture B: all `always` with ≥2 artifacts → threshold warning lists contributors; same set with `--strict` → non-zero exit; same set with `alwaysWarnThreshold: 1` → no warning.
    - Fixture C: no Kiro artifacts → no summary printed.
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 6.1, 6.2, 6.3, 6.4, 13.5_

- [x] 13. Wire the install pipeline: `--max-always`, pre-scan, post-install summary
  - [x] 13.1 Add the `--max-always <N>` option in `src/cli.ts` and thread it through `InstallOptions`
    - Parse as integer; `-1` or absent means "no limit". Surface as `maxAlways?: number`.
    - _Requirements: 7.3, 7.5, 14.3_

  - [x] 13.2 Implement the pre-install scan in `src/install.ts`
    - Before any `copyFile`, for every would-be-installed Kiro `.md` whose install-relative path matches `<name>.md`, `steering/<name>.md`, or `steering/<anything>.md`, parse the **source** file in `srcDir` with `parseKiroSteeringFile`.
    - Bucket parse failures, null frontmatter, and missing `inclusion` as `always` (conservative per Req 7.6) and record a warning.
    - If `maxAlways !== undefined` and the `always` count exceeds it, print the listed offenders and `process.exit(1)` without writing. Dry-run parity: print and exit non-zero.
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 12.4_

  - [x] 13.3 Implement the post-install Inclusion_Summary
    - After `install()` / `installWithWorkspace()` finishes writing, re-parse only the files copied in this invocation at `installBase` and print the per-mode summary to stderr before the `✓ Installed …` line.
    - Re-use the same "bucket as `always`" treatment for parse failures / missing `inclusion` and emit the Req 7.6 warning.
    - _Requirements: 7.1, 7.6, 14.3_

  - [x] 13.4 Write integration tests for `--max-always` and the install summary
    - File: `src/__tests__/kiro-progressive-steering.test.ts` or extension of `src/__tests__/install.test.ts`.
    - `--max-always=0` with an `always` file → non-zero exit, no writes.
    - `--max-always=3` with two `always` files → install succeeds, summary printed.
    - `--max-always=1` with two `always` files → non-zero exit, both offenders listed.
    - `--dry-run --max-always=1` breach → same non-zero exit without touching the destination.
    - Default install (no `--max-always`) → summary printed, no rejection (Req 14.3 regression guard).
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 13.6, 14.3_

- [x] 14. Checkpoint — end-to-end pipeline in place
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Create evaluation scenario fixtures for the progressive-steering rubric
  - [x] 15.1 Scaffold `fixtures/eval/kiro-progressive-steering/scenario-small/`
    - Add `artifacts/` with three knowledge artifacts: one `always`, one `fileMatch` targeting `src/**`, and one `manual` whose topic is mentioned in the `always` file's body.
    - Add `expected-build/` with the expected `dist/kiro/` output for determinism checks.
    - Add `workload.json` per the schema in Design §4 (`promptId`, `openedFiles[]`, `userReferences[]`, `expectedFired[]`) with at least five prompts and canonically-sorted list fields.
    - Add `README.md` describing the smoke-test scenario and recording that it should score Green.
    - _Design §4 (fixture tree, happy-path scenario)_

  - [x] 15.2 Scaffold `fixtures/eval/kiro-progressive-steering/scenario-mixed/`
    - Add `artifacts/` with five steering files distributed across all three modes.
    - Add `expected-build/` with the expected compiled output.
    - Add `workload.json` with at least 20 prompts exercising: direct file opens that should fire `fileMatch`, file opens that should not fire any `fileMatch`, `#`-references to `manual` files, and bare prompts that should only surface `always` files; all list fields canonically sorted.
    - Add `README.md` noting this is the CI gating fixture and recording its expected Green score and per-metric target values (AOCW, PR, FMP, MD, DER, WCA) with documented tolerances.
    - _Design §4 (CI-gated scenario), §9 (`scenario-mixed` as the CI fixture)_

  - [x] 15.3 Scaffold `fixtures/eval/kiro-progressive-steering/scenario-anti/`
    - Add `artifacts/` with five `always`-mode steering files with overlapping content, designed to fail the rubric.
    - Add `expected-build/` with the expected compiled output.
    - Add `workload.json` with prompts that never reference the `manual` files and never open files matching any glob.
    - Add `README.md` explaining the adversarial purpose: a non-Red score on this scenario is a rubric defect.
    - _Design §4 (deliberate failure fixture)_

- [x] 16. Implement the progressive-steering rubric grader module
  - [x] 16.1 Pin the tokenizer used by the grader
    - Add `tiktoken` as a runtime dependency consumed by `src/eval/rubrics/kiro-progressive-steering.ts` using the `cl100k_base` encoding.
    - Implement the chars fallback `tokens(body) ≈ max(1, ceil(chars(body) / 4))` for the missing-`tiktoken` case, emitting a one-line warning to stderr on that path.
    - Ensure both paths are pure functions of the input string: no network, no locale dependence, no environment reads.
    - _Design §6 (reproducibility contract), §2 (AOCW data source)_

  - [x] 16.2 Implement the AOCW metric in `src/eval/rubrics/kiro-progressive-steering.ts`
    - Iterate compiled `.md` files under `buildDir/kiro/**/*.md` and `buildDir/kiro/**/steering/**/*.md`, parsing each with `parseKiroSteeringFile` reused from `src/adapters/kiro-frontmatter.ts`.
    - Compute `sum(tokens(body) for sf if sf.inclusion == "always") / sum(tokens(body) for sf in installed)` using the pinned tokenizer.
    - Treat parse failures and missing `inclusion` as `always`, matching the install-scanner contract.
    - _Requirements: 5, 6; Design §2 metric AOCW_

  - [x] 16.3 Implement the PR metric
    - Compute `count(sf for sf in installed if sf.inclusion in {"fileMatch","manual"}) / count(installed)` from the same scanned file list used by AOCW.
    - Return `0` when `count(installed) === 0` and record a warning in the details object.
    - _Requirements: 5.2, 6.1; Design §2 metric PR, §8 (shared source of truth with `BuildResult.kiroInclusionSummary.progressiveRatio`)_

  - [x] 16.4 Implement the FMP metric
    - For each `fileMatch`-mode steering file: count how many workload prompts list it in `expectedFired[]` (`firesNeeded`) and how many the file's glob actually matches against each prompt's `openedFiles[]` (`firesTotal`), then compute `mean(firesNeeded / firesTotal)` across `fileMatch` files.
    - When `workload.json` lacks `expectedFired[]` labels, set FMP to `0` and emit a warning per Design §2 notes.
    - Populate `details.perFileMatchFile[]` with `{name, firesNeeded, firesTotal}` entries.
    - _Requirements: 2, 10; Design §2 metric FMP, §4 (workload schema)_

  - [x] 16.5 Implement the MD metric
    - Run an in-memory TF-IDF pass over all installed steering bodies; for each `manual`-mode file, take its top-5 TF-IDF tokens and check whether all of them appear in the union of `always`-mode bodies.
    - Compute `count(covered manual files) / count(manual)`; define as `1.0` when there are no `manual` files.
    - Populate `details.perManualFile[]` with the top-5 tokens and the covered flag per file.
    - _Requirements: 10, 11; Design §2 metric MD_

  - [x] 16.6 Implement the DER metric
    - Walk the source artifacts targeted by the build, invoke `resolveKiroInclusion` reused from `src/adapters/kiro-inclusion.ts`, and compute `count(artifacts where source === "default") / count(kiro artifacts)`.
    - Fall back to parsing the audit comment from the compiled file when source artifacts are not provided to the grader.
    - Populate `details.defaultSourceArtifacts[]`, stable-sorted.
    - _Requirements: 8.2, 9; Design §2 metric DER_

  - [x] 16.7 Implement the WCA metric
    - Filter source artifacts to `type ∈ {"power","reference-pack"}`; compute `count(those where resolveKiroInclusion(a).mode !== "always") / count(those)`.
    - Define WCA as `1.0` when the denominator is `0` so feature-absent builds score neutrally.
    - Populate `details.misalignedWizardArtifacts[]`, stable-sorted.
    - _Requirements: 4, 9; Design §2 metric WCA_

  - [x] 16.8 Compose `gradeProgressiveSteering(buildDir, workload)` and the rating function
    - Combine metrics using weights `w1..w6 = 0.30, 0.15, 0.25, 0.10, 0.10, 0.10` and the formula `Score = 100 * (w1*(1-AOCW) + w2*PR + w3*FMP + w4*MD + w5*(1-DER) + w6*WCA)`.
    - Apply Green / Yellow / Red ratings per Design §3, including the `AOCW ≤ 0.40` and `FMP ≥ 0.75` sub-gates on Green and the `AOCW ≤ 0.60` sub-gate on Yellow.
    - Return a `ProgressiveSteeringResult` with `score`, `rating`, `metrics`, and `details`; stable-sort every list field inside `details` before returning.
    - Export `gradeProgressiveSteering`, `ProgressiveSteeringMetrics`, and `ProgressiveSteeringResult` from `src/eval/rubrics/kiro-progressive-steering.ts`.
    - _Design §3 (scoring + thresholds), §5 (grading function signature)_

  - [x] 16.9 Write property test for Rubric Property R1 (scoring determinism)
    - **Property R1: Scoring determinism**
    - **Validates: Design §6 reproducibility contract**
    - File: `src/__tests__/kiro-progressive-steering-rubric.property.test.ts` (new `.property.test.ts`).
    - Generate small build-directory fixtures in a tmpdir with randomised steering files and workloads, invoke `gradeProgressiveSteering(buildDir, workload)` twice, and assert structural deep-equality of `{score, rating, metrics, details}` including stable ordering of every list field.

  - [x] 16.10 Write example tests for the three scenario fixtures
    - File: `src/__tests__/kiro-progressive-steering-rubric.test.ts` (new).
    - Case: `scenario-small` grades Green with `Score ≥ 80`, `AOCW ≤ 0.40`, `FMP ≥ 0.75`.
    - Case: `scenario-mixed` grades Green and matches the per-metric target values (AOCW, PR, FMP, MD, DER, WCA) recorded in the fixture's `README.md` within the documented tolerance.
    - Case: `scenario-anti` grades Red (`rating === "red"`).
    - _Design §3 (thresholds), §4 (fixtures)_

  - [x] 16.11 Write integration smoke-check for build-summary / rubric PR divergence
    - Add alongside the scenario tests in `src/__tests__/kiro-progressive-steering-rubric.test.ts`.
    - After building the `scenario-mixed` fixture, assert `BuildResult.kiroInclusionSummary.progressiveRatio === gradeProgressiveSteering(buildDir, workload).metrics.PR` exactly; a divergence indicates a defect in one side or the other.
    - _Design §8 (shared PR source of truth)_

- [x] 17. Expose the rubric through the CLI, config, and CI surfaces
  - [x] 17.1 Add the YAML descriptor at `evals/kiro-progressive-steering.yaml`
    - Describe the rubric id (`progressive-steering`), the harness (`kiro`), the fixture paths under `fixtures/eval/kiro-progressive-steering/`, and the metric weights from Design §3 so `discoverEvalConfigs()` picks the file up alongside existing eval configs.
    - _Design §5 (rubric config + discovery)_

  - [x] 17.2 Extend `kanon eval` in `src/eval.ts` with a `--rubric <name>` option
    - Parse the flag; when `--harness kiro` is selected and no `--rubric` is provided, default to `progressive-steering`.
    - Dispatch the rubric by name to `gradeProgressiveSteering` from `src/eval/rubrics/kiro-progressive-steering.ts` when the rubric matches.
    - Accept `--build <dir>` to point the grader at an already-compiled output, and build into a tempdir when source artifacts are passed instead.
    - _Design §5 (CLI surface), §9 (author workflow)_

  - [x] 17.3 Implement `--json` output for the rubric result
    - When `--json` is set, serialise `ProgressiveSteeringResult` as canonical JSON (sorted keys, stable list order) to the path from `--output`, falling back to stdout when absent.
    - Propagate the rubric's `rating` to the process exit code: `green` and `yellow` → `0`, `red` → `1`.
    - _Design §5 (output formats), §3 (exit-code mapping)_

  - [x] 17.4 Polish the terminal output for the rubric
    - Render a coloured table of metric names, targets, and actuals, a rating banner, and per-file details when rating ≠ Green.
    - _Design §5 (default terminal output)_

  - [x] 17.5 Add the CI workflow file
    - Create `.github/workflows/eval-kiro-progressive-steering.yml` implementing the `eval-kiro-progressive-steering` job per Design §9: trigger on PRs touching `src/adapters/kiro*.ts`, `templates/harness-adapters/kiro/**`, `src/schemas.ts`, `src/validate.ts`, `src/wizard.ts`, `src/eval/rubrics/kiro-progressive-steering.ts`, or `fixtures/eval/kiro-progressive-steering/**`; run `kanon build` on `scenario-mixed`; invoke `kanon eval --harness kiro --rubric progressive-steering --build <tempdir> --json rubric.json`; fail on non-zero exit; upload `rubric.json` as an artifact for trend analysis.
    - _Design §9 (CI gate)_

- [x] 18. Back-compat regression guard
  - [x] 18.1 Add a golden-file test for legacy artifact output
    - Commit a pre-feature golden for a fixture with no `harness-config.kiro.inclusion` and a top-level `inclusion: fileMatch`.
    - Build the fixture, strip lines matching `^<!-- forge:kiro-inclusion: .* -->$` from the emitted steering file, diff against the golden, assert byte-identical equality.
    - _Requirements: 14.1, 14.2_

- [x] 19. Documentation and changelog
  - [x] 19.1 Add towncrier changelog fragment
    - Create `changes/kiro-progressive-steering.feature.md` summarizing: explicit `harness-config.kiro.inclusion`, build/install summaries and threshold, `--max-always` gating, audit comment, validator and wizard updates, and the new `progressive-steering` eval rubric.
    - _Requirements: 14.4_

  - [x] 19.2 Update README / docs for the new surface
    - Document the `harness-config.kiro.inclusion` / `fileMatchPattern` fields, the `--max-always` flag, the `kiro.progressiveSteering.alwaysWarnThreshold` config key, the emitted audit comment, and the `kanon eval --harness kiro --rubric progressive-steering` command.
    - _Requirements: 14.4_

- [x] 20. Final checkpoint — full validation
  - [x] 20.1 Run the full build
    - `bun run build` completes without errors.

  - [x] 20.2 Run the full test suite
    - `bun test` passes, including the new property, integration, and rubric tests.

  - [x] 20.3 Run `biome check`
    - `bun run lint` reports no violations on changed files.

  - [x] 20.4 End-to-end sample validation
    - Scaffold a Kiro-targeted artifact through the wizard, run `bun run dev build`, run `kanon install --max-always=1` against a scratch destination, run `kanon eval --harness kiro --rubric progressive-steering --build dist/kiro`, and confirm the summary, audit comment, gating, and rubric output all behave as designed.

## Notes

- Sub-tasks marked with `*` are optional and can be skipped for a faster MVP.
- Every property test required by Requirement 13.2 and 13.3 is non-optional: P1 (3.2), P2 (7.2), P3 (7.3), P5 (1.2), P6 (9.3), P9 (4.2).
- Property tests live in `src/__tests__/` as `*.property.test.ts` files, co-located with existing property tests.
- Checkpoints gate progress through the resolver/scanner/template layer, the adapter layer, and the full pipeline.
- Requirement references point at granular acceptance criteria (e.g. `4.3`, `7.6`) rather than user stories so traceability stays precise.
- Non-optional rubric tasks include the grader module (16.1–16.8), scenario fixtures (15.1–15.3), the YAML descriptor (17.1), the `--rubric` CLI flag (17.2), `--json` output (17.3), and Rubric Property R1 (16.9); terminal polish (17.4) and CI workflow (17.5) are optional.
- The `AdapterResult.errors[]` channel (task 2.1) is a prerequisite for Req 10.4 (`progressiveWorkflowsStrict`) and must be in place before the adapter wiring in task 7.1.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "2.2", "3.1"] },
    { "id": 2, "tasks": ["3.2", "4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "5.1"] },
    { "id": 4, "tasks": ["7.1", "11.1"] },
    { "id": 5, "tasks": ["7.2", "7.3", "7.4", "7.5", "7.6", "7.7", "9.1", "11.2", "11.3"] },
    { "id": 6, "tasks": ["9.2", "10.1"] },
    { "id": 7, "tasks": ["9.3", "9.4", "10.2", "12.1"] },
    { "id": 8, "tasks": ["12.2", "13.1"] },
    { "id": 9, "tasks": ["12.3", "13.2"] },
    { "id": 10, "tasks": ["13.3", "13.4"] },
    { "id": 11, "tasks": ["15.1", "15.2", "15.3"] },
    { "id": 12, "tasks": ["16.1"] },
    { "id": 13, "tasks": ["16.2", "16.3", "16.4", "16.5", "16.6", "16.7"] },
    { "id": 14, "tasks": ["16.8"] },
    { "id": 15, "tasks": ["16.9", "16.10", "16.11", "17.1"] },
    { "id": 16, "tasks": ["17.2", "17.3"] },
    { "id": 17, "tasks": ["17.4", "17.5", "18.1"] },
    { "id": 18, "tasks": ["19.1", "19.2"] },
    { "id": 19, "tasks": ["20.1", "20.2", "20.3", "20.4"] }
  ]
}
```
