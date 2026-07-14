# Self-Paced Course on Coding Agents and Skill Creation

## Abstract

This course introduces Johns Hopkins Libraries staff to coding agents and structured knowledge artifacts. Learners examine what coding agents can and cannot do, how skills add relevant instructions and domain context, and how Kanon turns one source artifact into formats for multiple agent platforms. A guided practice project leads learners through selecting an artifact type, scaffolding a skill, writing and reviewing content, validating the artifact, and building harness-specific output. No programming experience is required. Learners should be comfortable opening a terminal and editing a text file. The course takes approximately 180 to 240 minutes, including exercises and a final review.

## Learning Outcomes

By the end of this course, learners will be able to:

1. **Explain** what a coding agent is, identify its limits, and name at least three examples.
2. **Distinguish** a skill from the seven other Kanon artifact types by using purpose, scope, and mode of use.
3. **Describe** how Kanon parses, adapts, and writes a knowledge artifact for a selected harness.
4. **Apply** the Kanon CLI to scaffold, edit, validate, and build a new skill.
5. **Identify** a suitable use case for a custom skill in a Johns Hopkins Libraries workflow without placing restricted or unapproved information in the artifact.
6. **Analyze** a completed skill for structural validity, clear instructions, appropriate scope, and evidence of human review.

## Self-Assessment Checklist

Use this checklist after completing the lessons. Save your responses in a learning journal or other approved work location.

| Outcome | Demonstration Activity |
|---------|------------------------|
| 1 | Explain a coding agent to a colleague in five sentences or fewer; name three examples and one limitation. |
| 2 | Classify the three scenarios in Lesson 2 and justify each choice with purpose, scope, and mode of use. |
| 3 | Label a diagram with the stages parse, adapt, and write; describe the input and output of each stage. |
| 4 | Produce a scaffolded practice skill that passes validation and builds for at least one selected harness. |
| 5 | Complete the use-case canvas in Lesson 2, including the source owner, intended users, exclusions, and review plan. |
| 6 | Review the final artifact with the capstone rubric and record at least one revision made because of the review. |

## Course Format

- **Audience:** Johns Hopkins Libraries staff who want to capture reusable guidance for coding agents. The course assumes no programming experience.
- **Delivery:** Self-paced and designed for completion without an instructor.
- **Estimated time:** 3–4 hours. Each lesson includes a suggested time, but learners may pause between lessons.
- **Interaction:** Lessons 4–6 use the Kanon CLI in a local development environment. Learners run commands in a terminal and edit Markdown and YAML files.
- **Sequence:** Complete the lessons in order. Each lesson ends with a checkpoint that asks you to produce or verify something before continuing.
- **Materials:** This Markdown course, the Kanon repository, a text editor, and a terminal.
- **Prerequisites:** Bun, Git, a local copy of the repository, and permission to create practice files in that copy.
- **Companion resources:** Use the [Kanon Tutorial](tutorial.md) for command-by-command instruction, the [Authoring Guide](authoring.md) for field details, and the [Commands Reference](commands.md) for syntax.

## Before You Begin

### Work in a Practice Copy

The exercises create a sample artifact in the repository's `kanon/knowledge/` directory and generated files in `kanon/dist/`. Use a branch or another practice copy if you do not want those files mixed with current work.

### Protect Information

A knowledge artifact can be copied into projects and loaded into an agent's context. Do not place restricted, confidential, licensed, personally identifiable, or otherwise sensitive information in the practice artifact. Do not copy credentials, access tokens, private collection records, donor restrictions, internal-only procedures, or unpublished policy into an exercise.

Use invented practice content in this course. Before developing a production artifact, confirm that you may reuse the source material and identify the staff member or group responsible for reviewing it.

### Keep Human Review Central

A valid build means that Kanon can parse and compile an artifact. It does not mean that the content is factually correct, approved, accessible, complete, or appropriate for every use. The subject-matter owner remains responsible for reviewing the source guidance and testing the resulting agent behavior.

## Course Map

| Lesson | Topic | Suggested Time | Evidence of Completion |
|--------|-------|----------------|------------------------|
| 1 | Coding agents, context, and limits | 25 minutes | Short explanation and risk check |
| 2 | Artifact types and use-case selection | 35 minutes | Scenario answers and use-case canvas |
| 3 | Harnesses and the compile pipeline | 25 minutes | Pipeline explanation |
| 4 | Setup and scaffolding | 35–50 minutes | Generated practice artifact |
| 5 | Writing and validating | 50–65 minutes | Validated artifact and review notes |
| 6 | Building, inspecting, and capstone review | 40–55 minutes | Build output and completed rubric |

## Module Lessons

### Module Lesson 1: Coding Agents, Context, and Limits

**Goal:** Explain how a coding agent uses context, where it can help, and where human judgment is required.

#### What Is a Coding Agent?

A coding agent is an AI assistant that works in a development environment. Depending on the product and the permissions granted to it, an agent may read project files, answer questions, draft text or code, suggest edits, run tools, and check its work.

Examples include Kiro, Claude Code, OpenAI Codex, GitHub Copilot, Cursor, Windsurf, Cline, and Amazon Q Developer. Their features differ, but they share an important trait: the response depends on the instructions and information available during the interaction.

#### Context Shapes the Response

Context is the material available to the agent for a task. It may include:

- the request you entered;
- files in the current project;
- recent conversation messages;
- project-level instructions; and
- a loaded skill or other knowledge artifact.

Think of context as a work packet. A new colleague can do more useful work when the packet contains a clear request, the relevant standards, a model example, and the boundaries of the task. A larger packet is not automatically better. Irrelevant, conflicting, stale, or sensitive content can reduce quality or create risk.

#### What a Skill Changes

Suppose a staff member asks an agent to draft descriptive metadata for a practice collection.

Without local guidance, the agent may choose common fields and make assumptions about formatting. The response may look plausible but may not match the intended profile.

With a reviewed practice skill, the agent can follow the field definitions, formatting examples, and exclusions included in that skill. The output becomes more consistent with the supplied guidance. It still needs human review; the skill improves the available context but does not guarantee a correct record.

#### Limits to Remember

A coding agent can:

- summarize supplied guidance;
- apply repeatable patterns;
- draft examples and checklists;
- compare content with stated criteria; and
- help identify missing or inconsistent information.

A coding agent cannot independently establish that:

- a local standard is current or officially approved;
- a factual claim is correct when no reliable source is available;
- private or licensed material may be shared with a given tool;
- generated content meets professional, legal, policy, or accessibility requirements; or
- a successful technical build makes an artifact ready for production.

#### Practice: Explain It to a Colleague

Write five sentences or fewer that answer these questions:

1. What is a coding agent?
2. What is context?
3. What does a skill add?
4. What must a person still review?

Then list three coding agents by name.

#### Checkpoint

- [ ] My explanation distinguishes the agent from the context it receives.
- [ ] I named at least three coding agents.
- [ ] I identified at least one task that still requires human judgment.
- [ ] I can explain why sensitive information does not belong in the practice artifact.

---

### Module Lesson 2: Choosing the Right Artifact and Use Case

**Goal:** Select an artifact type based on what the content is for, how broadly it applies, and how a user or agent will use it.

#### The Eight Artifact Types

Kanon supports eight artifact types:

| Type | Primary Purpose | Useful Signal |
|------|-----------------|---------------|
| **Skill** | Supplies reusable domain knowledge or guidance. | The same guidance should inform several related tasks. |
| **Power** | Packages a capability with supporting guidance and optional integrations. | The user needs an installable bundle, not only written guidance. |
| **Rule** | States a narrow constraint that should be followed consistently. | The content is a clear requirement or prohibition. |
| **Workflow** | Guides an ordered, repeatable process. | The sequence of steps matters. |
| **Agent** | Defines a specialized role, responsibilities, and boundaries. | The work needs a persistent role or delegation pattern. |
| **Prompt** | Provides a reusable request for a specific interaction. | The user repeatedly asks for the same kind of output. |
| **Template** | Supplies a reusable output structure. | The required sections or fields matter more than background guidance. |
| **Reference-pack** | Groups source material for consultation when needed. | Users need supporting references without loading them all the time. |

An artifact can support another artifact. For example, a workflow may depend on a skill for domain guidance and use a template for the final output.

#### Three Questions for Classification

Ask these questions before choosing a type:

1. **Purpose:** Is this background guidance, a constraint, a sequence, a reusable request, a structure, a role, a reference set, or an integrated capability?
2. **Scope:** Should it apply across several tasks, or only during one defined activity?
3. **Mode of use:** Should the content be loaded as guidance, followed in order, filled in, retrieved on demand, or installed with tools?

A skill is a good choice when reviewed domain guidance should inform several related tasks. A skill is not a substitute for an official policy system, a fixed procedure, or an authoritative database.

#### Practice: Classify Three Scenarios

For each scenario, select an artifact type and explain your choice.

**Scenario A: Metadata review sequence**

A team has an approved sequence for checking required fields, reviewing names, recording rights information, and documenting exceptions. Staff should complete the steps in order.

**Scenario B: Finding-aid section structure**

Staff repeatedly need a blank structure with the same headings and placeholder fields. The artifact should provide the structure without supplying collection-specific facts.

**Scenario C: Descriptive-language guidance**

A reviewed guide explains preferred terminology, decision principles, and examples that should inform several description and review tasks.

Record your answer before opening the answer key at the end of this course.

#### Develop a Use-Case Canvas

Complete this canvas for a possible Libraries use case. Keep the first version small enough to test in one work session.

| Prompt | Your Notes |
|--------|------------|
| Working title | |
| Intended users | |
| Task or decision the artifact should support | |
| Why a skill is the right type | |
| Source documents or expertise | |
| Source owner or subject-matter reviewer | |
| Information that must be excluded | |
| One example request to test | |
| What a useful response should contain | |
| What would make the response unacceptable | |
| Review date or review trigger | |

Potential domains include metadata quality, accessible document preparation, repository documentation, digital preservation terminology, research data guidance, and collection description. These are prompts for exploration, not statements of approved Johns Hopkins Libraries standards.

#### Checkpoint

- [ ] I classified all three scenarios and justified each choice.
- [ ] I completed every row of the use-case canvas.
- [ ] I identified an owner or reviewer for the source knowledge.
- [ ] I wrote at least one explicit exclusion.
- [ ] My proposed use case is small enough to test.

---

### Module Lesson 3: Harnesses and the Compile Pipeline

**Goal:** Describe how one source artifact becomes output for one or more coding-agent platforms.

#### What Is a Harness?

In Kanon, a harness is a target coding-agent platform. Kanon currently recognizes these harness names:

| Harness Name | Platform | Default Output Category |
|--------------|----------|-------------------------|
| `kiro` | Kiro | Steering file |
| `claude-code` | Claude Code | CLAUDE.md guidance |
| `codex` | OpenAI Codex | AGENTS.md guidance |
| `copilot` | GitHub Copilot | Repository instructions |
| `cursor` | Cursor | Rule file |
| `windsurf` | Windsurf | Rule file |
| `cline` | Cline | Rule file |
| `qdeveloper` | Amazon Q Developer | Rule file |

Some harnesses support more than one output format. The scaffold wizard records selected harnesses and, when needed, asks which format to use. An artifact may target only the platforms relevant to its intended users.

#### Author Once, Compile for Selected Platforms

The source artifact contains the reviewed guidance. Kanon uses an adapter for each selected harness to represent that guidance in the format the platform expects. The source remains the place to revise the content; generated output should not become a second, separately maintained source.

#### Parse, Adapt, Write

Kanon's compile pipeline has three stages:

1. **Parse:** Read the source files, separate metadata from the body, and check whether the data matches the schema.
2. **Adapt:** Convert the parsed artifact into the selected harness's supported format. Kanon may report compatibility warnings when a harness cannot represent a feature fully.
3. **Write:** Save the generated files under the harness and artifact folders in `dist/`.

The harness consumes the written output. Kanon performs the parse, adapt, and write stages.

#### A Useful Distinction

Validation and building answer different questions:

- **Validation:** Is the source artifact structurally acceptable, and do selected checks identify a problem?
- **Build:** Can Kanon produce output for the selected harnesses?
- **Content review:** Is the guidance accurate, current, appropriately scoped, and approved for the intended use?
- **Behavior test:** Does an agent using the output respond as intended to representative requests?

All four checks matter. None replaces the others.

#### Practice: Explain the Pipeline

Complete this sentence for each stage:

- Parse takes __________ as input and produces __________.
- Adapt takes __________ as input and produces __________.
- Write takes __________ as input and saves __________.

Then explain why generated output should be rebuilt from the canonical source rather than edited independently.

#### Checkpoint

- [ ] I can name at least three supported harnesses.
- [ ] I can describe the input and output of parse, adapt, and write.
- [ ] I can distinguish validation, build, content review, and behavior testing.
- [ ] I know that a compatibility warning deserves review rather than automatic dismissal.

---

### Module Lesson 4: Set Up and Scaffold a Practice Skill

**Goal:** Verify the local toolchain and create a practice skill with the current Kanon scaffold wizard.

#### Open the Kanon Project

The repository's development commands run from the `kanon/` directory. Open a terminal, move to your local repository, and then move into that directory:

```bash
cd /path/to/agentic-skill-forge/kanon
```

Replace the example path with the location of your local copy.

If dependencies have not been installed in this copy, run:

```bash
bun install
```

Confirm that Bun and the development CLI are available:

```bash
bun --version
bun run dev --help
```

If either command fails, stop here and use Lesson 5 of the [Kanon Tutorial](tutorial.md) to troubleshoot setup.

#### Create the Artifact

This course uses the name `jhu-libraries-metadata-practice`. The word `practice` is intentional: the content is invented for learning and is not an official metadata profile.

Run:

```bash
bun run dev new jhu-libraries-metadata-practice --type skill
```

If an artifact with that name already exists, choose a different kebab-case name and use it in the remaining commands.

The wizard collects information such as a description, keywords, author, inclusion behavior, categories, target harnesses, ecosystem tags, and initial content. Depending on the selections, it may also ask about a harness-specific format, hooks, or MCP servers.

For this exercise:

- write a description that labels the artifact as practice content;
- choose `manual` inclusion when available so learners invoke it intentionally;
- select one or two harnesses you can inspect, such as `kiro` and `codex`;
- leave the initial knowledge body blank if you prefer to edit it in the next lesson;
- do not add hooks; and
- do not add MCP servers.

#### Inspect the Scaffold

The wizard writes the artifact under:

```text
knowledge/jhu-libraries-metadata-practice/
```

The scaffold contains:

| Path | Purpose |
|------|---------|
| `knowledge.md` | Canonical metadata and instructional content. |
| `hooks.yaml` | Optional event-driven actions; this exercise leaves the list empty. |
| `mcp-servers.yaml` | Optional tool-server definitions; this exercise leaves the list empty. |
| `workflows/` | Optional supporting workflow files. |

The generated catalog is repository-level. The scaffold does not create an artifact-level `catalog.json`.

#### Read the Frontmatter

Open `knowledge.md`. The YAML frontmatter appears between the first pair of `---` markers. It records the artifact name, description, version, type, inclusion behavior, target harnesses, and other metadata. The Markdown body begins after the second marker.

Do not change the `name` casually after scaffolding; folder names, references, and generated output use it as an identifier. For this exercise, confirm that:

- `type` is `skill`;
- the description says the content is for practice;
- the selected harnesses match your intended build; and
- no sensitive information appears in the file.

#### Checkpoint

- [ ] `bun --version` and `bun run dev --help` both completed successfully.
- [ ] The practice artifact exists under `knowledge/`.
- [ ] The directory contains `knowledge.md`, `hooks.yaml`, and `mcp-servers.yaml`.
- [ ] I can identify where the YAML frontmatter ends and the Markdown body begins.
- [ ] I selected no hooks or MCP servers for this exercise.

---

### Module Lesson 5: Write, Review, and Validate the Skill

**Goal:** Add clear practice guidance, review it as content, and validate the artifact structure.

#### Write for the Agent and the Human Reviewer

Good skill content states:

- when the guidance applies;
- what task it supports;
- what source or authority the guidance reflects;
- the instructions or decision criteria;
- examples of acceptable and unacceptable behavior;
- exclusions and escalation points; and
- how reviewers will know whether the guidance worked.

Avoid vague directives such as “use best practices” when you can name the relevant criteria. Do not ask an agent to guess missing facts. Tell it when to ask a question, preserve uncertainty, cite a supplied source, or stop for human review.

#### Add the Practice Content

In `knowledge.md`, leave the generated frontmatter in place. Replace the placeholder body below the second `---` marker with the following practice content. You may adapt the wording, but keep the label that identifies it as an exercise.

```markdown
# Practice Descriptive Metadata Guidance

## Status and Scope

This artifact contains invented examples for a Kanon training exercise. It is not an official Johns Hopkins Libraries metadata profile and must not be used for production records.

Use it only to draft a practice record from information supplied in the current request. Do not infer names, dates, rights, or access conditions that the source does not state.

## Practice Fields

For each practice object, return:

- Title: Copy the supplied title. If none is supplied, write “Title not provided.”
- Creator: Copy a supplied creator name without expanding initials or changing name order.
- Date: Copy the supplied date and retain uncertainty markers.
- Description: Write one or two factual sentences based only on the supplied information.
- Rights review: Write “Human review required” unless the request supplies an approved rights statement.

## Review Rules

1. Preserve uncertainty instead of inventing a value.
2. Separate supplied facts from suggestions.
3. Flag offensive or outdated source language for review; do not silently rewrite a quotation or title.
4. Do not include personal, restricted, or confidential information.
5. End with a short list titled “Items for human review.”

## Example

Input: A photograph titled “Library entrance,” creator not provided, circa 1985.

Expected characteristics: The title is copied, the creator is marked as not provided, the uncertain date is retained, no rights claim is invented, and review items are listed.
```

The example is deliberately modest. It gives the agent an observable response pattern without asserting a real local standard.

#### Conduct a Content Review

Before running the validator, read the artifact once as a subject-matter reviewer. Record answers to these questions:

1. Can a reader tell that the content is a practice exercise?
2. Does the scope say when to use and not use the guidance?
3. Does each instruction lead to behavior you could observe in an answer?
4. Does the artifact tell the agent what not to infer?
5. Does it require human review where authority is missing?
6. Did any sensitive or unapproved information enter the file?

Revise the body if any answer is no.

#### Validate One Artifact

From the `kanon/` directory, validate the practice artifact by path:

```bash
bun run dev validate knowledge/jhu-libraries-metadata-practice
```

If you used another name, replace the path. A passing result confirms that the source matches the expected structure. If validation fails, read the field name, message, and file path in the output. Correct the reported issue and run the command again.

Then run the additional security checks:

```bash
bun run dev validate knowledge/jhu-libraries-metadata-practice --security
```

Security validation looks for patterns associated with prompt injection, dangerous hooks, risky MCP commands, and obfuscated content. A clean result is useful evidence, but it is not a privacy, policy, accessibility, or factual-accuracy certification.

#### Common Validation Problems

| Symptom | What to Check |
|---------|---------------|
| YAML parse error | Indentation, quotation marks, list markers, and the opening and closing `---` lines. |
| Missing or invalid field | The field named in the error and the expected values in the Authoring Guide. |
| Unknown harness | Spelling and lowercase harness identifiers. |
| File not found | Your current directory and the path to the artifact folder. |
| Security finding | The exact text or command reported; remove unsafe content rather than disguising it. |

#### Checkpoint

- [ ] The body clearly identifies itself as invented practice content.
- [ ] I completed the six-question content review and made any needed revisions.
- [ ] Standard validation passes for the practice artifact.
- [ ] Security validation completes, and I reviewed every warning or error.
- [ ] I can explain why validation does not replace subject-matter review.

---

### Module Lesson 6: Build, Inspect, and Review the Capstone

**Goal:** Build harness-specific output, compare it with the canonical source, and evaluate the completed practice skill.

#### Build for One Selected Harness

Choose a harness listed in the artifact's frontmatter. For Kiro, run:

```bash
bun run dev build --harness kiro
```

For OpenAI Codex, run:

```bash
bun run dev build --harness codex
```

The build command scans the repository's source directories and builds every eligible artifact for the selected harness. It does not build only the practice artifact. Generated files go under `dist/<harness>/<artifact-name>/`. The build process may clear and recreate generated output for the selected harness.

If the result contains compatibility warnings, read them. A warning may indicate that the selected harness represents or omits a feature differently. This exercise has no hooks or MCP servers, which keeps the comparison focused on the knowledge content.

#### Inspect the Output

List the files for the practice artifact. For a Kiro build, run:

```bash
find dist/kiro/jhu-libraries-metadata-practice -maxdepth 3 -type f
```

Open the generated Markdown file and compare it with `knowledge/jhu-libraries-metadata-practice/knowledge.md`.

Look for:

- the practice title and scope statement;
- the five practice fields;
- the five review rules;
- the example; and
- any harness-specific wrapper text or metadata.

Do not edit the generated file to make a lasting change. Revise the canonical source and rebuild.

#### Optional: Preview an Installation

To see what a local Kiro installation would copy without changing files, run this from the `kanon/` directory:

```bash
bun run dev install jhu-libraries-metadata-practice --harness kiro --source . --dry-run
```

Lesson 14 of the [Kanon Tutorial](tutorial.md) covers installation destinations, overwrite behavior, and multi-harness options. Complete an actual installation only in a project where you have permission to add the generated instructions.

#### Behavior Test Design

Technical compilation is not the final test. Draft three requests that would reveal whether the skill works:

1. **Typical case:** Supply a title, creator, date, and short description.
2. **Missing-information case:** Omit the creator and rights statement.
3. **Boundary case:** Ask the agent to invent a missing creator or state that an item is free of copyright restrictions.

For each request, write the observable behavior you expect. The boundary case should be refused or corrected according to the practice guidance. If you test in a coding agent, use only invented content and record the tool, date, loaded artifact version, prompt, output, and review notes.

#### Capstone Rubric

Score each criterion from 0 to 2.

| Criterion | 0 | 1 | 2 |
|-----------|---|---|---|
| Purpose and scope | Missing or unclear | Partly stated | Intended use, exclusions, and practice status are explicit |
| Source and ownership | No owner or source plan | Owner or source named | Owner, source, and review trigger are recorded |
| Instruction quality | Vague or conflicting | Mostly usable | Specific, ordered where needed, and observable |
| Safety and data handling | Sensitive content or unsafe direction | General caution only | Clear exclusions, uncertainty handling, and escalation points |
| Structural validity | Validation fails | Validation passes with unresolved warnings | Standard and security results reviewed and resolved |
| Harness output | Build fails or content is missing | Build succeeds for one harness | Output preserves the intended guidance and warnings are reviewed |
| Testability | No representative requests | One or two simple requests | Typical, missing-information, and boundary cases have expected results |
| Human review | No review evidence | Informal review noted | Reviewer, date, findings, and revision are recorded |

**Interpretation:**

- **13–16:** The practice artifact demonstrates the course outcomes.
- **9–12:** Revise the lowest-scoring criteria and review again.
- **0–8:** Return to the relevant lesson before treating the exercise as complete.

A high practice score is not approval to use the artifact in production. A production artifact needs review from the relevant subject-matter and information-governance owners.

#### Final Checkpoint

- [ ] I built the artifact for at least one harness selected in its frontmatter.
- [ ] I compared the generated output with the canonical source.
- [ ] I reviewed every build warning.
- [ ] I designed three behavior tests, including a boundary case.
- [ ] I scored the artifact with the capstone rubric and recorded one revision.

---

## Answer Key and Model Responses

Use this section after completing the practices.

### Lesson 1 Model Response

A coding agent is an AI assistant that can work with files and tools in a development environment. Context is the set of instructions and information available for the current task. A skill adds reusable domain guidance to that context. The agent may produce incomplete or incorrect work, so a person must review facts, professional judgments, permissions, and final use. Examples include Kiro, Claude Code, and OpenAI Codex.

### Lesson 2 Scenario Answers

- **Scenario A:** Workflow. The defining feature is an approved sequence whose order matters. A related skill could supply background metadata knowledge, but it would not replace the procedure.
- **Scenario B:** Template. The primary need is a repeatable structure with fixed headings and placeholders.
- **Scenario C:** Skill. Reviewed guidance and examples should inform several related description and review tasks. If one statement must function as an absolute constraint, that statement might also belong in a rule.

### Lesson 3 Pipeline Model

- Parse takes canonical source files as input and produces a validated, structured representation of the artifact.
- Adapt takes that structured artifact as input and produces content shaped for a selected harness and format.
- Write takes the adapted result as input and saves harness-specific files under `dist/`.

Generated files should be rebuilt from the source because the canonical artifact is the maintained record. Editing output independently creates copies that can conflict or disappear during the next build.

## Completion Record

Copy this record into your learning journal if your unit tracks professional development.

| Item | Entry |
|------|-------|
| Learner | |
| Completion date | |
| Practice artifact name | |
| Harness or harnesses built | |
| Validation result | |
| Capstone score | |
| Most important revision | |
| Follow-up question or proposed real use case | |

## Next Steps

- Continue through the [Kanon Tutorial](tutorial.md) for catalog, import, collections, evaluation, publishing, upgrading, and team distribution.
- Use the [Authoring Guide](authoring.md) when refining frontmatter, inclusion behavior, hooks, MCP servers, or workflow files.
- Complete the optional [Souk Compass Practice](souk-compass-practice.md) after Tutorial Lessons 10 and 16 if you have access to an approved semantic-search environment.
- Before creating a production skill, identify the content owner, approved source material, intended audience, test cases, review date, and distribution boundary.
- Pair with a colleague for the first production review. One person can check subject matter and another can test whether the instructions produce the intended behavior.