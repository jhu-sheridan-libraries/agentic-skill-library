---
id: "04-budget-brief"
title: "Package, Disclose, and Close"
estimated_minutes: 15
discovery_moment: true
steps:
  - index: 0
    label: "Build the handoff package"
    type: "prompt"
    instruction: "Assemble a reusable structure without inventing completed work."
    prompt_text: |
      Create a handoff-package template for this research request with: scoped question, inclusion and exclusion decisions, sources and databases searched, full search strategies, dates searched, result counts, screening notes, evidence matrix, synthesis, limitations, unresolved items, AI-use disclosure, verification record, and librarian contact. Mark all uncompleted sections "pending."
    checkpoint: "The template distinguishes completed, pending, and not-applicable sections."
  - index: 1
    label: "Write the disclosure and methods note"
    type: "prompt"
    instruction: "Describe what the AI tool actually did."
    prompt_text: |
      Draft two short notes:
      1. an AI-use disclosure for the patron, stating which tasks AI assisted and which a librarian verified;
      2. a methods note for another librarian, naming the tool features used, files supplied, external sources enabled, and known reproducibility limits.

      Use placeholders where our workshop did not record a value.
    checkpoint: "The patron note is plain-language; the methods note is operational."
  - index: 2
    label: "Run the final review gate"
    type: "observe"
    instruction: "Confirm the package is safe and accurate to share."
    observe_items:
      - "All material citations and calculations have a recorded verification status"
      - "Search syntax and dates are sufficient for another librarian to rerun"
      - "Private, licensed, or unpublished content is not exposed"
      - "AI assistance is disclosed according to local policy"
      - "Limitations, omissions, and unresolved items are visible"
      - "A named human owns the final review"
  - index: 3
    label: "Clean up the chat"
    type: "workspace"
    instruction: |
      Follow local retention policy. Remove unnecessary uploads and connected-source permissions. Delete the chat or project if the task record does not need to remain in the system; otherwise move the approved record to the designated repository and document the retention period.

      Do not assume deleting a local download deletes cloud copies or provider logs. Use the product's data controls and your institution's approved procedure.
    checkpoint: "The chat or project has been kept or deleted intentionally, and the decision is documented."
  - index: 4
    label: "Reflect on the course"
    type: "reflect"
    instruction: "The durable skill is accountable research support across changing products."
    reflection_prompt: "Which part of this workflow will you adopt, limit, or refuse in your practice, and what evidence will guide that decision?"
---

## Package, Disclose, and Close

A research-support task is not complete when the AI stops generating. Completion requires a usable handoff, transparent methods, meaningful human review, and an intentional retention or deletion decision.

## Discussion

- What belongs in the patron-facing package versus the internal methods record?
- Which artifacts should be retained outside the AI platform?
- What is your first local policy question after this workshop?
