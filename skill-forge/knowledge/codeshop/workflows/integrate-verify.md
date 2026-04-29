# Verify

## Entry Criteria
- Hardened adapter with passing tests for error handling, retries, circuit breaker, timeouts, and degradation

## Steps
1. Run an end-to-end smoke test against the real service or staging environment:
   - Exercise the happy path with real credentials and real network calls
   - Verify the response matches the contract types defined in the Contract phase
2. Verify contract compliance:
   - Does the real API return the shapes we defined?
   - Are error responses structured as expected?
   - Do auth mechanisms work as documented?
3. Check latency expectations:
   - Are response times within acceptable bounds for our callers?
   - Do timeouts need adjustment based on real-world latency?
4. Verify error handling under real conditions:
   - What happens when the real service returns unexpected responses?
   - If possible, test with invalid credentials or malformed requests to confirm error paths
5. Document anything that could not be verified and why:
   - No staging environment available
   - Rate limits prevent full testing
   - Certain error conditions cannot be triggered on demand
   - Destructive operations skipped in production

## Exit Criteria
- Smoke test passes against the real or staging service, OR explicit documentation of what could not be verified and why
- Contract compliance confirmed against real responses
- Latency expectations validated or timeout values adjusted
- Unverifiable scenarios documented with rationale
