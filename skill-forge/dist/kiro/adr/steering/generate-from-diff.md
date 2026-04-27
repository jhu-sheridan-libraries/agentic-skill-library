<!-- forge:version 0.4.1 -->
# ADR-from-Diff Generation

Auto-draft ADR from current git diff. Uses shared rules from POWER.md (git context, duplicate check, confirm before write, index, changelog).

## Workflow

### 1. Gather Diff
Run git context per POWER.md, plus:
```bash
git diff HEAD -- '*.tf' '*.py' '*.yaml' '*.yml' '*.toml' '*.json' '*.ts' '*.go' '*.rs'
```

### 2. Classify Changes

| Signal | Detection | Relevance |
|--------|-----------|-----------|
| New module/package | New `__init__.py`, new dir with multiple files | High |
| New dependency | Changes to `pyproject.toml`, `package.json`, `go.mod`, `Cargo.toml` | High |
| Interface change | Modified public API signatures, changed schemas | High |
| Config schema change | New env vars, new CLI options | Medium |
| Infrastructure change | New/modified `.tf`, IAM, S3, CI workflows | High |
| Pattern establishment | New base class, decorator, middleware, error hierarchy | High |
| File deletion | Removed modules/dependencies | Medium |
| Test-only / docs-only | Only tests or docs changed | Skip |

No high/medium signals → "No architectural changes detected." Stop.

### 3. Group
Related signals → single ADR. Group by: same component, same dependency+usage, same pattern across files.

### 4. Infer Details
- **Title**: from primary change
- **Context**: file paths + why it's a decision point
- **Drivers**: from commit messages, added vs removed code
- **Options**: implemented = chosen; "do nothing" always; replaced code = prior option; comments mentioning alternatives
- **Consequences**: new deps = maintenance; new patterns = consistency requirement; removed code = migration paid

### 5. Template
Multiple alternatives visible → full MADR. Single viable option → short-form. Unclear → full MADR.

### 6. Draft
1. Duplicate check per POWER.md
2. Draft with `<!-- REVIEW: ... -->` on uncertain sections
3. Present: "Drafted from recent changes. Review marked sections."
4. Confirm → write → index + changelog per POWER.md

## Limitations
- Cannot know alternatives never coded
- Inference quality depends on diff clarity
- Mark uncertainty with `<!-- REVIEW -->`