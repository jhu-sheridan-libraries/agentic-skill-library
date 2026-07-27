# Requirements Document

## Introduction

Context Bazaar currently runs two parallel spec-driven-development systems that don't know about each other. Kiro Specs (`.kiro/specs/<name>/`) track completion via `tasks.md` checkboxes, with `- [ ]` / `- [x]` as the shared source of truth understood by Kiro, humans, and the existing `kanon spec` coordination commands. Superpowers SDD tracks the same kind of work via a `docs/superpowers/plans/<slug>.md` implementation plan and a `.superpowers/sdd/progress.md` ledger that logs free-text lines like `Task 0: complete (commits 686134f..af0ea7e, review clean; ...)`. When the same underlying effort has a presence on both sides, the two completion records can drift out of agreement with no mechanism to notice or reconcile it.

This feature adds a `kanon spec sync` command that keeps *completion status only* in agreement between a linked Kiro spec and its superpowers counterpart — it does not merge or generate requirements/design prose, and it does not touch the superpowers plan's or ledger's hand-authored narrative content. A developer declares the link once via a small sidecar file in the Kiro spec folder; after that, `kanon spec sync` can be run at any time to detect and report drift, and to advance the superpowers side to match `tasks.md` when `tasks.md` shows a task done that the superpowers side does not yet reflect. Consistent with the existing multi-agent coordination convention in this codebase (`tasks.md` is completion truth; `reconcile` never un-checks a box), sync only ever advances completion — it never silently regresses a task that the superpowers ledger already reports as complete.

## Glossary

- **Kiro_Spec**: A feature or bugfix spec folder under `.kiro/specs/<name>/`, identified by its folder name. Its `tasks.md` checkboxes are the completion source of truth per existing convention.
- **Top_Level_Task**: A checkbox task in a Kiro spec's `tasks.md` with a non-decimal id (e.g. `1`, `2`, `3` — not `2.1`). Only top-level tasks participate in sync; sub-tasks are not individually matched to the superpowers side.
- **Superpowers_Plan**: The implementation plan file for a superpowers SDD effort, typically `docs/superpowers/plans/<date>-<slug>.md`, whose top-level sections (e.g. `### Task 0: ...`) enumerate the same work at a comparable granularity to a Kiro spec's top-level tasks.
- **Superpowers_Progress_Ledger**: The ledger file recording completion for a superpowers effort, e.g. `.superpowers/sdd/progress.md` (or an archived copy such as `progress-<slug>.md`). Contains free-text lines of the form `Task <n>: <status...>` in the same order as the effort's plan.
- **Ledger_Entry**: A single `Task <n>: ...` line parsed from a Superpowers_Progress_Ledger.
- **Link_Sidecar**: A file named `.superpowers-link.json`, placed inside a Kiro_Spec folder, declaring the repo-relative paths to that spec's linked Superpowers_Plan and Superpowers_Progress_Ledger.
- **Ordinal_Position**: The 0-based or 1-based rank of a Top_Level_Task or Ledger_Entry within its own document's natural order, independent of the literal id/number used on either side (Kiro top-level tasks conventionally start at `1`; superpowers ledgers observed in this repo start at `Task 0` — sync matches by position, never by comparing literal id strings across systems).
- **Sync_Status_Section**: A dedicated, clearly delimited section that `kanon spec sync` owns within the Superpowers_Progress_Ledger, used to record synced completion state without editing any pre-existing hand-authored line in that file.
- **Forward_Drift**: A Top_Level_Task is checked (`- [x]`) in `tasks.md` but its positionally-matched Ledger_Entry (or the Sync_Status_Section) does not yet show it complete.
- **Backward_Drift**: A positionally-matched Ledger_Entry (or Sync_Status_Section entry) reports a task complete, but the corresponding Top_Level_Task is unchecked (`- [ ]`) in `tasks.md`.

## Requirements

### Requirement 1: Declaring a link between a Kiro spec and a superpowers effort

**User Story:** As a developer working across both spec systems, I want to declare once that a given Kiro spec corresponds to a specific superpowers plan and progress ledger, so that `kanon spec sync` knows what to compare without me re-specifying it every run.

#### Acceptance Criteria

1. THE SYSTEM SHALL support a Link_Sidecar file named `.superpowers-link.json` inside a Kiro_Spec folder, containing at minimum a `plan` field (repo-relative path to the Superpowers_Plan) and a `ledger` field (repo-relative path to the Superpowers_Progress_Ledger).
2. THE SYSTEM SHALL provide a `kanon spec link <spec> --plan <path> --ledger <path>` command that creates or overwrites a spec's Link_Sidecar with real, validated paths.
3. IF a Kiro_Spec folder has no `.superpowers-link.json` THEN `kanon spec sync <spec>` SHALL report that the spec is not linked and SHALL exit without error and without modifying any file.
4. WHEN `kanon spec link` is given a `--plan` or `--ledger` path that does not exist on disk THEN THE SYSTEM SHALL reject the command with a clear error and SHALL NOT write the Link_Sidecar.

### Requirement 2: Parsing top-level completion state from a Kiro spec

**User Story:** As a developer, I want the sync command to read completion state only from top-level tasks, so that sub-task granularity differences between the two systems don't produce false drift.

#### Acceptance Criteria

1. THE SYSTEM SHALL parse a Kiro_Spec's `tasks.md` into an ordered list of Top_Level_Tasks, preserving document order and each task's checked/unchecked state.
2. THE SYSTEM SHALL exclude decimal-id sub-tasks (e.g. `2.1`) from the Top_Level_Task list used for sync matching.
3. IF `tasks.md` contains zero Top_Level_Tasks THEN THE SYSTEM SHALL report this as a reason no sync could be performed and SHALL NOT modify any file.

### Requirement 3: Parsing completion state from a superpowers progress ledger

**User Story:** As a developer, I want the sync command to read the superpowers side's completion state from its existing ledger format, so that no changes are required to how superpowers efforts are tracked today.

#### Acceptance Criteria

1. THE SYSTEM SHALL parse a Superpowers_Progress_Ledger into an ordered list of Ledger_Entries by matching lines of the form `Task <n>: <rest of line>`, preserving document order.
2. THE SYSTEM SHALL classify a Ledger_Entry as complete WHEN its text contains the word "complete" (case-insensitive), and as not complete otherwise.
3. IF the Link_Sidecar's `ledger` path does not exist on disk THEN THE SYSTEM SHALL treat the superpowers side as having zero Ledger_Entries (nothing yet recorded) rather than raising an error, since a ledger file may not exist yet for a newly linked effort.
4. WHEN a Sync_Status_Section already exists in the ledger file THEN THE SYSTEM SHALL parse synced completion state from that section in addition to hand-authored `Task <n>:` lines, preferring the Sync_Status_Section's record for a given position when both exist.

### Requirement 4: Positional matching between the two systems

**User Story:** As a developer, I want tasks matched by their order within each document, not by comparing literal task numbers, so that differing numbering conventions (Kiro starting at 1, superpowers ledgers observed starting at 0) don't cause silent mismatches.

#### Acceptance Criteria

1. THE SYSTEM SHALL match the 1st Top_Level_Task (in document order) to the 1st Ledger_Entry (in document order), the 2nd to the 2nd, and so on by Ordinal_Position, regardless of the literal id or number string used by either side.
2. THE SYSTEM SHALL NOT use the numeric value of a Kiro task id or a ledger `Task <n>` number as a matching key.
3. IF the count of Top_Level_Tasks differs from the count of Ledger_Entries THEN THE SYSTEM SHALL sync only the positions present on both sides and SHALL report the unmatched positions on the longer side as "unmatched" without error.

### Requirement 5: Detecting and classifying drift

**User Story:** As a developer, I want to know exactly where the two completion records disagree and in which direction, so that I can trust what sync will (and won't) change before or after it runs.

#### Acceptance Criteria

1. FOR each matched position, THE SYSTEM SHALL classify the pair as one of: in agreement (both done or both not done), Forward_Drift (Kiro done, superpowers not), or Backward_Drift (superpowers done, Kiro not).
2. THE SYSTEM SHALL produce a per-position drift report including the Kiro task id, its checked state, the matched Ledger_Entry text (or "none"), and the classification.

### Requirement 6: Auto-resolving forward drift

**User Story:** As a developer, I want the superpowers side automatically brought up to date when I've completed and checked off a task in Kiro, so that I don't have to hand-maintain two ledgers for the same work.

#### Acceptance Criteria

1. WHEN a matched position is classified as Forward_Drift THEN THE SYSTEM SHALL record that position as complete in the Superpowers_Progress_Ledger's Sync_Status_Section.
2. THE SYSTEM SHALL create the Sync_Status_Section in the ledger file if it does not already exist, delimited by an HTML comment identifying it as managed by `kanon spec sync` (mirroring the existing `COORDINATION.md` managed-file convention).
3. THE SYSTEM SHALL NOT modify, reorder, or remove any pre-existing hand-authored line in the Superpowers_Progress_Ledger outside the Sync_Status_Section.
4. WHEN `kanon spec sync` is run multiple times with no new Forward_Drift THEN THE SYSTEM SHALL leave the Sync_Status_Section's content unchanged (idempotent — no duplicate entries, no unnecessary rewrites).

### Requirement 7: Never auto-resolving backward drift

**User Story:** As a developer, I want the sync command to warn me rather than silently un-mark work as incomplete, so that a stale or premature superpowers ledger entry can't hide real completed work or corrupt a record a human already wrote.

#### Acceptance Criteria

1. WHEN a matched position is classified as Backward_Drift THEN THE SYSTEM SHALL report it as a warning and SHALL NOT modify `tasks.md`, the Ledger_Entry, or the Sync_Status_Section for that position.
2. THE SYSTEM SHALL exit with a non-zero status code WHEN any Backward_Drift is detected, distinct from the exit status used for Forward_Drift-only or fully-synced runs, so that Backward_Drift can be caught in automation without silently passing.

### Requirement 8: Reporting sync results

**User Story:** As a developer (or an orchestrating script), I want a clear summary of what sync found and changed, in both human-readable and machine-readable form.

#### Acceptance Criteria

1. THE SYSTEM SHALL print a human-readable summary after each run: counts of positions in agreement, Forward_Drift resolved, Backward_Drift warned, and unmatched positions.
2. WHERE a `--json` flag is provided, THE SYSTEM SHALL emit a machine-readable object containing the full per-position drift classification and the list of changes written, instead of the human-readable summary.
3. WHERE a `--dry-run` flag is provided, THE SYSTEM SHALL compute and report drift exactly as a normal run would, but SHALL NOT write to the Superpowers_Progress_Ledger.

### Requirement 9: Command integration and spec-status visibility

**User Story:** As a developer already using `kanon spec` for Kiro-side coordination, I want the superpowers link and sync state to be discoverable through the same command group, so I don't need a separate tool or mental model.

#### Acceptance Criteria

1. THE SYSTEM SHALL expose the sync command as `kanon spec sync [spec]` alongside the existing `list`, `status`, `next`, `claim`, `release`, `done`, `reconcile`, and `handoff` subcommands.
2. WHEN `kanon spec sync` is invoked with no spec argument THEN THE SYSTEM SHALL run sync for every Kiro_Spec that has a `.superpowers-link.json`, reporting each in turn, and SHALL NOT error solely because some specs are unlinked.
3. WHEN `kanon spec status <spec>` is invoked for a spec that has a Link_Sidecar THEN THE SYSTEM SHALL additionally display the linked plan/ledger paths and the most recent sync's summary counts.

### Requirement 10: Safety and non-destructive guarantees

**User Story:** As a developer, I want strong guarantees that this tool cannot corrupt either system's files, so that I can run it freely without reviewing a diff of hand-written prose every time.

#### Acceptance Criteria

1. THE SYSTEM SHALL NOT write to `tasks.md` under any circumstance — sync is one-directional (Kiro → superpowers) with respect to file writes.
2. THE SYSTEM SHALL NOT write to the Superpowers_Plan file under any circumstance.
3. IF a write to the Superpowers_Progress_Ledger would fail (e.g. permissions, disk error) THEN THE SYSTEM SHALL leave the file byte-for-byte unchanged and SHALL report the failure clearly rather than leaving a partial write.
