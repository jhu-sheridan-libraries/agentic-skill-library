# Implementation Plan: Catalog Admin Management

## Overview

Add full CRUD capabilities to the `forge catalog browse` server. This involves creating a new `admin.ts` module for validation, serialization, and file operations; extending `browse.ts` with mutation routes and a mutable catalog wrapper; and adding frontend UI (create/edit form, delete confirmation, notifications) to the HTML template. Implementation uses TypeScript with Bun, consistent with the existing codebase.

## Tasks

- [ ] 1. Create the `admin.ts` module with core functions
  - [ ] 1.1 Create `src/admin.ts` with the `ArtifactInput` interface, `validateArtifactInput` function (using `FrontmatterSchema` and kebab-case regex), `serializeFrontmatter` function (using `js-yaml` to produce `---` delimited YAML + body), and a `toKebabCase` helper for converting display names to kebab-case artifact names
    - Implement `validateArtifactInput` to run `FrontmatterSchema.safeParse` on the frontmatter fields and validate the name against `^[a-z0-9]+(-[a-z0-9]+)*$`
    - Implement `serializeFrontmatter` to produce a `knowledge.md` string with YAML frontmatter block and markdown body
    - Implement `toKebabCase` to lowercase, strip non-alphanumeric characters, and join segments with hyphens
    - _Requirements: 1.4, 1.6, 2.2, 5.1, 5.3_

  - [ ] 1.2 Add `createArtifact` async function to `src/admin.ts`
    - Create the artifact directory under `knowledge/`
    - Write `knowledge.md` using `serializeFrontmatter`
    - Create empty `hooks.yaml`, empty `mcp-servers.yaml`, and empty `workflows/` subdirectory
    - Check for existing directory and throw a conflict error if it exists
    - Re-scan catalog via `generateCatalog` and return the new `CatalogEntry`
    - _Requirements: 1.3, 1.5, 4.1, 4.4, 6.1, 6.2_

  - [ ] 1.3 Add `updateArtifact` async function to `src/admin.ts`
    - Validate the artifact directory exists, return not-found error if missing
    - Overwrite only `knowledge.md` with updated frontmatter and body (preserve all other files)
    - Re-scan catalog via `generateCatalog` and return the updated `CatalogEntry`
    - _Requirements: 2.3, 2.4, 2.5, 4.2, 4.4, 6.1, 6.2_

  - [ ] 1.4 Add `deleteArtifact` async function to `src/admin.ts`
    - Validate the artifact directory exists, return not-found error if missing
    - Recursively remove the entire artifact directory
    - Re-scan catalog via `generateCatalog`
    - _Requirements: 3.2, 3.3, 4.3, 4.4, 6.1_

  - [ ]* 1.5 Write unit tests for `admin.ts` in `src/__tests__/admin.test.ts`
    - Test `serializeFrontmatter` with known inputs produces expected YAML output
    - Test `validateArtifactInput` rejects empty name, invalid harness, invalid type, non-kebab-case name
    - Test `validateArtifactInput` accepts valid input
    - Test `toKebabCase` with various display name inputs
    - Test `createArtifact` conflict error when directory already exists
    - Test `updateArtifact` not-found error when directory is missing
    - Test `deleteArtifact` not-found error when directory is missing
    - _Requirements: 1.4, 1.5, 1.6, 2.2, 2.5, 3.3, 5.1, 5.3_

- [ ] 2. Checkpoint — Ensure admin module tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Extend `browse.ts` with mutation routes and mutable catalog
  - [ ] 3.1 Refactor `startBrowseServer` in `browse.ts` to use a mutable catalog wrapper `{ entries: CatalogEntry[] }` instead of a plain array, and add a `refreshCatalog` helper that re-scans `knowledge/` and updates the wrapper
    - Change `handleRequest` signature to accept the mutable wrapper
    - Update the existing `Bun.serve` fetch closure to pass the wrapper
    - _Requirements: 4.4, 6.1_

  - [ ] 3.2 Add `POST /api/artifact`, `PUT /api/artifact/:name`, and `DELETE /api/artifact/:name` route branches to `handleRequest` in `browse.ts`
    - Validate `Content-Type: application/json` for POST and PUT, return 400 if missing
    - Parse JSON body, call `createArtifact`/`updateArtifact`/`deleteArtifact` from `admin.ts`
    - Return appropriate status codes (201, 200, 204) and JSON response shapes
    - Handle errors (400 validation, 409 conflict, 404 not-found, 500 server error) with structured JSON
    - After each successful mutation, call `refreshCatalog` to update in-memory entries
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 6.1, 6.2, 6.3_

  - [ ]* 3.3 Write integration tests extending `src/__tests__/browse.test.ts` for mutation endpoints
    - Test POST create → GET catalog → verify entry present (HTTP round-trip)
    - Test PUT update → GET catalog → verify entry updated
    - Test DELETE → GET catalog → verify entry removed
    - Test error responses have correct JSON shape for 400, 404, 409 status codes
    - Test Content-Type validation on mutation endpoints
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6_

- [ ] 4. Checkpoint — Ensure browse mutation route tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Add frontend admin UI to the HTML template
  - [ ] 5.1 Add a "New Artifact" button to the header and implement the create/edit form component in `generateHtmlPage()` within `browse.ts`
    - Shared form for create and edit modes with fields for all frontmatter properties
    - Render `harnesses` as checkboxes, `type` as radio buttons, `categories` as checkboxes, `keywords`/`ecosystem`/`depends`/`enhances` as comma-separated text inputs, body as monospace textarea
    - Pre-populate create form with defaults (version "0.1.0", all harnesses selected, type "skill", inclusion "always", empty arrays)
    - Pre-populate edit form with current artifact values
    - Client-side kebab-case validation on the name field with real-time feedback
    - Auto-generate kebab-case name from displayName when name field is empty
    - _Requirements: 1.1, 1.2, 2.1, 5.2, 5.3, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ] 5.2 Add delete confirmation modal and toast notification system to `generateHtmlPage()`
    - Delete confirmation dialog showing artifact name and permanent deletion warning
    - Toast notification system for success and error feedback
    - Wire "Edit" and "Delete" buttons into the detail view
    - Handle API responses: display validation errors next to fields (400), conflict message (409), not-found navigation (404), generic error (500)
    - Display success notifications for create, update, and delete operations
    - After successful create: refresh catalog data and navigate to new artifact detail view
    - After successful edit: refresh catalog data and display updated detail view
    - After successful delete: refresh catalog data and navigate back to card grid
    - _Requirements: 1.7, 2.6, 3.1, 3.4, 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 6. Checkpoint — Ensure full UI integration works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Property-based tests for correctness properties
  - [ ]* 7.1 Write property test for frontmatter serialization round-trip in `src/__tests__/admin.property.test.ts`
    - **Property 1: Frontmatter serialization round-trip**
    - Reuse `frontmatterArb` generator pattern from `schema-roundtrip.property.test.ts`
    - Serialize with `serializeFrontmatter`, parse back with `gray-matter` + `FrontmatterSchema`, verify equivalence
    - **Validates: Requirements 2.3**

  - [ ]* 7.2 Write property test for validation consistency in `src/__tests__/admin.property.test.ts`
    - **Property 2: Validation consistency with FrontmatterSchema**
    - Generate random ArtifactInput objects (both valid and invalid), verify `validateArtifactInput` agrees with `FrontmatterSchema.safeParse` + kebab-case check
    - **Validates: Requirements 1.4, 2.2**

  - [ ]* 7.3 Write property test for kebab-case name validation in `src/__tests__/admin.property.test.ts`
    - **Property 3: Kebab-case name validation**
    - Generate random strings, verify admin API acceptance matches `^[a-z0-9]+(-[a-z0-9]+)*$` regex
    - **Validates: Requirements 1.6, 5.1**

  - [ ]* 7.4 Write property test for create file structure in `src/__tests__/admin.property.test.ts`
    - **Property 4: Create produces correct file structure**
    - Generate valid ArtifactInput, create in temp directory, verify `knowledge.md`, `hooks.yaml`, `mcp-servers.yaml`, and `workflows/` exist
    - **Validates: Requirements 1.3**

  - [ ]* 7.5 Write property test for update preserving files in `src/__tests__/admin.property.test.ts`
    - **Property 5: Update preserves non-knowledge.md files**
    - Create artifact with known hooks/mcp content, update with new frontmatter/body, verify hooks.yaml and mcp-servers.yaml are byte-identical
    - **Validates: Requirements 2.4**

  - [ ]* 7.6 Write property test for delete removing directory in `src/__tests__/admin.property.test.ts`
    - **Property 6: Delete removes artifact directory**
    - Create then delete artifact in temp directory, verify directory no longer exists
    - **Validates: Requirements 3.2**

  - [ ]* 7.7 Write property test for catalog consistency after mutations in `src/__tests__/admin.property.test.ts`
    - **Property 7: Catalog consistency after mutations**
    - Execute a sequence of create/update/delete operations, verify in-memory catalog matches fresh `generateCatalog` scan after each
    - **Validates: Requirements 4.4, 6.1**

  - [ ]* 7.8 Write property test for toKebabCase output in `src/__tests__/admin.property.test.ts`
    - **Property 8: toKebabCase produces valid kebab-case**
    - Generate non-empty display name strings with at least one alphanumeric character, verify output matches `^[a-z0-9]+(-[a-z0-9]+)*$`
    - **Validates: Requirements 5.3**

  - [ ]* 7.9 Write property test for comma-separated string parsing round-trip in `src/__tests__/admin.property.test.ts`
    - **Property 9: Comma-separated string parsing round-trip**
    - Generate arrays of non-empty strings without commas, join with commas, split/trim back, verify equivalence
    - **Validates: Requirements 7.3**

- [ ] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The `admin.ts` module is built first so it can be tested independently before wiring into `browse.ts`
