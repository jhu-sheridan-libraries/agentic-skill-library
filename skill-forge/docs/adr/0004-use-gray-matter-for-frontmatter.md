# ADR-0004: Use gray-matter for Frontmatter Parsing

## Status

Accepted

## Date

2026-04-10

## Context

`knowledge.md` files use YAML frontmatter delimited by `---` to store metadata alongside Markdown content. We need a parser that reliably extracts both the structured frontmatter and the body text, handling edge cases like empty frontmatter blocks and missing delimiters.

Alternatives considered: manual regex splitting, remark-frontmatter, custom parser.

## Decision

Use the `gray-matter` library to parse `knowledge.md` files. It returns `{ data, content }` where `data` is the parsed YAML object and `content` is the Markdown body below the frontmatter.

The parsed `data` is then validated through the Zod `FrontmatterSchema`.

## Consequences

### Positive

- Handles edge cases: empty frontmatter (`---\n---`), no frontmatter, malformed delimiters
- Well-tested library used by Hugo, Jekyll, Gatsby, and other static site generators
- Clean separation of metadata extraction (gray-matter) from validation (Zod)

### Negative

- Adds a runtime dependency
- gray-matter's error messages for invalid YAML need to be wrapped to include file paths and line numbers

### Neutral

- gray-matter supports multiple frontmatter formats (YAML, TOML, JSON) but we only use YAML
