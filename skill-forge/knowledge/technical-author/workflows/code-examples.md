# Code Examples

## Overview

Code examples are the backbone of a technical book. They're not illustrations — they're the primary teaching tool. A reader who can't follow your code examples will put the book down. A reader whose code examples actually work will trust you for the rest of the book. This phase covers designing, writing, testing, and maintaining code examples that teach effectively.

## Workflow: Building Effective Code Examples

### Step 1: Define Your Code Strategy

Before writing any examples, make strategic decisions:

**Language and version:**
- Pin to a specific version (e.g., Python 3.12, Node.js 20 LTS)
- Document the version prominently (in the preface and in setup instructions)
- Choose a version that will be current at publication time

**Completeness level:**
- **Snippets** — Fragments that illustrate a concept (3-10 lines). Good for inline explanations.
- **Listings** — Complete, runnable units (10-50 lines). Good for demonstrating techniques.
- **Full examples** — Complete programs or modules. Good for chapter exercises and the running example.

**Repository strategy:**
- Will you maintain a companion code repository? (Strongly recommended)
- How is the repo organized? (By chapter, by topic, by progression)
- Does the repo contain the exact code from the book, or extended versions?
- How do you handle code that evolves across chapters?

**Dependency management:**
- Minimize external dependencies in examples
- Pin dependency versions
- Document all dependencies in a setup chapter or appendix
- Consider whether dependencies will still be available at publication time

### Step 2: Design Examples for Learning

Code examples in a book serve a different purpose than production code. Design for clarity and teaching:

**The minimal example principle:**
Show the minimum code needed to demonstrate the concept. Strip away everything that isn't directly relevant.

**Bad example (too much noise):**
```python
import os
import sys
import logging
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional, List

logger = logging.getLogger(__name__)

@dataclass
class Config:
    host: str = "localhost"
    port: int = 8080
    debug: bool = False
    log_level: str = "INFO"
    
    def validate(self):
        if self.port < 1 or self.port > 65535:
            raise ValueError(f"Invalid port: {self.port}")

# ... 30 more lines before the actual concept being taught
```

**Good example (focused on the concept):**
```python
from dataclasses import dataclass

@dataclass
class Config:
    host: str = "localhost"
    port: int = 8080
```

"The `@dataclass` decorator generates `__init__`, `__repr__`, and `__eq__` methods automatically from the field definitions. No boilerplate needed."

**The progression principle:**
Build examples incrementally. Start simple, add complexity in stages:

1. Version 1: The simplest possible version that works
2. Version 2: Add error handling
3. Version 3: Add the feature being taught
4. Version 4: Production-ready version (if relevant)

Show each version explicitly. Don't jump from simple to complex.

**The realistic principle:**
While examples should be minimal, they shouldn't be trivial. Use domain concepts the reader recognizes:

- Instead of `foo`, `bar`, `baz` → use `user`, `order`, `product`
- Instead of abstract operations → use operations the reader would actually perform
- Instead of toy data → use data that resembles real-world data

### Step 3: Write Code Listings

**Listing anatomy:**

```markdown
**Listing 4-3: Implementing retry logic with exponential backoff**

```python
import time
import random

def retry_with_backoff(fn, max_retries=3, base_delay=1.0):  # ❶
    for attempt in range(max_retries):
        try:
            return fn()  # ❷
        except Exception as e:
            if attempt == max_retries - 1:
                raise  # ❸
            delay = base_delay * (2 ** attempt)  # ❹
            jitter = random.uniform(0, delay * 0.1)
            time.sleep(delay + jitter)
```

❶ Accept any callable and configure retry behavior
❷ If the function succeeds, return immediately
❸ On the last attempt, re-raise the exception instead of retrying
❹ Exponential backoff: 1s, 2s, 4s — with jitter to prevent thundering herd
```

**Listing conventions:**
- Number listings sequentially within chapters (Listing 4-1, 4-2, 4-3)
- Give every listing a descriptive title
- Use callout markers (❶ ❷ ❸) for line-by-line explanations
- Keep listings under 30 lines when possible
- If a listing must be longer, break it into parts with explanations between

**Code evolution across listings:**
When modifying code from a previous listing, make changes visible:

```markdown
**Listing 4-4: Adding timeout support to our retry function** (changes from Listing 4-3 in bold)

```python
import time
import random
**import signal**

def retry_with_backoff(fn, max_retries=3, base_delay=1.0, **timeout=30**):
    **signal.alarm(timeout)**  # ❶
    for attempt in range(max_retries):
        try:
            return fn()
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            delay = base_delay * (2 ** attempt)
            jitter = random.uniform(0, delay * 0.1)
            time.sleep(delay + jitter)
```

❶ Set an overall timeout for all retry attempts combined
```

### Step 4: Test Every Example

Untested code examples destroy credibility. Every listing in the book should be verified:

**Testing strategy:**
- Maintain a test suite that runs every code example
- Automate testing as part of your writing workflow
- Test against the specific language/framework version you're targeting
- Test on a clean environment periodically (not just your development machine)

**Code repository structure:**

```
book-code/
├── ch01/
│   ├── listing_01_01.py
│   ├── listing_01_02.py
│   └── tests/
│       └── test_listings.py
├── ch02/
│   ├── listing_02_01.py
│   └── tests/
│       └── test_listings.py
├── requirements.txt
├── README.md
└── Makefile          # or equivalent build tool
```

**Testing approaches:**
- **Unit tests** for functions and classes shown in listings
- **Integration tests** for examples that interact with external systems
- **Smoke tests** that simply import and run each listing
- **Output verification** that checks printed output matches what the book says

**When code can't be fully tested:**
- Infrastructure code (Terraform, CloudFormation) — test with dry-run or plan commands
- UI code — test the logic, screenshot the visual result
- Database queries — test against a local database with seed data
- API calls — use mocks or a test environment

### Step 5: Maintain Code Across Drafts

Code examples evolve as you write and revise. Manage this carefully:

**Version tracking:**
- Keep the code repository in sync with the manuscript
- Tag repository versions to match manuscript milestones
- When you change a listing, update all subsequent listings that depend on it

**Dependency updates:**
- Check for dependency updates monthly during writing
- Decide whether to update (and rewrite affected examples) or pin to the original version
- Document the decision and rationale

**The running example problem:**
If your book has a running example that grows across chapters, you need a way to show the state of the code at each chapter boundary. Options:
- Git branches per chapter (`ch01`, `ch02`, etc.)
- Git tags at chapter boundaries
- Separate directories per chapter with the complete state

## Techniques

### The Copy-Paste Test
Can a reader copy your code listing, paste it into their editor, and run it? If not, what's missing? (Imports, setup, configuration, data) Either include what's missing or clearly state the prerequisites.

### The Diff Review
When showing code evolution, review the diff between versions. Is the change clear? Can the reader see exactly what changed and why? If the diff is too large, break it into smaller steps.

### The Error Example
Deliberately show code that doesn't work, then fix it. This teaches debugging skills and helps readers recognize common mistakes:

"This looks right, but it has a subtle bug:"
```python
# Bug: this creates a shared default list across all instances
class UserList:
    def __init__(self, users=[]):
        self.users = users
```

"The fix:"
```python
class UserList:
    def __init__(self, users=None):
        self.users = users if users is not None else []
```

### The Incremental Build
For complex examples, show the code being built up line by line or block by block, with explanation between each addition. This mirrors how a developer actually writes code.

## Common Pitfalls

- **Untested code** — The single most damaging mistake. Readers will find every bug.
- **Missing imports** — Show all necessary imports, at least once per chapter.
- **Inconsistent style** — Code examples should follow a consistent style throughout the book.
- **Over-engineered examples** — Production patterns (dependency injection, abstract factories) in teaching code obscure the concept being taught.
- **Platform assumptions** — Code that only works on macOS, or only with a specific IDE. Be explicit about requirements.
- **Stale dependencies** — Libraries that have breaking changes between when you wrote the example and when the reader runs it. Pin versions.

## Deliverables

By the end of this phase, you should have:
- A code strategy document (language, version, completeness level, repo structure)
- A code style guide for examples
- A companion code repository initialized and organized
- A testing strategy for code examples
- Sample listings that demonstrate your code presentation approach

## Connection to Other Phases

- **Voice & Style** — Code conventions are part of your style guide
- **Explanation Craft** — Code and prose explanations work together
- **Running Example** — The running example is the largest code example in the book
- **Chapter Drafting** — Code listings are integrated into the drafting process
- **Technical Review** — Reviewers will test your code
- **Revision & Polish** — Code correctness is verified during revision
