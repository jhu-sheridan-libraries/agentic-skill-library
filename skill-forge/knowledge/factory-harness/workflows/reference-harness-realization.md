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
