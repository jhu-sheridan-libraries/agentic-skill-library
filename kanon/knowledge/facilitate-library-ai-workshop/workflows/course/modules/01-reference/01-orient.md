---
id: "01-orient"
title: "Set Up Your AI Tool"
estimated_minutes: 15
discovery_moment: false
steps:
  - index: 0
    label: "Open your AI tool"
    type: "workspace"
    instruction: |
      Open the graphical AI tool your library is using for the workshop. Start a new **project**, **workspace**, or **notebook** if that feature is available; otherwise start a new chat.

      Find the controls for file uploads, web or research mode, connected sources, chat history or memory, and deletion. Do not connect email, cloud storage, or other institutional systems for this exercise.
    checkpoint: "You can identify what the tool may access and where its privacy or data controls are located."
    facilitator_note: "Do not require everyone to use the same product. Ask learners to describe capabilities, not menu names."
  - index: 1
    label: "Apply the data-minimization gate"
    type: "observe"
    instruction: "Before uploading anything, check the proposed content."
    observe_items:
      - "The workshop request is simulated and contains no patron identifiers"
      - "No reference transcript, reading history, student record, unpublished manuscript, or licensed full text will be uploaded"
      - "Your library allows this tool for the workshop"
      - "A non-AI path remains available"
    reflection_prompt: "Which real materials from your work would fail this gate?"
  - index: 2
    label: "Add the standing brief"
    type: "workspace"
    instruction: |
      Add `WORKSPACE-BRIEF.md` as project or notebook instructions, project knowledge, or an uploaded file. Upload `sample-data/research-request.txt` in the same project or chat.

      If your tool offers only chat, attach both files to the first message. Product-specific shortcuts are optional; use the visible upload control.
    checkpoint: "Both files are visible in the project or attached to the chat."
  - index: 3
    label: "Test grounding"
    type: "prompt"
    instruction: "Paste this prompt."
    prompt_text: |
      Using only WORKSPACE-BRIEF.md and research-request.txt, list:
      1. the requested deliverable,
      2. two privacy or evidence rules that govern this work, and
      3. one ambiguity that must be clarified before searching.

      Cite the file name after each answer. Do not add facts from model memory or the web.
    checkpoint: "The response cites the supplied files and identifies the ambiguity around the meaning of reach."
  - index: 4
    label: "Reflect on the boundary"
    type: "reflect"
    instruction: "An AI chat can feel private even when it uses cloud services, memory, or connected data."
    reflection_prompt: "What would you need to confirm with your institution before using this setup with a real consultation?"
---

## Set Up Your AI Tool

GUI AI tools now share a common pattern: a conversation area, file uploads, optional standing instructions, optional connected sources, and web or research modes. The responsible first move is to identify the data boundary—not to select the most capable model.

## Discussion

- Which controls were easy or hard to find in your tool?
- What does a project or notebook retain after the task ends?
- When is a fresh chat safer than a persistent project?
