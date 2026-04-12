# Technical Review

## Overview

Technical review is the process that separates professional technical books from blog posts. Reviewers catch errors you can't see because you're too close to the material — incorrect explanations, untested assumptions, missing context, and code that works on your machine but nowhere else. This phase covers organizing the review process, selecting reviewers, managing feedback, and resolving conflicting opinions.

## Workflow: Managing Technical Review

### Step 1: Understand the Review Types

Technical books typically go through multiple review rounds:

**Development review (during writing):**
- Informal feedback on chapters as you write them
- Catches structural and conceptual problems early
- Usually from 1-2 trusted colleagues
- Low overhead, high value

**Technical review (after first draft):**
- Formal review of the complete manuscript
- Focuses on technical accuracy, code correctness, and completeness
- Usually 3-5 reviewers with relevant expertise
- Publisher may organize this (O'Reilly, Manning) or you may need to arrange it yourself

**Copy editing (after technical review):**
- Focuses on prose quality, grammar, consistency
- Usually handled by the publisher's editorial team
- Not your responsibility to organize, but you'll need to review their changes

**Proofreading (final pass):**
- Catches typos, formatting errors, broken references
- Last chance before publication
- Usually handled by the publisher

### Step 2: Select Reviewers

**Ideal reviewer profile:**
- Knowledgeable about the book's technology
- Representative of the target audience (not too expert, not too beginner)
- Willing to commit the time (reviewing a technical book is 20-40 hours of work)
- Able to articulate what's confusing, not just what's wrong
- Diverse perspectives (different experience levels, different use cases, different platforms)

**Reviewer mix (for 3-5 reviewers):**
- 1-2 experts in the technology (catch technical errors)
- 1-2 members of the target audience (catch explanation failures)
- 1 person from an adjacent field (catches assumptions and jargon)

**Where to find reviewers:**
- Colleagues who work with the technology
- Open source community members
- Conference speakers on related topics
- Technical bloggers in the space
- Your publisher's reviewer network (if traditionally published)
- Online communities (with appropriate compensation or credit)

**Reviewer compensation:**
- Traditional publishers typically pay reviewers a flat fee ($200-500) or provide free books
- Self-publishers should offer compensation, credit in the acknowledgments, or both
- At minimum, reviewers should receive a free copy of the finished book and prominent acknowledgment

### Step 3: Prepare Review Materials

**What to send reviewers:**

```markdown
# Review Guide for {Book Title}

## About the Book
{Brief description, target audience, scope}

## What I'm Looking For
Please focus on:
- Technical accuracy — Is the code correct? Are the explanations accurate?
- Clarity — Are there parts that are confusing or need more explanation?
- Completeness — Is anything important missing?
- Code quality — Do the examples follow best practices? Would you write it differently?
- Pacing — Does the difficulty ramp appropriately?
- Audience fit — Is this the right level for {target audience description}?

## How to Provide Feedback
- Use comments/annotations in the document (or whatever tool we're using)
- For code issues, please note the listing number and describe the problem
- For conceptual issues, explain what's confusing and suggest an alternative if you have one
- Don't worry about typos or grammar — that's a separate pass

## Timeline
- Review period: {start date} to {end date}
- Please review at least {N} chapters per week
- Final feedback due: {date}

## Chapters
{List of chapters with brief descriptions so reviewers can prioritize}
```

**Review format options:**
- Google Docs with commenting (easy collaboration)
- PDF with annotation tools (familiar to most reviewers)
- GitHub pull requests (good for code-heavy reviews)
- Publisher's review platform (if available)

### Step 4: Process Feedback

**Triage incoming feedback:**

| Category | Action | Priority |
|----------|--------|----------|
| Factual error | Fix immediately | Critical |
| Code bug | Fix and retest | Critical |
| Confusing explanation | Rewrite | High |
| Missing content | Evaluate and add if warranted | High |
| Style preference | Consider but don't automatically adopt | Medium |
| Nitpick | Fix if easy, skip if not | Low |
| Scope expansion | Usually decline | Low |

**Feedback tracking:**

```markdown
# Review Feedback Tracker

| Chapter | Reviewer | Issue | Category | Status | Notes |
|---------|----------|-------|----------|--------|-------|
| Ch 3 | Alice | Listing 3-4 has a race condition | Code bug | ✅ Fixed | Added mutex |
| Ch 5 | Bob | Explanation of CAP theorem is misleading | Factual | 🔄 Rewriting | |
| Ch 5 | Alice | CAP explanation is fine | Conflicting | — | See Bob's feedback |
| Ch 7 | Carol | Should cover gRPC in addition to REST | Scope expansion | ❌ Declined | Out of scope |
| Ch 2 | Bob | Section 2.3 is too long | Pacing | ✅ Split into 2.3 and 2.4 | |
```

### Step 5: Resolve Conflicting Feedback

Reviewers will disagree. This is normal and valuable.

**When reviewers conflict:**

1. **Identify the underlying issue** — Often reviewers agree on the problem but disagree on the solution
2. **Consider the audience** — Which perspective better serves the target reader?
3. **Check the facts** — If it's a factual disagreement, verify independently
4. **Trust your judgment** — You know the book's goals better than any individual reviewer
5. **Document your decision** — Note why you chose one approach over another

**Common conflict patterns:**
- "Too basic" vs. "too advanced" → Check against your defined audience level
- "Needs more theory" vs. "needs more practice" → Check against your book's stated approach
- "This is wrong" vs. "this is a simplification" → Decide if the simplification serves the reader
- "Add X" vs. "the book is already too long" → Evaluate against scope boundaries

### Step 6: Incorporate Feedback

**Revision approach:**
1. Group feedback by chapter
2. Address critical issues first (factual errors, code bugs)
3. Rewrite confusing explanations
4. Add missing content that's within scope
5. Decline scope expansions with a brief note to the reviewer
6. Send revised chapters back to the reviewer who flagged the issue (for critical changes)

**Communicating with reviewers:**
- Thank them for specific, actionable feedback
- Explain when you decline a suggestion (they'll understand if you have a reason)
- Share the final version so they can see how their feedback was incorporated
- Acknowledge them prominently in the book

## Techniques

### The Fresh Eyes Test
After incorporating all review feedback, have one person who hasn't seen the manuscript read it from start to finish. They'll catch issues that reviewers missed because they were reading chapter by chapter.

### The Code Walkthrough
For critical code examples, do a live walkthrough with a reviewer. Screen-share, run the code, and talk through it. This catches issues that reading alone misses.

### The Audience Proxy Test
Find someone who matches your target audience profile but hasn't been involved in the book. Give them a chapter and watch them work through it. Where do they get stuck? Where do they skip ahead? Where do they re-read?

## Common Pitfalls

- **Too few reviewers** — One reviewer isn't enough. You need multiple perspectives.
- **Too many reviewers** — More than 5-6 reviewers creates feedback overload. Quality over quantity.
- **Ignoring uncomfortable feedback** — The feedback that stings is often the most valuable.
- **Accepting all feedback** — Not every suggestion improves the book. You're the author; make judgment calls.
- **Late reviews** — Start the review process as early as possible. Waiting until the manuscript is "perfect" means you'll get feedback too late to act on it.
- **Reviewer fatigue** — Don't send the entire manuscript at once. Send chapters in batches.

## Deliverables

By the end of this phase, you should have:
- A reviewer roster with assigned chapters and timelines
- A review guide sent to all reviewers
- A feedback tracker with all issues categorized and addressed
- A revised manuscript incorporating review feedback
- Documentation of decisions made on conflicting feedback
- Reviewer acknowledgments drafted

## Connection to Other Phases

- **Code Examples** — Reviewers will test your code; ensure the companion repo is ready
- **Explanation Craft** — Review feedback often targets explanations; use explanation techniques to rewrite
- **Revision & Polish** — Technical review feeds directly into the revision process
- **Production Prep** — The manuscript should be technically reviewed before entering production
