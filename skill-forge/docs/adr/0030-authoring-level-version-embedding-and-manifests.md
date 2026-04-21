# ADR-0030: Authoring-Level Version Embedding and Manifests

## Status

Accepted

## Date

2026-04-21

## Context

Skill Forge has two distinct versioning concerns:

1. **Distribution-level versioning** — handled by the Guild system (`src/guild/`), which tracks which compiled version to fetch from a remote backend and cache globally.
2. **Authoring-level versioning** — tracking what version of the source artifact is compiled and installed locally, so that upgrades and migrations can be detected.

ADR-017 introduced `.forge-manifest.json` for recording backend provenance during `forge install --from-release`, but it only captures the backend label and artifact name — not the semver version, source path, installed file list, or timestamp needed for upgrade detection.

The build pipeline had no mechanism to stamp compiled output with the source artifact's version, making it impossible to determine which version of an artifact is installed by inspecting the output files alone.

## Decision

Introduce authoring-level version tracking with three components:

1. **`VersionManifest` schema** (`src/schemas.ts`) — A Zod-validated schema recording `artifactName`, `version` (semver), `harnessName`, `sourcePath`, `installedAt` (ISO datetime), and `files` (list of installed file paths). Written as `.forge-manifest.json` alongside installed files.

2. **Version embedding in compiled output** (`src/versioning.ts` → `embedVersion()`) — The build pipeline injects a `<!-- forge:version X.Y.Z -->` comment into compiled Markdown files and a `"_forgeVersion": "X.Y.Z"` field into compiled JSON files. This makes the version discoverable from output files without requiring the manifest.

3. **Version extraction from compiled files** (`src/install.ts` → `extractVersionFromFiles()`) — During install, if no explicit `--version` flag is provided, the installer scans compiled Markdown files for the `<!-- forge:version -->` comment to populate the manifest automatically.

The `FrontmatterSchema.version` field gains semver regex validation (`/^\d+\.\d+\.\d+$/`) and a build-time warning when the default `0.1.0` is used.

## Consequences

### Positive

- Installed artifacts are self-describing — the version is embedded in the output and recorded in a manifest
- `forge upgrade` (future) can compare installed manifest version against the latest source version
- Migration scripts can use the manifest's `fromVersion` to determine which transforms to apply
- Workspace-aware install writes per-project manifests, enabling per-project upgrade tracking

### Negative

- Compiled output is slightly modified (one comment line per Markdown file, one field per JSON file) — consumers that parse output strictly may need to account for the version marker
- Two manifest formats coexist: the legacy `ForgeManifestEntry[]` (from ADR-017's backend provenance) and the new `VersionManifest` — these should be unified in a future pass

### Neutral

- The `VersionManifest` schema is defined centrally in `src/schemas.ts` following existing conventions
- `embedVersion()` and `serializeManifest()` are pure functions in `src/versioning.ts`, consistent with the project's pure-function preference (ADR-003)

## Links and References

- Extends: [ADR-017](./0017-pluggable-backend-abstraction-for-artifact-publishing.md) (`.forge-manifest.json` provenance)
- Related: [ADR-023](./0023-manifest-driven-artifact-distribution-with-global-cache.md) (Guild distribution-level versioning)
- Implementation: `src/versioning.ts`, `src/schemas.ts` (`VersionManifestSchema`), `src/build.ts` (`embedVersion` calls), `src/install.ts` (`writeVersionManifest`, `extractVersionFromFiles`)
