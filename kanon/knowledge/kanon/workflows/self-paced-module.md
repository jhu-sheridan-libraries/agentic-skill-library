# Self-paced Module on Coding Agents and Skill Creation

## Abstract

This module introduces Johns Hopkins University Libraries staff to the world of AI coding agents and structured knowledge artifacts. Learners will discover what Coding Agents are and how they operate within development environments, understand how Skills augment agent behavior by packaging domain expertise into consumable formats, and gain hands-on experience creating custom Skills using the Kanon CLI. No prior programming experience is required — only familiarity with a command-line terminal and a willingness to experiment. Designed for self-paced completion, the module guides learners from foundational concepts through practical exercises in approximately 120 to 240 minutes.

## Learning Outcomes

By the end of this module, learners will be able to:

1. **Explain** what a Coding Agent is and name at least three examples (e.g., Kiro, Claude Code, Copilot, Cursor, Windsurf, Cline, Q Developer).
2. **Distinguish** a Skill from other artifact types (power, rule, workflow, agent, prompt, template, reference-pack) by identifying at least two differentiating characteristics for each.
3. **Describe** the three-stage pipeline (parse, adapt, write) by which a Harness consumes a compiled Skill.
4. **Apply** the Kanon CLI to scaffold, edit, validate, and build a new Skill from scratch.
5. **Identify** at least one use case for a custom Skill within JHU Libraries workflows such as cataloging, metadata creation, or collection management.
6. **Analyze** a completed Skill artifact to determine whether its structure, metadata, and content meet validation requirements.

## Self-Assessment Checklist

Use this checklist to verify you have achieved each learning outcome. Each item maps to one or more outcomes above.

| Outcome | Demonstration Activity |
|---------|----------------------|
| 1 | Write a one-paragraph explanation of what a Coding Agent is and list at least three examples by name. |
| 2 | Given a scenario description, select the correct artifact type and explain why the alternatives do not apply. Identify at least two characteristics that differentiate a Skill from each other type. |
| 3 | Draw or describe the three-stage pipeline (parse, adapt, write) and explain what happens at each stage when a Harness processes a compiled Skill. |
| 4 | Run the full Kanon workflow (scaffold, edit, validate, build) in your terminal and produce a successfully compiled Skill artifact for at least one Harness. |
| 5 | Describe a specific JHU Libraries workflow (cataloging, metadata creation, or collection management) and explain how a custom Skill would improve it. |
| 6 | Run `kanon validate` on a completed Skill and interpret the output, identifying any errors and explaining how to resolve them. |

## Format

- **Delivery mode:** Self-paced. This module can be completed independently without an instructor.
- **Interaction:** All exercises use the Kanon CLI in a local development environment. Learners are expected to run CLI commands in a terminal window.
- **Estimated time:** 2–4 hours (approximately 120 to 240 minutes), depending on prior familiarity with command-line tools.
- **Structure:** Sequential lessons with a checkpoint after each section. Each checkpoint consists of a hands-on exercise or self-assessment question that the learner completes before proceeding to the next lesson.
- **Format:** Delivered as a Markdown-based Knowledge Artifact within the Kanon repository.
- **Prerequisites:** Familiarity with a command-line terminal (Terminal on macOS, PowerShell or WSL on Windows, or any Linux shell) and a working local installation of the Kanon CLI toolchain (Bun runtime and the Kanon package). Bun is available for macOS, Linux, and Windows. Run `bun --version` and `bunx kanon --help` to confirm your environment is ready.

## Module Lessons

### Module Lesson 1: Understanding Coding Agents

**Goal:** Understand what Coding Agents are, how they operate, and why context matters for their behavior.

#### What Is a Coding Agent?

A Coding Agent is an AI-powered assistant that operates within a development environment. It reads instructions you provide, considers surrounding context (open files, project documentation, loaded knowledge), and produces responses — answering questions, writing text, generating code, or suggesting solutions.

Think of a Coding Agent as a highly capable new colleague who arrives on your team with broad general expertise. Without specific guidance about your organization, this colleague will produce technically correct but generic work. The moment you hand them your organization's style guide, metadata standards, or cataloging conventions, their output immediately aligns with your expectations.

#### Examples of Coding Agents

Today, several widely used Coding Agents are available:

- **Kiro** — An AI development environment that uses structured steering files to guide behavior
- **Claude Code** — A conversational coding assistant that follows project-level instructions
- **Copilot** — A code-completion assistant integrated into popular editors
- **Cursor** — An AI-first editor that applies project rules and context documents
- **Windsurf** — An AI coding assistant with workspace-wide awareness
- **Cline** — An autonomous coding agent that operates within your editor
- **Q Developer** — An AI assistant for building on cloud platforms

Each of these agents can receive additional knowledge — packaged as Skills — to specialize its behavior for your domain.

#### How Context Shapes Behavior

When a Coding Agent receives a request, it assembles all available information into a context window — your current file, recent conversation, project settings, and any loaded Skills. The agent draws on everything in that window to formulate its response.

**Without a loaded Skill:** You ask the agent to "create a metadata record for this digital object." The agent produces a generic Dublin Core record using common defaults, missing your institution's required local fields and controlled vocabulary terms.

**With a loaded Skill:** The same request now produces a record following JHU Libraries' specific metadata profile, including required local extensions, preferred controlled vocabularies, and institutional naming conventions. The Skill provided the domain knowledge the agent needed to tailor its output.

The difference is context. By packaging your expertise into a Skill and loading it into the agent's awareness, you transform a general-purpose assistant into a domain-aware collaborator.

#### Checkpoint

- [ ] I can explain what a Coding Agent is in my own words
- [ ] I can name at least three Coding Agent platforms
- [ ] I can describe how context influences an agent's responses
- [ ] I can give an example of how a Skill changes agent behavior

---

### Module Lesson 2: Skills and Knowledge Artifacts

**Goal:** Learn what Skills are, how they differ from other artifact types, and when to choose each type.

#### What Is a Skill?

A Skill is a Knowledge Artifact that packages domain expertise, coding standards, or process knowledge into a structured format that a Coding Agent can consume. When loaded into an agent's context window, a Skill augments the agent's behavior — providing specialized knowledge it would not otherwise have.

Skills are authored once in a canonical Markdown format (with YAML frontmatter) and then compiled by Kanon into the specific file format required by each target Coding Agent platform.

#### The Eight Artifact Types

Kanon supports eight distinct artifact types. Each serves a different purpose:

| Type | Purpose |
|------|---------|
| **Skill** | Packages domain expertise that broadly applies across many tasks and files. |
| **Power** | Bundles tools, documentation, and optional MCP servers into an installable capability. |
| **Rule** | Defines a specific constraint or coding standard enforced during code generation. |
| **Workflow** | Documents a step-by-step process to follow for a recurring procedure. |
| **Agent** | Configures a specialized persona with specific capabilities and boundaries. |
| **Prompt** | Provides a reusable instruction template for a specific task pattern. |
| **Template** | Offers a file scaffold or boilerplate structure to generate from. |
| **Reference-pack** | Collects related reference documents into a single browsable bundle. |

#### How to Choose the Right Type

When deciding which artifact type to create, consider these characteristics of your use case:

1. **Breadth of application:** If the knowledge applies broadly across many different files, tasks, and contexts — choose **Skill**. If it describes a sequential procedure with specific steps — choose **Workflow**.

2. **Nature of the content:** If you are defining a constraint that must always be followed — choose **Rule**. If you are providing background knowledge that informs decisions — choose **Skill**.

3. **Reusability pattern:** If the content is a fill-in-the-blank instruction — choose **Prompt**. If it is a file structure meant to be copied — choose **Template**.

4. **Scope of identity:** If you need to define a specialized agent persona with boundaries — choose **Agent**. If you need to package tools and documentation together — choose **Power**.

#### JHU Libraries Scenarios

**Scenario 1: MARC Cataloging Standards**
A cataloger wants to ensure the Coding Agent always follows JHU's local MARC field extensions and indicator conventions when generating or reviewing catalog records. The knowledge applies broadly across many records and tasks, making **Skill** the correct type. A **Workflow** would be incorrect because this is not a sequential procedure — it is background knowledge that informs many different activities.

**Scenario 2: Metadata Quality Review Process**
A metadata librarian needs the agent to follow a specific step-by-step review checklist each time a new digital object is ingested. Because this is a sequential procedure with defined steps, **Workflow** is the correct type. A **Skill** would be incorrect because the content is procedural (do A, then B, then C) rather than broad domain knowledge.

**Scenario 3: Collection Naming Conventions**
A collection manager wants all file names and identifiers to follow specific patterns. Because this is a constraint that must always be enforced, **Rule** is the correct type. A **Skill** would be incorrect because the content defines a strict requirement rather than general domain knowledge.

#### Common Misclassification

A common mistake is choosing **Skill** when the content is actually a step-by-step procedure. For example, "How to process a new accession" describes sequential steps (receive material, assign identifier, create finding aid, notify stakeholders). This is a **Workflow**, not a Skill. The key differentiator: if the content is "do these steps in this order," it belongs in a Workflow. If the content is "here is knowledge to keep in mind broadly," it belongs in a Skill.

#### Checkpoint

- [ ] I can define what a Skill is and explain its purpose
- [ ] I can name all eight artifact types and state each one's purpose
- [ ] I can identify at least two characteristics that distinguish a Skill from other types
- [ ] I can select the correct artifact type for a given scenario and explain why

---

### Module Lesson 3: The Harness Ecosystem

**Goal:** Understand how Kanon compiles a single source artifact into multiple platform-specific formats through the Harness system.

#### What Is a Harness?

A Harness is the target AI coding assistant platform for which Kanon produces compiled output. Each Coding Agent platform expects knowledge to be delivered in a specific format — Kiro uses steering files, Claude Code uses CLAUDE.md project files, Copilot uses .github/copilot-instructions.md, and so on.

Rather than requiring authors to learn each platform's format, Kanon handles all translation automatically.

#### Author Once, Compile to Many

The core principle of Kanon is: write your knowledge once in a universal format, then compile it to any supported platform. This means:

- You write a single Skill in Kanon's Markdown format
- Kanon compiles that Skill into the correct format for each Harness you target
- Each Coding Agent receives the same knowledge, delivered in its native format

This eliminates the need to maintain separate copies of the same knowledge for different platforms.

#### Supported Harnesses

Kanon currently supports compilation to these Coding Agent platforms:

| Harness | Output Format |
|---------|---------------|
| Kiro | Steering files in the `.kiro/` directory |
| Claude Code | `CLAUDE.md` project instruction file |
| Copilot | `.github/copilot-instructions.md` |
| Cursor | `.cursor/rules/` rule files |
| Windsurf | `.windsurfrules` configuration |
| Cline | `.clinerules` configuration |
| Amazon Q Developer | Project-level instruction files |

#### The Three-Stage Pipeline: Parse, Adapt, Write

When you run a build command, Kanon processes your artifact through three stages:

1. **Parse** — Kanon reads your source Markdown file, separates the YAML frontmatter from the content body, and validates the structure against the artifact schema. At this stage, Kanon understands *what* you wrote.

2. **Adapt** — Kanon transforms the parsed content into the target Harness format. Each Harness has specific rules about file structure, section organization, and metadata placement. The adapter reshapes your content to match those rules while preserving meaning. At this stage, Kanon reformats *how* the knowledge is presented.

3. **Write** — Kanon outputs the adapted content to the correct file location with the correct file name for the target Harness. At this stage, Kanon delivers *where* the agent will find it.

#### Side-by-Side Comparison

Consider a Skill about metadata standards. The same source content compiled for two different Harnesses produces different outputs:

**For Kiro (Steering File):**
The compiled output becomes a structured steering file placed in the `.kiro/steering/` directory. The content is organized into sections that Kiro's steering system understands, with metadata as frontmatter and guidance as structured prose.

**For Claude Code (CLAUDE.md):**
The compiled output becomes a section within the project's `CLAUDE.md` file. The content is formatted as natural-language instructions that Claude Code reads when it loads the project context, with headings and bullet points that match Claude Code's instruction format.

Both outputs carry the same domain knowledge — your metadata standards — but each is formatted for its target platform's native consumption pattern.

#### No Harness Syntax Required

As an artifact author, you never need to learn Kiro's steering file format, Claude Code's CLAUDE.md conventions, Copilot's instruction syntax, or any other platform-specific configuration. Kanon handles all format translation automatically. You focus entirely on writing clear, well-structured knowledge content.

#### Checkpoint

- [ ] I can define what a Harness is and name at least three supported platforms
- [ ] I can explain the "author once, compile to many" principle in my own words
- [ ] I can describe what happens at each stage of the three-stage pipeline (parse, adapt, write)
- [ ] I understand that I do not need to learn platform-specific syntax

---

### Module Lesson 4: Scaffolding Your First Skill

**Goal:** Use the Kanon CLI to scaffold a new Skill artifact and understand the generated file structure.

#### Before You Begin

Verify your environment is ready:

```bash
bun --version
```

You should see a version number (e.g., `1.x.x`). If not, install Bun first:

**macOS / Linux:**

```bash
curl -fsSL https://bun.sh/install | bash
```

**Windows (PowerShell):**

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

You can also install via `npm install -g bun`, Scoop (`scoop install bun`), or WinGet (`winget install Oven-sh.Bun`). For the most consistent experience on Windows, consider using Windows Subsystem for Linux (WSL) and installing Bun inside your WSL terminal with the macOS/Linux command above.

Close and reopen your terminal after installation, then verify with `bun --version`.

Next, confirm Kanon is available:

```bash
bunx kanon --help
```

You should see the Kanon help output listing available commands.

#### Scaffolding a New Skill

The `kanon new` command launches an interactive wizard that guides you through creating a new artifact. Run it now:

```bash
bunx kanon new
```

The wizard will ask you several questions:

1. **Name** — Enter a short, descriptive name for your Skill (e.g., `jhu-metadata-standards`)
2. **Type** — Select `skill` from the list of artifact types
3. **Category** — Choose the category that best fits your domain (e.g., `libraries`, `development`)
4. **Description** — Write a one-sentence summary of what this Skill teaches an agent

After completing the wizard, Kanon creates a new directory with the scaffolded structure:

```
your-skill-name/
  knowledge.md      # Your Skill content goes here
  hooks.yaml        # Lifecycle hooks (optional)
  catalog.json      # Metadata about your artifact
```

#### Understanding the Scaffolded Files

**knowledge.md** — This is the primary file where you write your domain knowledge. It contains YAML frontmatter (metadata) at the top and Markdown content below. The frontmatter includes fields like `name`, `type`, `version`, and `description`. The body contains your actual expertise.

**hooks.yaml** — This optional file defines lifecycle hooks that run during build or install. For your first Skill, you can ignore this file.

**catalog.json** — This file contains machine-readable metadata about your artifact. Kanon populates it from your wizard answers. You rarely need to edit it manually.

#### Exercise: Scaffold Your Skill

Complete this hands-on exercise:

1. Open your terminal and navigate to a working directory
2. Run `bunx kanon new`
3. When prompted for a name, enter `jhu-cataloging-conventions`
4. Select `skill` as the type
5. Choose an appropriate category
6. Enter a description like "Cataloging conventions for JHU Libraries special collections"
7. Examine the generated files

#### Checkpoint

- [ ] I successfully ran `bunx kanon new` and completed the wizard
- [ ] I can locate and identify the three generated files (knowledge.md, hooks.yaml, catalog.json)
- [ ] I understand which file contains my actual Skill content (knowledge.md)
- [ ] I can describe the purpose of the YAML frontmatter in knowledge.md

---

### Module Lesson 5: Editing and Validating

**Goal:** Edit your scaffolded Skill with real domain content and validate it against Kanon's schema.

#### Editing knowledge.md

Open the `knowledge.md` file in your scaffolded Skill directory. You will see a structure like this:

```yaml
---
name: jhu-cataloging-conventions
type: skill
version: 0.1.0
description: Cataloging conventions for JHU Libraries special collections
---
```

Below the frontmatter (the section between `---` markers), add your domain knowledge as Markdown content. Write clearly and organize with headings. For example:

```markdown
## Cataloging Conventions

### Local Field Extensions

When cataloging special collections materials, always include the following local fields:
- **590** — Local notes specific to the JHU copy
- **691** — JHU subject headings from the local thesaurus
- **856** — Links to digitized versions in JHU Digital Collections

### Preferred Controlled Vocabularies

Use these vocabularies in priority order:
1. Library of Congress Subject Headings (LCSH)
2. Art & Architecture Thesaurus (AAT) for visual materials
3. JHU Local Terms List for institution-specific concepts
```

Write as if you are briefing a knowledgeable colleague who needs to understand your domain standards. Be specific, use examples, and organize logically.

#### Validating Your Skill

After editing, run the validation command to check your artifact against Kanon's schema:

```bash
bunx kanon validate
```

Run this from within your Skill's directory (the folder containing `knowledge.md`).

Kanon validates:
- **Structure** — Is the frontmatter well-formed YAML with all required fields?
- **Content** — Does the Markdown body follow expected patterns?
- **Metadata** — Are the name, type, version, and description valid?

If validation passes, you will see a success message. If it fails, Kanon reports specific errors with line numbers and descriptions so you can fix them.

#### Security Validation

For additional confidence, run validation with the security flag:

```bash
bunx kanon validate --security
```

This checks for common issues like accidentally included secrets, overly permissive patterns, or content that might cause unintended agent behavior.

#### Exercise: Edit and Validate

Complete this hands-on exercise:

1. Open `knowledge.md` in your scaffolded Skill directory
2. Add at least two sections of domain knowledge relevant to your JHU workflow
3. Save the file
4. Run `bunx kanon validate` from the Skill directory
5. If errors appear, read the messages and fix each one
6. Run validation again until it passes cleanly

#### Checkpoint

- [ ] I edited knowledge.md with real domain content organized under clear headings
- [ ] I ran `bunx kanon validate` and resolved any reported errors
- [ ] I understand what the validator checks (structure, content, metadata)
- [ ] My Skill passes validation without errors

---

### Module Lesson 6: Building and Installing

**Goal:** Build your validated Skill for one or more Harnesses and install it into a local project.

#### Building Your Skill

Once your Skill passes validation, compile it for a target Harness:

```bash
bunx kanon build --harness kiro
```

This compiles your Skill into Kiro's steering file format. The output file is placed in the correct directory structure for Kiro to discover.

To build for a different Harness:

```bash
bunx kanon build --harness claude-code
```

To build for all supported Harnesses at once:

```bash
bunx kanon build
```

Without specifying a `--harness` flag, Kanon compiles for all available targets.

#### Strict Mode

For production-quality artifacts, use strict mode which treats warnings as errors:

```bash
bunx kanon build --strict
```

This ensures your Skill meets the highest quality standards before distribution.

#### Installing Locally

After building, install the compiled Skill into a local project directory:

```bash
bunx kanon install
```

Kanon places the compiled output files in the correct locations within your project (e.g., `.kiro/steering/` for Kiro, `CLAUDE.md` for Claude Code). The Coding Agent in that project will now load your Skill automatically.

#### Verifying the Installation

After installation, verify that the compiled files exist:

```bash
ls .kiro/steering/
```

You should see your Skill listed. To confirm the Coding Agent recognizes it, open the project in your editor and ask the agent a question related to your Skill's domain. Its response should reflect the knowledge you authored.

#### Exercise: Build and Install

Complete this hands-on exercise:

1. From your Skill directory, run `bunx kanon build --harness kiro`
2. Observe the output — note the file path where the compiled Skill was written
3. Run `bunx kanon build --harness claude-code` to compile for a second Harness
4. Compare the two outputs — notice how the same knowledge is formatted differently
5. Run `bunx kanon install` in a project directory where you use a Coding Agent
6. Verify the installed files appear in the expected location

#### Checkpoint

- [ ] I successfully built my Skill for at least one Harness
- [ ] I can explain the difference between building and installing
- [ ] I built for multiple Harnesses and observed the different output formats
- [ ] I installed the compiled Skill into a local project and verified the files exist

---

## Congratulations

You have completed the self-paced module on Coding Agents and Skill Creation. You now understand what Coding Agents are, how Skills provide them with domain expertise, how the Harness system delivers that knowledge in platform-specific formats, and how to use the Kanon CLI to scaffold, edit, validate, build, and install your own custom Skills.

### Next Steps

- Explore the [Kanon Tutorial](tutorial.md) for a comprehensive walkthrough of all Kanon commands
- Read the [Authoring Guide](authoring.md) for advanced artifact authoring techniques
- Browse the [Commands Reference](commands.md) for detailed CLI documentation
- Create a Skill for a real workflow in your JHU Libraries team and share it with colleagues
