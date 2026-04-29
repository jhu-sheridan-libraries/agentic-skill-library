# Wire

## Entry Criteria
- Contract is defined with types, error shapes, auth mechanism, and adapter public interface

## Steps
1. Implement the adapter using an anti-corruption layer pattern:
   - Our codebase talks to our adapter interface (defined in the Contract phase)
   - The adapter translates between our domain types and the external API's shape
   - External naming conventions, pagination details, and auth mechanics stay inside the adapter
2. Write integration tests using test doubles that honor the contract:
   - Use stubs or fakes that return responses matching the contract's type definitions
   - Do not mock internal collaborators — test doubles represent the external system, not our own code
   - Test doubles should simulate both success responses and known error responses
3. Build one vertical slice at a time:
   - The first slice proves the happy path end-to-end: one operation, request out, response back, caller gets the result
   - Each subsequent slice adds one more operation or edge case
   - Run tests after each slice — never move forward with failing tests
4. The adapter should be a deep module: small public interface hiding the translation complexity. If the adapter's public surface grows large, revisit the contract.

## Exit Criteria
- Working adapter implementing the contract's public interface
- Integration tests passing against test doubles for the happy path
- At least one vertical slice works end-to-end through the adapter

## Next Phase
→ Load `integrate-harden.md`
