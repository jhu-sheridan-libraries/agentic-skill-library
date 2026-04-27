<!-- forge:version 0.1.6 -->
# Isolate

## Entry Criteria
- The three-sentence articulation is complete
- Reproduction steps are confirmed
- At least one hypothesis has been ruled out

## Steps

1. Shrink the problem surface. A bug in 10 lines is easier to see than a bug in 1000. Use these techniques:

   **Binary search the call stack** — add a checkpoint at the midpoint of the execution path. If the state is already wrong there, the bug is in the first half. Repeat until you find the layer where the state first goes wrong.

   **Minimal reproduction** — strip away everything unrelated to the failure. If the bug survives without the database, the network, the auth layer — remove them from your test case.

   **One variable at a time** — when testing hypotheses, change exactly one variable per attempt. Multiple simultaneous changes make it impossible to know what fixed it.

   **Read the error message completely** — the second line is often more useful than the first.

2. Keep a running log of what you tried and what you learned. This log is the debug journal — it prevents you from trying the same thing twice and helps you spot patterns.

3. If you have been stuck for 30 minutes, re-read your three sentences. The problem statement may be wrong — update it if your understanding has changed.

## Exit Criteria
- You have a reproduction that is as small as you can make it
- You know which layer of the stack first sees the wrong state
- You have at least one concrete hypothesis about root cause

## Next Phase
→ Load `journal-debug-fix-and-verify.md`