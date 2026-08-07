# Profile Field Reference

> Auto-generated from the frozen Rosetta Stone registry. Do not edit manually.

## Acquisition Profile Fields

| Field | Type | Default | Required | Description |
|---|---|---|---|---|
| `repo` | string | — | yes | — |
| `branch` | string | "main" | no | — |
| `remote` | string | "origin" | no | — |
| `checkoutPrefix` | string | — | no | — |
| `credentialReference` | string | — | no | — |

## Translation Profile Fields

| Field | Type | Default | Required | Description |
|---|---|---|---|---|
| `sourceFormat` | string | — | no | — |
| `sourceSubpath` | string | — | no | — |
| `targetFormat` | string | — | no | — |
| `targetVariant` | string | — | no | — |
| `canonicalDestination` | string | — | no | — |
| `collections` | array | [] | no | — |
| `strict` | boolean | false | no | — |
| `canonicalSchemaVersion` | string | — | no | — |
| `options` | record | {} | no | — |

## Profile Precedence Order

Option resolution follows this precedence (highest wins):

1. Explicit CLI flag (`--variant`, `--strict`, etc.)
2. Named translation profile from `kanon.config.yaml`
3. Canonical `harness-config` in the artifact
4. Format contract default

## Security Constraints

- `credentialReference` in acquisition profiles accepts `${ENV_VAR}` references only
- Literal credentials are rejected during profile validation
- Sensitive values are never logged or included in diagnostic payloads
