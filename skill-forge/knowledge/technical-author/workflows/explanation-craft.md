# Explanation Craft

## Overview

The core skill of technical writing isn't knowing the technology — it's explaining it. A technical book lives or dies on the quality of its explanations. This phase covers the techniques for making complex concepts clear, building mental models in the reader's mind, and managing cognitive load so the reader learns without drowning.

## Workflow: Building Clear Explanations

### Step 1: Identify What Needs Explaining

Not everything in a technical book requires the same depth of explanation:

**Concept types:**
- **New vocabulary** — Terms the reader hasn't encountered. Define clearly on first use.
- **New mental models** — Ways of thinking the reader doesn't have yet. These need the most care.
- **New techniques** — How to do something. Show, don't just tell.
- **New tradeoffs** — When to use what. Requires context and judgment.
- **Corrections** — Things the reader probably believes that are wrong or incomplete. Handle with care — nobody likes being told they're wrong.

**For each concept, assess:**
- How far is this from what the reader already knows? (The bigger the gap, the more scaffolding needed)
- Is this concept a prerequisite for later material? (If yes, invest more in the explanation)
- Can the reader look this up elsewhere? (If yes, you can be briefer)

### Step 2: Choose an Explanation Strategy

Different concepts call for different approaches:

**Definition + Example:**
Best for: New vocabulary, simple concepts
Pattern: State what it is, then show it in action.

"A *middleware* is a function that sits between the incoming request and your route handler. It can inspect, modify, or reject the request before it reaches your code."

```python
def logging_middleware(request, next):
    print(f"Received: {request.method} {request.path}")
    response = next(request)
    print(f"Responded: {response.status}")
    return response
```

**Analogy Bridge:**
Best for: New mental models, abstract concepts
Pattern: Connect to something the reader already understands, then show where the analogy breaks down.

"Think of a message queue like a to-do list shared between teams. One team adds tasks, another team works through them at their own pace. The list decouples the teams — the producers don't wait for the consumers, and the consumers don't need to know who created the work. Unlike a to-do list, though, each message is typically processed by exactly one consumer, and the queue guarantees ordering."

**Contrast:**
Best for: Distinguishing similar concepts, correcting misconceptions
Pattern: Show two things side by side and highlight the differences.

"Concurrency and parallelism are often confused, but they solve different problems. Concurrency is about *structure* — organizing your program to handle multiple tasks. Parallelism is about *execution* — actually running multiple tasks at the same time. You can have concurrency without parallelism (a single-core CPU switching between tasks) and parallelism without concurrency (a GPU running the same operation on thousands of data points)."

**Progressive Disclosure:**
Best for: Complex systems, multi-layered concepts
Pattern: Start with the simplest version, then add layers of complexity.

1. "At its simplest, a database transaction groups multiple operations into one atomic unit."
2. "But 'atomic' has specific guarantees — the ACID properties..."
3. "In distributed systems, full ACID becomes expensive. That's where eventual consistency enters..."
4. "The CAP theorem formalizes the tradeoffs..."

**Problem-Solution:**
Best for: Techniques, patterns, best practices
Pattern: Present the problem the reader feels, then introduce the solution.

"You've probably written code like this: [messy example]. It works, but it's fragile — any change to the data format breaks everything downstream. The Repository pattern solves this by..."

**Visual Explanation:**
Best for: Architectures, data flows, state machines, algorithms
Pattern: Describe what a diagram shows, walk through it step by step.

"Figure 3-1 shows the request lifecycle. Follow the numbered arrows: ❶ The client sends an HTTP request. ❷ The load balancer routes it to a server. ❸ The server checks the cache..."

### Step 3: Manage Cognitive Load

The reader's working memory is limited. Respect it:

**Chunking:**
- Break complex explanations into discrete steps
- Each step should be small enough to hold in working memory
- Number the steps so the reader can track progress
- Summarize after a sequence of steps

**Scaffolding:**
- Build on what the reader already knows
- Introduce one new concept at a time
- Don't combine a new concept with a new syntax in the same example
- When showing complex code, start with a simplified version

**Signposting:**
- Tell the reader what's coming ("In this section, we'll cover three approaches to...")
- Tell them where they are ("Now that we understand the basics, let's look at...")
- Tell them what they can skip ("If you're already familiar with X, skip to section Y")

**Repetition (strategic):**
- Restate key concepts in different words at different points
- Summarize at the end of each section and chapter
- Reference earlier explanations when building on them ("Recall from Chapter 3 that...")

### Step 4: Handle the "Why"

Technical books that only explain "how" are reference manuals. Books that also explain "why" are the ones readers remember and recommend.

**For every technique or pattern, address:**
- Why does this exist? What problem motivated it?
- Why this approach instead of alternatives?
- Why does it work the way it does? (Design decisions, tradeoffs)
- When should you not use it? (Limitations, counter-indications)

**The "why" hierarchy:**
1. **Immediate why** — Why are we doing this right now in the tutorial?
2. **Technical why** — Why does this technology work this way?
3. **Historical why** — What led to this design decision?
4. **Strategic why** — Why would you choose this over alternatives in a real project?

You don't need all four for every concept, but the best technical books touch on multiple levels.

### Step 5: Use Concrete Before Abstract

The human brain learns from specific examples before generalizing to abstract principles:

**Wrong order:**
"The Observer pattern defines a one-to-many dependency between objects so that when one object changes state, all its dependents are notified. [Then shows example]"

**Right order:**
"Imagine you have a spreadsheet cell that displays a chart. When the data changes, the chart needs to update. You could have the data check for charts every time it changes, but that couples the data to every possible display. Instead, the chart *subscribes* to the data and gets notified of changes. That's the Observer pattern."

**The pattern:**
1. Concrete scenario the reader can visualize
2. The problem that arises
3. The solution in concrete terms
4. The generalized principle
5. The formal name or definition

### Step 6: Write Effective Transitions

Transitions between topics are where readers get lost. Bridge every gap:

**Between sections within a chapter:**
"Now that we can create individual records, we need a way to query them efficiently. That's where indexes come in."

**Between chapters:**
End each chapter with a forward reference: "We've built the data layer. In the next chapter, we'll add the API that exposes it to clients."

**Between concepts:**
"Authentication tells us *who* the user is. But knowing who they are isn't enough — we also need to know what they're *allowed to do*. That's authorization."

## Techniques

### The Feynman Technique
Try to explain the concept to someone with no background in it. Where you struggle to simplify, you've found the hard parts that need the most attention in your writing.

### The Question-Answer Method
Before writing an explanation, list the questions a reader would ask:
- What is this?
- Why do I need it?
- How does it work?
- How do I use it?
- What can go wrong?
- When should I not use it?

Answer each question in order. That's your explanation.

### The Before/After Method
Show code or a system before applying the concept, then after. The contrast makes the value of the concept tangible.

### The Misconception Preempt
Identify the most common misconceptions about a topic and address them proactively: "You might think X, but actually Y, because Z."

## Common Pitfalls

- **Assuming knowledge** — The most common failure. If you're not sure whether the reader knows something, explain it briefly or provide a reference.
- **Explaining too much** — The opposite problem. If the reader already knows something, a lengthy explanation is patronizing. Know your audience.
- **Abstract without concrete** — Definitions and principles without examples. Always ground abstractions in specifics.
- **Code without explanation** — A code listing is not an explanation. Walk the reader through what the code does and why.
- **Explanation without code** — For a technical book, prose explanations need to be grounded in working examples.

## Deliverables

By the end of this phase, you should have:
- A catalog of key concepts in your book ranked by explanation difficulty
- Chosen explanation strategies for the hardest concepts
- A cognitive load management plan (chunking, scaffolding, signposting)
- Practice explanations for 3-5 of the most challenging concepts
- Confidence in your ability to make complex ideas clear

## Connection to Other Phases

- **Voice & Style** — Your explanation approach is part of your voice
- **Code Examples** — Explanations and code work together; neither stands alone
- **Chapter Drafting** — Explanation craft is the core skill you'll use in every chapter
- **Technical Review** — Reviewers will flag explanations that don't land
