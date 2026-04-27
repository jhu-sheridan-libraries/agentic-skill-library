---
name: proofreader-review-checklist
displayName: Proofreader Review Checklist
description: Structured checklists for proofreading and reviewing writing documents — manuscript chapters, outlines, proposals, query letters, character sheets, and world-building docs.
keywords:
  - proofread
  - review
  - manuscript
  - checklist
  - query-letter
  - proposal
  - outline
  - consistency
  - chapter
  - character-sheet
author: Demo
version: 0.2.0
harnesses:
  - kiro
type: power
inclusion: manual
categories:
  - documentation
  - writing
ecosystem: []
depends: []
enhances: []
maturity: stable
inherit-hooks: false
---
# Proofreader Review Checklist

## Overview

This power provides structured checklists for proofreading and reviewing writing workspace documents. It adapts to the document type — manuscript chapters, outlines, proposals, query letters, character sheets, and more — so every review is focused and consistent.

## Onboarding

No setup required. When the user shares a document to review, begin by identifying what kind of document it is:

**Ask the user:** "What type of document are you reviewing? (manuscript chapter, outline/beat sheet, query letter/synopsis, book proposal, or character sheet/world-building doc)"

Then apply the relevant checklist below.

## Common Workflows

### Workflow: Manuscript Chapter (fiction or technical)

**1. Mechanical**
- Spelling, grammar, and punctuation errors
- Consistent punctuation style throughout (Oxford comma, em-dash vs en-dash, curly vs straight quotes)
- No stray formatting artifacts (double spaces, broken markdown, mismatched italics)

**2. Voice & Consistency**
- Tense is consistent throughout the chapter
- POV is maintained — no unintended head-hopping in single-POV chapters
- Character names, place names, and proper nouns spelled consistently
- Technical terms or invented vocabulary match usage in earlier chapters

**3. Continuity**
- Timeline aligns with the outline and earlier chapters
- Character attributes (appearance, age, relationships, traits) match established character sheets
- World-building rules are not violated
- The chapter's end state is consistent with where the next chapter begins

**4. Clarity**
- Sentences read smoothly when read aloud
- Ambiguous pronouns are resolved (it's clear who "he" or "she" refers to)
- Scene transitions are clearly marked and easy to follow
- Dialogue attribution is unambiguous

**5. Structure**
- Scene breaks are correctly marked (e.g., `---` or `* * *`)
- Chapter opens with a hook or re-entry point that draws the reader in
- Paragraph breaks are appropriate — no walls of text, no excessive fragmentation
- Formatting matches the manuscript's established conventions

---

### Workflow: Outline or Beat Sheet

**1. Completeness**
- All major plot or structural points are present
- Character arcs are tracked through each beat or chapter
- Each scene or chapter entry has a stated dramatic purpose

**2. Consistency**
- Character motivations are consistent beat to beat
- Timeline is plausible (no impossible travel, implausible time compression)
- Stakes escalate in the right direction toward the climax

**3. Formatting**
- Outline format is consistent throughout (headings, numbering, indentation)
- Chapter or scene labels are consistent
- No orphaned beats that lack context or connection to adjacent entries

---

### Workflow: Query Letter or Synopsis

**1. Mechanical**
- No spelling or grammar errors
- Word or page count is within the submission guidelines for the target agent or publisher

**2. Pitch Quality**
- Hook lands in the first sentence — the premise is clear and compelling immediately
- Protagonist, goal, conflict, and stakes are all present and legible
- Voice matches the manuscript's register (a quiet literary novel shouldn't have a punchy thriller query)
- Comp titles are current (within 3–5 years) and accurately comparable in tone, audience, and sales tier

**3. Consistency**
- Character names match the manuscript exactly
- Plot summary accurately reflects the manuscript's events — no invented or missing plot points
- Stated genre, word count, and age category match the manuscript

---

### Workflow: Book Proposal (technical or narrative non-fiction)

**1. Mechanical**
- No spelling or grammar errors
- All required sections are present: overview, audience, competitive analysis, TOC, author bio, sample chapter (or equivalent for the publisher)

**2. Market Accuracy**
- Comp titles are current, appropriately scoped, and not too famous or too obscure
- Audience definition is specific and credible — not "anyone interested in X"
- Any market data or statistics cited are recent and sourced

**3. Internal Consistency**
- Chapter summaries align with the proposed table of contents
- Author bio claims (platform size, credentials, previous publications) are accurate and verifiable
- The scope described in the overview matches the detailed outline — no over-promising

---

### Workflow: Character Sheet or World-Building Document

**1. Completeness**
- All required fields are filled for the template in use
- Any gaps are flagged for the author to resolve — not silently skipped

**2. Internal Consistency**
- No contradictions within the document (age doesn't conflict with birth year, two characters don't share the same unique backstory detail)
- Relationships are reciprocal where expected (if A is B's mentor, B should reference A as their student)

**3. Consistency with Manuscript**
- Details match what has appeared in chapters so far
- Any discrepancy between the sheet and the manuscript is flagged — the author decides which is canonical

## Best Practices

- Review one document type at a time; don't mix chapter proofreading with outline review in the same pass
- Check against source documents (outline, character sheets, established manuscript chapters) rather than from memory
- Flag continuity issues for the author's decision — don't silently "fix" lore
- Distinguish mechanical errors (correct them directly) from stylistic choices (flag with a note explaining the concern)
- Be specific: cite the exact passage or line, not just the category of problem
- When uncertain whether something is an error or an intentional choice, ask before changing it

## Examples

**Good proofreading note (specific, actionable):**
> Chapter 3, paragraph 2: "She walked to the their car" — typo: "the their" should be "their". Mechanical error, corrected.

**Good stylistic flag (respectful, informative):**
> Chapter 7, dialogue tag: "he exclaimed loudly" — the adverb "loudly" is redundant with "exclaimed." Consider removing. Flagged as stylistic concern, not corrected.

**Bad proofreading note (vague):**
> Some grammar issues in this chapter. (Which ones? Where? What kind?)

## Troubleshooting

**Agent corrects intentional stylistic choices:** When reviewing fiction, flag unusual constructions as questions ("Is this intentional?") rather than corrections. Dialect, voice, and deliberate rule-breaking are authorial choices.

**Agent misses consistency errors:** Run a dedicated consistency pass separate from the grammar pass. Looking for everything at once causes both types of errors to be missed.

**Agent over-corrects dialogue:** Dialogue should sound like speech, not prose. Fragments, contractions, and grammatical shortcuts are normal in dialogue and should not be "fixed."
