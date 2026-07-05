# ADR-0038: Codex as a first-class harness

## Status

Accepted

## Date

2026-06-11

## Context

OpenAI Codex CLI has its own native configuration surface: a short,
always-loaded `AGENTS.md` system prompt, repo-local skills discovered under
`.codex/skills/<name>/SKILL.md` (frontmatter-gated), file-based handoffs in
`_workspace/`, and MCP servers registered in `config.toml` under
`[mcp_servers.<name>]`. Authors targeting Codex previously had no canonical
artifact path through Kanon, so Codex content had to be hand-written or
ported from a sibling project (e.g. `meta-harness`).

The `factory-harness` artifact in particular is a meta-skill whose value is
realizing the same agent team natively on each harness, which requires Codex to
be a real compile target rather than an afterthought.

## Decision

Add `codex` to `SUPPORTED_HARNESSES` as a first-class harness with:

- a format registry entry (`agents-md` default, `skill`);
- a capability-matrix row (MCP full, workflows full, system-prompt merging full;
  hooks/path-scoping/file-match none; agents partial);
- a pure-function adapter that emits `AGENTS.md` (full body) for the `agents-md`
  format, or `.codex/skills/<name>/SKILL.md` + `references/` + a short `AGENTS.md`
  pointer for the `skill` format, plus `.codex/config.toml` for MCP servers;
- Nunjucks templates under `templates/harness-adapters/codex/`;
- an importer for `AGENTS.md`, `SKILL.md`, and `config.toml`;
- install/sync/detect path mappings and wizard/help entries.

Codex has no declarative event-hook system (only the `notify` shell hook), so
canonical hooks are skipped for Codex with a warning, consistent with other
hook-less harnesses.

## Consequences

### Positive

- Authors can target Codex from the same canonical artifact as every other harness.
- Codex output uses native conventions: always-loaded `AGENTS.md` pointer plus
  progressive-disclosure skills, and `config.toml` MCP registration.
- `factory-harness` realizes its team natively across Claude Code, Codex, and Kiro.

### Negative

- One more harness to keep in sync across the registry, capability matrix,
  compatibility table, importers, and CLI surfaces.
- Artifacts that omit an explicit `harnesses` list now also build Codex output.

### Neutral

- TOML for `config.toml` is generated directly in the adapter rather than via a
  Nunjucks template, since TOML escaping is simpler to keep correct in code.
