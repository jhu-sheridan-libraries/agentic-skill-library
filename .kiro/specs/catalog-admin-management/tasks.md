# Implementation Plan: Catalog Admin Management

## Overview

Add full CRUD capabilities to the `forge catalog browse` server for artifacts, collections, and manifest entries. This involves creating three backend modules (`admin.ts`, `collection-admin.ts`, `manifest-admin.ts`), extending `browse.ts` with mutation routes and mutable state, and building a unified frontend UI using a shared design system (design tokens, reusable render functions, DRY component patterns). Implementation uses TypeScript with Bun, consistent with the existing codebase.

## Tasks

- [x] 1. Create the `admin.ts` module with core artifact CRUD functions
  - [x] 1.1 Create `src/admin.ts` with the `ArtifactInput` interface, `validateArtifactInput` function (using `FrontmatterSchema` and kebab-case regex), `serializeFrontmatter` function (using `js-yaml` to produce `---` delimited YAML + body), and a `toKebabCase` helper for converting display names to kebab-case artifact names
    - Implement `validateArtifactInput` to run `FrontmatterSchema.safeParse` on the frontmatter fields and validate the name against `^[a-z0-9]+(-[a-z0-9]+)*$`
    - Implement `serializeFrontmatter` to produce a `knowledge.md` string with YAML frontmatter block and markdown body
    - Implement `toKebabCase` to lowercase, strip non-alphanumeric characters, and join segments with hyphens
    - _Requirements: 1.4, 1.6, 2.2, 5.1, 5.3_

  - [x] 1.2 Add `createArtifact` async function to `src/admin.ts`
    - Create the artifact directory under `knowledge/`
    - Write `knowledge.md` using `serializeFrontmatter`
    - Create empty `hooks.yaml`, empty `mcp-servers.yaml`, and empty `workflows/` subdirectory
    - Check for existing directory and throw a conflict error if it exists
    - Re-scan catalog via `generateCatalog` and return the new `CatalogEntry`
    - _Requirements: 1.3, 1.5, 4.1, 4.4, 6.1, 6.2_

  - [x] 1.3 Add `updateArtifact` async function to `src/admin.ts`
    - Validate the artifact directory exists, return not-found error if missing
    - Overwrite only `knowledge.md` with updated frontmatter and body (preserve all other files)
    - Re-scan catalog via `generateCatalog` and return the updated `CatalogEntry`
    - _Requirements: 2.3, 2.4, 2.5, 4.2, 4.4, 6.1, 6.2_

  - [x] 1.4 Add `deleteArtifact` async function to `src/admin.ts`
    - Validate the artifact directory exists, return not-found error if missing
    - Recursively remove the entire artifact directory
    - Re-scan catalog via `generateCatalog`
    - _Requirements: 3.2, 3.3, 4.3, 4.4, 6.1_

  - [x] 1.5 Write unit tests for `admin.ts` in `src/__tests__/admin.test.ts`
    - Test `serializeFrontmatter` with known inputs produces expected YAML output
    - Test `validateArtifactInput` rejects empty name, invalid harness, invalid type, non-kebab-case name
    - Test `validateArtifactInput` accepts valid input
    - Test `toKebabCase` with various display name inputs
    - Test `createArtifact` conflict error when directory already exists
    - Test `updateArtifact` not-found error when directory is missing
    - Test `deleteArtifact` not-found error when directory is missing
    - _Requirements: 1.4, 1.5, 1.6, 2.2, 2.5, 3.3, 5.1, 5.3_

- [x] 2. Create the `collection-admin.ts` module with collection CRUD functions
  - [x] 2.1 Create `src/collection-admin.ts` with `CollectionInput` interface, `validateCollectionInput` function (using `CollectionSchema` from `schemas.ts` and kebab-case regex), `serializeCollection` function (using `js-yaml`), and `parseCollectionFile` function (parsing YAML and preserving unknown keys)
    - `validateCollectionInput` validates required fields (name, displayName, description, version, trust) and name pattern
    - `serializeCollection` serializes a Collection record to YAML string
    - `parseCollectionFile` parses YAML, validates against CollectionSchema, returns both validated Collection and raw object with unknown keys
    - _Requirements: 10.4, 11.1, 11.2, 11.3, 11.4_

  - [x] 2.2 Add `listCollections` and `getCollection` async functions to `src/collection-admin.ts`
    - `listCollections` scans `collections/` directory, parses each `.yaml` file, returns array of collection objects
    - `getCollection` reads a single collection by name, resolves member artifacts by scanning catalogEntries for artifacts whose frontmatter `collections` array includes the collection name
    - Return not-found error if collection file does not exist
    - _Requirements: 9.1, 9.3, 9.4_

  - [x] 2.3 Add `createCollection`, `updateCollection`, `deleteCollection` async functions to `src/collection-admin.ts`
    - `createCollection` validates input, checks for existing file (conflict error), writes new YAML file to `collections/`
    - `updateCollection` validates input, reads existing file to preserve unknown keys, merges and writes updated YAML
    - `deleteCollection` checks file exists (not-found error), removes the YAML file
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 2.4 Write unit tests for `collection-admin.ts` in `src/__tests__/collection-admin.test.ts`
    - Test `parseCollectionFile` with known YAML produces expected Collection object
    - Test `serializeCollection` with known Collection produces expected YAML string
    - Test `validateCollectionInput` rejects missing required fields
    - Test `createCollection` conflict error when file already exists
    - Test `updateCollection` not-found error when file missing
    - Test `deleteCollection` not-found error when file missing
    - Test `getCollection` returns correct member artifacts based on frontmatter `collections` field
    - _Requirements: 9.4, 10.4, 10.5, 10.6, 11.1, 11.2_

- [x] 3. Create the `manifest-admin.ts` module with manifest entry management functions
  - [x] 3.1 Create `src/manifest-admin.ts` with `ManifestEntryInput` interface, `EntryStatus` interface, `SyncStatusResponse` interface, and `readManifest` function (reusing `parseManifest` from `guild/manifest.ts`, returning empty manifest if file doesn't exist)
    - Import and reuse `parseManifest`, `printManifest`, `ManifestSchema`, `ArtifactManifestEntrySchema`, `CollectionManifestEntrySchema` from `guild/manifest.ts`
    - `readManifest` reads `.forge/manifest.yaml`, returns parsed Manifest and raw object for unknown key preservation
    - _Requirements: 12.1, 12.6_

  - [x] 3.2 Add `readSyncLock` and `computeSyncStatus` functions to `src/manifest-admin.ts`
    - `readSyncLock` reads `.forge/sync-lock.json`, returns null if file doesn't exist
    - `computeSyncStatus` is a pure function comparing manifest entries against sync-lock: "synced" if version matches, "outdated" if version differs, "missing" if entry absent from sync-lock
    - _Requirements: 12.4_

  - [x] 3.3 Add `validateManifestEntry`, `addManifestEntry`, `editManifestEntry`, `removeManifestEntry` functions to `src/manifest-admin.ts`
    - `validateManifestEntry` delegates to `ArtifactManifestEntrySchema` (when `name` set) or `CollectionManifestEntrySchema` (when `collection` set), rejects inputs with both or neither
    - `addManifestEntry` validates, checks for duplicate identifier (conflict error), appends to manifest artifacts array, writes via `printManifest`
    - `editManifestEntry` finds entry by identifier (not-found error if missing), updates fields, writes
    - `removeManifestEntry` finds entry by identifier (not-found error if missing), removes from array, writes
    - All write operations preserve top-level `backend` field and unknown keys
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.10_

  - [x] 3.4 Write unit tests for `manifest-admin.ts` in `src/__tests__/manifest-admin.test.ts`
    - Test `readManifest` returns empty manifest when file doesn't exist
    - Test `readManifest` parses valid manifest YAML correctly
    - Test `readSyncLock` returns null when file doesn't exist
    - Test `computeSyncStatus` with empty sync-lock marks all entries as "missing"
    - Test `computeSyncStatus` with matching versions marks entries as "synced"
    - Test `computeSyncStatus` with mismatched versions marks entries as "outdated"
    - Test `addManifestEntry` conflict error when entry with same identifier exists
    - Test `editManifestEntry` not-found error when identifier doesn't match
    - Test `removeManifestEntry` not-found error when identifier doesn't match
    - _Requirements: 12.1, 12.4, 12.6, 13.4, 13.5, 13.6_

- [x] 4. Checkpoint — Ensure all backend module tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Extend `browse.ts` with mutation routes and mutable state
  - [x] 5.1 Refactor `startBrowseServer` in `browse.ts` to use a mutable wrapper `{ catalogEntries: CatalogEntry[], collectionsDir: string, forgeDir: string }` and add `refreshCatalog` and `refreshCollections` helpers
    - Change `handleRequest` signature to accept the mutable wrapper
    - `refreshCatalog` re-scans `knowledge/` via `generateCatalog` and updates wrapper
    - `refreshCollections` re-scans `collections/` via `listCollections` and updates wrapper
    - _Requirements: 4.4, 6.1_

  - [x] 5.2 Add artifact mutation routes to `handleRequest`: `POST /api/artifact`, `PUT /api/artifact/:name`, `DELETE /api/artifact/:name`
    - Validate `Content-Type: application/json` for POST and PUT, return 400 if missing
    - Parse JSON body, call `createArtifact`/`updateArtifact`/`deleteArtifact` from `admin.ts`
    - Return appropriate status codes (201, 200, 204) and JSON response shapes
    - Handle errors (400 validation, 409 conflict, 404 not-found, 500 server error) with structured JSON `{ error, details? }`
    - After each successful mutation, call `refreshCatalog`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 6.1, 6.2, 6.3_

  - [x] 5.3 Add collection routes to `handleRequest`: `GET /api/collections`, `GET /api/collections/:name`, `POST /api/collections`, `PUT /api/collections/:name`, `DELETE /api/collections/:name`
    - GET endpoints return collection data as JSON
    - POST/PUT/DELETE validate Content-Type, parse JSON, call collection-admin functions
    - Return appropriate status codes and JSON response shapes
    - After successful mutations, call `refreshCollections`
    - _Requirements: 9.1, 9.4, 10.1, 10.2, 10.3, 10.5, 10.6_

  - [x] 5.4 Add manifest routes to `handleRequest`: `GET /api/manifest`, `GET /api/manifest/status`, `POST /api/manifest/entries`, `PUT /api/manifest/entries/:identifier`, `DELETE /api/manifest/entries/:identifier`
    - GET endpoints read manifest and sync-lock, return JSON
    - POST/PUT/DELETE validate Content-Type, parse JSON, call manifest-admin functions
    - Return appropriate status codes and JSON response shapes
    - _Requirements: 12.1, 12.4, 12.6, 13.1, 13.2, 13.3, 13.5, 13.6_

  - [x] 5.5 Write integration tests extending `src/__tests__/browse.test.ts` for all mutation endpoints
    - Test artifact CRUD round-trips (POST → GET → verify, PUT → GET → verify, DELETE → GET → verify)
    - Test collection CRUD round-trips
    - Test manifest entry CRUD round-trips
    - Test GET /api/manifest/status returns correct sync status indicators
    - Test error responses have correct JSON shape for 400, 404, 409 status codes across all resource types
    - Test Content-Type validation on all mutation endpoints
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 9.1, 9.4, 10.1, 10.2, 10.3, 12.1, 12.4, 13.1, 13.2, 13.3_

- [x] 6. Checkpoint — Ensure browse route tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Build shared UI design system components in `generateHtmlPage()`
  - [x] 7.1 Add CSS design tokens (`:root` custom properties) and shared component styles to `generateHtmlPage()` in `browse.ts`
    - Define all design tokens: typography (font-display, font-body, font-mono), color palette (neutral warm grays, semantic colors, status indicators), spacing scale (4px base), radii, shadows
    - Add `.card` base styles with `.card--collection` modifier, `.card-header`, `.card-name`, `.card-description`, `.card-tags`, `.card-footer`
    - Add `.form-panel` styles with `.form-group`, `.form-label`, `.form-input`, `.form-textarea`, `.form-checkbox-group`, `.form-radio-group`, `.form-select`, `.form-error`, `.form-actions`
    - Add `.badge` styles with modifier classes: `.badge-maturity-*`, `.badge-trust-*`, `.badge-type-*`, `.badge-status-*`
    - Add `.toast-container` and `.toast` styles (`.toast--success`, `.toast--error`), fixed top-right positioning
    - Add `.modal` overlay and dialog styles
    - Add `.tab-nav` and `.tab-nav-item` styles with active state bottom border
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 9.2, 9.5, 12.2, 12.5, 14.1, 14.2_

  - [x] 7.2 Add shared JavaScript render functions to `generateHtmlPage()`: `renderCard`, `renderForm`, `renderBadge`, `showToast`, `showModal`, `showView`
    - `renderCard(data, type)` — renders a card element for either 'artifact' or 'collection' type, parameterized by content
    - `renderForm(fields, mode, onSubmit)` — renders a form panel for 'create' or 'edit' mode with field definitions
    - `renderBadge(text, variant)` — renders a badge span with the appropriate modifier class
    - `showToast(message, type)` — creates a toast notification ('success' or 'error'), auto-dismisses after 4 seconds
    - `showModal(title, message, onConfirm)` — shows a confirmation modal with cancel/confirm buttons
    - `showView(viewName)` — switches between 'artifacts', 'collections', 'manifest' views, updates active tab, shows/hides filters, renders content
    - _Requirements: 1.1, 3.1, 8.5, 9.2, 14.1_

- [x] 8. Build artifact admin UI (create/edit form, delete, notifications)
  - [x] 8.1 Implement artifact create/edit form using shared components
    - "New Artifact" button in header (context-aware based on active tab)
    - Shared form for create and edit modes with fields for all frontmatter properties
    - Render `harnesses` as checkboxes, `type` as radio buttons, `categories` as checkboxes, `keywords`/`ecosystem`/`depends`/`enhances` as comma-separated text inputs, body as monospace textarea
    - Pre-populate create form with defaults (version "0.1.0", all harnesses selected, type "skill", inclusion "always", empty arrays)
    - Pre-populate edit form with current artifact values
    - Client-side kebab-case validation on name field with real-time feedback
    - Auto-generate kebab-case name from displayName when name field is empty
    - _Requirements: 1.1, 1.2, 2.1, 5.2, 5.3, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 8.2 Implement artifact delete confirmation and success/error handling
    - Delete confirmation modal showing artifact name and permanent deletion warning
    - Wire "Edit" and "Delete" buttons into the artifact detail view
    - Handle API responses: display validation errors next to fields (400), conflict message (409), not-found navigation (404), generic error (500)
    - Display success toast notifications for create, update, and delete operations
    - After successful create: refresh catalog data and navigate to new artifact detail view
    - After successful edit: refresh catalog data and display updated detail view
    - After successful delete: refresh catalog data and navigate back to card grid
    - _Requirements: 1.7, 2.6, 3.1, 3.4, 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 9. Build collection admin UI (list, detail, create/edit/delete, filtering)
  - [x] 9.1 Implement collection list view and detail view using shared components
    - Collection card grid using `renderCard(col, 'collection')` with `.card--collection` modifier
    - Display displayName, description, trust badge (using `renderBadge`), and tag pills on each card
    - Collection detail view showing full metadata and list of member artifacts with links to artifact detail views
    - Visual indicator for trust level (official, community) using badge variants
    - _Requirements: 9.2, 9.3, 9.5, 14.2, 14.3_

  - [x] 9.2 Implement collection create/edit form and delete confirmation
    - "New Collection" button in header when collections tab is active
    - Collection form with fields: name, displayName, description, version, trust (dropdown: official, community), tags (comma-separated text input)
    - Delete confirmation modal for collections
    - Handle API responses with appropriate error/success feedback using `showToast`
    - After successful create/edit: refresh collections data and navigate to updated collection detail view
    - _Requirements: 10.7, 10.8_

  - [x] 9.3 Implement collection filtering by trust level and tags
    - Filter controls in the collections view filter bar
    - Trust level filter (checkboxes or dropdown)
    - Tag filter (text input or tag pills)
    - Filter logic: show only collections matching all active filter criteria
    - _Requirements: 14.6_

  - [x] 9.4 Implement collection badges on artifact detail views
    - Display collection membership badges in artifact metadata section
    - Each badge is clickable and navigates to the collection's detail view
    - Badge uses `.badge-trust-*` styling to indicate trust level
    - _Requirements: 14.4, 14.5_

- [x] 10. Build manifest admin UI (table view, status indicators, add/edit/remove)
  - [x] 10.1 Implement manifest table view with sync status indicators
    - Table-style list layout (not cards) for manifest entries
    - Each row shows: type icon (● artifact, ◆ collection), identifier (monospace), version pin (monospace), mode badge, harness icons, backend label, status dot
    - Status dot colors: green for synced, yellow for outdated, red for missing (using `--color-status-*` tokens)
    - Visually distinguish artifact entries from collection entries
    - Fetch and display sync status from `GET /api/manifest/status`
    - Handle empty manifest (no `.forge/manifest.yaml`) gracefully
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 10.2 Implement manifest "Add Entry" form and inline edit/remove controls
    - "Add Entry" button that shows a form with toggle between artifact reference and collection reference modes
    - Form fields: name/collection (mutually exclusive), version, mode (required/optional), harnesses (checkboxes), backend (optional text input)
    - Inline edit button (pencil icon) on each row that expands into editable form fields
    - Remove button (× icon) on each row with confirmation prompt via `showModal`
    - Handle API responses with appropriate error/success feedback
    - _Requirements: 13.7, 13.8, 13.9_

- [x] 11. Wire tab navigation and cross-view links
  - [x] 11.1 Implement tab navigation bar (Artifacts | Collections | Manifest)
    - Horizontal tab bar below header using `.tab-nav` pattern
    - Active tab has bottom border accent
    - `showView(viewName)` handles tab switching, filter bar visibility, and content rendering
    - Context-aware "New" button in header changes label based on active tab
    - _Requirements: 14.1_

- [x] 12. Checkpoint — Ensure full UI integration works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Property-based tests for artifact correctness properties (1–9)
  - [x] 13.1 Write property test for frontmatter serialization round-trip in `src/__tests__/admin.property.test.ts`
    - **Property 1: Frontmatter serialization round-trip**
    - Reuse `frontmatterArb` generator pattern from `schema-roundtrip.property.test.ts`
    - Serialize with `serializeFrontmatter`, parse back with `gray-matter` + `FrontmatterSchema`, verify equivalence
    - **Validates: Requirements 2.3**

  - [x] 13.2 Write property test for validation consistency in `src/__tests__/admin.property.test.ts`
    - **Property 2: Validation consistency with FrontmatterSchema**
    - Generate random ArtifactInput objects (both valid and invalid), verify `validateArtifactInput` agrees with `FrontmatterSchema.safeParse` + kebab-case check
    - **Validates: Requirements 1.4, 2.2**

  - [x] 13.3 Write property test for kebab-case name validation in `src/__tests__/admin.property.test.ts`
    - **Property 3: Kebab-case name validation**
    - Generate random strings, verify admin API acceptance matches `^[a-z0-9]+(-[a-z0-9]+)*$` regex
    - **Validates: Requirements 1.6, 5.1**

  - [x] 13.4 Write property test for create file structure in `src/__tests__/admin.property.test.ts`
    - **Property 4: Create produces correct file structure**
    - Generate valid ArtifactInput, create in temp directory, verify `knowledge.md`, `hooks.yaml`, `mcp-servers.yaml`, and `workflows/` exist
    - **Validates: Requirements 1.3**

  - [x] 13.5 Write property test for update preserving files in `src/__tests__/admin.property.test.ts`
    - **Property 5: Update preserves non-knowledge.md files**
    - Create artifact with known hooks/mcp content, update with new frontmatter/body, verify hooks.yaml and mcp-servers.yaml are byte-identical
    - **Validates: Requirements 2.4**

  - [x] 13.6 Write property test for delete removing directory in `src/__tests__/admin.property.test.ts`
    - **Property 6: Delete removes artifact directory**
    - Create then delete artifact in temp directory, verify directory no longer exists
    - **Validates: Requirements 3.2**

  - [x] 13.7 Write property test for catalog consistency after mutations in `src/__tests__/admin.property.test.ts`
    - **Property 7: Catalog consistency after mutations**
    - Execute a sequence of create/update/delete operations, verify in-memory catalog matches fresh `generateCatalog` scan after each
    - **Validates: Requirements 4.4, 6.1**

  - [x] 13.8 Write property test for toKebabCase output in `src/__tests__/admin.property.test.ts`
    - **Property 8: toKebabCase produces valid kebab-case**
    - Generate non-empty display name strings with at least one alphanumeric character, verify output matches `^[a-z0-9]+(-[a-z0-9]+)*$`
    - **Validates: Requirements 5.3**

  - [x] 13.9 Write property test for comma-separated string parsing round-trip in `src/__tests__/admin.property.test.ts`
    - **Property 9: Comma-separated string parsing round-trip**
    - Generate arrays of non-empty strings without commas, join with commas, split/trim back, verify equivalence
    - **Validates: Requirements 7.3**

- [x] 14. Property-based tests for collection correctness properties (10–12, 16)
  - [x] 14.1 Write property test for collection YAML round-trip in `src/__tests__/collection-admin.property.test.ts`
    - **Property 10: Collection YAML round-trip**
    - Generate random valid Collection objects (name, displayName, description, version, trust, tags), serialize with `serializeCollection`, parse back with `parseCollectionFile`, verify deep equality
    - **Validates: Requirements 11.1, 11.2, 11.3**

  - [x] 14.2 Write property test for collection unknown key preservation in `src/__tests__/collection-admin.property.test.ts`
    - **Property 11: Collection unknown key preservation**
    - Extend Property 10 generator with random extra top-level keys, verify unknown keys survive round-trip in the raw object
    - **Validates: Requirements 11.4**

  - [x] 14.3 Write property test for collection validation consistency in `src/__tests__/collection-admin.property.test.ts`
    - **Property 12: Collection validation consistency with CollectionSchema**
    - Generate random CollectionInput objects (both valid and invalid), verify `validateCollectionInput` agrees with `CollectionSchema.safeParse` + kebab-case check
    - **Validates: Requirements 10.4**

  - [x] 14.4 Write property test for collection filtering correctness in `src/__tests__/collection-admin.property.test.ts`
    - **Property 16: Collection filtering correctness**
    - Generate random collections with various trust levels and tags, apply filter combinations, verify results include exactly those collections matching all active filter criteria
    - **Validates: Requirements 14.6**

- [x] 15. Property-based tests for manifest correctness properties (13–15)
  - [x] 15.1 Write property test for sync status computation in `src/__tests__/manifest-admin.property.test.ts`
    - **Property 13: Sync status computation correctness**
    - Generate random manifest entries and sync-lock entries with varying overlap, verify `computeSyncStatus` returns correct status for each entry (synced/outdated/missing)
    - **Validates: Requirements 12.4**

  - [x] 15.2 Write property test for manifest entry validation delegation in `src/__tests__/manifest-admin.property.test.ts`
    - **Property 14: Manifest entry validation delegation**
    - Generate random ManifestEntryInput objects (valid artifact refs, valid collection refs, invalid both/neither), verify `validateManifestEntry` delegates correctly to the appropriate schema
    - **Validates: Requirements 13.4**

  - [x] 15.3 Write property test for manifest top-level field preservation in `src/__tests__/manifest-admin.property.test.ts`
    - **Property 15: Manifest top-level field preservation during entry mutations**
    - Generate manifests with backend and extra keys, perform entry mutations (add/edit/remove), verify top-level fields are preserved
    - **Validates: Requirements 13.10**

- [x] 16. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Write ADRs and changelog fragments for the completed tasks if relevant.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (Properties 1–16)
- The shared UI design system (task 7) is built BEFORE view-specific content (tasks 8–11) to enforce DRY patterns
- `admin.ts`, `collection-admin.ts`, and `manifest-admin.ts` are independent modules built sequentially (tasks 1–3) before route wiring (task 5)
- The `manifest-admin.ts` module reuses `parseManifest`/`printManifest` from `guild/manifest.ts`
- The `collection-admin.ts` module uses `js-yaml` and `CollectionSchema` from `schemas.ts`
- Frontend uses vanilla JS with parameterized render functions — no framework
