# Using Kanon in Your Project

This guide walks you through adding Kanon to an existing project so your AI coding assistant loads a curated set of skills, powers, and rules.

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.0 installed locally
- A project with at least one supported harness (Kiro, Claude Code, Codex, Cursor, Copilot, Windsurf, Cline, or Amazon Q Developer)
- Access to a Kanon release backend — the public JHU library at `jhu-sheridan-libraries/agentic-skill-forge` by default, or an internal fork

## 1. Add a `kanon.config.yaml`

Create `kanon.config.yaml` at your project root:

```yaml
install:
  backends:
    jhu:
      type: github
      repo: jhu-sheridan-libraries/agentic-skill-forge
      releasePrefix: v

projects:
  - name: my-project
    root: .
    harnesses:
      - kiro
    artifacts:
      include:
        - adr
        - alice-whiterabbit

knowledgeSources:
  - .
```

What each section does:

- `install.backends` — where to fetch compiled artifacts from. `type: github` pulls release tarballs; `type: s3` and `type: http` are also supported.
- `projects` — one or more subdirectories that should receive installed artifacts. Use `root: .` for single-project repos.
- `artifacts.include` — the artifact names to install. Omit this to install whatever the install command names.
- `knowledgeSources` — required by the schema even for consumers. Point it at any directory that exists; it's only used by authors.

For monorepos, declare one project per subdirectory and list which harnesses each one uses:

```yaml
projects:
  - name: backend
    root: services/backend
    harnesses: [kiro, claude-code, codex]
  - name: frontend
    root: services/frontend
    harnesses: [cursor, copilot]
```

## 2. Browse what's available

```bash
bunx @thinkingsage/kanon catalog browse
```

This opens a local web UI showing every artifact in the configured backends with descriptions, keywords, and capability matrices. You can also generate a static catalog page or query the index in the terminal.

## 3. Install artifacts

Install a single artifact for a single harness:

```bash
bunx @thinkingsage/kanon install adr --backend jhu --harness kiro
```

Install for every harness your project declares:

```bash
bunx @thinkingsage/kanon install adr --backend jhu --all
```

Pin to a specific release tag:

```bash
bunx @thinkingsage/kanon install adr --from-release v0.4.1 --harness kiro
```

Preview without writing files:

```bash
bunx @thinkingsage/kanon install adr --backend jhu --harness kiro --dry-run
```

### Where the files land

| Harness | Destination |
|---|---|
| Kiro | `.kiro/` (steering files, hooks, `mcp.json`, `POWER.md`) |
| Claude Code | `.claude/`, `CLAUDE.md` at project root |
| Codex | `AGENTS.md`, `.codex/skills/<name>/SKILL.md`, `.codex/config.toml` |
| Cursor | `.cursor/rules/`, `.cursor/mcp.json` |
| Copilot | `.github/instructions/`, `AGENTS.md` |
| Windsurf | `.windsurf/rules/`, `.windsurf/workflows/` |
| Cline | `.clinerules/` |
| Amazon Q Developer | `.q/rules/`, `.q/agents/` |

The installer writes `.forge-manifest.json` alongside installed files to track versions and source paths.

## 4. Verify the install

Restart your AI assistant so it picks up the new files, then confirm:

```bash
# Kiro
ls .kiro/steering/

# Claude Code
ls .claude/ && test -f CLAUDE.md && echo "CLAUDE.md present"
```

For Kiro specifically, the installed steering files carry `inclusion` metadata that controls when they activate — `always`, `auto`, `fileMatch`, or `manual`. Open any steering file to see which mode it uses.

## 5. Keep artifacts up to date

Re-run the install with `--force` to pull the latest version:

```bash
bunx @thinkingsage/kanon install adr --backend jhu --harness kiro --force
```

For team environments where everyone should stay on the same versions, use a guild instead — see [Joining or Running a Guild](./joining-a-guild.md).

## Troubleshooting

**"Artifact not built for harness X."** The release tarball doesn't contain that harness. Check the catalog or pick a different harness.

**"Unknown backend."** The backend name you passed to `--backend` isn't declared in `kanon.config.yaml` under `install.backends`.

**"Invalid workspace config."** The `knowledgeSources` field is required by the schema. Point it at any directory that exists, even `.`.

**Files overwritten on install.** The installer refuses to overwrite by default. Pass `--force` if you want the remote version to win, or hand-edit and skip the refresh.

**Kiro doesn't see the new steering files.** Restart the Kiro session. Steering files are loaded at startup.
