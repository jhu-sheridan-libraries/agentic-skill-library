# Voice & Style

## Overview

Technical writing has a reputation for being dry. It doesn't have to be. The best technical books have a distinct voice — authoritative but approachable, precise but not pedantic. This phase defines the prose style, tone, code conventions, and pedagogical approach that will make your manuscript consistent and readable across hundreds of pages.

## Workflow: Defining Your Technical Voice

### Step 1: Choose Your Narrative Stance

How do you relate to the reader?

- **The Guide** ("We'll build this together") — Collaborative, walks alongside the reader. Uses "we" and "let's." Good for tutorial-style books.
- **The Expert** ("Here's how it works") — Authoritative, explains from a position of knowledge. Uses "you" for the reader, third person for concepts. Good for reference and deep-dive books.
- **The Mentor** ("I've been where you are") — Personal, shares experience and war stories. Uses "I" and "you." Good for opinionated and experience-based books.
- **The Teacher** ("By the end of this chapter, you'll understand...") — Structured, learning-objective driven. Uses "you" and direct instruction. Good for textbook-style books.

Most technical books blend these, but one should dominate. Choose your primary stance and note where you'll shift.

### Step 2: Set the Tone

Where does your prose fall on these spectrums?

**Formality:**
- Casual ("Let's fire up the REPL and see what happens")
- Conversational ("You might be wondering why this matters")
- Professional ("This section examines the tradeoffs between...")
- Academic ("The following theorem establishes...")

**Humor:**
- None — Straight technical prose throughout
- Occasional — A light touch to keep things human
- Wry — Dry observations about the absurdities of software development
- Frequent — Humor is part of the voice (use carefully — it can age poorly)

**Personality:**
- Invisible — The prose gets out of the way; the content speaks
- Present — The author's perspective and opinions are part of the value
- Strong — The author's personality is a selling point (think "The Pragmatic Programmer")

**Confidence:**
- Hedged ("This approach might work well for...") — Appropriate for contested topics
- Direct ("Use this approach when...") — Appropriate for established best practices
- Opinionated ("Don't do this. Here's why.") — Appropriate for experience-based advice

### Step 3: Establish Prose Conventions

Define the mechanical aspects of your writing:

**Sentence structure:**
- Prefer short, clear sentences for explanations
- Use longer sentences sparingly for nuanced points
- One idea per sentence as a default
- Active voice over passive ("The function returns a list" not "A list is returned by the function")

**Vocabulary:**
- Define technical terms on first use
- Use consistent terminology throughout (don't alternate between "function" and "method" for the same concept unless the distinction matters)
- Avoid jargon that isn't necessary
- When jargon is necessary, explain it

**Paragraph structure:**
- Lead with the main point
- One topic per paragraph
- Keep paragraphs short (3-6 sentences for technical content)
- Use transitional sentences between sections

**Person and tense:**
- "You" for the reader (almost always)
- "We" for collaborative walkthroughs (if using the Guide stance)
- Present tense for describing how things work ("The compiler checks types at...")
- Past tense for historical context ("Version 2.0 introduced...")
- Imperative for instructions ("Open the file and add...")

### Step 4: Define Code Conventions

Code examples are as much a part of your voice as prose:

**Code style:**
- Language and version (e.g., Python 3.11+, TypeScript 5.x)
- Formatting standard (e.g., Black for Python, Prettier for TypeScript)
- Naming conventions used in examples
- Comment style and density

**Code presentation:**
- How much code per listing? (Keep listings focused — 5-30 lines is ideal)
- Do you show complete files or relevant snippets?
- How do you indicate code changes between listings? (Bold, annotations, callouts)
- Do you use line numbers?

**Code annotations:**
- Inline comments for brief explanations
- Callout annotations for detailed explanations (numbered markers in code, explanations below)
- Prose before or after the listing for context

**Example:**
```
// ❶ Create the client with retry configuration
const client = new Client({
  retries: 3,           // ❷
  timeout: 5000,
});

// ❸ The connection is lazy — nothing happens until the first request
```

❶ We configure the client at creation time, not per-request
❷ Three retries with exponential backoff is a reasonable default for most APIs
❸ This is important — don't assume the connection is live after construction

### Step 5: Establish Pedagogical Patterns

How do you teach? Define your recurring patterns:

**Concept introduction pattern:**
1. Motivate — Why does the reader need to know this?
2. Explain — What is it, in plain language?
3. Show — Demonstrate with a concrete example
4. Deepen — Add nuance, edge cases, and caveats
5. Connect — How does this relate to what they already know?

**The "explain like I'm a developer" test:**
For every concept, ask: "If a competent developer who doesn't know this specific technology asked me to explain it, what would I say?" That's your starting point.

**Callout boxes / sidebars:**
Define types you'll use consistently:

- **Note** — Additional context that's useful but not essential
- **Warning** — Something that will bite the reader if they're not careful
- **Tip** — A shortcut or best practice
- **Deep Dive** — Optional detailed explanation for curious readers
- **Historical Context** — Why something is the way it is

**Analogies and metaphors:**
- Use them to bridge from known to unknown
- Draw from software concepts the reader already understands
- Avoid forced or overextended analogies
- Be consistent — if you compare a message queue to a postal system, maintain that metaphor

### Step 6: Write a Style Sample

Before committing to the full manuscript, write 2,000-3,000 words in your chosen style. Pick a section from the middle of the book.

**Evaluate the sample:**
- Does it sound like you? (Authenticity matters)
- Is it clear to someone in your target audience?
- Can you sustain this voice for 300+ pages?
- Does the code presentation work?
- Is the pacing right — not too fast, not too slow?

If it doesn't feel right, adjust and try again.

## Techniques

### The Mentor Text Method
Identify 2-3 technical books whose style you admire. Analyze their prose: sentence structure, tone, how they introduce concepts, how they handle code. Use them as calibration points.

**Well-regarded technical writing styles to study:**
- Martin Kleppmann ("Designing Data-Intensive Applications") — Clear, thorough, well-structured
- Brian Kernighan ("The C Programming Language") — Sparse, precise, elegant
- Dave Thomas & Andy Hunt ("The Pragmatic Programmer") — Conversational, opinionated, memorable
- Julia Evans (blog/zines) — Enthusiastic, visual, accessible
- Sandi Metz ("Practical Object-Oriented Design") — Warm, methodical, example-driven

### The Read-Aloud Test
Read your prose aloud. Technical writing that sounds natural when spoken is almost always clearer than writing that only works on the page.

### The Jargon Audit
Highlight every technical term in a passage. For each one, ask: "Have I defined this? Does the reader know this term at this point in the book?" If not, either define it or restructure.

## Common Pitfalls

- **The curse of knowledge** — You know the topic so well that you skip steps the reader needs. Have someone less familiar read your drafts.
- **Inconsistent terminology** — Using different words for the same concept. Create a terminology glossary and stick to it.
- **Passive voice overuse** — "The request is processed by the server" is weaker than "The server processes the request."
- **Hedging everything** — "It might be a good idea to perhaps consider..." Just say it directly.
- **Code without context** — Dropping a code listing without explaining what it does or why the reader should care.

## Deliverables

By the end of this phase, you should have:
- A defined narrative stance and tone
- Prose conventions documented (sentence style, vocabulary, person/tense)
- Code conventions documented (style, presentation, annotations)
- Pedagogical patterns defined (concept introduction, callout types, analogy approach)
- A 2,000-3,000 word style sample that feels right
- 2-3 mentor texts for reference

## Next Phase

With your voice defined, move to **explanation-craft** to master the techniques for explaining complex technical concepts.
