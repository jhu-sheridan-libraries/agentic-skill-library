# Chapter Drafting

## Overview

This is where the book gets written. Drafting a technical book is different from drafting fiction — you're teaching, not storytelling. But the same principle applies: the first draft's job is to exist. Perfection comes later. This phase provides a systematic approach to writing chapters that teach effectively without getting paralyzed by the pursuit of perfect explanations.

## Workflow: Writing the Draft

### Step 1: Set Up Your Drafting Practice

**Writing pace for technical books:**
- 500-1,000 words/day is a sustainable pace alongside a full-time job
- 1,500-2,500 words/day is possible during dedicated writing time
- A typical chapter is 5,000-15,000 words (20-50 manuscript pages)
- At 1,000 words/day, a chapter takes 1-3 weeks

**Technical book writing is slower than other writing because:**
- You need to write and test code examples
- You need to verify technical accuracy
- You need to create or plan diagrams
- You need to check that explanations actually work

**First draft mindset:**
- Get the content down. Clarity and polish come in revision.
- Mark uncertain sections with [TODO] or [CHECK] rather than stopping to research
- Write the parts you're confident about first; come back to the hard parts
- A rough explanation that exists is better than a perfect explanation that doesn't

### Step 2: Chapter Planning (Before Each Chapter)

Before writing a chapter, spend 30-60 minutes planning:

**Chapter brief:**

```markdown
# Chapter N: {Title}

## Learning Objectives
After reading this chapter, the reader will be able to:
- {Objective 1 — specific and measurable}
- {Objective 2}
- {Objective 3}

## Prerequisites
- {What the reader needs to know from earlier chapters}
- {External knowledge assumed}

## Key Concepts
1. {Concept A} — {one-sentence description}
2. {Concept B} — {one-sentence description}
3. {Concept C} — {one-sentence description}

## Code Examples Needed
- Listing N-1: {description}
- Listing N-2: {description}
- Listing N-3: {description}

## Figures Needed
- Figure N-1: {description}
- Figure N-2: {description}

## Section Outline
1. {Section title} — {what it covers, ~X pages}
2. {Section title} — {what it covers, ~X pages}
3. {Section title} — {what it covers, ~X pages}
4. Summary

## Connection to Running Example
- {How this chapter advances the running example}
- {What the reader builds or adds in this chapter}
```

### Step 3: Write the Chapter Opening

The first page of each chapter sets expectations and creates motivation:

**Opening pattern:**

1. **Hook** — Why should the reader care about this topic? Start with a problem, a question, or a scenario they'll recognize.

"You've built the API, written the tests, and everything works on your laptop. Then you deploy to production and discover that your application handles exactly one request at a time. Welcome to the world of concurrency."

2. **Context** — Where does this chapter fit in the book's progression?

"In the previous chapter, we built a basic HTTP server. Now we need to make it handle multiple requests simultaneously."

3. **Roadmap** — What will this chapter cover?

"We'll start with the simplest concurrency model — threads — and work our way to async/await. By the end of this chapter, your server will handle thousands of concurrent connections."

### Step 4: Write the Body

**Section-by-section approach:**

For each section in your outline:

1. **Introduce the concept** — What is it and why does it matter?
2. **Explain with an example** — Show, don't just tell
3. **Provide the code** — Working code that demonstrates the concept
4. **Walk through the code** — Explain what each part does
5. **Add nuance** — Edge cases, caveats, best practices
6. **Connect** — How does this relate to what came before and what comes next?

**Pacing within a chapter:**
- Alternate between prose explanation and code examples
- Don't go more than 2 pages without code in a hands-on book
- Don't go more than 1 page of code without prose explanation
- Use callout boxes to break up long explanatory sections
- Include "try it yourself" moments where the reader should run code

**Handling difficult explanations:**
When you hit a concept that's hard to explain:
- Write the explanation badly first — just get the ideas down
- Mark it with [REVISE] and move on
- Come back to it after writing the rest of the chapter (context helps)
- Try explaining it to a colleague or rubber duck
- Consider whether a diagram would help

### Step 5: Write the Chapter Closing

**Closing pattern:**

1. **Summary** — Key takeaways in 3-5 bullet points

```markdown
## Summary

- Threads provide the simplest concurrency model but have overhead per thread
- The async/await pattern handles many concurrent operations with minimal overhead
- Choose threads for CPU-bound work and async for I/O-bound work
- Always handle cancellation and timeouts in concurrent code
- Test concurrent code with deliberate race condition scenarios
```

2. **What's next** — Bridge to the next chapter

"Our server can now handle thousands of concurrent connections, but we haven't addressed what happens when things go wrong. In the next chapter, we'll add error handling, retries, and circuit breakers to make our system resilient."

3. **Exercises** (optional but valuable)

```markdown
## Exercises

1. **Warm-up:** Modify the thread pool example to log which thread handles each request.
2. **Practice:** Convert the synchronous database client from Chapter 3 to use async/await.
3. **Challenge:** Implement a rate limiter that allows at most 100 requests per second using the concurrency primitives from this chapter.
```

### Step 6: Manage the Draft

**Progress tracking:**

```markdown
# Draft Progress

| Chapter | Status | Word Count | Code Tested | Figures | Notes |
|---------|--------|------------|-------------|---------|-------|
| Ch 1 | ✅ Draft | 8,200 | ✅ | 2/2 | Needs intro rewrite |
| Ch 2 | ✅ Draft | 11,400 | ✅ | 3/3 | |
| Ch 3 | 🔄 In progress | 4,100 | Partial | 1/4 | Stuck on section 3.3 |
| Ch 4 | ⬜ Not started | — | — | — | |
```

**When you get stuck:**
- Skip to a different section or chapter
- Write the code example first, then explain it
- Write the summary first — knowing where you're going helps you get there
- Talk through the concept out loud and transcribe
- Read a competing book's treatment of the same topic for inspiration (not copying)
- Take a break — technical writing requires sustained concentration

**Continuity tracking:**
Keep a running document of things to check for consistency:
- Variable names and code identifiers used across chapters
- Terminology decisions (did you call it a "service" or a "microservice"?)
- Forward and backward references between chapters
- Running example state at each chapter boundary

## Techniques

### The Code-First Draft
Write all the code examples for a chapter first, test them, then write the prose around them. This ensures the code works and gives you a concrete foundation for explanations.

### The Outline Expansion Method
Start with your section outline. Expand each bullet point into a paragraph. Expand each paragraph into a section. This incremental approach prevents blank-page paralysis.

### The Teaching Session Method
Imagine you're giving a workshop on this chapter's topic. What would you say? What would you show on the screen? What questions would attendees ask? Write the chapter as if you're transcribing that workshop.

### The Two-Pass Draft
- Pass 1: Write the prose explanations without code (just [CODE: description] placeholders)
- Pass 2: Write and integrate the code examples
This separates the two different types of thinking required.

## Common Pitfalls

- **Perfectionism** — Polishing chapter 1 for weeks while chapters 2-12 don't exist. Write forward.
- **Scope creep** — A chapter that was supposed to be 20 pages becomes 50. Stick to the chapter brief. Split if necessary.
- **Code-prose imbalance** — Too much code without explanation, or too much explanation without code. Alternate regularly.
- **Losing the thread** — Forgetting what the reader knows at this point in the book. Reference your dependency graph.
- **Writing out of order without tracking** — If you write chapters non-sequentially, track what each chapter assumes the reader knows.

## Deliverables

By the end of this phase, you should have:
- A complete first draft of all chapters
- All code examples written and tested
- Figure placeholders or drafts in place
- A progress tracker showing chapter status
- A continuity document tracking cross-chapter references
- A list of known issues to address in revision

## Connection to Other Phases

- **Book Architecture** — The chapter briefs come from your architecture work
- **Voice & Style** — Apply your style guide consistently across chapters
- **Explanation Craft** — Use explanation techniques for every concept
- **Code Examples** — Integrate tested code listings as you draft
- **Visuals & Diagrams** — Reference planned figures and create placeholders
- **Running Example** — Advance the running example in each relevant chapter
