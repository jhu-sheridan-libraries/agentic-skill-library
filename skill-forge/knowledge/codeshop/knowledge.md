---
name: codeshop
displayName: Codeshop 
description: A collection of 21 developer workflow skills covering planning, design, development, testing, writing, and knowledge management. Actionable, phase-driven workflows with shared vocabulary and natural chaining. Consolidates proven practices for TDD, architecture review, domain modeling, issue triage, and documentation into a single activatable 'skill router'.
keywords:
  - codeshop
  - planning
  - interface-design
  - test-driven-development
  - refactoring
  - domain-modeling
  - issue-triage
  - prd
  - vertical-slices
  - architecture
  - bug-triage
  - qa-session
  - skill-authoring
  - article-editing
  - living-documentation
  - code-review-craft
  - commit-messages
  - debugging-methodology
author: Steven J. Miklovic
version: 0.1.8
harnesses:
  - kiro
type: power
inclusion: auto
categories:
  - architecture
  - testing
  - documentation
ecosystem: []
depends: []
enhances: []
maturity: experimental
trust: official
audience: intermediate
model-assumptions: []
collections: [jhu, neon-caravan]
inherit-hooks: false
harness-config:
  kiro:
    format: power
    spec-hooks:
      - name: "Plan Stress Test"
        version: "1.0.0"
        description: "Detects the first spec task and stress-tests the plan before implementation begins"
        when:
          type: preTaskExecution
        then:
          type: askAgent
          prompt: |
            Before starting this task, assess whether it is the first task in the spec:

            1. Check the task description for references to "task 1" or "task 1.1" indicating this is the first task in the implementation plan.
            2. If the task is the first task:
               a. Read the stress-test-plan steering file from the codeshop power.
               b. Perform a brief stress-test of the spec's design.md, surfacing any gaps or assumptions before implementation begins.
            3. If the task is not the first task, proceed with the task normally.

            Either load the stress-test-plan workflow and confirm it is applied, or confirm the task is not the first task and proceed with implementation.

      - name: "Bugfix Triage Context"
        version: "1.0.0"
        description: "Detects bugfix spec tasks and loads the triage methodology"
        when:
          type: preTaskExecution
        then:
          type: askAgent
          prompt: |
            Before starting this task, assess whether it involves a bugfix context:

            1. Check the task description and spec context for bugfix-related keywords: bugfix, bug, fix, regression, defect, broken.
            2. If the task matches:
               a. Read the triage-bug steering file from the codeshop power.
               b. Apply the triage methodology (diagnose, find root cause, plan TDD fix) to the task.
            3. If the task does not match, proceed with the task normally.

            Either load the triage-bug workflow and confirm it is applied, or confirm the task does not involve a bugfix context and proceed with implementation.

      - name: "Domain Concept Validation"
        version: "1.0.0"
        description: "Detects tasks introducing new domain concepts and validates them against the existing model"
        when:
          type: preTaskExecution
        then:
          type: askAgent
          prompt: |
            Before starting this task, assess whether it introduces new domain concepts:

            1. Check the task description for domain-related keywords: new type, new interface, new entity, new aggregate, bounded context, domain event, value object, new module, new model.
            2. If the task matches:
               a. Read the challenge-domain-model steering file from the codeshop power.
               b. Validate that the proposed concepts align with the project's existing domain model in CONTEXT.md and UBIQUITOUS_LANGUAGE.md.
            3. If the task does not match, proceed with the task normally.

            Either load the challenge-domain-model workflow and confirm it is applied, or confirm the task does not introduce new domain concepts and proceed with implementation.

      - name: "TDD Task Detection"
        version: "1.0.0"
        description: "Detects test-related spec tasks and loads the TDD workflow"
        when:
          type: preTaskExecution
        then:
          type: askAgent
          prompt: |
            Before starting this task, assess whether it involves writing or modifying tests:

            1. Check the task description for test-related keywords: test, spec, TDD, red-green, assertion, coverage, unit test, integration test, property test.
            2. If the task matches:
               a. Read the drive-tests steering file from the codeshop power.
               b. Apply the TDD red-green-refactor methodology to the task.
            3. If the task does not match, proceed with the task normally.

            Either load the drive-tests workflow and confirm it is applied, or confirm the task does not involve tests and proceed with implementation.

      - name: "Post-Task Code Review"
        version: "1.0.0"
        description: "Performs a lightweight code review after each spec task completes"
        when:
          type: postTaskExecution
        then:
          type: askAgent
          prompt: |
            This task has just been completed. Perform a lightweight code review of the changes made during this task:

            1. Read the review-changes steering file from the codeshop power.
            2. Review the changes made during this task using the review-changes taxonomy.
            3. Classify findings as must-address, should-address, or nit.
            4. Report only must-address and should-address findings inline.

            Load the review-changes workflow and confirm the review is complete.

      - name: "Post-Task Commit Guidance"
        version: "1.0.0"
        description: "Suggests a well-crafted commit message after each spec task completes"
        when:
          type: postTaskExecution
        then:
          type: askAgent
          prompt: |
            This task has just been completed. Draft a commit message for the changes made during this task:

            1. Read the craft-commits steering file from the codeshop power.
            2. Draft a conventional commit message that captures the rationale for the changes.
            3. Include the spec task identifier in the commit message body for traceability.

            Load the craft-commits workflow and present the suggested commit message.
---

## Onboarding

Codeshop is a collection of 21 developer workflow skills covering planning, design, development, testing, writing, and knowledge management. Each skill is either a multi-phase Workflow Skill (with step-by-step phases you progress through) or a flat Knowledge Skill (a behavioral mode or reference you load once). Together they give you structured, opinionated workflows for tasks like TDD, architecture review, domain modeling, issue triage, PRD drafting, and documentation.

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
| integrate (wire-systems) | Workflow | `integrate.md` | "integrate with", "wire up", "connect to", "API integration" | Wire an external system through a contract-first adapter with hardened error handling and end-to-end verification. |
| migrate (data-migration) | Workflow | `migrate.md` | "migrate data", "schema migration", "data migration" | Reliable data migration with checksum verification — inventory, plan, dry-run, execute, verify. |

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

### Spec Mode Integration

The following hooks fire automatically during Kiro spec task execution. They do not require manual invocation — the Kiro spec engine triggers them via `preTaskExecution` and `postTaskExecution` events, and each hook's prompt determines whether to activate its workflow based on the task context.

| Hook Name | Kiro Event | Workflow Loaded | Detection Criteria |
|---|---|---|---|
| Plan Stress Test | preTaskExecution | `stress-test-plan.md` | First task in the spec (task 1 or task 1.1) |
| Bugfix Triage Context | preTaskExecution | `triage-bug.md` | Bugfix keywords: bugfix, bug, fix, regression, defect, broken |
| Domain Concept Validation | preTaskExecution | `challenge-domain-model.md` | Domain keywords: new type, new interface, new entity, new aggregate, bounded context, domain event, value object, new module, new model |
| TDD Task Detection | preTaskExecution | `drive-tests.md` | Test keywords: test, spec, TDD, red-green, assertion, coverage, unit test, integration test, property test |
| Post-Task Code Review | postTaskExecution | `review-changes.md` | Unconditional — fires after every task |
| Post-Task Commit Guidance | postTaskExecution | `craft-commits.md` | Unconditional — fires after every task |

**Precedence:** Pre-task hooks fire in array order — Plan Stress Test first, then Bugfix Triage Context, Domain Concept Validation, and TDD Task Detection. Each hook independently evaluates its detection criteria and exits early if the task does not match. Post-task hooks (Code Review, Commit Guidance) fire after all pre-task hooks and task execution complete.

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

### Contract-First Integration

Define the interface contract — request/response shapes, error codes, authentication mechanism, rate limits — before writing implementation code. The contract is the specification; the adapter is the implementation. This prevents "integration by discovery" where you learn the API's behavior through trial and error in production.

When integrating with an external system, the adapter should be an anti-corruption layer: our codebase talks to our adapter interface (which uses our domain language), and the adapter translates to the external API's shape. This keeps the external system's vocabulary and quirks from leaking into our domain model.

Ask: "Could I swap the external system for a different provider without changing any caller code?" If yes, the adapter is well-isolated. If callers need to know about the external system's error codes, pagination format, or authentication mechanism, the abstraction is leaking.

Referenced by: `integrate`, `design-interface`.

### Migration Checksum Discipline

Every migration step has a verification checkpoint. Checksums are not just row counts — they include aggregate hashes of key columns, referential integrity snapshots, and application-level smoke tests. Verification happens at three points: before (baseline), during (per-step checkpoints), and after (full reconciliation).

A migration without checksums is a hope, not a plan. Row counts alone don't catch data corruption — 1000 rows in source and 1000 rows in destination means nothing if half the values are wrong. Aggregate checksums (SUM of IDs, COUNT DISTINCT of unique fields) catch corruption that row counts miss. Referential integrity checks catch orphaned records. Application-level smoke tests catch transformation errors that are invisible at the database level.

Rollback criteria must be defined per-step, not just for the overall migration. Each step should have a clear condition that triggers rollback and a documented procedure for reversing that specific step.

Referenced by: `migrate`.

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

### Spec-Driven Development Chain

`stress-test-plan` → `drive-tests` → `review-changes` → `craft-commits`

Stress-test-plan fires before the first spec task to validate the design and surface gaps before implementation begins, drive-tests activates for test-related tasks using TDD red-green-refactor methodology, review-changes performs a lightweight code review after each task completes, and craft-commits suggests a conventional commit message capturing the rationale for the changes.

### Spec Bugfix Chain

`triage-bug` → `journal-debug` → `drive-tests`

Triage-bug loads the debugging methodology for bugfix spec tasks and narrows the search space, journal-debug provides systematic isolation of the root cause through articulation and binary search, and drive-tests implements the fix using TDD with a regression test that prevents recurrence.

**Note:** The Spec-Driven Development Chain and Spec Bugfix Chain are activated automatically by spec-hooks during spec task execution. Unlike the manually-invoked chains above, these chains are triggered by `preTaskExecution` and `postTaskExecution` hook events — the developer does not need to invoke them explicitly.

### Integration Chain

`design-interface` → `integrate` → `drive-tests`

Interface design defines the module boundary, integrate wires the external system through a contract-first adapter, and TDD verifies the integration with tests at every layer.

### Migration Chain

`migrate` → `drive-tests` → `review-changes`

Migration executes with checksum verification at every step, TDD adds regression tests proving the migrated data works correctly in the application, and review validates the migration code and verification approach.

### Full Delivery Chain

`compose-issues` → `integrate` → `drive-tests` → `review-changes` → `craft-commits`

Issues define integration work as vertical slices, integrate wires each slice's external dependency, TDD proves correctness, review validates quality, and commits capture rationale.

---

When a workflow completes, reference this section to suggest the natural next workflow in the chain. If the completed workflow appears as a step in one of these chains, offer to continue with the next workflow in the sequence.

## Companion Powers

These external powers complement codeshop but are NOT bundled — they are activated separately via the Powers system. Suggest them when the user's context would benefit from their specialized guidance.

- **adr** — Full ADR lifecycle management: create, update, review, health check, and cross-reference ADRs. Suggest activating when `refactor-architecture` or `challenge-domain-model` surfaces architectural decisions worth recording.

- **type-guardian** — TypeScript type discipline: strict mode enforcement, discriminated unions, utility types, and type-safe patterns. Suggest activating for TypeScript codebases when using `drive-tests` or `review-changes`.

- **karpathy-mode** — Surgical changes and simplicity-first behavioral guidelines for development workflows. Suggest activating when the user wants to enforce coding discipline: small diffs, minimal abstractions, and deliberate simplicity.

- **release-manager** — Release lifecycle management: assess changes, draft changelogs and release notes, cut tagged releases, and announce. Tool-agnostic methodology with detection logic for whatever release tooling the project uses. Suggest activating when `craft-commits` has been used consistently and the project is ready to cut a release.

- **secure-by-default** — Application security discipline: STRIDE threat modeling, auth/authz flow review, and secure coding patterns (OWASP, input validation, secret hygiene). Suggest activating when `design-interface` or `review-changes` involves authentication, authorization, or sensitive data handling.


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
