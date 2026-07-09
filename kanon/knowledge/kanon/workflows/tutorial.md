# Kanon Tutorial

A complete sequential walkthrough of every Kanon capability, from first install to publishing and team distribution. Each lesson is self-contained so you can skip ahead or return to a topic later.

## How to Use This Tutorial

- **First time?** Start at Lesson 1 and work through in order. Lessons 1–4 introduce core concepts (coding agents, skills, harnesses) and require no technical setup. Lessons 5–20 cover hands-on CLI usage.
- **Refreshing a topic?** Jump directly to the lesson you need using the table of contents.
- **Looking for a specific command?** See the Lesson Index below (commands appear in Lessons 5–20).

To skip to a lesson, tell the assistant something like "take me to Lesson 9" or "show me the publish lesson".

## Table of Contents

| # | Lesson | Covers |
|---|--------|--------|
| 1 | [What Are Coding Agents?](#lesson-1-what-are-coding-agents) | Coding agents, context, skills, harnesses |
| 2 | [Understanding Skills and Artifact Types](#lesson-2-understanding-skills-and-artifact-types) | Skills, 8 artifact types, decision criteria |
| 3 | [How Harnesses Work](#lesson-3-how-harnesses-work) | Author once compile many, supported harnesses |
| 4 | [Getting Started with Skill Creation](#lesson-4-getting-started-with-skill-creation) | Bridge to hands-on, readiness checklist |
| 5 | [Setup & Verification](#lesson-5-setup--verification) | Installing Bun, cloning, `bun install` |
| 6 | [The Guided Tutorial Command](#lesson-6-the-guided-tutorial-command) | `kanon tutorial` |
| 7 | [Exploring the Catalog](#lesson-7-exploring-the-catalog) | `kanon catalog generate`, `browse`, `export` |
| 8 | [Importing Existing Configs](#lesson-8-importing-existing-configs) | `kanon import` |
| 9 | [Scaffolding a New Artifact](#lesson-9-scaffolding-a-new-artifact) | `kanon new` + wizard |
| 10 | [Editing Your Artifact](#lesson-10-editing-your-artifact) | `knowledge.md`, `hooks.yaml`, `mcp-servers.yaml` |
| 11 | [Validation](#lesson-11-validation) | `kanon validate`, `--security` |
| 12 | [Building](#lesson-12-building) | `kanon build`, `--harness`, `--strict` |
| 13 | [Previewing with Temper](#lesson-13-previewing-with-temper) | `kanon temper`, compare, web |
| 14 | [Installing Locally](#lesson-14-installing-locally) | `kanon install` |
| 15 | [Collections](#lesson-15-collections) | `kanon collection new`, `build`, status |
| 16 | [Evaluating Artifacts](#lesson-16-evaluating-artifacts) | `kanon eval` and promptfoo |
| 17 | [Publishing](#lesson-17-publishing) | `kanon publish`, backends |
| 18 | [Upgrading](#lesson-18-upgrading) | `kanon upgrade` |
| 19 | [Team Distribution with Guild](#lesson-19-team-distribution-with-guild) | `kanon guild sync`, `status` |
| 20 | [Next Steps](#lesson-20-next-steps) | Where to go from here |

## Lesson Index (by Command)

If you know the command, jump straight to it:

| Command | Lesson |
|---------|--------|
| `kanon build` | [Lesson 12](#lesson-12-building) |
| `kanon catalog browse` | [Lesson 7](#lesson-7-exploring-the-catalog) |
| `kanon catalog export` | [Lesson 7](#lesson-7-exploring-the-catalog) |
| `kanon catalog generate` | [Lesson 7](#lesson-7-exploring-the-catalog) |
| `kanon collection *` | [Lesson 15](#lesson-15-collections) |
| `kanon eval` | [Lesson 16](#lesson-16-evaluating-artifacts) |
| `kanon guild *` | [Lesson 19](#lesson-19-team-distribution-with-guild) |
| `kanon import` | [Lesson 8](#lesson-8-importing-existing-configs) |
| `kanon install` | [Lesson 14](#lesson-14-installing-locally) |
| `kanon new` | [Lesson 9](#lesson-9-scaffolding-a-new-artifact) |
| `kanon publish` | [Lesson 17](#lesson-17-publishing) |
| `kanon temper` | [Lesson 13](#lesson-13-previewing-with-temper) |
| `kanon tutorial` | [Lesson 6](#lesson-6-the-guided-tutorial-command) |
| `kanon upgrade` | [Lesson 18](#lesson-18-upgrading) |
| `kanon validate` | [Lesson 11](#lesson-11-validation) |

---

## Lesson 1: What Are Coding Agents?

**Goal:** Understand what coding agents are and how they use context to shape their behavior.

### What Is a Coding Agent?

Think of a Coding Agent as a knowledgeable colleague who sits beside you while you work. Just as a new team member arrives with general expertise but gradually absorbs your organization's customs, naming conventions, and preferred approaches, a Coding Agent starts with broad knowledge and then adapts based on the specific guidance you provide.

A Coding Agent is an AI-powered assistant that operates within a development environment. It reads your instructions, considers the surrounding context, and produces responses — writing text, answering questions, or suggesting solutions. Without any additional guidance, it draws only on its general training. With targeted guidance loaded into its awareness, it tailors every response to your team's standards and domain.

Today, several Coding Agents are widely available:

| Agent Name | Description |
|------------|-------------|
| Kiro | An AI development environment that uses structured steering files to guide behavior |
| Claude Code | A conversational coding assistant that follows project-level instructions |
| Copilot | A code-completion assistant integrated into popular editors |
| Cursor | An AI-first editor that applies project rules and context documents |
| Windsurf | An AI coding assistant with workspace-wide awareness |
| Cline | An autonomous coding agent that operates within your editor |
| Q Developer | An AI assistant for building on cloud platforms |

Each of these agents can receive additional knowledge to specialize its behavior — and that is where context, Skills, and Harnesses come in.

### Three Key Terms

Before going further, here are three concepts you will encounter throughout this tutorial:

**Context** is like a briefing packet handed to a consultant before a meeting. It contains the background information, preferences, and constraints that shape how the consultant approaches the task. For a Coding Agent, context is any information loaded into its active awareness — project files, standards documents, or specialized knowledge — that influences how it responds.

**Skill** is a prepared briefing packet focused on a specific domain. Imagine writing down your organization's metadata standards, cataloging rules, or coding conventions in a structured document and handing it to every new team member on their first day. A Skill does exactly that for a Coding Agent: it packages domain expertise into a format the agent can consume, ensuring consistent and informed behavior.

**Harness** is the specific Coding Agent platform you want to deliver your Skill to. Think of it like choosing a delivery format for your briefing packet — one team member might need a printed binder, another might need an email summary, and a third might need a slide deck. The content is the same, but the format differs. A Harness is the target platform (such as Kiro, Claude Code, or Copilot) that determines what file format your Skill gets compiled into.

### How Context Shapes Agent Behavior

When a Coding Agent receives a request, it assembles all available context — your current file, recent conversation, and any loaded Skills — into a single window of awareness. The agent then draws on everything in that window to formulate its response.

Without a loaded Skill, the agent relies only on its general training. It may produce technically correct answers, but those answers will not reflect your organization's specific terminology, standards, or preferences.

With a loaded Skill, the agent gains access to your domain expertise. It now considers your cataloging conventions, your naming patterns, your preferred approaches — and weaves them into every response. The more relevant context an agent has, the more precisely it can tailor its output to your needs.

### Before and After: How a Skill Changes Agent Behavior

To illustrate the difference context makes, consider this scenario involving a library staff member who asks their Coding Agent for help describing a new digital collection.

**Without a Skill loaded (general behavior):**

The agent provides a generic response based on broadly applicable practices. It suggests common metadata fields like title, author, and date. It uses general terminology that could apply to any digital repository. The structure follows a one-size-fits-all template with no awareness of local standards, controlled vocabularies, or institutional naming conventions.

**With a "JHU Metadata Standards" Skill loaded (specialized behavior):**

The agent now draws on the loaded domain expertise. It recommends specific Dublin Core elements required by Johns Hopkins University Libraries. It applies the institutional controlled vocabulary for collection types. It follows the local naming convention for digital objects. It includes required fields unique to the JHU repository system and references the specific rights statements mandated by institutional policy.

The underlying agent is the same in both cases — what changed is the context available to it. Loading a Skill gave the agent access to domain-specific knowledge that it wove into its response automatically.

### Checkpoint

- [ ] I can describe what a Coding Agent is in my own words
- [ ] I can name at least five different Coding Agents
- [ ] I can explain what "context" means for a Coding Agent
- [ ] I can describe what a Skill does for a Coding Agent
- [ ] I can explain what a Harness is and why different ones exist

**Next:** [Lesson 2](#lesson-2-understanding-skills-and-artifact-types)

---

## Lesson 2: Understanding Skills and Artifact Types

**Goal:** Learn what Skills are and how they differ from other artifact types so you can choose the right type for your knowledge.

### What Is a Skill?

A Skill is a Knowledge Artifact that packages domain expertise into a format loadable into the context window of a supported AI coding assistant. Think of it as a reference guide that lives inside the agent's awareness — always available, always shaping how the agent responds.

When you create a Skill, you are capturing knowledge that applies broadly across many situations: institutional standards, domain conventions, best practices, or specialized terminology. The agent consults this knowledge whenever it encounters a relevant task, much like a well-trained staff member who has internalized your organization's policies.

### The Eight Artifact Types

Kanon recognizes eight distinct types of Knowledge Artifacts. Each serves a different purpose, and choosing the right type ensures your knowledge reaches the agent in the most effective form.

| Artifact Type | Purpose |
|---------------|---------|
| Skill | Packages domain expertise and standards that an agent applies broadly across many tasks and files. |
| Power | Bundles tools, integrations, and capabilities that extend what an agent can do beyond text generation. |
| Rule | Defines a specific constraint or guardrail that an agent must always follow without exception. |
| Workflow | Describes a step-by-step process that an agent follows to complete a structured multi-stage task. |
| Agent | Configures a specialized persona with defined responsibilities, boundaries, and interaction patterns. |
| Prompt | Provides a reusable instruction template that shapes a single interaction or request to an agent. |
| Template | Supplies a structural blueprint for generating files, documents, or outputs in a consistent format. |
| Reference-pack | Collects related reference materials into a single retrievable bundle for on-demand consultation. |

Each type has a distinct role. A Skill teaches the agent what to know. A Rule tells the agent what it must or must not do. A Workflow shows the agent how to proceed through ordered steps. Understanding these distinctions helps you place your knowledge in the right container.

### How to Decide When "Skill" Is the Right Choice

Choosing between artifact types comes down to observing the characteristics of your use case. Here are key criteria that point toward selecting "skill" over other types:

**Criterion 1: The knowledge applies broadly across many different tasks and files.**
If your expertise is relevant whenever the agent works within a particular domain — regardless of what specific task it is performing — then a Skill is appropriate. In contrast, if the knowledge describes a fixed sequence of steps for one particular process, a Workflow is the better fit.

**Criterion 2: The knowledge represents standards, conventions, or expertise rather than enforceable constraints.**
If you are capturing best practices, preferred approaches, or domain terminology that the agent should consider and apply thoughtfully, choose a Skill. If instead you need an absolute rule that must never be violated (such as "never expose credentials in output"), a Rule is the correct type.

**Criterion 3: The knowledge does not require external tool access or integrations.**
If your artifact is purely informational — teaching the agent about a domain without needing it to call external services or APIs — a Skill is correct. If the artifact needs to grant the agent new capabilities like accessing a database or calling a web service, a Power is the appropriate choice.

### Real-World Scenarios: Skills at JHU Libraries

The following scenarios illustrate how JHU Libraries staff would identify "skill" as the correct artifact type.

**Scenario 1: Dublin Core Metadata Standards**

A metadata librarian wants their Coding Agent to consistently apply the Johns Hopkins University Libraries metadata profile when describing digital objects. This profile specifies which Dublin Core elements are required, how controlled vocabularies should be applied, and what formatting conventions the institution follows.

Why "skill" is correct: The metadata standards represent domain expertise that the agent should apply broadly whenever it encounters metadata-related tasks. The knowledge is not a single step-by-step procedure — it is a body of conventions and requirements that inform many different activities (creating new records, reviewing existing ones, migrating collections).

Why "workflow" would be incorrect: A workflow describes a specific ordered process (step one, then step two, then step three). Metadata standards are not a process — they are a body of knowledge the agent draws upon across many different processes. Forcing standards into a workflow format would make them available only during one particular sequence of actions instead of being consistently present in the agent's awareness.

**Scenario 2: Cataloging Conventions for Special Collections**

An archivist wants their Coding Agent to understand the local cataloging conventions used for special collections at JHU Libraries. These conventions cover how to handle undated materials, how to structure hierarchical descriptions, and which local subject headings supplement the standard vocabularies.

Why "skill" is correct: Cataloging conventions represent accumulated expertise that applies across every cataloging task the agent might assist with. Whether the agent is helping draft a finding aid, suggesting subject headings, or reviewing a catalog record, it needs access to these conventions. The knowledge is broad, ongoing, and not tied to a single interaction.

Why "prompt" would be incorrect: A prompt is a one-time instruction template for a single interaction. Cataloging conventions need to be persistently available across all interactions — not just when you remember to include them in a specific request. Using a prompt would mean re-stating the conventions every time, defeating the purpose of captured institutional knowledge.

### Common Misclassification: When "Skill" Is Not the Right Choice

A common mistake is classifying a step-by-step procedure as a Skill when it should be a Workflow.

**Example:** A library staff member wants to create an artifact describing the process for onboarding a new digital collection — first request approval, then create a container record, then assign identifiers, then configure access permissions, then notify stakeholders.

This feels like it might be a Skill because it involves specialized knowledge about how the library operates. However, the defining characteristic here is the fixed sequence of ordered steps. The knowledge is not broad expertise to be applied flexibly — it is a specific procedure to be followed in order.

The correct artifact type is Workflow, because the content describes a structured multi-stage task with a defined beginning, middle, and end. A Skill would be the right choice if the content were the general principles and standards that inform each step (for example, "our naming convention for container records is..." or "access permissions follow these institutional policies..."), but the sequenced procedure itself belongs in a Workflow.

### Checkpoint

- [ ] I can define what a Skill is and what it packages for an AI coding assistant
- [ ] I can name all eight artifact types and describe how they differ
- [ ] I can identify at least two observable characteristics that indicate a use case calls for a Skill rather than another type
- [ ] I can explain why JHU metadata standards are best captured as a Skill rather than a Workflow or Prompt
- [ ] I can recognize when a step-by-step procedure should be a Workflow instead of a Skill

**Next:** [Lesson 3](#lesson-3-how-harnesses-work)

---

## Lesson 3: How Harnesses Work

**Goal:** Understand why Kanon compiles to multiple formats and what a Harness means for you as an artifact author.

### What Is a Harness?

In Lesson 1, you learned that a Harness is the specific Coding Agent platform you want to deliver your knowledge to. Now let us explore this concept more deeply.

A Harness is the target AI coding assistant platform for which Kanon produces compiled output. Each Coding Agent — Kiro, Claude Code, Copilot, and others — expects to receive guidance in its own particular format. One agent reads from a set of steering files organized in a specific folder structure. Another reads from a single project-level instruction document. A third looks for rule files in yet another location and layout.

Think of a Harness like a language translator at a conference. The speaker delivers one message, and each translator converts that same message into a different language for their audience. The meaning stays identical — only the delivery format changes. In Kanon, your artifact is the message, and each Harness is a translator that renders your knowledge into the format its corresponding Coding Agent understands.

### Author Once, Compile to Many

In Lesson 2, you learned that a Skill packages domain expertise into a Knowledge Artifact. You write that artifact exactly once, in a single canonical format. Kanon then takes that one source and automatically produces a correctly formatted version for every Harness you choose to target.

This is the "author once, compile to many" principle. You focus entirely on capturing your knowledge clearly and accurately. Kanon handles all the format translation — converting your single artifact into as many different platform-specific outputs as you need. Whether you want your knowledge available in two Coding Agents or seven, you never write it more than once.

This principle means that when a new Coding Agent emerges or an existing one changes its expected format, you do not need to rewrite your artifacts. Kanon simply adds or updates the relevant Harness, and your existing knowledge automatically compiles to the new format.

### Supported Harnesses

Kanon currently supports the following Coding Agent platforms as compilation targets:

| Harness | Coding Agent Platform |
|---------|----------------------|
| Kiro | An AI development environment that uses structured steering files |
| Claude Code | A conversational coding assistant that reads a project-level instruction document |
| Copilot | A code-completion assistant that reads instruction files from a designated folder |
| Cursor | An AI-first editor that applies project rules from a dedicated configuration area |
| Windsurf | An AI coding assistant that reads rule files from its own workspace folder |
| Cline | An autonomous coding agent that reads rule documents from its local configuration |
| Amazon Q Developer | An AI assistant that reads rule files from a platform-specific folder |

Each of these harnesses expects knowledge in a different format and location. As an artifact author, you do not need to know any of these details — Kanon manages them all for you.

### Same Artifact, Different Outputs

To see the "author once, compile to many" principle in action, consider what happens when you compile a single Skill — say, one that captures your organization's metadata standards — for two different Harnesses. The table below shows how the same artifact is delivered to each platform:

| Aspect | Kiro | Claude Code |
|--------|------|-------------|
| What the author writes | One Knowledge Artifact describing metadata standards | Same single Knowledge Artifact — no changes needed |
| Output format category | A steering file placed within a structured steering folder | A project-level instruction document that the agent reads on startup |
| How the agent receives it | The agent loads the steering file automatically based on its inclusion setting | The agent reads the instruction document whenever it opens the project |
| Author effort for this harness | None beyond writing the original artifact | None beyond writing the original artifact |

Notice that the "Author effort" row is the same for both: zero additional work. You wrote your metadata standards once. Kanon produced the correct output for each platform automatically. If you later decide to also target Cursor, Copilot, or any other supported Harness, you simply add it to your artifact's target list and rebuild — no rewriting required.

Here is another comparison showing two additional harnesses to illustrate the breadth of format translation:

| Aspect | Copilot | Cursor |
|--------|---------|--------|
| What the author writes | Same single Knowledge Artifact | Same single Knowledge Artifact |
| Output format category | An instruction file placed in a platform-specific repository folder | A rule document stored in the editor's configuration area |
| How the agent receives it | The agent reads the instruction file when assisting within the repository | The agent applies the rule document as project-level context |
| Author effort for this harness | None beyond writing the original artifact | None beyond writing the original artifact |

### You Do Not Need to Learn Harness-Specific Syntax

This is perhaps the most important takeaway from this lesson: as an artifact author, you do not need to learn any Harness-specific syntax, configuration format, folder structure, or tooling. Kanon handles all format translation automatically.

You will never need to memorize where each Coding Agent looks for its files. You will never need to learn the particular Markdown conventions or YAML structures that a specific platform requires. You will never need to restructure your content differently for different targets.

Your only job is to write clear, well-organized knowledge in the single canonical format you learned about in Lesson 2. Kanon does the rest.

### Checkpoint

- [ ] I can define what a Harness is in my own words
- [ ] I can explain the "author once, compile to many" principle
- [ ] I can name at least five supported Harnesses
- [ ] I can describe how the same artifact produces different output formats for different platforms
- [ ] I understand that I do not need to learn any Harness-specific syntax or configuration

**Next:** [Lesson 4](#lesson-4-getting-started-with-skill-creation)

---

## Lesson 4: Getting Started with Skill Creation

**Goal:** Bridge the conceptual foundations you have learned into hands-on artifact authoring so you feel confident beginning the creation process.

In the first three lessons you explored what Coding Agents are, how Skills package domain expertise for those agents, and how Harnesses allow a single artifact to reach multiple platforms. You now have the vocabulary and mental models needed to move from understanding into action. This lesson transitions you into the practical steps of creating your own Skill.

### The Three Steps of Creating a Skill

Creating a Skill follows a straightforward three-step process. Each step has a dedicated lesson later in this tutorial where you will perform the work hands-on:

| Step | What You Do | Where You Learn It |
|------|-------------|--------------------|
| Scaffolding | Generate the starter files and folder structure for your new artifact | Lesson 9: Scaffolding a New Artifact |
| Editing | Write and refine the knowledge content that your Skill will deliver to a Coding Agent | Lesson 10: Editing Your Artifact |
| Building | Compile your finished artifact into the platform-specific formats required by each target Harness | Lesson 12: Building Artifacts |

Think of these three steps like writing a letter: scaffolding is choosing your stationery and addressing the envelope, editing is composing the message itself, and building is printing copies formatted for each recipient's preferred reading device.

You do not need to memorize the details of each step right now. The purpose of this overview is simply to show you the path ahead so that when you reach Lessons 9, 10, and 12, you already know where each activity fits in the larger picture.

### You Are Ready

Before moving forward, confirm that you can do each of the following:

- [ ] I can explain what a Coding Agent is and how it uses context to shape its responses
- [ ] I can describe what a Skill does for a Coding Agent and why it matters
- [ ] I can name at least three Harnesses that Kanon supports
- [ ] I can outline the three main steps involved in creating a Skill

If every item feels comfortable, you are ready to begin working with the Kanon toolchain directly. If any item feels uncertain, revisit the earlier lesson where that concept was introduced — Lesson 1 for Coding Agents, Lesson 2 for Skills, and Lesson 3 for Harnesses.

### What Comes Next

You have two paths forward from here:

First, continue with Lesson 5 of this tutorial, which walks you through setting up your local environment so you can run Kanon on your own machine. The tutorial then guides you through every command and workflow step by step.

Second, consult the Authoring Guide for a condensed reference on creating a Knowledge Artifact from scratch. The Authoring Guide complements this tutorial by providing a streamlined overview you can return to once you are familiar with the basics.

For the most thorough learning experience, proceed to Lesson 9 (Scaffolding a New Artifact) after completing the setup lessons, keeping the Authoring Guide handy as a companion reference.

### Checkpoint

- [ ] I can list the three main steps of creating a Skill in order
- [ ] I can name the tutorial lesson associated with each step (Lesson 9 for scaffolding, Lesson 10 for editing, Lesson 12 for building)
- [ ] I can explain why no Harness-specific knowledge is needed to author a Skill
- [ ] I can identify both the Authoring Guide and Lesson 9 as recommended next steps for hands-on work

**Next:** [Lesson 5](#lesson-5-setup--verification)

---

## Lesson 5: Setup & Verification

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

**Next:** [Lesson 6](#lesson-6-the-guided-tutorial-command)

---

## Lesson 6: The Guided Tutorial Command

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

**Next:** [Lesson 7](#lesson-7-exploring-the-catalog)

---

## Lesson 7: Exploring the Catalog

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

**Next:** [Lesson 8](#lesson-8-importing-existing-configs)

---

## Lesson 8: Importing Existing Configs

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

**Next:** [Lesson 9](#lesson-9-scaffolding-a-new-artifact)

---

## Lesson 9: Scaffolding a New Artifact

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

**Next:** [Lesson 10](#lesson-10-editing-your-artifact)

---

## Lesson 10: Editing Your Artifact

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

**Next:** [Lesson 11](#lesson-11-validation)

---

## Lesson 11: Validation

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

**Next:** [Lesson 12](#lesson-12-building)

---

## Lesson 12: Building

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

**Next:** [Lesson 13](#lesson-13-previewing-with-temper)

---

## Lesson 13: Previewing with Temper

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

**Next:** [Lesson 14](#lesson-14-installing-locally)

---

## Lesson 14: Installing Locally

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

**Next:** [Lesson 15](#lesson-15-collections)

---

## Lesson 15: Collections

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

**Next:** [Lesson 16](#lesson-16-evaluating-artifacts)

---

## Lesson 16: Evaluating Artifacts

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

**Next:** [Lesson 17](#lesson-17-publishing)

---

## Lesson 17: Publishing

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

**Next:** [Lesson 18](#lesson-18-upgrading)

---

## Lesson 18: Upgrading

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

**Next:** [Lesson 19](#lesson-19-team-distribution-with-guild)

---

## Lesson 19: Team Distribution with Guild

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

**Next:** [Lesson 20](#lesson-20-next-steps)

---

## Lesson 20: Next Steps

You've seen every capability Kanon offers. Here's where to go from here.

### Build Something Real

Pick a piece of knowledge from your daily work that would help a colleague:

- A process you repeat (e.g., metadata QC for a new digital collection)
- A prompt you use often (e.g., generate LCSH from an abstract)
- A checklist (e.g., verify a catalog record)
- A coding pattern (e.g., how we structure data scripts)

Follow Lessons 9–14 to create, validate, build, and install it.

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

For any prompt artifact, add a promptfoo eval (Lesson 16). This builds confidence that your prompt works and lets you compare model tiers.

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
