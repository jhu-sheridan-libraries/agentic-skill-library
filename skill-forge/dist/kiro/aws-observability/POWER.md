---
name: aws-observability
displayName: AWS Observability
description: Comprehensive AWS observability platform combining CloudWatch Logs, Metrics, Alarms, Application Signals (APM), CloudTrail security auditing, and automated codebase observability gap analysis, for complete monitoring, troubleshooting, and optimization.
keywords: ["cloudwatch","observability","monitoring","logs","metrics","traces","alarms","apm","application signals","opentelemetry","x-ray","latency","error rate","troubleshooting","root cause","log analysis","cloudtrail","synthetic monitoring","service map"]
author: AWS
---
<!-- forge:version 0.1.0 -->

# ⚠️ CRITICAL: ALWAYS LOAD STEERING FILES FIRST

**BEFORE using ANY tools, you MUST:**

1. **Identify the user's scenario** from their request
2. **Load the appropriate steering file** using `kiroPowers` action with `readSteering`
3. **Follow the steering file's workflow** before making tool calls

## Scenario Detection & Steering File Selection

### 🚨 Incident Response & Troubleshooting → `incident-response.md`

**Load when user mentions:**
- Service health: "unhealthy", "down", "broken", "failing", "degraded", "not working"
- Investigation: "investigate", "troubleshoot", "debug", "what's wrong", "help me check", "root cause"
- Performance: "slow", "timeout", "errors", "high latency", "issues", "performance problems"
- Incidents: "outage", "incident", "production issue", "emergency", "sev1", "sev2"
- Vague concerns: "something's wrong", "having problems", "seems off"

### 📊 Log Analysis → `log-analysis.md`

**Load when user mentions:**
- "query logs", "search logs", "find in logs", "show me logs"
- "log patterns", "parse logs", "filter logs", "extract from logs"
- "aggregate logs", "log statistics", "count errors"

### 🔔 Alerting Setup → `alerting-setup.md`

**Load when user mentions:**
- "set up monitoring", "create alarms", "configure alerts"
- "improve alarms", "reduce false positives", "alarm fatigue"

### � Performance Monitoring → `performance-monitoring.md`

**Load when user mentions:**
- "monitor performance", "check service health", "service metrics"
- "distributed traces", "trace analysis", "X-Ray"
- "SLOs", "Service Level Objectives", "error rates", "latency"

### � Security Auditing → `security-auditing.md`

**Load when user mentions:**
- "security audit", "compliance", "CloudTrail"
- "who did what", "track changes", "API activity"
- "IAM changes", "unauthorized access"

### 🔍 Observability Gaps → `observability-gap-analysis.md`

**Load when user mentions:**
- "audit codebase", "check instrumentation", "observability gaps"
- "missing logs", "improve observability"

### ⚙️ Application Signals Setup → `application-signals-setup.md`

**Load when user mentions:**
- "enable Application Signals", "set up monitoring", "instrument service"
- "auto-instrumentation", "getting started"

---

# Onboarding

## Prerequisites

1. **AWS CLI configured** with credentials (`aws configure` or `~/.aws/credentials`)
2. **Python 3.10+** and `uv` installed ([Install uv](https://docs.astral.sh/uv/getting-started/installation/))
3. **Application Signals enabled** in your AWS account whenever applicable ([Getting started with Application Signals](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Application-Monitoring-Intro.html))
4. **Required AWS Permissions**: Your IAM user/role needs:
   - `cloudwatch:*` for CloudWatch Metrics and Alarms
   - `logs:*` for CloudWatch Logs operations (includes CloudTrail log querying)
   - `xray:*` for distributed tracing
   - `cloudtrail:*` for CloudTrail queries
   - `application-signals:*` for Application Signals
   - `synthetics:GetCanary`, `synthetics:GetCanaryRuns` for canary analysis
   - `s3:GetObject`, `s3:ListBucket` for canary artifacts
   - `iam:GetRole`, `iam:ListAttachedRolePolicies`, `iam:GetPolicy`, `iam:GetPolicyVersion` for the enablement guide

## Configuration

After installing this power, update the MCP server configuration with your AWS profile and region:

1. Open Kiro Settings → MCP Servers (or edit `~/.kiro/settings/mcp.json`)
2. Find the `awslabs.cloudwatch-mcp-server` entry
3. Update the `env` section:

```json
"env": {
  "AWS_PROFILE": "your-profile-name",  // ← Change to your AWS profile
  "AWS_REGION": "us-east-1",           // ← Change to your region
  "FASTMCP_LOG_LEVEL": "ERROR"
}
```

**Default:** Uses `default` AWS profile and `us-east-1` region.

## Quick Test

After configuration, try: *"Show me my CloudWatch log groups"*

---

# Overview

The comprehensive AWS observability platform combining monitoring, troubleshooting, security, and optimization tools in one power.

**Key capabilities:**
- **CloudWatch Logs** - Query and analyze logs using CloudWatch Logs Insights
- **Metrics & Alarms** - Metric querying with Metrics Insights and intelligent alarm recommendations
- **Application Signals** - APM with distributed tracing, service maps, SLOs, and enablement guides
- **Codebase Observability Analysis** - Automated analysis of codebases to identify observability gaps
- **CloudTrail Integration** - Security auditing and compliance tracking
- **AWS Documentation** - Direct access to official AWS docs for troubleshooting

**Authentication**: Requires AWS credentials (AWS CLI profile or IAM role).

## Core Capabilities

### 1. CloudWatch Logs

**Primary Use Case**: Query and analyze logs using CloudWatch Logs Insights

**Key Features**:
- CloudWatch Logs Insights query syntax for log analysis
- Multi-log-group queries across up to 50 log groups
- JSON field extraction with parse and filter commands
- Statistical functions and aggregations
- Pattern detection and anomaly analysis
- Log group discovery and metadata
- Saved queries support

**When to Use**:
- Searching and filtering log data across services
- Aggregations and statistical analysis
- Querying multiple log groups simultaneously
- Extracting structured data from JSON logs
- Troubleshooting distributed application issues

### 2. CloudWatch Metrics & Alarms

**Primary Use Case**: Monitor resource performance and set up intelligent alerting

**Key Features**:
- Retrieve metric data with multiple statistics (Average, Sum, Min, Max, percentiles)
- Metrics Insights for advanced filtering and grouping
- Analyze metric trends, seasonality, and anomalies
- Get recommended alarm configurations based on AWS best practices
- View active alarms and alarm history
- Support for custom metrics and composite alarms

**When to Use**:
- Monitoring EC2, Lambda, RDS, and other AWS service metrics
- Setting up performance baselines and thresholds
- Creating intelligent alarms with recommended configurations
- Investigating active alarms and reviewing alarm history
- Analyzing metric trends and detecting anomalies
- Troubleshooting performance degradation

### 3. Application Signals (APM)

**Primary Use Case**: Application performance monitoring with distributed tracing

**Key Features**:
- Service-level metrics and SLOs
- Distributed tracing with AWS X-Ray integration
- Service maps showing dependencies and call paths
- Error rate and latency tracking (P50, P90, P95, P99)
- Automatic service discovery
- SLO compliance monitoring and error budget tracking
- Enablement guide for setup assistance
- Primary audit tools (`audit_services`, `audit_slos`, `audit_service_operations`) as recommended entry points for all investigation workflows, with wildcard targeting and 7 auditor types (`slo`, `operation_metric`, `trace`, `log`, `dependency_metric`, `top_contributor`, `service_quota`)
- 100% Trace Visibility via `search_transaction_spans` querying OpenTelemetry spans through CloudWatch Logs Insights (vs X-Ray's 5% sampling)
- Canary Failure Analysis via `analyze_canary_failures` for root cause investigation of CloudWatch Synthetics canaries

**When to Use**:
- Monitoring microservices health and performance
- Troubleshooting latency and error rate issues
- Understanding service dependencies and bottlenecks
- Setting up and tracking SLOs
- Root cause analysis for distributed systems
- Getting started with Application Signals setup

### 4. CloudTrail Security Auditing

**Primary Use Case**: Security auditing, compliance, and governance

**Data Source Priority**: CloudTrail data is accessed through multiple sources in priority order:
1. **CloudTrail Lake** (Priority 1) - SQL-based querying with 7-year retention
2. **CloudWatch Logs** (Priority 2) - Real-time analysis with CloudWatch integration
3. **Lookup Events API** (Priority 3) - Fallback for basic queries (90-day limit)

See `cloudtrail-data-source-selection.md` steering file for detailed decision tree.

**Key Features**:
- API call history and analysis
- User activity tracking across AWS accounts
- Resource change tracking and audit trails
- IAM permission change monitoring
- Compliance reporting and security investigations
- Multiple data source options for flexibility

**When to Use**:
- Investigating security incidents
- Tracking resource modifications and deletions
- Compliance auditing and reporting
- Understanding who did what and when
- Detecting unauthorized access attempts
- Root cause analysis for configuration changes

### 5. Codebase Observability Analysis

**Primary Use Case**: Automated analysis of application codebases to identify observability gaps

**Key Features**:
- Multi-language support (Python, Java, JavaScript/TypeScript, Go, Ruby, C#/.NET)
- Logging pattern analysis and gap identification
- Metrics instrumentation assessment
- Distributed tracing coverage evaluation
- Error handling review
- Health check and readiness probe validation
- Actionable recommendations with code examples
- Prioritized gap reports by severity

**When to Use**:
- Auditing existing applications for observability best practices
- Onboarding new services to observability standards
- Improving debugging and troubleshooting capabilities
- Preparing for production deployments
- Establishing observability baselines
- Training teams on observability patterns

### 6. AWS Documentation Access

**Primary Use Case**: Quick access to official AWS documentation

**Key Features**:
- Search AWS documentation directly
- Read documentation pages in markdown format
- Get content recommendations for related topics
- Access service-specific guides and API references

**When to Use**:
- Looking up AWS service documentation
- Understanding API parameters and behavior
- Finding best practices and tutorials
- Troubleshooting with official guidance

## Available Steering Files

The following steering files provide detailed workflows for each scenario. **Always load the appropriate file first** using the decision tree at the top of this document.

### 1. `incident-response.md`
Comprehensive incident response framework with multi-tool correlation strategies.

### 2. `log-analysis.md`
CloudWatch Logs Insights query patterns and log analysis techniques.

### 3. `alerting-setup.md`
Intelligent alarm configuration and notification strategies.

### 4. `performance-monitoring.md`
Application Signals APM workflows and performance optimization.

### 5. `security-auditing.md`
CloudTrail security analysis and compliance auditing.

### 6. `observability-gap-analysis.md`
Codebase instrumentation assessment and recommendations.

### 7. `application-signals-setup.md`
Step-by-step Application Signals enablement guide.

### 8. `cloudtrail-data-source-selection.md`
CloudTrail data source priority logic (referenced by security-auditing.md).

## Quick Start Examples

### Example 1: Investigate High Error Rate

```
1. Load incident-response.md steering file
2. Follow the structured workflow:
   - Check active alarms for service health
   - Query CloudWatch Logs for error patterns
   - Review CloudTrail for recent changes
   - Analyze traces for root cause
   - Check AWS Documentation for error codes
```

### Example 2: Performance Optimization

```
1. Load performance-monitoring.md steering file
2. Follow the workflow:
   - Analyze CloudWatch Metrics
   - Query Application Signals for P95/P99 latency
   - Examine logs for patterns
```

### Example 3: Security Audit

```
1. Load security-auditing.md steering file
2. Follow the workflow:
   - Query CloudTrail events
   - Correlate with CloudWatch Logs
   - Check Application Signals for unusual patterns
   - Document findings with AWS documentation
```

### Example 4: Codebase Observability Gap Audit

```
1. Load observability-gap-analysis.md steering file
2. Follow the workflow:
   - Analyze codebase structure
   - Assess logging coverage
   - Evaluate metrics instrumentation
   - Review distributed tracing
   - Generate actionable report
```

## Available MCP Servers

### awslabs.cloudwatch-mcp-server
CloudWatch Logs querying, Metrics, Alarms, and log group analysis.

### awslabs.cloudwatch-applicationsignals-mcp-server
Application Signals APM with service health, SLOs, and distributed tracing.

### awslabs.cloudtrail-mcp-server
CloudTrail security auditing and API activity tracking.

### awslabs.aws-documentation-mcp-server
Search and read official AWS documentation.

## License
This power integrates with CloudWatch MCP Server, CloudWatch Application Signals MCP Server, CloudTrail MCP Server, and AWS Documentation MCP Server from [AWS Labs](https://github.com/awslabs/mcp) (Apache-2.0 license). All steering files and power configuration are licensed under Apache-2.0.

---

**Source:** AWS Labs
**License:** Apache 2.0
**Documentation:** https://github.com/awslabs/mcp

## Alerting Setup

# Intelligent Alerting Setup

## Purpose
This steering file provides guidance for setting up effective CloudWatch alarms using recommended configurations and best practices.

## Core Concepts

### Alarm States
- **OK**: Metric is within acceptable threshold
- **ALARM**: Metric has breached threshold
- **INSUFFICIENT_DATA**: Not enough data to evaluate

### Alarm Components
- **Metric**: What to monitor (CPU, errors, latency, etc.)
- **Statistic**: How to aggregate (Average, Sum, Maximum, percentiles)
- **Threshold**: Value that triggers alarm
- **Evaluation Period**: How long to evaluate
- **Datapoints to Alarm**: How many periods must breach

### Alarm Types
- **Metric Alarm**: Based on single CloudWatch metric
- **Composite Alarm**: Combines multiple alarms with logic (AND, OR, NOT)
- **Anomaly Detection Alarm**: Uses ML to detect unusual patterns

## Getting Recommended Alarm Configurations

### Using get_recommended_metric_alarms

The power includes intelligent alarm recommendations based on AWS best practices:

```
Tool: get_recommended_metric_alarms

Parameters:
  - namespace: AWS service namespace (e.g., "AWS/Lambda")
  - metric_name: Metric to monitor (e.g., "Errors")
  - dimensions: Resource identifiers
  - statistic: Appropriate statistic for metric type

Returns:
  - Recommended threshold values
  - Evaluation periods
  - Datapoints to alarm
  - Alarm description
  - Rationale for recommendations
```

### Choosing the Right Statistic

**Critical Rule**: The statistic must match the metric type:

**Count Metrics** (use `Sum`):
- Errors, Faults, Throttles
- Invocations, RequestCount
- CacheHits, CacheMisses
- Connections, EventsProcessed

**Utilization Metrics** (use `Average`):
- CPUUtilization, MemoryUtilization
- DiskUtilization, NetworkUtilization
- DatabaseConnections (as percentage)

**Latency/Time Metrics** (use `Average` or percentiles):
- Duration, Latency, ResponseTime
- ProcessingTime, ExecutionTime
- Delay, WaitTime

**Size Metrics** (use `Average`):
- PayloadSize, MessageSize
- RequestSize, BodySize

## Alarm Configuration Patterns

### Pattern 1: Lambda Function Errors

**Recommended Configuration**:
```
Metric: AWS/Lambda - Errors
Statistic: Sum
Threshold: > 5 errors
Evaluation Period: 5 minutes
Datapoints to Alarm: 2 out of 3
Treat Missing Data: notBreaching

Rationale:
- Sum is correct for count metrics
- 5 errors allows for occasional failures
- 2 out of 3 reduces false positives
- 5-minute periods balance responsiveness and stability
```

**Example**:
```
get_recommended_metric_alarms(
  namespace="AWS/Lambda",
  metric_name="Errors",
  dimensions=[{name: "FunctionName", value: "my-function"}],
  statistic="Sum"
)
```

### Pattern 2: EC2 CPU Utilization

**Recommended Configuration**:
```
Metric: AWS/EC2 - CPUUtilization
Statistic: Average
Threshold: > 80%
Evaluation Period: 5 minutes
Datapoints to Alarm: 3 out of 3
Treat Missing Data: notBreaching

Rationale:
- Average smooths out spikes
- 80% allows for burst capacity
- 3 out of 3 ensures sustained high CPU
- Prevents alarms during brief spikes
```

### Pattern 3: API Gateway Latency

**Recommended Configuration**:
```
Metric: AWS/ApiGateway - Latency
Statistic: p99 (99th percentile)
Threshold: > 1000ms
Evaluation Period: 5 minutes
Datapoints to Alarm: 2 out of 3
Treat Missing Data: notBreaching

Rationale:
- p99 catches tail latency issues
- 1000ms threshold for user experience
- 2 out of 3 balances sensitivity
- Focuses on worst-case performance
```

### Pattern 4: RDS Database Connections

**Recommended Configuration**:
```
Metric: AWS/RDS - DatabaseConnections
Statistic: Average
Threshold: > 80% of max_connections
Evaluation Period: 5 minutes
Datapoints to Alarm: 3 out of 3
Treat Missing Data: notBreaching

Rationale:
- Average shows sustained connection usage
- 80% threshold provides buffer
- 3 out of 3 ensures real issue
- Prevents connection pool exhaustion
```

### Pattern 5: DynamoDB Throttles

**Recommended Configuration**:
```
Metric: AWS/DynamoDB - UserErrors
Statistic: Sum
Threshold: > 10 errors
Evaluation Period: 1 minute
Datapoints to Alarm: 2 out of 2
Treat Missing Data: notBreaching

Rationale:
- Sum is correct for error counts
- 10 errors indicates capacity issue
- 1-minute periods for quick detection
- 2 out of 2 confirms sustained throttling
```

## Composite Alarms

### Use Cases for Composite Alarms

**Scenario 1: Service Health**
Combine multiple metrics to determine overall service health:

```
Composite Alarm: "api-service-unhealthy"

Logic: (high-error-rate OR high-latency) AND low-success-rate

Component Alarms:
  - high-error-rate: Errors > 5%
  - high-latency: p99 Latency > 2000ms
  - low-success-rate: Success rate < 95%

Rationale: Service is unhealthy if errors OR latency are high AND success rate is low
```

**Scenario 2: Dependency Failure**
Detect when a service and its dependencies are failing:

```
Composite Alarm: "service-and-dependency-down"

Logic: service-errors AND (database-errors OR cache-errors)

Component Alarms:
  - service-errors: Lambda Errors > 10
  - database-errors: RDS CPUUtilization > 90%
  - cache-errors: ElastiCache Evictions > 1000

Rationale: Service errors combined with dependency issues indicate cascading failure
```

## Anomaly Detection Alarms

### When to Use Anomaly Detection

**Good Use Cases**:
- Metrics with predictable patterns (daily, weekly cycles)
- Metrics where absolute thresholds are hard to define
- Detecting unusual behavior vs normal patterns

**Example: Request Count Anomaly**:
```
Metric: AWS/ApiGateway - Count
Anomaly Detection: Enabled
Threshold: 2 standard deviations
Evaluation Period: 10 minutes

Rationale:
- Request patterns vary by time of day
- Anomaly detection learns normal patterns
- 2 std dev catches significant deviations
- Adapts to traffic growth over time
```

## Alarm Best Practices

### 1. Alarm Naming Convention

Use descriptive, consistent names:
```
Format: [severity]-[service]-[metric]-[condition]

Examples:
- critical-api-error-rate-high
- warning-lambda-duration-p99-high
- info-rds-connections-approaching-limit
```

### 2. Alarm Descriptions

Include actionable information:
```
Description Template:
"[Service] [Metric] is [Condition]. 
Current value: {{value}} {{unit}}
Threshold: {{threshold}} {{unit}}
Runbook: [link to runbook]
Dashboard: [link to dashboard]"

Example:
"API Gateway error rate is above 5%.
Current value: 8.2%
Threshold: 5%
Runbook: https://wiki.company.com/runbooks/api-errors
Dashboard: https://console.aws.amazon.com/cloudwatch/dashboards/api-health"
```

### 3. Alarm Actions

Configure appropriate actions for each severity:

**Critical Alarms**:
- Page on-call engineer (PagerDuty, Opsgenie)
- Post to critical alerts channel (Slack, Teams)
- Create high-priority ticket

**Warning Alarms**:
- Post to team channel
- Create normal-priority ticket
- Email team distribution list

**Info Alarms**:
- Log to monitoring system
- Email individual owner
- No immediate action required

### 4. Treat Missing Data

Choose appropriate behavior:

- **notBreaching**: Use for most alarms (default)
- **breaching**: Use when missing data indicates problem
- **ignore**: Use when data is expected to be sparse
- **missing**: Treat as INSUFFICIENT_DATA

### 5. Evaluation Periods

Balance responsiveness vs stability:

**Fast Detection** (1-2 minutes):
- Critical services
- User-facing errors
- Security events

**Balanced** (5 minutes):
- Most application metrics
- Resource utilization
- Performance metrics

**Slow Detection** (10-15 minutes):
- Cost metrics
- Capacity planning
- Trend analysis

## SLO-Based Alerting

### Integrating with Application Signals SLOs

**Approach**: Use SLO error budget consumption for alerting

**Example: Availability SLO**:
```
SLO: 99.9% availability (30-day window)
Error Budget: 0.1% = 43.2 minutes downtime/month

Alerts:
1. Warning: 50% error budget consumed (21.6 min)
2. Critical: 80% error budget consumed (34.6 min)
3. Emergency: 100% error budget consumed (43.2 min)

Actions:
- Warning: Notify team, review recent changes
- Critical: Page on-call, implement feature freeze
- Emergency: All hands, immediate mitigation
```

**Implementation**:
```
1. Set up SLO in Application Signals
2. Create CloudWatch alarm on error budget metric
3. Configure multi-level thresholds
4. Link to incident response procedures
```

## Alarm Tuning and Maintenance

### Reducing False Positives

**Symptoms**:
- Alarms trigger frequently but no real issue
- Team ignores alarms (alarm fatigue)
- Alarms trigger during known maintenance

**Solutions**:

1. **Adjust Thresholds**:
   - Review alarm history
   - Analyze metric patterns
   - Increase threshold if too sensitive
   - Use percentiles instead of max/min

2. **Increase Datapoints to Alarm**:
   - Change from 1 out of 1 to 2 out of 3
   - Requires sustained breach
   - Reduces transient spikes

3. **Use Composite Alarms**:
   - Combine multiple signals
   - Require multiple conditions
   - More accurate detection

4. **Implement Maintenance Windows**:
   - Suppress alarms during deployments
   - Use CloudWatch alarm actions
   - Document maintenance schedules

### Handling Alarm Flapping

**Symptoms**:
- Alarm rapidly switches between OK and ALARM
- Metric oscillates around threshold
- Unclear if real issue exists

**Solutions**:

1. **Increase Evaluation Period**:
   - Use longer time windows
   - Smooth out oscillations
   - Focus on sustained issues

2. **Add Hysteresis**:
   - Use different thresholds for alarm and recovery
   - Example: Alarm at 80%, recover at 70%
   - Prevents rapid state changes

3. **Use Anomaly Detection**:
   - Adapts to metric patterns
   - Less sensitive to threshold proximity
   - Better for variable metrics

## Alarm Testing

### Validating Alarm Configuration

**Test Checklist**:
- [ ] Alarm triggers when metric breaches threshold
- [ ] Alarm recovers when metric returns to normal
- [ ] Alarm actions execute correctly (notifications sent)
- [ ] Alarm description is clear and actionable
- [ ] Runbook link works and is up-to-date
- [ ] On-call receives notification within SLA

**Testing Approaches**:

1. **Synthetic Testing**:
   - Inject errors or load
   - Verify alarm triggers
   - Confirm notifications

2. **Historical Analysis**:
   - Review past incidents
   - Check if alarm would have triggered
   - Adjust configuration if needed

3. **Chaos Engineering**:
   - Deliberately cause failures
   - Validate detection and alerting
   - Test incident response procedures

## Integration with Incident Response

### Alarm-Driven Workflows

**Workflow 1: Alarm Triggers Investigation**:
```
1. Alarm triggers → Notification sent
2. On-call checks alarm details
3. Query CloudWatch Logs for errors
4. Analyze Application Signals traces
5. Check CloudTrail for recent changes (use data source priority)
6. Implement mitigation
7. Update alarm if needed
```

**Workflow 2: Proactive Monitoring**:
```
1. Review alarm history daily
2. Identify patterns and trends
3. Tune thresholds before issues occur
4. Add missing alarms for gaps
5. Document learnings in runbooks
```

## Quick Reference

### Get Alarm Recommendations

```
# Lambda Errors
get_recommended_metric_alarms(
  namespace="AWS/Lambda",
  metric_name="Errors",
  dimensions=[{name: "FunctionName", value: "my-function"}],
  statistic="Sum"
)

# EC2 CPU
get_recommended_metric_alarms(
  namespace="AWS/EC2",
  metric_name="CPUUtilization",
  dimensions=[{name: "InstanceId", value: "i-1234567890abcdef0"}],
  statistic="Average"
)

# API Gateway Latency
get_recommended_metric_alarms(
  namespace="AWS/ApiGateway",
  metric_name="Latency",
  dimensions=[{name: "ApiName", value: "my-api"}],
  statistic="p99"
)
```

### Check Active Alarms

```
get_active_alarms(state_value="ALARM")
```

### Review Alarm History

```
get_alarm_history(
  alarm_name="my-alarm",
  history_item_type="StateUpdate",
  start_time="2026-01-01T00:00:00Z",
  end_time="2026-01-20T00:00:00Z"
)
```

---

**Remember**: Effective alerting requires continuous tuning. Start with recommended configurations, monitor for false positives, and adjust based on your specific needs and patterns.

## Application Signals Setup

# Application Signals Setup and Enablement Guide

This steering file provides comprehensive guidance for setting up AWS Application Signals using the power's enablement guide feature.

## Quick Start: Get Enablement Guide

**First Step**: Always start by getting the official enablement guide from AWS:

```
Use the awslabs.cloudwatch-applicationsignals-mcp-server's get_enablement_guide tool with the following required parameters:
  - service_platform (required): "ec2", "ecs", "lambda", or "eks"
  - service_language (required): "python", "nodejs", "java", or "dotnet"
  - iac_directory (required): Absolute path to your Infrastructure as Code directory
  - app_directory (required): Absolute path to your application code directory
```

This tool provides:
- Current prerequisites and requirements
- Step-by-step enablement instructions
- Service instrumentation guidance
- Best practices and recommendations
- Troubleshooting common issues

## Application Signals Setup Workflow

### Phase 1: Prerequisites Check

Before enabling Application Signals, verify:

1. **AWS Account Requirements**:
   - Application Signals is available in your region
   - Sufficient IAM permissions for CloudWatch and X-Ray
   - EC2/ECS/EKS/Lambda services are running

2. **Service Requirements**:
   - Applications are instrumented with AWS X-Ray SDK or OpenTelemetry
   - Services are running in supported compute environments
   - Network connectivity allows telemetry data transmission

### Phase 2: Enable Application Signals

1. **Get the Latest Guide**:
   ```
   Use get_enablement_guide to get current setup instructions
   ```

2. **Enable at Account Level**:
   - Use AWS Console or CLI to enable Application Signals
   - Configure service discovery settings
   - Set up data retention policies

3. **Verify Enablement**:
   - Check that Application Signals is active
   - Confirm data ingestion is working
   - Validate service discovery

### Phase 3: Service Instrumentation

Based on the enablement guide, instrument your services:

1. **For Lambda Functions**:
   - Enable X-Ray tracing
   - Add AWS X-Ray SDK to function code
   - Configure environment variables

2. **For ECS/EKS Services**:
   - Deploy X-Ray daemon as sidecar
   - Configure service mesh integration (if applicable)
   - Set up OpenTelemetry collectors

3. **For EC2 Applications**:
   - Install X-Ray daemon
   - Configure application instrumentation
   - Set up auto-discovery tags

### Phase 4: Configure Monitoring

1. **Service Level Objectives (SLOs)**:
   - Define availability targets
   - Set latency thresholds
   - Configure error rate limits

2. **Dashboards and Alarms**:
   - Create service overview dashboards
   - Set up performance alarms
   - Configure notification channels

## Common Setup Patterns

### Pattern 1: Microservices Architecture

For distributed microservices:

1. Get enablement guide for microservices setup
2. Enable Application Signals at the account level
3. Instrument each service with X-Ray SDK
4. Configure service maps and dependencies
5. Set up cross-service SLOs

### Pattern 2: Serverless Applications

For Lambda-based applications:

1. Get enablement guide for serverless setup
2. Enable X-Ray tracing on all Lambda functions
3. Configure API Gateway integration
4. Set up end-to-end tracing
5. Create function-level SLOs

### Pattern 3: Container Workloads

For ECS/EKS applications:

1. Get enablement guide for container setup
2. Deploy X-Ray daemon containers
3. Configure service discovery
4. Set up cluster-level monitoring
5. Create pod/task-level SLOs

## Troubleshooting Setup Issues

### Common Problems and Solutions

1. **No Data Appearing**:
   - Re-run get_enablement_guide for latest troubleshooting steps
   - Verify service instrumentation
   - Check IAM permissions
   - Validate network connectivity

2. **Incomplete Service Maps**:
   - Ensure all services are instrumented
   - Check X-Ray sampling rules
   - Verify service naming consistency

3. **Missing Metrics**:
   - Confirm Application Signals is enabled
   - Check service discovery configuration
   - Validate metric emission

## Best Practices from Enablement Guide

Always refer to the latest enablement guide, but common best practices include:

1. **Instrumentation**:
   - Use consistent service naming
   - Implement proper error handling
   - Configure appropriate sampling rates

2. **Monitoring**:
   - Start with basic SLOs and iterate
   - Use composite alarms for complex scenarios
   - Set up proper alerting channels

3. **Performance**:
   - Monitor instrumentation overhead
   - Optimize sampling configurations
   - Use async telemetry transmission

## Integration with Other Power Features

### Combine with CloudWatch Logs

Use Logs Insights queries to correlate Application Signals data with logs:

```
fields @timestamp, @message, traceId, duration
| filter ispresent(traceId)
| sort duration desc
| limit 100
```

### Combine with CloudTrail

Track Application Signals configuration changes:

- Monitor EnableApplicationSignals API calls
- Track service configuration modifications
- Audit SLO changes

## Validation Steps

After setup, validate your Application Signals implementation:

1. **Data Flow Validation**:
   - Confirm traces are appearing in X-Ray
   - Verify metrics in CloudWatch
   - Check service maps are populated

2. **SLO Validation**:
   - Test SLO calculations
   - Verify alarm triggering
   - Confirm notification delivery

3. **Performance Validation**:
   - Monitor instrumentation overhead
   - Check data ingestion costs
   - Validate query performance

## Next Steps After Setup

Once Application Signals is enabled:

1. Create comprehensive service dashboards
2. Set up automated alerting workflows
3. Implement SLO-based incident response
4. Train team on Application Signals features
5. Establish monitoring best practices

## Resources

- Use `get_enablement_guide` tool for latest official documentation
- [Application Signals User Guide](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Application-Signals.html)
- [X-Ray Developer Guide](https://docs.aws.amazon.com/xray/latest/devguide/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)

---

**Remember**: Always start with the `get_enablement_guide` tool to get the most current and accurate setup instructions for your specific environment and use case.

## Cloudtrail Data Source Selection

# CloudTrail Data Source Selection Strategy

## Purpose
This is a utility guide referenced by `security-auditing.md` and other steering files for CloudTrail data access priority logic. It is not intended to be loaded directly in response to user queries. For CloudTrail security analysis, use `security-auditing.md` instead.

This steering file defines the priority order for accessing CloudTrail audit data across different AWS services. It ensures the agent always uses the most efficient and comprehensive data source available.

## Data Source Priority

When CloudTrail or security auditing data is needed, follow this priority order:

### Priority 1: CloudTrail Lake (Event Data Store)
**Check First**: Use CloudTrail MCP server to check for CloudTrail Lake event data stores

**Tool**: `list_event_data_stores` from CloudTrail MCP server

**When to Use**:
- Event data store exists with management events enabled
- Provides SQL-based querying with advanced filtering
- Best for complex queries and long-term retention
- Most cost-effective for large-scale analysis

**Advantages**:
- Native SQL support for complex queries
- 7-year retention by default
- Cross-account and cross-region aggregation
- Advanced filtering and partitioning
- Lower query costs for large datasets

**Example Check**:
```
Use CloudTrail MCP server's list_event_data_stores tool to check if any event data stores exist with:
- Status: ENABLED
- AdvancedEventSelectors configured for management events
```

### Priority 2: CloudWatch Logs (CloudTrail Integration)
**Check Second**: If no CloudTrail Lake event data store, check CloudWatch Logs

**Tool**: `describe_log_groups` from CloudWatch MCP server

**When to Use**:
- CloudTrail is configured to send events to CloudWatch Logs
- Log group exists with "cloudtrail" in the name
- Good for real-time analysis and alerting
- Integrates with CloudWatch Alarms

**Advantages**:
- Real-time event streaming
- CloudWatch Logs Insights query support
- Integration with CloudWatch Alarms and metrics
- Cross-service log correlation
- Familiar CloudWatch Logs interface

**Common Log Group Patterns**:
- `/aws/cloudtrail/logs`
- `/aws/cloudtrail/<trail-name>`
- `CloudTrail/logs`
- `<organization-name>-cloudtrail`
- Any log group with "cloudtrail" in the name

**Example Check**:
```
Use CloudWatch MCP server's describe_log_groups tool with:
- log_group_name_prefix: "/aws/cloudtrail" or search for "cloudtrail"
```

### Priority 3: CloudTrail Lookup Events API
**Fallback**: If neither CloudTrail Lake nor CloudWatch Logs available

**Tool**: `lookup_events` from CloudTrail MCP server

**When to Use**:
- No CloudTrail Lake event data store configured
- CloudTrail not sending to CloudWatch Logs
- Quick lookups for recent events (last 90 days)
- Simple queries without complex filtering

**Limitations**:
- Only last 90 days of events
- Limited to 50 results per API call
- Basic filtering capabilities
- Higher API costs for large queries
- No SQL support

**Advantages**:
- Always available if CloudTrail is enabled
- No additional configuration required
- Simple API for basic queries
- Good for quick investigations

**Example Usage**:
```
Use CloudTrail MCP server's lookup_events tool with:
- StartTime and EndTime for date range
- LookupAttributes for filtering (EventName, Username, ResourceName, etc.)
- MaxResults for pagination
```

## Implementation Workflow

### Step 1: Check CloudTrail Lake
```
1. Call list_event_data_stores from CloudTrail MCP server
2. Check if any event data stores exist with:
   - Status = ENABLED
   - Management events enabled in AdvancedEventSelectors
3. If found, use CloudTrail Lake for queries
   - Use lake_query for SQL-based analysis
   - Leverage advanced filtering and aggregation
```

### Step 2: Check CloudWatch Logs (if Step 1 fails)
```
1. Call describe_log_groups from CloudWatch MCP server
2. Search for log groups with "cloudtrail" in the name
3. If found, use CloudWatch Logs Insights
   - Use execute_log_insights_query for analysis
   - Leverage CloudWatch Logs query syntax
   - Set up alarms if needed
```

### Step 3: Use Lookup Events API (if Steps 1 and 2 fail)
```
1. Use lookup_events from CloudTrail MCP server
2. Apply basic filtering with LookupAttributes
3. Paginate through results if needed
4. Note: Limited to last 90 days and 50 results per call
```

## Decision Tree

```
Need CloudTrail Data?
    |
    v
Check CloudTrail Lake (list_event_data_stores)
    |
    +-- Event Data Store Enabled? --> YES --> Use CloudTrail Lake (lake_query)
    |
    +-- NO
        |
        v
    Check CloudWatch Logs (describe_log_groups)
        |
        +-- CloudTrail Log Group Exists? --> YES --> Use CloudWatch Logs (execute_log_insights_query)
        |
        +-- NO
            |
            v
        Use CloudTrail Lookup Events API (lookup_events)
            |
            v
        Limited to 90 days, basic filtering
```

## Query Translation Examples

### Example 1: Find IAM User Deletions

**CloudTrail Lake (SQL)**:
```sql
SELECT 
    eventTime,
    userIdentity.userName,
    requestParameters.userName AS deletedUser,
    sourceIPAddress
FROM <event_data_store_id>
WHERE eventName = 'DeleteUser'
    AND eventTime > timestamp '2024-01-01 00:00:00'
ORDER BY eventTime DESC
```

**CloudWatch Logs Insights**:
```
fields eventTime, userIdentity.userName, requestParameters.userName, sourceIPAddress
| filter eventName = "DeleteUser"
| filter @timestamp > "2024-01-01T00:00:00Z"
| sort eventTime desc
| limit 50
```

**Lookup Events API**:
```
lookup_events(
    LookupAttributes=[
        {
            'AttributeKey': 'EventName',
            'AttributeValue': 'DeleteUser'
        }
    ],
    StartTime='2024-01-01T00:00:00Z',
    MaxResults=50
)
```

### Example 2: Track S3 Bucket Deletions

**CloudTrail Lake (SQL)**:
```sql
SELECT 
    eventTime,
    userIdentity.principalId,
    requestParameters.bucketName,
    sourceIPAddress,
    errorCode
FROM <event_data_store_id>
WHERE eventName = 'DeleteBucket'
    AND eventTime > timestamp '2024-01-01 00:00:00'
ORDER BY eventTime DESC
```

**CloudWatch Logs Insights**:
```
fields eventTime, userIdentity.principalId, requestParameters.bucketName, sourceIPAddress, errorCode
| filter eventName = "DeleteBucket"
| filter @timestamp > "2024-01-01T00:00:00Z"
| sort eventTime desc
| limit 50
```

**Lookup Events API**:
```
lookup_events(
    LookupAttributes=[
        {
            'AttributeKey': 'EventName',
            'AttributeValue': 'DeleteBucket'
        }
    ],
    StartTime='2024-01-01T00:00:00Z',
    MaxResults=50
)
```

## Best Practices

### 1. Always Check in Priority Order
- Start with CloudTrail Lake for best performance and cost
- Fall back to CloudWatch Logs for real-time analysis
- Use Lookup Events API only as last resort

### 2. Cache Data Source Discovery
- Once you've identified the available data source, remember it for the session
- Don't re-check on every query unless explicitly needed

### 3. Choose the Right Tool for the Job
- **Complex Analysis**: CloudTrail Lake (SQL support)
- **Real-time Alerting**: CloudWatch Logs (alarm integration)
- **Quick Lookups**: Lookup Events API (simple queries)

### 4. Consider Time Range
- **> 90 days**: Must use CloudTrail Lake or CloudWatch Logs
- **< 90 days**: All three options available
- **Real-time**: CloudWatch Logs preferred

### 5. Query Optimization
- **CloudTrail Lake**: Use SQL optimizations (WHERE clauses, partitioning)
- **CloudWatch Logs**: Use indexed fields, limit time ranges
- **Lookup Events**: Use specific LookupAttributes to reduce results

## Error Handling

### CloudTrail Lake Not Available
```
If list_event_data_stores returns empty or no enabled stores:
- Log: "CloudTrail Lake not configured, checking CloudWatch Logs"
- Proceed to Priority 2
```

### CloudWatch Logs Not Available
```
If describe_log_groups finds no CloudTrail log groups:
- Log: "CloudTrail not integrated with CloudWatch Logs, using Lookup Events API"
- Proceed to Priority 3
```

### Lookup Events API Limitations
```
If query requires:
- Data older than 90 days: Inform user CloudTrail Lake or CloudWatch Logs needed
- Complex filtering: Suggest enabling CloudTrail Lake
- Large result sets: Warn about pagination and API costs
```

## Migration Recommendations

If using Lookup Events API, recommend:

1. **Enable CloudTrail Lake** for:
   - Long-term retention (7 years)
   - Complex SQL queries
   - Cost-effective large-scale analysis
   - Cross-account aggregation

2. **Enable CloudWatch Logs Integration** for:
   - Real-time monitoring
   - CloudWatch Alarms
   - Log correlation with applications
   - Familiar CloudWatch interface

## Summary

This priority-based approach ensures:
- ✅ Most efficient data source is used first
- ✅ Graceful fallback to available alternatives
- ✅ Clear guidance for users on capabilities
- ✅ Cost optimization through appropriate tool selection
- ✅ Consistent behavior across all steering files

---

**Remember**: Always check data sources in priority order (CloudTrail Lake → CloudWatch Logs → Lookup Events API) to ensure optimal performance and cost efficiency.

## Incident Response

# Incident Response and Troubleshooting

## Purpose
This steering file provides comprehensive guidance for responding to incidents and troubleshooting issues using the full AWS observability stack.

## Incident Response Framework

### Phase 1: Detection and Triage

**Objectives**:
- Quickly identify the issue
- Assess severity and impact
- Determine affected services and users

**Actions**:
1. **Check Active Alarms**
   - Query CloudWatch for alarms in ALARM state
   - Review alarm history to understand timing
   - Identify which metrics triggered alarms

2. **Review Application Signals**
   - Check service health and SLO status
   - Identify services with elevated error rates
   - Review service maps for dependency issues

3. **Assess Impact**
   - Query logs for error volume
   - Check request counts and success rates
   - Determine user-facing impact

**Severity Classification**:
- **SEV1 (Critical)**: Complete service outage, data loss, security breach
- **SEV2 (High)**: Major functionality impaired, significant user impact
- **SEV3 (Medium)**: Partial functionality impaired, workaround available
- **SEV4 (Low)**: Minor issue, minimal user impact
- **SEV5 (Informational)**: No immediate impact, cosmetic or non-urgent improvement

### Phase 2: Investigation

**Objectives**:
- Gather evidence and data
- Identify root cause
- Understand the failure chain

**Data Collection**:

1. **CloudWatch Logs Insights**
   For detailed log query patterns and syntax, see `log-analysis.md`.
   Key query for incident context:
   ```
   # Quick error snapshot for incident timeframe
   fields @timestamp, @logStream, @message, level, errorType, requestId
   | filter level = "ERROR"
   | sort @timestamp asc
   | limit 1000
   ```

2. **Application Signals Traces**
   - Search for failed traces during incident window
   - Analyze trace timelines for bottlenecks
   - Examine error spans for exception details
   - Review service dependencies

3. **CloudWatch Metrics**
   - Get metric data for affected resources
   - Compare with baseline/normal behavior
   - Identify metric anomalies
   - Check for resource exhaustion (CPU, memory, connections)

4. **CloudTrail Events**
   For detailed CloudTrail query patterns and security analysis, see `security-auditing.md`.
   - **Follow CloudTrail data source priority** (see `cloudtrail-data-source-selection.md`):
     - Priority 1: Check CloudTrail Lake event data stores
     - Priority 2: Check CloudWatch Logs for CloudTrail integration
     - Priority 3: Use CloudTrail Lookup Events API
   - Query for recent configuration changes
   - Check for deployments or infrastructure modifications
   - Identify who made changes and when
   - Review IAM permission changes

**Correlation Workflow**:
```
1. Identify incident start time from alarms
2. Query logs for errors starting at that time
3. Extract trace IDs from error logs
4. Analyze traces for failure points
5. Check CloudTrail for changes before incident (use priority order)
6. Correlate metrics with error patterns
```

### Phase 3: Mitigation

**Objectives**:
- Stop the bleeding
- Restore service functionality
- Minimize user impact

**Common Mitigation Strategies**:

1. **Rollback Deployment**
   - Check CloudTrail for recent deployments (use data source priority)
   - Identify deployment time vs incident start
   - Rollback to previous stable version
   - Verify service recovery

2. **Scale Resources**
   - Check CloudWatch Metrics for resource constraints
   - Increase capacity (EC2 instances, Lambda concurrency)
   - Add read replicas for database load
   - Enable auto-scaling if not already active

3. **Circuit Breaker**
   - Identify failing downstream dependency
   - Implement circuit breaker or fallback
   - Route traffic away from failing component
   - Enable degraded mode operation

4. **Rate Limiting**
   - Identify traffic spike or abuse
   - Implement rate limiting at API Gateway
   - Block malicious IPs
   - Enable WAF rules

5. **Database Optimization**
   - Identify slow queries in logs
   - Add missing indexes
   - Optimize query patterns
   - Scale database resources

### Phase 4: Recovery Verification

**Objectives**:
- Confirm service is restored
- Validate metrics are normal
- Ensure no secondary issues

**Verification Steps**:

1. **Check Alarms**
   - Verify alarms have returned to OK state
   - Monitor for alarm flapping
   - Review alarm history

2. **Validate Application Signals**
   - Check error rates have normalized
   - Verify latency is within SLO targets
   - Review service map for healthy dependencies

3. **Query Logs**
   ```
   # Verify error rate has decreased
   fields @timestamp, level
   | stats count(*) as totalLogs, 
          sum(level = "ERROR") as errorCount 
     by bin(1m)
   | sort @timestamp asc
   | limit 60
   ```

4. **Monitor Metrics**
   - Check CPU, memory, and network utilization
   - Verify request rates and latencies
   - Monitor error rates and success rates

### Phase 5: Root Cause Analysis

**Objectives**:
- Understand why the incident occurred
- Identify contributing factors
- Document findings

**Analysis Framework**:

1. **Timeline Construction**
   - Create detailed timeline of events
   - Include all changes and observations
   - Mark incident start, detection, mitigation, and resolution

2. **Five Whys Analysis**
   ```
   Problem: API returned 500 errors
   
   Why? Lambda function timed out
   Why? Database queries were slow
   Why? Database was under heavy load
   Why? New feature caused N+1 query problem
   Why? Code review didn't catch the inefficient query pattern
   
   Root Cause: Insufficient code review process for database queries
   ```

3. **Contributing Factors**
   - Technical factors (code bugs, configuration errors)
   - Process factors (inadequate testing, missing monitoring)
   - Human factors (knowledge gaps, communication issues)

4. **Evidence Collection**
   - Log excerpts showing errors
   - Metric graphs showing anomalies
   - Trace examples demonstrating failures
   - CloudTrail events showing changes
   - Cost data showing resource usage

### Phase 6: Postmortem and Prevention

**Objectives**:
- Document incident for future reference
- Identify preventive measures
- Implement improvements

**Postmortem Template**:

```markdown
# Incident Postmortem: [Incident Title]

## Summary
- **Date**: YYYY-MM-DD
- **Duration**: X hours Y minutes
- **Severity**: SEVX
- **Impact**: Description of user impact
- **Root Cause**: Brief root cause statement

## Timeline
- HH:MM - Incident began
- HH:MM - First alert triggered
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Mitigation applied
- HH:MM - Service restored
- HH:MM - Incident closed

## What Happened
Detailed description of the incident

## Root Cause
Detailed root cause analysis with evidence

## Resolution
How the incident was resolved

## Impact
- Users affected: X
- Requests failed: Y
- Latency impact: P50/P95/P99 degradation during incident window
- Revenue impact: $Z
- SLO impact: A% error budget consumed

## Action Items
1. [ ] Immediate fix (Owner, Due Date)
2. [ ] Monitoring improvement (Owner, Due Date)
3. [ ] Process change (Owner, Due Date)
4. [ ] Documentation update (Owner, Due Date)

## Lessons Learned
What went well and what could be improved
```

**Prevention Strategies**:

1. **Monitoring Improvements**
   - Add missing alarms
   - Improve alarm thresholds
   - Create composite alarms for complex scenarios
   - Set up SLOs for critical services

2. **Testing Enhancements**
   - Add test cases for failure scenario
   - Implement chaos engineering
   - Load testing for capacity planning
   - Integration testing for dependencies

3. **Process Changes**
   - Update deployment procedures
   - Improve code review checklist
   - Enhance runbook documentation
   - Implement gradual rollouts

4. **Architecture Improvements**
   - Add redundancy for single points of failure
   - Implement circuit breakers
   - Add caching layers
   - Improve error handling

## Common Incident Patterns

### Pattern 1: Deployment-Related Incident

**Symptoms**:
- Errors spike immediately after deployment
- Specific service shows elevated error rate
- Traces show new error types

**Investigation**:
For detailed log query patterns and syntax, see `log-analysis.md`. Key incident-specific approach:
- Query logs for errors immediately after deployment timestamp
- Group errors by type to identify new error patterns introduced by the deployment
- Compare error types before and after deployment

**Mitigation**: Rollback deployment

**Prevention**: 
- Implement canary deployments
- Add integration tests
- Improve staging environment

### Pattern 2: Resource Exhaustion

**Symptoms**:
- Gradual performance degradation
- Timeouts and connection errors
- High CPU or memory utilization

**Investigation**:
- Check CloudWatch Metrics for resource utilization
- Query logs for timeout errors
- Review Application Signals for latency increases
- Check Cost Explorer for usage spikes

**Mitigation**: Scale resources, optimize code

**Prevention**:
- Set up auto-scaling
- Implement resource limits
- Add capacity planning alarms

### Pattern 3: Dependency Failure

**Symptoms**:
- Errors calling external service
- Traces show failures in downstream calls
- Service map shows unhealthy dependency

**Investigation**:
For detailed log query patterns (including field parsing and aggregation), see `log-analysis.md`. Key incident-specific approach:
- Filter logs for dependency-related errors and parse service names and status codes
- Correlate with Application Signals service map to identify unhealthy dependencies
- Check traces for failures in downstream calls

**Mitigation**: 
- Implement circuit breaker
- Add fallback behavior
- Route around failed dependency

**Prevention**:
- Add dependency health checks
- Implement retry logic with backoff
- Set up dependency SLOs

### Pattern 4: Database Performance

**Symptoms**:
- Slow query performance
- Database connection pool exhaustion
- High database CPU utilization

**Investigation**:
For detailed log query patterns (including duration parsing and aggregation), see `log-analysis.md`. Key incident-specific approach:
- Parse SQL queries and durations from logs, filtering for slow queries (e.g., duration > 1000ms)
- Aggregate by query pattern to identify the most impactful slow queries
- Correlate with database CloudWatch Metrics (CPU, connections, IOPS)

**Mitigation**:
- Add database indexes
- Optimize queries
- Scale database resources
- Implement query caching

**Prevention**:
- Regular query performance reviews
- Database monitoring and alerting
- Connection pool tuning

### Pattern 5: Traffic Spike

**Symptoms**:
- Sudden increase in request volume
- Rate limiting errors
- Resource exhaustion

**Investigation**:
- Check CloudWatch Metrics for request rates
- Query logs for request patterns
- Review Application Signals for traffic sources
- Check Cost Explorer for usage spikes

**Mitigation**:
- Enable auto-scaling
- Implement rate limiting
- Add caching layer
- Scale resources manually

**Prevention**:
- Capacity planning
- Load testing
- Auto-scaling configuration
- DDoS protection

## Integration with All Observability Tools

For detailed patterns on individual tools, see the specialized guides: `log-analysis.md` for log queries, `performance-monitoring.md` for Application Signals and APM, and `security-auditing.md` for CloudTrail analysis.

### Complete Investigation Workflow

```
1. Detection (CloudWatch Alarms)
   ↓
2. Service Health (Application Signals)
   ↓
3. Error Analysis (CloudWatch Logs Insights)
   ↓
4. Trace Analysis (Application Signals Traces)
   ↓
5. Metric Correlation (CloudWatch Metrics)
   ↓
6. Change Detection (CloudTrail)
   ↓
7. Cost Impact (Cost Explorer)
   ↓
8. Documentation (AWS Documentation)
```

### Example: Complete Incident Investigation

**Scenario**: API returning 500 errors

**Step 1: Check Alarms**
```
Query: get_active_alarms(state_value="ALARM")
Result: "api-error-rate" alarm in ALARM state
```

**Step 2: Check Application Signals**
For detailed Application Signals patterns and APM deep-dive, see `performance-monitoring.md`.
```
Query: audit_services(
  service_targets='[{"Type":"service","Data":{"Service":{"Type":"Service","Name":"*"}}}]'
)
Result: "api-service" flagged with 15% error rate (normal: 0.1%)
```

**Step 3: Query Logs**
```
fields @timestamp, @message, errorType, requestId, traceId
| filter level = "ERROR"
| sort @timestamp desc
| limit 100
```

**Step 4: Analyze Traces**
For detailed trace analysis patterns, see `performance-monitoring.md`.
```
Query: search_transaction_spans(
  query_string='FILTER attributes.aws.local.service = "api-service"
    and attributes.http.status_code >= 500
    | LIMIT 20'
)
Result: Traces show timeout calling database
```

**Step 5: Check Metrics**
```
Query: get_metric_data(
  namespace="AWS/RDS",
  metric_name="CPUUtilization",
  dimensions=[{name: "DBInstanceIdentifier", value: "prod-db"}]
)
Result: Database CPU at 95%
```

**Step 6: Check CloudTrail for Changes**
```
# Follow CloudTrail data source priority (see cloudtrail-data-source-selection.md)
# For detailed CloudTrail query patterns and security analysis, see security-auditing.md.
#
# 1. Check CloudTrail Lake (if available)
# 2. Check CloudWatch Logs (if CloudTrail integrated)
# 3. Use Lookup Events API (fallback)
#
# Query for recent changes to the affected service (e.g., RDS):
# - Filter by eventSource for the relevant AWS service
# - Sort by eventTime descending to find recent changes

Result: No recent database changes
```

**Step 7: Check Logs for Query Patterns**
For detailed log query patterns including duration parsing, see `log-analysis.md`.
```
# Analyze slow query patterns - parse SQL and duration from logs,
# aggregate by query to find the most frequent/slowest patterns.
# See log-analysis.md for parse and stats syntax reference.

Result: N+1 query pattern detected - 10,000+ queries for single API request
```

**Step 8: Root Cause**
```
Finding: New feature deployed 1 hour ago
Issue: N+1 query problem causing excessive database load
Evidence: 10,000+ queries for single API request
```

**Step 9: Mitigation**
```
Action: Rollback deployment
Verification: Error rate returns to normal
Follow-up: Fix N+1 query, add database query monitoring
```

## Quick Reference

### Incident Checklist

- [ ] Check active alarms
- [ ] Review Application Signals service health
- [ ] Query logs for errors
- [ ] Analyze traces for failures
- [ ] Check metrics for anomalies
- [ ] Review CloudTrail for changes
- [ ] Assess cost impact
- [ ] Document timeline
- [ ] Implement mitigation
- [ ] Verify recovery
- [ ] Conduct root cause analysis
- [ ] Write postmortem
- [ ] Implement preventive measures

### Key Logs Insights Queries

For detailed log query patterns, syntax reference, and common query templates, see `log-analysis.md`. During incidents, focus on:
- Error rate over time (bin by 1m for incident granularity)
- Top error types to identify the dominant failure mode
- Request tracing using requestId or traceId from error logs

---

**Remember**: Effective incident response requires quick detection, thorough investigation, decisive mitigation, and comprehensive follow-up. Use all available observability tools to build a complete picture of the incident.

## Log Analysis

# CloudWatch Logs Insights Analysis Steering

## Purpose
This steering file provides guidance for using CloudWatch Logs Insights QL syntax for log analysis, troubleshooting, and data extraction via the CloudWatch MCP server.

## MCP Server Tools

### Primary Tools
- `execute_log_insights_query` - Run Logs Insights queries with automatic polling
- `describe_log_groups` - Discover log groups and saved queries
- `analyze_log_group` - Detect anomalies and common patterns
- `get_logs_insight_query_results` - Retrieve results from timed-out queries
- `cancel_logs_insight_query` - Cancel running queries

### Key Parameters for execute_log_insights_query
- `query_string` - The Logs Insights QL query
- `log_group_names` OR `log_group_identifiers` - Target log groups (exactly one required)
- `start_time` / `end_time` - ISO 8601 format (e.g., "2025-02-06T10:00:00+00:00")
- `limit` - Max results (CRITICAL: always use to avoid context overflow)

## Query Construction Principles

### 1. Always Limit Results
Every query should include a limit to avoid overwhelming context:
```
fields @timestamp, @message
| limit 50
```

### 2. Use Pipe Syntax
Commands are separated by pipe (`|`) characters:
```
fields @timestamp, @message
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100
```

### 3. Built-in Fields Use @ Prefix
CloudWatch auto-discovers these fields:
- `@timestamp` - Log event timestamp
- `@message` - Raw log message
- `@logStream` - Log stream name
- `@log` - Log group identifier
- `@ingestionTime` - When CloudWatch received the event

### 4. Comments Use Hash
```
# This is a comment
fields @timestamp, @message
| limit 50
```

## Core Commands

### fields
Select and transform fields:
```
fields @timestamp, @message, @logStream
fields @timestamp, concat(@logStream, '-', @message) as combined
```

### filter
Filter log events:
```
filter @message like /ERROR/
filter @message like /(?i)exception/
filter statusCode >= 400
filter ispresent(requestId)
filter @message not like /DEBUG/
```

### stats
Aggregate statistics:
```
stats count(*) by bin(1h)
stats avg(duration), max(duration), min(duration) by serviceName
stats count(*) as errorCount by errorType
| sort errorCount desc
```

### parse
Extract fields from messages:
```
# Glob pattern
parse @message "user=* action=* status=*" as user, action, status

# Regex pattern
parse @message /user=(?<user>\S+)/
parse @message /duration=(?<duration>\d+)ms/
```

### sort
Order results:
```
sort @timestamp desc
sort duration desc
sort errorCount asc
```

### limit
Cap result count:
```
limit 100
```

### dedup
Remove duplicates:
```
dedup requestId
dedup @logStream, errorType
```

## Common Query Patterns

### Pattern 1: Basic Error Search
```
fields @timestamp, @message, @logStream
| filter @message like /ERROR/
| sort @timestamp desc
| limit 50
```

### Pattern 2: Count Errors by Type
```
filter @message like /ERROR/
| parse @message /ERROR: (?<errorType>[^:]+)/
| stats count(*) as count by errorType
| sort count desc
| limit 20
```

### Pattern 3: Lambda Cold Starts
```
filter @type = "REPORT"
| parse @message /Init Duration: (?<initDuration>[\d\.]+)/
| filter ispresent(initDuration)
| stats count(*) as coldStarts, avg(initDuration) as avgInitMs by bin(1h)
```

### Pattern 4: API Latency Analysis
```
filter ispresent(duration)
| stats avg(duration) as avgMs, 
        pct(duration, 95) as p95Ms,
        pct(duration, 99) as p99Ms,
        max(duration) as maxMs
  by bin(5m)
| sort @timestamp desc
```

### Pattern 5: HTTP Status Code Distribution
```
filter ispresent(statusCode)
| stats count(*) as requests by statusCode
| sort statusCode asc
```

### Pattern 6: Find Slow Requests
```
filter duration > 1000
| fields @timestamp, @requestId, duration, @message
| sort duration desc
| limit 25
```

### Pattern 7: JSON Log Parsing
```
fields @timestamp, @message
| parse @message '{"level":"*","message":"*","requestId":"*"}' as level, msg, reqId
| filter level = "ERROR"
| limit 50
```

### Pattern 8: Unique Error Messages
```
filter @message like /ERROR/
| dedup @message
| limit 30
```

### Pattern 9: Request Tracing
```
filter @requestId = "abc-123-def"
| fields @timestamp, @message, @logStream
| sort @timestamp asc
```

### Pattern 10: Anomaly Detection
```
anomaly @message
| limit 50
```

## Functions Reference

### String Functions
- `strlen(field)` - String length
- `trim(field)` - Remove whitespace
- `tolower(field)` / `toupper(field)` - Case conversion
- `concat(a, b, ...)` - Concatenate strings
- `replace(field, 'old', 'new')` - Replace substring

### Numeric Functions
- `abs(num)` - Absolute value
- `ceil(num)` / `floor(num)` - Rounding
- `greatest(a, b, ...)` / `least(a, b, ...)` - Min/max of values
- `log(num)` / `sqrt(num)` - Math functions

### Date/Time Functions
- `datefloor(timestamp, period)` - Round down to period
- `dateceil(timestamp, period)` - Round up to period
- `bin(period)` - Group by time bucket (1m, 5m, 1h, 1d)
- `fromMillis(ms)` - Convert epoch ms to timestamp
- `toMillis(timestamp)` - Convert timestamp to epoch ms

### Aggregation Functions (use with stats)
- `count(*)` / `count(field)` - Count events
- `sum(field)` - Sum values
- `avg(field)` - Average
- `min(field)` / `max(field)` - Min/max
- `pct(field, percentile)` - Percentile (e.g., pct(duration, 95))
- `stddev(field)` - Standard deviation
- `earliest(field)` / `latest(field)` - First/last by time

### Conditional Functions
- `ispresent(field)` - Check if field exists
- `isempty(field)` - Check if field is empty
- `isblank(field)` - Check if field is blank
- `coalesce(a, b, ...)` - First non-null value

### IP Functions
- `isValidIp(field)` - Validate IP address
- `isValidIpV4(field)` / `isValidIpV6(field)` - Validate specific version
- `isIpInSubnet(ip, subnet)` - Check subnet membership

## Best Practices

1. **Start with describe_log_groups** - Discover available log groups first
2. **Use narrow time ranges** - Minimize scanned data and costs
3. **Always include limit** - Prevent context window overflow
4. **Test incrementally** - Start simple, add complexity
5. **Use filterIndex for indexed fields** - Improves performance on large datasets
6. **Parse JSON early** - Extract fields before filtering when possible
7. **Use analyze_log_group** - For quick anomaly and pattern detection

## Common Pitfalls

1. **Missing limit** - Queries can return massive results
2. **Wrong time format** - Use ISO 8601 with timezone
3. **Case sensitivity** - Field names and regex are case-sensitive
4. **Missing ispresent()** - Filter on field existence before using it
5. **Regex escaping** - Use `/pattern/` syntax, escape special chars
6. **Large time ranges** - Can be slow and expensive

## Query Construction Workflow

When a user asks for log analysis:

1. **Discover log groups** - Use `describe_log_groups` if unknown
2. **Define time range** - Ask for or suggest appropriate window
3. **Identify requirements** - What fields, filters, aggregations?
4. **Build query** - Start simple, use patterns above
5. **Add limit** - Always cap results (50-100 typical)
6. **Execute and iterate** - Refine based on results

---

**Remember**: Always include a `limit` clause to avoid overwhelming the agent context. Start with 50-100 results and increase if needed.

## Observability Gap Analysis

# Codebase Observability Gap Analysis Steering

## Purpose
This steering file provides guidance for analyzing codebases across major programming languages to identify observability gaps and provide actionable recommendations for instrumentation, logging, metrics, and tracing.

## Analysis Framework

### 1. Logging Analysis
Identify gaps in logging coverage:

**What to Check:**
- Error handling blocks without logging
- Critical operations without audit logs
- Missing structured logging (JSON format)
- Inconsistent log levels
- Missing correlation IDs/request IDs
- Sensitive data in logs (PII, credentials)
- Missing context (user, session, transaction)

**Recommendations:**
- Use structured logging libraries (e.g., structlog, logrus, winston)
- Add correlation IDs to all log entries
- Log at appropriate levels (ERROR, WARN, INFO, DEBUG)
- Include contextual metadata (service, version, environment)
- Sanitize sensitive data before logging

**Cost Optimization:**
- Set production log level to INFO or WARN (avoid DEBUG in production)
- Use log sampling for high-throughput operations (e.g., log 1 in 100 requests)
- Configure CloudWatch log retention policies (7-30 days for most use cases)
- Use metric filters instead of logging for high-frequency counters
- Avoid logging in hot paths (tight loops, per-item processing)
- Consider log aggregation before shipping (batch similar events)
- Use EMF (Embedded Metric Format) for Lambda to reduce log volume

### 2. Metrics Collection
Assess metrics instrumentation:

**What to Check:**
- Missing business metrics (orders, signups, conversions)
- No performance metrics (latency, throughput)
- Missing resource utilization metrics
- No error rate tracking
- Missing custom CloudWatch metrics
- No metric dimensions for filtering

**Recommendations:**
- Instrument key business operations
- Track request duration and count
- Monitor error rates by type
- Add custom CloudWatch metrics for business KPIs
- Use metric dimensions (service, endpoint, status)
- Implement metric aggregation for high-volume operations

**Cost Optimization:**
- Limit metric dimensions to avoid cardinality explosion (max 10 dimensions per metric)
- Use metric aggregation at source before publishing to CloudWatch
- Leverage EMF (Embedded Metric Format) for Lambda to reduce API calls
- Set appropriate metric resolution (standard 1-min vs high-res 1-sec)
- Use metric math in dashboards instead of creating derived metrics
- Implement local aggregation for high-frequency metrics (>1000/sec)
- Consider StatsD/DogStatsD for local aggregation before CloudWatch

### 3. Distributed Tracing
Evaluate tracing implementation:

**What to Check:**
- Missing OpenTelemetry SDK integration
- No trace context propagation (W3C Trace Context)
- Missing spans for external calls
- No span attributes for business context
- Missing span events for debugging
- No sampling strategy
- Legacy X-Ray SDK without OTEL migration path

**Recommendations:**
- Use OpenTelemetry (OTEL) for instrumentation (vendor-neutral, industry standard)
- Deploy AWS Distro for OpenTelemetry (ADOT) as the collector
- Enable AWS Application Signals for automatic APM (built on OTEL)
- Propagate trace context across service boundaries (W3C Trace Context)
- Create spans for database, HTTP, and AWS SDK calls
- Add span attributes for searchable context
- Include span events for debugging details
- Implement adaptive sampling for high-volume services
- For existing X-Ray implementations: Plan migration to OTEL with X-Ray exporter

**Application Signals Benefits:**
- Automatic service discovery and dependency mapping
- Pre-built dashboards for service health (latency, errors, availability)
- SLO tracking and error budget monitoring
- Correlation between traces, metrics, and logs
- No code changes required (auto-instrumentation via ADOT)
- Built on OpenTelemetry standards

**Cost Optimization:**
- Implement head-based sampling (sample at trace start, not per-span)
- Use adaptive sampling rules (higher rate for errors, lower for success)
- Configure sampling rates based on traffic volume (1% for high-volume, 100% for low-volume)
- Avoid tracing health check endpoints
- Use tail-based sampling for critical transactions only
- Leverage ADOT collector for local aggregation and filtering

### 4. Error Handling
Review error handling patterns:

**What to Check:**
- Silent failures (empty catch blocks)
- Generic error messages
- Missing error context
- No error categorization
- Missing retry logic
- No circuit breaker patterns

**Recommendations:**
- Log all errors with full context
- Use specific error types/classes
- Include stack traces for debugging
- Categorize errors (transient, permanent, user)
- Implement exponential backoff for retries
- Add circuit breakers for external dependencies

### 5. Health Checks & Readiness
Assess service health endpoints:

**What to Check:**
- Missing health check endpoints
- No readiness probes
- Incomplete dependency checks
- No graceful shutdown handling
- Missing startup probes

**Recommendations:**
- Implement `/health` endpoint
- Add `/ready` endpoint with dependency checks
- Include version and build info
- Implement graceful shutdown
- Add startup probes for slow-starting services

## Language-Specific Patterns

### Python
```python
# GOOD: Structured logging with context
import structlog
logger = structlog.get_logger()

def process_order(order_id, user_id):
    log = logger.bind(order_id=order_id, user_id=user_id)
    try:
        log.info("processing_order_started")
        # ... business logic
        log.info("processing_order_completed", duration_ms=duration)
    except Exception as e:
        log.error("processing_order_failed", error=str(e), exc_info=True)
        raise

# BAD: Unstructured logging, no context
def process_order(order_id, user_id):
    try:
        print("Processing order")
        # ... business logic
    except:
        pass  # Silent failure
```

### Java
```java
// GOOD: Structured logging with MDC
import org.slf4j.Logger;
import org.slf4j.MDC;

public void processOrder(String orderId, String userId) {
    MDC.put("orderId", orderId);
    MDC.put("userId", userId);
    try {
        logger.info("Processing order started");
        // ... business logic
        logger.info("Processing order completed");
    } catch (Exception e) {
        logger.error("Processing order failed", e);
        throw e;
    } finally {
        MDC.clear();
    }
}

// BAD: No context, generic logging
public void processOrder(String orderId, String userId) {
    try {
        System.out.println("Processing");
        // ... business logic
    } catch (Exception e) {
        // Silent failure
    }
}
```

### JavaScript/TypeScript
```javascript
// GOOD: Structured logging with Winston
const winston = require('winston');
const logger = winston.createLogger({
  format: winston.format.json(),
  defaultMeta: { service: 'order-service' }
});

async function processOrder(orderId, userId) {
  const log = logger.child({ orderId, userId });
  try {
    log.info('Processing order started');
    // ... business logic
    log.info('Processing order completed', { duration: duration });
  } catch (error) {
    log.error('Processing order failed', { error: error.message, stack: error.stack });
    throw error;
  }
}

// BAD: Console logging, no structure
async function processOrder(orderId, userId) {
  try {
    console.log('Processing order');
    // ... business logic
  } catch (error) {
    // Silent failure
  }
}
```

### Go
```go
// GOOD: Structured logging with zerolog
import "github.com/rs/zerolog/log"

func processOrder(orderID, userID string) error {
    logger := log.With().
        Str("order_id", orderID).
        Str("user_id", userID).
        Logger()
    
    logger.Info().Msg("Processing order started")
    
    if err := doWork(); err != nil {
        logger.Error().Err(err).Msg("Processing order failed")
        return err
    }
    
    logger.Info().Msg("Processing order completed")
    return nil
}

// BAD: fmt.Println, no structure
func processOrder(orderID, userID string) error {
    fmt.Println("Processing order")
    if err := doWork(); err != nil {
        return err  // No logging
    }
    return nil
}
```

## Analysis Workflow

When analyzing a codebase:

1. **Scan Entry Points**
   - API endpoints/routes
   - Lambda handlers
   - Message queue consumers
   - Scheduled jobs

2. **Identify Critical Paths**
   - Authentication/authorization
   - Payment processing
   - Data mutations
   - External service calls

3. **Check Instrumentation**
   - Logging at entry/exit points
   - Error handling coverage
   - Metrics emission
   - Trace context propagation

4. **Generate Report**
   - List gaps by severity (Critical, High, Medium, Low)
   - Provide code examples for fixes
   - Estimate implementation effort
   - Prioritize recommendations

## Common Observability Gaps

### Critical Gaps
1. **No error logging** - Errors caught but not logged
2. **Missing trace context** - No X-Ray or trace propagation
3. **Silent failures** - Empty catch blocks
4. **No health checks** - Missing /health endpoints
5. **Sensitive data exposure** - PII in logs

### High Priority Gaps
1. **Unstructured logging** - Using print/console.log
2. **Missing correlation IDs** - Can't trace requests
3. **No metrics** - No CloudWatch custom metrics
4. **Generic error messages** - Hard to debug
5. **Missing request/response logging** - No audit trail

### Medium Priority Gaps
1. **Inconsistent log levels** - Everything at INFO
2. **Missing business metrics** - Only technical metrics
3. **No sampling strategy** - Tracing all requests
4. **Missing metadata** - Insufficient debugging context
5. **No log aggregation** - Logs not centralized

### Low Priority Gaps
1. **Verbose logging** - Too much DEBUG output
2. **Missing log rotation** - Disk space issues
3. **No log retention policy** - Compliance risk
4. **Inconsistent naming** - Hard to search logs
5. **Missing documentation** - No runbooks

## Actionable Recommendations Template

For each gap identified, provide:

```markdown
### Gap: [Description]
**Severity:** Critical/High/Medium/Low
**Location:** [File:Line or Pattern]
**Impact:** [What problems this causes]
**Recommendation:** [Specific fix]
**Code Example:**
[Before/After code snippet]
**Effort:** [Hours/Days estimate]
**Priority:** [1-5]
```

## Integration with AWS Observability

After identifying gaps, recommend:

1. **CloudWatch Logs**
   - Configure log groups per service
   - Set retention policies (7-30 days for cost optimization)
   - Enable log insights
   - Use metric filters for high-frequency counters

2. **CloudWatch Metrics**
   - Define custom metrics with limited dimensions
   - Set up dashboards
   - Configure alarms
   - Use EMF for Lambda functions

3. **OpenTelemetry + ADOT + Application Signals**
   - Integrate OpenTelemetry SDK (vendor-neutral)
   - Deploy ADOT Collector for trace aggregation
   - Enable AWS Application Signals for automatic APM
   - Configure sampling rules
   - Export to X-Ray, CloudWatch, or other backends
   - Set up service maps in X-Ray console
   - Use Application Signals dashboards for service health

4. **Application Signals (APM Layer)**
   - Enable for automatic service discovery
   - Define SLOs and track error budgets
   - Monitor service health (latency P50/P90/P99, error rates)
   - Correlate traces with metrics and logs
   - Use pre-built dashboards for common patterns

## Best Practices Checklist

- [ ] Structured logging with JSON format
- [ ] Correlation IDs in all logs
- [ ] Error logging with stack traces
- [ ] Metrics for key operations
- [ ] Distributed tracing with X-Ray
- [ ] Health check endpoints
- [ ] Graceful error handling
- [ ] No sensitive data in logs
- [ ] Log levels used appropriately
- [ ] Request/response logging
- [ ] Business metrics tracked
- [ ] Performance metrics collected
- [ ] Error rates monitored
- [ ] Trace context propagated
- [ ] Sampling strategy defined

## Example Analysis Output

```markdown
# Observability Analysis Report

## Summary
- **Files Analyzed:** 45
- **Critical Gaps:** 3
- **High Priority Gaps:** 8
- **Medium Priority Gaps:** 12
- **Low Priority Gaps:** 5

## Critical Gaps

### 1. Missing Error Logging in Payment Handler
**Severity:** Critical
**Location:** src/handlers/payment.py:45-60
**Impact:** Payment failures are not logged, making debugging impossible
**Recommendation:** Add structured error logging with full context
**Code Example:**
```python
# Before
try:
    process_payment(order)
except:
    pass

# After
try:
    process_payment(order)
except Exception as e:
    logger.error("payment_processing_failed", 
                 order_id=order.id,
                 error=str(e),
                 exc_info=True)
    raise
```
**Effort:** 2 hours
**Priority:** 1

[Continue for all gaps...]
```

---

**Remember**: Focus on actionable, specific recommendations with code examples. Prioritize by business impact and implementation effort.

## Performance Monitoring

# Application Signals Performance Monitoring Steering

## Purpose
This steering file provides guidance for using AWS CloudWatch Application Signals to monitor application performance, health, and dependencies.

## Application Signals Overview

Application Signals provides automatic instrumentation for application performance monitoring with:
- **Service-level metrics**: Latency, error rate, request volume
- **Distributed tracing**: End-to-end request flows with X-Ray
- **Service maps**: Visual representation of dependencies
- **SLOs**: Define and track service level objectives
- **Automatic discovery**: No code changes required for common frameworks

## Core Concepts

### 1. Services
A service represents a logical component of your application:
- Microservice
- Lambda function
- API endpoint
- Database connection

### 2. Operations
Operations are specific actions within a service:
- API endpoints
- Database queries
- External service calls
- Message queue operations

### 3. Service Level Objectives (SLOs)
Define expected service performance:
- **Availability SLO**: % of successful requests
- **Latency SLO**: % of requests under threshold
- **Custom SLO**: Based on specific metrics

### 4. Traces
End-to-end view of request flows:
- Trace ID: Unique identifier for request
- Spans: Individual operations within trace
- Annotations: Metadata and custom data
- Subsegments: Nested operations

## Common Monitoring Tasks

### Task 1: View Service Health
Check overall health of a service:

```
Operation: List services
Filters: 
  - Time range: Last 1 hour
  - Status: All / Healthy / Degraded / Unhealthy

Metrics to check:
  - Request count
  - Error rate
  - Average latency
  - P99 latency
```

### Task 2: Analyze Service Dependencies
Understand how services interact:

```
Operation: Get service map
Service: [target-service-name]
Time range: Last 24 hours

Look for:
  - Downstream dependencies
  - Upstream callers
  - External services
  - Database connections
  - Bottlenecks (high latency links)
```

### Task 3: Investigate Performance Issues
When latency increases or errors spike:

```
1. Check service metrics:
   - Compare current vs baseline latency
   - Identify error rate changes
   - Check request volume

2. Examine traces:
   - Filter by slow traces (p99)
   - Look for common patterns
   - Identify slowest operations

3. Analyze dependencies:
   - Check downstream service health
   - Identify external API issues
   - Review database query performance
```

### Task 4: Set Up SLOs
Define service level objectives:

```
Availability SLO Example:
  - Name: "API Availability"
  - Target: 99.9%
  - Evaluation period: 30 days
  - Metric: Success rate
  - Threshold: statusCode < 500

Latency SLO Example:
  - Name: "API Response Time"
  - Target: 95%
  - Evaluation period: 7 days
  - Metric: Request duration
  - Threshold: duration < 500ms
```

## Application Signals MCP Server Tools

### Primary Audit Tools (Recommended Entry Points)

1. **audit_services** ⭐: Comprehensive service health auditing with wildcard support
2. **audit_slos** ⭐: SLO compliance monitoring and breach analysis
3. **audit_service_operations** ⭐: Operation-specific performance analysis (GET, POST, etc.)

### Service Discovery Tools

4. **list_monitored_services**: Get all monitored services
5. **get_service_detail**: Get metadata and configuration for a specific service
6. **list_service_operations**: List recently invoked operations within a service (max 24h lookback)

### SLO Management Tools

7. **list_slos**: View configured SLOs
8. **get_slo**: Get detailed SLO configuration
9. **list_slis**: Legacy SLI status report with breach summary

### Metrics Tools

10. **query_service_metrics**: Retrieve metrics for a specific service (Latency, Error, Fault)

### Trace & Log Analysis Tools

11. **search_transaction_spans**: Query OpenTelemetry spans (100% sampled) via CloudWatch Logs Insights
12. **query_sampled_traces**: Query X-Ray traces (5% sampled) with filter expressions

### Canary, Change Events & Enablement Tools

13. **analyze_canary_failures**: Root cause investigation for CloudWatch Synthetics canaries
14. **list_change_events**: Query change events (deployments, config changes) to correlate with performance issues. Supports `comprehensive_history=True` (ListEntityEvents API, requires `service_key_attributes`) for full change history, or `comprehensive_history=False` (ListServiceStates API) for current service state.
15. **get_enablement_guide**: Step-by-step Application Signals setup instructions

### Target Format Reference

Audit tools require JSON target arrays. Examples:

**All services:**
```json
[{"Type":"service","Data":{"Service":{"Type":"Service","Name":"*"}}}]
```

**Wildcard pattern (e.g., payment services):**
```json
[{"Type":"service","Data":{"Service":{"Type":"Service","Name":"*payment*"}}}]
```

**Specific service:**
```json
[{"Type":"service","Data":{"Service":{"Type":"Service","Name":"checkout-service","Environment":"eks:prod-cluster"}}}]
```

**All SLOs:**
```json
[{"Type":"slo","Data":{"Slo":{"SloName":"*"}}}]
```

**Operation targets (e.g., GET operations, Latency):**
```json
[{"Type":"service_operation","Data":{"ServiceOperation":{"Service":{"Type":"Service","Name":"*payment*"},"Operation":"*GET*","MetricType":"Latency"}}}]
```

MetricType options: `Latency`, `Availability`, `Fault`, `Error`

### Auditor Selection Guide

| Scenario | Auditors |
|----------|----------|
| Quick health check | Default (omit parameter) |
| Root cause analysis | `all` |
| SLO breach investigation | `all` |
| Error investigation | `log,trace` |
| Dependency issues | `dependency_metric,trace` |
| Find outlier hosts | `top_contributor,operation_metric` |
| Quota monitoring | `service_quota,operation_metric` |

The 7 auditor types: `slo`, `operation_metric`, `trace`, `log`, `dependency_metric`, `top_contributor`, `service_quota`

### Transaction Search Query Patterns

Use with `search_transaction_spans` (100% sampled, queries `aws/spans` log group):

**Error analysis:**
```
FILTER attributes.aws.local.service = "service-name"
  and attributes.http.status_code >= 400
| STATS count() as error_count by attributes.aws.local.operation
| SORT error_count DESC
| LIMIT 20
```

**Latency analysis:**
```
FILTER attributes.aws.local.service = "service-name"
| STATS avg(duration) as avg_latency,
        pct(duration, 99) as p99_latency
  by attributes.aws.local.operation
| SORT p99_latency DESC
| LIMIT 20
```

**Dependency calls:**
```
FILTER attributes.aws.local.service = "service-name"
| STATS count() as call_count, avg(duration) as avg_latency
  by attributes.aws.remote.service, attributes.aws.remote.operation
| SORT call_count DESC
| LIMIT 20
```

**GenAI token usage:**
```
FILTER attributes.aws.local.service = "service-name"
  and attributes.aws.remote.operation = "InvokeModel"
| STATS sum(attributes.gen_ai.usage.output_tokens) as total_tokens
  by attributes.gen_ai.request.model, bin(1h)
```

### X-Ray Filter Expressions

Use with `query_sampled_traces` (5% sampled):

```
# Faults for a service
service("service-name"){fault = true}

# Slow requests
service("service-name") AND duration > 5

# Specific operation
annotation[aws.local.operation]="GET /api/orders"

# HTTP errors
http.status = 500

# Combined
service("api"){fault = true} AND annotation[aws.local.operation]="POST /checkout"
```

### Pagination (`next_token`) Guidance

Wildcard patterns process services/SLOs in batches (default: 5 per call):
1. First call returns findings + `next_token` if more results exist
2. Continue with same parameters + `next_token` to process remaining
3. Repeat until no `next_token` is returned

### Tool Usage Patterns

#### Pattern 1: Service Health Check
```
1. Audit all services:
   audit_services(
     service_targets='[{"Type":"service","Data":{"Service":{"Type":"Service","Name":"*"}}}]'
   )

2. For services with issues, deep dive:
   audit_services(
     service_targets='[{"Type":"service","Data":{"Service":{"Type":"Service","Name":"problem-service"}}}]',
     auditors="all"
   )

3. Review findings and follow recommendations
```

#### Pattern 2: Latency Investigation
```
1. Audit operations for latency:
   audit_service_operations(
     operation_targets='[{"Type":"service_operation","Data":{"ServiceOperation":{"Service":{"Type":"Service","Name":"service-name"},"Operation":"*","MetricType":"Latency"}}}]'
   )

2. Get detailed metrics:
   query_service_metrics(
     service_name="service-name",
     metric_name="Latency",
     statistic="Average",
     extended_statistic="p99"
   )

3. Search 100% sampled traces for slow requests:
   search_transaction_spans(
     query_string='FILTER attributes.aws.local.service = "service-name"
       | STATS avg(duration) as avg_latency, pct(duration, 99) as p99
         by attributes.aws.local.operation
       | SORT p99 DESC | LIMIT 20'
   )
```

#### Pattern 3: Dependency Analysis
```
1. Audit service with dependency auditor:
   audit_services(
     service_targets='[{"Type":"service","Data":{"Service":{"Type":"Service","Name":"service-name"}}}]',
     auditors="dependency_metric,trace"
   )

2. For each dependency, check metrics:
   query_service_metrics(
     service_name="dependency-name",
     metric_name="Latency"
   )
```

#### Pattern 4: SLO Monitoring
```
1. Audit all SLOs:
   audit_slos(
     slo_targets='[{"Type":"slo","Data":{"Slo":{"SloName":"*"}}}]'
   )

2. For breached SLOs, get configuration:
   get_slo(slo_id="breached-slo-name")

3. Deep dive with root cause analysis:
   audit_slos(
     slo_targets='[{"Type":"slo","Data":{"Slo":{"SloName":"breached-slo-name"}}}]',
     auditors="all"
   )
```

## Performance Metrics Reference

### Request Metrics
- **RequestCount**: Total number of requests
- **SuccessCount**: Number of successful requests (statusCode < 400)
- **FaultCount**: Number of server errors (statusCode >= 500)
- **ErrorCount**: Number of client errors (400 <= statusCode < 500)

### Latency Metrics
- **Duration**: Request processing time
- **P50**: 50th percentile latency (median)
- **P90**: 90th percentile latency
- **P95**: 95th percentile latency
- **P99**: 99th percentile latency
- **P99.9**: 99.9th percentile latency

### Rate Metrics
- **ErrorRate**: (ErrorCount / RequestCount) * 100
- **FaultRate**: (FaultCount / RequestCount) * 100
- **SuccessRate**: (SuccessCount / RequestCount) * 100

### Throughput Metrics
- **RequestsPerSecond**: RequestCount / time_window
- **BytesIn**: Incoming payload size
- **BytesOut**: Outgoing response size

## Distributed Tracing Analysis

### Trace Structure
```
Trace (Request ID: abc123)
├── Root Span: API Gateway Request
│   ├── Span: Lambda Execution
│   │   ├── Subsegment: DynamoDB Query
│   │   ├── Subsegment: S3 GetObject
│   │   └── Subsegment: External API Call
│   └── Span: Response Processing
```

### Analyzing Traces

**Look for**:
1. **Long spans**: Operations taking significant time
2. **Sequential calls**: Opportunities for parallelization
3. **Repeated operations**: Caching opportunities
4. **External dependencies**: Third-party service issues
5. **Error spans**: Failed operations and exceptions

**Common Patterns**:

```
Pattern: N+1 Query Problem
└── Multiple sequential database queries
    Solution: Use batch operations or caching

Pattern: Sequential External Calls
└── External API calls in sequence
    Solution: Parallelize independent calls

Pattern: Long Cold Start
└── Lambda initialization taking > 1s
    Solution: Provisioned concurrency or runtime optimization

Pattern: Downstream Service Timeout
└── Waiting for slow dependency
    Solution: Circuit breaker, timeout adjustment
```

## SLO Configuration Best Practices

### Availability SLOs

**Example 1: High-Availability Service**
```
Name: "Critical API Availability"
Target: 99.95%
Evaluation period: 30 days
Metric: (SuccessCount / RequestCount) * 100
Threshold: >= 99.95%

Alert when:
  - SLO at risk: Error budget < 20%
  - SLO breach: < 99.95%
```

**Example 2: Standard Service**
```
Name: "Standard API Availability"
Target: 99.9%
Evaluation period: 7 days
Metric: Success rate
Threshold: >= 99.9%
```

### Latency SLOs

**Example 1: User-Facing API**
```
Name: "API Response Time"
Target: 95% of requests < 500ms
Evaluation period: 7 days
Metric: Duration P95
Threshold: < 500ms

Rationale: Users expect fast responses
```

**Example 2: Background Processing**
```
Name: "Batch Job Latency"
Target: 99% of jobs < 30s
Evaluation period: 30 days
Metric: Duration P99
Threshold: < 30000ms

Rationale: Less critical than user-facing
```

### Custom SLOs

**Example: Data Freshness**
```
Name: "Data Pipeline Freshness"
Target: 99% of updates < 5 minutes old
Evaluation period: 24 hours
Metric: Custom metric (data_age)
Threshold: < 300000ms
```

## Performance Troubleshooting Workflows

### Workflow 1: High Error Rate

**Steps**:
1. Identify service with high error rate
2. Get error breakdown by operation
3. Sample error traces
4. Analyze error patterns:
   - Client errors (4xx): Input validation, auth issues
   - Server errors (5xx): Application bugs, dependency failures
5. Check dependencies for issues
6. Review recent deployments
7. Check CloudWatch Logs for detailed error messages

**Logs Insights Query for Error Analysis**:
```
# Analyze errors by endpoint and status code
fields @timestamp, endpoint, statusCode, errorType
| filter statusCode >= 400
| stats count(*) as errorCount by endpoint, statusCode
| sort errorCount desc
| limit 20
```

### Workflow 2: Increased Latency

**Steps**:
1. Compare current P95/P99 vs baseline
2. Identify slow operations
3. Analyze slow traces:
   - Which spans are slowest?
   - Are downstream services slow?
   - Database query performance?
4. Check for:
   - Increased load (scale out)
   - Code changes (rollback if needed)
   - Dependency issues (circuit breaker)
   - Resource constraints (CPU, memory)
5. Correlate with Application Signals service map

**Logs Insights Query for Latency Analysis**:
```
# Analyze latency by endpoint
fields @timestamp, endpoint, duration
| filter ispresent(duration)
| stats count(*) as requestCount, 
        avg(duration) as avgDuration,
        pct(duration, 95) as p95,
        pct(duration, 99) as p99,
        max(duration) as maxDuration 
  by endpoint
| sort p95 desc
| limit 20
```

### Workflow 3: SLO Breach Investigation

**Steps**:
1. Identify which SLO was breached
2. Determine time of breach
3. Get metrics during breach period:
   - Error rate spike?
   - Latency increase?
   - Traffic surge?
4. Check for correlated events:
   - Deployments (CloudTrail - use data source priority)
   - Infrastructure changes
   - Dependency failures
5. Review traces from breach period
6. Document root cause
7. Update runbooks

## Integration with Other Observability Tools

### CloudWatch Logs
Use Logs Insights queries to correlate Application Signals metrics with logs:

```
# Find slow requests with trace correlation
fields @timestamp, @message, requestId, traceId, duration, level
| filter duration > 1000
| sort duration desc
| limit 100
```

### CloudTrail
Check for recent changes that might affect performance:
```
Follow CloudTrail data source priority (see cloudtrail-data-source-selection.md):
1. Check CloudTrail Lake event data stores (preferred)
2. Check CloudWatch Logs for CloudTrail integration
3. Use CloudTrail Lookup Events API (fallback)

Query for:
- Recent deployments
- Configuration changes
- IAM policy updates
- Resource modifications
```

### X-Ray
Deep dive into specific traces:
```
1. Get trace IDs from Application Signals
2. Open X-Ray console for detailed analysis
3. Review service map and trace timeline
4. Check for errors and exceptions
5. Examine annotations and metadata
```

## Alerting Configuration

### Critical Alerts

**High Error Rate**:
```
Metric: ErrorRate
Threshold: > 5%
Evaluation period: 5 minutes
Datapoints to alarm: 3 of 5
Action: Page on-call engineer
```

**P99 Latency Breach**:
```
Metric: Duration P99
Threshold: > 2000ms
Evaluation period: 10 minutes
Datapoints to alarm: 2 of 2
Action: Notify team channel
```

**SLO At Risk**:
```
Metric: Error budget remaining
Threshold: < 20%
Evaluation period: 1 hour
Action: Notify team, consider feature freeze
```

### Warning Alerts

**Elevated Error Rate**:
```
Metric: ErrorRate
Threshold: > 1%
Evaluation period: 15 minutes
Action: Notify team channel
```

**P95 Latency Increase**:
```
Metric: Duration P95
Threshold: > 1000ms
Evaluation period: 15 minutes
Action: Log to monitoring channel
```

## Best Practices

### 1. Service Instrumentation
- Use AWS X-Ray SDK for custom instrumentation
- Add meaningful service names
- Include environment in service name (e.g., "api-prod")
- Use consistent naming conventions

### 2. SLO Management
- Start with realistic targets (99% before 99.99%)
- Align SLOs with business requirements
- Review and adjust quarterly
- Track error budget consumption
- Plan for error budget-based decisions

### 3. Trace Sampling
- Use adaptive sampling for high-volume services
- Always capture error traces
- Sample 100% of traces during incidents
- Include custom annotations for business context

### 4. Metric Collection
- Monitor latency percentiles (P50, P95, P99)
- Track error rates by type (4xx vs 5xx)
- Measure request volume trends
- Monitor dependency health

### 5. Performance Baselines
- Establish normal latency baselines
- Document expected error rates
- Track seasonal patterns
- Update baselines after optimization

## Common Performance Patterns

### Pattern 1: Cold Start Impact
**Symptom**: High P99 latency, spiky performance
**Detection**: Large gap between P50 and P99
**Solution**: Provisioned concurrency, keep-alive strategies

### Pattern 2: Database Connection Pooling
**Symptom**: Latency increases with load
**Detection**: Slow database spans in traces
**Solution**: Connection pooling, query optimization

### Pattern 3: Cascading Failures
**Symptom**: Multiple services showing errors simultaneously
**Detection**: Service map shows downstream failures
**Solution**: Circuit breakers, timeout configuration, bulkheads

### Pattern 4: Cache Invalidation
**Symptom**: Periodic latency spikes
**Detection**: Traces show increased database/API calls
**Solution**: Optimize cache strategy, cache warming

### Pattern 5: Traffic Bursts
**Symptom**: Error rate increases during peak load
**Detection**: Correlation between RequestCount and ErrorRate
**Solution**: Auto-scaling, rate limiting, queue buffering

## Quick Reference Commands

### Get Service Health
```
1. audit_services(service_targets='[{"Type":"service","Data":{"Service":{"Type":"Service","Name":"*"}}}]')
2. query_service_metrics(service_name="service-name", metric_name="Latency")
```

### Investigate Slow Request
```
1. search_transaction_spans(query_string='FILTER attributes.aws.local.service = "service-name" and duration > 5000 | LIMIT 20')
2. Analyze span durations from results
```

### Check Dependencies
```
1. audit_services(service_targets='[{"Type":"service","Data":{"Service":{"Type":"Service","Name":"service-name"}}}]', auditors="dependency_metric,trace")
```

### Monitor SLO
```
1. audit_slos(slo_targets='[{"Type":"slo","Data":{"Slo":{"SloName":"*"}}}]')
2. get_slo(slo_id="slo-name")
3. If breached: audit_slos(slo_targets='[{"Type":"slo","Data":{"Slo":{"SloName":"slo-name"}}}]', auditors="all")
```

---

**Remember**: Application Signals works best when services are properly instrumented and SLOs are aligned with business requirements. Always correlate metrics with traces and logs for complete visibility.

## Security Auditing

# CloudTrail Security Auditing Steering

## Purpose
This steering file provides guidance for accessing and analyzing CloudTrail audit data for security auditing, compliance monitoring, and governance analysis.

## Prerequisites and Data Source Selection

**IMPORTANT**: CloudTrail audit data can be accessed through multiple sources. Always follow the priority order defined in `cloudtrail-data-source-selection.md`:

### Priority 1: CloudTrail Lake (Preferred)
Check first for CloudTrail Lake event data stores using the CloudTrail MCP server:
- Use `list_event_data_stores` to check for enabled event data stores
- If available, use `lake_query` for SQL-based analysis
- Best for complex queries, long-term retention (7 years), and cost efficiency

### Priority 2: CloudWatch Logs (If CloudTrail Lake not available)
Check for CloudTrail integration with CloudWatch Logs:
- Use `describe_log_groups` to look for log groups containing "cloudtrail" in the name
- Common patterns: `/aws/cloudtrail/logs`, `/aws/cloudtrail/<trail-name>`, `CloudTrail/logs`
- Use `execute_log_insights_query` for CloudWatch Logs Insights analysis
- Good for real-time monitoring and CloudWatch Alarms integration

### Priority 3: CloudTrail Lookup Events API (Fallback)
If neither CloudTrail Lake nor CloudWatch Logs available:
- Use `lookup_events` from CloudTrail MCP server
- Limited to last 90 days of events
- Basic filtering with LookupAttributes
- Good for quick lookups but limited query capabilities

**See `cloudtrail-data-source-selection.md` for detailed decision tree and implementation workflow.**

## When to Load This Steering
Load this when the user needs to:
- Investigate security incidents
- Track API activity and resource changes
- Perform compliance audits
- Monitor IAM changes
- Detect unauthorized access attempts
- Generate audit reports
- Correlate security events with application logs

## CloudTrail Overview

CloudTrail provides governance, compliance, and audit capabilities by logging all API calls in your AWS account. When integrated with CloudWatch Logs, you can:

- **Real-time Analysis**: Query events as they arrive
- **CloudWatch Logs Insights**: Use powerful query syntax for complex analysis
- **Cross-Service Correlation**: Correlate CloudTrail events with application logs
- **Long-term Retention**: Configure retention policies in CloudWatch Logs
- **Multi-Region Support**: Capture events across all regions
- **Multi-Account Support**: Aggregate logs from organization

## Core Concepts

### Event Types

**1. Management Events**
- Control plane operations
- Resource creation, modification, deletion
- IAM changes
- Security group modifications
- Examples: CreateBucket, RunInstances, CreateUser

**2. Data Events**
- Data plane operations
- S3 object-level operations
- Lambda function invocations
- DynamoDB table operations
- Examples: GetObject, PutObject, Invoke

**3. Insights Events**
- Unusual API activity detected by ML
- Rate-based anomalies
- Error rate anomalies
- Requires CloudTrail Insights enabled

### Event Structure

CloudTrail events in CloudWatch Logs contain these key fields:

```json
{
  "eventTime": "2024-12-08T10:30:00Z",
  "eventName": "CreateBucket",
  "eventSource": "s3.amazonaws.com",
  "userIdentity": {
    "type": "IAMUser",
    "principalId": "AIDAI...",
    "arn": "arn:aws:iam::123456789012:user/alice",
    "userName": "alice"
  },
  "sourceIPAddress": "203.0.113.0",
  "userAgent": "aws-cli/2.0.0",
  "requestParameters": {
    "bucketName": "my-new-bucket"
  },
  "responseElements": {
    "location": "https://my-new-bucket.s3.amazonaws.com/"
  },
  "errorCode": null,
  "errorMessage": null
}
```

## Querying CloudTrail Data

### Using CloudTrail Lake (Priority 1)

When CloudTrail Lake event data store is available, use SQL-based queries:

**Tool**: `lake_query` from CloudTrail MCP server

**Example Query:**
```sql
SELECT 
    eventTime,
    eventName,
    userIdentity.userName,
    sourceIPAddress,
    requestParameters
FROM <event_data_store_id>
WHERE eventName IN ('DeleteBucket', 'TerminateInstances')
    AND eventTime > timestamp '2024-01-01 00:00:00'
ORDER BY eventTime DESC
LIMIT 50
```

**Advantages**:
- Full SQL support with JOINs, aggregations, and window functions
- 7-year retention by default
- Cross-account and cross-region queries
- Cost-effective for large-scale analysis
- Advanced filtering and partitioning

### Using CloudWatch Logs (Priority 2)

When CloudTrail is integrated with CloudWatch Logs:

**Tool**: `execute_log_insights_query` from CloudWatch MCP server

**Example Query:**
```
fields eventTime, eventName, userIdentity.userName, sourceIPAddress, requestParameters
| filter eventName = "DeleteBucket" or eventName = "TerminateInstances"
| sort eventTime desc
| limit 50
```

**Query Parameters:**
```
- log_group_names: ["/aws/cloudtrail/logs"]  # Or your CloudTrail log group name
- query_string: CloudWatch Logs Insights query (see above)
- start_time: ISO 8601 format (e.g., "2024-01-01T00:00:00Z")
- end_time: ISO 8601 format
- limit: 50 (or as needed)
```

**Advantages**:
- Real-time event streaming
- CloudWatch Alarms integration
- Cross-service log correlation
- Familiar CloudWatch interface

### Using Lookup Events API (Priority 3 - Fallback)

When neither CloudTrail Lake nor CloudWatch Logs available:

**Tool**: `lookup_events` from CloudTrail MCP server

**Example Usage:**
```
lookup_events(
    LookupAttributes=[
        {
            'AttributeKey': 'EventName',
            'AttributeValue': 'DeleteBucket'
        }
    ],
    StartTime='2024-01-01T00:00:00Z',
    EndTime='2024-12-31T23:59:59Z',
    MaxResults=50
)
```

**Limitations**:
- Only last 90 days of events
- Limited to 50 results per API call
- Basic filtering capabilities
- No SQL or complex query support

#### Pattern 2: Security Incident Investigation
```
# 1. Identify suspicious activity (failed access attempts)
fields eventTime, eventName, userIdentity.userName, sourceIPAddress, errorCode, errorMessage
| filter errorCode = "AccessDenied" or errorCode = "UnauthorizedOperation"
| sort eventTime desc
| limit 100

# 2. Trace user activity
fields eventTime, eventName, requestParameters, responseElements
| filter userIdentity.userName = "suspect-user"
| sort eventTime desc
| limit 100

# 3. Check IAM changes before incident
fields eventTime, eventName, userIdentity.userName, requestParameters
| filter eventSource = "iam.amazonaws.com"
| filter eventName like /Create|Delete|Update|Attach|Detach/
| sort eventTime desc
| limit 50
```


#### Pattern 3: Compliance Audit
```
# 1. List all IAM changes
fields eventTime, eventName, userIdentity.userName, userIdentity.principalId, requestParameters
| filter eventSource = "iam.amazonaws.com"
| filter eventName like /Create|Delete|Update|Attach|Detach/
| sort eventTime desc
| limit 100

# 2. Track privileged actions
fields eventTime, eventName, userIdentity.userName, userIdentity.sessionContext.sessionIssuer.userName, requestParameters
| filter eventName = "AssumeRole" or eventName = "GetFederationToken"
| sort eventTime desc
| limit 100

# 3. Review resource deletions
fields eventTime, eventName, userIdentity.userName, requestParameters, responseElements
| filter eventName like /Delete|Terminate/
| sort eventTime desc
| limit 100
```

#### Pattern 4: Resource Change Tracking
```
# 1. Find specific resource changes (replace with actual resource ARN)
fields eventTime, eventName, userIdentity.userName, requestParameters, responseElements
| filter requestParameters like /arn:aws:s3:::my-bucket/
| sort eventTime desc
| limit 50

# 2. Track configuration changes for a service
fields eventTime, eventName, userIdentity.userName, requestParameters
| filter eventSource = "ec2.amazonaws.com"
| filter eventName like /Update|Modify|Put/
| sort eventTime desc
| limit 100
```

## Security Monitoring Use Cases

### Use Case 1: Unauthorized Access Detection

**Indicators**:
- Failed authentication attempts
- Access from unusual IP addresses
- Access outside business hours
- Privilege escalation attempts

**CloudWatch Logs Insights Query**:
```
fields eventTime, eventName, userIdentity.userName, sourceIPAddress, errorCode, errorMessage
| filter (eventName = "ConsoleLogin" or eventName = "AssumeRole")
| filter errorCode like /AccessDenied|AuthFailure|UnauthorizedOperation/
| stats count() as failedAttempts by userIdentity.userName, sourceIPAddress
| sort failedAttempts desc
| limit 50
```

### Use Case 2: IAM Changes Audit

**Monitor for**:
- User/role creation and deletion
- Policy modifications
- Permission boundary changes
- Access key creation
- MFA changes

**CloudWatch Logs Insights Query**:
```
fields eventTime, eventName, userIdentity.userName as actor, requestParameters.userName as targetUser, requestParameters.policyName as policyName, sourceIPAddress
| filter eventSource = "iam.amazonaws.com"
| filter eventName in ["CreateUser", "DeleteUser", "CreateRole", "DeleteRole", "PutUserPolicy", "PutRolePolicy", "AttachUserPolicy", "AttachRolePolicy", "CreateAccessKey", "DeactivateMFADevice"]
| sort eventTime desc
| limit 100
```

**Aggregated IAM Changes**:
```
fields eventName, userIdentity.userName as actor
| filter eventSource = "iam.amazonaws.com"
| stats count() as changeCount by eventName, actor
| sort changeCount desc
| limit 50
```

### Use Case 3: Resource Deletion Tracking

**Monitor deletions of**:
- S3 buckets
- EC2 instances
- RDS databases
- Lambda functions
- DynamoDB tables

**CloudWatch Logs Insights Query**:
```
fields eventTime, eventName, userIdentity.userName, requestParameters, sourceIPAddress
| filter eventName like /Delete|Terminate/
| sort eventTime desc
| limit 100
```

**Deletion Summary by Service**:
```
fields eventSource, eventName
| filter eventName like /Delete|Terminate/
| stats count() as deletionCount by eventSource, eventName
| sort deletionCount desc
| limit 50
```

### Use Case 4: Security Group Changes

**Monitor**:
- New security group rules
- Overly permissive rules (0.0.0.0/0)
- Rule deletions

**CloudWatch Logs Insights Query**:
```
fields eventTime, eventName, userIdentity.userName as user, requestParameters.groupId as securityGroupId, requestParameters, sourceIPAddress
| filter eventSource = "ec2.amazonaws.com"
| filter eventName in ["AuthorizeSecurityGroupIngress", "AuthorizeSecurityGroupEgress", "RevokeSecurityGroupIngress", "RevokeSecurityGroupEgress"]
| sort eventTime desc
| limit 100
```

**Check for Overly Permissive Rules**:
```
fields eventTime, eventName, userIdentity.userName, requestParameters
| filter eventName = "AuthorizeSecurityGroupIngress"
| filter requestParameters like /0.0.0.0\/0/
| sort eventTime desc
| limit 50
```

### Use Case 5: Root Account Activity

**Critical to Monitor**:
- Root account usage should be rare
- MFA should always be used
- All root actions should be justified

**CloudWatch Logs Insights Query**:
```
fields eventTime, eventName, eventSource, userIdentity.type as userType, sourceIPAddress, userIdentity.sessionContext.attributes.mfaAuthenticated as mfaUsed
| filter userIdentity.type = "Root"
| sort eventTime desc
| limit 100
```

**Root Account Activity Summary**:
```
fields eventName, eventSource
| filter userIdentity.type = "Root"
| stats count() as actionCount by eventName, eventSource
| sort actionCount desc
| limit 50
```

### Use Case 6: Cross-Account Access

**Monitor**:
- AssumeRole calls from external accounts
- Cross-account resource access
- Federated user activity

**CloudWatch Logs Insights Query**:
```
fields eventTime, eventName, userIdentity.principalId, userIdentity.accountId, recipientAccountId, requestParameters, sourceIPAddress
| filter eventName = "AssumeRole"
| filter userIdentity.accountId != recipientAccountId
| sort eventTime desc
| limit 100
```

**AssumeRole Activity Summary**:
```
fields userIdentity.accountId as sourceAccount, recipientAccountId as targetAccount, requestParameters.roleArn
| filter eventName = "AssumeRole"
| stats count() as assumeCount by sourceAccount, targetAccount, requestParameters.roleArn
| sort assumeCount desc
| limit 50
```


## Incident Investigation Workflows

### Workflow 1: Suspicious IAM Activity

**Scenario**: Alert for unusual IAM activity

**Investigation Steps**:

1. **Identify the event**:
   ```
   fields eventTime, eventName, userIdentity.userName, requestParameters, sourceIPAddress
   | filter eventSource = "iam.amazonaws.com"
   | sort eventTime desc
   | limit 100
   ```

2. **Trace user activity**:
   ```
   # Trace all activity for suspect user
   fields eventTime, eventName, eventSource, sourceIPAddress, userAgent
   | filter userIdentity.userName = "suspect-user"
   | sort eventTime asc
   | limit 500
   ```

3. **Check for privilege escalation**:
   ```
   # Check for privilege escalation attempts
   fields eventTime, eventName, requestParameters.policyDocument as policy, requestParameters
   | filter userIdentity.userName = "suspect-user"
   | filter eventName in ["CreatePolicy", "AttachUserPolicy", "PutUserPolicy", "AttachRolePolicy", "PutRolePolicy"]
   | sort eventTime asc
   | limit 100
   ```

4. **Identify affected resources**:
   ```
   # Find resources accessed by suspect user
   fields eventName, eventSource, requestParameters
   | filter userIdentity.userName = "suspect-user"
   | stats count() as accessCount by eventName, eventSource
   | sort accessCount desc
   | limit 100
   ```

5. **Check access key usage**:
   ```
   fields eventTime, eventName, requestParameters.userName as targetUser, requestParameters.accessKeyId
   | filter eventName = "CreateAccessKey"
   | filter userIdentity.userName = "suspect-user" or requestParameters.userName = "suspect-user"
   | sort eventTime desc
   | limit 50
   ```

### Workflow 2: Resource Deletion Investigation

**Scenario**: Critical resource was deleted

**Investigation Steps**:

1. **Find the deletion event**:
   ```
   fields eventTime, eventName, userIdentity.userName, requestParameters, sourceIPAddress
   | filter eventName like /Delete|Terminate/
   | sort eventTime desc
   | limit 100
   ```

2. **Identify who deleted it**:
   ```
   fields eventTime, userIdentity.userName, userIdentity.principalId, userIdentity.arn, sourceIPAddress, userAgent
   | filter eventName = "DeleteBucket"  # Replace with actual deletion event
   | filter requestParameters.bucketName = "my-critical-bucket"  # Replace with actual resource
   | sort eventTime desc
   | limit 10
   ```

3. **Check user's recent activity**:
   ```
   fields eventTime, eventName, eventSource, sourceIPAddress
   | filter userIdentity.userName = "user-who-deleted"
   | filter eventName in ["ConsoleLogin", "GetSessionToken", "AssumeRole"]
   | sort eventTime desc
   | limit 10
   ```

4. **Check for automation**:
   ```
   fields eventTime, userAgent, sourceIPAddress
   | filter userIdentity.userName = "user-who-deleted"
   | stats count() as eventCount by userAgent
   | sort eventCount desc
   ```
   Look at userAgent field:
   - `aws-cli/*` indicates CLI usage
   - `Boto3/*` indicates Python SDK usage
   - `aws-sdk-*` indicates SDK usage
   - Check if expected for this user

### Workflow 3: Compliance Audit

**Scenario**: Quarterly compliance audit

**Audit Tasks**:

1. **IAM User Audit**:
   ```
   # List all users created in the audit period
   fields eventTime, eventName, userIdentity.userName as creator, requestParameters.userName as newUser
   | filter eventName = "CreateUser"
   | sort eventTime asc
   | limit 500
   ```

2. **Access Key Rotation**:
   ```
   # Find access keys created in the audit period
   fields eventTime, requestParameters.userName as user, responseElements.accessKey.accessKeyId as keyId
   | filter eventName = "CreateAccessKey"
   | sort eventTime asc
   | limit 500
   ```

3. **Policy Changes**:
   ```
   # Track policy modifications
   fields eventTime, eventName, userIdentity.userName as actor, requestParameters.policyName as policy
   | filter eventName in ["CreatePolicy", "CreatePolicyVersion", "DeletePolicy", "DeletePolicyVersion"]
   | sort eventTime asc
   | limit 500
   ```

4. **Encryption Changes**:
   ```
   # Track KMS key operations
   fields eventTime, eventName, userIdentity.userName as user, requestParameters.keyId as keyId
   | filter eventSource = "kms.amazonaws.com"
   | filter eventName in ["CreateKey", "ScheduleKeyDeletion", "DisableKey", "EnableKeyRotation"]
   | sort eventTime asc
   | limit 500
   ```

## Security Alerting Patterns

### Critical Alerts

**1. Root Account Usage**
```
# Alert: Root account activity
fields eventTime, eventName, sourceIPAddress, userIdentity.sessionContext.attributes.mfaAuthenticated as mfaUsed
| filter userIdentity.type = "Root"
| sort eventTime desc
| limit 50
```
**Action**: Page security team immediately

**2. IAM Policy Modifications**
```
# Alert: IAM policy modifications
fields eventTime, eventName, userIdentity.userName as user, requestParameters.policyDocument as policy, requestParameters
| filter eventName in ["PutUserPolicy", "PutRolePolicy", "AttachUserPolicy", "AttachRolePolicy"]
| sort eventTime desc
| limit 50
```
**Action**: Review policy changes, alert if suspicious

**3. Security Group Opening to Internet**
```
# Alert: Security group opened to 0.0.0.0/0
fields eventTime, userIdentity.userName as user, requestParameters
| filter eventName = "AuthorizeSecurityGroupIngress"
| filter requestParameters like /0.0.0.0\/0/
| sort eventTime desc
| limit 50
```
**Action**: Verify business justification

**4. KMS Key Deletion Scheduled**
```
# Alert: KMS key scheduled for deletion
fields eventTime, userIdentity.userName as user, requestParameters.keyId as keyId
| filter eventName = "ScheduleKeyDeletion"
| sort eventTime desc
| limit 50
```
**Action**: Confirm key is no longer needed

## Cross-Service Correlation

### Correlate CloudTrail with Application Logs

One of the key advantages of using CloudWatch Logs for CloudTrail is the ability to correlate security events with application behavior. While CloudWatch Logs Insights doesn't support JOINs across log groups in a single query, you can:

1. **Query CloudTrail for security events**
2. **Extract timestamps and user information**
3. **Query application logs for the same time period**
4. **Correlate results manually or programmatically**

**Example Workflow**:
```
# Step 1: Find IAM policy changes
fields eventTime, eventName, userIdentity.userName, requestParameters
| filter eventSource = "iam.amazonaws.com"
| filter eventName like /Policy/
| sort eventTime desc
| limit 50

# Step 2: Use the timestamps from above to query application logs
# Query application logs for errors after the policy change time
fields @timestamp, level, message
| filter level = "ERROR"
| filter @timestamp > "2024-01-01T10:00:00Z"  # Use timestamp from Step 1
| sort @timestamp desc
| limit 100
```

## Best Practices

### 1. Trail Configuration
- Enable CloudTrail in all regions
- Enable for all accounts (AWS Organizations)
- Enable log file validation
- **Configure CloudTrail to send events to CloudWatch Logs**
- Set up S3 lifecycle policies for cost optimization

### 2. Monitoring
- Set up CloudWatch Alarms for critical events
- Create metric filters for suspicious patterns
- Regular review of CloudTrail Insights
- Automate response to known threats
- Use CloudWatch Logs Insights for real-time analysis

### 3. Analysis
- Use CloudWatch Logs Insights for complex queries
- Correlate CloudTrail with application logs using time-based analysis
- Build CloudWatch Dashboards for security metrics
- Regular audit log reviews with saved queries

### 4. Retention
- Configure CloudWatch Logs retention for CloudTrail log groups
- Keep CloudTrail logs for required compliance period
- Consider separate retention for security events
- Archive to S3/Glacier for cost optimization
- Ensure immutability (S3 Object Lock for S3 archives)

### 5. Access Control
- Restrict access to CloudTrail log groups
- Use IAM policies to control CloudWatch Logs access
- Enable CloudWatch Logs encryption
- Monitor access to CloudTrail logs using CloudTrail itself

## Integration with Other Observability Tools

### CloudWatch Logs Insights
CloudTrail events in CloudWatch Logs enable:
- Real-time alerting with CloudWatch Alarms
- Complex queries for security analysis
- Time-based correlation with application logs
- Dashboard visualization with CloudWatch Dashboards

### Application Signals
Correlate CloudTrail security events with Application Signals service health:
- Track deployments that caused security policy changes
- Correlate IAM changes with service performance degradation
- Identify security events during SLO breaches

### AWS Security Hub
```
Security Hub integrates with CloudTrail for:
- Centralized security findings
- Compliance standard mapping
- Multi-account aggregation
- Automated remediation
```

### GuardDuty
```
GuardDuty uses CloudTrail for:
- Threat detection
- Unusual API activity
- Compromised credentials
- Cryptocurrency mining
```

## Quick Reference

### Common Event Names
- **IAM**: CreateUser, DeleteUser, AttachUserPolicy, CreateAccessKey
- **EC2**: RunInstances, TerminateInstances, AuthorizeSecurityGroupIngress
- **S3**: CreateBucket, DeleteBucket, PutBucketPolicy
- **RDS**: CreateDBInstance, DeleteDBInstance, ModifyDBInstance
- **Lambda**: CreateFunction, DeleteFunction, UpdateFunctionCode

### User Identity Types
- **IAMUser**: Standard IAM user
- **AssumedRole**: Assumed role via STS
- **Root**: Root account
- **FederatedUser**: Federated identity
- **AWSService**: AWS service acting on your behalf

### Error Codes
- **AccessDenied**: Permission denied
- **UnauthorizedOperation**: Not authorized for operation
- **InvalidParameter**: Invalid request parameter
- **ResourceNotFound**: Resource doesn't exist

### Common CloudWatch Logs Insights Filters

```
# Filter by event source
| filter eventSource = "iam.amazonaws.com"

# Filter by event name pattern
| filter eventName like /Delete|Terminate/

# Filter by user
| filter userIdentity.userName = "specific-user"

# Filter by error codes
| filter errorCode in ["AccessDenied", "UnauthorizedOperation"]

# Filter by IP address
| filter sourceIPAddress = "203.0.113.0"

# Filter by time range (in query, not tool parameters)
| filter eventTime > "2024-01-01T00:00:00Z"
```

---

**Remember**: CloudTrail security auditing via CloudWatch Logs provides real-time analysis and time-based correlation with application logs. Always correlate CloudTrail events with application logs and metrics for complete visibility. Configure CloudTrail → CloudWatch Logs integration first to enable these capabilities.
