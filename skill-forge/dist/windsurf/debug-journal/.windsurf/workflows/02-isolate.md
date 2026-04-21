<!-- forge:version 0.1.0 -->
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
