---
inclusion: manual
description: "Comprehensive API reference for the project's REST endpoints."
---
<!-- forge:version 1.0.0 -->
<!-- forge:kiro-inclusion: manual -->

# API Reference

## Authentication

All endpoints require a Bearer token in the `Authorization` header. Tokens are issued via the `/auth/token` endpoint with client credentials.

## Endpoints

### GET /users

Returns a paginated list of users. Query parameters: `page` (default 1), `limit` (default 20), `sort` (default `createdAt`).

### POST /users

Creates a new user. Required fields: `email`, `name`. Optional: `role` (default `viewer`).

### GET /users/:id

Returns a single user by ID. Returns 404 if not found.

### PUT /users/:id

Updates user fields. Partial updates supported. Returns the updated user object.

### DELETE /users/:id

Soft-deletes a user. Returns 204 on success. Requires `admin` role.
