# Within-Book Continuity

## Purpose

Track character details, timeline, setting facts, plot threads, character whereabouts, and information state within a single manuscript. Catch contradictions during drafting rather than discovering them in revision. This workflow produces and maintains the Continuity Log.

## Inputs Required

Before starting, confirm:
- Is this a standalone or part of a series? (If series, the series bible provides the starting state for recurring elements.)
- How many POV characters? (Determines whether whereabouts tracking is needed.)
- Is the timeline linear or non-linear? (Non-linear timelines require more rigorous tracking.)
- Are there secrets or information asymmetry? (Determines whether information state tracking is needed.)

## Workflow

### Step 1: Initialize the Continuity Log

At the start of a project (or when this power is activated mid-draft), create the Continuity Log using the template from knowledge.md.

**For a new project**: The log starts empty. Entries are created as details are established in the text.

**For a project in progress**: Backfill the log by scanning existing chapters. For each chapter, extract:
- Character physical descriptions and background details
- Timeline markers (day, time, season, specific dates)
- Setting descriptions and spatial relationships
- Plot threads introduced or advanced
- Character locations at scene boundaries
- Information revealed to characters and reader

### Step 2: Track During Drafting

After each drafting session, update the Continuity Log with new facts established in the text. This is the core discipline — the log must stay current with the manuscript.

**What to track:**

| Category | Track When | Example |
|----------|-----------|---------|
| Character physical detail | First mention or change | "Elena's dark hair" — Ch. 1 |
| Character background fact | Revealed in text | "Marcus served in the Navy" — Ch. 3 |
| Character knowledge | Character learns something | "Elena learns about the letter" — Ch. 5 |
| Character location | Scene start/end | "Elena at the office" — Ch. 4 end |
| Timeline marker | Any time reference | "Three days after the funeral" — Ch. 6 |
| Setting fact | Description or spatial detail | "The coffee shop is two blocks from the apartment" — Ch. 2 |
| Plot thread | Introduced, advanced, or resolved | "The missing photograph" — introduced Ch. 3, advanced Ch. 7 |
| Information asymmetry | Character or reader learns a secret | "Reader learns Marcus lied" — Ch. 8 |

### Step 3: Validate on Save

When a manuscript file is saved, cross-reference new content against the Continuity Log:

**Character checks:**
- Does any character description contradict a previously established detail?
- Does any character use knowledge they haven't acquired yet?
- Does any character appear in a location they couldn't have reached given their last known position?
- Does any character's behavior contradict established personality traits without acknowledgment?

**Timeline checks:**
- Does the time reference in this scene follow logically from the previous scene?
- Is travel time between locations consistent with established distances?
- Do seasonal markers (weather, daylight, holidays) match the timeline?
- If the story is non-linear, is the current scene's time period clearly signaled?

**Setting checks:**
- Does any location description contradict a previous description?
- Are spatial relationships consistent (distances, directions, layout)?
- Do sensory details match the established character of the location?

**Plot thread checks:**
- Are any threads dormant for too long? (More than 4-5 chapters without mention risks the reader forgetting.)
- Are any threads introduced but never advanced?
- Are any threads resolved without adequate setup?

### Step 4: Manage Non-Linear Timelines

For stories with flashbacks, dual timelines, or non-chronological structure:

**Maintain two documents:**
1. The master timeline (chronological order of all events)
2. The presentation order (the order the reader encounters events)

**For each scene, record:**
- Its position in the master timeline
- Its position in the presentation order
- What the reader knows at this point in the presentation order
- What the reader will learn from this scene
- Whether this scene depends on knowledge from a scene that hasn't been presented yet (if so, flag — this may confuse the reader)

**Validate:**
- Does the reader have enough context to understand each scene when they encounter it?
- Are timeline shifts clearly signaled (dates, age references, sensory markers, formatting)?
- Is the pattern of shifts consistent enough that the reader learns to navigate it?

### Step 5: Manage Character Whereabouts

For stories with multiple POV characters or ensemble casts, maintain the Character Whereabouts table from knowledge.md.

**Update at every scene boundary:**
- Where is the POV character at the start and end of the scene?
- Where are other significant characters during this scene? (Even if offscreen.)
- Could any offscreen character plausibly arrive at the scene's location during the scene?

**Flag:**
- Characters who appear somewhere impossible given their last known location
- Characters who are unaccounted for during scenes where their presence or absence matters
- Travel that takes less time than established distances allow

### Step 6: Manage Information State

For stories with secrets, reveals, or dramatic irony, maintain the Information State table from knowledge.md.

**Track for each piece of significant information:**
- When each character learns it (chapter and method — witnessed, told, deduced, overheard)
- When the reader learns it
- Whether any character acts on information they shouldn't have yet

**Flag:**
- Information leaks — a character acts on knowledge they haven't acquired
- Premature reveals — the reader learns something before the narrative intends
- Orphan secrets — information the reader is told is important but is never resolved
- Dramatic irony gaps — the reader knows something a character doesn't, but the narrative doesn't exploit the tension

### Step 7: Produce Continuity Report

At the end of a drafting phase or before revision, compile a continuity report:

```
# Continuity Report: {Project Title}

Date: {date}
Chapters reviewed: {range}

## Critical Issues (must fix)
- {Issue}: Ch. {N} contradicts Ch. {M}. {Description.}

## Significant Issues (fix in revision)
- {Issue}: {Description.}

## Minor Issues (fix if easy)
- {Issue}: {Description.}

## Thread Status
| Thread | Status | Last Active | Notes |
|--------|--------|-------------|-------|
| {thread} | {open/resolved/dormant} | Ch. {N} | {notes} |

## Unresolved Information
- {Secret or reveal that has not yet been resolved}

## Continuity Log Health
- Characters tracked: {N}
- Timeline entries: {N}
- Setting facts: {N}
- Known gaps in tracking: {list any chapters not yet logged}
```

## Common Failure Modes

- **Stale log**: The continuity log falls behind the manuscript. The log is only useful if it's current. Update after every session.
- **Over-tracking**: Logging every adjective and adverb. Track facts that could be contradicted, not stylistic choices.
- **Ignoring offscreen characters**: Characters exist when they're not on the page. If a character was at the hospital in chapter 5, they can't be at home in chapter 6 without travel time.
- **Timeline drift**: Small inconsistencies in time references accumulate into impossible timelines. Track days and times explicitly.
- **Thread amnesia**: A plot thread introduced with emphasis in chapter 3 that vanishes until chapter 18. The reader forgot about it by chapter 8.
