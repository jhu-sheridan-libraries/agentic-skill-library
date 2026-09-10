# ADR-0067: Format Identifiers Describe Structure, Not Vendor

## Status

Proposed

## Date

2026-09-08

## Context

Kanon's source format identifiers conflate two different things: the *structure*
of an artifact (its marker file and layout) and the *vendor* that happens to
consume it. The clearest offender is `kiro-skill`.

The `SKILL.md` + `references/` layout that `kiro-skill` recognizes is the
Anthropic Agent Skills / `obra/superpowers` convention. It is read by Claude
Code, Codex, and Kiro alike; no single harness owns it. Yet the `kiro-skill`
identifier — and its `harness: "kiro"` field in the Format_Contract — asserts
that Kiro owns it. The misattribution is not cosmetic: `harness` is a structured
field that the catalog, detection evidence, and provenance all read.

Two facts make the current state incoherent rather than merely untidy:

1. `superpowers`, the format whose `harness: null` honestly reflects that no
   vendor owns the `SKILL.md` shape, is the one marked **deprecated**.
   `kiro-skill`, with the false qualifier, is **active** and is what
   auto-detection selects for a `SKILL.md` source. The correctly-named format is
   being retired; the misnamed one is promoted.
2. `kiro-skill` and `superpowers` do nearly the same job — both parse
   `SKILL.md` — differing only in where companion files are expected
   (`references/` vs. top-level). That is a structural detail, not a vendor
   distinction.

By contrast, `kiro-power` (`POWER.md` + `steering/`) genuinely *is* Kiro's
native power format, so its `harness: "kiro"` is accurate. The rule we need must
distinguish these two cases rather than banning vendor qualifiers outright.

This ADR realizes the naming rule proposed in ADR-0066 and applies it to the
source formats. It is the Structure-axis half of the
`vendor-neutral-formats-categories` spec (Requirements 1–5).

## Decision

**A source format identifier describes the artifact's observable structure (its
marker file and layout). It may carry a vendor qualifier only when that vendor
genuinely defines or exclusively owns the structure. Reading a format does not
constitute owning it.**

The discriminating test for any format identifier: *does a specific vendor
define or exclusively own this structure?* If yes (`kiro-power`), the qualifier
is factual and permitted. If the structure is a convention multiple harnesses
read (`SKILL.md`), the identifier must be vendor-neutral and the contract's
`harness` field must be `null`.

Applying the rule:

1. **Introduce a vendor-neutral `skill-md` source format** (`harness: null`)
   that recognizes the `SKILL.md` + companions structure. The name follows the
   registry's existing marker-file convention for representation ids
   (`claude-md`, `agents-md`, `knowledge-md`).
2. **Collapse `kiro-skill` and `superpowers` into `skill-md`.** One translator
   reads `SKILL.md` and preserves companion files wherever they sit.
3. **Keep `kiro-skill` and `superpowers` as deprecated aliases of `skill-md`,**
   using the registry's existing `aliases` and `lifecycle` machinery. Selecting
   either resolves to `skill-md` and emits a deprecation diagnostic. No importer
   command or recorded provenance breaks.
4. **Resolve historical provenance contract ids.** Artifacts imported before this
   change record `provenance.contract: "kiro-skill@1"` or `"superpowers@1"`; the
   contract-id resolver maps both to `skill-md@1` so three-way reconciliation and
   re-sync keep working. `SOURCE_CONTRACT_IDENTIFIERS` emits `skill-md@1` going
   forward.
5. **`kiro-power` is unchanged.** `POWER.md` + `steering/` is a genuine
   Kiro-native structure, so its `harness: "kiro"` passes the discriminating
   test.

The rule is enforced, not just stated: the model-invariant check (see ADR-0068
and the spec's Part C) fails the built-in registry if any source format asserts
a non-null `harness` for a structure that is not vendor-owned — of the built-in
source formats, only `kiro-power` may.

This is a naming and enforcement change. `FormatContract` already supports
`harness: null`, an `aliases` array, and `lifecycle` diagnostics, so no schema
change is required.

## Consequences

### Positive

- Format identifiers and the `harness` field state what is true; `SKILL.md` is no
  longer attributed to Kiro.
- One `skill-md` format replaces two near-duplicate contracts, ending the state
  where the honestly-named format was the deprecated one.
- Establishes a reusable, testable naming rule, so future source formats are named
  by structure without re-litigating vendor attribution.
- The migration reuses existing registry mechanisms (`aliases`, `lifecycle`),
  containing the blast radius.

### Negative

- Touches recorded data: existing `provenance.contract` values must be resolved
  through an alias map indefinitely (or until a dedicated migration rewrites
  them). Getting this wrong silently breaks re-sync, so it needs explicit tests.
- Documentation churn: CONTRIBUTING and import examples reference
  `--format kiro-skill` / `superpowers` and must move to `--format skill-md`,
  with the old names noted as deprecated.
- A window where three ids (`skill-md`, `kiro-skill`, `superpowers`) all resolve
  to the same behavior may confuse readers until the aliases are removed in a
  future major.

### Neutral

- `kiro-power` keeps its name and `harness: "kiro"`; the change is scoped to the
  `SKILL.md` family.
- Auto-detection behavior is unchanged for users — a `SKILL.md` source still
  resolves automatically; only the selected id's name changes.
- The `skill-md` vs. `agent-skill` naming choice is deliberate (parallels the
  existing marker-file ids) but is the one point most open to revision in review.

## Links and References

- Spec: `.kiro/specs/vendor-neutral-formats-categories/` (Requirements 1–5, Design Part A)
- Realizes: ADR-0066 (source format identifiers must not assert a vendor unless a real vendor distinction exists)
- Related: [ADR-0051](./0051-deprecate-power-as-asset-taxonomy-value.md) — the same structure-vs-output-format distinction applied to `type`
- Companion: ADR-0068 (categories for craft, domains for subject) — the Craft/Subject-axis half of the same spec
- Implementation (planned): `kanon/src/rosetta/builtins/contracts.ts` (`SKILL_MD_CONTRACT`, `SELECTION_ALIASES`), `kanon/src/rosetta/builtins/sources/skill-md.ts`, `kanon/src/import.ts` (`SOURCE_CONTRACT_IDENTIFIERS`, `CONTRACT_ID_ALIASES`)
