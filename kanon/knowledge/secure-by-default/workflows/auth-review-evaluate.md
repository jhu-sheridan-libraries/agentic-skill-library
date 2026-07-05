# Phase 2: Evaluate

Evaluate each auth flow against secure patterns and flag violations.

## Entry Criteria

Auth flows mapped from Phase 1 (authentication mechanisms, authorization checks, session management, token handling).

## Steps

Evaluate each flow against these secure patterns. Flag violations with severity.

1. **Session fixation** — Is the session ID regenerated after successful login? Failure to regenerate allows an attacker to fixate a known session ID. Severity: **high**.

2. **CSRF protection** — Are state-changing requests (POST, PUT, DELETE) protected with CSRF tokens or SameSite cookies? Severity: **high**.

3. **Token storage** — Are tokens stored in httpOnly cookies, not localStorage or sessionStorage? Client-accessible storage is vulnerable to XSS exfiltration. Severity: **high**.

4. **Privilege escalation** — Can a user access another user's resources by manipulating IDs or parameters? Check for IDOR (insecure direct object reference) vulnerabilities. Severity: **high**.

5. **Broken access control** — Are authorization checks enforced server-side on every request? Client-side-only checks are trivially bypassed. Severity: **high**.

6. **Credential storage** — Are passwords hashed with bcrypt or argon2 with appropriate cost factors? Check for MD5, SHA-1, unsalted hashes, or plaintext storage. Severity: **high**.

7. **Brute force protection** — Is rate limiting applied to login, registration, and password reset endpoints? Check for account lockout or progressive delays. Severity: **medium**.

For each violation found:
- Describe the specific issue and where it occurs.
- Rate severity (high / medium / low).
- Classify as **must-address** (high severity, blocks release) or **should-address** (medium/low, track as follow-up).

## Exit Criteria

Findings report containing:
- Each violation described with location and severity
- Must-address / should-address classification
- Recommended remediation for each finding

Present the findings report for review.
