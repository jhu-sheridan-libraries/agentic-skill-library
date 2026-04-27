<!-- forge:version 0.1.7 -->
# Articulate

## Entry Criteria
- A bug, test failure, or unexpected behavior has been encountered
- The codeshop power is active and the journal-debug workflow has been loaded

## Steps

1. Before touching any code, enforce the **three-sentence rule**. Write down:
   1. **What I expected to happen** — the correct behavior, stated precisely
   2. **What actually happened** — the observed behavior, including error messages verbatim
   3. **What I already know it is not** — hypotheses already ruled out and how

   Do NOT proceed to isolation until all three sentences are written.

2. If you cannot write sentence 3, you have not started investigating yet. Run the failing case, read the error output, check logs. Come back when you can rule something out.

3. Write reproduction steps — the minimal sequence that reliably triggers the bug. If you cannot write a reliable reproduction sequence, do that first. A bug you cannot reproduce is a bug you cannot fix.

4. State the problem in terms of behavior, not code. _"The response is empty"_ — not _"line 42 crashes."_

## Exit Criteria
- All three sentences are written with specificity
- At least one hypothesis has been ruled out
- Reproduction steps are written and confirmed to work from a clean state
- The problem is stated in terms of behavior

## Next Phase
→ Load `journal-debug-isolate.md`