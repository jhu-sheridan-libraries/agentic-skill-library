<!-- forge:version 0.1.1 -->

The fastest path through a bug is rarely the first one you see. Before touching code, articulate the problem precisely. Writing forces clarity that browsing stack traces does not.

## The three-sentence rule

Before debugging, write three sentences:
1. What I expected to happen
2. What actually happened
3. What I already know it is not

If you can't write sentence three, you haven't started investigating yet.

## Phases

Follow the workflows below in order. Skipping phases is fine once you've found the root cause — but jumping to "fix" before "isolate" is how you patch symptoms.

## 01 Articulate

# Articulate

Before touching any code, write down:

1. **Observed behaviour** — exactly what happens, including any error messages verbatim
2. **Expected behaviour** — what should have happened instead
3. **Reproduction steps** — the minimal sequence that reliably triggers the bug
4. **What it is not** — list hypotheses you have already ruled out and how

If you cannot write a reliable reproduction sequence, do that first. A bug you cannot reproduce is a bug you cannot fix.

## Checkpoint

You are ready to move on when:
- [ ] Reproduction steps are written down and confirmed to work from a clean state
- [ ] At least one hypothesis has been ruled out
- [ ] The problem is stated in terms of behaviour, not code ("the response is empty" not "line 42 crashes")

## 02 Isolate

# Isolate

Shrink the problem surface. A bug in 10 lines is easier to see than a bug in 1000.

## Techniques

**Binary search the call stack** — add a checkpoint at the midpoint of the execution path. If the state is already wrong there, the bug is in the first half. Repeat.

**Minimal reproduction** — strip away everything unrelated to the failure. If the bug survives without the database, the network, the auth layer — remove them from your test case.

**Vary one thing at a time** — when testing hypotheses, change exactly one variable per attempt. Multiple simultaneous changes make it impossible to know what fixed it.

**Read the error message completely** — the second line is often more useful than the first.

## Checkpoint

You are ready to move on when:
- [ ] You have a reproduction that is as small as you can make it
- [ ] You know which layer of the stack first sees the wrong state
- [ ] You have at least one concrete hypothesis about root cause

## 03 Fix And Verify

# Fix and Verify

Apply the fix, then verify it actually solves the root cause — not just the symptom.

## Before committing

1. **Re-run the reproduction case** — confirm the bug no longer occurs
2. **Check adjacent behaviour** — does anything nearby break?
3. **Consider the failure mode** — could this same mistake exist elsewhere in the codebase?
4. **Write a test** — if the bug had a test, it would have been caught. Add one now.

## The commit message

Describe the root cause, not the fix. "Prevent null dereference" is not a root cause — "Catalog scanner returned null for artifacts with no evals/ dir" is.

## After the fix

Update your debug journal entry with:
- What the root cause actually was
- How it differed from your initial hypothesis
- What would have caught this earlier
