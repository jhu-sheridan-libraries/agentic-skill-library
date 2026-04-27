---
inclusion: manual
---
<!-- forge:version 0.1.0 -->

# Checkout.com Global Payments

This power provides access to Checkout.com's comprehensive API documentation. It enables AI assistants to search, explore, and understand Checkout.com's payment processing APIs covering payments, customers, disputes, issuing, platforms, workflows, and identity verification.

## What This Power Does

This power acts as an intelligent documentation assistant that can:

- **Search API Operations**: Find relevant endpoints using Lucene full-text search with fuzzy matching and typo tolerance
- **Search Documentation**: Find relevant guides, tutorials, and conceptual content
- **Explore API Structure**: Browse operations by tags and categories
- **Get Operation Details**: Retrieve simplified, token-efficient information about specific endpoints
- **Access Schema Definitions**: Get detailed schema information for request/response objects

## Important: Understand the Integration Path First

Before diving into API operations, determine which integration path the user needs:

### Flow (Prebuilt Payment UI)
If the user wants to accept payments with minimal effort, steer them towards **Flow** - Checkout.com's prebuilt payment interface. Flow handles:
- Tokenizing sensitive payment details (PCI compliant out of the box)
- Displaying available payment methods
- Capturing additional customer data
- 3D Secure authentication and redirects

**Flow is the right choice when:**
- The user wants a drop-in payment form on their website
- They want to get up and running quickly
- They don't need deep customization of the payment UI
- They want Checkout.com to manage the end-to-end payment experience

**Key resources for Flow:**
- [Get started with Flow](https://www.checkout.com/docs/get-started)
- [Customize Flow](https://www.checkout.com/docs/payments/accept-payments/accept-a-payment-on-your-website/customize-your-flow-integration)
- npm package: `@checkout.com/checkout-web-components`
- The main API call creates a Payment Session - use `ApiSearch` for "payment session" then `GetOperation` and `GetSchema` to explore it

### API-to-API (Direct Integration)
If the user needs full control over the payment experience, they should use the payment API endpoints directly. This is for:
- Server-to-server payment processing
- Custom payment UIs
- Complex payment flows (split payments, marketplace payouts, recurring billing)
- Backend-only integrations with no frontend

**Start with:** `ApiSearch` for "payment" or `ListOperations` with tag "Payments" to explore available endpoints.

## Key Features

### Comprehensive API Coverage
Access to all Checkout.com API operations including:
- **Payments**: Process payments, refunds, captures, and voids
- **Customers**: Manage customer profiles and payment instruments
- **Disputes**: Handle chargebacks and dispute management
- **Issuing**: Card issuing and management capabilities
- **Platforms**: Multi-entity and marketplace functionality
- **Workflows**: Automated business logic and event handling
- **Identity Verification**: KYC and identity checking services

### Intelligent Search
- Lucene full-text search with fuzzy matching and typo tolerance
- Handles 1-character typos (e.g. "paymnt" finds "payment")
- Relevance-ranked results with scoring
- Tag-based filtering for specific API domains

### Token-Efficient Responses
- `GetOperation` returns simplified responses (~300 tokens vs ~1,200 previously)
- Parameters show only essential info: name, location, required, type
- Request bodies show schema names with hints to use `GetSchema()` for details
- Responses grouped into success/error categories

## When to Use This Power

This power is ideal for:

- **API Integration Planning**: Understanding available endpoints and their capabilities
- **Development Support**: Getting detailed parameter and response information during coding
- **API Exploration**: Discovering new functionality and understanding API structure
- **Troubleshooting**: Finding relevant endpoints for specific use cases

## Available Tools

### Guide
Get integration guidance for Checkout.com's payment APIs. Call this first to understand the two integration paths: Flow (prebuilt payment UI with minimal code) or API-to-API (direct REST integration with full control). Returns structured recommendations, getting-started steps, and links to relevant documentation for each path.

**Use Cases:**
- Determine which integration approach fits the user's needs
- Get step-by-step onboarding for Flow or direct API integration
- Discover the key operations and npm packages for each path

**When to use:** At the start of any conversation about integrating with Checkout.com, before exploring specific endpoints.

### ApiSearch
Search the Checkout.com OpenAPI specification using Lucene full-text search with fuzzy matching, typo tolerance, and relevance ranking. Searches across operationId, path, summary, description, and tags.

**Use Cases:**
- Find payment-related endpoints: "payment", "charge", "transaction"
- Discover customer management APIs: "customer", "profile", "account"
- Locate dispute handling operations: "dispute", "chargeback", "refund"
- Search for schema definitions: "PaymentRequest", "Customer"

**When to use:** You need to find specific API endpoints, operation IDs, HTTP methods, paths, or schema definitions.

### DocsSearch
Search through Checkout.com documentation using Lucene full-text search with fuzzy matching, typo tolerance, and relevance ranking. Returns relevant sections with context.

**Use Cases:**
- Find implementation guides: "Flow integration", "3D Secure setup"
- Locate best practices: "payment security", "error handling"
- Discover integration patterns: "webhook configuration", "authentication"

**When to use:** You need to understand how to implement features, follow tutorials, or learn about concepts and best practices.

### ListOperations
List all API operations from the Checkout.com OpenAPI specification, with optional filtering by tag or text.

**Use Cases:**
- Browse all operations in a specific domain (e.g., "Payments", "Customers")
- Find operations containing specific terms
- Get an overview of available functionality

### GetOperation
Get detailed information about a specific API operation by operationId. Returns a simplified, token-efficient response with parameters, request body schema names, grouped response codes, and required scopes.

**Use Cases:**
- Understand parameters required for an endpoint
- See which schemas are used in request bodies (use `GetSchema` for full details)
- Check success/error response codes
- Learn about authentication requirements

### GetSchema
Get a schema definition by name from the Checkout.com OpenAPI specification (components/schemas).

**Use Cases:**
- Understand data structures for API requests
- Validate request/response formats
- Generate client code with proper type definitions

## Example Workflows

### Starting a New Integration
1. Call `Guide` to understand the two integration paths (Flow vs API-to-API)
2. Based on the user's needs, follow the recommended path

### Finding Payment Processing Endpoints
1. Use `ApiSearch` with query "payment process" to find relevant API operations
2. Use `GetOperation` to get information about specific endpoints
3. Use `GetSchema` to understand request/response structures

### Understanding Customer Management
1. Use `ListOperations` with tag "Customers" to see all customer-related endpoints
2. Explore specific operations like customer creation, updates, and retrieval
3. Get schema definitions for customer objects and related data structures

### Learning About Integration Patterns
1. Use `DocsSearch` with query "Flow integration" to find implementation guides
2. Search for "webhook" to understand event notification setup
3. Look for "3D Secure" to learn about authentication flows

---

## Privacy & Support

### Privacy Policy
For information about how Checkout.com collects, stores, and processes user data, please review our [Privacy Policy](https://www.checkout.com/legal/privacy-policy).

### Service Information
This power connects to Checkout.com's MCP service at `https://docs.mcp.checkout.com/rpc`, which provides access to our API documentation and developer resources.

### Support
For technical support, questions, or to report issues with this power, please contact our support team:
- [Checkout.com Support Center](https://support.checkout.com/hc/en-us)

For API-related questions and developer resources, visit our [Developer Documentation](https://www.checkout.com/docs/).

## Advanced Usage

# Advanced Usage Guide - Checkout.com Developer Experience MCP

This guide covers advanced techniques and patterns for maximizing the value of the Checkout.com Developer Experience MCP in complex integration scenarios.

## Official Resources

Before diving into advanced usage, familiarize yourself with Checkout.com's official resources:
- [Payment Authentication](https://www.checkout.com/docs/payments/authenticate-payments)
- [Marketplace Solutions](https://www.checkout.com/solutions/marketplaces)
- [Dispute Management](https://www.checkout.com/docs/disputes)
- [Workflow Automation](https://www.checkout.com/docs/workflows)
- [Security and Compliance](https://www.checkout.com/docs/payments/ensure-regulatory-compliance)

## Advanced Search Techniques

### Multi-Step Discovery Workflows

For complex integrations, use a systematic approach to discover and understand related operations:

1. **Domain Exploration**
   ```
   ListOperations with tag "Payments"
   ListOperations with tag "Workflows"
   ApiSearch for "webhook"
   ```

2. **Relationship Mapping**
   ```
   GetOperation for createPayment
   GetSchema for PaymentRequest
   GetSchema for PaymentResponse
   ApiSearch for "payment capture"
   ```

3. **Error Scenario Planning**
   ```
   ApiSearch for "void"
   ApiSearch for "refund"
   GetOperation for disputePayment
   ```

### Schema Deep Diving

Understanding complex data structures requires systematic schema exploration:

1. **Identify Core Schemas**
   ```
   GetSchema for PaymentRequest
   GetSchema for CustomerRequest
   GetSchema for WebhookEvent
   ```

2. **Explore Nested Objects**
   - `GetOperation` shows schema names referenced in request bodies
   - Use `GetSchema` to follow those references and understand full structures
   - Map required vs optional fields across related schemas

3. **Validate Data Flow**
   - Trace how data flows from request to response
   - Understand which response fields become input for subsequent operations
   - Identify shared data structures across operations

## Complex Integration Patterns

### Multi-Step Payment Flows

For sophisticated payment processing:

1. **Authorization and Capture Pattern**
   ```
   GetOperation for authorizePayment
   GetOperation for capturePayment
   GetSchema for AuthorizationRequest
   GetSchema for CaptureRequest
   ```

2. **Payment Instrument Management**
   ```
   ApiSearch for "instrument"
   GetOperation for createPaymentInstrument
   GetOperation for updatePaymentInstrument
   ```

3. **Recurring Payment Setup**
   ```
   ApiSearch for "recurring"
   ApiSearch for "subscription"
   GetSchema for RecurringPaymentRequest
   ```

### Platform and Marketplace Integrations

For multi-entity scenarios:

1. **Sub-Entity Management**
   ```
   ListOperations with tag "Platforms"
   GetOperation for createSubEntity
   GetSchema for SubEntityRequest
   ```

2. **Split Payment Scenarios**
   ```
   ApiSearch for "split"
   ApiSearch for "marketplace"
   GetSchema for SplitPaymentRequest
   ```

3. **Onboarding Workflows**
   ```
   ApiSearch for "onboard"
   GetOperation for uploadDocument
   GetSchema for OnboardingRequest
   ```

### Advanced Dispute Management

For comprehensive dispute handling:

1. **Dispute Lifecycle Management**
   ```
   GetOperation for getDispute
   GetOperation for acceptDispute
   GetOperation for provideDisputeEvidence
   GetSchema for DisputeEvidence
   ```

2. **Chargeback Prevention**
   ```
   ApiSearch for "alert"
   ApiSearch for "prevention"
   GetOperation for getDisputeAlert
   ```

## Workflow Automation Patterns

### Event-Driven Architecture

Understanding webhook and event patterns:

1. **Event Type Discovery**
   ```
   DocsSearch for "webhook events"
   GetSchema for WebhookEvent
   ApiSearch for "event"
   ```

2. **Workflow Configuration**
   ```
   ListOperations with tag "Workflows"
   GetOperation for createWorkflow
   GetSchema for WorkflowRequest
   ```

### Identity Verification Workflows

For KYC and compliance:

1. **Verification Process Discovery**
   ```
   ListOperations with tag "Identity Verification"
   GetOperation for createIdentityVerification
   GetSchema for IdentityVerificationRequest
   ```

2. **Document Management**
   ```
   ApiSearch for "document"
   GetOperation for uploadDocument
   GetSchema for DocumentRequest
   ```

## Performance and Optimization

### Efficient Tool Usage

1. **Start with Search** - Use `ApiSearch` or `DocsSearch` to find relevant operations first
2. **Get Simplified Details** - `GetOperation` returns token-efficient responses (~300 tokens)
3. **Drill into Schemas** - Only call `GetSchema` when you need full data structure details
4. **Use Tag Filtering** - `ListOperations` with a tag is more efficient than broad searches

### Token-Efficient Workflows

The `GetOperation` tool returns simplified responses by default:
- Parameters show only name, location, required status, and type
- Request bodies show schema names with hints to use `GetSchema()`
- Responses are grouped into success/error code arrays
- Security shows only required scopes

This means a typical workflow uses ~300 tokens per operation lookup instead of ~1,200.

## Security and Compliance

### Authentication Deep Dive

1. **Auth Method Discovery**
   ```
   DocsSearch for "authentication"
   DocsSearch for "authorization"
   ```

2. **Token Management**
   ```
   ApiSearch for "token"
   GetOperation for createToken
   GetSchema for TokenRequest
   ```

### PCI and Compliance

1. **Secure Data Handling**
   ```
   DocsSearch for "PCI compliance"
   DocsSearch for "sensitive data"
   ```

2. **Audit and Logging**
   ```
   ApiSearch for "audit"
   ApiSearch for "log"
   ```

## Best Practices for Power Usage

### Systematic Exploration
- Always start with broad searches and narrow down
- Use schema exploration to understand data relationships
- Map complete workflows before implementation

### Continuous Learning
- Regularly explore new API areas as your integration grows
- Stay updated with new operations and schema changes
- Use the power to understand deprecation notices and migration paths

## Additional Resources

For comprehensive implementation guidance, consult these official resources:
- [Checkout.com Developer Portal](https://www.checkout.com/docs/)
- [API Status and Updates](https://status.checkout.com/)
- [Testing and Test Cards](https://www.checkout.com/docs/testing/test-cards)
- [API Authentication](https://www.checkout.com/docs/resources/api-authentication/)

## Getting Started

# Getting Started with Checkout.com Developer Experience MCP

This guide will help you quickly start using the Checkout.com Developer Experience MCP to explore and understand Checkout.com's payment processing APIs.

## Official Documentation

For comprehensive information about Checkout.com's APIs, refer to the official documentation:
- [Checkout.com API Documentation](https://www.checkout.com/docs/)
- [API Reference](https://api-reference.checkout.com/)
- [Get Started Guide](https://www.checkout.com/docs/get-started)
- [SDKs](https://www.checkout.com/docs/integrate/sdks)

## Quick Start

### First: Determine the Integration Path

The most important question to ask is: **what kind of payment integration does the user need?**

#### Flow (Prebuilt Payment UI)
If the user wants to accept payments on their website with minimal effort, guide them to **Flow** - Checkout.com's prebuilt payment interface.

Flow manages the entire payment experience: tokenization, payment method display, customer data capture, 3D Secure authentication, and redirects. The user creates a Payment Session server-side, then mounts Flow client-side using the `@checkout.com/checkout-web-components` npm package.

**Key steps for Flow:**
1. Create a Payment Session (`CreatePaymentSession` endpoint)
2. Install `@checkout.com/checkout-web-components`
3. Initialize `CheckoutWebComponents` with the payment session and public key
4. Mount Flow onto the page with `checkout.create('flow').mount('#container')`
5. Handle payment response via webhooks or `onPaymentCompleted` callback

**Resources:**
- [Get started with Flow](https://www.checkout.com/docs/get-started)
- [Customize Flow](https://www.checkout.com/docs/payments/accept-payments/accept-a-payment-on-your-website/customize-your-flow-integration)
- [Add localization](https://www.checkout.com/docs/payments/accept-payments/accept-a-payment-on-your-website/add-localization-to-your-flow-integration)

Use `ApiSearch` with "payment session" to find the relevant operationId, then `GetOperation` and `GetSchema` for `PaymentSessionRequest` to explore the server-side setup.

#### API-to-API (Direct Integration)
If the user needs full control, custom UI, or server-to-server processing, they should use the payment API endpoints directly. Start exploring with `ApiSearch` for "payment" or `ListOperations` with tag "Payments".

---

Once the integration path is clear, you have access to six tools for exploring the API:

### 1. Get Integration Guidance (`Guide`)

Start here. The `Guide` tool returns structured guidance on the two integration paths (Flow vs API-to-API), including getting-started steps, relevant documentation links, and suggested next tools to call.

```
Call Guide to understand integration options
```

### 2. Search for API Operations (`ApiSearch`)

The fastest way to find relevant API endpoints is through keyword search:

```
Search for payment processing endpoints
```

This will use the `ApiSearch` tool to find operations related to payments. Supports fuzzy matching so typos like "paymnt" still find results. You can search for:
- **Business functions**: "payment", "refund", "customer", "dispute"
- **Technical terms**: "webhook", "authentication", "token"
- **Specific operations**: "create", "update", "delete", "list"

### 3. Browse Operations by Category (`ListOperations`)

To explore operations in a specific domain:

```
List all customer-related operations
```

This helps you understand the full scope of functionality available in each API domain.

### 4. Get Operation Information (`GetOperation`)

Once you find an interesting operation, get its details:

```
Get details for the createPayment operation
```

This provides a simplified, token-efficient response including:
- HTTP method and path
- Parameter names, locations, and types
- Request body schema names (with hints to use `GetSchema` for full details)
- Success and error response codes
- Required authentication scopes

### 5. Understand Data Structures (`GetSchema`)

To understand the data structures used in requests and responses:

```
Get the schema definition for PaymentRequest
```

This is essential for:
- Understanding required fields
- Validating data formats
- Generating client code
- Creating proper API requests

### 6. Search Documentation (`DocsSearch`)

For additional context and implementation guidance:

```
Search for webhook implementation examples
```

## Common Use Cases

### Planning a Payment Integration

1. **Discover Payment Operations**
   ```
   Search for payment processing operations
   ```

2. **Understand Payment Flow**
   ```
   Get details for createPayment operation
   Get schema for PaymentRequest
   ```

3. **Explore Related Operations**
   ```
   List operations containing "payment"
   Get details for capturePayment operation
   Get details for refundPayment operation
   ```

### Setting Up Customer Management

1. **Find Customer Operations**
   ```
   List operations with tag "Customers"
   ```

2. **Understand Customer Creation**
   ```
   Get details for createCustomer operation
   Get schema for CustomerRequest
   ```

3. **Explore Customer Lifecycle**
   ```
   Get details for updateCustomer operation
   Get details for deleteCustomer operation
   ```

### Handling Disputes and Chargebacks

1. **Discover Dispute Operations**
   ```
   Search for dispute and chargeback operations
   ```

2. **Understand Dispute Process**
   ```
   Get details for getDispute operation
   Get schema for DisputeResponse
   ```

### Implementing Webhooks

1. **Find Webhook Information**
   ```
   Search documentation for webhook setup
   Search for webhook-related operations
   ```

2. **Understand Event Types**
   ```
   Get schema for WebhookEvent
   Search documentation for event types
   ```

## Tips for Effective Usage

### Search Strategy
- Start with broad terms like "payment" or "customer"
- Fuzzy matching handles 1-character typos automatically
- Use specific operation names when you know them

### Understanding Relationships
- Operations often work together in workflows
- Use `GetSchema` to understand data flow between operations
- Look for common parameters that link operations

### Schema Exploration
- `GetOperation` shows schema names in request bodies - use `GetSchema` to get full details
- Pay attention to required vs optional fields
- Look for nested objects and their schemas

## Getting Help

If you need assistance:
- Use broad search terms to discover relevant operations
- Check schema definitions for data structure questions
- Search documentation for implementation guidance
- Explore related operations to understand complete workflows

For additional resources and detailed implementation guides, visit:
- [Checkout.com Developer Portal](https://www.checkout.com/docs/)
- [API Reference](https://api-reference.checkout.com/)
- [Webhook Management](https://www.checkout.com/docs/developer-resources/webhooks/manage-webhooks/)
- [Authentication Guide](https://www.checkout.com/docs/resources/api-authentication/)
