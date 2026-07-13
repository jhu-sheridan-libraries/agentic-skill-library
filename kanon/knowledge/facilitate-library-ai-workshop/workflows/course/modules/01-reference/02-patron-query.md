---
id: "02-patron-query"
title: "Turn a Request into a Research Brief"
estimated_minutes: 15
discovery_moment: true
steps:
  - index: 0
    label: "Extract what is known"
    type: "prompt"
    instruction: "Ask the tool to structure the supplied request without answering it."
    prompt_text: |
      Convert research-request.txt into a research brief with these headings:
      Decision or use; Population or context; Core concept; Outcomes; Date range; Geography; Evidence types; Access needs; Known ambiguities; Missing information.

      Use only the file. Mark missing information as "ask the researcher" rather than guessing.
    checkpoint: "The brief distinguishes supplied facts from missing information."
  - index: 1
    label: "Generate reference-interview questions"
    type: "prompt"
    instruction: "Now ask for questions a librarian could actually use."
    prompt_text: |
      Draft five concise follow-up questions for the faculty member. Prioritize questions whose answers would materially change the search strategy. For each, add a short note explaining what search decision it affects.
    checkpoint: "The questions address outcome definitions, intended use, disciplinary scope, and acceptable evidence."
  - index: 2
    label: "Audit the questions"
    type: "observe"
    instruction: "Evaluate the proposed interview."
    observe_items:
      - "Questions do not ask for information already in the request"
      - "Questions avoid collecting unnecessary personal or sensitive data"
      - "At least one question distinguishes scholarly citation from policy or practical use"
      - "The librarian, not the AI, decides which questions to ask"
  - index: 3
    label: "Handle a high-risk variation"
    type: "prompt"
    instruction: "Test whether the tool recognizes a privacy boundary."
    prompt_text: |
      Suppose I offer to upload the faculty member's full email thread, unpublished grant draft, and a spreadsheet containing collaborator names. Explain which items should not be uploaded under WORKSPACE-BRIEF.md and propose a de-identified alternative that preserves the information needed for search planning.
    checkpoint: "The response recommends data minimization instead of accepting the files."
  - index: 4
    label: "Reflect on professional judgment"
    type: "reflect"
    instruction: "AI can organize a question, but it cannot conduct the relational work of a reference interview."
    reflection_prompt: "Which follow-up question requires the most librarian judgment, and why?"
---

## Turn a Request into a Research Brief

Research requests often arrive as topics, while good searches are built around decisions, concepts, outcomes, constraints, and acceptable evidence. This exercise uses AI for question decomposition while keeping the librarian responsible for scope and consent.

## Discussion

- Which missing detail would change the search most?
- How can a structured brief improve handoffs among research-support staff?
- What should never be inferred from a patron's request?
