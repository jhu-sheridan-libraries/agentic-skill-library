# Requirements Document

## Introduction

The `forge catalog browse` subcommand extends the Skill Forge CLI with a local web-based catalog browser. While `forge catalog` generates a static `catalog.json` and `forge install` provides a TUI-based artifact picker, there is no visual way to explore the knowledge artifact library with rich metadata, search, and content preview. This feature spins up a temporary local HTTP server using Bun's built-in `Bun.serve()` and serves a single-page web UI that displays artifact cards with search, filtering, and detail views — all using inline HTML/CSS/JS with zero external frontend dependencies.

## Glossary

- **Browse_Server**: The temporary local HTTP server started by `forge catalog browse`, implemented using `Bun.serve()`, that serves the catalog browser web UI
- **Catalog_Browser**: The single-page web application served by the Browse_Server that displays knowledge artifact metadata with search, filter, and detail view capabilities
- **Artifact_Card**: A visual card element in the Catalog_Browser displaying an artifact's name, description, keywords, supported harnesses, and type badge
- **Detail_View**: A panel or page in the Catalog_Browser showing the full metadata and knowledge.md content preview for a selected artifact
- **Catalog_Data**: The array of catalog entries (from `catalog.json` or generated on-the-fly) that the Browse_Server provides to the Catalog_Browser as JSON
- **Forge_CLI**: The `forge` TypeScript CLI entry point (running on Bun) that provides subcommands including `build`, `install`, `new`, `validate`, `catalog`, and `eval`
- **Knowledge_Artifact**: A directory under `knowledge/` containing a `knowledge.md` file and optional supporting files — the harness-agnostic canonical source of truth for a single skill or power
- **CatalogEntry**: The Zod-validated schema for a single catalog entry containing `name`, `displayName`, `description`, `keywords`, `author`, `version`, `harnesses`, `type`, `path`, `evals`, `categories`, `ecosystem`, `depends`, and `enhances` fields

## Requirements

### Requirement 1: Browse Subcommand Registration

**User Story:** As a knowledge author, I want a `forge catalog browse` subcommand, so that I can visually explore the artifact library in my browser.

#### Acceptance Criteria

1. THE Forge_CLI SHALL register `browse` as a subcommand of the `catalog` command, invoked as `forge catalog browse`
2. THE Forge_CLI SHALL accept a `--port <number>` option on the `browse` subcommand with a default value of 3131
3. WHEN the user runs `forge catalog browse`, THE Forge_CLI SHALL start the Browse_Server and print the local URL to stderr
4. IF the `--port` option specifies a value that is not a valid integer between 1 and 65535, THEN THE Forge_CLI SHALL exit with an error message indicating the valid port range

### Requirement 2: Local HTTP Server Lifecycle

**User Story:** As a knowledge author, I want the browse server to start quickly and shut down cleanly, so that it does not leave orphaned processes.

#### Acceptance Criteria

1. WHEN `forge catalog browse` is executed, THE Browse_Server SHALL start listening on `localhost` at the specified port using `Bun.serve()`
2. WHEN the Browse_Server starts successfully, THE Forge_CLI SHALL attempt to open the default browser at the server URL
3. WHEN the user sends a SIGINT signal (Ctrl+C), THE Browse_Server SHALL stop accepting new connections and shut down within 2 seconds
4. WHEN the Browse_Server shuts down, THE Forge_CLI SHALL print a shutdown confirmation message to stderr
5. IF the specified port is already in use, THEN THE Browse_Server SHALL exit with an error message identifying the port conflict

### Requirement 3: Catalog Data Loading

**User Story:** As a knowledge author, I want the browse UI to reflect the current state of my artifacts, so that I see up-to-date information without manually regenerating the catalog.

#### Acceptance Criteria

1. WHEN the Browse_Server starts, THE Browse_Server SHALL generate Catalog_Data on-the-fly by calling the existing `generateCatalog` function from `src/catalog.ts`
2. THE Browse_Server SHALL serve the Catalog_Data as JSON at the `/api/catalog` endpoint with `Content-Type: application/json`
3. THE Browse_Server SHALL validate each catalog entry against the CatalogEntry schema before serving
4. IF the `knowledge/` directory contains no valid artifacts, THEN THE Browse_Server SHALL serve an empty array at `/api/catalog` and the Catalog_Browser SHALL display an empty state message

### Requirement 4: Artifact Detail Content Endpoint

**User Story:** As a knowledge author, I want to preview the full knowledge.md content for any artifact, so that I can review what will be compiled without opening files manually.

#### Acceptance Criteria

1. THE Browse_Server SHALL serve the raw Markdown content of an artifact's `knowledge.md` file at the `/api/artifact/:name/content` endpoint with `Content-Type: text/plain`
2. WHEN a request is made for an artifact name that does not exist, THE Browse_Server SHALL respond with HTTP 404 and a JSON error body containing a descriptive message
3. THE Browse_Server SHALL resolve the artifact path from the `path` field in the corresponding CatalogEntry

### Requirement 5: Single-Page Web UI Shell

**User Story:** As a knowledge author, I want the catalog browser to be a self-contained single page with no external dependencies, so that it works offline and loads instantly.

#### Acceptance Criteria

1. THE Browse_Server SHALL serve the Catalog_Browser as a single HTML response at the root path (`/`) containing all CSS and JavaScript inline
2. THE Catalog_Browser SHALL render without requiring any external CDN resources, fonts, or scripts
3. THE Catalog_Browser SHALL display a header with the title "Skill Forge Catalog" and the total artifact count
4. THE Catalog_Browser SHALL be usable at common viewport widths from 768px to 1920px

### Requirement 10: Visual Aesthetic

**User Story:** As a knowledge author, I want the catalog browser to have a minimal, academic computing aesthetic, so that it feels like a serious technical resource rather than a flashy marketing page.

#### Acceptance Criteria

1. THE Catalog_Browser SHALL use a monospace font stack (e.g., `"Berkeley Mono", "IBM Plex Mono", "JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, Monaco, Consolas, "Courier New", monospace`) as the primary typeface for all text
2. THE Catalog_Browser SHALL use a muted, low-contrast color palette with a light background (off-white or light gray), dark text, and minimal accent colors
3. THE Catalog_Browser SHALL NOT use rounded corners (border-radius), gradients, drop shadows, or decorative animations on any UI elements
4. THE Catalog_Browser SHALL use 1px solid borders for visual separation of cards, panels, and input fields
5. THE Catalog_Browser SHALL use plain text characters or ASCII-style indicators for type badges and status indicators rather than emoji or icon fonts
6. THE Catalog_Browser SHALL present harness labels as plain text in square brackets (e.g., `[kiro]`, `[cursor]`, `[copilot]`) rather than colored pills or icons
7. THE Catalog_Browser SHALL use a compact, information-dense layout that prioritizes content over whitespace

### Requirement 6: Artifact Card Display

**User Story:** As a knowledge author, I want to see artifact information at a glance in card format, so that I can quickly scan the library.

#### Acceptance Criteria

1. THE Catalog_Browser SHALL display one Artifact_Card per CatalogEntry in a responsive grid layout
2. EACH Artifact_Card SHALL display the artifact's `displayName` as the card title
3. EACH Artifact_Card SHALL display the artifact's `description` text
4. EACH Artifact_Card SHALL display the artifact's `keywords` as individual tag elements
5. EACH Artifact_Card SHALL display a type badge indicating whether the artifact is a "skill", "power", or "rule"
6. EACH Artifact_Card SHALL display icons or labels for each supported harness listed in the artifact's `harnesses` array
7. EACH Artifact_Card SHALL display the artifact's `categories` as labeled tags when present
8. EACH Artifact_Card SHALL display the artifact's `ecosystem` entries as labeled tags when present
9. EACH Artifact_Card SHALL display a dependency indicator showing the count of `depends` and `enhances` references when non-empty
10. WHEN the user clicks an Artifact_Card, THE Catalog_Browser SHALL navigate to the Detail_View for that artifact

### Requirement 7: Search and Filter

**User Story:** As a knowledge author, I want to search and filter the catalog, so that I can find specific artifacts quickly in a large library.

#### Acceptance Criteria

1. THE Catalog_Browser SHALL provide a text input field that filters Artifact_Cards as the user types
2. WHEN the user types in the search field, THE Catalog_Browser SHALL filter Artifact_Cards by matching the query against the artifact's `name`, `displayName`, `description`, `keywords`, `categories`, and `ecosystem` fields using case-insensitive substring matching
3. THE Catalog_Browser SHALL provide a harness filter that allows selecting one or more harnesses to show only artifacts supporting those harnesses
4. THE Catalog_Browser SHALL provide a type filter that allows selecting one or more artifact types (skill, power, rule)
5. THE Catalog_Browser SHALL provide a category filter that allows selecting one or more categories from the CategoryEnum to show only artifacts tagged with those categories
6. THE Catalog_Browser SHALL provide an ecosystem filter that allows selecting one or more ecosystem values (populated from the union of all artifact ecosystem entries) to show only artifacts targeting those ecosystems
7. WHEN multiple filters are active simultaneously, THE Catalog_Browser SHALL show only artifacts matching all active filter criteria (AND logic)
8. WHEN no artifacts match the active filters, THE Catalog_Browser SHALL display a "No matching artifacts" message

### Requirement 8: Artifact Detail View

**User Story:** As a knowledge author, I want to see the full metadata and content preview for a selected artifact, so that I can understand what it provides before installing it.

#### Acceptance Criteria

1. WHEN the user selects an artifact, THE Catalog_Browser SHALL display the Detail_View showing all CatalogEntry metadata fields: `displayName`, `description`, `keywords`, `author`, `version`, `harnesses`, `type`, `path`, `evals` status, `categories`, `ecosystem`, `depends`, and `enhances`
2. THE Detail_View SHALL fetch and display the raw Markdown content of the artifact's `knowledge.md` file from the `/api/artifact/:name/content` endpoint
3. THE Detail_View SHALL provide a navigation element to return to the card grid view
4. WHEN an artifact has `depends` or `enhances` entries, THE Detail_View SHALL display them as clickable links that navigate to the referenced artifact's Detail_View (if the referenced artifact exists in the catalog)
5. IF the content fetch fails, THEN THE Detail_View SHALL display an error message indicating the content could not be loaded

### Requirement 9: HTML Response Serialization

**User Story:** As a developer, I want the HTML generation to be reliable, so that the browser always receives a valid page.

#### Acceptance Criteria

1. THE Browse_Server SHALL generate the HTML response as a valid HTML5 document with `<!DOCTYPE html>`, `<html>`, `<head>`, and `<body>` elements
2. FOR ALL Catalog_Data contents, generating the HTML page then serving it SHALL produce a response with `Content-Type: text/html; charset=utf-8`
3. THE Browse_Server SHALL escape any user-provided content (artifact names, descriptions) embedded in the HTML to prevent script injection
