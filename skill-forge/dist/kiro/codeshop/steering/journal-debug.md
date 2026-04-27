<!-- forge:version 0.1.7 -->
# Journal Debug

A systematic debugging workflow — articulate the problem before chasing the solution. Writing forces clarity that browsing stack traces does not. The fastest path through a bug is rarely the first one you see.

## When to Use

- The user hits a bug, test failure, or unexpected behaviour
- The user mentions "debug this," "why is this broken," or "investigate bug"
- The user wants a systematic approach to debugging rather than trial-and-error
- The user asks for a debug journal or debugging methodology

## Prerequisites

- A reproducible bug, test failure, or unexpected behaviour
- Willingness to write before coding — the three-sentence rule is non-negotiable

## Phases

### Phase 1 — Articulate
Write the three sentences. Establish reproduction steps. Rule out at least one hypothesis before proceeding.
→ Load `journal-debug-articulate.md`

### Phase 2 — Isolate
Shrink the problem surface. Binary search the call stack, build a minimal reproduction, vary one thing at a time.
→ Load `journal-debug-isolate.md`

### Phase 3 — Fix and Verify
Apply the fix, verify it solves the root cause (not just the symptom), write a regression test, and update the journal.
→ Load `journal-debug-fix-and-verify.md`

---

## Reference: The Three-Sentence Rule

Before debugging, write three sentences:

1. **What I expected to happen**
2. **What actually happened**
3. **What I already know it is not**

If you can't write sentence three, you haven't started investigating yet. Do NOT proceed to isolation until all three sentences are written and at least one hypothesis is ruled out.

### Good Example

1. I expected the API to return 200 with a user object when given a valid session token
2. It returns 401 with "session expired" even though the token was created 5 seconds ago
3. It is not a token format issue (verified by decoding the JWT) and not a clock skew issue (server and client times match)

### Bad Example

1. It should work
2. It doesn't work
3. I don't know why

---

## Reference: Best Practices

- **Write the three sentences before touching any code** — this is the single most important step
- **Isolate before you fix** — reproduce the bug in the smallest possible context
- **One variable at a time** — change one thing, observe, then change the next
- **Keep a running log** of what you tried and what you learned
- **If you've been stuck for 30 minutes**, re-read your three sentences — the problem statement may be wrong
- **Read the error message completely** — the second line is often more useful than the first

---

## Reference: Isolation Techniques

**Binary search the call stack** — add a checkpoint at the midpoint of the execution path. If the state is already wrong there, the bug is in the first half. Repeat.

**Minimal reproduction** — strip away everything unrelated to the failure. If the bug survives without the database, the network, the auth layer — remove them from your test case.

**Vary one thing at a time** — when testing hypotheses, change exactly one variable per attempt. Multiple simultaneous changes make it impossible to know what fixed it.

---

## Reference: Fix and Verify Checklist

Before committing:
1. **Re-run the reproduction case** — confirm the bug no longer occurs
2. **Check adjacent behaviour** — does anything nearby break?
3. **Consider the failure mode** — could this same mistake exist elsewhere in the codebase?
4. **Write a test** — if the bug had a test, it would have been caught. Add one now.

### The Commit Message

Describe the root cause, not the fix. "Prevent null dereference" is not a root cause — "Catalog scanner returned null for artifacts with no evals/ dir" is.

### After the Fix

Update your debug journal entry with:
- What the root cause actually was
- How it differed from your initial hypothesis
- What would have caught this earlier

---

## Troubleshooting

**Can't write sentence 3:** You haven't investigated yet. Run the failing case, read the error output, check logs. Come back when you can rule something out.

**Root cause found but fix breaks other tests:** You isolated correctly but the fix is too broad. Narrow the fix to only the failing case and re-run the full suite.

**Stuck in a loop:** If you've tried the same approach three times, step back. Re-read your three sentences. The problem statement may need updating.