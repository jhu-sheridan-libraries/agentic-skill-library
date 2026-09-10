---
name: manuscript-writing
displayName: Manuscript Writing
version: 0.1.0
description: >-
  Guided scholarly-manuscript writing for the Archimedes Delight research
  collection. Domain-neutral guidance on IMRAD structure, citation styles,
  reporting guidelines, figure/table design principles, and venue adaptation.
  Part of the archimedes-delight collection; for citation formatting use
  citation-management, for figures use figure-preparation.
keywords:
  - manuscript-writing
  - archimedes-delight
  - academic-writing
  - imrad
  - reporting-guidelines
  - scholarly-publishing
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
    - work: "SciAgent-Skills: scientific-manuscript-writing"
      authors:
        - HITS
        - SciAgent-Skills contributors
      license: CC-BY-4.0
      url: https://github.com/SciAgent-Skills
      relationship: adapted
  notice: >-
    Adapted (condensed and made domain-neutral) from the SciAgent-Skills
    scientific-writing skill "scientific-manuscript-writing", licensed
    CC-BY-4.0. Attribution to the original authors is retained.
harness-config:
  kiro:
    format: power
    inclusion: manual
  codex:
    format: skill
---
# Manuscript Writing

## Overview

Manuscript writing is the craft of communicating research with precision,
clarity, and reproducibility. This guided skill covers the manuscript lifecycle
— planning and structuring with IMRAD, applying a citation style, designing
figures and tables, and meeting reporting standards — and applies across
disciplines (computational, physical, social, and biomedical). It is one member
of the Archimedes Delight collection; for reference formatting use
`citation-management`, and for figure preparation use `figure-preparation`.

Adapted from the SciAgent-Skills `scientific-manuscript-writing` skill
(CC-BY-4.0); see the artifact's attribution.

## Key Concepts

### Writing principles

Three pillars govern manuscript text:

- **Clarity** — precise, unambiguous language; define terms at first use;
  logical flow; active voice where it helps.
- **Conciseness** — the fewest words that carry the meaning; cut filler
  ("in order to" → "to"); strong verbs over noun-verb phrases.
- **Accuracy** — exact values at appropriate precision; consistent terminology;
  observations distinguished from interpretations; text that matches tables and
  figures.

### IMRAD structure

IMRAD (Introduction, Methods, Results, and Discussion) is the standard shape for
original research articles.

| Section | Question | Primary tense |
|---|---|---|
| Title | What is this about? | — |
| Abstract | Complete summary | mixed |
| Introduction | Why did you study this? | present/past |
| Methods | How did you do it? | past |
| Results | What did you find? | past |
| Discussion | What does it mean? | past/present |
| Conclusion | Take-home message | present |

The Introduction funnels from broad context to the specific gap and objectives.
Methods must allow replication. Results state findings without interpretation.
Discussion interprets, compares to prior work, and states limitations.

### Citation systems

| Style | Form | Typical disciplines |
|---|---|---|
| AMA | superscript numbers | medicine, health |
| Vancouver | bracketed numbers [1] | biomedical |
| APA | author-date (Smith, 2023) | psychology, social science |
| Chicago | notes or author-date | humanities |
| IEEE | bracketed numbers [1] | engineering, CS |

The target venue's author guidelines decide the style. For setting up a
reference workflow and formatting, hand off to `citation-management`.

### Reporting guidelines

Match the guideline to the study type early — during design, not after writing:
CONSORT (trials), STROBE (observational), PRISMA (systematic reviews), ARRIVE
(animal studies), STARD (diagnostic accuracy), TRIPOD (prediction models),
SPIRIT (protocols), CARE (case reports). Use the checklist while drafting.

## Decision Framework

```
What are you writing?
├── Original research
│   ├── Trial            → IMRAD + CONSORT
│   ├── Observational    → IMRAD + STROBE
│   ├── Diagnostic       → IMRAD + STARD
│   ├── Prediction model → IMRAD + TRIPOD
│   └── ML / CS          → Intro–Method–Experiments–Conclusion
├── Review
│   ├── Systematic       → PRISMA
│   ├── Meta-analysis    → PRISMA + forest plots
│   └── Narrative        → thematic structure
├── Case report          → CARE
└── Protocol             → SPIRIT
```

| Venue | Structure | Citation | Adaptation |
|---|---|---|---|
| Broad-science (Nature/Science) | modified IMRAD, methods in supplement | numbered superscript | accessible, story-driven, broad significance |
| Medical | strict IMRAD | Vancouver/AMA | structured abstracts, CONSORT/STROBE |
| Field journals | standard IMRAD | field default | full technical detail |
| ML conferences | Intro–Method–Experiments–Conclusion | numbered or author-year | numbered contributions, ablations |

## Best Practices

1. **Write the abstract last** — synthesize the key message in 100–250 words with quantitative results.
2. **Plan figures before prose** — design the display items as the data story; write Methods → Results → Discussion → Introduction.
3. **One idea per paragraph** — topic sentence, evidence, transition; 3–7 sentences.
4. **Report statistics completely** — point estimate, variability (SD/SEM/CI), n, test statistic, exact p-value, effect size.
5. **Follow the reporting guideline from the start** — use its checklist while drafting, not after.
6. **Match style to venue** — read 3–5 recent papers from the target journal and mirror their conventions.
7. **Verify citation–reference correspondence** — every in-text citation has a reference entry and vice versa.

## Common Pitfalls

1. **Overstating conclusions beyond the evidence** (causation from observational data).
   - *How to avoid*: hedge appropriately ("is associated with"); match claim strength to design.
2. **Inconsistent terminology** (switching words for one concept).
   - *How to avoid*: one term per concept; keep a terminology list.
3. **Mixing verb tenses** inappropriately across sections.
   - *How to avoid*: apply the section tense rules; review for tense in revision.
4. **Insufficient methods detail** for reproducibility (missing n, software versions, test justifications).
   - *How to avoid*: use the reporting-guideline checklist to catch omissions.
5. **Figures that don't stand alone** (captions missing units, n, definitions).
   - *How to avoid*: make each display item self-explanatory; see `figure-preparation`.

## Further Reading

- [EQUATOR Network](https://www.equator-network.org/) — reporting guidelines index
- [ICMJE Recommendations](https://www.icmje.org/) — authorship and manuscript conduct

## Related Skills

- `citation-management` — choose a reference manager and format references
- `figure-preparation` — figure/table design and journal figure requirements
- `critical-appraisal` — evaluate the evidence you cite
- `archimedes-delight` — the collection router
