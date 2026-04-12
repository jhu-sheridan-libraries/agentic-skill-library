# Revision & Polish

## Overview

The first draft gets the content down. Revision makes it teachable. Technical book revision is different from fiction revision — you're optimizing for clarity, accuracy, and learning effectiveness rather than narrative art. This phase provides a systematic, multi-pass approach to transforming a rough draft into a polished manuscript.

## Workflow: The Revision Passes

### Pass 1: Rest and Re-Read

**Create distance before revising.**

- Put the manuscript away for at least 1-2 weeks
- When you return, read the entire manuscript in as few sittings as possible
- Read as a learner, not the author — note where you get confused, bored, or lost
- Mark passages where the explanation doesn't land, even though you wrote it

**After the read-through, assess:**
- What chapters are strongest? What makes them work?
- What chapters are weakest? What's the core problem?
- Does the learning progression feel natural?
- Are there gaps where the reader would be lost?
- Is the difficulty ramp appropriate?

### Pass 2: Structural Revision

Address big-picture issues before touching prose:

**Chapter-level checks:**
- Does each chapter deliver on its learning objectives?
- Are chapters the right length? (Wildly uneven chapters suggest scope problems)
- Is the chapter order optimal? (Sometimes you discover a better sequence during drafting)
- Are there chapters that should be split, merged, or cut?
- Does each chapter have a clear beginning, middle, and end?

**Content coverage:**
- Does the book cover everything the reader needs to achieve the stated goal?
- Is there content that doesn't serve the book's purpose? (Cut it, even if it's good)
- Are there topics that need more depth?
- Are there topics that have too much depth for the audience level?

**Running example continuity:**
- Does the running example work at every chapter boundary?
- Does the project grow at a reasonable pace?
- Are there chapters where the running example feels forced?

**Actions in this pass:** Reorder sections, cut or add chapters, restructure the learning progression. This is major surgery.

### Pass 3: Explanation Revision

With the structure solid, improve every explanation:

**For each concept, check:**
- Is the motivation clear? (Why should the reader care?)
- Is the explanation accurate? (Technically correct, not misleading)
- Is the explanation clear? (Would a member of the target audience understand it?)
- Is there a concrete example? (Abstract explanations need grounding)
- Is the cognitive load manageable? (One concept at a time)

**Common explanation problems to fix:**
- **The curse of knowledge** — You skipped a step the reader needs. Add it.
- **Buried lede** — The key insight is in paragraph 3 instead of paragraph 1. Restructure.
- **Missing "why"** — You explained how but not why. Add motivation.
- **Jargon without definition** — A term used before it's explained. Define it or restructure.
- **Over-explanation** — Spending a page on something that needs a sentence. Trim.

### Pass 4: Code Revision

Verify every code example:

**Code accuracy:**
- Run every listing. Does it produce the output the book claims?
- Check against the current version of the technology
- Verify imports, dependencies, and configuration
- Test on a clean environment (not just your development machine)

**Code quality:**
- Do examples follow the code conventions from your style guide?
- Are variable names clear and consistent?
- Is the code the simplest version that demonstrates the concept?
- Are there unnecessary complications that distract from the teaching point?

**Code presentation:**
- Are listings numbered correctly and referenced in the text?
- Do callout annotations match the code?
- Is the code formatted consistently?
- Are changes between related listings clearly marked?

**Code evolution:**
- Does the running example compile/run at every chapter checkpoint?
- Are all branches/tags in the companion repository up to date?
- Do starter and checkpoint code match the manuscript?

### Pass 5: Line Editing

Now focus on prose quality:

**Clarity:**
- Is every sentence clear on first reading?
- Are there ambiguous pronouns or references?
- Can complex sentences be simplified?

**Economy:**
- Cut filler words (just, really, very, quite, basically, simply, actually)
- Tighten wordy constructions ("in order to" → "to", "the fact that" → cut)
- Remove redundant explanations (if you said it clearly once, don't say it again differently)
- Cut throat-clearing openings ("It's important to note that..." → just state the thing)

**Consistency:**
- Terminology consistent throughout? (Don't alternate between "function" and "method" for the same concept)
- Formatting consistent? (Code font for code terms, consistent heading levels)
- Person and tense consistent? (Don't switch between "we" and "you" randomly)

**Rhythm:**
- Vary sentence length
- Break up long paragraphs (especially in technical content)
- Read aloud to catch awkward phrasing

### Pass 6: Continuity and Polish

The final pass catches the small things:

**Cross-references:**
- Do all "see Chapter X" references point to the right chapter?
- Do all "as we saw in Listing X-Y" references point to the right listing?
- Do all figure references match actual figures?
- Are forward references still accurate after restructuring?

**Consistency details:**
- Chapter and section numbering correct?
- Listing numbering sequential within chapters?
- Figure numbering sequential within chapters?
- Terminology glossary complete and accurate?
- Index terms identified (if you're responsible for indexing)?

**Front and back matter:**
- Preface: Who is this book for? What will they learn? How to read it?
- Acknowledgments: Reviewers, editors, colleagues, family
- Appendix: Setup instructions, reference tables, further reading
- About the author: Updated bio

## Techniques

### The Chapter Swap Test
Read Chapter 7, then immediately read Chapter 3. Does Chapter 3 feel too basic after reading Chapter 7? Does Chapter 7 assume knowledge not covered by Chapter 3? This reveals progression problems.

### The Listing Audit
Create a spreadsheet of every code listing: number, description, language, tested (yes/no), references in text. This catches orphaned listings, missing references, and untested code.

### The Jargon Highlight
Print a chapter and highlight every technical term. For each one: Is it defined? Is it defined before first use? Is it used consistently? This is tedious but catches a common class of problems.

### The Beta Reader Protocol
After your own revision, get 2-3 people from your target audience to read the manuscript:
- Give them specific questions ("Could you follow the explanation in Section 5.3?")
- Ask them to work through the code examples
- Note where they get stuck — those are your revision priorities
- Patterns across multiple readers are more important than individual preferences

## Common Pitfalls

- **Revising too soon** — Editing chapters before the full draft exists leads to polishing content that might get cut.
- **Wrong order** — Line editing before structural revision wastes time on prose in sections that might be restructured.
- **Over-revising** — At some point, revision becomes procrastination. The manuscript will never be perfect.
- **Ignoring code** — Prose revision without code verification leaves bugs in the most important part of the book.
- **Losing the voice** — Over-editing can sand away personality. Keep some of your natural voice.

## Deliverables

By the end of this phase, you should have:
- A structurally sound manuscript with clear learning progression
- Accurate, tested code examples throughout
- Clear, consistent prose with a defined voice
- All cross-references verified
- Front and back matter complete
- A manuscript ready for production

## Connection to Other Phases

- **Technical Review** — Review feedback drives revision priorities
- **Code Examples** — Code revision is a major component of this phase
- **Voice & Style** — Your style guide is the reference standard for consistency checks
- **Production Prep** — The revised manuscript enters the production pipeline
