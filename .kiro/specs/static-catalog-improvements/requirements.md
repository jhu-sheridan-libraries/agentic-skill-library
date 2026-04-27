# Requirements Document

## Introduction

The Skill Forge catalog can be exported as a static HTML page via `forge catalog export` for deployment to GitHub Pages. The static version embeds catalog data and artifact content inline, but the shared HTML template still renders interactive UI elements (tabs, buttons) that require a running server and API endpoints to function. These non-functional elements confuse users and clutter the interface. Additionally, the default collection filter should pre-select the "jhu" collection in the static version to surface the most relevant artifacts immediately.

## Glossary

- **Static_Page**: The self-contained HTML file produced by `generateStaticHtmlPage`, which embeds catalog data and artifact content inline via `window.__CATALOG_DATA__` and `window.__ARTIFACT_CONTENT__` globals, requiring no backend server.
- **Interactive_View**: A tab-based view in the catalog browser that depends on live API endpoints (`/api/*`) to load data — specifically the Collections tab, Manifest tab, Dependencies (graph) tab, Workspace tab, and Build tab.
- **Header_Action_Button**: A button in the page header that triggers server-dependent functionality — specifically the "Import", "Build", and "+ New Artifact" buttons.
- **Collection_Filter**: The checkbox filter group in the Artifacts view that allows users to filter displayed artifacts by their `collections` membership.
- **Browse_UI**: The `browse-ui.ts` module that generates the HTML template for both the live catalog browser and the static export.

## Requirements

### Requirement 1: Hide Interactive Tabs in Static Mode

**User Story:** As a user viewing the static catalog on GitHub Pages, I want server-dependent tabs to be hidden, so that I am not presented with non-functional UI elements.

#### Acceptance Criteria

1. WHEN the Static_Page is rendered, THE Browse_UI SHALL hide the Collections tab from the tab navigation.
2. WHEN the Static_Page is rendered, THE Browse_UI SHALL hide the Manifest tab from the tab navigation.
3. WHEN the Static_Page is rendered, THE Browse_UI SHALL hide the Dependencies tab from the tab navigation.
4. WHEN the Static_Page is rendered, THE Browse_UI SHALL hide the Workspace tab from the tab navigation.
5. WHEN the Static_Page is rendered, THE Browse_UI SHALL hide the Build tab from the tab navigation.
6. WHILE the live catalog browser is running, THE Browse_UI SHALL continue to display all tabs as before.

### Requirement 2: Hide Header Action Buttons in Static Mode

**User Story:** As a user viewing the static catalog on GitHub Pages, I want server-dependent header buttons to be hidden, so that I only see controls that work in the static context.

#### Acceptance Criteria

1. WHEN the Static_Page is rendered, THE Browse_UI SHALL hide the "Import" button from the header.
2. WHEN the Static_Page is rendered, THE Browse_UI SHALL hide the "Build" button from the header.
3. WHEN the Static_Page is rendered, THE Browse_UI SHALL hide the "+ New Artifact" button from the header.
4. WHEN the Static_Page is rendered, THE Browse_UI SHALL hide the build status indicator from the header.
5. WHILE the live catalog browser is running, THE Browse_UI SHALL continue to display all header buttons as before.

### Requirement 3: Default Collection Filter to "jhu" in Static Mode

**User Story:** As a user viewing the static catalog on GitHub Pages, I want the collection filter to default to the "jhu" collection, so that I see the most relevant artifacts without manual filtering.

#### Acceptance Criteria

1. WHEN the Static_Page is loaded and the "jhu" collection exists in the catalog data, THE Collection_Filter SHALL pre-select the "jhu" checkbox.
2. WHEN the Static_Page is loaded and the "jhu" collection is pre-selected, THE Browse_UI SHALL apply the filter immediately so that only artifacts belonging to the "jhu" collection are displayed.
3. IF the "jhu" collection does not exist in the catalog data, THEN THE Collection_Filter SHALL leave all checkboxes unchecked and display all artifacts.
4. WHILE the live catalog browser is running, THE Collection_Filter SHALL leave all checkboxes unchecked by default.

### Requirement 4: Static Mode Detection

**User Story:** As a developer maintaining the Browse_UI, I want a reliable mechanism to detect static mode, so that conditional behavior can be applied consistently.

#### Acceptance Criteria

1. THE Browse_UI SHALL detect static mode by checking for the presence of the `window.__CATALOG_DATA__` global variable.
2. THE Browse_UI SHALL use the same detection mechanism for all static-mode conditional behavior (hiding tabs, hiding buttons, and setting default filters).
