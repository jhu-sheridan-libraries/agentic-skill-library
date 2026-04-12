# ADR-0006: Use Commander.js for CLI Framework

## Status

Accepted

## Date

2026-04-10

## Context

The `forge` CLI exposes six subcommands (`build`, `install`, `new`, `validate`, `catalog`, `eval`) with various options and flags. We need a CLI framework that handles argument parsing, help generation, and subcommand routing.

Alternatives considered: yargs, clipanion, oclif, manual `process.argv` parsing.

## Decision

Use Commander.js as the CLI framework. Each subcommand is registered with `.command()` and wired to a handler function. Options are declared with `.option()` and passed to handlers as typed objects.

## Consequences

### Positive

- Mature, well-documented, and widely used in the Node.js/Bun ecosystem
- Automatic `--help` generation from command and option descriptions
- Lightweight with no transitive dependencies
- Subcommand pattern maps cleanly to the forge command structure

### Negative

- Less opinionated than oclif — no built-in plugin system or command discovery
- TypeScript types for parsed options require manual interface definitions

### Neutral

- Commander.js works with Bun without modification
