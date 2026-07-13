---
id: "02-strategic-plan"
title: "Translate and Test Search Syntax"
estimated_minutes: 15
discovery_moment: false
steps:
  - index: 0
    label: "Create a concept-line strategy"
    type: "prompt"
    instruction: "Return to the concept map from Module 1."
    prompt_text: |
      Convert the concept map into a platform-neutral line-by-line strategy. Use one numbered line per concept, OR within concept lines, AND between concepts, quotation marks only for true phrases, and explicit placeholders for controlled vocabulary. Keep date, language, and document-type limits outside the concept logic.
    checkpoint: "The logic is readable before database-specific syntax is added."
  - index: 1
    label: "Translate for one database"
    type: "prompt"
    instruction: "Choose a database your institution provides and name it in the prompt."
    prompt_text: |
      Translate the platform-neutral strategy for [DATABASE AND INTERFACE]. Create a syntax checklist for field codes, phrase searching, truncation, proximity, controlled vocabulary, date limits, and export behavior. Mark every element "verify in current database help" and do not claim the syntax is valid until tested.
    checkpoint: "The output separates a draft translation from verified syntax."
  - index: 2
    label: "Test in the database"
    type: "workspace"
    instruction: |
      Open the real database interface. Verify syntax in current help, run each concept line separately, record result counts and errors, then combine lines. Revise terms based on indexing and retrieved records.

      Do not paste licensed full text or patron data into an AI chat unless your library has cleared the tool for that material.
    checkpoint: "You have a tested strategy and a record of changes made in the database."
  - index: 3
    label: "Create a translation log"
    type: "prompt"
    instruction: "Document what the AI draft could not establish."
    prompt_text: |
      Create a search translation log with: database and interface, date searched, draft line, tested line, result count, error or unexpected behavior, change made, reason, and reviewer initials. Leave unknown values blank for me to complete.
    checkpoint: "The log supports rerunning and peer review."
  - index: 4
    label: "Reflect on reproducibility"
    type: "reflect"
    instruction: "A syntactically valid query may still retrieve the wrong literature."
    reflection_prompt: "Which revisions came from database testing rather than AI suggestion, and how will you preserve them?"
---

## Translate and Test Search Syntax

AI can draft translations across database interfaces, but current help, thesauri, test searches, and retrieved records remain the authority. Document every material change.

## Discussion

- Which syntax elements are most likely to be hallucinated?
- How would a peer reviewer reproduce your final search?
