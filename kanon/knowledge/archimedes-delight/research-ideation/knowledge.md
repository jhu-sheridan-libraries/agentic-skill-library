---
name: research-ideation
displayName: Research Ideation
version: 0.1.0
description: >-
  Guided research ideation for the Archimedes Delight collection. Structured
  divergent-thinking methods (SCAMPER, Six Thinking Hats, morphological
  analysis, TRIZ) plus turning observations into testable hypotheses with
  predictions and experiment designs. Domain-neutral. Part of the
  archimedes-delight collection; for literature grounding use literature-review.
keywords:
  - research-ideation
  - archimedes-delight
  - brainstorming
  - hypothesis-generation
  - scamper
  - triz
  - divergent-thinking
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
    - work: "SciAgent-Skills: scientific-brainstorming"
      authors:
        - SciAgent-Skills contributors
      license: CC-BY-4.0
      url: https://github.com/SciAgent-Skills
      relationship: adapted
    - work: "SciAgent-Skills: hypothesis-generation"
      authors:
        - SciAgent-Skills contributors
      license: CC-BY-4.0
      url: https://github.com/SciAgent-Skills
      relationship: adapted
  notice: >-
    Adapted (condensed and made domain-neutral) from the SciAgent-Skills
    scientific-writing skills "scientific-brainstorming" and
    "hypothesis-generation", licensed CC-BY-4.0. Attribution retained.
harness-config:
  kiro:
    format: power
    inclusion: manual
  codex:
    format: skill
---
# Research Ideation

## Overview

Research ideation covers two linked activities: **generating** research ideas
through structured divergent-thinking methods, and **sharpening** them into
testable hypotheses with predictions and an experiment to falsify them. It is a
guided skill (human-in-the-loop) and domain-neutral. It is one member of the
Archimedes Delight collection; once an idea needs grounding in prior work, hand
off to `literature-review`.

Adapted from the SciAgent-Skills `scientific-brainstorming` and
`hypothesis-generation` skills (CC-BY-4.0); see the artifact's attribution.

## Key Concepts

### Divergent-thinking methods

- **SCAMPER** — prompts to transform an existing approach: Substitute, Combine,
  Adapt, Modify, Put-to-other-use, Eliminate, Reverse.
- **Six Thinking Hats** — examine an idea from six deliberate angles (facts,
  feelings, caution, benefits, creativity, process) to avoid one-track analysis.
- **Morphological analysis** — decompose a problem into independent parameters,
  enumerate options per parameter, and explore combinations systematically.
- **TRIZ** — resolve a *technical contradiction* (improving one parameter
  worsens another) with inventive principles (segmentation, extraction, local
  quality, nesting, prior action, dynamization) rather than trial and error; the
  *Ideal Final Result* reveals which constraints are real vs. assumed.

### From observation to hypothesis

A good hypothesis is a testable, falsifiable statement linking variables:

1. **Observation** — the surprising or unexplained thing.
2. **Question** — what about it do you want to explain?
3. **Hypothesis** — a specific, falsifiable proposed answer ("If X, then Y,
   because mechanism M").
4. **Prediction** — a concrete, measurable consequence if the hypothesis holds.
5. **Test** — an experiment or analysis that could show the prediction false.

A hypothesis that no achievable observation could falsify is not yet a
scientific hypothesis — refine it until it makes a risky prediction.

## Decision Framework

```
Where are you?
├── Stuck / one idea only            → SCAMPER (transform what you have)
├── Idea feels one-sided             → Six Thinking Hats (examine all angles)
├── Large design space to explore    → Morphological analysis (parameter grid)
├── A trade-off blocks progress      → TRIZ contradiction + Ideal Final Result
└── Have an observation, need a claim → Observation → Hypothesis → Prediction → Test
```

| Situation | Method | Why |
|---|---|---|
| Improving an existing method | SCAMPER | Systematic transformations of a known baseline |
| Interdisciplinary connections | TRIZ / Adapt | Borrow principles across fields |
| Many combinable factors | Morphological analysis | Covers the combination space, not just obvious pairs |
| Turning a finding into a study | Hypothesis workflow | Forces a falsifiable, testable claim |

## Best Practices

1. **Separate divergence from judgment** — generate first, evaluate later; premature critique kills options.
2. **Make hypotheses falsifiable** — if no result could disprove it, keep refining.
3. **State the mechanism** — "because M" turns a correlation guess into a testable model.
4. **Predict something risky** — a prediction that would be surprising if wrong is more informative.
5. **Design the disconfirming test** — plan the experiment that could falsify the hypothesis, not just confirm it.

## Common Pitfalls

1. **Confirmation-seeking** — only imagining tests that would support the idea.
   - *How to avoid*: explicitly design a test that could falsify it.
2. **Unfalsifiable hypotheses** — vague claims no observation could refute.
   - *How to avoid*: require a measurable prediction before proceeding.
3. **Judging during ideation** — evaluating each idea as it appears.
   - *How to avoid*: timebox divergence; defer evaluation to a separate pass.
4. **Anchoring on the first idea** — stopping at the first plausible option.
   - *How to avoid*: force a quota of alternatives (SCAMPER, morphological grid).
5. **Mechanism-free hypotheses** — "X affects Y" with no proposed why.
   - *How to avoid*: state a candidate mechanism to make the claim testable.

## Further Reading

- [TRIZ overview (Altshuller Institute)](https://www.aitriz.org/) — inventive problem solving
- [Karl Popper on falsifiability](https://plato.stanford.edu/entries/popper/) — the demarcation criterion

## Related Skills

- `literature-review` — ground an idea in what's already known
- `critical-appraisal` — pressure-test the evidence behind a hypothesis
- `manuscript-writing` — turn a tested hypothesis into a paper
- `archimedes-delight` — the collection router
