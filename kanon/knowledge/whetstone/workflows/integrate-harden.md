# Harden

## Entry Criteria
- Happy path is working with passing integration tests against test doubles

## Steps
1. Add error handling at the system boundary. Work through each concern:
   - **Retries with exponential backoff**: Only for idempotent operations. Define max retries and base delay. Non-idempotent operations must fail immediately.
   - **Circuit breaker**: Fail fast when the external system is down. Define the failure threshold (e.g., 5 consecutive failures), open duration, and half-open probe behavior.
   - **Timeouts**: Every external call needs a timeout. Set connect timeout and read timeout separately. Choose values based on the failure modes cataloged in the Discover phase.
   - **Graceful degradation**: What does the caller see when the external system is unavailable? Return cached data, a default response, or a typed error — never let raw external errors leak through the adapter boundary.
2. Each hardening concern gets its own test:
   - Test timeout behavior: verify the adapter fails within the expected time
   - Test retry exhaustion: verify the adapter gives up after max retries and returns a meaningful error
   - Test circuit-open scenario: verify the adapter fails fast without calling the external system
   - Test degraded response: verify callers receive the expected fallback when the system is unavailable

## Exit Criteria
- Error handling implemented for retries, circuit breaker, timeouts, and graceful degradation
- Each hardening concern has a dedicated test
- Tests pass for timeout, retry exhaustion, circuit-open, and degradation scenarios

## Next Phase
→ Load `integrate-verify.md`
