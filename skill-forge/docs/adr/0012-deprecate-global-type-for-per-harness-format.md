# ADR-0012: Deprecate Global Type Field in Favor of Per-Harness Format

## Status

Superseded by [ADR-0014](./0014-repurpose-type-as-asset-taxonomy.md)

## Date

2026-04-11

## Context

Skill Forge uses a top-level `type` field in artifact frontmatter (`skill`, `power`, or `rule`) to classify knowledge artifacts. In practice, this abstraction is misleading: the concept of artifact "type" is harness-dependent, and no adapter actually reads the top-level `type` field to determine output format. Kiro already uses `harness-config.kiro.power: true` independently to toggle power behavior, bypassing the global type entirely.

The `skill`/`power`/`rule` taxonomy doesn't map cleanly to any harness's native output formats. For example, Copilot produces either `copilot-instructions.md` or `AGENTS.md` — neither of which corresponds to "skill" or "rule." Q Developer produces `.q/rules/` or `.q/agents/`, which are its own concepts. Forcing authors to pick a single global label that applies across all seven harnesses creates confusion without adding value.

This decision was motivated by the per-harness artifact type spec (`.kiro/specs/per-harness-artifact-type/`).

## Decision

Deprecate the global `type` field and let each harness define its own output format through the existing `harness-config` section. Each harness declares a set of valid output formats with a default:

- **kiro**: `steering` (default), `power`
- **cursor**: `rule`
- **copilot**: `instructions` (default), `agent`
- **claude-code**: `claude-md`
- **windsurf**: `rule`
- **cline**: `rule`
- **qdeveloper**: `rule` (default), `agent`

Authors specify format per-harness via `harness-config.<harness>.format`. The global `type` field is retained as optional with a default of `"skill"` for backward compatibility, but adapters no longer read it. A deprecation warning is emitted during `forge validate` when an artifact relies on `type` without per-harness format configuration.

The wizard no longer prompts for a global artifact type. Instead, it prompts for output format per-harness (only for harnesses with multiple formats).

## Consequences

### Positive

- Authors use each harness's native terminology instead of a misleading global label
- Multi-format harnesses (kiro, copilot, qdeveloper) can be configured independently per artifact
- The wizard explains what each harness and format produces, reducing confusion
- Existing artifacts continue working without modification — defaults match prior behavior

### Negative

- The `type` field becomes vestigial metadata during the deprecation period, adding slight schema complexity
- Authors familiar with the old `type` field need to learn the new `format` approach (mitigated by deprecation warnings)

### Neutral

- The catalog retains `type` for backward compatibility and adds `formatByHarness` alongside it
- The browse SPA's type filter is replaced with a format filter
