---
id: "02-selection"
title: "Build a Claim-Evidence Matrix"
estimated_minutes: 15
discovery_moment: false
steps:
  - index: 0
    label: "Create the matrix"
    type: "prompt"
    instruction: "Keep uncertainty visible at row level."
    prompt_text: |
      Using only evidence-notes.csv, create a claim-evidence matrix with one row per source. Include source ID, source type, year, geography, reported outcome, what the record may support, what it cannot support, verification status, and next verification action. Quote no text that is not in the file.
    checkpoint: "Each row includes both a possible use and a limitation."
  - index: 1
    label: "Separate outcome from proxy"
    type: "prompt"
    instruction: "Make measurement assumptions explicit."
    prompt_text: |
      Add a column classifying each reported outcome as direct evidence of use, a proxy for attention or access, or unclear. Explain each classification in no more than 15 words and do not upgrade downloads or citations into practical use.
    checkpoint: "The matrix distinguishes attention and access proxies from direct use."
  - index: 2
    label: "Prioritize verification"
    type: "prompt"
    instruction: "Use risk and relevance, not convenience."
    prompt_text: |
      Rank the five records for verification priority. Use three criteria: importance to the research question, risk of misinterpretation, and current verification status. Show the score for each criterion and explain any tie.
    checkpoint: "The unverified citation and easily overstated outcomes rank high."
  - index: 3
    label: "Review the matrix"
    type: "observe"
    instruction: "Check whether the table supports responsible synthesis."
    observe_items:
      - "No row contains invented bibliographic details"
      - "Verification status is preserved"
      - "Outcomes and proxies are distinguished"
      - "Priority reflects evidentiary risk, not just publication date"
  - index: 4
    label: "Reflect on traceability"
    type: "reflect"
    instruction: "A matrix makes it easier to revise one claim without rewriting everything."
    reflection_prompt: "Which additional columns would your team need for a scoping review, grant scan, or research guide?"
---

## Build a Claim-Evidence Matrix

The matrix is the bridge between source notes and narrative. It preserves the origin, status, and limits of each claim so later prose can be audited.

## Discussion

- What information belongs at the source level versus the claim level?
- When should the matrix be maintained outside the AI tool?
