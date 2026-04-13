---
name: saas-builder
displayName: SaaS Builder
description: Build production-ready multi-tenant SaaS applications with serverless architecture, integrated billing, and enterprise-grade security
keywords: ["saas","multi-tenant","serverless","aws","lambda","dynamodb","stripe","billing","react","typescript"]
author: Allen Helton
---

# SaaS Builder Power

Build production-ready multi-tenant SaaS applications with serverless architecture, integrated billing, and enterprise-grade security.

## Overview

The SaaS Builder power provides tools and patterns for building scalable, cost-efficient SaaS applications on AWS. It combines serverless infrastructure, multi-tenant data isolation, subscription management, and usage-based billing into a cohesive development framework.

## Core Capabilities

- **Multi-tenant architecture** with tenant isolation at the data layer
- **Serverless-first** infrastructure (Lambda, API Gateway, DynamoDB)
- **Integrated billing** with Stripe and usage metering
- **Authentication & authorization** with JWT and RBAC
- **Cost-per-tenant economics** with zero idle costs
- **React + TypeScript** frontend with Tailwind CSS

## MCP Servers

- **fetch**: HTTP requests for external API integration
- **stripe**: Payment processing and subscription management (disabled by default)
- **aws-knowledge-mcp-server**: AWS documentation and best practices
- **awslabs.dynamodb-mcp-server**: DynamoDB operations with tenant isolation
- **awslabs.aws-serverless-mcp**: Serverless application deployment
- **playwright**: Browser automation for testing (disabled by default)

## Architecture Principles

### Multi-Tenancy
- Tenant ID prefix in all database keys: `${tenantId}#${entityType}#${id}`
- Lambda authorizer injects tenant context from JWT
- No cross-tenant data access
- Tenant-specific feature flags and quotas

### Cost Optimization
- Pay-per-use serverless components
- DynamoDB on-demand pricing
- Zero cost when idle
- Linear scaling economics

### Security
- Managed authentication (Cognito/Auth0)
- JWT tokens with tenant claims
- Role-based access control (RBAC)
- Encryption at rest and in transit

## Repository Structure

```
/
├── frontend/          # React + TypeScript + Tailwind
├── backend/           # Lambda functions
│   ├── functions/     # API handlers
│   │   ├── authorizer/
│   │   ├── api/
│   │   └── billing/
│   ├── lib/           # Business logic
│   └── infrastructure/ # IaC (CDK/SAM)
├── schema/            # API contracts (OpenAPI)
└── .kiro/             # Kiro configuration
```

## Billing & Payments

### Money Handling
- Integer cents only (never floats)
- Store: `amount_cents: 1999` (represents $19.99)
- Currency code with every amount

### Payment Integration
- Stripe for payment processing
- Webhook verification and idempotency
- Subscription lifecycle management
- Usage-based metering with EventBridge

### Subscription States
- `trial`, `active`, `past_due`, `canceled`, `expired`
- Grace periods for payment failures
- Prorated plan changes

## Implementation Patterns

### API Design
- RESTful conventions: `/api/v1/users`, `/api/v1/users/{id}`
- Versioned endpoints
- OpenAPI specification
- Proper HTTP status codes

### Lambda Functions
Every function follows this pattern:
1. Extract tenant context from authorizer
2. Extract user roles from authorizer
3. Validate parameters
4. Check permissions (RBAC)
5. Prefix database operations with tenant ID
6. Return proper status codes
7. Log with tenant context

### DynamoDB
- Composite keys: `pk: ${tenantId}#${entityType}#${id}`
- GSI for queries: `GSI1PK: ${tenantId}`, `GSI1SK: ${entityType}#${timestamp}`
- Tenant-scoped queries only

### Frontend
- Functional React components with hooks
- TypeScript strict mode
- Tailwind utility classes
- Tenant context in React Context
- Feature flags for tenant-specific UI

## Getting Started

1. Configure AWS credentials and region in `mcp.json`
2. Enable Stripe integration if using payments
3. Review steering files for detailed patterns
4. Use OpenAPI schema as source of truth
5. Implement Lambda authorizer first
6. Build tenant-aware API endpoints
7. Add usage metering for billable operations

## Configuration

Edit `saas-builder/mcp.json` to:
- Set AWS profile and region for serverless deployment
- Enable Stripe integration (update `disabled: false`)
- Enable Playwright for browser testing
- Configure auto-approve for trusted tools

## Best Practices

- Never use floats for money calculations
- Always validate tenant context
- Check user roles before operations
- Prefix all keys with tenant ID
- Use idempotency keys for payments
- Verify webhook signatures
- Implement rate limiting per tenant
- Monitor cost per tenant
- Test cross-tenant isolation
- Design for 10x growth

## Testing

- Unit tests for business logic
- Integration tests for tenant isolation
- Test cross-tenant data leakage
- Use Stripe test mode
- Test webhook delivery failures
- Load test with multi-tenant traffic

## Compliance

- PCI compliance via Stripe (never store cards)
- GDPR support (data export/deletion)
- Audit logging per tenant
- Data residency support
- Encryption at rest and in transit

## Architecture Principles

--- 
inclusion: always 
---

# SaaS Architecture Principles

## Multi-Tenancy First
- Every data model MUST include tenant isolation (tenant_id prefix in all keys)
- Prefix all entity keys with tenant: `pk: ${tenantId}#${entityType}#${id}`
- Use separate tables per entity type, not single-table design
- Never allow cross-tenant data access - validate tenant context on every operation
- Tenant ID comes from Lambda authorizer JWT claims, never from request body
- Design for tenant-level feature flags and configuration overrides
- Plan for tenant-specific rate limits and quotas from day one

## Cost-Per-Tenant Economics
- Serverless-first: AWS Lambda, API Gateway, DynamoDB (on-demand), S3
- Zero cost when idle - pay only for active tenant usage
- Design for horizontal scaling: more tenants = same per-tenant cost
- Avoid shared resources that don't scale linearly (RDS, fixed-size caches)
- Use DynamoDB on-demand pricing until predictable traffic patterns emerge
- Monitor cost per tenant to identify pricing model opportunities

## Authentication & Authorization
- Use managed auth: AWS Cognito or Auth0 (never roll your own)
- JWT tokens with tenant claims and user roles embedded
- Lambda authorizer validates tokens and injects tenant context + user roles
- EVERY Lambda function MUST check user roles before performing operations
- Role-based access control (RBAC) within tenants - check permissions at function entry
- Never assume authorization - explicitly verify user has required role/permission
- Support SSO/SAML for enterprise tenants
- API keys for programmatic access with tenant scoping

## Data Isolation & Compliance
- Logical isolation via tenant_id (pool model) for cost efficiency
- Physical isolation (separate tables/databases) only for enterprise tier
- Encrypt at rest (DynamoDB encryption) and in transit (TLS)
- Design for data residency requirements (multi-region support)
- Audit logging per tenant for compliance (CloudTrail, custom audit tables)
- Support tenant data export and deletion (GDPR, right to be forgotten)

## Subscription & Billing Integration
- Design features with usage metering from the start
- Track billable events: API calls, storage, compute time, seats
- Use EventBridge to publish usage events to billing system
- Support multiple pricing tiers with feature gating
- Plan for trial periods, freemium, and usage-based pricing
- Graceful degradation when tenant exceeds quota or payment fails

## Operational Excellence
- Tenant-aware monitoring: CloudWatch metrics tagged by tenant_id
- Isolate noisy neighbors: per-tenant rate limiting and circuit breakers
- Feature flags for gradual rollout and A/B testing
- Zero-downtime deployments with blue/green or canary
- Tenant-specific health checks and status pages
- Support tenant impersonation for debugging (with audit trail)

## Scalability Patterns
- Stateless services: no session affinity required
- Async processing for heavy workloads (SQS, Step Functions)
- Cache tenant config in Lambda memory (refresh on cold start)
- Design for 10x growth: what breaks at 100 tenants? 1000? 10000?
- Use DynamoDB GSIs for tenant-specific queries
- Avoid fan-out queries across all tenants

## Testing Strategy
- Backend: Unit tests for business logic, integration tests for tenant isolation
- Test cross-tenant data leakage scenarios explicitly
- Load test with realistic multi-tenant traffic patterns
- Frontend: Manual testing preferred, focus on tenant-specific UI variations

## Dependency Management
- Minimize third-party libraries - prefer AWS SDKs and built-in language features
- Pin versions to avoid breakages
- Prefer AWS-managed services over self-hosted alternatives
- Evaluate libraries for multi-tenant safety (no global state)

## Billing And Payments

---
inclusion: always
---

# Billing and Payments

## Money Handling Rules

### Never Use Floats for Money
- Use integers for all monetary amounts (cents, not dollars)
- Store: `amount_cents: 1999` (represents $19.99)
- Display: Convert to decimal only in UI layer
- Calculate: All math in cents, round at the end
- Currency: Always store currency code with amount (`USD`, `EUR`, etc.)

### Data Types
- Backend: Integer type for cents (int64/bigint for large amounts)
- Database: Integer column, never DECIMAL or FLOAT
- API: Send as integer cents in JSON: `{"amount": 1999, "currency": "USD"}`
- Frontend: Convert to display format: `(1999 / 100).toFixed(2)` → "$19.99"

## Payment Integration

### Use Payment Service Providers
- Never store credit card numbers (PCI compliance nightmare)
- Use Stripe, Paddle, or similar for payment processing
- Store only: customer ID, subscription ID, payment method ID (tokens)
- Let provider handle: card storage, PCI compliance, fraud detection

### Idempotency
- All payment operations MUST be idempotent
- Use idempotency keys for charge/refund operations
- Store operation results to prevent duplicate charges
- Handle webhook retries gracefully (same event may arrive multiple times)

### Webhook Security
- Verify webhook signatures (Stripe signature, etc.)
- Use HTTPS endpoints only
- Process webhooks asynchronously (return 200 immediately, process in background)
- Store raw webhook payload for debugging
- Implement retry logic for failed webhook processing

## Subscription Management

### Subscription States
Track subscription lifecycle per tenant:
- `trial` - Free trial period
- `active` - Paid and current
- `past_due` - Payment failed, grace period
- `canceled` - User canceled, end of billing period
- `expired` - Subscription ended

### Grace Periods
- Don't immediately disable on payment failure
- Provide grace period (3-7 days) with notifications
- Degrade gracefully: read-only mode before full lockout
- Allow reactivation without data loss

### Proration
- Calculate prorated amounts when changing plans mid-cycle
- Use provider's proration logic (Stripe handles this)
- Show preview of charges before plan changes
- Document proration policy clearly to users

## Usage-Based Billing

### Metering Pattern
```
1. Track usage events in real-time
2. Aggregate usage per tenant per billing period
3. Calculate charges based on usage tiers
4. Generate invoice at end of billing period
5. Charge payment method on file
```

### Usage Tracking
- Publish usage events to EventBridge immediately
- Store aggregated usage in DynamoDB (tenant + period)
- Include metadata: tenant ID, user ID, resource type, quantity, timestamp
- Make usage data queryable for customer dashboards

### Quota Enforcement
- Check quota before expensive operations
- Return 429 with clear message when quota exceeded
- Offer upgrade path in error response
- Track quota usage in real-time (cache in Lambda memory)

## Invoicing

### Invoice Generation
- Generate invoices automatically at billing cycle end
- Include: line items, usage details, taxes, discounts
- Store invoices in S3 (PDF) and metadata in DynamoDB
- Send invoice email with PDF attachment
- Provide invoice history in customer portal

### Tax Handling
- Use tax calculation service (Stripe Tax, TaxJar)
- Never calculate tax manually (complex, jurisdiction-specific)
- Store tax rate and amount with each transaction
- Support tax-exempt customers (store exemption certificate)

## Financial Reporting

### Audit Trail
- Log all financial operations: charges, refunds, credits
- Include: timestamp, tenant ID, amount, reason, operator
- Immutable logs (append-only)
- Retain for 7+ years (compliance requirement)

### Revenue Recognition
- Track MRR (Monthly Recurring Revenue) per tenant
- Calculate churn rate and LTV (Lifetime Value)
- Store subscription start/end dates for cohort analysis
- Separate one-time charges from recurring revenue

## Security & Compliance

### PCI Compliance
- Never log credit card numbers (even partial)
- Use tokenization for stored payment methods
- Encrypt sensitive financial data at rest
- Limit access to financial data (RBAC)

### Fraud Prevention
- Monitor for unusual patterns: rapid plan changes, high-value transactions
- Implement velocity limits (max charges per hour)
- Require additional verification for large amounts
- Use provider's fraud detection (Stripe Radar)

### Refund Policy
- Implement clear refund policy
- Track refund reasons for analysis
- Partial refunds for prorated cancellations
- Automate refunds where possible, manual review for large amounts

## Multi-Currency Support

### Currency Handling
- Store prices in multiple currencies if needed
- Use exchange rates from reliable source (provider or ECB)
- Lock exchange rate at time of charge
- Display prices in customer's currency
- Bill in customer's currency to avoid FX fees

### Localization
- Format currency according to locale: `$1,999.99` (US) vs `1.999,99 €` (EU)
- Use Intl.NumberFormat in frontend for formatting
- Store locale preference per tenant

## Testing

### Test Mode
- Use payment provider's test mode for development
- Test cards: successful charges, declined cards, 3D Secure
- Test webhooks with provider's CLI tools
- Never use real payment methods in development

### Edge Cases to Test
- Payment failure during subscription renewal
- Plan upgrade/downgrade mid-cycle
- Refund after partial usage
- Subscription cancellation with immediate vs end-of-period
- Webhook delivery failures and retries
- Currency conversion edge cases

## Implementation Patterns

---
inclusion: always
---

# Implementation Patterns

## Frontend Stack
- React with TypeScript (strict mode)
- Tailwind CSS for styling
- Functional components with hooks only

## API Design

### RESTful Conventions
- Use plural nouns for collections: `/api/v1/users`, `/api/v1/users/{id}`
- HTTP methods: GET (retrieve), POST (create), PUT/PATCH (update), DELETE (delete)
- Version APIs: `/v1/`, `/v2/`
- Avoid RPC-style endpoints like `/doEverything`
- Use query parameters for filtering, not custom endpoints

### Request/Response Models
- Define schemas in `schema/` (language-agnostic format preferred)
- Validate at API boundary with appropriate validation library
- Success: Return JSON object or array
- Error: `{ "error": { "code": "...", "message": "..." } }`
- Never expose internal database fields directly
- Document with OpenAPI specification

### Error Handling
- Use proper HTTP status codes:
  - 400: Client input errors
  - 401/403: Auth errors
  - 404: Not found
  - 500: Server errors
- Log errors internally (CloudWatch), return friendly messages to clients
- Implement global exception handlers
- Never leak stack traces or raw exceptions

### Authentication & Authorization
- Require auth on all endpoints (except rare public ones)
- Use JWTs or OAuth tokens (Auth0, AWS Cognito)
- Verify tokens in Lambda authorizer
- Lambda authorizer injects tenant ID and user roles into request context
- Use scopes/roles for sensitive operations
- Enforce tenant context for data segregation
- Never rely on client-side auth checks
- Never accept tenant ID from request body - only from authorizer

### Pagination & Filtering
- Enforce pagination for large lists
- Use `?page=` and `?pageSize=` or cursor-based `?nextToken=`
- Provide filters: `/orders?status=pending&created_after=2024-01-01`
- Refuse to return extremely large payloads
- All queries automatically scoped to tenant (no cross-tenant results)

### Rate Limiting
- Use API Gateway throttling quotas per tenant
- Document limits to users
- Protect expensive operations with application-level limits
- Degrade gracefully under load
- Consider per-tenant rate limits based on subscription tier

### Usage Tracking & Metering
- Track billable events at API boundary
- Publish usage events to EventBridge for billing system
- Include tenant ID, user ID, operation type, timestamp
- Check tenant quota before expensive operations
- Return 429 (Too Many Requests) when quota exceeded

## AWS Patterns

### DynamoDB
- Composite keys: `pk: ${tenantId}#${entityType}#${id}`, `sk: metadata | #{relationType}#${relatedId}`
- GSI for queries: `GSI1PK: ${tenantId}`, `GSI1SK: ${entityType}#${timestamp}`
- Always prefix keys with tenant ID for isolation
- Design access patterns upfront to minimize queries
- Use appropriate SDK for your backend language

### Lambda Functions
- Multi-Tenant Pattern
Every Lambda function should follow this pattern:

1. **Extract tenant context** from authorizer claims (injected by Lambda authorizer)
2. **Extract user roles** from authorizer claims
3. **Validate required parameters** at function entry
4. **Check user roles/permissions** before performing operations (RBAC)
5. **Prefix all database operations** with tenant ID
6. **Return proper HTTP status codes** (403 for unauthorized, etc.)
7. **Log errors with tenant context** for debugging
8. **Never trust tenant ID from request body** - only from authorizer

Example flow:
```
handler(event) {
  tenantId = event.requestContext.authorizer.tenantId
  userRoles = event.requestContext.authorizer.roles
  
  if (!hasRequiredRole(userRoles, 'admin')) {
    return 403 Forbidden
  }
  
  // All DB queries use tenantId prefix
  result = db.get(pk: `${tenantId}#User#${userId}`)
  
  return 200 OK
}
```

### Environment Configuration
- Use environment variables for runtime config
- Use AWS Secrets Manager for sensitive values
- Never hard-code credentials or secrets

## Frontend Code Style (React + TypeScript)

### React Components
- Functional components with hooks only
- Keep under 100 lines when possible
- TypeScript interfaces for props (strict mode)
- Prefer local state over global state
- Use Tailwind utility classes
- Mobile-first responsive design

### Naming Conventions
- Components: PascalCase (`UserProfile.tsx`)
- Hooks: camelCase with `use` prefix (`useAuth.ts`)
- Files: Match component name

### Multi-Tenant Frontend Patterns
- Store tenant context in React Context or auth state
- Include tenant ID in all API requests (from auth token)
- Handle tenant-specific branding/theming
- Support feature flags for tenant-specific features
- Display tenant-scoped data only
- Handle quota exceeded errors gracefully (show upgrade prompts)

### Frontend Best Practices
- Descriptive variable names (self-documenting)
- Proper error handling with try-catch
- Avoid comments - code should be self-documenting
- Only comment complex logic when necessary

## Backend Code Style (Language-Agnostic)

### General Principles
- Descriptive variable and function names
- Proper error handling
- Structured logging (errors only, with context)
- Consistent terminology across codebase
- Follow language-specific conventions (PEP8 for Python, etc.)

### Libraries & Dependencies
- Minimize third-party libraries
- Prefer AWS SDKs and built-in language features
- Pin versions to avoid breakages
- Use libraries packaged in Lambda runtime when possible

## Repository Structure

---
inclusion: always
---

# Repository Structure

## Root Layout

```
/
├── frontend/          # React + TypeScript + Tailwind
├── backend/           # Serverless functions (language-agnostic)
├── schema/            # Shared API contracts and types
├── .kiro/             # Kiro configuration
└── README.md          # Project documentation
```

## frontend/

React + TypeScript + Tailwind CSS application (Vite or Next.js)

```
frontend/
├── src/
│   ├── features/          # Feature-oriented structure (e.g., billing/, auth/)
│   ├── components/        # Shared UI components
│   ├── hooks/             # Custom React hooks
│   ├── utils/             # Helper functions
│   └── styles/            # Tailwind config and global CSS
```

### Conventions
- PascalCase for components: `UserProfile.tsx`
- camelCase for hooks: `useAuth.ts`, `useTenant.ts`
- Import types from `schema/` - never duplicate
- Store API URLs in `.env` files - never commit secrets
- Feature-oriented structure: group by domain (e.g., `features/billing/`, `features/tenants/`)
- Tenant context available via React Context or auth state

## backend/

Serverless functions (language-agnostic: Python, Node.js, Go, Java, etc.)

```
backend/
├── functions/         # Lambda function handlers
│   ├── authorizer/    # Lambda authorizer (validates JWT, injects tenant context)
│   ├── api/           # API endpoint handlers
│   ├── billing/       # Usage tracking and metering functions
│   └── admin/         # Tenant management functions
├── lib/               # Business logic modules (or services/)
│   ├── auth/          # RBAC and permission checks
│   ├── tenants/       # Tenant isolation logic
│   └── usage/         # Usage metering utilities
├── db/                # Data access layer (tenant-aware queries)
└── infrastructure/    # IaC (CDK, SAM, Terraform)
    ├── api.yaml       # API Gateway definition
    ├── database.yaml  # DynamoDB tables
    └── auth.yaml      # Cognito/Auth0 config
```

### Conventions
- Follow language-specific conventions (PEP8 for Python, etc.)
- Import schemas from `schema/` for validation
- Keep handlers thin - business logic in `lib/` or `services/`
- Stateless design - no global state
- Consistent naming with frontend (e.g., both use "Order", not "Order" vs "Purchase")
- All functions extract tenant context from authorizer claims
- All database operations prefixed with tenant ID

## schema/

Shared API contracts and types (language-agnostic)

```
schema/
├── openapi.yaml       # API specification (primary source of truth)
├── types/             # Generated or shared types
│   ├── User.ts        # TypeScript types for frontend
│   ├── Tenant.ts
│   └── Subscription.ts
└── events/            # Event schemas for EventBridge
    └── usage-events.json
```

### Conventions
- Use OpenAPI spec as single source of truth
- Generate language-specific types from OpenAPI (TypeScript for frontend, etc.)
- No business logic - only structure
- Include tenant-related models (Tenant, Subscription, Usage)
- Keep in sync with API implementation

## Monorepo Setup (Optional)

If using TypeScript/Node.js for backend, use Yarn Workspaces or PNPM:

```json
{
  "workspaces": ["frontend", "backend", "schema"]
}
```

For other backend languages, schema sharing happens via:
- OpenAPI spec generation/consumption
- Shared proto files (gRPC)
- Code generation tools

## Key Principles

- Clean separation: frontend (UI), backend (logic), schema (contracts)
- No duplication: API contracts defined once in `schema/`
- Consistent naming across all layers
- Multi-tenant by default: organize code by tenant-aware patterns
- Optimize for low cost: static frontend, serverless backend
- Use local emulators (DynamoDB Local, LocalStack) for development

## SaaS-Specific Organization

### Tenant Management
- Authorizer function validates JWT and injects tenant context
- Tenant CRUD operations in `backend/functions/admin/`
- Tenant configuration cached in Lambda memory

### Billing & Usage
- Usage tracking functions in `backend/functions/billing/`
- EventBridge events for metering in `schema/events/`
- Quota enforcement at API Gateway and function level

### Feature Flags
- Tenant-specific feature flags stored in DynamoDB
- Checked at API boundary or in business logic
- Frontend consumes feature flags from API
