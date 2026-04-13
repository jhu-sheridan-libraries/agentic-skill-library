# ADR-0023: Manifest-Driven Artifact Distribution with Global Cache

**Date:** 2026-04-13
**Status:** Proposed
**Deciders:** skill-forge maintainers
**Supersedes:** N/A

## Context and Problem Statement

Teams using Skill Forge need to share compiled artifacts across multiple repositories. The existing workflow requires each repo to run `forge build` locally or commit compiled `dist/` output to version control. This creates duplication, version drift between repos, and forces every developer to have the full knowledge source to rebuild artifacts. The question is how to decouple artifact production from consumption so that repos declare what they need and resolve it from a shared source.

## Decision Drivers

- Multiple repos must consume the same artifact versions without vendoring compiled output
- Developers should not need the knowledge source to use artifacts — only the compiled output
- Version pinning must be explicit and reproducible across team members
- Collections (curated bundles) must be referenceable as a single manifest entry
- The system must work offline when artifacts are already cached
- The existing `ArtifactBackend` interface (ADR-0017) must be reused, not replaced
- Background updates should keep teams current without manual intervention

## Considered Options

1. **Git submodules** — each repo includes a submodule pointing to a shared artifacts repo
2. **npm/registry-based distribution** — publish artifacts as npm packages, install via package manager
3. **Manifest-driven resolution with global cache** — repos declare dependencies in `.forge/manifest.yaml`, a sync engine resolves from `~/.forge/artifacts/`
4. **Do nothing** — continue vendoring `dist/` output into each repo

## Decision Outcome

**Chosen option: Option 3 — manifest-driven resolution with global cache**, because it provides explicit version control, offline operation, and reuses the existing backend infrastructure without introducing external package manager dependencies.

The architecture introduces:
- **Global cache** (`~/.forge/artifacts/`) — stores artifacts by name and version, shared across all repos on a machine
- **Manifest** (`.forge/manifest.yaml`) — YAML file committed to each repo declaring artifact dependencies with semver version pins
- **Sync engine** (`forge guild sync`) — reads the manifest, resolves versions against the cache, and materializes artifacts into harness-specific locations
- **Auto-updater** — throttle-gated background checks against backends for newer versions satisfying the manifest's version pins
- **Collection expansion** — collection refs in the manifest are expanded into individual artifact refs at resolve time, keeping the manifest compact while the sync-lock records the full expansion

The `forge guild` command group (`init`, `sync`, `status`, `hook install`) provides the CLI surface. `forge install --global` populates the cache from backends.

### Positive Consequences

- Repos declare dependencies explicitly — no implicit coupling to build output
- Version pins with semver ranges give teams control over update cadence
- Offline sync works from cache without network access
- Collection refs reduce manifest boilerplate for curated bundles
- The sync-lock file makes resolution reproducible across machines
- Reuses `ArtifactBackend` interface — all existing backends (GitHub, S3, HTTP, local) work without modification

### Negative Consequences

- New concept (global cache) that developers must understand
- `.forge/manifest.yaml` is a new file format to learn and maintain
- Cache can grow unbounded — no automatic garbage collection of old versions
- Throttle-based auto-update adds complexity; misconfigured intervals could cause stale artifacts or excessive backend traffic

## Options Analysis

### Option 1: Git submodules
**Pros:** Native git tooling; no new concepts
**Cons:** Submodule UX is notoriously painful; version pinning is commit-hash-based, not semver; no collection support

### Option 2: npm/registry-based
**Pros:** Mature ecosystem; dependency resolution is solved
**Cons:** Requires npm registry infrastructure; artifacts aren't npm packages; harness-specific output doesn't map to npm's flat file model

### Option 3: Manifest-driven with global cache (chosen)
**Pros:** Purpose-built for the harness model; semver resolution; offline-capable; reuses existing backends
**Cons:** Custom tooling to maintain; new manifest format

### Option 4: Do nothing
**Pros:** Zero implementation cost
**Cons:** Version drift; duplicated artifacts; every consumer needs build toolchain

## Links and References

- Relates to: [ADR-0017](./0017-pluggable-backend-abstraction-for-artifact-publishing.md) (backends reused for cache population and auto-update)
- Relates to: [ADR-0016](./0016-collection-membership-in-artifact-frontmatter.md) (collections are now referenceable in manifests)
- Spec: .kiro/specs/team-mode-distribution/design.md
- Spec: .kiro/specs/team-mode-distribution/requirements.md
- Implementation: `skill-forge/src/guild/` — manifest parser, sync engine, global cache, auto-updater, collection expander, version resolver
- Implementation: `skill-forge/src/guild/cli.ts` — `forge guild` command group
- Branch: develop
