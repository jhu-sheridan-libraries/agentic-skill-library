---
name: factory-harness
displayName: Factory Harness
description: "The team-architecture factory. Turns a domain or project description into a reusable agent team and the skills they use, using six team patterns (Pipeline, Fan-out/Fan-in, Expert Pool, Producer-Reviewer, Supervisor, Hierarchical Delegation). Use this whenever someone asks to build, compose, set up, design, engineer, audit, sync, or evolve a harness; scaffold specialist agents and the skills they use; or stand up domain automation. It realizes the same team natively on each harness — Claude Code agent teams plus skills, Codex AGENTS.md plus repo-local skills, Kiro powers plus steering plus agent hooks."
keywords:
  - harness
  - agent-team
  - team-architecture
  - meta-skill
  - orchestration
  - multi-agent
  - skill-architect
  - pipeline
  - fan-out-fan-in
  - expert-pool
  - producer-reviewer
  - supervisor
  - hierarchical-delegation
  - agent-scaffolding
author: robin (revfactory), adapted for Skill Forge by Steven J. Miklovic
version: 0.1.0
harnesses:
  - kiro
  - claude-code
  - codex
type: workflow
inclusion: manual
categories:
  - architecture
ecosystem: []
depends: []
enhances: []
license: Apache-2.0
maturity: experimental
trust: community
audience: advanced
model-assumptions:
  - "Uses the highest-reasoning model available (e.g. Claude Opus, GPT-5-class) for design and orchestration quality"
collections: []
inherit-hooks: false
harness-config:
  kiro:
    format: power
  codex:
    format: skill
---
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
