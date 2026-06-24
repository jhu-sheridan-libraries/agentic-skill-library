# Implementation Plan: codeshop-power

## Overview

Create the codeshop knowledge artifact at `skill-forge/knowledge/codeshop/` — a Kiro Knowledge Base Power consolidating 19 developer workflow skills. The artifact consists of `knowledge.md` (frontmatter + POWER.md body), `hooks.yaml` (8 canonical hooks), 19 steering-file sections embedded in the POWER.md body's skill router, and ~55 workflow phase files under `workflows/`. Content is sourced from 15 skills in the `skills/` workspace folder and 3 existing catalog artifacts (`review-ritual`, `commit-craft`, `debug-journal`). Implementation proceeds bottom-up: knowledge.md frontmatter → POWER.md body sections → hooks → Knowledge_Skill steering files → Workflow_Skill steering files → workflow phase files → build validation → testing.

## Tasks

- [ ] 1. Create knowledge.md with frontmatter and POWER.md body skeleton
  - [x] 1.1 Create `skill-forge/knowledge/codeshop/knowledge.md` with valid YAML frontmatter
    - Fields: `name: codeshop`, `displayName: Codeshop`, `description` (≤3 sentences covering planning, design, development, testing, writing, knowledge management), `keywords` array with domain-specific compound terms (must include: codeshop, planning, interface-design, test-driven-development, refactoring, architecture, domain-modeling, issue-triage, prd, vertical-slices, codebase-architecture, bug-triage, qa-session, skill-authoring, article-editing, living-documentation, code-review, commit-messages, debugging-methodology), `author: Matt Pocock`, `version: 0.1.0`, `harnesses: [kiro]`, `type: power`, `inclusion: manual`, `categories: [architecture, testing, documentation]`, `harness-config.kiro.format: power`
    - Keywords MUST NOT include banned broad terms: "writing", "skills", "code-review" (as standalone), "tdd", "domain-model", "code", "development", "testing"
    - _Requirements: 1.1, 1.5, 1.6, 10.1, 10.2, 10.3, 10.4, 17.1, 17.2, 17.3_

  - [x] 1.2 Write the Onboarding section in the knowledge.md body
    - Explain what codeshop provides (collection of 19 developer workflow skills covering planning, design, development, testing, writing, knowledge management)
    - Explain how the agent selects and loads workflows (Skill Router → readSteering)
    - List cross-workflow prerequisites: `gh` CLI installed and authenticated, test runner configured, `CONTEXT.md` / `docs/adr/` conventions
    - Include 2-3 example invocation phrases: "grill me on this plan", "let's do TDD", "triage this bug"
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [x] 1.3 Write the Skill Router section in the knowledge.md body
    - Group skills into three categories: Planning and Design, Development, Writing and Knowledge
    - For each of the 19 skills: verb-noun name, one-sentence description (adapted for Kiro), steering file name, Workflow/Knowledge type classification, trigger phrases, original skill name in parentheses
    - Visually distinguish Workflow_Skills from Knowledge_Skills (type column or grouping)
    - Planning and Design: stress-test-plan, draft-prd, compose-issues, design-interface, plan-refactor
    - Development: drive-tests, triage-bug, journal-debug, run-qa-session, review-changes, refactor-architecture, challenge-domain-model
    - Writing and Knowledge: edit-article, define-glossary, write-living-docs, craft-commits, map-context, laconic-output, author-knowledge
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 7.1, 7.2, 7.3, 13.1, 13.2, 21.11, 22.8, 23.4, 24.7_

  - [x] 1.4 Write the Shared Concepts section in the knowledge.md body
    - Define "deep modules" (small interface, significant hidden complexity) — referenced by drive-tests, refactor-architecture, draft-prd, design-interface
    - Define "vertical slices / tracer bullets" (thin end-to-end slices through all layers) — referenced by drive-tests, compose-issues, triage-bug
    - Define "domain language discipline" (using terms from CONTEXT.md / ubiquitous language consistently) — referenced by challenge-domain-model, refactor-architecture, run-qa-session
    - Define "durable issues" (GitHub issues that survive refactors by describing behaviors, not file paths) — referenced by run-qa-session, triage-bug, compose-issues
    - Include agent brief format from `github-triage/AGENT-BRIEF.md` as reusable reference
    - Include out-of-scope knowledge base pattern from `github-triage/OUT-OF-SCOPE.md` as reusable reference
    - Add "living documentation principles" summary for write-living-docs references
    - _Requirements: 3.4, 8.1, 8.2, 8.3, 8.4, 8.5, 9.1, 9.2_

  - [x] 1.5 Write the Workflow Composition section in the knowledge.md body
    - Planning chain: stress-test-plan → draft-prd → compose-issues → drive-tests
    - Bug-fix chain: triage-bug → drive-tests
    - Architecture chain: refactor-architecture → plan-refactor → compose-issues
    - Domain chain: challenge-domain-model → define-glossary → refactor-architecture
    - Documentation chain: refactor-architecture → write-living-docs → challenge-domain-model
    - Delivery chain: compose-issues → drive-tests → review-changes
    - Feedback chain: review-changes → triage-bug (review finds bug) or review-changes → plan-refactor (review surfaces refactoring)
    - Debugging chain: triage-bug → journal-debug → drive-tests
    - Commit chain: drive-tests → review-changes → craft-commits
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 21.12, 22.9, 23.5, 24.8_

  - [x] 1.6 Write the Companion Powers section in the knowledge.md body
    - `adr` power: full ADR lifecycle management, suggest when refactor-architecture or challenge-domain-model surfaces decisions
    - `type-guardian` power: TypeScript type discipline, suggest for TypeScript codebases with drive-tests or review-changes
    - `karpathy-mode` power: surgical changes and simplicity-first, suggest for development workflows
    - Each entry: power name, one-sentence description, when to suggest activating
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6_

  - [x] 1.7 Write the Troubleshooting section in the knowledge.md body
    - `gh` CLI not installed or not authenticated: diagnostic steps and resolution for issue-filing workflows
    - No test runner found: guidance on configuring one for drive-tests
    - No `CONTEXT.md` or `docs/adr/` directory: guidance that these are created lazily by challenge-domain-model and refactor-architecture
    - Agent loads wrong workflow: guidance on using more specific trigger phrases
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [x] 2. Checkpoint — Verify knowledge.md structure
  - Ensure knowledge.md has valid YAML frontmatter and all 6 body sections (Onboarding, Skill Router, Shared Concepts, Workflow Composition, Companion Powers, Troubleshooting). Ask the user if questions arise.

- [x] 3. Create hooks.yaml with all 8 canonical hooks
  - Create `skill-forge/knowledge/codeshop/hooks.yaml` with 8 hooks total
  - 3 `user_triggered` hooks: Map Context, Define Glossary, Challenge Domain Model — each loads the corresponding steering file and starts the workflow
  - 1 `pre_task` hook: Architectural Change Detection — checks if task involves architectural changes, loads refactor-architecture or challenge-domain-model if needed
  - 1 `agent_stop` hook: Unfiled Issue Reminder — scans conversation for unfiled bugs, files them using triage-bug or run-qa-session patterns
  - 3 `file_edited` hooks for conditional steering: Domain Context File Guidance (CONTEXT.md, CONTEXT-MAP.md), ADR File Guidance (docs/adr/**), Glossary File Guidance (UBIQUITOUS_LANGUAGE.md)
  - ALL hook prompts MUST follow directive pattern: imperative action ending with concrete action the agent must take, NOT advisory ("keep in mind", "consider suggesting")
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 19.1, 19.2, 19.3, 19.4_

- [ ] 4. Create Knowledge_Skill steering files (6 flat files)
  - [x] 4.1 Create `stress-test-plan.md` steering file content
    - Source: `skills/grill-me/SKILL.md`
    - Flat Knowledge_Skill — full SKILL.md body (excluding YAML frontmatter) as content
    - No supplementary files to inline
    - Embed as a section within knowledge.md body or as a standalone file referenced by the Skill Router (follow the artifact's steering file convention)
    - _Requirements: 2.1, 4.1, 7.1, 7.2, 13.2_

  - [x] 4.2 Create `edit-article.md` steering file content
    - Source: `skills/edit-article/SKILL.md`
    - Flat Knowledge_Skill — full SKILL.md body as content
    - No supplementary files to inline
    - _Requirements: 2.1, 4.1, 7.1, 7.2, 13.2_

  - [x] 4.3 Create `define-glossary.md` steering file content
    - Source: `skills/ubiquitous-language/SKILL.md`
    - Flat Knowledge_Skill — full SKILL.md body as content
    - Include adaptation note: "User-invoked only — do not proactively suggest" (matches original `disable-model-invocation: true`)
    - Reference POWER.md shared concepts for "domain language discipline" rather than redefining
    - _Requirements: 2.1, 4.1, 6.4, 6.5, 7.1, 7.2, 11.2, 13.2_

  - [x] 4.4 Create `map-context.md` steering file content
    - Source: `skills/zoom-out/SKILL.md`
    - Flat Knowledge_Skill — full SKILL.md body as content
    - Include adaptation note: "User-invoked only — do not proactively suggest"
    - Replace any "Agent tool with subagent_type=Explore" references with Kiro `invokeSubAgent` with `context-gatherer` agent
    - _Requirements: 2.1, 4.1, 6.1, 6.4, 6.5, 7.1, 7.2, 13.2_

  - [x] 4.5 Create `laconic-output.md` steering file content
    - Source: `skills/caveman/SKILL.md`
    - Flat Knowledge_Skill — full SKILL.md body as content
    - No supplementary files to inline
    - Reimagine as a Spartan, not a caveman.
    - _Requirements: 2.1, 4.1, 7.1, 7.2, 13.2_

  - [x] 4.6 Create `craft-commits.md` steering file content
    - Source: existing `skill-forge/knowledge/commit-craft/knowledge.md` catalog artifact
    - Flat Knowledge_Skill — adapt commit-craft content for Kiro: conventional commit format, "rule of thumb" test, examples of good and bad messages, anti-patterns
    - _Requirements: 2.1, 23.1, 23.2, 23.3, 23.4_

- [x] 5. Checkpoint — Verify all 6 Knowledge_Skill steering files
  - Ensure all 6 flat steering files exist and contain complete instructions. Verify no relative file path links between steering files. Ask the user if questions arise.

- [ ] 6. Create Workflow_Skill steering files (13 overview files)
  - [x] 6.1 Create `drive-tests.md` steering file content
    - Source: `skills/tdd/SKILL.md`
    - Workflow overview referencing 4 phase files: drive-tests-planning, drive-tests-tracer-bullet, drive-tests-incremental-loop, drive-tests-refactor
    - Inline supplementary files as appendix sections: `tests.md`, `mocking.md`, `deep-modules.md`, `interface-design.md`, `refactoring.md`
    - Reference POWER.md shared concepts for "deep modules" and "vertical slices" rather than redefining
    - _Requirements: 2.1, 4.1, 4.2, 4.3, 7.1, 7.2, 8.5, 11.1, 11.2, 13.1, 13.3, 13.4_

  - [x] 6.2 Create `draft-prd.md` steering file content
    - Source: `skills/to-prd/SKILL.md`
    - Workflow overview referencing 3 phase files: draft-prd-explore, draft-prd-sketch-modules, draft-prd-write-prd
    - Add adaptation note for `gh` CLI commands: "Requires `gh` CLI installed and authenticated"
    - _Requirements: 2.1, 4.1, 6.3, 7.1, 7.2, 13.1, 13.3, 13.4_

  - [x] 6.3 Create `compose-issues.md` steering file content
    - Source: `skills/to-issues/SKILL.md`
    - Workflow overview referencing 5 phase files: compose-issues-gather-context, compose-issues-explore, compose-issues-draft-slices, compose-issues-quiz-user, compose-issues-create-issues
    - Replace "Agent tool with subagent_type=Explore" with Kiro `invokeSubAgent` with `context-gatherer`
    - Add adaptation note for `gh` CLI commands
    - Reference shared concepts for "vertical slices" and "durable issues"
    - _Requirements: 2.1, 4.1, 6.1, 6.3, 7.1, 7.2, 8.5, 11.2, 13.1, 13.3, 13.4_

  - [x] 6.4 Create `plan-refactor.md` steering file content
    - Source: `skills/request-refactor-plan/SKILL.md`
    - Workflow overview referencing 7 phase files: plan-refactor-capture, plan-refactor-explore, plan-refactor-interview, plan-refactor-scope, plan-refactor-test-coverage, plan-refactor-commit-plan, plan-refactor-create-issue
    - Add adaptation note for `gh` CLI commands
    - _Requirements: 2.1, 4.1, 6.3, 7.1, 7.2, 13.1, 13.3, 13.4_

  - [x] 6.5 Create `triage-bug.md` steering file content
    - Source: `skills/triage-issue/SKILL.md`
    - Workflow overview referencing 5 phase files: triage-bug-capture, triage-bug-diagnose, triage-bug-fix-approach, triage-bug-tdd-plan, triage-bug-create-issue
    - Replace "Agent tool with subagent_type=Explore" with Kiro `invokeSubAgent` with `context-gatherer`
    - Add adaptation note for `gh` CLI commands
    - Reference shared concepts for "vertical slices" and "durable issues"
    - _Requirements: 2.1, 4.1, 6.1, 6.3, 7.1, 7.2, 8.5, 11.2, 13.1, 13.3, 13.4_

  - [x] 6.6 Create `design-interface.md` steering file content
    - Source: `skills/design-an-interface/SKILL.md`
    - Workflow overview referencing 5 phase files: design-interface-requirements, design-interface-generate, design-interface-present, design-interface-compare, design-interface-synthesize
    - Replace "Task tool" for parallel sub-agents with Kiro `invokeSubAgent` with `general-task-execution` agent
    - Reference shared concepts for "deep modules"
    - _Requirements: 2.1, 4.1, 6.2, 7.1, 7.2, 8.5, 11.2, 13.1, 13.3, 13.4_

  - [x] 6.7 Create `run-qa-session.md` steering file content
    - Source: `skills/qa/SKILL.md`
    - Workflow overview referencing 5 phase files: run-qa-session-listen, run-qa-session-explore, run-qa-session-scope, run-qa-session-file-issue, run-qa-session-continue
    - Replace "Agent tool with subagent_type=Explore" with Kiro `invokeSubAgent` with `context-gatherer`
    - Add adaptation note for `gh` CLI commands
    - Reference shared concepts for "durable issues" and "domain language discipline"
    - _Requirements: 2.1, 4.1, 6.1, 6.3, 7.1, 7.2, 8.5, 11.2, 13.1, 13.3, 13.4_

  - [x] 6.8 Create `refactor-architecture.md` steering file content
    - Source: `skills/improve-codebase-architecture/SKILL.md`
    - Workflow overview referencing 3 phase files: refactor-architecture-explore, refactor-architecture-present, refactor-architecture-grilling-loop
    - Inline supplementary files as appendix sections: `LANGUAGE.md`, `DEEPENING.md`, `INTERFACE-DESIGN.md`
    - Replace link to `../domain-model/CONTEXT-FORMAT.md` with "See the challenge-domain-model steering file for context format details"
    - Replace link to `../domain-model/ADR-FORMAT.md` with "See the challenge-domain-model steering file for ADR format details"
    - Replace "Agent tool with subagent_type=Explore" with Kiro `invokeSubAgent` with `context-gatherer`
    - Reference shared concepts for "deep modules" and "domain language discipline"
    - _Requirements: 2.1, 4.1, 4.4, 4.5, 4.6, 4.7, 5.2, 5.3, 6.1, 7.1, 7.2, 8.5, 11.2, 13.1, 13.3, 13.4_

  - [x] 6.9 Create `challenge-domain-model.md` steering file content
    - Source: `skills/domain-model/SKILL.md`
    - Workflow overview referencing 3 phase files: challenge-domain-model-setup, challenge-domain-model-session, challenge-domain-model-update
    - Inline `CONTEXT-FORMAT.md` and `ADR-FORMAT.md` as appendix sections (these are referenced by other skills)
    - Include adaptation note: "User-invoked only — do not proactively suggest"
    - Reference shared concepts for "domain language discipline"
    - _Requirements: 2.1, 4.1, 4.2, 5.1, 6.4, 6.5, 7.1, 7.2, 8.5, 11.2, 13.1, 13.3, 13.4_

  - [x] 6.10 Create `author-knowledge.md` steering file content
    - Source: `skills/write-a-skill/SKILL.md`
    - Workflow overview referencing 3 phase files: author-knowledge-gather, author-knowledge-draft, author-knowledge-review
    - Refocus on authoring canonical knowledge artifacts (`knowledge.md` + frontmatter + optional hooks.yaml, mcp-servers.yaml, workflows/)
    - Document the `FrontmatterSchema` fields as a reference template
    - Explain that the artifact is harness-agnostic — Skill Forge compiles to skills, powers, rules, or agents depending on type and harness-config
    - Include guidance on when to add workflows/ phase files vs body content, and when to add hooks.yaml and mcp-servers.yaml
    - Reference Skill Forge build commands (`bun run dev build`, `bun run dev validate`)
    - _Requirements: 2.1, 4.1, 7.1, 7.2, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 13.1, 13.3, 13.4_

  - [x] 6.11 Create `write-living-docs.md` steering file content
    - Source: original to codeshop (no source skill)
    - Workflow overview referencing 5 phase files: write-living-docs-audit, write-living-docs-classify, write-living-docs-harvest, write-living-docs-compose, write-living-docs-reconcile
    - Include "Documentation Anti-Patterns" section: Information Graveyard, Human Dedication, Speculative Documentation, Comprehensive Documentation
    - Include "Living Documentation Checklist": collaborative, insightful, reliable, low-effort
    - _Requirements: 21.1, 21.2, 21.9, 21.10, 21.11_

  - [x] 6.12 Create `review-changes.md` steering file content
    - Source: existing `skill-forge/knowledge/review-ritual/knowledge.md` catalog artifact
    - Workflow overview referencing 4 phase files: review-changes-orient, review-changes-read, review-changes-comment, review-changes-decide
    - Inline review-ritual's reading order, comment taxonomy (must address / should address / nit), and approval criteria as reference sections
    - _Requirements: 22.1, 22.2, 22.7, 22.8_

  - [x] 6.13 Create `journal-debug.md` steering file content
    - Source: existing `skill-forge/knowledge/debug-journal/knowledge.md` catalog artifact
    - Workflow overview referencing 3 phase files: journal-debug-articulate, journal-debug-isolate, journal-debug-fix-and-verify
    - Include the three-sentence rule, best practices, and examples as reference sections
    - _Requirements: 24.1, 24.2, 24.6, 24.7_

- [x] 7. Checkpoint — Verify all 13 Workflow_Skill steering files
  - Ensure all 13 workflow overview steering files exist, reference their phase files, and contain no relative file path links (no `../skill-name/` patterns). Verify inlined supplementary content in drive-tests, refactor-architecture, and challenge-domain-model. Ask the user if questions arise.

- [ ] 8. Create workflow phase files for drive-tests (tdd)
  - [x] 8.1 Create `workflows/drive-tests-planning.md`
    - Source: planning phase from `skills/tdd/SKILL.md`
    - Entry criteria, steps, exit criteria, next phase reference
    - _Requirements: 13.3_

  - [x] 8.2 Create `workflows/drive-tests-tracer-bullet.md`
    - Source: tracer bullet phase from `skills/tdd/SKILL.md`
    - Entry criteria, steps, exit criteria, next phase reference
    - _Requirements: 13.3_

  - [x] 8.3 Create `workflows/drive-tests-incremental-loop.md`
    - Source: incremental loop phase from `skills/tdd/SKILL.md`
    - Entry criteria, steps, exit criteria, next phase reference
    - _Requirements: 13.3_

  - [x] 8.4 Create `workflows/drive-tests-refactor.md`
    - Source: refactor phase from `skills/tdd/SKILL.md`
    - Entry criteria, steps, exit criteria, next phase reference
    - _Requirements: 13.3_

- [ ] 9. Create workflow phase files for draft-prd (to-prd)
  - [x] 9.1 Create `workflows/draft-prd-explore.md`
    - Source: explore phase from `skills/to-prd/SKILL.md`
    - Entry criteria, steps, exit criteria, next phase reference
    - _Requirements: 13.3_

  - [x] 9.2 Create `workflows/draft-prd-sketch-modules.md`
    - Source: sketch modules phase from `skills/to-prd/SKILL.md`
    - Entry criteria, steps, exit criteria, next phase reference
    - _Requirements: 13.3_

  - [x] 9.3 Create `workflows/draft-prd-write-prd.md`
    - Source: write PRD phase from `skills/to-prd/SKILL.md`
    - Entry criteria, steps, exit criteria, next phase reference
    - _Requirements: 13.3_

- [ ] 10. Create workflow phase files for compose-issues (to-issues)
  - [x] 10.1 Create `workflows/compose-issues-gather-context.md`
    - Source: gather context phase from `skills/to-issues/SKILL.md`
    - _Requirements: 13.3_

  - [x] 10.2 Create `workflows/compose-issues-explore.md`
    - Source: explore phase from `skills/to-issues/SKILL.md`
    - _Requirements: 13.3_

  - [x] 10.3 Create `workflows/compose-issues-draft-slices.md`
    - Source: draft slices phase from `skills/to-issues/SKILL.md`
    - _Requirements: 13.3_

  - [x] 10.4 Create `workflows/compose-issues-quiz-user.md`
    - Source: quiz user phase from `skills/to-issues/SKILL.md`
    - _Requirements: 13.3_

  - [x] 10.5 Create `workflows/compose-issues-create-issues.md`
    - Source: create issues phase from `skills/to-issues/SKILL.md`
    - _Requirements: 13.3_

- [ ] 11. Create workflow phase files for plan-refactor (request-refactor-plan)
  - [x] 11.1 Create `workflows/plan-refactor-capture.md`
    - Source: capture phase from `skills/request-refactor-plan/SKILL.md`
    - _Requirements: 13.3_

  - [x] 11.2 Create `workflows/plan-refactor-explore.md`
    - Source: explore phase from `skills/request-refactor-plan/SKILL.md`
    - _Requirements: 13.3_

  - [x] 11.3 Create `workflows/plan-refactor-interview.md`
    - Source: interview phase from `skills/request-refactor-plan/SKILL.md`
    - _Requirements: 13.3_

  - [x] 11.4 Create `workflows/plan-refactor-scope.md`
    - Source: scope phase from `skills/request-refactor-plan/SKILL.md`
    - _Requirements: 13.3_

  - [x] 11.5 Create `workflows/plan-refactor-test-coverage.md`
    - Source: test coverage phase from `skills/request-refactor-plan/SKILL.md`
    - _Requirements: 13.3_

  - [x] 11.6 Create `workflows/plan-refactor-commit-plan.md`
    - Source: commit plan phase from `skills/request-refactor-plan/SKILL.md`
    - _Requirements: 13.3_

  - [x] 11.7 Create `workflows/plan-refactor-create-issue.md`
    - Source: create issue phase from `skills/request-refactor-plan/SKILL.md`
    - _Requirements: 13.3_

- [ ] 12. Create workflow phase files for triage-bug (triage-issue)
  - [x] 12.1 Create `workflows/triage-bug-capture.md`
    - Source: capture phase from `skills/triage-issue/SKILL.md`
    - _Requirements: 13.3_

  - [x] 12.2 Create `workflows/triage-bug-diagnose.md`
    - Source: diagnose phase from `skills/triage-issue/SKILL.md`
    - _Requirements: 13.3_

  - [x] 12.3 Create `workflows/triage-bug-fix-approach.md`
    - Source: fix approach phase from `skills/triage-issue/SKILL.md`
    - _Requirements: 13.3_

  - [x] 12.4 Create `workflows/triage-bug-tdd-plan.md`
    - Source: TDD plan phase from `skills/triage-issue/SKILL.md`
    - _Requirements: 13.3_

  - [x] 12.5 Create `workflows/triage-bug-create-issue.md`
    - Source: create issue phase from `skills/triage-issue/SKILL.md`
    - _Requirements: 13.3_

- [ ] 13. Create workflow phase files for design-interface (design-an-interface)
  - [x] 13.1 Create `workflows/design-interface-requirements.md`
    - Source: requirements phase from `skills/design-an-interface/SKILL.md`
    - _Requirements: 13.3_

  - [x] 13.2 Create `workflows/design-interface-generate.md`
    - Source: generate phase from `skills/design-an-interface/SKILL.md`
    - Replace "Task tool" parallel sub-agent references with Kiro `invokeSubAgent` with `general-task-execution`
    - _Requirements: 6.2, 13.3_

  - [x] 13.3 Create `workflows/design-interface-present.md`
    - Source: present phase from `skills/design-an-interface/SKILL.md`
    - _Requirements: 13.3_

  - [x] 13.4 Create `workflows/design-interface-compare.md`
    - Source: compare phase from `skills/design-an-interface/SKILL.md`
    - _Requirements: 13.3_

  - [x] 13.5 Create `workflows/design-interface-synthesize.md`
    - Source: synthesize phase from `skills/design-an-interface/SKILL.md`
    - _Requirements: 13.3_

- [ ] 14. Create workflow phase files for run-qa-session (qa)
  - [x] 14.1 Create `workflows/run-qa-session-listen.md`
    - Source: listen phase from `skills/qa/SKILL.md`
    - _Requirements: 13.3_

  - [x] 14.2 Create `workflows/run-qa-session-explore.md`
    - Source: explore phase from `skills/qa/SKILL.md`
    - _Requirements: 13.3_

  - [x] 14.3 Create `workflows/run-qa-session-scope.md`
    - Source: scope phase from `skills/qa/SKILL.md`
    - _Requirements: 13.3_

  - [x] 14.4 Create `workflows/run-qa-session-file-issue.md`
    - Source: file issue phase from `skills/qa/SKILL.md`
    - _Requirements: 13.3_

  - [x] 14.5 Create `workflows/run-qa-session-continue.md`
    - Source: continue phase from `skills/qa/SKILL.md`
    - _Requirements: 13.3_

- [ ] 15. Create workflow phase files for refactor-architecture (improve-codebase-architecture)
  - [x] 15.1 Create `workflows/refactor-architecture-explore.md`
    - Source: explore phase from `skills/improve-codebase-architecture/SKILL.md`
    - Replace "Agent tool with subagent_type=Explore" with Kiro `invokeSubAgent` with `context-gatherer`
    - _Requirements: 6.1, 13.3_

  - [x] 15.2 Create `workflows/refactor-architecture-present.md`
    - Source: present phase from `skills/improve-codebase-architecture/SKILL.md`
    - _Requirements: 13.3_

  - [x] 15.3 Create `workflows/refactor-architecture-grilling-loop.md`
    - Source: grilling loop phase from `skills/improve-codebase-architecture/SKILL.md`
    - _Requirements: 13.3_

- [ ] 16. Create workflow phase files for challenge-domain-model (domain-model)
  - [x] 16.1 Create `workflows/challenge-domain-model-setup.md`
    - Source: setup phase from `skills/domain-model/SKILL.md`
    - _Requirements: 13.3_

  - [x] 16.2 Create `workflows/challenge-domain-model-session.md`
    - Source: session phase from `skills/domain-model/SKILL.md`
    - _Requirements: 13.3_

  - [x] 16.3 Create `workflows/challenge-domain-model-update.md`
    - Source: update phase from `skills/domain-model/SKILL.md`
    - _Requirements: 13.3_

- [ ] 17. Create workflow phase files for author-knowledge (write-a-skill)
  - [x] 17.1 Create `workflows/author-knowledge-gather.md`
    - Source: gather phase from `skills/write-a-skill/SKILL.md`
    - Refocus on gathering requirements for a canonical knowledge artifact: what domain/task does it cover, what type (skill, power, workflow, prompt, etc.), what harnesses to target, any hooks or MCP servers needed.
    - The author skills should strive to maintain awareness of latest best practices for Kiro, Claude Code, Cursor, etc.
    - _Requirements: 13.3_

  - [x] 17.2 Create `workflows/author-knowledge-draft.md`
    - Source: draft phase from `skills/write-a-skill/SKILL.md`
    - Refocus on drafting the `knowledge.md` file: frontmatter with all FrontmatterSchema fields, markdown body with the artifact's content, optional workflows/ phase files for multi-step processes, optional hooks.yaml and mcp-servers.yaml
    - Include guidance that Skill Forge handles compilation — author focuses on canonical content, not harness-specific output
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 13.3_

  - [x] 17.3 Create `workflows/author-knowledge-review.md`
    - Source: review phase from `skills/write-a-skill/SKILL.md`
    - Refocus on validating the artifact: run `bun run dev validate`, run `bun run dev build` to compile, review output for each target harness, iterate with user
    - _Requirements: 12.6, 13.3_

- [ ] 18. Create workflow phase files for write-living-docs (new)
  - [x] 18.1 Create `workflows/write-living-docs-audit.md`
    - Audit phase: inventory existing documentation sources, identify authoritative vs derived/stale sources
    - Entry criteria, steps, exit criteria, next phase reference
    - _Requirements: 21.2, 21.3_

  - [x] 18.2 Create `workflows/write-living-docs-classify.md`
    - Classify phase: apply Martraire's three principles (long-period interest, large audience, valuable/critical), categorize as Evergreen/Living/Conversation, mark "do not document" items
    - _Requirements: 21.2, 21.4, 21.5_

  - [x] 18.3 Create `workflows/write-living-docs-harvest.md`
    - Harvest phase: extract documentation from authoritative sources (test names, type signatures, CONTEXT.md terms, ADRs, config files, code structure)
    - _Requirements: 21.2, 21.6_

  - [x] 18.4 Create `workflows/write-living-docs-compose.md`
    - Compose phase: assemble harvested knowledge — one source of truth per concept, annotate rationale, filter by audience, version snapshots
    - _Requirements: 21.2, 21.7_

  - [x] 18.5 Create `workflows/write-living-docs-reconcile.md`
    - Reconcile phase: verify derived docs are consistent with authoritative sources, flag drift, update or mark stale
    - _Requirements: 21.2, 21.8_

- [ ] 19. Create workflow phase files for review-changes (from review-ritual)
  - [x] 19.1 Create `workflows/review-changes-orient.md`
    - Orient phase: read PR description, skim full diff to understand scope and intent
    - _Requirements: 22.2, 22.3_

  - [x] 19.2 Create `workflows/review-changes-read.md`
    - Read phase: read changed tests first (they explain expected behavior), then read implementation
    - _Requirements: 22.2, 22.4_

  - [x] 19.3 Create `workflows/review-changes-comment.md`
    - Comment phase: classify findings using taxonomy — "must address" (blocks merge), "should address" (request but don't block), "nit" (style preferences)
    - _Requirements: 22.2, 22.5_

  - [x] 19.4 Create `workflows/review-changes-decide.md`
    - Decide phase: approve only when you could explain the code to a colleague, or request changes with specific actionable comments including proposed alternatives
    - _Requirements: 22.2, 22.6_

- [ ] 20. Create workflow phase files for journal-debug (from debug-journal)
  - [x] 20.1 Create `workflows/journal-debug-articulate.md`
    - Source: adapt from `skill-forge/knowledge/debug-journal/workflows/01-articulate.md`
    - Articulate phase: enforce three-sentence rule — (1) what I expected, (2) what actually happened, (3) what I already know it is not. Do NOT proceed until all three sentences written and at least one hypothesis ruled out
    - _Requirements: 24.2, 24.3_

  - [x] 20.2 Create `workflows/journal-debug-isolate.md`
    - Source: adapt from `skill-forge/knowledge/debug-journal/workflows/02-isolate.md`
    - Isolate phase: shrink problem surface using binary search, minimal reproduction, one-variable-at-a-time
    - _Requirements: 24.2, 24.4_

  - [x] 20.3 Create `workflows/journal-debug-fix-and-verify.md`
    - Source: adapt from `skill-forge/knowledge/debug-journal/workflows/03-fix-and-verify.md`
    - Fix and Verify phase: re-run reproduction case, check adjacent behavior, check for same mistake elsewhere, write regression test
    - _Requirements: 24.2, 24.5_

- [x] 21. Checkpoint — Verify all ~55 workflow phase files
  - Ensure all workflow phase files exist under `skill-forge/knowledge/codeshop/workflows/`
  - Verify each phase file has Entry Criteria, Steps, and Exit Criteria sections
  - Verify naming convention: `{skill-name}-{phase-name}.md`
  - Verify no relative file path links (no `../` patterns)
  - Count: drive-tests (4) + draft-prd (3) + compose-issues (5) + plan-refactor (7) + triage-bug (5) + design-interface (5) + run-qa-session (5) + refactor-architecture (3) + challenge-domain-model (3) + author-knowledge (3) + write-living-docs (5) + review-changes (4) + journal-debug (3) = 55 files
  - Ask the user if questions arise.

- [ ] 22. Build and validate the codeshop power
  - [x] 22.1 Run `bun run dev build --harness kiro` from `skill-forge/` to compile the codeshop artifact
    - Verify build produces: POWER.md, 19 steering files, ~55 phase files in steering/, hook files, no mcp.json
    - Fix any build errors (invalid frontmatter, missing workflow files, invalid hooks YAML)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 22.2 Run `bun run dev validate` from `skill-forge/` to validate the artifact
    - Verify codeshop passes all validation checks
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 22.3 Verify cross-reference integrity across all steering files
    - Grep all steering files and workflow phase files for `../` relative path patterns — must find zero matches
    - Verify all cross-references use verb-noun names in prose form
    - _Requirements: 4.5, 5.2, 5.3, 7.4_

  - [x] 22.4 Verify hook directive pattern compliance
    - Check all 8 hook prompts do NOT contain advisory anti-patterns ("keep in mind", "consider suggesting", "flag for the user", "you might want to")
    - Verify each hook prompt ends with a concrete action directive
    - _Requirements: 15.4_

  - [x] 22.5 Verify keyword specificity
    - Check keywords array contains all required terms from Req 17.3
    - Check keywords array does NOT contain banned broad terms: "writing", "skills", "code-review" (standalone), "tdd", "domain-model", "code", "development", "testing"
    - _Requirements: 17.1, 17.2, 17.3_

- [ ] 23. Testing and validation per Requirement 20
  - [x] 23.1 Write structural validation tests in `skill-forge/src/__tests__/codeshop-power.test.ts`
    - Test: knowledge.md has valid frontmatter (passes FrontmatterSchema)
    - Test: build produces expected file counts (19 steering files, ~55 phase files, hook files, no mcp.json)
    - Test: every phase file in workflows/ has Entry Criteria, Steps, Exit Criteria sections (Property 2)
    - Test: no steering file or phase file contains `../` relative path references (Property 1)
    - Test: all hook prompts follow directive pattern — no advisory anti-patterns (Property 3)
    - Test: keywords array contains required terms and excludes banned terms (Property 4)
    - Test: Skill Router references all 19 steering files
    - Test: every Workflow_Skill has ≥2 phase files; no Knowledge_Skill has phase files
    - Test: drive-tests.md contains inlined content from all 5 supplementary files
    - Test: refactor-architecture.md contains inlined content from all 3 supplementary files
    - Test: challenge-domain-model.md contains inlined content from CONTEXT-FORMAT.md and ADR-FORMAT.md
    - Test: review-changes.md contains reading order, comment taxonomy, and approval criteria
    - Test: craft-commits.md contains conventional commit format and anti-patterns
    - Test: journal-debug.md references three phase files and contains three-sentence rule
    - Test: POWER.md contains Companion Powers section listing adr, type-guardian, karpathy-mode
    - _Requirements: 20.1, 20.2, 20.4, 20.5, 20.6_

  - [x] 23.2 Run `bun test` from `skill-forge/` to verify all tests pass (including new codeshop tests)
    - All existing tests must continue to pass
    - All new codeshop structural validation tests must pass
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6_

- [x] 24. Final checkpoint — Ensure all tests pass and artifact builds cleanly
  - Run `bun test` and `bun run dev build --harness kiro` one final time
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All steering file content is authored as markdown — no programming language selection needed
- The codeshop artifact follows the standard Skill Forge knowledge artifact structure at `skill-forge/knowledge/codeshop/`
- Source skills are in the `skills/` workspace folder; catalog artifacts (review-ritual, commit-craft, debug-journal) are in `skill-forge/knowledge/`
- The Kiro adapter compiles `knowledge.md` + `hooks.yaml` + `workflows/` into the final power output in `dist/kiro/codeshop/`
- Phase files are copied to `steering/` during compilation, so they are loaded via `readSteering` at runtime
- Checkpoints ensure incremental validation throughout the process
- Tasks reference specific requirements for traceability across all 25 requirements
