<!-- forge:version 0.3.0 -->
# Changelog Integration

Maintain CHANGELOG.md alongside ADRs. Changelog entries are links to ADRs, not restatements.

## Detection Order
Stop at first match:
1. towncrier — `[tool.towncrier]` in `pyproject.toml`, `towncrier.toml`, `changes/`, `changelog.d/`
2. conventional-changelog — `.versionrc`, `.versionrc.json`, `"standard-version"` in `package.json`
3. release-please — `release-please-config.json`, `.release-please-manifest.json`
4. changesets — `.changeset/`
5. git-cliff — `cliff.toml`

Fragment tool found → use its format, stop. Do not edit CHANGELOG.md directly.

No tool → look for `CHANGELOG.md`, `CHANGES.md`, `HISTORY.md`, `NEWS.md` at root or `docs/`.

Nothing found → offer to create `CHANGELOG.md`. Confirm first.

## Bootstrap Template
```markdown
# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/)

## [Unreleased]

### Architecture Decisions
```
Only include section headers that have entries.

## ADR Entry Format
One line per ADR. Link only, no summary:
```markdown
- [ADR-{NNN}](docs/adr/ADR-{NNN}-{slug}.md): {Title}
```

Supersession:
```markdown
- ~~[ADR-003](docs/adr/ADR-003-slug.md): Old Title~~ — superseded by ADR-015
- [ADR-015](docs/adr/ADR-015-slug.md): New Title
```

Status promotions (Draft→Proposed→Accepted): no new entry.

## Versioning
All entries go under `[Unreleased]`. Release process moves them to version sections. ADR power does not manage releases.

## Bulk Generation
For existing ADRs, one line each. Show draft, confirm before writing.

## Paths
Relative from CHANGELOG.md to ADR file. Verify resolution.