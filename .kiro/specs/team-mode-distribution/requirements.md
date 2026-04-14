# Requirements Document

## Introduction

Team Mode Distribution adds a shared artifact distribution system to Skill Forge under the `forge guild` command group. Instead of vendoring compiled artifacts into every repository via `forge build` + committed `dist/` output, teams install artifacts globally and repos declare dependencies via a manifest file. The `forge guild` subcommands handle repo initialization, sync/resolve, status reporting, and shell hook integration. A sync engine resolves artifacts from the global cache into harness-specific locations, and an auto-update mechanism keeps all team members on the same artifact versions without manual intervention. Manifests can reference both individual artifacts and collections (curated bundles of artifacts), which are expanded at resolve time.

## Glossary

- **Global_Cache**: The directory `~/.forge/artifacts/` where globally installed artifacts are stored, organized by artifact name and version.
- **Manifest**: A YAML file (`.forge/manifest.yaml`) committed to a repository that declares which artifacts the repo requires, their version constraints, and whether each is required or optional.
- **Manifest_Entry**: A single declaration within the Manifest. Can reference either an individual artifact (by `name`) or a collection (by `collection`), along with version pin, mode, and harness targets.
- **Collection_Ref**: A Manifest_Entry that uses the `collection` field instead of `name`, referencing a named collection. The Sync_Engine expands Collection_Refs into their member artifacts at resolve time.
- **Artifact_Ref**: A reference to a specific artifact at a specific version within the Global_Cache.
- **Sync_Engine**: The component that reads the Manifest, resolves Artifact_Refs from the Global_Cache, and materializes compiled output into harness-specific locations in the working directory.
- **Harness_Target**: A harness-specific output location (e.g., `.kiro/steering/`, `.claude/`, `.github/copilot-instructions.md`) where materialized artifacts are placed.
- **Throttle_State**: A file (`~/.forge/.last-sync`) that records the timestamp of the last auto-update check to enforce throttle intervals.
- **Resolution_Strategy**: The method used to materialize artifacts into Harness_Targets — file-copy with `.gitignore` markers to keep generated files out of version control.
- **Version_Pin**: A semver string or semver range in a Manifest_Entry that constrains which artifact version the Sync_Engine resolves.
- **Forge_CLI**: The `forge` command-line interface provided by the `@jhu-sheridan-libraries/skill-forge` package.
- **Guild**: The `forge guild` command group that contains all team-mode subcommands: `init`, `sync`, `status`, and `hook`.
- **Backend**: A remote or local source from which artifacts can be fetched (GitHub releases, S3, HTTP, local filesystem), as defined in `forge.config.yaml`.

## Requirements

### Requirement 1: Global Artifact Installation

**User Story:** As a developer, I want to install compiled artifacts into a global cache on my machine, so that multiple repositories can share the same artifacts without duplicating files.

#### Acceptance Criteria

1. WHEN the user runs `forge install --global <artifact-name>`, THE Forge_CLI SHALL download the artifact from the configured Backend and store it in the Global_Cache under `~/.forge/artifacts/<artifact-name>/<version>/`.
2. WHEN the `--global` flag is provided with a `--from-release <tag>` option, THE Forge_CLI SHALL fetch the specified version from the Backend and store it in the Global_Cache.
3. WHEN the `--global` flag is provided without a version specifier, THE Forge_CLI SHALL fetch the latest available version from the Backend.
4. WHEN a globally installed artifact already exists at the same version, THE Forge_CLI SHALL skip the installation and inform the user that the version is already cached.
5. WHEN a globally installed artifact already exists at a different version, THE Forge_CLI SHALL install the new version alongside the existing one without removing the old version.
6. THE Forge_CLI SHALL store all harness outputs for a globally installed artifact within the version directory in the Global_Cache, organized as `~/.forge/artifacts/<artifact-name>/<version>/dist/<harness>/`.
7. IF the Backend is unreachable during global installation, THEN THE Forge_CLI SHALL display an error message that includes the Backend name and the connection failure reason.

### Requirement 2: Repository Manifest Declaration

**User Story:** As a team lead, I want to declare which artifacts and collections a repository needs in a manifest file, so that all team members use the same artifacts without committing artifact content to the repo.

#### Acceptance Criteria

1. THE Manifest SHALL be a YAML file located at `.forge/manifest.yaml` in the repository root.
2. THE Manifest SHALL contain a top-level `artifacts` key that holds an array of Manifest_Entry objects.
3. A Manifest_Entry SHALL reference either an individual artifact (via the `name` field) or a collection (via the `collection` field), but not both.
4. WHEN a Manifest_Entry specifies `mode: required`, THE Sync_Engine SHALL treat a missing artifact in the Global_Cache as a fatal error during sync.
5. WHEN a Manifest_Entry specifies `mode: optional`, THE Sync_Engine SHALL skip the artifact with a warning if it is not found in the Global_Cache.
6. A Manifest_Entry referencing an individual artifact SHALL contain the fields: `name` (string, required), `version` (Version_Pin, required), `mode` (enum: `required` | `optional`, default: `required`), and `harnesses` (array of harness names, optional — defaults to all supported harnesses).
7. A Manifest_Entry referencing a collection SHALL contain the fields: `collection` (string, required), `version` (Version_Pin, required), `mode` (enum: `required` | `optional`, default: `required`), and `harnesses` (array of harness names, optional — defaults to all supported harnesses).
8. THE Manifest SHALL support a `backend` field at the top level that specifies the default Backend name for resolving artifacts.
9. A Manifest_Entry MAY include a `backend` field that overrides the top-level default, allowing a single manifest to pull artifacts from different Backends (e.g., some from S3, others from GitHub).
10. IF the Manifest file fails YAML parsing, THEN THE Forge_CLI SHALL display a descriptive parse error that includes the line number and column of the syntax error.
11. IF a Manifest_Entry is missing both the `name` and `collection` fields, THEN THE Forge_CLI SHALL reject the Manifest with an error identifying the incomplete entry.

### Requirement 3: Manifest Schema Parsing and Printing

**User Story:** As a developer, I want the manifest file to be reliably parsed and serialized, so that programmatic modifications to the manifest preserve its structure.

#### Acceptance Criteria

1. THE Manifest_Parser SHALL parse a valid `.forge/manifest.yaml` file into a typed Manifest object.
2. THE Manifest_Printer SHALL serialize a Manifest object back into valid YAML that conforms to the Manifest schema.
3. FOR ALL valid Manifest objects, parsing the printed output of a Manifest object SHALL produce an equivalent Manifest object (round-trip property).
4. WHEN the Manifest file contains unknown top-level keys, THE Manifest_Parser SHALL preserve the unknown keys without error so that forward-compatible extensions are supported.
5. IF the Manifest file contains a Manifest_Entry with an unrecognized harness name, THEN THE Manifest_Parser SHALL emit a warning and skip the unrecognized harness rather than rejecting the entire Manifest.

### Requirement 4: Guild Init Command

**User Story:** As a developer setting up a repository for team mode, I want a single command that adds an artifact or collection to the manifest and wires up harness pointers, so that I do not have to manually configure each tool.

#### Acceptance Criteria

1. WHEN the user runs `forge guild init <artifact-name>`, THE Forge_CLI SHALL add a Manifest_Entry for the specified artifact to `.forge/manifest.yaml`, creating the file if it does not exist.
2. WHEN the user runs `forge guild init <collection-name> --collection`, THE Forge_CLI SHALL add a Collection_Ref Manifest_Entry for the specified collection to `.forge/manifest.yaml`.
3. WHEN the `--mode required` option is provided, THE Forge_CLI SHALL set the Manifest_Entry mode to `required`.
4. WHEN the `--mode optional` option is provided, THE Forge_CLI SHALL set the Manifest_Entry mode to `optional`.
5. WHEN no `--mode` option is provided, THE Forge_CLI SHALL default the Manifest_Entry mode to `required`.
6. WHEN the `--version <pin>` option is provided, THE Forge_CLI SHALL set the Manifest_Entry Version_Pin to the specified value.
7. WHEN no `--version` option is provided, THE Forge_CLI SHALL query the Global_Cache for the latest installed version and use it as the Version_Pin.
8. WHEN the artifact or collection is not found in the Global_Cache and no `--version` is specified, THE Forge_CLI SHALL prompt the user to run `forge install --global <name>` first and exit with a non-zero status code.
9. THE Forge_CLI SHALL add a `.forge/` entry to the repository's `.gitignore` file (creating it if necessary) to prevent manifest-managed generated files from being committed, while preserving the manifest file itself.
10. IF the artifact or collection already exists in the Manifest, THEN THE Forge_CLI SHALL update the existing Manifest_Entry with the new options rather than creating a duplicate entry.
11. WHEN guild init completes successfully, THE Forge_CLI SHALL run the Sync_Engine for the newly added entry to immediately materialize it into Harness_Targets.

### Requirement 5: Guild Sync and Resolve Command

**User Story:** As a developer, I want to run a single command that reads the manifest and materializes all declared artifacts into the correct harness locations, so that my AI coding tools have access to the latest team artifacts.

#### Acceptance Criteria

1. WHEN the user runs `forge guild sync`, THE Sync_Engine SHALL read `.forge/manifest.yaml` and resolve each Manifest_Entry against the Global_Cache.
2. THE Sync_Engine SHALL resolve each Manifest_Entry by finding the highest version in the Global_Cache that satisfies the Version_Pin.
3. WHEN a Manifest_Entry is a Collection_Ref, THE Sync_Engine SHALL expand the collection into its member artifacts (by reading the collection's catalog metadata from the Global_Cache) and resolve each member individually.
4. WHEN a matching version is found, THE Sync_Engine SHALL copy the compiled artifact files from the Global_Cache into the appropriate Harness_Targets in the working directory.
5. THE Sync_Engine SHALL use the Resolution_Strategy of copying files and adding generated paths to a `.forge/.gitignore` file to keep materialized artifacts out of version control.
6. WHEN the `--dry-run` flag is provided, THE Sync_Engine SHALL display the list of files that would be materialized without writing any files.
7. WHEN the `--harness <name>` flag is provided, THE Sync_Engine SHALL materialize artifacts only for the specified harness.
8. IF a required Manifest_Entry cannot be resolved (artifact or version not found in Global_Cache), THEN THE Sync_Engine SHALL exit with a non-zero status code and display an error listing the unresolved artifacts.
9. IF an optional Manifest_Entry cannot be resolved, THEN THE Sync_Engine SHALL emit a warning and continue processing remaining entries.
10. WHEN multiple Manifest_Entries target the same Harness_Target directory, THE Sync_Engine SHALL materialize each artifact into its own subdirectory within the Harness_Target to prevent file collisions.
11. THE Sync_Engine SHALL write a `.forge/sync-lock.json` file recording the exact versions resolved for each artifact (including expanded collection members), so that the resolution is reproducible.

### Requirement 6: Auto-Update Mechanism

**User Story:** As a team lead, I want artifact updates to happen automatically in the background, so that developers always have the latest versions without manual intervention.

#### Acceptance Criteria

1. WHEN the user runs `forge guild sync --auto-update`, THE Sync_Engine SHALL check the configured Backend for newer versions of each artifact in the Manifest before resolving.
2. WHEN a newer version is available that satisfies the Version_Pin, THE Sync_Engine SHALL download the newer version to the Global_Cache and use it for resolution.
3. THE Sync_Engine SHALL record the current timestamp in the Throttle_State file after completing an auto-update check.
4. WHEN `forge guild sync --auto-update` is invoked and the Throttle_State file indicates that fewer than 60 minutes have elapsed since the last check, THE Sync_Engine SHALL skip the remote version check and resolve from the existing Global_Cache.
5. IF the Backend is unreachable during auto-update, THEN THE Sync_Engine SHALL silently fall back to resolving from the existing Global_Cache without displaying an error.
6. THE Sync_Engine SHALL complete the auto-update check and sync within the same command invocation without requiring user interaction.
7. WHEN the `--throttle <minutes>` option is provided with `--auto-update`, THE Sync_Engine SHALL use the specified interval instead of the default 60-minute throttle.

### Requirement 7: Guild Hook Integration

**User Story:** As a developer, I want auto-update to run transparently when I enter a project directory, so that I always have current artifacts without remembering to run a command.

#### Acceptance Criteria

1. WHEN the user runs `forge guild hook install`, THE Forge_CLI SHALL output a shell snippet suitable for appending to the user's shell profile (`.bashrc`, `.zshrc`, or equivalent).
2. THE shell snippet SHALL detect when the user changes into a directory containing a `.forge/manifest.yaml` file and invoke `forge guild sync --auto-update` in the background.
3. THE shell snippet SHALL redirect all output from the background sync to `/dev/null` so that the sync is completely silent during normal operation.
4. WHEN the user runs `forge guild hook install --shell <name>`, THE Forge_CLI SHALL generate the snippet for the specified shell (bash, zsh, fish).
5. WHEN no `--shell` option is provided, THE Forge_CLI SHALL detect the current shell from the `SHELL` environment variable.
6. IF the `SHELL` environment variable is not set and no `--shell` option is provided, THEN THE Forge_CLI SHALL display an error asking the user to specify the shell explicitly.
7. WHEN running on Windows, THE Forge_CLI SHALL generate a PowerShell profile snippet instead of a POSIX shell snippet.

### Requirement 8: Cross-Platform Compatibility

**User Story:** As a developer working on macOS, Linux, or Windows, I want the team mode distribution system to work consistently across operating systems, so that my team can use it regardless of their development environment.

#### Acceptance Criteria

1. THE Global_Cache SHALL use platform-appropriate path separators and resolve `~` to the user's home directory using the operating system's native home directory resolution.
2. THE Sync_Engine SHALL use file copy operations (not symlinks) as the Resolution_Strategy to ensure compatibility across all platforms including Windows without requiring elevated privileges.
3. THE Forge_CLI SHALL normalize all file paths in the Manifest and sync-lock files to use forward slashes for cross-platform consistency in committed files.
4. WHILE running on Windows, THE Forge_CLI SHALL use `%USERPROFILE%\.forge\artifacts\` as the Global_Cache location.
5. WHILE running on a POSIX system (macOS or Linux), THE Forge_CLI SHALL use `~/.forge/artifacts/` as the Global_Cache location.

### Requirement 9: Version Conflict Detection

**User Story:** As a developer, I want to be informed when version conflicts exist between the manifest and the global cache, so that I can resolve them before they cause issues.

#### Acceptance Criteria

1. WHEN `forge guild sync` encounters a Manifest_Entry whose Version_Pin cannot be satisfied by any version in the Global_Cache, THE Sync_Engine SHALL display an error listing the artifact name, the requested Version_Pin, and the versions available in the Global_Cache.
2. WHEN the user runs `forge guild status`, THE Forge_CLI SHALL display a table showing each Manifest_Entry (with expanded collection members), its Version_Pin, the resolved version (or "missing"), and whether the materialized files are up to date.
3. WHEN the sync-lock.json records a version that no longer exists in the Global_Cache, THE Sync_Engine SHALL treat the artifact as unresolved and attempt re-resolution from available versions.

### Requirement 10: Offline Operation

**User Story:** As a developer, I want the sync command to work without network access when artifacts are already cached, so that I can work in environments with limited connectivity.

#### Acceptance Criteria

1. WHEN `forge guild sync` is run without the `--auto-update` flag, THE Sync_Engine SHALL resolve artifacts exclusively from the Global_Cache without making any network requests.
2. WHEN `forge guild sync --auto-update` is run and the Backend is unreachable, THE Sync_Engine SHALL resolve from the Global_Cache and emit a single debug-level log message indicating that the remote check was skipped.
3. THE Forge_CLI SHALL cache the artifact catalog metadata alongside artifact files in the Global_Cache so that `forge guild status` can display version information without network access.

### Requirement 11: Collection Expansion

**User Story:** As a team lead, I want to reference a collection in the manifest and have all its member artifacts resolved automatically, so that I do not have to enumerate every artifact individually.

#### Acceptance Criteria

1. WHEN the Sync_Engine encounters a Collection_Ref in the Manifest, IT SHALL read the collection's member list from the catalog metadata in the Global_Cache.
2. THE Sync_Engine SHALL expand the Collection_Ref into individual Artifact_Refs for each member of the collection, inheriting the Collection_Ref's mode and harness settings.
3. WHEN a collection member is also listed as an individual Manifest_Entry, THE individual entry SHALL take precedence over the collection-inherited settings (mode, version, harnesses, backend).
4. THE sync-lock.json SHALL record expanded collection members individually, with a `source` field indicating which collection they originated from.
5. WHEN a collection's member list changes between versions (artifact added or removed), THE Sync_Engine SHALL detect the difference during `--auto-update` and materialize or remove artifacts accordingly.
6. WHEN the user runs `forge guild status`, THE Forge_CLI SHALL display collection members grouped under their collection name, with an indicator showing which entries are collection-inherited vs. individually declared.

### Requirement 12: Backend Integration

**User Story:** As a developer on a team with private artifact stores, I want the guild commands to use the existing pluggable backend system, so that I can pull artifacts from S3, GitHub, HTTP, or local sources without special configuration.

#### Acceptance Criteria

1. THE Sync_Engine SHALL resolve the Backend for each Manifest_Entry by checking (in order): the entry-level `backend` field, the manifest-level `backend` field, and the default backend from `forge.config.yaml`.
2. WHEN `forge guild sync --auto-update` checks for newer versions, IT SHALL call `listVersions()` on the resolved Backend for each artifact.
3. WHEN `forge guild sync --auto-update` downloads a newer version, IT SHALL call `fetchArtifact()` on the resolved Backend and store the result in the Global_Cache.
4. WHEN `forge install --global <name> --backend <backend-name>` is used, THE Forge_CLI SHALL record the backend name in the Global_Cache metadata so that subsequent auto-update checks use the same backend.
5. IF a Manifest_Entry specifies a `backend` name that is not defined in `forge.config.yaml`, THEN THE Forge_CLI SHALL display an error listing the unknown backend name and the available configured backends.
