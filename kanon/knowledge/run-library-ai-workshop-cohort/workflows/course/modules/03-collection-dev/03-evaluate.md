---
id: "03-evaluate"
title: "Synthesize Disagreement and Gaps"
estimated_minutes: 15
discovery_moment: true
steps:
  - index: 0
    label: "Draft a cautious synthesis"
    type: "prompt"
    instruction: "Use the matrix, not the original topic, as the evidence base."
    prompt_text: |
      Draft a 180-word synthesis using only the claim-evidence matrix. Organize by outcome type rather than source. State where the records point in the same direction, where outcomes are not comparable, and where verification gaps prevent a conclusion. Refer to source IDs in brackets.
    checkpoint: "The synthesis does not turn five incomplete records into a field-wide consensus."
  - index: 1
    label: "Generate an alternative reading"
    type: "prompt"
    instruction: "Test the stability of the narrative."
    prompt_text: |
      Write the strongest plausible alternative interpretation of the same matrix. Do not contradict the records; show how different weighting of geography, outcome definitions, or verification status could change the emphasis.
    checkpoint: "The alternative reading is evidence-constrained, not contrarian for its own sake."
  - index: 2
    label: "Map the gaps"
    type: "prompt"
    instruction: "Turn limitations into next research actions."
    prompt_text: |
      Create a gap map with four categories: missing populations or regions, missing outcome measures, missing study designs, and verification gaps. For each gap, suggest one next search or appraisal action and state whether it requires the web, a licensed database, or human subject expertise.
    checkpoint: "Next steps are matched to appropriate research resources."
  - index: 3
    label: "Check the synthesis"
    type: "observe"
    instruction: "Look for narrative overreach."
    observe_items:
      - "Agreement is not claimed across incomparable outcomes"
      - "A global conclusion is not drawn from geographically narrow evidence"
      - "Unverified records are not used as decisive evidence"
      - "The alternative interpretation remains grounded in the same data"
  - index: 4
    label: "Reflect on synthesis"
    type: "reflect"
    instruction: "Smooth prose can conceal methodological conflict."
    reflection_prompt: "Which caveat is essential for the intended reader, and which details belong in a methods note?"
---

## Synthesize Disagreement and Gaps

Responsible synthesis preserves distinctions among outcome definitions, populations, methods, and verification levels. Asking for an alternative evidence-constrained reading can reveal how much the narrative depends on weighting choices.

## Discussion

- When does an alternative interpretation improve rigor?
- How can a librarian communicate uncertainty without making the synthesis unusable?
