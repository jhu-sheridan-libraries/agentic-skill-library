# Getting Started with Skill Forge

Three guides for three kinds of users:

| I want to... | Read |
|---|---|
| Install powers and skills in my project | [Using Skill Forge in Your Project](./using-in-your-project.md) |
| Share a curated set of artifacts with my team | [Joining or Running a Guild](./joining-a-guild.md) |
| Build, extend, or contribute to Skill Forge itself | [Developing Skill Forge](./developing-skill-forge.md) |

## What is Skill Forge?

Skill Forge is a CLI tool that lets authors write knowledge artifacts (skills, powers, rules, workflows, prompts, agents, templates) once in a canonical format and compile them to any supported AI coding assistant — Kiro, Claude Code, GitHub Copilot, Cursor, Windsurf, Cline, Amazon Q Developer.

It solves three problems:

1. **Authors** maintain one copy of a skill, not seven.
2. **Consumers** install the same knowledge in any harness without re-authoring it.
3. **Teams** pin a curated set of artifacts and keep every member in sync.

## Quick Orientation

```
Author in knowledge/<name>/        →   forge build         →   dist/<harness>/
                                                              │
Consumer runs forge install  ←─────────────────────────────── ┘
                             →   .kiro/, CLAUDE.md, .cursor/rules/, …
```

The three guides above walk each persona through their end of this pipeline.

## Prerequisites

All three roles need:

- [Bun](https://bun.sh) ≥ 1.0 — the runtime Skill Forge is built on
- A supported AI coding assistant (Kiro, Claude Code, etc.)
- `git` and a GitHub account if you'll publish or pull from a release backend

See each guide for role-specific additions.
