# Security Policy

## Supported versions

Only the latest release of context-bazaar receives security fixes. Older releases are not patched.

## What counts as a security issue

**Report privately:**
- Vulnerabilities in the forge CLI that allow arbitrary code execution or privilege escalation
- MCP bridge issues that expose unintended filesystem access, allow injection, or leak sensitive environment variables
- Plugin install behavior that could allow a malicious repository to compromise the host system
- Dependency vulnerabilities with a credible exploit path in this project's attack surface

**Open a public issue instead:**
- Incorrect or harmful *knowledge content* in an artifact (use the [Content Quality Report](.github/ISSUE_TEMPLATE/content_quality_report.md) template)
- Missing validations that produce bad output but have no security dimension
- General bugs in forge commands that are not security-relevant

When in doubt, report privately. We'll tell you if it belongs in the public tracker.

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Report via [GitHub private vulnerability reporting](https://github.com/thinkingsage/context-bazaar/security/advisories/new) — this creates an encrypted, private advisory visible only to maintainers.

Include:
- A description of the vulnerability and its impact
- Steps to reproduce or a proof-of-concept (a minimal demo is enough — no need to weaponize it)
- The version or commit where you observed it
- Any suggested mitigations you've identified

## What to expect

| Milestone | Target |
|---|---|
| Acknowledgement | Within 48 hours |
| Initial assessment | Within 5 business days |
| Fix or mitigation | Critical issues within 7 days; others on a best-effort basis |
| Public disclosure | Coordinated with reporter; typically after a fix is released |

We'll keep you informed throughout. If you'd like credit in the advisory and release notes, let us know — we default to crediting reporters unless asked not to.

## MCP bridge surface area

The MCP bridge (`bridge/mcp-server.cjs`) runs as a local process with access to the filesystem at `CLAUDE_PLUGIN_ROOT`. It exposes three read-only tools (`catalog_list`, `artifact_content`, `collection_list`) and does not execute artifact content or make outbound network requests. Any behavior outside that surface is worth reporting.

## Scope

| In scope | Out of scope |
|---|---|
| forge CLI | Knowledge content of artifacts (report as a content quality issue) |
| MCP bridge | The user's own Claude Code configuration |
| Plugin install mechanism | Third-party MCP servers referenced in `mcp-servers.yaml` |
| Dependency chain with credible exploit path | Theoretical vulnerabilities with no realistic attack vector |
