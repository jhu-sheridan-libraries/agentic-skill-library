---
name: kiro-specs
description: "Read, write, modify, and execute Kiro Specs — the three-phase spec-driven workflow (requirements → design → tasks) that lives in .kiro/specs/. Use when creating a new feature spec, updating requirements or design, or working through a tasks.md implementation plan."
---

## Overview

A Kiro Spec is a structured, spec-driven plan for a single feature or bug fix. It lives in `.kiro/specs/<feature-name>/` and consists of three files created and approved in order:

1. `requirements.md` (feature specs) or `bugfix.md` (bugfix specs) — what the work must do, as user stories with EARS-format acceptance criteria, or a bug's current/expected/unchanged behavior.
2. `design.md` — how it will be built: architecture, sequence diagrams, data models, error handling, and testing strategy.
3. `tasks.md` — a numbered, checkboxed implementation plan derived from the design.

Specs turn a vague request into a reviewable, incremental plan. The standard workflow is deliberately phased with an explicit approval gate between phases. Use this skill whenever you are asked to create a new spec, revise an existing one, or implement the work a spec describes.

The three markdown files carry **no in-file metadata** — no YAML frontmatter, no `id` field, no headers beyond normal markdown. Spec identity and configuration live in sidecar files alongside them:

- **`.config.kiro`** — a small JSON file Kiro writes for each spec, e.g. `{"specId": "9f8b6ecc-1b68-4f32-ba4d-fa0c03a44af0", "workflowType": "requirements-first", "specType": "feature"}`. `specId` is a UUID (v4), `workflowType` is `requirements-first` or `design-first`, and `specType` is `feature` or `bugfix`. Read this to learn a spec's type and workflow. If you are scaffolding a spec by hand outside the Kiro IDE (e.g. from Claude Code or Cowork), you may write it too — but generate a **real** UUID v4 for `specId` (`uuidgen`, `node -e "console.log(crypto.randomUUID())"`, or `python3 -c "import uuid;print(uuid.uuid4())"`); never fabricate a plausible-looking string. Note that `specId` is **not** unique across specs — copied or branched specs reuse the same id — so it is not a reliable coordination key.
- **`tasks.meta.json`** (optional) — Kiro's execution-history and property-based-test bookkeeping for `tasks.md`. Treat as read-only: Kiro maintains it during task execution; don't hand-edit.

**The folder name under `.kiro/specs/` is the spec's true identity.** Because `specId` can be duplicated, always key on the folder name (e.g. `user-authentication`) when identifying or coordinating on a spec.

`.kiro/specs/` is shared across all Kiro surfaces (IDE, CLI, Web) and the format is identical everywhere, so a spec started in one can be continued in another — which is exactly what makes specs a good medium for coordinating work across several agents (see "Coordinating work across agents" below).

## Spec types and workflows

There are two spec **types**:

- **Feature spec** — building new functionality. Uses `requirements.md`.
- **Bugfix spec** — diagnosing and fixing a bug surgically while preventing regressions. Uses `bugfix.md` instead of `requirements.md`, then the same `design.md` and `tasks.md`.

Feature specs support two **workflow variants**, which differ only in which document comes first:

- **Requirements-First** (default) — `requirements.md` → `design.md` → `tasks.md`. Use when you know the desired behavior and the architecture is flexible.
- **Design-First** — `design.md` → `requirements.md` → `tasks.md`. Use when you have an existing architecture or strict non-functional constraints, and want to derive feasible requirements from the design.

A third option, **Quick Plan** (called "Quick Spec" in the CLI), generates all three files in one pass **without** approval gates between phases. Use it only for well-understood work where the user explicitly wants speed over review; otherwise default to the gated workflow below.

## When to use a spec

Reach for a spec when the work is non-trivial: a new feature, a substantial refactor, a bug where regressions are costly, or anything where getting alignment before coding will save rework. For a one-line fix, a typo, or an obvious change, a spec is overhead — just do the work. When in doubt, ask the user whether they want a full spec (and which workflow), a Quick Plan, or a direct implementation.

## Directory layout

```
.kiro/
└── specs/
    ├── user-authentication/     ← kebab-case, one folder per feature/bug
    │   ├── requirements.md      (feature) or bugfix.md (bugfix spec)
    │   ├── design.md
    │   ├── tasks.md
    │   ├── .config.kiro         ← JSON sidecar: specId, workflowType, specType (Kiro-managed)
    │   └── tasks.meta.json      ← optional execution history (Kiro-managed)
    └── product-catalog/
        └── ...
```

Keep one folder per feature or bug rather than a single spec for the whole codebase — smaller, focused specs are easier to iterate and let people work independently. The folder name is kebab-case and describes the feature, not the phase: `user-authentication`, `csv-export`, `catalog-search`. The `.config.kiro` and `tasks.meta.json` sidecars are managed by Kiro; the three markdown files are the ones you read and edit. Don't add other files to a spec folder unless the user asks.

## The three-phase workflow

The phases are sequential and gated. **Do not advance to the next phase until the user has explicitly approved the current one.** After writing or revising each document, stop and ask a direct question like "Do the requirements look good? If so, we can move to design." Treat any substantive edit request as a reason to revise and re-ask, not to proceed.

### Phase 1 — Requirements

Goal: capture what the feature must do, unambiguously enough to design against.

Structure `requirements.md` as an introduction followed by numbered requirements. Each requirement has a user story and a set of acceptance criteria written in EARS format (Easy Approach to Requirements Syntax). EARS keeps criteria testable and free of hidden assumptions.

The core EARS patterns:

- **Ubiquitous** — always true: `THE SYSTEM SHALL <response>`
- **Event-driven** — `WHEN <trigger> THE SYSTEM SHALL <response>`
- **State-driven** — `WHILE <state> THE SYSTEM SHALL <response>`
- **Optional feature** — `WHERE <feature is included> THE SYSTEM SHALL <response>`
- **Unwanted behavior** — `IF <condition> THEN THE SYSTEM SHALL <response>`
- Combinations are allowed: `WHILE <state>, WHEN <trigger> THE SYSTEM SHALL <response>`

Template (matches Kiro's generated convention — `# Requirements Document`, numbered requirements with a user story and numbered criteria):

```markdown
# Requirements Document

## Introduction

<One or two paragraphs: the problem, who it's for, and the intended outcome.>

## Requirements

### Requirement 1: <short title>

**User Story:** As a <role>, I want <capability>, so that <benefit>.

#### Acceptance Criteria

1. WHEN <trigger> THE SYSTEM SHALL <response>
2. IF <error condition> THEN THE SYSTEM SHALL <response>
3. THE SYSTEM SHALL <invariant>

### Requirement 2: <short title>

**User Story:** As a <role>, I want <capability>, so that <benefit>.

#### Acceptance Criteria

1. WHEN <trigger> THE SYSTEM SHALL <response>
```

Criteria are numbered (1, 2, 3…) within each requirement — this is what `tasks.md` traces back to, using `requirement.criterion` references like `2.3`. The subject of `SHALL` can be a named component rather than the literal words "THE SYSTEM" (e.g. `THE SoukVectorClient SHALL …`) when the requirement is about a specific unit. An optional `## Glossary` of named terms before `## Requirements` is common in larger specs and helps keep criteria unambiguous.

Guidance: cover the happy path and the error and edge cases (invalid input, empty state, permission failures, limits). Keep each criterion atomic and testable — one behavior per line. Avoid design detail here; "how" belongs in the next phase. When requirements are drafted, stop and request approval before designing. For complex requirement sets, note that Kiro offers an **Analyze Requirements** step that checks for logical inconsistencies, ambiguities, and gaps before design — recommend it when interactions between many requirements matter.

### Phase 2 — Design

Goal: describe how the requirements will be met, with enough detail to break into tasks.

Design must trace back to requirements — every major component should serve at least one requirement, and every requirement should be addressed somewhere. Research as needed (read the codebase, check existing patterns) and fold conclusions directly into the document rather than leaving them in chat.

Template:

```markdown
# Design Document

## Overview

<How the feature works at a high level and how it fits the existing system.>

## Architecture

<Component breakdown, boundaries, and data flow. Mermaid diagrams — a
high-level system diagram and per-scenario request-flow / sequence diagrams —
are welcome and common where they clarify structure.>

## Components and Interfaces

<Each component: responsibility, inputs/outputs, key function or endpoint
signatures. A directory layout of new/changed files is useful here.>

## Data Models

<Schemas, types, or table definitions the feature introduces or changes.>

## Error Handling

<How failures surface and are recovered — tie back to the IF/THEN criteria.>

## Testing Strategy

<What is unit-tested, integration-tested, and how acceptance criteria are
verified. For correctness-critical work, Kiro can enumerate property-based
tests here as a "Correctness Properties" list.>

## Decisions and Trade-offs

<Notable choices and why the alternatives were rejected.>
```

Guidance: keep it concrete and reviewable, not exhaustive — enough for someone to implement without re-deriving your reasoning. Every requirement should be addressed somewhere in the design, and every major component should trace back to a requirement. When design is drafted, stop and request approval before writing tasks.

### Phase 3 — Tasks

Goal: convert the design into a sequence of discrete, actionable coding steps.

`tasks.md` is a numbered checklist of implementation steps. Each task is a checkbox item, ordered so that earlier tasks unblock later ones, and each references the requirement(s) it satisfies. Tasks should be coding actions only — writing, modifying, or testing code — not deployment, user testing, or process steps. Prefer test-first ordering and incremental, verifiable increments; avoid a single giant task.

Template:

```markdown
# Implementation Plan

- [ ] 1. <Set up scaffolding / data models>
  - <sub-step detail>
  - _Requirements: 1, 3_

- [ ] 2. <Implement core logic>
  - [ ] 2.1 <Write failing tests for the behavior>
    - _Requirements: 1_
  - [ ] 2.2 <Implement to make tests pass>
    - _Requirements: 1_

- [ ] 3. <Wire components together and integration-test>
  - _Requirements: 2, 4_
```

Use `- [ ]` for open tasks and `- [x]` for completed ones. Sub-tasks use decimal numbering (`2.1`, `2.2`), and each references the requirement criteria it satisfies via `_Requirements: 2.3, 5.1_` (i.e. `requirement.criterion`). Tasks may carry ordering dependencies and may be marked optional vs required. When tasks are drafted, stop and request approval before executing.

## Bugfix specs

A bugfix spec follows the same three phases but replaces `requirements.md` with `bugfix.md`, which models how an experienced developer scopes a fix — capturing three things explicitly:

```markdown
# Bug Analysis

## Current Behavior (Defect)

- WHEN <condition> THEN the system <incorrect behavior>

## Expected Behavior (Correct)

- WHEN <condition> THEN the system SHALL <correct behavior>

## Unchanged Behavior (Regression Prevention)

- WHEN <condition> THEN the system SHALL CONTINUE TO <existing behavior>
```

The "unchanged behavior" section is what makes the fix surgical: it tells the design phase what must keep working. The resulting `design.md` includes root-cause analysis, and `tasks.md` favors property-based tests that prove the bug is reproducible, that the fix works, and that nothing else regressed. Set `specType: bugfix` in `.config.kiro`. Use a bugfix spec for costly-to-regress or hard-to-root-cause bugs; a plain chat fix is fine for typos and obvious one-liners.

## Reading an existing spec

When asked to work with a spec that already exists:

1. List `.kiro/specs/` to find spec folders; read the files in a folder to load full context. Check `.config.kiro` for `specType` (`feature` vs `bugfix`) and `workflowType` (`requirements-first` vs `design-first`) so you know which document leads.
2. Determine the current phase from what exists and how complete it is: requirements/bugfix only → still in phase 1; that plus design → phase 2 done, ready for tasks; all present with a task list → ready to execute.
3. In `tasks.md`, checked boxes (`- [x]`) show completed work and unchecked (`- [ ]`) show what remains. The first unchecked task is normally the next to do. If the codebase may already implement some tasks (e.g. done in another session), offer to scan and reconcile the checkboxes before proceeding.
4. Summarize the spec's intent and current state back to the user before acting, so you are aligned on where things stand.

## Modifying a spec

Specs are living documents, but respect the phase ordering when changing them. If requirements change, update `requirements.md` first, then propagate the impact down to `design.md` and `tasks.md` — re-request approval at each level you touch. Do not silently edit design or tasks to match code that drifted; instead surface the drift and ask whether to update the spec or the code. Bump nothing version-wise inside the spec (specs are not versioned artifacts), but keep the three files internally consistent. When adding new tasks to an in-progress plan, preserve existing checkbox states.

## Executing a spec (guided task execution)

Execution means implementing the plan in `tasks.md` one task at a time, with the user in the loop. Do **not** run the whole plan autonomously.

The loop for each task:

1. **Confirm the target.** Identify the next unchecked task (or the specific task the user names). State which task you are about to start.
2. **Load context.** Re-read `requirements.md` and `design.md` as needed so the implementation matches the agreed plan and the task's referenced requirements.
3. **Implement only that task.** Write or modify exactly the code the task describes. Follow test-first ordering when the task calls for it. Do not skip ahead to later tasks.
4. **Verify.** Run the relevant tests, linter, or build for the change. Confirm the referenced acceptance criteria are actually met.
5. **Mark complete.** Update the checkbox from `- [ ]` to `- [x]` in `tasks.md` once the task is done and verified.
6. **Report and stop.** Summarize what changed and what the next task is, then pause for the user before continuing to the next task.

Rules of thumb during execution: implement one task per turn unless the user explicitly says to continue through several; never mark a task complete while its tests fail or the work is partial; if a task turns out to be underspecified or wrong given what you find in the code, stop and raise it rather than guessing; and if new work surfaces that the plan doesn't cover, propose adding a task rather than doing undocumented work.

Kiro itself also offers autonomous execution — "Run all Tasks" in the IDE (which builds a dependency graph and runs independent tasks concurrently in waves), and `/spec run <name>` in the CLI (sequential, with verification between tasks). Those are available if the user explicitly asks to run the whole plan; the guided one-task-at-a-time loop above is the default for this skill unless they opt into a full autonomous run.

## Referencing a spec in chat

In Kiro, `#spec` (or `#spec:<name>`) pulls a spec's full context — all its files — into the conversation, which keeps generated code aligned with the documented plan. It's the idiomatic way to say things like `#spec:user-authentication implement task 2.3`, request a design change, check whether an implementation meets a task's acceptance criteria, or ask why a design decision was made. When operating outside Kiro, achieve the same by reading the spec's files into context before acting.

## Coordinating work across agents

Because `.kiro/specs/` is shared and file-based, a spec is a natural place to divide and coordinate work between multiple agents — for example Claude Code and Cowork working the same feature, or several sessions running in parallel. The challenge is that `tasks.md` only carries `- [ ]` / `- [x]` — it records *whether* a task is done, but not *who owns it* or *what's in flight*. And Kiro rewrites `tasks.md` on Sync/Refine and only understands those two markers, so ownership annotations can't safely live inline.

The convention this skill uses: keep completion state in `tasks.md` (the shared source of truth Kiro understands), and keep ownership/coordination state in a separate **`COORDINATION.md`** sidecar in the spec folder. Kiro ignores `COORDINATION.md`, so it survives Sync/Refine and stays readable in diffs. It holds a task-ownership table and a running handoff log:

```markdown
# Coordination — user-authentication

## Task ownership

| Task | Owner  | Status      | Deps | Lease until          | Updated              | Note |
|------|--------|-------------|------|----------------------|----------------------|------|
| 2.1  | cowork | done        | —    | —                    | 2026-07-17T14:02:00Z | —    |
| 2.2  | code   | in-progress | 2.1  | 2026-07-17T14:50:00Z | 2026-07-17T14:20:00Z | —    |
| 3.1  | —      | open        | —    | —                    | —                    | —    |

## Handoffs

- 2026-07-17T14:20:00Z cowork → code: schema landed, wire up the API layer next
```

Statuses are `open`, `claimed`, `in-progress`, `done`, `blocked`. The completion signal in `tasks.md` and the `done` rows in `COORDINATION.md` should agree — when they drift, `tasks.md` wins (it's what Kiro and humans read). Two columns support parallel work: **Deps** lists task ids that must be `done` before this task can be claimed, and **Lease until** is a timestamp past which an owner's claim is considered stale and may be taken over automatically (so a crashed or wandered-off agent doesn't block a task forever).

The protocol each agent follows:

1. **Pull work.** Ask for the next actionable task rather than picking by hand — `kanon spec next --agent <name>` selects the lowest-id task whose dependencies are all done and that nobody actively holds, and claims it for you atomically. This is the call an agent makes most often.
2. **Work** exactly that task, following the guided-execution loop above.
3. **Complete**: check the box in `tasks.md` *and* set the row to `done` (one step via `kanon spec done`).
4. **Hand off**: record what you finished and what's next, so the next agent has context.

If you'd rather target a specific task instead of taking the next one, `kanon spec claim` a known id — it enforces the same dependency and ownership guards.

### Declaring dependencies

Give the selector something to reason about by declaring order in `tasks.md`, right next to the task, using a `_Depends:_` marker that mirrors the `_Requirements:_` convention:

```markdown
- [ ] 2. Core logic _Depends: 1_
  - [ ] 2.1 Write failing tests
  - [ ] 2.2 Implement _Depends: 2.1_
- [ ] 3. Independent docs
```

`kanon spec reconcile`, `status`, and `next` all read these markers. A task with unmet dependencies is reported as blocked and is skipped by `next` until its prerequisites are `done`. Tasks with no dependencies (like `3` above) stay available in parallel, which is what lets multiple agents fan out.

### Use the `kanon spec` helper

Rather than hand-editing these files (and risking races or malformed tables), use the CLI helper, which reads and writes both files consistently:

```bash
kanon spec list [--json]                                 # specs with type/workflow + progress
kanon spec status <spec> [--json]                        # ownership, progress, deps, leases, handoffs
kanon spec next <spec> --agent <name> [--lease <min>] [--dry-run] [--json]
                                                         # select + claim the next ready task
kanon spec claim <spec> <taskId> --agent <name> [--force] [--lease <min>] [--ignore-deps]
kanon spec release <spec> <taskId>                       # release a claim back to open
kanon spec done <spec> <taskId> --agent <name>           # check the box in tasks.md AND mark done
kanon spec reconcile <spec>                              # sync rows + deps to tasks.md
kanon spec handoff <spec> "<message>" --from <a> --to <b>
```

Key behaviors: `next` is the primary work-pulling call — it never hands back a blocked or actively-held task, and it reclaims tasks whose lease expired. `claim` refuses a task actively owned by a different agent (use `--force` to take over) and refuses a task with unmet dependencies (use `--ignore-deps` to override); a claim whose lease has expired is *not* a conflict and can be reclaimed without `--force`. `done` toggles the real `tasks.md` checkbox and marks coordination done in one step. `reconcile` repairs drift — adding rows for new tasks, adopting `_Depends:_` markers, and marking rows done where the checkbox is checked (never un-checking or deleting). `--json` on `list`/`status`/`next` gives an orchestrating agent machine-readable state. If `COORDINATION.md` doesn't exist yet, any command seeds it from the current `tasks.md`.

Leases default to 30 minutes. A long-running task should be re-claimed (or use `--lease` with a larger value) so its lease doesn't lapse while legitimately in progress; conversely, if an agent stops, the lease lets the next agent recover the task automatically once it expires.

Recommended agent naming: use short, stable identifiers like `code` and `cowork` (or per-session names when several sessions of the same tool run at once) so ownership is unambiguous in the table and handoff log.

## Common mistakes

Writing design detail into requirements, or requirements into tasks — keep each phase in its lane. Skipping approval gates and racing to code (unless the user chose Quick Plan or an autonomous run). Marking tasks complete prematurely. Editing `tasks.md` to match drifted code instead of surfacing the drift. Adding YAML frontmatter or an `id` field to the markdown files — identity lives in `.config.kiro`, not the markdown. Fabricating a `specId` instead of generating a real UUID, or hand-editing `tasks.meta.json`. Keying coordination on `specId` (it can be duplicated) instead of the folder name. Recording ownership inline in `tasks.md` where Kiro will strip it on Sync/Refine, instead of in `COORDINATION.md`. Starting a task without checking `COORDINATION.md`, so two agents do the same work.

## Quick reference

| You are asked to... | Do this |
|---------------------|---------|
| Start a new feature spec | Create `.kiro/specs/<name>/`, write `requirements.md` (requirements-first) or `design.md` (design-first), request approval; let Kiro create `.config.kiro` |
| Fix a bug via spec | Same folder pattern but write `bugfix.md` (current / expected / unchanged behavior); `specType: bugfix` |
| Continue an existing spec | Read the spec's files, check `.config.kiro` for type/workflow, identify the phase, summarize state, then proceed |
| Change what the spec covers | Edit the lead document first (requirements or design), propagate down to tasks, re-approve each touched level |
| Implement the plan | Guided execution loop: one task, verify, check the box, report, pause (or an autonomous run if the user asks) |
| Check progress | Count `- [x]` vs `- [ ]` in `tasks.md`; first unchecked is next |
| Need a specId by hand | Generate a real UUID v4 (`uuidgen` / `crypto.randomUUID()` / `uuid.uuid4()`) — never fabricate one |
| Split work across agents | `kanon spec next --agent <name>` to pull the next ready task, `kanon spec done` to complete, `kanon spec handoff` to pass context; ownership lives in `COORDINATION.md`, completion in `tasks.md` |
| Order tasks / express blockers | Add `_Depends: <ids>_` markers in `tasks.md`; `next` skips blocked tasks and runs independent ones in parallel |
| Recover a task from a stalled agent | Nothing manual — the claim's lease expires (default 30 min) and `next`/`claim` reclaim it automatically |
| Identify a spec | Use the folder name, never `specId` (it can be duplicated across specs) |

## License, Privacy & Support

---
**License:** MIT (SPDX: `MIT`)
**Privacy Policy:** Knowledge-only documentation. Collects no telemetry and transmits no data.
**Author:** Johns Hopkins DRCC
**MCP servers:** None — this is knowledge-only documentation.
