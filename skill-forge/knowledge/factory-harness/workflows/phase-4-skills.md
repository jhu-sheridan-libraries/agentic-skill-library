Generate the skills the agents use. A skill captures *how* the work is done;
the agent captures *who* does it.

## 4-0. Dedup First

Check existing skills for overlap before creating a new one. Generalize a
near-duplicate rather than adding a parallel skill.

## 4-1. Structure

```
skill-name/
├── SKILL.md            (required — YAML frontmatter: name, description; then body)
└── references/         (optional — conditionally loaded detail)
    scripts/            (optional — deterministic helper code)
    assets/             (optional — templates, images used in output)
```

## 4-2. Description — Trigger Aggressively

`description` is the only trigger mechanism, and models judge triggers
conservatively, so write it to be pushy. State what the skill does **and**
concrete trigger situations, including follow-up phrasings ("re-run", "update
just the X", "improve the previous result"). Distinguish it from near-miss
skills that should not fire.

Bad: `"A skill that processes PDFs."`
Good: `"Read, extract, merge, split, watermark, OCR — every PDF operation.
Use whenever a .pdf is mentioned or a PDF deliverable is requested."`

## 4-3. Body Principles

- **Why over what** — give reasons, not bare `ALWAYS/NEVER`. A model that understands the reason handles edge cases.
- **Lean** — target < 500 lines; move weight to `references/`.
- **Generalize** — teach the principle, avoid overfitting to one example.
- **Bundle repeated code** — if agents keep writing the same helper, ship it in `scripts/`.
- **Imperative voice** — "do X", "prefer Y".

## 4-4. Progressive Disclosure

Metadata (name + description, always loaded) → SKILL.md body (on trigger) →
`references/` (on demand). Add a table of contents to references over ~300
lines. Split framework/domain variants into separate reference files so only
the relevant one loads.

## 4-5. Skill ↔ Agent Linking

One agent uses 1..N skills; a skill may be shared by several agents. Skills
hold *how*; agents hold *who*.

## Output

- Specialist skills, an optional orchestrator skill, and progressive-disclosure references.
