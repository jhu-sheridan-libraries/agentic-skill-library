# Clue Architecture

## Purpose

Design the clue chain that connects the crime to its solution. Ensure clues are planted fairly, red herrings are honest, and the revelation sequence gives the reader a solvable puzzle without making the solution obvious. This workflow produces clue bible entries.

## Inputs Required

Before starting, confirm these are established:
- The solution (culprit, method, motive, opportunity) — you must know the answer before planting clues
- The subgenre (determines fair-play strictness)
- The suspect pool (from suspect-management workflow)
- The investigation structure (from investigation-structure workflow, or at least a rough outline)

## Workflow

### Step 1: Decompose the Solution

Break the solution into its provable elements. Each element needs at least one clue:

```
Solution: {Culprit} killed {Victim} by {Method} because {Motive} at {Time/Place}.

Provable elements:
1. Culprit had access to the method → Clue needed
2. Culprit had motive → Clue needed
3. Culprit had opportunity (was at the scene) → Clue needed
4. Method is consistent with evidence → Clue needed
5. Timing is consistent with evidence → Clue needed
6. All other suspects are eliminated → Clue needed for each elimination
```

For locked-room or impossible-crime subgenres, add:
7. The mechanism that made the crime appear impossible → Clue needed
8. The flaw in the impossible situation → Clue needed

### Step 2: Design Each Clue

For each required clue, define:

**The clue itself**: What does the reader encounter? This must be a concrete, observable thing — a physical object, a statement, a behavior, a document, an absence.

**Surface reading**: What does the clue appear to mean on first encounter? In a well-designed mystery, the surface reading is plausible but wrong (or incomplete).

**True meaning**: What does the clue actually prove? This is what the reader recognizes in retrospect.

**Planting method**: How does the reader encounter this clue?
- Embedded in scene description (reader may skim past it)
- Delivered through dialogue (character mentions it)
- Discovered by the protagonist during investigation (reader and detective learn together)
- Present in a document, letter, or record (reader can examine it)
- Behavioral — a character does something that only makes sense if they are guilty/innocent

**Visibility calibration**: How noticeable should this clue be?
- Obvious: Reader will notice and remember. Use for clues that should drive early theorizing.
- Embedded: Reader encounters it but may not flag it as significant. Use for clues that pay off later.
- Hidden in plain sight: The clue is present but its significance is obscured by context. The most satisfying type — the reader kicks themselves for missing it.

### Step 3: Design Red Herrings

For each red herring, define:

**The factual clue**: What true thing does the reader encounter? Red herrings must be factually true within the story. A red herring that is a lie is cheating.

**The false inference**: What wrong conclusion does the reader draw? This should be logical given the available information.

**The true explanation**: What does this clue actually mean? When revealed, the reader should see how they were misled without feeling cheated.

**Target**: Which innocent suspect does this red herring implicate?

**Resolution**: When and how is the false inference corrected?

**Red herring quality test**: After the solution is known, does the red herring make more sense, not less? A good red herring gains meaning in retrospect. A bad red herring is simply discarded.

### Step 4: Design the Revelation Sequence

The order in which clues are revealed determines the reader's experience. Map the sequence:

**Early clues (Act 1)**: Establish the crime, introduce suspects, plant foundational clues that won't pay off until later. The reader should form initial theories.

**Accumulation clues (Act 2a)**: Build the case. Mix genuine clues with red herrings. The reader's theory should strengthen — toward the wrong suspect.

**Midpoint pivot**: The false solution collapses. A clue or revelation invalidates the reader's leading theory. This is the most important structural beat in a mystery.

**Reorientation clues (Act 2b)**: New evidence that recontextualizes earlier clues. The reader begins to see the real pattern. Previously dismissed details become significant.

**Final clue (late Act 2b or early Act 3)**: The last piece that makes the solution inevitable. This clue should be the one that, combined with everything before it, points to only one possible answer.

**The reveal (Act 3)**: The solution is presented. Every clue is recontextualized. The reader sees the complete picture.

### Step 5: Validate Fair Play

Run this validation after the clue chain is designed:

**For each element of the solution:**
1. Is there at least one clue that proves this element?
2. Is that clue present on the page before the solution is revealed?
3. Could a careful reader identify this clue as significant?
4. Is the clue's true meaning accessible (not requiring specialized knowledge the reader wouldn't have)?

**For the complete solution:**
5. If a reader assembled all genuine clues and ignored all red herrings, would the solution be reachable?
6. Is the solution the only conclusion consistent with all genuine clues? (If multiple solutions fit, the puzzle is broken.)

**For red herrings:**
7. Is every red herring factually true?
8. Is every red herring resolved before or during the reveal?
9. Does every red herring make sense in retrospect?

**Strictness by subgenre:**
- Traditional / Whodunit / Locked Room: All 9 checks must pass.
- Cozy / Amateur Sleuth: Checks 1-6 and 7-9 must pass. Clue visibility can be lower.
- Procedural: Checks 1-6 must pass. Red herrings may be procedural dead ends rather than planted misdirection.
- Noir / Psychological Thriller: Checks 1-3 must pass. Fair play is relaxed but the solution must still be traceable.

### Step 6: Write Clue Bible Entries

Produce completed entries using the Clue Bible Template from knowledge.md. Store in the project's clue bible document.

## Common Failure Modes

- **The unplanted solution element**: The culprit's motive is revealed in the solution scene but was never hinted at. The reader feels cheated.
- **The too-obvious clue**: A clue so prominent that the reader solves the mystery in chapter 3. Calibrate visibility.
- **The impossible inference**: The clue is present but no reasonable reader could connect it to the solution without specialized knowledge. Fair play requires accessible reasoning.
- **The orphan red herring**: A red herring that is never resolved. The reader remembers it and wonders what it meant.
- **The retroactive clue**: A clue inserted during revision that doesn't fit the scene's original logic. It feels planted (in the bad sense).
- **Clue clustering**: Too many clues in one scene. Distribute across the investigation.
