# Diagnostic Conventions

> Auto-generated RS_* code reference from the frozen diagnostic registry.
> See also the hand-written guidance in this file for naming, severity,
> phase ordering, blocking metadata, and safe construction rules.

## Registered Diagnostic Codes

| Code | Phase | Severity | Blocking | Description |
|---|---|---|---|---|
| `RS_AMBIGUOUS_MATCH` | detection | error | Yes | Multiple formats share the highest qualifying confidence score. |
| `RS_CANONICAL_DUPLICATE_WORKFLOW` | source-validation | error | Yes | Duplicate normalized workflow paths detected. |
| `RS_CANONICAL_INVALID` | canonical-validation | error | Yes | The canonical artifact fails schema validation. |
| `RS_CANONICAL_INVALID_BODY_OVERRIDE` | source-validation | warning | No | A body override file has an invalid harness name. |
| `RS_CANONICAL_INVALID_FRONTMATTER` | source-validation | error | Yes | The frontmatter YAML in knowledge.md could not be parsed. |
| `RS_CANONICAL_INVALID_YAML` | source-validation | error | Yes | An auxiliary YAML file could not be parsed. |
| `RS_CANONICAL_MISSING_KNOWLEDGE_MD` | source-validation | error | Yes | knowledge.md not found in the provided document set. |
| `RS_CANONICAL_WORKFLOW_TRAVERSAL` | source-validation | error | Yes | A workflow path contains directory traversal. |
| `RS_COMPATIBILITY_INCOMPLETE_PROFILE` | compatibility | error | Yes | The compatibility profile is incomplete and does not cover all canonical capabilities. |
| `RS_COMPATIBILITY_NONE` | compatibility | warning | No | A canonical capability is not supported by the target format. |
| `RS_COMPATIBILITY_PARTIAL` | compatibility | warning | No | A canonical capability is only partially supported by the target format. |
| `RS_DEFAULT_APPLIED` | source-translation | info | No | A default canonical value was applied during source translation. |
| `RS_DIRECTION_MISMATCH` | registry | error | Yes | The requested direction is not supported by the selected format contract. |
| `RS_EXTRA_FIELD_COLLISION` | source-translation | error | Yes | An extra field would collide with a canonical frontmatter key. |
| `RS_INVALID_CONTRACT` | registry | error | Yes | The format contract is invalid or does not satisfy registration requirements. |
| `RS_INVALID_REQUEST` | request | error | Yes | The translation request is invalid or malformed. |
| `RS_LIFECYCLE_DEPRECATED` | registry | warning | No | The selected format has a deprecated lifecycle status. |
| `RS_NO_MATCH` | detection | warning | No | No registered format met the selection threshold for the provided documents. |
| `RS_NORMALIZATION_APPLIED` | source-translation | info | No | A normalization rule was applied during source translation. |
| `RS_PATH_COLLISION` | plan-validation | error | Yes | Multiple output operations target the same normalized path. |
| `RS_PLAN_DUPLICATE_PATH` | plan-validation | error | Yes | Duplicate normalized output paths detected in the plan. |
| `RS_PLAN_INVALID_PATH` | plan-validation | error | Yes | An output path contains traversal, absolute prefix, NUL, or empty segment. |
| `RS_PLAN_ORPHAN_FILE` | plan-validation | error | Yes | An output file has no corresponding write operation. |
| `RS_PLAN_ORPHAN_OPERATION` | plan-validation | error | Yes | An operation references a non-existent output file index. |
| `RS_PLAN_SCHEMA_INVALID` | plan-validation | error | Yes | The translation plan fails Zod schema validation. |
| `RS_PLAN_WITHHELD` | plan-validation | info | No | The translation plan is withheld pending application policy approval. |
| `RS_REDACTION_UNSAFE` | redaction | error | Yes | Diagnostic redaction cannot prove safe output for sensitive values. |
| `RS_REGISTRATION_FAILED` | registry | error | Yes | Format registration failed due to a conflict or constraint violation. |
| `RS_REGISTRY_FAILURE` | registry | error | Yes | A registry operation failed and diagnostic construction was unavailable. |
| `RS_SENSITIVE_REFERENCE_INVALID` | redaction | error | Yes | A sensitive-value reference does not match any approved reference pattern. |
| `RS_SENSITIVE_REJECTED` | redaction | error | Yes | A literal secret was found in source content under a reject security policy. |
| `RS_SOURCE_LOSS` | source-translation | warning | No | Source data has no declared canonical mapping and will not be preserved. |
| `RS_SOURCE_LOSS_STRICT` | source-translation | error | Yes | Source data loss is not permitted in strict mode. |
| `RS_SOURCE_UNACCOUNTED` | source-translation | warning | No | A source document was neither consumed nor preserved during translation. |
| `RS_TRANSLATOR_INTERNAL` | request | error | Yes | An internal translator error occurred. |
| `RS_UNSAFE_PATH` | plan-validation | error | Yes | An output path is unsafe or violates path normalization rules. |

## Code Naming Convention

All codes use the `RS_` prefix followed by a category and optional detail:

```
RS_<CATEGORY>_<DETAIL>
```

## Severity Rules

| Severity | Meaning | Blocks Application |
|---|---|---|
| `info` | Informational note | Never |
| `warning` | Potential issue, review recommended | Only in strict mode |
| `error` | Translation cannot proceed safely | Always (if blocking) |

## Phase Order

Diagnostics sort by phase (lower = earlier), then severity, then code:

1. request
2. registry
3. detection
4. source-validation
5. source-translation
6. canonical-validation
7. compatibility
8. target-translation
9. plan-validation
10. redaction

## Safe Construction

Use `createDiagnostic` from `./rosetta` — never embed raw content,
stack traces, or credential-like values in diagnostic messages.
Use `convertInternalError` for unexpected exceptions.
