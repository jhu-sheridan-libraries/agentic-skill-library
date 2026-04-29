# Phase 2: Analyze

Apply STRIDE to each trust boundary crossing from the attack surface map.

## Entry Criteria

Attack surface map complete from Phase 1 (trust boundaries, data flows, entry points, assets).

## Steps

For each trust boundary crossing, systematically apply all six STRIDE categories:

1. **Spoofing** — Can an attacker impersonate a legitimate user or component? Check: authentication at the boundary, credential validation, identity verification.

2. **Tampering** — Can data be modified in transit or at rest without detection? Check: integrity controls, signed payloads, checksums, write permissions.

3. **Repudiation** — Can actions be denied without proof? Check: audit logging, non-repudiation controls, tamper-evident logs.

4. **Information Disclosure** — Can sensitive data leak? Check: encryption in transit and at rest, error messages, logs, side channels, verbose responses.

5. **Denial of Service** — Can the service be overwhelmed or made unavailable? Check: rate limiting, resource quotas, input size limits, connection pooling.

6. **Elevation of Privilege** — Can a user gain unauthorized access to resources or operations? Check: authorization enforcement, role boundaries, input-driven privilege changes.

For each finding:
- Describe the specific threat scenario.
- Rate severity: **high** (exploitable, significant impact), **medium** (exploitable with effort or moderate impact), **low** (theoretical or minimal impact).

## Exit Criteria

Threat table with:
- Trust boundary crossing identified
- STRIDE category applied
- Threat scenario described
- Severity rated (high / medium / low)

Present the threat table for review before proceeding.

## Next Phase

→ `threat-model-mitigate.md`
