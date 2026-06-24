<!-- forge:version 0.2.0 -->
# Skill Forge Command Reference

Complete reference for every Skill Forge CLI command. All commands are run from the `skill-forge/` directory using `bun run dev <command>`.

## Core Commands

### build

Compile knowledge artifacts into harness-native formats.

```bash
bun run dev build
bun run dev build --harness kiro
bun run dev build --strict
```

**Options:**
| Flag | Description |
|------|-------------|
| `--harness <name>` | Build for a single harness only (e.g., `kiro`, `claude-code`, `copilot`) |
| `--strict` | Treat compatibility warnings as errors (useful in CI) |

**What it does:**
- Reads all artifacts from `knowledge/`
- Validates frontmatter and structure
- Runs each artifact through per-harness adapters
- Writes compiled output to `dist/<harness>/<artifact>/`

**Example output structure:**
```
dist/
├── kiro/
│   └── my-artifact/
│       └── steering/
│           └── my-artifact.md
├── claude-code/
│   └── my-artifact/
│       └── CLAUDE.md
└── copilot/
    └── my-artifact/
        └── .github/
            └── copilot-instructions.md
```

---

### new

Scaffold a new knowledge artifact with the interactive wizard.

```bash
bun run dev new my-artifact-name
bun run dev new my-artifact-name --yes
bun run dev new my-artifact-name --type skill
```

**Options:**
| Flag | Description |
|------|-------------|
| `--yes` | Skip the wizard, use template defaults |
| `--type <type>` | Pre-select the artifact type (skill, power, rule, workflow, agent, prompt, template, reference-pack) |

**What it does:**
- Creates `knowledge/<name>/` directory
- Runs the interactive wizard (unless `--yes` is passed)
- Generates `knowledge.md`, `hooks.yaml`, and `mcp-servers.yaml` template files
- For workflow type, also creates `workflows/main.md`

**The wizard asks:**
1. Description (1-2 sentences)
2. Keywords (comma-separated)
3. Author name
4. Artifact type
5. Inclusion strategy (always / fileMatch / manual)
6. Categories
7. Target harnesses
8. Harness-specific format options (if applicable)

---

### validate

Check artifacts for correctness.

```bash
bun run dev validate
bun run dev validate knowledge/my-artifact
bun run dev validate --security
```

**Options:**
| Flag | Description |
|------|-------------|
| `[artifact-path]` | Validate a specific artifact (default: all) |
| `--security` | Run additional security checks (prompt injection, dangerous hooks, obfuscation) |

**What it checks:**
- Required frontmatter fields are present
- Field values match expected types and formats
- Harness names are valid
- Collection references exist
- No structural problems in the Markdown body

---

### install

Install compiled artifacts into the current project.

```bash
bun run dev install my-artifact --harness kiro
bun run dev install my-artifact --all
bun run dev install my-artifact --dry-run
```

**Options:**
| Flag | Description |
|------|-------------|
| `--harness <name>` | Install for a specific harness |
| `--all` | Install for all harnesses |
| `--force` | Overwrite existing files without confirmation |
| `--dry-run` | Show what would be installed without writing files |
| `--source <path>` | Path to skill-forge repository (if running from elsewhere) |
| `--from-release <tag>` | Download from a GitHub release |
| `--backend <name>` | Use a named backend from forge.config.yaml |
| `--global` | Install into the global cache |

**What it does:**
- Reads compiled output from `dist/`
- Copies files to the appropriate location for the target harness
- Respects existing files (prompts before overwriting unless `--force`)

---

### tutorial

Guided walkthrough for first-time users.

```bash
bun run dev tutorial
```

**No options.** This is a fully interactive, step-by-step experience that:
1. Explains what artifacts are in plain language
2. Creates a sample artifact using the wizard
3. Shows and explains the generated files
4. Builds the artifact and explains the output
5. Suggests next steps

Ideal for staff who are new to Skill Forge.

---

## Catalog Commands

### catalog generate

Generate the machine-readable catalog index.

```bash
bun run dev catalog generate
```

Creates `catalog.json` — a JSON file listing all artifacts with their metadata. Used by the browse UI and the MCP bridge.

---

### catalog browse

Open the artifact catalog in your web browser.

```bash
bun run dev catalog browse
bun run dev catalog browse --port 4000
```

**Options:**
| Flag | Description |
|------|-------------|
| `--port <number>` | Port to serve on (default: 3131) |

Opens a local web interface where you can:
- Browse all artifacts
- Filter by collection, type, or harness
- View artifact details and metadata
- See the capability matrix (what each harness supports)

Press `Ctrl+C` to stop the server.

---

### catalog export

Export a static catalog site for hosting.

```bash
bun run dev catalog export
bun run dev catalog export --output docs/site
```

**Options:**
| Flag | Description |
|------|-------------|
| `--output <dir>` | Output directory (default: `dist/web`) |

Generates a self-contained HTML page and catalog.json that can be deployed to GitHub Pages or any static host.

---

## Collection Commands

### collection

Show status of all collections.

```bash
bun run dev collection
```

Lists all collections with their member counts and metadata.

---

### collection new

Create a new collection manifest.

```bash
bun run dev collection new my-collection
```

Creates a YAML file in `collections/` with the collection metadata. Artifacts join a collection by listing it in their frontmatter `collections` field.

---

### collection build

Build collection bundles from compiled artifacts.

```bash
bun run dev collection build
bun run dev collection build --harness kiro
```

**Options:**
| Flag | Description |
|------|-------------|
| `--harness <name>` | Build for a single harness only |

Generates distributable bundles of collection members.

---

## Import Commands

### import

Import existing harness configurations as knowledge artifacts.

```bash
bun run dev import
bun run dev import /path/to/existing-power
bun run dev import --harness cursor
```

**Options:**
| Flag | Description |
|------|-------------|
| `[path]` | Path to import from (omit to auto-detect in current project) |
| `--all` | Import all artifact subdirectories within the path |
| `--format <format>` | Source format: `kiro-power`, `kiro-skill` (default: auto-detect) |
| `--harness <name>` | Scan for and import harness-native files |
| `--force` | Overwrite existing artifacts without confirmation |
| `--dry-run` | Show what would be imported without writing files |
| `--collections <names>` | Comma-separated collection names to assign |
| `--knowledge-dir <dir>` | Target knowledge directory (default: `knowledge`) |

Detects existing AI tool configuration files and converts them into canonical knowledge artifacts.

---

## Publishing Commands

### publish

Publish compiled artifacts to a release backend.

```bash
bun run dev publish
bun run dev publish --backend s3
bun run dev publish --dry-run
```

**Options:**
| Flag | Description |
|------|-------------|
| `--backend <name>` | Named backend from forge.config.yaml (default: github) |
| `--tag <version>` | Release tag (default: package.json version) |
| `--dry-run` | Validate and package without uploading |
| `--notes <file>` | Markdown file to use as release notes |

Backends: GitHub Releases, S3, HTTP, local filesystem.

---

## Evaluation Commands

### eval

Run prompt evaluations using promptfoo.

```bash
bun run dev eval
bun run dev eval my-artifact
bun run dev eval my-artifact --harness kiro
```

**Options:**
| Flag | Description |
|------|-------------|
| `[artifact]` | Specific artifact to evaluate |
| `--harness <name>` | Run evals for a specific harness only |
| `--threshold <score>` | Minimum passing score, 0.0–1.0 (default: 0.7) |
| `--output <path>` | Write detailed results as JSON |
| `--ci` | Machine-readable output for CI pipelines |
| `--provider <name>` | Run against a single provider |
| `--no-context` | Skip harness context wrapping |
| `--init <artifact>` | Scaffold eval suite for an artifact |
| `--record` | Append results to evals/history.jsonl |
| `--trend` | Show score progression from history |

---

## Preview Commands

### temper

Preview the compiled AI experience for an artifact-harness pair.

```bash
bun run dev temper my-artifact
bun run dev temper my-artifact --harness claude-code
bun run dev temper my-artifact --compare
bun run dev temper my-artifact --web
bun run dev temper my-artifact --json
```

**Options:**
| Flag | Description |
|------|-------------|
| `--harness <name>` | Target harness (default: kiro) |
| `--compare` | Compare artifact across all targeted harnesses |
| `--web` | Open interactive web preview in browser |
| `--json` | Output as JSON (TemperOutput schema) |
| `--no-color` | Disable color output |

Shows system prompt, steering content, hooks, MCP servers, and degradation reports.

---

## Guild Commands

Guild commands manage manifest-driven distribution and team sync.

### guild sync

Synchronize artifacts based on the guild manifest.

```bash
bun run dev guild sync
```

Installs or upgrades artifacts to match `.forge/manifest.yaml`.

### guild status

Show sync status for manifested artifacts.

```bash
bun run dev guild status
```

Shows installed versions, drift, and missing artifacts.

---

## Utility Commands

### upgrade

Check for and apply version upgrades to installed artifacts.

```bash
bun run dev upgrade
bun run dev upgrade --dry-run
bun run dev upgrade --force
bun run dev upgrade --project my-app
```

**Options:**
| Flag | Description |
|------|-------------|
| `--force` | Upgrade without confirmation prompts |
| `--dry-run` | Show what would be upgraded |
| `--project <name>` | Upgrade within a specific workspace project |

---

## Development Scripts

These are npm-style scripts (not forge commands) for contributors working on the tool itself:

```bash
# Run all tests (333+ must pass)
bun test

# Type check
bun x tsc --noEmit

# Lint (check only)
bun run lint

# Lint and auto-fix
bun run lint:fix

# Format code
bun run format

# Create a changelog fragment
bun run changelog:new --type added --message "description of change"

# Compile changelog
bun run changelog:compile
```

---

## Common Workflows

### "I want to create a new artifact for the team"

```bash
bun run dev new my-artifact-name
# Answer the wizard questions
# Edit knowledge/my-artifact-name/knowledge.md with your content
bun run dev validate
bun run dev build
git add knowledge/my-artifact-name/
git commit -m "Add artifact: my-artifact-name"
git push
```

### "I want to see what artifacts exist"

```bash
bun run dev catalog browse
# Or list collections:
bun run dev collection
```

### "I want to install an artifact into my project"

```bash
bun run dev build
bun run dev install artifact-name --harness kiro
```

### "I want to convert my existing Cursor rules to a universal artifact"

```bash
bun run dev import
# Follow the prompts to select which files to import
```

### "I want to preview what an AI tool will see"

```bash
bun run dev temper my-artifact --compare
bun run dev temper my-artifact --web
```

### "I want to check if my changes broke anything"

```bash
bun run dev validate
bun run dev build --strict
```

---

## Environment and Configuration

### forge.config.yaml

Optional configuration file in the `skill-forge/` directory that defines:
- Backend configurations for publish/install
- Workspace settings
- Default options

### Directory Structure

```
skill-forge/
├── knowledge/          ← Your artifacts live here
├── collections/        ← Collection manifests (YAML)
├── templates/          ← Nunjucks templates (internal)
├── dist/               ← Build output (generated, gitignored)
├── catalog.json        ← Generated catalog index
├── evals/              ← Evaluation configs
└── forge.config.yaml   ← Optional configuration
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (validation failure, missing files, etc.) |

All commands print errors to stderr with descriptive messages.