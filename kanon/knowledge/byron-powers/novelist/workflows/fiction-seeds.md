# Fiction Seeds

## Overview

A Fiction Seed is a language generator — a captured writing style distilled into a reusable prompt. You write a passage (or identify one that captures the voice you want), extract its stylistic DNA, and save it as a Seed. Later, you reload that Seed to generate more language in the same style and tone.

Seeds are useful for:
- Maintaining a consistent voice across long manuscripts
- Switching between narrative registers (e.g., a character's internal monologue vs. action sequences)
- Experimenting with different styles before committing
- Returning to a project after time away and quickly re-entering the voice

## Seed File Format

Seeds are stored as markdown files in a `seeds/` directory within your project (or in the central `~/seed-library/` for cross-project Seeds). Each Seed file follows this structure:

```markdown
---
name: cold_noir_narration
category: genre                          # house | genre | register | borrowed | client
tags: [crime, noir, urban, dark, clipped]
mood: [tense, detached, gritty]
compatible_with: []                      # Seeds this layers well with (populated as you use it)
conflicts_with: []                       # Seeds that clash with this one (populated as you use it)
derived_from:                            # Lineage — which Seed this evolved from (if any)
version: 1
created: {date}
last_updated: {date}
last_tested:                             # Populated after Step 5
reliability:                             # high | medium | low — populated after testing
drift_notes:                             # Known drift patterns — populated over time
projects_used: []
status: active                           # active | retired | draft
---

# {seed_name}

## Sample Passage

{The original passage that defines this style — 200-500 words of representative prose}

## Style Profile

- **Sentence structure:** {short/long/mixed, simple/complex, fragments allowed?}
- **Vocabulary:** {register — literary, colloquial, technical, sparse, lush}
- **Tone:** {emotional register — dark, warm, detached, intimate, wry}
- **Rhythm:** {pacing feel — staccato, flowing, syncopated, measured}
- **Figurative language:** {none, minimal, moderate, abundant — what kinds?}
- **POV and distance:** {first/third, close/distant, interior access level}
- **Sensory emphasis:** {which senses dominate — visual, tactile, auditory?}
- **Distinctive features:** {anything unique — recurring motifs, structural quirks, tonal signatures}

## Generation Prompt

When generating text in this style, follow these instructions:

{A natural-language prompt that captures the voice. This is the core of the Seed — a set of
instructions precise enough to reproduce the style consistently. Written in second person
as direct instructions to the language model.}

Example:
"Write in short, declarative sentences. Favor concrete nouns over abstractions. Use present
tense. Avoid adverbs. Let silence and white space do emotional work. Descriptions should be
sensory and specific — textures, temperatures, sounds — never summarized emotions. Dialogue
is sparse and clipped. Characters say less than they mean."

## Version History

### v1 — {date}
- Initial creation
- Source: {where the sample passage came from}
```

The frontmatter makes Seeds library-ready from the moment they're created. You don't need to fill in every field upfront — `compatible_with`, `conflicts_with`, `reliability`, and `drift_notes` are populated as you use the Seed and learn its behavior. But including the structure from the start means you never have to retrofit metadata later.

For full details on frontmatter fields and how they power the Seed Library's catalog, search, and recommendation features, see the **Seed Library** phase.

## Seed Naming Convention

Seeds use 3-5 word snake_case names that capture the essence of the style:

- `cold_noir_narration`
- `lush_southern_gothic`
- `spare_literary_realism`
- `breathless_thriller_pace`
- `wry_first_person_confessional`

The name should be evocative enough that you remember what the Seed sounds like without opening it.

## Workflow: Creating a Seed

### Step 1: Identify the Source Passage

Start with a passage that captures the voice you want to reproduce. This can be:

- **Something you wrote** — A paragraph or scene from your manuscript that nails the tone
- **A writing exercise** — A passage written specifically to explore a style
- **An existing work** — A passage from a published novel that represents your target voice (for reference only — the Seed captures the style, not the content). If you're creating a Seed from another author's work, this becomes a *borrowed Seed* — set `category: borrowed` in the frontmatter and `derived_from` to note the influence. See the **Seed Library** phase for the full borrowed Seed graduation path.

The passage should be 200-500 words — long enough to establish a pattern, short enough to be focused.

### Step 2: Analyze the Style

Read the passage carefully and extract its stylistic qualities. Work through each element of the Style Profile:

**Sentence structure:**
- Count a few sentences. What's the average length?
- Are there fragments? Run-ons? Compound-complex constructions?
- Is there a dominant pattern, or does it vary deliberately?

**Vocabulary:**
- What's the reading level? Simple words or elevated diction?
- Is there jargon, slang, or period-specific language?
- Are words chosen for precision, sound, or both?

**Tone:**
- What emotion does the prose create in the reader?
- Is the narrator's attitude visible, or is it neutral?
- Is there warmth, distance, irony, urgency?

**Rhythm:**
- Read it aloud. What does it sound like?
- Are there repeated rhythmic patterns?
- How does punctuation affect the flow?

**Figurative language:**
- Are there metaphors, similes, personification?
- How frequent? How elaborate?
- What domains do the comparisons draw from?

**Distinctive features:**
- What makes this passage sound like itself and not generic prose?
- What would you notice if it suddenly changed?

### Step 3: Write the Generation Prompt

This is the most important part of the Seed. The generation prompt translates your style analysis into actionable instructions.

**Guidelines for writing generation prompts:**

- Use direct, imperative language: "Write in..." "Favor..." "Avoid..."
- Be specific about what to do and what not to do
- Include concrete examples where helpful
- Address both what the prose should feel like and how to achieve it mechanically
- Keep it to one focused paragraph (3-8 sentences)

**Example generation prompts:**

For `cold_noir_narration`:
> Write in clipped, declarative sentences. Present tense. The narrator observes without judging but misses nothing. Descriptions are physical and precise — materials, distances, the way light falls. Emotions are shown through action and body language, never named. Dialogue is transactional. Metaphors are drawn from urban decay, machinery, and weather. The rhythm is steady and relentless, like footsteps on wet pavement.

For `lush_southern_gothic`:
> Write in long, winding sentences that accumulate detail like humidity. The prose should feel heavy and alive — overgrown, like the landscape it describes. Favor sensory language: heat, rot, sweetness, the sound of insects. Let sentences sprawl and then snap short for emphasis. The narrator is intimate with the setting, almost complicit. Figurative language is abundant and drawn from nature, religion, and the body. There is beauty in the grotesque and menace in the beautiful.

For `spare_literary_realism`:
> Write in short, clean sentences. Prefer simple words over complex ones. Describe only what can be observed — no interior access unless the POV character is reflecting. Leave emotional interpretation to the reader. Dialogue carries most of the weight. Physical details are few but precisely chosen. White space between paragraphs does work. The prose should feel like looking through clear glass — the style disappears and the reader sees the scene directly.

### Step 4: Save the Seed

Save the completed Seed file with its frontmatter populated:

1. **Fill in the frontmatter.** Set `name`, `category`, `tags`, `mood`, `version: 1`, `created`, and `status: active`. If the Seed is derived from another Seed or influenced by a published author, set `derived_from`.
2. **Leave discovery fields empty for now.** `compatible_with`, `conflicts_with`, `reliability`, `drift_notes`, and `last_tested` get populated after you test and use the Seed. Including the empty fields now means you won't have to retrofit them later.
3. **Choose the right location:**

For project-specific Seeds (character POV voices, section variants):
```
your-novel-project/
├── manuscript/
├── notes/
└── seeds/
    ├── cold_noir_narration.md
    ├── lush_southern_gothic.md
    └── spare_literary_realism.md
```

For Seeds intended for cross-project reuse (house voices, genre Seeds, register Seeds), save them directly to the central library:
```
~/seed-library/house/default_authorial_voice.md
~/seed-library/genre/cold_noir_narration.md
~/seed-library/register/action_sequence_urgency.md
~/seed-library/borrowed/chandler_influenced_noir.md
```

See the **Seed Library** phase for the full library directory structure and catalog system.

### Step 5: Test and Rate the Seed

Before relying on a Seed, test it and record the results:

1. Load the Seed's generation prompt
2. Ask for a short passage (200-300 words) on a topic unrelated to your novel
3. Compare the output to your original sample passage
4. Ask yourself: Does this sound like it belongs in the same book?

**Rate the Seed's reliability** based on your test results:
- **high** — The output consistently matches the intended style across multiple test passages. Minor variations stay within the voice.
- **medium** — The output mostly matches but drifts in predictable ways (e.g., sentences get longer, metaphors multiply). Usable with awareness.
- **low** — The output is inconsistent or only partially captures the voice. Needs prompt refinement before use.

**Update the frontmatter** after testing:
- Set `last_tested` to today's date
- Set `reliability` to your rating
- If you noticed drift patterns, record them in `drift_notes` — these are valuable for refining the generation prompt and for the Seed Library's audit process

If the output drifts from the intended style, refine the generation prompt. Common adjustments:
- Add constraints you forgot ("No exclamation points," "Paragraphs no longer than 3 sentences")
- Remove instructions that are too vague ("Write beautifully" → "Use one metaphor per paragraph, drawn from natural imagery")
- Add negative examples ("Don't summarize emotions — show them through physical sensation")

After refining, re-test and update the reliability rating. A Seed that required multiple refinement rounds isn't necessarily low-reliability — it's one that's been tuned. Update the `## Version History` section if the refinements were significant enough to constitute a new version.

## Workflow: Using a Seed

### Loading a Seed

When you want to generate text in a Seed's style:

1. Open the Seed file
2. Provide the generation prompt as context
3. Describe what you want written (scene, passage, dialogue) along with any relevant story context
4. The output should match the Seed's style profile

### Combining Seeds

You can blend Seeds for scenes that need mixed registers:

- Use one Seed for narration and another for a character's internal voice
- Shift Seeds at chapter boundaries to reflect tonal changes
- Layer a "base" Seed with modifiers ("Use `spare_literary_realism` but increase sensory detail for this scene")

When you find a blend that works, formalize it. The **Seed Library** phase defines a structured blend recipe format with a base Seed, modifier Seeds, explicit adjustments, anti-patterns, and a test passage. Formalizing blends makes them reproducible — ad-hoc blending instructions get interpreted differently each time.

As you combine Seeds, update their frontmatter: add successful pairings to `compatible_with` and note clashes in `conflicts_with`. This compatibility data becomes essential when the library grows large enough that you can't remember every pairing you've tried.

### Evolving Seeds

Seeds aren't static. As your manuscript develops, you may need to:

- Refine the generation prompt based on what's working in the draft
- Create variant Seeds for different sections (e.g., `cold_noir_narration_act_three` with higher emotional intensity)
- Archive Seeds that no longer match the project's direction

When you make significant changes to a Seed, treat it as a new version rather than a silent overwrite:

1. Increment the `version` number in the frontmatter
2. Update `last_updated`
3. Add an entry to the `## Version History` section describing what changed and why
4. Re-test and update `reliability` and `drift_notes`

This version trail matters for series writers — you may need to load an earlier version of a Seed to match a character's voice at a specific point in the series arc. See the **Seed Library** phase for the full versioning workflow and guidance on when to create a separate file vs. a new version.

## Techniques

### The A/B Test
Write the same scene using two different Seeds. Compare the results to understand what each style brings to the material and which serves the story better.

### The Extraction Method
Take a passage from your draft that you love and reverse-engineer a Seed from it. This captures your natural voice at its best, which you can then reproduce consistently.

### The Mentor Seed
Create a Seed based on a published author's style (for your private reference, not publication). Use it to understand what makes that voice work, then evolve it into something distinctly yours. Set `category: borrowed` and `derived_from: {author}_influenced_{quality}` in the frontmatter. The **Seed Library** phase provides a structured five-step graduation path for evolving borrowed Seeds into original ones — from identifying which techniques to keep, through testing against both the borrowed source and your house voice, to graduating the Seed into your personal library.

### The Constraint Seed
Create a Seed defined primarily by restrictions: "No adjectives. No sentences over 8 words. No metaphors. Present tense only." Extreme constraints often produce surprisingly distinctive voices.

## Deliverables

By the end of this phase, you should have:
- At least one Fiction Seed for your novel's primary narrative voice, with frontmatter populated
- Optional additional Seeds for alternate registers (character voices, tonal shifts)
- A `seeds/` directory in your project (and/or Seeds placed in the central `~/seed-library/`)
- Tested Seeds with `reliability` ratings and `last_tested` dates recorded in frontmatter
- `drift_notes` for any Seeds that showed predictable drift patterns during testing
- Initial `compatible_with` and `conflicts_with` entries for any Seeds you've already tried combining

## Connection to Other Phases

- **Style & Tone** — Seeds are the practical, reusable output of your style decisions. The style profile fields map directly to the dimensions defined in that phase.
- **Seed Library** — This phase creates individual Seeds; the Seed Library organizes them at scale. The frontmatter format defined here powers the library's catalog generation, search, compatibility tracking, and agent-driven Seed recommendation. Seeds created here are library-ready from the start.
- **Character Creation** — Character-specific Seeds capture individual narrative voices for multi-POV novels. For series, character Seed evolution tracks alongside character arc development via the Series Continuity integration.
- **Scene Drafting** — Load the appropriate Seed (or blend recipe) before drafting each scene. The Seed Library's Recommendation Map can automate this — the agent reads the project manifest and suggests the right Seed for each chapter.
- **Revision & Editing** — Use Seeds to check tonal consistency across the manuscript. Compare draft passages against their intended Seed's style profile to identify where prose has drifted (Seed Diffing).
- **Series Continuity** — For series writers, Seed versions track alongside character arcs and tonal progression in the series bible. The agent loads the correct Seed version for each book's timeline position.
