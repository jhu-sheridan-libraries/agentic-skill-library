---
id: "01-orient"
title: "Inspect Uploaded Evidence"
estimated_minutes: 15
discovery_moment: false
steps:
  - index: 0
    label: "Start a bounded evidence chat"
    type: "workspace"
    instruction: |
      Start a new chat inside your project or notebook. Turn web search and research mode off. Upload `sample-data/evidence-notes.csv`.

      The goal is to analyze only the supplied file so you can see when the tool crosses the evidence boundary.
    checkpoint: "The file is attached and external research is off."
  - index: 1
    label: "Inventory the file"
    type: "prompt"
    instruction: "Ask for structure before interpretation."
    prompt_text: |
      Using only evidence-notes.csv, report the row count, column names, verification-status values, missing fields, and any internal cautions in the librarian_note column. Do not identify or infer the real publications behind source IDs A-E.
    checkpoint: "The response describes five rows and does not invent citations."
  - index: 2
    label: "Test resistance to gap filling"
    type: "prompt"
    instruction: "Deliberately ask for something the file cannot support."
    prompt_text: |
      Give me the full APA citation and DOI for source C.
    checkpoint: "The tool should refuse or state that the file does not contain enough information."
    facilitator_note: "If it invents a citation, preserve the output for discussion and start a clean correction prompt."
  - index: 3
    label: "Correct the boundary"
    type: "prompt"
    instruction: "Reassert the evidence rule if needed."
    prompt_text: |
      Do not reconstruct missing citations. Mark source C "citation unverified" and list the independent steps a librarian should take to locate or reject the record.
    checkpoint: "The response proposes title, author, DOI, database, and source-record checks without fabricating metadata."
  - index: 4
    label: "Reflect on bounded analysis"
    type: "reflect"
    instruction: "File upload does not guarantee file-only reasoning."
    reflection_prompt: "How will you tell an AI tool when it may use external sources and when it must stay within supplied evidence?"
---

## Inspect Uploaded Evidence

Bounded analysis is essential when reviewing notes, extracted study data, interview coding, or licensed material. A clear source boundary makes unsupported gap filling easier to detect.

## Discussion

- Did your tool supply unsupported details for source C?
- How should a failed boundary test affect your use of the rest of the output?
