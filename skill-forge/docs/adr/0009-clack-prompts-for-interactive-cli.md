# ADR-0009: Use @clack/prompts for Interactive CLI Flows

**Date:** 2026-04-11
**Status:** Proposed
**Deciders:** Steven Murawski
**Supersedes:** N/A

## Context and Problem Statement

Decision arose during **interactive-new-command** (.kiro/specs/interactive-new-command/design.md).

The `forge new` command needed an interactive wizard to guide artifact authors through frontmatter configuration, hook setup, and MCP server definitions. The `forge tutorial` command needed similar interactive prompts for a guided walkthrough. We needed a prompt library that provides styled, accessible terminal prompts with cancellation support and a consistent visual style.

## Decision Drivers

- Requirement 1.4: Interactive wizard with intro banner
- Requirement 8.1: Cancellation handling at every prompt
- Existing usage: `install.ts` already uses `@clack/prompts`
- Need for `text`, `select`, `multiselect`, and `confirm` prompt types

## Considered Options

1. @clack/prompts
2. inquirer
3. prompts (by terkelg)
4. Raw readline/process.stdin

## Decision Outcome

**Chosen option:** @clack/prompts, because it was already used in the codebase (`install.ts`), provides a cohesive visual style with `intro`/`outro`/`log` helpers, has built-in cancellation detection via `isCancel()`, and requires no additional dependencies.

### Positive Consequences

- Consistent UX across `forge install`, `forge new`, and `forge tutorial`
- Built-in `isCancel()` makes cancellation handling straightforward
- `p.log.info`, `p.log.step`, `p.note` provide structured output without manual chalk formatting
- Lightweight — no heavy dependency tree

### Negative Consequences

- Less customizable than inquirer for complex prompt flows
- Prompt validation callbacks use a different pattern than Zod's native API, requiring a `validateField` adapter

### Neutral

- The library is actively maintained and works with Bun without modification

## Links and References

- Spec: .kiro/specs/interactive-new-command/requirements.md — Req 1, 2, 8
- Spec: .kiro/specs/interactive-new-command/design.md — Components and Interfaces
- Implementation: src/wizard.ts, src/tutorial.ts
