# Contributing to Context Bazaar

## What to contribute

The most valuable contributions are knowledge artifacts — well-written, focused guidance that an AI coding assistant can apply immediately. If you have deep knowledge in a domain that isn't covered, that's the right place to start.

Also welcome: bug fixes to the forge tool, new harness adapters, improvements to the catalog browser, eval suites, and collection proposals.

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.0
- Node.js ≥ 20 (for the MCP bridge)
- Clone the repo and run `cd skill-forge && bun install`

Verify your setup:
```bash
bun run dev --version
```

## Adding a knowledge artifact

### 1. Scaffold

```bash
cd skill-forge
bun run dev new my-artifact --type skill
```

Valid types: `skill` `power` `rule` `workflow` `agent` `prompt` `template` `reference-pack`

This creates `knowledge/my-artifact/` with `knowledge.md`, `hooks.yaml`, and `mcp-servers.yaml`.

If this is your first artifact, try the guided walkthrough first:
```bash
bun run dev tutorial
```

### 2. Edit the frontmatter

Open `knowledge/my-artifact/knowledge.md`. The required fields:

```yaml
name: my-artifact          # kebab-case, matches directory name
displayName: My Artifact   # human-readable
description: One sentence. # shown in catalog cards
keywords: [tag1, tag2]
author: Your Name
version: 0.1.0             # semver — bump on substantive changes
type: skill                # see types above
inclusion: always          # always | fileMatch | manual
categories: [debugging]   # testing security code-style devops documentation
                           # architecture debugging performance accessibility
```

Set `inclusion: manual` for reference material users invoke explicitly. Use `always` only for guidance that's genuinely useful in every session.

### 3. Write the body

The body is Markdown. Write for the AI, not a human reader — the assistant will apply this guidance to real tasks, so be concrete and specific. Avoid padding.

For `type: workflow`, add phase files to `workflows/`:
```
knowledge/my-artifact/workflows/
  01-first-phase.md
  02-second-phase.md
```

### 4. Assign to a collection (optional)

Add to frontmatter:
```yaml
collections: [neon-caravan]
```

To create a new collection: `bun run dev collection new my-collection`

### 5. Validate and build

```bash
bun run dev validate
bun run dev validate --security   # checks for prompt injection, dangerous hooks, obfuscation
bun run dev build
```

Fix any errors before opening a PR. Warnings are acceptable but should be understood.

### 6. Add eval tests (recommended)

```bash
bun run dev eval --init my-artifact
```

This scaffolds an eval suite in `knowledge/my-artifact/evals/`. Eval tests verify that the artifact actually improves assistant output. See existing evals for examples.

### 7. Browse locally

```bash
bun run dev catalog browse
```

Check that your artifact appears correctly in the catalog UI.

## Importing existing powers or skills

If you have an existing Kiro power library:

```bash
bun run dev import ~/my-powers --all --dry-run   # preview
bun run dev import ~/my-powers --all --collections my-collection
```

Supports Kiro power format (`POWER.md` + `steering/`) and skill format (`SKILL.md` + `references/`).

## Configuration and credentials

`forge.config.yaml` (per-repo, at the skill-forge root) declares backend names, S3 bucket names, GitHub repo slugs, and governance allowlists. **It may be committed** — it should contain no secrets.

`~/.forge/config.yaml` (user-global, in your home directory) holds credentials, bearer tokens, and personal overrides. **It must never be committed.** It is not tracked by git and will not appear in `git status` — this is by design.

If you need to reference a credential in `forge.config.yaml`, use an environment variable reference instead of a literal value:

```yaml
# forge.config.yaml — safe to commit
install:
  backends:
    internal:
      type: http
      baseUrl: https://artifacts.example.com
      token: "${FORGE_INTERNAL_TOKEN}"   # read from env at runtime, never stored
```

Running `forge validate --security` will warn if it detects credential-like values hardcoded in `mcp-servers.yaml` env blocks.

## Development workflow

### Running tests

```bash
cd skill-forge
bun test
```

All tests must pass. Do not submit a PR with failing tests.

### Type checking

```bash
bun x tsc --noEmit
```

The pre-existing `Dirent<NonSharedBuffer>` errors in test files are a Bun type definition issue — ignore those. All other type errors must be resolved.

### Linting

```bash
bun run lint        # check
bun run lint:fix    # auto-fix
```

### Changelog fragments

Every substantive change needs a fragment in `skill-forge/changes/`:

```bash
bun run changelog:new --type added --message "Added support for X"
```

Valid types: `added` `changed` `deprecated` `removed` `fixed` `security`

Fragments are compiled into `CHANGELOG.md` at release time. One fragment per logical change — don't bundle unrelated changes into a single fragment.

### MCP bridge

If you modify `src/mcp-bridge.ts`, rebuild the bridge:

```bash
bun run build:bridge
```

The bridge is compiled as CJS for Node.js compatibility and lives at `bridge/mcp-server.cjs`.

## Architecture decisions

Significant architectural choices are documented as ADRs in `skill-forge/docs/adr/` (30 and counting). Before making a structural change to the tool, check whether an existing ADR covers it. If you're making a decision with real trade-offs, add an ADR:

```bash
cp skill-forge/docs/adr/template.md skill-forge/docs/adr/NNNN-short-title.md
```

Update the index table in `skill-forge/docs/adr/README.md` when adding a new ADR.

## Harness targets

By default, artifacts compile to all seven harnesses. Restrict where it makes sense:

| Harness | When to restrict |
|---|---|
| `kiro` only | Powers — Kiro's native format; other harnesses get degraded output |
| `claude-code` only | CLAUDE.md-specific guidance, slash command skills |
| All | General skills, prompts, and reference packs |

Each harness has a capability matrix declaring support levels for features like hooks, MCP, path scoping, and workflows. The build pipeline applies degradation strategies (inline, comment, omit) for unsupported features automatically. Use `--strict` to treat unsupported capabilities as errors.

## Team distribution with Guild

For team workflows, the Guild system manages artifact distribution via a shared manifest:

```bash
bun run dev guild init my-artifact    # add to manifest
bun run dev guild sync                # resolve and install
bun run dev guild status              # check sync state
```

See `skill-forge/.forge/manifest.yaml` for the manifest format.

## Pull request checklist

- [ ] `bun test` passes
- [ ] `bun run dev validate` passes with no errors
- [ ] `bun run dev build` completes without errors
- [ ] `bun run lint` clean
- [ ] No new TypeScript errors (`bun x tsc --noEmit`)
- [ ] Changelog fragment added for each logical change
- [ ] Frontmatter is complete (name, displayName, description, keywords, author, version, type, categories)
- [ ] Body is substantive — not a placeholder
- [ ] If the artifact is a `reference-pack`, `inclusion: manual` is set
- [ ] ADR created or updated if an architectural decision was made
- [ ] `catalog.json` regenerated (`forge catalog generate`) if artifacts changed

## Artifact quality bar

A knowledge artifact earns its place if it passes this test: would an AI coding assistant produce meaningfully better output with this guidance than without it? If the answer isn't clearly yes, reconsider the scope or specificity.

Avoid:
- Rephrasing the obvious ("write clear code")
- Generic advice with no actionable specifics
- Content that duplicates what the model already knows well

Aim for:
- Domain-specific constraints the model wouldn't assume by default
- Checklists and workflows that impose useful structure on open-ended tasks
- Opinionated guidance grounded in a specific context (your team's standards, a particular tool's quirks)

## License

Contributions are licensed under [MIT Software License](LICENSE). By submitting a pull request you confirm you have the right to contribute the content under these terms.
