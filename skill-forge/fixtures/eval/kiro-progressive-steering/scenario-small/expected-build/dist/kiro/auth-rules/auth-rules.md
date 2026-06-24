---
inclusion: fileMatch
fileMatchPattern: "src/**/*.ts"
description: "Authentication and authorization rules loaded when working with source files."
---
<!-- forge:version 0.1.0 -->
<!-- forge:kiro-inclusion: fileMatch fileMatchPattern=src/**/*.ts -->

# Auth Rules

## Authorization Middleware

Every route handler that accesses user data MUST include authorization middleware:

```typescript
app.get("/user/:id", authorize("user:read"), async (req, res) => {
  // handler
});
```

## Token Validation

- Verify JWT signature before extracting claims.
- Check `exp` claim; reject expired tokens immediately.
- Validate `iss` and `aud` claims against expected values.
- Extract user roles from token claims, never from request body.

## Access Control

- Apply principle of least privilege to all role assignments.
- Deny by default; explicitly grant permissions per role.
- Log all authorization failures with the requesting user ID and attempted resource.
- Never expose internal authorization logic in API error responses.

## Session Management

- Regenerate session ID after successful authentication.
- Set idle timeout to 15 minutes for sensitive operations.
- Invalidate all sessions on password change.
- Use secure, httpOnly, sameSite=strict cookies for session tokens.
