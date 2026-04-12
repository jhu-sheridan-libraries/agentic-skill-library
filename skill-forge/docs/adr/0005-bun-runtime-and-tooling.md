# ADR-0005: Use Bun as Runtime and Build Tool

## Status

Accepted

## Date

2026-04-10

## Context

Skill Forge is a TypeScript CLI tool that needs a runtime, test runner, and bundler. We need to choose between Node.js (with separate tools for each concern) and Bun (which provides all three natively).

## Decision

Use Bun as the runtime, test runner (`bun test`), and bundler (`bun build --compile` for standalone binaries). The project targets Bun's native TypeScript execution — no separate compilation step needed during development.

Dependencies are managed via `bun install` with a `bun.lockb` lockfile.

## Consequences

### Positive

- Single tool for runtime, testing, and bundling reduces toolchain complexity
- Native TypeScript execution without a build step speeds up development
- `bun build --compile` produces standalone binaries for distribution without requiring Bun on the target machine
- Fast startup and install times

### Negative

- Bun's ecosystem compatibility is not 100% — some npm packages may have edge-case issues
- Contributors must install Bun (not as ubiquitous as Node.js)
- Bun's test runner API differs from Jest/Vitest, which may be unfamiliar

### Neutral

- `bunfig.toml` configures Bun-specific settings at the project root
