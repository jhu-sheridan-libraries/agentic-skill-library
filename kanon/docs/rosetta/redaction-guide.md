# Redaction Guide

> How sensitive-value policies work, how to implement a `StructuredRedactor`,
> completeness proofs, and fail-closed behavior.

## Overview

Rosetta Stone prevents credential leakage through a **fail-closed** redaction
system. When sensitive values are detected in source content, the system either:

- **Rejects** the translation entirely (blocking)
- **Preserves** the value as-is (trusted content)
- **Requires reference-only** syntax (e.g., `${ENV_VAR}`)

If redaction completeness cannot be proven, output is suppressed entirely.

## Security Policies

Each `FormatContract` declares a `FormatSecurityPolicy`:

| Policy | Behavior | Diagnostic |
|---|---|---|
| `reject` | Block translation if literal secrets detected | `RS_SENSITIVE_REJECTED` |
| `preserve` | Pass values through unchanged (trusted content) | None |
| `reference-only` | Allow only approved reference patterns | `RS_SENSITIVE_REFERENCE_INVALID` |

## How Detection Works

The `looksLikeSecret` function identifies credential-like values using pattern
matching against common secret formats:

```typescript
import { looksLikeSecret, matchesApprovedPattern } from "./rosetta";

// Detects tokens, keys, passwords, and credential-like strings
looksLikeSecret("ghp_abc123def456");  // true (GitHub token pattern)
looksLikeSecret("hello world");        // false

// Checks if a value uses approved reference syntax
matchesApprovedPattern("${AWS_SECRET_KEY}");  // true
matchesApprovedPattern("sk-live-abc123");      // false
```

## Implementing a StructuredRedactor

A `StructuredRedactor` handles content and diagnostic redaction for inspection
reports and previews:

```typescript
import type { StructuredRedactor } from "./rosetta";
import { createRedactor, computeFingerprint } from "./rosetta";

// Create a redactor for known sensitive locations
const redactor = createRedactor([
  { path: "mcp-servers.yaml", field: "apiKey", fingerprint: computeFingerprint("sk-live-xxx") },
  { path: "knowledge.md", field: "token", fingerprint: computeFingerprint("ghp_abc") },
]);

// Redact content (replaces sensitive values with [REDACTED])
const safeContent = redactor.redactContent(rawContent);

// Redact diagnostics (removes sensitive values from messages)
const safeDiagnostics = redactor.redactDiagnostics(diagnostics);

// Prove completeness
const proof = redactor.proveCompleteness();
if (!proof || !proof.complete) {
  // Cannot prove all sensitive locations were covered
  // Output must be suppressed
}
```

## Completeness Proofs

The redactor tracks which sensitive locations it has processed. A completeness
proof certifies that every registered sensitive location has been covered:

```typescript
import type { RedactionProof } from "./rosetta";

const proof: RedactionProof = {
  complete: true,           // All locations covered
  coveredLocations: 3,      // Number of locations redacted
  totalLocations: 3,        // Total registered locations
  uncoveredPaths: [],       // Empty when complete
};
```

If `complete` is `false`, the `uncoveredPaths` field lists locations that were
not processed. In this case, the system suppresses all derived output.

## Fail-Closed Behavior

The redaction system fails closed at every stage:

1. **Detection failure** — If `looksLikeSecret` cannot determine safety,
   the value is treated as sensitive (fail-closed)

2. **Incomplete redaction** — If the redactor cannot prove all locations
   are covered, output is suppressed entirely

3. **Diagnostic construction** — Diagnostics never embed raw sensitive values;
   only fingerprints and location metadata appear

4. **Inspection reports** — Preview content is suppressed when redaction
   completeness cannot be proven

### Suppression in Practice

```typescript
import { suppressOnIncompleteRedaction } from "./rosetta";

const result = suppressOnIncompleteRedaction(translationResult, proof);
// If proof.complete === false:
// - Plan content is removed
// - Preview is marked "suppressed"
// - Diagnostics are redacted
// - Only metadata (paths, status) remains visible
```

## Fingerprinting

Sensitive values are tracked by non-reversible fingerprints, never raw values:

```typescript
import { computeFingerprint } from "./rosetta";

// djb2-based, non-reversible, truncated hex
const fp = computeFingerprint("sk-live-abc123");
// → "a3f7c2e1" (example, not actual output)
```

Fingerprints allow the system to verify redaction coverage without ever storing
or transmitting the original secret value.

## Integration with the Engine

The `RosettaEngine` applies redaction automatically during the `redaction` phase:

```typescript
import { createEngine } from "./rosetta";

const engine = createEngine(registry);

// The engine's translate method handles redaction internally:
// 1. Detects sensitive values in source documents
// 2. Applies the format contract's security policy
// 3. Blocks or references as appropriate
// 4. Proves completeness before exposing output
const result = engine.translate(request);

// result.diagnostics may include RS_SENSITIVE_REJECTED
// result.status will be "failure" if secrets are rejected
```
