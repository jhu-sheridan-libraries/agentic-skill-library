---
name: figure-preparation
displayName: Figure Preparation
version: 0.1.0
description: >-
  Guided figure and schematic preparation for the Archimedes Delight collection.
  A domain-neutral QA checklist for publication figures (resolution, formats,
  color, fonts, panel labels, accessibility), a consolidated view of common
  journal requirements, and design principles for schematics and graphical
  abstracts. Part of the archimedes-delight collection.
keywords:
  - figure-preparation
  - archimedes-delight
  - scientific-figures
  - graphical-abstract
  - accessibility
  - schematics
author: Steven J. Miklovic
type: skill
inclusion: manual
categories:
  - writing
harnesses:
  - kiro
  - claude-code
  - codex
  - copilot
  - cursor
  - gemini-cli
ecosystem:
  - science
depends: []
enhances: []
maturity: experimental
model-assumptions: []
collections:
  - archimedes-delight
inherit-hooks: false
outcomes: []
attribution:
  upstream:
    - work: "SciAgent-Skills: general-figure-guide and journal figure guides"
      authors:
        - HITS
        - SciAgent-Skills contributors
      license: CC-BY-4.0
      url: https://github.com/SciAgent-Skills
      relationship: adapted
    - work: "SciAgent-Skills: scientific-schematics"
      authors:
        - SciAgent-Skills contributors
      license: CC-BY-4.0
      url: https://github.com/SciAgent-Skills
      relationship: adapted
  notice: >-
    Consolidated and adapted (condensed, made domain-neutral) from the
    SciAgent-Skills scientific-writing figure guides (general and journal-
    specific) and "scientific-schematics", licensed CC-BY-4.0. Journal-specific
    numbers are summarized as ranges; always confirm the target venue's current
    author guidelines. Attribution retained.
harness-config:
  kiro:
    format: power
    inclusion: manual
  codex:
    format: skill
---
# Figure Preparation

## Overview

This guided skill helps prepare publication-quality figures and schematics: a
QA checklist that catches the common defects, a consolidated summary of what
journals typically require, and design principles for illustrative (non-data)
figures and graphical abstracts. It is domain-neutral and is one member of the
Archimedes Delight collection. Journal specifics change — always confirm the
target venue's current author guidelines before final export.

Consolidated and adapted from the SciAgent-Skills figure guides and
`scientific-schematics` (CC-BY-4.0); see the artifact's attribution.

## Key Concepts

### QA checklist (any figure, before submission)

- **Legibility** — no overlapping or clipped labels; minimum ~8 pt font at
  final print size.
- **Completeness** — axes labelled with units; legend present; sample sizes and
  statistical annotations shown.
- **Not overcrowded** — one clear message per panel; split dense panels.
- **Self-contained caption** — defines all abbreviations, units, n, and error
  measures so the figure stands alone.
- **Error bars named** — state SD (spread), SEM (precision), or 95% CI
  (significance); prefer 95% CI, since non-overlapping CIs suggest a difference.
- **Accessibility** — color-blind-safe palette (e.g. viridis, blue-orange);
  readable in grayscale; don't encode meaning by color alone.

### Common journal requirements (confirm before submission)

Journal rules vary, but they cluster around a few axes. Treat these as typical
ranges, not authoritative values:

| Axis | Typical range / options |
|---|---|
| Resolution | 300–1200 DPI (line art higher than halftone) |
| Vector formats | EPS, PDF, AI, SVG (preferred for graphs) |
| Raster formats | TIFF, high-quality PNG (for images/photos) |
| Color model | RGB for online; some venues still request CMYK for print |
| Fonts | sans-serif (Arial/Helvetica) common; embed or outline |
| Panel labels | single letters; case and style vary by venue |
| Column widths | single- vs double-column templates (mm) |

Many venues run automated image-integrity screening and treat selective
enhancement (splicing, gamma changes without disclosure) as misconduct.

### Schematics and graphical abstracts

For illustrative (not data-driven) figures — pathway diagrams, mechanism
schematics, workflows, graphical abstracts:

- **One idea, left-to-right or top-to-bottom flow** — guide the eye.
- **Consistent visual language** — one shape/color convention per entity type,
  used the same way throughout.
- **Legible standalone** — the abstract should convey the finding without the
  paper.
- **Tools** — vector editors (Inkscape, Affinity, Illustrator) or diagramming
  tools; source icons you have the right to use.

## Decision Framework

```
What kind of figure?
├── Data figure (plot)        → run the QA checklist; export vector (PDF/EPS/SVG)
├── Image / micrograph        → high-DPI TIFF; no selective enhancement; disclose any adjustment
├── Multi-panel               → consistent scale/labels across panels; balanced layout
└── Schematic / graphical abstract → flow + consistent visual language; standalone message
```

## Best Practices

1. **Design figures before writing** — they are the data-story backbone.
2. **Export vector for graphs** — PDF/EPS/SVG scale without pixelation.
3. **Confirm the venue's guidelines** — resolution, format, color, and label rules differ.
4. **Make every figure standalone** — caption carries units, n, and error measure.
5. **Design for color-blind and grayscale** — never rely on hue alone.
6. **Disclose any image adjustment** — gamma/contrast changes must be reported; never splice.

## Common Pitfalls

1. **Raster graphs** — pixelated line art at print size.
   - *How to avoid*: export vector formats for plots.
2. **Color-only encoding** — meaning lost for color-blind readers / in grayscale.
   - *How to avoid*: add shape/pattern/label redundancy; use safe palettes.
3. **Unlabelled error bars** — reader can't tell SD from SEM from CI.
   - *How to avoid*: state the measure in the caption.
4. **Overcrowded panels** — too many series in one plot.
   - *How to avoid*: split into panels; one message each.
5. **Undisclosed image manipulation** — enhancement flagged as misconduct.
   - *How to avoid*: keep originals; disclose adjustments; never splice lanes/fields.

## Further Reading

- [Points of View (Nature Methods figure column)](https://www.nature.com/collections/qghhqm/pointsofview) — figure design essays
- [ColorBrewer](https://colorbrewer2.org/) — color-blind-safe palettes

## Related Skills

- `manuscript-writing` — where figures fit in the manuscript
- `research-presentation` — figures for slides and posters
- `archimedes-delight` — the collection router
