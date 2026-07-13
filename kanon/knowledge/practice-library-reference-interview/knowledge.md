---
name: practice-library-reference-interview
displayName: Practice a Library Reference Interview
description: Role-play and debrief a fictional research-library reference interview so a librarian or workshop participant can practice question negotiation, privacy boundaries, and a research brief without using real patron data.
keywords: [academic-libraries, reference-interview, question-negotiation, privacy, research-support, role-play]
author: Library AI Workshop maintainers
version: 0.1.0
harnesses: [codex]
type: skill
inclusion: manual
categories: [documentation, accessibility]
ecosystem: [academic-libraries, research]
depends: []
enhances: []
maturity: experimental
trust: community
license: MPL-2.0
audience: intermediate
model-assumptions: []
collections: [library-ai-workshop]
inherit-hooks: false
harness-config:
  codex:
    format: skill
---

> **Source and adaptation:** Imported from [eudaemon-ai/academic-ai-library-workshop](https://github.com/eudaemon-ai/academic-ai-library-workshop) at commit `d3743bca0b1766709d1694343ef6082d90933141`. The Kanon artifact preserves the upstream skill and focused references under `workflows/` for Codex progressive disclosure. Review local library policy, privacy, accessibility, and retention requirements before use.

# Practice a Library Reference Interview

Play a simulated patron while the learner practices the interview. Keep the exchange realistic, psychologically safe, and focused on research-support judgment rather than trivia.

## Set Up the Practice

1. Read `references/AI-TOOL-GUIDE.md` before the first exchange.
2. Read `references/SCENARIOS.md` and select one scenario that fits the learner's requested topic and difficulty.
3. Ask for the learner's preferred difficulty, available time, and whether they want feedback during the interview or only afterward.
4. State that all details are fictional and ask the learner not to substitute real patron or unpublished research information.

If the learner has no preference, choose an introductory scenario and use delayed feedback.

## Run the Role-Play

Start with only the scenario's opening request. Do not reveal hidden facts, success indicators, or the planned twist.

- Answer in the patron's voice using only scenario facts and reasonable everyday phrasing.
- Volunteer only what a real patron would naturally volunteer. Make the learner ask for search-changing details.
- Allow uncertainty, partial answers, and corrections. Do not make the patron unnaturally expert in library terminology.
- Introduce at most one twist after the learner has clarified the core need.
- If the learner requests sensitive or unnecessary information, respond in character with mild hesitation; address the issue explicitly in the debrief.
- If the learner gives substantive medical, legal, employment, or research-integrity advice, keep the role-play within literature support and flag the boundary in the debrief.
- Stop immediately if the learner says “pause role-play,” “stop,” or asks to debrief.

Do not perform the search or solve the research question. The practice target is the interview and resulting search brief.

## Decide When the Interview Is Complete

End when the learner can state, in their own words:

- the decision, use, or deliverable;
- the population, context, or core concepts;
- meaningful scope, date, geography, language, or evidence constraints;
- access, format, timing, or reproducibility needs;
- unresolved questions and the next human action.

Do not require every field when it would not affect the search. Ask the learner to summarize the agreed research brief before leaving the role-play.

## Debrief Without Scoring

Switch out of character clearly. Use the debrief dimensions in `references/SCENARIOS.md` and provide:

1. two specific moves that improved the interview;
2. one missed or late question that would have changed the search;
3. one observation about privacy, access, or professional boundaries;
4. a concise example of a stronger follow-up, if needed;
5. an invitation for the learner to revise the research brief.

Describe evidence from the conversation. Do not assign a score, rank the learner, diagnose communication style, or claim a single ideal script.

## Offer Variations

After the debrief, offer one relevant option:

- retry the same scenario with a different opening;
- increase ambiguity or time pressure;
- switch to another research-library service context;
- practice handing the brief to another librarian;
- continue with `$facilitate-library-ai-workshop` for the related course exercise.

Keep resume notes limited to fictional scenario name, difficulty, interview stage, and open practice goal.

## Resource Map

- `references/SCENARIOS.md`: fictional patron scenarios, hidden details, twists, and debrief dimensions.
- `references/AI-TOOL-GUIDE.md`: data boundaries and research-support standards.
