# Security Reference

> Auto-generated from the frozen Rosetta Stone registry. Do not edit manually.

## Sensitive Value Policies

| Format | Policy | Allowed Reference Patterns |
|---|---|---|
| `kanon-canonical` | reference-only | `\$\{[A-Z_]+\}` |
| `claude-code` | reject | — |
| `cline` | reject | — |
| `codex` | reference-only | `\$\{[A-Z_]+\}` |
| `copilot` | reject | — |
| `cursor` | reject | — |
| `kiro` | reference-only | `\$\{[A-Z_]+\}` |
| `qdeveloper` | reject | — |
| `windsurf` | reject | — |
| `kiro-power` | reference-only | `\$\{[A-Z_]+\}` |
| `kiro-skill` | reference-only | `\$\{[A-Z_]+\}` |
| `superpowers` | reference-only | `\$\{[A-Z_]+\}` |

## Policy Descriptions

- **reject**: Sensitive values are rejected entirely. No credentials allowed in content.
- **reference-only**: Only `${ENV_VAR}` style references are permitted. Raw secrets are rejected.
- **preserve**: Sensitive values pass through unchanged (not currently used by built-ins).
