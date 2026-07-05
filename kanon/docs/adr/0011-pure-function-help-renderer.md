# ADR-0011: Pure-Function Help Renderer over Commander.js Built-in Help

**Date:** 2026-04-11
**Status:** Proposed
**Deciders:** Steven Murawski
**Supersedes:** N/A

## Context and Problem Statement

Decision arose during **help-screen-improvements** (.kiro/specs/help-screen-improvements/design.md).

The Forge CLI used Commander.js default help output, which provides minimal formatting and no support for option grouping, usage examples, or styled sections. We needed richer help screens with chalk styling, per-command examples, grouped options, harness list injection, and deterministic output for snapshot testing and documentation generation.

## Decision Drivers

- Requirement 1.1–1.5: Styled root help with aligned columns and --no-color support
- Requirement 2.1–2.4: Per-command usage examples with styled comment/invocation lines
- Requirement 3.1–3.4: Grouped options display for commands with many flags
- Requirement 7.1: Deterministic output for automated documentation and snapshot tests
- Existing dependency: chalk already in use for banner styling

## Considered Options

1. Pure-function renderer with `helpInformation()` override
2. Commander.js `configureHelp()` API with `addHelpText()` calls
3. Custom Commander help formatter class

## Decision Outcome

**Chosen option:** Pure-function renderer with `helpInformation()` override, because Commander's `configureHelp` API does not support option grouping or example sections natively, and pure functions provide deterministic, testable output with no side effects.

The renderer is a set of exported functions (`renderRootHelp`, `renderCommandHelp`, `renderVersion`) that accept structured data and a `useColor` boolean, returning plain strings. No `console.log` calls inside the renderer — the CLI integration layer handles output. A declarative `commandMetaRegistry` keeps examples and option groups co-located as typed data rather than scattered across `.addHelpText()` calls.

### Positive Consequences

- Deterministic output: same inputs always produce identical strings, enabling snapshot tests
- Testable in isolation: pure functions with no side effects or terminal-width sniffing
- Extensible: adding examples or option groups for new commands is a single registry entry
- --no-color support is trivial: pass `useColor: false` and get zero ANSI codes guaranteed

### Negative Consequences

- Bypasses Commander's built-in help entirely, requiring manual `helpInformation()` overrides on every command
- Option metadata (flags, descriptions) must be extracted from Commander objects at integration time

### Neutral

- The `commandMetaRegistry` pattern mirrors how Commander stores command metadata internally, just with richer fields

## Links and References

- Spec: .kiro/specs/help-screen-improvements/requirements.md — Req 1–3, 7
- Spec: .kiro/specs/help-screen-improvements/design.md — Architecture, Components and Interfaces
- Implementation: src/help/renderer.ts, src/help/metadata.ts
