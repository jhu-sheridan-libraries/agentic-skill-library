---
id: "01-orient"
title: "Choose Chat, Search, or Research Mode"
estimated_minutes: 15
discovery_moment: false
steps:
  - index: 0
    label: "Locate the research controls"
    type: "workspace"
    instruction: |
      In your AI tool, locate ordinary chat, web search, and any deep-research or Researcher control available to your account. Also locate source-selection controls.

      Keep connected email, drives, calendars, and organizational repositories off. The public web and the supplied workshop files are sufficient.
    checkpoint: "You know which modes and source controls are available in your account."
  - index: 1
    label: "Classify three tasks"
    type: "prompt"
    instruction: "Ask the tool to recommend a mode, then evaluate its recommendation."
    prompt_text: |
      Classify each task as ordinary chat, quick web search, or deep research. Explain the trade-off in one sentence.
      A. Rephrase a paragraph I supplied.
      B. Confirm the current title and URL of an ALA policy.
      C. Map 2021-June 2026 evidence across several outcome types and source families.

      Do not perform the tasks yet.
    checkpoint: "The response chooses chat for transformation, search for the current fact, and research for the multi-source map."
  - index: 2
    label: "Define the evidence boundary"
    type: "prompt"
    instruction: "Prepare the long-form research task."
    prompt_text: |
      Before researching the request in research-request.txt, propose an evidence boundary: included source types, excluded source types, date range, geography, outcomes, preferred domains or publishers, and known coverage limitations. Do not start research yet.
    checkpoint: "The boundary is explicit enough for a librarian to revise."
  - index: 3
    label: "Evaluate the mode choice"
    type: "observe"
    instruction: "Check the proposed setup."
    observe_items:
      - "The task needs multiple searches and synthesis rather than a quick answer"
      - "The source boundary includes scholarly and policy evidence"
      - "Connected private sources remain off"
      - "The output will be treated as an environmental scan, not a systematic review"
  - index: 4
    label: "Reflect on sufficiency"
    type: "reflect"
    instruction: "More compute and more sources are not automatically better."
    reflection_prompt: "When would a database search by a librarian be faster, safer, or more defensible than deep research?"
---

## Choose Chat, Search, or Research Mode

Use the smallest mode that fits the task. Longer-running research is appropriate for exploratory, multi-source work; it does not replace licensed databases, controlled indexing, or documented review methods.

## Discussion

- Which tasks in your work do not need generative AI at all?
- How do product limits or account tiers affect equitable access?
