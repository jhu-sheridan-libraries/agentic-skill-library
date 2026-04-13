# Seed Library

## Overview

A Seed Library is a professional author's collection of Fiction Seeds organized across projects, genres, and purposes. Where the fiction-seeds phase teaches you to create and use individual Seeds, the Seed Library is the system for managing them at scale — across a career, not just a single manuscript.

Working authors don't write one book in one voice. They write series with evolving tones, switch between genres, ghostwrite in someone else's style, collaborate with co-authors, and return to dormant projects years later. A well-maintained Seed Library makes all of that faster and more consistent.

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
├── borrowed/                            ← Reference Seeds from other authors
│   ├── _README.md                       ← Ethics note: for study only, not publication
│   ├── chandler_influenced_noir.md
│   └── munro_influenced_domestic.md
├── client/                              ← Client and ghostwriting Seeds
│   ├── _README.md                       ← Confidentiality and usage guidelines
│   ├── client_a_memoir_voice.md
│   └── client_b_business_narrative.md
├── blends/                              ← Reusable blend recipes
│   ├── elena_action_blend.md
│   └── literary_thriller_hybrid.md
└── archive/                             ← Retired Seeds preserved for reference
    ├── default_authorial_voice_v1.md
    └── old_fantasy_register.md

your-novel-project/                      ← Project-level Seeds
└── seeds/
    ├── project_manifest.md              ← Which Seeds this project uses
    ├── elena_pov_voice.md               ← Character-specific Seeds
    ├── marcus_pov_voice.md
    └── act_three_escalation.md          ← Section-specific variants
```

## The Catalog

The catalog is the master index of your entire Seed Library. It makes Seeds discoverable without opening every file. Each Seed file includes structured frontmatter that enables the agent to search, filter, and recommend Seeds dynamically — the catalog is generated from this metadata, not maintained by hand.

### Seed File Metadata

Every Seed file should include a YAML frontmatter block at the top, before the standard fiction-seeds format sections. This metadata powers catalog generation, search, compatibility checks, and lineage tracking:

```markdown
---
name: cold_noir_narration
category: genre                          # house | genre | register | borrowed | client
tags: [crime, noir, urban, dark, clipped]
mood: [tense, detached, gritty]
compatible_with:                         # Seeds this layers well with
  - default_authorial_voice
  - action_sequence_urgency
conflicts_with:                          # Seeds that clash with this one
  - cozy_mystery_warmth
  - comic_relief_lightness
derived_from: chandler_influenced_noir   # Lineage — which Seed this evolved from (if any)
version: 2
created: 2024-03-15
last_updated: 2025-11-02
last_tested: 2025-10-28
reliability: high                        # high | medium | low — how consistently it reproduces
drift_notes: "Tends to over-produce metaphors in passages longer than 500 words. Add explicit cap."
projects_used: [The Liar's Garden, Nightfall Sequence]
series_context:                          # Series continuity link (if applicable)
  series: Nightfall Sequence
  books_used_in: [1, 2, 3]
  evolution_notes: "Loosened sentence length constraints in book 3 to reflect narrator's emotional thaw."
status: active                           # active | retired | draft
---
```

### Catalog Format

The catalog is generated from Seed frontmatter. It includes quality and compatibility data alongside the style summaries:

```markdown
# Seed Library Catalog

Last updated: {date}

## House Seeds
| Seed | Style Summary | Reliability | Projects Used | Compatible With |
|------|--------------|-------------|---------------|-----------------|
| default_authorial_voice | Clean literary realism, close third, sensory | high | All | all register Seeds |
| intimate_first_person | Confessional, present tense, fragmentary | high | The Liar's Garden, Untitled #4 | quiet_emotional_interiority |
| detached_third_omniscient | Ironic distance, long sentences, panoramic | medium | The Bellweather Trilogy | expository_world_delivery |

## Genre Seeds
| Seed | Style Summary | Genre | Reliability | Derived From |
|------|--------------|-------|-------------|--------------|
| hardboiled_crime_narration | Clipped, declarative, urban sensory | Crime/Noir | high | chandler_influenced_noir |
| cozy_mystery_warmth | Warm, observational, gentle humor | Cozy Mystery | high | — |
| epic_fantasy_grandeur | Elevated diction, sweeping, mythic register | Epic Fantasy | medium | — |

## Register Seeds
| Seed | Purpose | Best For | Reliability | Conflicts With |
|------|---------|----------|-------------|----------------|
| action_sequence_urgency | Short sentences, present-tense feel, visceral | Chase scenes, fights, escapes | high | quiet_emotional_interiority |
| quiet_emotional_interiority | Long sentences, reflective, sensory memory | Aftermath, grief, realization | high | action_sequence_urgency |
| comic_relief_lightness | Wry observations, timing-aware, understated | Tension breaks, character moments | medium | hardboiled_crime_narration |

## Borrowed Seeds
| Seed | Influence | Study Purpose | Graduated To |
|------|-----------|---------------|--------------|
| chandler_influenced_noir | Raymond Chandler | Metaphor construction, urban atmosphere | hardboiled_crime_narration |
| munro_influenced_domestic | Alice Munro | Time compression, emotional precision | — (in progress) |

## Client Seeds
| Seed | Client | Project Type | Confidentiality |
|------|--------|-------------|-----------------|
| client_a_memoir_voice | Client A | Memoir/ghostwrite | restricted — do not share or blend with personal Seeds |

## Blend Recipes
| Blend | Base Seed | Modifiers | Use Case |
|-------|-----------|-----------|----------|
| elena_action_blend | elena_pov_voice | + action_sequence_urgency, −30% sentence length | Elena's chase/confrontation scenes |
| literary_thriller_hybrid | default_authorial_voice | + tense_psychological_thriller, keep sensory density | Crossover literary thriller project |
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
Each project should have a `project_manifest.md` that maps Seeds to usage, including blend recipes and series context:

```markdown
# Project: The Liar's Garden

## Series Context
- Series: The Liar's Garden Trilogy
- Book: 1 of 3
- Series bible reference: ~/series-bibles/liars-garden-trilogy/
- Seed evolution plan: Elena's voice tightens across the trilogy; Marcus gains warmth

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

## Blend Recipes

### elena_action_blend
- **Base:** elena_pov_voice
- **Modifier:** action_sequence_urgency
- **Adjustments:** Reduce sentence length by 30%. Keep Elena's sensory interiority but shift from reflective to reactive. Limit metaphors to one per paragraph.
- **Use in:** Chapter 9 (the chase), Chapter 14 (confrontation)

### resolution_blend
- **Base:** default_authorial_voice
- **Modifier:** quiet_emotional_interiority
- **Adjustments:** Increase paragraph length. Allow longer sentences. Sensory details shift from visual to tactile. Pacing slows deliberately.
- **Use in:** Chapter 15 (resolution)

## Seed Recommendation Map
When drafting, the agent should recommend Seeds based on chapter context:
| Chapter | POV | Primary Seed | Register Override | Blend (if any) |
|---------|-----|-------------|-------------------|----------------|
| 1 | Elena | elena_pov_voice | — | — |
| 9 | Elena | elena_pov_voice | action_sequence_urgency | elena_action_blend |
| 15 | Both | default_authorial_voice | quiet_emotional_interiority | resolution_blend |
```

## Library Maintenance

### Versioning Seeds

As your writing evolves, so should your Seeds. Rather than creating separate files for each version (which fragments the library and creates naming ambiguity), track version history inside the Seed file itself:

**In the Seed's frontmatter**, increment the `version` number and update `last_updated` with each significant change.

**In the Seed file**, maintain a `## Version History` section at the bottom:

```markdown
## Version History

### v3 — 2025-11-02
- Tightened sentence length cap from 20 words to 15
- Added constraint against back-to-back metaphors
- Reason: Drift detected during Nightfall Sequence book 3 revision

### v2 — 2025-03-10
- Shifted from past tense to present tense default
- Added sensory emphasis on sound (previously visual-dominant)
- Reason: Better match for thriller pacing after A/B testing

### v1 — 2024-03-15
- Original version extracted from The Liar's Garden draft
```

**When to create a separate file vs. a new version:**
- New version (same file): The Seed is evolving — you want the latest version to be the default
- Separate file: The old version represents a fundamentally different voice you may want to use again (e.g., `default_authorial_voice_liars_garden.md` alongside the current `default_authorial_voice.md`)

The `archive/` directory is reserved for fully retired Seeds — not for version history.

### Retiring Seeds

Some Seeds outlive their usefulness. When a Seed no longer represents how you write or want to write:

1. Move it to an `archive/` subdirectory
2. Note in the catalog that it's retired and why
3. Don't delete it — you may want to reference it later

### Auditing the Library

Every 6-12 months (or between major projects), review your library:

**Quality audit:**
- Test each active Seed by generating a 200-word passage and comparing against the sample passage
- Update the `reliability` rating in frontmatter based on results
- Record any drift patterns in `drift_notes` — these are diagnostic gold for refining generation prompts
- Update `last_tested` dates

**Compatibility audit:**
- Review `compatible_with` and `conflicts_with` fields — have you discovered new pairings that work or clash?
- Test any blend recipes that haven't been used recently
- Update compatibility metadata based on actual drafting experience

**Coverage audit:**
- Are your house Seeds still accurate to how you actually write?
- Are there genre or register Seeds you've never used? (Consider retiring them)
- Are there styles you've been writing that don't have Seeds yet? (Create them)
- Do any Seeds overlap enough to be merged?

**Lineage audit:**
- Are there borrowed Seeds ready to graduate to original ones?
- Have any Seeds diverged enough from their `derived_from` parent to warrant clearing the lineage link?
- Are there Seeds that share enough DNA to be consolidated?

**Series audit (if applicable):**
- Do Seeds used across a series still reflect the intended voice evolution?
- Are `series_context` entries in frontmatter up to date?
- Does the series bible reference the correct Seed versions for each book?

## Advanced Techniques

### Seed Blending

For scenes that need a mixed register, create a formal blend recipe rather than ad-hoc prose instructions. Blend recipes can live in the project manifest (for project-specific blends) or in the `~/seed-library/blends/` directory (for reusable cross-project blends).

**Blend recipe format:**

```markdown
# elena_action_blend

## Base Seed
elena_pov_voice

## Modifier Seeds
- action_sequence_urgency (pacing layer)

## Adjustments
- Reduce typical sentence length by 30%
- Keep Elena's sensory interiority but shift from reflective to reactive
- Limit metaphors to one per paragraph
- Maintain Elena's anxious undercurrent — express it through body awareness, not thought

## Anti-patterns
- Don't lose Elena's voice entirely into generic action prose
- Don't let the urgency modifier eliminate all interiority — she still notices textures and sounds, just faster

## Test Passage
{A 200-word sample of what this blend should sound like — written or generated and approved}
```

**Why formalize blends?** Ad-hoc blending instructions ("Use X as base, layer in Y") produce inconsistent results because the instructions are interpreted differently each time. A tested blend recipe with a sample passage and explicit anti-patterns is reproducible.

Blending instructions in the project manifest should reference the blend recipe by name rather than restating the instructions inline.

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

### Graduating a Borrowed Seed

Borrowed Seeds should evolve into original ones over time. This is a structured process, not a vague aspiration:

**Step 1: Identify what you're keeping.**
Read the borrowed Seed's generation prompt and style profile. Highlight the specific techniques you want to absorb — not the whole voice, but particular moves. (Chandler's metaphor construction. Munro's time compression. McCarthy's sentence rhythm.)

**Step 2: Identify what you're changing.**
What about this borrowed voice doesn't sound like you? Where does it clash with your house Seeds? These are the elements you'll replace with your own tendencies.

**Step 3: Write a new generation prompt.**
Combine the techniques you're keeping with your own voice characteristics. The new prompt should read as instructions for *your* voice with borrowed techniques integrated, not as a modified version of someone else's voice.

**Step 4: Test against both sources.**
Generate a passage using the new Seed. Compare it to:
- The original borrowed Seed's sample passage (it should sound noticeably different)
- Your house Seed's sample passage (it should sound recognizably like you, with new capabilities)

If it's too close to the borrowed source, you haven't changed enough. If it's indistinguishable from your house voice, you haven't kept enough.

**Step 5: Graduate.**
Move the new Seed to the appropriate directory (house, genre, or register). Set `derived_from` in the frontmatter to reference the borrowed Seed. Update the catalog's "Graduated To" column for the borrowed Seed.

The borrowed Seed stays in the `borrowed/` directory as a reference — it's the study material, not the finished product.

## Client and Ghostwriting Seeds

The overview mentions ghostwriting, and many professional authors write for clients. Client Seeds require their own conventions:

### The `client/` Directory

Client Seeds live in `~/seed-library/client/`, separate from your personal library. Each client gets a subdirectory if they have multiple Seeds:

```
client/
├── _README.md                           ← Confidentiality guidelines
├── client_a_memoir_voice.md
└── client_b/
    ├── business_narrative.md
    └── thought_leadership.md
```

### Confidentiality Rules

The `_README.md` in the client directory should establish:

- Client Seeds are never blended with personal Seeds without explicit permission
- Client voice profiles are confidential — don't reference them in personal project manifests
- When a client engagement ends, archive their Seeds but don't delete them (you may be rehired)
- Client Seeds should not appear in the main catalog — maintain a separate `client_catalog.md` if needed

### Creating Client Seeds

The process mirrors house Seed creation, but the source material is the client's voice, not yours:

1. Gather 3-5 passages of the client's existing writing (or approved sample prose)
2. Extract the style profile as you would for any Seed
3. Test the Seed by generating a passage and having the client confirm it sounds like them
4. Iterate until the client approves — their ear is the standard, not yours

### Collaborative Seeds

When co-authoring, you may need Seeds that blend two authors' voices into a unified third voice:

1. Each author creates a house Seed (or provides an existing one)
2. Identify the overlap — where do your voices naturally converge?
3. Create a collaborative Seed that lives in the shared project, not in either author's personal library
4. Both authors test and approve the collaborative Seed before drafting begins

## Seed Discovery and Recommendation

A library is only useful if the right Seed gets loaded at the right time. The agent should proactively recommend Seeds during drafting rather than waiting for the author to manually look them up.

### How Seed Recommendation Works

During scene drafting, the agent should:

1. **Check the project manifest.** Read the Seed Recommendation Map (if present) to see which Seed is assigned to the current chapter or scene.
2. **Consider the scene context.** If the scene involves action, check for register overrides. If it's a POV shift, check for character Seeds. If it's a tonal transition, check for section variants.
3. **Suggest a Seed or blend.** Before the author starts writing, recommend the appropriate Seed with a brief rationale: "Chapter 9 is Elena's chase scene — loading `elena_action_blend` (elena_pov_voice + action_sequence_urgency, −30% sentence length)."
4. **Flag compatibility issues.** If the recommended Seed has `conflicts_with` entries that overlap with other Seeds in play, warn the author.

### Search and Filtering

The structured frontmatter on each Seed file enables the agent to search the library by:

- **Tags:** "Find all Seeds tagged `dark` and `urban`"
- **Mood:** "Which Seeds have a `tense` mood?"
- **Compatibility:** "What register Seeds are compatible with `epic_fantasy_grandeur`?"
- **Reliability:** "Show me only high-reliability Seeds"
- **Lineage:** "What Seeds are derived from `chandler_influenced_noir`?"
- **Series:** "Which Seeds have been used in the Nightfall Sequence?"

This turns the catalog from a static reference document into a queryable system.

### Drafting Integration

The connection between the Seed Library and Scene Drafting should be seamless:

- When the author opens a scene-drafting session, the agent reads the project manifest and loads the appropriate Seed's generation prompt automatically
- If no Seed is mapped to the current scene, the agent suggests candidates from the library based on scene metadata (POV character, scene type, emotional register)
- After drafting, the agent can compare the output against the loaded Seed's style profile and flag drift — this is the Seed Diffing technique applied automatically

## Series Continuity Integration

For authors writing series, Seeds evolve across books. The Seed Library should integrate with the Series Continuity power to track this evolution.

### How Seeds Connect to the Series Bible

The series bible (managed by the Series Continuity power) tracks character state, setting consistency, and timeline integrity across books. Seeds add a voice dimension to this tracking:

- **Character voice evolution:** A character who starts guarded and clipped in book 1 may become more open and flowing by book 3. Their POV Seed should evolve to match, and the series bible should reference which Seed version applies to which book.
- **Tonal arc across books:** A series that starts light and darkens over time needs Seeds that reflect this progression. Track the tonal arc in the series bible alongside plot and character arcs.
- **Consistency checks:** When drafting a new book in a series, the agent should load the Seed version that matches the character's state at that point in the series — not necessarily the latest version.

### Series Seed Tracking

Add a `## Seed Evolution` section to the series bible:

```markdown
## Seed Evolution

### Elena POV Voice
| Book | Seed Version | Key Changes | Rationale |
|------|-------------|-------------|-----------|
| 1 | elena_pov_voice v1 | Anxious, sensory, fragmented | Establishing character under stress |
| 2 | elena_pov_voice v2 | Longer sentences, more reflective | Character gaining confidence |
| 3 | elena_pov_voice v3 | Balanced, fewer fragments, warmer | Character arc resolution |

### Series Tone
| Book | Primary Seed | Register Emphasis | Tonal Direction |
|------|-------------|-------------------|-----------------|
| 1 | default_authorial_voice | action_sequence_urgency (heavy) | Tense, propulsive |
| 2 | default_authorial_voice | quiet_emotional_interiority (moderate) | Reflective, deepening |
| 3 | default_authorial_voice | balanced registers | Resolution, earned warmth |
```

### Cross-Book Seed Consistency

When starting a new book in a series:

1. Load the series bible's Seed Evolution section
2. Identify which Seed versions apply to the new book's starting point
3. Check whether any Seeds need new versions for this book's arc
4. Create new versions if needed, documenting the changes in both the Seed's version history and the series bible
5. Update the project manifest for the new book with the correct Seed versions

## Deliverables

By the end of this phase, you should have:
- A `~/seed-library/` directory with house, genre, register, borrowed, client (if applicable), blends, and archive subdirectories
- Structured frontmatter on every Seed file (tags, mood, compatibility, reliability, lineage)
- A `catalog.md` generated from Seed metadata, including quality and compatibility data
- At least one house Seed representing your default voice, tested and rated for reliability
- A project manifest for your current work-in-progress, including blend recipes and a Seed Recommendation Map
- Compatibility and conflict mappings between Seeds you use together
- A maintenance rhythm for keeping the library current (quality audits, compatibility audits, lineage audits)
- Series continuity integration if writing a series (Seed Evolution section in the series bible)
- A graduation plan for any borrowed Seeds you intend to evolve into original ones

## Connection to Other Phases

- **Fiction Seeds** — Individual Seed creation; this phase is the management layer on top. Seed file format is defined there; this phase adds frontmatter metadata, quality tracking, and compatibility mapping.
- **Style & Tone** — Style decisions feed into house and genre Seeds. The style profile fields in each Seed map directly to the style dimensions defined in this phase.
- **Character Creation** — Character voice profiles become character POV Seeds. For series, character Seed evolution tracks alongside character arc development.
- **Scene Drafting** — The agent loads the right Seed (or blend) before each writing session using the project manifest's Seed Recommendation Map. After drafting, automatic Seed Diffing checks for voice drift.
- **Revision & Editing** — Use Seeds diagnostically to check tonal consistency. Compare draft passages against their intended Seed's style profile to identify where prose has drifted.
- **Series Continuity** — For series writers, Seed evolution is tracked in the series bible. Character POV Seeds version alongside character arcs. The agent loads the correct Seed version for each book's timeline position.
