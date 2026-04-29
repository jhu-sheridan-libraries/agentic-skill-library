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
3. **Update changelog file** — prepend the new version's entries per POWER.md Changelog Format. If using a fragment tool, run its compile command instead (e.g. `bunx changeset version`, `towncrier build`).
4. **Commit the release:**
   ```bash
   git add -A
   git commit -m "chore(release): vX.Y.Z"
   ```
5. **Tag the release:**
   ```bash
   git tag vX.Y.Z
   ```
   Match the project's existing tag format per POWER.md Tag Format.
6. **Create GitHub release** (if `gh` CLI is available):
   ```bash
   gh release create vX.Y.Z --title "vX.Y.Z" --notes-file <release-notes-file>
   ```
   If `gh` is unavailable, instruct the user to push the tag and create the release manually.
7. **Push:**
   ```bash
   git push && git push --tags
   ```

## Exit Criteria
- Version is bumped in the package manifest
- Changelog is updated
- Release commit exists with message `chore(release): vX.Y.Z`
- Tag `vX.Y.Z` exists locally and is pushed
- GitHub release is created (or user is instructed to create manually)

## Next Phase
→ Load `cut-release-announce.md`
