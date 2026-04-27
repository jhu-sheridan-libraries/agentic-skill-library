# Requirements Document

## Introduction

The codeshop power consolidates ~20 agent skills (originally authored for Claude Code) into a single Kiro Knowledge Base Power. The skills span planning, development, writing, and knowledge workflows. The power's core value proposition is transforming loosely-structured skill instructions into actionable, phase-driven Kiro workflows — not merely porting documentation. Ten of the fifteen included skills are classified as Workflow_Skills with explicit ordered phases, entry/exit criteria, and concrete deliverables. The remaining five are Knowledge_Skills providing behavioral modes or reference guidance. The power packages them as a `POWER.md` index with per-skill `steering/*.md` files and `workflows/` phase files, adapting Claude Code-specific concepts (sub-agents, `gh` CLI, SKILL.md format) to Kiro-native equivalents (sub-agents via `invokeSubAgent`, steering files, hooks). Skills that are inherently Claude Code-specific or environment-specific are excluded.

## Glossary

- **Power**: A Kiro Power — a package of documentation (POWER.md), optional steering files, and optional MCP configuration that extends an AI coding assistant's capabilities.
- **Knowledge_Base_Power**: A Power with no `mcp.json` — pure documentation and workflow guidance.
- **Steering_File**: A markdown file in the `steering/` directory of a Power, loaded on-demand by the agent when a specific workflow is invoked.
- **POWER_MD**: The required root document of a Power containing YAML frontmatter (name, displayName, description, keywords, author) and markdown body with overview, skill index, and shared concepts.
- **Skill**: An original Claude Code agent skill consisting of a `SKILL.md` file (YAML frontmatter + markdown body) and optional supplementary markdown files.
- **Supplementary_File**: An additional markdown file bundled with a Skill that provides reference material, examples, or format specifications (e.g., `tdd/tests.md`, `domain-model/CONTEXT-FORMAT.md`).
- **Cross_Reference**: A link from one Skill to a file owned by another Skill (e.g., `improve-codebase-architecture` referencing `domain-model/CONTEXT-FORMAT.md`).
- **Skill_Router**: The section of POWER_MD that lists all available skills with descriptions and maps each to its steering file, enabling the agent to select the correct workflow.
- **Adaptation_Note**: An inline annotation in a steering file that flags a Claude Code-specific concept and describes the Kiro-native equivalent.
- **Frontmatter**: YAML metadata block at the top of a markdown file, delimited by `---`.
- **Verb_Noun_Name**: The recomposed steering file name following a verb-noun(s) semantic pattern (e.g., `stress-test-plan`, `define-glossary`) that replaces the original skill directory name to clearly communicate the action each workflow performs.
- **Workflow_Skill**: A skill that has explicit ordered phases with discrete steps, entry/exit criteria, and concrete deliverables. Transformed into a steering file plus `workflows/` phase files in the Kiro power format.
- **Knowledge_Skill**: A skill that provides behavioral modes, reference guidance, or single-instruction directives without ordered phases. Transformed into a flat steering file only.
- **Phase_File**: A markdown file in the `workflows/` directory of a knowledge artifact that defines one discrete phase of a multi-step workflow (e.g., `planning.md`, `tracer-bullet.md`, `refactor.md`).

## Requirements

### Requirement 1: Power Structure

**User Story:** As a developer, I want the codeshop power to follow the Kiro Knowledge Base Power structure, so that it installs and activates correctly in Kiro.

#### Acceptance Criteria

1. THE Power SHALL contain a `POWER.md` file with valid YAML frontmatter including name, displayName, description, keywords, and author fields.
2. THE Power SHALL contain a `steering/` directory with one steering file per included skill.
3. THE Power SHALL contain a `workflows/` directory with phase files for each Workflow_Skill.
4. THE Power SHALL NOT contain an `mcp.json` file, since all skills are pure documentation and workflows.
5. THE POWER_MD frontmatter `name` field SHALL use kebab-case format matching `codeshop`.
6. THE POWER_MD frontmatter `keywords` field SHALL include terms covering all skill categories: planning, design, development, testing, writing, knowledge, refactoring, triage, and architecture.

### Requirement 2: Skill Curation and Inclusion

**User Story:** As a developer, I want only platform-agnostic and Kiro-adaptable skills included, so that the power works reliably without Claude Code dependencies.

#### Acceptance Criteria

1. THE Power SHALL include the following platform-agnostic skills as steering files: `grill-me`, `design-an-interface`, `tdd`, `edit-article`, `ubiquitous-language`, `zoom-out`, `caveman`, `to-prd`, `to-issues`, `request-refactor-plan`, `triage-issue`, `qa`, `improve-codebase-architecture`, `domain-model`, and `write-a-skill`.
2. THE Power SHALL exclude `git-guardrails-claude-code` because it is a Claude Code hook implementation with a bundled shell script that has no Kiro equivalent.
3. THE Power SHALL exclude `migrate-to-shoehorn` because it is a narrow library-specific migration with no general workflow value.
4. THE Power SHALL exclude `scaffold-exercises` because it is specific to a particular course platform's linting and directory conventions.
5. THE Power SHALL exclude `setup-pre-commit` because it is a one-shot tooling setup script, not a reusable workflow.
6. THE Power SHALL exclude `obsidian-vault` because it is hardcoded to a specific local filesystem path and Obsidian-specific conventions.
7. THE Power SHALL exclude `github-triage` because it depends on a complex label-based state machine tightly coupled to `gh` CLI and Claude Code sub-agent patterns, making faithful adaptation impractical.
8. WHEN a new skill is proposed for inclusion, THE Skill_Router in POWER_MD SHALL be updated to reference the new steering file.

### Requirement 3: POWER.md Skill Router

**User Story:** As an AI agent, I want POWER.md to contain a categorized index of all skills with descriptions, type classification, and steering file references, so that I can select the correct workflow for the user's request.

#### Acceptance Criteria

1. THE POWER_MD body SHALL contain a Skill_Router section that lists every included skill grouped by category (Planning and Design, Development, Writing and Knowledge).
2. WHEN the agent activates the codeshop power, THE Skill_Router SHALL provide for each skill: the verb-noun name, a one-sentence description matching the original SKILL.md description (adapted for Kiro), the steering file name, and whether it is a Workflow_Skill or Knowledge_Skill.
3. THE Skill_Router SHALL include trigger phrases for each skill so the agent can match user requests to the correct workflow.
4. THE POWER_MD body SHALL contain a "Shared Concepts" section documenting cross-cutting ideas referenced by multiple skills (deep modules, vertical slices, domain language, durable issues).
5. THE Skill_Router SHALL visually distinguish Workflow_Skills from Knowledge_Skills (e.g., with a type column or grouping) so the agent understands which entries have phase files.

### Requirement 4: Steering File Generation from Skills

**User Story:** As a developer, I want each included skill converted into a self-contained steering file, so that the agent can load the full workflow on demand.

#### Acceptance Criteria

1. WHEN a Skill has no Supplementary_Files, THE corresponding steering file SHALL contain the full SKILL.md body (excluding YAML frontmatter) as its content.
2. WHEN a Skill has Supplementary_Files that are referenced only by that Skill, THE corresponding steering file SHALL inline the supplementary content as clearly labeled sections within the single steering file.
3. THE steering file `drive-tests.md` (from `tdd`) SHALL inline the content of `tests.md`, `mocking.md`, `deep-modules.md`, `interface-design.md`, and `refactoring.md` as appendix sections.
4. THE steering file `refactor-architecture.md` (from `improve-codebase-architecture`) SHALL inline the content of `LANGUAGE.md`, `DEEPENING.md`, and `INTERFACE-DESIGN.md` as appendix sections.
5. WHEN a Skill references a Supplementary_File owned by a different Skill (a Cross_Reference), THE steering file SHALL replace the relative link with a note directing the agent to load the referenced skill's steering file using its verb-noun name.
6. THE steering file `refactor-architecture.md` SHALL replace the link to `../domain-model/CONTEXT-FORMAT.md` with a note to load the `challenge-domain-model` steering file for context format details.
7. THE steering file `refactor-architecture.md` SHALL replace the link to `../domain-model/ADR-FORMAT.md` with a note to load the `challenge-domain-model` steering file for ADR format details.

### Requirement 5: Cross-Reference Resolution

**User Story:** As an AI agent, I want cross-references between skills resolved into steering file load instructions, so that I can follow references without broken links.

#### Acceptance Criteria

1. THE steering file `challenge-domain-model.md` (from `domain-model`) SHALL inline `CONTEXT-FORMAT.md` and `ADR-FORMAT.md` as appendix sections, since these are referenced by other skills.
2. WHEN a steering file references content from another steering file, THE reference SHALL use the verb-noun name in the format: "See the [verb-noun-name] steering file for [topic] details" rather than a relative file path.
3. THE Power SHALL NOT contain any relative file path links between steering files (e.g., no `../domain-model/CONTEXT-FORMAT.md` links).

### Requirement 6: Claude Code Concept Adaptation

**User Story:** As a developer, I want Claude Code-specific concepts replaced with Kiro equivalents, so that the workflows function correctly in Kiro.

#### Acceptance Criteria

1. WHEN a Skill references "Agent tool with subagent_type=Explore", THE steering file SHALL replace it with an Adaptation_Note recommending the use of Kiro's `invokeSubAgent` with the `context-gatherer` agent or direct file exploration tools.
2. WHEN a Skill references "Task tool" for parallel sub-agents, THE steering file SHALL replace it with an Adaptation_Note recommending the use of Kiro's `invokeSubAgent` with the `general-task-execution` agent.
3. WHEN a Skill references `gh issue create` or other `gh` CLI commands, THE steering file SHALL preserve the command but add an Adaptation_Note that the `gh` CLI must be installed and authenticated in the user's environment.
4. WHEN a Skill uses the `disable-model-invocation: true` frontmatter flag, THE steering file SHALL note that this skill is user-invoked only and the agent should not proactively suggest it.
5. THE steering files `map-context.md` (from `zoom-out`), `define-glossary.md` (from `ubiquitous-language`), and `challenge-domain-model.md` (from `domain-model`) SHALL each include a note that the skill is user-invoked only, matching the original `disable-model-invocation: true` behavior.

### Requirement 7: Steering File Naming Convention — Verb-Noun Recomposition

**User Story:** As a developer, I want steering files renamed to follow a verb-noun semantic pattern, so that each workflow name clearly communicates the action it performs.

#### Acceptance Criteria

1. THE steering file for each included skill SHALL be renamed from the original skill directory name to a verb-noun(s) pattern in kebab-case (e.g., `grill-me` → `stress-test-plan.md`, `ubiquitous-language` → `define-glossary.md`).
2. THE complete mapping from original skill names to verb-noun steering file names SHALL be:
   - `grill-me` → `stress-test-plan.md`
   - `design-an-interface` → `design-interface.md`
   - `tdd` → `drive-tests.md`
   - `edit-article` → `edit-article.md`
   - `ubiquitous-language` → `define-glossary.md`
   - `zoom-out` → `map-context.md`
   - `caveman` → `laconic-output.md`
   - `to-prd` → `draft-prd.md`
   - `to-issues` → `compose-issues.md`
   - `request-refactor-plan` → `plan-refactor.md`
   - `triage-issue` → `triage-bug.md`
   - `qa` → `run-qa-session.md`
   - `improve-codebase-architecture` → `refactor-architecture.md`
   - `domain-model` → `challenge-domain-model.md`
   - `write-a-skill` → `author-knowledge.md`
3. THE Skill_Router in POWER_MD SHALL use the verb-noun names as the primary identifiers, with the original skill names noted parenthetically for traceability.
4. ALL cross-references between steering files SHALL use the new verb-noun names (e.g., "See the challenge-domain-model steering file" rather than "See the domain-model steering file").

### Requirement 8: Shared Reference Content in POWER.md

**User Story:** As an AI agent, I want shared concepts documented once in POWER.md rather than duplicated across steering files, so that terminology stays consistent and context is preserved.

#### Acceptance Criteria

1. THE POWER_MD "Shared Concepts" section SHALL define "deep modules" (small interface, significant hidden complexity) since it is referenced by `drive-tests`, `refactor-architecture`, `draft-prd`, and `design-interface`.
2. THE POWER_MD "Shared Concepts" section SHALL define "vertical slices / tracer bullets" (thin end-to-end slices through all layers) since it is referenced by `drive-tests`, `compose-issues`, and `triage-bug`.
3. THE POWER_MD "Shared Concepts" section SHALL define "domain language discipline" (using terms from CONTEXT.md / ubiquitous language consistently) since it is referenced by `challenge-domain-model`, `refactor-architecture`, `run-qa-session`, and `github-triage`-derived content.
4. THE POWER_MD "Shared Concepts" section SHALL define "durable issues" (GitHub issues that survive refactors by describing behaviors, not file paths) since it is referenced by `run-qa-session`, `triage-bug`, and `compose-issues`.
5. WHEN a steering file uses a shared concept, THE steering file SHALL reference the POWER.md shared concepts section rather than redefining the term.

### Requirement 9: github-triage Reference Content Preservation

**User Story:** As a developer, I want the reusable reference documents from `github-triage` (agent brief format, out-of-scope knowledge base format) preserved as shared reference material, so that other skills can use them even though the full triage workflow is excluded.

#### Acceptance Criteria

1. THE POWER_MD "Shared Concepts" section SHALL include the agent brief format from `github-triage/AGENT-BRIEF.md` as a reusable reference for any skill that files GitHub issues.
2. THE POWER_MD "Shared Concepts" section SHALL include the out-of-scope knowledge base pattern from `github-triage/OUT-OF-SCOPE.md` as a reusable reference.

### Requirement 10: Frontmatter and Metadata Accuracy

**User Story:** As a developer, I want the POWER.md frontmatter to accurately describe the codeshop power, so that Kiro can index and surface it correctly.

#### Acceptance Criteria

1. THE POWER_MD `displayName` field SHALL be set to "Codeshop".
2. THE POWER_MD `description` field SHALL summarize the power as a collection of developer workflow skills covering planning, design, development, testing, writing, and knowledge management.
3. THE POWER_MD `description` field SHALL be three sentences or fewer.
4. THE POWER_MD `keywords` field SHALL be governed by Requirement 17 (Keyword Specificity).

### Requirement 11: Steering File Self-Containment

**User Story:** As an AI agent, I want each steering file to be self-contained enough to execute the workflow without loading POWER.md again, so that context window usage is efficient.

#### Acceptance Criteria

1. WHEN the agent loads a steering file, THE steering file SHALL contain all instructions needed to execute the workflow without requiring the agent to re-read POWER_MD.
2. THE steering file SHALL NOT duplicate shared concept definitions from POWER_MD but MAY include a brief inline reminder (one sentence) of a shared concept when it is central to the workflow.
3. IF a steering file requires content from another steering file, THE steering file SHALL explicitly name the other steering file to load rather than assuming it is already in context.

### Requirement 12: author-knowledge Adaptation

**User Story:** As a developer, I want the `author-knowledge` steering file (from `write-a-skill`) refocused on authoring canonical knowledge artifacts (`knowledge.md` + supplementary files), so that the output composes naturally with Skill Forge's build pipeline which handles compilation to any harness format.

#### Acceptance Criteria

1. THE steering file `author-knowledge.md` SHALL guide the user through authoring a canonical knowledge artifact: `knowledge.md` with YAML frontmatter and markdown body, optional `hooks.yaml`, optional `mcp-servers.yaml`, and optional `workflows/` phase files.
2. THE steering file `author-knowledge.md` SHALL document the `FrontmatterSchema` fields (name, displayName, description, keywords, author, version, type, harnesses, inclusion, categories, ecosystem, depends, enhances, maturity) as a reference template.
3. THE steering file `author-knowledge.md` SHALL explain that the canonical artifact is harness-agnostic — Skill Forge compiles it to skills, powers, rules, or agents depending on the `type` and `harness-config` fields, so the author focuses on content, not output format.
4. THE steering file `author-knowledge.md` SHALL include guidance on when to add `workflows/` phase files (ordered multi-step processes) vs keeping content in the body (reference material, behavioral modes).
5. THE steering file `author-knowledge.md` SHALL include guidance on when to add `hooks.yaml` (proactive agent behavior tied to IDE events) and `mcp-servers.yaml` (MCP server dependencies).
6. THE steering file `author-knowledge.md` SHALL reference the Skill Forge build commands (`bun run dev build`, `bun run dev validate`) as the mechanism for compiling the artifact to any target harness.

### Requirement 13: Workflow vs Knowledge Classification

**User Story:** As a developer, I want each included skill classified as either a Workflow_Skill or Knowledge_Skill, so that the power structure reflects the nature of each skill and Workflow_Skills get the phase-file treatment that makes this power uniquely valuable.

#### Acceptance Criteria

1. THE following skills SHALL be classified as Workflow_Skills and receive `workflows/` phase files: `drive-tests` (tdd), `draft-prd` (to-prd), `compose-issues` (to-issues), `plan-refactor` (request-refactor-plan), `triage-bug` (triage-issue), `design-interface` (design-an-interface), `run-qa-session` (qa), `refactor-architecture` (improve-codebase-architecture), `challenge-domain-model` (domain-model), and `author-knowledge` (write-a-skill).
2. THE following skills SHALL be classified as Knowledge_Skills and receive flat steering files only (no phase files): `stress-test-plan` (grill-me), `edit-article` (edit-article), `define-glossary` (ubiquitous-language), `map-context` (zoom-out), and `laconic-output` (caveman).
3. EACH Workflow_Skill SHALL have its ordered phases extracted into individual phase files under `workflows/` with clear entry criteria, steps, and exit criteria per phase.
4. THE steering file for each Workflow_Skill SHALL serve as the workflow overview and reference the phase files, rather than containing the full phase instructions inline.

### Requirement 14: Onboarding Section in POWER.md

**User Story:** As a developer installing the codeshop power for the first time, I want an onboarding section in POWER.md that explains what codeshop is, how to invoke workflows, and any prerequisites, so that I can start using it immediately.

#### Acceptance Criteria

1. THE POWER_MD body SHALL contain an "Onboarding" section before the Skill_Router section.
2. THE Onboarding section SHALL explain what the codeshop power provides (a collection of developer workflow skills) and how the agent selects and loads workflows.
3. THE Onboarding section SHALL list prerequisites that apply across multiple workflows: `gh` CLI installed and authenticated (for issue-filing workflows), a test runner configured in the project (for `drive-tests`), and `CONTEXT.md` / `docs/adr/` conventions (for `challenge-domain-model` and `refactor-architecture`).
4. THE Onboarding section SHALL include 2-3 example invocation phrases showing how a user triggers different workflows (e.g., "grill me on this plan", "let's do TDD", "triage this bug").

### Requirement 15: Hooks for Proactive Workflow Suggestions

**User Story:** As a developer, I want the codeshop power to include hooks that proactively suggest relevant workflows at the right moments, so that I benefit from the workflows without having to remember their names.

#### Acceptance Criteria

1. THE Power SHALL include a `userTriggered` hook for each workflow that has the `disable-model-invocation` equivalent (user-invoked only): `map-context`, `define-glossary`, and `challenge-domain-model`.
2. THE Power SHALL include a `preTaskExecution` hook that checks whether the current task involves architectural changes and suggests loading the `refactor-architecture` or `challenge-domain-model` steering file before proceeding.
3. THE Power SHALL include an `agentStop` hook that reminds the agent to file any issues discovered during the session using the `run-qa-session` or `triage-bug` workflow patterns, if bugs were discussed but not yet filed.
4. ALL hook prompts SHALL follow the directive pattern (imperative action, not advisory) as documented in the ADR power's hook design principles: end with a concrete action the agent must take, not a suggestion to "keep in mind."

### Requirement 16: Troubleshooting Section in POWER.md

**User Story:** As a developer, I want a troubleshooting section in POWER.md that addresses common failure modes across workflows, so that I can resolve issues without abandoning the workflow.

#### Acceptance Criteria

1. THE POWER_MD body SHALL contain a "Troubleshooting" section after the Shared Concepts section.
2. THE Troubleshooting section SHALL document the failure mode: `gh` CLI not installed or not authenticated, with diagnostic steps and resolution for workflows that file GitHub issues (`draft-prd`, `compose-issues`, `triage-bug`, `run-qa-session`, `plan-refactor`).
3. THE Troubleshooting section SHALL document the failure mode: no test runner found, with guidance on configuring one for the `drive-tests` workflow.
4. THE Troubleshooting section SHALL document the failure mode: no `CONTEXT.md` or `docs/adr/` directory found, with guidance that these are created lazily by the `challenge-domain-model` and `refactor-architecture` workflows.
5. THE Troubleshooting section SHALL document the failure mode: agent loads the wrong workflow for a user request, with guidance on using more specific trigger phrases.

### Requirement 17: Keyword Specificity

**User Story:** As a developer, I want the codeshop power's keywords to be specific enough to avoid false activations on unrelated requests, so that the power only triggers when developer workflow skills are genuinely relevant.

#### Acceptance Criteria

1. THE POWER_MD `keywords` field SHALL NOT include overly broad terms that could trigger on unrelated requests. Specifically, the keywords "writing", "skills", and "code-review" SHALL be replaced with more specific alternatives.
2. THE POWER_MD `keywords` field SHALL use domain-specific compound terms where possible (e.g., "test-driven-development" instead of "tdd", "domain-modeling" instead of "domain-model").
3. THE POWER_MD `keywords` field SHALL contain at least the following terms: "planning", "interface-design", "test-driven-development", "refactoring", "architecture", "domain-modeling", "issue-triage", "prd", "vertical-slices", "codeshop".

### Requirement 18: Workflow Composability Guidance

**User Story:** As an AI agent, I want POWER.md to document how workflows chain together, so that I can suggest logical next steps after completing a workflow.

#### Acceptance Criteria

1. THE POWER_MD body SHALL contain a "Workflow Composition" section that documents natural workflow chains.
2. THE Workflow Composition section SHALL document the planning chain: `stress-test-plan` → `draft-prd` → `compose-issues` → `drive-tests`, explaining that grilling sharpens the plan, the PRD formalizes it, issues break it down, and TDD implements each slice.
3. THE Workflow Composition section SHALL document the bug-fix chain: `triage-bug` → `drive-tests`, explaining that triage produces a TDD fix plan that `drive-tests` can execute.
4. THE Workflow Composition section SHALL document the architecture chain: `refactor-architecture` → `plan-refactor` → `compose-issues`, explaining that architecture review surfaces candidates, the refactor plan details the approach, and issues break it into work items.
5. THE Workflow Composition section SHALL document the domain chain: `challenge-domain-model` → `define-glossary` → `refactor-architecture`, explaining that domain grilling sharpens terminology, the glossary formalizes it, and architecture review uses the refined language.
6. WHEN a workflow completes, THE agent SHOULD reference the Workflow Composition section to suggest the natural next workflow in the chain, if applicable.

### Requirement 19: Conditional Steering via fileMatch

**User Story:** As a developer, I want certain codeshop workflows to activate automatically when I'm working with relevant files, so that the power provides contextual guidance without me having to remember to invoke it.

#### Acceptance Criteria

1. THE Power SHALL include conditional steering configuration that activates the `challenge-domain-model` workflow context when files matching `CONTEXT.md` or `CONTEXT-MAP.md` are read or edited.
2. THE Power SHALL include conditional steering configuration that activates the `refactor-architecture` workflow context when files matching `docs/adr/**` are read or edited.
3. THE Power SHALL include conditional steering configuration that activates the `define-glossary` workflow context when files matching `UBIQUITOUS_LANGUAGE.md` are read or edited.
4. THE conditional steering SHALL provide a brief contextual reminder (1-2 sentences) about the relevant workflow, not the full workflow instructions.

### Requirement 20: Testing and Validation Plan

**User Story:** As a developer, I want a testing plan that validates the codeshop power works correctly after creation, so that I can be confident the workflows trigger, load, and execute as expected.

#### Acceptance Criteria

1. THE spec SHALL include a testing task that installs the codeshop power locally via the Kiro Powers UI using a local directory path.
2. THE testing task SHALL verify that the power appears in the Installed Powers list and that `activate` returns the correct steering file list.
3. THE testing task SHALL verify that at least one workflow from each category (Planning, Development, Writing) triggers correctly from a natural language request.
4. THE testing task SHALL verify that steering files load successfully via `readSteering` and contain the expected workflow phases.
5. THE testing task SHALL verify that cross-references between steering files use verb-noun names and do not contain broken relative file paths.
6. THE testing task SHALL verify that hooks fire at the expected events and produce directive (not advisory) prompts.

### Requirement 21: write-living-docs Workflow — Living Documentation Specialist

**User Story:** As a developer, I want a documentation workflow grounded in Living Documentation principles (Martraire), so that my project's documentation stays reliable, collaborative, and low-effort by deriving it from authoritative sources in the codebase rather than maintaining it separately.

#### Acceptance Criteria

1. THE Power SHALL include a new Workflow_Skill called `write-living-docs` with the verb-noun steering file name `write-living-docs.md`.
2. THE `write-living-docs` workflow SHALL be classified as a Workflow_Skill with the following ordered phases: Audit, Classify, Harvest, Compose, Reconcile.
3. THE Audit phase SHALL instruct the agent to inventory existing documentation sources in the codebase: README files, CONTEXT.md, ADRs, inline doc comments, test descriptions, configuration files, type definitions, and any existing generated docs. The agent SHALL identify which sources are authoritative (single source of truth) and which are derived or stale.
4. THE Classify phase SHALL instruct the agent to classify each documentation need using Martraire's three principles: (a) knowledge of interest for a long period deserves documentation, (b) knowledge of interest to a large audience deserves documentation, (c) knowledge that is valuable or critical deserves documentation. Knowledge that can be recreated cheaply (volatile predictions, rarely-needed info, raw diagnostic output) SHALL be explicitly marked as "do not document."
5. THE Classify phase SHALL further categorize each documentation item as one of: Evergreen (stable knowledge, traditional docs acceptable), Living (changes with the code, must be derived from authoritative source), or Conversation (best transferred through discussion, not written docs).
6. THE Harvest phase SHALL instruct the agent to extract documentation from authoritative sources already in the codebase rather than writing new prose from scratch. Sources include: test names and descriptions as behavioral specifications, type signatures and interfaces as API contracts, CONTEXT.md terms as domain glossary, ADRs as decision rationale, configuration files as deployment documentation, and code structure as architecture documentation.
7. THE Compose phase SHALL instruct the agent to assemble harvested knowledge into the appropriate documentation format, following these rules: (a) only one source of truth per concept — use references, not copies, (b) annotate the rationale (the "why"), not just the mechanism (the "how"), (c) filter by audience — internal docs stay near the code, external docs are embellished and published, (d) version each published snapshot.
8. THE Reconcile phase SHALL instruct the agent to verify that all derived documentation is consistent with its authoritative source. For each documentation artifact, the agent SHALL check whether the source has changed since the doc was last updated, flag any drift, and either update the doc or mark it as stale with a link to the authoritative source.
9. THE `write-living-docs` steering file SHALL include a "Documentation Anti-Patterns" section documenting: (a) the Information Graveyard — docs written once and never updated, (b) Human Dedication — relying on individual heroism to keep docs current, (c) Speculative Documentation — documenting what might be needed rather than what is actually asked about, (d) Comprehensive Documentation — attempting to document everything rather than applying the "default is don't" principle.
10. THE `write-living-docs` steering file SHALL include a "Living Documentation Checklist" that the agent applies to each documentation artifact: Is it collaborative (multiple stakeholders can contribute)? Is it insightful (exposes uncertainty and complexity)? Is it reliable (derived from or reconciled with an authoritative source)? Is it low-effort (automated or derived, not manually maintained)?
11. THE Skill_Router in POWER_MD SHALL list `write-living-docs` under the "Writing and Knowledge" category with trigger phrases including: "document this", "write docs", "update documentation", "living docs", "documentation audit", "what needs documenting".
12. THE Workflow Composition section SHALL document a documentation chain: `refactor-architecture` → `write-living-docs` → `challenge-domain-model`, explaining that architecture review surfaces what changed, living docs captures it durably, and domain model grilling ensures the terminology is precise.

### Requirement 22: review-changes Workflow — Code Review from Existing Catalog Artifact

**User Story:** As a developer, I want a code review workflow in codeshop that adapts the existing `review-ritual` knowledge artifact into a phase-driven Kiro workflow, so that I can review pull requests and diffs systematically.

#### Acceptance Criteria

1. THE Power SHALL include a Workflow_Skill called `review-changes` sourced from the existing `review-ritual` knowledge artifact in the Skill Forge catalog.
2. THE `review-changes` workflow SHALL have the following ordered phases: Orient, Read, Comment, Decide.
3. THE Orient phase SHALL instruct the agent to read the PR description and skim the full diff to understand scope and intent before reviewing any individual file.
4. THE Read phase SHALL instruct the agent to read changed tests first (they explain expected behavior), then read the implementation to verify it matches the tests and description.
5. THE Comment phase SHALL instruct the agent to classify each finding using the review-ritual taxonomy: "must address" (blocks merge — logic errors, security issues, breaking changes, missing error handling), "should address" (request but don't block — missing tests, pattern inconsistencies, performance), and "nit" (style preferences not covered by linter).
6. THE Decide phase SHALL instruct the agent to approve only when it could explain the code to a colleague, or request changes with specific, actionable comments that include proposed alternatives.
7. THE `review-changes` steering file SHALL inline the review-ritual's reading order, comment taxonomy, and approval criteria as reference sections.
8. THE Skill_Router SHALL list `review-changes` under the "Development" category with trigger phrases including: "review this", "review PR", "code review", "review changes", "check this diff".
9. THE Workflow Composition section SHALL document a delivery chain: `compose-issues` → `drive-tests` → `review-changes`, and a feedback chain: `review-changes` → `triage-bug` (review finds bug) or `review-changes` → `plan-refactor` (review surfaces refactoring opportunity).

### Requirement 23: craft-commits Knowledge Skill — From Existing Catalog Artifact

**User Story:** As a developer, I want commit message guidance in codeshop that adapts the existing `commit-craft` knowledge artifact, so that my commits tell the story of why, not just what.

#### Acceptance Criteria

1. THE Power SHALL include a Knowledge_Skill called `craft-commits` sourced from the existing `commit-craft` knowledge artifact in the Skill Forge catalog.
2. THE `craft-commits` steering file SHALL contain the commit-craft content adapted for Kiro: conventional commit format, the "rule of thumb" test, examples of good and bad messages, and anti-patterns.
3. THE `craft-commits` steering file SHALL be a flat Knowledge_Skill (no phase files) since commit message guidance is reference material, not an ordered workflow.
4. THE Skill_Router SHALL list `craft-commits` under the "Writing and Knowledge" category with trigger phrases including: "commit message", "write commit", "conventional commit", "commit craft".
5. THE Workflow Composition section SHALL document that `craft-commits` naturally follows `drive-tests` and `review-changes` — after code is written and reviewed, commits capture the rationale.

### Requirement 24: journal-debug Workflow — From Existing Catalog Artifact

**User Story:** As a developer, I want a systematic debugging workflow in codeshop that adapts the existing `debug-journal` knowledge artifact into a phase-driven Kiro workflow, so that I articulate the problem before chasing the solution.

#### Acceptance Criteria

1. THE Power SHALL include a Workflow_Skill called `journal-debug` sourced from the existing `debug-journal` knowledge artifact in the Skill Forge catalog.
2. THE `journal-debug` workflow SHALL reuse the existing phase files from `debug-journal/workflows/`: Articulate (01-articulate.md), Isolate (02-isolate.md), Fix and Verify (03-fix-and-verify.md).
3. THE Articulate phase SHALL enforce the three-sentence rule: (1) what I expected, (2) what actually happened, (3) what I already know it is not. The agent SHALL NOT proceed to isolation until all three sentences are written and at least one hypothesis is ruled out.
4. THE Isolate phase SHALL instruct the agent to shrink the problem surface using binary search, minimal reproduction, and one-variable-at-a-time techniques.
5. THE Fix and Verify phase SHALL instruct the agent to re-run the reproduction case, check adjacent behavior, consider if the same mistake exists elsewhere, and write a test to prevent regression.
6. THE `journal-debug` steering file SHALL include the debug-journal's three-sentence rule, best practices, and examples as reference sections.
7. THE Skill_Router SHALL list `journal-debug` under the "Development" category with trigger phrases including: "debug this", "debugging", "why is this broken", "debug journal", "investigate bug", "systematic debug".
8. THE Workflow Composition section SHALL document that `journal-debug` complements `triage-bug`: triage-bug investigates and files an issue, while journal-debug is the hands-on debugging methodology used during the fix. Chain: `triage-bug` → `journal-debug` → `drive-tests`.

### Requirement 25: Companion Powers Section in POWER.md

**User Story:** As an AI agent, I want POWER.md to list companion powers that complement codeshop, so that I can suggest activating them alongside codeshop when relevant.

#### Acceptance Criteria

1. THE POWER_MD body SHALL contain a "Companion Powers" section after the Workflow Composition section and before Troubleshooting.
2. THE Companion Powers section SHALL list the `adr` power as a companion, explaining that codeshop's `refactor-architecture` and `challenge-domain-model` workflows reference ADRs, and the ADR power provides full ADR lifecycle management (create, update, review, health check).
3. THE Companion Powers section SHALL list the `type-guardian` power as a companion for TypeScript projects, explaining that it provides type discipline guidance that complements codeshop's language-agnostic workflows.
4. THE Companion Powers section SHALL list the `karpathy-mode` power as a companion, explaining that its "surgical changes" and "simplicity first" principles complement codeshop's development workflows.
5. EACH companion power entry SHALL include: the power name, a one-sentence description of what it adds, and when to suggest activating it alongside codeshop.
6. THE agent SHALL NOT bundle companion power content into codeshop steering files — companion powers are activated separately via the Powers system.
