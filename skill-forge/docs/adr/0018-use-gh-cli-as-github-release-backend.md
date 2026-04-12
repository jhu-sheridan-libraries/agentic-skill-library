# ADR-0018: Use `gh` CLI as the GitHub Release Backend

**Date:** 2026-04-12
**Status:** Proposed
**Deciders:** skill-forge maintainers
**Supersedes:** N/A

## Context and Problem Statement

The `GitHubBackend` needs to create releases and download release assets.
Two mechanisms exist: the GitHub REST API (direct HTTP calls with a personal
access token or OAuth app) and the `gh` CLI (an official GitHub tool that
manages its own auth flow). The choice affects how users authenticate and
how the backend is implemented.

## Decision

Use the `gh` CLI for all GitHub release operations (`gh release create`,
`gh release download`, `gh release list`). No direct GitHub API calls.

## Rationale for No Alternatives

Any team publishing to or installing from GitHub releases almost certainly
has `gh` installed and authenticated already — it is the standard tool for
GitHub automation in developer workflows. Implementing direct API calls would
require managing OAuth tokens or personal access tokens, storing them securely,
and handling token refresh; `gh` handles all of this transparently. The
`GITHUB_TOKEN` environment variable works in CI contexts without any additional
configuration.

## Consequences

- `gh` CLI must be installed and authenticated (`gh auth login`) on any
  machine that runs `forge publish` or `forge install --from-release`
- No direct dependency on GitHub's REST API shape — `gh` handles API
  versioning internally
- CI environments must have `gh` available (standard in GitHub Actions,
  requires explicit install elsewhere)
- Presigned download URLs for read-only install access are not currently
  supported — users fetching from GitHub releases need `gh` auth even for
  public repos (future: support unauthenticated `curl` download for public releases)

## Links and References

- Implements: [ADR-0017](./0017-pluggable-backend-abstraction-for-artifact-publishing.md)
- Implementation: `skill-forge/src/backends/github.ts`
- Branch: main
