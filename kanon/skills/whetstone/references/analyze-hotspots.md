# Analyze Hotspots

Git change-frequency analysis to identify the most-changed files in a codebase. Pure git churn — no complexity metrics. Use as a pre-filter to scope analysis or a post-filter to prioritize existing findings.

Inspired by Adam Tornhill's "Your Code as a Crime Scene."

## When to Use

- Before `plan-refactor` — identify which files to refactor first
- Before `review-changes` — focus review effort on high-churn areas
- Before `triage-bug` — check if the problematic area is a known hotspot
- When a test suite feels slow — high-churn files often accumulate test debt
- When onboarding to an unfamiliar codebase — hotspots reveal where the action is

## How It Works

Run `git log --name-only` over a configurable time period, count commits per file, rank by frequency. Exclude deleted files. Optionally overlay churn data on an existing report to re-prioritize findings.

## Modes

### 1. Analyze (default)

Show the most-changed files in the repo.

**Steps:**
1. Run: `git log --since={since} --format=format: --name-only | sort | uniq -c | sort -rn`
2. Exclude deleted files (verify each file still exists with `test -f`)
3. For each file in the top N, get last changed date: `git log -1 --format="%ar" -- {file}`
4. Display ranked table:

```
 Rank │ Commits │ Last Changed │ File
──────┼─────────┼──────────────┼─────────────────────────
    1 │      87 │ 2 days ago   │ src/services/payment.ts
    2 │      64 │ 1 week ago   │ src/api/controllers/user.ts
    3 │      51 │ 3 days ago   │ src/models/order.ts
```

5. Show summary: total files changed in period, time period, top N shown

**Defaults:** top 15 files, last 6 months.

### 2. Rank (post-filter)

Overlay churn data on an existing analysis report to prioritize findings.

**Steps:**
1. Run the same git churn analysis
2. Read the specified report file
3. Extract file paths mentioned in the report
4. Annotate each file with its commit count
5. Re-sort findings by churn (highest first). Findings without extractable file paths go at the bottom.
6. Show noise reduction: "X of Y findings are in low-churn files (< 20 commits)"

### 3. Detail (deep-dive on a single file)

**Steps:**
1. Monthly commit breakdown over the period
2. Top contributors to the file
3. Co-change coupling: top 5 files that frequently change alongside this one (`git log --format=format: --name-only` filtered to commits touching the target file)
4. Last 10 commit messages for context

## Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| top | 15 | Number of files to show |
| since | 6 months | Time period (e.g., 3m, 12m, or a date) |
| rank | — | Path to existing report to re-rank by churn |
| detail | — | Path to single file for deep-dive |

## Edge Cases

- **No commits in period**: Display "No commits found since {date}" rather than an empty table
- **File renames**: Counted as separate files (no `--follow`; keeps it simple and fast)
- **Empty repo / not a git repo**: Display error and exit

## Composing with Other Workflows

### Pre-filter (scope downstream analysis)

Run hotspot analysis first, then pass the file list to other workflows:
- `plan-refactor`: "Focus refactoring on these high-churn files"
- `refactor-architecture`: "These are the hotspots — are they shallow modules?"
- `drive-tests`: "These files change most — do they have adequate test coverage?"

### Post-filter (rank existing findings)

After any analysis produces a report, overlay churn to prioritize:
- A code review that found 20 issues → rank by churn to fix the most-impactful ones first
- An architecture review that surfaced 8 candidates → churn tells you which ones hurt most

## Tips

- High churn + high complexity = urgent refactoring candidate
- High churn + low complexity = probably fine (config files, generated code)
- Co-change coupling reveals hidden dependencies — files that always change together may belong in the same module
- A file with 80+ commits in 6 months that was last changed 3 months ago may indicate a stabilized hotspot (good news)