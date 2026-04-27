---
name: scifi-novelist
displayName: Sci-Fi Novelist
description: Genre-specific companion to the Novelist power for writing science fiction. Provides speculative technology design, alien species creation, hard-SF consistency validation, and subgenre-aware world-building. Designed for agent consumption.
keywords:
  - science-fiction
  - scifi
  - speculative-fiction
  - hard-sf
  - space-opera
  - cyberpunk
  - world-building
  - alien
  - technology
  - futurism
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
# Sci-Fi Novelist

## Overview

Genre-specific companion to the Novelist power for writing science fiction. Provides speculative technology design, alien species creation, hard-SF consistency validation, and subgenre-aware world-building. Activate alongside the Novelist power for the full creative writing stack.

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


## Examples

**Good extrapolation chain:**
> Technology: Cheap fusion power → Second-order: Desalination becomes trivial → Third-order: Desert nations become agricultural superpowers → Story implication: The old oil economies collapse, creating political refugees who drive the plot.

**Bad speculative element:**
> The ship has a "quantum drive" that goes anywhere instantly. (No cost, no limitation, no extrapolation. It's a plot convenience, not a technology.)

## Troubleshooting

**Agent introduces technology without constraints:** Ask "What can this technology NOT do?" and "What does it cost?" If the answer is "nothing," the technology needs redesign.

**Hardness rating inconsistency:** If the project is rated hard-SF but the agent is hand-waving physics, restate the hardness level and point to specific violations in the technology bible.

**Exposition dumps about technology:** Technology should be introduced through character interaction, not encyclopedia entries. If a passage reads like a textbook, rewrite it as a character encountering the technology's effects.
