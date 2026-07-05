# Cut Release

Assess unreleased changes, draft changelog and release notes, cut a tagged release, and announce it. Detects the project's existing release tooling and works with it.

## When to Use

- The user says "cut a release", "release notes", "prepare release", or "ship it"
- The user wants to review what changed since the last tag
- The user wants to bump the version and tag

## Prerequisites

- Git repository with commits since the last tag (or since initial commit if no tags)
- `gh` CLI installed and authenticated (for GitHub releases — optional, degrades gracefully)

## Shared Concepts

This workflow relies on the Shared Definitions in POWER.md: Release Tooling Detection Order, Semver Decision Tree, Changelog Format, Release Notes Structure, Git Context, and Tag Format.

## Phases

### Phase 1 — Assess
Detect release tooling, gather commits since last tag, classify changes by semver impact, and recommend a version bump.
→ Load `cut-release-assess.md`

### Phase 2 — Draft
Generate changelog entries and draft human-readable release notes. Present for user review.
→ Load `cut-release-draft.md`

### Phase 3 — Cut
Bump version in package manifest, update changelog, commit, tag, and create GitHub release.
→ Load `cut-release-cut.md`

### Phase 4 — Announce
Update badges, close milestones, suggest downstream notifications, and summarize.
→ Load `cut-release-announce.md`
