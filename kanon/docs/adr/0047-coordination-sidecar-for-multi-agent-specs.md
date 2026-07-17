# ADR-0047: COORDINATION.md sidecar for multi-agent work on Kiro Specs

## Status

Accepted

## Date

2026-07-17

## Context

Kiro Specs (`.kiro/specs/<name>/`) are increasingly used as the shared unit of
work for multiple agents — e.g. Claude Code and Cowork, or several parallel
sessions — collaborating on one feature. The spec files are plain markdown in a
git-tracked directory, which makes them a natural coordination medium, but the
format offers nowhere to record *who owns which task* or *what is in flight*:

- `tasks.md` carries only `- [ ]` / `- [x]` checkboxes. It records completion,
  not ownership or claim status.
- Kiro rewrites `tasks.md` on Sync/Refine and only understands the two standard
  checkbox markers, so any inline ownership annotation (e.g. `(@cowork)`) is
  liable to be stripped.
- `.config.kiro` holds `specId`, but that value is **not unique** — copied or
  branched specs reuse the same UUID (observed across several folders in this
  repo), so it cannot key coordination.

Without a convention, agents either double-work tasks or silently clobber each
other's progress. We needed a place to hold coordination state that Kiro leaves
alone and that stays legible in diffs.

## Decision

Introduce a dedicated **`COORDINATION.md`** sidecar per spec folder, plus a
`kanon spec` command group and a pure `src/spec-coordination.ts` module to
read/write it safely.

- `tasks.md` remains the single source of truth for *completion*; Kiro and
  humans read it. `COORDINATION.md` layers *ownership* (a task table of
  owner/status/updated/note) and a *handoff log* on top. When the two disagree
  about completion, `tasks.md` wins.
- Coordination is keyed on the **spec folder name**, never `specId`.
- `COORDINATION.md` is a file Kiro ignores, so it survives Sync/Refine.
- The module follows the repo's pure-core pattern: parse/serialize/mutate are
  side-effect-free string functions (unit-tested), and only the thin
  `*Command` actions and small read/write helpers touch the filesystem.
- Commands: `list`, `status`, `claim` (refuses a task owned by another active
  agent unless `--force`), `release`, `done` (toggles the real `tasks.md`
  checkbox *and* updates coordination in one step), `reconcile` (repairs drift
  from `tasks.md`, never un-checking or deleting), and `handoff`.
- Where a `specId` must be created by hand (scaffolding outside the Kiro IDE),
  the module generates a real UUID v4 via `crypto.randomUUID()` rather than a
  fabricated string.

The `kiro-specs` knowledge artifact documents the file format, the
claim→work→complete→handoff protocol, and these commands.

## Consequences

### Positive

- Multiple agents can divide work on one spec without double-working or
  clobbering, with an auditable ownership table and handoff trail in git.
- Coordination state is Kiro-safe (untouched by Sync/Refine) and human-readable.
- `done` keeps `tasks.md` and coordination consistent through a single entry
  point, avoiding hand-edit races and malformed tables.
- Pure-core design keeps the logic unit-testable without filesystem or CLI.

### Negative

- Introduces a project-specific convention not part of the native Kiro spec
  format; other Kiro tooling won't know about `COORDINATION.md`.
- Two files can still drift if agents bypass the helper and hand-edit; mitigated
  by `reconcile` and the "tasks.md wins" rule, but not prevented.
- File-based claims are cooperative, not atomic locks — a true simultaneous
  claim race is possible, though small in practice for human-paced agent work.

### Neutral

- `COORDINATION.md` is seeded lazily from `tasks.md` on first use; specs without
  multi-agent work never need one.
- Agent identities are free-form strings (e.g. `code`, `cowork`); the convention
  recommends short stable names but does not enforce a registry.
