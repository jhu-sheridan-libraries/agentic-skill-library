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
