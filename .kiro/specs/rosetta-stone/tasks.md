# Implementation Plan: Rosetta Stone

## Overview

Implement Rosetta Stone in TypeScript as a Zod-validated functional core with an imperative Bun/Commander shell. The sequence establishes public schemas and registry invariants first, then detection and canonical translation, built-in source and target translators, safe orchestration, CLI/configuration, compatibility facades, sync integration, generated operational guidance, and release validation. Each implementation step builds on an earlier contract and ends with the existing Kanon interfaces wired to the new subsystem.

## Tasks

- [ ] 1. Establish Rosetta Stone public schemas and deterministic contracts
  - [ ] 1.1 Add the strict Rosetta Stone Zod schemas and inferred TypeScript types to `src/schemas.ts`
    - Define identifiers, versions, source documents, format contracts, compatibility profiles, requests, diagnostics, plans, profiles, results, and machine-output envelopes.
    - Enforce normalized relative paths, strict extension maps, canonical capability completeness, and stable schema versions at public boundaries.
    - _Requirements: 1.2, 2.4, 8.1, 8.2, 8.6, 13.1, 15.3_
  - [ ] 1.2 Create `src/rosetta/contracts.ts` and deterministic normalization utilities
    - Re-export schema-derived interfaces and implement code-point ordering, stable JSON/YAML ordering inputs, canonical comparison normalization, deep freezing, and immutable context types.
    - Keep all public data shapes owned by `src/schemas.ts` and make pure contracts independent of filesystem, process, clock, random, Git, and network state.
    - _Requirements: 5.6, 12.1, 12.2, 12.3, 12.6, 12.7_
  - [ ] 1.3 Implement structured diagnostics in `src/rosetta/diagnostics.ts`
    - Add trusted diagnostic factories, blocking-code metadata, source/canonical locations, deterministic sorting, safe internal-error conversion, and the `RegistryFailure` fallback.
    - Guarantee stable `RS_*` codes and schema-valid human/machine diagnostic values without embedding untrusted payloads.
    - _Requirements: 2.6, 8.2, 8.3, 8.4, 8.5, 8.6, 13.10_
  - [ ]* 1.4 Add Bun schema/diagnostic unit tests and shared fast-check arbitraries
    - Create `src/__tests__/rosetta-arbitraries.ts` using existing test helpers and bounded generators for artifacts, contracts, documents, diagnostics, options, paths, and sensitive canaries.
    - Cover strict schema rejection, stable diagnostic ordering, blocking metadata, and versioned envelopes in `rosetta-schemas.test.ts`.
    - _Requirements: 8.1, 8.2, 8.5, 8.6, 16.1, 16.3, 16.4, 16.10_

- [ ] 2. Implement the transactional registry and complete built-in format catalog
  - [ ] 2.1 Implement `TranslationRegistryBuilder` and immutable `TranslationRegistrySnapshot` in `src/rosetta/registry.ts`
    - Build temporary query and resolver indexes, commit registration atomically, freeze snapshots, resolve aliases by direction, and expose typed deterministic queries.
    - Reject duplicate identifiers/aliases, unsupported versions, invalid defaults/profiles, and missing direction-required translators without mutating prior state.
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.7, 15.1, 15.4, 15.5_
  - [ ] 2.2 Register every built-in format contract in `src/rosetta/builtins/contracts.ts`
    - Add `kanon-canonical`, all harness-native formats, `kiro-power`, `kiro-skill`, and `superpowers` with directions, aliases, lifecycle metadata, variants/defaults, detection/path rules, schemas, normalization, security, and compatibility metadata.
    - Represent legacy `auto` as a deprecated selection alias with replacement and removal metadata rather than a format contract.
    - _Requirements: 2.4, 2.9, 6.3, 7.9, 14.3, 14.5, 15.7_
  - [ ] 2.3 Complete extension validation and registry metadata history
    - Add trusted `RegistryExtension` validation, lifecycle selection rules, alias-history snapshots, registry versioning, and transactional query-before-selection publication.
    - Return a minimal `RegistryFailure` if conflict diagnostics cannot be constructed safely.
    - _Requirements: 2.2, 2.6, 15.1, 15.2, 15.3, 15.4, 15.6, 15.7_
  - [ ]* 2.4 Write the fast-check test for registry atomicity
    - **Property 1: Registry registration is atomic, unique, complete, and query-consistent**
    - Create `rosetta-property-01-registry-atomicity.property.test.ts`, run at least 100 cases, and preserve fast-check's minimized counterexample output.
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 15.1, 15.3, 15.4, 15.5**
  - [ ]* 2.5 Write the fast-check test for registry metadata history
    - **Property 2: Registry metadata history is stable across snapshots**
    - Create `rosetta-property-02-registry-history.property.test.ts` and compare deterministic machine projections across generated lifecycle/alias updates.
    - **Validates: Requirements 15.7**
  - [ ]* 2.6 Write the fast-check test for direction-safe dispatch
    - **Property 3: Format resolution and dispatch are direction-safe**
    - Create `rosetta-property-03-direction-dispatch.property.test.ts` covering source, target, bidirectional, aliases, and unavailable implementations.
    - **Validates: Requirements 1.1, 1.5, 1.6**
  - [ ]* 2.7 Add registry unit and inventory tests
    - Verify diagnostic-factory failure, retired/deprecated behavior, query ordering, required list fields, all legacy formats, and exact current harness defaults.
    - _Requirements: 2.6, 2.8, 2.9, 6.3, 14.5, 15.2_

- [ ] 3. Guard requests and implement explainable format detection
  - [ ] 3.1 Implement `src/rosetta/request-guard.ts`
    - Parse discriminated requests with Zod, normalize paths/options, deep-freeze resolved values, reject accessors/class instances/functions/symbols/streams and reserved environmental keys, and record defaults/origins.
    - Validate explicit identifiers, direction, required format rules, binary/text constraints, duplicate normalized paths, and caller-supplied context before dispatch.
    - _Requirements: 1.3, 1.4, 3.6, 3.7, 8.1, 12.6, 12.7, 13.1, 13.2_
  - [ ] 3.2 Implement deterministic rule evaluation and selection in `src/rosetta/detector.ts`
    - Evaluate registered rules over sorted in-memory documents, calculate bounded confidence, retain safe evidence, rank deterministically, and handle unique, no-match, tied, and explicit selections.
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
  - [ ]* 3.3 Write the fast-check test for guarded request dispatch
    - **Property 4: Requests are closed, validated values before dispatch**
    - Create `rosetta-property-04-request-guard.property.test.ts` with dispatch spies proving invalid or impure inputs never reach detectors/translators.
    - **Validates: Requirements 1.2, 1.4, 8.1**
  - [ ]* 3.4 Write the fast-check test for deterministic detection ranking
    - **Property 5: Detection ranking and evidence are deterministic**
    - Create `rosetta-property-05-detection-ranking.property.test.ts` covering permutations, repeated evaluation, evidence, and total ordering.
    - **Validates: Requirements 3.1, 3.2, 3.8, 16.5**
  - [ ]* 3.5 Write the fast-check test for total detection selection
    - **Property 6: Detection selection is total and explicit selection has precedence**
    - Create `rosetta-property-06-detection-selection.property.test.ts` covering unique, absent, ambiguous, explicit, wrong-direction, missing-rule, and conflicting-rule cases.
    - **Validates: Requirements 3.3, 3.4, 3.5, 3.6, 3.7**
  - [ ]* 3.6 Add detector and request-guard unit tests
    - Pin confidence rounding, safe evidence labels, Unicode/code-point ordering, duplicate paths, text-only rejection, and forbidden-context error codes.
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 8.2, 13.2_

- [ ] 4. Implement pure canonical parsing and serialization
  - [ ] 4.1 Extract a pure `CanonicalParser` into `src/rosetta/canonical.ts`
    - Parse in-memory `knowledge.md`, auxiliary YAML, workflows, and body overrides; split known frontmatter from `extraFields`; and map grammar/schema errors to safe locations.
    - Retain filesystem reading in `src/parser.ts` as an outer adapter over the pure parser.
    - _Requirements: 4.5, 4.6, 5.1, 5.5, 12.1, 13.7_
  - [ ] 4.2 Implement deterministic `CanonicalSerializer` plan generation
    - Render canonical files, merge `extraFields` without overriding canonical keys, honor `emitEmptyAuxiliaryFiles`, normalize text/YAML, and emit sorted plan files and operations.
    - _Requirements: 5.2, 5.3, 5.5, 5.6, 6.6_
  - [ ]* 4.3 Write the fast-check test for canonical round trips
    - **Property 10: Canonical serialization and parsing preserve canonical meaning**
    - Create `rosetta-property-10-canonical-roundtrip.property.test.ts` with valid artifacts plus grammar/schema mutations and unknown-frontmatter ownership checks.
    - **Validates: Requirements 5.1, 5.3, 5.5, 16.1**
  - [ ]* 4.4 Write the fast-check test for canonical byte determinism
    - **Property 12: Canonical serialization is byte-deterministic and totally ordered**
    - Create `rosetta-property-12-canonical-determinism.property.test.ts` varying map insertion order and repeated invocations.
    - **Validates: Requirements 5.2, 5.6**
  - [ ]* 4.5 Add canonical parser/serializer unit tests
    - Cover malformed frontmatter/YAML, missing `knowledge.md`, invalid body override names, empty auxiliaries, nested workflows, extra-field collisions, and executable/file ordering.
    - _Requirements: 4.5, 4.6, 5.1, 5.2, 5.5, 5.6_

- [ ] 5. Checkpoint - Ensure all foundation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement complete built-in source translation and pretty-printing
  - [ ] 6.1 Add shared source accounting and mapping helpers
    - Implement consumed/preserved path tracking, field mappings, namespaced lossless `extraFields`, undeclared-loss diagnostics, default diagnostics, and source-document ordering normalization.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.9, 7.7_
  - [ ] 6.2 Implement path-based source translators for Kiro powers, Kiro skills, and Superpowers
    - Move schema translation from `src/import.ts` into pure translators under `src/rosetta/builtins/sources/` while retaining artifact naming as explicit caller context.
    - _Requirements: 2.9, 4.1, 4.2, 4.3, 4.5, 13.7, 14.3_
  - [ ] 6.3 Implement harness-native source translators for Kiro, Claude Code, and Codex
    - Adapt existing import parsers to in-memory document sets, preserving hooks, MCP servers, overrides, settings, and format-specific extra data with structured diagnostics.
    - _Requirements: 2.9, 4.1, 4.2, 4.3, 4.5, 4.6_
  - [ ] 6.4 Implement harness-native source translators for Copilot, Cursor, Windsurf, Cline, and Q Developer
    - Reuse deterministic grouping/mapping helpers and ensure every source file or field is consumed, preserved, or diagnosed.
    - _Requirements: 2.9, 4.1, 4.2, 4.3, 4.5, 4.6_
  - [ ] 6.5 Implement a deterministic pretty-printer for every source-capable contract
    - Keep pretty-printers separate from selectable target direction and apply only each contract's declared defaults and normalization rules.
    - _Requirements: 5.4, 12.4, 16.2_
  - [ ]* 6.6 Write the fast-check test for complete source accounting
    - **Property 7: Inbound translation has complete source accounting**
    - Create `rosetta-property-07-source-accounting.property.test.ts` generating mapped, preserved, defaulted, and intentionally unmapped source values.
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
  - [ ]* 6.7 Write the fast-check test for inbound order independence
    - **Property 9: Inbound translation is order-independent and repeatable**
    - Create `rosetta-property-09-inbound-determinism.property.test.ts` covering all permutations and repeated translations.
    - **Validates: Requirements 4.9, 12.4, 16.3**
  - [ ]* 6.8 Write the fast-check test for every source parser/pretty-printer round trip
    - **Property 11: Every source parser and pretty-printer round-trips**
    - Create `rosetta-property-11-source-roundtrip.property.test.ts`; derive the format inventory from the frozen registry so untested new source formats fail inventory checks.
    - **Validates: Requirements 5.4, 16.2**
  - [ ]* 6.9 Add fixture-based inbound regression tests
    - Build a manifest covering `kiro-power`, `kiro-skill`, `superpowers`, and every current harness importer; compare canonical-normalized artifacts and diagnostics against legacy output.
    - _Requirements: 14.1, 14.2, 14.10, 16.7_

- [ ] 7. Implement compatibility evaluation and effective option resolution
  - [ ] 7.1 Implement `src/rosetta/compatibility.ts`
    - Resolve complete variant profiles, identify used capabilities and affected values, emit one degradation diagnostic per canonical field group, aggregate counts, and promote compatibility/loss uniformly in strict mode.
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_
  - [ ] 7.2 Seed built-in compatibility profiles from current asset and harness capability declarations
    - Create explicit complete contract profiles and deterministic projections that remain equivalent to `ASSET_HARNESS_COMPATIBILITY` and `CAPABILITY_MATRIX` during migration.
    - _Requirements: 7.1, 7.2, 7.9, 14.5_
  - [ ] 7.3 Implement shared format variant and option resolution
    - Apply explicit request, profile, canonical `harness-config`, then contract-default precedence; validate effective options; list sorted valid choices; and record resolved origin/default data.
    - Preserve Kiro `power: true` fallback only when `format` is absent and emit stable deprecation guidance.
    - _Requirements: 6.2, 6.3, 6.4, 10.3, 10.8, 14.6, 14.7, 14.11_
  - [ ]* 7.4 Write the fast-check test for compatibility profile validity
    - **Property 17: Compatibility profiles are complete and internally valid**
    - Create `rosetta-property-17-compatibility-profile.property.test.ts` for all capabilities and variant overrides.
    - **Validates: Requirements 7.1, 7.2, 15.5, 16.6**
  - [ ]* 7.5 Write the fast-check test for degradation diagnostics and counts
    - **Property 18: Degradation diagnostics and counts exactly describe affected values**
    - Create `rosetta-property-18-degradation-diagnostics.property.test.ts` with partial/none profiles and unavailable detail fields.
    - **Validates: Requirements 7.3, 7.4, 7.5, 7.8**
  - [ ]* 7.6 Write the fast-check test for strict-mode promotion
    - **Property 19: Strict mode promotes compatibility and undeclared loss uniformly**
    - Create `rosetta-property-19-strict-mode.property.test.ts` proving noncompatibility content is unchanged and lossless channels remain preserved.
    - **Validates: Requirements 7.6, 7.7**
  - [ ]* 7.7 Add compatibility and resolution unit tests
    - Cover empty option maps, invalid options, explicit/profile/canonical/default precedence, Kiro deprecation guidance, and unavailable degradation details.
    - _Requirements: 6.2, 6.3, 6.4, 7.3, 7.4, 10.3, 14.7_
  - [ ]* 7.8 Add compatibility inventory regression tests
    - Snapshot every effective target/variant profile against current adapter capabilities and fail on unclassified canonical or asset capabilities.
    - _Requirements: 7.9, 14.5, 16.6, 16.7_

- [ ] 8. Implement target translators, immutable templates, and plan validation
  - [ ] 8.1 Implement the impure immutable template bundle loader and pure renderer contract
    - Load, resolve, and validate Nunjucks templates outside Rosetta Stone; register frozen in-memory sources and a content digest; prohibit filesystem fallback during translation.
    - _Requirements: 1.3, 6.7, 12.2, 12.5, 12.7, 13.8_
  - [ ] 8.2 Implement target translators for Kiro, Claude Code, and Codex
    - Wrap existing pure adapter logic with resolved variants, body overrides, template bundles, effective compatibility actions, structured diagnostics, and deterministic `TranslationPlan` output.
    - _Requirements: 6.1, 6.5, 6.6, 7.3, 7.5, 13.8_
  - [ ] 8.3 Implement target translators for Copilot, Cursor, Windsurf, Cline, and Q Developer
    - Normalize adapter file order and warnings, declare explicit executable flags, and ensure translators cannot write or consult environment state.
    - _Requirements: 6.1, 6.5, 6.6, 12.2, 12.5, 13.8_
  - [ ] 8.4 Implement `src/rosetta/plan.ts`
    - Validate plan schemas, lexical paths, normalized collisions, file-operation bijection, content/executable metadata, deterministic ordering, and operation withholding for blocking output diagnostics.
    - _Requirements: 6.6, 8.7, 13.1, 13.2, 13.5, 13.6_
  - [ ]* 8.5 Write the fast-check test for effective contract conformance
    - **Property 14: Target plans conform to the effective format contract**
    - Create `rosetta-property-14-target-conformance.property.test.ts` across artifacts, targets, variants, capabilities, and degradation actions.
    - **Validates: Requirements 6.1, 6.5, 6.6**
  - [ ]* 8.6 Write the fast-check test for outbound extensional determinism
    - **Property 15: Outbound translation is extensional and deterministic**
    - Create `rosetta-property-15-outbound-determinism.property.test.ts` varying canonically equivalent representations while holding all effective inputs fixed.
    - **Validates: Requirements 6.7, 12.5, 16.3**
  - [ ]* 8.7 Write the fast-check test for observable effective options
    - **Property 16: Effective option changes are observable in output**
    - Create `rosetta-property-16-effective-options.property.test.ts` from each contract's declared option effects.
    - **Validates: Requirements 6.8**
  - [ ]* 8.8 Write the fast-check test for safe path normalization and collisions
    - **Property 26: Path normalization is safe and collision-free**
    - Create `rosetta-property-26-path-safety.property.test.ts` generating POSIX absolute, drive, UNC, NUL, traversal, mixed-separator, Unicode normalization, and collision cases.
    - **Validates: Requirements 13.1, 13.2, 13.5, 13.6, 16.4**
  - [ ]* 8.9 Add fixture-based outbound adapter regression tests
    - Cover every current target variant and compare normalized paths, exact bytes, executable flags, and diagnostics with existing adapter output.
    - _Requirements: 14.5, 14.6, 14.7, 14.10, 16.7_
  - [ ]* 8.10 Add target/template/plan unit and security tests
    - Verify frozen inputs, in-memory includes/inheritance, no disk fallback, inert command/template strings, redacted translator exceptions, path errors, and normalized collision rejection.
    - _Requirements: 8.7, 12.2, 13.2, 13.6, 13.8_

- [ ] 9. Checkpoint - Ensure all pure translation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Coordinate translation phases, redaction, and inspection
  - [ ] 10.1 Implement `src/rosetta/engine.ts`
    - Coordinate request, registry, detection, source parse, canonical validation, compatibility, target translation, and plan validation for inbound, outbound, and transcode modes.
    - Derive success/partial/failure and eligible/policy-required/withheld states; convert unexpected implementation failures to redacted diagnostics; never apply effects.
    - _Requirements: 1.1, 1.2, 4.6, 4.7, 4.8, 8.1, 8.7, 12.4, 12.5_
  - [ ] 10.2 Implement fail-closed sensitive-value handling in `src/rosetta/redaction.ts`
    - Apply contract `reject`, `preserve`, and `reference-only` policies; record fingerprints/locations without raw values; prove structured preview redaction or suppress derived diagnostics, plans, and content.
    - _Requirements: 9.6, 9.7, 9.8, 13.9, 13.10, 13.11, 13.12_
  - [ ] 10.3 Implement deterministic inspection models in `src/rosetta/inspection.ts`
    - Project resolved formats/variants, evidence, versions, canonical summaries, defaults, normalizations, option origins, compatibility/degradation counts, diagnostics, plan paths, collision data, and preview status.
    - _Requirements: 7.8, 9.3, 9.6, 9.7, 9.8, 9.9_
  - [ ] 10.4 Export the stable library API from `src/rosetta/index.ts`
    - Export `RosettaStone`, schemas/types, registry construction, built-ins, detection, translation, and inspection without exporting impure scanner/applier services.
    - _Requirements: 1.1, 2.1, 15.1, 15.2, 15.6_
  - [ ]* 10.5 Write the fast-check test for inbound plan gating
    - **Property 8: Inbound validation gates plans by diagnostic class**
    - Create `rosetta-property-08-inbound-plan-gating.property.test.ts` covering canonical errors, source loss, policy-overridable errors, blocking codes, and affected operations.
    - **Validates: Requirements 4.6, 4.7, 4.8, 8.1, 8.7**
  - [ ]* 10.6 Write the fast-check test for structured and plan-safe diagnostics
    - **Property 20: Diagnostics are structured, located, ordered, and plan-safe**
    - Create `rosetta-property-20-diagnostics.property.test.ts` with randomized insertion order and source/canonical locations.
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.5, 8.7**
  - [ ]* 10.7 Write the fast-check test for fail-closed inspection redaction
    - **Property 22: Inspection redaction fails closed and is content-noninterfering**
    - Create `rosetta-property-22-inspection-redaction.property.test.ts` with generated canary secrets and complete/incomplete redactors.
    - **Validates: Requirements 9.6, 9.7, 9.8, 13.10, 13.11**
  - [ ]* 10.8 Write the fast-check test for explicit translation context
    - **Property 25: Translation depends only on explicit context**
    - Create `rosetta-property-25-explicit-context.property.test.ts` with host-state spies and declared effective-context changes.
    - **Validates: Requirements 12.6, 12.7**
  - [ ]* 10.9 Write the fast-check test for sensitive-value policy non-leakage
    - **Property 27: Sensitive-value policy never leaks diagnostic or report payloads**
    - Create `rosetta-property-27-sensitive-values.property.test.ts` generating credential-like canaries, approved references, all contract policies, and unsafe diagnostic-construction cases.
    - **Validates: Requirements 13.9, 13.10, 13.11**
  - [ ]* 10.10 Add engine, inspection, and redaction unit tests
    - Cover phase short-circuiting, internal exceptions, machine-safe output, strict promotion, sensitive references, preview suppression, and unchanged non-sensitive report fields.
    - _Requirements: 4.7, 4.8, 8.6, 9.3, 9.6, 9.7, 13.9, 13.10, 13.11_

- [ ] 11. Implement safe filesystem orchestration and plan application
  - [ ] 11.1 Implement allowed-root scanning and deterministic document grouping in `src/translation-orchestrator.ts`
    - Resolve source roots/symlinks before reads, reject escapes, group one artifact per request, enforce byte limits, and pass only normalized in-memory documents and JSON context to Rosetta Stone.
    - _Requirements: 1.3, 9.1, 11.2, 12.1, 13.3_
  - [ ] 11.2 Implement application policy and cross-request collision analysis
    - Allow only cataloged policy-overridable diagnostics, retain deterministic translation output, and reject normalized collisions before any write.
    - _Requirements: 4.8, 8.7, 9.1, 9.9, 13.5, 13.6_
  - [ ] 11.3 Implement `src/translation-plan-applier.ts`
    - Validate destination parents against the allowed root, reject symlink escapes, recheck collision policy, stage complete artifacts under the root, set executable modes explicitly, and atomically swap outputs.
    - Keep timestamps, operation IDs, and write failures in a separate `ApplicationReport`.
    - _Requirements: 1.3, 9.1, 12.2, 13.4_
  - [ ] 11.4 Complete dry-run/write orchestration and per-profile status isolation
    - Run the same pre-application path for dry-run and writes, omit applier invocation in dry-run, combine artifact plans only after validation, and isolate acquisition/translation/application results.
    - _Requirements: 9.1, 9.2, 9.9, 11.5, 11.6, 11.7_
  - [ ]* 11.5 Write the fast-check test for dry-run equivalence
    - **Property 21: Dry-run and write-enabled analysis are pre-application equivalent**
    - Create `rosetta-property-21-dry-run-equivalence.property.test.ts` over in-memory filesystem preconditions and report projections.
    - **Validates: Requirements 9.2, 9.3**
  - [ ]* 11.6 Write the fast-check test for profile isolation and acquisition independence
    - **Property 24: Multi-profile orchestration isolates status and translation ignores acquisition strategy**
    - Create `rosetta-property-24-profile-isolation.property.test.ts` varying providers/strategies while holding documents and profiles fixed.
    - **Validates: Requirements 11.7, 11.8**
  - [ ]* 11.7 Add Bun orchestration/applier integration tests
    - Use temporary local directories for in-root/escaping symlinks, destination parent resolution, collision policies, staging/atomicity, executable modes, and dry-run applier spies.
    - _Requirements: 9.1, 9.2, 9.9, 13.3, 13.4, 16.4, 16.9_

- [ ] 12. Add typed acquisition and translation configuration
  - [ ] 12.1 Integrate `AcquisitionProfileSchema` and `TranslationProfileSchema` into `src/config.ts`
    - Add strict `acquisitions` and `translations` records, registry-backed cross-validation, empty option defaults, canonical-version checks, field-addressed diagnostics, and credential-reference-only fields.
    - _Requirements: 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 13.12_
  - [ ] 12.2 Normalize legacy `upstreams` through validated profile mappings
    - Map `repo`, `branch`, `prefix`, `format`, `collection`, `knowledgeDir`, and `skillsPath` into separate acquisition/translation profiles without accepting literal credentials.
    - _Requirements: 10.6, 10.7, 13.12, 14.8_
  - [ ]* 12.3 Write the fast-check test for profile validation
    - **Property 23: Profile validation separates concerns and halts invalid work**
    - Create `rosetta-property-23-profile-validation.property.test.ts` with invocation spies, unknown formats/options/versions, misplaced fields, literal credentials, and approved references.
    - **Validates: Requirements 10.4, 10.5, 10.6, 10.7, 13.12**
  - [ ]* 12.4 Add config loading and legacy mapping unit tests
    - Cover absent options, target default resolution, field-addressed errors, pre-acquisition failure, and current `upstreams` entries.
    - _Requirements: 10.3, 10.4, 10.7, 10.8, 14.8_

- [ ] 13. Expose Rosetta Stone through Commander and stable renderers
  - [ ] 13.1 Implement and register `kanon rosetta` commands
    - Add `formats`, `detect`, `inspect`, and `translate` handlers with explicit direction checks, named profiles, inbound/outbound/transcode routing, dry-run, strict mode, variants, and JSON output.
    - _Requirements: 2.8, 10.1, 10.2, 10.3_
  - [ ] 13.2 Implement human and versioned JSON renderers
    - Render the same inspection model with stable fields/order, no ANSI in JSON, safe diagnostics, content-preview status, collision policy, and resolved option origins.
    - _Requirements: 8.6, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_
  - [ ]* 13.3 Write the fast-check test for variant and option precedence
    - **Property 13: Variant and option resolution follows one precedence order**
    - Create `rosetta-property-13-option-precedence.property.test.ts` across explicit, profile, canonical, and contract-default layers plus legacy `harness-config` equivalence.
    - **Validates: Requirements 6.2, 6.4, 10.3, 10.5, 10.8, 14.6**
  - [ ]* 13.4 Add Bun CLI integration tests
    - Cover command registration, list fields, direction errors, detection, human/JSON inspection, no-color JSON, dry-run, strict mode, precedence, exit statuses, and translate routing.
    - _Requirements: 2.8, 9.4, 9.5, 10.1, 10.2, 10.3, 16.8_

- [ ] 14. Migrate legacy inbound interfaces behind compatibility facades
  - [ ] 14.1 Refactor `src/import.ts` into a legacy path-import facade
    - Preserve supported `--all`, format/auto detection, collection, knowledge directory, collision, destination, and dry-run behavior while delegating translation and canonical plans to Rosetta Stone.
    - _Requirements: 14.1, 14.3, 14.4, 14.10, 14.11_
  - [ ] 14.2 Refactor `src/importers/` into harness-native compatibility facades
    - Preserve scanning, explicit harness filtering, confirmation, force, destination, dry-run, parser exports, and deterministic multi-file grouping while delegating pure parsing.
    - _Requirements: 14.2, 14.10, 14.11_
  - [ ]* 14.3 Add legacy inbound command and facade regression tests
    - Compare repository fixtures, collisions, prompt/force behavior, canonical bytes, diagnostics, aliases, and deprecation guidance against current behavior.
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.10, 14.11, 16.7, 16.8_

- [ ] 15. Migrate target registries, adapters, and build orchestration
  - [ ] 15.1 Replace `HARNESS_FORMAT_REGISTRY` and `resolveFormat` internals with registry projections
    - Preserve the public types, harness names, variants, defaults, sorted valid choices, and Kiro power deprecation behavior while removing independent declarations.
    - _Requirements: 2.9, 6.3, 14.5, 14.6, 14.7_
  - [ ] 15.2 Route `adapterRegistry` through target translators
    - Preload immutable template bundles, map plans/diagnostics back to `AdapterResult`, and preserve adapter signatures and warning/error semantics during migration.
    - _Requirements: 1.1, 6.1, 12.2, 14.5, 14.10_
  - [ ] 15.3 Delegate canonical parse and target translation from `src/build.ts`
    - Keep dependency composition, shared MCP merge, workspace overrides, dist policy, summaries, and writes in the imperative build shell while consuming validated Rosetta Stone plans.
    - _Requirements: 1.3, 12.1, 12.2, 14.5, 14.10_
  - [ ]* 15.4 Add adapter/format/build regression tests
    - Verify every target variant/default, `harness-config`, compatibility warning, output byte, executable flag, and current build fixture remains equivalent.
    - _Requirements: 7.9, 14.5, 14.6, 14.7, 14.10, 16.7, 16.8_

- [ ] 16. Integrate sync acquisition without crossing the pure boundary
  - [ ] 16.1 Add a script-facing validated profile listing/translation command
    - Return machine-readable acquisition and translation profile values/statuses without credentials or Git handles and halt before acquisition on invalid configuration.
    - _Requirements: 10.4, 10.7, 11.2, 11.6, 11.7_
  - [ ] 16.2 Update `scripts/sync-upstream.sh` and `scripts/sync-kiro-powers.sh`
    - Keep Git remote/subtree/checkout operations in shell, use validated named profiles, preserve pull-only/import-only/dry-run semantics, and report acquisition and translation statuses independently.
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 14.8, 14.9_
  - [ ]* 16.3 Add local-fixture sync integration tests
    - Use a temporary local Git repository or mocked Git runner for success, acquisition failure, pull-only, import-only, dry-run, current Kiro mapping, and multi-profile summaries with no network access.
    - _Requirements: 11.3, 11.4, 11.5, 11.6, 11.7, 14.8, 14.9, 16.9_

- [ ] 17. Implement registry-backed guidance and executable examples
  - [ ] 17.1 Implement a Bun generator for registry/profile reference and executable CLI examples
    - Generate checked-in format, variant, detection, lifecycle, compatibility, profile-field/default/precedence, normalization, degradation, and security references from schemas and the frozen registry.
    - Add executable examples for listing, detection, explicit selection, inspection, dry-run, strict/JSON, inbound translation, and outbound translation.
    - _Requirements: 17.2, 17.3, 17.4, 17.7, 17.8_
  - [ ] 17.2 Implement generated architecture, migration, and extension guidance
    - Add generator inputs/templates for the functional core/imperative shell, registry and sync separation, legacy import/importer/adapter/format/build/sync migration, extension contracts, diagnostic conventions, test obligations, path boundaries, redaction, and inert content.
    - Keep code examples type-checked and sourced from public Rosetta Stone exports rather than duplicated pseudocode.
    - _Requirements: 17.1, 17.5, 17.6, 17.8_
  - [ ]* 17.3 Write the fast-check test for documentation projections
    - **Property 28: Schema and registry documentation projections are complete**
    - Create `rosetta-property-28-documentation-projection.property.test.ts` comparing generated metadata with arbitrary profile schemas and immutable snapshots.
    - **Validates: Requirements 17.3, 17.4, 17.7**
  - [ ]* 17.4 Add generated-guidance and executable-example tests
    - Snapshot deterministic generated output, type-check/import code examples, invoke CLI examples against fixtures, and fail when registry/schema inventory is undocumented.
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 17.8_

- [ ] 18. Add architecture enforcement, validation entry points, and release metadata
  - [ ]* 18.1 Add Rosetta Stone architecture-boundary and synchronization tests
    - Scan `src/rosetta/**` imports for filesystem, subprocess, network, `process`, prompt, and filesystem-template dependencies; verify frozen inputs and compare built-ins with legacy importer/adapter/format/compatibility inventories.
    - _Requirements: 1.3, 1.4, 2.9, 12.1, 12.2, 12.3, 12.7, 16.6, 16.7_
  - [ ] 18.2 Add a one-shot Bun validation entry point for Rosetta Stone
    - Add a Bun script/package command that runs targeted `rosetta-*.test.ts` suites once, then the full Bun suite, `bun x tsc --noEmit`, and `bun run lint`, preserving raw fast-check failures and nonzero status.
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 16.10_
  - [ ] 18.3 Enforce and add the Rosetta Stone changelog fragment
    - Extend Bun release validation to require a substantive fragment and add an `added` fragment summarizing the new CLI/library surface, compatibility window, migration path, and security boundary without claiming legacy removal.
    - _Requirements: 14.11, 17.1, 17.5, 17.8_

- [ ] 19. Implement curation-preserving reconciliation
  - [ ] 19.1 Add provenance and reconciliation schemas
    - Add `ProvenanceRecordSchema` to `FrontmatterSchema` (optional, machine-managed) and register `provenance` in `KNOWN_FRONTMATTER_FIELDS` in `src/parser.ts`; add `FieldOwnershipPolicySchema`, `ReconciliationRequestSchema`, `ReconciliationDiagnosticSchema`, `ReconciliationResultSchema`, and `ReconciliationReportSchema` to `src/schemas.ts` with a documented default field-ownership policy.
    - _Requirements: 18.1, 18.8, 18.14_
  - [ ] 19.2 Implement the pure three-way reconciliation core in `src/rosetta/reconcile.ts`
    - Implement field-class dispatch (curation-owned keep-ours, upstream-owned fast-forward/conflict, merge-by-union deterministic union, machine-owned recompute), the reduced-confidence two-way path when base is absent, deterministic diagnostics, and per-artifact outcome classification, all within the Pure_Translation_Boundary.
    - _Requirements: 18.3, 18.4, 18.5, 18.6, 18.7, 18.11, 18.12, 18.13_
  - [ ] 19.3 Compute and verify Base_Digest via the Canonical_Serializer
    - Compute `baseDigest` as `sha256` over the deterministically serialized Theirs_Artifact reusing serializer ordering; add provenance self-verification that routes hand-edited artifacts to the reduced-confidence path with a warning diagnostic.
    - _Requirements: 18.2, 18.16_
  - [ ] 19.4 Write provenance at import and cache the base artifact (orchestration)
    - In the import/acquisition path, populate `ProvenanceRecord` from the acquired revision and write the normalized base artifact to a git-ignored `upstream/.kanon-base/<upstream>/<name>@<digest>` cache; add the path to `.gitignore`.
    - _Requirements: 18.1, 18.2_
  - [ ] 19.5 Add the `reconcile` collision policy and reconciliation report to the sync orchestrator
    - Extend the PlanApplier collision policy with `reconcile`; derive the reconcile set from `ProvenanceRecord`s (not a hardcoded map); classify `orphaned`/`new`; serialize the merged artifact through existing plan validation and application; build a deterministic `ReconciliationReport` renderable as human text and versioned JSON; exclude provenance-less artifacts (fall back to existing collision behavior).
    - _Requirements: 18.3, 18.9, 18.10, 18.15, 18.17_
  - [ ] 19.6 Add a provenance backfill command and retire the drift scripts
    - Add a one-shot command that matches existing distilled artifacts to current upstream by name, records `baseDigest`, and seeds the base cache; delete `scripts/compare-kiro-powers.sh`, `scripts/compare-kiro-powers-full.sh`, `scripts/diff-kiro-body.sh`, `scripts/diff-kiro-steering.sh`, and `scripts/sync-kiro-powers.sh`.
    - _Requirements: 18.1, 18.9_
  - [ ]* 19.7 Write the fast-check test for curation-preserving deterministic reconciliation
    - Property 29: generate Base/Ours/Theirs/policy triples and assert curation preservation, fast-forward-only-when-unchanged, conflict-keeps-ours-while-applying-non-conflicting-fields, deterministic union, and repeat-run canonical equivalence with identical diagnostics; at least 100 cases, unchanged shrinking output.
    - _Requirements: 18.4, 18.5, 18.6, 18.7, 18.12, 18.13, 18.18_
  - [ ]* 19.8 Write the fast-check test for total, stable provenance outcomes
    - Property 30: assert digest stability across repeated translation, `clean` on digest equality, reduced-confidence path on missing base or failed self-verify, `orphaned`/`new` classification, and exactly-one-outcome totality.
    - _Requirements: 18.1, 18.2, 18.3, 18.8, 18.9, 18.10, 18.11, 18.16_
  - [ ]* 19.9 Add reconciliation config validation and fixture regression tests
    - Validate `FieldOwnershipPolicy` (reject unknown/unclassified fields), add fixture-based re-sync scenarios (clean, fast-forward, conflict, orphaned, new, no-base) asserting report output and no Curation_Loss.
    - _Requirements: 18.14, 18.15_

- [ ] 20. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Implementation language is TypeScript (ESNext) on Bun; schemas use Zod 4, CLI commands use Commander, templates use in-memory Nunjucks, and generated properties use fast-check 4.x.
- Tasks marked with `*` are optional test tasks and may be skipped for a faster implementation pass; core implementation tasks are never optional.
- Every property task corresponds to exactly one numbered correctness property, uses the exact design comment annotation, runs at least 100 cases, and leaves fast-check shrinking output unchanged.
- Unit, integration, regression, architecture-boundary, and property suites use one-shot `bun test` execution, never watch mode.
- Validation runs from `kanon/`: `bun test src/__tests__/rosetta-*.test.ts`, `bun test`, `bun x tsc --noEmit`, and `bun run lint`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["1.4", "2.1", "3.1", "4.1", "7.1", "8.1", "8.4", "10.2", "11.1"] },
    { "id": 3, "tasks": ["2.3", "3.2", "3.3", "4.2", "6.1", "7.2", "10.3", "11.2", "11.3", "12.1"] },
    { "id": 4, "tasks": ["2.2", "3.4", "3.5", "3.6", "4.3", "4.4", "4.5", "6.2", "6.3", "6.4", "7.3", "7.4", "7.5", "7.6", "7.7", "7.8", "12.2"] },
    { "id": 5, "tasks": ["2.4", "2.5", "2.6", "2.7", "6.5", "6.6", "6.7", "6.9", "8.2", "8.3", "12.3", "12.4"] },
    { "id": 6, "tasks": ["6.8", "8.5", "8.6", "8.7", "8.8", "8.9", "8.10", "10.1"] },
    { "id": 7, "tasks": ["10.4", "10.5", "10.6", "10.7", "10.8", "10.9", "10.10", "11.4", "13.2", "15.1", "15.2"] },
    { "id": 8, "tasks": ["11.5", "11.6", "11.7", "13.1", "14.1", "14.2", "15.3", "18.1"] },
    { "id": 9, "tasks": ["13.3", "13.4", "14.3", "15.4", "16.1", "17.1"] },
    { "id": 10, "tasks": ["16.2", "17.2"] },
    { "id": 11, "tasks": ["16.3", "17.3", "17.4"] },
    { "id": 12, "tasks": ["18.2", "18.3", "19.1"] },
    { "id": 13, "tasks": ["19.2", "19.3"] },
    { "id": 14, "tasks": ["19.4", "19.5", "19.6"] },
    { "id": 15, "tasks": ["19.7", "19.8", "19.9"] }
  ]
}
```

Reconciliation (task group 19) depends on the canonical serializer (task 4), the source translators and import path (task groups 6, 14), and the sync orchestrator integration (task group 16); its schemas (19.1) can land alongside the other schema work but its core and orchestration follow those prerequisites. Task 20 is the renumbered final checkpoint.
