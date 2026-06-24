---
name: mystery-series-novelist
displayName: Mystery Series Novelist
description: Genre-specific companion to the Novelist power for writing mystery and detective fiction series. Provides clue architecture, suspect management, fair-play validation, series continuity tracking, and subgenre-aware plotting. Designed for agent consumption.
keywords:
  - mystery
  - detective
  - whodunit
  - crime-fiction
  - thriller
  - cozy-mystery
  - noir
  - procedural
  - clue
  - series
  - suspect
author: Steven J. Miklovic
version: 0.2.0
harnesses:
  - kiro
type: power
inclusion: manual
categories:
  - documentation
  - writing
ecosystem: []
depends:
  - novelist
  - series-continuity
enhances:
  - novelist
maturity: experimental
trust: community
audience: intermediate
model-assumptions: []
collections:
  - byron-powers
inherit-hooks: false
---
# Mystery Series Novelist

## Overview

Genre-specific companion to the Novelist power for writing mystery and detective fiction series. Provides clue architecture, suspect management, fair-play validation, series continuity tracking, and subgenre-aware plotting. Activate alongside the Novelist and Series Continuity powers for the full creative writing stack.

## Relationship to Novelist

This power is a genre overlay for mystery and detective fiction, with specific support for series writing. It does not replace the Novelist power — it extends it. The Novelist power handles universal craft: premise, character arcs, plot structure, scene drafting, revision, Fiction Seeds, and the professional track. This power handles what is unique to mystery fiction and what is unique to writing a series.

When both powers are active, apply Novelist workflows for general craft decisions and this power's workflows for genre-specific decisions. If guidance conflicts, this power takes precedence on mystery mechanics; Novelist takes precedence on general craft. For series continuity tracking, use the Series Continuity power — this power adds mystery-specific continuity concerns (case references, suspect/witness reappearances, fair-play tracking across books) on top of that foundation.

## Activation

When a user activates this power, determine their subgenre and series status before proceeding.

Ask: "What type of mystery are you writing?"

Map the answer to one of these categories. If the answer spans multiple, note the primary and secondary:

| Subgenre | Key Constraints | Typical Structure |
|----------|----------------|-------------------|
| Cozy | No graphic violence or sex. Amateur sleuth. Small community setting. Emphasis on puzzle and relationships. | Discovery → Investigation → Gathering (social) → Revelation |
| Traditional / Whodunit | Fair-play rules apply strictly. Reader has all clues needed to solve. Emphasis on puzzle. | Crime → Clues → Suspects → False solution → True solution |
| Police Procedural | Realistic investigative process. Chain of evidence. Institutional dynamics. Multiple cases possible. | Crime → Scene processing → Interviews → Forensics → Arrest → Prosecution |
| Hardboiled / Noir | Morally ambiguous protagonist. Atmospheric. Violence has weight. The system is corrupt. | Hire/discovery → Investigation → Betrayal → Deeper truth → Pyrrhic resolution |
| Psychological Thriller | Unreliable narrator common. Internal suspense. The mystery may be "what is real?" | Setup → Doubt → Escalation → Revelation → Recontextualization |
| Legal Thriller | Courtroom procedure. Evidence rules. Dual investigation (legal + factual). | Case assignment → Investigation → Trial prep → Courtroom → Verdict |
| Locked Room / Impossible Crime | The "how" is as important as the "who." Physical puzzle. | Impossible situation → Failed explanations → Key insight → Mechanical solution |
| Amateur Sleuth | Protagonist has a day job that provides access. Series-friendly. | Stumble into crime → Investigate alongside/despite police → Solve |
| Domestic Suspense | Threat comes from within relationships. Trust erosion. Secrets between intimates. | Normalcy → Cracks → Suspicion → Discovery → Confrontation |
| Historical Mystery | Period-accurate investigation methods. Social constraints of the era. | Same as subgenre + historical accuracy layer |

Then ask: "Is this a standalone or part of a series? If series, which book number?"

This determines whether series continuity tracking is active and how much character development carries across books.

## Steering Files

This power has five workflow files. Load them on demand based on the user's current phase:

- **clue-architecture** — Design the clue chain, plant evidence fairly, manage red herrings, and control revelation timing so the reader can solve the mystery but doesn't solve it too early.
- **suspect-management** — Build the suspect pool, design alibis and motives, manage the elimination sequence, and ensure every suspect is a plausible solution until eliminated.
- **series-continuity** — Mystery-specific series continuity concerns layered on top of the Series Continuity power: tracking case outcomes across books, managing recurring suspect/witness appearances, and ensuring fair-play rules are maintained when cases reference previous books.
- **investigation-structure** — Design the investigation sequence, manage procedural plausibility, and structure the protagonist's path from discovery to solution.
- **mystery-subgenre-conventions** — Reference guide for subgenre expectations, reader contract obligations, fair-play rules, and tropes to use deliberately or subvert.

## Core Principles for Agent Behavior

### 1. Fair Play Is Non-Negotiable (Subgenre-Dependent)

In traditional mysteries, whodunits, and cozies, the reader must have access to every clue the detective has. No solution should depend on information withheld from the reader. This is the foundational contract.

When reviewing or generating content, enforce fair-play rules at the strictness level appropriate to the subgenre:
- Traditional / Whodunit / Cozy / Locked Room: Strict fair play. Every clue must appear on the page before the solution.
- Procedural / Amateur Sleuth: Moderate fair play. Clues should be available but may be embedded in procedural detail.
- Noir / Psychological Thriller / Domestic Suspense: Relaxed fair play. The mystery may be more about "why" than "who," and the reader may be deliberately misled by an unreliable narrator.

### 2. The Solution Must Be Inevitable in Retrospect

When the solution is revealed, the reader should think "of course" — not "where did that come from?" Every element of the solution must be traceable to planted clues. The satisfaction of a mystery comes from the reader recognizing that the answer was available all along.

When reviewing a solution reveal, trace every element back to its planted clue. If any element lacks a plant, flag it.

### 3. Every Suspect Must Be Plausible

A suspect pool where only one person could possibly be guilty is not a mystery — it's a formality. Every suspect must have means, motive, and opportunity until the moment they are eliminated. Elimination must be based on evidence, not authorial convenience.

When reviewing suspect construction, verify that each suspect could plausibly be the culprit based on what the reader knows at each point in the story.

### 4. Red Herrings Must Be Honest

A red herring is a clue that points to a false conclusion. It must be genuinely misleading — not a lie. The clue itself must be real; only the conclusion drawn from it is wrong. When the truth is revealed, the reader should be able to see how the red herring misled them without feeling cheated.

When reviewing red herrings, verify: Is the clue itself factually true within the story? Does it point to a plausible false conclusion? When the truth is known, does the red herring make sense in a new light?

### 5. Series Characters Must Grow Without Resetting

In a series, the protagonist and recurring characters must change across books — but each book must also work as a standalone. The reader who picks up book 4 first should not be lost. The reader who has read all four should see growth.

When generating or reviewing series content, check: Does this book's character state follow from the previous book? Can a new reader understand this character without prior books? Is there forward movement in the series arc?

### 6. The Crime Must Matter

The crime is not just a puzzle — it is an event that affects people. Even in a cozy mystery where violence is offscreen, the victim was a person and their death has consequences. The investigation should reveal not just who did it, but why it matters.

When reviewing content, check: Is the victim a character (even if dead)? Do the consequences of the crime extend beyond the puzzle? Does the solution carry emotional weight?

## Clue Bible Template

Every mystery project should maintain a clue bible. When the user starts a project, offer this template:

```
# Clue Bible: {Project Title}

## The Solution
- Culprit: {who}
- Method: {how}
- Motive: {why}
- Opportunity: {when and where}

## Clue Chain

### Clue {N}: {Name}
- Type: {physical evidence / testimony / behavioral / circumstantial / forensic}
- What it actually means: {truth}
- What it appears to mean: {surface reading}
- Planted in: {chapter/scene}
- How planted: {dialogue / description / action / document}
- Visibility: {obvious / embedded / hidden in plain sight}
- Points to: {culprit / red herring suspect / method / motive}
- Connected to solution element: {which part of the solution this proves}

## Red Herrings

### Red Herring {N}: {Name}
- The clue: {what the reader encounters — must be factually true}
- False conclusion: {what the reader is meant to infer}
- True explanation: {what it actually means, revealed later}
- Planted in: {chapter/scene}
- Resolved in: {chapter/scene}
- Target suspect: {which innocent suspect this implicates}

## Revelation Sequence
- {Chapter}: Reader learns {clue/information} → Can now conclude {inference}
- {Chapter}: Reader learns {clue/information} → Previous inference complicated by {new data}
- ...
- {Chapter}: Solution revealed → All clues recontextualized
```

## Suspect Bible Template

```
# Suspect Bible: {Project Title}

## {Suspect Name}

### Status: {culprit / innocent / red herring target}

### Means
- Could they have committed the crime physically? {yes/no, explanation}
- Access to weapon/method: {description}
- Eliminated by: {evidence, chapter} or N/A if culprit

### Motive
- Apparent motive: {what the investigation surfaces}
- True motive: {if different from apparent}
- Motive strength: {strong / moderate / weak}
- Eliminated by: {evidence, chapter} or N/A if culprit

### Opportunity
- Alibi: {claimed alibi}
- Alibi status: {verified / unverified / false / partial}
- Timeline fit: {could they have been at the crime scene?}
- Eliminated by: {evidence, chapter} or N/A if culprit

### Reader Perception Arc
- First impression: {how the reader sees them when introduced}
- Suspicion peak: {chapter where they look most guilty}
- Elimination/revelation: {chapter where they are cleared or revealed}

### Relationship to Victim
- {Nature of relationship}
- {Any secrets in the relationship}
```

## Series Bible Template

For series projects, maintain across all books:

```
# Series Bible: {Series Title}

## Series Arc
- Overarching theme: {what the series explores across all books}
- Protagonist's series arc: {where they start in book 1, where they end in the final book}
- Series-level mystery (if any): {a question that spans multiple books}

## Recurring Characters

### {Character Name}
- Role: {protagonist / partner / antagonist / recurring suspect / authority figure}
- Introduced: {book number}
- Status by book:
  - Book 1: {relationship status, emotional state, key events}
  - Book 2: {changes from book 1}
  - Book 3: {changes from book 2}
- Running threads: {unresolved personal storylines}
- Reader knowledge: {what the reader knows about this character by each book}

## Recurring Setting
- Primary location: {city, town, institution}
- Key locations: {protagonist's home, workplace, regular haunts}
- Community dynamics: {how the setting changes across books}
- Seasonal/temporal progression: {how much time passes between books}

## Continuity Rules
- {Rule 1: e.g., "Each book covers approximately one month of story time"}
- {Rule 2: e.g., "The protagonist's relationship with X evolves each book"}
- {Rule 3: e.g., "Previous cases are referenced but never re-explained in full"}

## Known Continuity Issues
- {Any contradictions between books that need addressing}
```

## Investigation Pacing Guidelines

Mystery pacing follows a distinct pattern different from general fiction:

```
Act 1 (20-25%): Discovery
- The crime occurs or is discovered
- The protagonist is drawn into the investigation
- Initial suspects and clues are established
- The reader forms first theories

Act 2a (25-30%): Investigation Deepens
- Clues accumulate, some genuine, some misleading
- Suspects are interviewed, alibis checked
- The protagonist's theory forms and is challenged
- A complication occurs (second crime, key witness dies, alibi collapses)

Midpoint: The False Solution
- The evidence seems to point clearly to one suspect
- The protagonist (or reader) believes they've solved it
- New information shatters this conclusion

Act 2b (20-25%): Reorientation
- The investigation pivots based on new evidence
- Previously dismissed clues are reexamined
- The real pattern emerges
- The protagonist faces personal stakes or danger

Act 3 (15-20%): Solution
- The final clue falls into place
- The solution is revealed (gathering scene, confrontation, or deduction)
- The culprit's motive is fully understood
- Consequences and resolution
```

The midpoint false solution is the structural element most specific to mystery. It is the moment where the reader's theory is validated and then destroyed, creating the drive to find the real answer.


## Examples

**Good fair-play clue placement:**
> Chapter 3: The detective notices the victim's watch stopped at 2:15 AM. Chapter 7: A witness mentions hearing the grandfather clock chime twice. Chapter 12: The detective realizes the watch was set to a different timezone — the victim was killed at 2:15 AM *Eastern*, not local time.

**Bad red herring:**
> The gardener acts suspiciously for six chapters, then turns out to have no connection to the crime at all. (Dishonest — the reader invested attention for nothing.)

## Troubleshooting

**Agent reveals the solution too early:** Remind it of the revelation sequence in the clue bible. Clues must be planted before the solution is revealed, and the reader should be able to solve it one step ahead of the detective.

**All suspects feel equally suspicious:** Differentiate by giving each suspect a different *type* of suspicion — one has means, another has motive, a third has opportunity. The reader should suspect different people for different reasons.

**Series continuity conflicts with standalone mystery:** The standalone mystery must resolve completely. Series arcs advance but don't require previous books to understand. Use the Series Continuity power for cross-book tracking.
