# Detection Reference

> Auto-generated from the frozen Rosetta Stone registry. Do not edit manually.

## kanon-canonical

Threshold: 0.6

| Rule ID | Kind | Pattern | Weight | Required | Evidence Label |
|---|---|---|---|---|---|
| `knowledge-md` | basename | `knowledge.md` | 50 | yes | knowledge.md present |
| `frontmatter-name` | frontmatter-key | `name` | 20 | no | Frontmatter 'name' key |
| `frontmatter-type` | frontmatter-key | `type` | 20 | no | Frontmatter 'type' key |
| `hooks-yaml` | basename | `hooks.yaml` | 10 | no | hooks.yaml companion |

## claude-code

Threshold: 0.5

| Rule ID | Kind | Pattern | Weight | Required | Evidence Label |
|---|---|---|---|---|---|
| `claude-md` | basename | `CLAUDE.md` | 50 | no | CLAUDE.md present |
| `claude-settings` | path-glob | `.claude/settings.json` | 30 | no | Claude settings directory |

## cline

Threshold: 0.5

| Rule ID | Kind | Pattern | Weight | Required | Evidence Label |
|---|---|---|---|---|---|
| `cline-rules` | path-glob | `.cline/rules/*.md` | 50 | no | Cline rules directory |
| `clinerules` | basename | `.clinerules` | 30 | no | Legacy .clinerules file |

## codex

Threshold: 0.5

| Rule ID | Kind | Pattern | Weight | Required | Evidence Label |
|---|---|---|---|---|---|
| `agents-md` | basename | `AGENTS.md` | 50 | no | AGENTS.md present |
| `codex-plugin` | path-glob | `.codex-plugin/**` | 30 | no | Codex plugin directory |

## copilot

Threshold: 0.5

| Rule ID | Kind | Pattern | Weight | Required | Evidence Label |
|---|---|---|---|---|---|
| `copilot-instructions` | path-glob | `.github/copilot-instructions.md` | 50 | no | Copilot instructions file |
| `copilot-agents` | path-glob | `.github/copilot/*.md` | 30 | no | Copilot agent files |

## cursor

Threshold: 0.5

| Rule ID | Kind | Pattern | Weight | Required | Evidence Label |
|---|---|---|---|---|---|
| `cursor-rules` | path-glob | `.cursor/rules/*.mdc` | 50 | no | Cursor rules directory |
| `cursorrules` | basename | `.cursorrules` | 30 | no | Legacy .cursorrules file |

## kiro

Threshold: 0.5

| Rule ID | Kind | Pattern | Weight | Required | Evidence Label |
|---|---|---|---|---|---|
| `kiro-dir` | path-glob | `.kiro/**` | 40 | no | .kiro directory structure |
| `steering-md` | path-glob | `.kiro/steering/*.md` | 30 | no | Kiro steering file |
| `skill-md` | basename | `SKILL.md` | 20 | no | SKILL.md marker |

## qdeveloper

Threshold: 0.5

| Rule ID | Kind | Pattern | Weight | Required | Evidence Label |
|---|---|---|---|---|---|
| `amazonq-rules` | path-glob | `.amazonq/rules/*.md` | 50 | no | Amazon Q rules directory |
| `amazonq-agents` | path-glob | `.amazonq/agents/*.md` | 20 | no | Amazon Q agents directory |

## windsurf

Threshold: 0.5

| Rule ID | Kind | Pattern | Weight | Required | Evidence Label |
|---|---|---|---|---|---|
| `windsurf-rules` | path-glob | `.windsurf/rules/*.md` | 50 | no | Windsurf rules directory |
| `windsurfrules` | basename | `.windsurfrules` | 30 | no | Legacy .windsurfrules file |

## kiro-power

Threshold: 0.5

| Rule ID | Kind | Pattern | Weight | Required | Evidence Label |
|---|---|---|---|---|---|
| `power-md` | basename | `POWER.md` | 60 | yes | POWER.md present |
| `steering-dir` | path-glob | `steering/*.md` | 20 | no | Steering directory |

## kiro-skill

Threshold: 0.5

| Rule ID | Kind | Pattern | Weight | Required | Evidence Label |
|---|---|---|---|---|---|
| `skill-md` | basename | `SKILL.md` | 60 | yes | SKILL.md present |
| `references-dir` | path-glob | `references/*.md` | 20 | no | References directory |

## superpowers

Threshold: 0.5

| Rule ID | Kind | Pattern | Weight | Required | Evidence Label |
|---|---|---|---|---|---|
| `superpowers-skill` | basename | `SKILL.md` | 40 | yes | SKILL.md present |
| `superpowers-dir` | path-glob | `.superpowers/**` | 40 | no | .superpowers directory |
