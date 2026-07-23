# ADR-0051: Deprecate `power` as an Asset-Taxonomy Value

## Status

Accepted

## Date

2026-07-23

## Context

ADR-0014 repurposed the top-level `type` field into an asset taxonomy
(`skill | power | rule | workflow | agent | prompt | template |
reference-pack`), explicitly decoupled from harness *output format*
(`harness-config.<harness>.format`, established by ADR-0012). But `power`
never actually became a taxonomy value — it is Kiro's own output-format
concept (`harness-config.kiro.format: "power"`, defined in
`src/format-registry.ts`: `kiro: { formats: ["steering", "power"], default:
"steering" }`). No adapter branches on `frontmatter.type === "power"`;
`src/adapters/kiro.ts:266` branches on the *resolved* `harness-config.kiro.
format` value only, via `resolveFormat()`. `ASSET_CONVENTIONS.skill` and
`ASSET_CONVENTIONS.power` (`src/asset-conventions.ts`) were byte-identical —
same required/optional files, both with no validation rules — because there
was never a real distinction to encode. Anything typed `power` is, in
substance, `type: skill` with an explicit `harness-config.kiro.format:
"power"` describing the same content correctly.

**This was not just a theoretical inconsistency.** `resolveFormat()`
(`src/format-registry.ts:28-43`) never reads `frontmatter.type` at all — it
inspects only `harnessConfig?.format` (falling back to the legacy `power:
true` boolean, then to the registry default `"steering"`). Auditing the 47
`knowledge/` artifacts that carried `type: power`, 8 — all under
`knowledge/byron-powers/*` (`novelist`, `technical-author`,
`series-continuity`, `fantasy-novelist`, `scifi-novelist`,
`mystery-series-novelist`, `proofreader-review-checklist`,
`book-agent-publicist`) — had **no `harness-config` block at all**. For
these, `type: power` was already inert: they render as ordinary Kiro
steering files today, not POWER.md bundles, despite the label. The other 39
(36 with `type: power` + `harness-config.kiro.format: power` set
consistently, plus 3 artifacts outside the 47 — `knowledge/kanon`,
`knowledge/factory-harness`, `knowledge/hello` — that already diverge the
*other* way, with `type: skill/workflow/template` + `format: power`, per
ADR-0046) prove the two fields were already treated as independent by
content authors in practice, not as redundant restatements of each other.

`scripts/generate-plugin-skills.ts` already filters
`(e.type === "skill" || e.type === "power")` identically for Claude Code
plugin-skill eligibility — tooling already treats the two values as
interchangeable.

## Decision

**Deprecate `power` as a `type` value in favor of `type: "skill"` +
an explicit `harness-config.kiro.format: "power"`. Keep `power` valid in the
Zod schema as a permanent backward-compatible alias — this is not a hard
break.**

This follows the exact precedent ADR-0014 already established for
`ArtifactTypeSchema` (kept as an alias of `AssetTypeSchema`): the schema
keeps accepting the old value indefinitely, but tooling and content steer
toward the new canonical shape.

Concretely:

1. **`src/schemas.ts`** — `AssetTypeSchema` keeps `"power"` in its enum, with
   a comment marking it a deprecated alias for `"skill"`.
2. **`src/asset-conventions.ts`** — `ASSET_CONVENTIONS.power` keeps the same
   file conventions as `skill` (unchanged, since they were always
   identical), plus a new validation rule, `type-power-deprecated`, that
   `skill` does not carry.
3. **`src/compatibility.ts`** — `ASSET_HARNESS_COMPATIBILITY.power` is
   realigned to match `skill`'s row (`{}`, full support everywhere).
   Previously it independently declared "partial" support for every
   non-kiro harness — a holdover from when `power` was believed to be a
   distinct taxonomy concept. Once `power` is understood as an alias for
   `skill`, it should carry identical compatibility signal.
4. **`src/validate.ts`** — fires a warning (not an error) whenever
   `fm.type === "power"`, regardless of whether `harness-config.kiro.format`
   is also set to `"power"` — the warning is about the deprecated *type*
   value itself, not about a missing or mismatched format field. This
   replaces two existing tests in `validate.test.ts` that had asserted the
   *opposite* (no warning for `type: power`) under ADR-0014's original,
   now-superseded framing.
5. **`src/wizard.ts`** — the interactive "what kind of artifact is this?"
   prompt no longer offers `power` as an option (new authors get `skill` +
   the existing per-harness Kiro format prompt, which already asks
   `steering` vs. `power` — unaffected). `power` remains accepted when
   passed programmatically via `preSelectedType`, since the schema still
   allows it.
6. **`src/import.ts`** — the Kiro POWER.md importer now stamps `type:
   "skill"` (previously `"power"`) alongside the unchanged
   `harness-config.kiro.format: "power"` — modeling the new canonical shape
   for every future import.
7. **Content migration** — all 47 `knowledge/*/knowledge.md` artifacts with
   `type: power` were relabeled to `type: skill` in the same change,
   confirmed as a pure relabel with **zero rendering changes**: verified via
   `kanon temper <name> --harness kiro` before/after on both a
   `harness-config`-bearing artifact (`adr`, still emits an 8-file POWER.md
   bundle) and a byron-powers artifact with no `harness-config`
   (`novelist`, still emits steering-only output, unchanged). The 8
   byron-powers artifacts were **not** given a new `harness-config.kiro.
   format: "power"` block as part of this change — whether they were always
   meant to render as POWER.md bundles is a separate, deliberate content
   decision, explicitly deferred rather than folded silently into this
   taxonomy cleanup.
8. **`scripts/generate-plugin-skills.ts`** — unchanged; its existing
   `type === "skill" || type === "power"` filter already treats both values
   identically, which remains correct for the deprecated alias and its
   replacement.

A hard break (removing `power` from the enum entirely) was rejected: it
would require atomically landing schema, wizard, import, and all 47 content
files with no rollback path, for a value every consumer already treats as
functionally equivalent to `skill`.

## Consequences

### Positive

- `type` is now unambiguous going forward: new content never needs to
  choose between `skill` and `power` as if they meant different things.
- The deprecation warning gives existing/future `type: power` content (in
  this repo or any downstream fork/consumer) a discoverable migration path
  via `kanon validate`, without breaking builds.
- `ASSET_HARNESS_COMPATIBILITY.power` no longer disagrees with `skill`'s row
  for no principled reason.
- Surfaces (without resolving) a latent content gap: 8 byron-powers
  artifacts have carried a `power` label without ever producing power-shaped
  output. That's now a visible, deliberate follow-up decision rather than a
  silent inconsistency.

### Negative

- `power` remains a permanently-supported schema value — one more entry to
  keep in mind when reasoning about `AssetType`, indefinitely. Accepted as
  the cost of a non-breaking migration, mirroring the `ArtifactTypeSchema`
  precedent.
- The 8 byron-powers artifacts' actual-behavior-vs-label gap is now
  documented but not fixed. Follow-up work (out of scope here) would need to
  decide, per artifact, whether `harness-config.kiro.format: "power"` should
  be added.

### Neutral

- `catalog.json` was not regenerated as part of this change — it was
  already stale before this migration (containing unrelated additions from
  prior commits that were never re-catalogued). Regenerating it is a
  separate, pre-existing maintenance task, not part of this ADR's scope.

## Links and References

- Supersedes/corrects: [ADR-0014](./0014-repurpose-type-as-asset-taxonomy.md)
  (the taxonomy premise `power` never actually satisfied)
- Relates to: [ADR-0012](./0012-deprecate-global-type-for-per-harness-format.md)
  (established `harness-config.<harness>.format` as the correct home for
  output-format concerns)
- Relates to: [ADR-0046](./0046-committed-claude-code-plugin-skills.md)
  (already documents `type` and `harness-config.kiro.format` as independent,
  citing the `kanon` artifact's own `power`→`skill` reclassification as
  precedent)
- Relates to: [ADR-0050](./0050-agent-compatibility-and-degradation-reconciliation.md)
  (same `compatibility.ts`/`asset-conventions.ts` files, same
  deprecate-and-warn pattern applied to a different asset-type inconsistency)
- Implementation: `kanon/src/schemas.ts` — `AssetTypeSchema`
- Implementation: `kanon/src/asset-conventions.ts` — `type-power-deprecated`
- Implementation: `kanon/src/validate.ts` — deprecation warning wiring
- Implementation: `kanon/src/compatibility.ts` — `ASSET_HARNESS_COMPATIBILITY.power`
- Implementation: `kanon/src/wizard.ts`, `kanon/src/import.ts`
- Content migration: 47 files under `kanon/knowledge/`
- Branch: `claude/infallible-bouman-e70e6c`
