# Requirements Document

## Introduction

This feature adds admin management capabilities to the existing `forge catalog browse` web interface. Currently the browse interface is read-only — users can view, search, and filter catalog entries but cannot create, edit, or delete knowledge artifacts. The admin management feature introduces mutation endpoints and corresponding UI to allow full CRUD (Create, Read, Update, Delete) operations on knowledge artifacts directly from the browser, eliminating the need to manually edit files on disk for common authoring tasks.

Additionally, this feature extends the admin UI to support **collection management** and **manifest/team management**. Collections (curated bundles of artifacts defined in `collections/*.yaml`) can be viewed, created, edited, and deleted through the UI. The manifest (`.forge/manifest.yaml`) — which declares a repository's artifact dependencies — can be viewed and managed through the UI, including adding/removing entries, editing entry settings, and viewing sync status. The browse UI also integrates collections alongside artifacts for unified discovery.

## Glossary

- **Browse_Server**: The Bun HTTP server started by `forge catalog browse`, serving the SPA and API endpoints on localhost.
- **Admin_API**: The set of HTTP endpoints on the Browse_Server that handle mutation operations (create, update, delete) on knowledge artifacts.
- **Catalog_UI**: The single-page application served at the root of the Browse_Server, including both the existing browse views and the new admin management views.
- **Knowledge_Artifact**: A directory under `knowledge/` containing a `knowledge.md` file (with YAML frontmatter and markdown body), optional `hooks.yaml`, `mcp-servers.yaml`, and a `workflows/` subdirectory.
- **Frontmatter**: The YAML metadata block at the top of `knowledge.md`, validated by the FrontmatterSchema (name, displayName, description, keywords, author, version, harnesses, type, inclusion, categories, ecosystem, depends, enhances).
- **Artifact_Name**: A kebab-case identifier used as the directory name under `knowledge/` and as the `name` field in frontmatter.
- **Catalog_Entry**: A JSON object representing a knowledge artifact in the catalog, derived from parsing frontmatter and directory metadata.
- **Collection**: A curated bundle of artifacts defined as a YAML file in `collections/`. Contains metadata fields: name, displayName, description, version, trust, and tags.
- **Collection_File**: A YAML file in the `collections/` directory that defines a Collection's metadata.
- **Manifest**: A YAML file at `.forge/manifest.yaml` that declares which artifacts and collections a repository depends on, along with version pins, modes, and harness targets.
- **Manifest_Entry**: A single declaration within the Manifest referencing either an individual artifact (by `name`) or a collection (by `collection`), along with version pin, mode, harnesses, and optional backend override.
- **Sync_Lock**: A JSON file at `.forge/sync-lock.json` recording the exact resolved versions and sources for each manifest entry after the last sync.
- **Sync_Status**: The state of a manifest entry indicating whether the referenced artifact or collection is resolved in the global cache, missing, or outdated.

## Requirements

### Requirement 1: Create New Artifact via Admin UI

**User Story:** As a knowledge author, I want to create a new knowledge artifact through the catalog UI, so that I can scaffold artifacts without using the CLI.

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


### Requirement 9: Collection Management — View and Browse

**User Story:** As a knowledge author, I want to view all collections in the catalog UI, so that I can understand what curated bundles are available and what artifacts they contain.

#### Acceptance Criteria

1. THE Admin_API SHALL expose a `GET /api/collections` endpoint that returns an array of all Collection objects parsed from the `collections/` directory as JSON.
2. WHEN the user navigates to the collections view in the Catalog_UI, THE Catalog_UI SHALL display a list of all collections showing each collection's displayName, description, version, trust level, and tags.
3. WHEN the user clicks on a collection in the list, THE Catalog_UI SHALL display a detail view showing the collection's full metadata and a list of member artifacts (artifacts whose frontmatter declares membership in the collection).
4. THE Admin_API SHALL expose a `GET /api/collections/:name` endpoint that returns a single Collection object and its member artifact names as JSON.
5. THE Catalog_UI SHALL display a visual indicator for each collection's trust level (official, community, or other values).

### Requirement 10: Collection Management — Create, Edit, Delete

**User Story:** As a knowledge author, I want to create, edit, and delete collections through the catalog UI, so that I can manage curated artifact bundles without manually editing YAML files.

#### Acceptance Criteria

1. THE Admin_API SHALL expose a `POST /api/collections` endpoint that accepts a JSON body with collection fields (name, displayName, description, version, trust, tags), creates a new Collection_File in `collections/`, and returns the created Collection as JSON with HTTP status 201.
2. THE Admin_API SHALL expose a `PUT /api/collections/:name` endpoint that accepts a JSON body with updated collection fields, overwrites the existing Collection_File, and returns the updated Collection as JSON with HTTP status 200.
3. THE Admin_API SHALL expose a `DELETE /api/collections/:name` endpoint that removes the Collection_File from `collections/` and returns HTTP status 204 on success.
4. WHEN the user submits the collection creation form, THE Admin_API SHALL validate that the collection name matches the kebab-case pattern and that required fields (name, displayName, description, version, trust) are present.
5. IF the submitted collection name already exists as a file in `collections/`, THEN THE Admin_API SHALL reject the creation request with a conflict error (HTTP 409).
6. IF the specified collection does not exist when an edit or delete is requested, THEN THE Admin_API SHALL return a not-found error (HTTP 404).
7. THE Catalog_UI SHALL render the collection form with fields for name, displayName, description, version, trust (dropdown: official, community), and tags (comma-separated text input).
8. WHEN collection creation or editing succeeds, THE Catalog_UI SHALL refresh the collections data and navigate to the updated collection's detail view.

### Requirement 11: Collection YAML Serialization

**User Story:** As a developer, I want collection YAML files to be reliably parsed and serialized, so that programmatic modifications preserve the file structure.

#### Acceptance Criteria

1. THE Admin_API SHALL parse Collection_Files using `js-yaml` and validate them against a CollectionSchema (requiring name, displayName, description, version, trust; optional tags array).
2. THE Admin_API SHALL serialize Collection objects back to YAML using `js-yaml` with consistent formatting.
3. FOR ALL valid Collection objects, serializing to YAML and parsing back SHALL produce an equivalent Collection object (round-trip property).
4. WHEN a Collection_File contains unknown keys beyond the defined schema fields, THE Admin_API SHALL preserve the unknown keys during read and write operations.

### Requirement 12: Manifest Management — View Entries

**User Story:** As a developer on a team, I want to view the current manifest entries in the catalog UI, so that I can see what artifacts and collections my repository depends on and their sync status.

#### Acceptance Criteria

1. THE Admin_API SHALL expose a `GET /api/manifest` endpoint that reads `.forge/manifest.yaml`, parses it using the ManifestSchema, and returns the Manifest object (including backend and all entries) as JSON.
2. WHEN the user navigates to the manifest view in the Catalog_UI, THE Catalog_UI SHALL display a list of all Manifest_Entry objects showing: entry type (artifact or collection), name/collection identifier, version pin, mode, harnesses, and backend override.
3. THE Catalog_UI SHALL visually distinguish between individual artifact entries and collection reference entries in the manifest list.
4. THE Admin_API SHALL expose a `GET /api/manifest/status` endpoint that reads both the manifest and the Sync_Lock, and returns each entry's Sync_Status (resolved version, whether it is synced, missing, or outdated).
5. WHEN the manifest view is displayed, THE Catalog_UI SHALL show a status indicator next to each entry: a green indicator for synced entries, a yellow indicator for outdated entries, and a red indicator for missing entries.
6. IF the `.forge/manifest.yaml` file does not exist, THEN THE Admin_API SHALL return an empty manifest object with an empty artifacts array.

### Requirement 13: Manifest Management — Add, Edit, Remove Entries

**User Story:** As a developer on a team, I want to add, edit, and remove manifest entries through the catalog UI, so that I can manage my repository's artifact dependencies without manually editing YAML.

#### Acceptance Criteria

1. THE Admin_API SHALL expose a `POST /api/manifest/entries` endpoint that accepts a JSON body with a Manifest_Entry (either artifact ref or collection ref), appends it to the manifest's artifacts array, writes the updated manifest to `.forge/manifest.yaml`, and returns the updated Manifest as JSON with HTTP status 201.
2. THE Admin_API SHALL expose a `PUT /api/manifest/entries/:identifier` endpoint that accepts a JSON body with updated entry fields (version, mode, harnesses, backend), updates the matching entry in the manifest, writes the file, and returns the updated Manifest as JSON with HTTP status 200.
3. THE Admin_API SHALL expose a `DELETE /api/manifest/entries/:identifier` endpoint that removes the matching entry from the manifest's artifacts array, writes the updated manifest, and returns HTTP status 204.
4. WHEN adding a new manifest entry, THE Admin_API SHALL validate that the entry conforms to either ArtifactManifestEntrySchema or CollectionManifestEntrySchema and reject invalid entries with HTTP 400.
5. IF a manifest entry with the same name or collection identifier already exists, THEN THE Admin_API SHALL reject the addition with a conflict error (HTTP 409).
6. IF the specified entry identifier does not match any existing manifest entry, THEN THE Admin_API SHALL return a not-found error (HTTP 404) for edit and delete operations.
7. THE Catalog_UI SHALL provide an "Add Entry" form with a toggle between artifact reference and collection reference modes, and fields for: name/collection, version, mode (required/optional), harnesses (checkboxes), and backend (optional text input).
8. THE Catalog_UI SHALL provide inline edit controls on each manifest entry for modifying version pin, mode, harnesses, and backend.
9. THE Catalog_UI SHALL provide a remove button on each manifest entry with a confirmation prompt before deletion.
10. WHEN the manifest is modified through the Admin_API, THE Admin_API SHALL preserve the manifest's top-level backend field and any unknown keys.

### Requirement 14: Collection Browse Integration

**User Story:** As a knowledge author, I want to see collections alongside artifacts in the browse UI, so that I can discover curated bundles and understand artifact groupings in one place.

#### Acceptance Criteria

1. THE Catalog_UI SHALL display a navigation element (tab or toggle) allowing the user to switch between viewing artifacts and viewing collections.
2. WHEN the collections view is active, THE Catalog_UI SHALL display collection cards showing displayName, description, trust badge, and tag pills.
3. WHEN the user clicks a collection card, THE Catalog_UI SHALL navigate to the collection detail view showing full metadata and a list of member artifacts with links to their individual detail views.
4. THE Catalog_UI SHALL display a badge on artifact detail views indicating which collections the artifact belongs to (if any).
5. WHEN the user clicks a collection badge on an artifact detail view, THE Catalog_UI SHALL navigate to that collection's detail view.
6. THE Catalog_UI SHALL support filtering collections by trust level and tags in the collections view.
