# Fiction Seeds

## Overview

A Fiction Seed is a language generator — a captured writing style distilled into a reusable prompt. You write a passage (or identify one that captures the voice you want), extract its stylistic DNA, and save it as a Seed. Later, you reload that Seed to generate more language in the same style and tone.

Seeds are useful for:
- Maintaining a consistent voice across long manuscripts
- Switching between narrative registers (e.g., a character's internal monologue vs. action sequences)
- Experimenting with different styles before committing
- Returning to a project after time away and quickly re-entering the voice

## Seed File Format

Seeds are stored as markdown files in a `seeds/` directory within your project. Each Seed file follows this structure:

```markdown
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
```

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
- **An existing work** — A passage from a published novel that represents your target voice (for reference only — the Seed captures the style, not the content)

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

Save the completed Seed file to your project's `seeds/` directory:

```
your-novel-project/
├── manuscript/
├── notes/
└── seeds/
    ├── cold_noir_narration.md
    ├── lush_southern_gothic.md
    └── spare_literary_realism.md
```

### Step 5: Test the Seed

Before relying on a Seed, test it:

1. Load the Seed's generation prompt
2. Ask for a short passage (200-300 words) on a topic unrelated to your novel
3. Compare the output to your original sample passage
4. Ask yourself: Does this sound like it belongs in the same book?

If the output drifts from the intended style, refine the generation prompt. Common adjustments:
- Add constraints you forgot ("No exclamation points," "Paragraphs no longer than 3 sentences")
- Remove instructions that are too vague ("Write beautifully" → "Use one metaphor per paragraph, drawn from natural imagery")
- Add negative examples ("Don't summarize emotions — show them through physical sensation")

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

### Evolving Seeds

Seeds aren't static. As your manuscript develops, you may need to:

- Refine the generation prompt based on what's working in the draft
- Create variant Seeds for different sections (e.g., `cold_noir_narration_act_three` with higher emotional intensity)
- Archive Seeds that no longer match the project's direction

## Techniques

### The A/B Test
Write the same scene using two different Seeds. Compare the results to understand what each style brings to the material and which serves the story better.

### The Extraction Method
Take a passage from your draft that you love and reverse-engineer a Seed from it. This captures your natural voice at its best, which you can then reproduce consistently.

### The Mentor Seed
Create a Seed based on a published author's style (for your private reference, not publication). Use it to understand what makes that voice work, then evolve it into something distinctly yours.

### The Constraint Seed
Create a Seed defined primarily by restrictions: "No adjectives. No sentences over 8 words. No metaphors. Present tense only." Extreme constraints often produce surprisingly distinctive voices.

## Deliverables

By the end of this phase, you should have:
- At least one Fiction Seed for your novel's primary narrative voice
- Optional additional Seeds for alternate registers (character voices, tonal shifts)
- A `seeds/` directory in your project
- Tested Seeds that reliably reproduce the intended style

## Connection to Other Phases

- **Style & Tone** — Seeds are the practical, reusable output of your style decisions
- **Character Creation** — Character-specific Seeds can capture individual voices for dialogue
- **Scene Drafting** — Load the appropriate Seed before drafting each scene
- **Revision & Editing** — Use Seeds to check tonal consistency across the manuscript
