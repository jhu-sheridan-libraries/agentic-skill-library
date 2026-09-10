---
name: peer-review
displayName: Peer Review
version: 0.1.0
description: >-
  Guided peer review for the Archimedes Delight collection. A structured
  seven-stage evaluation of manuscripts and proposals — initial assessment,
  section review, statistical rigor, reproducibility, figure integrity, ethics,
  writing — plus reporting-standard checks and review-report structure.
  Domain-neutral. Part of the archimedes-delight collection; for evidence
  quality use critical-appraisal.
keywords:
  - peer-review
  - archimedes-delight
  - manuscript-review
  - reproducibility
  - reporting-standards
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
    - work: "SciAgent-Skills: peer-review-methodology"
      authors:
        - SciAgent-Skills contributors
      license: CC-BY-4.0
      url: https://github.com/SciAgent-Skills
      relationship: adapted
  notice: >-
    Adapted (condensed and made domain-neutral) from the SciAgent-Skills
    scientific-writing skill "peer-review-methodology", licensed CC-BY-4.0.
    Attribution retained.
harness-config:
  kiro:
    format: power
    inclusion: manual
  codex:
    format: skill
---
# Peer Review

## Overview

Peer review is a systematic evaluation of a manuscript or proposal, ending in a
structured report with actionable feedback. This guided, domain-neutral skill
walks the full cycle: initial assessment, section-by-section review, statistical
rigor, reproducibility, figure integrity, ethics, and writing quality. It is one
member of the Archimedes Delight collection; for judging the strength of the
evidence itself, use `critical-appraisal`.

Adapted from the SciAgent-Skills `peer-review-methodology` skill (CC-BY-4.0);
see the artifact's attribution.

## Key Concepts

### Comment severity

- **Major** — affects validity, interpretability, or significance; must be
  addressed (design flaws, unsupported conclusions, missing controls).
- **Minor** — improves clarity/completeness without affecting core validity
  (unclear labels, missing method detail, wording).
- **Questions for authors** — where the reviewer cannot judge without more
  information.

### Reporting standards quick check

| Standard | Applies to | Key check |
|---|---|---|
| CONSORT | randomized trials | flow diagram, randomization, blinding, ITT |
| STROBE | observational studies | design, participants, variables, bias |
| PRISMA | systematic reviews / meta-analyses | search strategy, PICO, risk of bias |
| ARRIVE | animal research | species, sample size, randomization, 3Rs |

### The seven stages

1. **Initial assessment** — scope fit, novelty, obvious fatal flaws; decide whether to review.
2. **Section review** — Introduction (gap and rationale), Methods (replicability), Results (claims match data), Discussion (interpretation within limits).
3. **Statistical rigor** — appropriate tests, assumptions checked, complete reporting (n, effect size, CI, exact p).
4. **Reproducibility** — data/code availability, sufficient method detail, versions.
5. **Figure integrity** — figures support the claims, no manipulation, captions self-contained.
6. **Ethics** — approvals, consent, conflicts, AI-use disclosure.
7. **Writing** — clarity, structure, and whether the abstract matches the paper.

## Decision Framework

```
What are you reviewing?
├── Original research      → full 7-stage workflow
├── Review / meta-analysis → emphasize Stage 2 (Intro+Methods) + Stage 4
├── Methods paper          → emphasize Stage 3 (rigor) + Stage 4 (reproducibility)
├── Short communication    → abbreviated (Stages 1, 2, 3, 7)
└── Proposal               → significance, innovation, feasibility, team
```

| Situation | Focus | Time budget |
|---|---|---|
| First-round review | all 7 stages, full detail | 4–8 h |
| Revision re-review | only whether prior concerns were addressed | 1–2 h |
| Internal feedback | Stages 1–3, 7 | 2–4 h |

## Best Practices

1. **Separate major from minor** — label every comment so authors know what's blocking.
2. **Be specific and actionable** — cite the line/figure and say what would fix it.
3. **Check claims against data** — verify each conclusion is supported by a result.
4. **Verify reporting completeness** — use the applicable standard's checklist.
5. **Be constructive and civil** — critique the work, not the authors; note strengths too.

## Common Pitfalls

1. **Vague comments** ("the methods are weak").
   - *How to avoid*: point to the specific gap and the fix.
2. **Conflating style with substance** — rejecting on wording, not validity.
   - *How to avoid*: sort comments into major (validity) vs minor (clarity).
3. **Skipping reproducibility** — not checking data/code/version availability.
   - *How to avoid*: make Stage 4 a required pass.
4. **Missing figure manipulation** — accepting figures at face value.
   - *How to avoid*: inspect for splicing, selective enhancement; check captions.
5. **Scope creep** — demanding a different paper than the one submitted.
   - *How to avoid*: review the study that was done, within its stated scope.

## Further Reading

- [COPE guidelines](https://publicationethics.org/) — publication and review ethics
- [EQUATOR Network](https://www.equator-network.org/) — reporting-standard checklists

## Related Skills

- `critical-appraisal` — evaluate the strength of the evidence a paper presents
- `manuscript-writing` — the authoring counterpart to review
- `archimedes-delight` — the collection router
