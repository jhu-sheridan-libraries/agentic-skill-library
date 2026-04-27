<!-- forge:version 0.1.6 -->
# Draft PRD

Turn the current conversation context and codebase understanding into a Product Requirements Document, then submit it as a GitHub issue.

## When to Use

- The user wants to create a PRD from the current context
- A feature discussion needs to be formalized into a structured document
- The user wants to capture implementation decisions before coding begins

## Prerequisites

- Conversation context with enough detail about the feature or problem
- `gh` CLI installed and authenticated (for submitting the PRD as a GitHub issue)

## Adaptation Notes

- **`gh` CLI**: This workflow uses `gh issue create` to submit the PRD as a GitHub issue. Requires the `gh` CLI installed and authenticated in the user's environment. If `gh` is unavailable, present the PRD content for the user to file manually.

## Phases

### Phase 1 — Explore
Explore the repo to understand the current state of the codebase. Identify existing modules, patterns, and conventions relevant to the feature.
→ Load `draft-prd-explore.md`

### Phase 2 — Sketch Modules
Sketch out the major modules to build or modify. Look for opportunities to extract deep modules that can be tested in isolation. Confirm with the user.
→ Load `draft-prd-sketch-modules.md`

### Phase 3 — Write PRD
Write the PRD using the standard template (Problem Statement, Solution, User Stories, Implementation Decisions, Testing Decisions, Out of Scope, Further Notes) and submit it as a GitHub issue.
→ Load `draft-prd-write-prd.md`

## Key Principles

- Do NOT interview the user — synthesize what you already know from the conversation context.
- Actively look for deep module opportunities (see POWER.md Shared Concepts).
- User stories should be extensive and cover all aspects of the feature.
- Implementation decisions describe modules and interfaces, not specific file paths or code snippets.
- Testing decisions focus on external behavior, not implementation details.