# ADR-0050: Reconcile Agent Asset-Type Compatibility with Agent Capability Support

## Status

Accepted

## Date

2026-07-23

## Context

ADR-0014 expanded `type` into an asset taxonomy including `agent`, and
ADR-0028 co-located a separate feature-level capability matrix
(`CAPABILITY_MATRIX` in `src/adapters/capabilities.ts`) alongside the
existing asset-type compatibility table (`ASSET_HARNESS_COMPATIBILITY` in
`src/compatibility.ts`). Both tables score `agent`/`agents` support per
harness, but they were populated independently and drifted:

| harness | `compatibility.ts` `agent` (before) | `capabilities.ts` `agents` |
|---|---|---|
| kiro | full | partial / inline |
| claude-code | partial | none / omit |
| codex | *(missing — defaulted to full)* | partial / inline |
| copilot | full | full |
| qdeveloper | full | full |
| cursor/windsurf/cline | none | none / omit |

Two problems followed from this:

1. `getCompatibility()` falls back to `"full"` for any harness not listed in
   a type's entry (`src/compatibility.ts`, `getCompatibility`). `agent` had
   no `codex` row, so codex silently inherited "full" build-time support —
   contradicting `capabilities.ts`, which says codex only has partial
   ("inline") agent support.
2. `kanon build` (`src/build.ts`) and `kanon temper` (`src/temper.ts`) read
   from these two tables independently. For the same artifact and harness, a
   build could report "full support" while a temper preview reported the
   capability as degraded to inline prose — a visible, confusing
   contradiction with no single source of truth to blame.

Separately, `src/temper.ts`'s `isCapabilityUsed()` — which decides whether a
harness's `agents` degradation is worth reporting for a given artifact —
checked only `artifact.frontmatter.type === "agent"`. Every other case in
that switch inspects real content (hook count, workflow count, inclusion
mode). This meant an artifact typed `power` but whose body plainly documents
agent-loop behavior (as several existing `knowledge/kiro-official/*-agent*`
artifacts do — they use `type: power` for Kiro's POWER.md format, not
`type: agent`, per ADR-0014's asset-taxonomy vs. output-format split) got
zero degradation reporting, even on harnesses that render that content as
plain, undifferentiated prose.

Finally, `ASSET_CONVENTIONS.agent` in `src/asset-conventions.ts` had
`validationRuleKeys: []` — no agent-specific authoring guidance existed at
all, unlike `workflow`, which is checked for a `workflows/` directory.

As of this analysis, zero artifacts in `knowledge/` use `type: agent` (47
`power`, 11 `skill`, 2 `workflow`, 1 each `template`/`reference-pack`/
`prompt`), so none of this drift had yet produced an incorrect real build.

## Decision

**1. Keep the two tables separate, but make them answer clearly distinct
questions and never contradict each other.**

- `ASSET_HARNESS_COMPATIBILITY` (`compatibility.ts`) answers a *build-level*
  question consumed by `build.ts`: does this harness produce meaningful
  output at all for this asset type, such that `strict` mode should error or
  warn? Its granularity is per asset **type**.
- `CAPABILITY_MATRIX` (`adapters/capabilities.ts`) answers a *feature-level*
  question consumed by adapters and `temper.ts`: can this harness represent a
  specific capability (hooks, agents, workflows, ...) natively, and if not,
  what degradation strategy applies? Its granularity is per **capability**,
  independent of asset type.

  A `type: agent` artifact and a `type: power` artifact that both happen to
  use hooks hit the *same* `agents`/`hooks` capability entries — capability
  support is a property of the harness, not of the declaring artifact's
  type. Collapsing the two tables into one would conflate "can this harness
  build this asset type at all" with "does this harness have a native
  representation for this specific feature," which are genuinely different
  questions with different callers (`build.ts` vs. adapters/`temper.ts`).

- The invariant going forward: `ASSET_HARNESS_COMPATIBILITY.agent[h]` must
  never be `"full"` where `CAPABILITY_MATRIX[h].agents.support` is `"none"`,
  and must never be `"none"` where the capability matrix says `"full"`.
  Enforced by a test in `src/__tests__/compatibility.test.ts`.

- Added the missing `codex` entry to `ASSET_HARNESS_COMPATIBILITY.agent`
  (`"partial"`) instead of relying on the silent `?? "full"` fallback in
  `getCompatibility()`.

- Corrected `ASSET_HARNESS_COMPATIBILITY.agent` values to align with what the
  adapters actually do: no harness in this codebase has a declarative
  sub-agent *file format* (contrast with `workflow`, which kiro/copilot/
  qdeveloper support fully as native files) — kiro, claude-code, and codex
  render agent artifacts as generic steering/CLAUDE.md/AGENTS.md prose
  (`"partial"`), copilot and qdeveloper have genuine native agent-file output
  (`AGENTS.md` / `.q/agents/*.md`, `"full"`), and cursor/windsurf/cline have
  no agent surface at all (`"none"`).

**2. Make `isCapabilityUsed("agents", ...)` content-aware.**

Added `documentsAgentLoop(body)` in `src/asset-conventions.ts`: a body
"documents an agent loop" when it contains at least two of four canonical
markdown headings (`Goal`/`Objective`, `Inputs`, `Outputs`,
`Loop`/`Autonomous Loop`), matched case-insensitively at any heading level.
`temper.ts`'s `isCapabilityUsed()` now returns true when
`frontmatter.type === "agent"` **or** `documentsAgentLoop(artifact.body)` —
so a `power`-typed artifact that genuinely documents agent-loop behavior now
gets agent-degradation reporting in `kanon temper`, without requiring authors
to reclassify existing artifacts.

Two headings (not one, not all four) was chosen as a deliberately low bar:
it flags likely agent content for a warning-level degradation report without
requiring a rigid, enforced template — false positives here just mean an
extra advisory line in a temper report, which is low-cost.

**3. Give `agent` a real validation rule.**

Added `AssetValidationRuleKey: "agent-should-document-loop"` to
`asset-conventions.ts`, using the same `documentsAgentLoop()` helper, wired
into `validate.ts` alongside the existing `prompt-body-too-short` check
(both need the parsed body, so both live in the post-parse block rather than
the frontmatter-only switch). An artifact declaring `type: agent` without at
least two of the four canonical headings now produces a validation warning.

## Consequences

### Positive

- `getCompatibility("agent", "codex")` is now an explicit, intentional value
  instead of an accidental fallback.
- Build-time and temper-time signals for `agent` artifacts no longer
  contradict each other, and a regression test guards the invariant.
- `kanon temper`'s agent-degradation reporting reflects actual artifact
  content, catching the common case where authors use `type: power` (per
  ADR-0014, `type` is asset taxonomy, not format) for what is functionally
  an agent.
- `type: agent` artifacts get baseline authoring guidance where previously
  there was none.

### Negative

- Two tables that answer related-but-different questions remain two tables,
  not one — a future contributor could still edit one without the other.
  Mitigated by the cross-table invariant test and comments in both files
  pointing at each other and this ADR.
- `documentsAgentLoop()`'s heading-based heuristic is necessarily inexact —
  an artifact could document agent-loop behavior using different prose
  conventions and go undetected, or use those headings incidentally without
  being agent-like. Accepted because the cost of a false positive/negative
  is a single advisory line, not a build failure.

### Neutral

- No existing artifact is affected: zero `knowledge/` artifacts currently
  use `type: agent`, and no existing `power`-typed artifact's body was
  checked against the new heuristic as part of this change (a follow-up
  content audit, not a code change, could apply `documentsAgentLoop()`
  against the existing corpus if desired).

## Links and References

- Relates to: [ADR-0014](./0014-repurpose-type-as-asset-taxonomy.md) (asset
  taxonomy vs. output format split — `type: power` artifacts documenting
  agent behavior is expected under that split, not a misuse)
- Relates to: [ADR-0028](./0028-capability-matrix-in-adapters.md) (capability
  matrix rationale — this ADR clarifies its relationship to
  `compatibility.ts` rather than superseding it)
- Implementation: `kanon/src/compatibility.ts` — `ASSET_HARNESS_COMPATIBILITY.agent`
- Implementation: `kanon/src/temper.ts` — `isCapabilityUsed()`
- Implementation: `kanon/src/asset-conventions.ts` — `documentsAgentLoop()`,
  `agent-should-document-loop`
- Implementation: `kanon/src/validate.ts` — agent loop documentation check
- Branch: `claude/infallible-bouman-e70e6c`
