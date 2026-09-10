# ADR-0072: Vendor-Neutral `agents` (AGENTS.md) Harness; Deprecate `qdeveloper` and `windsurf`

## Status

Accepted

## Date

2026-09-09

## Context

Two forces motivated this change:

1. **Amazon Q Developer is reaching end-of-support.** AWS blocked new signups on 2026-05-15 and set IDE plugins and paid subscriptions to end on 2027-04-30, with Kiro as the named successor. Kanon's `qdeveloper` harness targets a product on a sunset path.
2. **The ecosystem is converging on `AGENTS.md`.** `AGENTS.md` is a vendor-neutral open standard — a single root Markdown file that any compliant coding agent reads on task start — now adopted across a large and growing number of repositories and read by many tools (Aider, Zed, Continue, and others). A single AGENTS.md target gives broad, portable coverage without a per-tool adapter.

Kanon had no harness-level deprecation mechanism. Deprecation existed only for asset-type taxonomy values (ADR-0051 `power`, ADR-0012 global `type`) and for Rosetta format contracts via `FormatContract.lifecycle.status`. Because every Kanon harness is backed by exactly one bidirectional format contract, the contract-lifecycle lever is the natural way to deprecate a harness.

## Decision

**Add a vendor-neutral `agents` harness** that emits a single root `AGENTS.md`:

- New `agents` entry in `SUPPORTED_HARNESSES` (and the duplicated list in `help/renderer.ts`).
- New `AGENTS_CONTRACT` (id/harness `agents`, `bidirectional`, single `agents-md` variant, detects basename `AGENTS.md`) appended to `BUILTIN_FORMAT_CONTRACTS`, plus `AGENTS_PROFILE` and `PROFILE_LOOKUP` entries.
- New `CAPABILITY_MATRIX` row and `ASSET_HARNESS_COMPATIBILITY` cells. The profile mirrors other single-file, system-prompt-merged harnesses: `system-prompt-merging` full; hooks, MCP, path-scoping, workflows, toggleable-rules, file-match, and declarative agents unsupported.
- New target translator (`targets/agents.ts`) emitting only root `AGENTS.md` — no vendor-specific sidecars (contrast the Codex target, which also writes `.codex/` files) — plus a source translator and pretty-printer for round-trip, and a legacy `importers/agents.ts` facade.
- New template `templates/harness-adapters/agents/agents-md.md.njk`. Unlike the Codex `agents-md` template, it calls `super()` so the shared attribution footer is preserved; the portable AGENTS.md is exactly where upstream attribution matters most.

**Deprecate `qdeveloper` and `windsurf`** without breaking them:

- Set `lifecycle.status: "deprecated"` (with `deprecatedIn` and `replacement: "agents"`) on `QDEVELOPER_CONTRACT` and `WINDSURF_CONTRACT`.
- The build path resolves contracts directly rather than through the registry's `resolve()`, so the existing `RS_LIFECYCLE_DEPRECATED` diagnostic never fired during a build. The adapter wrapper now reads `contract.lifecycle` and emits a build-time deprecation warning pointing at the replacement.
- The wizard annotates both harnesses as deprecated and excludes them from the default multiselect; they remain selectable and buildable for backward compatibility.

## Consequences

### Positive

- One portable `AGENTS.md` target covers many downstream agents at once.
- Artifacts targeting the sunsetting Q Developer and Windsurf harnesses now get an actionable, non-breaking migration signal.
- Attribution is preserved in the vendor-neutral output.
- Establishes the reusable pattern for harness deprecation: flip the contract lifecycle and surface it in the adapter.

### Negative

- A root `AGENTS.md` is now detected by both `codex` and `agents` during import; the import wizard must let the user disambiguate.
- The deprecation warning is emitted per artifact per build, which is noisy for repositories still targeting those harnesses.

### Neutral

- `qdeveloper` and `windsurf` remain in `SUPPORTED_HARNESSES`; removal would be a separate hard break (as rejected for `power` in ADR-0051).
- The `agents` profile classifies the `agent` capability as `none` (following the CAPABILITY_MATRIX precedence in `buildCompatibilityProfile`), consistent with other single-file harnesses.
