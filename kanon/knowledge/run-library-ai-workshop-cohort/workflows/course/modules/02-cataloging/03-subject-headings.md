---
id: "03-subject-headings"
title: "Inspect the Source Set"
estimated_minutes: 15
discovery_moment: true
steps:
  - index: 0
    label: "Export a source inventory"
    type: "prompt"
    instruction: "Ask for an auditable table based on the completed report."
    prompt_text: |
      Create a source inventory for every source cited in the report. Include: author or organization, title, year, source type, URL or DOI, outcome family supported, geography, access status, and the exact report claim it supports. Use "unknown" rather than guessing.
    checkpoint: "Every cited source has an identifier and a claim assignment."
  - index: 1
    label: "Open a sample"
    type: "workspace"
    instruction: |
      Select at least five sources, including the report's strongest claim, one policy source, one source from outside North America or Europe if present, and one source that looks weak or surprising.

      Open each link. Confirm that the source exists, the title and date match, and the page supports the cited claim. If you cannot access full text, mark the verification level accordingly.
    checkpoint: "You have independently opened and checked at least five source records."
  - index: 2
    label: "Appraise the sample"
    type: "prompt"
    instruction: "Use the tool to structure—not perform—the final appraisal."
    prompt_text: |
      For the five sources I inspected, create an appraisal checklist with: provenance, study or report method, population or corpus, outcome definition, conflicts or sponsorship, correction or retraction check, relevance to the question, and verification level. Leave cells blank when I have not supplied the evidence.
    checkpoint: "The table does not fill missing appraisal details from model memory."
  - index: 3
    label: "Look for coverage bias"
    type: "prompt"
    instruction: "Ask what the source set may systematically miss."
    prompt_text: |
      Based only on the source inventory, identify coverage imbalances by geography, language, source type, discipline, publisher, and outcome family. Distinguish observed imbalance from speculation about why it occurred. Suggest three targeted searches a librarian could run next.
    checkpoint: "The response separates visible gaps from explanations that require evidence."
  - index: 4
    label: "Reflect on authority"
    type: "reflect"
    instruction: "A linked citation can still be irrelevant, methodologically weak, or misrepresented."
    reflection_prompt: "Which source looked most authoritative at first glance but required the most qualification after inspection?"
---

## Inspect the Source Set

Source verification is more than checking that a URL resolves. Research librarians assess provenance, method, fit, representation, access, and the relationship between a source and the claim assigned to it.

## Discussion

- How did paywalls affect what the tool cited?
- Which voices or regions were absent?
- What should be documented when full text cannot be checked?
