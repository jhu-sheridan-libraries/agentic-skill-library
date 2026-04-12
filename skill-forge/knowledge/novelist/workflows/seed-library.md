# Seed Library

## Overview

A Seed Library is a professional author's collection of Fiction Seeds organized across projects, genres, and purposes. Where the fiction-seeds phase teaches you to create and use individual Seeds, the Seed Library is the system for managing them at scale — across a career, not just a single manuscript.

Working authors don't write one book in one voice. They write series with evolving tones, switch between genres, ghostwrite in someone else's style, and return to dormant projects years later. A well-maintained Seed Library makes all of that faster and more consistent.

## Library Structure

The Seed Library lives in a central location accessible across projects, with project-specific Seeds stored locally:

```
~/seed-library/                          ← Central library (cross-project)
├── catalog.md                           ← Master index of all Seeds
├── house/                               ← Your signature voices
│   ├── default_authorial_voice.md
│   ├── intimate_first_person.md
│   └── detached_third_omniscient.md
├── genre/                               ← Genre-tuned Seeds
│   ├── hardboiled_crime_narration.md
│   ├── cozy_mystery_warmth.md
│   ├── epic_fantasy_grandeur.md
│   ├── literary_domestic_realism.md
│   └── tense_psychological_thriller.md
├── register/                            ← Functional registers
│   ├── action_sequence_urgency.md
│   ├── quiet_emotional_interiority.md
│   ├── comic_relief_lightness.md
│   ├── expository_world_delivery.md
│   └── dream_sequence_surreal.md
└── borrowed/                            ← Reference Seeds from other authors
    ├── _README.md                       ← Ethics note: for study only, not publication
    ├── chandler_influenced_noir.md
    └── munro_influenced_domestic.md

your-novel-project/                      ← Project-level Seeds
└── seeds/
    ├── project_manifest.md              ← Which Seeds this project uses
    ├── elena_pov_voice.md               ← Character-specific Seeds
    ├── marcus_pov_voice.md
    └── act_three_escalation.md          ← Section-specific variants
```

## The Catalog

The catalog is the master index of your entire Seed Library. It makes Seeds discoverable without opening every file.

```markdown
# Seed Library Catalog

Last updated: {date}

## House Seeds
| Seed | Style Summary | Projects Used |
|------|--------------|---------------|
| default_authorial_voice | Clean literary realism, close third, sensory | All |
| intimate_first_person | Confessional, present tense, fragmentary | The Liar's Garden, Untitled #4 |
| detached_third_omniscient | Ironic distance, long sentences, panoramic | The Bellweather Trilogy |

## Genre Seeds
| Seed | Style Summary | Genre |
|------|--------------|-------|
| hardboiled_crime_narration | Clipped, declarative, urban sensory | Crime/Noir |
| cozy_mystery_warmth | Warm, observational, gentle humor | Cozy Mystery |
| epic_fantasy_grandeur | Elevated diction, sweeping, mythic register | Epic Fantasy |

## Register Seeds
| Seed | Purpose | Best For |
|------|---------|----------|
| action_sequence_urgency | Short sentences, present-tense feel, visceral | Chase scenes, fights, escapes |
| quiet_emotional_interiority | Long sentences, reflective, sensory memory | Aftermath, grief, realization |
| comic_relief_lightness | Wry observations, timing-aware, understated | Tension breaks, character moments |

## Borrowed Seeds
| Seed | Influence | Study Purpose |
|------|-----------|---------------|
| chandler_influenced_noir | Raymond Chandler | Metaphor construction, urban atmosphere |
| munro_influenced_domestic | Alice Munro | Time compression, emotional precision |
```

## Workflow: Building Your Library

### Phase 1: Establish Your House Seeds

Every author has a default voice — the way you write when you're not trying to write any particular way. This is your most important Seed.

**To create your house Seed:**

1. Gather 3-5 passages from different projects that you feel represent your natural voice
2. Identify what they have in common — sentence patterns, vocabulary tendencies, tonal defaults
3. Distill these into a single Seed following the fiction-seeds format
4. Name it `default_authorial_voice`

**Then create 2-3 variants:**
- How does your voice shift when you write in first person vs. third?
- How does it change when you're writing something funny vs. something serious?
- What does your "reaching" voice sound like — the style you use when you're pushing yourself?

These house Seeds form the foundation. Everything else in the library is a departure from or elaboration on these.

### Phase 2: Build Genre Seeds

If you write across genres (or plan to), create Seeds for each genre's conventions:

**For each genre Seed, capture:**
- The prose expectations of that genre's readers
- Pacing conventions (thriller readers expect shorter sentences than literary readers)
- Vocabulary register (fantasy tolerates elevated diction; crime fiction doesn't)
- How your house voice adapts to meet genre expectations without losing your identity

**The key tension:** Genre Seeds should sound like you writing in that genre, not like a generic example of that genre. Your house voice should be audible underneath the genre conventions.

### Phase 3: Develop Register Seeds

Registers are functional modes you shift into regardless of genre:

- **Action** — When the pace needs to spike
- **Interiority** — When you're deep inside a character's mind
- **Exposition** — When world-building or backstory needs to be delivered
- **Comedy** — When you're playing for laughs or lightness
- **Lyrical** — When the prose itself is part of the experience
- **Surreal** — When reality bends (dreams, altered states, magical realism)

Register Seeds are modifiers — they layer on top of your house or genre Seed for specific scenes.

### Phase 4: Create Project-Specific Seeds

Each new project may need Seeds that don't exist in your library yet:

**Character POV Seeds:**
If your novel has multiple POV characters, each should have a distinct voice Seed. These capture not just how the character speaks (that's dialogue) but how the narrative sounds when filtered through their perception.

**Section variants:**
Some novels shift tone across their arc. A Seed for the opening chapters (establishing, measured) might differ from one for the climax (compressed, urgent). Create variants rather than trying to make one Seed cover everything.

**Project manifest:**
Each project should have a `project_manifest.md` that maps Seeds to usage:

```markdown
# Project: The Liar's Garden

## Primary Seed
- default_authorial_voice (base)

## Character Seeds
- elena_pov_voice — Chapters 1, 4, 7, 10, 13 (close third, sensory, anxious undercurrent)
- marcus_pov_voice — Chapters 2, 5, 8, 11, 14 (more detached, analytical, dry humor)

## Register Overrides
- action_sequence_urgency — Chapter 9 (the chase), Chapter 14 (confrontation)
- quiet_emotional_interiority — Chapter 7 (Elena's grief), Chapter 15 (resolution)

## Section Variants
- act_three_escalation — Chapters 11-15 (tighter sentences, less description, more dialogue)
```

## Library Maintenance

### Versioning Seeds

As your writing evolves, so should your Seeds. Rather than overwriting, version them:

- `default_authorial_voice.md` — Current version
- `default_authorial_voice_v1.md` — Archived original
- `default_authorial_voice_2024.md` — Date-stamped snapshot

This lets you return to earlier versions of your voice if a project calls for it, and track how your style has developed over time.

### Retiring Seeds

Some Seeds outlive their usefulness. When a Seed no longer represents how you write or want to write:

1. Move it to an `archive/` subdirectory
2. Note in the catalog that it's retired and why
3. Don't delete it — you may want to reference it later

### Auditing the Library

Every 6-12 months (or between major projects), review your library:

- Are your house Seeds still accurate to how you actually write?
- Are there genre or register Seeds you've never used? (Consider retiring them)
- Are there styles you've been writing that don't have Seeds yet? (Create them)
- Do any Seeds overlap enough to be merged?

## Advanced Techniques

### Seed Blending

For scenes that need a mixed register, specify a blend:

> "Use `elena_pov_voice` as the base. Layer in `action_sequence_urgency` for pacing but keep Elena's sensory interiority. Reduce her typical sentence length by 30%."

Blending instructions go in the project manifest or in scene-planning notes.

### Seed Diffing

When something feels "off" in a draft, compare the passage against its intended Seed. Read them side by side and identify where the draft diverges:

- Did sentence length drift longer?
- Did the vocabulary register shift?
- Did the emotional distance change?

This diagnostic use of Seeds is one of their most practical applications for professional authors.

### Seed Extraction from Existing Backlist

If you have published novels, extract Seeds retroactively:

1. Pick 2-3 representative passages from each book
2. Create a Seed for each book's voice
3. Add them to your library with the project name
4. Use them if you return to that series or want to recapture that period's style

### Cross-Pollination

Deliberately load a Seed from one genre while writing in another. A literary fiction Seed applied to a thriller can produce something fresh. A crime Seed applied to literary fiction can tighten flabby prose. Use this as a creative exercise, not a default.

## The Borrowed Seeds Directory

Seeds based on other authors' styles are valuable study tools but require ethical clarity:

- These are for private analysis and learning, not for publishing derivative work
- The goal is to understand technique, not to replicate voice
- Name them `{author}_influenced_{quality}` to be explicit about the relationship
- Include a note in each borrowed Seed about what you're studying and how it informs your own work
- Evolve borrowed Seeds into original ones by identifying what you want to keep and what you want to change

## Deliverables

By the end of this phase, you should have:
- A `~/seed-library/` directory with house, genre, register, and (optionally) borrowed subdirectories
- A `catalog.md` indexing all Seeds with summaries
- At least one house Seed representing your default voice
- A project manifest for your current work-in-progress
- A maintenance rhythm for keeping the library current

## Connection to Other Phases

- **Fiction Seeds** — Individual Seed creation; this phase is the management layer on top
- **Style & Tone** — Style decisions feed into house and genre Seeds
- **Character Creation** — Character voice profiles become character POV Seeds
- **Scene Drafting** — Load the right Seed before each writing session
- **Revision & Editing** — Use Seeds diagnostically to check tonal consistency
