---
inclusion: manual
---

# Mystery Series Novelist

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

## Clue Architecture

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

## Investigation Structure

# Investigation Structure

## Purpose

Design the investigation sequence — the path the protagonist follows from crime discovery to solution. Ensure the investigation is procedurally plausible for the subgenre, paced to sustain tension, and structured so the reader can follow the detective's reasoning while still being surprised by the solution.

## Inputs Required

Before starting, confirm:
- The solution (from clue-architecture)
- The suspect pool (from suspect-management)
- The subgenre (determines procedural expectations)
- The protagonist's investigative resources (professional detective? amateur? what tools and authority do they have?)

## Workflow

### Step 1: Define Investigative Authority

The protagonist's authority determines what investigation methods are available and plausible:

| Protagonist Type | Can Do | Cannot Do | Tension Source |
|-----------------|--------|-----------|----------------|
| Police detective | Interview suspects, access crime scenes, run forensics, make arrests | Violate procedure without consequences, ignore chain of evidence | Institutional pressure, politics, procedure vs. instinct |
| Private investigator | Interview willing parties, conduct surveillance, access public records | Compel testimony, access sealed records, make arrests | No authority, must persuade or trick, legal gray areas |
| Amateur sleuth | Talk to people in their community, observe, reason | Anything official — no badge, no warrant, no forensic lab | Must justify involvement, police may obstruct, personal risk |
| Journalist | Interview, research, FOIA requests, publish | Compel testimony, access crime scenes, make arrests | Publication pressure, source protection, legal exposure |
| Lawyer | Access case files, interview clients, courtroom authority | Investigate freely (conflict of interest), compel non-client testimony | Dual role, ethical constraints, client secrets |

If the protagonist does something outside their authority, the text must acknowledge the transgression and its risks. An amateur sleuth who breaks into a suspect's house is committing a crime — the narrative should treat it as one.

### Step 2: Design the Investigation Sequence

Map the investigation as a sequence of investigative beats. Each beat is an action the protagonist takes and what they learn from it:

```
Beat 1: {Action} → Learns {Information} → Concludes {Inference} → Next action: {What this leads to}
Beat 2: {Action} → Learns {Information} → Concludes {Inference} → Next action: {What this leads to}
...
```

**Types of investigative beats:**

| Beat Type | Description | Pacing Effect |
|-----------|-------------|---------------|
| Crime scene examination | Protagonist examines physical evidence | Slow, detailed, establishes facts |
| Witness interview | Protagonist talks to someone who saw or knows something | Medium, dialogue-driven, reveals character |
| Suspect interrogation | Protagonist confronts a suspect directly | High tension, adversarial |
| Research / records | Protagonist examines documents, databases, history | Slow, can be compressed in narration |
| Surveillance / observation | Protagonist watches and waits | Slow build to a reveal |
| Forensic results | Protagonist receives lab results or expert analysis | Information delivery, can be compressed |
| Collaboration | Protagonist discusses the case with a partner or ally | Medium, allows the reader to hear reasoning |
| Confrontation | Protagonist is threatened, warned off, or attacked | High tension, raises stakes |
| Discovery | Protagonist stumbles on something unexpected | Surprise, redirects investigation |
| Deduction | Protagonist reasons through the evidence | Internal, can be shown through dialogue or thought |

### Step 3: Pace the Investigation

The investigation must maintain momentum while allowing the reader to process information:

**Rhythm**: Alternate between high-tension beats (interrogations, confrontations, discoveries) and lower-tension beats (research, collaboration, deduction). Three high-tension beats in a row exhausts the reader. Three low-tension beats in a row bores them.

**Information rate**: The reader should learn something new in every chapter. If a chapter passes without new information, the investigation feels stalled.

**Dead ends**: Include 1-2 investigative dead ends — leads that go nowhere. This is realistic and creates frustration that mirrors the protagonist's experience. But dead ends must be brief. A dead end that consumes an entire chapter feels like wasted time.

**The ticking clock**: If possible, introduce a time pressure that prevents the protagonist from investigating at leisure:
- Another crime is imminent
- A suspect is about to flee
- Evidence is being destroyed
- An innocent person is accused
- A deadline (trial date, statute of limitations, personal obligation)

### Step 4: Design the Reasoning Chain

The protagonist's reasoning should be visible to the reader — not as exposition, but as a traceable chain of logic:

**Show the reasoning through:**
- Dialogue with a partner ("What if the alibi is wrong because...")
- Internal monologue at key moments ("Something about the timeline didn't fit...")
- Physical action (re-examining a clue, revisiting a location, testing a theory)
- A reasoning scene (the protagonist reviews evidence, often with visual aids — a board, a notebook, a timeline)

**The reader should be able to follow the reasoning but not necessarily reach the same conclusion.** The detective sees the pattern; the reader sees the pieces. The gap between them is what makes the reveal satisfying.

**Reasoning errors**: The protagonist should make at least one wrong inference during the investigation. This is realistic, creates the false-solution beat, and shows that the mystery is genuinely difficult. The error should be logical given the available evidence — not stupid.

### Step 5: Design the Solution Reveal

The reveal is the structural climax of a mystery. Design it for maximum impact:

**Reveal formats by subgenre:**

| Subgenre | Typical Reveal Format |
|----------|----------------------|
| Cozy / Traditional | The gathering — suspects assembled, detective explains | 
| Procedural | The interrogation — detective breaks the culprit in interview |
| Noir | The confrontation — detective faces the culprit, often alone and at risk |
| Psychological Thriller | The realization — protagonist (and reader) understands the truth |
| Locked Room | The demonstration — detective shows how the impossible crime was done |
| Legal Thriller | The courtroom — truth emerges through testimony and cross-examination |

**Reveal structure:**
1. The final clue or insight that triggers the solution
2. The recontextualization — earlier clues are reinterpreted in light of the truth
3. The confrontation with the culprit (or the culprit's exposure)
4. The motive revealed in full — why they did it
5. The aftermath — consequences for the culprit, the community, and the protagonist

**The recontextualization is the most important element.** This is where the reader experiences the satisfaction of a well-constructed mystery — seeing how everything fits together. Do not rush it.

### Step 6: Validate Investigation Plausibility

After designing the investigation sequence, run these checks:

1. **Authority check**: Does the protagonist stay within their investigative authority (or acknowledge when they don't)?
2. **Causality check**: Does each investigative beat lead logically to the next? Is the protagonist following evidence, not authorial convenience?
3. **Information access check**: Could the protagonist realistically obtain each piece of information they acquire?
4. **Pacing check**: Is there new information in every chapter? Are high and low tension beats alternating?
5. **Reasoning visibility check**: Can the reader follow the protagonist's logic at each step?
6. **Dead end check**: Are dead ends brief and realistic? Do they serve a purpose (misdirection, character development, procedural realism)?
7. **Reveal completeness check**: Does the reveal address every clue, every red herring, and every suspect? Nothing should be left unexplained.

## Common Failure Modes

- **The convenient witness**: A witness appears exactly when needed with exactly the right information. Witnesses should be sought, not delivered.
- **The genius leap**: The protagonist makes a deductive leap that no reader could follow. Show the reasoning.
- **The passive detective**: The protagonist receives information rather than pursuing it. The detective must drive the investigation.
- **The procedural violation without consequence**: The protagonist breaks rules and nothing happens. If they break rules, there must be risk.
- **The stalled middle**: The investigation produces no new information for multiple chapters. Every chapter must advance the case.
- **The incomplete reveal**: The solution is presented but not all clues are accounted for. The reader is left with unanswered questions about the evidence.

## Mystery Subgenre Conventions

# Mystery Subgenre Conventions Reference

## Purpose

Provide the agent with subgenre-specific expectations, fair-play rules, common tropes (to use deliberately or subvert), and reader contract obligations. Reference this workflow when validating subgenre compliance or when the user asks for genre-aware guidance.

## The Fair-Play Rules (Knox and Van Dine, Modernized)

These rules originated in the Golden Age of detective fiction. Not all apply to every subgenre, but they represent the reader's baseline expectations for mystery fiction. Violations should be deliberate and acknowledged.

### Rules That Still Apply Universally

1. **The culprit must appear early in the story.** A solution that names someone introduced in the final chapter is cheating.
2. **The detective must not withhold clues from the reader.** If the detective notices something, the reader must be told (even if the significance is not explained).
3. **The solution must not depend on accident or coincidence.** The culprit must have acted deliberately. The detective must solve the case through reasoning, not luck.
4. **The solution must be the only one consistent with all the clues.** If multiple solutions fit the evidence equally well, the puzzle is broken.

### Rules That Apply to Traditional/Whodunit/Cozy/Locked Room

5. **No secret passages or unknown poisons** unless established in the world before the crime. The solution cannot depend on information the reader had no way to know.
6. **No supernatural solutions** unless the story is established as supernatural from the beginning.
7. **The detective must not be the culprit** (with rare, well-signaled exceptions in literary mystery).
8. **Servants and minor characters should not be the culprit** unless they have been developed as real characters with page time and motive.

### Rules That Are Relaxed in Modern Mystery

9. **The detective's romantic interest is not automatically above suspicion.** Modern mystery allows any character to be the culprit if the evidence supports it.
10. **Twin siblings and disguises** are acceptable if established plausibly. The Golden Age prohibition was against lazy use, not the device itself.

## Cozy Mystery

**Reader contract**: A puzzle in a safe emotional space. The violence is offscreen. The community is charming. The amateur sleuth is relatable. Justice is restored by the end.

**Core expectations:**
- No graphic violence, sex, or profanity
- Amateur sleuth with a distinctive day job (baker, librarian, knitter, bookshop owner)
- Small, defined community where everyone knows everyone
- The investigation is driven by social access, not authority
- Humor and warmth alongside the mystery
- Justice is served — the culprit is caught and the community heals
- A hook beyond the mystery (recipes, crafts, cats, a specific setting)

**Series expectations:**
- The community is a character — it develops across books
- The protagonist's personal life evolves (romance, friendships, business)
- Previous cases are part of the community's history
- The body count should not make the setting implausible (a village with 12 murders strains credibility — address this or space books further apart in time)

**Tropes to use deliberately:**
- The nosy protagonist who can't help investigating
- The skeptical police officer who grudgingly respects the amateur
- The charming love interest who may or may not be a suspect
- The eccentric community members who provide comic relief and clues
- The gathering scene where the detective reveals the solution

**Tropes to handle carefully:**
- The protagonist in constant mortal danger — cozies should feel safe
- The incompetent police — they can be skeptical of the amateur, but shouldn't be stupid
- The victim nobody liked — even in a cozy, the victim should be a person worth caring about

**Comp title calibration**: Fluke, McKinlay, Budewitz, Beaton, Joanne Fluke

## Traditional / Whodunit

**Reader contract**: A fair puzzle. The reader has all the information needed to solve the mystery. The satisfaction comes from the intellectual challenge and the elegance of the solution.

**Core expectations:**
- Strict fair play — every clue on the page before the solution
- A defined suspect pool, each with means, motive, and opportunity
- A detective who reasons from evidence (not intuition alone)
- A solution that is surprising but inevitable in retrospect
- The puzzle is the primary pleasure — character and theme support it

**Series expectations:**
- The detective's method and personality are the series anchor
- Cases should vary in type and difficulty
- The detective may have a Watson figure who serves as reader proxy
- Character development is present but secondary to the puzzle

**Tropes to use deliberately:**
- The locked room or impossible crime
- The dying message
- The unreliable witness
- The clue hidden in plain sight
- The false solution that precedes the true one

**Tropes to handle carefully:**
- The omniscient detective who sees everything — show the reasoning, not just the conclusion
- The overly complex solution — elegance beats complexity
- The culprit who confesses when confronted — the evidence should be sufficient without confession

**Comp title calibration**: Christie, Sayers, Tey, Horowitz, Turton

## Police Procedural

**Reader contract**: Realistic investigative process. The institution matters — its resources, its politics, its constraints. The detective works within a system, and the system shapes the investigation.

**Core expectations:**
- Investigative procedure is depicted accurately (or plausibly)
- Chain of evidence matters — how evidence is collected affects whether it's admissible
- The detective has a team, a chain of command, and institutional pressures
- Multiple cases may run simultaneously
- The personal cost of the work is visible (burnout, relationship strain, moral compromise)
- The solution comes through methodical work, not a single brilliant insight

**Series expectations:**
- The precinct/department is a recurring setting with its own dynamics
- Partner relationships are central and evolve across books
- Institutional politics create ongoing tension
- The protagonist's career trajectory is a series arc
- Cases may connect across books through recurring criminals or systemic issues

**Tropes to use deliberately:**
- The partner dynamic (experienced/rookie, by-the-book/maverick)
- The case that gets personal
- The political pressure to close a case quickly
- The procedural shortcut that backfires
- The cold case reopened

**Tropes to handle carefully:**
- The rogue cop who breaks every rule — consequences must exist
- The forensic magic that solves everything — real forensics is slower and less conclusive
- The confession under pressure — modern readers are aware of false confessions

**Comp title calibration**: Rankin, Connelly, French, Penny, Paretsky

## Hardboiled / Noir

**Reader contract**: The world is corrupt. The detective navigates moral ambiguity. The mystery reveals not just who did it, but how deep the rot goes. The resolution may be pyrrhic — justice is imperfect.

**Core expectations:**
- Morally ambiguous protagonist — flawed, compromised, but with a code
- The crime is a symptom of systemic corruption
- Violence has weight and consequence
- Atmosphere is as important as plot — the setting is oppressive, seductive, or both
- The solution often implicates powerful people or institutions
- The ending may be bittersweet or bleak — full justice is rare

**Series expectations:**
- The protagonist accumulates damage across books (physical, emotional, moral)
- The city/setting darkens or reveals new layers across books
- Recurring antagonists may be institutional rather than individual
- The protagonist's moral code is tested and may evolve
- Each book should stand alone but the cumulative weight of the series matters

**Tropes to use deliberately:**
- The femme fatale / homme fatal (use with awareness of gender dynamics)
- The client who isn't telling the whole truth
- The powerful figure who is untouchable
- The betrayal by someone trusted
- The detective who solves the case but can't fix the world

**Tropes to handle carefully:**
- Misogyny as atmosphere — noir can examine power dynamics without endorsing them
- The alcoholic detective — if used, treat addiction seriously, not as character flavor
- Nihilism without purpose — the bleakness must serve the story's moral argument

**Comp title calibration**: Chandler, Hammett, Mosley, Lehane, Mina

## Psychological Thriller

**Reader contract**: The mystery is internal. The question may be "what is real?" as much as "who did it?" The reader's perception is deliberately manipulated. Trust no one — including the narrator.

**Core expectations:**
- Unreliable narration is common and expected
- The protagonist's psychology is the primary subject
- Suspense comes from uncertainty about reality, not just about the culprit
- The twist recontextualizes everything the reader thought they knew
- Pacing is driven by escalating paranoia, not investigative procedure
- The domestic or intimate setting amplifies claustrophobia

**Series expectations:**
- Psychological thrillers are more commonly standalones
- If serialized, the protagonist's psychological state is the series arc
- Each book should present a fundamentally different psychological puzzle
- Recurring characters are rare — the genre thrives on isolation

**Tropes to use deliberately:**
- The unreliable narrator
- The gaslighting partner/friend/authority figure
- The memory that doesn't add up
- The dual timeline that reveals a different truth
- The protagonist who may be the villain

**Tropes to handle carefully:**
- Mental illness as plot twist — depicting mental illness requires care and accuracy
- The "it was all in their head" ending — feels cheap unless earned
- The twist for twist's sake — the recontextualization must deepen meaning, not just surprise

**Comp title calibration**: Flynn, Hawkins, Ware, Jewell, Miranda

## Locked Room / Impossible Crime

**Reader contract**: The "how" is the puzzle. The crime appears physically impossible. The solution is a mechanical or logical explanation that the reader could theoretically deduce. This is the purest form of puzzle mystery.

**Core expectations:**
- The impossible situation is clearly established and genuinely appears impossible
- The solution is a physical/logical mechanism, not supernatural or coincidental
- Fair play is absolute — every element of the mechanism must be clued
- The detective demonstrates the solution (often physically or with a diagram)
- The "who" and "why" matter, but the "how" is the star

**Tropes to use deliberately:**
- The sealed room with no exit
- The crime committed in front of witnesses who saw nothing
- The victim found in an impossible location
- The weapon that couldn't exist
- The alibi that is physically unbreakable (until it isn't)

**Tropes to handle carefully:**
- The overly mechanical solution — it must be elegant, not a Rube Goldberg machine
- The solution that requires perfect timing and luck — the culprit's plan must be robust
- The solution that only works on paper — a reader who thinks it through should find it plausible

**Comp title calibration**: Carr, Halter, Shimada, Turton, Arisugawa

## Using This Reference

When validating subgenre compliance:
1. Identify the project's declared subgenre (from activation).
2. Check the manuscript against the "Core expectations" for that subgenre.
3. Check fair-play rules at the appropriate strictness level.
4. Flag any "Tropes to handle carefully" that appear without apparent awareness.
5. For series, check series-specific expectations.

When advising on creative decisions:
1. Reference the relevant subgenre's expectations and tropes.
2. Distinguish between conventions (reader expectations to honor) and clichés (overused patterns to subvert or avoid).
3. A trope used deliberately and with awareness is craft. A trope used unconsciously is a cliché.
4. Subversion of conventions is valid but must be signaled — the reader should know the author is breaking a rule on purpose.

## Series Continuity

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

## Suspect Management

# Suspect Management

## Purpose

Build and manage the suspect pool so that every suspect is a plausible culprit until eliminated by evidence. Design alibis, motives, and the elimination sequence to maintain tension and misdirection throughout the investigation. This workflow produces suspect bible entries.

## Inputs Required

Before starting, confirm:
- The solution (culprit, method, motive, opportunity)
- The victim (who they were, their relationships)
- The subgenre (determines suspect pool size and elimination style)
- The setting (determines who had access)

## Workflow

### Step 1: Determine Pool Size

The suspect pool must be large enough to sustain the mystery but small enough for the reader to track:

| Subgenre | Typical Pool Size | Notes |
|----------|------------------|-------|
| Cozy | 4-6 | Small community, reader knows everyone |
| Traditional / Whodunit | 5-8 | Classic range. Each suspect gets development. |
| Procedural | 3-5 initially, expanding | Investigation reveals new suspects over time |
| Noir | 3-5 | Fewer suspects, deeper moral complexity |
| Locked Room | 3-6 | Constrained by the locked setting |
| Psychological Thriller | 2-4 | The suspect may be the narrator |
| Domestic Suspense | 2-3 | Intimate circle, high stakes per suspect |

### Step 2: Design Each Suspect

For each suspect, build a complete profile using the Suspect Bible Template from knowledge.md. Key requirements:

**Means**: Every suspect must have plausible access to the method of the crime. If the victim was poisoned, every suspect must have had access to the poison (or the reader must believe they could have). Eliminate suspects by proving they lacked means only when the evidence is specific and convincing.

**Motive**: Every suspect must have a reason to want the victim dead (or harmed, or silenced). Motives should be:
- Distinct from each other (not five suspects who all owed the victim money)
- Proportional to the crime (murder requires a strong motive; theft can have a weaker one)
- Discoverable through investigation (the protagonist learns motives, they aren't just stated)

**Opportunity**: Every suspect must have had the chance to commit the crime. This means:
- Their alibi is unverified, false, or has a gap
- They were physically able to be at the crime scene at the relevant time
- No evidence conclusively places them elsewhere

**The culprit's profile** must be designed so that their means, motive, and opportunity are present but not more prominent than other suspects'. The culprit should not be the most obvious suspect or the least obvious — they should be the one the reader considered and then dismissed.

### Step 3: Design Alibis

Alibis are the primary mechanism for suspect elimination. Design them carefully:

**Alibi types:**
- **Verified alibi**: Confirmed by independent, reliable evidence (security footage, multiple witnesses, documented location). Eliminates the suspect conclusively.
- **Witness-dependent alibi**: Confirmed by one person who could be lying, mistaken, or coerced. Appears to eliminate but can be broken.
- **Partial alibi**: Accounts for part of the relevant time window but not all. Suspicious but not conclusive.
- **False alibi**: The suspect lies about their whereabouts. When broken, it increases suspicion but doesn't prove guilt (innocent people lie for innocent reasons).
- **No alibi**: The suspect cannot account for their time. Suspicious but common — most people can't prove where they were at 2 AM.

**The culprit's alibi** should be one of:
- Witness-dependent (the witness is mistaken or lying)
- Partial (covers most of the window but not the critical moment)
- Cleverly constructed (appears verified but has a flaw the investigation eventually finds)

It should NOT be "no alibi" — a culprit with no alibi is too easy.

### Step 4: Design the Elimination Sequence

Suspects are eliminated over the course of the investigation. The sequence matters:

**Early eliminations (Act 1 / early Act 2)**: Remove 1-2 suspects quickly. This shows the investigation is progressing and narrows the field. Eliminate suspects the reader didn't seriously consider — this builds confidence in the investigation without removing tension.

**Mid-investigation eliminations (Act 2a)**: Remove suspects the reader did consider. Each elimination should be surprising or reveal new information. The elimination of a strong suspect should redirect suspicion toward the false-solution suspect.

**False solution (Midpoint)**: The evidence converges on one suspect. The reader (and possibly the protagonist) believes the case is solved. Then new evidence eliminates this suspect or reveals the case is more complex than it appeared.

**Late eliminations (Act 2b)**: The remaining suspects are examined more closely. Eliminations here should recontextualize earlier evidence. The reader begins to see the real pattern.

**Final elimination**: The last innocent suspect is cleared, leaving only the culprit. This should happen through evidence, not process of elimination — the reader should see why the culprit is guilty, not just that everyone else isn't.

### Step 5: Design the Reader's Suspicion Arc

For each suspect, map how the reader's suspicion should change over the course of the book:

```
Suspect A: Low → Medium → HIGH (false solution) → Eliminated → Low
Suspect B: Medium → Low → Medium → Eliminated → Low
Suspect C (culprit): Medium → Low (dismissed) → Medium (reconsidered) → HIGH (revealed)
Suspect D: Low → Medium → Low → Eliminated
```

The culprit's arc should follow a "considered → dismissed → reconsidered → revealed" pattern. The dismissal phase is critical — the reader must have a reason to stop suspecting the culprit before the truth emerges.

### Step 6: Validate Suspect Pool

After designing all suspects, run these checks:

1. **Plausibility check**: At the midpoint, could a reader make a reasonable case for at least 3 suspects? If not, the pool is too thin.
2. **Distinctiveness check**: Are the suspects distinguishable from each other? (Different motives, different relationships to the victim, different personalities.) If two suspects are interchangeable, merge them.
3. **Elimination fairness check**: Is every elimination based on evidence the reader has access to? No suspect should be eliminated by information the reader doesn't have.
4. **Culprit camouflage check**: Is the culprit's profile (means, motive, opportunity) roughly as prominent as 2-3 other suspects? If the culprit stands out as either too suspicious or too innocent, recalibrate.
5. **Victim connection check**: Does every suspect have a meaningful relationship to the victim? Suspects with no real connection to the victim feel arbitrary.

### Step 7: Write Suspect Bible Entries

Produce completed entries using the Suspect Bible Template from knowledge.md. Store in the project's suspect bible document.

## Common Failure Modes

- **The obvious culprit**: The most suspicious person did it. The reader solves it immediately. The culprit should be considered and dismissed before being revealed.
- **The invisible culprit**: The culprit has so little page time or development that the reader doesn't consider them. The culprit must be a real character, not a name.
- **The arbitrary elimination**: A suspect is cleared by evidence that appears from nowhere. Eliminations must use evidence the reader has encountered.
- **The motive vacuum**: A suspect has means and opportunity but no discernible motive. Every suspect needs a reason.
- **The alibi fortress**: Every suspect except the culprit has an ironclad alibi. This makes the solution obvious by elimination. Give multiple suspects breakable alibis.
- **Suspect homogeneity**: All suspects are the same type (all business partners, all family members with inheritance motives). Diversify relationships and motives.
