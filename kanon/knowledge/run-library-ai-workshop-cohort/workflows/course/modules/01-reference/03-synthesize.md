---
id: "03-synthesize"
title: "Build a Search Concept Map"
estimated_minutes: 15
discovery_moment: false
steps:
  - index: 0
    label: "Draft concepts and synonyms"
    type: "prompt"
    instruction: "Use the research brief from the previous exercise."
    prompt_text: |
      Build a search concept map for the request. Create separate rows for:
      - open-access publishing,
      - public-health research,
      - research reach or use.

      For each row, list keywords, spelling variants, and candidate controlled-vocabulary concepts. Label every controlled term "candidate—verify in the database thesaurus." Do not write database syntax yet.
    checkpoint: "The output separates concepts and does not present candidate subject terms as verified headings."
  - index: 1
    label: "Map ambiguous outcomes"
    type: "prompt"
    instruction: "Prevent the search from collapsing distinct ideas into one metric."
    prompt_text: |
      Split "reach or use" into distinct outcome families: scholarly attention, public attention, policy use, practitioner access, and practical uptake. For each family, suggest observable indicators and one warning about what the indicator cannot prove.
    checkpoint: "The response notes, for example, that downloads do not prove reading or application."
  - index: 2
    label: "Choose source types"
    type: "prompt"
    instruction: "Ask for a source plan, not a list of invented subscriptions."
    prompt_text: |
      Recommend a source plan using categories rather than assuming our subscriptions. Include:
      1. two subject-database categories,
      2. one citation or bibliometric source category,
      3. one policy or gray-literature source category,
      4. one repository or open-discovery route.

      Explain what each contributes and what it may miss. Mark local access as "verify."
    checkpoint: "Each source category has a purpose and a stated limitation."
  - index: 3
    label: "Check the concept map"
    type: "observe"
    instruction: "Review before translating the map into database syntax."
    observe_items:
      - "Synonyms are grouped by concept rather than placed in one long query"
      - "Controlled vocabulary is labeled for database-specific verification"
      - "Outcome indicators are not treated as interchangeable"
      - "The plan includes gray literature and open discovery"
  - index: 4
    label: "Reflect on search design"
    type: "reflect"
    instruction: "A polished AI query can still be conceptually weak."
    reflection_prompt: "Which concept would you test first in a real database, and what would make you revise it?"
---

## Build a Search Concept Map

AI is useful for expanding vocabulary, but search quality depends on concept boundaries and database-specific verification. Build the map first; translate it into each database's syntax later.

## Discussion

- Where did the tool suggest too many synonyms?
- Which terms reflect dominant scholarly language, and which perspectives may be missing?
- How would you document changes after a pilot search?
