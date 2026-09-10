---
name: methodology-design
displayName: Methodology Design
version: 0.1.0
description: >-
  Guided research-methodology design for the Archimedes Delight collection.
  Domain-neutral guidance on letting the research question drive the method —
  a methodology decision tree by question type, a paradigm table, method and
  data-strategy selection, validity/reliability criteria, EQUATOR
  reporting-guideline mapping, preregistration guidance, and lightweight IRB
  navigation. Part of the archimedes-delight collection; to form the question
  first use research-ideation, to write it up use manuscript-writing.
keywords:
  - methodology-design
  - archimedes-delight
  - research-methods
  - study-design
  - paradigm
  - validity
  - equator
  - preregistration
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
    - work: "academic-research-skills: research_architect_agent"
      authors:
        - academic-research-skills contributors
      license: CC-BY-4.0
      url: https://github.com/stevenjmiklovic/academic-research-skills
      relationship: adapted
  notice: >-
    Adapted (domain substance only, pipeline machinery removed) from the
    academic-research-skills research_architect_agent, licensed CC-BY-4.0. The
    replay-validated IRB authority gates, cross-model design-freeze checkpoints,
    and phase-boundary fences were deliberately not ported; only a lightweight
    IRB navigation pointer is retained. Attribution to the original authors is
    retained.
harness-config:
  kiro:
    format: power
    inclusion: manual
  codex:
    format: skill
---
# Methodology Design

## Overview

Methodology design is the craft of choosing *how* to answer a research question
— the paradigm, method, data strategy, analytical framework, and validity
criteria — so that every choice traces back to the question rather than to
habit or fashion. This guided skill is human-in-the-loop and domain-neutral. It
is one member of the Archimedes Delight collection; to form or sharpen the
question first, use `research-ideation`; to write the study up, use
`manuscript-writing`.

Adapted from the academic-research-skills `research_architect_agent`
(CC-BY-4.0); see the artifact's attribution.

## Key Concepts

### Question drives method

The research question determines the methodology, never the reverse. A design
chosen because it is popular, or because the tools are already at hand, is a
design in search of a question. Before selecting anything, classify the question
by what it asks:

- **Descriptive** — "What is happening?"
- **Comparative** — "How does X compare to Y?"
- **Correlational** — "Is X related to Y?"
- **Causal** — "Does X cause Y?"
- **Phenomenological** — "How do people experience X?"
- **Evaluative** — "Is policy or program X effective?"

### Research paradigm

A paradigm makes your philosophical assumptions explicit — what you take reality
to be (ontology) and how you claim to know it (epistemology). Naming it keeps
the rest of the design coherent.

| Paradigm | Ontology | Epistemology | Best for |
|---|---|---|---|
| Positivist | Objective reality | Observable, measurable | Causal, correlational |
| Interpretivist | Socially constructed | Understanding meaning | Phenomenological, exploratory |
| Pragmatist | What works | Mixed methods | Complex, applied problems |
| Critical | Power structures | Emancipatory knowledge | Policy, equity research |

### Method, data, and analysis

- **Method.** Qualitative (interviews, focus groups, document analysis,
  ethnography), quantitative (surveys, experiments, statistical modeling), or
  mixed (sequential explanatory, convergent parallel, embedded).
- **Data strategy.** Primary (what to collect, from whom, with what sampling
  rationale and sample size), secondary (which databases, datasets, archives,
  time periods), or both (with an integration plan).
- **Analytical framework.** Techniques matched to the data type — coding schemes
  for qualitative data, statistical tests for quantitative — specified in
  advance, not chosen after seeing the results.

### Validity and reliability

Build quality criteria into the design; do not bolt them on afterward. The
criteria differ by paradigm.

| Tradition | Quality criteria |
|---|---|
| Quantitative | Internal validity, external validity, reliability, objectivity |
| Qualitative | Credibility, transferability, dependability, confirmability |
| Mixed | Integration validity, inference quality, inference transferability |

### Reporting guidelines, preregistration, and ethics

- **EQUATOR reporting guidelines.** Pick the guideline that matches the design
  *at the design stage*, so the study is reportable from the start.

  | Research design | Reporting guideline |
  |---|---|
  | Systematic review | PRISMA 2020 |
  | Randomized controlled trial | CONSORT 2010 |
  | Observational study | STROBE |
  | Qualitative research | COREQ |
  | Quality-improvement study | SQUIRE 2.0 |

- **Preregistration.** Strongly recommended for confirmatory work, RCTs,
  multiple-comparison studies, and systematic reviews; recommended for secondary
  analyses and replications; not required for purely exploratory, qualitative,
  or theoretical work. Register systematic reviews on PROSPERO and everything
  else on the OSF Registries.
- **Human-subjects ethics (lightweight navigation).** When the study touches
  human subjects — surveys, interviews, experiments, or personal-data analysis —
  record the facts a review office will need (population, recruitment, consent
  approach, data handling and retention) and note that **the pathway is an
  institutional determination**. This skill points you toward that
  determination; it does not make it. Ask your IRB or ethics office for the
  applicable pathway and its current timeline rather than assuming one.

## Decision Framework

```
Research question type
├── "What is happening?" (descriptive)        → survey / case study / content analysis
├── "How does X compare to Y?" (comparative)  → comparative case study / cross-sectional / benchmarking
├── "Is X related to Y?" (correlational)      → correlational / regression / meta-analysis
├── "Does X cause Y?" (causal)                → experiment / quasi-experiment / longitudinal
├── "How do people experience X?" (phenom.)   → phenomenology / grounded theory / narrative inquiry
└── "Is policy X effective?" (evaluative)     → program evaluation / cost-benefit / policy analysis
```

| Question type | Typical paradigm | Method family | Reporting guideline |
|---|---|---|---|
| Descriptive | Positivist / Interpretivist | Survey, case study | STROBE (quant) / COREQ (qual) |
| Comparative | Positivist | Comparative, cross-sectional | STROBE |
| Correlational | Positivist | Regression, meta-analysis | STROBE / PRISMA |
| Causal | Positivist | Experiment, quasi-experiment | CONSORT |
| Phenomenological | Interpretivist | Grounded theory, narrative | COREQ |
| Evaluative | Pragmatist | Program evaluation, mixed | SQUIRE 2.0 |

## Best Practices

1. **Justify every choice from the question** — write one sentence per component (paradigm, method, data, analysis) tying it to the research question.
2. **Name the paradigm explicitly** — state the ontology and epistemology so the design's assumptions are visible and coherent.
3. **Pick the reporting guideline at the design stage** — choose PRISMA/CONSORT/STROBE/COREQ/SQUIRE before data collection and use its checklist while designing.
4. **Preregister confirmatory work** — lodge hypotheses and the analysis plan on PROSPERO (reviews) or OSF (everything else) before looking at outcomes.
5. **Design the validity criteria in** — match credibility/transferability (qualitative) or internal/external validity (quantitative) to the paradigm and plan how each is secured.
6. **State limitations by design** — name the known limitations and their mitigations up front rather than discovering them at write-up.
7. **Route human-subjects questions to the institution** — record the review-relevant facts and treat the pathway as an institutional determination, not a self-assessment.

## Common Pitfalls

1. **Method-first design** — choosing a familiar method and then bending the question to fit it.
   - *How to avoid*: classify the question type first, then let the decision tree propose the method family.
2. **Silent paradigm** — leaving ontological and epistemological assumptions implicit, so validity criteria don't match the method.
   - *How to avoid*: name the paradigm explicitly and select its matching quality criteria.
3. **Reporting guideline chosen after writing** — retrofitting PRISMA or CONSORT once the study is done and finding gaps too late.
   - *How to avoid*: map the design to its EQUATOR guideline at the design stage and design to its checklist.
4. **Skipping preregistration on confirmatory work** — leaving room for undisclosed analytic flexibility.
   - *How to avoid*: preregister hypotheses and the analysis plan on OSF or PROSPERO before data collection.
5. **Treating the IRB pathway as self-decidable** — declaring a study "exempt" or "expedited" without the institution.
   - *How to avoid*: record the facts a review office needs and route the determination to your IRB; never assume the pathway.
6. **Validity as an afterthought** — planning quality checks only at analysis time.
   - *How to avoid*: specify the validity/reliability strategy for each criterion inside the blueprint, before collecting data.

## Further Reading

- [EQUATOR Network](https://www.equator-network.org/) — index of reporting guidelines by study design
- [OSF Registries](https://osf.io/registries) — preregistration for most study types
- [PROSPERO](https://www.crd.york.ac.uk/prospero/) — preregistration for systematic reviews

## Related Skills

- `research-ideation` — form and sharpen the question before designing the study
- `evidence-synthesis` — integrate prior evidence that informs the design
- `manuscript-writing` — report the completed study against its reporting guideline
- `archimedes-delight` — the collection router
