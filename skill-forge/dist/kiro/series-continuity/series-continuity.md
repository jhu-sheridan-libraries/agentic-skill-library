---
inclusion: manual
---
<!-- forge:version 0.2.0 -->

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


## Examples

**Good continuity catch:**
> Chapter 12: Sarah mentions her brother's blue eyes. Chapter 3 established her brother has brown eyes. Severity: high (physical description contradiction). Recommendation: check which is correct and update the other.

**Good information state tracking:**
> At end of Chapter 8: Detective knows about the forged will (learned Ch. 6). Detective does NOT know about the second victim (revealed to reader in Ch. 7 via different POV). Any dialogue in Ch. 9 where the detective references the second victim is an information leak.

## Troubleshooting

**Continuity log becomes unwieldy:** Focus on facts that could contradict — physical descriptions, timeline markers, character knowledge, and location details. Don't track every adjective.

**Series bible conflicts with current book:** The current book's content is canon. If it contradicts the series bible, update the bible and note the change in Known Continuity Issues.

**Agent flags intentional continuity breaks:** Some "errors" are deliberate — an unreliable narrator, a character who lies, or a retcon. Mark these as intentional in the continuity log so they aren't flagged again.

## Series Arc Design

# Series Arc Design

## Purpose

Design the overarching series arc, manage the tension between standalone book satisfaction and series-level progression, plan book-to-book transitions, and handle reader onboarding for mid-series entry. This workflow is genre-agnostic — the principles apply to mystery, sci-fi, fantasy, romance, thriller, and literary fiction series.

## Inputs Required

Before starting, confirm:
- Series model (episodic, progressive, serial, hybrid — see Step 1)
- Planned length (finite or open-ended)
- Genre (affects reader expectations for standalone vs. serial)
- Whether the series arc is character-driven, plot-driven, or both

## Workflow

### Step 1: Choose the Series Model

Every series follows one of these structural models. The choice affects every subsequent decision:

| Model | Description | Series Arc | Standalone Requirement | Best For |
|-------|-------------|-----------|----------------------|----------|
| Episodic | Each book is fully independent. Recurring cast and setting provide continuity. Character growth is minimal or absent. | Minimal | Very high — any book can be first | Long-running genre series, comfort reads |
| Progressive | Each book is standalone but a background thread develops. Characters grow. The series has a direction. | Moderate | High for the book's plot, moderate for the series thread | Most commercially successful series |
| Serial | Books form a continuous narrative. Each book is a chapter in a larger story. | Strong | Low — books must be read in order | Epic fantasy, space opera, thriller trilogies |
| Hybrid | Standalone plots with a serial subplot that escalates. Each book satisfies on its own but the series builds to something. | Strong subplot | High for the book's plot, reading order matters for subplot | Mystery, urban fantasy, romance |

**Genre conventions:**
- Mystery: Progressive or hybrid (readers expect case closure per book)
- Romance: Episodic (different couple per book) or progressive (same couple, deepening relationship)
- Fantasy: Serial (epic) or progressive (urban fantasy)
- Sci-fi: Any model depending on scope
- Thriller: Progressive or serial
- Literary: Progressive (character-driven series arc)

### Step 2: Design the Series Arc

**For episodic series:**
The series arc is the protagonist's life. There is no overarching plot, but the character should not be static. Define:
- What aspect of the protagonist's life evolves across books? (Relationships, career, self-understanding)
- What is the emotional trajectory? (Even episodic series benefit from a direction)
- What keeps the reader coming back beyond the individual plots? (Character attachment, setting comfort, thematic consistency)

**For progressive series:**
The series arc is a background thread that gains prominence over time. Define:
- What question or conflict spans the series?
- How much of the answer is revealed in each book?
- At what point does the series arc move from background to foreground? (Usually the penultimate or final book)
- How does each book's standalone plot connect to the series arc? (Directly, thematically, or through character development)

**For serial series:**
The series arc IS the story. Define:
- What is the overarching conflict?
- How is it divided across books? (Each book should have its own sub-conflict that resolves while advancing the main conflict)
- What is the escalation pattern? (Each book's stakes should be higher than the last)
- How does each book end? (Cliffhangers are acceptable in serial but each book should still have a satisfying internal arc)

**For hybrid series:**
Define both the standalone and serial elements:
- What is the standalone element in each book? (A case, a mission, a relationship challenge)
- What is the serial element? (An overarching threat, a relationship arc, a mystery about the protagonist's past)
- How do the two elements interact? (The standalone plot should illuminate or advance the serial element)
- What is the ratio? (Typically 70% standalone, 30% serial — but this shifts as the series progresses toward its conclusion)

### Step 3: Plan the Arc Across Books

Map the series arc's progression:

```
# Series Arc Map: {Series Title}

## Overarching Arc: {description}

Book 1: {Establishes} — {what the reader learns about the series arc}
  - Standalone satisfaction: {what resolves}
  - Series seed: {what is planted for later}

Book 2: {Develops} — {how the series arc advances}
  - Standalone satisfaction: {what resolves}
  - Series advancement: {what changes}

Book 3: {Complicates} — {how the series arc deepens or twists}
  - Standalone satisfaction: {what resolves}
  - Series escalation: {what raises the stakes}

...

Book N (final): {Resolves} — {how the series arc concludes}
  - Standalone satisfaction: {what resolves}
  - Series resolution: {how the overarching question is answered}
```

**Pacing the arc:**
- Books 1-2: Establish the series world, characters, and the seed of the series arc
- Middle books: Develop the arc, raise stakes, deepen relationships, complicate the question
- Penultimate book: The series arc moves to the foreground. The crisis point.
- Final book: Resolution of both the standalone plot and the series arc

### Step 4: Manage the Standalone/Series Tension

Each book must serve two audiences: the new reader and the series reader.

**For the new reader, each book must:**
- Introduce the protagonist and key recurring characters through action, not summary
- Present a complete, self-contained plot with a satisfying resolution
- Make the setting feel lived-in without requiring prior knowledge
- Not depend on knowledge of previous books for the current book's plot resolution
- Provide enough context for the series arc to be intriguing, not confusing

**For the series reader, each book must:**
- Advance the protagonist's character arc
- Progress the series-level storyline or relationship arcs
- Reference previous events naturally (not as exposition dumps)
- Reward loyalty with continuity details, callbacks, and deepening understanding
- Not repeat information the series reader already knows (or repeat it so briefly it doesn't feel like recap)

**Techniques for serving both:**

| Technique | How It Works | Example |
|-----------|-------------|---------|
| Action introduction | Introduce recurring characters through what they do in the current story, not who they were in previous books | "Detective Reyes arrived first, as usual, already photographing the scene before the uniforms finished taping it off." |
| Passing reference | Mention previous events in a subordinate clause, not a paragraph | "Since the Hargrove case last fall, she'd been more careful about chain of custody." |
| Dual-purpose scenes | Scenes that advance both the standalone plot and the series arc simultaneously | An interview for the current case that also reveals information about the series-level mystery |
| Emotional shorthand | Reference the emotional impact of previous events without retelling them | "He flinched at the sound of breaking glass — he'd been doing that since October." |
| New character as proxy | Introduce a new character who needs things explained, serving as a stand-in for the new reader | A new partner, a new neighbor, a new client who asks natural questions |

### Step 5: Plan Book-to-Book Transitions

At the end of each book, set up the next without undermining the current book's closure:

**Resolved in this book (mandatory):**
- The standalone plot (the case, the mission, the central conflict of this book)
- Any relationship subplot that reached a natural conclusion
- Any series-arc question that this book was designed to answer

**Carried forward (natural):**
- The protagonist's emotional state after this book's events
- Ongoing series-arc threads
- New questions raised by this book's events
- Changes to the community, setting, or power dynamics

**Seeded for next book (deliberate):**
- A detail, character, or question introduced in this book that becomes important in the next
- The seed should be organic — not a cliffhanger (unless the series model supports cliffhangers) but a thread that creates anticipation
- The seed should be subtle enough that a reader who doesn't continue the series doesn't feel cheated

**What NOT to do:**
- End on a cliffhanger that makes the current book feel incomplete (unless serial model)
- Introduce a major new element in the final chapter that has nothing to do with the current book
- Resolve the series arc prematurely
- Leave the standalone plot unresolved to force the reader into the next book

### Step 6: Handle Series-Length Character Development

Characters in a series must change — but the change must be gradual, motivated, and trackable:

**Per-book character development:**
- Each book should change the protagonist in one meaningful way
- The change should be caused by the events of that book (not arbitrary)
- The change should be visible in the protagonist's decisions and behavior, not just stated
- The change should carry into the next book as the new baseline

**Series-level character development:**
- The protagonist at the end of the series should be recognizably the same person as at the beginning — but different in important ways
- The trajectory should feel inevitable in retrospect
- Major changes should be distributed across books, not concentrated in one

**Avoiding the reset button:**
- If the protagonist learns something in book 2, they must still know it in book 3
- If a relationship changes in book 3, it must reflect that change in book 4
- If the protagonist suffers trauma, the effects must persist (even if they heal over time)
- Growth is not linear — setbacks are realistic, but the overall direction should be forward

### Step 7: Validate Series Arc Design

After planning the arc, run these checks:

1. **Standalone check**: Could each book be read independently and provide a satisfying experience?
2. **Progression check**: Does each book advance the series arc? Is there forward movement in every installment?
3. **Escalation check**: Do the stakes increase across the series? Does each book feel like it matters more than the last?
4. **Character check**: Does the protagonist change across the series? Is the change motivated and gradual?
5. **Onboarding check**: Could a reader start at book 3 and not be lost?
6. **Resolution check**: Does the planned ending resolve both the final book's plot and the series arc?
7. **Pacing check**: Is the series arc distributed across books, or front-loaded/back-loaded?

## Common Failure Modes

- **The static series**: Books that could be read in any order because nothing changes. Even episodic series need some progression.
- **The dependent series**: Books that make no sense without reading all previous installments. Each book should onboard new readers.
- **The rushed conclusion**: A series arc that is ignored for most of the series and then resolved in the final book. Distribute the arc.
- **The endless series**: A series with no planned endpoint that loses direction. Even open-ended series benefit from knowing the general trajectory.
- **The recap problem**: Each book spending pages summarizing previous books. Integrate context naturally or trust the reader.
- **The escalation trap**: Each book must have higher stakes than the last, leading to absurd escalation. Stakes can be different rather than bigger — personal stakes can follow global stakes.

## Series Bible Management

# Series Bible Management

## Purpose

Build and maintain the series bible — the canonical record of all facts, characters, settings, and timeline across multiple books. The bible is the single source of truth for continuity. This workflow produces and maintains series bible entries using the template from knowledge.md.

## Inputs Required

Before starting, confirm:
- Series title and planned scope
- Current book number
- Whether a series bible already exists (if joining a series in progress)
- Genre (affects what categories of facts need tracking — a fantasy series tracks magic systems, a mystery series tracks case outcomes, a romance series tracks relationship states)

## Workflow

### Step 1: Initialize or Inherit the Bible

**New series (book 1):**
Create the Series Bible using the template from knowledge.md. At this stage, most sections will be empty or minimal. The bible grows as the first book is drafted.

Populate:
- Series metadata (genre, model, planned length)
- Series arc (if planned — even a rough direction is useful)
- Protagonist entry (from character creation work)
- Primary setting entry (from world-building work)

**Existing series (book 2+):**
The bible should already exist from previous books. Before starting the new book:
1. Review all recurring character entries — confirm their end-of-previous-book state
2. Review setting entries — confirm any changes from the previous book
3. Review the cross-book timeline — confirm the gap between books
4. Review the canon registry — note any known continuity issues
5. Review running threads — identify which carry into this book

### Step 2: Define Entry Standards

The bible must be consistent in what it tracks. Define standards for the series:

**Character entries must include:**
- Canonical physical description (with source book and chapter)
- Key personality traits and speech patterns
- State at the end of each book (physical, emotional, professional, relational)
- What the reader knows about this character after each book
- Running threads (unresolved personal storylines)

**Setting entries must include:**
- Canonical description (with source book and chapter)
- Spatial relationships to other locations (distances, directions)
- Changes across books (with source)
- Sensory signature (what this place looks, sounds, smells like)

**Timeline entries must include:**
- Internal time span of each book
- Gap between books
- Season and any specific dates
- Character ages at each book (if relevant)

**Canon registry entries must include:**
- The fact as stated in the text
- Source (book, chapter, approximate location)
- Any modifications in later books
- Whether the fact is plot-relevant or background

### Step 3: Update Protocol

The bible must be updated at three points:

**During drafting:**
When a new fact is established in the text — a character detail, a setting description, a timeline marker — add it to the bible immediately. Do not wait until the end of the book. Delayed updates lead to contradictions.

**End of each book:**
After completing a book's draft, do a comprehensive bible update:
1. Update every recurring character's state to reflect end-of-book
2. Update every setting entry with any changes
3. Update the cross-book timeline
4. Add any new canon registry entries
5. Note any continuity issues discovered during drafting
6. Update the series arc progression

**During revision:**
If revision changes any established fact, update the bible to match. If the change contradicts a fact from a previous published book, flag it — the published book is canon unless the author decides to retcon.

### Step 4: Handle Contradictions

When a contradiction is discovered between the current manuscript and the bible:

**Contradiction within the current book:**
The author decides which version is correct. Update the bible and fix the manuscript.

**Contradiction with a previous unpublished book:**
The author decides which version is correct. Update both the bible and the earlier manuscript if still editable.

**Contradiction with a previous published book:**
This is a continuity error. Options:
1. Fix the current manuscript to match the published book (preferred)
2. Acknowledge the contradiction in-text if it can be explained (character misremembered, unreliable narrator)
3. Accept the error and note it in the bible's Known Continuity Issues section (last resort)

Never silently change a published fact. Flag it for the author's decision.

### Step 5: Manage Canon Hierarchy

Not all facts have equal weight. When contradictions arise, resolve using this hierarchy:

1. **Plot-critical facts** (highest priority): Facts that affect the plot of any book. These must be consistent.
2. **Character-defining facts**: Core personality traits, key backstory, relationship states. High priority.
3. **Physical descriptions**: Appearance, setting details. Medium priority — readers notice these but they rarely affect plot.
4. **Background details**: Minor facts mentioned in passing. Low priority — fix if easy, note if not.
5. **Implied facts** (lowest priority): Things the reader might infer but that were never stated explicitly. These can be overridden without contradiction.

### Step 6: Bible Access Patterns

The bible should be consulted at specific moments during drafting:

**Before introducing a recurring character in a new scene:**
Check their current state (physical, emotional, relational). Check what the reader knows about them at this point.

**Before describing a recurring setting:**
Check the canonical description. Check for any changes since the last appearance.

**Before referencing a previous event:**
Check the canon registry for the exact details. Do not rely on memory — check the bible.

**Before establishing a new fact:**
Check whether a contradicting fact already exists. If the character's mother has never been named, any name works. If she was named Margaret in book 1, she must be Margaret now.

### Step 7: Validate the Bible

Periodically (at minimum, at the end of each book), validate the bible itself:

1. **Completeness check**: Are all recurring characters, settings, and major facts tracked?
2. **Currency check**: Does every entry reflect the most recent book?
3. **Consistency check**: Do any entries contradict each other within the bible?
4. **Source check**: Does every entry have a source reference (book, chapter)?
5. **Gap check**: Are there characters or settings that appear in the manuscript but have no bible entry?

## Common Failure Modes

- **The abandoned bible**: Started with enthusiasm for book 1, neglected by book 3. The bible is only useful if maintained.
- **The over-detailed bible**: Tracking every adjective instead of facts that could be contradicted. Track what matters.
- **The authoritative bible**: Treating the bible as more canonical than the manuscript. The manuscript is the text — the bible is the index.
- **The single-author assumption**: If multiple people contribute to the series (co-authors, ghostwriters, editors), the bible must be the shared source of truth, not any individual's memory.
- **The retroactive bible**: Building the bible after multiple books are written. This works but requires a careful audit of all published text. Do not trust memory — read the books.

## Within Book Continuity

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
