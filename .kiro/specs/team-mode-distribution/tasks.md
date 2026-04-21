# Implementation Plan: Team Mode Distribution

## Overview

Implement the `forge guild` command group and supporting modules for shared artifact distribution. Tasks are ordered by dependency: Zod schemas and types first, then core modules (cache, resolver, expander), then orchestration (sync engine, auto-updater), then CLI wiring (guild commands, install --global, hook generator), and finally integration checkpoints. Each task builds incrementally on previous work so there is no orphaned code.

## Tasks

- [x] 1. Create ManifestParser with Zod schemas and YAML round-trip
  - [x] 1.1 Create `src/guild/manifest.ts` with Zod schemas and parse/print functions
    - Define `ManifestEntryModeSchema`, `ArtifactManifestEntrySchema`, `CollectionManifestEntrySchema`, `ManifestEntrySchema` (union), and `ManifestSchema` (with `.passthrough()`)
    - Implement `parseManifest(yamlContent: string): Manifest` using `js-yaml` + Zod validation
    - Implement `printManifest(manifest: Manifest): string` using `js-yaml.dump()`
    - Implement `isCollectionRef()` type guard
    - Emit warnings (not errors) for unrecognized harness names in entries per Req 3.5
    - Reject entries that have both `name` and `collection` fields set
    - Include descriptive parse errors with line/column on YAML syntax failure
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 1.2 Write property test: Manifest round-trip (Property 1)
    - **Property 1: Manifest round-trip**
    - Generate random Manifest objects with 0–10 entries (mix of artifact/collection refs, random version pins, random harness subsets); assert `parseManifest(printManifest(m))` deeply equals `m`
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [x] 1.3 Write property test: Unknown top-level keys preserved (Property 2)
    - **Property 2: Unknown top-level keys are preserved**
    - Extend Property 1 generator with arbitrary extra top-level keys; assert they survive round-trip
    - **Validates: Requirements 3.4**

  - [x] 1.4 Write property test: Mutual exclusivity of name and collection (Property 3)
    - **Property 3: Mutual exclusivity of name and collection**
    - Generate entries with both `name` and `collection` set; assert parser rejects with validation error
    - **Validates: Requirements 2.3, 2.11**

  - [x] 1.5 Write property test: Unrecognized harness graceful degradation (Property 4)
    - **Property 4: Unrecognized harness graceful degradation**
    - Generate entries with mix of recognized and random harness names; assert parsing succeeds with only recognized harnesses and warnings emitted
    - **Validates: Requirements 3.5**

- [x] 2. Implement GlobalCache API
  - [x] 2.1 Create `src/guild/global-cache.ts` with `GlobalCacheAPI` interface and implementation
    - Implement platform-aware root path (`~/.forge/artifacts/` on POSIX, `%USERPROFILE%\.forge\artifacts\` on Windows)
    - Implement `listVersions(artifactName)` — read subdirectories under `<root>/artifacts/<name>/`
    - Implement `distPath(artifactName, version, harness)` — construct `<root>/artifacts/<name>/<version>/dist/<harness>/`
    - Implement `has(artifactName, version)` — check directory existence
    - Implement `store(artifactName, version, harness, sourceDir, backendLabel)` — copy files into cache, write `meta.json`
    - Implement `readCollectionCatalog(collectionName, version)` and `writeCatalogMeta()`
    - Implement `readThrottleState()` and `writeThrottleState()` for `~/.forge/.last-sync`
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 8.1, 8.4, 8.5, 10.3_

  - [x] 2.2 Write property test: Idempotent global install (Property 11)
    - **Property 11: Idempotent global install**
    - Generate random artifact names and versions; assert storing the same name+version twice does not modify cached files and returns skip result
    - **Validates: Requirements 1.4**

  - [x] 2.3 Write property test: Version coexistence in global cache (Property 12)
    - **Property 12: Version coexistence in global cache**
    - Generate pairs of distinct versions for the same artifact; assert both exist in cache after sequential installs
    - **Validates: Requirements 1.5**

  - [x] 2.4 Write property test: Cache path construction (Property 13)
    - **Property 13: Cache path construction**
    - Generate random names, versions, harness names; assert `distPath()` matches `<root>/artifacts/<name>/<version>/dist/<harness>/`
    - **Validates: Requirements 1.6**

- [x] 3. Implement VersionResolver with semver matching
  - [x] 3.1 Create `src/guild/version-resolver.ts` with `resolveVersion()` function
    - Support exact versions (`"1.2.3"`) and semver ranges (`"^1.0.0"`, `"~1.2.0"`)
    - Return `ResolutionResult` with `resolvedVersion` (highest satisfying) or `null`
    - Include `availableVersions` in result for error reporting
    - _Requirements: 5.2, 9.1_

  - [x] 3.2 Write property test: Version resolution picks highest satisfying version (Property 5)
    - **Property 5: Version resolution picks highest satisfying version**
    - Generate lists of 1–20 semver strings and random semver range pins; assert result is the highest satisfying version or null
    - **Validates: Requirements 5.2**

  - [x] 3.3 Write property test: Unsatisfied version pin error content (Property 19)
    - **Property 19: Unsatisfied version pin error content**
    - Generate artifact names, pins, and version lists with no match; assert error message contains artifact name, requested pin, and at least one available version (if any)
    - **Validates: Requirements 9.1**

- [x] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement CollectionExpander
  - [x] 5.1 Create `src/guild/collection-expander.ts` with `expandCollection()` function
    - Read collection member list from `GlobalCache.readCollectionCatalog()`
    - Produce `ExpandedArtifact[]` inheriting the collection ref's mode, harnesses, and backend
    - Set `source` field to the originating collection name on each expanded artifact
    - _Requirements: 5.3, 11.1, 11.2_

  - [x] 5.2 Write property test: Collection expansion with setting inheritance (Property 8)
    - **Property 8: Collection expansion with setting inheritance**
    - Generate collections with 1–15 members, random mode/harness/backend; assert expansion produces exactly N refs each inheriting parent settings
    - **Validates: Requirements 5.3, 11.1, 11.2**

- [x] 6. Implement path normalization utility
  - [x] 6.1 Create a path normalization helper (in `src/guild/sync.ts` or a shared util) that converts all backslash separators to forward slashes for manifest and sync-lock output
    - _Requirements: 8.3_

  - [x] 6.2 Write property test: Path normalization to forward slashes (Property 17)
    - **Property 17: Path normalization to forward slashes**
    - Generate paths with mixed separators; assert normalized output contains only forward slashes
    - **Validates: Requirements 8.3**

- [x] 7. Implement AutoUpdater with throttle logic
  - [x] 7.1 Create `src/guild/auto-updater.ts` with `autoUpdate()` function
    - Read throttle state from `GlobalCache.readThrottleState()`
    - Skip remote check if elapsed time < configured throttle interval (default 60 min)
    - Call `listVersions()` on resolved backend for each entry; download newer versions via `fetchArtifact()` to cache
    - Silently fall back to cache on network failure (no user-visible error)
    - Write updated throttle state after check completes
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 10.2_

  - [x] 7.2 Write property test: Throttle skips remote check within interval (Property 15)
    - **Property 15: Throttle skips remote check within interval**
    - Generate pairs of timestamps where elapsed < throttle interval; assert auto-updater skips remote check
    - **Validates: Requirements 6.4**

- [x] 8. Implement SyncEngine orchestration
  - [x] 8.1 Create `src/guild/sync.ts` with `sync()` function implementing the full pipeline
    - Parse manifest via `ManifestParser`
    - If `autoUpdate`, run `AutoUpdater` (throttle-gated)
    - Expand collection refs via `CollectionExpander`
    - Merge expanded entries with individual entries (individual takes precedence per Req 11.3)
    - Resolve backend for each entry using precedence chain: entry-level → manifest-level → config-level
    - Resolve versions via `VersionResolver` against `GlobalCache`
    - Fatal error for unresolved required entries; warning for optional entries
    - Materialize resolved artifacts into harness targets via file copy (no symlinks)
    - Each artifact gets its own subdirectory within harness target to prevent collisions
    - Support `--dry-run` (display plan without writing) and `--harness` (filter to single harness)
    - Write `.forge/sync-lock.json` with resolved versions and collection `source` fields
    - Update `.forge/.gitignore` with generated paths
    - Normalize all paths in sync-lock to forward slashes
    - _Requirements: 2.4, 2.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10, 5.11, 8.2, 8.3, 9.1, 9.3, 10.1, 11.3, 11.4, 11.5, 12.1_

  - [x] 8.2 Write property test: Mode-dependent sync behavior (Property 6)
    - **Property 6: Mode-dependent sync behavior for missing artifacts**
    - Generate entries with random mode and empty mock cache; assert required → fatal error, optional → warning + continue
    - **Validates: Requirements 2.4, 2.5, 5.8, 5.9**

  - [x] 8.3 Write property test: Backend resolution precedence chain (Property 7)
    - **Property 7: Backend resolution precedence chain**
    - Generate 3-tuples of optional backend strings (entry, manifest, config); assert resolved backend is first non-undefined in order
    - **Validates: Requirements 2.9, 12.1**

  - [x] 8.4 Write property test: Individual entry takes precedence over collection-inherited (Property 9)
    - **Property 9: Individual entry takes precedence over collection-inherited**
    - Generate manifests with overlapping individual + collection entries; assert individual settings win
    - **Validates: Requirements 11.3**

  - [x] 8.5 Write property test: Sync-lock records collection source (Property 10)
    - **Property 10: Sync-lock records collection source**
    - Generate collection-expanded sync results; assert each sync-lock entry from a collection has `source` field
    - **Validates: Requirements 11.4**

  - [x] 8.6 Write property test: Artifact isolation in harness targets (Property 14)
    - **Property 14: Artifact isolation in harness targets**
    - Generate pairs of distinct artifact names targeting same harness; assert materialized paths do not overlap
    - **Validates: Requirements 5.10**

- [x] 9. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement ShellSnippetGenerator for hook integration
  - [x] 10.1 Create `src/guild/hook-generator.ts` with `generateHookSnippet()` and `detectShell()`
    - Generate shell snippets for bash, zsh, fish, and PowerShell
    - Each snippet: detect `.forge/manifest.yaml` on directory change, invoke `forge guild sync --auto-update` in background, redirect all output to `/dev/null` (or `$null` on PowerShell)
    - `detectShell()` reads `SHELL` env var; returns `null` if unset
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ] 10.2 Write property test: Shell snippet contains required elements (Property 16)
    - **Property 16: Shell snippet contains required elements**
    - For each supported shell type, assert snippet contains manifest check, sync invocation, and output redirection
    - **Validates: Requirements 7.2, 7.3**

- [x] 11. Implement GuildCLI command registration and guild init
  - [x] 11.1 Create `src/guild/cli.ts` with `registerGuildCommands(program)` function
    - Register `forge guild init <name>` with `--collection`, `--mode`, `--version` options
    - Register `forge guild sync` with `--auto-update`, `--throttle`, `--dry-run`, `--harness` options
    - Register `forge guild status` to display manifest entries, resolved versions, and sync state
    - Register `forge guild hook install` with `--shell` option
    - Implement `guild init` logic: add/update manifest entry, create `.forge/manifest.yaml` if needed, add `.forge/` to `.gitignore`, query cache for latest version if no `--version`, run sync for new entry
    - Implement `guild status` logic: read manifest + sync-lock + cache, display table with version pin, resolved version, and up-to-date status; group collection members under collection name
    - Error if artifact not in cache and no `--version` specified (prompt user to `forge install --global`)
    - Error if `SHELL` not set and no `--shell` for hook install (non-Windows)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 7.1, 7.4, 7.5, 7.6, 9.2, 11.6_

  - [ ] 11.2 Write property test: Init updates existing entry without duplication (Property 18)
    - **Property 18: Init updates existing entry without duplication**
    - Generate manifests with existing entries; run init with new settings; assert exactly one entry for the artifact with updated settings
    - **Validates: Requirements 4.10**

- [x] 12. Extend `forge install` with `--global` flag support
  - [x] 12.1 Modify `src/install.ts` to add `--global` flag handling
    - When `--global` is provided, route to `GlobalCache.store()` instead of local harness install paths
    - Support `--from-release <tag>` with `--global` to fetch specific version from backend
    - Default to latest version when no version specifier with `--global`
    - Skip installation if same version already cached; inform user
    - Install new versions alongside existing ones (no removal)
    - Record backend name in cache metadata for subsequent auto-update checks
    - Display error with backend name and connection failure reason if backend unreachable
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 12.4_

  - [x] 12.2 Wire `--global` flag into `src/cli.ts` install command options
    - Add `.option("--global", "Install artifact into the global cache")` to the install command definition
    - _Requirements: 1.1_

- [x] 13. Wire guild commands into main CLI
  - [x] 13.1 Modify `src/cli.ts` to import and call `registerGuildCommands(program)`
    - Import `registerGuildCommands` from `./guild/cli`
    - Call `registerGuildCommands(program)` alongside existing command registrations
    - _Requirements: 4.1, 5.1, 7.1, 9.2_

- [x] 14. Implement backend resolution for manifest entries
  - [x] 14.1 Add backend resolution logic that checks entry-level → manifest-level → config-level backend
    - Reuse existing `loadForgeConfig()` and `resolveBackendConfigs()` from `src/config.ts`
    - Error if manifest entry references an undefined backend name (list available backends)
    - Wire into SyncEngine and AutoUpdater
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 15. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Write unit tests for CLI commands and edge cases
  - [x] 16.1 Write unit tests for `guild init` flag parsing and manifest creation
    - Test `--collection`, `--mode`, `--version` flag combinations
    - Test `.gitignore` management
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.9_

  - [x] 16.2 Write unit tests for `guild sync` dry-run and harness filtering
    - Test `--dry-run` produces no file writes
    - Test `--harness` filters materialization to single harness
    - _Requirements: 5.6, 5.7_

  - [x] 16.3 Write unit tests for `guild status` output formatting
    - Test table output with resolved/missing versions
    - Test collection member grouping display
    - _Requirements: 9.2, 11.6_

  - [x] 16.4 Write unit tests for shell snippet generation per shell type
    - Test bash, zsh, fish, PowerShell snippet content
    - Test shell detection from `SHELL` env var
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 16.5 Write unit tests for `forge install --global` flag handling
    - Test routing to GlobalCache, skip-if-cached, version coexistence
    - Test error display on backend unreachable
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7_

- [x] 17. Write integration tests for end-to-end flows
  - [x] 17.1 Write integration test: full install → init → sync pipeline with mock backends
    - Test `forge install --global` → `forge guild init` → `forge guild sync` end-to-end
    - _Requirements: 1.1, 4.1, 4.11, 5.1, 5.4_

  - [x] 17.2 Write integration test: collection expansion end-to-end with mock catalog
    - Test collection ref expansion through full sync pipeline
    - _Requirements: 5.3, 11.1, 11.2, 11.3, 11.4_

  - [x] 17.3 Write integration test: auto-update with mock backend returning newer versions
    - Test throttle behavior and version download
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 17.4 Write integration test: offline sync (cache-only, no network)
    - Test sync resolves from cache without network requests when `--auto-update` is not set
    - _Requirements: 10.1, 10.2_

  - [x] 17.5 Write integration test: stale sync-lock re-resolution
    - Test that a sync-lock referencing a deleted cache version triggers re-resolution
    - _Requirements: 9.3_

- [x] 18. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each major phase
- Property tests validate the 19 correctness properties defined in the design document
- Unit and integration tests cover CLI behavior, edge cases, and end-to-end flows
- The project uses Bun as runtime, `fast-check` for property-based tests, and `zod` for schema validation
