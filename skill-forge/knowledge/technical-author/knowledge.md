---
name: technical-author
displayName: Technical Author
description: A methodical guide for writing technical books from initial concept to published manuscript. Walks authors through every phase of the technical publishing process with structured workflows and practical techniques, tailored for publishers like O'Reilly, Pragmatic Bookshelf, Manning, and Addison-Wesley.
keywords:
  - technical-writing
  - technical-book
  - oreilly
  - publishing
  - manuscript
  - nonfiction
author: Kiro Power Builder
version: 0.1.0
harnesses:
  - kiro
type: power
inclusion: manual
categories:
  - documentation
ecosystem: []
depends: []
enhances: []
maturity: stable
trust: community
audience: intermediate
model-assumptions: []
collections:
  - byron-powers
inherit-hooks: false
---
# Technical Author

## Overview

Technical Author is a comprehensive power for writing technical books. It breaks the book-writing process into discrete, manageable phases — each with its own steering file — so you can focus on one aspect of craft at a time while keeping the big picture in view.

Whether you're pitching a vague idea to an acquisitions editor or polishing a manuscript for production, Technical Author meets you where you are.

## Getting Started

When a user activates this power, begin by asking which track fits their current needs:

**Ask the user:** "Where are you in your technical book journey?"

**Option 1: Planning Track** — "I'm developing a book idea. I need help with the concept, audience, outline, and proposal."

**Option 2: Writing Track** — "I have an approved outline. I need help writing chapters, code examples, and explanations."

**Option 3: Production Track** — "I have a draft. I need help with technical review, revision, and preparing for production."

**Option 4: Full Journey** — "I want to go from concept to finished manuscript. Walk me through everything."

Based on their answer, guide them into the appropriate track below. Users can switch tracks or access any phase at any time — the tracks are starting points, not constraints.

## Planning Track

The Planning Track covers everything before you write the first chapter. It's organized into five phases:

### Phases

1. **Concept & Audience** — Define what the book teaches, who it's for, and why it matters now
2. **Technology Landscape** — Research the competitive landscape, existing books, and market timing
3. **Book Architecture** — Design the table of contents, chapter flow, and learning progression
4. **Proposal & Pitch** — Write the book proposal for publishers or self-publishing planning
5. **Voice & Style** — Establish the prose style, tone, and conventions for the manuscript

### Planning Track Steering Files

- **concept-and-audience** — Develop your core idea into a compelling book concept with a defined audience, scope, and value proposition
- **technology-landscape** — Research existing books, competing resources, market timing, and positioning for your technical topic
- **book-architecture** — Design the table of contents, chapter structure, learning progression, and dependency graph
- **proposal-and-pitch** — Write a publisher-ready book proposal or self-publishing plan with market analysis and sample chapter
- **voice-and-style** — Define and maintain a consistent technical writing voice, code style, and pedagogical approach

## Writing Track

The Writing Track covers the craft of writing technical content chapter by chapter. It's organized into five phases:

### Phases

6. **Explanation Craft** — Master the techniques for explaining complex technical concepts clearly
7. **Code Examples** — Design, write, and maintain code examples that teach effectively
8. **Visual & Diagrams** — Plan diagrams, figures, screenshots, and visual explanations
9. **Chapter Drafting** — Write chapters systematically with attention to pacing, depth, and flow
10. **Running Example** — Design and maintain a cohesive example project that threads through the book

### Writing Track Steering Files

- **explanation-craft** — Techniques for explaining complex technical concepts with clarity, precision, and appropriate depth
- **code-examples** — Design, write, test, and maintain code examples that teach effectively and actually run
- **visuals-and-diagrams** — Plan and describe diagrams, architecture figures, screenshots, and visual explanations
- **chapter-drafting** — Write chapters systematically with attention to pacing, learning objectives, and forward momentum
- **running-example** — Design and maintain a cohesive example project that threads through the book and grows with the reader

## Production Track

The Production Track covers everything after the draft is written — review, revision, and preparation for publication. It's organized into four phases:

### Phases

11. **Technical Review** — Manage the technical review process and incorporate feedback
12. **Revision & Polish** — Revise for accuracy, clarity, consistency, and completeness
13. **Production Prep** — Prepare the manuscript for the publisher's production pipeline
14. **Launch & Marketing** — Plan the book launch, marketing, and ongoing maintenance

### Production Track Steering Files

- **technical-review** — Manage the technical review process, incorporate feedback, and resolve conflicting reviewer opinions
- **revision-and-polish** — Systematically revise for technical accuracy, prose clarity, code correctness, and consistency
- **production-prep** — Prepare the manuscript for the publisher's production pipeline including formatting, indexing, and final checks
- **launch-and-marketing** — Plan the book launch, build an audience, and maintain the book post-publication

## Full Journey

If the user selects the Full Journey, guide them through all fourteen phases in order — the Planning Track, then the Writing Track, then the Production Track. The complete sequence:

1. Concept & Audience
2. Technology Landscape
3. Book Architecture
4. Proposal & Pitch
5. Voice & Style
6. Explanation Craft
7. Code Examples
8. Visuals & Diagrams
9. Chapter Drafting
10. Running Example
11. Technical Review
12. Revision & Polish
13. Production Prep
14. Launch & Marketing

## Tips for Using This Power

- Activate the steering file for whichever phase you're working on
- Keep a running document for your book project (outline, code repo, style guide, manuscript)
- Reference earlier phase outputs as you move forward — consistency matters
- Don't try to perfect one phase before moving on; iteration is part of the process
- When stuck, try jumping to a different phase for fresh perspective
- You can switch between tracks at any time — the boundaries are guides, not walls
- Technical books are living documents — plan for updates from the start
