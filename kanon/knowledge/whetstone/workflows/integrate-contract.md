# Contract

## Entry Criteria
- Integration boundary is mapped: target system, protocol, data flows, callers, and failure modes are documented

## Steps
1. Define the interface contract before writing any implementation. Work through each element:
   - **Request/response shapes**: Define TypeScript types (or equivalent) for all data crossing the boundary.
   - **Error codes and error response shapes**: What errors does the external system return? Define typed error responses.
   - **Authentication mechanism**: API keys, OAuth, mTLS, HMAC signatures — document what's required.
   - **Rate limits and quotas**: What are the limits? How are they communicated (headers, error responses)?
   - **Idempotency requirements**: Which operations are safe to retry? What idempotency keys are needed?
   - **Pagination patterns**: If the API returns collections, how does pagination work?
2. If an OpenAPI, AsyncAPI, or protobuf spec exists, read it and extract the relevant subset. Use `invokeSubAgent` to explore large specs.
3. If no spec exists, draft the contract from documentation or by exploring the API.
4. Define the adapter's public interface — the contract our codebase sees. This may differ from the external API's raw shape:
   - Translate external naming conventions to our domain language
   - Simplify complex external responses to what callers actually need
   - Hide pagination, auth, and retry mechanics behind the interface

## Exit Criteria
- Contract defined with request/response types, error shapes, and auth mechanism
- Adapter's public interface defined — the surface area our codebase will depend on
- Contract is documented in code (types/interfaces) or in a spec file

## Next Phase
→ Load `integrate-wire.md`
