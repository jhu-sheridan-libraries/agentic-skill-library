---
name: debug-journal
displayName: Debug Journal
description: A systematic debugging workflow — articulate the problem before chasing the solution.
keywords: [debugging, methodology, workflow, problem-solving]
author: skill-forge
version: 0.2.0
type: workflow
inclusion: manual
categories: [debugging]
ecosystem: []
collections: [neon-caravan]
maturity: beta
trust: community
---

## Overview

Debug Journal is a systematic debugging workflow that forces you to articulate the problem before chasing the solution. Use it when you hit a bug, a test failure, or unexpected behaviour. Writing forces clarity that browsing stack traces does not.

The fastest path through a bug is rarely the first one you see.

## The three-sentence rule

Before debugging, write three sentences:
1. What I expected to happen
2. What actually happened
3. What I already know it is not

If you can't write sentence three, you haven't started investigating yet.

## Phases

Follow the workflows below in order. Skipping phases is fine once you've found the root cause — but jumping to "fix" before "isolate" is how you patch symptoms.

## Best Practices

- Write the three sentences before touching any code
- Isolate before you fix — reproduce the bug in the smallest possible context
- One variable at a time — change one thing, observe, then change the next
- Keep a running log of what you tried and what you learned
- If you've been stuck for 30 minutes, re-read your three sentences — the problem statement may be wrong

## Examples

**Good three-sentence articulation:**
1. I expected the API to return 200 with a user object when given a valid session token
2. It returns 401 with "session expired" even though the token was created 5 seconds ago
3. It is not a token format issue (verified by decoding the JWT) and not a clock skew issue (server and client times match)

**Bad three-sentence articulation:**
1. It should work
2. It doesn't work
3. I don't know why

## Troubleshooting

**Can't write sentence 3:** You haven't investigated yet. Run the failing case, read the error output, check logs. Come back when you can rule something out.

**Root cause found but fix breaks other tests:** You isolated correctly but the fix is too broad. Narrow the fix to only the failing case and re-run the full suite.

**Stuck in a loop:** If you've tried the same approach three times, step back. Re-read your three sentences. The problem statement may need updating.
