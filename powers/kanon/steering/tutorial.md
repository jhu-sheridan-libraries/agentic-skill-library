<!-- forge:version 0.2.0 -->
# Kanon Tutorial

A complete sequential walkthrough of every Kanon capability, from first install to publishing and team distribution. Each lesson is self-contained so you can skip ahead or return to a topic later.

## How to Use This Tutorial

- **First time?** Start at Lesson 1 and work through in order.
- **Refreshing a topic?** Jump directly to the lesson you need using the table of contents.
- **Looking for a specific command?** See the Lesson Index below.

To skip to a lesson, tell the assistant something like "take me to Lesson 7" or "show me the publish lesson".

## Table of Contents

| # | Lesson | Covers |
|---|--------|--------|
| 1 | [Setup & Verification](#lesson-1-setup--verification) | Installing Bun, cloning, `bun install` |
| 2 | [The Guided Tutorial Command](#lesson-2-the-guided-tutorial-command) | `kanon tutorial` |
| 3 | [Exploring the Catalog](#lesson-3-exploring-the-catalog) | `kanon catalog generate`, `browse`, `export` |
| 4 | [Importing Existing Configs](#lesson-4-importing-existing-configs) | `kanon import` |
| 5 | [Scaffolding a New Artifact](#lesson-5-scaffolding-a-new-artifact) | `kanon new` + wizard |
| 6 | [Editing Your Artifact](#lesson-6-editing-your-artifact) | `knowledge.md`, `hooks.yaml`, `mcp-servers.yaml` |
| 7 | [Validation](#lesson-7-validation) | `kanon validate`, `--security` |
| 8 | [Building](#lesson-8-building) | `kanon build`, `--harness`, `--strict` |
| 9 | [Previewing with Temper](#lesson-9-previewing-with-temper) | `kanon temper`, compare, web |
| 10 | [Installing Locally](#lesson-10-installing-locally) | `kanon install` |
| 11 | [Collections](#lesson-11-collections) | `kanon collection new`, `build`, status |
| 12 | [Evaluating Artifacts](#lesson-12-evaluating-artifacts) | `kanon eval` and promptfoo |
| 13 | [Publishing](#lesson-13-publishing) | `kanon publish`, backends |
| 14 | [Upgrading](#lesson-14-upgrading) | `kanon upgrade` |
| 15 | [Team Distribution with Guild](#lesson-15-team-distribution-with-guild) | `kanon guild sync`, `status` |
| 16 | [Next Steps](#lesson-16-next-steps) | Where to go from here |

## Lesson Index (by Command)

If you know the command, jump straight to it:

| Command | Lesson |
|---------|--------|
| `kanon build` | [Lesson 8](#lesson-8-building) |
| `kanon catalog browse` | [Lesson 3](#lesson-3-exploring-the-catalog) |
| `kanon catalog export` | [Lesson 3](#lesson-3-exploring-the-catalog) |
| `kanon catalog generate` | [Lesson 3](#lesson-3-exploring-the-catalog) |
| `kanon collection *` | [Lesson 11](#lesson-11-collections) |
| `kanon eval` | [Lesson 12](#lesson-12-evaluating-artifacts) |
| `kanon guild *` | [Lesson 15](#lesson-15-team-distribution-with-guild) |
| `kanon import` | [Lesson 4](#lesson-4-importing-existing-configs) |
| `kanon install` | [Lesson 10](#lesson-10-installing-locally) |
| `kanon new` | [Lesson 5](#lesson-5-scaffolding-a-new-artifact) |
| `kanon publish` | [Lesson 13](#lesson-13-publishing) |
| `kanon temper` | [Lesson 9](#lesson-9-previewing-with-temper) |
| `kanon tutorial` | [Lesson 2](#lesson-2-the-guided-tutorial-command) |
| `kanon upgrade` | [Lesson 14](#lesson-14-upgrading) |
| `kanon validate` | [Lesson 7](#lesson-7-validation) |

---

## Lesson 1: Setup & Verification

**Goal:** Get Kanon running on your machine.

### Install Bun

Kanon runs on Bun, a fast JavaScript runtime. Install it with:

```bash
curl -fsSL https://bun.sh/install | bash
```

Close and reopen your terminal, then verify:

```bash
bun --version
```

You should see `1.x.x`. If not, check your shell's PATH configuration — the installer prints instructions.

### Clone the Repository

```bash
git clone https://github.com/jhu-sheridan-libraries/agentic-skill-forge.git
cd agentic-skill-forge/kanon
```

All subsequent commands run from the `kanon/` directory.

### Install Dependencies

```bash
bun install
```

This downloads everything Kanon needs. Takes about 10–30 seconds the first time.

### Verify the CLI Works

```bash
bun run dev --help
```

You should see the kanon banner and a list of commands. If you see "command not found" errors, confirm you're in the `kanon/` directory.

### Checkpoint

- [ ] `bun --version` returns a version
- [ ] You're in `agentic-skill-forge/kanon/`
- [ ] `bun run dev --help` shows the command list

**Next:** [Lesson 2](#lesson-2-the-guided-tutorial-command)

---

## Lesson 2: The Guided Tutorial Command

**Goal:** Use the built-in `kanon tutorial` command for a hands-on walkthrough.

Kanon ships with its own interactive tutorial that creates a sample artifact end-to-end.

```bash
bun run dev tutorial
```

### What Happens

1. The tutorial explains what an artifact is in plain language
2. It prompts you to create a sample artifact (defaults to `hello-world`)
3. The wizard asks a few questions — use defaults or type your own answers
4. It shows you the generated files and explains each one
5. It builds the artifact and explains the output

### Tips

- Press Enter at any "Press Enter to continue" prompt to proceed
- Press Ctrl+C to exit at any point — your scaffold files stay intact
- If `hello-world` already exists, the tutorial will ask if you want to overwrite or pick a new name

After the tutorial finishes, you'll have a working artifact at `knowledge/hello-world/` (or whatever name you chose) and compiled output in `dist/`.

**Next:** [Lesson 3](#lesson-3-exploring-the-catalog)

---

## Lesson 3: Exploring the Catalog

**Goal:** See what artifacts already exist and learn to navigate the catalog.

The catalog is a machine-readable index of every artifact in the repository. It powers search, the browse UI, and the MCP bridge.

### Generate the Catalog

```bash
bun run dev catalog generate
```

This creates `catalog.json` — a JSON file listing every artifact with its metadata. Run this whenever you add, remove, or modify artifacts.

### Browse in Your Web Browser

```bash
bun run dev catalog browse
```

Opens a local server (default: http://localhost:3131). You can:

- Filter by collection (e.g., show only JHU artifacts)
- Filter by type (skill, power, prompt, etc.)
- Filter by harness
- Click into an artifact to see its full content
- View the capability matrix (what each harness supports)
- Edit or delete artifacts through the UI

Change the port if 3131 is in use:

```bash
bun run dev catalog browse --port 4000
```

Press Ctrl+C to stop the server.

### Export a Static Catalog Site

```bash
bun run dev catalog export
```

Generates a self-contained HTML page + catalog.json in `dist/web/`. You can deploy this to GitHub Pages or any static host. Use `--output` to change the location:

```bash
bun run dev catalog export --output docs/public-catalog
```

### Checkpoint

- [ ] `catalog.json` exists in the `kanon/` directory
- [ ] You've opened the browse UI and clicked into at least one artifact

**Next:** [Lesson 4](#lesson-4-importing-existing-configs)

---

## Lesson 4: Importing Existing Configs

**Goal:** Convert existing AI tool configurations into canonical Kanon artifacts.

If you already have rules or instructions written for one AI tool (Cursor rules, Claude Code's CLAUDE.md, Copilot instructions), `kanon import` converts them into a single canonical artifact that compiles to every harness.

### Auto-Detect Harness-Native Files

Run with no path to scan the current project:

```bash
bun run dev import
```

This detects files like `.cursorrules`, `CLAUDE.md`, `.github/copilot-instructions.md`, and offers to import them.

### Import from a Specific Path

Import an entire Kiro power or skill directory:

```bash
bun run dev import /path/to/existing-power
bun run dev import /path/to/existing-power --all
```

### Import for a Specific Harness

```bash
bun run dev import --harness cursor
bun run dev import --harness claude-code
```

### Useful Flags

| Flag | Purpose |
|------|---------|
| `--all` | Import all artifact subdirectories within the path |
| `--format <format>` | Force format: `kiro-power` or `kiro-skill` (default: auto-detect) |
| `--force` | Overwrite existing artifacts without confirmation |
| `--dry-run` | Show what would be imported without writing files |
| `--collections jh-drcc,reference` | Assign imported artifacts to collections |
| `--knowledge-dir <dir>` | Target knowledge directory (default: `knowledge`) |

### Example: Import with JHU Tag

```bash
bun run dev import ../existing-jhu-rules --all --collections jh-drcc --dry-run
```

Always run with `--dry-run` first to preview what will be written.

**Next:** [Lesson 5](#lesson-5-scaffolding-a-new-artifact)

---

## Lesson 5: Scaffolding a New Artifact

**Goal:** Create a brand new artifact from scratch.

### Run the Scaffold Command

```bash
bun run dev new my-artifact-name
```

Name rules:
- Use kebab-case (lowercase with hyphens)
- Descriptive but concise (2–5 words)
- Must be unique within `knowledge/`

### The Interactive Wizard

The wizard asks you:

1. **Description** — 1–2 sentences explaining what this artifact does
2. **Keywords** — comma-separated terms (e.g., `metadata, cataloging, quality`)
3. **Author** — your name
4. **Type** — see the table below
5. **Inclusion** — `always`, `fileMatch`, or `manual`
6. **Categories** — multi-select broad topic areas
7. **Harnesses** — which AI tools should receive this
8. **Harness-specific format** — for harnesses with multiple output formats
9. **Optional hooks** — event-driven automations
10. **Optional MCP servers** — tool integrations

### Artifact Types

| Type | Use For |
|------|---------|
| `skill` | General knowledge injected into AI context |
| `power` | Kiro capability bundle (POWER.md + steering/) |
| `rule` | Lint-style code quality rules |
| `workflow` | Step-by-step process guides |
| `agent` | Agent definitions with hooks and MCP tools |
| `prompt` | Reusable prompt templates |
| `template` | Reference scaffolds or boilerplate |
| `reference-pack` | Background references loaded on demand |

### Skip the Wizard

Use `--yes` to accept template defaults:

```bash
bun run dev new my-artifact-name --yes
```

### Pre-Select a Type

```bash
bun run dev new my-artifact-name --type prompt
bun run dev new my-workflow --type workflow
```

A workflow type auto-creates a `workflows/main.md` file.

### What Gets Created

```
knowledge/my-artifact-name/
├── knowledge.md        ← your content + metadata
├── hooks.yaml          ← optional automations
├── mcp-servers.yaml    ← optional tool integrations
└── workflows/          ← optional (populated for workflow type)
```

**Next:** [Lesson 6](#lesson-6-editing-your-artifact)

---

## Lesson 6: Editing Your Artifact

**Goal:** Fill in your artifact's content and metadata.

### The knowledge.md File

Two parts separated by `---` lines: frontmatter (YAML metadata) and body (Markdown content).

### Frontmatter Reference

```yaml
---
name: my-artifact-name
displayName: My Artifact Name
version: 0.1.0
description: A clear description of what this artifact provides
keywords:
  - keyword1
  - keyword2
author: Your Name
type: skill
inclusion: manual
categories:
  - documentation
harnesses:
  - kiro
  - claude-code
collections:
  - jh-drcc
ecosystem: []
depends: []
enhances: []
maturity: experimental
---
```

### Required Fields

| Field | Purpose |
|-------|---------|
| `name` | kebab-case identifier (matches the folder name) |
| `displayName` | human-readable title |
| `description` | clear, concise summary |
| `type` | one of the 8 artifact types |
| `inclusion` | `always`, `fileMatch`, or `manual` |
| `harnesses` | which AI tools to target |

### JHU-Specific Conventions

- Always include `jh-drcc` in `collections` for library artifacts
- Start `maturity` at `experimental` — upgrade to `stable` after team review
- Use `manual` inclusion for reference material; `always` only for team-wide standards

### hooks.yaml (Optional)

Defines automations triggered by events:

```yaml
hooks:
  - name: lint-on-save
    event: fileEdited
    condition:
      file_patterns:
        - "*.py"
    action:
      type: run_command
      command: "ruff check --fix"
```

### mcp-servers.yaml (Optional)

Lists MCP tool integrations the AI can use:

```yaml
servers:
  - name: github
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    env:
      GITHUB_TOKEN: GITHUB_TOKEN_ENV_VAR
```

### Writing Good Content

- Be specific: "Use ISO 8601 dates" not "use proper date format"
- Include examples of both correct and incorrect usage
- Use headers to structure content (AI tools use them for navigation)
- One artifact = one topic

**Next:** [Lesson 7](#lesson-7-validation)

---

## Lesson 7: Validation

**Goal:** Catch problems before you build or publish.

### Validate All Artifacts

```bash
bun run dev validate
```

### Validate a Specific Artifact

```bash
bun run dev validate knowledge/my-artifact-name
```

### What Gets Checked

- Required frontmatter fields are present
- Field values match expected types
- Harness names are valid
- Collection references exist
- Structural problems in Markdown and YAML files
- Dependencies and enhances references resolve

### Security Validation

```bash
bun run dev validate --security
```

Adds checks for:

- Prompt injection patterns
- Dangerous hook commands (e.g., `rm -rf`, unquoted user input)
- Obfuscation (suspicious encoding, unicode tricks)
- Credentials or secrets in content

Run this before publishing any artifact externally.

### Reading Validation Output

Errors block the build. Warnings don't block but should be addressed:

```
✓ knowledge/hello
✗ knowledge/my-artifact
  Error: Missing required field "description"
  Error: Unknown harness "copilot-legacy"
⚠ knowledge/other
  Warning: keywords has only 1 entry (recommended: 3+)
```

### Checkpoint

- [ ] `bun run dev validate` passes for your artifact
- [ ] `bun run dev validate --security` also passes

**Next:** [Lesson 8](#lesson-8-building)

---

## Lesson 8: Building

**Goal:** Compile your artifact into formats each AI tool understands.

### Build Everything

```bash
bun run dev build
```

Output goes to `dist/<harness>/<artifact>/`.

### Build for a Single Harness

Faster iteration when testing:

```bash
bun run dev build --harness kiro
bun run dev build --harness claude-code
```

Valid harness names: `kiro`, `claude-code`, `copilot`, `cursor`, `windsurf`, `cline`, `qdeveloper`

### Strict Mode

Turns compatibility warnings into errors — useful for CI:

```bash
bun run dev build --strict
```

### Understanding the Output

Each harness gets a different shape:

```
dist/
├── kiro/my-artifact/.kiro/steering/my-artifact.md
├── claude-code/my-artifact/CLAUDE.md
├── copilot/my-artifact/.github/copilot-instructions.md
├── cursor/my-artifact/.cursor/rules/my-artifact.mdc
├── windsurf/my-artifact/.windsurf/rules/my-artifact.md
├── cline/my-artifact/.clinerules/my-artifact.md
└── qdeveloper/my-artifact/.amazonq/rules/my-artifact.md
```

### Degradations

If your artifact uses a feature a harness doesn't fully support (e.g., hooks on a harness without hooks), the build will:

- Compile what it can
- Emit a warning explaining what was skipped or downgraded
- Continue unless `--strict` is set

### Checkpoint

- [ ] `bun run dev build` completed without errors
- [ ] You can see output files in `dist/`

**Next:** [Lesson 9](#lesson-9-previewing-with-temper)

---

## Lesson 9: Previewing with Temper

**Goal:** See exactly what AI tools will receive, before you install.

Temper renders the full compiled experience — system prompt, steering content, hooks, MCP servers, and any degradations — for an artifact-harness pair.

### Preview for One Harness

```bash
bun run dev temper my-artifact-name
bun run dev temper my-artifact-name --harness claude-code
```

Default harness is `kiro`.

### Compare Across All Harnesses

```bash
bun run dev temper my-artifact-name --compare
```

Shows a side-by-side view of how the same artifact looks across every targeted harness. Useful for spotting degradations.

### Interactive Web Preview

```bash
bun run dev temper my-artifact-name --web
```

Opens a browser interface with syntax highlighting and section navigation.

### Machine-Readable Output

```bash
bun run dev temper my-artifact-name --json
```

Emits `TemperOutput` JSON — useful for scripting or automated checks.

### When to Use Temper

- Before installing: confirm the output is what you expect
- After changing an artifact: see how the change affects each harness
- When a harness behaves unexpectedly: check the actual compiled content
- Before publishing: validate the experience across all targeted harnesses

**Next:** [Lesson 10](#lesson-10-installing-locally)

---

## Lesson 10: Installing Locally

**Goal:** Copy compiled output into the right location for your AI tool to find.

### Install for One Harness

```bash
bun run dev install my-artifact --harness kiro
```

Copies from `dist/kiro/my-artifact/` into the appropriate location in your current project (e.g., `.kiro/steering/`).

### Install for All Harnesses

```bash
bun run dev install my-artifact --all
```

### Preview Without Writing

```bash
bun run dev install my-artifact --harness kiro --dry-run
```

Shows what would be copied and where, without making changes.

### Install into a Different Project

```bash
bun run dev install my-artifact --harness kiro --source /path/to/kanon
```

Use `--source` when running `kanon install` from outside the `kanon/` directory.

### Force Overwrite

```bash
bun run dev install my-artifact --harness kiro --force
```

Skips confirmation prompts when files already exist.

### Install from a GitHub Release

```bash
bun run dev install my-artifact --from-release v1.2.0
```

Downloads a published release rather than using local `dist/` output.

### Global vs Project Install

```bash
bun run dev install my-artifact --global           # into global cache
bun run dev install my-artifact --project my-app   # specific workspace project
```

**Next:** [Lesson 11](#lesson-11-collections)

---

## Lesson 11: Collections

**Goal:** Group related artifacts and build collection bundles.

Collections are lightweight groupings. Membership is declared in each artifact's frontmatter — not in the collection manifest itself.

### Show Collection Status

```bash
bun run dev collection
```

Lists all collections with their member counts and metadata.

### Create a New Collection

```bash
bun run dev collection new my-collection
```

Creates `collections/my-collection.yaml` with a template:

```yaml
name: my-collection
displayName: "My Collection"
description: "Short description of what this collection groups together."
trust: community
tags: [example, tag]
```

### Assign Artifacts to a Collection

Edit the artifact's frontmatter:

```yaml
collections:
  - jh-drcc
  - my-collection
```

An artifact can belong to multiple collections.

### Build Collection Bundles

```bash
bun run dev collection build
bun run dev collection build --harness kiro
```

Generates distributable bundles of collection members — useful for packaging a group of related artifacts for installation as a unit.

### The JHU Collection

Already exists at `collections/jh-drcc.yaml`. Always add `jh-drcc` to the `collections` field of artifacts you create for the library team.

**Next:** [Lesson 12](#lesson-12-evaluating-artifacts)

---

## Lesson 12: Evaluating Artifacts

**Goal:** Test whether your artifact produces good results using promptfoo.

Kanon integrates with promptfoo to run automated quality checks against compiled artifacts.

### Scaffold an Eval Suite

```bash
bun run dev eval --init my-artifact
```

Creates an `evals/my-artifact/` directory with a starter eval configuration.

### Run Evals

```bash
bun run dev eval
bun run dev eval my-artifact
```

### Run for a Specific Harness

```bash
bun run dev eval my-artifact --harness kiro
```

### Useful Flags

| Flag | Purpose |
|------|---------|
| `--threshold 0.8` | Minimum passing score (0.0–1.0, default: 0.7) |
| `--output results.json` | Write detailed JSON results |
| `--ci` | Machine-readable output for CI pipelines |
| `--provider openai:gpt-4` | Run against a single provider |
| `--no-context` | Skip harness context wrapping |
| `--record` | Append results to `evals/history.jsonl` |
| `--trend` | Show score progression over time |

### Example: Track Quality Over Time

```bash
# First eval run
bun run dev eval my-artifact --record

# Make changes to the artifact...

# Second run
bun run dev eval my-artifact --record

# See how scores changed
bun run dev eval my-artifact --trend
```

### When to Use Evals

- Before publishing: confirm the artifact actually produces useful output
- To pick a model tier: compare haiku vs sonnet vs opus results
- In CI: catch regressions when someone edits an artifact
- For research: measure how prompt changes affect output quality

**Next:** [Lesson 13](#lesson-13-publishing)

---

## Lesson 13: Publishing

**Goal:** Make your artifacts available to other teams or the world.

### The Default Backend: GitHub Releases

```bash
bun run dev publish
```

Packages the current state and uploads to a GitHub release. Uses `gh` CLI under the hood.

### Specify a Tag

```bash
bun run dev publish --tag v1.2.0
```

Default is whatever's in `package.json`.

### Dry Run

Always recommended first:

```bash
bun run dev publish --dry-run
```

Validates and packages without uploading.

### Use a Different Backend

```bash
bun run dev publish --backend s3
bun run dev publish --backend http
bun run dev publish --backend local
```

Backends are configured in `kanon.config.yaml`:

```yaml
backends:
  s3:
    type: s3
    bucket: my-team-artifacts
    region: us-east-1
  http:
    type: http
    base_url: https://internal.example.edu/artifacts
```

### Add Release Notes

```bash
bun run dev publish --notes CHANGELOG.md
```

### Before Publishing Externally

Run these checks first:

```bash
bun run dev validate --security
bun run dev build --strict
bun run dev eval
bun run dev temper my-artifact --compare
```

**Next:** [Lesson 14](#lesson-14-upgrading)

---

## Lesson 14: Upgrading

**Goal:** Keep installed artifacts current with upstream releases.

### Check for Upgrades

```bash
bun run dev upgrade --dry-run
```

Shows which installed artifacts have newer versions available, without making changes.

### Apply Upgrades

```bash
bun run dev upgrade
```

Prompts before each upgrade. Version comparison uses semver.

### Force Upgrade Without Prompts

```bash
bun run dev upgrade --force
```

### Upgrade Within a Specific Project

```bash
bun run dev upgrade --project my-app
```

### Understanding Version Compatibility

Upgrade checks:

- The installed artifact's current version
- The latest available version
- Breaking change indicators (major version bump)
- Dependencies on other artifacts

If an artifact declares `depends` on another, upgrade will warn you if the dependency isn't compatible.

**Next:** [Lesson 15](#lesson-15-team-distribution-with-guild)

---

## Lesson 15: Team Distribution with Guild

**Goal:** Keep a team of developers in sync with a shared set of artifacts.

Guild is a manifest-driven distribution system. One team member curates a manifest listing which artifacts (and at what versions) should be installed; everyone else syncs from it.

### Check Guild Status

```bash
bun run dev guild status
```

Shows:

- Which artifacts the manifest requires
- Which are installed and at what version
- Drift (installed versions different from manifest)
- Missing artifacts

### Sync from the Manifest

```bash
bun run dev guild sync
```

Installs or upgrades artifacts to match the manifest. Reports any conflicts.

### The Manifest

Lives at `kanon/.forge/manifest.yaml`:

```yaml
artifacts:
  - name: commit-craft
    version: "^1.0.0"
    harness: kiro
  - name: review-ritual
    version: "1.2.0"
    harness: kiro
    project: default
```

### Workflow for Library Teams

1. One designated curator edits the manifest and commits changes
2. Other team members run `bun run dev guild sync` when they pull
3. Use `bun run dev guild status` during code review to verify no drift

### When Guild Helps

- Keeping a team on the same artifact versions
- Rolling out updates across many developer machines
- Auditing what everyone has installed

**Next:** [Lesson 16](#lesson-16-next-steps)

---

## Lesson 16: Next Steps

You've seen every capability Kanon offers. Here's where to go from here.

### Build Something Real

Pick a piece of knowledge from your daily work that would help a colleague:

- A process you repeat (e.g., metadata QC for a new digital collection)
- A prompt you use often (e.g., generate LCSH from an abstract)
- A checklist (e.g., verify a catalog record)
- A coding pattern (e.g., how we structure data scripts)

Follow Lessons 5–10 to create, validate, build, and install it.

### Contribute to the JHU Collection

Library-relevant artifacts should join the `jh-drcc` collection. Add it to your frontmatter:

```yaml
collections:
  - jh-drcc
```

Commit and push — CI will validate and build your artifact automatically.

### Explore Existing Artifacts

```bash
bun run dev catalog browse
```

Look at artifacts in the `jh-drcc` collection and others for inspiration. Read their `knowledge.md` files to see how experienced authors structure content.

### Set Up Automated Evals

For any prompt artifact, add a promptfoo eval (Lesson 12). This builds confidence that your prompt works and lets you compare model tiers.

### Join the Team Workflow

If your team uses Guild for distribution, run:

```bash
bun run dev guild status
bun run dev guild sync
```

### Further Reading

- `commands.md` steering file — complete command reference with every flag
- `authoring.md` steering file — deep dive on artifact authoring conventions
- The Context Bazaar [catalog site](https://jhu-sheridan-libraries.github.io/agentic-skill-forge/)
- `CONTRIBUTING.md` in the repository root

### Getting Help

```bash
bun run dev help
bun run dev help <command>
```

Or ask your assistant — say something like "help me write a prompt artifact for LCSH generation" and it will guide you through the relevant lessons.

---

## Quick Reference Card

```bash
# Setup
bun install

# Learn
bun run dev tutorial
bun run dev catalog browse

# Create
bun run dev new my-artifact
bun run dev import /path/to/existing     # import from elsewhere

# Check
bun run dev validate
bun run dev validate --security

# Build & Preview
bun run dev build
bun run dev temper my-artifact --compare

# Install & Share
bun run dev install my-artifact --harness kiro
bun run dev publish --dry-run

# Quality
bun run dev eval my-artifact --record

# Team
bun run dev guild sync
bun run dev upgrade
```