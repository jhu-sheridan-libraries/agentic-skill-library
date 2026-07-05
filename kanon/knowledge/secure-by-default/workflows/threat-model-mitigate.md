# Phase 3: Mitigate

Propose concrete mitigations for each threat finding.

## Entry Criteria

Threat table complete from Phase 2 (STRIDE findings with severity ratings).

## Steps

1. **Propose mitigations** — For each high and medium severity threat, propose a concrete mitigation:
   - Code pattern (input validation, parameterized query, output encoding)
   - Configuration change (CORS policy, rate limit, TLS setting)
   - Architectural adjustment (add auth layer, separate trust zones, introduce audit logging)

2. **Classify priority** — For each mitigation:
   - **Must-address** — High severity threats, or medium threats with low implementation effort.
   - **Should-address** — Medium severity threats with higher effort, or defense-in-depth improvements.

3. **Prioritize** — Order mitigations by severity first, then by implementation effort (quick wins before large refactors).

4. **Accept residual risk** — For any threat not mitigated, document:
   - Why the risk is accepted (low likelihood, compensating controls, cost/benefit).
   - What conditions would change the decision (e.g. "revisit if we add public API access").

## Exit Criteria

Mitigation plan containing:
- Each high/medium threat paired with a concrete mitigation
- Priority classification (must-address / should-address)
- Implementation order
- Residual risks documented with justification

Present the mitigation plan for review.
