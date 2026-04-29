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
