# ADR-0025: Extract browse UI template into dedicated module

## Status

Proposed

## Date

2026-04-20

## Context

After adding admin CRUD capabilities (ADR-0024), `browse.ts` grew to ~2950 lines — nearly 5× the next largest production file. The bulk (~2400 lines) was the `generateHtmlPage()` function: a single template string containing all CSS design tokens, component styles, and frontend JavaScript for the catalog browser SPA.

This made `browse.ts` responsible for three unrelated concerns: HTML/CSS/JS template generation, HTTP route handling, and server lifecycle management. The file was difficult to navigate and the UI template dominated the routing logic.

## Decision

Extract the UI template generation into a dedicated `browse-ui.ts` module containing:

- `escapeHtml()` — HTML entity escaping utility
- `generateHtmlPage()` — the full SPA template (~2400 lines of inline HTML/CSS/JS)
- `safeJsonEmbed()` — safe JSON serialization for `<script>` embedding
- `generateStaticHtmlPage()` — static export variant with embedded catalog data

`browse.ts` re-exports these functions (`export { ... } from "./browse-ui"`) so existing imports remain valid — zero breaking changes for tests or other consumers.

After extraction, `browse.ts` contains only routing and server concerns (~500 lines): `BrowseState`, refresh helpers, route helpers, `handleRequest`, `exportCommand`, `startBrowseServer`, and `validatePort`.

## Consequences

### Positive

- `browse.ts` drops from ~2950 to ~500 lines — on par with other modules in the codebase
- Clear separation: `browse-ui.ts` owns the SPA template, `browse.ts` owns HTTP routing and server lifecycle
- Re-exports preserve backward compatibility — no import changes needed anywhere

### Negative

- One additional file to maintain, though the boundary is clean and unlikely to cause confusion

### Neutral

- The UI template remains a single inline string (no build step or framework) — this decision is purely about module boundaries, not the rendering approach
- Future UI changes (e.g., extracting to a separate build step) would now only touch `browse-ui.ts`

## Links and References

- Extends: [ADR-0024](./0024-browse-server-admin-crud-with-mutable-state.md) (admin CRUD architecture)
- Implementation: `skill-forge/src/browse-ui.ts`, `skill-forge/src/browse.ts`
