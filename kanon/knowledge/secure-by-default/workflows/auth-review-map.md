# Phase 1: Map

Map all authentication and authorization flows in the target area.

## Entry Criteria

User identifies the authentication or authorization area to review.

## Steps

1. **Map authentication flows** — Identify and trace each authentication mechanism:
   - Login (username/password, social login, SSO)
   - Registration (account creation, email verification)
   - Password reset (reset flow, token generation, expiration)
   - API authentication (API keys, OAuth tokens, service accounts)
   - Multi-factor authentication (TOTP, SMS, hardware keys)

2. **Map authorization checks** — Identify every authorization decision point:
   - Role checks (admin, user, moderator)
   - Permission gates (read, write, delete per resource)
   - Resource ownership (user can only access their own data)
   - Scope restrictions (API token scopes, OAuth scopes)

3. **Identify session management** — Trace the session lifecycle:
   - Creation (when and how sessions are established)
   - Storage (server-side sessions, cookies, token storage)
   - Expiration (absolute timeout, idle timeout)
   - Invalidation (logout, password change, revocation)

4. **Identify token handling** — For each token type in use:
   - JWT validation (signature verification, expiration, issuer, audience)
   - Refresh tokens (rotation policy, storage, revocation)
   - Storage location (httpOnly cookies vs localStorage vs memory)
   - Transmission (Authorization header, cookie, query parameter)

## Exit Criteria

Auth flow diagram with:
- All authentication mechanisms mapped
- All authorization decision points identified
- Session lifecycle documented
- Token handling traced

Present the auth flow map for review before proceeding.

## Next Phase

→ `auth-review-evaluate.md`
