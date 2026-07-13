# Implementation Plan: Tutorial Expansion

## Overview

This plan implements the expansion of the Kanon tutorial with four new introductory lessons on coding agents, skills, and harnesses, creates a standalone self-paced learning module, updates `knowledge.md`, and adds property-based validation tests using fast-check/TypeScript. All primary deliverables are Markdown content; tests are TypeScript using the Bun runtime.

## Tasks

- [x] 1. Write Lesson 1: What Are Coding Agents?
  - [x] 1.1 Author the full content of Lesson 1 in `kanon/knowledge/kanon/workflows/tutorial.md`
    - Insert as the first lesson section (after the existing "How to Use This Tutorial" and ToC/Index sections)
    - Include `## Lesson 1: What Are Coding Agents?` heading
    - Include `**Goal:**` statement about understanding coding agents and context
    - Define Coding_Agent via analogy (no code, no CLI, no API references)
    - Define context, Skill, and Harness in plain language
    - List at least 5 supported harnesses by name (Kiro, Claude Code, Copilot, Cursor, Windsurf, Cline, Q Developer)
    - Describe how a Coding_Agent uses loaded context to influence responses (plain language only)
    - Include before/after example showing agent behavior with and without a Skill
    - Include `### Checkpoint` with self-assessment checklist items
    - Include `**Next:** [Lesson 2](#lesson-2-understanding-skills-and-artifact-types)` link
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Write Lesson 2: Understanding Skills and Artifact Types
  - [x] 2.1 Author the full content of Lesson 2 in `kanon/knowledge/kanon/workflows/tutorial.md`
    - Insert after Lesson 1
    - Include `## Lesson 2: Understanding Skills and Artifact Types` heading
    - Include `**Goal:**` statement about learning what skills are and how they differ from other artifact types
    - Define Skill as a Knowledge Artifact that packages domain expertise for AI assistant context windows
    - Present all 8 artifact types (skill, power, rule, workflow, agent, prompt, template, reference-pack) in a table with ≤150-char single-sentence descriptions, each with distinct purpose
    - Include at least 2 decision criteria for choosing "skill" vs other types, based on observable use-case characteristics
    - Include at least 2 JHU Libraries scenarios (e.g., metadata standards, cataloging conventions) with goal, why "skill" is correct, and one incorrect alternative with explanation
    - Include at least 1 common misclassification example with correct alternative and reasoning
    - Include `### Checkpoint` with self-assessment checklist items
    - Include `**Next:** [Lesson 3](#lesson-3-how-harnesses-work)` link
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. Write Lesson 3: How Harnesses Work
  - [x] 3.1 Author the full content of Lesson 3 in `kanon/knowledge/kanon/workflows/tutorial.md`
    - Insert after Lesson 2
    - Include `## Lesson 3: How Harnesses Work` heading
    - Include `**Goal:**` statement about understanding why Kanon compiles to multiple formats
    - Define Harness as the target AI coding assistant platform
    - Explain "author once, compile to many" principle using only concepts from Lessons 1-2
    - List all currently supported harnesses (Kiro, Claude Code, Copilot, Cursor, Windsurf, Cline, Amazon Q Developer)
    - Include side-by-side comparison of same artifact compiled for at least 2 different harnesses, identifying output format category for each (e.g., "steering files" for Kiro, "CLAUDE.md" for Claude Code)
    - State explicitly that authors do not need to learn harness-specific syntax
    - No internal pipeline references, no file-system paths, no source code
    - Include `### Checkpoint` with self-assessment checklist items
    - Include `**Next:** [Lesson 4](#lesson-4-getting-started-with-skill-creation)` link
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Write Lesson 4: Getting Started with Skill Creation
  - [x] 4.1 Author the full content of Lesson 4 in `kanon/knowledge/kanon/workflows/tutorial.md`
    - Insert after Lesson 3
    - Include `## Lesson 4: Getting Started with Skill Creation` heading
    - Include `**Goal:**` statement about bridging concepts to hands-on authoring
    - Opening statement naming Coding_Agents, Skills, and Harnesses as concepts already covered, stating transition to practical steps
    - Describe three main steps of creating a Skill (scaffolding, editing, building) with references to Lesson 9 (was 5), Lesson 10 (was 6), and Lesson 12 (was 8) respectively
    - Include "You Are Ready" checklist with 3-5 items phrased as "I can…" statements
    - Direct Learner to both the Authoring_Guide and Lesson 9 (Scaffolding a New Artifact) as next steps
    - Include `### Checkpoint` with self-assessment checklist items
    - Include `**Next:** [Lesson 5](#lesson-5-setup--verification)` link
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 5. Renumber existing lessons and update all navigation
  - [x] 5.1 Renumber all existing lessons by +4 offset in `kanon/knowledge/kanon/workflows/tutorial.md`
    - Change `## Lesson 1: Setup & Verification` → `## Lesson 5: Setup & Verification`
    - Change `## Lesson 2: The Guided Tutorial Command` → `## Lesson 6: The Guided Tutorial Command`
    - Continue through `## Lesson 16: Next Steps` → `## Lesson 20: Next Steps`
    - Update all heading IDs to match new numbers (e.g., `lesson-5-setup--verification`)
    - _Requirements: 8.2, 8.4_

  - [x] 5.2 Update Table of Contents to include all 20 lessons
    - Add 4 new rows for Lessons 1-4 at the top of the ToC table
    - Update the 16 existing rows with new lesson numbers (5-20)
    - Ensure every anchor link matches the corresponding lesson heading ID
    - Verify contiguous numbering 1-20 with no gaps or duplicates
    - _Requirements: 8.1, 8.2_

  - [x] 5.3 Update Lesson Index (by Command) with renumbered references
    - Update all command → lesson mappings by +4 offset
    - `kanon build` → Lesson 12 (was Lesson 8)
    - `kanon catalog *` → Lesson 7 (was Lesson 3)
    - `kanon collection *` → Lesson 15 (was Lesson 11)
    - `kanon eval` → Lesson 16 (was Lesson 12)
    - `kanon guild *` → Lesson 19 (was Lesson 15)
    - `kanon import` → Lesson 8 (was Lesson 4)
    - `kanon install` → Lesson 14 (was Lesson 10)
    - `kanon new` → Lesson 9 (was Lesson 5)
    - `kanon publish` → Lesson 17 (was Lesson 13)
    - `kanon temper` → Lesson 13 (was Lesson 9)
    - `kanon tutorial` → Lesson 6 (was Lesson 2)
    - `kanon upgrade` → Lesson 18 (was Lesson 14)
    - `kanon validate` → Lesson 11 (was Lesson 7)
    - Do not add Lessons 1-4 to the index (they contain no commands)
    - _Requirements: 8.6_

  - [x] 5.4 Update all Next links to form contiguous chain from Lesson 1 through Lesson 20
    - Lesson 4 Next → Lesson 5 (bridges new content to existing CLI lessons)
    - Lessons 5-19 Next links all shift to point to N+1
    - Lesson 20 has no Next link (final lesson)
    - Verify every Next link's anchor matches the target lesson's heading ID
    - _Requirements: 8.7_

  - [x] 5.5 Update the introductory text in "How to Use This Tutorial" section
    - Update lesson count from 16 to 20
    - Update the topic list to mention introductory conceptual content before CLI lessons
    - _Requirements: 8.4_

- [x] 6. Checkpoint - Verify tutorial structural integrity
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Create the Self-Paced Module document
  - [x] 7.1 Create `kanon/knowledge/kanon/workflows/self-paced-module.md` with complete content
    - Include document title: `# Self-paced Module on Coding Agents and Skill Creation`
    - Include `## Abstract` section (50-150 words) covering: what Coding_Agents are, how Skills augment agent behavior, how to create custom Skills using Kanon; identify JHU Libraries staff as audience; state no prior programming required; state estimated completion time in minutes
    - Include `## Learning Outcomes` section with 5-8 outcomes each starting with Bloom's taxonomy verb (levels 1-4: Remember, Understand, Apply, Analyze)
    - Outcomes must include: explain Coding_Agents + 3 examples; distinguish Skill from other types; describe three-stage pipeline (parse, adapt, write); scaffold/edit/validate/build a Skill; identify JHU use case for custom Skill
    - Include `## Self-Assessment Checklist` mapping each outcome to ≥1 observable demonstration activity
    - Include `## Format` section stating: self-paced, no instructor needed; CLI exercises in local dev environment; time range 2-4 hours; sequential with checkpoints; delivered as Markdown Knowledge_Artifact; prerequisites (command-line familiarity, Bun + Kanon installed)
    - Include `## Module Lessons` with subsections for each module lesson (6 lessons as per design)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 8. Update knowledge.md
  - [x] 8.1 Update `kanon/knowledge/kanon/knowledge.md` to reference the new module
    - Add new row to "Available Steering Files" table for `self-paced-module` with trigger `/module` and description
    - Update the tutorial row description to reflect 20 lessons and mention introductory conceptual content
    - Update the lesson count in the "Using the Tutorial" section from 16 to 20
    - Update the topic list (add agents, skills, harnesses before the existing CLI topics)
    - _Requirements: 5.1 (discoverability), 8.2 (accurate count)_

- [x] 9. Checkpoint - Verify all content is complete and cross-referenced
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Write property-based validation tests
  - [ ]* 10.1 Set up test file and imports for property-based validation
    - Create test file (e.g., `kanon/tests/tutorial-expansion.property.test.ts`)
    - Import fast-check, Bun test runner, and a Markdown parser (e.g., remark/unified or regex-based parsing)
    - Set up file reading utilities to load `tutorial.md` and `self-paced-module.md`
    - _Requirements: 8.1, 8.2_

  - [ ]* 10.2 Write property test: Conceptual lessons contain no code (Property 1)
    - **Property 1: Conceptual lessons contain no code**
    - For each of Lessons 1-4, verify no Markdown code fences (triple backticks), no inline code (single backticks), no CLI command patterns (`bun run`, `kanon`, `npm`)
    - **Validates: Requirements 1.2, 1.4, 1.5**

  - [ ]* 10.3 Write property test: Artifact type descriptions are concise and singular (Property 2)
    - **Property 2: Artifact type descriptions are concise and singular**
    - Parse the artifact types table in Lesson 2, verify each description is ≤150 characters and contains exactly one sentence
    - **Validates: Requirements 2.2**

  - [ ]* 10.4 Write property test: Checklist items use self-assessable phrasing (Property 3)
    - **Property 3: Checklist items use self-assessable phrasing**
    - Parse the "You Are Ready" checklist in Lesson 4, verify each item starts with "I can" and count is between 3 and 5 inclusive
    - **Validates: Requirements 4.3**

  - [ ]* 10.5 Write property test: Module abstract word count is within bounds (Property 4)
    - **Property 4: Module abstract word count is within bounds**
    - Parse the Abstract section of self-paced-module.md, verify word count is between 50 and 150 inclusive
    - **Validates: Requirements 5.1**

  - [ ]* 10.6 Write property test: Learning outcomes use Bloom's taxonomy verbs (Property 5)
    - **Property 5: Learning outcomes use Bloom's taxonomy verbs**
    - Parse the Learning Outcomes section, verify each outcome starts with a recognized Bloom's taxonomy verb (levels 1-4) and count is between 5 and 8
    - **Validates: Requirements 6.1**

  - [ ]* 10.7 Write property test: Learning outcomes have demonstration activities (Property 6)
    - **Property 6: Learning outcomes have demonstration activities**
    - Parse Learning Outcomes and Self-Assessment Checklist, verify each outcome maps to ≥1 demonstration activity
    - **Validates: Requirements 6.7**

  - [ ]* 10.8 Write property test: Table of Contents anchor integrity (Property 7)
    - **Property 7: Table of Contents anchor integrity**
    - Parse ToC entries and lesson headings, verify every ToC anchor resolves to a heading and every heading has a ToC entry
    - **Validates: Requirements 8.1, 8.5**

  - [ ]* 10.9 Write property test: Contiguous lesson numbering (Property 8)
    - **Property 8: Contiguous lesson numbering**
    - Extract all `## Lesson N` headings, verify they form contiguous sequence starting at 1 with no gaps/duplicates, count matches total lessons
    - **Validates: Requirements 8.2**

  - [ ]* 10.10 Write property test: Lesson format consistency (Property 9)
    - **Property 9: Lesson format consistency**
    - For each lesson, verify presence of: `**Goal:**` statement, ≥1 subsection, `### Checkpoint` with ≥1 checklist item, `**Next:**` link (except final lesson)
    - **Validates: Requirements 8.3**

  - [ ]* 10.11 Write property test: Command index references correct lessons (Property 10)
    - **Property 10: Command index references correct lessons**
    - For each command in Lesson Index, verify the referenced lesson contains instructional content about that command
    - **Validates: Requirements 8.6**

  - [ ]* 10.12 Write property test: Next-link chain integrity (Property 11)
    - **Property 11: Next-link chain integrity**
    - For each lesson N (not final), verify Next link points to heading ID of lesson N+1
    - **Validates: Requirements 8.7**

- [x] 11. Final checkpoint - Ensure all tests pass and integration is complete
  - Ensure all tests pass, ask the user if questions arise.
  - Verify `kanon build` compiles the expanded tutorial without errors
  - Verify all cross-references between tutorial.md, self-paced-module.md, and knowledge.md are consistent

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The primary deliverables are Markdown content files — no compiled code is produced
- Property-based tests use TypeScript with fast-check on the Bun runtime
- Each new lesson (1-4) must contain zero code (no backticks, no CLI patterns) per design constraint
- The renumbering offset is exactly +4 for all existing lessons
- Lesson 4 references renumbered lesson numbers (Lesson 9 for scaffolding, Lesson 10 for editing, Lesson 12 for building)
- The self-paced module is a standalone document complementing (not duplicating) tutorial Lessons 1-4
- All tests validate the final Markdown structure, not intermediate states

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["4.1"] },
    { "id": 4, "tasks": ["5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "5.4", "5.5"] },
    { "id": 6, "tasks": ["7.1", "8.1"] },
    { "id": 7, "tasks": ["10.1"] },
    { "id": 8, "tasks": ["10.2", "10.3", "10.4", "10.5", "10.6", "10.7", "10.8", "10.9", "10.10", "10.11", "10.12"] }
  ]
}
```
