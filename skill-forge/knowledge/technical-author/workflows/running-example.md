# Running Example

## Overview

A running example is a cohesive project that threads through the book, growing in complexity as the reader learns new concepts. It transforms a technical book from a collection of isolated lessons into a narrative — the reader isn't just learning concepts, they're building something. The best technical books are remembered for their running examples: the bookstore in "Agile Web Development with Rails," the social network in countless web framework tutorials.

This phase covers designing, maintaining, and evolving a running example that serves the book's teaching goals without constraining them.

## When to Use a Running Example

**Use a running example when:**
- The book is tutorial or project-based
- Concepts build on each other and benefit from a shared context
- The reader should end up with something they built and understand completely
- The technology is best learned by building with it

**Don't use a running example when:**
- The book is a reference or cookbook (independent recipes work better)
- Topics are too diverse to fit a single project
- The technology doesn't lend itself to incremental building
- A running example would force artificial constraints on topic coverage

**Hybrid approach:**
Some books use a running example for core chapters and standalone examples for advanced or optional topics. This gives you the narrative benefits without the constraints.

## Workflow: Designing the Running Example

### Step 1: Choose the Domain

The running example's domain should be:

**Familiar enough** that the reader doesn't need to learn the domain to learn the technology. Good domains:
- E-commerce (products, orders, users, payments)
- Task/project management (tasks, users, teams, deadlines)
- Content management (posts, comments, users, media)
- Chat/messaging (messages, channels, users, notifications)
- Inventory/warehouse (items, locations, movements, reports)

**Rich enough** to support the concepts you need to teach. The domain should naturally require:
- The data structures you want to demonstrate
- The patterns you want to teach
- The complexity levels you need to reach
- The integrations or features you want to show

**Not so interesting** that it distracts from the technology. The domain is a vehicle for learning, not the destination.

### Step 2: Define the Project Scope

Map the running example to your chapter structure:

```markdown
# Running Example: {Project Name}

## Domain: {e.g., Online Bookstore}

## Project State by Chapter

### Chapter 1: Setup
- Initialize project structure
- Basic configuration
- "Hello world" equivalent

### Chapter 2: Data Model
- Define core entities (Book, Author, Category)
- Set up database schema
- Seed data for development

### Chapter 3: Basic CRUD
- Create, read, update, delete operations for Books
- Simple API endpoints or UI

### Chapter 4: Authentication
- User registration and login
- Protected routes/endpoints

### Chapter 5: Search & Filtering
- Full-text search for books
- Category filtering, pagination

### Chapter 6: Shopping Cart
- Cart management
- Session handling

### Chapter 7: Order Processing
- Checkout flow
- Payment integration (mocked)

### Chapter 8: Background Jobs
- Order confirmation emails
- Inventory updates

### Chapter 9: Testing
- Unit tests for business logic
- Integration tests for API
- End-to-end tests

### Chapter 10: Deployment
- Production configuration
- CI/CD pipeline
- Monitoring setup
```

### Step 3: Design the Data Model

Start with the complete data model, even though the reader won't see all of it until later chapters:

```markdown
# Complete Data Model

## Core Entities
- **Book**: id, title, author_id, isbn, price, description, published_date
- **Author**: id, name, bio
- **Category**: id, name, parent_id
- **User**: id, email, password_hash, name, role

## Introduced in Later Chapters
- **Cart**: id, user_id, created_at
- **CartItem**: id, cart_id, book_id, quantity
- **Order**: id, user_id, status, total, created_at
- **OrderItem**: id, order_id, book_id, quantity, price_at_purchase

## Relationships
- Book belongs to Author (many-to-one)
- Book has many Categories (many-to-many via BookCategory)
- User has one Cart
- Cart has many CartItems
- Order has many OrderItems
```

**Design principles:**
- Start simple — the initial model should have 2-3 entities
- Add entities as the book introduces concepts that need them
- Don't introduce entities before they're needed
- Keep the model realistic but not over-engineered

### Step 4: Plan the Code Evolution

The running example's code evolves across chapters. Plan how:

**Code state management:**

Option A: **Additive chapters** — Each chapter adds new files/features without modifying existing code much. Easier for the reader to follow.

Option B: **Refactoring chapters** — Some chapters refactor existing code to introduce better patterns. More realistic but harder to follow.

Option C: **Hybrid** — Mostly additive, with occasional refactoring chapters that are clearly marked.

**Repository branching strategy:**

```
main (final state of the project)
├── ch01-setup
├── ch02-data-model
├── ch03-basic-crud
├── ch04-authentication
├── ch05-search
├── ch06-cart
├── ch07-orders
├── ch08-background-jobs
├── ch09-testing
└── ch10-deployment
```

Each branch represents the state of the project at the end of that chapter. The reader can check out any branch to see the complete code at that point.

### Step 5: Create Starter and Checkpoint Code

**Starter code:**
What the reader begins with at the start of each chapter. This should be the end state of the previous chapter.

**Checkpoint code:**
The complete, working code at the end of each chapter. The reader can compare their work against this.

**Provide both in the companion repository:**

```markdown
# Repository Structure

book-code/
├── starter/           # Starting point for each chapter
│   ├── ch01/
│   ├── ch02/
│   └── ...
├── complete/          # Finished state for each chapter
│   ├── ch01/
│   ├── ch02/
│   └── ...
└── README.md          # Setup instructions and chapter guide
```

### Step 6: Handle the Complexity Ramp

The running example should feel manageable at every stage:

**Early chapters (simple):**
- Few files, minimal configuration
- The reader can hold the entire project in their head
- Focus on one concept at a time

**Middle chapters (growing):**
- More files, more moving parts
- The reader needs the project structure to navigate
- Introduce organizational patterns (modules, packages, layers)

**Late chapters (complex):**
- The project resembles a real application
- The reader relies on the architecture to manage complexity
- This is where the payoff happens — they've built something substantial

**Complexity management techniques:**
- Provide a project structure diagram at the start of each chapter
- Show only the files that change in each chapter
- Use clear naming conventions so the reader can find things
- Include a "where we are" summary at the start of each chapter

## Techniques

### The Feature Slice Approach
Each chapter adds a complete vertical slice of functionality (from UI/API to database). This gives the reader a sense of accomplishment with each chapter and keeps the project functional at every stage.

### The Scaffolding Technique
Provide pre-built scaffolding for parts of the project that aren't the focus of the current chapter. If Chapter 5 is about search, provide the UI components pre-built so the reader can focus on the search implementation.

### The "Real World" Sidebar
Periodically note how the running example differs from a production application: "In a real application, you'd also handle [X], but we're keeping things focused on [Y] for now. We'll address [X] in Chapter [N]."

### The Reset Point
At the start of each chapter, tell the reader how to get to the right starting state if they're jumping in mid-book or if something went wrong: "If you want to start fresh from this chapter, check out the `ch05-start` branch from the companion repository."

## Common Pitfalls

- **Over-scoped example** — A running example that's too ambitious becomes a burden. Keep it simple enough that the technology is the focus, not the application.
- **Under-scoped example** — A running example that's too trivial doesn't demonstrate real-world usage. It should be complex enough to encounter real problems.
- **Broken intermediate states** — The project should work at the end of every chapter. If Chapter 5's code doesn't run without Chapter 6's changes, you have a problem.
- **Domain complexity** — If the reader spends more time understanding the business logic than the technology, the domain is too complex.
- **Artificial constraints** — Don't force a concept into the running example if it doesn't fit naturally. Use a standalone example instead.

## Deliverables

By the end of this phase, you should have:
- A chosen domain with rationale
- A project scope mapped to chapters
- A complete data model (even if introduced incrementally)
- A code evolution plan (additive, refactoring, or hybrid)
- A companion repository with starter and checkpoint code
- A complexity management strategy

## Connection to Other Phases

- **Book Architecture** — The running example maps directly to the chapter structure
- **Code Examples** — The running example is the largest code example; standalone examples supplement it
- **Chapter Drafting** — Each chapter advances the running example
- **Technical Review** — Reviewers should be able to build the running example from scratch
- **Revision & Polish** — Verify the running example works end-to-end during revision
