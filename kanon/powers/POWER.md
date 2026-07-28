---
name: factory-harness
displayName: Factory Harness
description: The team-architecture factory. Turns a domain or project description into a reusable agent team and the skills they use, using six team patterns (Pipeline, Fan-out/Fan-in, Expert Pool, Producer-Reviewer, Supervisor, Hierarchical Delegation). Use this whenever someone asks to build, compose, set up, design, engineer, audit, sync, or evolve a harness; scaffold specialist agents and the skills they use; or stand up domain automation. It realizes the same team natively on each harness — Claude Code agent teams plus skills, Codex AGENTS.md plus repo-local skills, Kiro powers plus steering plus agent hooks.
keywords: ["harness","agent-team","team-architecture","meta-skill","orchestration","multi-agent","skill-architect","pipeline","fan-out-fan-in","expert-pool","producer-reviewer","supervisor","hierarchical-delegation","agent-scaffolding"]
author: robin (revfactory), adapted for Kanon by Steven J. Miklovic
---
<!-- forge:version 0.1.1 -->

# Factory Harness — Agent Team & Skill Architect

A **harness** is the repo-local system that turns a domain into an agent team
and the skills that team uses. Factory Harness is the meta-skill that designs
that system: it analyzes a domain, picks a team-architecture pattern, defines
specialist agents, generates the skills they use, wires them into an
orchestration, validates the result, and keeps it evolving.

It compiles to three harnesses and realizes the same team natively on each:

- **Claude Code** — agent teams (`.claude/agents/`) + skills (`.claude/skills/`), self-coordinating through team messaging, with a `CLAUDE.md` pointer.
- **Codex** — repo-local skills (`.codex/skills/<name>/SKILL.md`) + a short always-loaded `AGENTS.md`, coordinating through file-based handoffs in `_workspace/`.
- **Kiro** — a power (`POWER.md` + steering) with agent hooks for automation and specs for structured execution.

## Core Principles

1. **Separate who from how.** Agents define *who* does the work (role, principles, protocol). Skills define *how* the work is done. Keep them in separate files so both are reusable next session.
2. **Prefer the smallest architecture that holds quality.** Start single-agent; add a team only when collaboration, parallelism, or review genuinely improve the result.
3. **Make every artifact reusable and discoverable.** Every generated skill starts with YAML frontmatter (`name` + `description`) so native discovery can find it. Names are kebab-case and deterministic.
4. **Keep coordination rippable.** Isolate model-specific retries, recovery heuristics, and runtime cleverness in removable sections. A harness should survive a model upgrade.
5. **A harness evolves.** It is not a one-shot artifact. After every run, fold feedback back into the agents, skills, and orchestrator, and record the change.

## When to Use

- Standing up a new domain/project automation system from a description.
- Adding or reworking specialist agents and the skills they use.
- Auditing, syncing, or evolving an existing harness (drift detection, role merges, trigger fixes).

Do **not** use it for a one-off task that an existing single skill already covers — adding reusable structure there is pure overhead.

## Workflow at a Glance

The full method is an eight-phase loop. Each phase has a detailed reference;
load the phase file only when you reach it (progressive disclosure).

| Phase | Purpose | Reference |
|-------|---------|-----------|
| 0 | Audit existing harness; branch into new / extend / maintain | `phase-0-audit` |
| 1 | Domain analysis — tasks, outputs, quality bar, reuse | `phase-1-domain-analysis` |
| 2 | Team architecture — execution mode + pattern choice | `phase-2-architecture` |
| 3 | Role/agent definitions (dedup against existing) | `phase-3-roles` |
| 4 | Skill generation (dedup, progressive disclosure) | `phase-4-skills` |
| 5 | Integration & orchestration + data-handoff protocol | `phase-5-orchestration` |
| 6 | Validation & testing (structure, triggers, dry-run) | `phase-6-validation` |
| 7 | Evolution — feedback capture and change history | `phase-7-evolution` |

On an existing harness, run Phase 0 first, then execute only the phases the
change actually needs (see the Phase Selection Matrix in `phase-0-audit`).

## Execution Modes

Two or more cooperating agents is the trigger to consider a **team**. Pick the
mode before the pattern:

| Mode | Use when | Mechanism |
|------|----------|-----------|
| **Agent team** (default for 2+) | Real-time coordination, feedback exchange, cross-referencing intermediate work | Self-coordination via the harness's native team/handoff primitives |
| **Sub-agent** (alternative) | One bounded task whose result returns to the caller; team comms would be pure overhead | Spawn a worker, collect its return value |
| **Hybrid** | Phases differ in character (e.g. parallel gather → consensus synthesis) | Mode chosen per phase, stated in the orchestrator |

How each mode is realized differs per harness — see **Harness Realization**.

## Architecture Patterns

Decompose the work, then choose the smallest pattern that preserves quality
and clarity. Full decision guidance and per-pattern tradeoffs live in
`reference-agent-design-patterns`.

| Pattern | Best for |
|---------|----------|
| Pipeline | Sequential dependent work |
| Fan-out/Fan-in | Parallel independent work, later synthesis |
| Expert Pool | Selective routing to a subset of specialists |
| Producer-Reviewer | Generation followed by explicit quality review |
| Supervisor | Dynamic allocation across a changing backlog |
| Hierarchical Delegation | Naturally layered decomposition |

## Harness Realization

The same team maps onto different native primitives. This is where the harness
specialities earn their keep — read `reference-harness-realization` for the
full mapping, file layouts, and per-harness checklists. In short:

- **Claude Code** — generate `.claude/agents/{role}.md` and `.claude/skills/{name}/SKILL.md`; default to an agent team that self-coordinates; register a minimal pointer in `CLAUDE.md`. Agent teams and sub-agents are first-class.
- **Codex** — generate `.codex/skills/{name}/SKILL.md` (frontmatter + lean body + `references/`) and a short, pointer-heavy `AGENTS.md`; coordinate through deterministic `_workspace/{phase}_{role}_{artifact}.md` handoffs; register MCP servers in `.codex/config.toml`. Keep recovery logic rippable.
- **Kiro** — generate a power (`POWER.md` + `steering/`), use **agent hooks** for automation (post-task validation, manual harness audit) and **specs** for structured multi-step execution; register MCP servers in `mcp.json`.

## Skill Authoring Principles

These apply to every skill the harness generates (detail in `phase-4-skills`):

- **Trigger aggressively.** `description` is the only trigger mechanism. State what the skill does *and* concrete trigger situations, including follow-up phrasings ("re-run", "update just the X"). Distinguish it from near-miss skills.
- **Explain why, not just what.** Prefer reasons over `ALWAYS/NEVER` commands; a model that understands the reason handles edge cases.
- **Stay lean.** Target < 500 lines in the main file; push bulky or conditional detail into `references/` with a pointer.
- **Progressive disclosure.** Metadata (always) → main body (on trigger) → references (on demand). Add a ToC to references over ~300 lines.
- **Generalize.** Teach the principle, not an overfit rule.

## Validation & Evolution

- Verify structure, paths, and cross-references; confirm no dead links in the data-handoff plan (`phase-6-validation`).
- Test each skill with 2–3 realistic prompts and trigger sets (should-trigger and near-miss should-NOT-trigger).
- After every run, offer the user a chance to give feedback, route it to the right artifact, and record it in the change history (`phase-7-evolution`).

## Output Checklist

- [ ] Agent/role definitions created as files (not inline prompts).
- [ ] Skills generated with frontmatter, pushy descriptions, and follow-up triggers.
- [ ] One orchestrator that names the execution mode, data-handoff protocol, error handling, and test scenarios.
- [ ] Existing agents/skills checked for duplication before adding new ones.
- [ ] Realized natively for the running harness (see Harness Realization).
- [ ] Pointer + change-history registered in the harness's always-loaded file (`CLAUDE.md` / `AGENTS.md` / Kiro steering).

## Reference Pointers

- `phase-0-audit` … `phase-7-evolution` — the eight phases in detail.
- `reference-agent-design-patterns` — the six patterns, execution-mode comparison, agent-separation and reuse criteria.
- `reference-harness-realization` — how teams, skills, handoffs, and MCP map onto Claude Code, Codex, and Kiro, with per-harness file layouts and checklists.

## Phase 0 Audit

When the harness skill triggers, audit the current state **before** generating anything.

## Steps

1. Read the harness's native locations for the running harness:
   - Claude Code — `.claude/agents/`, `.claude/skills/`, `CLAUDE.md`
   - Codex — `.codex/skills/` (and `.agents/skills/`), `AGENTS.md`, `.codex/config.toml`
   - Kiro — `.kiro/steering/`, any installed power, `.kiro/specs/`, `.kiro/hooks`
2. Branch into an execution mode:
   - **New build** — no agents/skills present → run Phases 1–7 fully.
   - **Extend** — a harness exists and new agents/skills are requested → run only the phases the change needs (matrix below).
   - **Maintain** — audit, fix, or sync an existing harness → go to the Maintenance Workflow.
3. Compare the actual agent/skill files against what the orchestrator and the always-loaded pointer claim. Flag any **drift**.
4. Summarize the audit for the user and confirm the execution plan before proceeding.

## Phase Selection Matrix (Extend)

| Change | P1 | P2 | P3 | P4 | P5 | P6 |
|--------|----|----|----|----|----|----|
| Add agent | skip | placement only | required (incl. dedup) | only if a new skill is needed | update orchestrator | required |
| Add/modify skill | skip | skip | skip | required (incl. dedup) | only if wiring changes | required |
| Architecture change | skip | required | affected agents only | affected skills only | required | required |

## Maintenance Workflow

1. **Audit** — diff the agent/skill files against the orchestrator's roster; produce a drift list; report it.
2. **Incremental change** — apply one add/modify/remove at a time; after each, immediately sync.
3. **Record** — append to the change-history table (date, change, target, reason).
4. **Verify** — structure-check the touched artifacts; trigger-check if triggers changed; for large changes (architecture, 3+ agents) also run execution and dry-run tests; confirm the pointer file matches reality.

## Phase 1 Domain Analysis

Understand the domain before designing the team.

## Steps

1. Identify the domain/project from the request and the repository.
2. Enumerate the core task types (generate, validate, edit, analyze, research, review).
3. Using the Phase 0 audit, note conflicts and overlaps with existing agents/skills.
4. Explore the codebase if one exists — tech stack, data models, key modules, existing docs.
5. Capture the expected final deliverables, constraints, quality bar, and failure tolerance.
6. **Detect user proficiency** from conversational cues and tune your tone. Do not use unexplained jargon (`assertion`, `JSON schema`) with a less technical user.
7. If the request is an iterative-experiment workflow, define the mutable surface, the immutable evaluation surface, the baseline requirement, and the metric before generating anything.

## Output

- A concise domain summary.
- A task inventory.
- Reuse notes for any existing material worth preserving.

Hold these in `_workspace/01_analysis_domain.md` (or the harness equivalent) so later phases and re-runs can read them.

## Phase 2 Architecture

Design the team: choose an execution mode, then a pattern.

## 2-1. Execution Mode

Two or more cooperating agents is the trigger to consider a team. Decision order:

1. Can this be an agent team? If 2+ agents collaborate, that is the default.
2. Choose **sub-agent** only when team communication is structurally unnecessary (result-passing only) and the coordination overhead outweighs the benefit.
3. If phases differ in character, go **hybrid** and state each phase's mode in the orchestrator.

How each mode runs is harness-specific — see `reference-harness-realization`.

## 2-2. Pattern Selection

Decompose the work into specialist areas, then pick the smallest pattern that
preserves quality. The six patterns and their decision tradeoffs are in
`reference-agent-design-patterns`:

- Pipeline — sequential dependent work.
- Fan-out/Fan-in — parallel independent work, later synthesis.
- Expert Pool — selective routing to a subset of specialists.
- Producer-Reviewer — generation plus an explicit review step.
- Supervisor — central agent manages a changing backlog.
- Hierarchical Delegation — recursive delegation down one shallow layer.

## 2-3. Agent Separation

Judge along four axes: specialization, parallelism, context pressure, reuse.
Prefer a few focused agents over many thin ones — coordination overhead grows
with team size. Defer dedup against existing agents to Phase 3.

## Output

- Chosen execution mode (and per-phase modes if hybrid).
- Chosen pattern.
- Role list, handoff plan, and artifact-naming convention.

## Phase 3 Roles

Define each stable role as a file. Never bury a role in an inline prompt — a
role must persist as a file to be reusable next session.

## 3-0. Dedup First

Before creating an agent, check the existing roster (`.claude/agents/`,
`.codex/skills/` role briefs, Kiro steering). Repeated harness builds accumulate
overlapping roles under different names. Reuse or generalize instead of cloning.

## Required Sections

Each role definition includes: core role, working principles, input/output
protocol, error handling, and collaboration. In team mode add a **Team
Communication Protocol** section naming who it sends to/receives from and the
scope of work it may request.

## Re-invocation Behavior

State what the role does when prior outputs already exist: read the previous
result and improve it; if the user gave feedback, change only the affected part.

## Model

Use the strongest reasoning model available — harness quality tracks the
agents' reasoning quality.

## QA Roles

If the harness includes QA:

- Give QA an execution-capable type (it must run validation scripts, not just read).
- QA's value is **cross-boundary comparison** — read both sides of an interface (e.g. API response and the front-end hook) and compare their shapes.
- Run QA **incrementally** after each module, not once at the end.
- See `reference-agent-design-patterns` for the QA methodology and bug patterns.

## Output

- Role inventory, file layout, and a per-role input/output contract.

## Phase 4 Skills

Generate the skills the agents use. A skill captures *how* the work is done;
the agent captures *who* does it.

## 4-0. Dedup First

Check existing skills for overlap before creating a new one. Generalize a
near-duplicate rather than adding a parallel skill.

## 4-1. Structure

```
skill-name/
├── SKILL.md            (required — YAML frontmatter: name, description; then body)
└── references/         (optional — conditionally loaded detail)
    scripts/            (optional — deterministic helper code)
    assets/             (optional — templates, images used in output)
```

## 4-2. Description — Trigger Aggressively

`description` is the only trigger mechanism, and models judge triggers
conservatively, so write it to be pushy. State what the skill does **and**
concrete trigger situations, including follow-up phrasings ("re-run", "update
just the X", "improve the previous result"). Distinguish it from near-miss
skills that should not fire.

Bad: `"A skill that processes PDFs."`
Good: `"Read, extract, merge, split, watermark, OCR — every PDF operation.
Use whenever a .pdf is mentioned or a PDF deliverable is requested."`

## 4-3. Body Principles

- **Why over what** — give reasons, not bare `ALWAYS/NEVER`. A model that understands the reason handles edge cases.
- **Lean** — target < 500 lines; move weight to `references/`.
- **Generalize** — teach the principle, avoid overfitting to one example.
- **Bundle repeated code** — if agents keep writing the same helper, ship it in `scripts/`.
- **Imperative voice** — "do X", "prefer Y".

## 4-4. Progressive Disclosure

Metadata (name + description, always loaded) → SKILL.md body (on trigger) →
`references/` (on demand). Add a table of contents to references over ~300
lines. Split framework/domain variants into separate reference files so only
the relevant one loads.

## 4-5. Skill ↔ Agent Linking

One agent uses 1..N skills; a skill may be shared by several agents. Skills
hold *how*; agents hold *who*.

## Output

- Specialist skills, an optional orchestrator skill, and progressive-disclosure references.

## Phase 5 Orchestration

The orchestrator is a special skill that weaves individual agents and skills
into one workflow. Individual skills say "what each agent does"; the
orchestrator says "who collaborates, when, in what order". On an existing
harness, modify the orchestrator rather than creating a new one.

## 5-1. Data-Handoff Protocol

Name how data moves between agents:

| Strategy | Mechanism | Best for |
|----------|-----------|----------|
| Message-based | Native team messaging | Real-time coordination, feedback |
| Task-based | Shared task list | Progress tracking, dependencies |
| File-based | Agreed paths in `_workspace/` | Large/structured artifacts, audit trail |
| Return-value | Worker return message | Sub-agent result collection |

Recommended (team): task-based (coordination) + file-based (artifacts) +
message-based (live comms). Recommended (sub-agent): return-value +
file-based. The native mechanism per harness is in
`reference-harness-realization`.

File-based rules:

- Stage intermediate artifacts under `_workspace/`.
- Name them `{phase}_{role}_{artifact}.{ext}` (e.g. `01_analyst_requirements.md`).
- Emit only final artifacts to the user's path; preserve `_workspace/` for audit and re-runs.

## 5-2. Error Handling

Retry once; on a second failure, proceed without that result and note the gap
in the report. Never delete conflicting data — keep both and cite sources.

## 5-3. Team Size

| Scale | Members | Tasks/member |
|-------|---------|--------------|
| Small (5–10 tasks) | 2–3 | 3–5 |
| Medium (10–20) | 3–5 | 4–6 |
| Large (20+) | 5–7 | 4–5 |

Three focused members beat five scattered ones.

## 5-4. Register the Pointer

Record a minimal pointer in the harness's always-loaded file (`CLAUDE.md`,
`AGENTS.md`, or Kiro steering): goal, trigger rule, and a change-history table.
Do **not** duplicate the agent/skill roster or directory tree there — those
live in the files themselves.

## 5-5. Follow-up Support

1. Put follow-up phrasings in the orchestrator description ("re-run", "update", "improve the previous result").
2. Add a context-check at the start of the workflow: existing `_workspace/` + partial-edit request → partial re-run; existing `_workspace/` + new input → fresh run (move old to `_workspace_prev/`); no `_workspace/` → initial run.
3. Ensure each role definition states its behavior when prior outputs exist.

## Output

- An orchestrator naming execution mode, handoff protocol, error handling, and test scenarios.

## Phase 6 Validation

Validate the generated harness before declaring it done.

## 6-1. Structure

- Every agent/role file is in the right native location.
- Every skill has valid frontmatter (`name`, `description`).
- Cross-references between agents and skills are consistent.
- No stray command/slash artifacts were created unless intended.

## 6-2. Execution-Mode Checks

- **Team** — verify communication paths, task dependencies, and team-size fit.
- **Sub-agent** — verify each worker's I/O wiring and result collection.
- **Hybrid** — verify each phase's mode is stated and that data crosses phase boundaries intact (a team's output feeds the next sub-agent's input).

## 6-3. Skill Execution Test

For each skill, write 2–3 realistic prompts and run them. Where possible run
with-skill vs without-skill in parallel to confirm the skill adds value.
Evaluate output qualitatively (review) and quantitatively (assertions where
objectively checkable). On problems, **generalize** the fix into the skill and
re-test until stable. Bundle any helper code the tests keep re-creating.

## 6-4. Trigger Validation

- 8–10 should-trigger queries (formal/casual, explicit/implicit).
- 8–10 should-NOT-trigger near-miss queries. A good near-miss has an ambiguous boundary (e.g. "extract the chart from this xlsx as PNG" — spreadsheet skill vs image converter), not an obviously unrelated query.
- Check for trigger collisions with existing skills.

## 6-5. Dry-Run

- The orchestrator's phase order is logical.
- No dead links in the data-handoff path.
- Every agent's input matches the prior phase's output.
- Each error scenario has a runnable fallback.

## 6-6. Test Scenarios

Add a `## Test Scenarios` section to the orchestrator with at least one normal
flow and one error flow.

## Phase 7 Evolution

A harness is a living system. Keep it evolving from real feedback.

## 7-1. Collect Feedback

After every run, offer the user a chance to react ("anything to improve?",
"want to change the team or workflow?"). Don't force it; always provide it.

## 7-2. Route Feedback

| Feedback type | Fix target | Example |
|---------------|-----------|---------|
| Output quality | the relevant skill | "analysis too shallow" → add depth criteria |
| Agent role | the agent definition | "need security review" → add an agent |
| Workflow order | the orchestrator | "validate earlier" → reorder phases |
| Team composition | orchestrator + agents | "merge these two" → combine agents |
| Missing trigger | the skill description | "this phrasing didn't fire" → extend description |

## 7-3. Change History

Record every change in the always-loaded pointer's change-history table:

```markdown
| Date | Change | Target | Reason |
|------|--------|--------|--------|
| 2026-04-05 | Initial build | all | - |
| 2026-04-07 | Added QA agent | agents/qa | output-quality feedback |
```

This tracks the harness's direction and guards against regression.

## 7-4. Proactive Evolution Triggers

Propose evolution even without an explicit request when:

- The same kind of feedback repeats twice or more.
- An agent fails in a repeating pattern.
- The user keeps bypassing the orchestrator to work by hand.

## Reference Agent Design Patterns

Decision guidance for execution mode, the six team patterns, agent separation,
and reuse.

## Execution Mode Comparison

| | Agent team | Sub-agent | Hybrid |
|---|-----------|-----------|--------|
| Coordination | self-organizing, live | none (result only) | per phase |
| Best for | discovery sharing, conflict debate, gap-filling | bounded parallel work | mixed-character phases |
| Cost | comms overhead | no shared context | both, managed per phase |

Default to a team for 2+ collaborating agents. Drop to sub-agents only when
comms add nothing. Go hybrid when phases genuinely differ.

## The Six Patterns

- **Pipeline** — each phase depends on the previous artifact. Sequential orchestrator + `_workspace/` handoffs.
- **Fan-out/Fan-in** — specialists work independently, then a synthesis step merges. Bounded parallel workers + a final synthesizer.
- **Expert Pool** — only the relevant specialists are invoked per request. Routing rules + reusable specialist skills.
- **Producer-Reviewer** — output quality is enforced by a paired reviewer with a bounded revision loop.
- **Supervisor** — one coordinator owns a changing backlog and redistributes work with explicit reassignment rules.
- **Hierarchical Delegation** — a top-level goal splits into sub-goals coordinated one shallow layer down. Keep it shallow.

## Agent Separation Criteria

Split a role out when it scores high on:

- **Specialization** — distinct expertise/instructions.
- **Parallelism** — can run independently of siblings.
- **Context pressure** — its context would crowd out others.
- **Reuse** — useful across multiple workflows.

If none apply strongly, keep it folded into an existing agent.

## Reuse Design

When a candidate overlaps an existing agent/skill:

- **Identical** — reuse as-is.
- **Superset** — generalize the existing one to cover both.
- **Partial overlap** — extract the shared part into a skill both use.
- **Coincidental name clash** — rename for clarity; keep separate.

## QA Methodology

QA's failures are usually at **boundaries**, not within a module. Read both
sides of each interface and compare shapes (request/response vs consumer
expectation; schema vs serializer; config vs reader). Run QA incrementally per
module. Give QA execution capability so it can run validators, not just read.
Typical boundary bugs: field-name drift, optional/required mismatch, null
handling, enum divergence, unit/format mismatch, off-by-one pagination,
timezone/encoding assumptions.

## Reference Harness Realization

The same team-architecture maps onto each harness's native primitives. Realize
it the native way — that is where the harness specialities pay off. Determine
the running harness first, then follow its section.

## Claude Code

Strength: true multi-agent teams and a rich skills system.

File layout:

```
.claude/agents/{role}.md          # who — role, principles, team protocol
.claude/skills/{name}/SKILL.md     # how — frontmatter + body + references/
CLAUDE.md                          # always-loaded pointer + change history
.claude/settings.json              # agent_stop run-command hooks (optional)
```

Realization:

- **Default to an agent team.** Members self-coordinate via the team's native messaging and a shared task list; the orchestrator/leader assembles the team, assigns tasks, monitors, and synthesizes.
- **Sub-agents** are the alternative for bounded parallel work; run in the background and collect return values.
- **Re-teaming** — one active team per session, but teams can be torn down and rebuilt between phases (save outputs to files first).
- Use the strongest model for every agent.
- `CLAUDE.md` holds only the trigger rule + change history — never the full roster.

Checklist: agent files exist (even for built-in types); skills have pushy
descriptions; orchestrator names the mode and handoffs; `CLAUDE.md` pointer
registered; no slash-command files unless intended.

## Codex

Strength: a short always-loaded `AGENTS.md` plus portable repo-local skills and
deterministic file handoffs. Prefer simple, rippable coordination over runtime
cleverness.

File layout:

```
AGENTS.md                              # short, repo-wide WHAT/WHY/HOW + pointer
.codex/skills/{name}/SKILL.md          # frontmatter + lean body
.codex/skills/{name}/references/*      # progressive-disclosure detail
.codex/config.toml                     # [mcp_servers.<name>] entries
_workspace/{phase}_{role}_{artifact}.md # deterministic handoffs
docs/harness/{domain}/team-spec.md     # role topology, handoffs, failure policy
```

Realization:

- **Single main agent by default.** Spawn workers (profiles / `codex exec`) only for clearly parallelizable, bounded slices.
- **Coordinate through files**, not assumed peer messaging — `_workspace/` handoffs are the contract.
- Keep `AGENTS.md` short and pointer-heavy; it loads every session. Put conditional detail in skills/docs and point to it. Read the AGENTS.md guidance before writing it.
- Every generated `SKILL.md` starts with YAML frontmatter (`name`, `description`) for native discovery.
- Keep model-specific retries and recovery in **rippable** sections that survive a model upgrade.
- Register MCP servers in `.codex/config.toml` under `[mcp_servers.<name>]`.

Checklist: `AGENTS.md` short and pointer-heavy; skills have frontmatter;
`_workspace/` handoffs deterministic and preserved; recovery logic isolated;
no platform runtime assumptions unless the repo already depends on them.

## Kiro

Strength: powers, steering, agent hooks, specs, and MCP — automation and
structured execution.

File layout:

```
POWER.md                       # capability overview + activation
steering/{name}.md             # the orchestrating knowledge
steering/<workflow files>      # phase detail
*.kiro.hook                    # agent hooks (automation)
.kiro/specs/{feature}/         # structured multi-step execution
mcp.json                       # MCP servers
```

Realization:

- Express the harness as a **power** (`POWER.md` + steering) so it is discoverable and activatable.
- Use **agent hooks** for automation: a `userTriggered` hook to run a harness audit, a `postTaskExecution` hook to validate generated artifacts.
- Use **specs** (requirements → design → tasks) for structured, reviewable multi-step builds.
- Sub-agents/teams are partial on Kiro; lean on hooks + specs + steering to coordinate, and capture intermediate work in files.
- Register MCP servers in `mcp.json`.
- Record the pointer + change history in steering.

Checklist: `POWER.md` present; steering carries the workflow; hooks valid
against the Kiro hook schema; MCP registered; pointer + change history in
steering.
