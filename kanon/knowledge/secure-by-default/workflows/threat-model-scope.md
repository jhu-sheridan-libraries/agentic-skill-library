# Phase 1: Scope

Map the attack surface for the component under analysis.

## Entry Criteria

User identifies a feature, component, or integration to threat-model.

## Steps

1. **Identify the component** — Name the feature or component under analysis. Define its boundaries: what code, services, and data stores are in scope.

2. **Map trust boundaries** — Identify where data crosses from trusted to untrusted zones. Examples: client ↔ server, service ↔ external API, application ↔ database, user input ↔ backend processing.

3. **Identify data flows** — Trace what data moves where. For each flow: source, destination, transport mechanism, and whether the data is sensitive (PII, credentials, financial, health).

4. **List entry points** — Enumerate all ways data enters the component:
   - API endpoints (REST, GraphQL, gRPC)
   - UI forms and user input fields
   - File uploads
   - Message queues and event streams
   - Webhooks and callbacks
   - Configuration files and environment variables

5. **Catalog assets** — List what is worth protecting:
   - User data (PII, preferences, activity)
   - Credentials (passwords, tokens, API keys)
   - Business logic (pricing rules, access policies)
   - System integrity (configuration, audit logs)

## Exit Criteria

Attack surface map containing:
- Trust boundaries with crossing points
- Data flows with sensitivity classification
- Entry points enumerated
- Assets cataloged

Present the map for review before proceeding.

## Next Phase

→ `threat-model-analyze.md`
