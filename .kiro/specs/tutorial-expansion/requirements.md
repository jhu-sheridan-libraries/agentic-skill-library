# Requirements Document

## Introduction

This specification covers the expansion of the existing Kanon tutorial knowledge artifacts to introduce foundational concepts about AI coding agents, skills, and harnesses from a user's perspective. It also defines a "Self-paced Module on Coding Agents and Skill Creation" that provides Johns Hopkins University Libraries staff — many of whom lack development backgrounds — with structured learning content covering what coding agents are, how skills augment them, and how to create custom skills using Kanon.

The existing tutorial (`kanon/knowledge/kanon/workflows/tutorial.md`) focuses exclusively on CLI commands but does not explain the conceptual foundations. This expansion fills that gap by prepending introductory lessons and adding a standalone self-paced learning module.

## Glossary

- **Tutorial**: The sequential walkthrough document at `kanon/knowledge/kanon/workflows/tutorial.md` that teaches Kanon capabilities through numbered lessons.
- **Coding_Agent**: An AI-powered coding assistant (such as Kiro, Claude Code, Copilot, Cursor, Windsurf, Cline, or Q Developer) that operates within a development environment and responds to instructions, context, and rules.
- **Skill**: A knowledge artifact of type "skill" that packages domain expertise, coding standards, or process knowledge into a format that a Coding_Agent can consume to augment its behavior.
- **Harness**: The target AI coding assistant platform (e.g., Kiro, Claude Code, Copilot) for which Kanon compiles artifacts into platform-specific file formats.
- **Knowledge_Artifact**: A structured Markdown file with YAML frontmatter that encapsulates expertise in a canonical format, compilable to multiple Harnesses.
- **Module**: The self-paced learning document titled "Self-paced Module on Coding Agents and Skill Creation" that provides structured educational content with learning outcomes.
- **Learner**: A Johns Hopkins University Libraries staff member or collaborator who uses the Tutorial or Module to learn about Coding_Agents and Skill creation.
- **Authoring_Guide**: The existing guide at `kanon/knowledge/kanon/workflows/authoring.md` that explains how to create a Knowledge_Artifact from scratch.

## Requirements

### Requirement 1: Introduce Coding Agents Concept

**User Story:** As a Learner, I want an introductory lesson explaining what coding agents are and how they work, so that I understand the technology before learning to create skills for it.

#### Acceptance Criteria

1. WHEN a Learner begins the Tutorial, THE Tutorial SHALL present a lesson titled "What Are Coding Agents?" before any CLI command lessons.
2. THE Tutorial SHALL define a Coding_Agent as an AI-powered assistant that operates within a development environment and responds to instructions and context, and SHALL define the terms "context," "Skill," and "Harness" using analogies or plain-language descriptions that contain no programming syntax or code snippets.
3. THE Tutorial SHALL list at least five supported Harnesses by name (Kiro, Claude Code, Copilot, Cursor, Windsurf, Cline, Q Developer).
4. THE Tutorial SHALL describe how a Coding_Agent uses loaded context to influence its responses by providing a plain-language description that contains no programming syntax, no code snippets, and no references to APIs or command-line operations.
5. THE Tutorial SHALL include at least one example showing a Coding_Agent receiving a Skill and producing different behavior because of the loaded context, where the example presents a named before-state (agent behavior without the Skill) and a named after-state (agent behavior with the Skill) and uses no programming syntax or code snippets.

### Requirement 2: Introduce Skills and Artifact Types

**User Story:** As a Learner, I want a lesson explaining what skills are and how they relate to other artifact types, so that I understand what I will be creating when I author a knowledge artifact.

#### Acceptance Criteria

1. WHEN a Learner reaches the skills introduction lesson, THE Tutorial SHALL define a Skill as a Knowledge Artifact that packages domain expertise into a format loadable into the context window of a supported AI coding assistant.
2. THE Tutorial SHALL present all eight artifact types (skill, power, rule, workflow, agent, prompt, template, reference-pack) with a description of each that is no longer than one sentence and no more than 150 characters, where each description states a distinct purpose not duplicated by any other type's description.
3. THE Tutorial SHALL explain when a Learner should choose the "skill" type versus other artifact types by presenting at least two decision criteria, where each criterion identifies an observable characteristic of the user's use case (e.g., "knowledge applies broadly across files" vs. "knowledge is a step-by-step process") that maps to exactly one artifact type.
4. THE Tutorial SHALL provide at least two real-world scenarios relevant to Johns Hopkins University Libraries staff (e.g., metadata standards, cataloging conventions) where each scenario states the Learner's goal, identifies why "skill" is the correct artifact type, and names at least one alternative type that would be incorrect along with the reason it does not apply.
5. THE Tutorial SHALL include at least one example of a common misclassification where a Learner might incorrectly choose "skill" and explain which alternative artifact type is correct and why.

### Requirement 3: Explain Harnesses from a User Perspective

**User Story:** As a Learner, I want a lesson explaining what harnesses are and how they affect my experience as an artifact author, so that I understand why Kanon compiles to multiple formats.

#### Acceptance Criteria

1. WHEN a Learner reaches the harness explanation lesson, THE Tutorial SHALL define a Harness as the target AI coding assistant platform for which Kanon produces compiled output.
2. THE Tutorial SHALL explain the "author once, compile to many" principle using only concepts already introduced in prior lessons, without referencing internal pipeline stages, source code, or file-system paths.
3. THE Tutorial SHALL list all currently supported Harnesses by name (Kiro, Claude Code, Copilot, Cursor, Windsurf, Cline, Amazon Q Developer) so the Learner can identify which targets are available.
4. THE Tutorial SHALL present a side-by-side comparison showing the same Knowledge_Artifact compiled for at least 2 different Harnesses, identifying for each Harness the output format category (e.g., "steering files" for Kiro, "CLAUDE.md" for Claude Code) so the Learner can observe that a single source produces distinct per-harness outputs.
5. THE Tutorial SHALL state explicitly that artifact authors do not need to learn any Harness-specific syntax, configuration, or tooling because Kanon handles all format translation automatically.

### Requirement 4: Getting Started with Skill Creation

**User Story:** As a Learner, I want a lesson that bridges the conceptual introduction into hands-on skill creation, so that I feel confident starting the authoring process.

#### Acceptance Criteria

1. WHEN a Learner reaches the skill creation bridge lesson, THE Tutorial SHALL present an opening statement that names the concepts already covered (Coding_Agents, Skills, Harnesses) and states that the lesson transitions into practical artifact authoring steps.
2. THE Tutorial SHALL describe the three main steps of creating a Skill — scaffolding, editing content, and building — and reference each to its corresponding existing Tutorial lesson: scaffolding to Lesson 5, editing to Lesson 6, and building to Lesson 8.
3. THE Tutorial SHALL include a "You Are Ready" checklist containing 3 to 5 items, where each item is phrased as a self-assessable statement beginning with "I can…" (e.g., "I can explain what a Coding_Agent is," "I can name at least one Harness," "I can describe what a Skill does for a Coding_Agent").
4. THE Tutorial SHALL direct the Learner to both the Authoring_Guide and the existing Lesson 5 (Scaffolding a New Artifact) as next steps, naming each by title.

### Requirement 5: Self-Paced Module Abstract

**User Story:** As a Learner, I want a clear abstract for the self-paced module, so that I understand what the module covers and whether it is relevant to my needs.

#### Acceptance Criteria

1. THE Module SHALL include an Abstract section, appearing as the first content section of the module, that summarizes the module content in 50 to 150 words.
2. THE Module Abstract SHALL state that the module covers three topics: what Coding_Agents are, how Skills augment Coding_Agent behavior, and how to create custom Skills using Kanon.
3. THE Module Abstract SHALL identify Johns Hopkins University Libraries staff as the primary audience.
4. THE Module Abstract SHALL state that no prior programming experience is required.
5. THE Module Abstract SHALL state the estimated completion time for the module in minutes.

### Requirement 6: Self-Paced Module Learning Outcomes

**User Story:** As a Learner, I want clearly defined learning outcomes, so that I know what I will be able to do after completing the module.

#### Acceptance Criteria

1. THE Module SHALL include a Learning Outcomes section listing between 5 and 8 outcomes, each beginning with an action verb from Bloom's taxonomy levels 1 through 4 (Remember, Understand, Apply, Analyze).
2. THE Module Learning Outcomes SHALL include the ability to explain what a Coding_Agent is and name at least three examples.
3. THE Module Learning Outcomes SHALL include the ability to distinguish a Skill from other artifact types (power, rule, workflow, agent, prompt, template, reference-pack) by identifying at least two differentiating characteristics per artifact type.
4. THE Module Learning Outcomes SHALL include the ability to describe the three-stage pipeline (parse, adapt, write) by which a Harness consumes a compiled Skill.
5. THE Module Learning Outcomes SHALL include the ability to scaffold, edit, validate, and build a new Skill using the Kanon CLI.
6. THE Module Learning Outcomes SHALL include the ability to identify at least one use case for a custom Skill within JHU Libraries workflows such as cataloging, metadata creation, or collection management.
7. THE Module SHALL provide a self-assessment checklist mapping each learning outcome to at least one observable demonstration activity that a learner can complete to verify attainment.

### Requirement 7: Self-Paced Module Format

**User Story:** As a Learner, I want to know how the module is delivered, so that I can plan my time and understand what interaction is expected.

#### Acceptance Criteria

1. THE Module SHALL include a Format section that contains all delivery-related information specified in criteria 2 through 7.
2. THE Module Format section SHALL state that the module is self-paced and can be completed without an instructor.
3. THE Module Format section SHALL state that all exercises use the Kanon CLI in a local development environment and that the learner is expected to run CLI commands in a terminal.
4. THE Module Format section SHALL specify an estimated completion time range expressed in hours (e.g., "2–4 hours"), where the minimum is at least 1 hour and the maximum is no greater than 20 hours.
5. THE Module Format section SHALL state that the module is structured as sequential lessons with a checkpoint after each section, where each checkpoint is a hands-on exercise or self-assessment question that the learner completes before proceeding.
6. THE Module Format section SHALL state that the module content is delivered as a Markdown-based Knowledge_Artifact within the Kanon repository.
7. THE Module Format section SHALL state the assumed prerequisites, including familiarity with a command-line terminal and a working local installation of the Kanon CLI toolchain (Bun runtime and the Kanon package).

### Requirement 8: Tutorial Structural Integrity

**User Story:** As a Learner, I want the expanded tutorial to maintain its existing structure and navigation, so that the new introductory content integrates seamlessly without breaking existing lesson references.

#### Acceptance Criteria

1. WHEN new introductory lessons are added, THE Tutorial SHALL update the Table of Contents to list every lesson in sequential order, where each entry's anchor link matches the corresponding lesson heading ID.
2. WHEN new introductory lessons are added, THE Tutorial SHALL renumber all subsequent lessons so that the sequence remains contiguous starting from 1 with no gaps or duplicates.
3. THE Tutorial SHALL maintain the existing lesson format (Goal statement, content, Checkpoint, Next link) for all new lessons.
4. THE Tutorial SHALL preserve all existing lesson content—including instructional prose, code snippets, examples, and checkpoint questions—without modification, allowing only changes to lesson numbers, heading IDs, and navigational links.
5. IF a Learner navigates to an existing lesson by its original topic name via the Table of Contents or Lesson Index, THEN THE Tutorial SHALL display the lesson containing that same topic content at its updated number.
6. WHEN new introductory lessons are added, THE Tutorial SHALL update the Lesson Index by command so that each command entry references the correct renumbered lesson.
7. WHEN lessons are renumbered, THE Tutorial SHALL update every "Next" link within each lesson to reference the immediately following lesson in the new sequence.
