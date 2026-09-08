# Requirements: Upstream Attribution

## Goal

context-bazaar is a curated library of both in-house artifacts and imports
distilled from external upstreams. Machine lineage already exists
(`provenance` + the ADR-0049 reconciliation engine), but there is no
structured, credit- and license-facing record of *who authored the upstream
work an artifact derives from*. Today that credit is smeared across the
free-text `author:` string in four incompatible conventions and hand-written
prose banners in artifact bodies — unqueryable, unrenderable, un-lintable, and
unprotected from re-sync.

This feature adds a first-class, structured `attribution` block, **captured at
import time by an interactive wizard** that derives everything it can and asks
the curator only for the one genuine judgment (the *relationship*). The block
is curation-owned, so it survives every upstream re-sync. See
[ADR-0064](../../../kanon/docs/adr/0064-structured-upstream-attribution.md).

## Glossary

- **Attribution_Record** — the structured `attribution` frontmatter block on a
  `KnowledgeArtifact`: one or more `Upstream_Work` entries plus `curated-by` and
  an optional `notice`.
- **Upstream_Work** — one entry in `attribution.upstream[]`: `work`, `authors`,
  and optional `url`, `license`, `source-repo`, `source-commit`, `relationship`.
- **Relationship** — the closed enum describing the copyright-relevant link to an
  upstream work: `verbatim | adapted | inspired-by | packaged`.
- **Provenance_Record** — the pre-existing machine-owned `provenance` block
  (ADR-0049). Distinct from Attribution_Record: opposite ownership and lifecycle.
- **Attribution_Wizard** — the interactive import-time prompt that derives and
  confirms an Attribution_Record.
- **Field_Ownership_Policy** — the ADR-0049 reconciliation classification map.
  `attribution` is added to it as `curation-owned`.
- **NOTICES_Report** — the deterministic credit/license report produced by
  `kanon attribute`.

## Requirements

### Requirement 1 — Attribution_Record schema

**User story:** As a library maintainer, I want a structured `attribution`
frontmatter block, so that upstream credit is machine-readable rather than prose.

**Acceptance criteria:**

- WHEN an artifact's frontmatter contains an `attribution` block THE SYSTEM SHALL
  validate it against an `AttributionRecordSchema` defined in `src/schemas.ts`.
- THE SYSTEM SHALL require each `Upstream_Work` entry to carry a non-empty `work`
  and a non-empty `authors` array, and SHALL allow optional `url`, `license`,
  `source-repo`, `source-commit`, and `relationship`.
- THE SYSTEM SHALL constrain `relationship` to the enum
  `verbatim | adapted | inspired-by | packaged` and default an absent value to
  `verbatim`.
- THE SYSTEM SHALL allow one or more `Upstream_Work` entries in
  `attribution.upstream[]`.
- THE SYSTEM SHALL treat the whole `attribution` block as optional; an artifact
  with no upstream omits it and remains valid.
- IF `attribution.upstream[].license` is present THEN THE SYSTEM SHALL accept an
  SPDX identifier string, reusing the conventions of the existing frontmatter
  `license` field.
- THE SYSTEM SHALL register `attribution` in `KNOWN_FRONTMATTER_FIELDS` in
  `src/parser.ts` so it round-trips without an "unknown field" warning.

### Requirement 2 — `author` coexistence and backward compatibility

**User story:** As a maintainer of 66 existing artifacts, I want the current
`author` field to keep working unchanged, so that nothing breaks.

**Acceptance criteria:**

- THE SYSTEM SHALL retain `author` as the one-line display string with no change
  to its type or semantics.
- THE SYSTEM SHALL treat `attribution` as purely additive: an artifact with only
  `author` and no `attribution` SHALL validate exactly as it does today.
- THE SYSTEM SHALL NOT require `attribution` for any artifact to build, validate,
  or catalog.

### Requirement 3 — Import-time Attribution_Wizard (primary capture)

**User story:** As a curator importing an upstream artifact, I want a prompt that
pre-fills every derivable field and asks me only for the relationship, so that
capturing attribution is one confirmation rather than hand-authoring.

**Acceptance criteria:**

- WHEN an artifact is imported interactively THE SYSTEM SHALL present an
  Attribution_Wizard modeled on the existing `kanon new` wizard (`src/wizard.ts`,
  `@clack/prompts`).
- THE SYSTEM SHALL pre-fill `source-repo` and `source-commit` from the same
  acquisition data that populates `provenance.sourceRepo` / `sourceRevision`.
- THE SYSTEM SHALL pre-fill `work` and `authors` from the upstream artifact's own
  `author` / `name` frontmatter when present.
- THE SYSTEM SHALL pre-fill `license` from the upstream artifact's `license`
  frontmatter when present, and `url` from the upstream repo plus source path.
- THE SYSTEM SHALL default `curated-by` from `kanon.config.yaml` or git identity.
- THE SYSTEM SHALL require the curator to select a `relationship`, defaulting the
  selection to `verbatim`.
- WHEN the curator completes the wizard THE SYSTEM SHALL write a complete,
  schema-valid `attribution` block into the new artifact's frontmatter.
- THE SYSTEM SHALL run the wizard on FIRST import only; a re-sync of an artifact
  that already has an `attribution` block SHALL NOT re-prompt.

### Requirement 4 — Non-interactive import modes

**User story:** As an operator running the batch `sync-upstream.sh` path, I want
non-interactive attribution behavior, so that bulk imports don't block on prompts.

**Acceptance criteria:**

- WHEN import is invoked with `--attribution-defaults` THE SYSTEM SHALL accept all
  derived values and `relationship: verbatim` without prompting, producing a
  complete `attribution` block.
- WHEN import is invoked with `--no-attribution` THE SYSTEM SHALL skip the block
  entirely, leaving `attribution` absent.
- WHEN import runs in a non-TTY environment without an explicit flag THE SYSTEM
  SHALL behave as `--attribution-defaults` and SHALL record a warning that the
  relationship was assumed `verbatim`.
- THE SYSTEM SHALL wire the chosen non-interactive flag through
  `scripts/sync-upstream.sh`.

### Requirement 5 — Curation-owned reconciliation

**User story:** As a maintainer, I want a hand-refined `attribution` block to
survive upstream re-syncs, so that credit is never silently overwritten.

**Acceptance criteria:**

- THE SYSTEM SHALL add `attribution` to `ReconcilableFieldSchema` and classify it
  `curation-owned` in `DEFAULT_FIELD_OWNERSHIP_POLICY`.
- WHEN a three-way reconciliation runs on an artifact THE SYSTEM SHALL keep the
  curated (`ours`) `attribution` value and SHALL NOT fast-forward it to any
  upstream value.
- THE SYSTEM SHALL keep `provenance` classified `machine-owned`, preserving the
  opposite ownership of the two blocks.

### Requirement 6 — Validation warnings

**User story:** As a maintainer, I want the validator to flag imports that are
missing or under-specifying attribution, so that un-credited work is caught
mechanically.

**Acceptance criteria:**

- WHEN an artifact has a `provenance` record but no `attribution.upstream` THE
  SYSTEM SHALL emit a validation **warning** (not an error) naming the artifact.
- WHEN an `attribution.upstream[].license` is an attribution-required license
  (e.g. `CC-BY*`, `MPL-2.0`) but the entry has no `authors` and the block has no
  `notice` THE SYSTEM SHALL emit a validation warning.
- THE SYSTEM SHALL NOT fail the build on either condition (warnings only, per the
  ADR-0008 warnings-not-errors convention for advisory checks).

### Requirement 7 — Catalog projection and rendering

**User story:** As a browse-UI user, I want a consistent "Sources & credits"
panel per artifact, so that attribution is visible everywhere instead of buried
in prose banners.

**Acceptance criteria:**

- THE SYSTEM SHALL project a subset of `attribution` into `CatalogEntrySchema` at
  catalog-generation time.
- WHEN the browse UI or MCP bridge renders an artifact with attribution THE
  SYSTEM SHALL display a "Sources & credits" section in the DETAIL view derived
  from the projected block.
- WHEN the browse gallery renders an artifact card whose `attribution.upstream`
  is present THE SYSTEM SHALL show a relationship chip in the existing
  `card-footer` badge row (Option A), styled like the sibling trust/maturity
  badges. The chip SHALL read `↳ <work> · <relationship>` for a single upstream
  and `↳ N sources` for two or more, and SHALL be absent for an artifact with no
  `attribution`.
- WHEN a harness adapter compiles an artifact with attribution THE SYSTEM SHALL
  emit a uniform attribution footer in the harness-native output.
- THE SYSTEM SHALL regenerate `catalog.json` correctly (per the standing "catalog
  must be regenerated after any knowledge change" rule) with the new field.

### Requirement 8 — `kanon attribute` NOTICES report

**User story:** As a maintainer preparing a release, I want a generated
NOTICES-style report, so that license compliance is a command, not a manual pass.

**Acceptance criteria:**

- WHEN `kanon attribute` is invoked THE SYSTEM SHALL walk every
  `attribution`-bearing artifact and emit a deterministic credit/license report.
- THE SYSTEM SHALL group entries by license and list each `Upstream_Work` with
  its `work`, `authors`, `url`, and `relationship`.
- THE SYSTEM SHALL produce byte-identical output for identical input (determinism,
  mirroring the ADR-0049 reconciliation report).

### Requirement 9 — One-shot backfill of existing imports

**User story:** As a maintainer, I want the ~15 already-imported credited
artifacts brought up to the new shape, so that the corpus is consistent.

**Acceptance criteria:**

- WHEN a backfill command runs THE SYSTEM SHALL, for each existing artifact with a
  recognizable upstream `author`/`license` (and any `provenance`), generate a
  draft `attribution` block deriving fields from that metadata with
  `relationship: verbatim`.
- WHEN an artifact body contains a source banner (`> **Source and adaptation:**`
  or similar) THE SYSTEM SHALL parse the repo URL and `@<commit>` it names, fold
  them into the derived `Upstream_Work`, and — IF the banner names a distinct
  original work or author beyond the packaging repo — add a second
  `Upstream_Work` entry and route the artifact to manual review.
- THE SYSTEM SHALL leave the existing `author` string untouched.
- THE SYSTEM SHALL NOT overwrite an `attribution` block that already exists.
- THE SYSTEM SHALL report which artifacts were backfilled clean and which need a
  manual `relationship` review (author-prose adaptation markers *or* a
  multi-work body banner).

## Non-Functional Requirements

- **Determinism:** attribution projection and the NOTICES report SHALL be pure
  and deterministic, consistent with the Rosetta Stone pure-core boundary.
- **Backward compatibility:** the change SHALL be additive; all existing tests
  and all 66 `author`-bearing artifacts SHALL continue to validate.
- **Security:** the wizard SHALL NOT read or store credentials; derived `url`
  values SHALL be repo/path references only.
- **Testing:** schema, reconciliation classification, validator warnings,
  projection, and the NOTICES report SHALL each carry unit tests; wizard field
  derivation SHALL be tested with injected inputs (no live prompting in tests).
