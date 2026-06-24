# scenario-small — Smoke-Test Fixture

## Purpose

Minimal happy-path scenario for the Kiro Progressive Steering evaluation rubric. Exercises all three inclusion modes with the smallest viable artifact set.

## Artifacts

| Name | Type | Inclusion | Notes |
|------|------|-----------|-------|
| `code-standards` | skill | always | Always-on coding standards; body mentions "authentication patterns" linking to the manual artifact |
| `auth-rules` | skill | fileMatch | Fires when any `src/**/*.ts` file is open |
| `security-refs` | reference-pack | manual | Loaded only when user explicitly references it |

## Progressive Steering Design

- The `always` artifact (`code-standards`) provides baseline context every prompt.
- The `fileMatch` artifact (`auth-rules`) fires only when TypeScript source files are in context, keeping auth rules out of non-code prompts.
- The `manual` artifact (`security-refs`) is discoverable because the `always` file mentions "authentication patterns" and "security-refs" in its body, satisfying the Manual Discoverability (MD) metric.

## Workload

Seven prompts covering:

1. Opening an auth-related source file → `auth-rules` fires.
2. Opening a non-source config file → nothing fires beyond `always`.
3. Explicit `#`-reference to `security-refs` → manual artifact fires.
4. Opening a utility source file → `auth-rules` fires (glob match).
5. Bare prompt with no files or references → nothing fires.
6. Multiple source files open → `auth-rules` fires.
7. Source file open plus explicit security reference → both fire.

## Expected Score

**Rating: 🟢 Green**

- AOCW: Low (1 of 3 artifacts is always-on, and it has modest body size).
- PR: 0.67 (2 of 3 artifacts are progressive).
- FMP: High (auth-rules fires precisely when src files are open).
- MD: 1.0 (security-refs top tokens appear in the always body).
- DER: 0.0 (all artifacts have explicit inclusion set).
- WCA: 1.0 (reference-pack uses manual, matching convention).
