---
id: "04-abstract"
title: "Audit Claims and Citations"
estimated_minutes: 15
discovery_moment: false
steps:
  - index: 0
    label: "Create a claim-citation ledger"
    type: "prompt"
    instruction: "Turn the report into an audit object."
    prompt_text: |
      Break the report into material factual claims. For each claim, list its cited source or sources and assign one status: supported, partly supported, unsupported, citation inaccessible, or not yet checked. Do not mark a claim supported unless I have told you I opened the source and confirmed it.
    checkpoint: "Unchecked claims remain explicitly unchecked."
  - index: 1
    label: "Check citation identity"
    type: "workspace"
    instruction: |
      For each sampled citation, compare author or organization, title, venue, year, DOI or URL, and publication type with the landing page or authoritative record.

      Search the DOI or exact title independently when a link redirects, fails, or points to a secondary account.
    checkpoint: "Citation metadata are confirmed or discrepancies are recorded."
  - index: 2
    label: "Check claim entailment"
    type: "prompt"
    instruction: "Ask the tool to explain the evidentiary gap without substituting confidence for proof."
    prompt_text: |
      For each claim marked partly supported or unsupported, explain the smallest accurate revision that the checked source would support. Preserve distinctions among association, causation, reach, access, attention, and use.
    checkpoint: "Revisions narrow claims instead of adding new evidence."
  - index: 3
    label: "Run the release gate"
    type: "observe"
    instruction: "Decide whether the report is ready to leave the chat."
    observe_items:
      - "Material claims have checked citations or are labeled provisional"
      - "Quotations and numerical values match the source"
      - "Inaccessible citations are not presented as verified"
      - "Coverage gaps and search limits are visible"
      - "The report is labeled an exploratory scan, not a systematic review"
  - index: 4
    label: "Reflect on cited AI"
    type: "reflect"
    instruction: "Citations make verification possible; they do not complete it."
    reflection_prompt: "What proportion of the report would you need to verify before using it in a consultation, guide, or grant-support deliverable?"
---

## Audit Claims and Citations

The key question is not “Does the report have citations?” It is “Does each material claim accurately represent an identifiable, appropriate source?” This exercise creates a repeatable release gate.

## Discussion

- Which errors are easiest to miss in a polished cited report?
- When is sampling sufficient, and when is full verification required?
