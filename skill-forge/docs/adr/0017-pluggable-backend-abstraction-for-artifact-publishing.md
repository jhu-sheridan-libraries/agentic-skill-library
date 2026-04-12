# ADR-0017: Pluggable Backend Abstraction for Artifact Publishing and Installation

**Date:** 2026-04-12
**Status:** Proposed
**Deciders:** skill-forge maintainers
**Supersedes:** N/A

## Context and Problem Statement

`forge install --from-release <tag>` was declared in the CLI but never implemented —
the option accepted input and did nothing. This left a gap between building artifacts
locally and distributing them to other projects. The question of *where* artifacts
are hosted is not answered by a single obvious answer: public teams want GitHub
releases; private teams may need S3 buckets or internal HTTP servers to keep
their artifacts out of public repositories. A hardcoded single-source approach
would require forking or patching the tool for any non-GitHub workflow.

## Decision Drivers

- `forge install --from-release <tag>` must be functional, not a placeholder
- Private teams need a distribution channel for artifacts that must not be
  committed to public repositories
- The public repo and private artifact stores must coexist — `forge install`
  should be able to draw from both in the same session
- Adding a new backend type later (e.g. npm registry, OCI registry) should
  not require changes to the install or publish command surfaces
- Credentials must never be committed; the mechanism must support both
  ambient auth (IAM roles, `gh` auth) and explicit tokens

## Considered Options

1. **Hardcode GitHub releases only** — implement `--from-release` as a
   GitHub-specific download; no other backends
2. **Hardcode GitHub + S3** — two named code paths, no abstraction
3. **Pluggable `ArtifactBackend` interface** — a common interface with
   swappable implementations; selection driven by `forge.config.yaml`
4. **Do nothing** — leave `--from-release` as a placeholder and document
   a manual workflow

## Decision Outcome

**Chosen option: Option 3 — pluggable `ArtifactBackend` interface**, because
it solves the public/private coexistence problem without baking GitHub-only
assumptions into the install surface. The interface is small (3 methods:
`fetchCatalog`, `fetchArtifact`, `listVersions`) and each backend is
independently replaceable. The `forge.config.yaml` config file handles named
backend registration, keeping credential config out of version control via a
parallel `~/.forge/config.yaml` user-global file.

Initial backends:
- `LocalBackend` — reads from `dist/` (preserves all existing behavior)
- `GitHubBackend` — `gh` CLI for auth and asset download
- `S3Backend` — `aws` CLI for S3-compatible stores (R2, MinIO)
- `HttpBackend` — generic HTTPS with optional bearer token (`${ENV_VAR}` syntax)

The `--backend <name>` flag on `forge install` and `forge publish` selects a
named backend from config. `--from-release <tag>` maps to `GitHubBackend` for
backward compatibility.

### Positive Consequences

- Private teams publish to their own S3 bucket via `forge publish --backend internal`
  and install via `forge install my-artifact --backend internal` — no changes to
  the public repo's catalog or collections
- New backend types (OCI, npm, custom registry) can be added by implementing
  the 3-method interface without touching install or publish command logic
- Downloaded artifacts are cached in `~/.forge/cache/` — repeated installs
  of the same version from remote backends are instant
- `.forge-manifest.json` written alongside installed files records backend
  provenance, enabling `forge upgrade` in a future phase

### Negative Consequences / Trade-offs

- The `aws` and `gh` CLIs are external dependencies for S3 and GitHub backends;
  they must be installed and authenticated separately
- `forge.config.yaml` is a new file authors must learn; misconfigured backends
  produce runtime errors rather than schema errors
- The S3 and HTTP backends use `aws s3 sync` and `fetch()` respectively — no
  progress indicators for large downloads

## Options Analysis

### Option 1: Hardcode GitHub only
**Pros:** Simple; GitHub is the overwhelmingly common case
**Cons:** Private teams are permanently blocked; no extensibility

### Option 2: Hardcode GitHub + S3
**Pros:** Covers most real cases without abstraction overhead
**Cons:** Adding a third backend requires modifying install/publish logic;
still a second-class path for HTTP

### Option 3: Pluggable interface (chosen)
**Pros:** Unlimited extensibility; clean separation; testable backends
**Cons:** More upfront code; requires config file convention

### Option 4: Do nothing
**Pros:** Zero implementation cost
**Cons:** `--from-release` remains permanently broken; private use cases unserved

## Links and References

- Relates to: [ADR-0015](./0015-knowledge-bazaar-shared-manifest-phase-1.md)
  (publish pipeline produces the bazaar catalog)
- Relates to: [ADR-0016](./0016-collection-membership-in-artifact-frontmatter.md)
  (collection bundles are distributed via backends)
- Implementation: `skill-forge/src/backends/` — interface and four backends
- Implementation: `skill-forge/src/config.ts` — `ForgeConfigSchema`,
  `loadForgeConfig()`, `resolveBackendConfigs()`
- Implementation: `skill-forge/src/publish.ts` — full publish pipeline
- Implementation: `skill-forge/src/install.ts` — `--backend` flag wiring
- Branch: main
