# scenario-anti — Adversarial Failure Fixture

## Purpose

This fixture is an **adversarial scenario** designed to **fail** the Progressive Steering
rubric. It represents the worst-case anti-pattern: every steering file is `always`-mode,
their content overlaps heavily, and the workload never references any files or globs.

A non-Red score on this scenario is a **rubric defect** — it means the rubric is not
sensitive enough to detect a build that violates the goals of Progressive Steering.

## Expected Rating: 🔴 Red

## Metric Targets

| Metric | Expected Value | Reasoning |
|--------|---------------|-----------|
| AOCW   | 1.0           | All steering content is always-on; 100% of tokens are in always-mode files. |
| PR     | 0.0           | Zero files use a progressive inclusion mode (fileMatch or manual). |
| FMP    | 0 (undefined) | No fileMatch files exist; metric is undefined, falls back to 0. |
| DER    | 0.0           | All artifacts set inclusion explicitly to "always" (source = "harness-config"), so no defaults. |
| WCA    | 1.0           | No power/reference-pack artifacts in the fixture; denominator is 0, defined as 1.0. |
| MD     | 1.0           | No manual files exist; metric is defined as 1.0 when there are no manual files. |

## Composite Score Calculation

```
Score = 100 * (
    0.30 * (1 - 1.0)  +   # AOCW: 0.0
    0.15 * 0.0         +   # PR:   0.0
    0.25 * 0.0         +   # FMP:  0.0
    0.10 * 1.0         +   # MD:   0.1
    0.10 * (1 - 0.0)  +   # DER:  0.1
    0.10 * 1.0             # WCA:  0.1
) = 100 * 0.30 = 30
```

Score = 30, which is below the Yellow threshold (60) → **Red**.

Additionally, even if the score were somehow higher:
- AOCW = 1.0 exceeds the Yellow sub-gate (≤ 0.60), independently forcing Red.

## Fixture Design

- **5 artifacts**, all with `inclusion: always` set explicitly in frontmatter.
- Content is intentionally overlapping across files (shared vocabulary about naming,
  error handling, testing, code review) to maximise the MD metric's detection of
  redundancy and to ensure AOCW = 1.0.
- **Workload**: 5 bare prompts with no `openedFiles`, no `userReferences`, and no
  `expectedFired` entries. This ensures FMP is undefined (no fileMatch files to
  evaluate) and no progressive disclosure occurs.

## Invariant

If the rubric ever scores this fixture as anything other than Red, the rubric
has a defect that must be investigated before any other scenario results are trusted.
