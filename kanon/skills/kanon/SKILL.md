---
name: kanon
description: "Onboarding and assistant guide for using the Kanon CLI & Context Bazaar to author, build, and manage knowledge artifacts for AI coding assistants."
---

# Kanon

## Overview

Kanon is a command-line tool that lets you write knowledge once and compile it for any AI coding assistant. Instead of maintaining separate configuration files for Kiro, Claude Code, Copilot, Cursor, and others, you author a single "knowledge artifact" and Kanon translates it into the right format for each tool.

Think of it like writing a document once and having it translated into the formats used by several AI coding assistants.

This guide helps Johns Hopkins Libraries staff get started with Kanon, whether you're creating your first artifact or managing the JH DRCC collection.

## Available Steering Files

| File | Trigger | Content |
|------|---------|---------|
| **tutorial** | `/tutorial` or ask "take me through the tutorial" | A 20-lesson sequential walkthrough that introduces coding agents, skills, and harnesses (Lessons 1–4), then covers Kanon CLI capabilities from setup through publishing (Lessons 5–20). Each lesson is self-contained so you can skip ahead |
| **self-paced-module** | `/module` or ask "show me the self-paced course" | Structured 3–4 hour course on coding agents and skill creation, with a safe practice artifact, assessments, answer key, and capstone review |
| **curriculum-guide** | ask for "curriculum guide" | Learning paths, curriculum map, facilitation notes, assessment strategy, accessibility considerations, and production-readiness questions for Johns Hopkins Libraries staff |
| **souk-compass-practice** | ask for "Souk Compass practice" | Optional 60–90 minute practice on semantic-search retrieval, source verification, incremental reindexing, and safe index scope after the MCP and evaluation lessons |
| **library-ai-workshop collection** | browse or install the collection | Four Codex skills for library AI learning: learner coaching, cohort facilitation, fictional reference-interview practice, and evidence-focused review of AI-assisted research output |
| **jhu-editorial-check** | ask for "JHU editorial check" | Review and revise Johns Hopkins communications while separating editorial guidance from official approval, legal, privacy, policy, and accessibility decisions |
| **authoring** | ask for "authoring guide" | Step-by-step guide to creating your first knowledge artifact, from idea to compiled output |
| **commands** | ask for "command reference" | Complete command reference with examples for every Kanon command |

### Using the Tutorial

To start the full sequential tutorial:

> `/tutorial`

To skip to a specific lesson, mention it by name or number:

> `/tutorial lesson 9` — Scaffolding a new artifact
>
> `/tutorial publishing` — Lesson 17
>
> `/tutorial take me to evals` — Lesson 16

The tutorial covers 20 lessons in order: coding agents → skills & artifact types → harnesses → getting started → setup → tutorial command → catalog → import → scaffold → edit → validate → build → temper → install → collections → eval → publish → upgrade → guild → next steps.

### Library AI Workshop Collection

The `library-ai-workshop` collection imports the [Library AI Workshop](https://github.com/eudaemon-ai/academic-ai-library-workshop) skills and their bundled course references. Install an individual skill for a focused task, or browse the collection first:

```bash
bun run dev catalog browse
bun run dev install facilitate-library-ai-workshop --harness codex --source .
```

The imported material is community content under MPL-2.0. It uses simulated files by default; review local privacy, accessibility, retention, copyright, and research-support policies before using it with library staff or patron-related work.

## Onboarding

### What You Need

- **Bun** (a JavaScript runtime) — install from [bun.sh](https://bun.sh)
- **Git** — for cloning the repository and version control
- A **terminal** — Terminal.app on macOS, or the integrated terminal in Kiro/VS Code

### Installing Bun

Open your terminal and run:

```bash
curl -fsSL https://bun.sh/install | bash
```

Close and reopen your terminal, then verify:

```bash
bun --version
```

You should see a version number like `1.x.x`.

### Getting the Repository

```bash
# Clone the agentic-skill-forge repository
git clone https://github.com/jhu-sheridan-libraries/agentic-skill-forge.git

# Move into the kanon directory (where the CLI lives)
cd agentic-skill-forge/kanon

# Install dependencies
bun install
```

### Verifying Your Setup

Run the tutorial to confirm everything works:

```bash
bun run dev tutorial
```

This guided walkthrough will:
1. Explain what artifacts are in plain language
2. Walk you through creating a sample artifact
3. Show you the generated files and explain each one
4. Build the artifact so you can see the compiled output

No coding experience is required — just follow the prompts.

### Your First Build

After the tutorial, try building all existing artifacts:

```bash
bun run dev build
```

This compiles every artifact in the `knowledge/` directory into harness-specific output in `dist/`.

### Browsing the Catalog

To see all available artifacts in a web interface:

```bash
bun run dev catalog browse
```

This opens a local web page (usually at http://localhost:3131) where you can explore artifacts, filter by collection, and see what's available.

## Key Concepts

| Concept | What It Means |
|---------|---------------|
| **Knowledge artifact** | A package of expertise — a skill, prompt, workflow, rule, or other structured knowledge that AI tools can use |
| **Harness** | An AI coding assistant (Kiro, Claude Code, Copilot, Cursor, Windsurf, Cline, Q Developer) |
| **Collection** | A group of related artifacts (e.g., "jh-drcc" for our library artifacts) |
| **Build** | The process of compiling your artifact into formats each harness understands |
| **Catalog** | A searchable index of all artifacts in the repository |

## Artifact Types

When creating an artifact, you choose a type that describes what kind of knowledge it contains:

| Type | Purpose | Example |
|------|---------|---------|
| **skill** | General knowledge injected into AI context | Coding standards, domain expertise |
| **power** | Kiro capability bundle with documentation | Tool guides, workflow documentation |
| **rule** | Lint-style rules for code quality | "Always use parameterized queries" |
| **workflow** | Step-by-step process guide | Release checklist, review process |
| **agent** | Agent definition with hooks and tools | Automated code reviewer |
| **prompt** | Reusable prompt template | Structured summary generator |
| **template** | Reference scaffold or boilerplate | Project starter template |
| **reference-pack** | Background reference (loaded on demand) | API documentation, style guides |

## Supported Harnesses

Kanon compiles artifacts for these AI coding assistants:

| Harness | What Gets Generated |
|---------|-------------------|
| **Kiro** | Steering files, hooks, powers, skills |
| **Claude Code** | CLAUDE.md, settings.json, MCP config |
| **GitHub Copilot** | Instructions, path-scoped rules, AGENTS.md |
| **Cursor** | Rules, MCP config |
| **Windsurf** | Rules, workflows, MCP config |
| **Cline** | Toggleable rules, hook scripts, MCP config |
| **Amazon Q Developer** | Rules, agents, MCP config |

## The JH DRCC Collection

The `jh-drcc` collection contains artifacts from the Johns Hopkins Digital Research and Curation Center. When you create an artifact for our team, include `jh-drcc` in the `collections` field of your artifact's frontmatter.

## Quick Reference

```bash
# Run any kanon command in dev mode
bun run dev <command>

# Create a new artifact
bun run dev new my-artifact-name

# Build all artifacts
bun run dev build

# Build for a specific harness only
bun run dev build --harness kiro

# Validate your artifacts
bun run dev validate

# Browse the catalog
bun run dev catalog browse

# Run the guided tutorial
bun run dev tutorial
```

## Common Questions

**Do I need to know how to code?**
No. Artifacts are written in Markdown (plain text with simple formatting). The wizard walks you through the metadata. You just need your expertise and a terminal.

**What if I only use one AI tool?**
That's fine. You can build for just one harness: `bun run dev build --harness kiro`. But your artifact will still be available to colleagues who use other tools.

**How do I share my artifact with the team?**
Commit it to the repository and push. The CI pipeline will validate and build it automatically. Other team members can then install it.

**What's the difference between a skill and a power?**
A skill is general knowledge that gets injected into AI context. A power is a Kiro-specific bundle that can include documentation, steering files, and MCP server configurations. If you're writing for Kiro specifically, use "power". For cross-harness knowledge, use "skill".

**Where do artifacts live?**
In the `kanon/knowledge/` directory. Each artifact is its own folder containing a `knowledge.md` file and optional `hooks.yaml` and `mcp-servers.yaml` files.

## Troubleshooting

### "Error: Kanon requires Bun"

You're trying to run kanon without Bun installed, or Bun isn't in your PATH.

**Fix:**
```bash
curl -fsSL https://bun.sh/install | bash
# Close and reopen your terminal
bun --version
```

### "Artifact already exists"

You tried to create an artifact with a name that's already taken.

**Fix:** Choose a different name, or check `knowledge/` to see what exists:
```bash
ls knowledge/
```

### Build warnings about "compatibility"

Some artifact features aren't supported by all harnesses. This is normal — Kanon will degrade gracefully and tell you what was skipped.

### "Permission denied" when running commands

**Fix (macOS):**
```bash
chmod +x src/cli.ts
```

Or prefix commands with `bun run dev` which handles permissions automatically.

## Best Practices

- Use **kebab-case** for artifact names: `my-cool-artifact`, not `MyCoolArtifact`
- Write descriptions that explain the **value**, not the implementation
- Include at least 3-5 **keywords** for discoverability
- Test your artifact with `bun run dev validate` before committing
- Add the `jh-drcc` collection tag for library-specific artifacts
- Keep artifact content focused — one artifact per topic area
- Use the `manual` inclusion strategy for reference material that shouldn't load automatically

## Next Steps

- Run **`/tutorial`** in chat for the complete sequential walkthrough — 20 lessons covering every capability
- Read the **authoring** steering file for a focused guide on creating artifacts
- Read the **commands** steering file for detailed documentation of every CLI command
- Browse existing artifacts with `bun run dev catalog browse` for inspiration
- Try the built-in CLI tutorial: `bun run dev tutorial`

## License, Privacy & Support

---
**License:** MIT (SPDX: `MIT`)
**Privacy Policy:** This is local documentation that guides you through the Kanon CLI. It collects no telemetry and transmits no data. The CLI runs locally; network access happens only when you explicitly publish artifacts or run evals. Source and statement: https://github.com/jhu-sheridan-libraries/agentic-skill-forge
**Support:** https://github.com/jhu-sheridan-libraries/agentic-skill-forge/issues
**Author:** Johns Hopkins DRCC
**MCP servers:** None — this is knowledge-only documentation.

## Reference Pointers

Load these only when the workflow calls for them (progressive disclosure):

- `references/authoring.md` — Authoring
- `references/commands.md` — Commands
- `references/curriculum-guide.md` — Curriculum Guide
- `references/self-paced-module.md` — Self Paced Module
- `references/souk-compass-practice.md` — Souk Compass Practice
- `references/tutorial.md` — Tutorial
