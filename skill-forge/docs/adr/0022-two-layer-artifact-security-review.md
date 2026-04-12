# ADR-0022: Two-Layer Artifact Security Review — Static + LLM Adversarial Eval

**Date:** 2026-04-12
**Status:** Proposed
**Deciders:** skill-forge maintainers
**Supersedes:** N/A

## Context and Problem Statement

Static pattern matching (ADR-0021) catches known-bad signatures but cannot
detect novel or subtly-worded prompt injection attacks — a determined
attacker can craft guidance that evades regex while still causing a model
to behave harmfully. An LLM rubric evaluation provides a second layer that
reasons about intent and coherence rather than matching surface patterns.

## Decision Drivers

- Static checks have zero false-negative guarantee only for known patterns
- The existing `forge eval` / promptfoo infrastructure is already present
- The Bedrock provider (`AWS_BEARER_TOKEN_BEDROCK`) is already configured
  for evals — no new credentials required
- The rubric must evaluate compiled artifact output, not source markdown,
  to test what actually reaches the model

## Decision Outcome

**Chosen option: LLM rubric eval via the existing promptfoo framework**,
as a second layer that runs against compiled `dist/claude-code/*/CLAUDE.md`
artifacts using four rubric assertions.

The four rubrics test for:
1. Identity override and behavior restriction bypass
2. Data exfiltration and unauthorized code execution
3. Contradictory or internally inconsistent instructions
4. Gradual erosion of safe defaults

This is intentionally not a CI hard gate in the initial implementation —
it runs on `AWS_BEARER_TOKEN_BEDROCK` which may not be available in all
PR contexts. It is intended as a scheduled/manual review tool for
maintainers, with promotion to a hard gate when the credential is
available in the CI environment.

### Positive Consequences

- Novel prompt injection patterns that evade static checks can be caught
  by the LLM rubric's reasoning about intent
- The rubric config in `evals/security-audit.yaml` is readable and
  auditable — reviewers can understand what is being tested
- Reuses existing eval infrastructure; no new runtime dependencies

### Negative Consequences / Trade-offs

- Requires `AWS_BEARER_TOKEN_BEDROCK` to run — not runnable in all
  contributor environments
- LLM judges can themselves produce false positives or be fooled by
  adversarial content in edge cases
- The eval covers only claude-code compiled artifacts in the initial
  implementation; other harnesses not yet covered

## Links and References

- Implements second layer for: [ADR-0021](./0021-integrated-static-security-validation.md)
- Relates to: [ADR-0020](./0020-mcp-bridge-as-claude-code-plugin-integration-layer.md)
  (eval uses the same Bedrock provider configured for the plugin)
- Implementation: `skill-forge/evals/security-audit.yaml`
- Branch: main
