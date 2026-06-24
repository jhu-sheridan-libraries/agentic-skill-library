---
inclusion: always
description: "Always-on coding standards covering naming, formatting, and authentication patterns."
---
<!-- forge:version 0.1.0 -->
<!-- forge:kiro-inclusion: always -->

# Code Standards

## Naming Conventions

- Use camelCase for variables and functions.
- Use PascalCase for classes, interfaces, and type aliases.
- Use UPPER_SNAKE_CASE for constants.
- Prefix boolean variables with `is`, `has`, or `should`.

## Formatting

- Use 2-space indentation.
- Maximum line length is 100 characters.
- Always use trailing commas in multi-line structures.

## Authentication Patterns

When implementing authentication flows, follow these patterns:

- Use JWT tokens with short expiry for session management.
- Store refresh tokens in httpOnly cookies, never localStorage.
- Validate tokens server-side on every request.
- Implement rate limiting on login endpoints.
- Use bcrypt or argon2 for password hashing.

For detailed security references and compliance checklists, consult the security-refs artifact. It covers OWASP guidelines, SOC 2 controls, GDPR data handling, and OAuth flow diagrams. The checklist includes integrity verification, payload validation, and authorization patterns. Always audit your code, confirm access control rules, and handle failures gracefully.
