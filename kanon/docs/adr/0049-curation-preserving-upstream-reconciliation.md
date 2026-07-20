# ADR-0049: Curation-preserving upstream reconciliation

**Date:** 2026-07-19
**Status:** Proposed
**Deciders:** kanon maintainers
**Relates to:** [ADR-0048](./0048-config-driven-upstream-marketplace-sync.md), [ADR-0019](./0019-forge-import-auto-detecting-kiro-format-importer.md), Rosetta Stone spec (`.kiro/specs/rosetta-stone/`)

## Context and Problem Statement

ADR-0048 gave us config-driven acquisition: any number of upstream marketplaces
can be declared in `kanon.config.yaml` and pulled + imported through one script.
That solved the *first* import. It did not solve the *second* one.

Imported artifacts do not stay as-imported. They are **distilled**: a maintainer
edits frontmatter (assigns `categories`, sets `trust: partner` vs `community`,
tunes `keywords`, adds `collections`, sometimes rewrites the body). The
`knowledge/kiro-official/` tree is the product of that curation, not a verbatim
copy of `upstream/kiro-powers/`.

The current import pipeline has exactly one behavior when an artifact already
exists: it **skips** it (`import.ts` returns `already exists — use --force to
overwrite`). So today the maintainer faces a false choice on every re-sync:

- **Skip** — upstream improvements (new steering files, corrected instructions,
  new MCP servers) never reach the distilled artifact. It silently rots.
- **`--force` overwrite** — every hand-curated field is destroyed and must be
  re-applied by hand.

Neither is maintainable. The evidence that this is already painful is sitting in
`scripts/`: four separate drift-comparison scripts
(`compare-kiro-powers.sh`, `compare-kiro-powers-full.sh`, `diff-kiro-body.sh`,
`diff-kiro-steering.sh`) exist solely to let a human eyeball what changed
upstream versus the distilled copy. They are unmaintainable in three concrete
ways:

1. **Hardcoded artifact mapping.** Each script embeds a 25-entry
   `distilled:upstream` name map. When `figma` was distilled it was never added
   to the map — so `figma` drift is invisible today. There are 34 distilled
   `kiro-official` artifacts against 32 upstream power directories; the maps are
   already out of sync with reality.
2. **Hardcoded, contradictory absolute paths.** One script defaults
   `UPSTREAM_ROOT` to `$HOME/jhu.edu/kiro-powers`, another to
   `/Users/stevenm/v3-x.net/kiro-powers` — neither is the actual vendored
   location (`kanon/upstream/kiro-powers`, established by ADR-0048).
3. **kiro-powers only.** There is no equivalent for `superpowers` (configured in
   `upstreams` but not yet vendored) or any future source. Every new marketplace
   would need its own bespoke quartet of drift scripts.

The Rosetta Stone spec (`.kiro/specs/rosetta-stone/`) rigorously fixes the
*translation* half of this: it defines a pure, deterministic Source_Format →
`KnowledgeArtifact` boundary with structured diagnostics. But Rosetta Stone
deliberately keeps "destination collision policy" in the orchestration shell,
and the only policies its design names are `error | skip | replace`
(`design.md`, PlanApplier). None of those three preserves curation. Rosetta
Stone makes translation trustworthy; it does not make *re-translation* safe.

We need a mechanism that, on every re-sync, automatically carries upstream
improvements into a curated artifact **without** clobbering the curation, and
escalates to a human only for the genuine conflicts.

## Decision Drivers

- Re-sync must be the common, low-toil path — not a manual merge every time.
- Human curation is the higher-value layer and must never be silently lost.
- Must generalize to N sources (kiro-powers, superpowers, archon, …), not just
  kiro-powers.
- Must sit *on top of* Rosetta Stone's pure translation boundary, not violate
  it. Reconciliation is orchestration; it reads and writes files, so it lives in
  the shell.
- Drift must be *detected* mechanically and *attributed* precisely (which field,
  which side changed), replacing the eyeball scripts.

## Considered Options

1. **Keep skip/force + drift scripts.** Status quo. Rejected: the scripts are
   already stale and don't scale past one source.
2. **Layered overwrite (regenerate + re-apply a curation overlay).** Store the
   raw upstream import in a hidden layer, keep maintainer edits as a separate
   overlay file, and regenerate the distilled artifact = upstream ⊕ overlay on
   every sync. Overwrite is always safe because curation lives outside the
   generated file.
3. **Three-way merge with provenance (chosen).** Record, per artifact, the
   upstream content it was distilled *from* (a "base" snapshot). On re-sync,
   compute a field-level three-way merge between `base` (last import), `ours`
   (current distilled), and `theirs` (new upstream). Auto-apply the safe cases;
   emit a structured conflict report for the rest.

## Decision Outcome

**Chosen: Option 3 — three-way merge with recorded provenance.**

Option 2 (overlay) is clean in theory but forces maintainers to express curation
as a diff/overlay rather than by directly editing `knowledge.md` — which breaks
the existing, well-liked authoring workflow and every tool that reads
`knowledge.md` as the source of truth. Option 3 preserves direct editing: the
maintainer keeps editing the distilled artifact normally, and the system infers
what they changed by comparing against the recorded base.

The design has three parts.

### 1. Provenance metadata (the "base" pointer)

Add an optional, machine-managed `provenance` block to artifact frontmatter,
written by the importer and never edited by hand:

```yaml
provenance:
  upstream: kiro-powers            # matches a key in config `upstreams`
  sourcePath: aws-observability    # dir within the upstream repo
  sourceFormat: kiro-power
  sourceCommit: 9f3c1e2            # subtree commit the import was taken from
  baseDigest: sha256:ab12…         # digest of the *normalized upstream* at import
  importedAt: 2026-07-19
  contract: kiro-power@1           # Rosetta Stone Format_Contract + version
```

`baseDigest` is the crucial field: it is the fingerprint of "what upstream looked
like the last time we distilled this artifact." It is what makes a true
three-way merge possible instead of a lossy two-way diff. Because Rosetta Stone's
inbound translation is deterministic and order-independent (spec Property 9), the
same upstream always produces the same base, so the digest is stable and
reproducible.

`provenance` is added to `FrontmatterSchema` (with `.passthrough()` it already
round-trips, but it also gets an explicit optional schema) and to
`KNOWN_FRONTMATTER_FIELDS` in `parser.ts`. Artifacts authored from scratch simply
omit it and are never reconciled.

### 2. Field-level three-way reconciliation

`kanon sync` (or the existing `sync-upstream.sh` in the interim) gains a
reconcile step that runs after acquisition and Rosetta Stone translation, for
every artifact whose `provenance.baseDigest` no longer matches the freshly
translated upstream. For each artifact it computes three canonical values:

- **base** — the upstream re-translated at `provenance.sourceCommit` (or, when
  the old commit is unavailable, reconstructed from `baseDigest` cache; see
  Consequences).
- **ours** — the current distilled `KnowledgeArtifact`.
- **theirs** — the upstream translated at the new commit.

Reconciliation is per-field, because different fields have different ownership:

| Field class | Examples | Merge rule |
|---|---|---|
| **Curation-owned** | `categories`, `trust`, `collections`, `audience`, `priority`, `visibility`, `hooks` | Always keep **ours**. Never overwritten from upstream. |
| **Upstream-owned** | body, `workflows/`, `mcp-servers` (when maintainer hasn't touched them) | Fast-forward to **theirs** when `base == ours` (maintainer never edited); three-way conflict when both changed. |
| **Merge-by-union** | `keywords`, `enhances`, `depends` | Union of ours + theirs additions, minus base deletions. |
| **Machine-owned** | `provenance`, `version` | Recomputed by the tool. |

The field ownership table is declared in config (see §3 of the design doc) so it
is data, not code — a new upstream can tune which fields it curates. When
`base == ours` for an upstream-owned field, the change is applied automatically
(the low-toil common case). Only when *both* base→ours and base→theirs diverge on
the same upstream-owned field is a conflict raised.

### 3. Structured drift + conflict report (retires the shell scripts)

The reconcile step emits one deterministic, machine-readable report per sync
covering **every** provenance-bearing artifact (no hardcoded map, no missing
`figma`):

- `clean` — base == theirs, nothing to do.
- `fast-forward` — upstream changed, maintainer didn't; applied automatically.
- `merged` — both changed different fields; merged automatically.
- `conflict` — both changed the same field; needs human review, with a
  field-addressed diff.
- `orphaned` — distilled artifact whose upstream `sourcePath` no longer exists
  (this is exactly `figma`'s situation, and today nothing flags it).
- `new` — upstream artifact with no distilled counterpart yet.

This report subsumes all four `compare-*.sh` / `diff-*.sh` scripts, which are
deleted. The mapping is derived from `provenance`, so it can never drift from
reality the way the hardcoded lists have.

### Boundary alignment with Rosetta Stone

Reconciliation is **orchestration**, not translation. It runs entirely in the
Sync_Orchestrator / Translation_Orchestrator shell (Rosetta Stone Requirement 11
and 1.3): it reads files, computes merges, and writes results. It calls Rosetta
Stone purely to turn upstream Source_Documents into canonical
`KnowledgeArtifact`s and to re-serialize the merged result. The three-way merge
operates on two canonical `KnowledgeArtifact` values plus a base, so it inherits
Rosetta Stone's determinism and diagnostics for free. No Git, digesting, or file
IO crosses the Pure_Translation_Boundary.

Concretely, this adds one collision policy — `reconcile` — to the PlanApplier's
existing `error | skip | replace`, implemented in the orchestrator, plus the
provenance schema and the field-ownership config.

## Consequences

### Positive

- Re-sync becomes the low-toil default: upstream fixes flow in automatically for
  every field the maintainer hasn't personally touched; curation is preserved by
  construction.
- Drift detection is complete and self-maintaining — driven by `provenance`, so
  a newly distilled artifact (like `figma`) is covered the moment it exists,
  and orphaned artifacts are surfaced instead of rotting silently.
- Generalizes to every upstream in `upstreams` with zero per-source scripting;
  `superpowers` and future sources get reconciliation for free.
- Four brittle shell scripts with stale hardcoded paths and maps are deleted.
- Conflicts are field-addressed and machine-readable, so an agent (or a human)
  can resolve them surgically instead of diffing whole files.

### Negative / Trade-offs

- Requires a one-time **backfill**: existing distilled artifacts have no
  `provenance`. Until backfilled they fall back to skip-or-force. Backfill is a
  one-shot command that matches distilled artifacts to current upstream by name
  and records the current `baseDigest` (accepting that any pre-existing drift is
  "baked into" the base — acceptable, since we have no better base for legacy
  artifacts).
- Reconstructing **base** ideally needs the historical upstream commit. Because
  we vendor via `git subtree --squash` (ADR-0048), old upstream trees are in
  history but awkward to check out. Mitigation: cache the normalized base
  artifact content (not just its digest) under a git-ignored
  `upstream/.kanon-base/` keyed by `baseDigest`, written at import time. When the
  cache is missing we degrade gracefully to a two-way merge (ours vs theirs) and
  mark those results `merged (no-base)` in the report so the maintainer knows the
  confidence is lower.
- Adds a machine-managed frontmatter block that authors must leave alone;
  `kanon validate` should warn if `provenance` is hand-edited (digest won't
  verify).
- Field-ownership classification is a policy that can be wrong for a given
  upstream; making it config-driven mitigates this but adds a config surface.

### Neutral

- `sync-kiro-powers.sh` (already superseded by `sync-upstream.sh` per ADR-0048)
  and the `compare/diff` scripts are removed together in this change.
- This ADR does not itself implement `kanon sync` as a TypeScript command
  (ADR-0048 deferred that). The reconcile logic is written as a pure module
  usable from either the shell script or a future `kanon sync` command; choosing
  between them is left to the Rosetta Stone migration (spec task group 16).

## Links and References

- Builds on: ADR-0048 (config-driven upstream sync), ADR-0019 (import formats)
- Extends: Rosetta Stone spec — Requirement 11 (sync/acquisition separation),
  Requirement 4 (inbound translation), Property 9 (order-independent, repeatable
  inbound translation)
- Affected code: `src/schemas.ts` (`FrontmatterSchema.provenance`),
  `src/parser.ts` (`KNOWN_FRONTMATTER_FIELDS`), `src/import.ts` (write
  provenance), new `src/reconcile.ts`, `scripts/sync-upstream.sh`
- Deletes: `scripts/compare-kiro-powers.sh`,
  `scripts/compare-kiro-powers-full.sh`, `scripts/diff-kiro-body.sh`,
  `scripts/diff-kiro-steering.sh`, `scripts/sync-kiro-powers.sh`
