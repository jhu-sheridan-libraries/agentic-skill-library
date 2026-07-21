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

### Extension: dependencies, leases, and `next` (2026-07-17)

To make the parallel-agent story workable, the model was extended:

- **Task dependencies.** `ClaimEntry` gains `deps: string[]`. Dependencies are
  declared in `tasks.md` with a `_Depends: 1, 2.3_` marker (mirroring the
  existing `_Requirements:_` convention) and surfaced in a Deps column of
  `COORDINATION.md`. A task is not claimable until every dependency is `done`.
- **Claim leases.** `ClaimEntry` gains `leaseUntil: string | null`. A claim sets
  a lease (default 30 min); once it expires, the task is reclaimable by another
  agent without `--force`, so a crashed or abandoned claim can't block a task
  forever. Reaching `done`/`blocked` clears the lease.
- **`kanon spec next --agent <name>`.** Atomically selects the lowest-id task
  that is not done, has satisfied dependencies, and is unclaimed (or whose lease
  expired), then claims it — the single call an agent uses to pull work. This
  replaces read-then-claim with one operation, shrinking the claim race window.
- **`--json`** output on `list`/`status`/`next` for orchestrating agents.
- `COORDINATION.md` grew from a 5-column to a 7-column ownership table
  (adds Deps, Lease until); `parseCoordination` still reads the old 5-column
  layout for backward compatibility.

Selection, dependency, and lease logic are pure functions (`selectNextTask`,
`depsSatisfied`, `isLeaseExpired`, `isClaimable`), unit-tested independently of
the CLI and filesystem.

### Extension: a third `tasks.md` marker for in-progress (2026-07-21)

Kiro itself recognizes three checkbox markers in `tasks.md`, not two: `- [ ]`
(open), `- [~]` (checked out / in progress), and `- [x]` (done). The original
model only parsed `[ ]`/`[x]` — a `[~]` line silently failed `TASK_LINE_RE` and
vanished from `parseTaskLines`, invisible to `status`, `reconcile`, and the
done/total counts. This was a correctness gap, not just a doc omission: the
`TaskCoordStatus` enum already had `in-progress` as a value, but nothing wrote
`[~]` into `tasks.md` to represent it.

- `TaskLine.checked: boolean` became `TaskLine.status: "open" | "in-progress" |
  "done"`, matching the three real markers. `TASK_LINE_RE`'s marker group
  extended to `( |x|X|~)`.
- `setTaskChecked` (open/done only) is now a thin wrapper over a new
  `setTaskMarker(tasksMd, taskId, status)`, which can also write `[~]`.
- `reconcile` promotes an `open` row to `in-progress` when `tasks.md` shows
  `[~]` (e.g. a human or Kiro itself hand-edited the file), but never
  downgrades an existing `claimed`/`done` row — the same "never un-mark" rule
  as before, extended to the new marker.
- `kanon spec claim` and `kanon spec next` now write `[~]` into `tasks.md`
  when they claim a task (in addition to updating `COORDINATION.md`), so the
  in-progress state is visible directly in the file Kiro and humans read, not
  only in the sidecar. `kanon spec release` resets the marker back to `[ ]`.
  `kanon spec done` still finishes with `[x]`, which always wins over `[~]`.
  `next --dry-run` reports the pick without writing anything.
- Added a `kanon spec channel` alias for `kanon spec next` (no behavior
  change) for teams using the "Kirouija" framing documented in the
  `kiro-specs` knowledge artifact.

This closes the gap between what Kiro can render/write in `tasks.md` and what
`kanon spec` understands, without adding new files or growing
`COORDINATION.md`'s schema — `COORDINATION.md`'s five-state model (`open`,
`claimed`, `in-progress`, `done`, `blocked`) is unchanged; it's simply now
reflected accurately in `tasks.md`'s three-state marker instead of a
two-state approximation.

## Consequences

### Positive

- Multiple agents can divide work on one spec without double-working or
  clobbering, with an auditable ownership table and handoff trail in git.
- Coordination state is Kiro-safe (untouched by Sync/Refine) and human-readable.
- `done` keeps `tasks.md` and coordination consistent through a single entry
  point, avoiding hand-edit races and malformed tables.
- Pure-core design keeps the logic unit-testable without filesystem or CLI.
- Dependencies let independent tasks run in parallel while ordered ones wait,
  and `next` gives agents a single, low-friction way to pull the right work.
- Leases make the system self-healing: an abandoned claim is recovered
  automatically rather than requiring a human to notice and `release` it.

### Negative

- Introduces a project-specific convention not part of the native Kiro spec
  format; other Kiro tooling won't know about `COORDINATION.md`.
- Two files can still drift if agents bypass the helper and hand-edit; mitigated
  by `reconcile` and the "tasks.md wins" rule, but not prevented.
- File-based claims are cooperative, not atomic locks — a true simultaneous
  claim race is still possible (leases shrink but do not eliminate the window).
  Adequate for human-paced agent work; not a substitute for a real lock service.
- Lease expiry is wall-clock based: a legitimately long task can lose its lease
  if not re-claimed, and a very short `--lease` risks premature takeover.
- Dependencies are advisory (`--ignore-deps` exists) and only as good as the
  `_Depends:_` markers authors add; the system does not infer them.

### Neutral

- `COORDINATION.md` is seeded lazily from `tasks.md` on first use; specs without
  multi-agent work never need one.
- Agent identities are free-form strings (e.g. `code`, `cowork`); the convention
  recommends short stable names but does not enforce a registry.
