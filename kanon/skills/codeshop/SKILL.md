---
name: codeshop
description: "A collection of 25 developer workflow skills covering planning, design, development, testing, writing, and knowledge management. Actionable, phase-driven workflows with shared vocabulary and natural chaining."
---

## Onboarding

Codeshop is a collection of 25 developer workflow skills covering planning, design, development, testing, writing, and knowledge management. Each skill is either a multi-phase Workflow Skill (with step-by-step phases you progress through) or a flat Knowledge Skill (a behavioral mode or reference you load once). Together they give you structured, opinionated workflows for tasks like TDD, architecture review, domain modeling, issue triage, PRD drafting, and documentation.

### How it works

This skill is a router. The tables below map your request to a reference file under `references/`. When you match a request, name the skill explicitly (e.g. "I'll load the `integrate` workflow"), then read `references/<name>.md`. Workflow skills have multiple phase files under `references/` — load each phase in sequence as you progress. Knowledge skills are a single reference file loaded once.

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

Within reference files, mentions of a "steering file" refer to the corresponding `references/<name>.md` in this skill.

Match the user's request to the right reference file. Each skill is either a **Workflow** (multi-phase, with `workflows/` phase files) or **Knowledge** (flat steering file, loaded once). Load the reference file `references/<name>.md` using the filename shown below.

**Routing rule:** When you match a user's intent to a skill, always **name the skill explicitly** in your response (e.g., "I'll load the `integrate` workflow" or "Activating `laconic-output` mode"). This makes the routing decision visible and traceable. Use the exact steering file name from the table below (without the `.md` extension) as the canonical skill identifier.

### Planning and Design

| Skill | Type | Steering File | Triggers | Description |
|---|---|---|---|---|
| diverge-options (nWave-inspired) | Knowledge | `diverge-options.md` | "what are my options", "explore approaches", "diverge", "brainstorm solutions", "compare alternatives", "different ways to" | Generate 3-5 radically different approaches to a problem before converging. Structured brainstorming that prevents premature commitment to the first idea. |
| tune-rigor (nWave-inspired) | Knowledge | `tune-rigor.md` | "how much rigor", "right level of testing", "over-engineering", "tune rigor", "lean vs thorough", "how much process", "do I need acceptance tests" | Choose the right rigor profile (lean/standard/thorough/exhaustive) for a task by scoring criticality, blast radius, reversibility, and audience. Avoids over-engineering trivial work and under-testing critical work. |
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
| integrate (wire-systems) | Workflow | `integrate.md` | "integrate with", "wire up", "connect to", "API integration", "external service", "third-party API", "build an adapter" | Wire an external system through a contract-first adapter with hardened error handling and end-to-end verification. |
| migrate (data-migration) | Workflow | `migrate.md` | "migrate data", "schema migration", "data migration", "move data", "database migration" | Reliable data migration with checksum verification — inventory, plan, dry-run, execute, verify. |
| trim-tests (nWave-inspired) | Workflow | `trim-tests.md` | "trim tests", "optimize tests", "reduce test count", "test bloat", "too many tests", "test suite slow", "clean up tests" | Minimize test count while preserving coverage — detect duplication, inflation, and anti-patterns, then consolidate with explicit approval. |
| analyze-hotspots (nWave-inspired) | Knowledge | `analyze-hotspots.md` | "hotspots", "churn analysis", "most changed files", "code crime scene", "what changes most", "high-churn files", "where should I focus" | Git change-frequency analysis to identify high-churn files. Use as a pre-filter to scope refactoring or a post-filter to prioritize findings. |

### Writing and Knowledge

| Skill | Type | Steering File | Triggers | Description |
|---|---|---|---|---|
| edit-article (edit-article) | Knowledge | `edit-article.md` | "edit article", "proofread", "improve writing" | Edit and improve articles by restructuring sections, improving clarity, and tightening prose. |
| define-glossary (ubiquitous-language) | Knowledge | `define-glossary.md` | "define glossary", "ubiquitous language", "domain terms" | Extract a DDD-style ubiquitous language glossary from the current conversation, flagging ambiguities and proposing canonical terms. |
| write-living-docs (new, original to codeshop) | Workflow | `write-living-docs.md` | "living docs", "documentation audit", "harvest docs" | Derive reliable, low-effort documentation from authoritative sources in the codebase using Living Documentation principles. |
| craft-commits (commit-craft catalog) | Knowledge | `craft-commits.md` | "commit message", "craft commit", "conventional commit" | Write commit messages that tell the story of why, not just what — conventional commit format with motivation over mechanics. |
| map-context (zoom-out) | Knowledge | `map-context.md` | "zoom out", "map context", "show dependencies" | Zoom out to a higher level of abstraction and map all relevant modules and callers for an unfamiliar area of code. |
| laconic-output (caveman) | Knowledge | `laconic-output.md` | "be brief", "laconic mode", "terse output", "spartan mode" | Spartan communication mode — every word earns its place or gets cut. Grammar stays intact, sentences stripped to their load-bearing minimum. No warmth, no hedging, no filler. |
| list-skills (new) | Knowledge | `list-skills.md` | "list skills", "what can codeshop do", "show available workflows", "show the menu" | Present the complete codeshop skill index formatted by category with trigger phrases — a quick-reference card for all 24 workflows. |
| author-knowledge (write-a-skill) | Workflow | `author-knowledge.md` | "write a skill", "author knowledge", "create artifact" | Author canonical knowledge artifacts with proper structure, frontmatter, and optional workflows — Kanon handles compilation to any harness. |

### Automatic Phase Workflows (Manual in Claude Code)

**Automatic phase workflows (manual in Claude Code).** In Kiro these fire as spec hooks; in Claude Code, invoke them yourself at the matching moment. Before starting a plan's first task, consider `stress-test-plan`. For bugfix work, `triage-bug`. When introducing new domain types, `challenge-domain-model`. For test tasks, `drive-tests`. After finishing a task, `review-changes` then `craft-commits`.

| Reference | Reference File | When to Use |
|---|---|---|
| Plan Stress Test | `references/stress-test-plan.md` | Before starting a plan's first task |
| Bugfix Triage Context | `references/triage-bug.md` | When the task involves a bugfix: bug, fix, regression, defect, broken behavior |
| Domain Concept Validation | `references/challenge-domain-model.md` | When the task introduces new domain concepts: new type, new interface, new entity, new aggregate, bounded context, domain event, value object, new module, new model |
| TDD Task Detection | `references/drive-tests.md` | When the task involves writing or modifying tests: test, spec, TDD, red-green, assertion, coverage, unit test, integration test, property test |
| Post-Task Code Review | `references/review-changes.md` | After finishing any task |
| Post-Task Commit Guidance | `references/craft-commits.md` | After finishing any task, to draft the commit message |

**Suggested order:** When more than one applies to the same task, apply them in this order before starting: `stress-test-plan`, then `triage-bug`, `challenge-domain-model`, `drive-tests`. After finishing the task, apply `review-changes`, then `craft-commits`.

## Shared Concepts

These cross-cutting concepts are referenced by multiple skills. Steering files reference this section rather than redefining these terms, keeping vocabulary consistent across all codeshop workflows.

### Deep Modules

A deep module has a small, simple interface that hides significant complexity behind it. The ratio of functionality to interface surface area is high — callers get a lot of value without needing to understand the internals.

**Enforcement rule:** When designing interfaces, ALWAYS prefer fewer public methods with richer behavior over many fine-grained methods. Collapse options into configuration rather than exposing them as separate interface surface. If a proposed interface has more than 5 public methods or requires callers to understand internal state, it is too shallow — push complexity behind fewer entry points.

When designing or refactoring, prefer deep modules over shallow ones. A shallow module has an interface nearly as complex as its implementation, forcing callers to understand the internals anyway. Deep modules reduce cognitive load and make systems easier to change because the complexity is concentrated behind a stable boundary.

Ask: "Could a caller use this module knowing only its signature and a one-sentence description?" If yes, it's deep. If the caller needs to understand internal state, ordering constraints, or implementation details, it's shallow.

Referenced by: `drive-tests`, `refactor-architecture`, `draft-prd`, `design-interface`.

### Vertical Slices / Tracer Bullets

A vertical slice (or tracer bullet) is a thin end-to-end path through all layers of the system. Instead of building one complete layer at a time (all models, then all services, then all UI), you build a narrow slice that touches every layer — from the user-facing boundary down to persistence (or whatever the system's outermost boundaries are).

**Enforcement rule:** When breaking work into issues or TDD iterations, ALWAYS slice vertically. Each issue or RED-GREEN cycle must touch all layers required for one feature. NEVER organize by layer (all DB first, then all API, then all UI). This is a hard constraint, not a preference.

- ✓ "User can edit display name" (touches DB + API + UI for one feature)
- ✗ "Create database schema for all profile fields" (horizontal layer)
- ✓ RED: test that display name updates → GREEN: implement across all layers
- ✗ RED: test1, test2, test3, test4 → GREEN: impl1, impl2, impl3, impl4

Each slice delivers a working feature, however minimal. This approach:

- Proves the integration works early, before you've invested in building out any single layer
- Gives you a deployable increment at every step
- Surfaces architectural friction immediately rather than at integration time
- Makes progress visible and testable

Referenced by: `drive-tests`, `compose-issues`, `triage-bug`.

### Domain Language Discipline

Every project has a vocabulary — the terms that appear in its domain model, its `CONTEXT.md`, its ubiquitous language glossary. Domain language discipline means using those terms consistently in all artifacts: code identifiers, comments, commit messages, issue titles, documentation, and conversation.

When you encounter a term in the codebase, use it exactly as defined. Don't introduce synonyms ("user" vs "account" vs "member" for the same concept). Don't abbreviate canonical terms. If a term feels wrong, challenge it through the `challenge-domain-model` workflow rather than silently introducing an alternative.

This discipline compounds: consistent language makes code searchable, issues traceable, and conversations unambiguous. Inconsistent language creates hidden translation layers that slow everyone down.

Referenced by: `challenge-domain-model`, `refactor-architecture`, `run-qa-session`.

### Durable Issues

A durable issue is a GitHub issue that survives refactors. It describes a behavior or outcome, not a file path or implementation detail. Durable issues remain valid even when the codebase is restructured, files are renamed, or modules are extracted.

**Enforcement rule:** When filing issues, NEVER include file paths (`src/...`) or line numbers (`line 42`). Even if the user provides them, translate to behavioral language. This is a hard constraint.

**Durable:** "Users can submit the login form twice due to missing debounce on the submit handler"
**Fragile:** "Fix `handleSubmit()` in `src/components/LoginForm.tsx` line 42 — missing debounce"

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

Stress-test-plan applies before the first task of a plan to validate the design and surface gaps before implementation begins, drive-tests activates for test-related tasks using TDD red-green-refactor methodology, review-changes performs a lightweight code review after each task completes, and craft-commits suggests a conventional commit message capturing the rationale for the changes.

### Spec Bugfix Chain

`triage-bug` → `journal-debug` → `drive-tests`

Triage-bug loads the debugging methodology for bugfix tasks and narrows the search space, journal-debug provides systematic isolation of the root cause through articulation and binary search, and drive-tests implements the fix using TDD with a regression test that prevents recurrence.

**Note:** The Spec-Driven Development Chain and Spec Bugfix Chain correspond to the Automatic Phase Workflows described above. Unlike the manually-invoked chains elsewhere in this document, these chains map to moments you should invoke yourself — before the first task, and after each task — rather than something the harness triggers for you.

### Exploration Chain

`diverge-options` → `stress-test-plan` → `draft-prd` → `compose-issues`

Diverge generates 3-5 radically different approaches before committing to one, stress-test-plan grills the chosen approach to expose gaps, the PRD formalizes the refined plan, and issues break it into vertical slices.

### Test Hygiene Chain

`drive-tests` → `trim-tests` → `analyze-hotspots`

TDD implements features with tests, trim-tests removes accumulated bloat (duplicates, inflation, stale nets) after the feature lands, and hotspot analysis identifies which high-churn files need the most attention next.

### Hotspot-Driven Refactoring Chain

`analyze-hotspots` → `refactor-architecture` → `plan-refactor`

Hotspot analysis identifies the most-changed files (likely pain points), architecture review evaluates whether those hotspots are shallow modules worth deepening, and the refactor plan details the approach with scoped commits.

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

### Next-Workflow Lookup

When a workflow completes and the user asks what to do next, **name the specific next workflow by its reference file name (`references/<name>.md`)**. Use this table:

| Completed Workflow | → Next Workflow | Chain |
|---|---|---|
| `stress-test-plan` | → `draft-prd` | Planning |
| `draft-prd` | → `compose-issues` | Planning |
| `compose-issues` | → `drive-tests` | Delivery |
| `drive-tests` | → `review-changes` | Commit |
| `review-changes` | → `craft-commits` | Commit |
| `triage-bug` | → `drive-tests` | Bug-Fix |
| `journal-debug` | → `drive-tests` | Debugging |
| `refactor-architecture` | → `plan-refactor` | Architecture |
| `plan-refactor` | → `compose-issues` | Architecture |
| `challenge-domain-model` | → `define-glossary` | Domain |
| `define-glossary` | → `refactor-architecture` | Domain |
| `design-interface` | → `integrate` | Integration |
| `integrate` | → `drive-tests` | Integration |
| `migrate` | → `drive-tests` | Migration |
| `diverge-options` | → `stress-test-plan` | Exploration |
| `trim-tests` | → `analyze-hotspots` | Test Hygiene |
| `analyze-hotspots` | → `refactor-architecture` | Hotspot |

**Rule:** When answering "what's next?" after a workflow completes, always state the next workflow name from this table explicitly (e.g., "The natural next step is **drive-tests** — the Bug-Fix Chain continues with TDD to implement the fix"). If the completed workflow appears in multiple chains, pick the chain that best matches the user's context and name the next step.

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

If the agent still selects the wrong workflow, explicitly name the skill: "Load the `review-changes` workflow" or "Use the `triage-bug` reference file."

## License, Privacy & Support

---
**License:** MIT (SPDX: `MIT`)
**Privacy Policy:** This power is local workflow guidance. It collects no telemetry and transmits no data. Some workflows invoke local tools only when you direct them — `git`, your test runner, and the `gh` CLI (which talks to GitHub to file issues you ask it to create). Source and statement: https://github.com/thinkingsage/context-bazaar
**Support:** https://github.com/thinkingsage/context-bazaar/issues
**Author:** Steven J. Miklovic
**MCP servers:** None — this is a knowledge-only power.

## Reference Pointers

Load these only when the workflow calls for them (progressive disclosure):

- `references/analyze-hotspots.md` — Analyze Hotspots
- `references/author-knowledge-draft.md` — Author Knowledge Draft
- `references/author-knowledge-gather.md` — Author Knowledge Gather
- `references/author-knowledge-review.md` — Author Knowledge Review
- `references/author-knowledge.md` — Author Knowledge
- `references/challenge-domain-model-session.md` — Challenge Domain Model Session
- `references/challenge-domain-model-setup.md` — Challenge Domain Model Setup
- `references/challenge-domain-model-update.md` — Challenge Domain Model Update
- `references/challenge-domain-model.md` — Challenge Domain Model
- `references/compose-issues-create-issues.md` — Compose Issues Create Issues
- `references/compose-issues-draft-slices.md` — Compose Issues Draft Slices
- `references/compose-issues-explore.md` — Compose Issues Explore
- `references/compose-issues-gather-context.md` — Compose Issues Gather Context
- `references/compose-issues-quiz-user.md` — Compose Issues Quiz User
- `references/compose-issues.md` — Compose Issues
- `references/craft-commits.md` — Craft Commits
- `references/define-glossary.md` — Define Glossary
- `references/design-interface-compare.md` — Design Interface Compare
- `references/design-interface-generate.md` — Design Interface Generate
- `references/design-interface-present.md` — Design Interface Present
- `references/design-interface-requirements.md` — Design Interface Requirements
- `references/design-interface-synthesize.md` — Design Interface Synthesize
- `references/design-interface.md` — Design Interface
- `references/diverge-options.md` — Diverge Options
- `references/draft-prd-explore.md` — Draft Prd Explore
- `references/draft-prd-sketch-modules.md` — Draft Prd Sketch Modules
- `references/draft-prd-write-prd.md` — Draft Prd Write Prd
- `references/draft-prd.md` — Draft Prd
- `references/drive-tests-incremental-loop.md` — Drive Tests Incremental Loop
- `references/drive-tests-planning.md` — Drive Tests Planning
- `references/drive-tests-refactor.md` — Drive Tests Refactor
- `references/drive-tests-tracer-bullet.md` — Drive Tests Tracer Bullet
- `references/drive-tests.md` — Drive Tests
- `references/edit-article.md` — Edit Article
- `references/integrate-contract.md` — Integrate Contract
- `references/integrate-discover.md` — Integrate Discover
- `references/integrate-harden.md` — Integrate Harden
- `references/integrate-verify.md` — Integrate Verify
- `references/integrate-wire.md` — Integrate Wire
- `references/integrate.md` — Integrate
- `references/journal-debug-articulate.md` — Journal Debug Articulate
- `references/journal-debug-fix-and-verify.md` — Journal Debug Fix And Verify
- `references/journal-debug-isolate.md` — Journal Debug Isolate
- `references/journal-debug.md` — Journal Debug
- `references/laconic-output.md` — Laconic Output
- `references/list-skills.md` — List Skills
- `references/map-context.md` — Map Context
- `references/migrate-dry-run.md` — Migrate Dry Run
- `references/migrate-execute.md` — Migrate Execute
- `references/migrate-inventory.md` — Migrate Inventory
- `references/migrate-plan.md` — Migrate Plan
- `references/migrate-verify.md` — Migrate Verify
- `references/migrate.md` — Migrate
- `references/plan-refactor-capture.md` — Plan Refactor Capture
- `references/plan-refactor-commit-plan.md` — Plan Refactor Commit Plan
- `references/plan-refactor-create-issue.md` — Plan Refactor Create Issue
- `references/plan-refactor-explore.md` — Plan Refactor Explore
- `references/plan-refactor-interview.md` — Plan Refactor Interview
- `references/plan-refactor-scope.md` — Plan Refactor Scope
- `references/plan-refactor-test-coverage.md` — Plan Refactor Test Coverage
- `references/plan-refactor.md` — Plan Refactor
- `references/refactor-architecture-explore.md` — Refactor Architecture Explore
- `references/refactor-architecture-grilling-loop.md` — Refactor Architecture Grilling Loop
- `references/refactor-architecture-present.md` — Refactor Architecture Present
- `references/refactor-architecture.md` — Refactor Architecture
- `references/register-outcomes.md` — Register Outcomes
- `references/review-changes-comment.md` — Review Changes Comment
- `references/review-changes-decide.md` — Review Changes Decide
- `references/review-changes-orient.md` — Review Changes Orient
- `references/review-changes-read.md` — Review Changes Read
- `references/review-changes.md` — Review Changes
- `references/run-qa-session-continue.md` — Run Qa Session Continue
- `references/run-qa-session-explore.md` — Run Qa Session Explore
- `references/run-qa-session-file-issue.md` — Run Qa Session File Issue
- `references/run-qa-session-listen.md` — Run Qa Session Listen
- `references/run-qa-session-scope.md` — Run Qa Session Scope
- `references/run-qa-session.md` — Run Qa Session
- `references/stress-test-plan.md` — Stress Test Plan
- `references/triage-bug-capture.md` — Triage Bug Capture
- `references/triage-bug-create-issue.md` — Triage Bug Create Issue
- `references/triage-bug-diagnose.md` — Triage Bug Diagnose
- `references/triage-bug-fix-approach.md` — Triage Bug Fix Approach
- `references/triage-bug-tdd-plan.md` — Triage Bug Tdd Plan
- `references/triage-bug.md` — Triage Bug
- `references/trim-tests-apply.md` — Trim Tests Apply
- `references/trim-tests-detect.md` — Trim Tests Detect
- `references/trim-tests-inventory.md` — Trim Tests Inventory
- `references/trim-tests-plan.md` — Trim Tests Plan
- `references/trim-tests.md` — Trim Tests
- `references/tune-rigor.md` — Tune Rigor
- `references/write-living-docs-audit.md` — Write Living Docs Audit
- `references/write-living-docs-classify.md` — Write Living Docs Classify
- `references/write-living-docs-compose.md` — Write Living Docs Compose
- `references/write-living-docs-harvest.md` — Write Living Docs Harvest
- `references/write-living-docs-reconcile.md` — Write Living Docs Reconcile
- `references/write-living-docs.md` — Write Living Docs
