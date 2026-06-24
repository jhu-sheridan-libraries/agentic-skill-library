# Bundled Kiro Powers

This directory contains Kiro Powers that ship with the repository. Anyone who opens this workspace in Kiro can install them as local powers.

## Installing

1. Open the Kiro Powers panel (command palette → "Powers")
2. Click **Add Custom Power**
3. Select **Local Directory**
4. Point to the absolute path of the power directory (e.g., `/path/to/agentic-skill-forge/powers/skill-forge`)

## Available Powers

### adr

Create, maintain, and cross-reference Architecture Decision Records (ADRs) in MADR format. Reads git context, detects duplicate decisions, manages supersession chains, and keeps the ADR index up to date. Works in any git repository — the ADR directory and changelog tool are auto-discovered.

**Includes:**
- MADR templates (full and short-form) with create / update / review / cross-reference workflows
- Auto-draft ADRs from `git diff`
- Health check for drift, staleness, broken references, and orphaned drafts
- Team review checklist and Proposed→Accepted promotion
- Bidirectional linking with Kiro specs
- Changelog tool integration (towncrier, changesets, conventional-changelog, release-please, git-cliff, or plain CHANGELOG.md)
- Installable native Kiro hooks that auto-enforce ADR creation on session end and before spec tasks

**Steering files:**
- `workflow` — Core ADR operations and MADR templates
- `generate-from-diff` — Draft an ADR from a git diff
- `health-check` — Audit ADRs for drift and broken references
- `team-review` — Review checklist and promotion workflow
- `specs-integration` — Link ADRs with Kiro specs
- `changelog` — Record ADRs in the project's changelog tool
- `hooks` — Installable native Kiro enforcement hooks

### skill-forge

Onboarding and assistant guide for using the Skill Forge CLI. Designed for Johns Hopkins Libraries staff who may or may not be familiar with software development.

**Includes:**
- Onboarding walkthrough (install Bun, clone, first build)
- 16-lesson sequential tutorial covering every CLI capability
- Artifact authoring guide with JHU-specific conventions
- Complete command reference

**Steering files:**
- `tutorial` — Full sequential walkthrough, skip-ahead by lesson
- `authoring` — Step-by-step artifact creation guide
- `commands` — Every CLI command with flags and examples
