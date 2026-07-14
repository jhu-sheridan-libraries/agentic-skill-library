---
id: "04-usage-analysis"
title: "Analyze Data Without Hiding Assumptions"
estimated_minutes: 15
discovery_moment: true
steps:
  - index: 0
    label: "Upload and profile the data"
    type: "workspace"
    instruction: |
      Start a new bounded chat and upload `sample-data/usage-report.csv`. Keep web research off. Ask the tool to show a data preview before calculating.
    checkpoint: "You can see the columns, row count, and any missing or unusual values."
  - index: 1
    label: "Request transparent calculations"
    type: "prompt"
    instruction: "Require formulas and row-level evidence."
    prompt_text: |
      Analyze usage-report.csv. Show the formula for every derived metric. Identify the three highest values for Total Item Requests, calculate the Investigations-to-Requests ratio for each title, and flag zero-request rows. Return a compact table plus three data-quality cautions. Do not recommend cancellation.
    checkpoint: "The output shows formulas and separates description from a collection decision."
  - index: 2
    label: "Spot-check the arithmetic"
    type: "workspace"
    instruction: |
      Choose at least three rows, including a zero or extreme value. Recalculate the ratios with a calculator or spreadsheet. Compare them with the AI output.

      Record any rounding, divide-by-zero, missing-value, or column-selection error.
    checkpoint: "At least three calculations have been independently checked."
  - index: 3
    label: "Challenge the interpretation"
    type: "prompt"
    instruction: "Ask for competing explanations and missing decision data."
    prompt_text: |
      For each flagged pattern, give at least two plausible explanations. Then list data needed before a renewal decision, including multi-year trends, cost, access model, turnaways, interlibrary loan, curriculum relevance, and known reporting changes. Distinguish measured facts from hypotheses.
    checkpoint: "Low use is not treated as a complete cancellation argument."
  - index: 4
    label: "Reflect on data review"
    type: "reflect"
    instruction: "A correct calculation can still support a weak decision."
    reflection_prompt: "Which part of this analysis requires domain expertise rather than arithmetic, and who should review it?"
---

## Analyze Data Without Hiding Assumptions

Spreadsheet analysis is useful when the tool shows its calculations and you independently spot-check them. Interpretation still depends on reporting definitions, local context, and decision criteria outside the file.

## Discussion

- Which calculated pattern was easiest to overinterpret?
- What evidence would make the analysis decision-ready?
- When should analysis move to a spreadsheet or statistical tool?
