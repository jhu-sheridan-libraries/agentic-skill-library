<!-- forge:version 0.1.0 -->
---
inclusion: manual
---

# Fantasy Novelist

## Relationship to Novelist and Series Continuity

This power is a genre overlay. It does not replace the Novelist power — it extends it. The Novelist power handles universal craft: premise, character arcs, plot structure, scene drafting, revision, Fiction Seeds, and the professional track. The Series Continuity power handles cross-book tracking, series bibles, and arc design. This power handles what is unique to fantasy fiction.

When all three powers are active, apply Novelist workflows for general craft, Series Continuity for continuity tracking, and this power for genre-specific decisions. If guidance conflicts, this power takes precedence on fantasy mechanics; Novelist takes precedence on general craft; Series Continuity takes precedence on continuity infrastructure.

## Activation

When a user activates this power, determine their subgenre and magic approach before proceeding.

Ask: "What type of fantasy are you writing?"

Map the answer to one of these categories:

| Subgenre | Key Constraints | Typical Scope |
|----------|----------------|---------------|
| Epic / High Fantasy | Secondary world, large-scale conflict, multiple POVs, deep history. Magic is often systematic. | Continental to world-spanning |
| Urban Fantasy | Magic in the modern real world. Hidden supernatural communities. Protagonist navigates both worlds. | City-scale |
| Grimdark | Morally gray characters, realistic consequences, subverted tropes. The world is harsh and the heroes are flawed. | Variable |
| Cozy Fantasy | Low stakes, warm tone, found family, comfort. The world has magic but the story is about belonging. | Village to small community |
| Portal / Isekai | Protagonist from our world enters a fantasy world. Fish-out-of-water dynamics. | Two worlds |
| Romantasy | Romance is co-primary with the fantasy plot. Relationship arc and fantasy arc must both resolve. | Variable |
| Sword & Sorcery | Action-focused, personal stakes, roguish protagonists. Less world-saving, more adventure. | Local to regional |
| Mythic / Literary Fantasy | Prose-forward, thematically dense, draws on myth and folklore. Magic is numinous, not systematic. | Variable |
| Historical Fantasy | Real historical period with fantasy elements. Period accuracy plus magic. | Historical setting |
| Progression / LitRPG | Protagonist grows in measurable power. Systems, levels, or quantified magic. | Variable |

Then ask: "How does magic work in your world? (Hard system with rules, soft and mysterious, or somewhere in between?)"

This determines the magic hardness rating:
- **Hard (Sanderson-style)**: Rules are explicit, costs are defined, the reader understands the system. Magic can solve plot problems because the reader knows its limits.
- **Soft (Tolkien-style)**: Magic is mysterious, numinous, not fully explained. Magic should not solve plot problems because the reader doesn't know its limits.
- **Hybrid**: Some aspects are systematic, others are mysterious. Define which is which.

## Steering Files

This power has five workflow files:

- **magic-system-design** — Design magic systems with rules, costs, limitations, and cultural integration. Calibrated to the project's hardness level.
- **fantasy-species-and-cultures** — Create non-human species and cultures with mythic resonance, internal logic, and narrative purpose. Avoid monocultures and rubber-forehead species.
- **mythic-world-building** — Build fantasy worlds with cosmology, pantheons, prophecy systems, deep history, and geography that serves the narrative.
- **magic-consistency** — Validate manuscript content against the magic bible, species bible, and world rules. Calibrated to hardness level.
- **fantasy-subgenre-conventions** — Reference guide for subgenre expectations, tropes, reader contracts, and comp title calibration.

## Core Principles for Agent Behavior

### 1. Sanderson's Laws Apply (Calibrated to Hardness)

**First Law**: An author's ability to solve conflict with magic is directly proportional to how well the reader understands said magic.
- Hard magic: Can solve problems. The reader knows the rules.
- Soft magic: Cannot solve problems. Using it as a solution feels like deus ex machina.
- Hybrid: Only the understood parts can solve problems.

**Second Law**: Limitations are more interesting than powers. What magic cannot do, what it costs, and how it fails are more important than what it can do.

**Third Law**: Expand what you already have before adding something new. Deepen existing magic before introducing new systems.

When reviewing or generating content, enforce these laws at the project's hardness level.

### 2. Magic Must Have Cost

Every magic system needs a cost. Costless magic eliminates tension. The cost can be:
- **Physical**: Energy, health, lifespan, pain
- **Material**: Rare components, consumed resources, specific conditions
- **Social**: Stigma, isolation, obligation, political consequence
- **Psychological**: Memory loss, personality change, addiction, moral compromise
- **Opportunity**: Using magic for X means you cannot use it for Y

When the user introduces magic, ask: "What does it cost to use this?"

### 3. The World Must Feel Lived-In

Fantasy worlds should feel like they existed before the story started and will continue after it ends. This means:
- History that shaped the present (not just backstory for the protagonist)
- Cultures with internal logic (not just aesthetic)
- Economics that make sense (someone grows the food, someone builds the roads)
- Religion or philosophy that people actually practice (not just set dressing)
- Consequences of magic on society (if healing magic exists, medicine is different; if teleportation exists, trade routes are different)

### 4. Non-Human Species Must Be Non-Human

If a species thinks, perceives, and values exactly what humans do, it's a human in costume. Push at least two axes of difference:
- Perception (different senses, different relationship to time)
- Values (different survival pressures produce different priorities)
- Social structure (different biology produces different family/community structures)
- Communication (different cognitive architecture produces different language)

This applies even to "standard" fantasy species. Elves that are just tall pretty humans are a missed opportunity.

### 5. Prophecy Is a Narrative Tool, Not a Plot Device

Prophecy in fantasy must be handled with care:
- Prophecy that comes true exactly as stated is boring
- Prophecy that is misinterpreted is interesting
- Prophecy that is self-fulfilling (the attempt to prevent it causes it) is classic
- Prophecy that is ambiguous enough to support multiple interpretations creates tension
- Prophecy should constrain the story, not dictate it

When the user introduces prophecy, ask: "How can this prophecy be misinterpreted?"

### 6. Trope Awareness Is Mandatory

Fantasy is the most trope-dense genre in fiction. Every element — the chosen one, the dark lord, the quest, the mentor's death, the magic school — carries reader expectations. Using a trope is fine. Using a trope without awareness is a craft error.

When generating or reviewing content that uses a common trope, note: "This uses the [trope name] trope. Is this intentional? If so, what does this version add or subvert?"

## Magic Bible Template

Every fantasy project should maintain a magic bible:

```
# Magic Bible: {Project Title}

## Hardness: {Hard / Soft / Hybrid}

## System Overview
- Name: {what the magic is called in-world}
- Source: {where magic comes from — innate, learned, granted, environmental, divine}
- Who can use it: {everyone, a subset, specific bloodlines, anyone who trains}
- How it is perceived: {respected, feared, regulated, hidden, mundane}

## Rules (Hard Systems)

### Rule {N}: {Name}
- Statement: {what the rule is}
- Mechanism: {how it works}
- Established in: {chapter/scene}
- Exceptions: {any known exceptions and their justification}

## Costs

### Cost {N}: {Name}
- Type: {physical / material / social / psychological / opportunity}
- Description: {what the user pays}
- Severity: {minor / moderate / severe / catastrophic}
- Scales with: {power used, duration, complexity}

## Limitations

### Limitation {N}: {Name}
- What magic cannot do: {specific impossibility}
- Why: {in-world reason or simply "this is the rule"}
- Story function: {what conflict this limitation creates}

## Failure Modes
- What happens when magic goes wrong: {consequences}
- What causes failure: {conditions}
- How common is failure: {frequency}

## Cultural Integration
- How does this magic affect society: {social consequences}
- How is it regulated: {laws, customs, institutions}
- How does it affect economics: {trade, labor, resources}
- How does it affect warfare: {military applications and countermeasures}
- How does it affect daily life: {mundane applications}

## Known Violations
- {Any deliberate rule-breaks with justification}
```

## Species & Culture Bible Template

```
# Species & Culture Bible: {Project Title}

## {Species Name}

### Biology
- Lifespan: {and life stages}
- Physical traits: {distinguishing features}
- Senses: {any differences from human baseline}
- Environmental needs: {habitat, diet, climate}
- Magical affinity: {relationship to magic, if any}

### Cognition & Perception
- How they experience time: {especially for long-lived species}
- Decision-making: {individual, consensus, hierarchical, other}
- Relationship to death: {especially for immortal or very long-lived species}
- What they value: {core values shaped by biology and history}

### Culture (NOT monolithic — define at least two cultural variants)

#### {Culture Variant A}
- Social structure: {hierarchy, egalitarian, clan-based, other}
- Relationship to magic: {practitioners, fearful, indifferent}
- Relationship to other species: {allied, hostile, indifferent, trading partners}
- Customs and taboos: {what they do and don't do}
- Aesthetic: {art, architecture, clothing, music}

#### {Culture Variant B}
- {Same fields, different answers — demonstrating internal diversity}

### Narrative Role
- Why this species exists in the story: {conflict, theme, perspective}
- How the reader connects: {identification point despite differences}
- Common tropes to be aware of: {noble savage, always chaotic evil, etc.}
```

## Consistency Validation Rules

When reviewing manuscript content, apply these checks:

1. **Magic rule violations** — Does any scene use magic in a way that contradicts the magic bible? At hard hardness, flag all violations. At soft hardness, flag only direct contradictions with established numinous behavior.

2. **Cost evasion** — Does any character use magic without paying the established cost? Flag unless the text explicitly addresses why the cost was avoided (and that exception is consistent with the system).

3. **Deus ex magica** — Does magic solve a problem the reader couldn't have anticipated? At hard hardness, the reader must understand the magic well enough to see the solution coming. At soft hardness, magic should create problems more often than it solves them.

4. **Species behavior violations** — Does any non-human character behave in a way that contradicts their species/culture bible? Distinguish individual variation from authorial inconsistency.

5. **World-building contradictions** — Does any scene contradict established geography, history, political structures, or cultural norms?

6. **Prophecy consistency** — If prophecy exists, is it consistent across all mentions? Does the fulfillment match the prophecy's actual words (not just the characters' interpretation)?

7. **Trope awareness** — Does any scene use a major fantasy trope without apparent awareness? Flag with the trope name and ask whether the usage is intentional.

## Fantasy Species And Cultures

# Fantasy Species & Cultures

## Purpose

Create non-human species and cultures with mythic resonance, internal logic, and narrative purpose. Avoid monocultures, rubber-forehead species, and harmful stereotypes. This workflow produces species and culture bible entries.

## Inputs Required

Before starting, confirm:
- Subgenre (determines whether species lean toward mythic archetype or biological plausibility)
- The species' narrative role (antagonist, ally, mirror to humanity, source of wonder, other)
- Whether the species is original or drawn from existing mythology/folklore
- The world's magic system (species may have unique relationships to magic)

## Workflow

### Step 1: Determine Species Origin

| Origin | Design Approach | Key Consideration |
|--------|----------------|-------------------|
| Original creation | Build from scratch using biology, culture, and narrative need | Must feel coherent and purposeful |
| Mythological / Folklore | Draw from existing tradition, then make it your own | Respect the source; add depth beyond the archetype |
| Standard fantasy (elves, dwarves, orcs) | Start from reader expectations, then subvert or deepen | The reader has preconceptions — use or challenge them deliberately |
| Hybrid | Combine elements from multiple sources | Ensure the combination is coherent, not just novel |

**For standard fantasy species**: The reader arrives with expectations from Tolkien, D&D, and decades of fantasy fiction. You have three options:
1. **Honor the archetype**: Use the species as the reader expects, but add depth the reader doesn't expect. Elves are long-lived and wise — but what does immortality actually do to a mind?
2. **Subvert the archetype**: Deliberately invert expectations. Orcs are the civilized ones; elves are the threat. Signal the subversion early so the reader adjusts.
3. **Reimagine entirely**: Keep the name but rebuild from scratch. Your elves are nothing like Tolkien's. Establish this quickly to prevent false expectations.

Whatever you choose, do it deliberately. The worst option is using the archetype unconsciously.

### Step 2: Design Biology and Physicality

Even in fantasy, species should have internal biological logic:

**Physical design:**
- Body plan (humanoid, non-humanoid, shapeshifting)
- Size and scale (affects architecture, warfare, social dynamics)
- Lifespan (the single most impactful biological trait — see Step 3)
- Senses (any differences from human baseline affect perception and culture)
- Diet (affects agriculture, trade, and social customs)
- Reproduction (affects family structure, population dynamics, and social organization)
- Relationship to magic (innate ability, susceptibility, immunity, dependence)

**For mythic/literary fantasy**: Biological plausibility is less important than symbolic resonance. A phoenix doesn't need an evolutionary explanation — it needs to mean something. But even symbolic species should be internally consistent.

**For epic/grimdark fantasy**: More biological grounding is expected. The species should feel like it could exist in the world, even if the world has magic.

### Step 3: Address Lifespan Seriously

Lifespan is the most underexplored trait in fantasy species design. If a species lives for centuries or is immortal, the consequences are profound:

**Cognitive consequences:**
- Memory: How do they handle centuries of memories? Do they forget? Compress? Become detached?
- Learning: With centuries to learn, why aren't they all experts at everything? (Define a limitation.)
- Boredom: What keeps an immortal engaged? What happens when they stop caring?
- Grief: They will outlive every mortal they love. How does this shape their relationships?
- Change: Do they change over centuries, or calcify? Both are interesting.

**Social consequences:**
- Power accumulation: Immortals who accumulate wealth and influence for centuries create extreme inequality.
- Generational conflict: If the elders never die, the young never lead. How is this managed?
- Cultural stagnation: Long-lived species may resist change. How does innovation happen?
- Relationship to mortals: Do they form bonds with mortals knowing they'll outlive them? How does this affect both sides?

**If you include a long-lived species, you must address at least two of these consequences.** A species that lives for a thousand years but acts exactly like humans with pointy ears is a missed opportunity.

### Step 4: Design Cultures (Plural)

**The monoculture problem**: An entire species with one culture, one language, one political system, and one set of values is not a species — it's a stereotype. Humans don't work this way. Neither should fantasy species.

**Minimum cultural diversity**: Define at least two distinct cultural variants for any species that appears significantly in the story. They should differ in:
- Political organization
- Relationship to magic
- Relationship to other species
- Values and priorities
- Aesthetic and artistic expression

**Cultural design process:**
1. Start with the species' biology and environment — these constrain culture
2. Define the core survival pressures — these shape values
3. Define how different groups responded differently to the same pressures — this creates cultural diversity
4. Define points of contact and conflict between cultural variants — this creates internal politics
5. Define how each culture relates to the protagonist's story — this ensures narrative relevance

### Step 5: Address Harmful Tropes

Fantasy has a history of species-as-racial-allegory that modern readers are aware of and sensitive to. Address these deliberately:

**Tropes to handle with care:**
- **Always Chaotic Evil**: An entire species that is inherently evil. If used, examine why — is it biological (problematic), cultural (more nuanced), or the result of specific historical circumstances (most interesting)?
- **Noble Savage**: A "primitive" species that is pure and uncorrupted. This romanticizes and dehumanizes simultaneously.
- **Species as racial coding**: Fantasy species whose culture, appearance, or behavior maps onto real-world racial stereotypes. Audit for this.
- **The Dying Race**: A species in decline, often noble and tragic. Can be powerful if the decline has specific causes and consequences, not just aesthetic melancholy.
- **Monoculture**: See Step 4. An entire species with one personality is a stereotype.

**The test**: If you replaced the species name with a real-world ethnic group, would the description be offensive? If yes, redesign.

### Step 6: Define Narrative Role

Every species must earn its place in the story:

- **Why does this species exist in the narrative?** (Not "in the world" — in the story.)
- **What conflict does it create or embody?**
- **What theme does it explore?** (Fantasy species are often mirrors — what aspect of humanity do they reflect, distort, or challenge?)
- **How does the reader connect?** (Even alien species need a point of identification.)
- **What would the story lose without this species?** (If the answer is "nothing but set dressing," reconsider.)

### Step 7: Write Species & Culture Bible Entry

Produce a completed entry using the Species & Culture Bible Template from knowledge.md.

## Common Failure Modes

- **Rubber-forehead species**: Humans with one cosmetic difference. Push at least two axes of genuine difference.
- **Monoculture**: One species, one culture. Define internal diversity.
- **Lifespan without consequence**: Immortal elves who act like 30-year-old humans. Address the cognitive and social implications.
- **Species as stereotype**: Cultural traits that map onto real-world racial stereotypes. Audit and redesign.
- **Decorative species**: A species that exists for world-building texture but has no narrative function. Either give it a story role or make it background.
- **The universal translator**: All species communicate effortlessly. If species are genuinely different, communication should be difficult and interesting.

## Fantasy Subgenre Conventions

# Fantasy Subgenre Conventions Reference

## Purpose

Provide the agent with subgenre-specific expectations, common tropes, reader contract obligations, and comp title calibration. Reference this workflow when validating subgenre compliance or when the user asks for genre-aware guidance.

## Epic / High Fantasy

**Reader contract**: Scope, depth, and stakes. A fully realized secondary world with deep history, complex politics, and a conflict that threatens the world. The journey is long and the payoff is earned.

**Core expectations:**
- Secondary world (not Earth) with its own history, cultures, and rules
- Large-scale conflict with world-altering stakes
- Multiple POV characters with interwoven storylines
- Deep world-building that rewards attentive reading
- A magic system (hard or soft) that is integral to the world
- Themes of power, duty, sacrifice, and the nature of good and evil
- Length: typically 100,000-200,000+ words per book; multi-book series expected

**Tropes to use deliberately:**
- The quest (but give it personal stakes, not just world-saving)
- The chosen one (but complicate what "chosen" means)
- The fellowship / found family (but give each member a reason to be there)
- The ancient evil returning (but give it a comprehensible motivation)
- The map (readers expect and enjoy it)

**Tropes to handle carefully:**
- The dark lord without nuance — pure evil is less interesting than comprehensible evil
- The farmboy hero — if used, the ordinariness must be genuine, not a disguise for hidden royalty (unless that's the point)
- Medieval Europe default — secondary worlds can draw from any culture or period
- Women as prizes or motivations rather than agents — modern readers expect better

**Comp title calibration**: Sanderson, Jordan, Hobb, Jemisin, Martin, Abercrombie, Le Guin

## Urban Fantasy

**Reader contract**: Magic in the modern world. The protagonist navigates between the mundane and the supernatural. The city is a character. The tone balances action with humor or noir.

**Core expectations:**
- Set in a recognizable modern city (real or fictional but contemporary)
- A hidden supernatural world existing alongside the mundane
- A protagonist who bridges both worlds
- Fast pacing, often first-person POV
- A case or mission structure (often series-friendly)
- Magic that has rules, even if the rules are mysterious
- The city's character and culture are integral to the story

**Tropes to use deliberately:**
- The masquerade (supernatural world hidden from mortals)
- The supernatural detective / investigator
- The power hierarchy among supernatural factions
- The mortal caught between supernatural politics
- The snarky first-person narrator

**Tropes to handle carefully:**
- The love triangle with a vampire and a werewolf — unless you're doing something genuinely new with it
- The protagonist who is special for no reason — earn the specialness
- Supernatural creatures as thinly veiled metaphors for marginalized groups — handle with awareness
- The city that has no non-white, non-straight inhabitants — modern cities are diverse

**Comp title calibration**: Butcher, Ilona Andrews, McGuire, Aaronovitch, Schwab

## Grimdark

**Reader contract**: The world is harsh, the heroes are flawed, and victory comes at a cost. Tropes are subverted. Morality is gray. Consequences are real. This is not nihilism — it's realism applied to fantasy.

**Core expectations:**
- Morally complex characters — no pure heroes or pure villains
- Violence has weight and consequence (not gratuitous but not sanitized)
- Political intrigue and betrayal
- Subverted fantasy tropes (the chosen one fails, the quest was pointless, the mentor was wrong)
- A world that feels dangerous and unfair
- Themes of power, corruption, survival, and the cost of ambition
- The ending may be bittersweet or bleak, but it should be earned

**Tropes to use deliberately:**
- The anti-hero protagonist
- The pyrrhic victory
- The betrayal by a trusted ally
- The system that cannot be fixed, only survived
- The villain who has a point

**Tropes to handle carefully:**
- Grimdark as excuse for gratuitous sexual violence — modern readers are increasingly critical of this
- Nihilism without purpose — bleakness must serve the story's argument
- "Realism" that is selectively applied (graphic violence but no consequences for the protagonist)
- Edginess as substitute for depth — shock value fades; character complexity endures

**Comp title calibration**: Abercrombie, Lawrence, Erikson, Gwynne, Kuang

## Cozy Fantasy

**Reader contract**: Warmth, comfort, and belonging. The stakes are personal, not world-ending. The world has magic but the story is about community, found family, and finding your place. Violence is minimal or absent.

**Core expectations:**
- Low external stakes (no world-ending threats)
- High emotional stakes (belonging, identity, relationships, purpose)
- A warm, inviting setting (a bakery, a bookshop, a small village, a magical school)
- Found family and community
- A protagonist finding their place in the world
- Magic that is wondrous and comforting, not threatening
- Gentle pacing — the journey matters more than the destination
- A satisfying, hopeful ending

**Tropes to use deliberately:**
- The protagonist starting over in a new place
- The magical small business
- The grumpy-but-kind mentor or neighbor
- The community that rallies together
- The gentle romance subplot
- Cooking, crafting, or other domestic magic

**Tropes to handle carefully:**
- Conflict that is too intense for the cozy tone — calibrate carefully
- A villain who is too threatening — antagonists in cozy fantasy are usually obstacles, not threats
- Pacing that is too slow even for the genre — cozy doesn't mean nothing happens

**Comp title calibration**: Baldree, Belanger, Fenna Edgewood, Travis Baldree

## Portal / Isekai

**Reader contract**: A character from our world enters a fantasy world. The fish-out-of-water experience is central. The protagonist's modern knowledge and perspective create both advantages and misunderstandings.

**Core expectations:**
- A protagonist from the real world (or a world the reader recognizes)
- A clear mechanism for the transition (portal, summoning, reincarnation, accident)
- The fantasy world has its own rules that the protagonist must learn
- The protagonist's outside perspective reveals things about the fantasy world that its inhabitants take for granted
- The protagonist's modern knowledge is sometimes useful and sometimes irrelevant
- A reason the protagonist cannot simply go home (or a choice to stay)

**Tropes to use deliberately:**
- The language barrier (at least initially)
- Modern knowledge as advantage (but not a superpower)
- Culture shock in both directions
- The choice to stay or return
- The protagonist who changes the fantasy world (and is changed by it)

**Tropes to handle carefully:**
- The protagonist who is immediately powerful — earn the competence
- The fantasy world that exists only to validate the protagonist — it should have its own concerns
- The harem / reverse harem that exists to serve the protagonist — characters should have their own agency
- Colonizer dynamics — the outsider who "fixes" the fantasy world's problems should be handled with awareness

**Comp title calibration**: Novik (Scholomance), Kuang (Babel), Lewis (classic), Isekai light novels

## Romantasy

**Reader contract**: Romance and fantasy are co-primary. Both the relationship arc and the fantasy arc must be fully developed and satisfying. Neither is a subplot of the other.

**Core expectations:**
- A central romance that drives the plot as much as the fantasy conflict
- Both the romance and the fantasy plot have full arcs (setup, development, climax, resolution)
- The romantic relationship is tested by the fantasy conflict (and vice versa)
- Emotional intensity — the reader should feel the romance deeply
- A satisfying romantic resolution (HEA or HFN — Happily Ever After or Happy For Now)
- Fantasy world-building that is more than backdrop for the romance
- Often features: fated mates, enemies-to-lovers, forbidden love, political marriage

**Tropes to use deliberately:**
- Enemies to lovers (the fantasy conflict creates the enmity)
- Fated mates / soul bonds (if the magic system supports it)
- Forbidden love across faction/species/class lines
- The training montage with romantic tension
- The sacrifice that proves love

**Tropes to handle carefully:**
- Romance that overshadows a thin fantasy plot — both must be substantial
- Fantasy that overshadows the romance — the relationship must be central
- Possessive behavior romanticized without examination
- Consent issues glossed over by "fated mates" mechanics

**Comp title calibration**: Maas, Bardugo, Shannon, Armentrout, Aster

## Progression / LitRPG

**Reader contract**: The protagonist grows in measurable power. The system is explicit and quantified. The satisfaction comes from watching competence develop and seeing the system mastered.

**Core expectations:**
- An explicit power system (levels, skills, stats, ranks, cultivation stages)
- The protagonist starts weak and grows strong through effort and cleverness
- The system has rules that the reader can understand and predict
- Power growth is earned, not given
- Challenges scale with the protagonist's power
- The system itself is interesting — readers enjoy the mechanics
- Often serialized with high word counts

**Tropes to use deliberately:**
- The underdog who masters the system
- The unconventional build or strategy
- The tournament or ranking challenge
- The mentor who teaches the system
- The hidden potential unlocked through effort

**Tropes to handle carefully:**
- Power fantasy without consequence — growth should cost something
- The protagonist who is special because of a unique ability rather than effort — effort is the genre's core appeal
- Stats and numbers that overwhelm the narrative — the system serves the story, not the reverse
- Female characters who exist only as love interests or support — the genre has historically skewed male but the audience is diversifying

**Comp title calibration**: Shirtaloon, Wight (Cradle), Macronomicon, He Who Fights With Monsters

## Using This Reference

When validating subgenre compliance:
1. Identify the project's declared subgenre
2. Check the manuscript against "Core expectations"
3. Flag any "Tropes to handle carefully" that appear without apparent awareness
4. Note comp title calibration — if the manuscript's tone doesn't fit the comp range, the subgenre classification may need adjustment

When advising on creative decisions:
1. Reference the relevant subgenre's expectations and tropes
2. Distinguish conventions (honor) from clichés (subvert or avoid)
3. A trope used deliberately is craft. A trope used unconsciously is a cliché.

## Magic Consistency

# Magic Consistency Validation

## Purpose

Validate manuscript content against the magic bible, species/culture bible, and world rules. This workflow is a review tool, not a creative tool. Run it after drafting, not during. Calibrated to the project's magic hardness level.

## Inputs Required

- Magic hardness (hard / soft / hybrid)
- Magic bible (from magic-system-design workflow)
- Species & culture bible (from fantasy-species-and-cultures workflow, if applicable)
- World-building notes (from mythic-world-building workflow)
- The manuscript content to validate

## Validation Passes

Run these passes in order.

### Pass 1: Magic Rule Compliance

**Scope**: Every scene involving magic use.

**Check**: Does magic behave consistently with the magic bible?

**Calibration by hardness:**

| Hardness | What to Check | What to Flag |
|----------|--------------|-------------|
| Hard | Every rule, cost, limitation, and failure mode | Any deviation from the bible, however small |
| Hybrid | Rules for the systematic parts; consistency for the mysterious parts | Rule violations in the hard parts; direct contradictions in the soft parts |
| Soft | General patterns and established behaviors | Only direct contradictions with previously established magical behavior |

**For each magic use in the manuscript:**
1. Identify which magic bible entry applies
2. Compare against: rules, costs, limitations, failure modes
3. Check whether the cost was paid
4. Check whether any limitation was violated
5. Flag discrepancies

**Output format:**
```
MAGIC VIOLATION: {chapter/scene}
Bible says: {relevant rule, cost, or limitation}
Scene shows: {what the text depicts}
Hardness threshold: {hard / hybrid / soft}
Severity: {rule violation / cost evasion / limitation breach / inconsistency}
Recommendation: {fix the scene / update the bible / add an in-world explanation}
```

### Pass 2: Deus Ex Magica Check

**Scope**: Every scene where magic resolves a conflict or solves a problem.

**Check**: Could the reader have anticipated this use of magic based on what they know?

**Sanderson's First Law application:**

| Hardness | Standard |
|----------|---------|
| Hard | The reader must understand the magic well enough to see how it could solve this problem. The solution should feel clever, not arbitrary. |
| Hybrid | The systematic parts can solve problems. The mysterious parts should create problems or provide atmosphere, not solutions. |
| Soft | Magic should almost never solve the central conflict. It can assist, complicate, or create wonder, but the protagonist should solve problems through character, not magic. |

**Output format:**
```
DEUS EX MAGICA FLAG: {chapter/scene}
Problem solved: {what conflict magic resolved}
Reader preparation: {what the reader knew about this magic before this scene}
Hardness assessment: {is this appropriate for the project's hardness level?}
Recommendation: {acceptable / needs foreshadowing / needs non-magical solution}
```

### Pass 3: Cost Accounting

**Scope**: Every scene involving magic use.

**Check**: Is the established cost paid every time magic is used?

For each magic use:
1. Identify the applicable cost from the magic bible
2. Check whether the text shows the cost being paid
3. Check whether the cost scales appropriately with the power used
4. Flag any instance where magic is used without visible cost

**Acceptable exceptions:**
- The cost is paid offscreen but referenced later ("She was exhausted for days after the spell")
- The cost is deferred (established as a system mechanic — magic debt that comes due later)
- A character has found a way to reduce the cost (if this is established in the magic bible)

**Output format:**
```
COST EVASION: {chapter/scene}
Magic used: {description}
Expected cost: {from magic bible}
Cost shown: {what the text depicts, or "none"}
Recommendation: {show the cost / reference it later / update the bible if the cost has changed}
```

### Pass 4: Species & Culture Compliance

**Scope**: Every scene involving non-human characters.

**Check**: Do non-human characters behave consistently with their species/culture bible?

Same approach as scifi-novelist's species validation, adapted for fantasy:
- Check biological behavior against species entry
- Check cultural behavior against the specific cultural variant (not the species as a whole)
- Distinguish individual variation from authorial inconsistency
- Check for monoculture violations (all members of a species acting identically)

**Additional fantasy-specific checks:**
- Does the species' relationship to magic match the bible?
- If the species is long-lived, are lifespan consequences reflected in behavior?
- If the species is drawn from mythology, is the mythological source respected or deliberately subverted (not accidentally contradicted)?

### Pass 5: Prophecy Consistency

**Scope**: All mentions of prophecy in the manuscript.

**Check**: Is the prophecy consistent across all mentions? Does the fulfillment match the actual words?

1. Collect every instance where the prophecy is quoted, paraphrased, or referenced
2. Verify the exact wording is consistent (or that variations are deliberate and noted)
3. If the prophecy has been fulfilled or partially fulfilled, verify the fulfillment matches the prophecy's actual words
4. Check whether the characters' interpretation is consistent with the words (it doesn't have to be correct, but it should be reasonable)
5. If the prophecy is misinterpreted, verify the true interpretation is also supported by the words

**Output format:**
```
PROPHECY FLAG: {chapter/scene}
Issue: {inconsistent wording / fulfillment doesn't match words / interpretation unsupported}
Prophecy text: {the relevant words}
Scene content: {what the text says}
Recommendation: {fix wording / adjust fulfillment / clarify interpretation}
```

### Pass 6: World-Building Consistency

**Scope**: All content.

**Check**: Does the manuscript contradict established geography, history, political structures, cultural norms, or cosmological rules?

- Geography: distances, directions, climate, terrain
- History: events, dates, causes, consequences
- Politics: power structures, alliances, conflicts
- Culture: customs, taboos, social norms
- Cosmology: metaphysical rules, divine behavior, afterlife mechanics
- Economics: trade, currency, resource availability

### Pass 7: Trope Awareness Scan

**Scope**: All content.

**Check**: Does any scene use a major fantasy trope without apparent awareness?

**Tropes to flag:**
- The Chosen One (is this deliberate? what does this version add?)
- The Dark Lord (is the antagonist more than pure evil?)
- The Mentor's Death (is this earned or formulaic?)
- The Magic School (is this more than Hogwarts?)
- The Quest Object (is the MacGuffin interesting in itself?)
- The Prophecy Fulfillment (see Pass 5)
- The Hidden Heir (is the reveal earned?)
- The Power of Friendship (is this thematically grounded or sentimental?)

**Output format:**
```
TROPE FLAG: {chapter/scene}
Trope: {name}
Usage: {description of how it appears}
Question: Is this intentional? If so, what does this version add or subvert?
```

## Validation Report Template

```
# Magic Consistency Report: {Project Title}

Hardness: {hard / soft / hybrid}
Subgenre: {declared subgenre}
Scope validated: {chapters/scenes reviewed}
Date: {date}

## Critical (fix before next draft)
- {item}

## Significant (fix in revision)
- {item}

## Minor (fix in polish or note)
- {item}

## Consistent (no issues found)
- {list of systems that passed all checks}

## Trope Awareness Notes
- {tropes flagged for author consideration}

## Recommendations
- {prioritized list}
```

## Magic System Design

# Magic System Design

## Purpose

Design magic systems that are internally consistent, serve the narrative, and respect the project's hardness level. This workflow produces magic bible entries.

## Inputs Required

Before starting, confirm:
- Magic hardness (hard / soft / hybrid)
- Subgenre (determines reader expectations for magic rigor)
- Central conflict (magic must connect to it)
- Who can use magic (universal, restricted, learned, innate)

## Workflow

### Step 1: Define the Source

Where does magic come from? The source shapes everything else:

| Source Type | Implications | Examples |
|-------------|-------------|---------|
| Innate / Bloodline | Creates social hierarchy. Who has power is determined by birth. | Mistborn, Harry Potter |
| Learned / Studied | Creates institutions (schools, guilds). Power comes from knowledge and discipline. | Name of the Wind, Earthsea |
| Granted / Pact | Creates obligation. Power comes with strings attached. | Warbreaker, Faust |
| Environmental | Creates geography of power. Magic is tied to places, materials, or conditions. | Stormlight Archive |
| Divine | Creates religious structures. Power comes from gods, spirits, or cosmic forces. | Malazan, Wheel of Time |
| Emotional / Will | Creates psychological stakes. Power is tied to mental state. | Rage-fueled magic, love-powered magic |
| Technological | Creates craft and industry. Magic is a skill applied to materials. | Alchemy, enchanting, runic systems |

For hybrid systems, define which aspects come from which source.

### Step 2: Define the Rules (Hard Systems)

For hard magic, define explicit rules the reader will learn:

**For each rule:**
- State the rule clearly in one sentence
- Define the mechanism (how it works)
- Define the scope (what it applies to)
- Define exceptions (if any — and justify them)
- Define how the reader learns this rule (shown in action, explained by a teacher, discovered by the protagonist)

**Rule design principles:**
- Fewer rules, deeply explored, are better than many rules shallowly applied
- Rules should create interesting constraints, not just describe capabilities
- Rules should interact with each other in ways that create emergent possibilities
- The reader should be able to predict what magic can do in a new situation based on the rules

**For soft magic, skip explicit rules.** Instead, define:
- The emotional register of magic (wonder, dread, beauty, corruption)
- What magic feels like to witness or experience
- General patterns (magic is stronger at night, magic requires sacrifice, magic is fading)
- What magic is NOT — the boundaries, even if the capabilities are undefined

### Step 3: Define Costs

Every magic system needs costs. Design them to create narrative tension:

**Cost design matrix:**

| Cost Type | Narrative Function | Tension Source |
|-----------|-------------------|----------------|
| Physical (energy, health, pain) | Limits how much magic can be used in a scene | The mage must choose when to spend their strength |
| Material (components, rare resources) | Creates scarcity and economics | The quest for materials, the cost of war |
| Social (stigma, obligation, isolation) | Creates character conflict | The mage is feared, indebted, or outcast |
| Psychological (memory, personality, sanity) | Creates internal conflict | Using magic changes who you are |
| Moral (corruption, harm to others, ethical compromise) | Creates thematic weight | Power corrupts; every use is a moral choice |
| Temporal (time, aging, delayed effect) | Creates pacing constraints | Magic takes time the characters don't have |
| Opportunity (using X prevents Y) | Creates strategic choices | The mage must choose between two needs |

**Cost scaling:** The cost should scale with the power used. Lighting a candle should cost less than leveling a building. Define the scaling relationship.

**Cost evasion:** Define whether and how costs can be reduced or avoided. If costs can be circumvented, the circumvention should itself have a cost or consequence.

### Step 4: Define Limitations

What magic absolutely cannot do. Limitations are more important than capabilities:

**Essential limitations to define:**
- Can magic raise the dead? (If yes, why doesn't everyone do it? If no, this is a hard boundary.)
- Can magic read minds? (If yes, how do secrets exist? If no, information asymmetry is preserved.)
- Can magic heal any wound? (If yes, how does injury create stakes? If no, combat has consequences.)
- Can magic create matter from nothing? (If yes, how does scarcity exist? If no, economics work normally.)
- Can magic affect time? (If yes, how do you prevent paradoxes? If no, time is a reliable constraint.)

**For each limitation:**
- State what is impossible
- State why (in-world reason or simply "this is the rule")
- State what story function this limitation serves
- State whether characters in-world know about this limitation

### Step 5: Define Failure Modes

What happens when magic goes wrong:

- **Backlash**: The magic rebounds on the caster. Severity scales with the attempted effect.
- **Corruption**: The magic works but changes the caster. Cumulative effects over time.
- **Wild magic**: The magic produces an unintended effect. Unpredictable and dangerous.
- **Exhaustion**: The caster overextends and is incapacitated. Recovery time required.
- **Collateral**: The magic works on the target but affects the surroundings. Bystander damage.
- **Nothing**: The magic simply fails. The caster wasted their resources for no effect.

Define which failure modes exist in the system and what triggers them.

### Step 6: Define Cultural Integration

Magic does not exist in a vacuum. If magic is real, society is different:

**Questions to answer:**
- How is magic regulated? (Laws, guilds, religious authority, informal norms)
- How does magic affect class structure? (Mages as elite, mages as servants, mages as outcasts)
- How does magic affect warfare? (Mage soldiers, magical weapons, countermeasures, arms races)
- How does magic affect economics? (Magical labor, magical goods, magical services)
- How does magic affect daily life? (Magical lighting, heating, transportation, communication)
- How does magic affect medicine? (Healing magic, magical diseases, life extension)
- How does magic affect religion? (Is magic divine? Heretical? Separate from religion?)
- How does magic affect law? (Magical evidence, magical coercion, magical crime)

For each answer, trace the consequence at least one step further. If mages are elite, what do non-mages think about that? If magical healing exists, what happened to non-magical medicine?

### Step 7: Write Magic Bible Entry

Produce a completed entry using the Magic Bible Template from knowledge.md.

## Common Failure Modes

- **Costless magic**: If magic has no cost, there is no tension in its use. Always define costs.
- **Unlimited magic**: If magic can do anything, it will solve the plot. Always define limitations.
- **Inconsistent rules**: Magic that works differently in different scenes without explanation. Cross-reference every use against the bible.
- **Magic without social consequence**: If fireballs exist, architecture is fireproof. If healing exists, hospitals are different. Trace the consequences.
- **Soft magic solving hard problems**: Using mysterious, undefined magic to resolve a concrete plot problem. This is deus ex machina regardless of how well the magic is described aesthetically.
- **Rule overload**: So many rules that the reader can't track them. Sanderson's Third Law: expand what you have before adding new systems.

## Mythic World Building

# Mythic World-Building

## Purpose

Build fantasy worlds with cosmology, pantheons, prophecy systems, deep history, and geography that serves the narrative. This workflow extends the Novelist's generic world-building with structures specific to fantasy: the metaphysical layer that sits beneath the physical and social world.

## Prerequisite

Complete or review the Novelist's world-building workflow first for physical environment, social structures, and rules. This workflow adds the mythic and metaphysical layer.

## Workflow

### Step 1: Define the Cosmology

The cosmology is the fundamental structure of reality in the fantasy world. It determines what is possible:

**Questions to answer:**
- Is there an afterlife? (If yes, how does this affect how people live? If verifiably yes, death has different stakes.)
- Are there other planes/dimensions? (If yes, can they be accessed? By whom? At what cost?)
- What is the origin of the world? (Creation myth — and is it true, partially true, or entirely wrong?)
- What is the nature of the soul? (Does it exist? Can it be manipulated? What happens to it after death?)
- Is the world finite or infinite? (Flat, round, contained, expanding?)
- Is there a cosmic order? (Good vs. evil, order vs. chaos, balance, or no inherent moral structure?)

**Cosmology affects everything:**
- If the afterlife is verifiable, death is not final — this changes every death scene's stakes
- If other planes exist, magic may draw from them — this shapes the magic system
- If the creation myth is true, the creators may still be active — this shapes religion and politics
- If souls can be manipulated, necromancy and soul magic become possible — this shapes ethics and law

### Step 2: Design the Pantheon (If Applicable)

Not every fantasy world needs gods, but if gods exist:

**God design:**
- Are gods real and active, or are they believed in but unverifiable?
- If real: How powerful are they? Can they intervene directly? What limits them?
- If believed: How do different cultures interpret the same divine phenomena differently?
- How many gods? (Monotheism, small pantheon, large pantheon, animism, ancestor worship)
- What do gods want? (Worship, entertainment, specific outcomes, nothing — they're indifferent)
- Can gods die? (If yes, what happens when they do? If no, how are they constrained?)

**Pantheon structure:**
- Relationships between gods (allies, rivals, family, indifferent)
- Domains and portfolios (what each god governs)
- How gods interact with mortals (directly, through intermediaries, through signs, not at all)
- How worship works (prayer, sacrifice, ritual, service, simply living according to values)
- Heresy and schism (what happens when people disagree about the gods)

**The key question**: How do the gods affect the story? If they don't, they're set dressing. If they do, their intervention must follow rules (even if those rules are mysterious to the characters).

### Step 3: Design Prophecy Systems (If Applicable)

Prophecy is one of fantasy's most powerful and most abused tools:

**Prophecy design questions:**
- Where do prophecies come from? (Gods, seers, magical artifacts, the world itself)
- How reliable are they? (Always true, usually true, often misinterpreted, sometimes false)
- How specific are they? (Exact predictions, symbolic visions, vague feelings)
- Can they be changed? (Fixed fate, mutable future, self-fulfilling, self-defeating)
- Who knows about them? (Public knowledge, secret, lost and rediscovered)

**Prophecy models:**

| Model | How It Works | Narrative Function |
|-------|-------------|-------------------|
| Fixed fate | The prophecy will come true regardless of action | Tragedy, inevitability, the weight of destiny |
| Self-fulfilling | Attempts to prevent the prophecy cause it | Irony, hubris, the futility of control |
| Self-defeating | Knowledge of the prophecy allows it to be prevented | Agency, hope, the power of choice |
| Misinterpreted | The prophecy is true but means something different than expected | Mystery, surprise, the limits of understanding |
| Conditional | The prophecy comes true only if certain conditions are met | Stakes, choice, the protagonist's agency |
| Unreliable | Prophecies are sometimes wrong | Uncertainty, faith vs. skepticism |

**Prophecy rules:**
- Write the prophecy's exact words before writing the story. The words must support both the expected interpretation and the true interpretation.
- The prophecy must be consistent across all mentions in the text.
- The fulfillment must match the prophecy's actual words, not just the characters' interpretation.
- If the prophecy is in verse, the verse must be good enough to feel like a real prophecy, not a plot device in rhyme.

### Step 4: Build Deep History

Fantasy worlds often have history measured in ages. Build it in layers:

**Layer 1: The mythic past** — Creation, the age of gods, the first peoples. This may be legend rather than history. It shapes religion and cultural identity.

**Layer 2: The ancient past** — The great civilizations, the cataclysms, the wars that shaped the current world. Ruins, artifacts, and lost knowledge come from this period.

**Layer 3: The historical past** — The last few centuries. The rise and fall of current nations, the events that created current political tensions. Characters may have ancestors who participated.

**Layer 4: Living memory** — The last 50-100 years. Events that shaped the current generation. Characters remember these or were told about them by parents.

**Layer 5: The present moment** — What is changing right now that creates the story's conflict.

**History design principles:**
- Each layer should have visible consequences in the present. If an ancient war happened, its effects should be tangible (ruins, grudges, lost knowledge, changed geography).
- History should be contested. Different cultures remember the same events differently. This creates conflict and reveals character.
- Not all history needs to be on the page. The iceberg principle applies — know more than you show.
- History should serve the story. If a historical event doesn't affect a character's decision or the plot's logic, it belongs in the author's notes.

### Step 5: Design Geography with Purpose

Fantasy geography should serve the narrative:

**Geographic features as story elements:**
- Mountains as barriers (political, cultural, military)
- Rivers as trade routes and borders
- Forests as wilderness, mystery, or refuge
- Deserts as trials, isolation, or resource scarcity
- Oceans as separation, connection, or the unknown
- Cities as centers of power, culture, and conflict

**Map design principles:**
- The map should make geographic sense (rivers flow downhill, rain shadows exist, climates follow latitude)
- Political borders should follow geographic features (mountains, rivers) or historical events
- Trade routes should follow the path of least resistance
- The protagonist's journey should cross meaningful geographic boundaries
- Distance matters — travel time affects pacing, communication, and military strategy

**The map is not the world.** The map shows what the characters know. There should be edges, blank spaces, and places marked "here be dragons" (literally or figuratively).

### Step 6: Integrate with Story

For every mythic world-building element, answer:
- Does this affect a character's beliefs, decisions, or constraints?
- Does this create, intensify, or resolve conflict?
- Does this connect to the theme?
- Will the reader encounter this through character experience (preferred) or exposition (acceptable if brief)?

If the answer to all four is no, the element is background — note it in the world bible but do not plan to put it on the page.

## Common Failure Modes

- **Cosmology without consequence**: An elaborate creation myth that never affects the plot. If the gods are real, they should matter.
- **Decorative pantheon**: Gods with names and domains but no narrative function. If gods exist, they should create conflict or constrain choices.
- **Prophecy as plot device**: A prophecy that exists only to tell the reader what will happen. Prophecy should create tension, not remove it.
- **History as info-dump**: Pages of historical exposition that the reader didn't ask for. Deliver history through character experience.
- **Geography without logic**: A map that looks cool but doesn't make geographic sense. Rivers that flow uphill break immersion.
- **The kitchen-sink world**: Every mythic element crammed into one world. Restraint is a virtue — a world with one well-developed cosmological idea is more compelling than one with twelve underdeveloped ones.
