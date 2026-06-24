# scenario-mixed — CI Gating Fixture

This is the **production CI gating fixture** for the `kiro-progressive-steering` evaluation rubric. It exercises all three Kiro inclusion modes (`always`, `fileMatch`, `manual`) across five steering files with a workload of 24 prompts covering every scenario the rubric measures.

## Artifacts

| Name | Inclusion | fileMatchPattern | Type |
|------|-----------|------------------|------|
| `general-rules` | always | — | skill |
| `typescript-patterns` | fileMatch | `src/**/*.ts` | skill |
| `python-patterns` | fileMatch | `**/*.py` | skill |
| `api-reference` | manual | — | reference-pack |
| `deployment-guide` | manual | — | skill |

## Workload Coverage

The 24 prompts in `workload.json` exercise:

- **File opens matching `src/**/*.ts`** — triggers `typescript-patterns` (6 prompts)
- **File opens matching `**/*.py`** — triggers `python-patterns` (5 prompts)
- **File opens not matching any glob** — no `fileMatch` fires (6 prompts)
- **`#`-references to manual files** — triggers the referenced file (6 prompts)
- **Bare prompts** (no opens, no refs) — only `always` files surface (4 prompts)

Some prompts combine multiple scenarios (e.g., a `#`-reference with a matching file open).

## Expected Rating

**🟢 Green**

## Per-Metric Targets

| Metric | Symbol | Target | Tolerance |
|--------|--------|--------|-----------|
| Always-on Context Weight | AOCW | 0.20 | ±0.05 |
| Progressive Ratio | PR | 0.80 | ±0.05 |
| FileMatch Hit Precision | FMP | 0.85 | ±0.05 |
| Manual Discoverability | MD | 1.00 | ±0.05 |
| Default Escape Rate | DER | 0.00 | ±0.05 |
| Wizard-Convention Alignment | WCA | 1.00 | ±0.05 |

### Target Rationale

- **AOCW ≈ 0.20**: Only 1/5 files is `always`, and its body is short (~200 chars) relative to the total corpus. The exact ratio depends on the tokenizer but the short body keeps AOCW well below the 0.40 Green sub-gate.
- **PR = 0.80**: 4/5 files use progressive modes (`fileMatch` or `manual`).
- **FMP ≈ 0.85**: Both `fileMatch` files fire on prompts that open matching files and do not fire on non-matching opens. Precision is high because the globs are specific.
- **MD = 1.00**: Both manual files (`api-reference`, `deployment-guide`) have their topics mentioned in the `always` body of `general-rules`, making them discoverable via TF-IDF.
- **DER = 0.00**: All five artifacts have explicit `harness-config.kiro.inclusion` set; none relies on the default.
- **WCA = 1.00**: The one `reference-pack` artifact (`api-reference`) uses `manual` mode, which aligns with the wizard convention. No `power` or `reference-pack` artifacts use `always`.

### Composite Score

Using weights `w1=0.30, w2=0.15, w3=0.25, w4=0.10, w5=0.10, w6=0.10`:

```
Score = 100 * (0.30*(1-0.20) + 0.15*0.80 + 0.25*0.85 + 0.10*1.00 + 0.10*(1-0.00) + 0.10*1.00)
      = 100 * (0.24 + 0.12 + 0.2125 + 0.10 + 0.10 + 0.10)
      = 100 * 0.8725
      = 87.25
```

Expected composite score: **~87** (within Green threshold of ≥80).

## CI Usage

This fixture is used by the `eval-kiro-progressive-steering` CI job:

1. `forge build` compiles the artifacts in `artifacts/`.
2. `forge eval --harness kiro --rubric progressive-steering --build <dir> --json rubric.json` scores the build.
3. A non-zero exit (Red rating) fails the job.
4. The `rubric.json` artifact is uploaded for trend analysis.

## Determinism Contract

All list fields in `workload.json` are canonically sorted (lexicographic ascending). The fixture contains no timestamps, environment variables, or absolute paths. Repeated evaluations on the same build must produce identical scores.
