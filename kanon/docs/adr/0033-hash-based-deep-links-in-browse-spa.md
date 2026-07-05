# ADR-0033: Hash-based deep links in browse SPA

## Status

Accepted

## Date

2026-04-27

## Context

The browse SPA (both static and live modes) renders artifact detail views via JavaScript DOM manipulation. Navigation state was entirely ephemeral — refreshing the page or sharing a URL always landed on the catalog grid. Users needed a way to bookmark and share direct links to specific artifacts, and browser back/forward buttons had no effect on in-app navigation.

## Decision

Implement hash-fragment routing (`#artifact/<name>`) in the browse SPA client script:

1. `showDetailView()` sets `window.location.hash` to `#artifact/<name>` when opening an artifact.
2. `hideDetailView()` clears the hash via `history.replaceState()` to avoid polluting browser history with intermediate states.
3. A `hashchange` event listener calls `navigateFromHash()` to support browser back/forward.
4. On `DOMContentLoaded`, after catalog data loads, `navigateFromHash()` is called to handle initial deep-link navigation.
5. A `data-current` attribute on the detail view element prevents redundant re-renders when the hash is set programmatically.

This approach was chosen over:
- **History API (`pushState`)**: Requires server-side fallback routing for direct URL access, which the static HTML export cannot provide.
- **Query parameters**: Would conflict with potential future server-side filtering and are less conventional for SPA view state.

## Consequences

### Positive

- Artifacts are bookmarkable and shareable via URL (e.g., `catalog.html#artifact/karpathy-mode`).
- Browser back/forward buttons navigate between catalog and detail views.
- Works identically in both static and live server modes with no server changes.
- Zero dependencies — uses only built-in browser APIs.

### Negative

- Hash fragments are not sent to the server, so server-side analytics cannot track deep-link usage without additional client-side instrumentation.
- Only artifact detail views are routable; collection and other views are not yet addressed.

### Neutral

- The pattern is extensible to other view types (e.g., `#collection/<name>`) if needed later.
