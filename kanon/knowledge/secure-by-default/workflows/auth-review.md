# Auth Review Workflow

Structured review of authentication and authorization flows. Secure patterns and shared definitions are in POWER.md.

## When to Use

Trigger phrases: "review auth", "check authorization", "audit authentication".

Use when building or modifying login, registration, password reset, SSO, API key management, session handling, or access control logic.

## Prerequisites

- An authentication or authorization area to review (existing or proposed).
- Access to the codebase implementing the auth flows.

## Phases

### Phase 1: Map (`auth-review-map.md`)
Map all authentication and authorization flows, session management, and token handling.

### Phase 2: Evaluate (`auth-review-evaluate.md`)
Evaluate each flow against secure patterns. Flag violations with severity.
