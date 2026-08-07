# Extension Guide

> How to write a `RegistryExtension` — a trusted in-process module that adds
> a new format to the Rosetta Stone translation registry.

## Overview

A `RegistryExtension` bundles a `FormatContract` with optional translator
implementations. Extensions are registered by trusted host code — they run
in-process and share the same trust boundary as built-in formats.

## RegistryExtension Interface

```typescript
import type {
  RegistryExtension,
  FormatContract,
  SourceTranslator,
  TargetTranslator,
  PrettyPrinter,
} from "./rosetta";

// A RegistryExtension bundles contract + optional translators
const myExtension: RegistryExtension = {
  contract: myFormatContract,
  sourceTranslator: mySourceTranslator,   // required if direction is "source" or "bidirectional"
  targetTranslator: myTargetTranslator,   // required if direction is "target" or "bidirectional"
  prettyPrinter: myPrettyPrinter,         // optional: enables round-trip testing
};
```

## Required FormatContract Fields

Every format contract must declare:

| Field | Type | Description |
|---|---|---|
| `id` | `FormatIdentifier` | Unique kebab-case identifier |
| `direction` | `"source" \| "target" \| "bidirectional"` | Translation direction |
| `version` | `ContractVersion` | Semver contract version |
| `canonicalVersionRange` | `CanonicalVersionRange` | Supported canonical schema versions |
| `harness` | `string \| null` | Associated harness name, or null |
| `aliases` | `string[]` | Alternative names for selection |
| `lifecycle` | `LifecycleMetadata` | Status, deprecation info, replacement |
| `detection` | `DetectionContract` | Rules for automatic format identification |
| `pathConventions` | `PathConvention[]` | Expected file patterns |
| `schemaRef` | `SchemaReference` | Grammar/schema documentation link |
| `compatibility` | `RosettaCompatibilityProfile` | Capability support levels |
| `normalization` | `NormalizationRule[]` | Declared normalization rules |
| `security` | `FormatSecurityPolicy` | Sensitive-value handling policy |
| `options` | `FormatOptionDefinition[]` | Configurable translation options |
| `variants` | `VariantContract[]` | Named output variants |
| `defaultVariant` | `string \| null` | Default variant selection |

## Validation Rules

The registry validates each extension at registration time:

1. **Unique identifier** — No existing contract shares the `id`
2. **Unique aliases** — No alias collides with another contract's id or alias
3. **Direction consistency** — A `source` contract must provide `sourceTranslator`;
   a `target` contract must provide `targetTranslator`
4. **Complete compatibility profile** — Every canonical capability must be classified
5. **Valid lifecycle** — Status must be `experimental`, `active`, `deprecated`, or `retired`
6. **Supported version range** — The `canonicalVersionRange` must include at least
   one known schema version
7. **Detection rules present** — At least one detection rule for source-capable formats

## Direction Requirements

| Direction | sourceTranslator | targetTranslator | prettyPrinter |
|---|---|---|---|
| `source` | Required | Not allowed | Optional |
| `target` | Not allowed | Required | N/A |
| `bidirectional` | Required | Required | Optional |

## Detection Metadata

Detection rules enable automatic format identification. Each rule has:

```typescript
const detectionRules: DetectionRule[] = [
  {
    kind: "filename",           // "filename" | "content" | "structure"
    pattern: "POWER.md",        // match pattern
    confidence: 0.8,            // base confidence contribution (0–1)
    evidence: "Has POWER.md",   // human-readable evidence label
  },
  {
    kind: "content",
    pattern: "^---\\n",         // frontmatter marker
    confidence: 0.3,
    evidence: "YAML frontmatter present",
  },
];
```

Multiple rules combine additively up to 1.0. The detector evaluates all rules
against sorted in-memory documents and ranks candidates deterministically.

## Compatibility Profile Obligations

Every canonical capability must appear in the profile:

```typescript
import type { RosettaCompatibilityProfile } from "./rosetta";

const profile: RosettaCompatibilityProfile = {
  frontmatter:   { support: "full" },
  body:          { support: "full" },
  hooks:         { support: "partial", degradation: "comment" },
  mcpServers:    { support: "none",    degradation: "omit" },
  workflows:     { support: "none",    degradation: "omit" },
  bodyOverrides: { support: "partial", degradation: "inline" },
  extraFields:   { support: "full" },
  assetType:     { support: "full" },
};
```

Support levels: `full` (no loss), `partial` (degraded), `none` (omitted).
Degradation actions: `inline` (merged into body), `comment` (as comment), `omit` (dropped).

## Registration Example

```typescript
import { createRegistryBuilder } from "./rosetta";

const builder = createRegistryBuilder();

const result = builder.register(myExtension);

if (!result.ok) {
  // Registration failed — inspect diagnostics
  if ("diagnostics" in result) {
    for (const d of result.diagnostics) {
      console.error(`${d.code}: ${d.message}`);
    }
  } else {
    console.error("Registry failure:", result.registryFailure.reason);
  }
}

// Freeze the registry to create an immutable snapshot
const registry = builder.freeze();
```

## Diagnostic Conventions for Extensions

Extensions should use `createDiagnostic` to produce structured diagnostics:

```typescript
import { createDiagnostic } from "./rosetta";

const diagnostic = createDiagnostic({
  code: "RS_SOURCE_LOSS",
  severity: "warning",
  phase: "source-translation",
  format: "my-format",
  message: "Field 'customProp' has no canonical mapping",
  remediation: "Declare an extraFields mapping or accept the loss",
});
```

See the [Diagnostic Conventions](./diagnostic-conventions.md) guide for naming
rules and severity guidelines.

## Test Obligations

Every extension must provide:

1. **Property tests** — Verify source accounting completeness, deterministic
   output, and round-trip stability (if a pretty-printer is provided)
2. **Fixture tests** — Pin expected output for representative inputs
3. **Architecture boundary compliance** — No filesystem/process/network imports
   inside translator functions

See the [Testing Guide](./testing-guide.md) for detailed requirements.
