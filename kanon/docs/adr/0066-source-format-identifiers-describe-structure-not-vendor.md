# ADR-0066: Source format identifiers describe structure, not vendor

## Status

Proposed

## Date

2026-09-08

## Context

Rosetta Stone's source-only format contracts identify some formats by a vendor
qualifier that does not correspond to a real vendor distinction.

The registry (`src/rosetta/builtins/contracts.ts`) currently declares three
source-direction contracts:

| id | `harness` | required marker | companions | lifecycle |
|---|---|---|---|---|
| `kiro-power` | `kiro` | `POWER.md` | `steering/*.md` | active |
| `kiro-skill` | `kiro` | `SKILL.md` | `references/*.md` | active |
| `superpowers` | `null` | `SKILL.md` | `*.md` (companions) | deprecated |

The problem is `kiro-skill`. A `SKILL.md` file plus a `references/` tree is the
[Anthropic Agent Skills](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
convention — the layout Claude Code loads from `~/.claude/skills/<name>/SKILL.md`
and the community `obra/superpowers` marketplace popularized. It is **not** a
Kiro-native artifact. Kiro's own native surfaces are `POWER.md` + `steering/`
(the `kiro-power` format) and the compiled steering files under `.kiro/`. Kiro
merely also *reads* `SKILL.md`; reading a format is not owning it.

So `kiro-skill` asserts, in both its identifier and its `harness: "kiro"` field,
a vendor relationship that reality does not support. The misattribution is baked
into the data model, not just the label: `harness` is a structured field that
downstream consumers (catalog, detection evidence, provenance) can read.

Two further facts make the current state incoherent rather than merely untidy:

1. `superpowers` — which carries the honest `harness: null` because no single
   harness owns the `SKILL.md` convention — is the one marked **deprecated**.
   `kiro-skill`, with the false qualifier, is **active** and is what
   auto-detection selects for a `SKILL.md` source. The format naming reality
   correctly is the one being retired; the misnamed one is promoted.
2. `kiro-skill` and `superpowers` do nearly the same job. Both parse `SKILL.md`.
   They differ only in where companion files are expected (`references/` vs.
   top-level `*.md`) — a structural detail, not a vendor difference.

ADR-0048 already records the underlying reality: skill marketplaces "emerged —
notably obra/superpowers — with different directory conventions," and the import
pipeline must "support heterogeneous formats." The identifiers should reflect
that the `SKILL.md` shape is a cross-vendor structure.

`kiro-power`, by contrast, is correctly named: `POWER.md` + `steering/` genuinely
is Kiro's native power format, so its `harness: "kiro"` is accurate. This ADR
does not change it.

## Decision

**A source format identifier must describe the artifact's observable structure
(its marker file and layout), and may carry a vendor qualifier only when a real
vendor distinction exists.** Reading a format does not constitute ownership.

Concretely:

1. **Introduce a vendor-neutral `skill-md` source format** describing the
   `SKILL.md` + preserved-companions structure, with `harness: null`. The name
   follows the registry's existing marker-file convention for representation
   ids (`claude-md`, `agents-md`, `knowledge-md`), and asserts no vendor.

2. **Collapse `kiro-skill` and `superpowers` into `skill-md`.** The single
   translator reads `SKILL.md` and preserves companion files wherever they sit
   (`references/`, top-level, or nested), rather than encoding one fixed
   companion location per format. (The recursive, all-file source read this
   requires is tracked separately as the "source documents must include the
   whole tree" change; `skill-md` is defined to assume it.)

3. **Keep `kiro-skill` and `superpowers` as deprecated aliases of `skill-md`,**
   using the registry's existing `aliases` field and `lifecycle` machinery
   (`status: "deprecated"`, `replacement: "skill-md"`). Selecting either old id
   resolves to `skill-md` and emits a migration diagnostic. No importer command
   or recorded provenance breaks.

4. **Resolve historical provenance contract ids.** Artifacts imported before
   this change record `provenance.contract: "kiro-skill@1"` or
   `"superpowers@1"`. The contract-id resolver must map both to `skill-md@1` so
   three-way reconciliation and re-sync continue to work. `SOURCE_CONTRACT_IDENTIFIERS`
   in `src/import.ts` emits `skill-md@1` going forward.

5. **`kiro-power` is unchanged.** Its vendor qualifier names a genuine
   Kiro-native format and passes the discriminating test.

The discriminating test for any future format id: *does a specific vendor define
or exclusively own this structure?* If yes (`kiro-power`), the qualifier is
factual and allowed. If the structure is a convention multiple harnesses read
(`skill-md`), the id must be vendor-neutral and `harness` must be `null`.

This ADR is proposal-only. No renames are committed with it; it establishes the
rule and the migration path for review.

## Consequences

### Positive

- Format identifiers and the `harness` field state what is true. `SKILL.md` is
  no longer attributed to Kiro.
- One `skill-md` format replaces two near-duplicate contracts, removing the
  "which SKILL.md format do I pick?" ambiguity and the awkward state where the
  honestly-named format was the deprecated one.
- Establishes a reusable naming rule, so future source formats (e.g. other
  marketplace layouts) are added by structure without re-litigating vendor
  attribution.
- The migration reuses mechanisms that already exist (`aliases`, `lifecycle`,
  selection-alias diagnostics), so the blast radius is contained.

### Negative

- Touches recorded data: existing `provenance.contract` values must be resolved
  through an alias map indefinitely (or until a dedicated migration rewrites
  them). Getting this wrong silently breaks re-sync, so it needs explicit tests.
- Documentation churn: CONTRIBUTING and import examples reference
  `--format kiro-skill` / `superpowers` and must move to `--format skill-md`,
  with the aliases noted as deprecated.
- A short window where three ids (`skill-md`, `kiro-skill`, `superpowers`) all
  resolve to the same behavior may confuse readers until the aliases are removed
  in a future major.

### Neutral

- `kiro-power` keeps its name and `harness: "kiro"`; the change is scoped to the
  `SKILL.md` family.
- Auto-detection behavior is unchanged for users — a `SKILL.md` source still
  resolves automatically; only the selected id's name changes.
- Naming choice `skill-md` over `agent-skill` is deliberate (parallels existing
  marker-file ids) but is the one point most open to revision in review.


## Appendix: Implementation sketch (not committed)

The `FormatContract` schema (`src/schemas.ts:1037`) already carries every field
this migration needs: `harness` is `HarnessNameSchema.nullable()`, `aliases` is
`z.array(FormatIdentifierSchema)`, and `lifecycle` supports
`status: "deprecated"` with a `replacement`. No schema change is required — only
data (contract definitions) and the reader.

### 1. The vendor-neutral contract

Replace `KIRO_SKILL_CONTRACT` and `SUPERPOWERS_CONTRACT` with one `SKILL_MD_CONTRACT`:

```ts
export const SKILL_MD_CONTRACT: FormatContract = {
  id: "skill-md" as FormatIdentifier,
  contractVersion: "1.0",
  direction: "source",
  harness: null,                          // no vendor owns SKILL.md
  aliases: [
    "kiro-skill" as FormatIdentifier,     // deprecated names resolve here
    "superpowers" as FormatIdentifier,
  ],
  lifecycle: { status: "active", introducedIn: "1.1.0" },
  // ...canonicalVersions, security unchanged from the old contracts...
  schemaReference: { type: "none", description: "SKILL.md skill structure with preserved companions" },
  pathConventions: [
    { pattern: "SKILL.md", required: true, description: "Skill definition file" },
    { pattern: "**/*",     required: false, description: "Companion files preserved by relative path" },
  ],
  detection: {
    threshold: 0.5,
    rules: [
      { id: "skill-md", kind: "basename", pattern: "SKILL.md", weight: 60, required: true, evidenceLabel: "SKILL.md present" },
      { id: "references-dir", kind: "path-glob", pattern: "references/*", weight: 10, required: false, evidenceLabel: "references/ companions" },
    ],
  },
  // ...variants/options/defaults/normalizationRules/compatibility as before...
};
```

Note on `aliases`: the registry treats a contract's `aliases` as alternate
selectors for that contract, checked for uniqueness at registration
(`registry.ts:293–327`). Selecting `--format kiro-skill` therefore resolves to
`skill-md`. To make the deprecation *loud* (a migration diagnostic on use), pair
this with a `SELECTION_ALIASES` entry — the mechanism `auto` already uses
(`contracts.ts:56`):

```ts
export const SELECTION_ALIASES = {
  auto: { /* unchanged */ },
  "kiro-skill": {
    id: "kiro-skill", status: "deprecated",
    description: "Vendor-qualified name for the SKILL.md structure; Kiro does not own it.",
    replacement: "skill-md",
    introducedIn: "0.1.0", deprecatedIn: "1.1.0",
    removalPolicy: "Removed in 2.0.0. Use --format skill-md.",
  },
  superpowers: {
    id: "superpowers", status: "deprecated",
    description: "obra/superpowers marketplace name for the SKILL.md structure.",
    replacement: "skill-md",
    introducedIn: "0.1.0", deprecatedIn: "1.1.0",
    removalPolicy: "Removed in 2.0.0. Use --format skill-md.",
  },
};
```

(The two mechanisms are complementary: contract `aliases` make the old id
*resolve*; `SELECTION_ALIASES` make it *warn*. Either alone works; both together
give resolution plus a migration message.)

### 2. Source-translator registration

`src/rosetta/builtins/sources/index.ts` maps format id → translator:

```ts
// before
["kiro-skill" as FormatIdentifier,  translateKiroSkill],
["superpowers" as FormatIdentifier, translateSuperpowers],
// after — one structure-based translator, companions preserved wherever they sit
["skill-md" as FormatIdentifier, translateSkillMd],
```

`translateSkillMd` is the merge of the two existing translators: parse
`SKILL.md` frontmatter+body; map `references/*.md` companions to workflows
(strip the `references/` prefix, as `translateKiroSkill` does today, so compiled
`references/…` links resolve); `accountant.preserve()` everything else by its
relative path. This is where it depends on the recursive source read.

### 3. Provenance contract-id resolution (the piece that can silently break)

`src/import.ts` records the source contract into each artifact's provenance:

```ts
const SOURCE_CONTRACT_IDENTIFIERS = {
  "kiro-power": "kiro-power@1",
  "skill-md":   "skill-md@1",   // was "kiro-skill@1" / "superpowers@1"
};
```

Artifacts imported before this change carry `provenance.contract: "kiro-skill@1"`
or `"superpowers@1"`. Re-sync/reconciliation compares recorded contract ids, so
the resolver that reads provenance must alias both historical ids to
`skill-md@1`:

```ts
const CONTRACT_ID_ALIASES: Record<string, string> = {
  "kiro-skill@1":  "skill-md@1",
  "superpowers@1": "skill-md@1",
};
```

This mapping is the highest-risk item and needs a dedicated regression test:
import under the old id, rename, re-sync, assert the base digest still verifies.

### 4. Docs

`CONTRIBUTING.md` and import examples move from `--format kiro-skill` /
`superpowers` to `--format skill-md`, noting the old names as deprecated
aliases. ADR-0019 and ADR-0029 reference `kiro-skill` descriptively and can be
left as historical record (ADRs are immutable once accepted); a forward pointer
to this ADR is enough.

### Out of scope (tracked separately)

- The recursive, all-file source read that `skill-md` assumes (the
  "`buildSourceDocuments` drops non-`.md` and non-top-level files" fix).
- Binary-safe workflow content (`WorkflowFileSchema.content` widening).
- The categories/domains taxonomy rework (relates to ADR-0007).

`kiro-power` is intentionally untouched: `POWER.md` + `steering/` is a genuine
Kiro-native format, so `harness: "kiro"` is factual.
