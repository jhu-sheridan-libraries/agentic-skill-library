<!-- forge:version 0.1.6 -->
# Orient

## Entry Criteria
- A pull request, merge request, or diff is available for review
- The codeshop power is active and the review-changes workflow has been loaded

## Steps

1. Read the PR description first — understand intent before reading code. If there is no description, ask for one before reviewing. A PR without a description forces the reviewer to reverse-engineer intent from the diff.

2. Skim the full diff to orient yourself:
   - How many files are changed?
   - What is the scope — is this a focused change or a broad refactor?
   - Which areas of the codebase are touched?
   - Are there any files that seem unrelated to the stated intent?

3. Note the PR's stated goal and any context:
   - What problem does this solve?
   - What approach was chosen?
   - Are there any caveats or known limitations mentioned?

4. If the PR is too large to review effectively (more than ~400 lines or ~30 minutes of review time), ask the author to split it into logical chunks. Review each chunk separately.

## Exit Criteria
- The PR description has been read and the intent is understood
- The full diff has been skimmed for scope and structure
- You have a mental model of what the PR is trying to accomplish
- Large PRs have been flagged for splitting if needed

## Next Phase
→ Load `review-changes-read.md`