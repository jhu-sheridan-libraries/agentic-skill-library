# Kiro Progressive Steering — Evaluation Rubric

This document is the authoritative reference for the **progressive-steering** eval rubric. The rubric scores how well a compiled Kanon build delivers Progressive Steering for the Kiro harness — measuring whether steering files load only when needed rather than bloating every agent prompt.

## Quick Start

```bash
# Build your artifacts for Kiro
kanon build --harness kiro

# Run the rubric against the compiled output
kanon eval --harness kiro --rubric progressive-steering --build dist/kiro

# Machine-readable output for CI
kanon eval --harness kiro --rubric progressive-steering --build dist/kiro --json rubric.json
```

The command exits `0` on Green or Yellow ratings, and `1` on Red.

---

## What Progressive Steering Means

Kiro supports three inclusion modes for steering files:

| Mode | Behaviour | When to use |
|------|-----------|-------------|
| `always` | Loaded into every agent interaction | Core rules that apply universally |
| `fileMatch` | Loaded only when a file matching a glob is in context | Domain-specific guidance tied to file types |
| `manual` | Loaded only when the user references it via `#` | Reference material, deep-dive workflows |

**Progressive Steering** means choosing the lightest mode that still delivers the steering at the right moment. The rubric measures whether a build achieves this in practice.

---

## Metrics

The rubric computes six metrics from a compiled build directory and an optional labeled workload fixture.

### 1. Always-on Context Weight (AOCW)

**What it measures:** The fraction of total steering content (by token count) that lands in every single prompt.

**Formula:**

```
AOCW = sum(tokens(body) for file where inclusion == "always")
     / sum(tokens(body) for file in all_installed)
```

**Range:** 0.0 (nothing is always-on) to 1.0 (everything is always-on).

**Ideal:** ≤ 0.40. Lower is more progressive.

**Tokenizer:** `tiktoken` with `cl100k_base` encoding. Falls back to `max(1, ceil(chars / 4))` when tiktoken is unavailable.

---

### 2. Progressive Ratio (PR)

**What it measures:** The proportion of steering files using a progressive mode (`fileMatch` or `manual`) rather than `always`.

**Formula:**

```
PR = count(files where inclusion ∈ {"fileMatch", "manual"})
   / count(all_installed_files)
```

**Range:** 0.0 to 1.0.

**Ideal:** As high as possible. A PR of 0.67 means two-thirds of your steering is progressively disclosed.

**Note:** This is the same value the build summary prints as "progressive %". The rubric recomputes it as a consistency check.

---

### 3. FileMatch Hit Precision (FMP)

**What it measures:** Whether `fileMatch` steering files fire only when they should — not too broadly, not too narrowly.

**Formula:**

```
FMP = mean(fires_needed / fires_total) across all fileMatch files
```

Where:
- `fires_total` = number of workload prompts where the file's glob matches at least one `openedFiles[]` entry
- `fires_needed` = number of those prompts where the file appears in `expectedFired[]` (ground truth)

**Range:** 0.0 to 1.0.

**Ideal:** ≥ 0.75. A precision of 1.0 means the glob never fires on irrelevant prompts.

**Requires:** A labeled `workload.json` fixture. Without one, FMP defaults to 0 with a warning.

---

### 4. Manual Discoverability (MD)

**What it measures:** Whether `manual`-mode steering files are discoverable through always-on context — can a user know they exist without already knowing to reference them?

**Formula:**

```
MD = count(manual files whose top-5 TF-IDF tokens all appear in always-on bodies)
   / count(manual files)
```

**Range:** 0.0 to 1.0. Defined as 1.0 when there are no manual files.

**Ideal:** As high as possible. An MD of 1.0 means every manual file's key topics are mentioned somewhere in the always-on context, making them discoverable.

---

### 5. Default Escape Rate (DER)

**What it measures:** How often authors let the inclusion mode default to `always` rather than making an explicit choice.

**Formula:**

```
DER = count(artifacts where resolveKiroInclusion().source == "default")
    / count(all kiro artifacts)
```

**Range:** 0.0 to 1.0.

**Ideal:** 0.0. Every artifact should declare its inclusion mode explicitly.

**Note:** Setting `harness-config.kiro.inclusion: "always"` explicitly counts as a deliberate choice (DER = 0 for that artifact), even though the mode is the same as the default.

---

### 6. Wizard-Convention Alignment (WCA)

**What it measures:** Whether `power` and `reference-pack` artifacts follow the convention of using progressive modes rather than `always`.

**Formula:**

```
WCA = count(power/reference-pack artifacts where inclusion != "always")
    / count(power/reference-pack artifacts)
```

**Range:** 0.0 to 1.0. Defined as 1.0 when there are no power/reference-pack artifacts.

**Ideal:** 1.0. Powers should use `manual` or `fileMatch` because POWER.md is already the always-on discovery surface.

---

## Composite Score

The six metrics combine into a single 0–100 score:

```
Score = 100 × (
    0.30 × (1 - AOCW) +
    0.15 × PR          +
    0.25 × FMP         +
    0.10 × MD          +
    0.10 × (1 - DER)   +
    0.10 × WCA
)
```

### Weight Rationale

| Weight | Metric | Why |
|--------|--------|-----|
| 0.30 | AOCW | Always-on bloat is the primary harm. Consumers feel it on every prompt. |
| 0.25 | FMP | A `fileMatch` that fires on everything defeats the purpose. Precision matters. |
| 0.15 | PR | Coarse distribution check. Complements AOCW but less sensitive to content size. |
| 0.10 | MD | Manual entries must be discoverable or they're effectively uninstalled. |
| 0.10 | DER | Rewards deliberate authoring choices over silent defaults. |
| 0.10 | WCA | Rewards following the wizard's type-specific recommendations. |

---

## Rating Thresholds

| Rating | Condition | Exit Code |
|--------|-----------|-----------|
| 🟢 **Green** | Score ≥ 80 AND AOCW ≤ 0.40 AND FMP ≥ 0.75 | 0 |
| 🟡 **Yellow** | Score ≥ 60 AND AOCW ≤ 0.60 (but not Green) | 0 (with warning) |
| 🔴 **Red** | Anything below Yellow | 1 |

The AOCW and FMP sub-gates prevent gaming: a build with AOCW = 0.9 cannot reach Green even if PR and WCA are perfect.

---

## Workload Fixtures

The rubric uses labeled workload files to compute FMP. Each fixture lives under `fixtures/eval/kiro-progressive-steering/`.

### Workload Schema

Each entry in `workload.json`:

```jsonc
{
  "promptId": "open-auth-file",
  "openedFiles": ["src/auth/login.ts", "src/auth/session.ts"],
  "userReferences": ["security-checklist"],
  "expectedFired": ["auth-rules", "security-checklist"]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `promptId` | string | Unique identifier for this prompt scenario |
| `openedFiles` | string[] | Files in the agent's context (matched against `fileMatch` globs) |
| `userReferences` | string[] | Steering files explicitly `#`-referenced by the user |
| `expectedFired` | string[] | Ground-truth: which steering files should be in context |

### Included Scenarios

| Scenario | Files | Prompts | Expected Rating | Purpose |
|----------|-------|---------|-----------------|---------|
| `scenario-small` | 3 | 5+ | Green | Smoke test / happy path |
| `scenario-mixed` | 5 | 20+ | Green | CI gating fixture |
| `scenario-anti` | 5 | varies | Red | Proves rubric catches bad builds |

---

## CLI Reference

### Basic usage

```bash
kanon eval --harness kiro --rubric progressive-steering --build <dir>
```

### Options

| Flag | Description |
|------|-------------|
| `--harness kiro` | Target the Kiro harness (required) |
| `--rubric progressive-steering` | Select this rubric (default for `--harness kiro`) |
| `--build <dir>` | Path to compiled build output (e.g. `dist/kiro`) |
| `--json` | Output machine-readable JSON |
| `--output <path>` | Write JSON to a file instead of stdout |

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Green or Yellow rating |
| 1 | Red rating (build fails the rubric) |

---

## CI Integration

### GitHub Actions job

```yaml
# .github/workflows/eval-kiro-progressive-steering.yml
name: Kiro Progressive Steering Eval
on:
  pull_request:
    paths:
      - 'src/adapters/kiro*.ts'
      - 'templates/harness-adapters/kiro/**'
      - 'src/schemas.ts'
      - 'src/validate.ts'
      - 'src/wizard.ts'
      - 'src/eval/rubrics/kiro-progressive-steering.ts'
      - 'fixtures/eval/kiro-progressive-steering/**'

jobs:
  eval-kiro-progressive-steering:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: kanon build --source fixtures/eval/kiro-progressive-steering/scenario-mixed
      - run: kanon eval --harness kiro --rubric progressive-steering --build dist/kiro --json rubric.json
      - uses: actions/upload-artifact@v4
        with:
          name: rubric-result
          path: rubric.json
```

### Behaviour

- **Red** → job fails, PR is blocked.
- **Yellow** → job passes, but a warning annotation appears on the PR.
- **Green** → job passes silently.

---

## Reproducibility Contract

The rubric is deterministic. Given the same `(buildDir, workload)` inputs:

1. The tokenizer is pinned (`tiktoken` `cl100k_base`, or the chars fallback).
2. Workload files contain no timestamps, RNG seeds, or environment-dependent paths.
3. All list fields in the output are canonically sorted.
4. No reads of `Date.now()`, `process.env`, or `Math.random()` in the grading path.
5. The same `{score, rating, metrics, details}` object is produced on every invocation.

This is enforced by **Rubric Property R1** (scoring determinism), a `fast-check` property test that generates random fixtures and asserts structural equality across repeated invocations.

---

## Relationship to Build Summary

The build summary (`kanon build` stderr output) and the rubric serve different purposes:

| | Build Summary | Eval Rubric |
|---|---|---|
| **Runs** | Every `kanon build` | On-demand via `kanon eval` |
| **Cost** | Free (no fixtures needed) | Moderate (needs workload fixtures for FMP) |
| **Metrics** | PR + threshold warning | All six (AOCW, PR, FMP, MD, DER, WCA) |
| **Gates** | `--strict` promotes threshold warning to error | Red rating → exit 1 |
| **Purpose** | Fast inner-loop feedback | Deep quality gate for CI/release |

PR is shared between both surfaces. A divergence between the build-summary PR and the rubric PR indicates a defect — tested as a smoke check in the rubric integration tests.

---

## Improving Your Score

| Problem | Metric affected | Fix |
|---------|----------------|-----|
| Too much always-on content | AOCW ↑ | Move domain-specific steering to `fileMatch` with targeted globs |
| Overly broad globs (e.g. `**/*`) | FMP ↓ | Narrow globs to specific directories or extensions |
| Manual files with no mention in always-on context | MD ↓ | Reference manual file topics in POWER.md or an always-on overview |
| Artifacts relying on the default inclusion | DER ↑ | Set `harness-config.kiro.inclusion` explicitly |
| Powers/reference-packs using `always` | WCA ↓ | Switch to `manual` (powers) or `fileMatch` (reference-packs) |
| Low overall progressive ratio | PR ↓ | Convert `always` files to `fileMatch` or `manual` where possible |

---

## JSON Output Schema

When using `--json`, the output conforms to:

```typescript
interface ProgressiveSteeringResult {
  score: number;                          // 0..100
  rating: "green" | "yellow" | "red";
  metrics: {
    AOCW: number;   // 0..1
    PR: number;     // 0..1
    FMP: number;    // 0..1
    MD: number;     // 0..1
    DER: number;    // 0..1
    WCA: number;    // 0..1
  };
  details: {
    perFileMatchFile: Array<{
      name: string;
      firesNeeded: number;
      firesTotal: number;
    }>;
    perManualFile: Array<{
      name: string;
      top5Tokens: string[];
      covered: boolean;
    }>;
    defaultSourceArtifacts: string[];     // stable-sorted
    misalignedWizardArtifacts: string[];  // stable-sorted
  };
}
```

---

## Further Reading

- [Design document](../.kiro/specs/kiro-progressive-steering/design.md) — full architectural context
- [Requirements](../.kiro/specs/kiro-progressive-steering/requirements.md) — the 14 requirements this rubric validates
- [Implementation tasks](../.kiro/specs/kiro-progressive-steering/tasks.md) — tasks 15–17 cover rubric implementation
