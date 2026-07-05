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
