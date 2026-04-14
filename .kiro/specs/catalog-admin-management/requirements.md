# Requirements Document

## Introduction

This feature adds admin management capabilities to the existing `forge catalog browse` web interface. Currently the browse interface is read-only — users can view, search, and filter catalog entries but cannot create, edit, or delete knowledge artifacts. The admin management feature introduces mutation endpoints and corresponding UI to allow full CRUD (Create, Read, Update, Delete) operations on knowledge artifacts directly from the browser, eliminating the need to manually edit files on disk for common authoring tasks.

## Glossary

- **Browse_Server**: The Bun HTTP server started by `forge catalog browse`, serving the SPA and API endpoints on localhost.
- **Admin_API**: The set of HTTP endpoints on the Browse_Server that handle mutation operations (create, update, delete) on knowledge artifacts.
- **Catalog_UI**: The single-page application served at the root of the Browse_Server, including both the existing browse views and the new admin management views.
- **Knowledge_Artifact**: A directory under `knowledge/` containing a `knowledge.md` file (with YAML frontmatter and markdown body), optional `hooks.yaml`, `mcp-servers.yaml`, and a `workflows/` subdirectory.
- **Frontmatter**: The YAML metadata block at the top of `knowledge.md`, validated by the FrontmatterSchema (name, displayName, description, keywords, author, version, harnesses, type, inclusion, categories, ecosystem, depends, enhances).
- **Artifact_Name**: A kebab-case identifier used as the directory name under `knowledge/` and as the `name` field in frontmatter.
- **Catalog_Entry**: A JSON object representing a knowledge artifact in the catalog, derived from parsing frontmatter and directory metadata.

## Requirements

### Requirement 1: Create New Artifact via Admin UI

**User Story:** As a knowledge author, I want to create a new knowledge artifact through the browse UI, so that I can scaffold artifacts without using the CLI.

#### Acceptance Criteria

1. WHEN the user clicks the "New Artifact" button in the Catalog_UI, THE Catalog_UI SHALL display a creation form with fields for all Frontmatter properties (name, displayName, description, keywords, author, version, harnesses, type, inclusion, categories, ecosystem, depends, enhances) and a body content editor.
2. THE Catalog_UI SHALL pre-populate the creation form with default values matching the template defaults (version "0.1.0", all harnesses selected, type "skill", inclusion "always", empty arrays for keywords/categories/ecosystem/depends/enhances).
3. WHEN the user submits the creation form with a valid Artifact_Name, THE Admin_API SHALL create a new Knowledge_Artifact directory under `knowledge/` containing `knowledge.md`, an empty `hooks.yaml`, an empty `mcp-servers.yaml`, and an empty `workflows/` subdirectory.
4. WHEN the user submits the creation form, THE Admin_API SHALL validate the submitted Frontmatter using the existing FrontmatterSchema and return validation errors if the data is invalid.
5. IF the submitted Artifact_Name already exists as a directory under `knowledge/`, THEN THE Admin_API SHALL reject the request with a conflict error and a descriptive message.
6. IF the submitted Artifact_Name does not match the kebab-case pattern (`^[a-z0-9]+(-[a-z0-9]+)*$`), THEN THE Admin_API SHALL reject the request with a validation error.
7. WHEN artifact creation succeeds, THE Catalog_UI SHALL refresh the catalog data and navigate to the detail view of the newly created artifact.

### Requirement 2: Edit Existing Artifact via Admin UI

**User Story:** As a knowledge author, I want to edit an existing knowledge artifact's metadata and content through the browse UI, so that I can make changes without manually editing files.

#### Acceptance Criteria

1. WHEN the user clicks the "Edit" button on an artifact's detail view, THE Catalog_UI SHALL display an edit form pre-populated with the artifact's current Frontmatter values and body content.
2. WHEN the user submits the edit form, THE Admin_API SHALL validate the updated Frontmatter using the existing FrontmatterSchema and return validation errors if the data is invalid.
3. WHEN the edit form is submitted with valid data, THE Admin_API SHALL overwrite the `knowledge.md` file in the artifact's directory with the updated frontmatter and body content.
4. THE Admin_API SHALL preserve existing `hooks.yaml`, `mcp-servers.yaml`, and `workflows/` contents when updating an artifact's `knowledge.md`.
5. IF the artifact directory does not exist when an edit is submitted, THEN THE Admin_API SHALL return a not-found error.
6. WHEN artifact editing succeeds, THE Catalog_UI SHALL refresh the catalog data and display the updated artifact detail view.

### Requirement 3: Delete Artifact via Admin UI

**User Story:** As a knowledge author, I want to delete a knowledge artifact through the browse UI, so that I can remove obsolete artifacts without using the file system directly.

#### Acceptance Criteria

1. WHEN the user clicks the "Delete" button on an artifact's detail view, THE Catalog_UI SHALL display a confirmation dialog showing the artifact's name and warning that deletion is permanent.
2. WHEN the user confirms deletion, THE Admin_API SHALL remove the entire artifact directory (including `knowledge.md`, `hooks.yaml`, `mcp-servers.yaml`, `workflows/`, and any other contents) from the `knowledge/` directory.
3. IF the artifact directory does not exist when a delete is requested, THEN THE Admin_API SHALL return a not-found error.
4. WHEN artifact deletion succeeds, THE Catalog_UI SHALL refresh the catalog data and navigate back to the card grid view.

### Requirement 4: Admin API Endpoints

**User Story:** As a developer integrating with the browse server, I want well-defined REST API endpoints for artifact mutations, so that the admin UI and potential external tools can manage artifacts programmatically.

#### Acceptance Criteria

1. THE Admin_API SHALL expose a `POST /api/artifact` endpoint that accepts a JSON body with frontmatter fields and body content, creates a new Knowledge_Artifact, and returns the created Catalog_Entry as JSON with HTTP status 201.
2. THE Admin_API SHALL expose a `PUT /api/artifact/:name` endpoint that accepts a JSON body with updated frontmatter fields and body content, updates the existing Knowledge_Artifact, and returns the updated Catalog_Entry as JSON with HTTP status 200.
3. THE Admin_API SHALL expose a `DELETE /api/artifact/:name` endpoint that deletes the specified Knowledge_Artifact and returns HTTP status 204 on success.
4. WHEN any Admin_API mutation endpoint is called, THE Browse_Server SHALL regenerate the in-memory catalog entries from the `knowledge/` directory to reflect the change.
5. IF an Admin_API endpoint receives a request with an invalid or missing `Content-Type` header for endpoints expecting JSON, THEN THE Admin_API SHALL return HTTP status 400 with a descriptive error message.
6. THE Admin_API SHALL return error responses as JSON objects with an `error` field containing a human-readable message.

### Requirement 5: Artifact Name Validation

**User Story:** As a knowledge author, I want the system to enforce naming conventions, so that all artifact names remain consistent and compatible with the file system and existing tooling.

#### Acceptance Criteria

1. THE Admin_API SHALL validate that Artifact_Name values match the pattern `^[a-z0-9]+(-[a-z0-9]+)*$` (lowercase alphanumeric segments separated by hyphens).
2. THE Catalog_UI SHALL provide real-time validation feedback on the artifact name field, indicating whether the entered name is valid before form submission.
3. WHEN the user types a displayName in the creation form and the name field is empty, THE Catalog_UI SHALL auto-generate a kebab-case Artifact_Name from the displayName.

### Requirement 6: Catalog Data Refresh

**User Story:** As a knowledge author, I want the catalog to reflect my changes immediately after mutations, so that I can verify my edits without restarting the server.

#### Acceptance Criteria

1. WHEN a create, update, or delete operation completes successfully via the Admin_API, THE Browse_Server SHALL re-scan the `knowledge/` directory and rebuild the in-memory catalog entries.
2. WHEN the catalog data is refreshed, THE Admin_API SHALL return the updated Catalog_Entry (for create and update) or an empty response (for delete) so the Catalog_UI can update without a separate fetch.
3. IF an error occurs during catalog regeneration after a successful file operation, THEN THE Browse_Server SHALL log the error and return HTTP status 500 with a descriptive error message.

### Requirement 7: Frontmatter Form Controls

**User Story:** As a knowledge author, I want the edit and create forms to provide appropriate input controls for each frontmatter field, so that I can enter valid data efficiently.

#### Acceptance Criteria

1. THE Catalog_UI SHALL render the `harnesses` field as a set of checkboxes, one for each supported harness (kiro, claude-code, copilot, cursor, windsurf, cline, qdeveloper).
2. THE Catalog_UI SHALL render the `type` field as a radio button group with options: skill, power, rule.
3. THE Catalog_UI SHALL render the `keywords`, `ecosystem`, `depends`, and `enhances` fields as comma-separated text inputs that parse into arrays.
4. THE Catalog_UI SHALL render the `categories` field as a set of checkboxes, one for each valid category (testing, security, code-style, devops, documentation, architecture, debugging, performance, accessibility).
5. THE Catalog_UI SHALL render the body content field as a multi-line text area with monospace font.
6. WHEN the user submits a form with empty optional array fields, THE Catalog_UI SHALL send empty arrays rather than omitting the fields.

### Requirement 8: Error Handling and User Feedback

**User Story:** As a knowledge author, I want clear feedback when operations succeed or fail, so that I understand the result of my actions.

#### Acceptance Criteria

1. WHEN an Admin_API request fails with a validation error (HTTP 400), THE Catalog_UI SHALL display the specific validation error messages next to the relevant form fields.
2. WHEN an Admin_API request fails with a conflict error (HTTP 409), THE Catalog_UI SHALL display a message indicating the artifact name is already taken.
3. WHEN an Admin_API request fails with a not-found error (HTTP 404), THE Catalog_UI SHALL display a message indicating the artifact was not found and navigate back to the card grid.
4. WHEN an Admin_API request fails with a server error (HTTP 500), THE Catalog_UI SHALL display a generic error message indicating the operation could not be completed.
5. WHEN a create, update, or delete operation succeeds, THE Catalog_UI SHALL display a brief success notification.
