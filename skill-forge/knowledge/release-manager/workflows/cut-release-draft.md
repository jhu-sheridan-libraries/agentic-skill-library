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
