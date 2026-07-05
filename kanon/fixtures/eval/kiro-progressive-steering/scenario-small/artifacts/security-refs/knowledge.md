---
name: security-refs
displayName: Security References
description: Security compliance checklists and reference material, loaded on demand.
keywords:
  - security
  - compliance
  - owasp
  - references
author: Eval Fixture
version: 0.1.0
harnesses:
  - kiro
type: reference-pack
categories:
  - security
ecosystem: []
depends: []
enhances: []
maturity: stable
trust: official
audience: intermediate
model-assumptions: []
collections: []
inherit-hooks: false
harness-config:
  kiro:
    inclusion: manual
---
# Security References

## OWASP Top 10 Checklist

Use this checklist when reviewing code for security vulnerabilities:

| # | Category | Check |
|---|----------|-------|
| A01 | Broken Access Control | Verify authorization on every endpoint |
| A02 | Cryptographic Failures | Confirm sensitive data is encrypted at rest and in transit |
| A03 | Injection | Ensure parameterized queries for all DB operations |
| A04 | Insecure Design | Review threat model coverage |
| A05 | Security Misconfiguration | Audit default settings and unnecessary features |
| A06 | Vulnerable Components | Run dependency audit |
| A07 | Auth Failures | Check credential storage and session management |
| A08 | Integrity Failures | Verify CI/CD pipeline integrity |
| A09 | Logging Failures | Confirm security events are logged |
| A10 | SSRF | Validate all outbound URLs |

## Compliance Standards

### SOC 2 Type II Controls

- Access control reviews quarterly.
- Change management procedures documented.
- Incident response plan tested annually.
- Data retention policies enforced.

### GDPR Data Handling

- Collect only necessary personal data.
- Provide data export and deletion endpoints.
- Maintain processing records.
- Report breaches within 72 hours.

## Authentication Patterns Reference

Detailed authentication patterns for various frameworks and scenarios. This supplements the always-on code-standards steering file with deep-dive reference material.

### OAuth 2.0 Flow Selection

| Flow | Use Case |
|------|----------|
| Authorization Code + PKCE | SPAs and mobile apps |
| Client Credentials | Service-to-service |
| Device Code | CLI tools and IoT |

### JWT Best Practices

- Keep payload minimal; store only claims needed for authorization.
- Use RS256 for distributed systems; HS256 for single-service.
- Set expiry to 15 minutes for access tokens.
- Never store sensitive data in the JWT payload.
