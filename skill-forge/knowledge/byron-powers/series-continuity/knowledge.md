---
name: series-continuity
displayName: Series Continuity
description: Genre-agnostic continuity tracking for fiction series and standalone novels. Manages character state, setting consistency, timeline integrity, within-book continuity, and cross-book series arcs. Designed for agent consumption.
keywords:
  - continuity
  - series
  - series-bible
  - character-tracking
  - timeline
  - consistency
  - sequel
  - recurring-characters
  - world-bible
  - canon
author: Steven J. Miklovic
version: 0.1.0
harnesses:
  - kiro
type: power
inclusion: manual
categories:
  - writing
ecosystem: []
depends: []
enhances:
  - novelist
  - scifi-novelist
  - mystery-series-novelist
maturity: experimental
trust: community
audience: intermediate
model-assumptions: []
collections:
  - byron-powers
inherit-hooks: false
---
# Series Continuity

## Overview

This power provides structured continuity tracking at two levels: within a single book (character details, timeline, setting facts, plot threads) and across a multi-book series (recurring character arcs, setting evolution, series-level storylines, and the standalone/series tension).

It is genre-agnostic. Mystery series, sci-fi sagas, fantasy epics, romance series, thriller sequences, and literary fiction with recurring characters all need the same continuity infrastructure. Genre-specific powers (mystery-series-novelist, scifi-novelist, etc.) layer their domain-specific rules on top of this foundation.

## Relationship to Other Powers

This power provides the continuity layer. Other powers provide the craft and genre layers:

| Power | Provides | Uses Series Continuity For |
|-------|----------|---------------------------|
| Novelist | General craft — premise, character, plot, drafting, revision | Within-book continuity notes during drafting |
| Scifi-Novelist | Technology bibles, species bibles, science consistency | Tracking tech/species consistency across books |
| Mystery-Series-Novelist | Clue architecture, suspect management, fair play | Tracking case references, recurring suspect/witness appearances |
| Book-Agent-Publicist | Query, publicity, career | Series positioning in proposals and pitches |

When this power is active alongside a genre power, this power handles all continuity tracking. The genre power handles genre-specific content validation.

## Activation

When a user activates this power, determine the scope:

Ask: "Are you tracking continuity for a single book or a multi-book series?"

**Single book**: Activate within-book continuity tracking only. Load the `within-book-continuity` workflow.

**Multi-book series**: Activate both levels. Ask follow-up questions:
- "Which book number are you on?"
- "How many books are planned (or is it open-ended)?"
- "Is there an overarching series arc, or are the books connected primarily by recurring characters and setting?"

Then load the appropriate workflows.

## Steering Files

This power has three workflow files:

- **within-book-continuity** — Track character details, timeline, setting facts, and plot threads within a single manuscript. Produces a continuity log that feeds into revision.
- **series-bible-management** — Build and maintain the series bible: recurring characters, settings, timeline, and canon across multiple books. Produces series bible entries.
- **series-arc-design** — Design the overarching series arc, manage the standalone/series tension, plan book-to-book transitions, and handle reader onboarding for mid-series entry.

## Core Principles for Agent Behavior

### 1. Track Everything, Surface Only What Matters

The continuity system should track every factual detail — character eye color, building locations, travel times, relationship states, what each character knows. But it should only flag issues when a detail contradicts an established fact or when a tracked detail is relevant to the current scene.

Do not produce continuity reports unprompted. Flag contradictions when they appear. Produce full reports only when requested via the user-triggered hooks.

### 2. Canon Is What's on the Page

If a detail appears in a published or finalized manuscript, it is canon — even if it contradicts the author's notes or the series bible. When a contradiction exists between the manuscript and the bible, flag it and ask the author which is correct. Then update the bible to match the decision.

### 3. Continuity Errors Have Different Severities

Not all continuity issues are equal. Classify them:

| Severity | Description | Example | Action |
|----------|-------------|---------|--------|
| Critical | Contradicts a plot-relevant fact | Character uses knowledge they shouldn't have yet | Must fix before publication |
| Significant | Contradicts an established detail that attentive readers will notice | Character's eye color changes between chapters | Fix in revision |
| Minor | Contradicts a detail that most readers won't notice | A street name spelled differently once | Fix if easy, note if not |
| Cosmetic | Inconsistency in style rather than fact | Character's name sometimes has a middle initial | Standardize in copy edit |

When flagging issues, always include the severity classification.

### 4. The Bible Is a Living Document

The series bible is not a specification written before the first word — it is a record that grows with the manuscript. Entries are created when details are established in the text, updated when details change, and flagged when details conflict.

After every drafting session, the bible should be updated with any new facts established in the text.

### 5. Readers Have Better Memories Than Authors

Assume the reader remembers everything from previous books. They will notice if a character's sister was named Sarah in book 1 and Sandra in book 3. They will notice if the walk from the protagonist's apartment to the coffee shop took five minutes in chapter 2 and fifteen minutes in chapter 20. Track what the reader has been told.

## Continuity Log Template (Within-Book)

For tracking continuity within a single manuscript:

```
# Continuity Log: {Project Title}

## Characters

### {Character Name}
- Physical: {appearance details as established in text, with chapter reference}
- Background: {backstory details revealed, with chapter reference}
- Knowledge: {what this character knows and when they learned it}
- Relationships: {state of each relationship, with chapter of last change}
- Location: {where this character is at each point in the story}

## Timeline

| Chapter | Day/Date | Time | Key Events | Characters Present |
|---------|----------|------|------------|-------------------|
| 1 | Day 1 | Morning | {event} | {names} |
| 2 | Day 1 | Afternoon | {event} | {names} |

## Setting Facts

### {Location Name}
- Description: {as established in text, with chapter reference}
- Distance from {other location}: {as established}
- Details: {any specific facts — number of rooms, color of walls, etc.}

## Plot Threads

| Thread | Introduced | Active In | Status | Notes |
|--------|-----------|-----------|--------|-------|
| {thread} | Ch. {N} | Ch. {list} | Open/Resolved | {notes} |

## Established Facts
- {Any fact stated in the text that could be contradicted later}
- Chapter {N}: "{exact or paraphrased statement}"
```

## Series Bible Template

For tracking continuity across multiple books:

```
# Series Bible: {Series Title}

## Series Metadata
- Genre: {genre/subgenre}
- Series model: {episodic / progressive / serial / hybrid}
- Planned length: {N books / open-ended}
- Current book: {N}
- Time span: {how much time the series covers}

## Series Arc
- Overarching theme: {what the series explores}
- Protagonist's series arc: {start state → end state}
- Series-level storyline: {if any — the question or conflict that spans books}
- Arc progression by book:
  - Book 1: {what this book establishes and advances}
  - Book 2: {what this book advances}

## Recurring Characters

### {Character Name}
- Role: {protagonist / partner / antagonist / love interest / mentor / etc.}
- Introduced: Book {N}, Chapter {N}
- Physical description: {canonical details with source reference}
- Key traits: {personality, habits, speech patterns}
- State by book:
  - Book 1: {physical, emotional, professional, relational state at end}
  - Book 2: {changes from book 1}
- Running threads: {unresolved personal storylines}
- Reader knowledge by book: {what the reader knows about this character after each book}

## Recurring Settings

### {Location Name}
- Introduced: Book {N}
- Description: {canonical details}
- Changes by book:
  - Book 1: {state}
  - Book 2: {changes}
- Key facts: {distances, layout, sensory details established in text}

## Cross-Book Timeline

| Book | Internal Time Span | Time Since Previous | Season | Key Dates |
|------|-------------------|--------------------|---------|-----------| 
| 1 | {duration} | N/A | {season} | {any specific dates} |
| 2 | {duration} | {gap} | {season} | {any specific dates} |

## Canon Registry
- {Fact}: Established in Book {N}, Chapter {N}. "{source text or paraphrase}"
- {Fact}: Established in Book {N}, Chapter {N}. Modified in Book {M}, Chapter {M}.

## Known Continuity Issues
- {Description}: Book {N} says {X}, Book {M} says {Y}. Resolution: {pending / decided}
```

## Character Whereabouts Tracking

For multi-POV or ensemble stories, track where every significant character is at every point:

```
# Character Whereabouts: {Book Title}

| Chapter | {Char A} | {Char B} | {Char C} | {Char D} |
|---------|----------|----------|----------|----------|
| 1 | Kitchen (POV) | Driving | Unknown | At work |
| 2 | At home | Office (POV) | Arriving | At work |
| 3 | At work | Office | Hotel (POV) | At home |
```

This prevents characters from appearing somewhere impossible given their last known location, and surfaces opportunities for offscreen events.

## Information State Tracking

Track what each character and the reader knows at each point:

```
# Information State: {Book Title}

| Information | {Char A} knows | {Char B} knows | Reader knows |
|-------------|---------------|---------------|-------------|
| {Secret 1} | Ch. 5 | Never | Ch. 3 |
| {Secret 2} | Always | Ch. 12 | Ch. 8 |
| {Event 1} | Ch. 1 (witnessed) | Ch. 6 (told) | Ch. 1 |
```

This is critical for any story with secrets, reveals, or information asymmetry — not just mysteries. Romance, thriller, literary fiction, and sci-fi all use information asymmetry as a narrative tool.

