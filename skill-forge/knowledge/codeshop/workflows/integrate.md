# Integrate

Wire an external system through a contract-first adapter with hardened error handling and end-to-end verification.

## When to Use

- The user wants to integrate with an external API
- The user wants to wire up a third-party service
- The user wants to connect to an event bus or message queue
- The user wants to implement an SDK integration

## Prerequisites

- Understanding of the external system's API or protocol
- Access credentials if needed

## Shared Concepts

This workflow relies on "Contract-First Integration" and "Deep Modules" as defined in the POWER.md Shared Concepts section. The adapter's public interface is the contract our codebase sees — define it before writing implementation. The adapter itself should be a deep module: a small public interface hiding the translation complexity between our domain and the external system's shape.

## Adaptation Notes

- **Contract exploration**: Use Kiro's `invokeSubAgent` with the `general-task-execution` agent to explore external API documentation, OpenAPI specs, or SDK source code.
- **Codebase investigation**: Use direct file exploration tools (`readCode`, `grepSearch`, `listDirectory`) to find existing adapters, callers, and patterns.

## Phases

### Phase 1 — Discover
Identify the integration target, protocol, data flows, callers, and known failure modes.
→ Load `integrate-discover.md`

### Phase 2 — Contract
Define the interface contract before writing implementation — types, error shapes, auth, and the adapter's public interface.
→ Load `integrate-contract.md`

### Phase 3 — Wire
Implement the adapter as an anti-corruption layer with integration tests against test doubles.
→ Load `integrate-wire.md`

### Phase 4 — Harden
Add error handling at the system boundary — retries, circuit breaker, timeouts, graceful degradation.
→ Load `integrate-harden.md`

### Phase 5 — Verify
End-to-end smoke test against the real service and contract compliance verification.
→ Load `integrate-verify.md`

## Anti-Patterns

- Do not integrate by discovery — trial and error against a live service wastes time and risks production incidents
- Do not skip the contract phase — writing implementation before defining the interface leads to leaky abstractions
- Do not mock internal collaborators in integration tests — test doubles should honor the external contract, not stub your own code
- Do not add error handling before the happy path works — hardening a broken adapter just makes failures harder to diagnose
