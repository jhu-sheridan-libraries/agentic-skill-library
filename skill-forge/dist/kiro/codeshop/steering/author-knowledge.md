<!-- forge:version 0.1.7 -->
# Author Knowledge

Create canonical knowledge artifacts for Skill Forge — `knowledge.md` with YAML frontmatter and markdown body, plus optional `hooks.yaml`, `mcp-servers.yaml`, and `workflows/` phase files. The artifact is harness-agnostic: Skill Forge compiles it to skills, powers, rules, or agents depending on the `type` and `harness-config` fields.

## When to Use

- The user wants to create a new knowledge artifact
- The user wants to write or build a new skill, power, rule, or agent
- The user mentions "write a skill," "create an artifact," or "author knowledge"

## Prerequisites

- Skill Forge installed (`bun install` in the `skill-forge/` directory)
- Understanding of what task or domain the artifact will cover

## Key Principle: Harness-Agnostic Authoring

Authors focus on canonical content, not output format. Skill Forge's build pipeline handles compilation:

- `bun run dev build` — compiles the artifact to all target harnesses (Kiro, Claude Code, Copilot, Cursor, Windsurf, Cline, Q Developer)
- `bun run dev build --harness kiro` — compiles for a single harness
- `bun run dev validate` — validates the artifact against the schema

The same `knowledge.md` can produce a Kiro power, a Claude Code CLAUDE.md rule, a Copilot instructions file, or a Cursor rule — depending on the `type`, `harnesses`, and `harness-config` fields in the frontmatter.

## Phases

### Phase 1 — Gather
Collect requirements for the artifact: what domain/task it covers, what type it should be, what harnesses to target, whether it needs hooks or MCP servers.
→ Load `author-knowledge-gather.md`

### Phase 2 — Draft
Write the `knowledge.md` file with frontmatter and body content. Add optional `hooks.yaml`, `mcp-servers.yaml`, and `workflows/` phase files as needed.
→ Load `author-knowledge-draft.md`

### Phase 3 — Review
Validate the artifact with `bun run dev validate`, compile with `bun run dev build`, review output for each target harness, and iterate with the user.
→ Load `author-knowledge-review.md`

## Artifact Structure

```
artifact-name/
├── knowledge.md       # Required — YAML frontmatter + markdown body
├── hooks.yaml         # Optional — canonical hooks for proactive agent behavior
├── mcp-servers.yaml   # Optional — MCP server dependencies
└── workflows/         # Optional — phase files for multi-step workflows
    ├── phase-one.md
    ├── phase-two.md
    └── phase-three.md
```

## Frontmatter Reference Template

The `FrontmatterSchema` defines all valid fields. Here is a complete reference:

```yaml
---
# Required
name: my-artifact                    # kebab-case identifier

# Recommended
displayName: My Artifact             # Human-readable name
description: >-                      # ≤3 sentences — what it does and when to use it
  Brief description of capability.
  Use when [specific triggers].
keywords:                            # Domain-specific compound terms for discovery
  - keyword-one
  - keyword-two
author: Your Name                    # Author attribution
version: 0.1.0                      # Semver string

# Classification
type: skill                          # skill | power | workflow | prompt | rule | agent | template | reference-pack
inclusion: always                    # always | manual | auto
harnesses:                           # Target harnesses (defaults to all)
  - kiro
  - claude-code
  - copilot
  - cursor
  - windsurf
  - cline
  - qdeveloper
categories:                          # Predefined categories
  - architecture
  - testing
  - documentation

# Ecosystem & Dependencies
ecosystem:                           # Technology tags (kebab-case)
  - typescript
  - react
depends:                             # Required companion artifacts (kebab-case)
  - other-artifact
enhances:                            # Optional companion artifacts (kebab-case)
  - another-artifact

# Catalog & Distribution
maturity: experimental               # experimental | beta | stable | deprecated
trust: community                     # community | verified | official
audience: intermediate               # beginner | intermediate | advanced
collections:                         # Collection membership (kebab-case)
  - my-collection
inherit-hooks: false                 # Whether to inherit hooks from dependencies

# Per-Harness Configuration
harness-config:
  kiro:
    format: power                    # kiro: steering | power
  copilot:
    format: instructions             # copilot: instructions | agent
  qdeveloper:
    format: rule                     # qdeveloper: rule | agent
---
```

## When to Add Workflows

Add `workflows/` phase files when the artifact describes an **ordered multi-step process** with discrete phases, each having entry criteria, steps, and exit criteria. Examples: TDD cycles, code review rituals, debugging methodologies.

Keep content in the **body** (no phase files) when the artifact provides:
- Reference material or behavioral modes (glossaries, style guides)
- Single-instruction directives (output formatting, commit conventions)
- Flat guidance without sequential ordering

## When to Add hooks.yaml

Add `hooks.yaml` when the artifact should trigger **proactive agent behavior** tied to IDE events:
- `user_triggered` — user-invoked actions (buttons, commands)
- `file_edited` / `file_created` / `file_deleted` — react to file changes
- `pre_task` / `agent_stop` — lifecycle hooks
- `prompt_submit` — react to user prompts

Each hook follows the directive pattern: imperative action ending with a concrete action the agent must take.

## When to Add mcp-servers.yaml

Add `mcp-servers.yaml` when the artifact requires **external tool access** via MCP servers — database queries, API calls, specialized computation. Most knowledge artifacts don't need this; it's primarily for powers that integrate with external services.