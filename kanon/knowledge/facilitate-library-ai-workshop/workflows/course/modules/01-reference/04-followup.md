---
id: "04-followup"
title: "Draft a Transparent Patron Handoff"
estimated_minutes: 15
discovery_moment: true
steps:
  - index: 0
    label: "Draft a consultation follow-up"
    type: "prompt"
    instruction: "Turn the scoped work into a concise patron-facing message."
    prompt_text: |
      Draft a 180-220 word follow-up email to the faculty member. Summarize how the question has been scoped, list the next three librarian actions, identify the ambiguity we still need them to resolve, and offer a non-AI consultation path. Do not claim that a search has already been completed.
    checkpoint: "The email is clear about what has and has not happened."
  - index: 1
    label: "Add an AI-use disclosure"
    type: "prompt"
    instruction: "Practice concise, locally adaptable disclosure."
    prompt_text: |
      Add one plain-language sentence disclosing that the AI tool used in this workshop helped organize the de-identified request and that a librarian will verify the search strategy and sources. Do not name a product unless local policy requires it.
    checkpoint: "The disclosure is specific about AI's limited role and human review."
  - index: 2
    label: "Run the send gate"
    type: "observe"
    instruction: "Review the message as if it were going to a real patron."
    observe_items:
      - "No private or identifying details were added"
      - "No sources, searches, or access rights were invented"
      - "The researcher can correct the scope"
      - "AI assistance and librarian review are described accurately"
      - "A human or non-AI option is available"
  - index: 3
    label: "Create a task record"
    type: "prompt"
    instruction: "Keep a compact record for reproducibility."
    prompt_text: |
      Create a task record with: date, files supplied, connected sources used, web research on/off, decisions made, unresolved questions, outputs created, and human reviewer. Use "not used" or "not yet assigned" where appropriate.
    checkpoint: "The record distinguishes inputs, settings, decisions, and review responsibility."
  - index: 4
    label: "Reflect on transparency"
    type: "reflect"
    instruction: "Disclosure should inform the patron, not shift responsibility to them."
    reflection_prompt: "What level of AI-use disclosure does your institution require, and where should it appear?"
---

## Draft a Transparent Patron Handoff

ALA's June 2026 guidance calls for clear disclosure, meaningful human review, and a path to human assistance. A useful handoff makes the work visible without overstating what AI or the librarian has completed.

## Discussion

- What would make a disclosure informative rather than performative?
- Who is accountable if an AI-assisted search brief is wrong?
- How long should the task record be retained?
