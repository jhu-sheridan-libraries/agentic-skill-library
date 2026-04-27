<!-- forge:version 0.1.7 -->
---
name: Codeshop
displayName: Codeshop
description: A collection of 19 developer workflow skills covering planning, design, development, testing, writing, and knowledge management. Actionable, phase-driven workflows with shared vocabulary and natural chaining. Consolidates proven practices for TDD, architecture review, domain modeling, issue triage, and documentation into a single activatable 'skill router'.
keywords: ["codeshop","planning","interface-design","test-driven-development","refactoring","domain-modeling","issue-triage","prd","vertical-slices","codebase-architecture","bug-triage","qa-session","skill-authoring","article-editing","living-documentation","code-review-craft","commit-messages","debugging-methodology"]
author: Steven J. Miklovic
---

## Onboarding

Codeshop is a collection of 19 developer workflow skills covering planning, design, development, testing, writing, and knowledge management. Each skill is either a multi-phase Workflow Skill (with step-by-step phases you progress through) or a flat Knowledge Skill (a behavioral mode or reference you load once). Together they give you structured, opinionated workflows for tasks like TDD, architecture review, domain modeling, issue triage, PRD drafting, and documentation.

### How it works

When you activate the codeshop power, the agent receives this document and a list of available steering files. The **Skill Router** section below maps your request to the right steering file. The agent matches your intent to a skill, calls `readSteering` to load that skill's instructions, and for Workflow Skills loads each phase file in sequence as you progress through the workflow.

### Prerequisites

Some workflows depend on external tools or project conventions. Set these up before you need them:

- **`gh` CLI installed and authenticated** — Required by workflows that file GitHub issues: `draft-prd`, `compose-issues`, `triage-bug`, `run-qa-session`, `plan-refactor`. Run `gh auth status` to verify.
- **Test runner configured** — Required by `drive-tests`. Your project needs a working test command (e.g., `bun test`, `vitest --run`, `jest`).
- **`CONTEXT.md` / `docs/adr/` conventions** — Used by `challenge-domain-model` and `refactor-architecture`. These files are created lazily by those workflows if they don't exist yet, so no upfront setup is needed.

### Try it

Ask the agent something like:

- "Grill me on this plan" — triggers `stress-test-plan` to pressure-test your design
- "Let's do TDD" — triggers `drive-tests` to walk you through test-driven development
- "Triage this bug" — triggers `triage-bug` to diagnose and plan a fix

## Skill Router

Match the user's request to the right steering file. Each skill is either a **Workflow** (multi-phase, with `workflows/` phase files) or **Knowledge** (flat steering file, loaded once). Load the steering file with `readSteering` using the filename shown below.

### Planning and Design

| Skill | Type | Steering File | Triggers | Description |
|---|---|---|---|---|
| stress-test-plan (grill-me) | Knowledge | `stress-test-plan.md` | "grill me", "stress test", "challenge my plan" | Interview the user relentlessly about a plan or design until reaching shared understanding, resolving each branch of the decision tree. |
| draft-prd (to-prd) | Workflow | `draft-prd.md` | "write a PRD", "product requirements", "draft PRD" | Turn the current conversation context and codebase understanding into a PRD, then submit it as a GitHub issue. |
| compose-issues (to-issues) | Workflow | `compose-issues.md` | "create issues", "break into issues", "file issues" | Break a plan, spec, or PRD into independently-grabbable GitHub issues using tracer-bullet vertical slices. |
| design-interface (design-an-interface) | Workflow | `design-interface.md` | "design interface", "API design", "interface options" | Generate multiple radically different interface designs for a module, compare trade-offs, and synthesize the best approach. |
| plan-refactor (request-refactor-plan) | Workflow | `plan-refactor.md` | "plan refactor", "refactoring plan", "refactor strategy" | Create a detailed refactor plan with tiny commits via user interview, then file it as a GitHub issue. |

### Development

| Skill | Type | Steering File | Triggers | Description |
|---|---|---|---|---|
| drive-tests (tdd) | Workflow | `drive-tests.md` | "TDD", "test-driven", "let's do TDD", "red-green-refactor" | Test-driven development with red-green-refactor loop — vertical slices, not horizontal layers. |
| triage-bug (triage-issue) | Workflow | `triage-bug.md` | "triage bug", "diagnose bug", "bug report" | Investigate a reported problem, find its root cause, and create a GitHub issue with a TDD-based fix plan. |
| journal-debug (debug-journal catalog) | Workflow | `journal-debug.md` | "debug journal", "debugging session", "isolate bug" | Systematic debugging workflow — articulate the problem before chasing the solution using the three-sentence rule. |
| run-qa-session (qa) | Workflow | `run-qa-session.md` | "QA session", "quality check", "find bugs" | Interactive QA session where the user reports bugs conversationally and the agent files durable GitHub issues. |
| review-changes (review-ritual catalog) | Workflow | `review-changes.md` | "review PR", "code review", "review changes" | Code review as a craft — read with intent, comment with purpose, approve with confidence. |
| refactor-architecture (improve-codebase-architecture) | Workflow | `refactor-architecture.md` | "architecture review", "improve architecture", "codebase architecture" | Surface architectural friction and propose deepening opportunities — refactors that turn shallow modules into deep ones. |
| challenge-domain-model (domain-model) | Workflow | `challenge-domain-model.md` | "domain model", "challenge model", "domain grilling" | Grilling session that challenges your plan against the existing domain model, sharpens terminology, and updates CONTEXT.md and ADRs inline. |

### Writing and Knowledge

| Skill | Type | Steering File | Triggers | Description |
|---|---|---|---|---|
| edit-article (edit-article) | Knowledge | `edit-article.md` | "edit article", "proofread", "improve writing" | Edit and improve articles by restructuring sections, improving clarity, and tightening prose. |
| define-glossary (ubiquitous-language) | Knowledge | `define-glossary.md` | "define glossary", "ubiquitous language", "domain terms" | Extract a DDD-style ubiquitous language glossary from the current conversation, flagging ambiguities and proposing canonical terms. |
| write-living-docs (new, original to codeshop) | Workflow | `write-living-docs.md` | "living docs", "documentation audit", "harvest docs" | Derive reliable, low-effort documentation from authoritative sources in the codebase using Living Documentation principles. |
| craft-commits (commit-craft catalog) | Knowledge | `craft-commits.md` | "commit message", "craft commit", "conventional commit" | Write commit messages that tell the story of why, not just what — conventional commit format with motivation over mechanics. |
| map-context (zoom-out) | Knowledge | `map-context.md` | "zoom out", "map context", "show dependencies" | Zoom out to a higher level of abstraction and map all relevant modules and callers for an unfamiliar area of code. |
| laconic-output (caveman) | Knowledge | `laconic-output.md` | "be brief", "laconic mode", "terse output", "spartan mode" | Spartan communication mode — every word earns its place or gets cut. Grammar stays intact, sentences stripped to their load-bearing minimum. No warmth, no hedging, no filler. |
| author-knowledge (write-a-skill) | Workflow | `author-knowledge.md` | "write a skill", "author knowledge", "create artifact" | Author canonical knowledge artifacts with proper structure, frontmatter, and optional workflows — Skill Forge handles compilation to any harness. |

## Shared Concepts

These cross-cutting concepts are referenced by multiple skills. Steering files reference this section rather than redefining these terms, keeping vocabulary consistent across all codeshop workflows.

### Deep Modules

A deep module has a small, simple interface that hides significant complexity behind it. The ratio of functionality to interface surface area is high — callers get a lot of value without needing to understand the internals.

When designing or refactoring, prefer deep modules over shallow ones. A shallow module has an interface nearly as complex as its implementation, forcing callers to understand the internals anyway. Deep modules reduce cognitive load and make systems easier to change because the complexity is concentrated behind a stable boundary.

Ask: "Could a caller use this module knowing only its signature and a one-sentence description?" If yes, it's deep. If the caller needs to understand internal state, ordering constraints, or implementation details, it's shallow.

Referenced by: `drive-tests`, `refactor-architecture`, `draft-prd`, `design-interface`.

### Vertical Slices / Tracer Bullets

A vertical slice (or tracer bullet) is a thin end-to-end path through all layers of the system. Instead of building one complete layer at a time (all models, then all services, then all UI), you build a narrow slice that touches every layer — from the user-facing boundary down to persistence (or whatever the system's outermost boundaries are).

Each slice delivers a working feature, however minimal. This approach:

- Proves the integration works early, before you've invested in building out any single layer
- Gives you a deployable increment at every step
- Surfaces architectural friction immediately rather than at integration time
- Makes progress visible and testable

When breaking work into issues or planning TDD iterations, slice vertically. "User can create a todo item" is a vertical slice. "Implement the database schema for all entities" is a horizontal layer — avoid it.

Referenced by: `drive-tests`, `compose-issues`, `triage-bug`.

### Domain Language Discipline

Every project has a vocabulary — the terms that appear in its domain model, its `CONTEXT.md`, its ubiquitous language glossary. Domain language discipline means using those terms consistently in all artifacts: code identifiers, comments, commit messages, issue titles, documentation, and conversation.

When you encounter a term in the codebase, use it exactly as defined. Don't introduce synonyms ("user" vs "account" vs "member" for the same concept). Don't abbreviate canonical terms. If a term feels wrong, challenge it through the `challenge-domain-model` workflow rather than silently introducing an alternative.

This discipline compounds: consistent language makes code searchable, issues traceable, and conversations unambiguous. Inconsistent language creates hidden translation layers that slow everyone down.

Referenced by: `challenge-domain-model`, `refactor-architecture`, `run-qa-session`.

### Durable Issues

A durable issue is a GitHub issue that survives refactors. It describes a behavior or outcome, not a file path or implementation detail. Durable issues remain valid even when the codebase is restructured, files are renamed, or modules are extracted.

**Durable:** "Users cannot reset their password if their account was created via SSO"
**Fragile:** "Fix `resetPassword()` in `src/auth/handlers.ts` — the SSO check on line 47 is wrong"

The fragile version breaks the moment someone renames the file, moves the function, or changes the line. The durable version stays useful because it describes the problem in terms of user-visible behavior.

When filing issues (via `compose-issues`, `triage-bug`, or `run-qa-session`), always use durable language:

- Describe behaviors, not file paths
- Name types and interfaces, not line numbers
- State what should happen vs what does happen
- Include acceptance criteria that can be verified without knowing the current file structure

Referenced by: `run-qa-session`, `triage-bug`, `compose-issues`.

### Agent Brief Format

An agent brief is a structured comment posted on a GitHub issue that serves as the authoritative specification for work. The original issue body and discussion are context — the agent brief is the contract. Use this format when any codeshop workflow files a GitHub issue.

**Principles:**

- **Durability over precision** — Describe interfaces, types, and behavioral contracts. Do not reference file paths or line numbers — they go stale. The brief should stay useful even as the codebase changes.
- **Behavioral, not procedural** — Describe what the system should do, not how to implement it. Good: "The `SkillConfig` type should accept an optional `schedule` field of type `CronExpression`." Bad: "Open src/types/skill.ts and add a schedule field on line 42."
- **Complete acceptance criteria** — Every brief must have concrete, testable acceptance criteria. Each criterion should be independently verifiable.
- **Explicit scope boundaries** — State what is out of scope to prevent gold-plating or assumptions about adjacent features.

**Template:**

```markdown
## Agent Brief

**Category:** bug / enhancement
**Summary:** one-line description of what needs to happen

**Current behavior:**
Describe what happens now. For bugs, this is the broken behavior.
For enhancements, this is the status quo the feature builds on.

**Desired behavior:**
Describe what should happen after the agent's work is complete.
Be specific about edge cases and error conditions.

**Key interfaces:**
- `TypeName` — what needs to change and why
- `functionName()` return type — what it currently returns vs what it should return
- Config shape — any new configuration options needed

**Acceptance criteria:**
- [ ] Specific, testable criterion 1
- [ ] Specific, testable criterion 2
- [ ] Specific, testable criterion 3

**Out of scope:**
- Thing that should NOT be changed or addressed in this issue
- Adjacent feature that might seem related but is separate
```

Referenced by: any workflow that files GitHub issues (`compose-issues`, `triage-bug`, `run-qa-session`, `plan-refactor`, `draft-prd`).

### Out-of-Scope Knowledge Base

The `.out-of-scope/` directory in a repo stores persistent records of rejected feature requests. It serves two purposes: institutional memory (why a feature was rejected, so the reasoning isn't lost when the issue is closed) and deduplication (when a new issue matches a prior rejection, surface the previous decision instead of re-litigating it).

**Directory structure:**

```
.out-of-scope/
├── dark-mode.md
├── plugin-system.md
└── graphql-api.md
```

One file per concept, not per issue. Multiple issues requesting the same thing are grouped under one file.

**File format:**

Each file should be written in a readable style — more like a short design document than a database entry. Use paragraphs, code samples, and examples to make the reasoning clear.

```markdown
# Concept Name

This project does not support [concept] because [reason].

## Why this is out of scope

Substantive explanation referencing project scope, technical constraints,
or strategic decisions. Avoid temporary circumstances ("we're too busy") —
those are deferrals, not rejections.

## Prior requests

- #42 — "Original request title"
- #87 — "Related request title"
```

**Naming:** Use short, descriptive kebab-case names: `dark-mode.md`, `plugin-system.md`.

**When to check:** During triage, read all files in `.out-of-scope/`. Match by concept similarity, not keyword — "night theme" matches `dark-mode.md`. If there's a match, surface it to the maintainer with the prior reasoning.

**When to write:** Only when an enhancement (not a bug) is rejected as `wontfix`. Create or update the matching file, post a comment on the issue explaining the decision, and close with the `wontfix` label.

**Updating or removing:** If the maintainer changes their mind, delete the `.out-of-scope/` file. The new issue proceeds through normal triage.

Referenced by: `triage-bug`, `run-qa-session`, `compose-issues`.

### Living Documentation Principles

Living documentation is documentation that is collaborative, insightful, reliable, and low-effort. It derives from authoritative sources in the codebase (tests, types, configuration, ADRs, code structure) rather than being written as standalone prose that drifts out of sync.

**Core principles:**

- **Collaborative** — Documentation is a conversation between the team and the codebase, not a solo writing exercise. Multiple contributors refine it through the same review process as code.
- **Insightful** — Documentation should reveal knowledge that isn't obvious from reading the code alone: rationale, trade-offs, domain context, and architectural intent.
- **Reliable** — If documentation can become stale, it will. Derive it from authoritative sources (test names as behavioral specs, type signatures as API contracts, ADRs as decision records) so it stays accurate as the code evolves.
- **Low-effort** — The best documentation is harvested, not written. Extract it from what already exists rather than creating a parallel maintenance burden.

**Anti-patterns to avoid:**

- **Information Graveyard** — Documentation that nobody reads because it's too long, too stale, or too disconnected from the code.
- **Human Dedication** — Relying on a single person to keep docs updated. When they leave or get busy, the docs rot.
- **Speculative Documentation** — Documenting features or designs that haven't been built yet. Wait until the code exists.
- **Comprehensive Documentation** — Trying to document everything. Focus on knowledge that is long-lived, widely needed, or critical.

Referenced by: `write-living-docs`.

## Workflow Composition

Codeshop workflows chain naturally — the output of one becomes the input of the next. These chains represent proven sequences where each step builds on the previous one's deliverables.

### Planning Chain

`stress-test-plan` → `draft-prd` → `compose-issues` → `drive-tests`

Grilling sharpens the plan by exposing gaps and assumptions, the PRD formalizes the refined plan into a structured document, issues break the PRD into independently-grabbable vertical slices, and TDD implements each slice with tests leading the way.

### Bug-Fix Chain

`triage-bug` → `drive-tests`

Triage investigates the problem and produces a TDD-based fix plan with a failing test specification, which `drive-tests` can execute directly through its red-green-refactor loop.

### Architecture Chain

`refactor-architecture` → `plan-refactor` → `compose-issues`

Architecture review surfaces shallow modules and friction points as refactoring candidates, the refactor plan details the approach with scoped commits via user interview, and issues break the plan into durable, independently-grabbable work items.

### Domain Chain

`challenge-domain-model` → `define-glossary` → `refactor-architecture`

Domain grilling challenges assumptions and sharpens terminology against the existing model, the glossary formalizes the refined terms into a canonical ubiquitous language, and architecture review uses that precise language to evaluate module boundaries and naming.

### Documentation Chain

`refactor-architecture` → `write-living-docs` → `challenge-domain-model`

Architecture review surfaces what changed and why, living docs harvests that knowledge from authoritative sources into reliable documentation, and domain model grilling ensures the terminology captured in those docs stays precise and consistent.

### Delivery Chain

`compose-issues` → `drive-tests` → `review-changes`

Issues define the work as vertical slices with clear acceptance criteria, TDD implements each slice with tests proving correctness, and review validates that the changes match intent and meet quality standards.

### Feedback Chain

`review-changes` → `triage-bug` (review finds a bug) or `review-changes` → `plan-refactor` (review surfaces a refactoring opportunity)

Code review is a branching point — when it uncovers a defect, triage-bug investigates and files it with a fix plan; when it reveals structural friction, plan-refactor captures the improvement as a scoped refactoring proposal.

### Debugging Chain

`triage-bug` → `journal-debug` → `drive-tests`

Triage identifies the bug and narrows the search space, the debug journal isolates the root cause through systematic articulation and binary search, and TDD verifies the fix with a regression test that prevents recurrence.

### Commit Chain

`drive-tests` → `review-changes` → `craft-commits`

TDD produces working, tested changes, review validates they meet quality and intent, and craft-commits writes commit messages that capture the rationale — why the change was made, not just what changed.

---

When a workflow completes, reference this section to suggest the natural next workflow in the chain. If the completed workflow appears as a step in one of these chains, offer to continue with the next workflow in the sequence.

## Companion Powers

These external powers complement codeshop but are NOT bundled — they are activated separately via the Powers system. Suggest them when the user's context would benefit from their specialized guidance.

- **adr** — Full ADR lifecycle management: create, update, review, health check, and cross-reference ADRs. Suggest activating when `refactor-architecture` or `challenge-domain-model` surfaces architectural decisions worth recording.

- **type-guardian** — TypeScript type discipline: strict mode enforcement, discriminated unions, utility types, and type-safe patterns. Suggest activating for TypeScript codebases when using `drive-tests` or `review-changes`.

- **karpathy-mode** — Surgical changes and simplicity-first behavioral guidelines for development workflows. Suggest activating when the user wants to enforce coding discipline: small diffs, minimal abstractions, and deliberate simplicity.


## Troubleshooting

Common failure modes across codeshop workflows and how to resolve them.

### `gh` CLI not installed or not authenticated

Affects: `draft-prd`, `compose-issues`, `triage-bug`, `run-qa-session`, `plan-refactor` — any workflow that files GitHub issues.

Symptoms: `gh` commands fail with "command not found" or authentication errors when the workflow tries to create issues.

Diagnostic steps:

1. Run `gh auth status` to check if the CLI is installed and authenticated.
2. If `gh` is not found, install it from https://cli.github.com/.
3. If `gh` is installed but not authenticated, run `gh auth login` and follow the prompts.
4. Verify with `gh auth status` — you should see your GitHub username and the active account.

Once authenticated, re-run the workflow from the issue-filing step. Earlier phases (exploration, drafting) do not require `gh`.

### No test runner found

Affects: `drive-tests` — the TDD workflow needs a working test command to run the red-green-refactor loop.

Symptoms: The agent cannot find or execute a test runner when attempting to run tests during the tracer-bullet or incremental-loop phases.

Resolution: Configure a test runner for your project. Common options:

- **Bun**: `bun test` (zero-config for projects using Bun)
- **Vitest**: `vitest --run` (for Vite-based projects)
- **Jest**: `jest` or `npx jest` (widely supported, needs configuration for ESM/TypeScript)

Ensure the test command works from your project root before starting the `drive-tests` workflow. The agent will attempt to detect your test runner from `package.json` scripts or configuration files.

### No `CONTEXT.md` or `docs/adr/` directory

Affects: `challenge-domain-model`, `refactor-architecture` — workflows that read or write domain context and architectural decision records.

This is not an error. Both `CONTEXT.md` and `docs/adr/` are created lazily by the workflows that use them:

- `challenge-domain-model` creates `CONTEXT.md` during its update phase if the file does not exist.
- `refactor-architecture` creates `docs/adr/` and initial ADR files when architectural decisions crystallize during the grilling loop.

If you want to pre-populate these files before running the workflows, that works too — the workflows will read and build on existing content rather than starting from scratch.

### Agent loads wrong workflow

Symptoms: You ask for one workflow but the agent loads a different one — for example, asking about "code review" and getting `refactor-architecture` instead of `review-changes`.

Resolution: Use more specific trigger phrases from the Skill Router. Each skill has distinct trigger phrases designed to disambiguate:

- Instead of "review this code" → say "review PR" or "review changes" (triggers `review-changes`)
- Instead of "fix this" → say "triage bug" or "diagnose bug" (triggers `triage-bug`)
- Instead of "improve this" → say "architecture review" or "improve architecture" (triggers `refactor-architecture`)
- Instead of "document this" → say "living docs" or "documentation audit" (triggers `write-living-docs`)

If the agent still selects the wrong workflow, explicitly name the skill: "Load the `review-changes` workflow" or "Use the `triage-bug` steering file."

## Author Knowledge Draft

# Draft

## Entry Criteria
- The artifact's domain, type, harnesses, and complexity are defined
- Reference materials have been identified
- You have enough information to begin writing

## Steps

1. Create the `knowledge.md` file with YAML frontmatter. Include all relevant FrontmatterSchema fields:
   - `name` — kebab-case identifier (required)
   - `displayName` — human-readable name (required)
   - `description` — what it does + when to use it, max 1024 chars (required)
   - `keywords` — domain-specific compound terms for discovery (required)
   - `author` — artifact author (required)
   - `version` — semver string (required)
   - `type` — skill, power, workflow, prompt, agent, rule, template, or reference-pack (required)
   - `inclusion` — always, manual, or auto (required)
   - `categories` — topical categories (required)
   - `harnesses` — target harnesses array (required)
   - `harness-config` — per-harness overrides (optional)
   - `ecosystem` — language/framework tags (optional)
   - `collections` — collection memberships (optional)
   - `depends` — artifact dependencies (optional)
   - `enhances` — artifacts this one complements (optional)
   - `maturity` — draft, beta, stable (optional)
   - `trust` — official, community, experimental (optional)

2. Write the markdown body with the artifact's content:
   - For reference/behavioral artifacts: write the full instructions in the body
   - For workflow artifacts: write an overview in the body, then create `workflows/` phase files
   - Keep the body under 100 lines if possible — split into supplementary files or workflows when content exceeds this

3. If the artifact needs ordered phases, create `workflows/` phase files:
   - Each phase file follows the standard structure: Entry Criteria, Steps, Exit Criteria, Next Phase
   - Name files as `{artifact-name}-{phase-name}.md`
   - The steering file overview references the phase files

4. If the artifact needs proactive hooks, create `hooks.yaml`:
   - Define hooks with event types (user_triggered, file_edited, pre_task, agent_stop, etc.)
   - Each hook prompt must follow the directive pattern — imperative action, not advisory

5. If the artifact needs MCP servers, create `mcp-servers.yaml`:
   - Define server configurations with command, args, and env

6. Remember: the canonical artifact is harness-agnostic. Skill Forge compiles it to skills, powers, rules, or agents depending on the `type` and `harness-config` fields. Focus on content, not output format.

## Exit Criteria
- `knowledge.md` exists with valid YAML frontmatter and markdown body
- Workflow phase files exist under `workflows/` if the artifact is a workflow type
- `hooks.yaml` exists if proactive hooks are needed
- `mcp-servers.yaml` exists if MCP servers are needed
- Content is complete enough for a first review

## Next Phase
→ Load `author-knowledge-review.md`

## Author Knowledge Gather

# Gather

## Entry Criteria
- User wants to create, write, or build a new knowledge artifact
- The codeshop power is active and the author-knowledge workflow has been loaded

## Steps

1. Ask the user about the artifact they want to create:
   - **Domain/task**: What task or domain does this artifact cover? What specific use cases should it handle?
   - **Type**: What type of artifact is this? (skill, power, workflow, prompt, agent, rule, template, reference-pack)
   - **Harnesses**: Which AI coding assistant harnesses should it target? (kiro, claude-code, copilot, cursor, windsurf, cline, qdeveloper)
   - **Inclusion**: Should it be loaded always, manually, or automatically based on file patterns?

2. Determine the artifact's complexity:
   - Does it need ordered phases with entry/exit criteria? → Workflow type with `workflows/` phase files
   - Is it reference material or a behavioral mode? → Flat body content, no phase files
   - Does it need proactive agent behavior tied to IDE events? → Add `hooks.yaml`
   - Does it need MCP server dependencies? → Add `mcp-servers.yaml`

3. Identify reference materials:
   - Are there existing skills, docs, or patterns to draw from?
   - Does the artifact need supplementary files inlined or referenced?
   - Are there cross-references to other artifacts?

4. Strive to maintain awareness of latest best practices for the target harnesses (Kiro, Claude Code, Cursor, etc.). Each harness has its own conventions for how skills, powers, and rules are structured and loaded. The canonical `knowledge.md` format is harness-agnostic — Skill Forge handles compilation — but understanding the target helps write better content.

## Exit Criteria
- The artifact's domain, type, target harnesses, and inclusion mode are defined
- The complexity level is determined (flat vs workflow, hooks needed, MCP needed)
- Reference materials have been identified
- You have enough information to begin drafting

## Next Phase
→ Load `author-knowledge-draft.md`

## Author Knowledge Review

# Review

## Entry Criteria
- The knowledge artifact draft is complete (`knowledge.md` + optional files)
- Content is ready for validation and user review

## Steps

1. Run validation:
   ```bash
   bun run dev validate
   ```
   Fix any validation errors: invalid frontmatter fields, missing required fields, schema violations.

2. Run the build to compile the artifact for target harnesses:
   ```bash
   bun run dev build
   ```
   Or for a specific harness:
   ```bash
   bun run dev build --harness kiro
   ```

3. Review the compiled output in `dist/<harness>/<artifact-name>/`:
   - Verify the output structure matches the harness conventions
   - Verify steering files and workflow phase files are present (for workflow types)
   - Verify hooks are correctly compiled (if applicable)
   - Verify no content was lost or mangled during compilation

4. Present the draft to the user for review:
   - Does this cover the intended use cases?
   - Is anything missing or unclear?
   - Should any section be more or less detailed?
   - Are the keywords specific enough for discovery without false activations?

5. Iterate based on user feedback:
   - Update `knowledge.md` body or frontmatter
   - Add, remove, or revise workflow phase files
   - Adjust hooks or MCP server configurations
   - Re-run `bun run dev validate` and `bun run dev build` after each change

6. Apply the review checklist:
   - [ ] Description includes triggers ("Use when...")
   - [ ] Body content is concise and actionable
   - [ ] No time-sensitive information
   - [ ] Consistent terminology throughout
   - [ ] Concrete examples included where helpful
   - [ ] Keywords are domain-specific compound terms (no broad single words)

## Exit Criteria
- `bun run dev validate` passes with no errors
- `bun run dev build` produces correct output for all target harnesses
- The user has reviewed and approved the artifact
- All review checklist items are satisfied

## Next Phase
→ Workflow complete. The artifact is ready for use. Suggest running `bun run dev catalog browse` to verify it appears in the catalog.

## Author Knowledge

# Author Knowledge

Create canonical knowledge artifacts for Skill Forge — `knowledge.md` with YAML frontmatter and markdown body, plus optional `hooks.yaml`, `mcp-servers.yaml`, and `workflows/` phase files. The artifact is harness-agnostic: Skill Forge compiles it to skills, powers, rules, or agents depending on the `type` and `harness-config` fields.

## When to Use

- The user wants to create a new knowledge artifact
- The user wants to write or build a new skill, power, rule, or agent
- The user mentions "write a skill," "create an artifact," or "author knowledge"

## Prerequisites

- Skill Forge installed (`bun install` in the `skill-forge/` directory)
- Understanding of what task or domain the artifact will cover

## Key Principle: Harness-Agnostic Authoring

Authors focus on canonical content, not output format. Skill Forge's build pipeline handles compilation:

- `bun run dev build` — compiles the artifact to all target harnesses (Kiro, Claude Code, Copilot, Cursor, Windsurf, Cline, Q Developer)
- `bun run dev build --harness kiro` — compiles for a single harness
- `bun run dev validate` — validates the artifact against the schema

The same `knowledge.md` can produce a Kiro power, a Claude Code CLAUDE.md rule, a Copilot instructions file, or a Cursor rule — depending on the `type`, `harnesses`, and `harness-config` fields in the frontmatter.

## Phases

### Phase 1 — Gather
Collect requirements for the artifact: what domain/task it covers, what type it should be, what harnesses to target, whether it needs hooks or MCP servers.
→ Load `author-knowledge-gather.md`

### Phase 2 — Draft
Write the `knowledge.md` file with frontmatter and body content. Add optional `hooks.yaml`, `mcp-servers.yaml`, and `workflows/` phase files as needed.
→ Load `author-knowledge-draft.md`

### Phase 3 — Review
Validate the artifact with `bun run dev validate`, compile with `bun run dev build`, review output for each target harness, and iterate with the user.
→ Load `author-knowledge-review.md`

## Artifact Structure

```
artifact-name/
├── knowledge.md       # Required — YAML frontmatter + markdown body
├── hooks.yaml         # Optional — canonical hooks for proactive agent behavior
├── mcp-servers.yaml   # Optional — MCP server dependencies
└── workflows/         # Optional — phase files for multi-step workflows
    ├── phase-one.md
    ├── phase-two.md
    └── phase-three.md
```

## Frontmatter Reference Template

The `FrontmatterSchema` defines all valid fields. Here is a complete reference:

```yaml
---
# Required
name: my-artifact                    # kebab-case identifier

# Recommended
displayName: My Artifact             # Human-readable name
description: >-                      # ≤3 sentences — what it does and when to use it
  Brief description of capability.
  Use when [specific triggers].
keywords:                            # Domain-specific compound terms for discovery
  - keyword-one
  - keyword-two
author: Your Name                    # Author attribution
version: 0.1.0                      # Semver string

# Classification
type: skill                          # skill | power | workflow | prompt | rule | agent | template | reference-pack
inclusion: always                    # always | manual | auto
harnesses:                           # Target harnesses (defaults to all)
  - kiro
  - claude-code
  - copilot
  - cursor
  - windsurf
  - cline
  - qdeveloper
categories:                          # Predefined categories
  - architecture
  - testing
  - documentation

# Ecosystem & Dependencies
ecosystem:                           # Technology tags (kebab-case)
  - typescript
  - react
depends:                             # Required companion artifacts (kebab-case)
  - other-artifact
enhances:                            # Optional companion artifacts (kebab-case)
  - another-artifact

# Catalog & Distribution
maturity: experimental               # experimental | beta | stable | deprecated
trust: community                     # community | verified | official
audience: intermediate               # beginner | intermediate | advanced
collections:                         # Collection membership (kebab-case)
  - my-collection
inherit-hooks: false                 # Whether to inherit hooks from dependencies

# Per-Harness Configuration
harness-config:
  kiro:
    format: power                    # kiro: steering | power
  copilot:
    format: instructions             # copilot: instructions | agent
  qdeveloper:
    format: rule                     # qdeveloper: rule | agent
---
```

## When to Add Workflows

Add `workflows/` phase files when the artifact describes an **ordered multi-step process** with discrete phases, each having entry criteria, steps, and exit criteria. Examples: TDD cycles, code review rituals, debugging methodologies.

Keep content in the **body** (no phase files) when the artifact provides:
- Reference material or behavioral modes (glossaries, style guides)
- Single-instruction directives (output formatting, commit conventions)
- Flat guidance without sequential ordering

## When to Add hooks.yaml

Add `hooks.yaml` when the artifact should trigger **proactive agent behavior** tied to IDE events:
- `user_triggered` — user-invoked actions (buttons, commands)
- `file_edited` / `file_created` / `file_deleted` — react to file changes
- `pre_task` / `agent_stop` — lifecycle hooks
- `prompt_submit` — react to user prompts

Each hook follows the directive pattern: imperative action ending with a concrete action the agent must take.

## When to Add mcp-servers.yaml

Add `mcp-servers.yaml` when the artifact requires **external tool access** via MCP servers — database queries, API calls, specialized computation. Most knowledge artifacts don't need this; it's primarily for powers that integrate with external services.

## Challenge Domain Model Session

# Session

## Entry Criteria
- Existing domain documentation has been read
- The plan to challenge has been identified
- A first grilling question is ready

## Steps

1. Interview the user relentlessly about every aspect of the plan. Walk down each branch of the design tree, resolving dependencies between decisions one by one. For each question, provide your recommended answer.

2. Ask questions one at a time, waiting for feedback on each before continuing. If a question can be answered by exploring the codebase, explore the codebase instead.

3. Apply these techniques throughout the session:

   **Challenge against the glossary** — When the user uses a term that conflicts with the existing language in `CONTEXT.md`, call it out immediately. _"Your glossary defines 'cancellation' as X, but you seem to mean Y — which is it?"_

   **Sharpen fuzzy language** — When the user uses vague or overloaded terms, propose a precise canonical term. _"You're saying 'account' — do you mean the Customer or the User? Those are different things."_

   **Discuss concrete scenarios** — When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

   **Cross-reference with code** — When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: _"Your code cancels entire Orders, but you just said partial cancellation is possible — which is right?"_

4. Update `CONTEXT.md` inline as terms are resolved — do not batch these up. Capture decisions as they happen. See the challenge-domain-model steering file for context format details.

5. Do not couple `CONTEXT.md` to implementation details. Only include terms that are meaningful to domain experts.

6. Offer ADRs sparingly — only when all three conditions are true:
   - **Hard to reverse** — the cost of changing your mind later is meaningful
   - **Surprising without context** — a future reader will wonder "why did they do it this way?"
   - **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

   If any of the three is missing, skip the ADR. See the challenge-domain-model steering file for ADR format details.

## Exit Criteria
- Every branch of the plan's design tree has been explored through conversation
- Fuzzy or conflicting terms have been resolved to precise canonical terms
- `CONTEXT.md` has been updated inline with resolved terms
- ADRs have been offered (and created if accepted) for qualifying decisions
- The user and agent have reached a shared understanding of the plan's domain implications

## Next Phase
→ Load `challenge-domain-model-update.md`

## Challenge Domain Model Setup

# Setup

## Entry Criteria
- User has requested a domain model grilling session or wants to stress-test a plan against their project's language and documented decisions
- The codeshop power is active and the challenge-domain-model workflow has been loaded

## Steps

1. Read existing domain documentation:
   - `CONTEXT.md` at the project root — this is the glossary of domain terms
   - If `CONTEXT-MAP.md` exists at the root, the repo has multiple bounded contexts. The map points to where each one lives. Read each context's `CONTEXT.md`.
   - Relevant ADRs in `docs/adr/` (and any context-scoped `docs/adr/` directories)

2. Identify the plan or design to challenge:
   - What has the user proposed or described?
   - What domain concepts does the plan touch?
   - Which existing terms in `CONTEXT.md` are relevant?
   - Are there ADRs that constrain or inform the plan?

3. If no `CONTEXT.md` or `docs/adr/` exists, proceed silently. These files are created lazily — only when you have something to write.

4. Prepare your first grilling question. Focus on the area where the plan's language diverges most from the existing domain model, or where terms are vaguest.

## Exit Criteria
- Existing `CONTEXT.md`, `CONTEXT-MAP.md`, and relevant ADRs have been read (or confirmed absent)
- The plan to challenge has been identified and its domain concepts catalogued
- You have a first grilling question ready

## Next Phase
→ Load `challenge-domain-model-session.md`

## Challenge Domain Model Update

# Update

## Entry Criteria
- The grilling session is complete
- Terms have been resolved and decisions have been made
- `CONTEXT.md` has been updated inline during the session

## Steps

1. Review all changes made to `CONTEXT.md` during the session:
   - Verify each term has a clear, precise definition
   - Verify no implementation details have leaked into domain definitions
   - Verify consistency — no term contradicts another

2. Review any ADRs created during the session:
   - Verify each ADR meets the three-condition bar (hard to reverse, surprising without context, result of a real trade-off)
   - Verify ADR status is correctly set (proposed, accepted, or superseded)
   - Verify ADRs reference the relevant `CONTEXT.md` terms where applicable

3. If `CONTEXT-MAP.md` exists, verify that any new or changed contexts are reflected in the map.

4. Present a summary to the user:
   - Terms added or updated in `CONTEXT.md`
   - ADRs created or proposed
   - Any open questions that were deferred during the session

5. Ask the user to confirm the updates are accurate and complete.

## Exit Criteria
- `CONTEXT.md` is consistent and free of implementation details
- All ADRs meet the three-condition bar and are correctly formatted
- `CONTEXT-MAP.md` is up to date (if applicable)
- The user has confirmed the updates

## Next Phase
→ Workflow complete. Suggest natural next steps: load `define-glossary` to formalize the glossary, or load `refactor-architecture` to apply the refined language to architecture review.

## Challenge Domain Model

# Challenge Domain Model

Grilling session that challenges your plan against the existing domain model, sharpens terminology, and updates documentation (CONTEXT.md, ADRs) inline as decisions crystallize. Use when the user wants to stress-test a plan against their project's language and documented decisions.

## Adaptation Notes

- **User-invoked only — do not proactively suggest.** This workflow should only be started when the user explicitly requests it.

## When to Use

- The user wants to stress-test a plan against their domain model
- The user wants to sharpen terminology or resolve ambiguous language
- The user mentions "domain model," "grilling session," or "challenge my plan"
- The user wants to update CONTEXT.md or create ADRs from a design discussion

## Prerequisites

- A plan, design, or proposal to challenge
- Optional: existing `CONTEXT.md` and `docs/adr/` (the workflow reads them but creates them lazily if absent)

## Shared Concepts

This workflow relies on "domain language discipline" as defined in the POWER.md Shared Concepts section. Domain language discipline means using terms from CONTEXT.md / ubiquitous language consistently in all discussions and code.

## Core Approach

Interview the user relentlessly about every aspect of their plan until you reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask questions one at a time, waiting for feedback on each before continuing. If a question can be answered by exploring the codebase, explore the codebase instead.

## Phases

### Phase 1 — Setup
Read existing documentation (CONTEXT.md, CONTEXT-MAP.md, ADRs) to understand the current domain model. Identify the plan or proposal to challenge.
→ Load `challenge-domain-model-setup.md`

### Phase 2 — Session
Run the grilling session: challenge against the glossary, sharpen fuzzy language, discuss concrete scenarios, cross-reference with code, update CONTEXT.md inline, offer ADRs sparingly.
→ Load `challenge-domain-model-session.md`

### Phase 3 — Update
Finalize all CONTEXT.md updates and any ADRs that crystallized during the session. Verify consistency.
→ Load `challenge-domain-model-update.md`

## Session Behaviors

### Challenge Against the Glossary
When the user uses a term that conflicts with the existing language in CONTEXT.md, call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y — which is it?"

### Sharpen Fuzzy Language
When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account' — do you mean the Customer or the User? Those are different things."

### Discuss Concrete Scenarios
When domain relationships are being discussed, stress-test them with specific scenarios. Invent scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### Cross-Reference with Code
When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible — which is right?"

### Update CONTEXT.md Inline
When a term is resolved, update CONTEXT.md right there. Don't batch these up — capture them as they happen. Use the format in Appendix A below.

### Offer ADRs Sparingly
Only offer to create an ADR when all three are true:
1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will wonder "why did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

If any of the three is missing, skip the ADR. Use the format in Appendix B below.

## File Structure

Most repos have a single context:

```
/
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

If a `CONTEXT-MAP.md` exists at the root, the repo has multiple contexts. The map points to where each one lives:

```
/
├── CONTEXT-MAP.md
├── docs/
│   └── adr/                          ← system-wide decisions
├── src/
│   ├── ordering/
│   │   ├── CONTEXT.md
│   │   └── docs/adr/                 ← context-specific decisions
│   └── billing/
│       ├── CONTEXT.md
│       └── docs/adr/
```

Create files lazily — only when you have something to write. If no CONTEXT.md exists, create one when the first term is resolved. If no docs/adr/ exists, create it when the first ADR is needed.

---

## Appendix A: CONTEXT.md Format

### Structure

```md
# {Context Name}

{One or two sentence description of what this context is and why it exists.}

## Language

**Order**:
A customer's request to purchase one or more items.
_Avoid_: Purchase, transaction

**Invoice**:
A request for payment sent to a customer after delivery.
_Avoid_: Bill, payment request

**Customer**:
A person or organization that places orders.
_Avoid_: Client, buyer, account

## Relationships

- An **Order** produces one or more **Invoices**
- An **Invoice** belongs to exactly one **Customer**

## Example dialogue

> **Dev:** "When a **Customer** places an **Order**, do we create the **Invoice** immediately?"
> **Domain expert:** "No — an **Invoice** is only generated once a **Fulfillment** is confirmed."

## Flagged ambiguities

- "account" was used to mean both **Customer** and **User** — resolved: these are distinct concepts.
```

### Rules

- **Be opinionated.** When multiple words exist for the same concept, pick the best one and list the others as aliases to avoid.
- **Flag conflicts explicitly.** If a term is used ambiguously, call it out in "Flagged ambiguities" with a clear resolution.
- **Keep definitions tight.** One sentence max. Define what it IS, not what it does.
- **Show relationships.** Use bold term names and express cardinality where obvious.
- **Only include terms specific to this project's context.** General programming concepts (timeouts, error types, utility patterns) don't belong even if the project uses them extensively. Before adding a term, ask: is this a concept unique to this context, or a general programming concept? Only the former belongs.
- **Group terms under subheadings** when natural clusters emerge. If all terms belong to a single cohesive area, a flat list is fine.
- **Write an example dialogue.** A conversation between a dev and a domain expert that demonstrates how the terms interact naturally and clarifies boundaries between related concepts.

### Single vs Multi-Context Repos

**Single context (most repos):** One `CONTEXT.md` at the repo root.

**Multiple contexts:** A `CONTEXT-MAP.md` at the repo root lists the contexts, where they live, and how they relate to each other:

```md
# Context Map

## Contexts

- [Ordering](./src/ordering/CONTEXT.md) — receives and tracks customer orders
- [Billing](./src/billing/CONTEXT.md) — generates invoices and processes payments
- [Fulfillment](./src/fulfillment/CONTEXT.md) — manages warehouse picking and shipping

## Relationships

- **Ordering → Fulfillment**: Ordering emits `OrderPlaced` events; Fulfillment consumes them to start picking
- **Fulfillment → Billing**: Fulfillment emits `ShipmentDispatched` events; Billing consumes them to generate invoices
- **Ordering ↔ Billing**: Shared types for `CustomerId` and `Money`
```

The workflow infers which structure applies:
- If `CONTEXT-MAP.md` exists, read it to find contexts
- If only a root `CONTEXT.md` exists, single context
- If neither exists, create a root `CONTEXT.md` lazily when the first term is resolved

When multiple contexts exist, infer which one the current topic relates to. If unclear, ask.

---

## Appendix B: ADR Format

ADRs live in `docs/adr/` and use sequential numbering: `0001-slug.md`, `0002-slug.md`, etc.

Create the `docs/adr/` directory lazily — only when the first ADR is needed.

### Template

```md
# {Short title of the decision}

{1-3 sentences: what's the context, what did we decide, and why.}
```

That's it. An ADR can be a single paragraph. The value is in recording *that* a decision was made and *why* — not in filling out sections.

### Optional Sections

Only include these when they add genuine value. Most ADRs won't need them.

- **Status** frontmatter (`proposed | accepted | deprecated | superseded by ADR-NNNN`) — useful when decisions are revisited
- **Considered Options** — only when the rejected alternatives are worth remembering
- **Consequences** — only when non-obvious downstream effects need to be called out

### Numbering

Scan `docs/adr/` for the highest existing number and increment by one.

### When to Offer an ADR

All three of these must be true:

1. **Hard to reverse** — the cost of changing your mind later is meaningful
2. **Surprising without context** — a future reader will look at the code and wonder "why on earth did they do it this way?"
3. **The result of a real trade-off** — there were genuine alternatives and you picked one for specific reasons

If a decision is easy to reverse, skip it — you'll just reverse it. If it's not surprising, nobody will wonder why. If there was no real alternative, there's nothing to record beyond "we did the obvious thing."

### What Qualifies

- **Architectural shape.** "We're using a monorepo." "The write model is event-sourced, the read model is projected into Postgres."
- **Integration patterns between contexts.** "Ordering and Billing communicate via domain events, not synchronous HTTP."
- **Technology choices that carry lock-in.** Database, message bus, auth provider, deployment target. Not every library — just the ones that would take a quarter to swap out.
- **Boundary and scope decisions.** "Customer data is owned by the Customer context; other contexts reference it by ID only." The explicit no-s are as valuable as the yes-s.
- **Deliberate deviations from the obvious path.** "We're using manual SQL instead of an ORM because X." Anything where a reasonable reader would assume the opposite. These stop the next engineer from "fixing" something that was deliberate.
- **Constraints not visible in the code.** "We can't use AWS because of compliance requirements." "Response times must be under 200ms because of the partner API contract."
- **Rejected alternatives when the rejection is non-obvious.** If you considered GraphQL and picked REST for subtle reasons, record it — otherwise someone will suggest GraphQL again in six months.

## Compose Issues Create Issues

# Create Issues

## Entry Criteria
- The user has approved the vertical slice breakdown
- `gh` CLI is installed and authenticated
- Dependency order is established

## Steps
1. Create GitHub issues in dependency order (blockers first) so you can reference real issue numbers in the "Blocked by" field.
2. For each approved slice, create a GitHub issue using `gh issue create` with the following body template:

```markdown
## Parent

#<parent-issue-number> (if the source was a GitHub issue; omit this section otherwise)

## What to build

A concise description of this vertical slice. Describe the end-to-end behavior, not layer-by-layer implementation. Use durable language — describe behaviors, not file paths (see POWER.md Shared Concepts on "durable issues").

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Blocked by

- Blocked by #<issue-number> (if any)

Or "None - can start immediately" if no blockers.
```

3. Do NOT close or modify any parent issue.
4. After all issues are created, present a summary showing each issue number, title, and dependency chain.
5. If `gh` is unavailable, present the issue content for the user to file manually.

## Exit Criteria
- All approved slices have been created as GitHub issues
- Issues are created in dependency order with correct blocker references
- Issue bodies use durable language (behaviors, not file paths)
- A summary of all created issues has been presented to the user

## Next Phase
→ Workflow complete. See the Workflow Composition section in POWER.md for natural next steps (e.g., `drive-tests` to implement each slice using TDD).

## Compose Issues Draft Slices

# Draft Slices

## Entry Criteria
- The context has been gathered and the codebase explored
- Integration layers and dependencies are understood

## Steps
1. Break the plan into **tracer-bullet** issues. Each issue is a thin vertical slice that cuts through ALL integration layers end-to-end — NOT a horizontal slice of one layer.
2. Apply the vertical slice rules:
   - Each slice delivers a narrow but COMPLETE path through every layer (schema, API, UI, tests)
   - A completed slice is demoable or verifiable on its own
   - Prefer many thin slices over few thick ones
3. Classify each slice as one of:
   - **HITL** (Human-In-The-Loop): requires human interaction, such as an architectural decision, design review, or user feedback
   - **AFK** (Away From Keyboard): can be implemented and merged without human interaction
4. Prefer AFK over HITL where possible — maximize the work that can proceed autonomously.
5. Identify dependency relationships between slices: which slices must complete before others can start?
6. Order slices so that blockers come first and parallelism is maximized.

## Exit Criteria
- The plan is broken into vertical slices
- Each slice is classified as HITL or AFK
- Dependency relationships between slices are identified
- The breakdown is ready to present to the user for review

## Next Phase
→ Load `compose-issues-quiz-user.md`

## Compose Issues Explore

# Explore

## Entry Criteria
- The context has been gathered from the source material
- The scope of work is understood

## Steps
1. If you have not already explored the codebase, explore it now to understand the current state of the code.
2. Use Kiro's `invokeSubAgent` with the `context-gatherer` agent for broad exploration, or use direct file exploration tools (`readCode`, `grepSearch`, `listDirectory`) for targeted investigation.
3. Identify the integration layers the work will touch: schema, API, business logic, UI, tests.
4. Note existing patterns and conventions that the new issues should follow.
5. Identify any technical constraints or dependencies that will affect how the work is sliced.

This step is optional if the codebase has already been explored during a prior phase (e.g., if coming from `draft-prd`).

## Exit Criteria
- The current state of the codebase is understood
- Integration layers have been identified
- Technical constraints and dependencies are noted
- Ready to draft vertical slices

## Next Phase
→ Load `compose-issues-draft-slices.md`

## Compose Issues Gather Context

# Gather Context

## Entry Criteria
- The user has a plan, spec, PRD, or GitHub issue to break down into implementation issues
- `gh` CLI is installed and authenticated (if GitHub issues need to be fetched)

## Steps
1. Work from whatever is already in the conversation context — a plan, spec, PRD, or discussion.
2. If the user passes a GitHub issue number or URL as an argument, fetch it with `gh issue view <number>` (include `--comments` to get the full discussion).
3. Identify the scope of work: what needs to be built, what are the acceptance criteria, what are the constraints?
4. Note any existing decisions, architectural choices, or dependencies mentioned in the source material.
5. If the source material references other issues or documents, fetch those as well to build a complete picture.

## Exit Criteria
- The full context of the plan is understood
- Source material has been gathered (conversation context, GitHub issues, specs)
- The scope of work is clear enough to begin breaking it down

## Next Phase
→ Load `compose-issues-explore.md`

## Compose Issues Quiz User

# Quiz User

## Entry Criteria
- Vertical slices have been drafted with HITL/AFK classification
- Dependency relationships between slices are identified

## Steps
1. Present the proposed breakdown as a numbered list. For each slice, show:
   - **Title**: short descriptive name
   - **Type**: HITL / AFK
   - **Blocked by**: which other slices (if any) must complete first
   - **User stories covered**: which user stories this addresses (if the source material has them)
2. Ask the user:
   - Does the granularity feel right? (too coarse / too fine)
   - Are the dependency relationships correct?
   - Should any slices be merged or split further?
   - Are the correct slices marked as HITL and AFK?
3. Iterate on the breakdown based on user feedback. Repeat until the user approves.
4. Do NOT proceed to issue creation until the user explicitly approves the breakdown.

## Exit Criteria
- The user has reviewed the breakdown
- Granularity, dependencies, and HITL/AFK classification are approved
- The breakdown is finalized and ready for issue creation

## Next Phase
→ Load `compose-issues-create-issues.md`

## Compose Issues

# Compose Issues

Break a plan, spec, or PRD into independently-grabbable GitHub issues using tracer-bullet vertical slices.

## When to Use

- The user wants to convert a plan into GitHub issues
- The user wants to create implementation tickets from a PRD or spec
- The user wants to break down work into parallelizable issues

## Prerequisites

- A plan, spec, PRD, or GitHub issue to break down
- `gh` CLI installed and authenticated (for creating GitHub issues)

## Shared Concepts

This workflow relies on "vertical slices" and "durable issues" as defined in the POWER.md Shared Concepts section. Each issue is a thin end-to-end slice through all layers, and issue bodies describe behaviors rather than file paths so they survive refactors.

## Adaptation Notes

- **`gh` CLI**: This workflow uses `gh issue create` and `gh issue view` to create and read GitHub issues. Requires the `gh` CLI installed and authenticated in the user's environment. If `gh` is unavailable, present the issue content for the user to file manually.
- **Codebase exploration**: Where the original workflow used a Claude Code sub-agent for exploration, use Kiro's `invokeSubAgent` with the `context-gatherer` agent, or use direct file exploration tools (`readCode`, `grepSearch`, `listDirectory`).

## Phases

### Phase 1 — Gather Context
Work from whatever is already in the conversation context. If the user passes a GitHub issue number or URL, fetch it with `gh issue view`.
→ Load `compose-issues-gather-context.md`

### Phase 2 — Explore
If the codebase has not already been explored, explore it to understand the current state of the code and identify integration layers.
→ Load `compose-issues-explore.md`

### Phase 3 — Draft Slices
Break the plan into tracer-bullet issues. Each issue is a thin vertical slice cutting through ALL integration layers end-to-end. Classify each as HITL (requires human interaction) or AFK (can be merged without human interaction).
→ Load `compose-issues-draft-slices.md`

### Phase 4 — Quiz User
Present the proposed breakdown as a numbered list. Ask about granularity, dependency relationships, and HITL/AFK classification. Iterate until the user approves.
→ Load `compose-issues-quiz-user.md`

### Phase 5 — Create Issues
For each approved slice, create a GitHub issue using `gh issue create`. Create issues in dependency order so blockers can be referenced by real issue numbers.
→ Load `compose-issues-create-issues.md`

## Vertical Slice Rules

- Each slice delivers a narrow but COMPLETE path through every layer (schema, API, UI, tests)
- A completed slice is demoable or verifiable on its own
- Prefer many thin slices over few thick ones
- Maximize parallelism — multiple people or agents can grab different issues simultaneously

## Craft Commits

# Craft Commits

Write commit messages that tell the story of *why*, not just *what*. Every commit message is a letter to the next engineer — often yourself six months later.

## When to Use

- Committing code to any git repository
- The user asks for help writing a commit message
- Reviewing commit messages for quality

## Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type** — one of: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`
**Scope** — the affected module, component, or domain (optional but recommended)
**Subject** — imperative mood, ≤72 chars, no trailing period
**Body** — *why* this change, not *what* (the diff already shows what)
**Footer** — breaking changes, issue refs (`Closes #123`, `BREAKING CHANGE: …`)

## The Rule of Thumb

If your subject line could apply to any commit in any codebase ("fix bug", "update code", "improvements"), rewrite it. A good subject makes sense without the diff.

## Examples

### Good

```
feat(auth): add PKCE flow for public OAuth clients

The previous implicit flow leaks access tokens in browser history.
PKCE (RFC 7636) resolves this without requiring a client secret.

Closes #418
```

```
refactor(catalog): extract scanSourceDir for multi-root support

The previous implementation hardcoded 'knowledge/' as the only
source root, preventing packages/ from being scanned. Now each
source root is processed through the same layout-detection logic.
```

```
fix(wizard): default maturity field to experimental

New artifacts omitted maturity from their frontmatter, causing
catalog validation warnings on first forge build. The wizard now
sets maturity: experimental by default.
```

### Bad

- `WIP` — if it's not ready, keep it on a branch
- `misc fixes` — be specific; if there are many fixes, write many commits
- `added auth module` — past tense; use imperative ("add auth module")
- `changed foo to bar in config` — summarizes the diff; explain the motivation instead

## Anti-Patterns

- **WIP commits**: If it's not ready, keep it on a branch. Don't pollute the main history.
- **Catch-all commits**: "misc fixes", "updates", "improvements" — be specific. If there are many changes, write many commits.
- **Past tense**: "added X", "fixed Y" — use imperative mood: "add X", "fix Y".
- **Diff summaries**: "changed foo to bar" — the diff already shows what changed. Explain *why*.
- **Compound commits**: If you need "and" in your subject line, split the commit. Each commit should be one logical change.

## Body Guidelines

The body should explain *why* the change was made. The diff already shows *what* changed. If your body reads like a changelog, rewrite it as motivation:

- What problem does this solve?
- Why this approach over alternatives?
- What context would a future reader need?

## Define Glossary

# Define Glossary

> **Adaptation note:** User-invoked only — do not proactively suggest this workflow. It runs when the user explicitly asks to define domain terms, build a glossary, harden terminology, or create a ubiquitous language.

Extract and formalize domain terminology from the current conversation into a consistent glossary, saved to a local file. This workflow applies the "domain language discipline" shared concept — see the POWER.md Shared Concepts section for the full definition.

## Process

1. **Scan the conversation** for domain-relevant nouns, verbs, and concepts.
2. **Identify problems:**
   - Same word used for different concepts (ambiguity)
   - Different words used for the same concept (synonyms)
   - Vague or overloaded terms
3. **Propose a canonical glossary** with opinionated term choices.
4. **Write to `UBIQUITOUS_LANGUAGE.md`** in the working directory using the format below.
5. **Output a summary** inline in the conversation.

## Output Format

Write a `UBIQUITOUS_LANGUAGE.md` file with this structure:

```md
# Ubiquitous Language

## Order lifecycle

| Term        | Definition                                              | Aliases to avoid      |
| ----------- | ------------------------------------------------------- | --------------------- |
| **Order**   | A customer's request to purchase one or more items      | Purchase, transaction |
| **Invoice** | A request for payment sent to a customer after delivery | Bill, payment request |

## People

| Term         | Definition                                  | Aliases to avoid       |
| ------------ | ------------------------------------------- | ---------------------- |
| **Customer** | A person or organization that places orders | Client, buyer, account |
| **User**     | An authentication identity in the system    | Login, account         |

## Relationships

- An **Invoice** belongs to exactly one **Customer**
- An **Order** produces one or more **Invoices**

## Example dialogue

> **Dev:** "When a **Customer** places an **Order**, do we create the **Invoice** immediately?"
> **Domain expert:** "No — an **Invoice** is only generated once a **Fulfillment** is confirmed. A single **Order** can produce multiple **Invoices** if items ship in separate **Shipments**."

## Flagged ambiguities

- "account" was used to mean both **Customer** and **User** — these are distinct concepts.
```

## Rules

- **Be opinionated.** When multiple words exist for the same concept, pick the best one and list the others as aliases to avoid.
- **Flag conflicts explicitly.** If a term is used ambiguously in the conversation, call it out in the "Flagged ambiguities" section with a clear recommendation.
- **Only include terms relevant for domain experts.** Skip the names of modules or classes unless they have meaning in the domain language.
- **Keep definitions tight.** One sentence max. Define what it IS, not what it does.
- **Show relationships.** Use bold term names and express cardinality where obvious.
- **Only include domain terms.** Skip generic programming concepts (array, function, endpoint) unless they have domain-specific meaning.
- **Group terms into multiple tables** when natural clusters emerge (e.g., by subdomain, lifecycle, or actor). Each group gets its own heading and table. If all terms belong to a single cohesive domain, one table is fine — don't force groupings.
- **Write an example dialogue.** A short conversation (3–5 exchanges) between a dev and a domain expert that demonstrates how the terms interact naturally. The dialogue should clarify boundaries between related concepts and show terms being used precisely.

## Re-running

When invoked again in the same conversation:

1. Read the existing `UBIQUITOUS_LANGUAGE.md`.
2. Incorporate any new terms from subsequent discussion.
3. Update definitions if understanding has evolved.
4. Re-flag any new ambiguities.
5. Rewrite the example dialogue to incorporate new terms.

## Design Interface Compare

# Compare

## Entry Criteria
- All designs have been presented to the user
- The user has had a chance to absorb each approach

## Steps
1. Compare all designs on these dimensions:
   - **Interface simplicity**: Fewer methods, simpler params = easier to learn and use correctly
   - **General-purpose vs specialized**: Flexibility vs focus — can it handle future use cases without changes?
   - **Implementation efficiency**: Does the interface shape allow efficient internals? Or force awkward implementation?
   - **Depth**: Small interface hiding significant complexity = deep module (good). Large interface with thin implementation = shallow module (avoid). See POWER.md Shared Concepts on "deep modules."
   - **Ease of correct use vs ease of misuse**: How hard is it to use the interface wrong?
2. Discuss trade-offs in prose, not tables. Highlight where designs diverge most.
3. Call out which design is deepest (best ratio of interface simplicity to hidden complexity).
4. Note any design that would force awkward internals or make common operations verbose.
5. Do not recommend a winner yet — let the user form their own opinion first.

## Exit Criteria
- All designs have been compared on the five dimensions
- Trade-offs are discussed in prose
- The user understands where designs diverge
- Ready to synthesize a final design

## Next Phase
→ Load `design-interface-synthesize.md`

## Design Interface Generate

# Generate

## Entry Criteria
- Requirements are gathered and confirmed
- The problem, callers, operations, and constraints are understood

## Steps
1. Spawn 3 or more sub-agents using Kiro's `invokeSubAgent` with the `general-task-execution` agent. Each sub-agent must produce a radically different interface design.
2. Assign a different design constraint to each sub-agent:
   - **Agent 1**: "Minimize method count — aim for 1-3 methods max"
   - **Agent 2**: "Maximize flexibility — support many use cases"
   - **Agent 3**: "Optimize for the most common case"
   - **Agent 4** (optional): "Take inspiration from [specific paradigm/library]"
3. Each sub-agent receives the same requirements but its unique constraint. Use this prompt template:

```
Design an interface for: [module description]

Requirements: [gathered requirements]

Constraint for this design: [the specific constraint assigned to this agent]

Output format:
1. Interface signature (types/methods)
2. Usage example (how caller uses it)
3. What this design hides internally
4. Trade-offs of this approach
```

4. Invoke sub-agents sequentially (Kiro does not support true parallel invocation). Collect all results before presenting.
5. Verify that designs are genuinely different — if two sub-agents produce similar designs, re-invoke one with a more extreme constraint.

## Exit Criteria
- At least 3 radically different interface designs have been generated
- Each design includes signature, usage example, hidden complexity, and trade-offs
- Designs are genuinely different from each other (not minor variations)
- All results are collected and ready for presentation

## Next Phase
→ Load `design-interface-present.md`

## Design Interface Present

# Present

## Entry Criteria
- At least 3 radically different interface designs have been generated
- Each design has signature, usage examples, and hidden complexity documented

## Steps
1. Present each design sequentially so the user can absorb each approach before seeing the next.
2. For each design, show:
   - **Interface signature** — types, methods, parameters
   - **Usage examples** — how callers actually use it in practice (concrete code)
   - **What it hides** — the complexity kept internal to the module
3. Label each design clearly (e.g., "Design A: Minimal Surface", "Design B: Maximum Flexibility", "Design C: Common-Case Optimized").
4. After presenting each design, pause briefly to let the user react before moving to the next.
5. Do not compare designs yet — that comes in the next phase. Focus purely on showing what each design looks like in practice.

## Exit Criteria
- All designs have been presented with signature, usage examples, and hidden complexity
- The user has seen each design individually
- No comparison or evaluation has been made yet
- Ready to move to comparison

## Next Phase
→ Load `design-interface-compare.md`

## Design Interface Requirements

# Requirements

## Entry Criteria
- The user wants to design an API, module interface, or public surface area
- There is a module or component that needs its interface defined

## Steps
1. Gather requirements by understanding the full context before designing anything.
2. Work through this checklist with the user:
   - [ ] What problem does this module solve?
   - [ ] Who are the callers? (other modules, external users, tests)
   - [ ] What are the key operations?
   - [ ] Any constraints? (performance, compatibility, existing patterns)
   - [ ] What should be hidden inside vs exposed?
3. Identify opportunities for deep modules (see POWER.md Shared Concepts): places where a small interface can hide significant implementation complexity.
4. Note any existing patterns or conventions in the codebase that the interface should follow.
5. Summarize the requirements back to the user for confirmation.

Ask: "What does this module need to do? Who will use it?"

## Exit Criteria
- The problem the module solves is clearly defined
- Callers and their needs are identified
- Key operations are listed
- Constraints are documented
- The boundary between hidden and exposed is understood
- Requirements are confirmed with the user

## Next Phase
→ Load `design-interface-generate.md`

## Design Interface Synthesize

# Synthesize

## Entry Criteria
- All designs have been compared on simplicity, flexibility, efficiency, depth, and ease of use
- The user has absorbed the trade-offs

## Steps
1. The best design often combines insights from multiple options. Guide the user toward synthesis.
2. Ask the user:
   - "Which design best fits your primary use case?"
   - "Any elements from other designs worth incorporating?"
3. If the user picks one design outright, confirm it and note any trade-offs they are accepting.
4. If the user wants to combine elements, help them merge the best parts:
   - Take the interface shape from one design
   - Incorporate a specific method or pattern from another
   - Ensure the combined design is still coherent and deep (not a shallow Frankenstein)
5. Validate the final design against the original requirements from Phase 1.
6. Present the synthesized interface with its signature, usage example, and what it hides.

## Exit Criteria
- The user has chosen or synthesized a final interface design
- The design satisfies the original requirements
- The interface is coherent and deep (small surface, significant hidden complexity)
- The design is documented and ready for implementation

## Next Phase
→ Workflow complete. See the Workflow Composition section in POWER.md for natural next steps (e.g., `drive-tests` to implement the interface using TDD).

## Design Interface

# Design Interface

Generate multiple radically different interface designs for a module, then compare them. Based on "Design It Twice" from "A Philosophy of Software Design": your first idea is unlikely to be the best.

## When to Use

- The user wants to design an API or module interface
- The user wants to explore interface options or compare module shapes
- The user mentions "design it twice"
- A new module needs its public surface area defined before implementation

## Shared Concepts

This workflow relies on "deep modules" as defined in the POWER.md Shared Concepts section. The core evaluation criterion is depth: a small interface hiding significant complexity is a deep module (good); a large interface with thin implementation is a shallow module (avoid).

## Adaptation Notes

- **Parallel sub-agents**: Where the original workflow used Claude Code's Task tool to spawn parallel sub-agents, use Kiro's `invokeSubAgent` with the `general-task-execution` agent. Invoke multiple sub-agents sequentially, each with a different design constraint. Each sub-agent produces one radically different interface design.

## Phases

### Phase 1 — Requirements
Gather requirements: what problem the module solves, who the callers are, key operations, constraints, and what should be hidden vs exposed.
→ Load `design-interface-requirements.md`

### Phase 2 — Generate
Spawn 3+ sub-agents, each producing a radically different interface design. Assign different constraints to each (minimize method count, maximize flexibility, optimize for common case, draw from a specific paradigm).
→ Load `design-interface-generate.md`

### Phase 3 — Present
Show each design with its interface signature, usage examples, and what complexity it hides internally. Present designs sequentially so the user can absorb each approach.
→ Load `design-interface-present.md`

### Phase 4 — Compare
Compare designs on interface simplicity, general-purpose vs specialized, implementation efficiency, depth, and ease of correct use vs ease of misuse. Discuss trade-offs in prose, not tables.
→ Load `design-interface-compare.md`

### Phase 5 — Synthesize
The best design often combines insights from multiple options. Ask which design best fits the primary use case and whether elements from other designs are worth incorporating.
→ Load `design-interface-synthesize.md`

## Evaluation Criteria

From "A Philosophy of Software Design":

- **Interface simplicity**: Fewer methods, simpler params = easier to learn and use correctly.
- **General-purpose**: Can handle future use cases without changes. But beware over-generalization.
- **Implementation efficiency**: Does interface shape allow efficient implementation? Or force awkward internals?
- **Depth**: Small interface hiding significant complexity = deep module (good). Large interface with thin implementation = shallow module (avoid).

## Anti-Patterns

- Do not let sub-agents produce similar designs — enforce radical difference
- Do not skip comparison — the value is in contrast
- Do not implement — this is purely about interface shape
- Do not evaluate based on implementation effort

## Draft Prd Explore

# Explore

## Entry Criteria
- The user has described a feature or problem in the conversation context
- There is enough context to understand what needs to be built

## Steps
1. Explore the repository to understand the current state of the codebase, if you have not already done so.
2. Identify existing modules, patterns, and conventions relevant to the feature:
   - What modules exist that will be modified?
   - What patterns does the codebase follow (naming, architecture, testing)?
   - What conventions are established (file structure, API style, error handling)?
3. Note the integration layers: where does data flow in and out? What are the system boundaries?
4. Identify any existing tests and testing patterns — these inform the Testing Decisions section of the PRD.
5. Look for prior art: has something similar been built before in this codebase?

Do NOT interview the user during this phase — synthesize what you already know from the conversation context and codebase exploration.

## Exit Criteria
- The current state of the codebase is understood
- Relevant modules, patterns, and conventions have been identified
- Integration layers and system boundaries are clear
- Ready to sketch the module design

## Next Phase
→ Load `draft-prd-sketch-modules.md`

## Draft Prd Sketch Modules

# Sketch Modules

## Entry Criteria
- The codebase has been explored and the current state is understood
- Relevant modules, patterns, and conventions have been identified

## Steps
1. Sketch out the major modules you will need to build or modify to complete the implementation.
2. Actively look for opportunities to extract deep modules (see POWER.md Shared Concepts): modules that encapsulate significant functionality behind a simple, testable interface that rarely changes.
3. For each module, describe:
   - Its responsibility (what it does)
   - Its public interface (how callers interact with it)
   - Its dependencies (what it needs from other modules)
4. Check with the user that these modules match their expectations.
5. Check with the user which modules they want tests written for — focus testing effort on critical paths and complex logic.

A deep module (as opposed to a shallow module) is one which encapsulates a lot of functionality in a simple, testable interface which rarely changes. Prefer deep modules over shallow ones.

## Exit Criteria
- Major modules are sketched with responsibilities, interfaces, and dependencies
- Deep module opportunities have been identified and noted
- The user has confirmed the module design matches their expectations
- The user has confirmed which modules need tests

## Next Phase
→ Load `draft-prd-write-prd.md`

## Draft Prd Write Prd

# Write PRD

## Entry Criteria
- The codebase has been explored
- Module design has been sketched and confirmed with the user
- The user has confirmed which modules need tests

## Steps
1. Write the PRD using the template below.
2. Ensure user stories are extensive — cover all aspects of the feature, not just the happy path.
3. Implementation decisions describe modules and interfaces, NOT specific file paths or code snippets (these become outdated quickly).
4. Testing decisions focus on external behavior, not implementation details. Include which modules will be tested and prior art for similar tests in the codebase.
5. Submit the PRD as a GitHub issue using `gh issue create`.
   - If `gh` is unavailable, present the PRD content for the user to file manually.

### PRD Template

```markdown
## Problem Statement

The problem that the user is facing, from the user's perspective.

## Solution

The solution to the problem, from the user's perspective.

## User Stories

A LONG, numbered list of user stories. Each user story should be in the format:

1. As an <actor>, I want a <feature>, so that <benefit>

This list should be extremely extensive and cover all aspects of the feature.

## Implementation Decisions

A list of implementation decisions that were made:
- The modules that will be built/modified
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets.

## Testing Decisions

A list of testing decisions:
- A description of what makes a good test (only test external behavior, not implementation details)
- Which modules will be tested
- Prior art for the tests (similar types of tests in the codebase)

## Out of Scope

A description of the things that are out of scope for this PRD.

## Further Notes

Any further notes about the feature.
```

## Exit Criteria
- The PRD is complete with all template sections filled in
- User stories are extensive and cover all aspects of the feature
- Implementation decisions describe modules and interfaces, not file paths
- The PRD has been submitted as a GitHub issue (or presented for manual filing)

## Next Phase
→ Workflow complete. See the Workflow Composition section in POWER.md for natural next steps (e.g., `compose-issues` to break the PRD into implementation tickets).

## Draft Prd

# Draft PRD

Turn the current conversation context and codebase understanding into a Product Requirements Document, then submit it as a GitHub issue.

## When to Use

- The user wants to create a PRD from the current context
- A feature discussion needs to be formalized into a structured document
- The user wants to capture implementation decisions before coding begins

## Prerequisites

- Conversation context with enough detail about the feature or problem
- `gh` CLI installed and authenticated (for submitting the PRD as a GitHub issue)

## Adaptation Notes

- **`gh` CLI**: This workflow uses `gh issue create` to submit the PRD as a GitHub issue. Requires the `gh` CLI installed and authenticated in the user's environment. If `gh` is unavailable, present the PRD content for the user to file manually.

## Phases

### Phase 1 — Explore
Explore the repo to understand the current state of the codebase. Identify existing modules, patterns, and conventions relevant to the feature.
→ Load `draft-prd-explore.md`

### Phase 2 — Sketch Modules
Sketch out the major modules to build or modify. Look for opportunities to extract deep modules that can be tested in isolation. Confirm with the user.
→ Load `draft-prd-sketch-modules.md`

### Phase 3 — Write PRD
Write the PRD using the standard template (Problem Statement, Solution, User Stories, Implementation Decisions, Testing Decisions, Out of Scope, Further Notes) and submit it as a GitHub issue.
→ Load `draft-prd-write-prd.md`

## Key Principles

- Do NOT interview the user — synthesize what you already know from the conversation context.
- Actively look for deep module opportunities (see POWER.md Shared Concepts).
- User stories should be extensive and cover all aspects of the feature.
- Implementation decisions describe modules and interfaces, not specific file paths or code snippets.
- Testing decisions focus on external behavior, not implementation details.

## Drive Tests Incremental Loop

# Incremental Loop

## Entry Criteria
- The tracer bullet test exists and passes
- There are remaining behaviors on the approved plan to implement

## Steps

For each remaining behavior on the plan, repeat this cycle:

1. **RED** — Write the next test for the next behavior on the list. Run it. It MUST fail. If it passes, the behavior is already implemented or the test is wrong — investigate before proceeding.
2. **GREEN** — Write the minimal code to make the test pass. Only enough code to satisfy the current test. Do not anticipate future tests or add speculative features.
3. Run all tests. All MUST pass — the new test and all previous tests.
4. Verify the new test against the checklist:
   - Test describes behavior, not implementation
   - Test uses public interface only
   - Test would survive internal refactor
   - Code is minimal for this test
   - No speculative features added
5. Move to the next behavior and repeat.

Rules:
- One test at a time — do NOT write multiple tests before implementing
- Only enough code to pass the current test
- Do not anticipate future tests
- Keep tests focused on observable behavior
- This is vertical slicing: RED→GREEN for each behavior, not all REDs then all GREENs

```
RED→GREEN: test1→impl1
RED→GREEN: test2→impl2
RED→GREEN: test3→impl3
```

## Exit Criteria
- All behaviors from the approved plan have been implemented
- All tests pass
- Each test verifies one behavior through the public interface
- No speculative code has been added beyond what the tests require

## Next Phase
→ Load `drive-tests-refactor.md`

## Drive Tests Planning

# Planning

## Entry Criteria
- The user has described a feature to build or a bug to fix using TDD
- There is a clear understanding of the problem domain
- A test runner is configured in the project

## Steps
1. Confirm with the user what interface changes are needed — what should the public API look like?
2. Confirm with the user which behaviors to test and prioritize them. You cannot test everything — focus testing effort on critical paths and complex logic, not every possible edge case.
3. Identify opportunities for deep modules (see POWER.md Shared Concepts): look for places where a small interface can hide significant implementation complexity.
4. Design interfaces for testability:
   - Accept dependencies, do not create them (dependency injection)
   - Return results, do not produce side effects
   - Keep the surface area small — fewer methods, simpler parameters
5. List the behaviors to test — describe observable behaviors, not implementation steps.
6. Get user approval on the plan before writing any code.

Ask: "What should the public interface look like? Which behaviors are most important to test?"

## Exit Criteria
- The user has approved the list of behaviors to test
- Interface changes are agreed upon
- Deep module opportunities have been identified
- The plan is prioritized and ready for the tracer bullet

## Next Phase
→ Load `drive-tests-tracer-bullet.md`

## Drive Tests Refactor

# Refactor

## Entry Criteria
- All tests from the incremental loop pass (you are GREEN)
- All planned behaviors have been implemented and tested
- Never enter this phase while RED — get to GREEN first

## Steps
1. Review the code written during the incremental loop and look for refactor candidates:
   - **Duplication** → Extract function or class
   - **Long methods** → Break into private helpers (keep tests on the public interface)
   - **Shallow modules** → Combine or deepen (move complexity behind simpler interfaces)
   - **Feature envy** → Move logic to where the data lives
   - **Primitive obsession** → Introduce value objects
   - **Existing code** the new code reveals as problematic — consider what the new code teaches you about the codebase
2. Apply SOLID principles where they arise naturally — do not force them.
3. After each refactor step, run all tests. They MUST still pass. If a test breaks during refactoring, the test was coupled to implementation — fix the test or reconsider the refactor.
4. Look for opportunities to deepen modules: can you reduce the number of methods? Simplify parameters? Hide more complexity inside?
5. Repeat until the code is clean and all tests pass.

**Critical rule**: Never refactor while RED. If a test is failing, fix the code to make it pass before refactoring. Refactoring happens only when all tests are GREEN.

## Exit Criteria
- All tests still pass after refactoring
- Duplication has been extracted
- Modules are as deep as practical
- The code is clean and ready for review

## Next Phase
→ Workflow complete. See the Workflow Composition section in POWER.md for natural next steps (e.g., `review-changes` → `craft-commits`).

## Drive Tests Tracer Bullet

# Tracer Bullet

## Entry Criteria
- The planning phase is complete and the user has approved the behavior list
- The first (highest-priority) behavior has been identified
- The test runner is configured and working

## Steps
1. Pick the single most important behavior from the approved plan.
2. Write ONE test that confirms ONE thing about the system end-to-end. This is the tracer bullet — it proves the path works through all layers.
3. Run the test. It MUST fail (RED). If it passes, the test is not testing new behavior — revisit.
4. Write the minimal code to make the test pass (GREEN). Do not add anything beyond what this single test requires.
5. Run the test again. It MUST pass.
6. Verify the test describes behavior, not implementation:
   - Uses the public interface only
   - Would survive an internal refactor
   - Reads like a specification ("user can checkout with valid cart")

```
RED:   Write test for first behavior → test fails
GREEN: Write minimal code to pass → test passes
```

## Exit Criteria
- One test exists and passes
- The test exercises a real code path through the public API
- The tracer bullet proves the end-to-end path works
- No speculative features have been added

## Next Phase
→ Load `drive-tests-incremental-loop.md`

## Drive Tests

# Drive Tests

Test-driven development with red-green-refactor vertical slices. Build features or fix bugs by writing one test at a time, implementing just enough code to pass, then refactoring.

## When to Use

- The user wants to build features or fix bugs using TDD
- The user mentions "red-green-refactor" or "test-first"
- The user wants integration tests that verify behavior through public interfaces
- The user asks for test-driven development

## Prerequisites

- A test runner configured in the project (see Troubleshooting in POWER.md if missing)
- Clear understanding of the feature or bug to implement

## Shared Concepts

This workflow relies on "deep modules" and "vertical slices" as defined in the POWER.md Shared Concepts section. Deep modules have small interfaces hiding significant complexity. Vertical slices cut thin end-to-end paths through all layers — one test, one implementation, repeat.

## Philosophy

Tests verify behavior through public interfaces, not implementation details. Code can change entirely; tests should not. Good tests are integration-style: they exercise real code paths through public APIs and describe _what_ the system does, not _how_. A good test reads like a specification.

Bad tests are coupled to implementation — they mock internal collaborators, test private methods, or verify through external means. The warning sign: your test breaks when you refactor, but behavior has not changed.

## Anti-Pattern: Horizontal Slices

Do NOT write all tests first, then all implementation. This is horizontal slicing — treating RED as "write all tests" and GREEN as "write all code." Tests written in bulk test imagined behavior, not actual behavior. You outrun your headlights, committing to test structure before understanding the implementation.

Correct approach: vertical slices via tracer bullets. One test → one implementation → repeat.

```
WRONG (horizontal):
  RED:   test1, test2, test3, test4, test5
  GREEN: impl1, impl2, impl3, impl4, impl5

RIGHT (vertical):
  RED→GREEN: test1→impl1
  RED→GREEN: test2→impl2
  RED→GREEN: test3→impl3
```

## Phases

### Phase 1 — Planning
Confirm interface changes, prioritize behaviors to test, identify deep module opportunities, and get user approval on the plan.
→ Load `drive-tests-planning.md`

### Phase 2 — Tracer Bullet
Write ONE test that confirms ONE thing about the system end-to-end. This proves the path works.
→ Load `drive-tests-tracer-bullet.md`

### Phase 3 — Incremental Loop
For each remaining behavior: write one test (RED), write minimal code to pass (GREEN). One test at a time, no anticipating future tests.
→ Load `drive-tests-incremental-loop.md`

### Phase 4 — Refactor
After all tests pass, look for refactor candidates. Never refactor while RED — get to GREEN first.
→ Load `drive-tests-refactor.md`

## Checklist Per Cycle

```
[ ] Test describes behavior, not implementation
[ ] Test uses public interface only
[ ] Test would survive internal refactor
[ ] Code is minimal for this test
[ ] No speculative features added
```

---

## Appendix A: Good and Bad Tests

### Good Tests

Integration-style: test through real interfaces, not mocks of internal parts.

```typescript
// GOOD: Tests observable behavior
test("user can checkout with valid cart", async () => {
  const cart = createCart();
  cart.add(product);
  const result = await checkout(cart, paymentMethod);
  expect(result.status).toBe("confirmed");
});
```

Characteristics:
- Tests behavior users/callers care about
- Uses public API only
- Survives internal refactors
- Describes WHAT, not HOW
- One logical assertion per test

### Bad Tests

Implementation-detail tests: coupled to internal structure.

```typescript
// BAD: Tests implementation details
test("checkout calls paymentService.process", async () => {
  const mockPayment = jest.mock(paymentService);
  await checkout(cart, payment);
  expect(mockPayment.process).toHaveBeenCalledWith(cart.total);
});
```

Red flags:
- Mocking internal collaborators
- Testing private methods
- Asserting on call counts/order
- Test breaks when refactoring without behavior change
- Test name describes HOW not WHAT
- Verifying through external means instead of interface

```typescript
// BAD: Bypasses interface to verify
test("createUser saves to database", async () => {
  await createUser({ name: "Alice" });
  const row = await db.query("SELECT * FROM users WHERE name = ?", ["Alice"]);
  expect(row).toBeDefined();
});

// GOOD: Verifies through interface
test("createUser makes user retrievable", async () => {
  const user = await createUser({ name: "Alice" });
  const retrieved = await getUser(user.id);
  expect(retrieved.name).toBe("Alice");
});
```

---

## Appendix B: When to Mock

Mock at system boundaries only:
- External APIs (payment, email, etc.)
- Databases (sometimes — prefer test DB)
- Time/randomness
- File system (sometimes)

Do not mock:
- Your own classes/modules
- Internal collaborators
- Anything you control

### Designing for Mockability

At system boundaries, design interfaces that are easy to mock:

**1. Use dependency injection**

Pass external dependencies in rather than creating them internally:

```typescript
// Easy to mock
function processPayment(order, paymentClient) {
  return paymentClient.charge(order.total);
}

// Hard to mock
function processPayment(order) {
  const client = new StripeClient(process.env.STRIPE_KEY);
  return client.charge(order.total);
}
```

**2. Prefer SDK-style interfaces over generic fetchers**

Create specific functions for each external operation instead of one generic function with conditional logic:

```typescript
// GOOD: Each function is independently mockable
const api = {
  getUser: (id) => fetch(`/users/${id}`),
  getOrders: (userId) => fetch(`/users/${userId}/orders`),
  createOrder: (data) => fetch('/orders', { method: 'POST', body: data }),
};

// BAD: Mocking requires conditional logic inside the mock
const api = {
  fetch: (endpoint, options) => fetch(endpoint, options),
};
```

The SDK approach means:
- Each mock returns one specific shape
- No conditional logic in test setup
- Easier to see which endpoints a test exercises
- Type safety per endpoint

---

## Appendix C: Deep Modules

From "A Philosophy of Software Design":

**Deep module** = small interface + lots of implementation

```
┌─────────────────────┐
│   Small Interface   │  ← Few methods, simple params
├─────────────────────┤
│                     │
│                     │
│  Deep Implementation│  ← Complex logic hidden
│                     │
│                     │
└─────────────────────┘
```

**Shallow module** = large interface + little implementation (avoid)

```
┌─────────────────────────────────┐
│       Large Interface           │  ← Many methods, complex params
├─────────────────────────────────┤
│  Thin Implementation            │  ← Just passes through
└─────────────────────────────────┘
```

When designing interfaces, ask:
- Can I reduce the number of methods?
- Can I simplify the parameters?
- Can I hide more complexity inside?

See the POWER.md Shared Concepts section for the full "deep modules" definition used across codeshop workflows.

---

## Appendix D: Interface Design for Testability

Good interfaces make testing natural:

1. **Accept dependencies, don't create them**

   ```typescript
   // Testable
   function processOrder(order, paymentGateway) {}

   // Hard to test
   function processOrder(order) {
     const gateway = new StripeGateway();
   }
   ```

2. **Return results, don't produce side effects**

   ```typescript
   // Testable
   function calculateDiscount(cart): Discount {}

   // Hard to test
   function applyDiscount(cart): void {
     cart.total -= discount;
   }
   ```

3. **Small surface area**
   - Fewer methods = fewer tests needed
   - Fewer params = simpler test setup

---

## Appendix E: Refactor Candidates

After the TDD cycle, look for:

- **Duplication** → Extract function/class
- **Long methods** → Break into private helpers (keep tests on public interface)
- **Shallow modules** → Combine or deepen
- **Feature envy** → Move logic to where data lives
- **Primitive obsession** → Introduce value objects
- **Existing code** the new code reveals as problematic

## Edit Article

# Edit Article

Edit and improve articles by restructuring sections, improving clarity, and tightening prose.

## When to Use

- The user wants to edit, revise, or improve an article draft
- A blog post, tutorial, or documentation piece needs structural and prose improvements

## Process

1. First, divide the article into sections based on its headings. Think about the main points to make during those sections.

   Consider that information is a directed acyclic graph — pieces of information can depend on other pieces of information. Make sure the order of sections and their contents respects these dependencies.

   Confirm the sections with the user.

2. For each section:

   a. Rewrite the section to improve clarity, coherence, and flow. Use a maximum of 240 characters per paragraph.

## Guidelines

- Respect the author's voice — improve, don't replace.
- Tighten prose: cut filler words, redundant phrases, and passive constructions where active voice is clearer.
- Ensure each section has a clear purpose and transitions smoothly to the next.
- Flag any sections where the information dependency order seems wrong and propose a reordering.
- Present changes to the user section by section for review before moving on.

## Journal Debug Articulate

# Articulate

## Entry Criteria
- A bug, test failure, or unexpected behavior has been encountered
- The codeshop power is active and the journal-debug workflow has been loaded

## Steps

1. Before touching any code, enforce the **three-sentence rule**. Write down:
   1. **What I expected to happen** — the correct behavior, stated precisely
   2. **What actually happened** — the observed behavior, including error messages verbatim
   3. **What I already know it is not** — hypotheses already ruled out and how

   Do NOT proceed to isolation until all three sentences are written.

2. If you cannot write sentence 3, you have not started investigating yet. Run the failing case, read the error output, check logs. Come back when you can rule something out.

3. Write reproduction steps — the minimal sequence that reliably triggers the bug. If you cannot write a reliable reproduction sequence, do that first. A bug you cannot reproduce is a bug you cannot fix.

4. State the problem in terms of behavior, not code. _"The response is empty"_ — not _"line 42 crashes."_

## Exit Criteria
- All three sentences are written with specificity
- At least one hypothesis has been ruled out
- Reproduction steps are written and confirmed to work from a clean state
- The problem is stated in terms of behavior

## Next Phase
→ Load `journal-debug-isolate.md`

## Journal Debug Fix And Verify

# Fix and Verify

## Entry Criteria
- The bug is isolated to a specific layer and code path
- A concrete hypothesis about root cause exists
- A minimal reproduction case is available

## Steps

1. Apply the fix, then verify it solves the root cause — not just the symptom:

   - **Re-run the reproduction case** — confirm the bug no longer occurs
   - **Check adjacent behavior** — does anything nearby break? Run the full test suite, not just the failing test.
   - **Check for the same mistake elsewhere** — could this same bug exist in other parts of the codebase? Search for similar patterns.
   - **Write a regression test** — if the bug had a test, it would have been caught. Add one now. The test should fail without the fix and pass with it.

2. Write a commit message that describes the root cause, not the fix. _"Prevent null dereference"_ is not a root cause — _"Catalog scanner returned null for artifacts with no evals/ dir"_ is.

3. Update the debug journal entry with:
   - What the root cause actually was
   - How it differed from your initial hypothesis
   - What would have caught this earlier (missing test, missing validation, unclear contract)

## Exit Criteria
- The reproduction case passes with the fix applied
- Adjacent behavior is verified (full test suite passes)
- A regression test exists that fails without the fix
- The commit message describes the root cause
- The debug journal entry is updated with lessons learned

## Next Phase
→ Workflow complete. Suggest natural next steps: load `drive-tests` if additional test coverage is needed, or load `review-changes` to review the fix before merging.

## Journal Debug Isolate

# Isolate

## Entry Criteria
- The three-sentence articulation is complete
- Reproduction steps are confirmed
- At least one hypothesis has been ruled out

## Steps

1. Shrink the problem surface. A bug in 10 lines is easier to see than a bug in 1000. Use these techniques:

   **Binary search the call stack** — add a checkpoint at the midpoint of the execution path. If the state is already wrong there, the bug is in the first half. Repeat until you find the layer where the state first goes wrong.

   **Minimal reproduction** — strip away everything unrelated to the failure. If the bug survives without the database, the network, the auth layer — remove them from your test case.

   **One variable at a time** — when testing hypotheses, change exactly one variable per attempt. Multiple simultaneous changes make it impossible to know what fixed it.

   **Read the error message completely** — the second line is often more useful than the first.

2. Keep a running log of what you tried and what you learned. This log is the debug journal — it prevents you from trying the same thing twice and helps you spot patterns.

3. If you have been stuck for 30 minutes, re-read your three sentences. The problem statement may be wrong — update it if your understanding has changed.

## Exit Criteria
- You have a reproduction that is as small as you can make it
- You know which layer of the stack first sees the wrong state
- You have at least one concrete hypothesis about root cause

## Next Phase
→ Load `journal-debug-fix-and-verify.md`

## Journal Debug

# Journal Debug

A systematic debugging workflow — articulate the problem before chasing the solution. Writing forces clarity that browsing stack traces does not. The fastest path through a bug is rarely the first one you see.

## When to Use

- The user hits a bug, test failure, or unexpected behaviour
- The user mentions "debug this," "why is this broken," or "investigate bug"
- The user wants a systematic approach to debugging rather than trial-and-error
- The user asks for a debug journal or debugging methodology

## Prerequisites

- A reproducible bug, test failure, or unexpected behaviour
- Willingness to write before coding — the three-sentence rule is non-negotiable

## Phases

### Phase 1 — Articulate
Write the three sentences. Establish reproduction steps. Rule out at least one hypothesis before proceeding.
→ Load `journal-debug-articulate.md`

### Phase 2 — Isolate
Shrink the problem surface. Binary search the call stack, build a minimal reproduction, vary one thing at a time.
→ Load `journal-debug-isolate.md`

### Phase 3 — Fix and Verify
Apply the fix, verify it solves the root cause (not just the symptom), write a regression test, and update the journal.
→ Load `journal-debug-fix-and-verify.md`

---

## Reference: The Three-Sentence Rule

Before debugging, write three sentences:

1. **What I expected to happen**
2. **What actually happened**
3. **What I already know it is not**

If you can't write sentence three, you haven't started investigating yet. Do NOT proceed to isolation until all three sentences are written and at least one hypothesis is ruled out.

### Good Example

1. I expected the API to return 200 with a user object when given a valid session token
2. It returns 401 with "session expired" even though the token was created 5 seconds ago
3. It is not a token format issue (verified by decoding the JWT) and not a clock skew issue (server and client times match)

### Bad Example

1. It should work
2. It doesn't work
3. I don't know why

---

## Reference: Best Practices

- **Write the three sentences before touching any code** — this is the single most important step
- **Isolate before you fix** — reproduce the bug in the smallest possible context
- **One variable at a time** — change one thing, observe, then change the next
- **Keep a running log** of what you tried and what you learned
- **If you've been stuck for 30 minutes**, re-read your three sentences — the problem statement may be wrong
- **Read the error message completely** — the second line is often more useful than the first

---

## Reference: Isolation Techniques

**Binary search the call stack** — add a checkpoint at the midpoint of the execution path. If the state is already wrong there, the bug is in the first half. Repeat.

**Minimal reproduction** — strip away everything unrelated to the failure. If the bug survives without the database, the network, the auth layer — remove them from your test case.

**Vary one thing at a time** — when testing hypotheses, change exactly one variable per attempt. Multiple simultaneous changes make it impossible to know what fixed it.

---

## Reference: Fix and Verify Checklist

Before committing:
1. **Re-run the reproduction case** — confirm the bug no longer occurs
2. **Check adjacent behaviour** — does anything nearby break?
3. **Consider the failure mode** — could this same mistake exist elsewhere in the codebase?
4. **Write a test** — if the bug had a test, it would have been caught. Add one now.

### The Commit Message

Describe the root cause, not the fix. "Prevent null dereference" is not a root cause — "Catalog scanner returned null for artifacts with no evals/ dir" is.

### After the Fix

Update your debug journal entry with:
- What the root cause actually was
- How it differed from your initial hypothesis
- What would have caught this earlier

---

## Troubleshooting

**Can't write sentence 3:** You haven't investigated yet. Run the failing case, read the error output, check logs. Come back when you can rule something out.

**Root cause found but fix breaks other tests:** You isolated correctly but the fix is too broad. Narrow the fix to only the failing case and re-run the full suite.

**Stuck in a loop:** If you've tried the same approach three times, step back. Re-read your three sentences. The problem statement may need updating.

## Laconic Output

# Laconic Output

Spartan communication mode. Every word earns its place or gets cut. Grammar stays intact — this is discipline, not laziness. Sentences are stripped to their load-bearing minimum. No warmth, no hedging, no filler. Say only what must be said. Say it once.

## When to Use

- The user says "be brief", "laconic mode", "terse output", "spartan mode", or "short answers"

## Persistence

ACTIVE EVERY RESPONSE once triggered. No drift toward verbosity. No courtesy creep. Still active if unsure. Off only when user says "stop laconic", "normal mode", or "at ease".

## Rules

One sentence where one sentence suffices. No preamble. No summary unless asked. No "let me explain" — just explain. No rhetorical questions. No encouragement. State the answer, then stop.

Keep grammar correct. Prefer short declarative sentences. Active voice. Present tense. Cut adverbs. Cut qualifiers (very/quite/somewhat/arguably). Cut throat-clearing (so/well/now/okay/right). No pleasantries (sure/certainly/of course/happy to).

Technical terms stay exact. Code blocks unchanged. Errors quoted exact.

Pattern: `[Answer]. [Evidence or code]. [Next action if needed].`

Not: "Great question! So basically what's happening here is that your component is re-rendering because React creates a new object reference every time..."
Yes: "Inline object props create new references each render. Memoize them."

### Examples

**"Why is my API slow?"**

> N+1 queries. Batch the lookups or use a dataloader.

**"Explain database connection pooling."**

> A pool keeps open connections ready for reuse. Skips the handshake cost. Essential under load.

**"Should I use Redis or Memcached?"**

> Redis. It does everything Memcached does, plus persistence, pub/sub, and data structures.

**"Why React component re-render?"**

> Inline object prop creates a new reference each render. Wrap it in `useMemo`.

## Clarity Exception

Break laconic mode for: security warnings, destructive operations, ambiguous instructions where brevity risks misinterpretation. Resume immediately after.

Example — destructive operation:

> **This permanently deletes all data in the `users` table. There is no undo. Confirm you have a backup before proceeding.**
>
> ```sql
> DROP TABLE users;
> ```
>
> Confirmed or not?

## Map Context

# Map Context

> **Adaptation note:** User-invoked only — do not proactively suggest this workflow. It runs when the user explicitly asks to zoom out, get broader context, or understand how a section of code fits into the bigger picture.

Go up a layer of abstraction. Give the user a map of all the relevant modules and callers for the area of code they are asking about.

## When to Use

- The user is unfamiliar with a section of code
- The user needs to understand how a component fits into the bigger picture
- The user says "zoom out", "map this", or "what calls this?"

## Process

1. Identify the code area the user is asking about.
2. Use `invokeSubAgent` with the `context-gatherer` agent to explore the surrounding codebase — find callers, dependencies, and related modules.
3. Go up one layer of abstraction from the current focus area.
4. Present a map of all relevant modules and callers.

## Rules

- Do NOT summarize — show the actual dependency graph with concrete module names and call sites.
- Include both inbound (who calls this?) and outbound (what does this call?) relationships.
- If the area spans multiple layers, show the layer boundaries explicitly.
- Keep the map focused on the user's area of interest — don't map the entire codebase.

## Plan Refactor Capture

# Capture

## Entry Criteria
- The user wants to plan a refactor, create a refactoring RFC, or break a refactor into safe incremental steps
- The user has a general idea of the problem area

## Steps
1. Ask the user for a long, detailed description of the problem they want to solve.
2. Ask about any potential ideas they already have for solutions.
3. Listen actively — let the user explain the full context before moving on. Do not interrupt with implementation questions yet.
4. Note the key pain points, motivations, and any constraints the user mentions.
5. Summarize what you heard back to the user to confirm understanding.

Ask: "Describe the problem you want to solve in as much detail as you can. Include any ideas you have for how to fix it."

## Exit Criteria
- The user has provided a detailed description of the problem
- Any initial solution ideas have been captured
- The problem statement is clear enough to begin codebase exploration

## Next Phase
→ Load `plan-refactor-explore.md`

## Plan Refactor Commit Plan

# Commit Plan

## Entry Criteria
- The scope is agreed upon
- Test coverage has been assessed
- Implementation decisions are documented

## Steps
1. Break the implementation into a plan of tiny commits.
2. Follow Martin Fowler's advice: "make each refactoring step as small as possible, so that you can always see the program working."
3. Each commit must leave the codebase in a working state — all tests pass, no broken imports, no half-finished migrations.
4. Order commits to minimize risk:
   - Start with preparatory refactors (extract, rename, move) that do not change behavior
   - Then introduce new abstractions or interfaces
   - Then migrate callers incrementally
   - Then remove old code
5. For each commit, describe:
   - What changes in this commit
   - Why this order (what depends on what)
   - What should still work after this commit
6. Identify any commits that are higher risk and flag them.
7. Present the full commit plan to the user for review.

## Exit Criteria
- The implementation is broken into tiny, ordered commits
- Each commit leaves the codebase in a working state
- The commit order respects dependencies
- The user has reviewed and approved the commit plan

## Next Phase
→ Load `plan-refactor-create-issue.md`

## Plan Refactor Create Issue

# Create Issue

## Entry Criteria
- The commit plan is complete and approved by the user
- All decisions are documented
- `gh` CLI is installed and authenticated

## Steps
1. Create a GitHub issue using `gh issue create` with the refactor plan template below.
2. Do NOT ask the user to review before creating — just create it and share the URL.
3. If `gh` is unavailable, present the issue content for the user to file manually.

Use this template for the issue body:

```markdown
## Problem Statement

The problem that the developer is facing, from the developer's perspective.

## Solution

The solution to the problem, from the developer's perspective.

## Commits

A LONG, detailed implementation plan. Write the plan in plain English, breaking down the implementation into the tiniest commits possible. Each commit should leave the codebase in a working state.

## Decision Document

A list of implementation decisions that were made. This can include:
- The modules that will be built/modified
- The interfaces of those modules that will be modified
- Technical clarifications from the developer
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets. They may end up being outdated very quickly.

## Testing Decisions

A list of testing decisions that were made. Include:
- A description of what makes a good test (only test external behavior, not implementation details)
- Which modules will be tested
- Prior art for the tests (i.e. similar types of tests in the codebase)

## Out of Scope

A description of the things that are out of scope for this refactor.

## Further Notes (optional)

Any further notes about the refactor.
```

4. After creating the issue, print the issue URL and a one-line summary of the refactor plan.

## Exit Criteria
- A GitHub issue has been created with the complete refactor plan
- The issue URL has been shared with the user
- The issue uses durable language (behaviors and contracts, not file paths)

## Next Phase
→ Workflow complete. See the Workflow Composition section in POWER.md for natural next steps (e.g., `compose-issues` to break the plan into implementation issues, or `drive-tests` to begin implementing).

## Plan Refactor Explore

# Explore

## Entry Criteria
- The user has provided a detailed problem description
- The problem area in the codebase is identified

## Steps
1. Explore the codebase to verify the user's assertions about the current state.
2. Use Kiro's `invokeSubAgent` with the `context-gatherer` agent for broad exploration, or use direct file exploration tools (`readCode`, `grepSearch`, `listDirectory`) for targeted investigation.
3. Identify the modules, interfaces, and dependencies involved in the problem area.
4. Check whether the user's description matches reality — note any discrepancies.
5. Look for existing patterns, conventions, and architectural decisions that constrain the refactor.
6. Note any surprises or complications the user may not be aware of.

## Exit Criteria
- The current state of the affected codebase area is understood
- The user's assertions have been verified or corrected
- Modules, interfaces, and dependencies are mapped
- Ready to discuss alternatives with the user

## Next Phase
→ Load `plan-refactor-interview.md`

## Plan Refactor Interview

# Interview

## Entry Criteria
- The codebase has been explored and the current state is understood
- The user's assertions have been verified

## Steps
1. Ask the user whether they have considered other approaches to solving this problem.
2. Present alternative options you identified during exploration — different architectural approaches, simpler solutions, or partial refactors that address the core pain.
3. Interview the user about the implementation in extreme detail:
   - Which modules will be built or modified?
   - What interfaces will change?
   - What are the technical clarifications needed?
   - Are there schema changes, API contract changes, or architectural decisions to make?
   - What specific interactions between components will change?
4. Be thorough — surface every ambiguity and resolve it now, not during implementation.
5. Document each decision as it is made.

Ask: "Have you considered other approaches? Here are some alternatives I see..." then proceed to detailed implementation questions.

## Exit Criteria
- Alternative approaches have been discussed
- The user has made clear implementation decisions
- Technical details are resolved (interfaces, schemas, contracts, interactions)
- All ambiguities have been surfaced and addressed

## Next Phase
→ Load `plan-refactor-scope.md`

## Plan Refactor Scope

# Scope

## Entry Criteria
- The interview phase is complete
- Implementation decisions have been made
- Technical details are resolved

## Steps
1. Work with the user to define the exact scope of the refactor.
2. Explicitly list what will change:
   - Which modules will be modified
   - Which interfaces will be updated
   - What new code will be written
3. Explicitly list what will NOT change:
   - Adjacent modules that remain untouched
   - Behaviors that must be preserved
   - APIs or contracts that stay stable
4. Identify boundary conditions — where does this refactor stop?
5. Call out any "slippery slope" areas where scope could creep.
6. Get the user's explicit agreement on the scope boundary.

Ask: "Here's what I think is in scope and out of scope. Does this match your expectations?"

## Exit Criteria
- In-scope changes are explicitly listed
- Out-of-scope items are explicitly listed
- The user has agreed on the scope boundary
- No ambiguity about what this refactor includes

## Next Phase
→ Load `plan-refactor-test-coverage.md`

## Plan Refactor Test Coverage

# Test Coverage

## Entry Criteria
- The scope of the refactor is agreed upon
- The affected modules and interfaces are identified

## Steps
1. Examine the codebase for existing test coverage of the affected area.
2. Identify what is well-tested, what has gaps, and what has no coverage at all.
3. Look at the types of tests present — unit tests, integration tests, end-to-end tests.
4. Assess whether existing tests will catch regressions during the refactor.
5. If test coverage is insufficient, ask the user about their testing plans:
   - Will they add tests before refactoring (recommended)?
   - Will they add tests as part of the refactor?
   - Are there areas they consider too risky to refactor without tests?
6. Note any tests that will need to be updated as part of the refactor.
7. Identify prior art — similar types of tests in the codebase that can serve as patterns.

Ask (if coverage is insufficient): "Test coverage in this area is thin. What's your plan for testing — add tests first, or as part of the refactor?"

## Exit Criteria
- Test coverage of the affected area has been assessed
- Testing gaps are identified
- The user has a plan for testing (if coverage is insufficient)
- Tests that need updating are noted

## Next Phase
→ Load `plan-refactor-commit-plan.md`

## Plan Refactor

# Plan Refactor

Create a detailed refactor plan with tiny commits via user interview, then file it as a GitHub issue.

## When to Use

- The user wants to plan a refactor
- The user wants to create a refactoring RFC
- The user wants to break a refactor into safe incremental steps

## Prerequisites

- A clear idea of the problem area to refactor
- `gh` CLI installed and authenticated (for filing the refactor plan as a GitHub issue)

## Adaptation Notes

- **`gh` CLI**: This workflow uses `gh issue create` to file the refactor plan as a GitHub issue. Requires the `gh` CLI installed and authenticated in the user's environment. If `gh` is unavailable, present the plan content for the user to file manually.

## Phases

### Phase 1 — Capture
Ask the user for a long, detailed description of the problem they want to solve and any potential ideas for solutions.
→ Load `plan-refactor-capture.md`

### Phase 2 — Explore
Explore the repo to verify the user's assertions and understand the current state of the codebase.
→ Load `plan-refactor-explore.md`

### Phase 3 — Interview
Ask whether the user has considered other options. Present alternatives. Interview the user about the implementation in extreme detail.
→ Load `plan-refactor-interview.md`

### Phase 4 — Scope
Hammer out the exact scope of the implementation. Work out what you plan to change and what you plan not to change.
→ Load `plan-refactor-scope.md`

### Phase 5 — Test Coverage
Check the codebase for test coverage of the affected area. If coverage is insufficient, ask the user about their testing plans.
→ Load `plan-refactor-test-coverage.md`

### Phase 6 — Commit Plan
Break the implementation into a plan of tiny commits. Each commit should leave the codebase in a working state. Follow Martin Fowler's advice: "make each refactoring step as small as possible, so that you can always see the program working."
→ Load `plan-refactor-commit-plan.md`

### Phase 7 — Create Issue
Create a GitHub issue with the refactor plan using the standard template (Problem Statement, Solution, Commits, Decision Document, Testing Decisions, Out of Scope, Further Notes).
→ Load `plan-refactor-create-issue.md`

## Refactor Architecture Explore

# Explore

## Entry Criteria
- User has requested an architecture review, refactoring opportunities, or codebase improvement
- The codeshop power is active and the refactor-architecture workflow has been loaded

## Steps

1. Read existing documentation first:
   - `CONTEXT.md` (or `CONTEXT-MAP.md` + each `CONTEXT.md` in a multi-context repo)
   - Relevant ADRs in `docs/adr/` (and any context-scoped `docs/adr/` directories)
   - If these files do not exist, proceed silently — do not flag their absence or suggest creating them upfront

2. Walk the codebase organically using `invokeSubAgent` with the `context-gatherer` agent. Do not follow rigid heuristics — explore and note where you experience friction:
   - Where does understanding one concept require bouncing between many small modules?
   - Where are modules **shallow** — interface nearly as complex as the implementation?
   - Where have pure functions been extracted just for testability, but the real bugs hide in how they're called (no **locality**)?
   - Where do tightly-coupled modules leak across their seams?
   - Which parts of the codebase are untested, or hard to test through their current interface?

3. Apply the **deletion test** to anything you suspect is shallow: would deleting it concentrate complexity, or just move it? A "yes, concentrates" is the signal you want.

4. Note friction points in terms of the architecture vocabulary:
   - **Shallow modules**: interface nearly as complex as the implementation
   - **Leaky seams**: implementation details crossing module boundaries
   - **Missing locality**: changes or bugs spread across many files instead of concentrating in one place
   - **Untested or untestable code**: no clear interface to test through

## Exit Criteria
- You have explored the codebase and identified at least 2-3 areas of architectural friction
- Friction points are described using consistent architecture vocabulary (module, interface, seam, depth, locality, leverage)
- You have checked existing CONTEXT.md and ADRs for relevant context

## Next Phase
→ Load `refactor-architecture-present.md`

## Refactor Architecture Grilling Loop

# Grilling Loop

## Entry Criteria
- The user has selected a deepening candidate from the presented list
- The candidate's files, problem, and solution are understood

## Steps

1. Drop into a grilling conversation with the user. Walk the design tree together:
   - What are the constraints on this module?
   - What are its dependencies — and which are essential vs accidental?
   - What is the shape of the deepened module — what sits behind the seam?
   - What tests survive the refactor? Which need rewriting?
   - What does the interface look like from the caller's perspective?

2. Apply side effects inline as decisions crystallize:

   - **Naming a deepened module after a concept not in `CONTEXT.md`?** Add the term to `CONTEXT.md` right there — same discipline as the challenge-domain-model workflow. See the challenge-domain-model steering file for context format details. Create the file lazily if it does not exist.

   - **Sharpening a fuzzy term during the conversation?** Update `CONTEXT.md` immediately — do not batch these up.

   - **User rejects the candidate with a load-bearing reason?** Offer an ADR, framed as: _"Want me to record this as an ADR so future architecture reviews don't re-suggest it?"_ Only offer when the reason would actually be needed by a future explorer. Skip ephemeral reasons ("not worth it right now") and self-evident ones. See the challenge-domain-model steering file for ADR format details.

   - **Want to explore alternative interfaces for the deepened module?** Use the interface design principles from the refactor-architecture steering file appendix, or load the design-interface workflow for a full parallel-alternatives session.

3. Continue the grilling loop until the user is satisfied with the design direction or decides to move on.

## Exit Criteria
- The design direction for the selected candidate has been explored through conversation
- `CONTEXT.md` has been updated with any new or sharpened terms
- ADRs have been offered (and created if accepted) for load-bearing decisions
- The user has a clear picture of the deepened module's shape, interface, and test implications

## Next Phase
→ Workflow complete. Suggest natural next steps: load `plan-refactor` to detail the implementation approach, or load `compose-issues` to break the refactor into work items.

## Refactor Architecture Present

# Present Candidates

## Entry Criteria
- Codebase exploration is complete
- You have identified multiple areas of architectural friction
- Friction points are described using architecture vocabulary (module, interface, seam, depth, locality, leverage)

## Steps

1. Present a numbered list of **deepening opportunities** — refactors that turn shallow modules into deep ones. For each candidate:
   - **Files** — which files/modules are involved
   - **Problem** — why the current architecture is causing friction
   - **Solution** — plain English description of what would change
   - **Benefits** — explained in terms of locality and leverage, and how tests would improve

2. Use `CONTEXT.md` vocabulary for the domain, and architecture vocabulary for the structure. If `CONTEXT.md` defines "Order," talk about "the Order intake module" — not "the FooBarHandler," and not "the Order service."

3. Handle ADR conflicts carefully: if a candidate contradicts an existing ADR, only surface it when the friction is real enough to warrant revisiting the ADR. Mark it clearly (e.g., _"contradicts ADR-0007 — but worth reopening because…"_). Do not list every theoretical refactor an ADR forbids.

4. Do NOT propose interfaces yet. Ask the user: "Which of these would you like to explore?"

## Exit Criteria
- A numbered list of deepening candidates has been presented to the user
- Each candidate includes files, problem, solution, and benefits (in terms of locality and leverage)
- No interfaces have been proposed — only problems and plain-English solutions
- The user has been asked which candidate to explore

## Next Phase
→ Load `refactor-architecture-grilling-loop.md`

## Refactor Architecture

# Refactor Architecture

Surface architectural friction and propose deepening opportunities — refactors that turn shallow modules into deep ones. The aim is testability and AI-navigability, informed by the domain language in CONTEXT.md and the decisions in docs/adr/.

## Adaptation Notes

- **Codebase exploration**: Use `invokeSubAgent` with the `context-gatherer` agent to walk the codebase organically, or use direct file exploration tools (`readCode`, `grepSearch`, `listDirectory`).
- **Cross-references**: See the challenge-domain-model steering file for context format details. See the challenge-domain-model steering file for ADR format details.

## When to Use

- The user wants to improve architecture or find refactoring opportunities
- The user wants to consolidate tightly-coupled modules
- The user wants to make a codebase more testable or AI-navigable
- The user mentions "deepening," "shallow modules," or "architectural friction"

## Prerequisites

- Familiarity with the project's codebase structure
- Optional: `CONTEXT.md` and `docs/adr/` if they exist (the workflow reads them but does not require them)

## Shared Concepts

This workflow relies on "deep modules" and "domain language discipline" as defined in the POWER.md Shared Concepts section. Deep modules have small interfaces hiding significant complexity. Domain language discipline means using terms from CONTEXT.md consistently in all suggestions and discussions.

## Glossary

Use these terms exactly in every suggestion. Consistent language is the point — don't drift into "component," "service," "API," or "boundary."

- **Module** — anything with an interface and an implementation (function, class, package, slice).
- **Interface** — everything a caller must know to use the module: types, invariants, error modes, ordering, config. Not just the type signature.
- **Implementation** — the code inside.
- **Depth** — leverage at the interface: a lot of behaviour behind a small interface. Deep = high leverage. Shallow = interface nearly as complex as the implementation.
- **Seam** — where an interface lives; a place behaviour can be altered without editing in place. (Use this, not "boundary.")
- **Adapter** — a concrete thing satisfying an interface at a seam.
- **Leverage** — what callers get from depth.
- **Locality** — what maintainers get from depth: change, bugs, knowledge concentrated in one place.

Key principles:

- **Deletion test**: imagine deleting the module. If complexity vanishes, it was a pass-through. If complexity reappears across N callers, it was earning its keep.
- **The interface is the test surface.**
- **One adapter = hypothetical seam. Two adapters = real seam.**

## Phases

### Phase 1 — Explore
Read existing documentation (CONTEXT.md, ADRs), then walk the codebase organically. Note where you experience friction: shallow modules, leaky seams, untested code, tightly-coupled clusters.
→ Load `refactor-architecture-explore.md`

### Phase 2 — Present Candidates
Present a numbered list of deepening opportunities with files, problem, solution, and benefits explained in terms of locality and leverage. Do NOT propose interfaces yet.
→ Load `refactor-architecture-present.md`

### Phase 3 — Grilling Loop
Once the user picks a candidate, walk the design tree with them — constraints, dependencies, the shape of the deepened module, what sits behind the seam, what tests survive. Update CONTEXT.md and offer ADRs inline as decisions crystallize.
→ Load `refactor-architecture-grilling-loop.md`

---

## Appendix A: Architecture Language

Shared vocabulary for every suggestion this workflow makes. Use these terms exactly — don't substitute "component," "service," "API," or "boundary." Consistent language is the whole point.

### Terms

**Module**
Anything with an interface and an implementation. Deliberately scale-agnostic — applies equally to a function, class, package, or tier-spanning slice.
_Avoid_: unit, component, service.

**Interface**
Everything a caller must know to use the module correctly. Includes the type signature, but also invariants, ordering constraints, error modes, required configuration, and performance characteristics.
_Avoid_: API, signature (too narrow — those refer only to the type-level surface).

**Implementation**
What's inside a module — its body of code. Distinct from **Adapter**: a thing can be a small adapter with a large implementation (a Postgres repo) or a large adapter with a small implementation (an in-memory fake). Reach for "adapter" when the seam is the topic; "implementation" otherwise.

**Depth**
Leverage at the interface — the amount of behaviour a caller (or test) can exercise per unit of interface they have to learn. A module is **deep** when a large amount of behaviour sits behind a small interface. A module is **shallow** when the interface is nearly as complex as the implementation.

**Seam** _(from Michael Feathers)_
A place where you can alter behaviour without editing in that place. The *location* at which a module's interface lives. Choosing where to put the seam is its own design decision, distinct from what goes behind it.
_Avoid_: boundary (overloaded with DDD's bounded context).

**Adapter**
A concrete thing that satisfies an interface at a seam. Describes *role* (what slot it fills), not substance (what's inside).

**Leverage**
What callers get from depth. More capability per unit of interface they have to learn. One implementation pays back across N call sites and M tests.

**Locality**
What maintainers get from depth. Change, bugs, knowledge, and verification concentrate at one place rather than spreading across callers. Fix once, fixed everywhere.

### Principles

- **Depth is a property of the interface, not the implementation.** A deep module can be internally composed of small, mockable, swappable parts — they just aren't part of the interface. A module can have **internal seams** (private to its implementation, used by its own tests) as well as the **external seam** at its interface.
- **The deletion test.** Imagine deleting the module. If complexity vanishes, the module wasn't hiding anything (it was a pass-through). If complexity reappears across N callers, the module was earning its keep.
- **The interface is the test surface.** Callers and tests cross the same seam. If you want to test *past* the interface, the module is probably the wrong shape.
- **One adapter means a hypothetical seam. Two adapters means a real one.** Don't introduce a seam unless something actually varies across it.

### Relationships

- A **Module** has exactly one **Interface** (the surface it presents to callers and tests).
- **Depth** is a property of a **Module**, measured against its **Interface**.
- A **Seam** is where a **Module**'s **Interface** lives.
- An **Adapter** sits at a **Seam** and satisfies the **Interface**.
- **Depth** produces **Leverage** for callers and **Locality** for maintainers.

### Rejected Framings

- **Depth as ratio of implementation-lines to interface-lines** (Ousterhout): rewards padding the implementation. We use depth-as-leverage instead.
- **"Interface" as the TypeScript `interface` keyword or a class's public methods**: too narrow — interface here includes every fact a caller must know.
- **"Boundary"**: overloaded with DDD's bounded context. Say **seam** or **interface**.

---

## Appendix B: Deepening

How to deepen a cluster of shallow modules safely, given its dependencies. Assumes the vocabulary from Appendix A — **module**, **interface**, **seam**, **adapter**.

### Dependency Categories

When assessing a candidate for deepening, classify its dependencies. The category determines how the deepened module is tested across its seam.

#### 1. In-process

Pure computation, in-memory state, no I/O. Always deepenable — merge the modules and test through the new interface directly. No adapter needed.

#### 2. Local-substitutable

Dependencies that have local test stand-ins (PGLite for Postgres, in-memory filesystem). Deepenable if the stand-in exists. The deepened module is tested with the stand-in running in the test suite. The seam is internal; no port at the module's external interface.

#### 3. Remote but owned (Ports & Adapters)

Your own services across a network boundary (microservices, internal APIs). Define a **port** (interface) at the seam. The deep module owns the logic; the transport is injected as an **adapter**. Tests use an in-memory adapter. Production uses an HTTP/gRPC/queue adapter.

Recommendation shape: *"Define a port at the seam, implement an HTTP adapter for production and an in-memory adapter for testing, so the logic sits in one deep module even though it's deployed across a network."*

#### 4. True external (Mock)

Third-party services (Stripe, Twilio, etc.) you don't control. The deepened module takes the external dependency as an injected port; tests provide a mock adapter.

### Seam Discipline

- **One adapter means a hypothetical seam. Two adapters means a real one.** Don't introduce a port unless at least two adapters are justified (typically production + test). A single-adapter seam is just indirection.
- **Internal seams vs external seams.** A deep module can have internal seams (private to its implementation, used by its own tests) as well as the external seam at its interface. Don't expose internal seams through the interface just because tests use them.

### Testing Strategy: Replace, Don't Layer

- Old unit tests on shallow modules become waste once tests at the deepened module's interface exist — delete them.
- Write new tests at the deepened module's interface. The **interface is the test surface**.
- Tests assert on observable outcomes through the interface, not internal state.
- Tests should survive internal refactors — they describe behaviour, not implementation. If a test has to change when the implementation changes, it's testing past the interface.

---

## Appendix C: Interface Design

When the user wants to explore alternative interfaces for a chosen deepening candidate, use this parallel sub-agent pattern. Based on "Design It Twice" (Ousterhout) — your first idea is unlikely to be the best.

Uses the vocabulary from Appendix A — **module**, **interface**, **seam**, **adapter**, **leverage**.

### Process

#### 1. Frame the Problem Space

Before spawning sub-agents, write a user-facing explanation of the problem space for the chosen candidate:

- The constraints any new interface would need to satisfy
- The dependencies it would rely on, and which category they fall into (see Appendix B: Deepening)
- A rough illustrative code sketch to ground the constraints — not a proposal, just a way to make the constraints concrete

Show this to the user, then immediately proceed to Step 2. The user reads and thinks while the sub-agents work.

#### 2. Spawn Sub-Agents

Use `invokeSubAgent` with the `general-task-execution` agent to generate radically different interface designs. Each sub-agent receives a separate technical brief (file paths, coupling details, dependency category from Appendix B, what sits behind the seam). Give each agent a different design constraint:

- Agent 1: "Minimize the interface — aim for 1–3 entry points max. Maximise leverage per entry point."
- Agent 2: "Maximise flexibility — support many use cases and extension."
- Agent 3: "Optimise for the most common caller — make the default case trivial."
- Agent 4 (if applicable): "Design around ports & adapters for cross-seam dependencies."

Include both the architecture vocabulary (Appendix A) and CONTEXT.md vocabulary in the brief so each sub-agent names things consistently.

Each sub-agent outputs:

1. Interface (types, methods, params — plus invariants, ordering, error modes)
2. Usage example showing how callers use it
3. What the implementation hides behind the seam
4. Dependency strategy and adapters (see Appendix B)
5. Trade-offs — where leverage is high, where it's thin

#### 3. Present and Compare

Present designs sequentially so the user can absorb each one, then compare them in prose. Contrast by **depth** (leverage at the interface), **locality** (where change concentrates), and **seam placement**.

After comparing, give your own recommendation: which design you think is strongest and why. If elements from different designs would combine well, propose a hybrid. Be opinionated — the user wants a strong read, not a menu.

## Review Changes Comment

# Comment

## Entry Criteria
- Tests and implementation have been read
- Issues have been identified and classified by severity

## Steps

1. Classify each finding using the review taxonomy:

   - **"must address"** — blocks merge. Logic errors, security issues, breaking changes, missing error handling at system boundaries. These must be fixed before the PR can be merged.

   - **"should address"** — request the change but do not block merge. Missing tests for non-trivial logic, inconsistencies with existing patterns, performance regressions. The author should address these but can merge without them if they have a good reason.

   - **"nit"** — style preferences not covered by the linter. Prefix with "nit:" so the author knows this is optional. Alternative approaches worth considering in future.

2. Write specific, actionable comments:
   - Be specific — _"`processOrder` throws if `user` is null, which happens when the session expires mid-checkout. Consider adding a null check with a redirect to login."_ is better than _"This could throw."_
   - Suggest, don't just criticize — include a proposed alternative when it is obvious
   - Ask questions when unsure — _"Is this intentional?"_ opens dialogue better than an assertion

3. Acknowledge good work — a review that only flags problems creates a negative feedback loop. If you see a well-structured test, a clean abstraction, or a thoughtful comment, say so.

4. Before leaving any comment, ask: does this improve the code, or does it reflect a personal preference? Both are valid — but label them differently.

## Exit Criteria
- All findings are classified as "must address," "should address," or "nit"
- Each comment is specific and includes a proposed alternative where applicable
- Good work has been acknowledged
- Comments are ready to be posted

## Next Phase
→ Load `review-changes-decide.md`

## Review Changes Decide

# Decide

## Entry Criteria
- All findings are classified and comments are written
- The review is ready for a final verdict

## Steps

1. Make the approval decision:

   **Approve** when:
   - You could explain this code to a colleague yourself
   - All "must address" items have been resolved (or there are none)
   - The code does what the PR description says it does
   - Tests cover the important behaviors

   **Request changes** when:
   - There are unresolved "must address" items
   - The code does not match the stated intent
   - Critical test coverage is missing
   - Security or correctness issues are present

2. If requesting changes, ensure every comment is actionable:
   - State what needs to change
   - Explain why it needs to change
   - Propose an alternative where possible
   - Do not leave vague requests like "please fix" without specifics

3. Do not rubber-stamp. An approval that misses a security issue is worse than no review at all. If you are not confident in your understanding of the code, say so — ask questions rather than approving with uncertainty.

4. Post the review with the appropriate verdict and all comments.

## Exit Criteria
- A clear verdict has been given: approve or request changes
- All comments are posted with appropriate severity labels
- If changes are requested, every request is specific and actionable
- The author knows exactly what to do next

## Next Phase
→ Workflow complete. If the review surfaces a bug, suggest loading `triage-bug` to investigate. If the review surfaces a refactoring opportunity, suggest loading `plan-refactor` to detail the approach.

## Review Changes Orient

# Orient

## Entry Criteria
- A pull request, merge request, or diff is available for review
- The codeshop power is active and the review-changes workflow has been loaded

## Steps

1. Read the PR description first — understand intent before reading code. If there is no description, ask for one before reviewing. A PR without a description forces the reviewer to reverse-engineer intent from the diff.

2. Skim the full diff to orient yourself:
   - How many files are changed?
   - What is the scope — is this a focused change or a broad refactor?
   - Which areas of the codebase are touched?
   - Are there any files that seem unrelated to the stated intent?

3. Note the PR's stated goal and any context:
   - What problem does this solve?
   - What approach was chosen?
   - Are there any caveats or known limitations mentioned?

4. If the PR is too large to review effectively (more than ~400 lines or ~30 minutes of review time), ask the author to split it into logical chunks. Review each chunk separately.

## Exit Criteria
- The PR description has been read and the intent is understood
- The full diff has been skimmed for scope and structure
- You have a mental model of what the PR is trying to accomplish
- Large PRs have been flagged for splitting if needed

## Next Phase
→ Load `review-changes-read.md`

## Review Changes Read

# Read

## Entry Criteria
- The PR description has been read and intent is understood
- The full diff has been skimmed for scope

## Steps

1. Read changed tests first — they explain expected behavior better than the implementation. For each test change:
   - What behavior is being added, changed, or removed?
   - Do the test names clearly describe the expected behavior?
   - Are edge cases covered?
   - Do the tests actually test what they claim to test?

2. Read the implementation — now verify it matches the tests and the description:
   - Does the code do what the tests expect?
   - Does the code do what the PR description says?
   - Are there behaviors in the code that are not covered by tests?
   - Are there any side effects that the tests do not exercise?

3. Look for specific issues:

   **Must address** (blocks merge):
   - Logic errors, off-by-ones, race conditions
   - Security issues: injection, auth bypasses, exposed secrets
   - Breaking changes without a migration path
   - Missing error handling at system boundaries

   **Should address** (request but don't block):
   - Missing tests for non-trivial logic
   - Inconsistencies with existing patterns in the codebase
   - Performance regressions visible from the code

   **Nit** (style preferences):
   - Style preferences not covered by the linter
   - Alternative approaches worth considering in future

4. If you find a contradiction between the tests and the implementation, flag it — one of them is wrong.

## Exit Criteria
- Changed tests have been read and understood
- Implementation has been verified against tests and PR description
- Issues have been identified and mentally classified by severity

## Next Phase
→ Load `review-changes-comment.md`

## Review Changes

# Review Changes

Code review as a craft — read with intent, comment with purpose, approve with confidence. Use when reviewing pull requests, merge requests, or any code changes. The goal is a better codebase, not a lower diff count.

## When to Use

- The user wants to review a pull request or diff
- The user mentions "review this," "code review," or "check this diff"
- The user asks for feedback on changes before merging

## Prerequisites

- A diff, pull request, or set of changes to review
- Optional: `gh` CLI installed and authenticated for PR-based workflows

## Core Principle

Code review is a collaboration, not an audit. Before leaving any comment, ask: does this improve the code, or does it reflect a personal preference? Both are valid — but label them differently.

## Phases

### Phase 1 — Orient
Read the PR description and skim the full diff to understand scope and intent before reviewing any individual file.
→ Load `review-changes-orient.md`

### Phase 2 — Read
Read changed tests first (they explain expected behavior), then read the implementation to verify it matches the tests and description.
→ Load `review-changes-read.md`

### Phase 3 — Comment
Classify each finding using the comment taxonomy. Leave specific, actionable comments with proposed alternatives.
→ Load `review-changes-comment.md`

### Phase 4 — Decide
Approve only when you could explain the code to a colleague, or request changes with specific actionable comments.
→ Load `review-changes-decide.md`

---

## Reference: Reading Order

1. **Read the PR description first** — understand intent before reading code. If there's no description, ask for one before reviewing.
2. **Skim the full diff** — orient yourself to the scope before diving into any file.
3. **Read changed tests first** — they often explain expected behaviour better than the implementation.
4. **Read the implementation** — now verify it matches the tests and the description.

---

## Reference: Comment Taxonomy

### Must Address (blocks merge)
- Logic errors, off-by-ones, race conditions
- Security issues: injection, auth bypasses, exposed secrets
- Breaking changes without a migration path
- Missing error handling at system boundaries

### Should Address (request but don't block)
- Missing tests for non-trivial logic
- Inconsistencies with existing patterns in the codebase
- Performance regressions visible from the code

### Nit (style preferences)
- Style preferences that aren't covered by the linter
- Alternative approaches that may be worth considering in future

### Leaving Good Comments

- Be specific — "this could throw" is less useful than "this throws if `user` is null, which happens when the session expires"
- Suggest, don't just criticise — include a proposed alternative when it's obvious
- Ask questions when unsure — "is this intentional?" opens dialogue better than an assertion
- Acknowledge good work — a review that only flags problems creates a negative feedback loop

### Examples

**Good comment:**
> `processOrder` throws if `user` is null, which happens when the session expires mid-checkout. Consider adding a null check with a redirect to login.

**Bad comment:**
> This could throw.

**Good nit:**
> nit: I'd name this `fetchActiveUsers` rather than `getUsers` — but not blocking.

---

## Reference: Approval Criteria

Only approve when you would be comfortable explaining this code to a colleague yourself. Rubber-stamp approvals devalue the review process for everyone.

### Best Practices

- Separate "must fix" from "nit" — label your comments so the author knows what blocks merge
- Review in one sitting when possible — context-switching mid-review leads to missed connections
- Time-box large PRs — if a PR is too big to review in 30 minutes, ask the author to split it
- Review your own PR first — catch the obvious issues before asking someone else to

### When to Request Changes

Request changes when any "must address" item exists. Be specific about what needs to change and why. Include a proposed alternative when the fix isn't obvious.

### When to Approve

Approve when:
- No "must address" items remain
- You understand the intent and the implementation matches it
- You could explain this code to a colleague
- Any "should address" items are acknowledged (fixed or explicitly deferred)

## Run Qa Session Continue

# Continue

## Entry Criteria
- At least one issue has been filed
- The user has not indicated they are done

## Steps
1. After filing the issue(s), print all issue URLs with a brief summary.
2. If a breakdown was created, summarize the blocking relationships.
3. Ask: "Next issue, or are we done?"
4. If the user raises another issue, start a new cycle from the Listen phase.
5. Each issue is independent — do not batch them. Handle one at a time.
6. Keep going until the user says they are done.
7. When the session ends, print a final summary of all issue URLs created during the session.

## Exit Criteria
- The user has indicated they are done, OR a new issue cycle begins at the Listen phase
- All issue URLs from the session have been printed
- The session is cleanly wrapped up

## Next Phase
→ If the user raises another issue: Load `run-qa-session-listen.md`
→ If the user is done: Workflow complete. See the Workflow Composition section in POWER.md for natural next steps.

## Run Qa Session Explore

# Explore

## Entry Criteria
- The user has described the problem
- Enough context exists to identify the relevant codebase area

## Steps
1. Explore the relevant codebase area in the background using Kiro's `invokeSubAgent` with the `context-gatherer` agent, or use direct file exploration tools (`readCode`, `grepSearch`, `listDirectory`) for targeted investigation.
2. The goal is NOT to find a fix. The goal is to:
   - Learn the domain language used in that area (check `UBIQUITOUS_LANGUAGE.md` if it exists)
   - Understand what the feature is supposed to do
   - Identify the user-facing behavior boundary
3. This context helps write a better issue — but the issue itself should NOT reference specific files, line numbers, or internal implementation details.
4. Note the domain terms that should be used when writing the issue.

## Exit Criteria
- The relevant codebase area has been explored
- Domain language for the area is understood
- The feature's intended behavior is clear
- Ready to assess scope

## Next Phase
→ Load `run-qa-session-scope.md`

## Run Qa Session File Issue

# File Issue

## Entry Criteria
- The scope is determined (single issue or breakdown)
- Domain language for the area is understood
- `gh` CLI is installed and authenticated

## Steps
1. Create issues with `gh issue create`. Do NOT ask the user to review first — just file and share URLs.
2. If `gh` is unavailable, present the issue content for the user to file manually.

### For a single issue, use this template:

```markdown
## What happened

[Describe the actual behavior the user experienced, in plain language]

## What I expected

[Describe the expected behavior]

## Steps to reproduce

1. [Concrete, numbered steps a developer can follow]
2. [Use domain terms from the codebase, not internal module names]
3. [Include relevant inputs, flags, or configuration]

## Additional context

[Any extra observations from the user or from codebase exploration that help frame the issue — use domain language but do not cite files]
```

### For a breakdown (multiple issues):

Create issues in dependency order (blockers first) so you can reference real issue numbers.

```markdown
## Parent issue

#<parent-issue-number> (if you created a tracking issue) or "Reported during QA session"

## What's wrong

[Describe this specific behavior problem — just this slice, not the whole report]

## What I expected

[Expected behavior for this specific slice]

## Steps to reproduce

1. [Steps specific to THIS issue]

## Blocked by

- #<issue-number> (if this issue cannot be fixed until another is resolved)

Or "None — can start immediately" if no blockers.

## Additional context

[Any extra observations relevant to this slice]
```

3. Follow these rules for all issue bodies (see POWER.md Shared Concepts on "durable issues"):
   - No file paths or line numbers — these go stale
   - Use the project's domain language (check `UBIQUITOUS_LANGUAGE.md` if it exists)
   - Describe behaviors, not code
   - Reproduction steps are mandatory — if you cannot determine them, ask the user
   - Keep it concise — a developer should be able to read the issue in 30 seconds
4. When creating a breakdown:
   - Prefer many thin issues over few thick ones
   - Mark blocking relationships honestly
   - Create issues in dependency order so you can reference real issue numbers
   - Maximize parallelism

## Exit Criteria
- All issues have been filed via `gh issue create`
- Issue URLs have been shared with the user
- Issues use durable language (behaviors, not file paths)
- Blocking relationships are documented (if breakdown)

## Next Phase
→ Load `run-qa-session-continue.md`

## Run Qa Session Listen

# Listen

## Entry Criteria
- The user wants to report bugs, do QA, or file issues conversationally
- A QA session has been initiated

## Steps
1. Let the user describe the problem in their own words. Do not interrupt.
2. Ask at most 2-3 short clarifying questions, focused on:
   - What they expected vs what actually happened
   - Steps to reproduce (if not obvious from the description)
   - Whether the problem is consistent or intermittent
3. Do NOT over-interview. If the description is clear enough to file an issue, move on.
4. Capture the key details:
   - Actual behavior observed
   - Expected behavior
   - Reproduction context (if provided)

## Exit Criteria
- The user has described the problem
- Clarifying questions (if any) have been answered
- Enough context exists to explore the codebase and file an issue

## Next Phase
→ Load `run-qa-session-explore.md`

## Run Qa Session Scope

# Scope

## Entry Criteria
- The problem has been described and clarified
- The relevant codebase area has been explored

## Steps
1. Assess whether this is a single issue or needs to be broken down into multiple issues.
2. Break down when:
   - The fix spans multiple independent areas (e.g., "the form validation is wrong AND the success message is missing AND the redirect is broken")
   - There are clearly separable concerns that different people could work on in parallel
   - The user describes something with multiple distinct failure modes or symptoms
3. Keep as a single issue when:
   - It is one behavior that is wrong in one place
   - The symptoms are all caused by the same root behavior
4. If breaking down, identify:
   - The individual sub-issues
   - Dependency order (which issues block which)
   - Which issues can be worked on in parallel
5. Communicate the scope decision to the user before filing.

## Exit Criteria
- The scope is assessed: single issue or breakdown
- If breakdown: sub-issues are identified with dependency order
- The user understands the scope decision
- Ready to file the issue(s)

## Next Phase
→ Load `run-qa-session-file-issue.md`

## Run Qa Session

# Run QA Session

Interactive QA session where the user reports bugs or issues conversationally, and the agent files GitHub issues. Explores the codebase in the background for context and domain language.

## When to Use

- The user wants to report bugs or do QA
- The user wants to file issues conversationally
- The user mentions "QA session" or wants to walk through problems they have encountered

## Prerequisites

- `gh` CLI installed and authenticated (for filing GitHub issues)
- Optionally, a `UBIQUITOUS_LANGUAGE.md` file for domain language reference

## Shared Concepts

This workflow relies on "durable issues" and "domain language discipline" as defined in the POWER.md Shared Concepts section. Issues describe behaviors (not file paths) so they survive refactors, and all issue text uses the project's domain language from CONTEXT.md or UBIQUITOUS_LANGUAGE.md.

## Adaptation Notes

- **Codebase exploration**: Where the original workflow used a Claude Code sub-agent for background exploration, use Kiro's `invokeSubAgent` with the `context-gatherer` agent, or use direct file exploration tools (`readCode`, `grepSearch`, `listDirectory`).
- **`gh` CLI**: This workflow uses `gh issue create` to file issues. Requires the `gh` CLI installed and authenticated in the user's environment. If `gh` is unavailable, present the issue content for the user to file manually.

## Phases

### Phase 1 — Listen
Let the user describe the problem in their own words. Ask at most 2-3 short clarifying questions focused on expected vs actual behavior, reproduction steps, and consistency. Do not over-interview.
→ Load `run-qa-session-listen.md`

### Phase 2 — Explore
While talking to the user, explore the relevant codebase area in the background. The goal is NOT to find a fix — it is to learn the domain language, understand what the feature is supposed to do, and identify the user-facing behavior boundary.
→ Load `run-qa-session-explore.md`

### Phase 3 — Scope
Assess whether this is a single issue or needs to be broken down into multiple issues. Break down when the fix spans multiple independent areas or has clearly separable concerns.
→ Load `run-qa-session-scope.md`

### Phase 4 — File Issue
Create issues with `gh issue create`. Do NOT ask the user to review first — just file and share URLs. Use the appropriate template (single issue or breakdown).
→ Load `run-qa-session-file-issue.md`

### Phase 5 — Continue
Keep going until the user says they are done. Each issue is independent — do not batch them. After filing, print all issue URLs and ask: "Next issue, or are we done?"
→ Load `run-qa-session-continue.md`

## Issue Rules

- No file paths or line numbers — these go stale
- Use the project's domain language (check UBIQUITOUS_LANGUAGE.md if it exists)
- Describe behaviors, not code — "the sync service fails to apply the patch" not "applyPatch() throws on line 42"
- Reproduction steps are mandatory — if you cannot determine them, ask the user
- Keep it concise — a developer should be able to read the issue in 30 seconds

## Stress Test Plan

# Stress-Test Plan

Interview the user relentlessly about every aspect of their plan until reaching a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one by one. For each question, provide your recommended answer.

Ask the questions one at a time.

If a question can be answered by exploring the codebase, explore the codebase instead — use `readCode`, `grepSearch`, or `listDirectory` to gather evidence before asking.

## When to Use

- The user wants to stress-test a plan or design
- The user says "grill me" or "poke holes in this"
- A PRD, spec, or design document needs adversarial review before implementation

## Approach

1. Read the plan or design document the user references.
2. Identify every assumption, dependency, and decision point.
3. For each branch of the decision tree:
   - Ask one focused question.
   - Provide your recommended answer with reasoning.
   - Wait for the user's response before moving to the next question.
4. Resolve dependencies between decisions — if decision B depends on decision A, resolve A first.
5. Continue until all branches are explored and the user confirms shared understanding.

## Tips

- Do not batch questions. One question per turn keeps the conversation focused.
- When the codebase can answer a question, explore it yourself rather than asking the user.
- Challenge vague answers — ask for specifics, examples, or constraints.
- Track resolved vs. unresolved branches and summarize progress periodically.

## Triage Bug Capture

# Capture

## Entry Criteria
- The user has reported a bug, unexpected behavior, or wants to investigate a problem
- Or the user is ready to describe the problem when prompted

## Steps
1. If the user has already described the problem, acknowledge it and move on to diagnosis immediately.
2. If the user has not provided a description, ask ONE question: "What's the problem you're seeing?"
3. Do NOT ask follow-up questions yet. Do not over-interview.
4. Capture the key details from whatever the user provides:
   - What they observed (actual behavior)
   - What they expected (if mentioned)
   - Any reproduction context (if mentioned)
5. Start investigating immediately after receiving the description.

This is a mostly hands-off workflow — minimize questions to the user.

## Exit Criteria
- A brief description of the problem has been captured
- Enough context exists to begin codebase investigation
- No unnecessary follow-up questions were asked

## Next Phase
→ Load `triage-bug-diagnose.md`

## Triage Bug Create Issue

# Create Issue

## Entry Criteria
- The TDD fix plan is complete
- Root cause analysis is documented
- `gh` CLI is installed and authenticated

## Steps
1. Create a GitHub issue using `gh issue create` with the template below.
2. Do NOT ask the user to review before creating — just create it and share the URL.
3. If `gh` is unavailable, present the issue content for the user to file manually.

Use this template for the issue body:

```markdown
## Problem

A clear description of the bug or issue, including:
- What happens (actual behavior)
- What should happen (expected behavior)
- How to reproduce (if applicable)

## Root Cause Analysis

Describe what was found during investigation:
- The code path involved
- Why the current code fails
- Any contributing factors

Do NOT include specific file paths, line numbers, or implementation details that couple to current code layout. Describe modules, behaviors, and contracts instead. The issue should remain useful even after major refactors.

## TDD Fix Plan

A numbered list of RED-GREEN cycles:

1. **RED**: Write a test that [describes expected behavior]
   **GREEN**: [Minimal change to make it pass]

2. **RED**: Write a test that [describes next behavior]
   **GREEN**: [Minimal change to make it pass]

**REFACTOR**: [Any cleanup needed after all tests pass]

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] All new tests pass
- [ ] Existing tests still pass
```

4. After creating the issue, print the issue URL and a one-line summary of the root cause.

## Exit Criteria
- A GitHub issue has been created with the complete triage report
- The issue URL has been shared with the user
- The issue uses durable language (behaviors and contracts, not file paths)

## Next Phase
→ Workflow complete. See the Workflow Composition section in POWER.md for natural next steps (e.g., `drive-tests` to implement the fix using the TDD plan).

## Triage Bug Diagnose

# Diagnose

## Entry Criteria
- A brief problem description has been captured
- The problem area is identified enough to begin investigation

## Steps
1. Use Kiro's `invokeSubAgent` with the `context-gatherer` agent to deeply investigate the codebase. For targeted investigation, use direct file exploration tools (`readCode`, `grepSearch`, `listDirectory`).
2. Find **where** the bug manifests — entry points, UI, API responses, error messages.
3. Trace **what** code path is involved — follow the flow from trigger to symptom.
4. Determine **why** it fails — identify the root cause, not just the symptom.
5. Identify **what** related code exists:
   - Similar patterns elsewhere in the codebase that work correctly
   - Existing tests (what is tested, what is missing)
   - Recent changes to affected files (use `git log` on relevant files)
   - Error handling in the code path
6. Distinguish between the symptom and the root cause — the fix should address the root cause.

## Exit Criteria
- The bug's manifestation point is identified
- The code path from trigger to symptom is traced
- The root cause is identified (not just the symptom)
- Related code and existing test coverage are noted
- Ready to determine the fix approach

## Next Phase
→ Load `triage-bug-fix-approach.md`

## Triage Bug Fix Approach

# Fix Approach

## Entry Criteria
- The root cause has been identified
- The code path and related code are understood

## Steps
1. Determine the minimal change needed to fix the root cause — not a workaround, not a rewrite, just the smallest correct fix.
2. Identify which modules and interfaces are affected by the fix.
3. List the behaviors that need to be verified via tests:
   - The broken behavior that should be fixed
   - Adjacent behaviors that must not regress
   - Edge cases related to the root cause
4. Classify the issue:
   - **Regression**: Something that used to work and broke (check git history)
   - **Missing feature**: Expected behavior that was never implemented
   - **Design flaw**: The code works as written but the design is wrong
5. Assess risk — does this fix touch a critical path? Are there downstream effects?

## Exit Criteria
- The minimal fix is identified
- Affected modules and interfaces are listed
- Behaviors needing test verification are enumerated
- The issue is classified (regression, missing feature, or design flaw)
- Ready to design the TDD fix plan

## Next Phase
→ Load `triage-bug-tdd-plan.md`

## Triage Bug Tdd Plan

# TDD Plan

## Entry Criteria
- The fix approach is determined
- Affected modules and behaviors are identified
- The issue classification is clear

## Steps
1. Create a concrete, ordered list of RED-GREEN cycles. Each cycle is one vertical slice (see POWER.md Shared Concepts on "vertical slices").
2. For each cycle:
   - **RED**: Describe a specific test that captures the broken or missing behavior. The test must fail before the fix.
   - **GREEN**: Describe the minimal code change to make that test pass.
3. Follow these rules:
   - Tests verify behavior through public interfaces, not implementation details
   - One test at a time, vertical slices (NOT all tests first, then all code)
   - Each test should survive internal refactors
   - Tests assert on observable outcomes (API responses, UI state, user-visible effects), not internal state
4. Include a final REFACTOR step if cleanup is needed after all tests pass.
5. Ensure durability — only suggest fixes that would survive radical codebase changes. Describe behaviors and contracts, not internal structure. A good plan reads like a spec; a bad one reads like a diff.

## Exit Criteria
- An ordered list of RED-GREEN cycles is complete
- Each cycle is a vertical slice with a clear test and minimal fix
- Tests target observable behavior, not implementation details
- A refactor step is included if needed
- The plan is durable — it describes behaviors, not file paths

## Next Phase
→ Load `triage-bug-create-issue.md`

## Triage Bug

# Triage Bug

Investigate a reported problem, find its root cause, and create a GitHub issue with a TDD fix plan. This is a mostly hands-off workflow — minimize questions to the user.

## When to Use

- The user reports a bug or unexpected behavior
- The user wants to file an issue with a fix plan
- The user mentions "triage" or wants to investigate a problem
- A bug needs root cause analysis before fixing

## Prerequisites

- A description of the problem (or the user can provide one when prompted)
- `gh` CLI installed and authenticated (for creating the GitHub issue)

## Shared Concepts

This workflow relies on "vertical slices" and "durable issues" as defined in the POWER.md Shared Concepts section. The TDD fix plan uses vertical slices (one RED-GREEN cycle per slice), and the filed issue describes behaviors rather than file paths so it survives refactors.

## Adaptation Notes

- **Codebase exploration**: Where the original workflow used a Claude Code sub-agent for exploration, use Kiro's `invokeSubAgent` with the `context-gatherer` agent, or use direct file exploration tools (`readCode`, `grepSearch`, `listDirectory`).
- **`gh` CLI**: This workflow uses `gh issue create` to file the issue. Requires the `gh` CLI installed and authenticated in the user's environment. If `gh` is unavailable, present the issue content for the user to file manually.

## Phases

### Phase 1 — Capture
Get a brief description of the issue from the user. If they have not provided one, ask ONE question: "What's the problem you're seeing?" Do not ask follow-up questions yet — start investigating immediately.
→ Load `triage-bug-capture.md`

### Phase 2 — Diagnose
Deeply investigate the codebase to find where the bug manifests, what code path is involved, why it fails (root cause, not symptom), and what related code exists.
→ Load `triage-bug-diagnose.md`

### Phase 3 — Fix Approach
Determine the minimal change needed to fix the root cause, which modules/interfaces are affected, what behaviors need verification via tests, and whether this is a regression, missing feature, or design flaw.
→ Load `triage-bug-fix-approach.md`

### Phase 4 — TDD Plan
Create a concrete, ordered list of RED-GREEN cycles. Each cycle is one vertical slice: RED describes a test capturing broken/missing behavior, GREEN describes the minimal code change to pass.
→ Load `triage-bug-tdd-plan.md`

### Phase 5 — Create Issue
Create a GitHub issue with the standard template (Problem, Root Cause Analysis, TDD Fix Plan, Acceptance Criteria). Do NOT ask the user to review before creating — just create it and share the URL.
→ Load `triage-bug-create-issue.md`

## Durability Rules

- Only suggest fixes that would survive radical codebase changes
- Describe behaviors and contracts, not internal structure
- Tests assert on observable outcomes (API responses, UI state, user-visible effects), not internal state
- A good suggestion reads like a spec; a bad one reads like a diff

## Write Living Docs Audit

# Audit

## Entry Criteria
- User wants to improve, create, or review project documentation
- The codeshop power is active and the write-living-docs workflow has been loaded

## Steps

1. Inventory existing documentation sources in the codebase:
   - README files (root and per-package)
   - `CONTEXT.md` and `CONTEXT-MAP.md` (domain glossary)
   - ADRs in `docs/adr/` (decision rationale)
   - Inline doc comments (JSDoc, docstrings, etc.)
   - Test descriptions and test file names (behavioral specifications)
   - Configuration files (deployment and environment documentation)
   - Type definitions and interfaces (API contracts)
   - Generated docs (API docs, changelogs, etc.)
   - Wiki pages, Notion docs, or other external documentation

2. For each source, classify it as:
   - **Authoritative** — this is the single source of truth for the knowledge it contains. Changes here are the canonical update.
   - **Derived** — this was generated from or summarizes an authoritative source. It may be stale.
   - **Stale** — this was once accurate but has drifted from its source. It may be actively misleading.
   - **Orphaned** — no clear authoritative source exists. The knowledge lives only here.

3. Note which documentation sources overlap — where the same concept is documented in multiple places. These are drift risks.

## Exit Criteria
- A complete inventory of documentation sources exists
- Each source is classified as authoritative, derived, stale, or orphaned
- Overlap and drift risks are identified

## Next Phase
→ Load `write-living-docs-classify.md`

## Write Living Docs Classify

# Classify

## Entry Criteria
- Documentation inventory is complete
- Each source is classified as authoritative, derived, stale, or orphaned

## Steps

1. For each documentation need (not each existing doc — think about what *should* be documented), apply Martraire's three principles:
   - **Long-period interest** — is this knowledge relevant for months or years, not just this sprint?
   - **Large audience** — do multiple people or teams need this knowledge?
   - **Valuable or critical** — would losing this knowledge cause real harm?

   Knowledge that fails all three tests should be explicitly marked as **"do not document"**. The default is don't — documentation has a maintenance cost.

2. Categorize each documentation item that passes the filter:
   - **Evergreen** — stable knowledge that changes rarely (project vision, core architecture, onboarding). Traditional docs are acceptable here.
   - **Living** — changes with the code and must be derived from an authoritative source (API docs from types, behavior docs from tests, domain glossary from CONTEXT.md). Manual maintenance will fail.
   - **Conversation** — best transferred through discussion, pairing, or code review. Writing it down produces low-value prose that nobody reads. Skip it.

3. For items marked "do not document," verify they match one of these criteria:
   - Can be recreated cheaply when needed
   - Volatile predictions that will be wrong soon
   - Rarely needed by anyone
   - Raw diagnostic output better served by tooling

## Exit Criteria
- Every documentation need has been evaluated against the three principles
- Items are categorized as Evergreen, Living, Conversation, or "do not document"
- The "do not document" items have explicit justification

## Next Phase
→ Load `write-living-docs-harvest.md`

## Write Living Docs Compose

# Compose

## Entry Criteria
- Authoritative sources have been identified for each documentation item
- Extracted knowledge is captured in working format
- Single source of truth is identified for each concept

## Steps

1. Assemble harvested knowledge into the appropriate documentation format, following these rules:

   - **One source of truth per concept** — use references, not copies. If the API contract lives in the type definitions, the README should link to them, not duplicate them.
   - **Annotate the rationale** — document the "why," not just the "how." The code already shows the mechanism; documentation should explain the reasoning.
   - **Filter by audience** — internal docs stay near the code (inline comments, CONTEXT.md, ADRs). External docs are embellished and published separately (README, API docs, guides).
   - **Version each published snapshot** — when publishing external documentation, tag it with the version it describes.

2. For Living documentation, set up the derivation pipeline:
   - Can this doc be generated from the source? (e.g., API docs from types)
   - If not fully generated, can it reference the source with a "last verified" date?
   - What is the reconciliation trigger? (e.g., "re-check when types change")

3. For Evergreen documentation, write or update the prose:
   - Keep it concise — if it takes more than a page, it probably needs splitting
   - Include "last reviewed" dates so staleness is visible
   - Link to authoritative sources for any claims that could drift

4. Apply the Living Documentation Checklist to each artifact:
   - [ ] **Collaborative** — can multiple stakeholders contribute?
   - [ ] **Insightful** — does it expose uncertainty and complexity, not just happy paths?
   - [ ] **Reliable** — is it derived from or reconciled with an authoritative source?
   - [ ] **Low-effort** — is it automated or derived, not manually maintained?

## Exit Criteria
- Documentation artifacts are assembled with one source of truth per concept
- Rationale is annotated alongside mechanism
- Audience filtering is applied (internal vs external)
- Living Documentation Checklist passes for each artifact

## Next Phase
→ Load `write-living-docs-reconcile.md`

## Write Living Docs Harvest

# Harvest

## Entry Criteria
- Documentation needs are classified as Evergreen, Living, or Conversation
- "Do not document" items are identified and justified

## Steps

1. For each **Living** documentation item, identify the authoritative source already in the codebase and extract documentation from it rather than writing new prose from scratch:
   - **Test names and descriptions** → behavioral specifications ("what does this system do?")
   - **Type signatures and interfaces** → API contracts ("what can I call and what do I get back?")
   - **`CONTEXT.md` terms** → domain glossary ("what do these words mean here?")
   - **ADRs** → decision rationale ("why was it built this way?")
   - **Configuration files** → deployment and environment documentation
   - **Code structure** (module boundaries, directory layout) → architecture documentation

2. For each **Evergreen** item, check whether an authoritative source exists:
   - If yes, derive the documentation from it
   - If no, this is one of the few cases where writing original prose is justified — but keep it minimal and link to code where possible

3. For each **Conversation** item, do not write documentation. Instead, note where the knowledge transfer should happen (code review, pairing sessions, onboarding conversations).

4. As you harvest, apply the single-source-of-truth rule: if the same knowledge exists in multiple places, pick one authoritative source and plan to make the others reference it.

## Exit Criteria
- Living documentation items have identified authoritative sources
- Extracted knowledge is captured in a working format (notes, drafts, or direct edits)
- No new prose has been written where an authoritative source already exists
- Single source of truth is identified for each concept

## Next Phase
→ Load `write-living-docs-compose.md`

## Write Living Docs Reconcile

# Reconcile

## Entry Criteria
- Documentation artifacts are assembled and pass the Living Documentation Checklist
- Sources of truth are identified for each concept

## Steps

1. For each documentation artifact, verify consistency with its authoritative source:
   - Has the source changed since the doc was last updated?
   - Does the doc accurately reflect the current state of the source?
   - Are there any claims in the doc that contradict the code, tests, or configuration?

2. For any drift found:
   - If the doc is **derived** and the source is authoritative → update the doc to match the source
   - If the doc is **orphaned** and no source exists → either promote it to authoritative (if the knowledge is valuable) or mark it as stale with a warning
   - If the source and doc disagree and it is unclear which is correct → flag for the user to resolve

3. For stale documentation:
   - Add a visible "stale" marker with a link to the authoritative source
   - Or delete it if the authoritative source is sufficient on its own
   - Do not silently leave stale docs in place — they are worse than no docs

4. Check for documentation anti-patterns:
   - **Information Graveyard** — docs written once and never updated. Add reconciliation triggers or delete.
   - **Human Dedication** — relying on one person to keep docs current. Automate or derive instead.
   - **Speculative Documentation** — documenting what might be needed rather than what is actually asked about. Delete speculative sections.
   - **Comprehensive Documentation** — attempting to document everything. Apply the "default is don't" principle.

5. Present a reconciliation summary to the user:
   - Docs updated to match sources
   - Docs marked as stale or deleted
   - Anti-patterns identified and addressed
   - Remaining drift risks and recommended reconciliation schedule

## Exit Criteria
- All derived documentation is consistent with its authoritative source
- Stale documentation is updated, marked, or deleted
- Documentation anti-patterns are identified and addressed
- The user has reviewed the reconciliation summary

## Next Phase
→ Workflow complete. Suggest natural next steps: load `challenge-domain-model` to ensure terminology is precise, or schedule a periodic reconciliation review.

## Write Living Docs

# Write Living Docs

Create and maintain documentation that stays reliable by deriving it from authoritative sources in the codebase rather than maintaining it separately. Grounded in Living Documentation principles (Cyrille Martraire) — the default is "don't document," and everything that is documented must be traceable to an authoritative source.

## When to Use

- The user wants to document a project or feature
- The user wants to audit or update existing documentation
- The user mentions "living docs," "documentation audit," or "what needs documenting"
- The user asks to write docs, update documentation, or review doc freshness

## Prerequisites

- A codebase with existing sources to harvest from (tests, types, config, CONTEXT.md, ADRs)
- Understanding of the target audience (internal team vs external users)

## Core Principle

Documentation is a liability, not an asset — unless it stays current. The fastest way to keep docs current is to derive them from sources that already change with the code: test names, type signatures, CONTEXT.md terms, ADRs, configuration files, and code structure.

## Phases

### Phase 1 — Audit
Inventory existing documentation sources. Identify which are authoritative (single source of truth) and which are derived or stale.
→ Load `write-living-docs-audit.md`

### Phase 2 — Classify
Apply Martraire's three principles to decide what deserves documentation. Categorize as Evergreen, Living, or Conversation. Mark "do not document" items explicitly.
→ Load `write-living-docs-classify.md`

### Phase 3 — Harvest
Extract documentation from authoritative sources already in the codebase rather than writing new prose from scratch.
→ Load `write-living-docs-harvest.md`

### Phase 4 — Compose
Assemble harvested knowledge into the appropriate documentation format. One source of truth per concept — use references, not copies.
→ Load `write-living-docs-compose.md`

### Phase 5 — Reconcile
Verify that all derived documentation is consistent with its authoritative source. Flag drift, update or mark stale.
→ Load `write-living-docs-reconcile.md`

---

## Documentation Anti-Patterns

### The Information Graveyard
Documentation written once and never updated. Symptoms: docs that reference deleted files, outdated API signatures, or deprecated features. The fix: derive docs from authoritative sources so they update when the code does, or delete them.

### Human Dedication
Relying on individual heroism to keep docs current. One person "owns" the docs and updates them manually after every change. When that person leaves or gets busy, the docs rot. The fix: automate derivation from code, tests, and config.

### Speculative Documentation
Documenting what might be needed rather than what is actually asked about. "Someone might need this someday" leads to pages nobody reads. The fix: apply the "default is don't" principle — only document what has been asked about or what meets the three-principle test.

### Comprehensive Documentation
Attempting to document everything rather than applying the "default is don't" principle. The result is a wall of text that nobody reads because the signal-to-noise ratio is too low. The fix: classify ruthlessly — most knowledge doesn't need written documentation.

---

## Living Documentation Checklist

Apply this checklist to each documentation artifact:

- [ ] **Collaborative** — Can multiple stakeholders contribute? Is it in a shared, editable format?
- [ ] **Insightful** — Does it expose uncertainty and complexity rather than hiding it? Does it explain the "why," not just the "how"?
- [ ] **Reliable** — Is it derived from or reconciled with an authoritative source? Can you trace each claim to its origin?
- [ ] **Low-effort** — Is it automated or derived, not manually maintained? Would it survive a month of neglect?

If a documentation artifact fails two or more of these checks, consider whether it should exist at all.

---

## Martraire's Three Principles

Use these to decide whether something deserves documentation:

1. **Long-period interest** — Knowledge that will be relevant for months or years, not days or weeks.
2. **Large audience** — Knowledge that many people need, not just one person.
3. **Valuable or critical** — Knowledge that is expensive to recreate or dangerous to get wrong.

Knowledge that fails all three tests should not be documented. Knowledge that passes at least one deserves consideration. Knowledge that passes all three is a documentation priority.

### Classification Categories

- **Evergreen** — Stable knowledge that changes rarely. Traditional documentation is acceptable (architecture overviews, onboarding guides).
- **Living** — Changes with the code. Must be derived from an authoritative source or reconciled regularly (API docs, configuration reference, behavioral specs).
- **Conversation** — Best transferred through discussion, not written docs. Pair programming, code review comments, design sessions. Don't try to capture everything — capture the decisions, not the discussion.
