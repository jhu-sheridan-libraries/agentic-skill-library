---
name: critical-appraisal
description: "Guided critical appraisal of scientific evidence for the Archimedes Delight collection. Study-design hierarchy, effect measures (RR/OR/HR/NNT/Cohen's d), bias types, confounding, p-value vs effect size, and GRADE quality assessment. Domain-neutral. Part of the archimedes-delight collection; use when reading a paper or assessing a claim's strength."
---

# Critical Appraisal

## Overview

Critical appraisal is the disciplined evaluation of whether a study's design,
analysis, and interpretation actually support its conclusions. It is what
separates synthesizing evidence from merely accumulating it. This guided,
domain-neutral skill covers the evidence hierarchy, effect measures, bias
mechanics, the p-value/effect-size distinction, and GRADE grading. It is one
member of the Archimedes Delight collection; the `literature-review` agent's
triage step draws on the same concepts.

Adapted from the SciAgent-Skills `scientific-critical-thinking` skill
(CC-BY-4.0); see the artifact's attribution.

## Key Concepts

### Study-design hierarchy (for causal questions)

```
Systematic reviews / meta-analyses of RCTs   (highest causal certainty)
  → Randomized controlled trials
  → Non-randomized / cluster-randomized trials
  → Prospective cohort
  → Retrospective cohort
  → Case-control
  → Cross-sectional
  → Case series / case reports
  → Expert opinion, mechanistic reasoning     (lowest causal certainty)
```

Exceptions matter: for **rare outcomes**, case-control is often more efficient;
for **diagnostic accuracy**, cross-sectional/cohort designs with a verified
reference standard beat randomized ones; for **harm**, large cohorts may be the
best feasible evidence.

### Effect measures

| Measure | Use case | Interpretation |
|---|---|---|
| Risk Ratio (RR) | cohort, RCT | RR 2.0 = twice the risk |
| Odds Ratio (OR) | case-control, logistic regression | approximates RR only when outcome is rare (<10%) |
| Hazard Ratio (HR) | survival analysis | HR 0.7 = 30% lower hazard per time unit |
| Number Needed to Treat (NNT) | clinical decisions | NNT 20 = treat 20 to prevent 1 event |
| Absolute Risk Reduction (ARR) | real-world impact | ARR 2% = 2 percentage-point drop |
| Cohen's d | continuous outcomes | 0.2 small, 0.5 medium, 0.8 large |

**Common error:** reporting only the *relative* risk reduction. A drop from 2%
to 1% is a 50% relative reduction but only 1% absolute (NNT 100). Always ask for
the absolute measure.

### Bias (systematic, not fixed by larger samples)

- **Selection bias** — those studied differ systematically from those not
  (healthy-worker effect, loss to follow-up, volunteer bias).
- **Information bias** — systematic measurement error (recall bias, observer
  bias); check for blinding and validated instruments.
- **Confounding** — a variable tied to both exposure and outcome, creating a
  spurious or masked association; check for adjustment/matching.

### p-value vs significance

A p-value is the probability of data at least this extreme if the null were
true — not the probability the hypothesis is false, and not a measure of effect
size. A tiny p with a trivial effect is statistically but not practically
meaningful. Always read the effect size and its confidence interval alongside p.

### GRADE

GRADE rates the *certainty* of a body of evidence (high → moderate → low → very
low), starting from design and downgrading for risk of bias, inconsistency,
indirectness, imprecision, and publication bias.

## Decision Framework

```
What are you appraising?
├── A causal claim        → place the design on the hierarchy; check confounding
├── An effect's magnitude → read absolute measure + CI, not just relative/p
├── A surprising result   → scan for selection/information bias first
└── A body of evidence    → apply GRADE (start at design, downgrade for flaws)
```

## Best Practices

1. **Match claim to design** — an observational study supports association, not causation.
2. **Read the absolute effect and its CI** — relative measures and bare p-values mislead.
3. **Look for the confounder** — ask what third variable could explain the association.
4. **Check for blinding and validated measures** — the main defense against information bias.
5. **Grade the whole body, not one study** — one RCT is not the literature.

## Common Pitfalls

1. **Treating a small p as a large effect.**
   - *How to avoid*: always report and read the effect size + CI.
2. **Accepting relative risk reduction alone.**
   - *How to avoid*: convert to absolute risk reduction / NNT.
3. **Assuming correlation is causation from observational data.**
   - *How to avoid*: locate the design on the hierarchy; look for confounding.
4. **Ignoring attrition/selection.**
   - *How to avoid*: compare included vs excluded; inspect loss to follow-up.
5. **Over-weighting a single dramatic study.**
   - *How to avoid*: appraise the body of evidence with GRADE.

## Further Reading

- [GRADE working group](https://www.gradeworkinggroup.org/) — certainty-of-evidence framework
- [Catalogue of Bias](https://catalogofbias.org/) — bias definitions and examples

## Related Skills

- `literature-review` — the autonomous agent whose triage step applies these criteria
- `peer-review` — structured evaluation of a manuscript's rigor
- `manuscript-writing` — report statistics and claims honestly
- `archimedes-delight` — the collection router
---

## Sources & credits
- **SciAgent-Skills: scientific-critical-thinking** — SciAgent-Skills contributors [adapted] (CC-BY-4.0) — https://github.com/SciAgent-Skills
Adapted (condensed and made domain-neutral) from the SciAgent-Skills scientific-writing skill "scientific-critical-thinking", licensed CC-BY-4.0. Attribution retained.