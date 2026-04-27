---
name: debug-journal
displayName: Debug Journal
description: A systematic debugging workflow — articulate the problem before chasing the solution.
keywords: [methodology, workflow, problem-solving]
author: skill-forge
version: 0.1.1
type: workflow
inclusion: manual
categories: [debugging]
ecosystem: []
collections: [neon-caravan]
maturity: beta
trust: community
---

The fastest path through a bug is rarely the first one you see. Before touching code, articulate the problem precisely. Writing forces clarity that browsing stack traces does not.

## The three-sentence rule

Before debugging, write three sentences:
1. What I expected to happen
2. What actually happened
3. What I already know it is not

If you can't write sentence three, you haven't started investigating yet.

## Phases

Follow the workflows below in order. Skipping phases is fine once you've found the root cause — but jumping to "fix" before "isolate" is how you patch symptoms.
