---
name: release-manager
displayName: Release Manager
description: Tool-agnostic release lifecycle management — assess changes, draft changelogs and release notes, cut tagged releases, and announce. Detects whatever release tooling the project uses.
keywords: ["release","changelog","semver","versioning","release-notes","git-tag"]
author: Steven J. Miklovic
---
<!-- forge:version 0.1.2 -->

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
7. **Keep CITATION.cff in sync** — if a `CITATION.cff` file exists at the project root (or in the package directory), update its `version` and `date-released` fields as part of the release commit. The version must match the new tag (without the `v` prefix) and the date must be the release date in `YYYY-MM-DD` format.

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

## Cut Release Announce

# Announce

## Entry Criteria
- The release is tagged and published (or tag is pushed for manual release creation)
- GitHub release exists (or user has been instructed to create it)

## Steps
1. **Update README badges** if the README displays a version badge:
   - Check for version shields/badges in `README.md`
   - Update if they reference a hardcoded version (dynamic badges need no update)
2. **Close milestone** if the project uses GitHub milestones:
   ```bash
   gh api repos/{owner}/{repo}/milestones --jq '.[] | select(.title == "vX.Y.Z")'
   ```
   If a matching milestone exists, close it. If not, skip silently.
3. **Suggest downstream notifications:**
   - Dependabot: consumers will pick up the new version automatically
   - If the project has known consumers or a mailing list, remind the user to notify them
   - If the project publishes to a registry (npm, PyPI, crates.io), remind the user to publish the package
4. **Summarize what was released:**
   - Version number and tag
   - Number of commits included
   - Key highlights (top 3 changes)
   - Link to the GitHub release (if created)
   - Any follow-up actions the user should take

## Exit Criteria
- README badges updated (if applicable)
- Milestone closed (if applicable)
- Downstream notification suggestions provided
- Release summary presented to the user

## Cut Release Assess

# Assess

## Entry Criteria
- The user wants to cut a release or review unreleased changes
- A git repository is available

## Steps
1. **Detect release tooling** per POWER.md detection order. Report which tool was found (or none).
2. **Find the last release tag:**
   ```bash
   git describe --tags --abbrev=0 2>/dev/null
   ```
   No tags → use initial commit as baseline. Report "first release."
3. **List commits since last tag:**
   ```bash
   git log --oneline <last-tag>..HEAD
   ```
4. **Classify changes by semver impact** using the Semver Decision Tree in POWER.md:
   - Scan for `BREAKING CHANGE:` footers or `!` suffix → major
   - Scan for `feat:` prefixes → minor
   - Everything else → patch
   - For pre-1.0 projects, note the adjusted rules
5. **Identify unreleased changelog entries** if the project uses a fragment-based tool (towncrier, changesets):
   ```bash
   ls .changeset/*.md 2>/dev/null || ls changes/ 2>/dev/null
   ```
6. **Recommend version bump** — state the current version, the recommended next version, and why (list the highest-impact commits driving the recommendation).
7. Present the change summary to the user. Ask if the recommended bump is correct or if they want to override.

## Exit Criteria
- Release tooling identified (or confirmed absent)
- All commits since last tag listed and classified
- Semver recommendation presented with rationale
- User has confirmed or overridden the version bump

## Next Phase
→ Load `cut-release-draft.md`

## Cut Release Cut

# Cut

## Entry Criteria
- Release notes and changelog entries are approved by the user
- Working tree is clean (`git status` shows no uncommitted changes)

## Steps
1. **Check for clean working tree:**
   ```bash
   git status --porcelain
   ```
   If dirty, warn the user and ask whether to proceed or stash first.
2. **Bump version in package manifest** — detect the manifest type and update:
   - `package.json` → update `version` field
   - `pyproject.toml` → update `version` under `[project]` or `[tool.poetry]`
   - `Cargo.toml` → update `version` under `[package]`
   - `pom.xml` → update `<version>` element
   - Other → ask the user which file to update
3. **Update CITATION.cff** (if present) — update `version` (without `v` prefix) and `date-released` (today in `YYYY-MM-DD` format). Check both the project root and the package directory.
4. **Update changelog file** — prepend the new version's entries per POWER.md Changelog Format. If using a fragment tool, run its compile command instead (e.g. `bunx changeset version`, `towncrier build`).
5. **Commit the release:**
   ```bash
   git add -A
   git commit -m "chore(release): vX.Y.Z"
   ```
6. **Tag the release:**
   ```bash
   git tag vX.Y.Z
   ```
   Match the project's existing tag format per POWER.md Tag Format.
7. **Create GitHub release** (if `gh` CLI is available):
   ```bash
   gh release create vX.Y.Z --title "vX.Y.Z" --notes-file <release-notes-file>
   ```
   If `gh` is unavailable, instruct the user to push the tag and create the release manually.
8. **Push:**
   ```bash
   git push && git push --tags
   ```

## Exit Criteria
- Version is bumped in the package manifest
- CITATION.cff is updated (if present) with matching version and release date
- Changelog is updated
- Release commit exists with message `chore(release): vX.Y.Z`
- Tag `vX.Y.Z` exists locally and is pushed
- GitHub release is created (or user is instructed to create manually)

## Next Phase
→ Load `cut-release-announce.md`

## Cut Release Draft

# Draft

## Entry Criteria
- Change summary with classified commits exists from Assess phase
- Version bump is confirmed by the user

## Steps
1. **Generate changelog entries** grouped by type per POWER.md Changelog Format:
   - Breaking Changes, Features, Bug Fixes, Performance, Other
   - Rewrite terse commit messages into clear, human-readable descriptions
   - Include commit short hashes for traceability
2. **Draft release notes** per POWER.md Release Notes Structure:
   - One-sentence summary capturing the release theme
   - Highlights section with the most impactful changes
   - Breaking Changes section with what changed and why
   - Migration Steps for any breaking changes (numbered, actionable)
   - What's Changed grouped list
3. **List contributors** from commits:
   ```bash
   git shortlog -sne <last-tag>..HEAD
   ```
4. **Highlight breaking changes** prominently — if any exist, ensure migration steps are concrete and testable. If migration is non-trivial, add code examples.
5. If the project uses a fragment-based changelog tool (towncrier, changesets), generate entries in that tool's native format instead of editing the changelog file directly.
6. Present both the changelog entries and the release notes draft to the user for review. Ask for approval or edits.

## Exit Criteria
- Changelog entries are drafted in the correct format (native tool or markdown)
- Release notes are drafted with summary, highlights, breaking changes, migration, and contributors
- User has reviewed and approved (or requested edits to) both documents

## Next Phase
→ Load `cut-release-cut.md`

## Cut Release

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
