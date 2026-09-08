# Implementation Plan: Vendor-Neutral Formats and Domain Categories

## Overview

Apply one classification model — structure / craft / subject / origin / destination, with vendor confined to the edge — to the axes that currently mis-carry a vendor, then make the model's invariants mechanically enforced. Track A collapses `kiro-skill` + `superpowers` into a vendor-neutral `skill-md` Source_Format with deprecated aliases and provenance continuity. Track B adds a curation-owned `domains` subject axis (freeform, governed by a Known_Domains_Registry warning) alongside the `categories` craft enum and surfaces it in catalog and browse. Track C defines `harnesses` as the Destination-axis allow-list and adds a `checkModelInvariants` guard that enforces INV-1..INV-3 across every contract and artifact — so a future change cannot silently reintroduce a vendor onto an intrinsic axis. Tracks A and B touch disjoint code and may land as separate PRs; Track C is cross-cutting and lands last because it depends on the field set A and B settle. The shared invariants and ADRs bind all three into one system. Implementation is TypeScript + Zod on Bun, tested with `fast-check` property tests and `bun:test` unit tests.

Each property test carries the comment `Feature: vendor-neutral-formats-categories, Property {N}: {title}`.

## Tasks

- [ ] 1. Track A — Define the vendor-neutral `skill-md` Source_Format
  - [ ] 1.1 Add `SKILL_MD_CONTRACT` in `src/rosetta/builtins/contracts.ts`
    - `id: "skill-md"`, `direction: "source"`, `harness: null`, `lifecycle.status: "active"`
    - `aliases: ["kiro-skill", "superpowers"]`
    - `pathConventions`: required `SKILL.md`, optional `**/*` companions preserved by relative path
    - `detection` rules weighting `SKILL.md` (required) and `references/*` (optional)
    - Export it and add to `BUILTIN_FORMAT_CONTRACTS` in `src/rosetta/index.ts`; remove `KIRO_SKILL_CONTRACT` and `SUPERPOWERS_CONTRACT` from the export/registration set
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.4_
  - [ ] 1.2 Add `SELECTION_ALIASES` entries for `kiro-skill` and `superpowers`
    - Each: `status: "deprecated"`, `replacement: "skill-md"`, `introducedIn`, `deprecatedIn`, `removalPolicy` (removal in next major)
    - _Requirements: 2.3, 2.6_
  - [ ] 1.3 Implement `translateSkillMd` in `src/rosetta/builtins/sources/skill-md.ts`
    - Merge `translateKiroSkill` + `translateSuperpowers`: parse `SKILL.md` frontmatter/body; map `references/*.md` to workflows stripping the `references/` prefix; `accountant.preserve()` all other companions by relative path
    - Register `["skill-md", translateSkillMd]` in `src/rosetta/builtins/sources/index.ts`; delete the `kiro-skill`/`superpowers` translator registrations
    - Delete `kiro-skill.ts` and `superpowers.ts`; re-point their tests at `translateSkillMd`
    - _Requirements: 1.4, 1.6_
  - [ ] 1.4 Write property test: Alias output equivalence (Property 1)
    - **Property 1: Alias output equivalence**
    - Generate Skill_Md_Structure dirs; assert translating under `kiro-skill`, `superpowers`, and `skill-md` yields an identical canonical artifact and identical serialized output (diagnostics excepted)
    - File: `src/__tests__/skill-md-alias-equivalence.property.test.ts`
    - **Validates: Requirements 1.4, 2.1, 2.2, 2.5**
  - [ ] 1.5 Write test: auto-detection resolves `SKILL.md` to `skill-md` (Property 2)
    - **Property 2: Auto-detection resolves SKILL.md to skill-md**
    - A directory whose only marker is `SKILL.md` detects as `skill-md`
    - File: `src/__tests__/rosetta-detect-skill-md.test.ts`
    - **Validates: Requirements 1.5**

- [ ] 2. Track A — Enforce the format-naming rule
  - [ ] 2.1 Keep `KIRO_POWER_CONTRACT` unchanged and add a registry self-check
    - Add a built-in-registry validation that fails if a `source` Format_Contract asserts a non-null `harness` for a structure declared multi-harness; `kiro-power` (Kiro-native) is the only permitted non-null `harness`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [ ] 2.2 Write test: no source format asserts a false vendor (Property 3)
    - **Property 3: No source format asserts a false vendor**
    - Iterate `BUILTIN_FORMAT_CONTRACTS`; assert every `source` contract except `kiro-power` has `harness: null`
    - File: `src/__tests__/format-vendor-rule.test.ts`
    - **Validates: Requirements 3.2, 3.3, 3.4**

- [ ] 3. Track A — Provenance and re-sync continuity
  - [ ] 3.1 Update `SOURCE_CONTRACT_IDENTIFIERS` in `src/import.ts`
    - Emit `skill-md@1` for the `skill-md` format (and thus for the alias selectors); remove `kiro-skill`/`superpowers` keys
    - _Requirements: 5.1_
  - [ ] 3.2 Add `CONTRACT_ID_ALIASES` resolver used by re-sync/reconciliation
    - Map `kiro-skill@1` → `skill-md@1` and `superpowers@1` → `skill-md@1`; read-only, applied where recorded `provenance.contract` is compared
    - Ensure no command rewrites recorded provenance as a side effect
    - _Requirements: 5.2, 5.4_
  - [ ] 3.3 Write test: provenance-id resolution round-trip (Property 4)
    - **Property 4: Provenance-id resolution round-trip**
    - Old ids resolve to `skill-md@1`; an artifact recorded under an old id re-syncs to a verifying base digest without re-import
    - Extend `src/__tests__/import-provenance.test.ts`
    - **Validates: Requirements 5.2, 5.3**
  - [ ] 3.4 Document the opt-in nature of any future bulk provenance rewrite
    - No implementation now; note in the ADR that a rewrite, if ever added, is an explicit command that reports every changed file
    - _Requirements: 5.5_

- [ ] 4. Track A — Export/install independence from source format
  - [ ] 4.1 Confirm and lock export destination is driven only by Target_Format + `Install_Path_Map`
    - Audit `src/install.ts` and target adapters to ensure the source format an artifact was imported from never influences install destination; add a guard/comment if any coupling is found
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [ ] 4.2 Write test: export destination depends only on target, not source (Property 5)
    - **Property 5: Export destination depends only on target, not source**
    - The same canonical artifact, regardless of source origin, installs to the same `Install_Path_Map` location per harness (`~/.claude/skills/`, `.codex/skills/`, `.kiro/`)
    - File: `src/__tests__/install-destination.test.ts`
    - **Validates: Requirements 4.2, 4.5, 4.6**

- [ ] 5. Checkpoint — Track A green
  - Run `bun test`, `bun x tsc --noEmit`, `bun run lint`; ensure `rosetta formats` lists `skill-md` active with `kiro-skill`/`superpowers` as deprecated aliases; confirm a full `bun run dev build` is byte-identical to pre-change output for existing `SKILL.md` artifacts (e.g. `jhsomcv`, `jhu-editorial-check`). Ask the user if questions arise.
  - _Requirements: 9.3_

- [ ] 6. Track B — Add the `domains` subject axis to the schema
  - [ ] 6.1 Extend `FrontmatterSchema` in `src/schemas.ts`
    - `domains: z.array(z.string().min(1).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)).default([])`
    - Do NOT modify `CategoryEnum`
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 7.1, 7.2_
  - [ ] 6.2 Extend `CatalogEntrySchema` in `src/schemas.ts`
    - `domains: z.array(z.string())`
    - _Requirements: 8.1_
  - [ ] 6.3 Add `"domains"` to `KNOWN_FRONTMATTER_FIELDS` in `src/parser.ts`
    - _Requirements: 9.5_
  - [ ] 6.4 Mark `domains` curation-owned in the reconciliation field-classification map
    - Join `categories`/`trust`/`collections`/`attribution` as curation-owned so import does not populate and re-sync does not overwrite it
    - _Requirements: 6.4_
  - [ ] 6.5 Write property test: Domains frontmatter round-trip (Property 6)
    - **Property 6: Domains frontmatter round-trip**
    - Extend `frontmatterArb` with a `domains` arbitrary; YAML round-trip preserves content and order
    - Extend `src/__tests__/schema-roundtrip.property.test.ts`
    - **Validates: Requirements 6.2, 6.6**
  - [ ] 6.6 Write property test: Categories/domains independence (Property 9)
    - **Property 9: Categories/domains independence**
    - Cross-product of valid Category and Domain values is accepted; a domain is never checked against `CategoryEnum` nor a category against the domain pattern
    - Extend `src/__tests__/schema-roundtrip.property.test.ts`
    - **Validates: Requirements 7.1, 7.3, 7.5**
  - [ ] 6.7 Write property test: Backward compatibility (Property 10)
    - **Property 10: Backward compatibility for the existing catalog**
    - Legacy frontmatter omitting `domains` parses with `domains: []`, no new errors, unchanged existing fields
    - File: `src/__tests__/backcompat-domains.test.ts`
    - **Validates: Requirements 9.1, 9.2, 9.5**

- [ ] 7. Track B — Propagate `domains` through catalog
  - [ ] 7.1 Map `domains` into each `CatalogEntry` in `generateCatalog()` (`src/catalog.ts`)
    - Add `domains: fm.domains` to the `entries.push({...})` call
    - _Requirements: 8.2_
  - [ ] 7.2 Write property test: Domains catalog round-trip (Property 7)
    - **Property 7: Domains catalog round-trip**
    - Extend `catalogEntryArb`; JSON round-trip through the catalog schema preserves `domains`
    - Extend `src/__tests__/catalog-roundtrip.property.test.ts`
    - **Validates: Requirements 8.1, 8.3**
  - [ ] 7.3 Write test: domains is curation-owned across re-sync (Property 8)
    - **Property 8: Domains is curation-owned across re-sync**
    - Author-set `domains` survives an import/re-sync of upstream unchanged
    - Extend the reconciliation test suite
    - **Validates: Requirements 6.4**
  - [ ] 7.4 Add the Known_Domains_Registry and governance-by-warning check
    - Add `KNOWN_DOMAINS` as an exported `readonly string[]` (e.g. `src/domains.ts`) plus a `closestKnownDomain(value)` helper (edit-distance over the registry)
    - In `validate.ts` cross-artifact pass, warn (never error) for a well-formed `domains` value not in `KNOWN_DOMAINS`, naming the value and suggesting the closest known domain when within threshold; keep the artifact valid
    - Adding a domain is a one-line append to `KNOWN_DOMAINS` with NO `FrontmatterSchema` change
    - _Requirements: 12.1, 12.2, 12.6, 12.7_
  - [ ] 7.5 Write test: unrecognized domains warn without failing, and suggest a canonical form (Property 13)
    - **Property 13: Unrecognized domains warn without failing, and suggest a canonical form**
    - Well-formed unknown value → exactly one warning, artifact stays valid; near match → warning names closest known domain; known value → no warning
    - File: `src/__tests__/domain-governance.test.ts` (also cover 12.6 extend-without-schema-change)
    - **Validates: Requirements 12.2, 12.3, 12.4, 12.5**

- [ ] 8. Track B — Surface `domains` in the browse UI
  - [ ] 8.1 Add a Domain facet and detail-view chips in `src/browse-ui.ts`
    - Facet filters by Domain alongside Category; detail view renders Domain values distinctly from Category values
    - _Requirements: 8.4, 8.5_
  - [ ] 8.2 Write/extend browse test for the Domain facet render and filter
    - _Requirements: 8.4, 8.5_

- [ ] 9. Checkpoint — Track B green
  - Run `bun test`, `bun x tsc --noEmit`, `bun run lint`; run `bun run dev catalog generate` and diff against the pre-change `catalog.json` — the only differences shall be added `domains` fields. Ask the user if questions arise.
  - _Requirements: 9.2, 9.3, 9.4_

- [ ] 10. Track C — Enforce the model invariants registry-wide
  - _Depends on Tracks A and B: C1 inspects the field set both settle, so this track lands last._
  - [ ] 10.1 Define `harnesses` as the Destination-axis allow-list (Requirement 13)
    - Add/adjust the `harnesses` field doc comment defining it as the export-target allow-list (which harnesses an artifact may build to), explicitly not a classification and not influencing Structure determination
    - Introduce `VENDOR_BEARING_FIELDS = {harnesses, provenance, attribution}` as the set of fields permitted to contain a Harness_Name
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_
  - [ ] 10.2 Implement `checkModelInvariants` in `src/validate.ts`
    - INV-1a (ERROR): no built-in Source_Format except `kiro-power` asserts a non-null `harness`
    - INV-1b (WARNING): no `categories`/`domains` value equals a Harness_Name
    - INV-3 (WARNING): no frontmatter field outside `VENDOR_BEARING_FIELDS` contains a Harness_Name
    - INV-2: assert no code path derives `categories`/`domains` from the source format (structural + Property 9)
    - Wire into `kanon validate`; registry violation → error, authored-metadata violation → warning
    - _Requirements: 11.1, 11.2, 11.4, 11.5, 11.6, 13.2_
  - [ ] 10.3 Write property test: model invariants hold across the whole model (Property 11)
    - **Property 11: Model invariants hold across the whole model**
    - Clean corpus (all built-in contracts + all artifacts) passes; inject a violation and assert it is flagged — error for a built-in-registry violation, warning for an authored-metadata violation
    - File: `src/__tests__/model-invariants.property.test.ts`
    - **Validates: Requirements 11.1, 11.2, 11.4, 11.5, 11.6**
  - [ ] 10.4 Write guard test: invariant check tracks the schema's intrinsic fields (Property 12)
    - **Property 12: Invariant check tracks the schema's intrinsic fields**
    - Assert the Intrinsic_Axis field set `checkModelInvariants` inspects equals the classification fields declared on `FrontmatterSchema`; adding an intrinsic field without registering it fails this test
    - In `src/__tests__/model-invariants.property.test.ts`; also assert `harnesses` is exempt (Req 13.2)
    - **Validates: Requirements 11.3, 11.7, 13.2**

- [ ] 11. Shared — Documentation, scaffold, and ADRs
  - [ ] 11.1 Add a commented `domains: []` block to `templates/knowledge/knowledge.md.njk`
    - _Requirements: 10.1_
  - [ ] 11.2 Update `CONTRIBUTING.md` and import docs
    - Use `--format skill-md`; mark `kiro-skill`/`superpowers` as deprecated aliases; add a worked `categories` vs `domains` example (e.g. `jhsomcv`: `categories: [documentation]`, `domains: [academic, healthcare, publishing]`); document the Known_Domains_Registry and how to propose additions; note `harnesses` is the Destination allow-list, distinct from the removed source-format `harness`
    - _Requirements: 10.2, 10.4, 12.7, 13.5_
  - [ ] 11.3 Verify `rosetta formats` output presents `skill-md` active + old ids as deprecated aliases
    - No code change expected (renderer already reads `lifecycle`/`aliases`); add/adjust a snapshot test
    - _Requirements: 10.3_
  - [x] 11.4 Write ADR-0067 — "Format identifiers describe structure, not vendor"
    - Drafted at `kanon/docs/adr/0067-format-identifiers-describe-structure-not-vendor.md` (Status: Proposed) and added to the ADR index
    - Realizes ADR-0066; states the naming rule (Requirement 3), applies it (`skill-md` `harness: null`; `kiro-power` unchanged), documents the alias + provenance-id migration, and records the model-invariant check as the registry-wide enforcement mechanism
    - _Requirements: 3.5, 10.5_
  - [x] 11.5 Write ADR-0068 — "Categories for craft, domains for subject"
    - Drafted at `kanon/docs/adr/0068-categories-for-craft-domains-for-subject.md` (Status: Proposed) and added to the ADR index
    - Extends ADR-0007; documents the two-axis split, why `domains` is freeform-with-warning (Known_Domains_Registry) rather than a second closed enum, and defines `harnesses` as the Destination axis so INV-1 does not contradict itself
    - _Requirements: 10.5, 13.5_
  - [ ] 11.6 Add changelog fragments
    - One `changed` fragment for the format rename/aliases; one `added` fragment for the `domains` field + domain governance; one `added` fragment for the model-invariant check
    - _Requirements: 10.2_

- [ ] 12. Final verification — the unified model holds
  - Full `bun test` (all property tests ≥100 runs) and `bun x tsc --noEmit` pass; `bun run dev validate` and `--security` pass for all artifacts; a whole-catalog before/after build+catalog diff is empty except for added `domains` fields; re-import of a `SKILL.md` source under `skill-md` and under each deprecated alias produces identical artifacts; `checkModelInvariants` reports clean over the full corpus; confirm INV-1..INV-3 are each exercised by a passing property (INV-1 → P3/P11, INV-2 → P9, INV-3 → P4/P5/P11) and that the C2 guard test (P12) is present.
  - _Requirements: 4.5, 5.3, 9.2, 9.3, 9.4, 11.1, 11.7_
