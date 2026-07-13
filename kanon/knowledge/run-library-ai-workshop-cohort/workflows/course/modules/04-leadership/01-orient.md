---
id: "01-orient"
title: "Design a Reproducible Workflow"
estimated_minutes: 15
discovery_moment: false
steps:
  - index: 0
    label: "Map the workflow"
    type: "prompt"
    instruction: "Use the workshop request as a realistic example."
    prompt_text: |
      Design an AI-assisted workflow for the research request in research-request.txt. Use these stages: intake, privacy review, question scoping, concept mapping, database selection, syntax translation, test searches, source screening, evidence extraction, synthesis, citation audit, patron handoff, and chat cleanup.

      For each stage, name the input, output, whether AI is optional, required human expertise, and a stop or escalation condition.
    checkpoint: "The workflow includes human-only decisions and explicit stop conditions."
  - index: 1
    label: "Define meaningful review"
    type: "prompt"
    instruction: "Make review operational rather than symbolic."
    prompt_text: |
      For the workflow above, define meaningful human review: who reviews, what they inspect, when review occurs, what evidence they need, and whether they may correct, reject, or escalate the output. Distinguish a routine reference scan from a systematic review search.
    checkpoint: "Review authority and required expertise scale with task risk."
  - index: 2
    label: "Add a non-AI path"
    type: "prompt"
    instruction: "The workflow must work if the patron or librarian declines AI."
    prompt_text: |
      Create an equivalent non-AI path for this request using a reference interview, database thesauri, search logs, a spreadsheet evidence matrix, and librarian-authored synthesis. Identify what changes in time, documentation, and privacy exposure.
    checkpoint: "The non-AI path is viable, not framed as a failure or inferior service."
  - index: 3
    label: "Review the workflow"
    type: "observe"
    instruction: "Check alignment with professional practice."
    observe_items:
      - "AI is optional at multiple stages"
      - "Private data are excluded unless the specific use is approved"
      - "Search and appraisal decisions remain with qualified people"
      - "Stop conditions include unsupported claims, privacy risk, and scope drift"
      - "The patron retains access to human assistance"
  - index: 4
    label: "Reflect on adoption"
    type: "reflect"
    instruction: "Choosing limited use or non-use can be a responsible professional decision."
    reflection_prompt: "Which stage would you pilot first, and what evidence would determine whether to continue?"
---

## Design a Reproducible Workflow

A reusable workflow defines where AI may help and where professional judgment is mandatory. It also makes non-use, rejection, and escalation normal outcomes.

## Discussion

- Which stage carries the highest risk of deskilling?
- What would you measure in a pilot besides time saved?
