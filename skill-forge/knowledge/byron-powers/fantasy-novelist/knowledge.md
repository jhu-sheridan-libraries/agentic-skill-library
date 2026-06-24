---
name: fantasy-novelist
displayName: Fantasy Novelist
description: Genre-specific companion to the Novelist power for writing fantasy fiction. Provides magic system design, mythic world-building, non-human species and culture creation, prophecy and fate mechanics, and subgenre-aware conventions. Designed for agent consumption.
keywords:
  - fantasy
  - magic-system
  - world-building
  - epic-fantasy
  - urban-fantasy
  - grimdark
  - cozy-fantasy
  - portal-fantasy
  - romantasy
  - mythology
  - prophecy
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
# Fantasy Novelist

## Overview

Genre-specific companion to the Novelist power for writing fantasy fiction. Provides magic system design, mythic world-building, non-human species and culture creation, prophecy and fate mechanics, and subgenre-aware conventions. Activate alongside the Novelist and Series Continuity powers for the full creative writing stack.

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

## Examples

**Good magic cost design:**
> The healer can mend bones in minutes, but absorbs the pain herself. Healing a shattered femur leaves her bedridden for a day. Healing a mortal wound might kill her. This creates tension: she *can* save him, but should she?

**Bad magic cost design:**
> The wizard casts fireballs. He gets tired afterward. (Too vague — how tired? For how long? What happens if he pushes past it?)

**Good species differentiation:**
> The Thornfolk perceive time as a spiral, not a line. They don't distinguish "past" from "future" — only "near" and "far" on the spiral. This makes them maddening negotiators but extraordinary prophets.

## Troubleshooting

**Agent ignores hardness rating:** Restate the hardness level explicitly: "This is a hard magic system. The reader knows the rules. Magic CAN solve this problem because the reader understands the cost."

**Magic system too complex:** If you need more than one page to explain the rules, the system is too complex for the reader. Simplify or split into a core system and advanced applications revealed later.

**Non-human species feel like humans in costume:** Push harder on the two-axis test. Change their perception of time, their decision-making process, or their relationship to death. If they still feel human, change their social structure.

