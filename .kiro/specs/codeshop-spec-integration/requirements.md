# Requirements Document

## Introduction

This feature integrates the Codeshop power's developer workflows and hooks with Kiro's Spec Mode — the spec-driven development system that guides features through requirements, design, and task phases. The existing codeshop power (specified in the `codeshop-power` spec) provides 19 developer workflow skills and 8 canonical hooks. This integration makes those workflows contextually available during spec task execution by adding spec-aware hooks to the codeshop artifact's `hooks.yaml` and `harness-config.kiro.spec-hooks`, and by extending the `knowledge.md` Skill Router and Workflow Composition sections to document spec-mode integration points. The goal is to have codeshop workflows activate at the right moments during spec-driven development — TDD when implementing test tasks, code review after task completion, domain validation when tasks introduce new concepts — without requiring the developer to manually invoke them.

## Glossary

- **Spec_Mode**: Kiro's spec-driven development system that structures feature work into three phases: requirements, design, and tasks. Each phase produces a markdown document (requirements.md, design.md, tasks.md) in `.kiro/specs/{feature_name}/`.
- **Spec_Task**: A single work item in a spec's tasks.md file, executed by the agent one at a time. Tasks have statuses (not_started, in_progress, completed) and may have sub-tasks.
- **Spec_Phase**: One of the three stages of a spec: requirements gathering, design creation, or task execution.
- **Canonical_Hook**: A hook defined in `hooks.yaml` using the canonical event schema (`CanonicalEventSchema`) and compiled to harness-native format by the Kiro adapter.
- **Spec_Hook**: A Kiro-specific hook defined in `harness-config.kiro.spec-hooks` that bypasses canonical event translation and is emitted directly in Kiro's native hook format (with `when`/`then` structure).
- **preTaskExecution**: A Kiro hook event that fires before a spec task begins execution, providing the task description as context.
- **postTaskExecution**: A Kiro hook event that fires after a spec task completes execution.
- **Skill_Router**: The section of POWER.md (knowledge.md body) that maps user requests to steering files. Defined in the codeshop-power spec, Requirement 3.
- **Workflow_Composition**: The section of POWER.md that documents natural workflow chains. Defined in the codeshop-power spec, Requirement 18.
- **Bugfix_Spec**: A spec with `specType: "bugfix"` in its `.config.kiro` file, indicating the spec follows the bugfix workflow rather than the feature workflow.
- **Design_MD**: The design document produced during the design phase of a spec, located at `.kiro/specs/{feature_name}/design.md`.
- **Tasks_MD**: The task list produced during the task phase of a spec, located at `.kiro/specs/{feature_name}/tasks.md`.

## Requirements

### Requirement 1: Pre-Task TDD Hook for Test-Related Spec Tasks

**User Story:** As a developer executing spec tasks, I want the TDD workflow to activate automatically when a task involves writing or modifying tests, so that I follow test-driven development without having to remember to invoke it.

#### Acceptance Criteria

1. THE Codeshop power SHALL include a `preTaskExecution` hook that detects whether the current spec task description contains test-related keywords (test, spec, TDD, red-green, assertion, coverage, unit test, integration test, property test).
2. WHEN the hook detects a test-related task, THE hook prompt SHALL instruct the agent to read the `drive-tests` steering file from the codeshop power and apply the TDD red-green-refactor methodology to the task.
3. WHEN the hook detects a non-test-related task, THE hook prompt SHALL instruct the agent to proceed with the task normally without loading the TDD workflow.
4. THE hook SHALL be defined as a Spec_Hook in `harness-config.kiro.spec-hooks` because `preTaskExecution` is a Kiro-specific event that maps directly from the canonical `pre_task` event.

### Requirement 2: Post-Task Code Review Hook

**User Story:** As a developer, I want an automatic code review pass after each spec task completes, so that changes are validated before moving to the next task.

#### Acceptance Criteria

1. THE Codeshop power SHALL include a `postTaskExecution` hook that triggers after a spec task completes.
2. THE hook prompt SHALL instruct the agent to read the `review-changes` steering file from the codeshop power and perform a lightweight review of the changes made during the task.
3. THE hook prompt SHALL instruct the agent to classify findings using the review-changes taxonomy (must-address, should-address, nit) and report only must-address and should-address findings inline.
4. THE hook SHALL be defined as a Spec_Hook in `harness-config.kiro.spec-hooks` because `postTaskExecution` is a Kiro-specific event that maps directly from the canonical `post_task` event.

### Requirement 3: Post-Task Commit Guidance Hook

**User Story:** As a developer, I want commit message guidance after completing a spec task, so that each task's changes are committed with a well-crafted message that captures the rationale.

#### Acceptance Criteria

1. THE Codeshop power SHALL include a `postTaskExecution` hook that triggers after a spec task completes and suggests a commit message.
2. THE hook prompt SHALL instruct the agent to read the `craft-commits` steering file from the codeshop power and draft a conventional commit message for the changes made during the task.
3. THE hook prompt SHALL instruct the agent to include the spec task identifier in the commit message body for traceability.
4. THE hook SHALL be defined as a Spec_Hook in `harness-config.kiro.spec-hooks` because `postTaskExecution` is a Kiro-specific event.

### Requirement 4: Pre-Task Domain Validation Hook

**User Story:** As a developer, I want domain model validation to activate before tasks that introduce new types, interfaces, or bounded context changes, so that new concepts are consistent with the project's ubiquitous language.

#### Acceptance Criteria

1. THE Codeshop power SHALL include a `preTaskExecution` hook that detects whether the current spec task description involves new domain concepts (new type, new interface, new entity, new aggregate, bounded context, domain event, value object, new module, new model).
2. WHEN the hook detects a domain-concept task, THE hook prompt SHALL instruct the agent to read the `challenge-domain-model` steering file from the codeshop power and validate that the proposed concepts align with the project's existing domain model in CONTEXT.md and UBIQUITOUS_LANGUAGE.md.
3. WHEN the hook detects a non-domain task, THE hook prompt SHALL instruct the agent to proceed normally.
4. THE hook SHALL be defined as a Spec_Hook in `harness-config.kiro.spec-hooks` because `preTaskExecution` is a Kiro-specific event.

### Requirement 5: Pre-First-Task Plan Stress-Test Hook

**User Story:** As a developer, I want the plan stress-tested before the first spec task begins, so that design gaps are caught before implementation starts.

#### Acceptance Criteria

1. THE Codeshop power SHALL include a `preTaskExecution` hook that detects whether the current task is the first task in the spec (task 1 or task 1.1).
2. WHEN the hook detects the first task, THE hook prompt SHALL instruct the agent to read the `stress-test-plan` steering file from the codeshop power and perform a brief stress-test of the spec's design.md, surfacing any gaps or assumptions before implementation begins.
3. WHEN the hook detects a non-first task, THE hook prompt SHALL instruct the agent to skip the stress test and proceed normally.
4. THE hook SHALL be defined as a Spec_Hook in `harness-config.kiro.spec-hooks` because `preTaskExecution` is a Kiro-specific event.

### Requirement 6: Bugfix Spec Triage Context Hook

**User Story:** As a developer working on a bugfix spec, I want the triage-bug workflow context loaded automatically, so that the debugging methodology is available from the start.

#### Acceptance Criteria

1. THE Codeshop power SHALL include a `preTaskExecution` hook that detects whether the active spec is a Bugfix_Spec by checking for bugfix-related keywords in the task context (bugfix, bug, fix, regression, defect, broken).
2. WHEN the hook detects a bugfix context, THE hook prompt SHALL instruct the agent to read the `triage-bug` steering file from the codeshop power and apply the triage methodology (diagnose, find root cause, plan TDD fix) to the task.
3. WHEN the hook detects a non-bugfix context, THE hook prompt SHALL instruct the agent to proceed normally.
4. THE hook SHALL be defined as a Spec_Hook in `harness-config.kiro.spec-hooks` because `preTaskExecution` is a Kiro-specific event.

### Requirement 7: Existing Canonical Hooks Preserved

**User Story:** As a developer, I want the existing 8 canonical hooks in hooks.yaml to remain unchanged, so that the spec integration adds new hooks without breaking existing behavior.

#### Acceptance Criteria

1. THE existing 3 `user_triggered` hooks (Map Context, Define Glossary, Challenge Domain Model) in hooks.yaml SHALL remain unchanged.
2. THE existing 1 `pre_task` hook (Architectural Change Detection) in hooks.yaml SHALL remain unchanged.
3. THE existing 1 `agent_stop` hook (Unfiled Issue Reminder) in hooks.yaml SHALL remain unchanged.
4. THE existing 3 `file_edited` hooks (Domain Context File Guidance, ADR File Guidance, Glossary File Guidance) in hooks.yaml SHALL remain unchanged.
5. THE new spec-integration hooks SHALL be defined in `harness-config.kiro.spec-hooks` to avoid conflicts with the canonical hooks in hooks.yaml.

### Requirement 8: Spec-Hooks Schema in Harness Config

**User Story:** As a developer, I want the spec-hooks defined in a structured format within the Kiro harness-config, so that the Kiro adapter can compile them into native hook files alongside the canonical hooks.

#### Acceptance Criteria

1. THE codeshop knowledge artifact's `harness-config.kiro` section SHALL include a `spec-hooks` array containing the spec-integration hooks defined in Requirements 1-6.
2. EACH spec-hook entry SHALL follow the Kiro-native hook structure with `name`, `version`, `description`, `when` (containing `type` matching a Kiro event), and `then` (containing `type` and `prompt` for askAgent actions).
3. THE Kiro adapter SHALL compile each spec-hook entry into a separate `.kiro.hook` file, using the existing spec-hooks compilation path in the adapter.
4. EACH spec-hook file name SHALL be derived from the hook name in kebab-case (e.g., "TDD Task Detection" becomes `tdd-task-detection.kiro.hook`).

### Requirement 9: Skill Router Spec-Mode Section

**User Story:** As an AI agent, I want the Skill Router in POWER.md to document which codeshop workflows are relevant during spec-mode task execution, so that I understand the integration points without needing to parse hook definitions.

#### Acceptance Criteria

1. THE POWER_MD Skill_Router section SHALL include a "Spec Mode Integration" subsection after the existing skill category tables.
2. THE Spec Mode Integration subsection SHALL list each spec-aware hook with: the hook name, the Kiro event it fires on, the codeshop workflow it loads, and the detection criteria (what task characteristics trigger it).
3. THE Spec Mode Integration subsection SHALL note that these hooks fire automatically during spec task execution and do not require manual invocation.
4. THE Spec Mode Integration subsection SHALL document the precedence when multiple hooks could fire for the same task (e.g., a first task that is also test-related): the stress-test hook fires first for the first task, then the TDD hook fires for test-related content.

### Requirement 10: Workflow Composition Spec-Mode Chains

**User Story:** As an AI agent, I want the Workflow Composition section to document how codeshop workflows chain during spec-driven development, so that I can suggest the right workflow at each stage.

#### Acceptance Criteria

1. THE Workflow Composition section in POWER_MD SHALL include a "Spec-Driven Development Chain" documenting the flow: `stress-test-plan` (pre-first-task) → `drive-tests` (test tasks) → `review-changes` (post-task) → `craft-commits` (post-task).
2. THE Workflow Composition section SHALL include a "Spec Bugfix Chain" documenting the flow: `triage-bug` (bugfix spec tasks) → `journal-debug` (isolation) → `drive-tests` (TDD fix).
3. THE Workflow Composition section SHALL note that these chains are activated automatically by spec-hooks, unlike the manually-invoked chains documented in the existing Workflow Composition section.

### Requirement 11: Hook Prompt Directive Pattern

**User Story:** As a developer, I want all spec-hook prompts to follow the directive pattern established in the existing codeshop hooks, so that the agent takes concrete action rather than offering advisory suggestions.

#### Acceptance Criteria

1. EACH spec-hook prompt SHALL end with a concrete action the agent must take, following the directive pattern used by the existing canonical hooks (e.g., "Either load the architectural context and confirm it is applied, or confirm the task is non-architectural and proceed with implementation").
2. EACH spec-hook prompt SHALL include a conditional branch: one path for when the detection criteria match (load the workflow) and one path for when they do not match (proceed normally).
3. EACH spec-hook prompt SHALL reference the specific steering file to load by its verb-noun name (e.g., "Read the drive-tests steering file from the codeshop power").

### Requirement 12: Kiro Adapter Spec-Hooks Compilation Validation

**User Story:** As a developer, I want the spec-hooks to compile correctly through the existing Kiro adapter pipeline, so that the hooks are emitted as valid `.kiro.hook` files during build.

#### Acceptance Criteria

1. WHEN the Kiro adapter processes the codeshop artifact, THE adapter SHALL emit one `.kiro.hook` file for each entry in `harness-config.kiro.spec-hooks`.
2. EACH emitted `.kiro.hook` file SHALL contain valid JSON matching the Kiro hook schema (name, version, description, when, then).
3. THE emitted hook files SHALL have names derived from the hook name in kebab-case format.
4. THE spec-hook files SHALL be emitted alongside (not replacing) the hook files generated from the canonical hooks in hooks.yaml.
