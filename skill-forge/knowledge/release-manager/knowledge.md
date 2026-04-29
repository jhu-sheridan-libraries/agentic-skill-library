---
name: release-manager
displayName: Release Manager
description: Tool-agnostic release lifecycle management — assess changes, draft changelogs and release notes, cut tagged releases, and announce. Detects whatever release tooling the project uses.
keywords:
  - release
  - changelog
  - semver
  - versioning
  - release-notes
  - git-tag
author: Steven J. Miklovic
version: 0.1.0
harnesses:
  - kiro
  - claude-code
  - copilot
  - cursor
  - windsurf
  - cline
  - qdeveloper
type: power
inclusion: auto
categories:
  - devops
  - documentation
ecosystem: []
depends: []
enhances: []
maturity: experimental
trust: official
audience: intermediate
model-assumptions: []
collections:
  - jhu
  - neon-caravan
inherit-hooks: false
harness-config:
  kiro:
    format: power
---
# Release Manager Power

## Overview

Release Manager automates the release lifecycle — assessing unreleased changes, drafting changelogs and release notes, cutting tagged releases, and announcing them. It detects whatever release tooling the project already uses (changesets, release-please, semantic-release, git-cliff, towncrier, or plain CHANGELOG.md) and works with it rather than imposing a new tool.

Use this power when you want to cut a release, prepare release notes, or review what has changed since the last tag.

## Steering Files

- **cut-release** — 4-phase workflow: Assess → Draft → Cut → Announce. Start here for any release task.

## Shared Definitions

All phases reference these. Defined once here.

### Release Tooling Detection Order

Search the project root in this order. Use the first match:

| Priority | Tool | Detection |
|----------|------|-----------|
| 1 | Changesets | `.changeset/` directory |
| 2 | release-please | `release-please-config.json` or `.release-please-manifest.json` |
| 3 | semantic-release | `.releaserc`, `.releaserc.json`, `.releaserc.yml`, or `release` key in `package.json` |
| 4 | git-cliff | `cliff.toml` or `git-cliff.toml` |
| 5 | towncrier | `pyproject.toml` with `[tool.towncrier]`, or `towncrier.toml`, or `changes/` directory with fragments |
| 6 | Plain changelog | `CHANGELOG.md`, `CHANGES.md`, `HISTORY.md`, or `NEWS.md` at project root |

None found → offer to bootstrap `CHANGELOG.md`. Confirm before creating.

When a tool is detected, use its native commands and formats. Do not bypass the tool.

### Semver Decision Tree

Classify commits since last tag using conventional commit prefixes:

| Signal | Bump | Examples |
|--------|------|----------|
| `BREAKING CHANGE:` footer or `!` after type | **major** | `feat!: remove v1 API`, `refactor!: rename public types` |
| `feat:` | **minor** | `feat: add pagination`, `feat(api): new endpoint` |
| `fix:`, `perf:`, `refactor:`, `docs:`, `chore:`, `ci:`, `test:`, `build:`, `style:` | **patch** | `fix: null check`, `perf: cache queries` |

The highest signal wins. If any commit is breaking → major. Else if any commit is a feature → minor. Otherwise → patch.

For pre-1.0 projects (`0.x.y`): breaking changes bump minor, features bump patch. Note this in the recommendation.

### Changelog Format

Group entries by type, most impactful first:

```markdown
## [X.Y.Z] — YYYY-MM-DD

### Breaking Changes
- Description (commit hash)

### Features
- Description (commit hash)

### Bug Fixes
- Description (commit hash)

### Performance
- Description (commit hash)

### Other
- Description (commit hash)
```

Entries are human-readable descriptions, not raw commit messages. Rewrite terse commits into clear sentences.

### Release Notes Structure

```markdown
# vX.Y.Z

One-sentence summary of the release theme.

## Highlights
- Key feature or change (brief explanation)

## Breaking Changes
- What changed, why, and how to migrate

## Migration Steps
1. Step-by-step instructions for breaking changes

## What's Changed
- Grouped list (features, fixes, other)

## Contributors
- @handle (via git shortlog)
```

Release notes are prose for humans, not a commit dump. Summarize, group, and explain.

### Git Context

Run before any drafting or analysis:
```bash
git log --oneline $(git describe --tags --abbrev=0 2>/dev/null || echo "$(git rev-list --max-parents=0 HEAD)")..HEAD
git describe --tags --abbrev=0 2>/dev/null || echo "no tags found"
git rev-parse --abbrev-ref HEAD
```

### Tag Format

Use `vX.Y.Z` (e.g. `v1.2.3`). Match the project's existing tag format if it differs. Check with:
```bash
git tag --sort=-v:refname | head -5
```

## Rules

1. **Git context before drafting** — always gather commits, tags, and branch before any analysis.
2. **Never skip the changelog** — every release must update the changelog file, even if using a release tool that generates notes separately.
3. **Tag format conventions** — match the project's existing tag format. Default to `vX.Y.Z`.
4. **Draft → confirm → publish** — never tag or publish without user approval of the release notes.
5. **Detect, don't impose** — use whatever release tooling the project already has. Do not install new tools without asking.
6. **Atomic release commits** — version bump, changelog update, and tag should be a single logical unit.

## Troubleshooting

**No tags found:**
If the project has no existing tags, recommend starting at `v0.1.0` (or `v1.0.0` if the project is clearly production-ready). All commits since the initial commit are included in the assessment.

**Release tool conflicts:**
If multiple release tools are detected (e.g. both changesets and release-please config), flag the conflict and ask the user which one to use. Do not guess.

**Uncommitted changes:**
If `git status` shows uncommitted changes, warn the user before proceeding. Release should be cut from a clean working tree.

**gh CLI not available:**
If `gh` is not installed or not authenticated, skip the GitHub release creation step. Present the release notes for the user to publish manually. Tag locally and let the user push.

**Pre-release versions:**
For alpha/beta/rc releases, use the format `vX.Y.Z-alpha.N`. Append the pre-release suffix to the tag and note it in the changelog header.

**Monorepo with multiple packages:**
Ask the user which package to release. Scope the commit analysis to that package's directory using `git log -- <path>`.
