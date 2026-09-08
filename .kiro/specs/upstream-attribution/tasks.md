# Implementation Plan: Upstream Attribution

Ordered, incremental coding tasks. Each builds on the prior, references the
requirement(s) it implements, and includes its own verification. All commands
run from `kanon/`. Verify with Bun (`bun test`, `bun run dev validate`,
`bun x tsc --noEmit`, `bun run lint`) — this repo has no Python project.

- [x] 1. Add `AttributionRecordSchema` to `src/schemas.ts`
  - [x] 1.1 Define `RelationshipSchema`, `UpstreamWorkSchema`, `AttributionRecordSchema` above `FrontmatterSchema`, matching the file's Zod-4 conventions (kebab-case keys `source-repo`/`source-commit`/`curated-by`, `relationship` defaulting to `verbatim`, `authors` min 1).
  - [x] 1.2 Add `attribution: AttributionRecordSchema.optional()` to `FrontmatterSchema`; leave `author` unchanged.
  - [x] 1.3 Export the schemas and inferred types.
  - Verify: `bun x tsc --noEmit`; add schema unit tests (valid/invalid fixtures, `relationship` default, `author`-only artifact still valid) and `bun test`.
  - _Requirements: 1, 2_

- [x] 2. Register `attribution` in the parser's known fields
  - [x] 2.1 Add `"attribution"` to `KNOWN_FRONTMATTER_FIELDS` in `src/parser.ts`.
  - Verify: parse a fixture artifact carrying `attribution` and assert no unknown-field warning; `bun test`.
  - _Requirements: 1_

- [x] 3. Classify `attribution` as curation-owned in reconciliation
  - [x] 3.1 Add `"attribution"` to `ReconcilableFieldSchema` and `attribution: "curation-owned"` to `DEFAULT_FIELD_OWNERSHIP_POLICY` in `src/schemas.ts`.
  - Verify: reconciliation test asserting a diverged upstream `attribution` keeps `ours` and never fast-forwards; `bun test`.
  - _Requirements: 5_

- [x] 4. Pure attribution-draft derivation
  - [x] 4.1 Add `deriveAttributionDraft(input)` (new `src/attribution.ts`) that builds an `AttributionRecord` from upstream frontmatter + acquisition data (`source-repo`/`source-commit`/`url`/`work`/`authors`/`license`/`curated-by`), `relationship: verbatim`.
  - Verify: unit tests over upstream-frontmatter fixtures incl. missing `author` (empty `authors`) and multi-author; `bun test`.
  - _Requirements: 3_

- [x] 5. Attribution wizard shell + import wiring
  - [x] 5.1 Add `runAttributionWizard(draft, {mode})` reusing `@clack/prompts` helpers from `src/wizard.ts`: confirm derived fields, require a `relationship` select (default `verbatim`).
  - [x] 5.2 Wire it into `src/import.ts` after translation/before write; skip when the existing on-disk artifact already has an `attribution` block (first-import-only).
  - Verify: tests for `interactive`/`defaults`/`skip` with injected inputs (no live prompt); assert first-import-only skip; `bun test`.
  - _Requirements: 3, 4, 5_

- [x] 6. Non-interactive flags and batch path
  - [x] 6.1 Add `--attribution-defaults` and `--no-attribution` to the import command in `src/cli.ts`. NOTE: plain non-interactive local imports default to `skip` (not `defaults`) — attribution is an upstream-credit concern and forcing a block on local `kanon import` broke byte-determinism; interactive TTY prompts, and the backfill/`--attribution-defaults` populate blocks.
  - [~] 6.2 DEFERRED: `scripts/sync-upstream.sh` calls `kanon rosetta translate --profile`, NOT `kanon import` — the batch path is a SEPARATE engine (`rosetta-cli.ts translateCommand`) with its own write path, so `--attribution-defaults` cannot be wired via a one-line script edit. Wiring attribution through `rosetta translate`/profile translation is a larger change the spec did not scope; the one-shot backfill (task 11) covers the corpus regardless of import path.
  - Verify: CLI tests for each flag and the non-TTY default path; `bun test`.
  - _Requirements: 4_

- [x] 7. Validation warnings
  - [x] 7.1 In `src/validate.ts`, warn when `provenance` present AND `attribution?.upstream` absent/empty (naming the artifact).
  - [x] 7.2 Warn when an `attribution.upstream[].license` is attribution-required (`/^CC-BY/`, `MPL-2.0`, small constant set) with no `authors` and no `notice`. Neither fails the build.
  - Verify: tests asserting both warnings fire and `valid` stays true; `bun run dev validate` on a fixture; `bun test`.
  - _Requirements: 6_

- [x] 8. Catalog projection and gallery card chip
  - [x] 8.1 Add optional projected `attribution` to `CatalogEntrySchema`; copy it during generation in `src/catalog.ts`.
  - [x] 8.2 In `renderCards` (`src/browse-ui.ts`, ~line 1001), when `entry.attribution?.upstream` is present, append a relationship chip to the `.card-badges` footer row (Option A): `↳ <work> · <relationship>` for one upstream, `↳ N sources` for ≥2. Add a `.badge-attribution` CSS modifier (indigo `#eef2ff`/`#3730a3`) alongside the existing badge classes. Absent when `attribution` is absent (in-house cards unchanged). Also added a detail-view "Sources & credits" section. (`web-verify` screenshot deferred — no live gallery server in this pass.)
  - Verify: catalog test asserting the field projects; `bun run dev catalog generate` produces a valid `catalog.json`; a `browse-ui` test asserting the chip renders for a projected-attribution entry, shows `N sources` for a two-upstream entry, and is absent otherwise; `web-verify` screenshot of the gallery against the approved Option A mockup; `bun test`.
  - _Requirements: 7_

- [x] 9. Harness adapter attribution footer
  - [x] 9.1 Render a uniform "Sources & credits" footer from `attribution` in the adapters (`src/adapters/*`) via a shared Nunjucks partial in `templates/harness-adapters/*`; adapters stay pure (ADR-0003). Implemented as `_base/attribution-footer.md.njk` included from the base `footer` block, so ALL markdown-body adapters inherit it uniformly.
  - Verify: golden-output test for one adapter (e.g. `claude-code`) includes the footer; artifact without `attribution` emits none; `bun test`.
  - _Requirements: 7_

- [x] 10. `kanon attribute` NOTICES report
  - [x] 10.1 Add pure `src/attribution-report.ts` (artifact list → deterministic string, grouped by license, each `Upstream_Work` with `work`/`authors`/`url`/`relationship`).
  - [x] 10.2 Register the `kanon attribute` command in `src/cli.ts`.
  - Verify: determinism test (byte-identical for identical input) + grouping test; `bun test`.
  - _Requirements: 8_

- [x] 11. One-shot backfill command
  - [x] 11.1 Add `src/attribution-backfill.ts`: per artifact, skip if `attribution` present, else derive from `author`/`license`/`provenance` (`relationship: verbatim`), write the draft, leave `author` untouched; emit a "clean vs needs-manual-review" split (adaptation markers in `author`).
  - [x] 11.2 Scan each artifact BODY for an existing source banner (`> **Source and adaptation:**` or similar) and parse out the repo URL + `@<commit>` it names. When found, (a) fold that repo/commit into the derived `Upstream_Work` (`source-repo`, `source-commit`, `url`), and (b) if the banner names a distinct original work or author beyond the packaging repo, emit a SECOND `Upstream_Work` entry and route the artifact to manual review.
  - [x] 11.3 Register a CLI subcommand (`kanon attribute backfill [--dry-run]`) to run it. Enumerates artifacts via `generateCatalog` so BOTH flat and namespaced layouts are scanned (a plain readdir missed the nested kiro-official/byron-powers artifacts). Live dry-run reproduces the design's 39 clean / 3 manual / 24 in-house split.
  - Verify: idempotence test (no overwrite), `author` untouched, correct split; a body-banner fixture yields the parsed repo/commit and, for a two-work banner, two `upstream[]` entries + manual routing; dry-run against the real corpus reports the ~15 credited artifacts (3 manual: `factory-harness`, `karpathy-mode`, `writing-clearly-and-concisely`); `bun test`.
  - _Requirements: 9_

- [x] 12. Backfill the corpus and fold in prose banners
  - [x] 12.1 Run the backfill over `knowledge/`; hand-set `relationship` for the flagged artifacts (`karpathy-mode` → `packaged`, `factory-harness` → `adapted`, `writing-clearly-and-concisely` → Strunk `verbatim` + obra `packaged`, two upstreams).
  - [x] 12.2 Replace the hand-written `> **Source and adaptation:**` body banner in `review-ai-research-output` (and trimmed the attribution prose from `writing-clearly-and-concisely`'s banner, keeping the workflows/token guidance) with the structured block (the renderer now surfaces it).
  - Verify: `bun run dev validate` clean (66/66, no un-credited-import warnings remain); `bun run dev catalog generate` (66 entries, two-upstream projects); `bun test` (3715 pass). Changes are UNCOMMITTED on jhu-main for review.
  - _Requirements: 7, 9_

- [ ] 13. Docs, ADR status, changelog
  - [ ] 13.1 Flip ADR-0064 status to Accepted and add its row to `docs/adr/README.md`.
  - [ ] 13.2 Add a changelog fragment: `bun run changelog:new --type added --message "Structured upstream attribution captured by an import wizard"`.
  - [ ] 13.3 Document the `attribution` block and the wizard in the relevant metadata/help docs.
  - Verify: `bun run lint`; `bun x tsc --noEmit`; full `bun test` green.
  - _Requirements: 1–9_

## Non-Requirements (out of scope)

- No change to `author` semantics or removal of the field.
- No merge of `provenance` and `attribution` into one block.
- No new license vocabulary beyond SPDX identifiers already used by `license`.
- No enforcement (errors) — attribution gaps are warnings only.
- No retroactive relationship *inference* beyond the coarse `author`-prose
  markers used to flag artifacts for manual review.
