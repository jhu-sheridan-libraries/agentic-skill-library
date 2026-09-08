# ADR-0064: Structured upstream attribution

**Date:** 2026-09-08
**Status:** Accepted
**Deciders:** kanon maintainers
**Relates to:** [ADR-0048](./0048-config-driven-upstream-marketplace-sync.md), [ADR-0049](./0049-curation-preserving-upstream-reconciliation.md), [ADR-0015](./0015-knowledge-bazaar-shared-manifest-phase-1.md)

## Context and Problem Statement

context-bazaar is a curated library of both in-house artifacts and imports
distilled from external upstreams. ADR-0048 gave us config-driven acquisition;
ADR-0049 gave us `provenance` — a machine-managed frontmatter block
(`upstream`, `sourcePath`, `sourceRevision`, `baseDigest`, `importedAt`,
`contract`) plus a three-way reconciliation engine. Between them they answer one
question well: **"where do I re-sync this artifact from, and how do I merge the
next upstream change without clobbering curation?"**

They do not answer the *other* question a curated library owes its sources:
**"who authored the work this artifact derives from, under what license, and how
do we credit them?"** That is a license- and credit-facing concern, distinct from
the build-time lineage `provenance` records. The two overlap (both point at an
upstream) but serve different masters: `provenance` exists for the machine and is
overwritten on every re-sync; attribution exists for credit/licensing and must
*survive* re-sync.

Most attribution facts are already knowable **at import time**, from the same
sources the importer uses to write `provenance`: the upstream key, repo, and
revision are in hand, and the upstream's own frontmatter usually carries an
`author` and a `license`. The gap is that nothing captures them into a durable,
structured shape — and there is no import-time prompt to confirm or enrich the
one genuinely human judgment (the *relationship*: verbatim vs. adapted). So the
design's center of gravity is **capture at import**, not hand-authoring after the
fact.

Today attribution is entirely ad-hoc, smeared across the free-text `author:`
string in at least four mutually incompatible conventions, plus hand-written
prose banners in artifact bodies. Concrete evidence from the current corpus:

| Pattern | Real example in `knowledge/` |
|---|---|
| Bare upstream org | `author: AWS`, `author: HashiCorp`, `author: Figma` |
| Prose dual-credit | `author: robin (revfactory), adapted for Kanon by Steven J. Miklovic` |
| Parenthetical packager | `author: Andrej Karpathy (packaged by Forrest Chang)` |
| Hand-written body banner | `review-ai-research-output`: `> **Source and adaptation:** Imported from [repo](url) at commit d3743bc…` |

This is unmaintainable in four concrete ways:

1. **Not machine-readable.** The distinction between "AWS wrote this" and "we
   adapted AWS's work" lives in prose punctuation. Nothing can query, count, or
   verify it.
2. **Not renderable consistently.** The browse UI and every harness adapter can
   only surface the flat `author` string; the license and original URL are
   invisible or buried in the body.
3. **No license-compliance path.** Several imports carry attribution-required
   licenses (`review-ai-research-output` is `MPL-2.0`; CC-BY sources exist). We
   have no way to generate a NOTICES file or verify that an attribution-required
   import actually carries its credit.
4. **Attribution is not protected from re-sync.** Because it is folded into
   `author` and the body — neither of which is classified in ADR-0049's
   `Field_Ownership_Policy` for `author`, and body being *upstream-owned* — a
   re-sync can fast-forward over a hand-written credit banner and lose it.

We need attribution to be a first-class, structured, curation-owned field —
the human/legal counterpart to ADR-0049's machine `provenance`.

## Decision Drivers

- Attribution must be **structured and machine-readable** — queryable, countable,
  renderable, and lintable — not prose.
- It must be **captured at import time by an interactive wizard**, not left to
  after-the-fact hand-editing. The wizard pre-fills every field it can derive
  (upstream repo/commit from acquisition; `author`/`license` from the upstream's
  own frontmatter) and asks the curator only to confirm and to set the one field
  that requires judgment — the `relationship`. Attribution kept as a
  hand-authored block *without* a capture wizard is a non-goal: it would just
  reproduce today's ad-hoc `author` prose in a new shape.
- Once captured, it must be **curation-owned**: it survives every upstream
  re-sync untouched, unlike `provenance`.
- It must **coexist with, not replace, `author`**. `author` stays as the
  one-line display string; nothing that reads it breaks. Backward compatibility
  is non-negotiable — 66 artifacts carry `author` today.
- It must capture the **copyright-relevant relationship** the corpus already
  expresses in prose: verbatim vendoring vs. adaptation vs. inspiration vs. mere
  packaging. This is the wizard's single required human input.
- It must support **multiple upstreams** per artifact (an artifact can distill
  two sources).
- It must feed **license compliance** — a generated NOTICES / attribution report.

## Considered Options

1. **Keep `author` free-text; formalize by convention only.** Document a
   canonical string grammar (`Upstream (adapted by Curator)`) and lint it.
   Rejected: still prose, still unparseable in the general case, still can't hold
   a license or URL, still lost on re-sync, and still relies on a human
   remembering to type it correctly with no capture point.
2. **Overload `provenance` to carry human credit too.** Add `authors`, `license`,
   `url` to the existing `provenance` block. Rejected: `provenance` is
   machine-owned and *overwritten on every import* (ADR-0049 classifies it
   `machine-owned`). Credit written there would be destroyed on the next
   sync — exactly the failure we are trying to fix. The two have opposite
   ownership and lifecycles and must stay separate.
3. **Structured `attribution` block with no capture point** — a curation-owned
   frontmatter block that maintainers fill in by hand whenever they remember.
   Rejected per the steer: without an import-time prompt this is just today's
   ad-hoc `author` prose relocated into YAML; capture would lag imports and drift.
4. **Structured `attribution` block captured by an import wizard (chosen).** The
   same structured, curation-owned block as option 3, but populated at import
   time by an interactive prompt that derives every field it can and asks only
   for the `relationship` judgment. This is what makes the block worth having.

## Decision Outcome

**Chosen: Option 4 — a structured, curation-owned `attribution` block captured
by an import wizard.**

The block is only as valuable as its capture point, so the wizard (part 3) is
the load-bearing half of this decision, not an add-on.

The design has four parts.

### 1. The `attribution` frontmatter block

An optional `attribution` block added to `FrontmatterSchema`, populated by the
import wizard (part 3). `author` is retained unchanged as the display string;
`attribution` is its structured expansion.

```yaml
author: "Andrej Karpathy (packaged by Forrest Chang)"   # unchanged, display-only
attribution:
  upstream:                                 # one or more upstream works
    - work: "karpathy-mode"
      authors: ["Andrej Karpathy"]
      url: "https://github.com/…"
      license: "MIT"
      source-repo: "obra/superpowers"       # optional; forge coordinates
      source-commit: "d3743bc"              # optional; ties to provenance.sourceRevision
      relationship: packaged                # verbatim | adapted | inspired-by | packaged
  curated-by: "Steven J. Miklovic, Johns Hopkins DRCC"   # optional
  notice: "Retains upstream MIT attribution."            # optional free-text
```

Field semantics:

- **`upstream[]`** — one entry per distinct upstream work. `work` and `authors`
  are required per entry; `url`, `license`, `source-repo`, `source-commit` are
  optional.
- **`relationship`** — a closed enum capturing the copyright-relevant
  distinction the corpus already draws in prose:
  - `verbatim` — vendored unchanged (body is upstream's).
  - `adapted` — materially edited from upstream (`robin … adapted for Kanon by`).
  - `inspired-by` — original expression, upstream idea only.
  - `packaged` — repackaged/reformatted, authorship unchanged (`packaged by`).
- **`license`** — SPDX identifier where possible, reusing the existing
  frontmatter `license` field's conventions; per-upstream because a
  multi-source artifact can mix licenses.
- **`curated-by`** — the in-house distiller, distinct from upstream `authors`.
  Resolves the recurring "X, adapted by Y" collision cleanly. The wizard defaults
  it from `kanon.config.yaml` / git identity, so it is confirmed, not typed.
- **`notice`** — free-text for license-required notices that don't fit the
  structured fields.

The block is added to `FrontmatterSchema` (with a dedicated
`AttributionRecordSchema`) and to `KNOWN_FRONTMATTER_FIELDS` in `parser.ts`.
Artifacts with no upstream simply omit it.

### 2. Curation-owned in reconciliation

`attribution` is added to ADR-0049's `ReconcilableFieldSchema` and classified
**`curation-owned`** in `DEFAULT_FIELD_OWNERSHIP_POLICY`, alongside `trust`,
`collections`, and `hooks`. This is the load-bearing decision: it guarantees an
upstream re-sync **never** overwrites hand-authored credit, closing the
"fast-forward loses the credit banner" hole. `provenance` remains
`machine-owned`; the two blocks now have explicit, opposite ownership.

### 3. Import-time attribution wizard (the capture point)

Attribution is captured **when the artifact is imported**, by an interactive
prompt modeled on the existing `kanon new` wizard (`src/wizard.ts`, `@clack/prompts`).
Import today is non-interactive (the `sync-upstream.sh` batch path from
ADR-0048), so this adds the first interactive step to that flow — the reason the
block is worth having rather than another field that rots.

The wizard **derives everything it can** and asks the curator only to confirm or
supply the rest:

| Field | How the wizard fills it | Prompt? |
|---|---|---|
| `source-repo`, `source-commit` | from acquisition (same source as `provenance.sourceRepo`/`sourceRevision`) | pre-filled, confirm |
| `work`, `authors` | from the upstream artifact's own `author`/`name` frontmatter | pre-filled, confirm/correct |
| `license` | from the upstream's `license` frontmatter (SPDX) | pre-filled, confirm |
| `url` | from the upstream repo + source path | pre-filled, confirm |
| `curated-by` | from `kanon.config.yaml` / git identity | default, confirm |
| **`relationship`** | **cannot be derived — the one genuine judgment** | **required select** (`verbatim` / `adapted` / `inspired-by` / `packaged`, default `verbatim`) |

Two non-interactive modes keep the batch path working:

- `--attribution-defaults` (or a config flag): accept all derived values and
  `relationship: verbatim` without prompting, for bulk re-imports where verbatim
  vendoring is the norm. Produces a complete block with zero interaction.
- `--no-attribution`: skip the block entirely (e.g. an in-house artifact routed
  through import), leaving `attribution` absent.

Because attribution is curation-owned (part 2), the wizard runs on **first
import only**; subsequent re-syncs never re-prompt and never overwrite the
captured block.

### 4. Validation, catalog projection, and rendering

- **Validation (`validate.ts`).** A new rule *warns* when an artifact has a
  `provenance` record (i.e. it was imported) **and** a `trust` of
  `community`/`partner`/`official`-with-upstream, **but** no
  `attribution.upstream`. This catches un-credited imports mechanically. A
  second rule warns when a `license` in the attribution list is
  attribution-required (CC-BY*, MPL-2.0, …) but no `notice` or `authors` is
  present.
- **Catalog (`catalog.ts` / `CatalogEntrySchema`).** Project a subset of
  `attribution` into the catalog so browse and the MCP bridge can render a
  consistent "Sources & credits" panel, replacing the hand-written body banners.
- **Adapters.** Each harness adapter can emit a uniform attribution footer from
  the structured block, so credit travels with the artifact into every compiled
  harness output.
- **`kanon attribution` report.** A deterministic command that walks all
  `attribution`-bearing artifacts and emits a NOTICES-style credit/license
  report for compliance — the attribution analogue of ADR-0049's reconciliation
  report.

## Consequences

### Positive

- Attribution becomes structured, queryable, and lintable; the four incompatible
  `author` conventions and the prose body banners collapse into one machine-
  readable shape.
- Credit is **protected by construction** from upstream re-sync (curation-owned),
  fixing a real data-loss path in the current pipeline.
- License compliance gets a mechanical path: a generated NOTICES report and
  validator warnings for un-credited or under-credited imports.
- Consistent "Sources & credits" rendering across the browse UI and every
  compiled harness, instead of ad-hoc per-artifact prose.
- Auto-fill in the wizard means the common case (verbatim vendor) requires one
  keystroke, and the curator only elaborates when the relationship is richer;
  `--attribution-defaults` makes bulk re-imports fully non-interactive.
- Cleanly resolves the "X, adapted by Y" ambiguity by separating upstream
  `authors` from `curated-by`.

### Negative / Trade-offs

- Adds the **first interactive step to the import path** (today a batch script).
  Mitigated by full derivation + `--attribution-defaults` / `--no-attribution`
  for scripted and bulk runs, but it is a genuine change to the sync flow that
  ADR-0048/0049 built as non-interactive.
- Requires a one-time **corpus backfill**: the ~15 already-imported artifacts
  with upstream credit (all of `kiro-official/`, plus `karpathy-mode`,
  `factory-harness`, `review-ai-research-output`,
  `writing-clearly-and-concisely`, …) predate the wizard and need `attribution`
  blocks generated (a one-shot command deriving from their existing
  `author`/`license` + any `provenance`) and their prose body banners folded in.
- Adds a frontmatter surface and a schema (mitigated by wizard capture and by
  `author` still working alone).
- `relationship` is a curator judgment the wizard elicits but cannot verify — a
  validator can check presence, not correctness.
- Two upstream-pointing blocks (`provenance` for the machine, `attribution` for
  humans) can look redundant; the ADR must document *why* they are separate
  (opposite ownership and lifecycle) so they aren't later merged and re-broken.

### Neutral

- `author` is unchanged and remains the primary display string; `attribution`
  is purely additive. No existing artifact breaks.
- This ADR defines the schema and policy; it does not by itself migrate the
  corpus or implement `kanon attribution` — those are follow-on tasks (a Kiro
  spec is the natural home, mirroring how ADR-0049 fed the Rosetta Stone spec).
- The `license` SPDX conventions reuse the existing frontmatter `license` field;
  no new license vocabulary is introduced.

## Links and References

- Builds on: ADR-0049 (curation-preserving reconciliation — `provenance`,
  `Field_Ownership_Policy`), ADR-0048 (config-driven upstream sync), ADR-0015
  (bazaar manifest governance fields including `author`, `license`, `trust`)
- Affected code: `src/schemas.ts` (`AttributionRecordSchema`,
  `FrontmatterSchema.attribution`, `ReconcilableFieldSchema`,
  `DEFAULT_FIELD_OWNERSHIP_POLICY`, `CatalogEntrySchema`), `src/parser.ts`
  (`KNOWN_FRONTMATTER_FIELDS`), `src/import.ts` + `src/wizard.ts` (import-time
  attribution wizard, `--attribution-defaults` / `--no-attribution`),
  `scripts/sync-upstream.sh` (pass the non-interactive flag), `src/validate.ts`
  (un-credited-import + license warnings), `src/catalog.ts` (projection),
  `src/adapters/*` + templates (attribution footer)
- Follows: one-shot backfill of already-imported credited artifacts; new
  `kanon attribution` NOTICES report
