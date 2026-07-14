---
name: karpathy-mode
description: "Behavioral guidelines to reduce common LLM coding mistakes. Use when writing, reviewing, or refactoring code to avoid overcomplication, make surgical changes, surface assumptions, and define verifiable success criteria."
---

# Karpathy Mode

## Overview

Behavioral guidelines to reduce common LLM coding mistakes, derived from [Andrej Karpathy's observations](https://x.com/karpathy/status/2015883857489522876) on LLM coding pitfalls. Use when writing, reviewing, or refactoring code to avoid overcomplication, make surgical changes, surface assumptions, and define verifiable success criteria.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Anti-Patterns Summary

| Principle | Anti-Pattern | Fix |
|-----------|-------------|-----|
| Think Before Coding | Silently assumes file format, fields, scope | List assumptions explicitly, ask for clarification |
| Simplicity First | Strategy pattern for single discount calculation | One function until complexity is actually needed |
| Surgical Changes | Reformats quotes, adds type hints while fixing bug | Only change lines that fix the reported issue |
| Goal-Driven | "I'll review and improve the code" | "Write test for bug X → make it pass → verify no regressions" |

## Key Insight

Good code is code that solves today's problem simply, not tomorrow's problem prematurely. LLMs are exceptionally good at looping until they meet specific goals — don't tell them what to do, give them success criteria and watch them go.

## Examples

Real-world code examples demonstrating the four principles. Each example shows what LLMs commonly do wrong and how to fix it.

### 1. Think Before Coding

#### Hidden Assumptions

**User Request:** "Add a feature to export user data"

**❌ Wrong (Hidden Assumptions)**

```python
def export_users(format='json'):
    """Export all users to a file."""
    users = User.query.all()
    
    if format == 'json':
        with open('users.json', 'w') as f:
            json.dump([u.to_dict() for u in users], f)
    elif format == 'csv':
        with open('users.csv', 'w') as f:
            writer = csv.DictWriter(f, fieldnames=['id', 'email', 'name'])
            writer.writeheader()
            writer.writerows([u.to_dict() for u in users])
    
    return f"Exported {len(users)} users"
```

Problems: Assumed ALL users (privacy?), assumed file location, assumed which fields, assumed CSV fieldnames without checking data structure.

**✅ Right (Surface Assumptions)**

```
Before implementing, I need to clarify:

1. **Scope**: Export all users or filtered subset? (privacy implications)
2. **Format**: Download file in browser? Background job? API endpoint?
3. **Fields**: Which user fields? (some might be sensitive)
4. **Volume**: How many users typically? (affects approach)

Simplest approach: Add an API endpoint that returns paginated JSON.
What's your preference?
```

#### Multiple Interpretations

**User Request:** "Make the search faster"

**❌ Wrong (Pick Silently)** — Adds caching, indexes, and async without asking which "faster" matters.

**✅ Right** — Present the options:

```
"Make the search faster" could mean:

1. **Faster response time** (< 100ms instead of 500ms)
   → Add database indexes, cache frequent queries

2. **Handle more concurrent searches** (throughput)
   → Add async/await, connection pooling

3. **Faster perceived speed** (UX)
   → Show partial results immediately, progressive loading

Current search takes ~500ms. Which aspect matters most?
```

### 2. Simplicity First

#### Over-abstraction

**User Request:** "Add a function to calculate discount"

**❌ Wrong (Overengineered)** — Strategy pattern, ABC, dataclass config, 50+ lines:

```python
class DiscountStrategy(ABC):
    @abstractmethod
    def calculate(self, amount: float) -> float: ...

class PercentageDiscount(DiscountStrategy): ...
class FixedDiscount(DiscountStrategy): ...

@dataclass
class DiscountConfig:
    strategy: DiscountStrategy
    min_purchase: float = 0.0
    max_discount: float = float('inf')

class DiscountCalculator:
    def __init__(self, config: DiscountConfig): ...
    def apply_discount(self, amount: float) -> float: ...
```

**✅ Right (Simple)**

```python
def calculate_discount(amount: float, percent: float) -> float:
    """Calculate discount amount. percent should be 0-100."""
    return amount * (percent / 100)
```

Add complexity only when you actually need multiple discount types.

#### Speculative Features

**User Request:** "Save user preferences to database"

**❌ Wrong** — Adds caching, validation, merging, notifications nobody asked for.

**✅ Right (Just What Was Asked)**

```python
def save_preferences(db, user_id: int, preferences: dict):
    """Save user preferences to database."""
    db.execute(
        "UPDATE users SET preferences = ? WHERE id = ?",
        (json.dumps(preferences), user_id)
    )
```

Add caching when performance matters, validation when bad data appears, merging when the requirement emerges.

### 3. Surgical Changes

#### Drive-by Refactoring

**User Request:** "Fix the bug where empty emails crash the validator"

**❌ Wrong (Too Much)** — Also "improves" email validation, adds username checks, changes comments, adds docstring.

**✅ Right (Surgical)**

```diff
  def validate_user(user_data):
      # Check email format
-     if not user_data.get('email'):
+     email = user_data.get('email', '')
+     if not email or not email.strip():
          raise ValueError("Email required")
      
      # Basic email validation
-     if '@' not in user_data['email']:
+     if '@' not in email:
          raise ValueError("Invalid email")
```

Only changed the specific lines that fix empty email handling.

#### Style Drift

**User Request:** "Add logging to the upload function"

**❌ Wrong** — Also changes quote style, adds type hints, adds docstring, reformats whitespace, changes boolean logic.

**✅ Right (Match Existing Style)**

```diff
+ import logging
+ logger = logging.getLogger(__name__)
+ 
  def upload_file(file_path, destination):
+     logger.info(f'Starting upload: {file_path}')
      try:
          with open(file_path, 'rb') as f:
              data = f.read()
          response = requests.post(destination, files={'file': data})
          if response.status_code == 200:
+             logger.info(f'Upload successful: {file_path}')
              return True
          else:
+             logger.error(f'Upload failed: {file_path}, status={response.status_code}')
              return False
      except Exception as e:
-         print(f"Error: {e}")
+         logger.exception(f'Upload error: {file_path}')
          return False
```

Matched: Single quotes, no type hints, existing boolean pattern, spacing style.

### 4. Goal-Driven Execution

#### Vague vs. Verifiable

**User Request:** "Fix the authentication system"

**❌ Wrong** — "I'll review the code, identify issues, make improvements, and test." (No clear success criteria.)

**✅ Right (Verifiable Goals)**

```
If the issue is "users stay logged in after password change":

Plan:
1. Write test: Change password → verify old session invalidated
   Verify: Test fails (reproduces bug)
2. Implement: Invalidate sessions on password change
   Verify: Test passes
3. Check edge cases: Multiple active sessions, concurrent changes
   Verify: Additional tests pass
4. Verify no regression: Existing auth tests still pass
```

#### Test-First Verification

**User Request:** "The sorting breaks when there are duplicate scores"

**❌ Wrong** — Immediately changes sort logic without confirming the bug.

**✅ Right (Reproduce First)**

```python
# 1. Write a test that reproduces the issue
def test_sort_with_duplicate_scores():
    scores = [
        {'name': 'Alice', 'score': 100},
        {'name': 'Bob', 'score': 100},
        {'name': 'Charlie', 'score': 90},
    ]
    result = sort_scores(scores)
    # Bug: order is non-deterministic for duplicates
    assert result[0]['score'] == 100
    assert result[1]['score'] == 100
    assert result[2]['score'] == 90

# Verify: Run test 10 times → fails with inconsistent ordering

# 2. Now fix with stable sort
def sort_scores(scores):
    """Sort by score descending, then name ascending for ties."""
    return sorted(scores, key=lambda x: (-x['score'], x['name']))

# Verify: Test passes consistently
```

## Troubleshooting

**Agent keeps adding unrequested features:** Restate the task with explicit boundaries: "Only change X. Do not modify Y or Z."

**Agent reformats adjacent code:** Remind it of the surgical changes principle: every changed line must trace to the user's request.

**Agent can't define success criteria:** The task is too vague. Break it into smaller, verifiable steps.

## Reference Pointers

Load these only when the workflow calls for them (progressive disclosure):

- `references/examples.md` — Examples
