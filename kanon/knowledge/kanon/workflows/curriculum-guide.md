# Kanon Curriculum Guide for Johns Hopkins Libraries Staff

## Purpose

This guide connects the Kanon tutorial, self-paced course, authoring guide, and command reference into one staff learning program. It is intended for course coordinators, team leads, peer mentors, and learners who want to choose an appropriate path.

The curriculum prepares staff to make informed decisions about knowledge artifacts and to create a small practice skill. It does not authorize the use of a coding agent with restricted information or certify that an artifact is ready for production. Units should apply their current data, privacy, records, accessibility, licensing, and tool-use requirements.

## Audience

The primary audience is Johns Hopkins Libraries staff with subject expertise who may have little or no programming experience. Learners should be able to:

- open a terminal;
- navigate to a known folder;
- edit and save a text file; and
- ask for help when a command or technical term is unfamiliar.

Staff who will maintain adapters, schemas, integrations, or release infrastructure need additional developer onboarding beyond this curriculum.

## Curriculum Components

| Component | Primary Use | Learner Product |
|-----------|-------------|-----------------|
| [Kanon Tutorial](tutorial.md) | Sequential introduction to concepts and every major CLI capability | Completed lesson checkpoints and command practice |
| [Self-Paced Course](self-paced-module.md) | Structured 3–4 hour learning experience focused on skill creation | A validated, built practice skill and capstone review |
| [Authoring Guide](authoring.md) | Reference while drafting or revising an artifact | Correct canonical structure and frontmatter |
| [Commands Reference](commands.md) | Just-in-time syntax lookup | Correct command and option selection |

## Recommended Learning Paths

### Path A: Conceptual Orientation

Use this path for staff who need to understand Kanon but will not author an artifact yet.

1. Complete Tutorial Lessons 1–4.
2. Discuss one possible Libraries use case and one reason it may not be suitable.
3. Review the data-protection and human-review guidance in the self-paced course's “Before You Begin” section.

**Completion evidence:** The learner can explain coding agents, skills, harnesses, and one human-review responsibility in plain language.

### Path B: First Skill

Use this as the default authoring path.

1. Complete the full [Self-Paced Course](self-paced-module.md).
2. Use the Authoring Guide when a field or artifact structure needs clarification.
3. Record the capstone score and at least one revision.
4. Review the practice artifact with a peer.

**Completion evidence:** The learner produces a practice skill that passes standard and security validation, builds for a selected harness, and meets the capstone threshold.

### Path C: Kanon Contributor

Use this path for staff who will manage artifacts, collections, evaluations, publishing, or team distribution.

1. Complete Path B.
2. Continue through Tutorial Lessons 7–20.
3. Practice catalog generation, strict builds, evaluation, and a dry-run publish in a nonproduction environment.
4. Complete the optional [Souk Compass Practice](souk-compass-practice.md) if the team uses an approved semantic-search environment.
5. Read the repository contribution and change-management guidance before proposing a production change.

**Completion evidence:** The learner can explain where canonical sources, generated output, catalog data, tests, and change records belong.

## Program Learning Outcomes

After completing Path B, learners should be able to:

1. explain how instructions and context affect coding-agent responses;
2. select an artifact type that fits an observable use case;
3. describe how Kanon compiles one canonical source for selected harnesses;
4. scaffold, edit, validate, and build a practice skill;
5. protect sensitive and unapproved information during authoring and testing;
6. design representative behavior tests; and
7. document human review and revision.

Path C adds operational outcomes for cataloging, installation, collections, evaluation, publishing, upgrades, team distribution, and optional semantic-search retrieval evaluation.

## Curriculum Map

| Outcome | Tutorial | Self-Paced Course | Assessment Evidence |
|---------|----------|-------------------|---------------------|
| Explain agents and context | Lessons 1 and 4 | Lesson 1 | Plain-language explanation and limitation |
| Select an artifact type | Lesson 2 | Lesson 2 | Scenario classification and use-case canvas |
| Explain harnesses and compilation | Lesson 3 | Lesson 3 | Parse-adapt-write model |
| Scaffold an artifact | Lessons 5, 6, and 9 | Lesson 4 | Generated artifact directory |
| Write and validate content | Lessons 10 and 11 | Lesson 5 | Review notes and passing validation |
| Build and inspect output | Lessons 12 and 13 | Lesson 6 | Generated harness output and comparison |
| Plan distribution and stewardship | Lessons 14–20 | Lessons 2 and 6 | Named owner, review trigger, and next-step plan |
| Evaluate semantic search (optional) | Lessons 10 and 16 | Souk Compass Practice | Approved retrieval test set and source-review notes |

## Suggested Delivery Sequence

The course works independently, but a cohort can use the following sequence:

### Before the Session

The coordinator should:

- confirm that learners have a writable practice copy of the repository;
- confirm that Bun and repository dependencies are available;
- identify a technical contact for setup problems;
- provide an approved location for learning notes;
- remind learners not to use production data or restricted documents; and
- decide whether the cohort will build for Kiro, Codex, or another supported harness.

Do not distribute an invented local standard as if it were an official Libraries policy. The course's sample metadata content is labeled as practice material for this reason.

### During the Session

For a facilitated cohort, use short demonstrations followed by independent practice:

1. Discuss agents, context, and limits.
2. Classify the three artifact scenarios.
3. Trace one artifact through parse, adapt, and write.
4. Demonstrate the scaffold command once.
5. Give learners time to write and validate their own practice copy.
6. Build one harness together and compare outputs.
7. End with peer review using the capstone rubric.

Avoid live demonstrations that require learners to copy passwords, tokens, private URLs, or restricted content into a terminal or agent conversation.

### After the Session

Ask learners to save:

- the completed use-case canvas;
- the practice artifact or its approved repository location;
- validation and build results;
- the capstone rubric;
- the revision made after review; and
- one follow-up question.

Course coordinators may collect completion evidence, but should not collect sensitive work samples merely to document attendance.

## Practice Content Design

### Use Small, Observable Tasks

A first exercise should have:

- one intended audience;
- one narrow domain;
- a short set of reviewed instructions;
- at least one explicit exclusion;
- a typical test case;
- a missing-information case; and
- a boundary case.

The learner should be able to inspect the output and decide whether each instruction was followed. Broad goals such as “know everything about cataloging” are not testable first projects.

### Use Invented or Approved Examples

Safe practice material can include:

- invented titles, dates, and descriptions;
- public-domain examples whose reuse is confirmed;
- generic process examples that do not reproduce internal policy; or
- source text that the content owner has approved for training.

Avoid real patron data, credentials, donor restrictions, unpublished collection information, licensed database content, personnel information, and internal-only security or infrastructure details.

### Make Uncertainty Visible

Skills should tell the agent how to handle missing or conflicting information. Useful directions include:

- preserve an uncertainty marker;
- distinguish a supplied fact from a suggestion;
- ask a focused question;
- record that information was not provided; or
- stop and request human review.

## Assessment Strategy

### Formative Checks

Each lesson checkpoint is formative: it helps learners find gaps before the capstone. A learner may retry a command, revise an explanation, or revisit a concept without penalty.

### Capstone

The self-paced course rubric assesses eight areas:

1. purpose and scope;
2. source and ownership;
3. instruction quality;
4. safety and data handling;
5. structural validity;
6. harness output;
7. testability; and
8. human review.

A score of 13–16 demonstrates the course outcomes for the practice exercise. It is not production approval.

### Peer Review Prompts

The reviewer should ask:

- Can I tell when this artifact applies?
- Can I tell when it does not apply?
- Which statements come from an identified source?
- What would the agent do when a fact is missing?
- Could I observe whether each instruction was followed?
- Is any information present that should not be distributed with the artifact?
- Who will review this again, and when?

## Accessibility and Learner Support

- Provide all commands as selectable text, not screenshots alone.
- Explain the expected result after each command.
- Avoid relying on terminal color as the only signal; learners should read the status text and symbols.
- Allow extra time for terminal navigation and setup.
- Define acronyms and platform-specific terms when first used.
- Offer a paired option for learners who are new to Git or command-line tools.
- When adapting the material to another format, preserve headings, table labels, link text, and code-block language identifiers.

This guidance supports accessible instruction but is not an accessibility compliance review.

## Production Readiness Gate

After the course, a real artifact should move into production only when the responsible team has answered these questions:

- Who owns the source guidance?
- May the guidance be distributed to every selected harness and project?
- What information is explicitly out of scope?
- Which staff roles reviewed the content?
- Which representative and boundary tests passed?
- What warnings or harness degradations remain?
- How will users report a problem?
- What event or date triggers re-review?
- Who may publish or install the artifact?

If an answer is missing, keep the artifact in a practice or experimental state.

## Maintenance

Review the curriculum when:

- the CLI changes a command, option, scaffolded file, or output path;
- supported harnesses or default formats change;
- the artifact schema changes;
- Johns Hopkins guidance for AI, privacy, accessibility, or information handling changes;
- learners repeatedly encounter the same error; or
- the practice exercise begins to resemble a claimed production standard.

For each update:

1. compare course commands with the live CLI help and source;
2. run the curriculum property tests;
3. validate and build the Kanon knowledge artifact;
4. scan Johns Hopkins-facing copy for invented claims and unexplained acronyms;
5. update the changelog fragment; and
6. ask a staff learner or peer mentor to complete the changed exercise.

## Coordinator Checklist

- [ ] The intended learning path is clear.
- [ ] The practice environment is writable and separate from production work.
- [ ] Setup instructions match the current CLI.
- [ ] Practice content is invented or approved for training.
- [ ] Learners know what information to exclude.
- [ ] A technical contact and a subject-matter reviewer are identified.
- [ ] Completion evidence is defined.
- [ ] The capstone is treated as learning evidence, not production approval.
- [ ] A review date or trigger is recorded for the curriculum.
