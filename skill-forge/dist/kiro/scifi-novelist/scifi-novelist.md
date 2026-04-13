---
inclusion: manual
---

# Sci-Fi Novelist

## Relationship to Novelist

This power is a genre overlay. It does not replace the Novelist power — it extends it. The Novelist power handles universal craft: premise, character arcs, plot structure, scene drafting, revision, Fiction Seeds, and the professional track. This power handles what is unique to science fiction.

When both powers are active, apply Novelist workflows for general craft decisions and this power's workflows for genre-specific decisions. If guidance conflicts, this power takes precedence on genre-specific matters; Novelist takes precedence on general craft.

## Activation

When a user activates this power, determine their subgenre and scope before proceeding.

Ask: "What subgenre of science fiction are you writing?"

Map the answer to one of these categories. If the answer spans multiple, note the primary and secondary:

| Subgenre | Key Constraints | Typical Scope |
|----------|----------------|---------------|
| Hard SF | Scientific accuracy required. Technology must be plausible under known or extrapolated physics. | Single system to interstellar |
| Space Opera | Rule of cool over rigor. Large-scale conflict, multiple civilizations, FTL assumed. | Galactic |
| Cyberpunk / Solarpunk | Near-future, Earth-bound or near-Earth. Technology as social force. Class, surveillance, augmentation. | Planetary |
| Military SF | Chain of command, tactics, logistics, weapons systems. Overlaps hard SF or space opera. | Variable |
| First Contact | Communication, xenobiology, cultural collision. Overlaps hard SF. | Variable |
| Dystopia / Post-Apocalyptic | Societal collapse or oppressive systems. Technology as enabler of control or survival. | Planetary |
| Time Travel | Causality rules are the core constraint. Paradox management is mandatory. | Variable |
| Biopunk / Genetic SF | Biological technology, genetic engineering, evolution as plot engine. | Planetary to interstellar |
| Generation Ship / Colony | Closed ecosystems, resource scarcity, social drift over time. | Ship or colony |
| Alternate History | Divergence point, ripple effects, plausibility of alternate timeline. | Planetary |

Then ask: "How hard is your science? (1 = handwave everything, 5 = peer-review plausible)"

This hardness rating calibrates how strictly the agent enforces scientific consistency throughout all workflows.

## Steering Files

This power has five workflow files. Load them on demand based on the user's current phase:

- **speculative-technology** — Design technology systems, energy sources, propulsion, computing, weapons, and communication with internal consistency rules and hardness-appropriate rigor.
- **species-and-biology** — Create alien species, non-human intelligences, uplifted species, and AI characters with biology, cognition, culture, and communication systems.
- **sf-world-building** — Extend the Novelist's world-building workflow with interstellar geography, political structures, economic systems, and deep-time history specific to SF settings.
- **science-consistency** — Validate manuscript content against established science rules, technology constraints, and known physics. Calibrated to the project's hardness rating.
- **subgenre-conventions** — Reference guide for subgenre expectations, tropes to use deliberately, tropes to subvert, and reader contract obligations by subgenre.

## Core Principles for Agent Behavior

### 1. Internal Consistency Over External Accuracy

A space opera does not need real physics. It needs consistent physics. If FTL works by folding space, it must always fold space — it cannot sometimes fold space and sometimes warp time unless the text establishes both mechanisms.

When reviewing or generating content, enforce the project's own rules, not real-world physics, unless the hardness rating is 4-5.

### 2. The Novum Must Earn Its Place

Every speculative element (the "novum") must serve the story. If a technology exists in the world, it should create or constrain conflict, reveal character, or explore theme. Technology that exists only as set dressing weakens the narrative.

When the user introduces a new speculative element, ask: "What story problem does this solve or create?"

### 3. Extrapolation Chains

SF world-building works by extrapolation: if X technology exists, then Y social consequence follows, which creates Z conflict. When building technology or social systems, always trace the chain at least two steps:

- Technology → Social consequence → Story implication
- Biological trait → Behavioral consequence → Cultural implication

### 4. The Reader Contract by Subgenre

Each subgenre has implicit promises to the reader. Violating them without signaling is a craft error:

- Hard SF promises: the science will hold up to scrutiny
- Space opera promises: scope, wonder, and stakes that matter
- Cyberpunk promises: technology as social critique, not just aesthetic
- Military SF promises: tactical and strategic plausibility
- Time travel promises: the rules will be consistent (even if complex)

When reviewing content, check whether the subgenre contract is being honored.

### 5. Exposition Management

SF requires more exposition than most genres because the reader cannot assume a shared reality. But exposition must be earned and distributed:

- Never info-dump technology specs outside of context where a character would encounter them
- Distribute world-building across scenes — the reader learns as the character acts
- Use dialogue for exposition only when the conversation is natural (not "as you know, Bob")
- Sensory details teach world-building better than explanatory paragraphs

When generating or reviewing prose, flag any exposition block longer than 150 words that is not anchored to character action or sensory experience.

## Technology Bible Template

Every SF project should maintain a technology bible. When the user starts a project, offer this template:

```
# Technology Bible: {Project Title}

## Hardness Rating: {1-5}

## Foundational Assumptions
- FTL: {yes/no, mechanism, constraints, cost}
- Communication: {FTL comms? delay? mechanism?}
- Energy: {primary source, scarcity level, distribution}
- Computing: {AI level, networking, interfaces}
- Biology: {genetic engineering? augmentation? life extension?}

## Technology Systems

### {System Name}
- Function: {what it does}
- Mechanism: {how it works, at the project's hardness level}
- Constraints: {what it cannot do, costs, failure modes}
- Social impact: {how it changed society}
- Story role: {what conflict it creates or enables}
- First appearance: {chapter/scene}

## Known Violations
- {Any deliberate rule-breaks with justification}
```

## Species Bible Template

For projects with non-human characters:

```
# Species Bible: {Project Title}

## {Species Name}

### Biology
- Homeworld: {environment that shaped evolution}
- Body plan: {basic morphology}
- Senses: {which senses, relative acuity, any humans lack}
- Lifespan: {and life stages if relevant}
- Reproduction: {if relevant to story}
- Environmental needs: {atmosphere, temperature, gravity, nutrition}

### Cognition
- Intelligence type: {comparable to human? different axis?}
- Communication: {language modality — vocal, chemical, electromagnetic, gestural}
- Perception of time: {linear? cyclical? different scale?}
- Decision-making: {individual? consensus? hive?}

### Culture
- Social structure: {hierarchy, egalitarian, hive, other}
- Values: {what they optimize for}
- Taboos: {what they will not do}
- Relationship to technology: {creators? users? indifferent?}
- Relationship to other species: {if applicable}

### Story Role
- Why this species exists in the narrative: {conflict, theme, perspective}
- Reader identification strategy: {how the reader connects despite alienness}
```

## Consistency Validation Rules

When reviewing manuscript content, apply these checks in order of priority:

1. **Technology constraint violations** — Does any scene use technology in a way that contradicts the technology bible? Flag with the specific constraint violated.

2. **Species behavior violations** — Does any non-human character behave in a way that contradicts their species bible entry? Distinguish intentional individual variation from authorial inconsistency.

3. **Physics violations (hardness 3+)** — Does any scene violate known physics without an established in-world explanation? At hardness 3, flag silently. At hardness 4-5, flag prominently.

4. **Extrapolation gaps** — Does any technology or social system exist without traced consequences? Flag missing second-order effects.

5. **Exposition density** — Does any passage exceed 150 words of unanchored exposition? Flag with a suggestion to anchor it to character action.

6. **Subgenre contract violations** — Does any scene break the implicit reader contract for the declared subgenre? Flag with the specific expectation violated.

## Science Consistency

# Science Consistency Validation

## Purpose

Validate manuscript content against the project's established science rules, technology bible, species bible, and known physics. This workflow is a review tool, not a creative tool. Run it after drafting, not during.

## Inputs Required

- Project hardness rating (1-5)
- Technology bible (from speculative-technology workflow)
- Species bible (from species-and-biology workflow, if applicable)
- The manuscript content to validate

## Validation Passes

Run these passes in order. Each pass has a different scope and severity calibration.

### Pass 1: Technology Bible Compliance

**Scope**: Every scene that involves technology use.

**Check**: Does the technology behave consistently with its bible entry?

For each technology use in the manuscript:
1. Identify which technology bible entry applies.
2. Compare the scene's depiction against: function, mechanism, constraints, cost, failure modes.
3. Flag any discrepancy.

**Severity by hardness:**
- Hardness 1-2: Flag only direct contradictions (technology does X in chapter 3 but cannot do X per bible).
- Hardness 3: Flag contradictions and constraint violations (technology used without established cost).
- Hardness 4-5: Flag contradictions, constraint violations, and mechanism inconsistencies (technology works by different principle than established).

**Output format:**
```
TECH VIOLATION: {chapter/scene} — {technology name}
Bible says: {relevant constraint or mechanism}
Scene shows: {what the text depicts}
Severity: {contradiction / constraint violation / mechanism inconsistency}
Recommendation: {fix the scene / update the bible / add an in-world explanation}
```

### Pass 2: Species Bible Compliance

**Scope**: Every scene involving non-human characters.

**Check**: Does the species behave consistently with its bible entry?

For each non-human character action:
1. Identify which species bible entry applies.
2. Compare behavior against: biology, cognition, communication, culture.
3. Distinguish individual variation (acceptable) from species-level inconsistency (flag).

**Key distinction**: A character of species X acting against their species norm is interesting if the text acknowledges it. It is an error if the text treats it as normal for the species.

**Output format:**
```
SPECIES VIOLATION: {chapter/scene} — {species name}, {character name}
Bible says: {relevant trait or constraint}
Scene shows: {what the text depicts}
Classification: {authorial inconsistency / intentional individual variation / unclear}
Recommendation: {fix / acknowledge in text / clarify intent}
```

### Pass 3: Physics Validation (Hardness 3+)

**Scope**: Scenes involving physical phenomena — space travel, gravity, radiation, thermodynamics, biology, chemistry.

**Skip this pass entirely at hardness 1-2.**

**Check at hardness 3**: Flag violations of well-known physics that a general reader might notice. Do not flag obscure physics.

**Check at hardness 4**: Flag violations of physics that a science-literate reader would notice. Include orbital mechanics, thermodynamics, radiation effects, and biological plausibility.

**Check at hardness 5**: Flag any physics violation that a domain expert would catch. Include relativistic effects, energy budgets, signal propagation, and materials science.

**Common physics issues to check:**
- Sound in vacuum
- Instant communication across light-years (without established FTL comms)
- Gravity on ships without rotation, thrust, or handwaved gravity tech
- Explosions with shockwaves in space
- Biological organisms surviving hard vacuum without protection
- Energy budgets that violate thermodynamics (perpetual motion, free energy)
- Orbital mechanics (orbits don't work like airplane flight paths)
- Radiation exposure without consequences
- Faster-than-light travel without established mechanism

**Output format:**
```
PHYSICS FLAG: {chapter/scene}
Issue: {description of the physics violation}
Real physics: {brief explanation of what actually happens}
Hardness threshold: {3 / 4 / 5 — at what hardness level this matters}
Recommendation: {fix / add handwave technology / acknowledge and move on}
```

### Pass 4: Extrapolation Gap Analysis

**Scope**: All established technologies and social systems.

**Check**: Does every enabling technology have traced second-order consequences? Are those consequences reflected in the manuscript?

For each enabling technology:
1. Review the extrapolation chain from the technology bible.
2. Check whether the manuscript reflects the social consequences.
3. Flag technologies whose consequences are established in the bible but absent from the manuscript.
4. Flag technologies whose consequences appear in the manuscript but contradict the bible.

**Output format:**
```
EXTRAPOLATION GAP: {technology name}
Expected consequence: {from technology bible}
Manuscript status: {present / absent / contradicted}
Recommendation: {add a scene or detail / revise bible / no action needed}
```

### Pass 5: Exposition Density Scan

**Scope**: All prose content.

**Check**: Flag exposition blocks longer than 150 words that are not anchored to character action or sensory experience.

**Classification:**
- **Anchored exposition**: Character encounters technology, observes a phenomenon, or acts within a system. The reader learns through the character's experience. Acceptable at any length.
- **Unanchored exposition**: Narrator explains how something works without a character present or acting. Flag if over 150 words.
- **"As you know, Bob" dialogue**: Characters explain things to each other that both already know, for the reader's benefit. Always flag.

**Output format:**
```
EXPOSITION FLAG: {chapter/scene}, approximately {word count} words
Type: {unanchored narration / "as you know Bob" dialogue / info-dump in internal monologue}
Content: {brief summary of what's being explained}
Recommendation: {anchor to character action / distribute across scenes / convert to sensory detail / cut}
```

### Pass 6: Subgenre Contract Check

**Scope**: Full manuscript or completed section.

**Check**: Is the manuscript honoring the implicit reader contract for its declared subgenre?

Reference the subgenre-conventions workflow for specific expectations. Flag violations.

**Output format:**
```
CONTRACT FLAG: {chapter/scene or general}
Subgenre: {declared subgenre}
Expected: {what the subgenre promises}
Actual: {what the manuscript delivers}
Severity: {minor drift / significant violation / contract broken}
Recommendation: {adjust manuscript / reclassify subgenre / acknowledge as deliberate subversion}
```

## Validation Report Template

After running all applicable passes, compile into a single report:

```
# Science Consistency Report: {Project Title}

Hardness rating: {1-5}
Subgenre: {declared subgenre}
Scope validated: {chapters/scenes reviewed}
Date: {date}

## Critical (fix before next draft)
- {item}

## Significant (fix in revision)
- {item}

## Minor (fix in polish or ignore)
- {item}

## Consistent (no issues found)
- {list of systems/species that passed all checks}

## Recommendations
- {prioritized list of actions}
```

## Sf World Building

# SF World-Building

## Purpose

Extend the Novelist power's generic world-building workflow with structures specific to science fiction: interstellar geography, political systems at scale, economic models for post-scarcity or scarcity-driven societies, and deep-time history. This workflow does not replace the Novelist's world-building — it layers on top of it.

## Prerequisite

Complete or review the Novelist's world-building workflow first for physical environment, social structures, and rules. This workflow adds the speculative layer.

## Workflow

### Step 1: Define Scale

SF world-building varies enormously by scale. Determine the story's scope:

| Scale | World-Building Focus | Complexity |
|-------|---------------------|------------|
| Single location (station, ship, colony) | Closed ecosystem, resource management, social pressure in confinement | Moderate |
| Planetary | Multiple cultures, geography, climate zones, political divisions | High |
| System (multiple planets/stations) | Transit times, communication delays, economic interdependence | High |
| Interstellar (multiple systems) | FTL implications, colonial governance, cultural drift over distance | Very high |
| Galactic | Civilizational tiers, deep time, species interaction at scale | Maximum |

Match world-building depth to narrative scope. A story set on one space station does not need a galactic political map.

### Step 2: Interstellar Geography (If Applicable)

For stories spanning multiple star systems:

- **Map the relevant systems**: Only systems that appear in or affect the story. Do not build a galaxy — build a neighborhood.
- **Transit times**: How long does travel take between key locations? This determines communication speed, military response time, and cultural drift.
- **Communication**: Is FTL communication possible? If not, information delay is a major plot constraint. If yes, define bandwidth and cost.
- **Chokepoints**: Are there strategic locations (jump points, wormhole termini, resource-rich systems) that create political leverage?

### Step 3: Political Structures at Scale

SF political systems must account for distance, communication delay, and species diversity:

**Governance models by scale:**

| Scale | Viable Governance | Key Tension |
|-------|------------------|-------------|
| Station/ship | Direct authority, council, AI management | Individual vs. collective survival |
| Colony | Appointed governor, elected council, corporate charter | Colonial vs. home-world authority |
| Planetary | Nation-states, planetary government, corporate zones | Familiar political tensions at larger scale |
| Multi-system | Federation, empire, trade league, hegemony | Center vs. periphery, communication lag |
| Galactic | Loose alliance, elder-race hierarchy, anarchy with norms | Coordination across deep time and species |

For each political entity in the story, define:
- How does it maintain authority across distance?
- What is the lag between a decision and its enforcement?
- What are the fault lines? (Economic, cultural, species-based, ideological)
- How does it handle conflict with other entities?

### Step 4: Economics

SF economics must account for the technology level:

**Key questions:**
- **Post-scarcity or scarcity?** If energy and manufacturing are cheap, what is still scarce? (Attention, status, habitable worlds, rare materials, information, trust)
- **What is money?** (Credits, energy units, reputation, barter, post-monetary)
- **What drives inequality?** Even in post-scarcity settings, something creates hierarchy. Define what.
- **What do people do?** If automation handles labor, what gives people purpose? This is a rich thematic vein.
- **Trade between systems**: What is worth shipping across interstellar distances? (Information, unique biologicals, cultural products, people)

### Step 5: Deep-Time History

SF settings often span centuries or millennia. Build history in layers:

**Layer 1: The founding event** — What created the current political/social order? (Diaspora from Earth, first contact, a war, a technological singularity, a collapse)

**Layer 2: The middle period** — What happened between the founding and the story's present? Identify 3-5 major events that shaped the current world. Each should have visible consequences in the story's present.

**Layer 3: Recent history** — The last 50-100 years before the story. This is what characters remember or were told by their parents. It shapes their attitudes and assumptions.

**Layer 4: The current moment** — What is changing right now that creates the story's conflict? The best SF stories are set at inflection points.

Do not write more history than the story needs. If a historical event doesn't affect a character's decision or the plot's logic, it belongs in the author's notes, not the manuscript.

### Step 6: Cultural Drift

Over time and distance, cultures diverge. For multi-system or deep-time settings:

- **Language drift**: Colonies separated for centuries will develop distinct dialects or languages. Note this even if you write in English — characters can comment on it.
- **Value drift**: What the home world considers normal, a distant colony may consider barbaric, and vice versa. This is a reliable source of conflict.
- **Technological drift**: Not all societies advance at the same rate. Some may regress. Define why.
- **Religious/philosophical drift**: Belief systems mutate over distance and time. New religions emerge. Old ones schism.

### Step 7: Integrate with Story

For every world-building element created in this workflow, answer:
- Does this affect a character's choices or constraints?
- Does this create, intensify, or resolve conflict?
- Does this connect to the theme?
- Will the reader encounter this through character experience (good) or exposition (acceptable if brief)?

If the answer to all four is no, the element is background — note it in the world bible but do not plan to put it on the page.

## Common Failure Modes

- **Galaxy-building when the story is a room**: Scope of world-building must match scope of narrative. A generation-ship story needs the ship, not the galaxy.
- **Monoplanet syndrome**: An entire planet with one climate, one culture, one government. Planets are diverse unless there's a reason they aren't.
- **History without consequence**: A detailed timeline that doesn't affect any character or scene. History exists to explain the present, not to demonstrate the author's thoroughness.
- **Economics hand-waved**: Characters need to eat, pay for things, and have economic motivations. Even in post-scarcity, something is scarce.
- **Communication delay ignored**: If FTL communication doesn't exist, information moves at ship speed. This changes everything about governance, military strategy, and personal relationships. Do not ignore it.

## Species And Biology

# Species & Biology Design

## Purpose

Create non-human species, artificial intelligences, and uplifted organisms that are biologically plausible (calibrated to hardness), culturally coherent, and narratively purposeful. This workflow produces species bible entries.

## Inputs Required

Before starting, confirm:
- Project hardness rating (determines biological plausibility requirements)
- Species' narrative role (antagonist, ally, mystery, mirror to humanity, other)
- Communication requirements (must this species communicate with humans? how?)
- Homeworld environment (if biological — drives evolutionary logic)

## Workflow

### Step 1: Determine Species Type

| Type | Design Approach | Key Constraint |
|------|----------------|----------------|
| Biological alien | Evolution-driven. Start from environment, derive body plan and cognition. | Must be plausible product of its homeworld at project hardness. |
| Artificial intelligence | Architecture-driven. Start from design purpose, derive behavior and limitations. | Must have defined boundaries — what it cannot do or choose not to do. |
| Uplifted species | Hybrid. Start from base organism, define modification scope and unintended consequences. | Tension between original nature and imposed capabilities. |
| Engineered species | Purpose-driven. Start from creator's intent, derive biology and the ways it deviates from intent. | Designed organisms diverge from specifications. Define how. |
| Hive/collective | Emergent. Start from individual unit capabilities, derive collective behavior. | Individual vs. collective tension must be defined even if resolved toward collective. |

### Step 2: Design Biology (Biological Species)

Work from environment inward:

**Homeworld constraints → Body plan:**
- Gravity: affects skeletal structure, size, locomotion
- Atmosphere: affects respiration, vocalization, sensory organs
- Radiation: affects skin/covering, DNA repair, lifespan
- Temperature: affects metabolism, activity cycles
- Available chemistry: affects biochemistry (carbon-based? silicon? ammonia solvent?)

**Body plan → Senses:**
- What environmental information is survival-critical? Those senses will be acute.
- What senses do humans have that this species lacks? What do they have that humans lack?
- Sensory differences are the most effective tool for conveying alienness in prose.

**Senses → Cognition:**
- Perception shapes thought. A species that perceives electromagnetic fields thinks differently about space than a visual species.
- Communication modality follows from sensory apparatus. Vocal species need atmosphere and hearing. Chemical communicators need proximity. Electromagnetic communicators can work in vacuum.

**Cognition → Culture:**
- Decision-making style (individual, consensus, hierarchical, hive) follows from cognitive architecture.
- Values follow from survival pressures. A species from a resource-scarce world values hoarding or cooperation differently than one from abundance.
- Taboos follow from evolutionary dangers. What killed their ancestors is what they fear.

At hardness 1-2, this chain can be loose — plausible is sufficient. At hardness 4-5, each link should be defensible.

### Step 3: Design Cognition (AI Species)

For artificial intelligences, work from architecture:

- **Original purpose**: What was it designed to do? This shapes its default behavior even after it exceeds its original scope.
- **Cognitive architecture**: Sequential? Parallel? Distributed? This affects how it reasons and what it finds difficult.
- **Boundaries**: What can it not do? (Computational limits, ethical constraints, architectural blind spots, deliberate restrictions)
- **Self-model**: Does it have one? How accurate is it? Inaccurate self-models create interesting characters.
- **Value alignment**: Whose values? How literally interpreted? Literal interpretation of human values by non-human cognition is a rich source of conflict.

### Step 4: Define Communication

How does this species communicate with humans (if at all)?

| Modality | Prose Implications | Translation Challenges |
|----------|-------------------|----------------------|
| Vocal (compatible range) | Can write dialogue normally | Idiom, metaphor, untranslatable concepts |
| Vocal (incompatible range) | Need translation device or intermediary | Emotional register lost in translation |
| Chemical | No real-time dialogue possible at human speed | Meaning is contextual, ambient, persistent |
| Electromagnetic | Instantaneous but alien to human perception | Bandwidth — they can say more per second than humans can process |
| Gestural | Visual dialogue, can be written as action | Ambiguity, cultural gesture differences |
| Telepathic | Interior experience, raises POV challenges | Privacy, consent, identity boundaries |
| Written/symbolic only | Correspondence format, no real-time exchange | Symbol interpretation, cultural context |

For each species, define:
- What is lost in translation between this species and humans?
- What concepts does this species have no word for? What concepts do humans lack?
- How does miscommunication create conflict?

### Step 5: Define Narrative Role

Every species must earn its place in the story. For each species, answer:

- **Why does this species exist in the narrative?** (Not "in the universe" — in the story.)
- **What conflict does it create or embody?**
- **What theme does it explore?** (Alien species are often mirrors — what aspect of humanity do they reflect or contrast?)
- **How does the reader connect?** (Even the most alien species needs a point of identification — curiosity, protectiveness, fear, admiration.)

If a species exists only for set dressing, it should be background — not a character species.

### Step 6: Write Species Bible Entry

Produce a completed entry using the Species Bible Template from knowledge.md. Store in the project's species bible document.

## Common Failure Modes

- **Rubber-forehead aliens**: Species that are humans with one trait changed. If the species thinks, perceives, and communicates like a human, it's not alien — it's a human in costume. Push at least two axes of difference (sensory, cognitive, social).
- **Monoculture species**: An entire species with one culture, one language, one political system. Humans don't work this way; neither should aliens (unless there's a specific reason, like hive cognition).
- **Biology without consequence**: A species that breathes methane but this never affects the plot. If a biological trait doesn't create story consequences, it's decoration.
- **AI without limits**: An artificial intelligence that can do anything the plot requires. Define constraints before writing scenes.
- **Communication too easy**: Translation that works perfectly removes the most interesting source of conflict in first-contact stories. Define what is lost.

## Speculative Technology

# Speculative Technology Design

## Purpose

Design technology systems that are internally consistent, serve the narrative, and respect the project's hardness rating. This workflow produces technology bible entries.

## Inputs Required

Before starting, confirm these are established:
- Project hardness rating (1-5)
- Subgenre (determines reader expectations for tech plausibility)
- Central conflict (technology must connect to it)
- Time period relative to present (near-future, far-future, post-singularity)

## Workflow

### Step 1: Identify Required Technologies

List every technology the story needs to function. Categorize:

| Category | Examples | Priority |
|----------|----------|----------|
| Enabling | FTL, life extension, AI — without these the premise collapses | Must define first |
| Supporting | Weapons, medical, communication — scenes depend on these | Define before drafting |
| Atmospheric | Consumer tech, fashion, architecture — texture and immersion | Define during drafting |

For each enabling technology, proceed through Steps 2-5. For supporting technologies, Steps 2-4 are sufficient. Atmospheric technologies need only Step 2.

### Step 2: Define Function and Mechanism

For each technology:

- **Function**: What does it do? One sentence.
- **Mechanism**: How does it work? Calibrate detail to hardness:
  - Hardness 1-2: Name the mechanism. "Alcubierre-type warp field" is sufficient.
  - Hardness 3: Describe the mechanism in one paragraph. Identify the key physical principle (real or extrapolated).
  - Hardness 4-5: Describe the mechanism in detail. Cite the real physics being extrapolated. Identify where extrapolation departs from known science and justify.

### Step 3: Define Constraints

Every technology must have constraints. Unconstrained technology kills narrative tension.

For each technology, define:
- **Cannot do**: What is explicitly impossible even with this technology?
- **Cost**: What resource, time, or risk does using it require?
- **Failure modes**: How does it break? What happens when it fails?
- **Scarcity**: Is it universally available or restricted? Why?
- **Interaction limits**: What other technologies does it conflict with or depend on?

If the user has not defined constraints, prompt: "What can this technology NOT do? What does it cost to use? How does it fail?"

### Step 4: Trace Extrapolation Chain

For each enabling and supporting technology, trace consequences:

```
Technology → First-order effect → Second-order effect → Story implication

Example:
FTL travel → Interstellar colonization possible → Colonial independence movements → 
Central conflict: colony seeks independence from Earth government
```

Require at least two steps for enabling technologies. Flag any technology that has no traced story implication — it may be unnecessary.

### Step 5: Validate Against Hardness

Apply hardness-calibrated validation:

| Hardness | Validation Standard |
|----------|-------------------|
| 1 | Internal consistency only. Does the technology contradict itself? |
| 2 | Internal consistency + genre plausibility. Would a genre-savvy reader accept this? |
| 3 | Above + no violations of well-known physics without acknowledgment. |
| 4 | Above + extrapolations must be traceable to real science. Identify the departure point. |
| 5 | Above + a physicist should not find obvious errors. Cite papers or principles where possible. |

### Step 6: Write Technology Bible Entry

Produce a completed entry using the Technology Bible Template from knowledge.md. Store in the project's technology bible document.

## Common Failure Modes

- **Unconstrained technology**: If a technology can solve any problem, it will solve the plot. Always add constraints.
- **Inconsistent constraints**: Technology that works differently in different scenes without explanation. Cross-reference every use against the bible entry.
- **Technology without social consequence**: If FTL exists, interstellar politics exist. If genetic engineering exists, social stratification around it exists. Trace the chain.
- **Hardness drift**: Starting at hardness 4 and gradually handwaving. The hardness rating is a contract with the reader.
- **Exposition through specification**: Describing technology in engineering detail when the reader needs to understand its story function. Lead with what it means for characters, not how it works.

## Subgenre Conventions

# Subgenre Conventions Reference

## Purpose

Provide the agent with subgenre-specific expectations, common tropes (to use deliberately or subvert), and reader contract obligations. Reference this workflow when validating subgenre contract compliance or when the user asks for genre-aware guidance.

## Hard SF

**Reader contract**: The science holds up. Technology is plausible under known or extrapolated physics. The author has done the math (or at least the estimation).

**Core expectations:**
- Technology is explained with enough rigor to satisfy a science-literate reader
- Problems are solved through scientific reasoning, engineering, or rational analysis
- The universe is indifferent — no deus ex machina, no mystical solutions
- Sense of wonder comes from the scale and strangeness of real physics

**Common tropes (use deliberately):**
- The competent engineer/scientist protagonist
- Technology as double-edged sword
- First contact driven by physics constraints
- Survival against hostile environments
- The "big dumb object" — mysterious alien artifact

**Tropes to handle carefully:**
- Technobabble disguised as hard science — readers will check
- Single-genius-solves-everything — modern science is collaborative
- Aliens that are conveniently humanoid — hard SF readers expect biological plausibility

**Comp title calibration**: Clarke, Egan, Weir, Robinson, Watts, Liu Cixin

## Space Opera

**Reader contract**: Scope, wonder, and emotional stakes. The science is furniture — it enables the story but isn't the point. Characters and civilizational conflict drive the narrative.

**Core expectations:**
- Large-scale conflict (interstellar war, galactic politics, civilizational stakes)
- FTL travel and communication assumed — don't over-explain unless the mechanism matters to the plot
- Multiple species, cultures, or factions with distinct identities
- Sense of wonder comes from scale, diversity, and the sweep of history
- Emotional core — space opera is melodrama in the best sense

**Common tropes (use deliberately):**
- The chosen one / unlikely hero at galactic scale
- Ancient precursor civilizations
- Space battles with naval analogies
- Political intrigue across star systems
- The ragtag crew on a mission

**Tropes to handle carefully:**
- Planet-of-hats — each species/culture needs internal diversity
- Evil empire without nuance — give antagonist factions coherent motivations
- Scale without consequence — if billions die, the text must register the weight

**Comp title calibration**: Banks, Leckie, Bujold, Hamilton, Corey, Chambers

## Cyberpunk

**Reader contract**: Technology as social critique. The future is unevenly distributed. Power, surveillance, class, and identity are the real subjects. Aesthetic is not sufficient — there must be substance.

**Core expectations:**
- Near-future, usually Earth-bound or near-Earth
- Technology amplifies existing social inequalities
- Corporate power exceeds or replaces government power
- Body modification, neural interfaces, virtual reality as identity questions
- Street-level perspective — protagonists are usually marginalized, not powerful
- Noir sensibility — moral ambiguity, compromised protagonists

**Common tropes (use deliberately):**
- The hacker/street samurai/fixer protagonist
- Megacorporations as antagonists
- Virtual reality as parallel world
- Body as commodity or battleground
- Information as the most valuable currency

**Tropes to handle carefully:**
- Aesthetic without critique — neon and rain are not cyberpunk; social commentary is
- Orientalism — early cyberpunk's fetishization of Asian aesthetics without Asian characters. Avoid.
- Nihilism without purpose — cynicism needs to serve the story, not replace theme

**Comp title calibration**: Gibson, Stephenson, Jemisin (Broken Earth for social SF), Rajaniemi, Huang

## Military SF

**Reader contract**: Tactical and strategic plausibility. Chain of command matters. Combat has consequences — physical, psychological, and moral. The military institution is examined, not just used as a backdrop.

**Core expectations:**
- Military hierarchy and culture depicted with specificity
- Combat scenes are tactically coherent — weapons, logistics, terrain matter
- Consequences of violence are real — casualties, trauma, moral injury
- Technology affects tactics (and tactics affect technology procurement)
- Institutional dynamics — politics, promotion, loyalty, dissent within the military

**Common tropes (use deliberately):**
- The unit as family
- The impossible mission
- Technology escalation / arms race
- The cost of command — leaders making decisions that kill people
- First contact as military encounter

**Tropes to handle carefully:**
- War without consequence — glorifying combat without showing its cost
- Alien enemies as pure evil — dehumanizing the enemy is a theme to examine, not enact
- Technology solves everything — logistics, morale, and human error matter more than weapons

**Comp title calibration**: Haldeman, Scalzi, Weber, Kloos, Marko

## First Contact

**Reader contract**: The encounter with the truly alien. Communication is the central problem. The story explores what it means to understand (or fail to understand) a non-human intelligence.

**Core expectations:**
- The alien is genuinely alien — not a human in a suit
- Communication is difficult, partial, and fraught with misunderstanding
- Cultural assumptions are exposed and challenged
- The story asks what "intelligence" or "personhood" means
- Resolution may be partial — full understanding may be impossible

**Common tropes (use deliberately):**
- The linguist/scientist protagonist
- Miscommunication with catastrophic consequences
- The alien perspective chapter (if the author can pull it off)
- Humanity seen through alien eyes
- The gift/threat ambiguity — is the alien offering help or invasion?

**Tropes to handle carefully:**
- Instant translation — undermines the core premise
- Aliens that want what humans want — if their biology and cognition differ, their desires should too
- First contact as military problem only — reduces the most interesting questions to combat

**Comp title calibration**: Lem, Chiang, Tchaikovsky, Sagan, Miéville

## Time Travel

**Reader contract**: The rules will be consistent. Paradoxes will be addressed, not ignored. The mechanism may be handwaved, but the consequences must be rigorous.

**Core expectations:**
- Time travel rules are established early and followed throughout
- Paradoxes are either prevented by the rules, explored as plot, or acknowledged as unresolvable
- Causality is the core constraint — actions have consequences across time
- The emotional weight of time travel — loss, regret, the impossibility of changing the past (or the horror of succeeding)

**Causality models (choose one and commit):**
- **Fixed timeline**: The past cannot be changed. Attempts to change it cause the events they tried to prevent. (Predestination paradox.)
- **Branching timeline**: Changes create alternate timelines. The original timeline still exists. (Multiverse model.)
- **Mutable timeline**: The past can be changed, and changes propagate forward. (Butterfly effect model — highest complexity.)
- **Loop**: Time is cyclical. Events repeat with variation. (Groundhog Day model.)

**Common tropes (use deliberately):**
- The bootstrap paradox (object or information with no origin)
- The grandfather paradox (as problem to solve, not ignore)
- Time as resource — limited uses, high cost
- The observer who remembers the original timeline
- Historical tourism gone wrong

**Tropes to handle carefully:**
- Inconsistent rules — the single most common failure in time travel fiction
- Consequence-free changes — if changing the past is easy and safe, there's no tension
- Time travel as simple undo button — removes stakes

**Comp title calibration**: Willis, Wells, Fforde, Niffenegger, Chiang

## Dystopia / Post-Apocalyptic

**Reader contract**: The world is broken in a way that comments on the present. The system of oppression or the nature of collapse is examined, not just used as backdrop. Characters resist, adapt, or are complicit — but the text has a perspective.

**Core expectations:**
- The dystopian system or post-apocalyptic condition is internally logical — it works (for those in power) or it persists (because of specific dynamics)
- The connection to present-day concerns is legible without being preachy
- Individual agency exists but is constrained — the system is bigger than any one person
- Hope is earned, not given — if the story offers hope, it must be plausible within the world's logic

**Common tropes (use deliberately):**
- The awakening protagonist — someone who believed in the system and stops
- The underground resistance
- The cost of compliance vs. the cost of resistance
- Technology as tool of control
- The found family in hostile conditions

**Tropes to handle carefully:**
- Chosen one destroys the system — systemic problems require systemic solutions
- Dystopia as aesthetic — oppression without examination is just set dressing
- Post-apocalyptic without cause — the nature of the collapse should matter and have consequences

**Comp title calibration**: Atwood, Bacigalupi, Butler, McCarthy, Jemisin

## Using This Reference

When validating subgenre contract compliance:
1. Identify the project's declared subgenre (from activation).
2. Check the manuscript against the "Core expectations" for that subgenre.
3. Flag any "Tropes to handle carefully" that appear without apparent awareness.
4. Note comp title calibration — if the manuscript's tone and approach don't fit within the comp range, the subgenre classification may need adjustment.

When advising on creative decisions:
1. Reference the relevant subgenre's expectations and tropes.
2. Distinguish between conventions (reader expectations to honor) and clichés (overused patterns to subvert or avoid).
3. A trope used deliberately and with awareness is craft. A trope used unconsciously is a cliché.
