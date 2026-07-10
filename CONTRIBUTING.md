# Contributing to Kanon and Context Bazaar

Thank you for contributing. This repository contains knowledge artifacts and the Kanon CLI that validates, compiles, catalogs, installs, evaluates, and publishes them for AI coding assistants.

## What to contribute

The most valuable contributions are focused, source-backed knowledge artifacts that help an assistant produce better work for a defined task. If you have expertise in a domain that is not covered, start there.

Also welcome: bug fixes to the Kanon tool, harness adapters, catalog improvements, evaluation suites, collection proposals, documentation, and security fixes.

## Choose a contribution path

| Contribution | Start here |
|---|---|
| New or revised knowledge artifact | [Self-paced course](kanon/knowledge/kanon/workflows/self-paced-module.md), [Kanon tutorial](kanon/knowledge/kanon/workflows/tutorial.md), and the steps below |
| Artifact quality or retrieval issue | [Content Quality Report](.github/ISSUE_TEMPLATE/content_quality_report.md) |
| New artifact proposal | [Artifact Submission](.github/ISSUE_TEMPLATE/artifact_submission.md) |
| Bug in the CLI, adapters, catalog, or bridge | [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md) |
| Feature or capability proposal | [Feature Request](.github/ISSUE_TEMPLATE/feature_request.md) |
| Structural or architectural change | Existing [ADRs](kanon/docs/adr/README.md), then an ADR proposal if needed |

For Johns Hopkins Libraries staff, the [Curriculum Guide](kanon/knowledge/kanon/workflows/curriculum-guide.md) maps the tutorial, self-paced course, and optional [Souk Compass practice](kanon/knowledge/kanon/workflows/souk-compass-practice.md) into learning paths.

## Prerequisites

- [Bun](https://bun.sh) 1.0 or later. CI currently uses Bun 1.3.12.
- Git.
- Node.js 20 or later when running the compiled MCP bridge.
- A text editor and a terminal.

Clone the repository and install dependencies:

```bash
git clone https://github.com/jhu-sheridan-libraries/agentic-skill-forge.git
cd agentic-skill-forge/kanon
bun install
```

Verify your setup:
```bash
bun --version
bun run dev --help
```

No programming experience is required to author an artifact. The [self-paced course](kanon/knowledge/kanon/workflows/self-paced-module.md) uses invented practice content and explains how to keep restricted information out of artifacts and evaluations.

## Adding a knowledge artifact

Kanon's canonical source is the maintained record. The compile pipeline is `knowledge/` → parse → adapt → write → `dist/`. Generated files in `dist/` are build output; revise the source and rebuild instead of editing generated files.

### 1. Scaffold

```bash
cd kanon
bun run dev new my-artifact --type skill
```

Valid types: `skill` `power` `rule` `workflow` `agent` `prompt` `template` `reference-pack`

This creates `knowledge/my-artifact/` with `knowledge.md`, `hooks.yaml`, `mcp-servers.yaml`, and a `workflows/` directory for supporting files.

If this is your first artifact, try the guided walkthrough first:
```bash
bun run dev tutorial
```

### 2. Edit the frontmatter

Open `knowledge/my-artifact/knowledge.md`. The required fields:

```yaml
---
name: my-artifact          # kebab-case, matches directory name
displayName: My Artifact   # human-readable
description: One sentence. # shown in catalog cards
keywords: [tag1, tag2]
author: Your Name
version: 0.1.0             # semver — bump on substantive changes
type: skill                # see types above
inclusion: always          # always | fileMatch | manual
harnesses: [kiro, claude-code, codex, copilot, cursor, windsurf, cline, qdeveloper]
categories: [debugging]   # testing security code-style devops documentation
                           # architecture debugging performance accessibility
collections: []
inherit-hooks: false
---
```

The frontmatter must stay between the opening and closing `---` markers. The schema also supports governance fields such as `trust`, `license`, `audience`, `risk-level`, `visibility`, and `priority`. If you add a new frontmatter field to Kanon itself, update both `FrontmatterSchema` and `KNOWN_FRONTMATTER_FIELDS`.

Set `inclusion: manual` for reference material users invoke explicitly. Use `always` only for guidance that's genuinely useful in every session.

### 3. Write the body

The body is Markdown. Write for the assistant and the human reviewer. State when the artifact applies, the task it supports, source ownership, concrete instructions, examples, exclusions, uncertainty handling, escalation points, and how to test the guidance.

Avoid generic advice, unsupported institutional claims, and instructions that ask an assistant to invent facts. Do not place passwords, tokens, personal information, restricted records, licensed content, or unpublished policy in a practice artifact or evaluation.

For `type: workflow`, add ordered phase files to `workflows/`:
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

Collection manifests contain metadata only. Membership is declared in each artifact's frontmatter. Add a collection only when the artifact belongs there and the responsible collection owner can review it.

### 5. Validate and build

```bash
bun run dev validate
bun run dev validate --security   # checks for prompt injection, dangerous hooks, obfuscation
bun run dev build
bun run dev build --harness codex
bun run dev build --strict
```

Fix errors before opening a PR. Review every warning; a build can succeed while reporting that a feature is partial, omitted, or degraded for a harness.

### 6. Add eval tests (recommended)

```bash
bun run dev eval --init my-artifact
```

This scaffolds an eval suite in `knowledge/my-artifact/evals/`. Evaluation tests verify behavior, not only file structure. Add representative, missing-information, and boundary cases using approved data.

Run an artifact evaluation:

```bash
bun run dev eval my-artifact
bun run dev eval my-artifact --harness codex
bun run dev eval my-artifact --record
bun run dev eval my-artifact --trend
```

Do not treat an evaluation score as an approval, accessibility review, privacy review, or substitute for subject-matter judgment.

### 7. Browse locally

```bash
bun run dev catalog browse
```

Check that your artifact appears correctly in the catalog UI.

Regenerate the catalog after any change under `knowledge/` or `packages/`:

```bash
bun run dev catalog generate
```

## Importing existing guidance

If you have an existing Kiro power library:

```bash
bun run dev import ~/my-powers --all --dry-run   # preview
bun run dev import ~/my-powers --all --collections my-collection
```

The importer supports Kiro powers and skills and harness-native files. Use `--force` only when you intend to overwrite an existing canonical artifact.

## Optional Souk Compass work

Souk Compass is a separate MCP server for semantic search over approved artifact, document, memory, or codebase collections. It is not required for core Kanon development. Follow the [optional practice](kanon/knowledge/kanon/workflows/souk-compass-practice.md) before changing its indexing scope. Infrastructure setup requires Docker, Solr, and an approved environment; do not add shared credentials or index restricted content.

## Configuration and credentials

`kanon.config.yaml` (per-repo, at the kanon root) declares backend names, S3 bucket names, GitHub repo slugs, and governance allowlists. **It may be committed** — it should contain no secrets.

`~/.forge/config.yaml` (user-global, in your home directory) holds credentials, bearer tokens, and personal overrides. **It must never be committed.** It is not tracked by git and will not appear in `git status` — this is by design.

If you need to reference a credential in `kanon.config.yaml`, use an environment variable reference instead of a literal value:

```yaml
# kanon.config.yaml — safe to commit
install:
  backends:
    internal:
      type: http
      baseUrl: https://artifacts.example.com
      token: "${FORGE_INTERNAL_TOKEN}"   # read from env at runtime, never stored
```

Running `bun run dev validate --security` will warn if it detects credential-like values hardcoded in `mcp-servers.yaml` environment blocks.

## Development workflow

### Running tests

```bash
cd kanon
bun test
bun test --test-name-pattern="catalog"
bun x tsc --noEmit
bun run lint
```

All tests must pass. Do not submit a PR with failing tests.

### Type checking

```bash
bun x tsc --noEmit
```

The pre-existing `Dirent<NonSharedBuffer>` errors in test files are a Bun type definition issue — ignore those. All other type errors must be resolved.

### MCP bridge and standalone servers

If you modify `src/mcp-bridge.ts`, rebuild the committed bridge:

```bash
bun run build:bridge
```

If you modify Souk Compass, run its package checks from `kanon/`:

```bash
cd mcp-servers/souk-compass
bun install
bun test
bun run build
```

### Linting

```bash
bun run lint        # check
bun run lint:fix    # auto-fix
```

### Changelog fragments

Every substantive change needs a fragment in `kanon/changes/`:

```bash
bun run changelog:new --type added --message "Added support for X"
```

Valid types: `added` `changed` `deprecated` `removed` `fixed` `security`

Fragments are compiled into `CHANGELOG.md` at release time. One fragment per logical change — don't bundle unrelated changes into a single fragment.

## Architecture decisions

Significant architectural choices are documented as ADRs in `kanon/docs/adr/`. Before making a structural change to the tool, check whether an existing ADR covers it. If you're making a decision with real trade-offs, add an ADR:

From the `kanon/` directory:

```bash
cp docs/adr/template.md docs/adr/NNNN-short-title.md
```

Use the next available number and update the index table in `docs/adr/README.md`.

## Harness targets

Kanon supports eight harnesses. An artifact should target the platforms its intended users actually use:

| Harness | When to restrict |
|---|---|
| `kiro` | Powers and steering-specific capabilities |
| `claude-code` | CLAUDE.md-specific guidance |
| `codex` | AGENTS.md or native Codex skill output |
| `copilot` | Copilot instruction or agent output |
| `cursor` | Cursor rule output |
| `windsurf` | Windsurf rule or workflow output |
| `cline` | Cline rule or hook output |
| `qdeveloper` | Amazon Q Developer rule or agent output |

Each harness has a capability matrix declaring support levels for features like hooks, MCP, path scoping, and workflows. The build pipeline applies degradation strategies (inline, comment, omit) for unsupported features automatically. Use `--strict` to treat unsupported capabilities as errors.

## Team distribution with Guild

For team workflows, the Guild system manages artifact distribution via a shared manifest:

```bash
bun run dev guild init my-artifact    # add to manifest
bun run dev guild sync                # resolve and install
bun run dev guild status              # check sync state
```

See `kanon/.forge/manifest.yaml` for the manifest format.

## Pull request checklist

- [ ] `bun test` passes
- [ ] `bun run dev validate` passes with no errors
- [ ] `bun run dev validate --security` has been reviewed
- [ ] `bun run dev build` completes without errors
- [ ] `bun run lint` clean
- [ ] No new TypeScript errors (`bun x tsc --noEmit`)
- [ ] Changelog fragment added for each logical change
- [ ] Changed artifacts have non-placeholder body content
- [ ] Frontmatter is complete (name, displayName, description, keywords, author, version, type, categories)
- [ ] Body is substantive — not a placeholder
- [ ] If the artifact is a `reference-pack`, `inclusion: manual` is set
- [ ] ADR created or updated if an architectural decision was made
- [ ] `catalog.json` regenerated (`kanon catalog generate`) if artifacts changed
- [ ] The compiled output was inspected for the primary harness, when applicable

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

Do not contribute content that asks an assistant to ignore safeguards, fabricates Johns Hopkins facts or approvals, exposes secrets or restricted information, presents generated text as final public-facing copy without human review, or claims legal, privacy, security, accessibility, or policy compliance without the responsible review.

If you find harmful, incorrect, or outdated guidance, open a [Content Quality Report](.github/ISSUE_TEMPLATE/content_quality_report.md) with the exact text, evidence, expected behavior, and severity.

## License

Contributions are licensed under [MIT Software License](LICENSE). By submitting a pull request you confirm you have the right to contribute the content under these terms.
