# Discover

## Entry Criteria
- The user identifies an integration target (external API, third-party service, event bus, message queue, or SDK)

## Steps
1. Identify what system we're connecting to and why — what capability does it provide that our system needs?
2. Determine the protocol: REST, GraphQL, gRPC, events/webhooks, SDK, or message queue.
3. Map what data flows across the boundary:
   - What do we send to the external system?
   - What do we receive back?
   - What events or notifications flow in either direction?
4. Identify who the callers are in our codebase — which modules, services, or components will use this integration.
5. Catalog known failure modes of the external system:
   - Timeouts and typical latency
   - Rate limits and quotas
   - Downtime windows or maintenance schedules
   - Known error responses or quirks
6. Check if an existing adapter or client library already exists in the codebase. Search for imports of the external system's SDK, existing HTTP clients pointing at the same host, or wrapper modules.

## Exit Criteria
- Integration boundary map documented: target system, protocol, data flows (in and out), callers in our codebase, and known failure modes
- Existing adapters or client libraries identified (or confirmed absent)

## Next Phase
→ Load `integrate-contract.md`
