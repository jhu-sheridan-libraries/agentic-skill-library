---
name: research-presentation
description: "Guided research presentation for the Archimedes Delight collection. Slide and poster design for conferences, seminars, defenses, and pitches — talk structure, timing, slide/data-viz design, poster layout, accessibility, and QA. Domain-neutral. Part of the archimedes-delight collection; for figures use figure-preparation."
---

# Research Presentation

## Overview

This guided skill helps build research talks and posters — for conferences,
seminars, thesis defenses, and grant pitches. It covers talk structure and
timing, slide and data-visualization design, poster layout, accessibility, and a
QA pass. It is domain-neutral and is one member of the Archimedes Delight
collection; for the figures that go on the slide or poster, use
`figure-preparation`.

Adapted from the SciAgent-Skills `scientific-slides` and `latex-research-posters`
skills (CC-BY-4.0); see the artifact's attribution.

## Key Concepts

### Talk structure

A research talk is a narrative, not a paper read aloud: motivation → question →
approach → key results → takeaway. Lead with why it matters; end with one
sentence the audience should remember. Budget roughly one slide per minute and
rehearse to the actual time limit.

### Slide design

- **One idea per slide** — a clear title that states the point, not the topic.
- **Minimal text** — talking points, not paragraphs; the speaker carries detail.
- **Large, legible type** — readable from the back of the room.
- **Data viz for a room** — bigger fonts, fewer series, and highlighted
  takeaways versus a print figure; reuse `figure-preparation` output but simplify.

### Poster layout

- **Readable flow** — columns, clear section heading order, a visible path
  through the content.
- **Legible at distance** — title readable from several meters; body from ~1–2 m.
- **Figure-forward** — the poster is mostly visuals with concise captions, not
  dense prose.
- **LaTeX options** — `beamerposter`, `tikzposter`, or `baposter` for
  reproducible, templated layouts.

### Accessibility

Color-blind-safe palettes, high text/background contrast, and no meaning encoded
by color alone — the same discipline as `figure-preparation`, applied to slides
and posters.

## Bundled Templates

This skill ships ready-to-compile LaTeX templates under `workflows/`, so you can
start from a working scaffold rather than a blank file. They are adapted from
SciAgent-Skills (CC-BY-4.0; see the artifact's attribution).

**Slides** (`workflows/slide-templates/`):

| File | Use for |
|---|---|
| `beamer_template_conference.tex` | 10–20 min conference talk (16:9) |
| `beamer_template_seminar.tex` | 30–60 min seminar |
| `beamer_template_defense.tex` | thesis defense |
| `slide_design_guide.md` | slide design reference |
| `talk_types_guide.md` | structure by talk type and length |
| `timing_guidelines.md` | timing/pacing per talk length |

**Posters** (`workflows/poster-templates/`):

| File | Use for |
|---|---|
| `beamerposter_template.tex` | poster via the `beamerposter` package |
| `tikzposter_template.tex` | poster via the `tikzposter` package |
| `baposter_template.tex` | poster via the `baposter` package |

Pick the template that matches the format, then adapt content, color scheme, and
figures (from `figure-preparation`) to the venue's requirements. Compile with
`pdflatex`/`lualatex` as noted in each template's header.

## Decision Framework

```
What are you presenting?
├── Conference talk (10–15 min)  → tight narrative; ~1 slide/min; one takeaway
├── Seminar / defense (30–60 min)→ fuller arc; backup slides for Q&A
├── Lightning talk (3–5 min)     → one result, one slide of setup, one takeaway
└── Poster                       → figure-forward columns; readable at distance
```

## Best Practices

1. **Design the narrative first** — outline the story before making slides.
2. **One point per slide** — title states the point; visuals support it.
3. **Rehearse to time** — cut to fit; never plan to rush the last slides.
4. **Simplify figures for the room/poster** — bigger, fewer elements, highlighted takeaway.
5. **Prepare for Q&A** — backup slides for likely questions.
6. **Keep it accessible** — contrast, safe palettes, no color-only meaning.

## Common Pitfalls

1. **Text-wall slides** — paragraphs the audience reads instead of listening.
   - *How to avoid*: talking points only; move detail to speech or backup slides.
2. **Reused print figures** — too small/dense for a room or poster.
   - *How to avoid*: enlarge fonts, cut series, highlight the takeaway.
3. **No clear takeaway** — audience leaves unsure of the point.
   - *How to avoid*: end on one memorable sentence.
4. **Over-running time** — rushing or getting cut off.
   - *How to avoid*: rehearse to the limit; trim early.
5. **Poster as a wall of text** — unreadable at distance.
   - *How to avoid*: figure-forward layout, concise captions, large title.

## Further Reading

- [Better Posters](https://betterposters.blogspot.com/) — poster design practice
- [beamerposter](https://ctan.org/pkg/beamerposter) — LaTeX poster package

## Related Skills

- `figure-preparation` — the figures that go on slides and posters
- `manuscript-writing` — the written counterpart of the talk
- `archimedes-delight` — the collection router

## Reference Pointers

Load these only when the workflow calls for them (progressive disclosure):

- `references/poster-templates/baposter_template.tex` — Poster Templates Baposter_template
- `references/poster-templates/beamerposter_template.tex` — Poster Templates Beamerposter_template
- `references/poster-templates/tikzposter_template.tex` — Poster Templates Tikzposter_template
- `references/slide-templates/beamer_template_conference.tex` — Slide Templates Beamer_template_conference
- `references/slide-templates/beamer_template_defense.tex` — Slide Templates Beamer_template_defense
- `references/slide-templates/beamer_template_seminar.tex` — Slide Templates Beamer_template_seminar
- `references/slide-templates/slide_design_guide.md` — Slide Templates Slide_design_guide
- `references/slide-templates/talk_types_guide.md` — Slide Templates Talk_types_guide
- `references/slide-templates/timing_guidelines.md` — Slide Templates Timing_guidelines
---

## Sources & credits
- **SciAgent-Skills: scientific-slides** — SciAgent-Skills contributors [adapted] (CC-BY-4.0) — https://github.com/SciAgent-Skills- **SciAgent-Skills: latex-research-posters** — SciAgent-Skills contributors [adapted] (CC-BY-4.0) — https://github.com/SciAgent-Skills
Adapted (condensed and made domain-neutral) from the SciAgent-Skills scientific-writing skills "scientific-slides" and "latex-research-posters", licensed CC-BY-4.0. Attribution retained.