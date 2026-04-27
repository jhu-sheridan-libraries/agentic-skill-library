<!-- forge:version 0.4.0 -->
# ADR Health Check

Cross-reference ADRs against codebase. Produce actionable report. Do not auto-fix.

## 1. Load ADRs
For each ADR, extract: number, title, status, date, referenced file paths, dependencies, patterns, supersession links.

## 2. Checks (Accepted/Proposed ADRs only)

**File existence**: `test -f "{path}"`. Missing → **drifted**.

**Dependency presence**: grep project dependency file (`pyproject.toml`, `package.json`, `go.mod`, `Cargo.toml`, `*.tf`). Missing → **drifted**.

**Pattern survival**: `grep -r "{pattern}" -l` across source files. Zero matches → **potentially obsolete**.

**Git activity** (ADRs >6 months): `git log --since="6 months ago" --oneline -- {paths}`. Significant changes → **needs review**.

**Supersession integrity**: verify both sides of supersession links exist and statuses match. Mismatch → **broken reference**.

**Orphans**: Draft >30 days → **abandoned draft**. Proposed >60 days → **stalled proposal**.

## 3. Report Format
```markdown
# ADR Health Report — {date}

## Summary
Total: {N} | Healthy: {N} | Attention: {N}

## Issues

### 🔴 Drifted
- **ADR-NNN**: `{path}` missing since {commit}. Action: supersede or deprecate.

### 🟡 Needs Review
- **ADR-NNN**: `{path}` modified {N} times since written. Action: verify decision holds.

### 🟠 Potentially Obsolete
- **ADR-NNN**: `{pattern}` not found. Action: verify if renamed/replaced.

### ⚪ Stale Process
- **ADR-NNN** ({status}, {N} days): Promote, update, or delete.

### 🔗 Broken References
- **ADR-NNN**: supersession link inconsistent. Action: update statuses.

## Healthy
{list}
```

Present report. Let user decide actions.