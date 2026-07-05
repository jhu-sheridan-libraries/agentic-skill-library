# Implementation Plan: nWave Forge Integration

## Overview

This implementation integrates five nWave-inspired capabilities into Kanon: two knowledge skills (Rigor Profiles, Outcomes Methodology), and three CLI/pipeline enhancements (Outcomes Registry with collision detection, DES-style hook execution, enhanced catalog metadata, and mutation testing). The plan follows the pure-core/thin-shell architecture, building schema extensions first, then pure algorithm modules, then wiring into existing commands.

## Tasks

- [x] 1. Schema extensions and data models
  - [x] 1.1 Add Outcome schema and frontmatter extension
    - Add `OutcomeKindSchema`, `OutcomeSchema` to `src/schemas.ts`
    - Add `outcomes: z.array(OutcomeSchema).default([])` to `FrontmatterSchema`
    - Add `outcomes` to `KNOWN_FRONTMATTER_FIELDS` in `src/parser.ts`
    - Extend `CatalogEntrySchema` with `outcomes` array (id, kind, inputShape, outputShape, keywords)
    - _Requirements: 2B.1, 2B.2, 2C.1, 2C.3, 2H.2_

  - [x] 1.2 Add visibility and priority schema extensions
    - Add `VisibilitySchema` (enum: public/private/unlisted, default public) to `src/schemas.ts`
    - Add `PrioritySchema` (int 1-100, default 50) to `src/schemas.ts`
    - Extend `FrontmatterSchema` with optional `visibility` and `priority` fields
    - Extend `CollectionSchema` with optional `visibility` and `priority` fields
    - Extend `CatalogEntrySchema` with `visibility` and `priority` fields
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.10_

  - [x] 1.3 Add DES hook schema extensions
    - Add `HookStateValueSchema` (union of string | boolean) to `src/schemas.ts`
    - Extend `CanonicalHookSchema` with optional `gate: z.string()`
    - Extend `CanonicalHookSchema` with optional `postcondition: z.string()`
    - Extend `CanonicalHookSchema` with optional `state: z.record(z.string(), HookStateValueSchema)`
    - _Requirements: 3.1, 3.3, 3.5_

  - [x] 1.4 Add mutation testing config schema
    - Add `MutationOperatorSchema` enum to `src/config.ts`
    - Extend `ForgeConfigSchema` with optional `eval.mutationOperators` array (defaults to all 5 operators)
    - _Requirements: 5.3_

  - [x] 1.5 Write unit tests for new schemas
    - Test OutcomeSchema validation (valid/invalid IDs, max lengths, keyword constraints)
    - Test VisibilitySchema and PrioritySchema defaults and range enforcement
    - Test hook gate/postcondition/state schema parsing
    - Test MutationOperatorSchema enum values
    - _Requirements: 2B.1, 2C.3, 4.1, 4.2, 4.10, 3.1, 3.3, 3.5, 5.3_

- [x] 2. Outcomes Registry — pure core modules
  - [x] 2.1 Implement shape normalization (`src/outcomes/normalize.ts`)
    - Implement `normalizeShape(shape: string): string` — pure function
    - Steps: trim, collapse whitespace, lowercase, normalize Array<T> to T[], strip tuple param names, sort top-level union members alphabetically
    - Ensure it does NOT resolve aliases, erase generics, or structurally compare objects
    - _Requirements: 2D.1, 2D.2_

  - [x]* 2.2 Write property tests for shape normalization
    - **Property: normalizeShape is idempotent** — `normalizeShape(normalizeShape(s)) === normalizeShape(s)` for any string
    - **Property: normalizeShape output is always lowercase** — no uppercase characters in output
    - **Property: union member order is canonical** — sorting is stable and alphabetical
    - **Validates: Requirements 2D.1**
    - File: `src/__tests__/outcomes-normalize.property.test.ts`

  - [x] 2.3 Implement collision detection (`src/outcomes/collision.ts`)
    - Implement `tokenizeKeywords(keywords: string[]): Set<string>` — split on `-`, `_`, whitespace; drop tokens ≤ 2 chars; dedupe
    - Implement `jaccardSimilarity(a: Set<string>, b: Set<string>): number` — |A∩B| / |A∪B|, 0 when both empty
    - Implement `shapesMatch(a, b): boolean` — exact match on normalized (inputShape, outputShape) tuple
    - Implement `keywordsMatch(a, b, threshold?): boolean` — Jaccard ≥ 0.4 (default)
    - Implement `computeVerdict(a, b, threshold?): Verdict` — COLLISION / AMBIGUOUS / CLEAN
    - Implement `isAcknowledged(a, b): boolean` — mutual `related` reference
    - _Requirements: 2E.1, 2E.2, 2E.3, 2E.4_

  - [x] 2.4 Write property tests for collision detection
    - **Property: Jaccard similarity is symmetric** — `jaccardSimilarity(a, b) === jaccardSimilarity(b, a)`
    - **Property: Jaccard range is [0, 1]** — output always between 0 and 1 inclusive
    - **Property: computeVerdict is symmetric** — `computeVerdict(a, b) === computeVerdict(b, a)`
    - **Property: isAcknowledged requires mutual reference** — one-sided reference returns false
    - **Validates: Requirements 2E.1, 2E.2, 2E.3, 2E.4**
    - File: `src/__tests__/outcomes-collision.property.test.ts`

  - [x] 2.5 Implement registry aggregation and check (`src/outcomes/registry.ts`)
    - Implement `aggregateOutcomes(artifacts): OutcomeRef[]` — flatten outcomes with artifact attribution
    - Implement `runRegistryCheck(refs, threshold?): RegistryReport` — duplicate-id detection + pairwise collision + acknowledged-overlap downgrade
    - Export `OutcomeRef`, `CollisionFinding`, `RegistryReport` interfaces
    - _Requirements: 2F.1, 2F.4, 2E.4_

  - [x] 2.6 Write unit tests for registry aggregation
    - Test duplicate-id detection across artifacts
    - Test pairwise collision reports include both IDs, artifact names, shapes, Jaccard score
    - Test acknowledged-overlap downgrade when both outcomes list each other in `related`
    - Test AMBIGUOUS verdict is reported but not treated as error
    - _Requirements: 2F.1, 2F.2, 2F.3, 2F.4_

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. DES-Style Hook Execution — pure core modules
  - [x] 4.1 Implement expression engine (`src/hooks/expression.ts`)
    - Implement `parseExpression(expr: string): ParsedExpression` — parse boolean expression grammar (&&, ||, !, parens, equality against literals)
    - Implement `collectReferences(expr): { stateKeys, predicates }` — extract all referenced state keys and predicate names
    - Implement `validateReferences(expr, declaredStateKeys): { undefinedStateKeys, undefinedPredicates }` — check against BUILTIN_PREDICATES and declared keys
    - Implement `evaluateExpression(expr, predicateValues, state): boolean` — pure evaluation
    - Export `BUILTIN_PREDICATES` constant (`tests_pass`, `files_exist`, `lint_clean`)
    - _Requirements: 3.1, 3.7_

  - [x]* 4.2 Write property tests for expression engine
    - **Property: evaluateExpression with constant true expression always returns true**
    - **Property: collectReferences is deterministic** — same expression yields same references
    - **Property: double negation is identity** — `evaluate(!(!expr)) === evaluate(expr)`
    - **Validates: Requirements 3.1, 3.7**
    - File: `src/__tests__/hooks-expression.property.test.ts`

  - [x] 4.3 Implement hook pipeline (`src/hooks/pipeline.ts`)
    - Implement `runPipeline(hooks, resolvePredicates): PipelineResult`
    - Process hooks in declaration order: gate → action → postcondition (Req 3.8 fixed order)
    - Gate false → skip action + record warning (Req 3.2)
    - Postcondition false after action → halt with failure details (Req 3.4)
    - Thread state writes from earlier hooks into later hooks' context (Req 3.9)
    - Export `HookStepOutcome` and `PipelineResult` types
    - _Requirements: 3.2, 3.4, 3.8, 3.9_

  - [x] 4.4 Write unit tests for hook pipeline
    - Test gate skip behavior and warning emission
    - Test postcondition halt behavior with failure details
    - Test state threading across hooks in order
    - Test multiple hooks with mixed gate pass/fail scenarios
    - _Requirements: 3.2, 3.4, 3.8, 3.9_

  - [x] 4.5 Implement gate-to-preamble translation in Kiro adapter
    - Add `translateGateToPreamble(gate: string): string` pure helper to `src/adapters/kiro.ts`
    - Extend `buildKiroHook` to prepend natural-language precondition preamble when gate is defined
    - Map built-in predicates to fixed phrasings (e.g., `tests_pass` → "Confirm the test suite passes")
    - Map state-key references to "Confirm that <key> is <expected>"
    - _Requirements: 3.6_

- [x] 5. Validate and guild sync integration — outcomes + hooks
  - [x] 5.1 Integrate outcomes collision detection into `kanon validate`
    - Add cross-artifact outcomes pass to `validateAll` in `src/validate.ts`
    - Aggregate outcomes from all artifacts, call `runRegistryCheck`
    - Map COLLISION findings to `ValidationError` (include both IDs, artifact names, shapes, Jaccard)
    - Map AMBIGUOUS findings to `ValidationWarning`
    - Errors cause non-zero exit via existing validation logic
    - _Requirements: 2F.1, 2F.2, 2F.3, 2F.4_

  - [x] 5.2 Integrate hook reference validation into `kanon validate`
    - When parsing `hooks.yaml`, for every `gate` and `postcondition` expression:
    - Parse expression and run `validateReferences` against union of all declared `state` keys in the file
    - Any undefined state key or unknown predicate yields a `ValidationError` with hook name and field
    - _Requirements: 3.7_

  - [x] 5.3 Integrate outcomes collision detection into `kanon guild sync`
    - After artifact resolution, before materialization, aggregate outcomes and run `runRegistryCheck`
    - COLLISION (non-acknowledged) → error, set hasFatalError, return before materialize
    - AMBIGUOUS → warning, continue
    - Add `--force` flag to `SyncOptions`: when set, collisions become warnings and materialization proceeds
    - _Requirements: 2G.1, 2G.2, 2G.3, 2G.4_

  - [x] 5.4 Write unit tests for validate and guild sync integration
    - Test validate reports collision errors with correct details
    - Test validate reports ambiguous as warnings without blocking
    - Test guild sync blocks on collision, proceeds with --force
    - Test hook reference validation catches undefined state keys and unknown predicates
    - _Requirements: 2F.2, 2F.3, 2G.2, 2G.3, 3.7_

- [x] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Enhanced Catalog Metadata
  - [x] 7.1 Implement catalog visibility filtering and priority sorting
    - Modify `generateCatalog` in `src/catalog.ts` to exclude `visibility: private` entries entirely
    - Retain `unlisted` entries with `visibility` field set in JSON output
    - Implement `sortCatalogEntries(entries): CatalogEntry[]` — sort by priority desc, then name asc
    - Replace existing sort with `sortCatalogEntries`
    - Include `outcomes` array projection (id, kind, inputShape, outputShape, keywords) in catalog entries
    - _Requirements: 4.5, 4.6, 4.7, 2H.1, 2H.2_

  - [x] 7.2 Implement browse filtering with --all flag
    - Extend `kanon catalog browse` in `src/browse.ts` with `--all` CLI option
    - Default listing: hide private (already absent from catalog.json) and unlisted
    - With `--all`: show unlisted, continue hiding private
    - _Requirements: 4.8, 4.9_

  - [x] 7.3 Write unit tests for catalog metadata
    - Test private artifacts excluded from catalog.json
    - Test unlisted artifacts included with visibility field
    - Test priority sorting (descending) with alphabetical tiebreak
    - Test browse default hides unlisted, --all reveals unlisted
    - Test outcomes array included in catalog entries
    - _Requirements: 4.5, 4.6, 4.7, 4.8, 4.9, 2H.1, 2H.2_

- [x] 8. Mutation Testing
  - [x] 8.1 Implement mutation operators (`src/mutation/operators.ts`)
    - Define `Mutant` interface (filePath, line, operator, originalSnippet, mutatedSnippet, mutatedSource)
    - Implement `generateMutants(filePath, source, operators, cap?): Mutant[]` — pure, deterministic, capped at 50 per file
    - Implement 5 operators: statement-deletion, conditional-boundary, arithmetic-replacement, string-literal, return-value
    - Each operator locates candidate AST sites and emits single-site mutations
    - _Requirements: 5.3_

  - [x] 8.2 Write property tests for mutation operators
    - **Property: generateMutants never exceeds cap** — output length ≤ cap for any input
    - **Property: each mutant differs from original at exactly one site** — mutatedSource !== source
    - **Property: generateMutants is deterministic** — same input produces same output
    - **Validates: Requirements 5.3**
    - File: `src/__tests__/mutation-operators.property.test.ts`

  - [x] 8.3 Implement delta strategy (`src/mutation/delta.ts`)
    - Implement `selectDeltaTargets(adapterFiles, changedFiles): string[]` — pure intersection logic
    - _Requirements: 5.6_

  - [x] 8.4 Implement history persistence (`src/mutation/history.ts`)
    - Define `MutationRunRecord` interface (ts, sha, killRate, totalMutants, killed, survived, operators)
    - Implement `serializeRecord(r): string` — pure, single JSONL line
    - Implement `parseHistory(content): MutationRunRecord[]` — pure JSONL parsing
    - Implement `appendRecord(filePath, record): Promise<void>` — I/O: append to `evals/mutation-history.jsonl`
    - _Requirements: 5.8_

  - [x] 8.5 Implement mutation runner orchestration (`src/mutation/runner.ts`)
    - Implement adapter file discovery: scan `src/adapters/` for .ts files exporting HarnessAdapter, exclude types.ts/index.ts/capabilities.ts
    - Exit code 1 with error if no adapter files found
    - For each mutant: write mutated source, run `bun test` with 30s timeout, record killed/survived
    - Implement `computeKillRate(killed, total): number` — pure
    - Exit code 1 if kill rate < threshold (default 0.80)
    - Report surviving mutants with file path, line, operator, original/mutated code (3 lines context)
    - _Requirements: 5.1, 5.2, 5.4, 5.5, 5.9, 5.10_

  - [x] 8.6 Wire CLI for `kanon eval --mutation`
    - Add `--mutation`, `--delta`, `--threshold <decimal>`, and `--trend` flags to eval command in `src/eval.ts` / `src/cli.ts`
    - `--delta`: read last run SHA from history, call `git diff`, pass to `selectDeltaTargets`; fall back to full run if no baseline (Req 5.7)
    - `--trend`: read and render history (reuse sparkline style)
    - _Requirements: 5.1, 5.5, 5.6, 5.7, 5.8_

  - [x] 8.7 Write unit tests for mutation testing
    - Test adapter discovery includes correct files and excludes types.ts/index.ts/capabilities.ts
    - Test computeKillRate edge cases (0 total, all killed, all survived)
    - Test selectDeltaTargets intersection logic
    - Test history serialization round-trip
    - Test threshold exit code behavior
    - _Requirements: 5.2, 5.5, 5.6, 5.8, 5.10_

- [x] 9. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Knowledge Skills — prose content
  - [x] 10.1 Author Rigor Profiles knowledge skill (`knowledge/codeshop/workflows/tune-rigor.md`)
    - Document four profiles: lean, standard, thorough, exhaustive
    - Include decision matrix mapping 4 dimensions (criticality, blast radius, reversibility, audience) to profiles
    - Per-profile practice tables: included practices (TDD depth, review passes, refactoring pass, mutation testing)
    - Per-profile exclusion tables: each omitted practice named with one-sentence rationale
    - Conflict-resolution rule: select higher rigor when dimensions map to multiple candidates
    - Worked examples referencing driving dimension values
    - Language-agnostic and tool-agnostic prose, matching codeshop shared-concepts style
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

  - [x] 10.2 Author Outcomes Methodology knowledge skill (`knowledge/codeshop/workflows/register-outcomes.md`)
    - Document outcomes registration pattern and when to declare outcomes
    - Document two-tier collision detection algorithm (shape match + keyword Jaccard)
    - Document verdict matrix (COLLISION, AMBIGUOUS, CLEAN) and resolution workflow
    - Document `related` field for acknowledging intentional overlap
    - Use generic type-shape notation only (primitives, arrays, maps, tuples, unions, named records)
    - Language-agnostic prose, no language-specific syntax
    - _Requirements: 2A.1, 2A.2_

- [x] 11. Changelog fragments and final wiring
  - [x] 11.1 Create changelog fragments
    - Create fragment for outcomes registry (added)
    - Create fragment for DES hook execution (added)
    - Create fragment for enhanced catalog metadata (added)
    - Create fragment for mutation testing (added)
    - Create fragment for rigor profiles knowledge skill (added)
    - Create fragment for outcomes methodology knowledge skill (added)
    - _Requirements: all (project convention)_

  - [x] 11.2 Wire all components together and verify end-to-end
    - Ensure `kanon validate` runs outcomes collision + hook reference validation in correct order
    - Ensure `kanon guild sync` gates on outcomes before materialization
    - Ensure `kanon catalog` includes outcomes, visibility, priority with correct filtering/sorting
    - Ensure `kanon eval --mutation` routes correctly and produces expected output
    - Ensure existing tests still pass with schema extensions (backward compatibility via defaults)
    - _Requirements: 2C.2, 2F.1, 2G.1, 4.4, 4.5, 5.1_

- [x] 12. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties of pure functions (normalization, Jaccard, verdict symmetry, operator cap)
- Unit tests validate specific examples, edge cases, and integration behavior
- Knowledge skills (10.1, 10.2) are prose-only — validated via eval framework, not code tests
- All new frontmatter/manifest fields use `.default()` in Zod schemas for backward compatibility
- The outcomes `runRegistryCheck` function is reused by both validate and guild sync — single source of truth

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["1.5", "2.1", "4.1", "10.1", "10.2"] },
    { "id": 2, "tasks": ["2.2", "2.3", "4.2", "4.3"] },
    { "id": 3, "tasks": ["2.4", "2.5", "4.4", "4.5"] },
    { "id": 4, "tasks": ["2.6", "5.1", "5.2", "7.1"] },
    { "id": 5, "tasks": ["5.3", "5.4", "7.2", "8.1"] },
    { "id": 6, "tasks": ["7.3", "8.2", "8.3", "8.4"] },
    { "id": 7, "tasks": ["8.5", "8.6"] },
    { "id": 8, "tasks": ["8.7", "11.1"] },
    { "id": 9, "tasks": ["11.2"] }
  ]
}
```
