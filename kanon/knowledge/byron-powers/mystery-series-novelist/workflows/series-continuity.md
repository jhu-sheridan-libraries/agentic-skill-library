# Mystery Series Continuity

## Purpose

Layer mystery-specific continuity concerns on top of the Series Continuity power's general infrastructure. This workflow handles what is unique to mystery series: case outcome tracking, recurring suspect/witness management, fair-play consistency across books, and the body-count plausibility problem.

## Prerequisite

The Series Continuity power provides the foundation: series bible, recurring character tracking, setting continuity, timeline management, standalone/series tension, and book-to-book transitions. This workflow adds only the mystery-specific layer. Activate Series Continuity first.

## Workflow

### Step 1: Track Case Outcomes

Maintain a case registry across the series:

```
# Case Registry: {Series Title}

| Book | Case | Victim | Culprit | Method | Motive | Resolution | Loose Ends |
|------|------|--------|---------|--------|--------|------------|------------|
| 1 | {title} | {name} | {name} | {method} | {motive} | {convicted/escaped/dead/other} | {any unresolved elements} |
| 2 | {title} | {name} | {name} | {method} | {method} | {resolution} | {loose ends} |
```

**Why this matters:**
- Previous cases should be referenced naturally in later books
- The community remembers — characters affected by previous cases carry that history
- Patterns across cases may form part of the series arc
- The reader who has read all books will notice if a case outcome is misremembered

### Step 2: Track Recurring Suspects and Witnesses

Characters who appeared as suspects or witnesses in previous cases may reappear. Track:

**For each character who was a suspect or significant witness:**
- Which book and case they appeared in
- Their role (suspect, witness, victim's associate, bystander)
- Whether they were cleared and how
- Their relationship to the protagonist after the case
- Whether they hold a grudge, feel grateful, or are indifferent
- Any information they possess that could be relevant to future cases

**Why this matters:**
- A character cleared in book 2 who reappears in book 5 carries history
- The protagonist's relationship with former suspects evolves
- Former suspects make excellent red herrings in later books — the reader remembers them
- Former witnesses may provide information or connections in later cases

### Step 3: Maintain Fair-Play Consistency Across Books

If the series has a series-level mystery (a question spanning multiple books):

**Track clue planting across books:**
- Which clues for the series mystery have been planted in which books?
- Is the series mystery solvable with clues from published books only? (It should not be — the reader should have enough to theorize but not enough to solve until the final book.)
- Are red herrings for the series mystery resolved within a reasonable timeframe?

**Fair-play rules for series mysteries:**
- The series mystery's solution must not depend on information from a book the reader hasn't read
- Clues planted in book 1 must still be accurate in book 5 — do not retroactively change their meaning without textual justification
- If the series mystery's solution changes during writing (it happens), audit all previously planted clues for consistency

### Step 4: Manage the Body Count Problem

In a mystery series set in a small community, the accumulating body count strains credibility. Address this:

**Strategies:**
- Space books further apart in story time (a murder every two years is more plausible than one every month)
- Vary the type of crime (not every book needs a murder — theft, fraud, disappearance, cold cases)
- Acknowledge the pattern in-text (characters comment on the unusual crime rate — this is especially effective in cozies)
- Expand the geographic scope gradually (the protagonist's reputation draws cases from outside the immediate community)
- Use the body count as a series-arc element (why does this community have so many crimes? is there a systemic cause?)

**Track:**
- Total body count across the series
- Time elapsed in-story across the series
- Whether the community's reaction to repeated crimes is depicted
- Whether the protagonist's reputation as a "murder magnet" is addressed

### Step 5: Track the Protagonist's Investigative Growth

Mystery series protagonists should become better investigators over time:

- Do they learn from previous cases? (Techniques, instincts, contacts)
- Do they make different mistakes in later books? (Repeating the same error is stagnation)
- Does their reputation change? (Police take them more seriously, suspects are more guarded, the community trusts or fears them)
- Do they develop specialties or blind spots based on experience?

**Add to the series bible's protagonist entry:**
- Investigative skills gained per book
- Key lessons learned per case
- Professional reputation state per book
- Contacts and resources acquired through previous cases

### Step 6: Validate Mystery-Specific Continuity

After completing each book's draft, run these checks in addition to the Series Continuity power's general checks:

1. **Case reference accuracy**: Are references to previous cases accurate per the case registry?
2. **Suspect/witness continuity**: Do returning characters from previous cases behave consistently with their established history?
3. **Fair-play series consistency**: If there's a series mystery, are all planted clues still accurate?
4. **Body count plausibility**: Is the cumulative crime rate addressed or at least not absurd?
5. **Investigative growth**: Does the protagonist demonstrate growth from previous cases?
6. **Case independence**: Can the current case be solved without knowledge of previous cases?

## Common Failure Modes

- **The amnesia detective**: The protagonist never references or learns from previous cases. Each book feels like their first investigation.
- **The invisible community**: Previous victims, suspects, and witnesses vanish from the community after their book. They should persist as background characters.
- **The serial-killer village**: A small town with a murder rate that would make a war zone blush, and nobody comments on it.
- **The retconned clue**: A series-mystery clue planted in book 2 that is quietly changed in book 4 because the author changed the solution. Audit and fix.
- **The dependent case**: A case that can only be solved if the reader remembers a detail from three books ago. Each case must be self-contained.
