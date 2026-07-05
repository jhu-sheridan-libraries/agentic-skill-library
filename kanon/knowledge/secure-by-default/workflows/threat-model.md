# Threat Model Workflow

STRIDE threat modeling for features, components, and integrations. STRIDE categories and shared definitions are in POWER.md.

## When to Use

Trigger phrases: "threat model", "security analysis", "attack surface".

Use when introducing a new feature, component, or integration that changes the application's attack surface — new APIs, data flows, external integrations, or trust boundary changes.

## Prerequisites

- A feature or component to analyze (existing or proposed).
- Access to the codebase or design documents describing the component.

## Phases

### Phase 1: Scope (`threat-model-scope.md`)
Map the attack surface — trust boundaries, data flows, entry points, and assets.

### Phase 2: Analyze (`threat-model-analyze.md`)
Apply STRIDE to each trust boundary crossing. Rate findings by severity.

### Phase 3: Mitigate (`threat-model-mitigate.md`)
Propose concrete mitigations for each finding. Prioritize by severity and effort.
