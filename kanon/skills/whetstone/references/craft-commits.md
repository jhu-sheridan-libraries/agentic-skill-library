# Craft Commits

The full commit-to-merge delivery lifecycle. From writing a commit message through pushing, opening a PR, and merging — this is the "last mile" of shipping code via git and GitHub.

## When to Use

- Committing code to any git repository
- The user asks for help writing a commit message
- Creating or managing a pull request
- Deciding on a merge strategy
- Pushing changes or creating branches
- Tagging a release commit

## Commit Messages

Write commit messages that tell the story of *why*, not just *what*. Every commit message is a letter to the next engineer — often yourself six months later.

### Format

Follow Conventional Commits, with this structure:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type** — one of: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`, `build`, `style`, `revert`
**Scope** — the affected module, component, or domain (optional but recommended)
**Subject** — imperative mood, ≤72 chars, no trailing period
**Body** — *why* this change, not *what* (the diff already shows what)
**Footer** — breaking changes, issue refs (`Closes #123`, `BREAKING CHANGE: ...`)

### The Rule of Thumb

If your subject line could apply to any commit in any codebase ("fix bug", "update code", "improvements"), rewrite it. A good subject makes sense without the diff.

### Examples

```
feat(auth): add PKCE flow for public OAuth clients

The previous implicit flow leaks access tokens in browser history.
PKCE (RFC 7636) resolves this without requiring a client secret.

Closes #418
```

```
refactor(catalog): extract scanSourceDir for multi-root support

The previous implementation hardcoded 'knowledge/' as the only
source root, preventing packages/ from being scanned. Now each
source root is processed through the same layout-detection logic.
```

```
fix(wizard): default maturity field to experimental

New artifacts omitted maturity from their frontmatter, causing
catalog validation warnings on first kanon build. The wizard now
sets maturity: experimental by default.
```

### Anti-Patterns

- **WIP commits**: If it's not ready, keep it on a branch. Don't pollute the main history.
- **Catch-all commits**: "misc fixes", "updates", "improvements" — be specific. If there are many changes, write many commits.
- **Past tense**: "added X", "fixed Y" — use imperative mood: "add X", "fix Y".
- **Diff summaries**: "changed foo to bar" — the diff already shows what changed. Explain *why*.
- **Compound commits**: If you need "and" in your subject line, split the commit. Each commit should be one logical change.

### Body Guidelines

The body should explain *why* the change was made:

- What problem does this solve?
- Why this approach over alternatives?
- What context would a future reader need?

---

## Branching

### Branch Naming

Use this pattern: `<type>/<short-description>`

```
feat/pkce-auth-flow
fix/wizard-maturity-default
refactor/multi-root-scan
docs/contributing-guide
chore/upgrade-bun-1.2
```

**Rules:**
- Kebab-case for the description segment
- Type prefix matches the commit type you expect to produce
- Keep it short — branch names appear in merge commits and PR URLs
- Include the issue number when working from a tracked issue: `fix/418-token-leak`

### When to Branch

- **Always branch for features and fixes.** Never commit directly to `main`/`master`.
- **Branch from the latest `main`** unless you're stacking on another unmerged branch (and know the rebase implications).
- **One branch per logical change.** Don't accumulate unrelated work on a single branch.
- **Delete branches after merge.** Stale branches are noise. Use `gh pr merge --delete-branch` or configure auto-delete in repo settings.

### Trunk-Based Development (Default)

Short-lived feature branches (hours to days, not weeks). Merge frequently. Keep branches small. If a branch lives longer than a few days, it's drifting — rebase or split it.

Long-lived feature branches are a code smell. If the feature is too large to merge in days, break it into vertical slices (see `compose-issues`) and merge each slice independently behind a feature flag if needed.

---

## Pushing

### Push Conventions

```bash
# First push — set upstream tracking
git push -u origin feat/pkce-auth-flow

# Subsequent pushes
git push
```

**Rules:**
- Always use `-u` on first push to set up tracking.
- Push early and often on feature branches. Pushing is not publishing — it's backing up your work and making it visible for review.
- Never push directly to `main`/`master`. Always go through a PR.

### Force-Push Safety

```bash
# Safe: rewrite history on YOUR branch before review
git push --force-with-lease

# Dangerous: never do this on shared branches
git push --force  # destroys others' work without checking
```

**When force-push is acceptable:**
- Rebasing your own feature branch before or during review (use `--force-with-lease`)
- Squashing fixup commits on your own branch before merge
- Amending your own unpushed or review-only commits

**When force-push is never acceptable:**
- On `main`, `master`, `develop`, or any shared/protected branch
- After someone else has based work on your branch
- Without `--force-with-lease` (always use the lease check)

---

## Pull Requests

### Creating a PR

Use `gh pr create` for consistency and to link issues automatically:

```bash
# Interactive — prompts for title, body, reviewers
gh pr create

# Non-interactive with all details
gh pr create \
  --title "feat(auth): add PKCE flow for public OAuth clients" \
  --body-file pr-description.md \
  --assignee @me \
  --label "enhancement"
```

### PR Title

The PR title should match or closely mirror the final commit message subject (especially for squash merges, where the PR title becomes the merge commit subject):

```
feat(auth): add PKCE flow for public OAuth clients
```

Same rules as commit subjects: imperative mood, ≤72 chars, type prefix, no trailing period.

### PR Description Template

```markdown
## Summary

One paragraph explaining what this PR does and why.

## Changes

- Bullet list of notable changes (not a line-by-line diff recap)
- Focus on behavioral changes, not file-level edits

## Testing

How was this tested? What commands to run?

## Linked Issues

Closes #418
```

**Rules:**
- Always link the issue(s) this PR addresses using `Closes #N` or `Resolves #N` in the body. This auto-closes the issue on merge.
- If the PR partially addresses an issue, use `Relates to #N` instead (does not auto-close).
- Keep the summary focused on *why* — reviewers can read the diff to see *what*.

### PR Lifecycle

1. **Draft PRs** — open early as draft (`gh pr create --draft`) to signal work-in-progress and get early feedback without requesting formal review.
2. **Ready for review** — mark ready when CI passes and you've self-reviewed: `gh pr ready`.
3. **Address feedback** — push fixup commits during review. Don't force-push away reviewer comments unless asked.
4. **Merge** — once approved and CI green, merge using the project's chosen strategy (see below).

### Stacked PRs

When work depends on another unmerged PR:

1. Branch from the first PR's branch, not from `main`.
2. Note the dependency in the PR description: "Depends on #N — merge that first."
3. After the base PR merges, rebase the stacked PR onto `main`: `git rebase main && git push --force-with-lease`.

---

## Merge Strategy

Choose the merge strategy based on what history you want to tell:

| Strategy | When to use | Result |
|----------|-------------|--------|
| **Squash merge** | Single logical change, messy branch history | One clean commit on main |
| **Merge commit** | Multiple meaningful commits worth preserving | Merge bubble with full branch history |
| **Rebase merge** | Linear history preferred, each commit is clean | Commits replayed on tip of main |

### Decision Guide

- **Default to squash merge** for feature branches with fixup/WIP commits. The PR title becomes the commit message. This keeps `main` history clean and bisectable.
- **Use merge commit** when the branch contains multiple distinct, well-crafted commits that each tell a meaningful part of the story (e.g., a migration with 5 deliberate steps).
- **Use rebase merge** when you've already cleaned up your branch history and want linear history without merge bubbles.

### Executing the Merge

```bash
# Squash merge (default recommendation)
gh pr merge --squash --delete-branch

# Merge commit (preserves branch history)
gh pr merge --merge --delete-branch

# Rebase (linear history)
gh pr merge --rebase --delete-branch
```

Always pass `--delete-branch` to clean up after merge.

---

## Tagging

### When to Tag

- After a release is ready to ship (not before — tags are immutable declarations)
- When you need a stable reference point (e.g., deploy targets)
- Follow SemVer for version tags

### Tag Format

```bash
# Annotated tag (preferred for releases — includes metadata)
git tag -a v1.2.0 -m "Release v1.2.0: PKCE auth support"
git push origin v1.2.0

# Lightweight tag (for ephemeral markers)
git tag deploy-2024-03-15
git push origin deploy-2024-03-15
```

**Rules:**
- Use annotated tags (`-a`) for releases. They carry the tagger identity, date, and message.
- Use lightweight tags only for ephemeral/internal markers (deploy stamps, CI references).
- Version tags follow `v<major>.<minor>.<patch>` — the `v` prefix is conventional.
- Never move or delete a published tag. If you tagged the wrong commit, create a new patch version.
- Push tags explicitly — `git push` does not push tags by default.

### Relationship to Releases

Tags mark the commit; releases are the GitHub artifact built on top of a tag. For full release management (changelogs, release notes, assets), see the `release-manager` companion power. Tags here cover the git-level operation only.

---

## Issue Linking Across the Lifecycle

Keep issues connected to the code that resolves them:

| Stage | How to link |
|-------|-------------|
| Branch name | Include issue number: `fix/418-token-leak` |
| Commit footer | `Closes #418` or `Refs: #418` |
| PR description | `Closes #418` (auto-closes on merge) |
| PR title | Optional: `fix(auth): resolve token leak (#418)` |

Using `Closes` in the PR body is the most reliable — GitHub auto-closes the issue only when the PR merges to the default branch. Commit footers also work but only when those commits land on the default branch directly (not via squash merge, which rewrites the message).

---

## Git Hygiene

### Interactive Rebase Before PR

Clean up your branch history before requesting review:

```bash
# Squash fixups, reword messages, reorder commits
git rebase -i main
```

Use this to:
- Squash "fixup" and "oops" commits into their parent
- Reword vague commit messages
- Drop commits that were superseded
- Reorder commits into a logical narrative

Do this *before* pushing for review, not after reviewers have commented on specific commits.

### Keeping a Branch Up to Date

```bash
# Preferred: rebase onto latest main (linear history)
git fetch origin
git rebase origin/main

# Alternative: merge main into your branch (creates merge commits)
git merge origin/main
```

Prefer rebase for feature branches to avoid polluting the branch with merge commits. Use merge only if you've already shared the branch and others have based work on it (rebase would rewrite their history).

### Commit Atomicity

Each commit should:
- Compile and pass tests (the build is never broken mid-history)
- Represent one logical change (not "fix + refactor + add feature")
- Be revertable in isolation without breaking unrelated functionality

If `git bisect` would finger your commit for an unrelated regression, the commit isn't atomic enough.

---

## Coordination With Other Workflows

craft-commits is the delivery endpoint for most codeshop chains:

- **After `review-changes`**: Commit the approved changes using the format above, then push and open a PR.
- **After `drive-tests`**: Each red-green-refactor cycle may be one commit or squashed at the end — use judgment based on whether individual cycles are meaningful history.
- **After `compose-issues`**: Each issue becomes a branch → commits → PR → merge cycle.
- **Before `release-manager`**: Tags created here are what the release-manager power builds releases from.

The natural flow: `drive-tests` → `review-changes` → `craft-commits` (commit + branch + PR + merge).
