# ADR-0026: Workspace config extends forge.config.yaml

## Status

Proposed

## Date

2026-04-21

## Context

Skill Forge needs multi-repo/monorepo workspace support — the ability to define multiple knowledge sources, per-project harness targets, artifact include/exclude lists, and shared defaults. The existing `forge.config.yaml` already defines `install.backends` for publish/install configuration. A new config file could be introduced, but that fragments configuration and adds discovery complexity.

## Decision

Extend the existing `forge.config.yaml` with new top-level fields (`knowledgeSources`, `sharedMcpServers`, `defaults`, `projects`) alongside the existing `install.backends` structure. No new config file is created. The workspace fields are validated by `WorkspaceConfigSchema` (Zod) in `src/schemas.ts`. If both `forge.config.ts` and `forge.config.yaml` exist, prefer `.ts` with a warning.

## Consequences

### Positive

- Single config file for all Forge settings — no discovery ambiguity
- Existing `loadForgeConfig()` in `src/config.ts` can be extended rather than duplicated
- Users already familiar with `forge.config.yaml` find workspace fields in the same place

### Negative

- The config file grows in scope — may become large for complex monorepos
- Mixing backend config and workspace config in one file couples two concerns

### Neutral

- The `WorkspaceConfigSchema` is defined centrally in `src/schemas.ts` following existing conventions
- Workspace fields are optional — repos without workspace needs are unaffected
