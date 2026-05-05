# Joining or Running a Guild

A **guild** is a manifest-driven way for a team to share a curated set of Skill Forge artifacts. It answers "what skills and powers does everyone on this team use?" with a committed YAML file and a single `forge guild sync` command.

Two roles:

- **Guild member** — your team already has a guild. You want to sync it to your workspace.
- **Guild maintainer** — you're standing up a guild for your team.

## What a Guild Gives You

A guild adds three things on top of plain `forge install`:

1. **A shared manifest.** `.forge/manifest.yaml` lists the artifacts and versions everyone should use.
2. **A global cache.** Artifacts are fetched once into `~/.forge/cache/` and materialized into every workspace that references them — no repeated downloads.
3. **Collection expansion.** Reference a collection (e.g. `neon-caravan`) and the sync step pulls every member, so new additions by the collection owner are picked up automatically.

## Prerequisites

- Bun ≥ 1.0 installed
- A `forge.config.yaml` at the project root with at least one backend declared (see [Using Skill Forge in Your Project](./using-in-your-project.md))
- Access to the backend where the manifest entries live (usually a GitHub release tag)

## Joining an Existing Guild

Your team lead (or the project README) will tell you the manifest already exists. Clone the project and run:

```bash
bunx @jhu-sheridan-libraries/skill-forge guild sync
```

This reads `.forge/manifest.yaml`, resolves versions, fetches anything missing into the cache, and materializes files into every harness target configured for the project.

Check what happened:

```bash
bunx @jhu-sheridan-libraries/skill-forge guild status
```

You'll see each manifest entry, the resolved version, the backend it came from, and whether the local sync is up to date.

To check for remote updates before syncing:

```bash
bunx @jhu-sheridan-libraries/skill-forge guild sync --auto-update
```

The throttle defaults to 60 minutes between remote checks — override with `--throttle 0` to force a fresh check.

## Optional: Auto-sync on Directory Entry

If you work in many projects, you can have the guild sync run automatically when you `cd` into a project that has a manifest:

```bash
bunx @jhu-sheridan-libraries/skill-forge guild hook install >> ~/.bashrc
# or ~/.zshrc, ~/.config/fish/config.fish
```

Reload your shell and the hook will trigger a silent sync whenever you enter a project with `.forge/manifest.yaml`.

## Running a Guild (Maintainer Path)

### 1. Create the manifest

From your project root:

```bash
# Add an artifact at the latest cached version
bunx @jhu-sheridan-libraries/skill-forge guild init adr

# Pin a specific version
bunx @jhu-sheridan-libraries/skill-forge guild init alice-whiterabbit --version 0.1.1

# Add a whole collection (every member artifact is pulled at sync time)
bunx @jhu-sheridan-libraries/skill-forge guild init neon-caravan --collection --backend jhu

# Mark an entry optional — members can skip it without breaking the sync
bunx @jhu-sheridan-libraries/skill-forge guild init experimental-agent --mode optional
```

Each call appends to `.forge/manifest.yaml`. The resulting file looks like:

```yaml
backend: jhu
artifacts:
  - name: adr
    version: 0.4.1
    mode: required
  - name: alice-whiterabbit
    version: 0.1.1
    mode: required
    harnesses: [kiro, claude-code]
  - collection: neon-caravan
    version: 2026.05.01
    mode: optional
```

### 2. Commit the manifest

```bash
git add .forge/manifest.yaml forge.config.yaml
git commit -m "chore: establish team guild with adr, alice-whiterabbit, neon-caravan"
```

Your team members now run `forge guild sync` on pull and they're done.

### 3. Update versions

When a new version of an artifact ships:

```bash
# Bump the manifest to the latest available version
bunx @jhu-sheridan-libraries/skill-forge guild sync --auto-update
```

Review the diff to `.forge/manifest.yaml`, commit, and push. The next `guild sync` for every member picks up the change.

### 4. Remove an entry

Edit `.forge/manifest.yaml` directly — remove the block — then:

```bash
bunx @jhu-sheridan-libraries/skill-forge guild sync
```

The sync does not delete previously-installed files; run `forge install ... --force` or remove them manually if you want a clean target.

## Guild vs Plain Install — When to Use Which

| Need | Use |
|---|---|
| One developer trying out an artifact | `forge install` |
| A team that wants the same artifacts everywhere | `forge guild` |
| A collection that changes membership over time | `forge guild` with a collection reference |
| An airgapped environment where you don't want remote checks | `forge install --source <path>` |

## Troubleshooting

**"Manifest not found."** `forge guild sync` expects `.forge/manifest.yaml` at the project root. Run `forge guild init` first or create the file manually.

**"Version could not be resolved."** The pinned version doesn't exist in any configured backend. Run `forge guild status` to see which backends were searched, then list available versions with the backend directly (e.g. `gh release list` for GitHub).

**Auto-update isn't checking.** By default, remote checks are throttled to once an hour per backend. Run `--throttle 0` or delete `~/.forge/cache/backend-check-<name>.json` to force a fresh check.

**Collection entries pull the wrong artifacts.** Collection membership is declared in each artifact's frontmatter, not in the collection manifest. Check the source artifact's frontmatter for the `collections:` field.
