---
id: "02-marc-record"
title: "Review the Research Plan"
estimated_minutes: 15
discovery_moment: false
steps:
  - index: 0
    label: "Request a plan before execution"
    type: "prompt"
    instruction: "Turn on your tool's research mode, but review the plan before allowing the search if the interface supports that control."
    prompt_text: |
      Research this question from research-request.txt: What does evidence published from January 2021 through June 2026 report about how open-access publishing affects the reach and use of public-health research outside universities?

      First show a research plan. Include distinct searches for scholarly citation, public attention, policy use, practitioner access, and practical uptake. Include empirical research, reviews, and credible policy or bibliometric reports. Do not treat downloads as proof of use. Do not cite a source you cannot open.
    checkpoint: "A plan or visible search approach separates the five outcome families."
    facilitator_note: "Some interfaces expose an editable plan; others begin searching. If no plan is shown, ask the learner to pause or interrupt and request one."
  - index: 1
    label: "Add librarian revisions"
    type: "prompt"
    instruction: "Revise the plan before or during the run."
    prompt_text: |
      Revise the plan to:
      - include evidence from low- and middle-income countries where available,
      - search for null or mixed findings as well as benefits,
      - distinguish author self-archiving from publisher-provided open access,
      - record databases or websites searched and important access failures.

      Show the revised plan before continuing.
    checkpoint: "The revised plan addresses geographic, publication-model, and reporting bias."
  - index: 2
    label: "Run the research"
    type: "workspace"
    instruction: |
      Start or continue the research. If your tool allows progress review or interruption, inspect the activity and redirect it if it drifts from the plan.

      When the report finishes, keep the report and source list open. Do not export or share it yet.
    checkpoint: "You have a cited report and can open its source list or citation links."
  - index: 3
    label: "Compare plan with execution"
    type: "observe"
    instruction: "Check whether the system did what the plan promised."
    observe_items:
      - "Each outcome family appears in the report or is named as a gap"
      - "Null or mixed evidence is visible"
      - "Source types are not limited to news summaries"
      - "Search locations and access failures are documented where the interface permits"
  - index: 4
    label: "Reflect on control"
    type: "reflect"
    instruction: "A research plan is useful only if it can be inspected and corrected."
    reflection_prompt: "What did you change in the plan that the tool would not have done on its own?"
---

## Review the Research Plan

Some GUI research modes show an editable plan; others reveal their approach through progress or activity views. In either case, intervene before a polished report hides weak scope decisions.

## Discussion

- Which elements of the search are reproducible?
- What does the activity view omit compared with a database search log?
