# Design: Upstream Attribution

## Overview

This feature adds a structured, curation-owned `attribution` block to the
canonical `KnowledgeArtifact`, captured at import time by an interactive wizard.
It is the human/legal counterpart to the machine-owned `provenance` block from
ADR-0049: `provenance` answers *"where do I re-sync from"* and is overwritten
on every import; `attribution` answers *"who do I credit and under what
license"* and is preserved across every re-sync.

The design sits on the existing seams:

- **Schema** — `src/schemas.ts` is the single source of truth (ADR-0002); the new
  `AttributionRecordSchema` and its wiring into `FrontmatterSchema`,
  `ReconcilableFieldSchema`, `DEFAULT_FIELD_OWNERSHIP_POLICY`, and
  `CatalogEntrySchema` all live there.
- **Parser** — `src/parser.ts` gains `attribution` in `KNOWN_FRONTMATTER_FIELDS`
  (the `.passthrough()` on `FrontmatterSchema` already round-trips it; the list
  suppresses the unknown-field warning).
- **Wizard** — a new `attribution` step reuses the `@clack/prompts` patterns
  already in `src/wizard.ts` (used by `kanon new`), invoked from the import path.
- **Reconciliation** — `attribution` joins the ADR-0049 `Field_Ownership_Policy`
  as `curation-owned`; no new merge machinery is needed.
- **Catalog / adapters / validate** — projection, rendering, and warnings hang
  off the existing `catalog.ts`, `adapters/*`, and `validate.ts`.

Satisfies Requirements 1–9.

## Data Model

### AttributionRecordSchema (Requirement 1, 2)

Defined in `src/schemas.ts`, following the file's existing Zod-4 conventions.
`author` is unchanged; `attribution` is added as an optional field on
`FrontmatterSchema` (which is `.passthrough()`).

```ts
export const RelationshipSchema = z.enum([
  "verbatim",     // vendored unchanged; body is upstream's
  "adapted",      // materially edited from upstream
  "inspired-by",  // original expression, upstream idea only
  "packaged",     // repackaged/reformatted, authorship unchanged
]);
export type Relationship = z.infer<typeof RelationshipSchema>;

export const UpstreamWorkSchema = z.object({
  work: z.string().min(1),
  authors: z.array(z.string().min(1)).min(1),
  url: z.string().url().optional(),
  license: z.string().optional(),          // SPDX; reuses frontmatter `license` conventions
  "source-repo": z.string().min(1).optional(),
  "source-commit": z.string().min(1).optional(),
  relationship: RelationshipSchema.default("verbatim"),
});
export type UpstreamWork = z.infer<typeof UpstreamWorkSchema>;

export const AttributionRecordSchema = z.object({
  upstream: z.array(UpstreamWorkSchema).min(1),
  "curated-by": z.string().min(1).optional(),
  notice: z.string().optional(),
});
export type AttributionRecord = z.infer<typeof AttributionRecordSchema>;
```

Wired into `FrontmatterSchema` exactly as `provenance` is (lazy reference to
keep declaration order clean is unnecessary here since the schema is defined
before `FrontmatterSchema`; place `AttributionRecordSchema` above it):

```ts
// inside FrontmatterSchema object:
attribution: AttributionRecordSchema.optional(),
```

`author` stays as `z.string().default("")` — no change (Requirement 2).

### Relationship to `provenance`

The two blocks are deliberately separate (ADR-0064 Option 2 rejected):

| | `provenance` | `attribution` |
|---|---|---|
| Audience | machine (re-sync) | people / licenses |
| Ownership | `machine-owned` | `curation-owned` |
| Lifecycle | overwritten every import | preserved across re-sync |
| Author | importer | wizard (confirmed by curator) |

They may both name the same upstream repo/commit; that overlap is intentional
and not deduplicated.

## Import-time Attribution_Wizard (Requirement 3, 4)

### Placement

Import today is non-interactive (the ADR-0048 `sync-upstream.sh` batch path).
The wizard adds the first interactive step to the single-artifact import flow in
`src/import.ts`, reusing the prompt helpers from `src/wizard.ts`. It runs after
translation produces the candidate `KnowledgeArtifact` and before the artifact
is written to disk.

### Field derivation

The wizard is derive-first: every field it can compute is pre-filled, and only
`relationship` is a required interaction.

| Field | Source | Interaction |
|---|---|---|
| `source-repo`, `source-commit` | acquisition (same data as `provenance.sourceRepo`/`sourceRevision`) | pre-filled, confirm |
| `work`, `authors` | upstream artifact's `author` / `name` frontmatter | pre-filled, confirm/edit |
| `license` | upstream artifact's `license` frontmatter | pre-filled, confirm |
| `url` | upstream repo + source path | pre-filled, confirm |
| `curated-by` | `kanon.config.yaml` / git identity | default, confirm |
| `relationship` | **not derivable** | **required select**, default `verbatim` |

### Interface (pure core, thin prompt shell)

To keep the derivation testable without live prompting (Requirement:
non-functional testing), split derivation (pure) from prompting (shell):

```ts
// pure — unit-tested with fixtures
export function deriveAttributionDraft(input: {
  upstreamFrontmatter: Record<string, unknown>;
  sourceRepo?: string;
  sourceCommit?: string;
  sourcePath: string;
  curatedBy?: string;
}): AttributionRecord;   // relationship defaults to "verbatim"

// shell — @clack/prompts, confirms the draft and elicits relationship
export async function runAttributionWizard(
  draft: AttributionRecord,
  opts: { mode: "interactive" | "defaults" | "skip" },
): Promise<AttributionRecord | undefined>;  // undefined when skipped
```

### Non-interactive modes

- `--attribution-defaults` → `mode: "defaults"`: return `deriveAttributionDraft`
  output unchanged (relationship `verbatim`), no prompt.
- `--no-attribution` → `mode: "skip"`: return `undefined`; no block written.
- Non-TTY with no flag → behave as `defaults` and push a warning through the
  existing import warnings channel (Requirement 4).
- `scripts/sync-upstream.sh` passes `--attribution-defaults` so bulk re-imports
  stay hands-off.

### First-import-only

Before running, the flow checks whether the existing on-disk artifact (if any)
already carries an `attribution` block; if so it skips the wizard entirely — the
block is curation-owned and re-sync must not touch it (Requirement 3, 5).

## Reconciliation (Requirement 5)

Two edits to the ADR-0049 policy in `src/schemas.ts`:

```ts
// add to ReconcilableFieldSchema enum:
"attribution",

// add to DEFAULT_FIELD_OWNERSHIP_POLICY:
attribution: "curation-owned",
```

Because `curation-owned` fields "always keep ours; never overwritten from
upstream" (the existing rule for `trust`, `collections`, `hooks`), no new merge
code is required — the reconciliation engine already implements the class. A
test asserts that a diverged upstream `attribution` never fast-forwards.

## Validation (Requirement 6)

Two advisory rules in `src/validate.ts`, both **warnings** (ADR-0008 convention):

1. **Un-credited import** — `provenance` present AND `attribution?.upstream`
   absent/empty → warn, naming the artifact.
2. **Under-credited attribution-required license** — any
   `attribution.upstream[].license` matching an attribution-required set
   (`/^CC-BY/`, `MPL-2.0`, …, held in a small constant) with no `authors` on that
   entry and no block-level `notice` → warn.

Neither fails the build.

## Catalog projection & rendering (Requirement 7)

- **`CatalogEntrySchema`** gains an optional projected `attribution` (the same
  shape, or a trimmed `{ upstream: {work, authors, url, license, relationship}[],
  curatedBy? }`). `catalog.ts` copies it during generation.
- **Browse UI / MCP bridge** render a "Sources & credits" section from the
  projected field in the DETAIL view, replacing the hand-written body banner in
  `review-ai-research-output` and any future ones.
- **Gallery card chip (chosen: Option A).** In `renderCards`
  (`src/browse-ui.ts`, ~line 1001), when `entry.attribution?.upstream` is
  present, render a relationship chip inside the existing `card-footer`
  `.card-badges` row, beside the trust/maturity badges. Reuse the `.badge`
  class with a new `.badge-attribution` modifier (indigo: `#eef2ff` / `#3730a3`,
  matching the mockup). Text: `↳ <work> · <relationship>` for a single
  `Upstream_Work`, `↳ N sources` for ≥2. Absent when `attribution` is absent, so
  in-house cards are unchanged. This is a small, additive edit to the existing
  card assembly and the CSS block; the chip is derived data (pure), no new IO.
- **Adapters** (`src/adapters/*` + `templates/harness-adapters/*`) emit a uniform
  attribution footer so credit travels into compiled harness output. Adapters are
  pure functions (ADR-0003) — the footer is rendered from the artifact + Nunjucks
  template, no IO.
- `catalog.json` is regenerated (standing rule).

## `kanon attribute` NOTICES report (Requirement 8)

A new CLI command (`src/cli.ts` registration + a pure `src/attribution-report.ts`
module) that:

1. Loads all artifacts (reusing the catalog scan).
2. Collects every `AttributionRecord`.
3. Emits a deterministic report grouped by license, each `Upstream_Work` listed
   with `work`, `authors`, `url`, `relationship`.

The report generator is pure (input: artifact list → output: string), so it is
unit-tested and byte-deterministic, mirroring the ADR-0049 reconciliation report.

## Backfill (Requirement 9)

A one-shot command (`src/attribution-backfill.ts`, invoked via a CLI subcommand
or a `scripts/` entry) that, per existing artifact:

- Skips if `attribution` already present.
- Else, if the artifact has an upstream-looking `author`/`license` (or a
  `provenance` record), calls `deriveAttributionDraft` from that metadata with
  `relationship: verbatim`, and writes a draft block.
- **Scans the artifact body** for a source banner (`> **Source and adaptation:**`
  or similar) and parses the repo URL + `@<commit>` it names. A found banner (a)
  enriches the derived `Upstream_Work` with `source-repo` / `source-commit` /
  `url`, and (b) when it names a distinct original work/author beyond the
  packaging repo, adds a SECOND `Upstream_Work` entry and routes the artifact to
  manual review. This is required because author-string matching alone misses
  multi-upstream cases — e.g. `writing-clearly-and-concisely` credits `obra` in
  frontmatter but its banner reveals two works: obra's repo (`packaged`) and
  William Strunk Jr.'s public-domain 1918 text (`verbatim`).
- Leaves `author` untouched.
- Emits a report splitting artifacts into "backfilled clean" vs "needs manual
  relationship review" (author-prose adaptation markers *or* a multi-work body
  banner).

The dry-run against the real corpus classifies 66 artifacts as **24 skip
(in-house), 39 clean (verbatim), 3 manual review** (`factory-harness`,
`karpathy-mode`, `writing-clearly-and-concisely`). No artifact currently carries
`provenance`, so `source-repo`/`source-commit` are derivable only from a body
banner until a re-sync writes provenance.

## Error Handling

- Schema failures on `attribution` surface as normal Zod `ValidationError`s with
  a field path (`attribution.upstream[0].authors`).
- Wizard cancellation (Ctrl-C) aborts the import without writing a partial
  artifact; a hand-edited invalid `attribution` block fails `kanon validate` with
  a precise path.
- Missing derivation inputs (upstream has no `author`) leave `work`/`authors`
  empty in the draft; the wizard then requires the curator to supply them
  (interactive) or the defaults mode writes the block with a warning that
  `authors` is empty and the un-credited-import validator catches it.

## Testing Strategy

- **Schema** — valid/invalid `AttributionRecord` fixtures; `relationship`
  defaulting; `author`-only artifact still valid (Req 1, 2).
- **Derivation** — `deriveAttributionDraft` unit tests over upstream-frontmatter
  fixtures (Req 3), no live prompts.
- **Non-interactive modes** — `defaults` / `skip` / non-TTY behaviors (Req 4).
- **Reconciliation** — `attribution` classified `curation-owned`; a diverged
  upstream never overwrites ours (Req 5).
- **Validation** — un-credited-import and under-credited-license warnings fire;
  build does not fail (Req 6).
- **Catalog/adapters** — projection present; a golden adapter output includes the
  attribution footer (Req 7).
- **NOTICES report** — determinism (byte-identical for identical input) and
  grouping (Req 8).
- **Backfill** — idempotence (no overwrite), `author` untouched, correct
  clean-vs-manual split (Req 9).

Use `makeFrontmatter()` / `makeArtifact()` from `src/__tests__/test-helpers.ts`
for all fixtures (standing rule — `Frontmatter` has ~20 required fields).

## Key Decisions (ADR-0064)

- **Separate `attribution` block, not `provenance` extension** — opposite
  ownership/lifecycle; merging them re-introduces the re-sync data-loss bug.
- **Wizard is the capture point, not hand-authoring** — a block with no capture
  point just relocates today's ad-hoc `author` prose into YAML.
- **`author` retained** — additive change; zero existing-artifact breakage.
- **`curation-owned` in reconciliation** — reuses the existing merge class; no new
  engine code.
