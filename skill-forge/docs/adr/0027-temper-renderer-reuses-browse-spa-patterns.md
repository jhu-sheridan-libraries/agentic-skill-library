# ADR-0027: Temper Renderer Reuses Browse SPA Patterns

## Status

Proposed

## Date

2026-04-21

## Context

Skill Forge needs an interactive preview command (`forge temper`) that renders a human-readable view of the "AI experience" for a given artifact-harness combination. This includes system prompt, steering content, hooks, MCP servers, and degradation reports. The preview needs terminal output (with chalk highlighting), JSON output, and a web-based preview mode with syntax highlighting and collapsible sections.

The project already has a local HTTP server infrastructure in `src/browse.ts` (Bun.serve, `handleRequest()` routing, HTML generation via `src/browse-ui.ts`) used by `forge catalog browse`. Introducing a separate server framework or external UI dependencies would increase complexity and bundle size.

## Decision

The temper renderer (`src/temper.ts`) reuses the Browse SPA patterns established by `src/browse.ts`:

1. **Web mode** uses `Bun.serve` with the same `handleRequest()` routing style — no new server framework.
2. **HTML generation** follows the inline HTML/CSS/JS approach from `src/browse-ui.ts` — no external CDN dependencies.
3. **Data model** uses a `TemperOutput` Zod schema (with typed sections) that serves both terminal and web rendering.
4. **API integration** adds a `POST /api/temper` endpoint to the existing browse server for admin UI access.

The `TemperOutput` schema defines sections with a discriminated `type` enum (`system-prompt`, `steering`, `hooks`, `mcp-servers`, `degradation-report`) enabling both renderers to handle each section type appropriately.

## Consequences

### Positive

- Zero new runtime dependencies for the web preview mode.
- Consistent UX between `forge catalog browse` and `forge temper --web`.
- The admin UI can embed temper previews via the same API endpoint.
- Typed `TemperOutput` schema enables JSON output mode for tooling integration.

### Negative

- Inline HTML/CSS/JS in `generateTemperHtml()` can become verbose for complex layouts.
- Web mode shares no code with terminal mode beyond the `TemperOutput` data structure.

### Neutral

- The `--no-color` flag for deterministic output is orthogonal to this decision but benefits from the structured `TemperOutput` schema.
