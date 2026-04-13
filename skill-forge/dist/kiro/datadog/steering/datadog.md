---
inclusion: manual
---

# Onboarding

Before proceeding, let the user know that the MCP server is currently in preview and they may need to request access by visiting https://docs.datadoghq.com/bits_ai/mcp_server/


# Overview

The Datadog Observability Power provides comprehensive access to your Datadog monitoring data across logs, metrics, APM traces, Real User Monitoring (RUM), incidents, and monitors. Query and analyze production systems for debugging, performance optimization, and incident response.

**Key capabilities:**
- **Log Search**: Query application and infrastructure logs with powerful filtering
- **Metrics**: Analyze time-series data for performance and resource utilization
- **APM/Traces**: Investigate distributed traces and service dependencies
- **RUM**: Analyze user experience, page performance, and frontend errors
- **Incidents**: Track and manage production incidents
- **Monitors**: Search alerting rules and monitor status
- **Documentation**: Look up Datadog setup, instrumentation, and best practices

**Authentication**: Requires Datadog API key and application key.

## Available Steering Files

This power has the following steering files:
- **steering** - Comprehensive query syntax guide with examples, workflows, and troubleshooting

## Available MCP Servers

### datadog
**Package:** `mcp-remote` + `https://mcp.datadoghq.com/api/unstable/mcp-server/mcp`
**Connection:** Remote MCP server via npx

**Tools:**

1. **search_datadog_logs** - Search application and infrastructure logs
   - Required: `query` (string) - Log search query
   - Optional: `from` (string) - Start time (default: "now-1h")
   - Optional: `to` (string) - End time (default: "now")
   - Optional: `head_limit` (number) - Max results (default: 100)
   - Optional: `max_tokens` (number) - Token limit for output
   - Optional: `group_by_message` (boolean) - Group similar logs
   - Optional: `extra_fields` (array) - Additional fields to include
   - Returns: Matching log entries with timestamps and attributes

2. **get_datadog_metric** - Query time-series metrics
   - Required: `query` (string) - Metric query
   - Required: `from` (string) - Start time
   - Required: `to` (string) - End time
   - Optional: `raw_data` (boolean) - Return raw datapoints vs binned
   - Optional: `use_cloud_cost` (boolean) - Query cloud cost data
   - Returns: Metric values over time with aggregations

3. **search_datadog_spans** - Search APM traces and spans
   - Required: `query` (string) - Span search query
   - Optional: `from` (string) - Start time (default: "now-1h")
   - Optional: `to` (string) - End time (default: "now")
   - Optional: `head_limit` (number) - Max results (default: 100)
   - Optional: `max_tokens` (number) - Token limit for output
   - Optional: `custom_attributes` (array) - Custom span attributes to include
   - Returns: Matching spans with trace IDs and timing

4. **get_datadog_trace** - Get full trace details by trace ID
   - Required: `trace_id` (string) - Trace ID to retrieve
   - Returns: Complete trace with all spans and relationships

5. **search_datadog_rum_events** - Search Real User Monitoring events
   - Required: `query` (string) - RUM event query
   - Optional: `from` (string) - Start time (default: "now-15m")
   - Optional: `to` (string) - End time (default: "now")
   - Optional: `head_limit` (number) - Max results (default: 100)
   - Optional: `max_tokens` (number) - Token limit for output
   - Optional: `detailed_output` (boolean) - Include full event details
   - Returns: RUM events (views, actions, errors, resources)

6. **search_datadog_incidents** - Search and list incidents
   - Optional: `query` (string) - Incident search query (default: "state:active")
   - Optional: `from` (string) - Start time
   - Optional: `to` (string) - End time
   - Returns: Incidents with severity, status, and affected services

7. **get_datadog_incident** - Get detailed incident information
   - Required: `incident_id` (string) - Incident ID
   - Returns: Full incident details with timeline and updates

8. **search_datadog_monitors** - Search alerting monitors
   - Optional: `query` (string) - Monitor search query
   - Returns: Monitors with status and configuration

9. **search_datadog_services** - List APM services
   - Optional: `detailed_output` (boolean) - Include service details
   - Returns: Services with metadata and dependencies

10. **search_datadog_dashboards** - Search dashboards
    - Optional: `query` (string) - Dashboard search query
    - Optional: `max_queries_per_dashboard` (number) - Extract widget queries
    - Returns: Dashboards with metadata and widget queries

11. **search_datadog_docs** - Search Datadog documentation
    - Required: `query` (string) - Documentation search query
    - Returns: Relevant documentation pages and guides

## Tool Usage Examples

### Searching Logs

**Find error logs:**
```javascript
usePower("datadog", "datadog", "search_datadog_logs", {
  "query": "service:api env:prod status:error",
  "from": "now-1h",
  "to": "now"
})
// Returns: Error logs from API service in last hour
```

**Search with custom attributes:**
```javascript
usePower("datadog", "datadog", "search_datadog_logs", {
  "query": "service:checkout @http.status_code:[400 TO 599]",
  "from": "now-1h",
  "to": "now",
  "extra_fields": ["@user.id", "@order.id", "@http.*"]
})
// Returns: HTTP errors with user and order context
```

### Querying Metrics

**Service response time:**
```javascript
usePower("datadog", "datadog", "get_datadog_metric", {
  "query": "avg:trace.servlet.request.duration{service:api,env:prod} by {resource_name}",
  "from": "now-4h",
  "to": "now"
})
// Returns: Average response time per endpoint
```

**CPU usage by host:**
```javascript
usePower("datadog", "datadog", "get_datadog_metric", {
  "query": "avg:system.cpu.user{env:prod} by {host}",
  "from": "now-1h",
  "to": "now"
})
// Returns: CPU usage for each production host
```

**Cloud costs:**
```javascript
usePower("datadog", "datadog", "get_datadog_metric", {
  "query": "sum:all.cost{*} by {providername}.rollup(sum, daily)",
  "from": "now-30d",
  "to": "now",
  "use_cloud_cost": true
})
// Returns: Daily costs by cloud provider
```

### Searching Traces

**Find slow requests:**
```javascript
usePower("datadog", "datadog", "search_datadog_spans", {
  "query": "service:api @duration:>100000000",  // >100ms in nanoseconds
  "from": "now-1h",
  "to": "now"
})
// Returns: Slow API requests with trace IDs
```

**Get full trace details:**
```javascript
usePower("datadog", "datadog", "get_datadog_trace", {
  "trace_id": "7d5d747be160e280504c099d984bcfe0"
})
// Returns: Complete trace with all spans and timing
```

### RUM Analysis

**Find slow page loads:**
```javascript
usePower("datadog", "datadog", "search_datadog_rum_events", {
  "query": "@type:view @view.loading_time:>3000",
  "from": "now-1h",
  "to": "now",
  "detailed_output": true
})
// Returns: Pages taking >3 seconds to load
```

**Frontend errors:**
```javascript
usePower("datadog", "datadog", "search_datadog_rum_events", {
  "query": "@type:error @application.name:\"My App\" @device.type:mobile",
  "from": "now-1h",
  "to": "now"
})
// Returns: Mobile frontend errors
```

### Incident Management

**List active incidents:**
```javascript
usePower("datadog", "datadog", "search_datadog_incidents", {
  "query": "state:(active OR stable)"
})
// Returns: Current incidents being worked on
```

**Get incident details:**
```javascript
usePower("datadog", "datadog", "get_datadog_incident", {
  "incident_id": "12345"
})
// Returns: Full incident timeline and updates
```

### Monitor Search

**Find alerting monitors:**
```javascript
usePower("datadog", "datadog", "search_datadog_monitors", {
  "query": "status:alert muted:false env:prod"
})
// Returns: Active unmuted alerts in production
```

## Combining Tools (Workflows)

### Workflow 1: Production Error Investigation

```javascript
// Step 1: Find recent errors in logs
const errorLogs = usePower("datadog", "datadog", "search_datadog_logs", {
  "query": "service:checkout env:prod status:error",
  "from": "now-1h",
  "to": "now",
  "extra_fields": ["@error.message", "@user.id"]
})

// Step 2: Find related error traces
const errorSpans = usePower("datadog", "datadog", "search_datadog_spans", {
  "query": "service:checkout status:error",
  "from": "now-1h",
  "to": "now"
})

// Step 3: Get full trace for first error
const fullTrace = usePower("datadog", "datadog", "get_datadog_trace", {
  "trace_id": errorSpans[0].trace_id
})

// Step 4: Check if there's an active incident
const incidents = usePower("datadog", "datadog", "search_datadog_incidents", {
  "query": "state:active"
})

// Step 5: Check related monitors
const monitors = usePower("datadog", "datadog", "search_datadog_monitors", {
  "query": "tag:\"service:checkout\" status:alert"
})
```

### Workflow 2: Performance Degradation Analysis

```javascript
// Step 1: Identify slow requests
const slowSpans = usePower("datadog", "datadog", "search_datadog_spans", {
  "query": "service:api @duration:>100000000",  // >100ms
  "from": "now-1h",
  "to": "now"
})

// Step 2: Check response time metrics
const latencyMetrics = usePower("datadog", "datadog", "get_datadog_metric", {
  "query": "avg:trace.servlet.request.duration{service:api} by {resource_name}",
  "from": "now-4h",
  "to": "now"
})

// Step 3: Check infrastructure metrics
const cpuMetrics = usePower("datadog", "datadog", "get_datadog_metric", {
  "query": "avg:system.cpu.user{service:api} by {host}",
  "from": "now-4h",
  "to": "now"
})

// Step 4: Check for deployment correlation
const deploymentLogs = usePower("datadog", "datadog", "search_datadog_logs", {
  "query": "service:api @deployment.version:*",
  "from": "now-4h",
  "to": "now"
})

// Step 5: Get full trace of slowest request
const slowestTrace = usePower("datadog", "datadog", "get_datadog_trace", {
  "trace_id": slowSpans[0].trace_id
})
```

### Workflow 3: User Experience Investigation

```javascript
// Step 1: Find slow page loads
const slowPages = usePower("datadog", "datadog", "search_datadog_rum_events", {
  "query": "@type:view @view.loading_time:>3000",
  "from": "now-1h",
  "to": "now",
  "detailed_output": true
})

// Step 2: Check for frontend errors
const frontendErrors = usePower("datadog", "datadog", "search_datadog_rum_events", {
  "query": "@type:error",
  "from": "now-1h",
  "to": "now"
})

// Step 3: Check backend API performance
const apiLatency = usePower("datadog", "datadog", "get_datadog_metric", {
  "query": "avg:trace.servlet.request.duration{service:api,env:prod}",
  "from": "now-1h",
  "to": "now"
})

// Step 4: Check resource loading issues
const resourceErrors = usePower("datadog", "datadog", "search_datadog_rum_events", {
  "query": "@type:resource @resource.status_code:[400 TO 599]",
  "from": "now-1h",
  "to": "now"
})
```

### Workflow 4: Service Dependency Analysis

```javascript
// Step 1: List all services
const services = usePower("datadog", "datadog", "search_datadog_services", {
  "detailed_output": true
})

// Step 2: Find traces for a service
const serviceSpans = usePower("datadog", "datadog", "search_datadog_spans", {
  "query": "service:frontend",
  "from": "now-1h",
  "to": "now"
})

// Step 3: Get full trace to see downstream calls
const dependencyTrace = usePower("datadog", "datadog", "get_datadog_trace", {
  "trace_id": serviceSpans[0].trace_id
})

// Step 4: Check latency between services
const serviceLatency = usePower("datadog", "datadog", "get_datadog_metric", {
  "query": "avg:trace.servlet.request.duration{env:prod} by {service}",
  "from": "now-4h",
  "to": "now"
})
```

## Query Syntax Guide

### Log Search Syntax

**Tags** (no @ prefix):
- `service:api` - Service name
- `env:prod` - Environment
- `status:error` - Log status level
- `host:web-1` - Hostname

**Attributes** (@ prefix required):
- `@http.status_code:500` - HTTP status
- `@user.id:abc123` - User identifier
- `@duration:>1000` - Duration in milliseconds
- `@error.message:"timeout"` - Error message

**Boolean operators:**
- AND (default): `service:api status:error`
- OR: `env:(prod OR staging)`
- Exclusion: `-status:info`

**Wildcards:**
- `service:web*` - Matches web-api, web-worker
- `@url:/api/*` - Matches any /api/ path

### Metric Query Syntax

**Structure:**
```
<AGGREGATOR>:<METRIC_NAME>{<SCOPE>} by {<GROUPING>}
```

**Aggregators:**
- `avg` - Average across series
- `sum` - Sum all series
- `min` / `max` - Min/max values
- `p95` / `p99` - Percentiles

**Examples:**
```
avg:system.cpu.user{env:prod} by {host}
sum:trace.requests.count{service:api}.rollup(sum, 300)
p95:trace.servlet.request.duration{env:prod}
```

### APM/Trace Query Syntax

**Reserved fields** (NO @ prefix):
- `service` - Service name
- `resource_name` - Endpoint/operation
- `operation_name` - Span operation
- `status` - ok or error
- `trace_id` - Specific trace

**Span attributes** (@ prefix required):
- `@http.status_code` - HTTP status
- `@http.method` - HTTP method
- `@duration` - Duration in **nanoseconds**
- `@error.message` - Error message

**Duration conversions:**
- 1ms = 1,000,000 nanoseconds
- 100ms = 100,000,000 nanoseconds
- 1s = 1,000,000,000 nanoseconds

**Examples:**
```
service:api status:error
service:api @duration:>100000000
operation_name:db.query @duration:>1000000000
```

### RUM Query Syntax

**Event types:**
- `@type:view` - Page views
- `@type:action` - User interactions
- `@type:error` - Frontend errors
- `@type:resource` - Resource loading
- `@type:vital` - Core Web Vitals

**Common attributes:**
- `@application.name` - RUM app name
- `@view.url_path` - Page URL
- `@view.loading_time` - Load duration (ms)
- `@device.type` - Device type
- `@browser.name` - Browser name
- `@user.id` - User identifier

**Examples:**
```
@type:view @view.loading_time:>3000
@type:error @browser.name:Safari
@type:resource @resource.status_code:[400 TO 599]
```

### Incident Query Syntax

**Fields:**
- `state` - active, stable, resolved
- `severity` - SEV-1, SEV-2, SEV-3, SEV-4, SEV-5
- `customer_impacted` - true or false

**Important:** Group multiple values of same field:
```
severity:(SEV-1 OR SEV-2)  ✅
severity:SEV-1 OR severity:SEV-2  ❌
```

**Examples:**
```
state:active
severity:(SEV-1 OR SEV-2) AND state:active
customer_impacted:true AND state:active
```

### Monitor Query Syntax

**Fields:**
- `status` - alert, warn, ok
- `muted` - true or false
- `tag` - Monitor tags
- `env` - Environment
- `priority` - p1, p2, etc.

**Examples:**
```
status:alert muted:false
priority:(p1 OR p2)
tag:"service:api" status:alert
```

## Best Practices

### ✅ Do:

- **Start with narrow time ranges** (15m-1h) and expand if needed
- **Use unified service tags** (service, env, version) together
- **Filter by service first** to scope queries
- **Use @ prefix correctly** (attributes yes, reserved fields no)
- **Remember duration units** (nanoseconds for spans, milliseconds for logs/RUM)
- **Group similar logs** with `group_by_message: true`
- **Set appropriate max_tokens** (5000 for overview, 50000 for details)
- **Use extra_fields/custom_attributes** for custom data
- **Leverage documentation search** for setup and instrumentation questions
- **Check incidents first** when investigating issues

### ❌ Don't:

- **Use very long time ranges** without reason (expensive and slow)
- **Forget @ prefix** for log/span attributes
- **Use @ prefix** for reserved trace fields (service, status, etc.)
- **Forget duration conversions** (5ms = 5,000,000 nanoseconds)
- **Use wildcards inside quotes** (they become literal)
- **Skip escaping special characters** (: = / \ etc.)
- **Use excessive free-text searches** (use structured tags instead)
- **Ignore unified service tagging** (always include service, env, version)
- **Query without time filters** (expensive and slow)

## Troubleshooting

### Error: "No results found"
**Cause:** Filters too restrictive or wrong field names
**Solution:**
1. Widen time range
2. Check field names (use @ for attributes)
3. Verify case-sensitivity
4. Use wildcards for partial matches

### Error: "Query timeout"
**Cause:** Query too expensive or time range too large
**Solution:**
1. Narrow time range (start with now-1h)
2. Add specific filters (service, env)
3. Reduce aggregation cardinality
4. Use head_limit to restrict results

### Error: "Invalid query syntax"
**Cause:** Malformed query string
**Solution:**
1. Check @ prefix usage
2. Escape special characters (: = / \)
3. Use double quotes for strings with spaces
4. Group OR conditions: `field:(value1 OR value2)`

### Error: "Trace not found"
**Cause:** Invalid trace ID or trace expired
**Solution:**
1. Verify trace_id format (hex string)
2. Check if trace is within retention period
3. Ensure trace exists in correct environment

## Configuration

**Authentication Required**: Datadog API key and application key

**Setup Steps:**

1. **Get Datadog Credentials:**
   - Log in to Datadog
   - Navigate to Organization Settings → API Keys
   - Create or copy API key
   - Navigate to Organization Settings → Application Keys
   - Create or copy application key

2. **Configure in mcp.json:**
   ```json
   {
     "mcpServers": {
       "datadog": {
         "command": "npx",
         "args": [
           "mcp-remote",
           "https://mcp.datadoghq.com/api/unstable/mcp-server/mcp"
         ],
         "env": {
           "DD_API_KEY": "your-api-key-here",
           "DD_APP_KEY": "your-app-key-here",
           "DD_SITE": "datadoghq.com"
         }
       }
     }
   }
   ```

3. **Set DD_SITE** based on your region:
   - US1: `datadoghq.com` (default)
   - US3: `us3.datadoghq.com`
   - US5: `us5.datadoghq.com`
   - EU: `datadoghq.eu`
   - AP1: `ap1.datadoghq.com`

## Tips

1. **Start narrow** - Use 15m-1h time ranges, expand if needed
2. **Use steering file** - Comprehensive syntax guide with examples
3. **Check incidents first** - Active incidents often point to root cause
4. **Leverage unified tags** - Always use service, env, version together
5. **Search docs** - Use `search_datadog_docs` for setup questions
6. **Group logs** - Use `group_by_message` to reduce duplicate entries
7. **Get full traces** - Use trace_id from spans to get complete picture
8. **Monitor your monitors** - Check alert status during investigations
9. **Analyze dependencies** - Use full traces to understand service relationships
10. **Remember units** - Nanoseconds for spans, milliseconds for logs/RUM

---

**Package:** `mcp-remote` + Datadog MCP Server  
**Source:** Official Datadog  
**License:** Apache 2.0  
**Connection:** Remote MCP server with API/App key authentication

## Steering

# Datadog MCP Server Steering Guide

This steering file provides comprehensive guidance for using the Datadog MCP (Model Context Protocol) server to query observability data including logs, metrics, traces, RUM events, incidents, and more.

## When to Use the Datadog MCP Server

Use Datadog MCP tools when you need to:
- **Investigate production issues**: Errors, performance degradation, service outages
- **Analyze application behavior**: User experience, service dependencies, resource utilization
- **Monitor system health**: Infrastructure metrics, service status, host information
- **Track incidents**: Active incidents, incident history, severity analysis
- **Optimize performance**: Slow queries, high latency, resource bottlenecks
- **Analyze costs**: Cloud spending, resource allocation, cost trends
- **Debug specific requests**: Trace analysis, span details, distributed tracing
- **Set up services and instrumentation**: Look up how to configure services for Datadog monitoring, add APM, logs, or RUM instrumentation
- **Look up Datadog platform functionality**: Understand features, integrations, configuration options, and best practices

## Core Principles

### 1. Start Narrow, Expand if Needed
Always begin with narrow time ranges and specific queries, then expand:
- Start: `now-15m` or `now-1h`
- Expand to: `now-24h` or `now-7d` if needed
- Narrower ranges = faster queries and more relevant results

### 2. Use Unified Service Tagging
Always query with these three tags together when available:
- `service`: Application/service name
- `env`: Environment (production, staging, dev)
- `version`: Deployed version (semantic version or git SHA)

### 3. Prefer Structured Queries
Use tag/attribute searches over free-text searches for better performance:
- Good: `service:checkout env:prod status:error`
- Avoid: `"checkout error in production"`

---

## Query Syntax Fundamentals

These concepts apply across most Datadog query types:

### Boolean Operators (Case-Sensitive!)
- **AND** (default): Both conditions must match
  - `service:api status:error` (implicit AND)
  - `service:api AND env:prod` (explicit AND)
- **OR**: Either condition can match
  - `env:(prod OR staging)` ← Preferred for same field
  - `service:api OR service:worker`
- **- (exclusion)**: Exclude matching results
  - `service:api -status:info`
  - `-version:beta`

### Wildcards
- **`*`**: Multi-character wildcard (only works outside quotes)
  - `service:web*` matches `web-api`, `web-worker`
  - `@http.url:/api/*` matches any `/api/` endpoint
- **`?`**: Single-character wildcard
  - `@hostname:web-?` matches `web-1`, `web-2`

### Special Characters and Escaping
Escape these characters: `?`, `>`, `<`, `:`, `=`, `"`, `~`, `/`, `\`
- Use backslash `\` or double quotes:
  - `@message:hello\:world` or `@message:"hello:world"`
  - `@url:https\:\/\/example.com\/api\-v1\/*`

### Numerical Ranges
- Comparison: `<`, `>`, `<=`, `>=`
  - `@http.status_code:>=400`
- Ranges: `[x TO y]`
  - `@http.status_code:[400 TO 499]`

### @ Prefix Rules
- **Use @ prefix**: For log/span attributes (`@http.status_code`, `@user.id`)
- **NO @ prefix**: For reserved trace fields (`service`, `resource_name`, `operation_name`, `status`, `trace_id`, `type`)
- **NO @ prefix**: For tags (`env:prod`, `host:web-1`)

---

## Log Search Query Syntax

### Tags vs Attributes
- **Tags**: Direct format `key:value`
  - Examples: `env:prod`, `service:api`, `host:web-1`
- **Attributes**: Use `@` prefix for log-specific fields
  - Examples: `@http.status_code:500`, `@user.id:123`, `@error.message:"timeout"`

### Common Examples
```
# Error logs from production API service
service:api env:prod status:error

# 4xx or 5xx HTTP errors
@http.status_code:[400 TO 599]

# Database queries taking over 1 second
service:database @duration:>1000

# Specific user's session
@user.id:abc123

# All logs except health checks
service:api -@url:/health

# Search across multiple services
(service:api OR service:worker) AND status:error

# URL pattern matching
@http.url:/api/v*/users/*
```

### Best Practices for Logs
- Use `status:error` to find errors quickly
- Filter by `service` first to narrow scope
- Use `group_by_message: true` to reduce duplicate log entries
- Set `max_tokens` appropriately (5000-10000 for overview, 20000-50000 for details)
- Specify `extra_fields` array for custom attributes (use wildcards like `experiments*`)

---

## Metrics Query Syntax

Use `get_datadog_metric` with metric query strings:

### Basic Structure
```
<AGGREGATOR>:<METRIC_NAME>{<SCOPE>} by {<GROUPING_TAGS>}
```

### Space Aggregators
Combine multiple timeseries into one:
- **avg**: Average across all series
- **sum**: Sum all series
- **min**: Minimum value
- **max**: Maximum value
- **count**: Count of datapoints

### Scope (Filter)
Filter which hosts/services to include:
- `{*}` - All sources
- `{env:prod}` - Specific tag
- `{env:prod,service:api}` - Multiple tags (AND logic)
- `{host:web-1}` - Specific host

### Grouping
Split metrics by tag values using `by {tag1,tag2}`:
```
avg:system.cpu.user{env:prod} by {host}
```
Returns separate series for each host in production.

### Rollup (Time Aggregation)
Control how datapoints are aggregated over time:
```
.rollup(<AGGREGATOR>, <INTERVAL_SECONDS>)
```

Aggregators: `avg`, `sum`, `min`, `max`, `count`

Examples:
- `.rollup(avg, 60)` - Average over 1-minute buckets
- `.rollup(sum, 3600)` - Sum over 1-hour buckets
- `.rollup(max, 300)` - Max over 5-minute buckets

### Complete Examples
```
# Average CPU per host in production
avg:system.cpu.user{env:prod} by {host}

# Total requests per service, 5-minute buckets
sum:trace.requests.count{env:prod} by {service}.rollup(sum, 300)

# 95th percentile latency across all services
p95:trace.servlet.request.duration{env:prod}

# Memory usage with hourly averages
avg:system.mem.used{env:prod} by {host}.rollup(avg, 3600)
```

### Output Modes
- **Binned data** (default): 20 statistical buckets with min/max/avg
  - Fast, good for trends and patterns
  - Use for timeframes > 1 hour
- **Raw/CSV data** (`raw_data: true`): Exact datapoint values
  - Use for debugging short-lived issues
  - Best for timeframes < 45 minutes

### Cloud Cost Management
Set `use_cloud_cost: true` for cost queries:
```
# Daily costs by provider
sum:all.cost{*} by {providername}.rollup(sum, daily)

# Monthly total costs
sum:all.cost{*}.rollup(sum, monthly)

# AWS costs for specific resource
sum:aws.cost.net.amortized.shared.resources.allocated{aws_resource_id:xyz}.rollup(sum, daily)
```

### Best Practices for Metrics
- Use appropriate aggregators (avg for gauges, sum for counters)
- Apply rollup for longer time ranges to reduce data points
- Use `by {tag}` to identify specific problematic hosts/services
- Use binned data for trends, raw data for debugging

---

## APM/Trace Query Syntax

Use `search_datadog_spans` for distributed trace analysis:

### Reserved Attributes (NO @ prefix)
- `service` - Service name
- `resource_name` - Resource path/operation
- `operation_name` - Span operation type
- `status` - Span status (ok, error)
- `trace_id` - Specific trace ID
- `type` - Span type (web, db, cache, custom)

### Span Attributes (@ prefix required)
- `@http.status_code` - HTTP status
- `@http.method` - HTTP method (GET, POST, etc.)
- `@http.url` - Request URL
- `@error.message` - Error message
- `@error.type` - Error type/class
- `@duration` - Span duration in **nanoseconds**
- Custom attributes: `@user.id`, `@order.total`, etc.

### Duration Queries (Nanoseconds!)
Critical: Duration is in nanoseconds, not milliseconds!
- 1ms = 1,000,000 nanoseconds
- 5ms = 5,000,000 nanoseconds
- 100ms = 100,000,000 nanoseconds

Examples:
```
# Spans taking more than 5ms
@duration:>5000000

# Spans between 1ms and 10ms
@duration:[1000000 TO 10000000]

# Very slow database queries (>1 second)
operation_name:db.query @duration:>1000000000
```

### Complete Examples
```
# All errors in checkout service
service:checkout status:error

# Slow API requests
service:api resource_name:/api/* @duration:>100000000

# Database queries with errors
operation_name:db.query status:error

# HTTP 5xx errors
service:web @http.status_code:[500 TO 599]

# Multiple span types
type:(http OR rpc OR db)

# Exclude health checks
service:api -resource_name:/health

# Specific error type
@error.type:"TimeoutException"
```

### Retrieving Full Traces
Use `get_datadog_trace` with a specific `trace_id`:
```
trace_id: "7d5d747be160e280504c099d984bcfe0"
```
Returns all spans in the trace with detailed timing and relationships.

### Best Practices for APM
- Filter by `service` first to scope your search
- Use `@duration` for performance investigations (remember nanoseconds!)
- Combine `service` and `resource_name` to target specific endpoints
- Use `custom_attributes` parameter with wildcards for custom span tags
- Find trace IDs from spans, then use `get_datadog_trace` for full details

---

## RUM Event Query Syntax

Use `search_datadog_rum_events` for Real User Monitoring data:

### Event Types
Filter by `@type`:
- `@type:view` - Page views
- `@type:action` - User interactions (clicks, taps)
- `@type:error` - Frontend errors
- `@type:resource` - Resource loading (JS, CSS, images)
- `@type:long_task` - Long-running tasks (>50ms)
- `@type:vital` - Core Web Vitals

### Common Attributes
- `@application.name` - RUM application name
- `@view.url_path` - Page URL path
- `@view.loading_time` - Page load duration
- `@session.type` - Session type (user, synthetics)
- `@device.type` - Device type (mobile, tablet, desktop)
- `@browser.name` - Browser (Chrome, Firefox, Safari)
- `@user.id` - User identifier
- `@error.message` - Error message
- `@error.source` - Error origin (network, source, custom)
- `@geo.country` - User country

### Performance Metrics
Use ranges for performance analysis:
```
# Slow page loads (>3 seconds)
@type:view @view.loading_time:>3000

# Loading time between 1-3 seconds
@view.loading_time:[1000 TO 3000]

# Large Contentful Paint (Core Web Vital)
@type:vital @view.largest_contentful_paint:>2500
```

### Complete Examples
```
# Frontend errors for specific user
@type:error @user.id:abc123

# Slow mobile page loads
@type:view @device.type:mobile @view.loading_time:>5000

# Failed resource loads
@type:resource @resource.status_code:[400 TO 599]

# High interaction latency
@type:action @action.loading_time:>1000

# Safari-specific errors
@type:error @browser.name:Safari
```

### Best Practices for RUM
- Use `detailed_output: true` for comprehensive event data
- Set higher `max_tokens` (50000+) for detailed analysis
- Filter by `@application.name` and `env` first
- Use wildcards in `@view.url_path` to match patterns

---

## Incident Search Query Syntax

Use `search_datadog_incidents` to find and track incidents:

### Search Fields
- `state` - Incident state
  - Values: `active`, `stable`, `resolved`
- `severity` - Incident severity
  - Values: `SEV-1`, `SEV-2`, `SEV-3`, `SEV-4`, `SEV-5`
- `customer_impacted` - Customer impact flag
  - Values: `true`, `false`
- `title` - Incident title (supports partial matches)
- `team` - Team responsible

### Boolean Logic
Supports **AND**, **OR**, and field-grouped OR syntax:
```
# Standard AND
state:active AND severity:SEV-1

# Standard OR
state:active OR state:stable

# Field-grouped OR (REQUIRED for same field!)
severity:(SEV-1 OR SEV-2 OR SEV-3)

# Combined
state:active AND severity:(SEV-1 OR SEV-2)
```

**Important**: When querying multiple values of the same field, you MUST group them:
- ✅ Correct: `severity:(SEV-1 OR SEV-2)`
- ❌ Wrong: `severity:SEV-1 OR severity:SEV-2`

### Time Filtering
Use `from` and `to` parameters to filter by incident creation time:
```
from: "now-7d"
to: "now"
query: "state:(active OR stable)"
```

### Common Examples
```
# Default query (recommended starting point)
state:active

# All active incidents
state:(active OR stable)

# High-severity incidents
severity:(SEV-1 OR SEV-2) AND state:active

# Customer-impacting incidents
customer_impacted:true AND state:active

# Resolved incidents in last 7 days
state:resolved
from: now-7d
```

### Best Practices for Incidents
- Default query is `state:active` - use this for current issues
- For ongoing work, use `state:(active OR stable)` to include post-mitigation
- Always group multiple values of same field together

---

## Monitor Search Query Syntax

Use `search_datadog_monitors` to find alerting rules:

### Search Fields
- `id` - Monitor ID: `id:167097893`
- `title` - Monitor name: `title:my-monitor`
- `status` - Alert status: `status:alert`, `status:warn`, `status:ok`
- `muted` - Mute status: `muted:true`, `muted:false`
- `tag` - Monitor tags: `tag:"monitor_gate:true"`
- `env` - Environment: `env:prod`
- `team` - Team: `team:backend`
- `priority` - Priority: `priority:p1`, `priority:p2`, etc.
- `notification` - Notification target: `notification:slack-logs-team-ops`
- `type` - Monitor type: `type:metric`, `type:log`, `type:apm`

### Boolean Logic
Supports **AND**, **OR**, and parentheses:
```
# Multiple conditions
status:alert muted:false

# OR logic
priority:p1 OR priority:p2

# Complex queries
priority:p2 AND (title:api OR title:database)
```

### Complete Examples
```
# All alerting monitors
status:alert

# Unmuted alerts in production
status:alert muted:false env:prod

# High-priority monitors
priority:(p1 OR p2)

# Specific notification channel
notification:slack-alerts

# Service-specific monitors
tag:"service:api"
```

### Best Practices for Monitors
- Start with `status:alert` to find active alerts
- Filter by `env` to scope to specific environment
- Use `muted:false` to exclude silenced alerts

---

## Common Tags Reference

### Unified Service Tags (Always Use Together)
These three tags correlate data across all Datadog products:
- **service** - Application/service name
  - Examples: `checkout-api`, `user-service`, `payment-worker`
- **env** - Environment
  - Examples: `production`, `staging`, `development`, `qa`
- **version** - Deployed version
  - Examples: `v1.2.3`, `abc123` (git SHA), `2024-01-15`

### Infrastructure Tags
- **host** - Host/instance name
- **availability-zone** - AWS/cloud AZ
- **region** - Cloud region
- **instance-type** - Instance size/type

### Application Tags
- **team** - Owning team
- **source** - Technology source (logs)
  - Examples: `nginx`, `postgres`, `redis`, `python`
- **status** - Status level
  - Log values: `info`, `warn`, `error`, `debug`
  - Span values: `ok`, `error`

### Tag Usage in Queries
```
# Single value
env:production

# Multiple values (OR)
env:(production OR staging)

# Wildcards
service:web*

# Exclusion
-env:development

# Multiple tags (AND)
service:api env:prod team:backend
```

---

## Time Range Best Practices

### Supported Formats
1. **Relative time** (recommended):
   - `now-15m`, `now-1h`, `now-24h`, `now-7d`
   - Units: `m` (minutes), `h` (hours), `d` (days), `w` (weeks), `mo` (months)
2. **ISO 8601**: `2023-01-01T00:00:00Z`
3. **Unix timestamp** (milliseconds): `1672531200000`

### Recommended Workflow
Start narrow and expand based on findings:

1. **Recent issues** (start here):
   ```
   from: "now-15m"  or  "now-1h"
   to: "now"
   ```

2. **Past day** (if nothing found):
   ```
   from: "now-24h"
   to: "now"
   ```

3. **Historical analysis**:
   ```
   from: "now-7d"
   to: "now"
   ```

### Tool-Specific Defaults
- **Logs**: Default `now-1h`
- **RUM**: Default `now-15m`
- **Spans**: Default `now-1h`
- **Incidents**: No default time filter (shows all)

---

## Common Use Cases

### 1. Investigating Production Errors
```
# Step 1: Search logs for errors in last hour
Tool: search_datadog_logs
Query: service:api env:prod status:error
Time: from="now-1h", to="now"

# Step 2: If errors found, get error details
Enable: extra_fields=["*"]  # Get all attributes
Check: Error messages, stack traces, affected users

# Step 3: Find related traces
Tool: search_datadog_spans
Query: service:api status:error
Time: Same as log time range

# Step 4: Get full trace for detailed analysis
Tool: get_datadog_trace
trace_id: <from span search>
```

### 2. Performance Degradation Analysis
```
# Step 1: Check for slow requests
Tool: search_datadog_spans
Query: service:api @duration:>100000000  # >100ms
Time: from="now-1h", to="now"

# Step 2: Examine metrics for patterns
Tool: get_datadog_metric
Query: avg:trace.servlet.request.duration{service:api} by {resource_name}
Time: from="now-4h", to="now"

# Step 3: Check for infrastructure issues
Tool: get_datadog_metric
Query: avg:system.cpu.user{service:api} by {host}
Time: Same range

# Step 4: Review related monitors
Tool: search_datadog_monitors
Query: tag:"service:api" status:alert
```

### 3. User Experience Issues (RUM)
```
# Step 1: Find slow page loads
Tool: search_datadog_rum_events
Query: @type:view @view.loading_time:>3000
detailed_output: true
Time: from="now-1h", to="now"

# Step 2: Check for frontend errors
Tool: search_datadog_rum_events
Query: @type:error @application.name:"My App"
Time: Same range

# Step 3: Analyze by device/browser
Query: @type:view @view.loading_time:>3000
Group findings by @device.type and @browser.name
```

### 4. Incident Investigation
```
# Step 1: Find active incidents
Tool: search_datadog_incidents
Query: state:(active OR stable)

# Step 2: Get incident details
Tool: get_datadog_incident
incident_id: <from search results>

# Step 3: Check related metrics/logs
Use incident time range to query logs and metrics
Filter by affected services/hosts from incident
```

### 5. Service Dependency Analysis
```
# Step 1: List all services
Tool: search_datadog_services
detailed_output: true

# Step 2: Find traces spanning multiple services
Tool: search_datadog_spans
Query: service:frontend
Check spans for downstream service calls

# Step 3: Analyze service-to-service latency
Tool: get_datadog_metric
Query: avg:trace.servlet.request.duration{env:prod} by {service}
```

---

## Anti-Patterns and Common Mistakes

### ❌ DON'T: Use Very Long Time Ranges Without Reason
```
# Slow and often not helpful
from: "now-30d"
```
**Instead**: Start with `now-1h` or `now-24h`, expand if needed.

### ❌ DON'T: Forget @ Prefix for Span/Log Attributes
```
# Wrong
http.status_code:500

# Correct
@http.status_code:500
```

### ❌ DON'T: Use @ Prefix for Reserved Trace Attributes
```
# Wrong
@service:api

# Correct
service:api
```

### ❌ DON'T: Forget Duration is in Nanoseconds
```
# Wrong (this is 5 nanoseconds!)
@duration:>5

# Correct (5 milliseconds)
@duration:>5000000
```

### ❌ DON'T: Use Wildcards Inside Quotes
```
# Wrong (wildcard becomes literal)
@url:"*/api/*"

# Correct
@url:*/api/*
```

### ❌ DON'T: Separate Multi-Value OR Queries
```
# Wrong for incidents
severity:SEV-1 OR severity:SEV-2

# Correct
severity:(SEV-1 OR SEV-2)
```

### ❌ DON'T: Use Excessive Free-Text Searches
```
# Slow and imprecise
"timeout error in production"

# Better - use structured tags
service:api env:prod @error.message:*timeout*
```

### ❌ DON'T: Ignore Unified Service Tagging
```
# Missing critical context
status:error

# Much better
service:api env:prod version:v1.2.3 status:error
```

### ❌ DON'T: Skip Escaping Special Characters
```
# Wrong (colon breaks parsing)
@url:https://example.com

# Correct
@url:https\:\/\/example.com
```

---

## Performance Tips

### 1. Query Optimization
- **Filter first**: Use `service`, `env` before complex conditions
- **Use facets**: Ensure frequently queried attributes are facets
- **Limit wildcards**: Avoid leading wildcards when possible
- **Use tag searches**: More efficient than free-text

### 2. Result Size Management
- **max_tokens**: Adjust based on needs (5000 for overview, 50000 for details)
- **head_limit**: Limit result count for faster responses
- **group_by_message**: For logs, group similar messages to reduce output
- **Binned metrics**: Use binned data for trends instead of raw

### 3. Time Range Strategy
```
# Good progression
1. now-15m → Quick check for recent issues
2. now-1h → Standard investigation window
3. now-24h → Broader pattern analysis
4. now-7d → Historical trends only when needed
```

### 4. Parallel Investigations
When investigating incidents, query multiple sources in parallel:
- Logs for error messages
- Spans for trace analysis
- Metrics for resource utilization
- Monitors for alert status

---

## Additional Resources

### Documentation Tool
Use `search_datadog_docs` to look up information about instrumentation, setup, and platform functionality:
- **Service instrumentation**: How to add APM tracing, log collection, or RUM to your applications
- **Integration setup**: How to configure cloud providers, databases, or third-party services
- **Platform features**: How to use monitors, dashboards, SLOs, synthetic tests, etc.
- **Configuration options**: How to use APIs, agent settings, tagging strategies
- **Best practices**: Recommended approaches for monitoring and observability

### Dashboard Analysis
Use `search_datadog_dashboards` to:
- Find existing dashboards by name or tags
- Extract metric queries from dashboards
- Discover team-maintained visualizations
- Set `max_queries_per_dashboard` to see widget queries

---

## Summary Checklist

Before making Datadog queries, ensure you:
- ✅ Start with narrow time ranges (15m-1h)
- ✅ Include unified service tags (service, env, version)
- ✅ Use appropriate tool for the data type
- ✅ Apply @ prefix correctly (attributes yes, reserved fields no)
- ✅ Escape special characters in queries
- ✅ Use grouped OR syntax for multiple values of same field
- ✅ Consider duration is in nanoseconds for APM
- ✅ Set appropriate max_tokens for expected result size
- ✅ Use structured tag queries instead of free-text when possible

This steering file represents the essential knowledge for effectively querying Datadog observability data through the MCP server. Follow these patterns for accurate, performant, and actionable results.
