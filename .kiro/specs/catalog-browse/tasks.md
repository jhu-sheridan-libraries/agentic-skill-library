# Implementation Plan: Catalog Browse

## Overview

Add a `forge catalog browse` subcommand that starts a temporary local Bun HTTP server serving a self-contained single-page catalog browser. The existing `catalog` command becomes a command group with `generate` and `browse` subcommands. The browse module (`src/browse.ts`) handles server lifecycle, routing, and inline HTML/CSS/JS generation. The SPA displays artifact cards with search, harness/type filtering, and a detail view with raw knowledge.md preview — all styled with a minimal academic computing aesthetic.

## Tasks

- [x] 1. Restructure catalog CLI command group and create browse module skeleton
  - [x] 1.1 Convert the `catalog` command in `src/cli.ts` from a simple command to a command group with `generate` and `browse` subcommands
    - Replace the current `program.command("catalog")` with a parent command, add `catalog generate` pointing to the existing `catalogCommand`, and add `catalog browse` with `--port <number>` option (default `"3131"`) pointing to a new `browseCommand`
    - Import `browseCommand` from `./browse`
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 Create `src/browse.ts` with the `browseCommand` entry point, `BrowseOptions` interface, port validation, and module exports
    - Export `browseCommand(options: { port: string }): Promise<void>` that parses and validates the port option
    - Implement `validatePort(portStr: string): number` that parses the string to an integer and validates range 1–65535, exiting with a descriptive error on invalid input
    - _Requirements: 1.2, 1.4_

- [x] 2. Implement server lifecycle and request routing
  - [x] 2.1 Implement `startBrowseServer` in `src/browse.ts`
    - Call `generateCatalog("knowledge")` at startup to load catalog entries
    - Call `generateHtmlPage()` to pre-generate the HTML string
    - Start `Bun.serve()` on `localhost` at the specified port
    - Print the local URL to stderr using chalk
    - Attempt to open the default browser (use `Bun.spawn` with platform-appropriate `open`/`xdg-open`/`start` command)
    - Register a `SIGINT` handler that calls `server.stop()`, prints a shutdown message to stderr, and exits
    - Handle port-in-use errors with a descriptive error message
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1_

  - [x] 2.2 Implement `handleRequest` router function in `src/browse.ts`
    - `GET /` → respond with the cached HTML string (`text/html; charset=utf-8`)
    - `GET /api/catalog` → respond with JSON-serialized catalog entries (`application/json`)
    - `GET /api/artifact/:name/content` → read `knowledge.md` from the artifact's path, respond with `text/plain`; return 404 JSON error if artifact not found or file missing
    - All other routes → 404 JSON `{ "error": "Not found" }`
    - _Requirements: 3.2, 4.1, 4.2, 4.3, 5.1, 9.2_

- [x] 3. Implement HTML escaping utility and HTML page generator
  - [x] 3.1 Implement `escapeHtml(str: string): string` in `src/browse.ts`
    - Escape `&`, `<`, `>`, `"`, and `'` characters to their HTML entity equivalents
    - _Requirements: 9.3_

  - [x] 3.2 Implement `generateHtmlPage(): string` in `src/browse.ts` — the HTML document shell
    - Generate a valid HTML5 document (`<!DOCTYPE html>`, `<html>`, `<head>`, `<body>`)
    - Inline all CSS in a `<style>` block and all JS in a `<script>` block — no external resources
    - Include a header with "Skill Forge Catalog" title and a `<span>` for artifact count
    - Include a search text input, a harness filter (multi-select or checkboxes), and a type filter (skill/power/rule checkboxes)
    - Include a container div for the card grid and a container div for the detail view (initially hidden)
    - _Requirements: 5.1, 5.2, 5.3, 9.1, 9.2_

- [x] 4. Implement inline CSS with academic computing aesthetic
  - [x] 4.1 Write the CSS portion of `generateHtmlPage` applying the visual design requirements
    - Use monospace font stack: `"Berkeley Mono", "IBM Plex Mono", "JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, Monaco, Consolas, "Courier New", monospace`
    - Muted, low-contrast color palette: off-white/light gray background, dark text, minimal accent colors
    - No `border-radius`, no gradients, no `box-shadow`, no decorative animations
    - 1px solid borders on cards, panels, and input fields
    - Compact, information-dense layout prioritizing content over whitespace
    - Responsive grid for cards usable from 768px to 1920px viewport widths
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.7, 5.4_

- [x] 5. Implement inline JavaScript for the SPA behavior
  - [x] 5.1 Write the JS portion of `generateHtmlPage` — catalog fetch and card rendering
    - On page load, fetch `/api/catalog` and render one Artifact_Card per entry in the grid
    - Each card shows: `displayName` as title, `description` text, `keywords` as tag elements, ASCII-style type badge (e.g., `[skill]`, `[power]`, `[rule]`), harness labels in square brackets (e.g., `[kiro]`, `[cursor]`)
    - Update the header artifact count after loading
    - Display an empty state message when the catalog is empty
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 10.5, 10.6, 3.4_

  - [x] 5.2 Write the JS for search and filter functionality
    - Text input filters cards by case-insensitive substring match against `name`, `displayName`, `description`, and `keywords`
    - Harness filter allows selecting one or more harnesses
    - Type filter allows selecting one or more types (skill, power, rule)
    - Multiple active filters use AND logic
    - Display "No matching artifacts" when no cards match
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 5.3 Write the JS for the detail view
    - Clicking a card navigates to the detail view showing all metadata fields: `displayName`, `description`, `keywords`, `author`, `version`, `harnesses`, `type`, `path`, `evals` status
    - Fetch `/api/artifact/:name/content` and display the raw markdown content in a `<pre>` block
    - Provide a back/return navigation element to go back to the card grid
    - Display an error message if the content fetch fails
    - _Requirements: 6.7, 8.1, 8.2, 8.3, 8.4_

- [x] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Integration wiring and final validation
  - [x] 7.1 Verify end-to-end wiring: `cli.ts` → `browseCommand` → `startBrowseServer` → `handleRequest`
    - Ensure `forge catalog browse` starts the server and `forge catalog generate` still works as before
    - Confirm all imports resolve and there are no TypeScript errors
    - _Requirements: 1.1, 1.3_

  - [x] 7.2 Write unit tests for `validatePort`, `escapeHtml`, and `handleRequest`
    - Test valid port strings, boundary values (1, 65535), and invalid inputs (0, 65536, "abc", negative)
    - Test HTML escaping of `&`, `<`, `>`, `"`, `'` and passthrough of safe strings
    - Test route matching: `/` returns HTML, `/api/catalog` returns JSON, `/api/artifact/:name/content` returns text or 404, unknown routes return 404
    - _Requirements: 1.4, 9.3, 3.2, 4.1, 4.2_

  - [x] 7.3 Write integration tests for the browse server
    - Start the server on a random available port, make HTTP requests to each endpoint, verify response status codes and content types
    - _Requirements: 2.1, 3.2, 4.1, 5.1, 9.2_

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The design uses TypeScript with Bun runtime — no new dependencies needed
- The design has no Correctness Properties section, so property-based tests are not included
- All HTML/CSS/JS is inline in a single generated string — no template files or external assets
- The existing `generateCatalog` function from `src/catalog.ts` is reused as-is
