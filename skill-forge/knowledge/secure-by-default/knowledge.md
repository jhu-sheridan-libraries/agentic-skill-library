---
name: secure-by-default
displayName: Secure by Default
description: Application security discipline — STRIDE threat modeling, auth/authz flow review, and secure coding patterns. Scoped to developer-facing application security, not infrastructure.
keywords:
  - security
  - threat-model
  - stride
  - owasp
  - authentication
  - authorization
  - secure-coding
author: Steven J. Miklovic
version: 0.1.0
harnesses:
  - kiro
  - claude-code
  - copilot
  - cursor
  - windsurf
  - cline
  - qdeveloper
type: power
inclusion: auto
categories:
  - security
  - code-style
ecosystem: []
depends: []
enhances: []
maturity: experimental
trust: official
audience: intermediate
model-assumptions: []
collections:
  - jhu
  - neon-caravan
inherit-hooks: false
harness-config:
  kiro:
    format: power
---
# Secure by Default

## Overview

Application security discipline for developer-facing code. This power provides STRIDE threat modeling, authentication/authorization flow review, and secure coding patterns. It is scoped to application security — not infrastructure, network, or cloud configuration.

Use this power when building features that handle user input, authentication, authorization, sensitive data, or external integrations. The workflows guide you through structured analysis; the inline secure-coding reference provides patterns to apply during implementation.

## Steering Files

- **threat-model** — 3-phase workflow: Scope → Analyze → Mitigate. Use when introducing a new feature, component, or integration that changes the attack surface.
- **auth-review** — 2-phase workflow: Map → Evaluate. Use when building or modifying authentication or authorization flows.
- **secure-coding** — Flat knowledge reference, inline below. Apply during implementation for input validation, parameterized queries, output encoding, auth patterns, dependency hygiene, error handling, HTTPS, and CORS.

## Shared Definitions

### STRIDE Categories

- **Spoofing** — An attacker impersonates a legitimate user, component, or system to gain unauthorized access.
- **Tampering** — Data is modified in transit or at rest without detection, compromising integrity.
- **Repudiation** — A user or system denies performing an action, and there is no evidence to prove otherwise.
- **Information Disclosure** — Sensitive data is exposed to unauthorized parties through leaks, logs, or side channels.
- **Denial of Service** — An attacker overwhelms a service or resource, making it unavailable to legitimate users.
- **Elevation of Privilege** — A user gains access to resources or operations beyond their authorized level.

### OWASP Top 10 Quick Reference

| ID | Category | Description |
|----|----------|-------------|
| A01 | Broken Access Control | Users act outside their intended permissions. |
| A02 | Cryptographic Failures | Sensitive data exposed due to weak or missing encryption. |
| A03 | Injection | Untrusted data sent to an interpreter as part of a command or query. |
| A04 | Insecure Design | Missing or ineffective security controls at the design level. |
| A05 | Security Misconfiguration | Default, incomplete, or ad-hoc configurations that leave gaps. |
| A06 | Vulnerable and Outdated Components | Using components with known vulnerabilities. |
| A07 | Identification and Authentication Failures | Weak authentication mechanisms or session management. |
| A08 | Software and Data Integrity Failures | Code or data modified without verification (e.g. insecure CI/CD, unsigned updates). |
| A09 | Security Logging and Monitoring Failures | Insufficient logging to detect or respond to breaches. |
| A10 | Server-Side Request Forgery (SSRF) | Application fetches remote resources without validating user-supplied URLs. |

### Secret Hygiene Rules

1. **Never commit secrets** — No API keys, passwords, tokens, or private keys in source control. Use `.gitignore` and pre-commit hooks to catch accidental commits.
2. **Use environment variables or secret managers** — Store secrets in environment variables, AWS Secrets Manager, HashiCorp Vault, or equivalent. Never hardcode.
3. **Rotate regularly** — Rotate credentials on a schedule. Automate rotation where possible.
4. **Audit access** — Review who and what has access to secrets. Revoke unused credentials promptly.

## Secure Coding Reference

This section is flat knowledge — apply these patterns during implementation.

### Input Validation

- Validate all external input at the boundary: API parameters, form fields, headers, file uploads, query strings.
- Use allowlists over denylists. Define what is permitted rather than trying to enumerate what is forbidden.
- Validate type, length, range, and format. Reject invalid input early with clear error messages.
- Treat all client-side validation as a UX convenience, not a security control. Always re-validate server-side.

### Parameterized Queries

- Never concatenate user input into SQL, NoSQL, LDAP, or OS commands.
- Use parameterized queries (prepared statements) for all database operations.
- Use ORM query builders with parameter binding. Avoid raw query methods unless parameterized.
- Apply the same principle to any interpreter: template engines, shell commands, XML parsers.

### Output Encoding

- Apply context-aware encoding before rendering untrusted data.
- **HTML context**: HTML-entity-encode (`<` → `&lt;`).
- **JavaScript context**: JavaScript-encode or use safe DOM APIs (`textContent` over `innerHTML`).
- **URL context**: percent-encode user-supplied values in URLs.
- **CSS context**: CSS-encode dynamic values. Avoid injecting user data into stylesheets.
- Use framework-provided auto-escaping (React JSX, Jinja2 autoescape, etc.) and avoid bypassing it (`dangerouslySetInnerHTML`, `| safe`).

### Authentication Patterns

- Hash passwords with **bcrypt** or **argon2**. Never use MD5, SHA-1, or unsalted SHA-256 for passwords.
- Implement multi-factor authentication (MFA) for sensitive operations and privileged accounts.
- Regenerate session IDs after login to prevent session fixation.
- Set session expiration and idle timeouts. Invalidate sessions on logout.
- Use secure, httpOnly, sameSite cookies for session tokens. Never store session tokens in localStorage.

### Authorization Patterns

- Apply the **principle of least privilege** — grant the minimum permissions required for each role or operation.
- Enforce authorization checks **server-side**. Client-side checks are for UX only.
- Use RBAC (role-based access control) or ABAC (attribute-based access control) consistently. Avoid ad-hoc permission checks scattered through code.
- Verify resource ownership — a user should only access their own resources unless explicitly authorized otherwise.
- Deny by default. If no rule grants access, deny.

### Dependency Hygiene

- Audit dependencies regularly with `npm audit`, `pip-audit`, `cargo audit`, or equivalent.
- Pin dependency versions. Use exact versions or lock files to prevent supply-chain attacks via version ranges.
- Monitor security advisories for your dependency tree (Dependabot, Snyk, Socket, or equivalent).
- Remove unused dependencies. Each dependency is attack surface.

### Error Handling

- Never leak stack traces, internal paths, database errors, or system state to end users.
- Return generic error messages to clients. Log detailed errors server-side.
- Use structured error responses with error codes, not raw exception messages.
- Handle all error paths — unhandled exceptions can expose internal state or crash the service.

### HTTPS Everywhere

- Serve all traffic over HTTPS. Redirect HTTP to HTTPS.
- Use HSTS headers to prevent protocol downgrade attacks.
- Validate TLS certificates in all outbound connections. Never disable certificate verification.

### CORS Configuration

- Configure CORS with explicit allowed origins. Never use `*` for credentialed requests.
- Restrict allowed methods and headers to what the application actually needs.
- Set `Access-Control-Max-Age` to reduce preflight request overhead.
- Validate the `Origin` header server-side for sensitive endpoints.

## Rules

1. Validate all external input at the boundary — never trust client-side validation alone.
2. Use parameterized queries for all database and interpreter operations.
3. Apply context-aware output encoding before rendering untrusted data.
4. Hash passwords with bcrypt or argon2 — never MD5 or unsalted SHA.
5. Enforce authorization server-side. Deny by default.
6. Never commit secrets to source control.
7. Audit dependencies regularly. Pin versions.
8. Never leak stack traces or internal state to end users.
9. Serve all traffic over HTTPS. Configure CORS with explicit origins.
10. Run threat modeling (STRIDE) when introducing new features that change the attack surface.
11. Review auth flows when modifying authentication or authorization logic.

## Troubleshooting

**Not sure which workflow to use:**
Use `threat-model` when analyzing a new feature or component for security risks. Use `auth-review` when building or modifying login, registration, session management, or access control. Apply the secure-coding reference during any implementation.

**Threat model feels too heavyweight:**
For small features, the scope phase may produce a minimal attack surface map (one trust boundary, a few data flows). That's fine — the value is in systematic STRIDE analysis, even when the surface is small.

**Auth review finds too many issues:**
Prioritize by severity. Must-address items (broken access control, credential storage, session fixation) block release. Should-address items (missing rate limiting, suboptimal token storage) can be tracked as follow-up work.

**Secure coding patterns conflict with framework conventions:**
Framework-provided security features (CSRF tokens, auto-escaping, ORM parameterization) satisfy the corresponding patterns. Use them. The patterns here are for cases where the framework doesn't provide built-in protection or where you're bypassing it.

**False positives in dependency audits:**
Not every advisory applies to your usage. Check whether the vulnerable code path is reachable in your application. Document accepted risks with justification. Don't suppress warnings silently.
