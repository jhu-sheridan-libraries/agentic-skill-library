# Book Architecture

## Overview

The architecture of a technical book is its table of contents, chapter structure, and learning progression. A well-architected book feels inevitable — each chapter builds on the last, the reader never feels lost, and by the end they've constructed a complete mental model. A poorly architected book feels like a random collection of topics stapled together.

This phase designs the skeleton that everything else hangs on.

## Workflow: Designing the Structure

### Step 1: Choose a Structural Pattern

Technical books follow recognizable patterns. Choose the one that fits your content:

**Bottom-Up (fundamentals first):**
- Start with core concepts, build toward complex applications
- Good for: language books, framework introductions, foundational topics
- Risk: readers may lose patience before reaching the interesting parts
- Example: "Programming Rust" — starts with ownership, builds to async

**Top-Down (big picture first):**
- Start with architecture and design, drill into implementation details
- Good for: architecture books, system design, strategic topics
- Risk: can feel abstract until the reader gets to concrete examples
- Example: "Designing Data-Intensive Applications" — starts with data models, drills into storage engines

**Spiral (revisit topics at increasing depth):**
- Introduce concepts simply, return to them with more nuance later
- Good for: complex topics where full understanding requires multiple passes
- Risk: can feel repetitive if not handled well
- Example: "The Art of PostgreSQL" — revisits SQL concepts at increasing sophistication

**Project-Based (learn by building):**
- Each chapter adds a feature or capability to a running example
- Good for: practical guides, framework tutorials, hands-on learners
- Risk: the project can constrain what topics you cover
- Example: "Agile Web Development with Rails" — builds a store application

**Reference (organized by topic):**
- Chapters are relatively independent, organized by domain
- Good for: cookbooks, API guides, comprehensive references
- Risk: no narrative momentum; readers may not read cover-to-cover
- Example: "JavaScript: The Definitive Guide" — organized by language feature

**Problem-Solution (organized by challenge):**
- Each chapter addresses a specific problem or use case
- Good for: intermediate/advanced audiences, cookbooks, best-practices guides
- Risk: can lack cohesion if problems aren't connected
- Example: "Release It!" — organized by production failure patterns

### Step 2: Define the Chapter List

Draft your table of contents. For each chapter, specify:

```markdown
# Table of Contents

## Part I: {Part Title} (if using parts)

### Chapter 1: {Title}
- **Learning objective:** What the reader can do after this chapter
- **Prerequisites:** What they need to know before reading this
- **Key concepts:** 3-5 main ideas covered
- **Estimated length:** {pages}

### Chapter 2: {Title}
- **Learning objective:** ...
- **Prerequisites:** Chapter 1
- **Key concepts:** ...
- **Estimated length:** {pages}
```

**Chapter count guidelines by book type:**

| Book Type | Typical Chapters | Typical Pages |
|-----------|-----------------|---------------|
| Introductory guide | 10-15 | 250-350 |
| Comprehensive guide | 15-25 | 400-600 |
| Cookbook/recipes | 10-15 (with many sections each) | 300-500 |
| Deep dive / advanced | 8-15 | 250-400 |
| Project-based | 10-20 | 300-500 |

### Step 3: Map the Dependency Graph

Technical content has dependencies — you can't explain middleware before explaining HTTP, can't cover testing strategies before covering the code being tested.

**Create a dependency map:**

```markdown
# Chapter Dependencies

Chapter 1: Foundations → (no dependencies)
Chapter 2: Core API → depends on Chapter 1
Chapter 3: Data Layer → depends on Chapter 1
Chapter 4: Authentication → depends on Chapters 2, 3
Chapter 5: Testing → depends on Chapters 2, 3
Chapter 6: Deployment → depends on Chapters 2, 3, 4
Chapter 7: Advanced Patterns → depends on Chapters 2, 3, 4, 5
```

**Check for problems:**
- **Circular dependencies:** Chapter A requires B, but B requires A. Resolve by restructuring or introducing concepts incrementally.
- **Deep dependency chains:** If Chapter 10 requires all of Chapters 1-9, the reader can't skip ahead. Consider making some chapters more independent.
- **Orphan chapters:** A chapter with no dependencies and nothing depends on it. It might not belong in this book.

### Step 4: Design the Learning Progression

The reader should feel a sense of growing capability as they move through the book:

**Early chapters (1-3):**
- Establish vocabulary and mental models
- Get the reader to a working "hello world" quickly
- Build confidence with small wins
- Set up the development environment

**Middle chapters (4-8):**
- Introduce the core techniques and patterns
- Increase complexity gradually
- Each chapter should produce something the reader is proud of
- This is where the bulk of the teaching happens

**Late chapters (9+):**
- Advanced topics, edge cases, production concerns
- Synthesis — connecting earlier concepts in sophisticated ways
- Real-world considerations (performance, security, operations)
- Where to go next

**The "aha moment" placement:**
Every 2-3 chapters, the reader should have a moment where disparate concepts click together. Plan these moments deliberately.

### Step 5: Design Chapter Internal Structure

Establish a consistent internal structure for chapters:

**Standard chapter template:**

```markdown
# Chapter N: {Title}

## What You'll Learn
- {Learning objective 1}
- {Learning objective 2}
- {Learning objective 3}

## {Section 1: Concept Introduction}
{Explain the concept with motivation — why does this matter?}

## {Section 2: Hands-On}
{Walk through the implementation with code examples}

## {Section 3: Going Deeper}
{Nuances, edge cases, advanced usage}

## {Section 4: Practical Application}
{Apply the concept to the running example or a realistic scenario}

## Summary
{Key takeaways — 3-5 bullet points}

## Exercises (optional)
{Practice problems or challenges for the reader}
```

Not every chapter needs every section, but having a template creates consistency that readers appreciate.

### Step 6: Validate the Architecture

Before writing, stress-test the structure:

- **Coverage check:** Does the TOC cover everything the reader needs to achieve the book's stated goal?
- **Pacing check:** Are chapters roughly similar in length? Wild variation suggests scope problems.
- **Progression check:** Does difficulty increase gradually? Are there sudden jumps?
- **Independence check:** Can a reader skip chapters they already know? (Desirable for reference-style books)
- **Completeness check:** After reading the last chapter, can the reader do what the book promised?

## Techniques

### The Sticky Note Method
Write each chapter title on a sticky note. Arrange them on a wall. Draw arrows for dependencies. Rearrange until the flow feels natural. This makes structure tangible and movable.

### The Reverse Design Method
Start with what the reader should be able to build or do after finishing the book. Work backward: what do they need to know to do that? What do they need to know before that? Keep going until you reach "things the reader already knows." That's your chapter list in reverse.

### The Three-Reader Test
Imagine three readers: a beginner, an intermediate, and an advanced practitioner. Trace each reader's path through the book. The beginner reads everything. The intermediate skips early chapters. The advanced reader jumps to specific topics. Does the book serve all three?

### The Competitor Comparison
Lay your TOC next to the TOC of 2-3 competing books. Where do you overlap? Where do you diverge? The overlaps should be handled better. The divergences should be your unique value.

## Deliverables

By the end of this phase, you should have:
- A chosen structural pattern with rationale
- A complete table of contents with learning objectives per chapter
- A dependency graph showing chapter relationships
- A learning progression plan with "aha moment" placement
- A chapter template for internal structure
- Estimated page counts per chapter and total
- Confidence that the architecture supports the book's goals

## Next Phase

With the architecture designed, move to **proposal-and-pitch** to write the book proposal for publishers.
