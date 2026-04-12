# ADR-0001: Use Nunjucks for Template Rendering

## Status

Accepted

## Date

2026-04-10

## Context

Skill Forge compiles knowledge artifacts into seven different harness formats. Each harness has its own file structure and conventions, but many share common patterns (Markdown body, frontmatter, workflow sections). We need a template engine that supports code reuse across harness templates while allowing per-harness customization.

Handlebars and EJS were considered as alternatives.

## Decision

Use Nunjucks as the template engine for all harness output rendering.

Templates live under `templates/harness-adapters/<harness-name>/` with a shared `_base/base.md.njk` that harness-specific templates extend via `{% extends %}` and `{% block %}`.

## Consequences

### Positive

- Template inheritance (`{% extends %}` / `{% block %}`) eliminates boilerplate duplication across seven harness templates
- Nunjucks has mature Node.js support and works well with Bun
- Filters and macros provide flexibility for harness-specific transformations

### Negative

- Nunjucks syntax is less familiar than Handlebars to some contributors
- Template errors can be harder to debug than programmatic string building

### Neutral

- Templates are stored as `.njk` files alongside the source code, not embedded in TypeScript
