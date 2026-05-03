# ALICE CLI — Research Prompt Recipes

Prompt patterns for common academic and library research tasks using ALICE.

## Paper Summarization

```bash
# Summarize a single paper
alice summarize paper.pdf

# Summarize from stdin
cat abstract.txt | alice summarize -

# Use a cheaper model for bulk summarization
alice summarize paper.pdf --model-id haiku
```

**Effective prompts for invoke:**

```bash
# Structured summary
alice invoke "Summarize this paper in three sections: (1) Research question, (2) Methods, (3) Key findings. Paper: <paste abstract>"

# Executive summary for non-specialists
alice invoke "Write a 3-sentence plain-language summary of this research suitable for a library newsletter: <paste abstract>"
```

## Literature Review Assistance

```bash
# Compare how models interpret a research question
alice compare "What are the main approaches to digital preservation of born-digital materials published since 2020?" --models sonnet,opus

# Extract themes from multiple abstracts
alice invoke "Identify the 5 most common themes across these abstracts and rank by frequency: <paste abstracts>"

# Gap analysis
alice invoke "Based on these paper summaries, identify research gaps and suggest future directions: <paste summaries>"
```

## Key Finding Extraction

```bash
# Structured extraction
alice invoke "Extract from this paper: (1) hypothesis, (2) sample size, (3) statistical method, (4) p-values, (5) main conclusion. Paper: <paste>"

# Methodology extraction
alice invoke "List the research methods used in this study, including data collection and analysis techniques: <paste>"

# Citation extraction
alice invoke "List all works cited in this passage with author, year, and the claim they support: <paste>"
```

## Metadata and Cataloging Assistance

```bash
# Generate subject headings
alice invoke "Suggest 5 Library of Congress Subject Headings (LCSH) for a work with this abstract: <paste>"

# Dublin Core metadata
alice invoke "Generate Dublin Core metadata elements (title, creator, subject, description, date, type, format, identifier) for this resource: <paste description>"

# MARC field suggestions
alice invoke "Suggest MARC 21 fields 245, 260, 300, 500, 520, and 650 for a catalog record based on this description: <paste>"
```

## Batch Processing for Research

```bash
# Process many prompts from CSV
# CSV format: one prompt per row, first column is the prompt text
alice batch prompts.csv

# Example: batch-extract keywords from 100 abstracts
# Create abstracts.csv with one abstract per row, prefixed with instruction
alice batch abstracts.csv --model-id haiku
```

**CSV preparation tip:** Prefix each row with the instruction:

```
"Extract 5 keywords from this abstract: <abstract text here>"
"Extract 5 keywords from this abstract: <abstract text here>"
```

## Multi-Model Evaluation for Research

```bash
# Compare factual accuracy across models
alice compare "What year was the Library of Congress founded and who was its first Librarian?" --models sonnet,nova-pro,haiku

# Compare reasoning on domain-specific questions
alice compare "Explain the difference between FRBR and BIBFRAME as bibliographic frameworks" --models sonnet,opus

# Evaluate summarization quality
alice compare "Summarize this abstract in 2 sentences: <paste>" --models sonnet,haiku,nova-pro
```

## Interactive Research Sessions

```bash
# Deep-dive chat on a topic
alice chat --model-id opus
# Then in chat: "I'm researching digital humanities methods for analyzing 19th century newspapers. Help me develop a methodology."

# Quick Q&A with cheaper model
alice chat --model-id haiku
# Then: "What's the difference between DOI and Handle System identifiers?"
```

## Working with Citations (when alice cite is available)

```bash
# Clean up a messy bibliography
alice cite process references.txt --output-format bibtex --output clean.bib

# Look up a single reference
alice cite lookup "10.1145/3292500.3330672"
alice cite lookup "Attention Is All You Need 2017"

# Convert BibTeX to APA for a paper submission
alice cite format bibliography.bib --output-format apa --output references-apa.txt

# Interactive mode for ambiguous references
alice cite process rough-notes.txt --interactive --output-format bibtex
```
