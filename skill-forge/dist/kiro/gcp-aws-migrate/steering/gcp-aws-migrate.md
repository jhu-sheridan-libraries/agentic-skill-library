---
inclusion: manual
---
<!-- forge:version 0.1.0 -->

# GCP-to-AWS Migration Advisor

Migrate workloads from Google Cloud Platform to AWS with a 5-phase guided process: Terraform infrastructure discovery, requirements clarification, AWS architecture design, cost estimation, and execution planning. This no-cost tool assesses your current cloud provider's usage, geography, and billing data to estimate and compare AWS services and pricing, and recommends migration or continued use of your current provider. AWS pricing is based on current published pricing and may vary over time. The tool may generate a .migration folder containing comparison and migration execution data, which you may delete upon completion or use to migrate to AWS.


## Philosophy

- **Re-platform by default**: Select AWS services that match GCP workload types (e.g., Cloud Run → Fargate, Cloud SQL → RDS).
- **Dev sizing unless specified**: Default to development-tier capacity (e.g., db.t4g.micro, single AZ). Upgrade only on user direction.
- **Multi-signal approach**: Design phase adapts based on available inputs — Terraform IaC for infrastructure, billing data for service mapping, and app code for AI workload detection.

---

## Definitions

- **"Load"** = Read the file using the Read tool and follow its instructions. Do not summarize or skip sections.
- **`$MIGRATION_DIR`** = The run-specific directory under `.migration/` (e.g., `.migration/0226-1430/`). Set during Phase 1 (Discover).

---

## Prerequisites

**GCP sources** — User must provide at least one:

- **Terraform IaC**: `.tf` files (with optional `.tfvars`, `.tfstate`)
- **Application code**: Source files with GCP SDK or AI framework imports
- **Billing data**: GCP billing/cost/usage export files (CSV or JSON)

If none of the above are found, stop and ask user to provide at least one source type.

**AWS credentials** — Optional, improves cost estimation accuracy:

- The power uses `steering/cached-prices.md` as the primary pricing source (±5-10% for infra, ±15-25% for AI)
- When cached pricing is unavailable or stale, the power falls back to the AWS Pricing MCP server for live rates
- To enable the MCP fallback: configure valid AWS credentials locally (`aws configure` or `aws sso login`)
- Any AWS account with read-only access works — the AWS Pricing API is a public, read-only API and does not need to be the target migration account
- Required IAM permissions: `pricing:DescribeServices`, `pricing:GetAttributeValues`, `pricing:GetProducts`
- If neither cached pricing nor MCP is available, the Estimate phase will warn about reduced accuracy

---

## State Machine

This is the execution controller. After completing each phase, consult this table to determine the next action.

| Current State   | Condition | Next Action                     |
| --------------- | --------- | ------------------------------- |
| `start`         | always    | Load `steering/discover.md`     |
| `discover_done` | always    | Load `steering/clarify.md`      |
| `clarify_done`  | always    | Load `steering/design.md`       |
| `design_done`   | always    | Load `steering/estimate.md`     |
| `estimate_done` | always    | Load `steering/generate.md`     |
| `generate_done` | always    | Migration planning complete     |

**How to determine current state:** Read `$MIGRATION_DIR/.phase-status.json` → check `phases` object → find the last phase with value `"completed"`.

**Phase gate checks**: If prior phase incomplete, do not advance (e.g., cannot enter estimate without completed design).

**Feedback checkpoints**: Feedback is not a sequential phase — it is offered at two interleaved checkpoints (after Discover and after Estimate). See step 7 of **Workflow Execution** below for details.

---

## State Validation

When reading `$MIGRATION_DIR/.phase-status.json`, validate before proceeding:

1. **Multiple sessions**: If multiple directories exist under `.migration/`, list them with their phase status and ask: [A] Resume latest, [B] Start fresh, [C] Cancel.
2. **Invalid JSON**: If `.phase-status.json` fails to parse, STOP. Output: "State file corrupted (invalid JSON). Delete the file and restart the current phase."
3. **Unrecognized phase**: If `phases` object contains a phase not in {discover, clarify, design, estimate, generate, feedback}, STOP. Output: "Unrecognized phase: [value]. Valid phases: discover, clarify, design, estimate, generate, feedback."
4. **Unrecognized status**: If any `phases.*` is not in {pending, in_progress, completed}, STOP. Output: "Unrecognized status: [value]. Valid values: pending, in_progress, completed."

---

## State Management

Migration state lives in `$MIGRATION_DIR` (`.migration/[MMDD-HHMM]/`), created by Phase 1 and persisted across invocations.

**.phase-status.json schema:**

```json
{
  "migration_id": "0226-1430",
  "last_updated": "2026-02-26T15:35:22-05:00",
  "phases": {
    "discover": "completed",
    "clarify": "completed",
    "design": "in_progress",
    "estimate": "pending",
    "generate": "pending",
    "feedback": "pending"
  }
}
```

**Status values:** `"pending"` → `"in_progress"` → `"completed"`. Never goes backward.

The `.migration/` directory is automatically protected by a `.gitignore` file created in Phase 1.

---

## Phase Status Update Protocol

**Do not Read `.phase-status.json` before updating it.** You already know the current state because you are executing phases sequentially. Use the Write tool to write the **complete file** in the same turn as your final phase work (e.g., the output message announcing phase completion).

Example — after completing the Clarify phase, write `$MIGRATION_DIR/.phase-status.json` with:

```json
{
  "migration_id": "MMDD-HHMM",
  "last_updated": "2026-02-26T15:35:22-05:00",
  "phases": {
    "discover": "completed",
    "clarify": "completed",
    "design": "pending",
    "estimate": "pending",
    "generate": "pending",
    "feedback": "pending"
  }
}
```

Replace `MMDD-HHMM` with the actual migration ID, generate the `last_updated` ISO 8601 timestamp with local timezone offset yourself, and set each phase to its correct status at that point.

**Read `.phase-status.json` ONLY during session resume** (Step 0 of discover.md when checking for existing runs) or the feedback prerequisite check.

---

## File Writing Protocol

Many output files (JSON artifacts, Terraform configs, migration scripts) exceed 50 lines. When writing a file:

1. **If the content is 50 lines or fewer**: Write the entire file in a single operation.
2. **If the content exceeds 50 lines**: Write the first portion of the file (up to 50 lines), then append the remaining content in subsequent operations until the file is complete.
3. **Always verify**: After writing, confirm the file is valid (e.g., valid JSON for `.json` files). If the file was written in multiple parts, ensure no content was lost or duplicated at chunk boundaries.

This applies to all files written during any phase, including JSON artifacts, Terraform `.tf` files, migration scripts, and documentation.

---

## Phase Summary Table

| Phase        | Inputs                                                                                                                                                                   | Outputs                                                                                                                                                                                   | Reference                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **Discover** | `.tf` files, app source code, and/or billing exports (at least one required)                                                                                             | `gcp-resource-inventory.json`, `gcp-resource-clusters.json`, `ai-workload-profile.json`, `billing-profile.json`, `.phase-status.json` updated (outputs vary by input)                     | `steering/discover.md`     |
| **Clarify**  | Discovery artifacts (`gcp-resource-inventory.json`, `gcp-resource-clusters.json`, `ai-workload-profile.json`, `billing-profile.json` — whichever exist)                  | `preferences.json`, `.phase-status.json` updated                                                                                                                                          | `steering/clarify.md`      |
| **Design**   | `preferences.json` + discovery artifacts                                                                                                                                 | `aws-design.json` (infra), `aws-design-ai.json` (AI), `aws-design-billing.json` (billing-only)                                                                                            | `steering/design.md`       |
| **Estimate** | `aws-design.json` or `aws-design-billing.json` or `aws-design-ai.json`, `preferences.json`                                                                               | `estimation-infra.json` or `estimation-ai.json` or `estimation-billing.json`, `.phase-status.json` updated                                                                                | `steering/estimate.md`     |
| **Generate** | `estimation-infra.json` or `estimation-ai.json` or `estimation-billing.json`, `aws-design.json` or `aws-design-billing.json` or `aws-design-ai.json`, `preferences.json` | `generation-infra.json` or `generation-ai.json` or `generation-billing.json` + `terraform/`, `scripts/`, `ai-migration/`, `MIGRATION_GUIDE.md`, `README.md`, `.phase-status.json` updated | `steering/generate.md`     |
| **Feedback** | `.phase-status.json` (discover completed minimum), all existing migration artifacts                                                                                      | `feedback.json`, `trace.json`, `.phase-status.json` updated                                                                                                                               | `steering/feedback.md`     |

---

## Defaults

- **IaC output**: Terraform configurations, migration scripts, AI migration code, and documentation
- **Region**: `us-east-1` (unless user specifies, or GCP region → AWS region mapping suggests otherwise)
- **Sizing**: Development tier (e.g., `db.t4g.micro` for databases, 0.5 CPU for Fargate)
- **Migration mode**: Adapts based on available inputs (infrastructure, AI, or billing-only)
- **Cost currency**: USD
- **Timeline assumption**: 8-12 weeks total

---

## MCP Servers

**awspricing** (for cost estimation):

- Provides `get_pricing`, `get_pricing_service_codes`, `get_pricing_service_attributes` tools
- Only needed during Estimate phase. Discover and Design do not require it.
- Primary pricing source: `steering/cached-prices.md` (cached rates, ±5-10% for infra, ±15-25% for AI). MCP is secondary — used only for services not found in the cache.

**Recommended setup** (better accuracy):

- AWS credentials configured locally (any valid AWS account with read-only access)
- Required IAM permissions: `pricing:DescribeServices`, `pricing:GetAttributeValues`, `pricing:GetProducts`
- The AWS Pricing API is a public, read-only API — any AWS account works, it does not need to be the target migration account
- Credentials must be active and not expired (refresh via `aws sso login` or `aws configure` as needed)

---

## Workflow Execution

When invoked, the agent **MUST follow this exact sequence**:

1. **Load phase status**: Read `.phase-status.json` from `.migration/*/`.
   - If missing: Initialize for Phase 1 (Discover)
   - If exists: Determine current phase based on phase field and status value

2. **Determine phase to execute**:
   - If status is `in_progress`: Resume that phase (read corresponding steering file)
   - If status is `completed`: Advance to next phase (read next steering file)
   - Phase mapping for advancement:
     - discover (completed) → Execute clarify (read `steering/clarify.md`)
     - clarify (completed) → Execute design (read `steering/design.md`)
     - design (completed) → Execute estimate (read `steering/estimate.md`)
     - estimate (completed) → Execute generate (read `steering/generate.md`)
     - generate (completed) → Migration complete

3. **Read phase reference**: Load the full steering file for the target phase.

4. **Execute ALL steps in order**: Follow every numbered step in the steering file. **Do not skip, optimize, or deviate.**

5. **Validate outputs**: Confirm all required output files exist with correct schema before proceeding.

6. **Update phase status**: Use the Phase Status Update Protocol (Write tool, no Read) in the same turn as the phase's final output message.

7. **Feedback checkpoint**: After a phase completes, check if feedback should be offered. This runs **before** advancing to the next phase.

   - **After Discover** (if `phases.feedback` is `"pending"`): Output to user:
     "Would you like to share quick feedback (5 optional questions + anonymized usage data) to help improve this tool? Your data never includes resource names, file paths, or account IDs.
     [A] Send feedback now
     [B] Wait until after the Estimate phase"
     - If user picks **A** → Load `steering/feedback.md`, execute it, then continue to Clarify.
     - If user picks **B** → Continue to Clarify (feedback stays `"pending"`).

   - **After Estimate** (if `phases.feedback` is `"pending"`): Output to user:
     "Would you like to share quick feedback now? (5 optional questions + anonymized usage data)
     [A] Yes, share feedback
     [B] No thanks, continue to Generate"
     - If user picks **A** → Load `steering/feedback.md`, execute it, then continue to Generate.
     - If user picks **B** → Set `phases.feedback` to `"completed"`, update `last_updated`. Continue to Generate.

   - **After Generate**: No feedback offer. If `phases.feedback` is still `"pending"`, set it to `"completed"` and update `last_updated` (user had two chances and chose to defer/skip).

8. **Display summary**: Show user what was accomplished, highlight next phase, or confirm migration completion.

**Critical constraint**: Agent must strictly adhere to the steering file's workflow. If unable to complete a step, stop and report the exact step that failed.

User can invoke the power again to resume from last completed phase.

---

## Error Conditions

| Condition                                                     | Action                                                                                                                                           |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| No GCP sources found (no `.tf`, no app code, no billing data) | Stop. Output: "No GCP sources detected. Provide at least one source type (Terraform files, application code, or billing exports) and try again." |
| `.phase-status.json` missing phase gate                       | Stop. Output: "Cannot enter Phase X: Phase Y-1 not completed. Start from Phase Y or resume Phase Y-1."                                           |
| awspricing unavailable after 3 attempts                       | Display user warning about ±5-25% accuracy. Use `steering/cached-prices.md`. Add `pricing_source: "cached"` to estimation.json.                  |
| User skips questions or says "use all defaults"               | Apply documented defaults from each category file. Phase 2 completes either way.                                                                 |
| `aws-design.json` missing required clusters                   | Stop Phase 4. Output: "Re-run Phase 3 to generate missing cluster designs."                                                                      |

---

## Files in This Power

```
gcp-aws-migrate/
├── POWER.md                                    ← You are here (orchestrator + state machine)
├── mcp.json                                    # MCP server configuration
│
└── steering/
    │
    ├── # Phase orchestrators (linear flow)
    ├── discover.md                             # Phase 1: Discover orchestrator
    ├── clarify.md                              # Phase 2: Clarify orchestrator
    ├── design.md                               # Phase 3: Design orchestrator
    ├── estimate.md                             # Phase 4: Estimate orchestrator
    ├── generate.md                             # Phase 5: Generate orchestrator
    ├── feedback.md                             # Phase 6: Feedback orchestrator
    │
    ├── # Discover sub-files
    ├── discover-iac.md                         # IaC discovery (Terraform/K8s/Docker)
    ├── discover-app-code.md                    # App code discovery (SDK imports, AI detection)
    ├── discover-billing.md                     # Billing data discovery
    │
    ├── # Clarify sub-files
    ├── clarify-global.md                       # Category A: Global/Strategic (Q1-Q7)
    ├── clarify-compute.md                      # Categories B+C: Config Gaps + Compute (Q8-Q11)
    ├── clarify-database.md                     # Category D: Database (Q12-Q13)
    ├── clarify-ai.md                           # Category F: AI/Bedrock (Q14-Q22)
    ├── clarify-ai-only.md                      # Standalone AI-only migration flow
    │
    ├── # Design sub-files
    ├── design-infra.md                         # Infrastructure design (cluster-based)
    ├── design-ai.md                            # AI workload design (Bedrock)
    ├── design-billing.md                       # Billing-only design (fallback)
    │
    ├── # Estimate sub-files
    ├── estimate-infra.md                       # Infrastructure cost analysis
    ├── estimate-ai.md                          # AI workload cost analysis
    ├── estimate-billing.md                     # Billing-only cost ranges
    │
    ├── # Generate sub-files
    ├── generate-infra.md                       # Infrastructure migration plan
    ├── generate-ai.md                          # AI migration plan
    ├── generate-billing.md                     # Billing-only migration plan
    ├── generate-artifacts-infra.md             # Terraform configurations
    ├── generate-artifacts-scripts.md           # Migration scripts
    ├── generate-artifacts-ai.md                # Provider adapter + test harness
    ├── generate-artifacts-billing.md           # Skeleton Terraform with TODO markers
    ├── generate-artifacts-docs.md              # MIGRATION_GUIDE.md + README.md
    │
    ├── # Feedback sub-files
    ├── feedback-trace.md                       # Anonymized trace builder
    │
    ├── # Design reference files
    ├── design-ref-index.md                     # Lookup table: GCP type → design-ref file
    ├── design-ref-fast-path.md                 # Deterministic 1:1 mappings (Pass 1)
    ├── design-ref-compute.md                   # Compute mappings (Cloud Run, GCE, GKE, App Engine)
    ├── design-ref-database.md                  # Database mappings (Cloud SQL, Firestore, BigQuery, Redis)
    ├── design-ref-storage.md                   # Storage mappings (GCS → S3)
    ├── design-ref-networking.md                # Networking mappings (VPC, LB, DNS, Interconnect)
    ├── design-ref-messaging.md                 # Messaging mappings (Pub/Sub, Cloud Tasks)
    ├── design-ref-ai.md                        # AI/ML mappings (traditional ML → SageMaker)
    ├── design-ref-ai-gemini-to-bedrock.md      # Gemini → Bedrock model selection guide
    ├── design-ref-ai-openai-to-bedrock.md      # OpenAI → Bedrock model selection guide
    │
    ├── # Clustering algorithm files
    ├── clustering-classification-rules.md      # Primary/secondary classification rules
    ├── clustering-algorithm.md                 # Cluster formation rules (6 priority rules)
    ├── depth-calculation.md                    # Topological depth (Kahn's algorithm)
    ├── typed-edges-strategy.md                 # Edge type assignment (HCL reference parsing)
    │
    ├── # Schema files
    ├── schema-phase-status.md                  # .phase-status.json schema
    ├── schema-discover-iac.md                  # gcp-resource-inventory + clusters schemas
    ├── schema-discover-ai.md                   # ai-workload-profile schema
    ├── schema-discover-billing.md              # billing-profile schema
    ├── schema-estimate-infra.md                # estimation-infra.json schema
    │
    ├── # Pricing files
    └── cached-prices.md                        # Pre-fetched live AWS pricing (±5-10%, primary)
```

---

## Scope Notes

**v1.0 includes:**

- Terraform infrastructure discovery
- App code scanning (AI workload detection — Gemini, OpenAI, and other providers)
- Billing data import from GCP
- User requirement clarification (adaptive questions by category)
- Multi-path Design (infrastructure, AI workloads, billing-only fallback)
- AWS cost estimation (two-tier pricing: cached primary, MCP secondary)
- Migration artifact generation (Terraform, scripts, AI adapters, documentation)
- Optional feedback collection with anonymized telemetry

# Telemetry Disclosure

This power includes an **optional** feedback phase that collects anonymized usage data to help improve the tool. Telemetry is **off by default** and only runs if the user explicitly opts in at one of two feedback checkpoints (after the Discover phase or after the Estimate phase).

**What is collected:** Anonymous responses to 5 optional survey questions and aggregated migration metadata (e.g., number of resources discovered, migration path type, phases completed). See `steering/feedback-trace.md` for the full trace schema.

**What is never collected:** Resource names, file paths, account IDs, IP addresses, credentials, or any personally identifiable information.

**How to disable:** Simply decline the feedback prompt when offered by selecting option **[B]** at either checkpoint. No telemetry data is collected or transmitted unless you explicitly choose option **[A]**. If you do not respond to either checkpoint, feedback is automatically skipped after the Generate phase.

# Integrations

This power integrates with:
- [AWS Knowledge MCP Server](https://knowledge-mcp.global.api.aws) — for AWS documentation and service guidance
- [AWS Pricing MCP Server](https://github.com/awslabs/mcp/tree/main/src/aws-pricing-mcp-server) (Apache-2.0 license) — for live AWS cost estimation

# License

```
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
```

## Cached Prices

# AWS Pricing Cache

**Last updated:** 2026-03-07
**Region:** us-east-1
**Currency:** USD
**Accuracy:** ±5-10% for infrastructure services (sourced from AWS Price List API), ±15-25% for AI models (sourced from public pricing pages)

> Prices may vary by region and change over time. Use for estimation only. For real-time pricing, fall back to the AWS Pricing MCP server.

---

## Compute

### Fargate

| Metric             | Rate      |
| ------------------ | --------- |
| Per vCPU-hour      | $0.04048  |
| Per GB memory-hour | $0.004445 |

Linux/x86, on-demand.

### Lambda

| Metric                   | Rate                            |
| ------------------------ | ------------------------------- |
| Per request              | $0.0000002                      |
| Per GB-second (first 6B) | $0.0000166667                   |
| Per GB-second (over 6B)  | $0.000015                       |
| Free tier                | 1M requests + 400K GB-sec/month |

### EKS

| Metric                | Rate   |
| --------------------- | ------ |
| Cluster fee per hour  | $0.10  |
| Cluster fee per month | $73.00 |

Worker nodes billed separately as EC2 or Fargate.

### EC2 (On-Demand, Linux)

| Instance  | $/hour | $/month |
| --------- | ------ | ------- |
| t3.micro  | 0.0104 | 7.58    |
| t3.small  | 0.0208 | 15.17   |
| t3.medium | 0.0416 | 30.34   |
| t3.large  | 0.0832 | 60.68   |
| m5.large  | 0.096  | 70.08   |
| m5.xlarge | 0.192  | 140.16  |
| c5.large  | 0.085  | 62.05   |
| c5.xlarge | 0.17   | 124.10  |

---

## Database

### Aurora PostgreSQL (On-Demand)

Aurora replicates across 3 AZs by default. Pricing is listed as Single-AZ — do NOT use Multi-AZ filter with MCP.

| Instance       | $/hour |
| -------------- | ------ |
| db.t4g.medium  | 0.073  |
| db.t4g.large   | 0.146  |
| db.r6g.large   | 0.26   |
| db.r6i.large   | 0.29   |
| db.r7g.xlarge  | 0.553  |
| db.r8g.large   | 0.276  |
| db.r8g.xlarge  | 0.552  |
| db.r8g.2xlarge | 1.104  |
| db.r8g.4xlarge | 2.208  |
| db.r8g.8xlarge | 4.416  |

| Storage/IO               | Rate  |
| ------------------------ | ----- |
| Storage per GB-month     | $0.10 |
| I/O per million requests | $0.20 |

### Aurora MySQL (On-Demand)

Same Multi-AZ note as Aurora PostgreSQL.

| Instance      | $/hour |
| ------------- | ------ |
| db.t4g.medium | 0.073  |
| db.t4g.large  | 0.146  |

Storage and I/O same as Aurora PostgreSQL.

### Aurora Serverless v2

Scales between min and max ACU. Both PostgreSQL and MySQL cost the same per ACU.

| Metric                     | Rate  |
| -------------------------- | ----- |
| Standard per ACU-hour      | $0.12 |
| I/O Optimized per ACU-hour | $0.16 |
| Storage per GB-month       | $0.10 |
| I/O per million requests   | $0.20 |

Min ACU = 0.5, scales to 256 ACU.

### RDS PostgreSQL (On-Demand, Multi-AZ)

| Instance       | $/hour |
| -------------- | ------ |
| db.t4g.micro   | 0.032  |
| db.t4g.small   | 0.065  |
| db.t4g.medium  | 0.129  |
| db.t4g.large   | 0.258  |
| db.t4g.xlarge  | 0.517  |
| db.t4g.2xlarge | 1.034  |

| Storage      | Rate  |
| ------------ | ----- |
| Per GB-month | $0.23 |

### RDS MySQL (On-Demand, Single-AZ)

For Multi-AZ, approximately double these rates.

| Instance      | $/hour | $/month |
| ------------- | ------ | ------- |
| db.t3.small   | 0.034  | 24.82   |
| db.t3.medium  | 0.068  | 49.64   |
| db.t3.large   | 0.136  | 99.28   |
| db.t4g.micro  | 0.016  | 11.68   |
| db.t4g.small  | 0.032  | 23.36   |
| db.t4g.medium | 0.065  | 47.45   |
| db.m5.large   | 0.171  | 124.83  |

| Storage             | Rate   |
| ------------------- | ------ |
| Per GB-month        | $0.23  |
| Backup per GB-month | $0.023 |

### DynamoDB (On-Demand)

| Metric                | Rate   |
| --------------------- | ------ |
| Read per million RRU  | $0.125 |
| Write per million WRU | $0.625 |
| Storage per GB-month  | $0.25  |

### ElastiCache Redis (On-Demand)

Single-AZ pricing. For Multi-AZ, approximately double.

| Node             | $/hour | $/month |
| ---------------- | ------ | ------- |
| cache.t3.micro   | 0.017  | 12.41   |
| cache.t3.small   | 0.034  | 24.82   |
| cache.t3.medium  | 0.068  | 49.64   |
| cache.t4g.micro  | 0.016  | —       |
| cache.t4g.small  | 0.032  | —       |
| cache.t4g.medium | 0.065  | —       |
| cache.r6g.large  | 0.206  | 150.38  |

---

## Storage

### S3

| Tier                       | Rate per GB-month |
| -------------------------- | ----------------- |
| Standard (first 50 TB)     | $0.023            |
| Standard (next 450 TB)     | $0.022            |
| Standard (over 500 TB)     | $0.021            |
| Standard-IA                | $0.0125           |
| Glacier Flexible Retrieval | $0.0036           |

| Requests                 | Rate    |
| ------------------------ | ------- |
| PUT per 1K               | $0.005  |
| GET per 1K               | $0.0004 |
| S3-IA retrieval per GB   | $0.01   |
| Glacier retrieval per GB | $0.01   |

---

## Networking

### Application Load Balancer

| Metric        | Rate    |
| ------------- | ------- |
| Per ALB-hour  | $0.0225 |
| Per LCU-hour  | $0.008  |
| Monthly fixed | $16.43  |

### Network Load Balancer

| Metric        | Rate    |
| ------------- | ------- |
| Per NLB-hour  | $0.0225 |
| Per LCU-hour  | $0.006  |
| Monthly fixed | $16.43  |

### NAT Gateway

| Metric           | Rate   |
| ---------------- | ------ |
| Per hour         | $0.045 |
| Per GB processed | $0.045 |
| Monthly fixed    | $32.85 |

### VPC

VPC itself is free. Add-ons:

| Component                   | Rate   |
| --------------------------- | ------ |
| VPN connection per hour     | $0.05  |
| VPN monthly                 | $36.50 |
| Interface endpoint per hour | $0.01  |
| Interface endpoint monthly  | $7.30  |

### Route 53

| Metric                       | Rate  |
| ---------------------------- | ----- |
| Hosted zone per month        | $0.50 |
| Per million standard queries | $0.40 |
| Per million latency queries  | $0.60 |
| Health check per month       | $0.50 |

### CloudFront (US/Europe)

| Metric                        | Rate                |
| ----------------------------- | ------------------- |
| Per GB transfer (first 10 TB) | $0.085              |
| Per 10K HTTPS requests        | $0.01               |
| Free tier                     | 1 TB transfer/month |

---

## Supporting Services

### Secrets Manager

| Metric               | Rate  |
| -------------------- | ----- |
| Per secret per month | $0.40 |
| Per 10K API calls    | $0.05 |

### CloudWatch

| Metric                        | Rate   |
| ----------------------------- | ------ |
| Log ingestion per GB          | $0.50  |
| Log storage per GB-month      | $0.03  |
| Insights query per GB scanned | $0.005 |
| Custom metric per month       | $0.30  |

### SQS

| Metric                        | Rate              |
| ----------------------------- | ----------------- |
| Standard per million requests | $0.40             |
| FIFO per million requests     | $0.50             |
| Free tier                     | 1M requests/month |

### SNS

| Metric                    | Rate               |
| ------------------------- | ------------------ |
| Per million publishes     | $0.50              |
| SQS delivery per million  | $0.00              |
| HTTP delivery per million | $0.60              |
| Free tier                 | 1M publishes/month |

### EventBridge

| Metric             | Rate  |
| ------------------ | ----- |
| Per million events | $1.00 |

---

## Analytics

### Redshift Serverless

| Metric               | Rate   |
| -------------------- | ------ |
| Per RPU-hour         | $0.375 |
| Storage per GB-month | $0.024 |

Minimum 8 RPU base capacity.

### Athena

| Metric         | Rate  |
| -------------- | ----- |
| Per TB scanned | $5.00 |

Columnar formats (Parquet, ORC) and partitioning reduce scan volume.

### SageMaker

| Training Instance    | $/hour |
| -------------------- | ------ |
| ml.m5.large          | 0.115  |
| ml.m5.xlarge         | 0.23   |
| ml.g4dn.xlarge (GPU) | 0.736  |

| Inference Instance | $/hour | $/month |
| ------------------ | ------ | ------- |
| ml.t3.medium       | 0.05   | 36.50   |
| ml.m5.large        | 0.115  | 83.95   |

Serverless inference: $0.0000200 per second per GB memory.

---

## Bedrock Models (On-Demand)

Prices per 1M tokens. Prompt caching available for Claude models (90% reduction on cached portions). Long Context variants activate automatically when input exceeds 200K tokens — 2x input price, 1.5x output price.

| Model                            | Model ID                                 | Provider  | Input $/1M | Output $/1M | Context | Tier      |
| -------------------------------- | ---------------------------------------- | --------- | ---------- | ----------- | ------- | --------- |
| Claude Sonnet 4.6                | anthropic.claude-sonnet-4-6              | Anthropic | 3.00       | 15.00       | 200K    | flagship  |
| Claude Sonnet 4.6 — Long Context | anthropic.claude-sonnet-4-6              | Anthropic | 6.00       | 22.50       | >200K   | flagship  |
| Claude Opus 4.6                  | anthropic.claude-opus-4-6-v1             | Anthropic | 5.00       | 25.00       | 200K    | premium   |
| Claude Opus 4.6 — Long Context   | anthropic.claude-opus-4-6-v1             | Anthropic | 10.00      | 37.50       | >200K   | premium   |
| Claude Haiku 4.5                 | anthropic.claude-haiku-4-5-20251001-v1:0 | Anthropic | 1.00       | 5.00        | 200K    | fast      |
| Llama 4 Maverick                 | meta.llama4-maverick-17b-instruct-v1:0   | Meta      | 0.24       | 0.97        | 1M      | mid       |
| Llama 4 Scout                    | meta.llama4-scout-17b-instruct-v1:0      | Meta      | 0.17       | 0.66        | 10M     | efficient |
| Llama 3.3 70B                    | meta.llama3-3-70b-instruct-v1:0          | Meta      | 0.72       | 0.72        | 128K    | mid       |
| Llama 3.2 90B                    | meta.llama3-2-90b-instruct-v1:0          | Meta      | 0.72       | 0.72        | 128K    | mid       |
| Nova 2 Lite                      | amazon.nova-2-lite-v1:0                  | Amazon    | 0.33       | 2.75        | 1M      | mid       |
| Nova 2 Pro                       | amazon.nova-2-pro-v1:0                   | Amazon    | 1.38       | 11.00       | 1M      | flagship  |
| Nova Pro                         | amazon.nova-pro-v1:0                     | Amazon    | 0.80       | 3.20        | 300K    | mid       |
| Nova Lite                        | amazon.nova-lite-v1:0                    | Amazon    | 0.06       | 0.24        | 300K    | fast      |
| Nova Micro                       | amazon.nova-micro-v1:0                   | Amazon    | 0.035      | 0.14        | 128K    | budget    |
| Nova Premier                     | amazon.nova-premier-v1:0                 | Amazon    | 2.50       | 12.50       | 1M      | reasoning |
| Mistral Large 3                  | mistral.mistral-large-3-675b-instruct    | Mistral   | 0.50       | 1.50        | 256K    | flagship  |
| DeepSeek-R1                      | deepseek.r1-v1:0                         | DeepSeek  | 1.35       | 5.40        | 128K    | reasoning |
| gpt-oss-20b                      | openai.gpt-oss-20b-1:0                   | OpenAI    | 0.07       | 0.30        | 128K    | budget    |
| gpt-oss-120b                     | openai.gpt-oss-120b-1:0                  | OpenAI    | 0.15       | 0.60        | 128K    | efficient |
| Gemma 3 4B IT                    | google.gemma-3-4b-it                     | Google    | 0.04       | 0.08        | 128K    | budget    |
| Gemma 3 12B IT                   | google.gemma-3-12b-it                    | Google    | 0.09       | 0.29        | 128K    | budget    |
| Gemma 3 27B IT                   | google.gemma-3-27b-it                    | Google    | 0.23       | 0.38        | 128K    | efficient |

---

## Source Provider Pricing (for Migration Comparison)

Use alongside Bedrock pricing to calculate migration ROI.

### Gemini (Standard Tier)

Prices per 1M tokens.

| Model                  | Input $/1M | Output $/1M | Context | Tier     |
| ---------------------- | ---------- | ----------- | ------- | -------- |
| Gemini 3.1 Pro Preview | 2.00       | 12.00       | 1M      | flagship |
| Gemini 2.5 Pro         | 1.25       | 10.00       | 1M      | flagship |
| Gemini 2.5 Flash       | 0.30       | 2.50        | 1M      | fast     |
| Gemini 2.0 Flash       | 0.10       | 0.40        | 1M      | fast     |
| Gemini 2.0 Flash Lite  | 0.075      | 0.30        | 1M      | budget   |

### OpenAI (Standard Tier)

Prices per 1M tokens.

| Model        | Input $/1M | Output $/1M | Context | Tier      |
| ------------ | ---------- | ----------- | ------- | --------- |
| GPT-5.2      | 1.75       | 14.00       | 200K    | flagship  |
| GPT-5.1      | 1.25       | 10.00       | 200K    | flagship  |
| GPT-5 Mini   | 0.25       | 2.00        | 200K    | fast      |
| GPT-5 Nano   | 0.05       | 0.40        | 128K    | budget    |
| GPT-4.1      | 2.00       | 8.00        | 1M      | flagship  |
| GPT-4.1 Mini | 0.40       | 1.60        | 1M      | fast      |
| GPT-4.1 Nano | 0.10       | 0.40        | 1M      | budget    |
| GPT-4o       | 2.50       | 10.00       | 128K    | flagship  |
| o3           | 2.00       | 8.00        | 200K    | reasoning |
| o4-mini      | 1.10       | 4.40        | 200K    | reasoning |

## Clarify Ai Only

# AI-Only Migration — Clarify Requirements

**Standalone flow** — Used when ONLY `ai-workload-profile.json` exists (no infrastructure or billing artifacts). Infrastructure stays on GCP; only AI/LLM calls move to AWS Bedrock.

This file replaces the category-based question system for AI-only migrations. It produces the same `preferences.json` output but with `design_constraints` limited to region and compliance, and `ai_constraints` fully populated.

---

## Step 1: Present AI Detection Summary

> **AI-Only Migration Detected**
> Your project has AI workloads but no infrastructure artifacts (Terraform, billing). I'll focus on migrating your AI/LLM calls to AWS Bedrock while your infrastructure stays on GCP.
>
> **AI source:** [from `summary.ai_source`]
> **Models detected:** [from `models[].model_id`]
> **Capabilities in use:** [from `integration.capabilities_summary` where true]
> **Integration pattern:** [from `integration.pattern`] via [from `integration.primary_sdk`]
> **Gateway/router:** [from `integration.gateway_type`, or "None (direct SDK)"]
> **Frameworks:** [from `integration.frameworks`, or "None"]

---

## Step 2: Ask Questions (Q1–Q10)

Present all questions at once with a progress indicator. Questions use their own numbering (Q1–Q10), independent of the full migration numbering.

```
I have a few questions to tailor your AI migration plan.
You can answer each, skip individual ones (I'll use sensible defaults),
or say "use all defaults" to proceed.
```

---

### AI Framework & Orchestration (Q1)

Always asked first. The orchestration layer determines the entire migration approach — gateway config change, provider swap, or full agent migration.

---

### Q1 — What AI framework or orchestration layer are you using? (select all that apply)

Same decision logic, auto-detect signals, combination logic, and interpretation as Q14 in `clarify-ai.md`. Refer to that file for full details.

**Auto-detect signals** — scan application code before asking:

- No AI framework imports, raw HTTP calls → A
- LiteLLM, OpenRouter, PortKey, Helicone, Kong, Apigee → B
- LangChain/LangGraph/LlamaIndex → C
- CrewAI, AutoGen, custom multi-agent → D
- OpenAI Agents SDK / Swarm → E
- MCP / A2A protocol → F
- Vapi, Bland.ai, Retell, Whisper → G

> How your AI calls reach the model determines migration effort.
>
> A) No framework — direct API calls
> B) LLM router/gateway (LiteLLM, OpenRouter, PortKey, Kong, Apigee)
> C) LangChain / LangGraph
> D) Multi-agent framework (CrewAI, AutoGen, custom)
> E) OpenAI Agents SDK / custom agent loop
> F) MCP servers or A2A protocol
> G) Voice/conversational agent platform (Vapi, Retell, Bland.ai)

Interpret: same as Q14 in `clarify-ai.md` → `ai_framework` array.

Default: _(auto-detect)_ — fall back to `["direct"]`.

---

### Priority & Cost (Q2–Q3)

Top-level filters for model selection and credits eligibility.

---

### Q2 — What matters most for your AI application?

Same decision logic as Q16 in `clarify-ai.md`.

**Context for user:** When asking, help the user think about their actual priority rather than defaulting to "best quality":

- **Best quality/reasoning** — accuracy and depth matter most; you'd pay more or wait longer for better answers (e.g., legal analysis, complex code generation, medical summarization)
- **Fastest speed** — response time is the primary constraint; users are waiting in real-time (e.g., chat UI, autocomplete, live suggestions)
- **Lowest cost** — volume is high and budget is tight; good-enough quality at scale (e.g., classification, tagging, bulk summarization)
- **Specialized capability** — you rely on a specific feature like vision, function calling, or extended thinking (covered in Q10)
- **Balanced** — no single dimension dominates; you want a solid all-rounder

> This determines our model selection strategy.
>
> A) Best quality/reasoning
> B) Fastest speed
> C) Lowest cost
> D) Specialized capability (covered in Q10)
> E) Balanced
> F) I don't know

| Answer                 | Recommendation Impact                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Best quality/reasoning | Claude Sonnet 4.6 (latest, highest reasoning in Sonnet family) — primary; Claude Opus 4.6 for most demanding reasoning tasks |
| Fastest speed          | Claude Haiku 4.5 — lowest latency in Claude family; also consider Amazon Nova Micro/Lite for cost-optimized speed            |
| Lowest cost            | Claude Haiku 4.5 or Amazon Nova Micro — lowest cost per token                                                                |
| Specialized capability | Deferred to Q10 to determine which model                                                                                     |
| Balanced               | Claude Sonnet 4.6 as default balanced recommendation                                                                         |

Interpret: same as Q16 → `ai_priority`.

Default: E — `ai_priority: "balanced"`.

---

### Q3 — Approximately how much are you spending on OpenAI or Gemini per month?

Same decision logic as Q15 in `clarify-ai.md` — credits eligibility and cost baseline.

> AI spend helps me calculate migration credits eligibility and establish a Bedrock cost baseline.
>
> A) < $500/month
> B) $500–$2,000/month
> C) $2,000–$10,000/month
> D) > $10,000/month
> E) I don't know

Interpret: same as Q15 → `ai_monthly_spend`.

Default: B — `ai_monthly_spend: "$500-$2K"`.

---

### Cross-Cloud Architecture (Q4)

Unique to AI-only migrations where infrastructure stays on GCP while AI calls route to AWS.

---

### Q4 — Cross-cloud API call concerns

**Rationale:** AI-only migrations keep infrastructure on GCP while moving AI calls to AWS Bedrock. Cross-region API calls add latency and potential egress costs that may affect the recommendation. This question is unique to AI-only migrations.

**Context for user:** Explain the tradeoff concretely:

- **Yes — latency critical** — AI calls are in the hot path and every 20–50ms matters (e.g., real-time chat, autocomplete, live transcription)
- **No — latency acceptable** — AI calls are async or users expect a brief wait (e.g., background processing, batch jobs, report generation)
- **Concerned about egress costs** — sending large payloads (images, documents, audio) between GCP and AWS
- **Want to test first** — run both providers in parallel before committing

> Since your infrastructure stays on GCP, AI calls to Bedrock will cross cloud boundaries. This affects latency and data transfer costs.
>
> A) Yes — latency critical, AI calls are in the hot path
> B) No — latency acceptable, async or users can wait
> C) Concerned about egress costs for large payloads
> D) Want to test first — run both providers in parallel

| Answer                 | Recommendation Impact                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Latency critical       | VPC endpoint for Bedrock strongly recommended; us-east-1 or closest region to GCP deployment; latency benchmarks included |
| Latency acceptable     | Standard Bedrock endpoint; region selected for cost/availability                                                          |
| Concerned about egress | AWS PrivateLink for Bedrock recommended; egress cost analysis included                                                    |
| Want to test first     | Phased migration plan; parallel running guidance included                                                                 |

Interpret:

```
A -> cross_cloud: "latency-critical" — VPC endpoint; closest region to GCP
B -> cross_cloud: "latency-acceptable" — Standard endpoint; region by cost
C -> cross_cloud: "egress-concerned" — PrivateLink; egress analysis
D -> cross_cloud: "test-first" — Phased migration; parallel running
```

Default: B — `cross_cloud: "latency-acceptable"`.

---

### Model & Modality (Q5–Q6)

Establish the baseline model recommendation and whether multimodal capabilities are needed.

---

### Q5 — Which model are you currently using?

**Rationale:** The source model establishes the baseline Bedrock recommendation — a like-for-like capability match. This is a starting point only; answers to Q2 (priority), Q7 (volume), Q8 (latency), Q9 (complexity), and Q10 (special features) can all override this baseline.

**Override hierarchy:**

1. Q10 special features — hard overrides (e.g., speech-to-speech forces Nova Sonic regardless of source model)
2. Q2 priority — adjusts up or down within the Claude family (e.g., "lowest cost" downgrades Sonnet → Haiku even if source model was GPT-4)
3. Q7/Q8 volume and latency — may adjust toward provisioned throughput or faster models
4. Q5 source model — baseline only, used when no overrides apply

> The model you're currently using helps me recommend the closest Bedrock equivalent.
>
> A) Gemini Flash (1.5/2.0/2.5 Flash)
> B) Gemini Pro (1.5/2.5/3 Pro)
> C) GPT-3.5 Turbo
> D) GPT-4 / GPT-4 Turbo
> E) GPT-4o
> F) GPT-5 / GPT-5.x
> G) o-series (o1, o3)
> H) Other / Multiple models
> I) I don't know

| Source Model              | Baseline Bedrock Recommendation                                       | Pricing Context                                                  |
| ------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Gemini Flash variants     | Claude Haiku 4.5 ($1/$5) — speed and cost optimized                   | Strong savings vs Gemini Flash pricing                           |
| Gemini Pro variants       | Claude Sonnet 4.6 ($3/$15) — quality match                            | Comparable pricing tier                                          |
| GPT-3.5 Turbo             | Claude Haiku 4.5 ($1/$5) — cost-equivalent                            | Haiku is faster and cheaper                                      |
| GPT-4 / GPT-4 Turbo       | Claude Sonnet 4.6 ($3/$15) — quality equivalent                       | Major savings: GPT-4 Turbo is $10/$30 vs Sonnet $3/$15           |
| GPT-4o                    | Claude Sonnet 4.6 ($3/$15) — performance equivalent                   | Modest savings on output; input slightly higher on Bedrock       |
| GPT-5 / GPT-5.x           | Claude Sonnet 4.6 ($3/$15) — performance equivalent                   | GPT-5 is $1.25/$10 — savings story is quality/features, not cost |
| GPT-5 (flagship use case) | Claude Opus 4.6 ($5/$25) — flagship-to-flagship                       | Opus still cheaper than GPT-5 Pro ($15/$120)                     |
| o-series (o1, o3)         | Claude Sonnet 4.6 with extended thinking; Opus 4.6 for most demanding | o1 is $15/$60 — significant savings with Sonnet 4.6 at $3/$15    |

**Example overrides:**

- GPT-4 user (baseline: Sonnet 4.6) + Q2=lowest cost → **Haiku 4.5**
- Gemini Flash user (baseline: Haiku 4.5) + Q10=extended thinking → **Sonnet 4.6 with extended thinking**
- GPT-4o user (baseline: Sonnet 4.6) + Q10=real-time speech → **Nova Sonic** (Claude has no speech capability)
- GPT-3.5 user (baseline: Haiku 4.5) + Q9=complex reasoning → **Sonnet 4.6** (task complexity overrides cost-equivalent mapping)
- GPT-5 user (baseline: Opus 4.6) + Q2=balanced → **Sonnet 4.6** (priority overrides flagship-to-flagship mapping)

Interpret: same as Q19 in `clarify-ai.md` → `ai_model_baseline`.

Default: _(auto-detect)_ — fall back to Q2 priority-based selection.

---

### Q6 — Do you need vision or just text?

**Rationale:** Vision capability narrows the model selection to multimodal-capable models only.

> Vision capability limits which models are available.
>
> A) Text only
> B) Vision required
> C) Audio/Video inputs needed

| Answer             | Recommendation Impact                                                                 |
| ------------------ | ------------------------------------------------------------------------------------- |
| Text only          | Full model catalog available; cheapest/fastest text model per Q2 priority             |
| Vision required    | Claude Sonnet family (multimodal) required; Haiku excluded for vision tasks           |
| Audio/Video inputs | Amazon Nova Reel (video) or Nova Sonic (audio); Claude excluded for audio/video input |

Interpret: same as Q20 → `ai_vision`.

Default: A — no constraint (text only).

---

### Workload Characteristics (Q7–Q10)

These questions refine the model recommendation based on actual usage patterns — volume, latency, complexity, and specialized features can all override the baseline from Q5.

---

### Q7 — Monthly AI usage volume

**Rationale:** Volume determines whether on-demand or provisioned throughput is more cost-effective.

> Volume determines pricing strategy — on-demand vs provisioned throughput.
>
> A) Low (< 1M tokens/month)
> B) Medium (1–10M tokens/month)
> C) High (10–100M tokens/month)
> D) Very high (> 100M tokens/month)
> E) I don't know

| Answer    | Recommendation Impact                                                                  |
| --------- | -------------------------------------------------------------------------------------- |
| Low       | On-demand pricing; no provisioned throughput needed                                    |
| Medium    | On-demand with prompt caching analysis                                                 |
| High      | Provisioned throughput analysis; prompt caching strongly recommended                   |
| Very high | Provisioned throughput required for cost control; dedicated capacity planning included |

Interpret:

```
A -> ai_token_volume: "<1M" — On-demand; no provisioned throughput
B -> ai_token_volume: "1M-10M" — On-demand; prompt caching analysis
C -> ai_token_volume: "10M-100M" — Provisioned throughput analysis; prompt caching
D -> ai_token_volume: ">100M" — Provisioned throughput required; capacity planning
E -> same as default (B)
```

Default: B — `ai_token_volume: "1M-10M"`.

---

### Q8 — How important is response speed?

**Rationale:** Latency requirements can override cost and quality preferences from Q2.

**Context for user:** When asking, anchor each option in a real scenario:

- **Critical (< 500ms)** — users are staring at a loading spinner; every millisecond matters (e.g., autocomplete, live chat, real-time transcription)
- **Important (< 2s)** — users expect a quick response but a brief pause is acceptable (e.g., chat assistant, search augmentation, inline suggestions)
- **Flexible (2–10s)** — users submit a request and can wait; background or async is fine (e.g., report generation, batch analysis, email drafting)

> Latency requirements can override cost and quality preferences.
>
> A) Critical (< 500ms)
> B) Important (< 2s)
> C) Flexible (2–10s)

| Answer             | Recommendation Impact                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| Critical (< 500ms) | Claude Haiku 4.5 or Nova Micro; streaming required; provisioned throughput for consistent latency |
| Important (< 2s)   | Claude Sonnet 4.6 with streaming; standard on-demand acceptable                                   |
| Flexible (2–10s)   | Any model; batch inference considered for cost savings at high volume                             |

Interpret: same as Q21 → `ai_latency`.

Default: B — `ai_latency: "important"`.

---

### Q9 — How complex are your AI tasks?

**Rationale:** Task complexity determines whether a cheaper/faster model can handle the workload or whether a more capable model is required.

**Context for user:** When asking, give concrete examples so the user doesn't over- or under-estimate:

- **Simple** — single-step tasks with short prompts: classify this text, extract these fields, summarize this paragraph
- **Moderate** — multi-step prompts with examples or structured output: analyze this document and return JSON, generate content following a template, few-shot classification
- **Complex** — multi-turn reasoning, tool use, or long chain-of-thought: agentic workflows, code generation with debugging loops, research tasks that require planning and iteration

> Task complexity determines whether cheaper models can handle your workload.
>
> A) Simple (classification, short summaries, extraction)
> B) Moderate (analysis, structured content, few-shot)
> C) Complex (multi-step reasoning, tool use, agentic workflows)

| Answer   | Recommendation Impact                                                                       |
| -------- | ------------------------------------------------------------------------------------------- |
| Simple   | Claude Haiku 4.5 or Nova Micro sufficient; significant cost savings vs larger models        |
| Moderate | Claude Sonnet 4.6 recommended; Haiku may suffice with prompt engineering                    |
| Complex  | Claude Sonnet 4.6 required; extended thinking considered; Claude Opus 4.6 for hardest tasks |

Interpret: same as Q22 → `ai_complexity`.

Default: B — `ai_complexity: "moderate"`.

---

### Q10 — Specialized features needed

Same decision logic as Q17 in `clarify-ai.md`.

> Some features are only available in specific models. What's your most critical specialized requirement?
>
> A) Function calling / Tool use
> B) Ultra-long context (> 300K tokens)
> C) Extended thinking / Chain-of-thought
> D) Prompt caching
> E) RAG optimization
> F) Agentic workflows
> G) Real-time speed (< 500ms)
> H) Multimodal with image generation
> I) Real-time conversational speech
> J) None — standard features sufficient

Interpret: same as Q17 → `ai_critical_feature`.

Default: J — no additional override.

---

## Step 3: Write preferences.json

Write `$MIGRATION_DIR/preferences.json` with AI-only structure:

```json
{
  "metadata": {
    "timestamp": "<ISO timestamp>",
    "migration_type": "ai-only",
    "discovery_artifacts": ["ai-workload-profile.json"],
    "questions_asked": ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8", "Q9", "Q10"],
    "questions_defaulted": [],
    "questions_skipped_extracted": [],
    "questions_skipped_not_applicable": []
  },
  "design_constraints": {
    "target_region": { "value": "us-east-1", "chosen_by": "derived" }
  },
  "ai_constraints": {
    "ai_framework": { "value": ["langchain"], "chosen_by": "extracted" },
    "ai_priority": { "value": "balanced", "chosen_by": "user" },
    "ai_monthly_spend": { "value": "$500-$2K", "chosen_by": "user" },
    "cross_cloud": { "value": "latency-acceptable", "chosen_by": "user" },
    "ai_model_baseline": { "value": "claude-sonnet-4-6", "chosen_by": "derived" },
    "ai_vision": { "value": "text-only", "chosen_by": "user" },
    "ai_token_volume": { "value": "1M-10M", "chosen_by": "user" },
    "ai_latency": { "value": "important", "chosen_by": "user" },
    "ai_complexity": { "value": "moderate", "chosen_by": "user" },
    "ai_critical_feature": { "value": "none", "chosen_by": "user" },
    "ai_capabilities_required": {
      "value": ["text_generation", "streaming"],
      "chosen_by": "derived"
    }
  }
}
```

### Schema Notes (AI-Only)

1. `metadata.migration_type` is `"ai-only"` — downstream phases use this to skip infrastructure design/estimation.
2. `design_constraints` is minimal — only `target_region` (derived from GCP deployment region or cross-cloud latency preference).
3. `ai_constraints.cross_cloud` is unique to AI-only migrations — not present in full migration preferences.
4. `ai_constraints.ai_token_volume` uses different tiers than full migration Q18 — more granular for AI-only cost analysis.
5. All other schema rules from `clarify.md` apply (value/chosen_by fields, no nulls, derived capabilities).

---

## Step 4: Update Phase Status

Update `$MIGRATION_DIR/.phase-status.json`:

- Set `phases.clarify` to `"completed"`
- Update `last_updated` to current timestamp

Output to user: "Clarification complete. Proceeding to Phase 3: Design AI Migration Architecture."

## Clarify Ai

# Category F — AI/Bedrock (If `ai-workload-profile.json` Exists)

_Fire when:_ `ai-workload-profile.json` exists in `$MIGRATION_DIR/`.

These questions refine the AI migration approach — framework/orchestration layer, model selection, cost projections, and performance requirements.

---

## AI Context Summary

Before presenting questions, show the AI detection context:

> **AI Context Summary:**
> **AI source:** [from `summary.ai_source`: "Gemini", "OpenAI", "Both", or "Other"]
> **Models detected:** [from `models[].model_id`]
> **Capabilities in use:** [from `integration.capabilities_summary` where true]
> **Integration pattern:** [from `integration.pattern`] via [from `integration.primary_sdk`]
> **Gateway/router:** [from `integration.gateway_type`, or "None (direct SDK)"]
> **Frameworks:** [from `integration.frameworks`, or "None"]

---

## Q14 — What AI framework or orchestration layer are you using? (select all that apply)

**Rationale:** The orchestration layer determines the migration surface area more than the model choice. A LangGraph app with multi-agent tool-calling has a fundamentally different migration path than raw API calls routed through a gateway. Understanding the full AI stack upfront determines whether to migrate orchestration to Bedrock Agents, keep the existing framework with a Bedrock provider swap, adopt a hybrid approach, or simply change a gateway config.

**Auto-detect signals** — scan IaC and application code before asking:

- No AI framework imports, raw HTTP calls to OpenAI/Gemini endpoints → A
- LiteLLM imports or config files → B
- OpenRouter base URL in code/config → B
- PortKey, Helicone, Martian SDK imports → B
- Kong AI Gateway, Apigee AI config files → B
- Custom proxy class wrapping the AI client → B
- LangChain/LangGraph imports → C
- LangChain/LlamaIndex with provider-agnostic model config → C
- CrewAI imports, `Crew` and `Agent` class definitions → D
- AutoGen imports, `ConversableAgent` patterns → D
- Custom multi-agent loop with dispatcher logic → D
- OpenAI Agents SDK / Swarm imports → E
- Custom while-loop agent with tool-call parsing → E
- `mcp.server` / `mcp.client` imports, MCP config JSON files → F
- A2A protocol config or SDK imports → F
- Vapi, Bland.ai, Retell SDK imports → G
- Nova Sonic or Whisper integration in code → G

_Skip when:_ Auto-detection fully resolves the framework(s). Use detected value(s) with `chosen_by: "extracted"`.

> How your AI calls reach the model determines migration effort. Gateway users can often migrate by changing a single config line.
>
> A) No framework — direct API calls to OpenAI/Gemini
> B) LLM router/gateway (LiteLLM, OpenRouter, PortKey, Kong, Apigee)
> C) LangChain / LangGraph
> D) Multi-agent framework (CrewAI, AutoGen, custom)
> E) OpenAI Agents SDK / custom agent loop
> F) MCP servers or A2A protocol
> G) Voice/conversational agent platform (Vapi, Retell, Bland.ai)
>
> _(Multiple selections allowed)_

| Answer                                   | Recommendation Impact                                                                                                                                                                                                        | Migration Effort  | Timeline                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------- |
| A) No framework — direct API calls       | Swap OpenAI/Gemini SDK calls to Bedrock SDK; recommend evaluating Bedrock Agents if planning agentic capabilities                                                                                                            | Low               | 1–3 weeks depending on call sites                  |
| B) LLM router/gateway                    | Add Bedrock as provider in gateway config, swap model IDs; no app code changes; verify gateway supports AWS SigV4 auth                                                                                                       | Minimal           | Hours to 1–3 days                                  |
| C) LangChain / LangGraph                 | Provider swap to Bedrock via `ChatBedrock` class; existing chains/graphs/tools preserved; validate tool schemas with Bedrock tool-use format                                                                                 | Low               | 1–3 days; 1 week if complex agent graphs           |
| D) Multi-agent framework                 | Two paths: 1) Keep framework, swap to Bedrock as LLM provider — lower effort, 2) Migrate to Bedrock multi-agent orchestration — higher effort, deeper AWS integration; recommend path 1 unless managed infrastructure wanted | Medium            | Path 1: 3–5 days; Path 2: 2–4 weeks                |
| E) OpenAI Agents SDK / custom agent loop | Highest effort; OpenAI Agents SDK is tightly coupled to OpenAI API with no provider swap; recommend Bedrock Agents as replacement or LangGraph as portable intermediate step; tool-calling schema translation required       | High              | 2–4 weeks                                          |
| F) MCP servers or A2A protocol           | Bedrock Agents supports MCP tool use natively; A2A interop available; recommend Bedrock Agents as orchestration layer to preserve MCP/A2A investments                                                                        | Low–Medium        | 3–5 days for MCP; 1–2 weeks if A2A refactoring     |
| G) Voice/conversational agent platform   | Check if platform supports Bedrock natively — if yes, config change only; if no, evaluate Nova Sonic as replacement for voice layer                                                                                          | Minimal to Medium | Hours if native; 2–3 weeks if Nova Sonic migration |

### Combination Logic

| Combination                          | Approach                                                                                                                                 |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| A only                               | Simplest path — direct SDK migration                                                                                                     |
| B only                               | Quick win — gateway config change, skip SDK migration steps                                                                              |
| B + any other                        | Gateway swap is the quick win; assess framework migration as separate workstream                                                         |
| C + A                                | Two workstreams: LangChain provider swap (fast) + direct call migration (slower)                                                         |
| D + F                                | Complex — multi-agent with MCP tooling; recommend Bedrock Agents to unify orchestration and tool access                                  |
| E + anything                         | E is the long pole; plan timeline around the Agents SDK migration; other layers may be quick wins                                        |
| Multiple frameworks (C+D, C+E, etc.) | Assess each independently; prioritize by traffic volume or business criticality; recommend consolidating to one framework post-migration |

**Key principle:** When a framework is detected, lead with "here's how your orchestration layer maps to AWS" rather than "here's which model replaces yours." Model recommendation from subsequent questions becomes a sub-decision within the framework migration.

_Note: If answer includes B and no other selections, skip or abbreviate SDK migration steps. If answer is A only, proceed with standard model migration flow._

Interpret:

```
A -> ai_framework: ["direct"] — Full SDK migration required
B -> ai_framework: ["llm-router"] — Config change only (1-3 days)
C -> ai_framework: ["langchain"] — Provider swap via ChatBedrock
D -> ai_framework: ["multi-agent"] — Two migration paths available
E -> ai_framework: ["openai-agents"] — Highest effort; Bedrock Agents recommended
F -> ai_framework: ["mcp-a2a"] — Bedrock Agents for orchestration
G -> ai_framework: ["voice-platform"] — Check native Bedrock support
Multiple -> ai_framework: [array of all selected values]
```

Default: _(auto-detect from code)_ — fall back to `["direct"]` if detection fails.

---

## Q15 — Approximately how much are you spending on OpenAI or Gemini per month?

**Rationale:** AI spend drives the IW Migrate credits calculation at the 35% rate (vs 25% for infrastructure-only). Also provides the cost engine with a baseline for Bedrock cost comparison when detailed billing CSV is not uploaded.

**Pricing context:** GPT-5 ($1.25/$10 per 1M tokens) is actually cheaper than GPT-4o ($2.50/$10) and significantly cheaper than GPT-4 Turbo ($10/$30). Users on GPT-4 Turbo have the strongest cost savings case for migrating to Bedrock — Claude Sonnet 4.6 at $3/$15 is 70% cheaper on input tokens. Users on GPT-5 will see more modest savings since GPT-5 is already competitively priced.

> AI spend helps me calculate your migration credits eligibility (35% rate for AI workloads) and establish a cost baseline for Bedrock comparison.
>
> A) < $500/month
> B) $500–$2,000/month
> C) $2,000–$10,000/month
> D) > $10,000/month
> E) I don't know

| Answer               | Recommendation Impact                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| < $500/month         | AWS Activate or low-tier IW Migrate credits; Bedrock cost comparison shows modest savings         |
| $500–$2,000/month    | IW Migrate credits at 35% of ARR; Bedrock cost comparison highlighted                             |
| $2,000–$10,000/month | Significant IW Migrate credits; Bedrock cost savings prominently featured; Savings Plans analysis |
| > $10,000/month      | MAP eligibility likely; dedicated AI migration support; Bedrock provisioned throughput analysis   |

Interpret:

```
A -> ai_monthly_spend: "<$500" — Activate or low-tier IW Migrate
B -> ai_monthly_spend: "$500-$2K" — IW Migrate at 35% of ARR
C -> ai_monthly_spend: "$2K-$10K" — Significant IW Migrate; Savings Plans analysis
D -> ai_monthly_spend: ">$10K" — MAP eligibility; provisioned throughput analysis
E -> same as default (B)
```

Default: B — `ai_monthly_spend: "$500-$2K"`.

---

## Q16 — What matters most for your AI workloads?

**Rationale:** The primary priority is the top-level filter for Bedrock model selection. Quality, speed, and cost point to different model families.

**Context for user:** When asking, help the user think about their actual priority rather than defaulting to "best quality":

- **Best quality/reasoning** — accuracy and depth matter most; you'd pay more or wait longer for better answers (e.g., legal analysis, complex code generation, medical summarization)
- **Fastest speed** — response time is the primary constraint; users are waiting in real-time (e.g., chat UI, autocomplete, live suggestions)
- **Lowest cost** — volume is high and budget is tight; good-enough quality at scale (e.g., classification, tagging, bulk summarization)
- **Specialized capability** — you rely on a specific feature like vision, function calling, or extended thinking (covered in Q17)
- **Balanced** — no single dimension dominates; you want a solid all-rounder

> This determines our model selection strategy and optimization approach.
>
> A) Best quality/reasoning — accuracy matters most, willing to pay more
> B) Fastest speed — response time is the primary constraint
> C) Lowest cost — high volume, budget tight, good-enough quality at scale
> D) Specialized capability — rely on a specific feature (covered in Q17)
> E) Balanced — no single dimension dominates
> F) I don't know

| Answer                 | Recommendation Impact                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Best quality/reasoning | Claude Sonnet 4.6 (latest, highest reasoning in Sonnet family) — primary; Claude Opus 4.6 for most demanding reasoning tasks |
| Fastest speed          | Claude Haiku 4.5 — lowest latency in Claude family; also consider Amazon Nova Micro/Lite for cost-optimized speed            |
| Lowest cost            | Claude Haiku 4.5 or Amazon Nova Micro — lowest cost per token                                                                |
| Specialized capability | Deferred to Q17 to determine which model                                                                                     |
| Balanced               | Claude Sonnet 4.6 as default balanced recommendation                                                                         |

Interpret:

```
A -> ai_priority: "quality" — Claude Sonnet 4.6; Opus 4.6 for hardest tasks
B -> ai_priority: "speed" — Haiku 4.5 or Nova Micro
C -> ai_priority: "cost" — Haiku 4.5 or Nova Micro
D -> ai_priority: "specialized" — deferred to Q17
E -> ai_priority: "balanced" — Claude Sonnet 4.6
F -> same as default (E)
```

Default: E — `ai_priority: "balanced"`.

---

## Q17 — What is your MOST CRITICAL specialized AI feature?

**Rationale:** Specialized features can override the priority-based model selection from Q16. Some features are only available in specific models.

> Some features are only available in specific models. This helps me ensure the recommended model supports your critical requirement.
>
> A) Function calling / Tool use
> B) Ultra-long context (> 300K tokens)
> C) Extended thinking / Chain-of-thought
> D) Prompt caching
> E) RAG optimization
> F) Agentic workflows
> G) Real-time speed (< 500ms)
> H) Multimodal with image generation
> I) Real-time conversational speech
> J) None — standard features are sufficient

| Answer                               | Recommendation Impact                                                                                                                        |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Function calling / Tool use          | Claude Sonnet 4.6 — best-in-class tool use on Bedrock via structured JSON tool schemas; supports parallel tool calls and multi-turn tool use |
| Ultra-long context (> 300K tokens)   | Claude Sonnet 4.6 — supports 1M token context window (beta); no chunking strategy required for most use cases                                |
| Extended thinking / Chain-of-thought | Claude Sonnet 4.6 with extended thinking mode; Claude Opus 4.6 for most complex reasoning                                                    |
| Prompt caching                       | Claude Sonnet 4.6 with prompt caching enabled; cost savings analysis included                                                                |
| RAG optimization                     | Amazon Bedrock Knowledge Bases recommended alongside model; Titan Embeddings for vector store                                                |
| Agentic workflows                    | Claude Sonnet 4.6 with Bedrock Agents; multi-agent orchestration guidance included                                                           |
| Real-time speed (< 500ms)            | Claude Haiku 4.5 or Nova Micro; streaming response guidance included                                                                         |
| Multimodal with image generation     | Claude Sonnet 4.6 (vision) + Amazon Nova Canvas or Titan Image Generator for generation                                                      |
| Real-time conversational speech      | Amazon Nova Sonic recommended for speech-to-speech; latency guidance included                                                                |
| None                                 | Default recommendation from Q16 priority stands                                                                                              |

Interpret:

```
A -> ai_critical_feature: "function-calling" — Claude Sonnet 4.6
B -> ai_critical_feature: "long-context" — Claude Sonnet 4.6 (1M context)
C -> ai_critical_feature: "extended-thinking" — Claude Sonnet 4.6 extended thinking; Opus 4.6
D -> ai_critical_feature: "prompt-caching" — Claude Sonnet 4.6 with caching
E -> ai_critical_feature: "rag" — Bedrock Knowledge Bases + Titan Embeddings
F -> ai_critical_feature: "agentic" — Claude Sonnet 4.6 + Bedrock Agents
G -> ai_critical_feature: "real-time-speed" — Haiku 4.5 or Nova Micro
H -> ai_critical_feature: "multimodal-generation" — Sonnet 4.6 + Nova Canvas/Titan Image
I -> ai_critical_feature: "speech" — Nova Sonic (hard override — Claude has no speech)
J -> (no constraint written — Q16 priority stands)
```

Default: J — no additional override.

---

## Q18 — What's your AI usage volume and cost tolerance?

**Rationale:** Volume at scale changes the economics significantly. High-volume workloads should use provisioned throughput or cheaper models even if quality is slightly lower.

> Volume determines whether on-demand or provisioned throughput is more cost-effective, and whether we should optimize for cost over quality.
>
> A) Low volume + quality priority — small-scale, quality matters most
> B) Medium volume + balanced — moderate production use, balanced approach
> C) High volume + cost critical — high scale, budget is tight, need cost control

| Answer                        | Recommendation Impact                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Low volume + quality priority | On-demand Claude Sonnet; no provisioned throughput needed                                                     |
| Medium volume + balanced      | On-demand Claude Sonnet or Haiku depending on Q16; Savings Plans analysis                                     |
| High volume + cost critical   | **Provisioned throughput strongly recommended**; Claude Haiku or Nova Micro; prompt caching analysis included |

Interpret:

```
A -> ai_volume_cost: "low-quality" — On-demand; quality model
B -> ai_volume_cost: "medium-balanced" — On-demand; Savings Plans analysis
C -> ai_volume_cost: "high-cost-critical" — Provisioned throughput; cheaper models; prompt caching
```

Default: A — `ai_volume_cost: "low-quality"`.

---

## Q19 — Which Gemini or OpenAI model are you currently using?

**Rationale:** The source model establishes the baseline Bedrock recommendation — a like-for-like capability match. This is a starting point only; answers to Q16 (priority), Q17 (features), Q18 (volume), Q21 (latency), and Q22 (complexity) can all override this baseline.

**Override hierarchy:**

1. Q17 special features — hard overrides (e.g., speech-to-speech forces Nova Sonic regardless of source model)
2. Q16 priority — adjusts up or down within the Claude family
3. Q18/Q21 volume and latency — may further adjust toward provisioned throughput or faster models
4. Q19 source model — baseline only, used when no overrides apply

> The model you're currently using helps me recommend the closest Bedrock equivalent as a starting point.
>
> A) Gemini Flash (1.5/2.0/2.5 Flash)
> B) Gemini Pro (1.5/2.5/3 Pro)
> C) GPT-3.5 Turbo
> D) GPT-4 / GPT-4 Turbo
> E) GPT-4o
> F) GPT-5 / GPT-5.x
> G) o-series (o1, o3)
> H) Other / Multiple models
> I) I don't know

| Source Model              | Baseline Bedrock Recommendation                                       | Pricing Context                                                  |
| ------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Gemini Flash variants     | Claude Haiku 4.5 ($1/$5) — speed and cost optimized                   | Strong savings vs Gemini Flash pricing                           |
| Gemini Pro variants       | Claude Sonnet 4.6 ($3/$15) — quality match                            | Comparable pricing tier                                          |
| GPT-3.5 Turbo             | Claude Haiku 4.5 ($1/$5) — cost-equivalent                            | Haiku is faster and cheaper                                      |
| GPT-4 / GPT-4 Turbo       | Claude Sonnet 4.6 ($3/$15) — quality equivalent                       | Major savings: GPT-4 Turbo is $10/$30 vs Sonnet $3/$15           |
| GPT-4o                    | Claude Sonnet 4.6 ($3/$15) — performance equivalent                   | Modest savings on output; input slightly higher on Bedrock       |
| GPT-5 / GPT-5.x           | Claude Sonnet 4.6 ($3/$15) — performance equivalent                   | GPT-5 is $1.25/$10 — savings story is quality/features, not cost |
| GPT-5 (flagship use case) | Claude Opus 4.6 ($5/$25) — flagship-to-flagship                       | Opus still cheaper than GPT-5 Pro ($15/$120)                     |
| o-series (o1, o3)         | Claude Sonnet 4.6 with extended thinking; Opus 4.6 for most demanding | o1 is $15/$60 — significant savings with Sonnet 4.6 at $3/$15    |

**Example overrides:**

- GPT-4 user (baseline: Sonnet 4.6) + Q16=lowest cost → **Haiku 4.5**
- Gemini Flash user (baseline: Haiku 4.5) + Q17=extended thinking → **Sonnet 4.6 with extended thinking**
- GPT-4o user (baseline: Sonnet 4.6) + Q17=real-time speech → **Nova Sonic** (Claude has no speech)
- GPT-3.5 user (baseline: Haiku 4.5) + Q22=complex reasoning → **Sonnet 4.6** (complexity overrides cost mapping)
- GPT-5 user (baseline: Opus 4.6) + Q16=balanced → **Sonnet 4.6** (priority overrides flagship mapping)

Interpret:

```
A -> ai_model_baseline: "claude-haiku-4-5" — speed/cost optimized
B -> ai_model_baseline: "claude-sonnet-4-6" — quality match
C -> ai_model_baseline: "claude-haiku-4-5" — cost equivalent
D -> ai_model_baseline: "claude-sonnet-4-6" — quality equivalent; major savings
E -> ai_model_baseline: "claude-sonnet-4-6" — performance equivalent
F -> ai_model_baseline: "claude-sonnet-4-6" — default; "claude-opus-4-6" for flagship use cases
G -> ai_model_baseline: "claude-sonnet-4-6-extended-thinking" — reasoning equivalent
H -> ai_model_baseline: "claude-sonnet-4-6" — safe default for multiple models
I -> same as default (use Q16 priority to determine)
```

Default: _(auto-detect from code)_ — fall back to Q16 priority-based selection.

---

## Q20 — Do you need vision (image understanding) or just text?

**Rationale:** Vision capability narrows the model selection to multimodal-capable models only.

> Vision capability limits which models are available. This ensures the recommendation supports your input types.
>
> A) Text only
> B) Vision required — model must process images
> C) Audio/Video inputs needed

| Answer             | Recommendation Impact                                                                 |
| ------------------ | ------------------------------------------------------------------------------------- |
| Text only          | Full model catalog available; cheapest/fastest text model per Q16 priority            |
| Vision required    | Claude Sonnet family (multimodal) required; Haiku excluded for vision tasks           |
| Audio/Video inputs | Amazon Nova Reel (video) or Nova Sonic (audio); Claude excluded for audio/video input |

Interpret:

```
A -> (no constraint written — full model catalog)
B -> ai_vision: "required" — Claude Sonnet family required; Haiku excluded for vision
C -> ai_vision: "audio-video" — Nova Reel (video) or Nova Sonic (audio); Claude excluded
```

Default: A — no constraint (text only).

---

## Q21 — How important is AI response speed?

**Rationale:** Latency requirements can override cost and quality preferences from Q16.

**Context for user:** When asking, anchor each option in a real scenario:

- **Critical (< 500ms)** — users are staring at a loading spinner; every millisecond matters (e.g., autocomplete, live chat, real-time transcription)
- **Important (< 2s)** — users expect a quick response but a brief pause is acceptable (e.g., chat assistant, search augmentation, inline suggestions)
- **Flexible (2–10s)** — users submit a request and can wait; background or async is fine (e.g., report generation, batch analysis, email drafting)

> Latency requirements can override cost and quality preferences from your earlier answers.
>
> A) Critical (< 500ms) — users staring at a loading spinner
> B) Important (< 2s) — quick response expected, brief pause acceptable
> C) Flexible (2–10s) — users can wait, background/async acceptable

| Answer             | Recommendation Impact                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| Critical (< 500ms) | Claude Haiku 4.5 or Nova Micro; streaming required; provisioned throughput for consistent latency |
| Important (< 2s)   | Claude Sonnet 4.6 with streaming; standard on-demand acceptable                                   |
| Flexible (2–10s)   | Any model; batch inference considered for cost savings at high volume                             |

Interpret:

```
A -> ai_latency: "critical" — Haiku 4.5 or Nova Micro; streaming; provisioned throughput
B -> ai_latency: "important" — Sonnet 4.6 with streaming; on-demand
C -> ai_latency: "flexible" — Any model; batch inference for cost savings
```

Default: B — `ai_latency: "important"`.

---

## Q22 — How complex are your AI tasks?

**Rationale:** Task complexity determines whether a cheaper/faster model can handle the workload or whether a more capable model is required.

**Context for user:** When asking, give concrete examples so the user doesn't over- or under-estimate:

- **Simple** — single-step tasks with short prompts: classify this text, extract these fields, summarize this paragraph
- **Moderate** — multi-step prompts with examples or structured output: analyze this document and return JSON, generate content following a template, few-shot classification
- **Complex** — multi-turn reasoning, tool use, or long chain-of-thought: agentic workflows, code generation with debugging loops, research tasks that require planning and iteration

> Task complexity determines whether a cheaper/faster model can handle the workload or whether a more capable model is required.
>
> A) Simple (classification, short summaries, extraction)
> B) Moderate (analysis, structured content, few-shot)
> C) Complex (multi-step reasoning, tool use, agentic workflows)

| Answer   | Recommendation Impact                                                                       |
| -------- | ------------------------------------------------------------------------------------------- |
| Simple   | Claude Haiku 4.5 or Nova Micro sufficient; significant cost savings vs larger models        |
| Moderate | Claude Sonnet 4.6 recommended; Haiku may suffice with prompt engineering                    |
| Complex  | Claude Sonnet 4.6 required; extended thinking considered; Claude Opus 4.6 for hardest tasks |

Interpret:

```
A -> ai_complexity: "simple" — Haiku 4.5 or Nova Micro sufficient
B -> ai_complexity: "moderate" — Sonnet 4.6 recommended; Haiku may suffice
C -> ai_complexity: "complex" — Sonnet 4.6 required; Opus 4.6 for hardest tasks
```

Default: B — `ai_complexity: "moderate"`.

## Clarify Compute

# Category B — Configuration Gaps + Category C — Compute Model

This file covers two related categories:

- **Category B** — Configuration gaps for billing-source inventories (factual questions to fill inferred data)
- **Category C** — Compute model questions (platform and traffic pattern decisions)

---

## Category B — Configuration Gaps (Billing-Source Inventories Only)

_Fire when:_ `gcp-resource-inventory.json` exists with `metadata.source == "billing"` AND at least one resource has `config_confidence == "assumed"`.
_Skip when:_ `metadata.source == "terraform"`.

These fill factual gaps in the inferred inventory. Answers update the inventory understanding — they do not produce design constraints directly.

- **Cloud SQL HA**: Single-zone or high-availability? _(ask if SKU says Zonal)_
  > Default: assume Zonal is intentional.
- **Cloud Run service count**: How many distinct services? _(ask if Cloud Run billing is present)_
  > Default: assume 1 service.
- **Memorystore memory size**: How much memory (GB)? _(ask if cannot be derived from usage units)_
  > Default: estimate from usage amount.
- **Cloud Functions generation**: Gen 1 or Gen 2? _(ask if SKU does not specify)_
  > Default: assume Gen 1.

Record Category B answers in `metadata.inventory_clarifications`.

---

## Category C — Compute Model (If Compute Resources Present)

_Fire when:_ Compute resources present (Cloud Run, Cloud Functions, GKE, GCE).

---

## Q8 — How does your team feel about managing Kubernetes?

_Fire when:_ GKE cluster present AND Q5 != A (multi-cloud). Skip when: Q5 = A (already resolved to EKS) or no GKE in inventory.

**Rationale:** When multi-cloud is not required (Q5=No) and GKE is detected, team sentiment is the deciding factor between EKS and ECS Fargate. This is subjective and cannot be inferred from IaC.

**Context for user:** When asking, frame it practically so the user gives an honest answer rather than aspirational:

- **Love it / K8s expert** — your team writes Helm charts, debugs CrashLoopBackOff in their sleep, and actively chose K8s
- **Neutral / Competent** — K8s works, your team can operate it, but it's not a passion project
- **Frustrated / Steep curve** — K8s feels like overhead; your team spends more time fighting YAML than shipping features

> Your team's Kubernetes experience determines whether we recommend EKS (Kubernetes on AWS) or ECS Fargate (simpler managed containers).
>
> A) Love it / Team is K8s expert
> B) Neutral / Competent with K8s
> C) Frustrated / Learning curve steep
> D) N/A — We don't use Kubernetes
> E) I don't know

| Answer                   | Recommendation Impact                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Love it / K8s expert     | EKS recommended — preserves existing Kubernetes investment and expertise                                     |
| Neutral / Competent      | EKS recommended with managed node groups to reduce operational burden                                        |
| Frustrated / Steep curve | **Strong ECS Fargate recommendation** — eliminates Kubernetes management entirely; simpler operational model |

_Note: If Q5=Yes (multi-cloud), this question is skipped and EKS is already decided._

Interpret:

```
A -> kubernetes: "eks-managed" — EKS recommended, preserves K8s investment
B -> kubernetes: "eks-or-ecs" — EKS with managed node groups to reduce operational burden
C -> kubernetes: "ecs-fargate" — Strong ECS Fargate recommendation, eliminates K8s management
D -> (no constraint written — no K8s workloads)
E -> same as default (B) — assume neutral, evaluate both EKS and ECS
```

Default: B — `kubernetes: "eks-or-ecs"`.

---

## Q9 — Do any of your services need WebSocket support or long-lived connections?

_Fire when:_ Compute resources present AND WebSocket usage cannot be determined from inventory.

**Rationale:** WebSocket support affects load balancer configuration. App Runner is now on KTLO (keep the lights on) and is no longer recommended for any workload — this question confirms whether ALB WebSocket configuration is needed in templates.

> WebSocket support affects load balancer configuration. This confirms whether ALB WebSocket configuration is needed in the migration templates.
>
> A) Yes — Real-time features, WebSockets, persistent connections
> B) No — Standard HTTP/HTTPS only
> C) I don't know

| Answer                  | Recommendation Impact                                                         |
| ----------------------- | ----------------------------------------------------------------------------- |
| Yes — WebSockets needed | ECS Fargate or EKS required; ALB with WebSocket support included in templates |
| No — HTTP only          | ECS Fargate recommended for simple stateless services                         |

Interpret:

```
A -> websocket: "required" — ALB with WebSocket support, ECS Fargate or EKS required
B -> (no constraint written)
C -> same as default (B) — assume no WebSocket; can be reconfigured later
```

Default: B — no constraint.

---

## Q10 — What's your typical traffic pattern for your Cloud Run services?

_Fire when:_ Cloud Run present in inventory. Skip when: no Cloud Run.

**Rationale:** Cloud Run's scale-to-zero is its primary cost advantage. If traffic is constant, that advantage disappears and AWS becomes cost-competitive or cheaper. This drives whether we recommend migrating Cloud Run at all.

> Cloud Run's scale-to-zero is its primary cost advantage. Understanding your traffic pattern helps me determine whether migrating Cloud Run to AWS makes financial sense.
>
> A) Business hours only (9am–5pm weekdays, ~40 hrs/week)
> B) Active most of the day (16–20 hours, ~120 hrs/week)
> C) Constant 24/7 traffic (~168 hrs/week)
> D) N/A — We don't use Cloud Run
> E) I don't know

| Answer              | Recommendation Impact                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| Business hours only | AWS likely 40–50% MORE expensive — recommend staying on Cloud Run or flagging cost increase prominently |
| Active most of day  | Moderate cost difference — present both options with cost comparison                                    |
| Constant 24/7       | AWS costs similar or cheaper — ECS Fargate recommended as straightforward migration                     |

Interpret:

```
A -> cloud_run_traffic_pattern: "business-hours" — AWS likely 40-50% MORE expensive; flag cost increase
B -> cloud_run_traffic_pattern: "most-of-day" — Moderate cost difference; present both options
C -> cloud_run_traffic_pattern: "constant-24-7" — AWS costs similar or cheaper; ECS Fargate recommended
D -> (no constraint written — Cloud Run not used)
E -> same as default (C) — assume constant traffic for conservative estimate
```

Default: C — `cloud_run_traffic_pattern: "constant-24-7"`.

---

## Q11 — Approximately how much are you spending on Cloud Run per month?

_Fire when:_ Cloud Run present in inventory. Skip when: no Cloud Run.

**Rationale:** Absolute spend determines whether the migration math makes financial sense regardless of traffic pattern. Low-spend Cloud Run workloads are rarely worth the migration complexity.

> Absolute Cloud Run spend determines whether the migration math makes financial sense regardless of traffic pattern.
>
> A) < $100/month
> B) $100–$500/month
> C) $500–$1,500/month
> D) > $1,500/month
> E) N/A — We don't use Cloud Run
> F) I don't know

| Answer            | Recommendation Impact                                                            |
| ----------------- | -------------------------------------------------------------------------------- |
| < $100/month      | Recommend staying on Cloud Run — migration cost and complexity exceeds savings   |
| $100–$500/month   | Present cost comparison; migration may make sense if consolidating to AWS        |
| $500–$1,500/month | Fixed-cost AWS options (ECS Fargate reserved capacity) become attractive         |
| > $1,500/month    | Strong case for migration to ECS Fargate with Savings Plans or reserved capacity |

Interpret:

```
A -> cloud_run_monthly_spend: "<$100" — Recommend staying on Cloud Run; migration cost exceeds savings
B -> cloud_run_monthly_spend: "$100-$500" — Present cost comparison; migration may make sense if consolidating
C -> cloud_run_monthly_spend: "$500-$1500" — Fixed-cost AWS options attractive (ECS Fargate reserved)
D -> cloud_run_monthly_spend: ">$1500" — Strong case for ECS Fargate with Savings Plans
E -> (no constraint written)
F -> same as default (B)
```

Default: B — `cloud_run_monthly_spend: "$100-$500"`.

## Clarify Database

# Category D — Database Model (If Database Resources Present)

_Fire when:_ Database resources present (Cloud SQL, Spanner, Memorystore).

Traffic pattern and I/O intensity determine the Aurora configuration — standard vs I/O-Optimized, read replicas, Serverless v2, or DSQL.

---

## Database Engine Detection

Before asking questions, detect the database engine from IaC (`database_version` in `google_sql_database_instance`). State what was found:

> "I see Cloud SQL for PostgreSQL (or MySQL) in your Terraform."

Handle non-Aurora-compatible engines:

| Detected Engine          | Migration Target                                                  | Notes                                |
| ------------------------ | ----------------------------------------------------------------- | ------------------------------------ |
| Cloud SQL for PostgreSQL | Aurora PostgreSQL                                                 | Direct migration path                |
| Cloud SQL for MySQL      | Aurora MySQL                                                      | Direct migration path                |
| Cloud SQL for SQL Server | **RDS for SQL Server**                                            | Aurora doesn't support SQL Server    |
| Spanner                  | Aurora DSQL (global distributed) or DynamoDB (key-value patterns) | Migration path differs significantly |
| Firestore                | DynamoDB                                                          | NoSQL migration                      |
| AlloyDB                  | Aurora PostgreSQL                                                 | Closest equivalent                   |

If the engine is not PostgreSQL or MySQL, note that Aurora doesn't support it and flag the appropriate RDS or DynamoDB target. Ask the user to confirm if detection is ambiguous.

---

## Q12 — What does your database traffic pattern look like?

_Fire when:_ Cloud SQL present in inventory. Skip when: no Cloud SQL.

**Rationale:** Database traffic pattern determines whether standard Aurora is sufficient or whether more specialized options (read replicas, DSQL, Serverless v2) are needed. Asking about the pattern rather than whether they have a problem avoids leading the answer.

**Context for user:** When asking, give concrete examples so the user can pattern-match to their situation:

- **Steady, predictable load** — consistent query volume day-to-day, no major spikes (e.g., internal CRUD app, content CMS)
- **Read-heavy with occasional write spikes** — mostly reads with bursts of writes at certain times (e.g., reporting dashboards, catalog browsing with periodic bulk imports)
- **Write-heavy or globally distributed writes** — high write throughput or writes coming from multiple regions (e.g., IoT ingestion, multi-region user-generated content, event logging)
- **Rapidly growing** — traffic is noticeably increasing month over month, doubling every few months (e.g., post-launch growth, viral product)

> Understanding your database traffic pattern helps me recommend the right Aurora configuration — standard vs I/O-Optimized, read replicas, or Serverless v2.
>
> A) Steady, predictable load — consistent volume, no major spikes
> B) Read-heavy with occasional write spikes — mostly reads, periodic write bursts
> C) Write-heavy or globally distributed writes — high write throughput or multi-region writes
> D) Rapidly growing — doubling every few months
> E) N/A — We don't use Cloud SQL
> F) I don't know

| Answer                              | Recommendation Impact                                                                                            |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Steady, predictable                 | Standard Aurora Multi-AZ; straightforward sizing from current Cloud SQL config                                   |
| Read-heavy with write spikes        | Aurora with read replicas; auto-scaling read capacity                                                            |
| Write-heavy or globally distributed | **Aurora DSQL considered** for global active-active; architecture review flagged                                 |
| Rapidly growing                     | Aurora with headroom planning; **Aurora Serverless v2** for elastic scaling; revisit sizing at 6-month intervals |

Interpret:

```
A -> database_traffic: "steady" — Standard Aurora Multi-AZ
B -> database_traffic: "read-heavy" — Aurora with read replicas; auto-scaling read capacity
C -> database_traffic: "write-heavy-global" — Aurora DSQL considered; architecture review flagged
D -> database_traffic: "rapidly-growing" — Aurora Serverless v2 for elastic scaling
E -> (no constraint written)
F -> same as default (A) — assume steady traffic
```

Default: A — `database_traffic: "steady"`.

---

## Q13 — What's your typical database I/O workload?

_Fire when:_ Cloud SQL present in inventory. Skip when: no Cloud SQL.

**Rationale:** Aurora has two pricing modes — standard and I/O-Optimized. The right choice depends on actual I/O intensity. Choosing wrong can mean paying 40% more than necessary.

> Aurora has two pricing modes — standard and I/O-Optimized. Choosing wrong can mean paying 40% more than necessary.
>
> A) Low (< 1,000 IOPS) — Mostly reads, infrequent writes
> B) Medium (1,000–10,000 IOPS) — Balanced workload
> C) High (> 10,000 IOPS) — Write-heavy, high transactions
> D) N/A — We don't use Cloud SQL
> E) I don't know

| Answer                     | Recommendation Impact                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| Low (< 1,000 IOPS)         | Aurora standard pricing recommended                                                       |
| Medium (1,000–10,000 IOPS) | Aurora standard pricing; flag I/O-Optimized as option if workload grows                   |
| High (> 10,000 IOPS)       | **Aurora I/O-Optimized recommended** — can save up to 40% vs standard at high I/O volumes |

Interpret:

```
A -> db_io_workload: "low" — Aurora standard pricing
B -> db_io_workload: "medium" — Aurora standard; flag I/O-Optimized as option if workload grows
C -> db_io_workload: "high" — Aurora I/O-Optimized recommended (up to 40% savings at high I/O)
D -> (no constraint written)
E -> same as default (B) — assume medium I/O
```

Default: B — `db_io_workload: "medium"`.

## Clarify Global

# Category A — Global/Strategic (Always Fires)

These foundational constraints gate everything downstream — region selection, service catalog, data residency, credits eligibility, compute platform, availability topology, and migration strategy.

Present questions with a conversational tone and brief context explaining why each matters.

---

## Q1 — Where are your users located?

**Rationale:** Geography drives AWS region selection and CDN strategy. It does NOT by itself justify multi-region architecture or Aurora Global Database — those decisions require understanding write patterns and RTO/RPO requirements from Q6 (uptime) and Q7 (maintenance window). Recommending multi-region based on geography alone would over-engineer most architectures and significantly increase cost.

> I need to understand your user base to recommend the right AWS region and CDN strategy.
>
> A) Single region (e.g., US-only, EU-only)
> B) Multi-region (2–3 regions, e.g., US + EU)
> C) Global (users worldwide, latency critical)
> D) I don't know

| Answer        | Recommendation Impact                                                                                                                                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Single region | Deploy in closest AWS region to users; standard Route 53 routing                                                                                                                                                                          |
| Multi-region  | Primary region closest to majority; CloudFront for static assets and API caching; Route 53 latency-based routing — multi-region infrastructure deferred to Q6                                                                             |
| Global        | Primary region by largest user concentration; CloudFront globally distributed; Route 53 geolocation routing — Aurora Global Database and multi-region compute only if Q6 = Catastrophic AND write latency is a confirmed hard requirement |

Interpret:

```
A -> target_region: "<closest AWS region to GCP region in inventory>"
B -> target_region: "<closest AWS region>", replication: "cross-region"
C -> target_region: "<closest AWS region>", replication: "cross-region", cdn: "required"
D -> same as default (A)
```

Default: A — single region, closest AWS region to GCP region in inventory.

---

## Q2 — Do you have any compliance or regulatory requirements?

**Rationale:** Compliance requirements gate entire service categories and regions. A HIPAA customer cannot use the same architecture as an unconstrained startup.

> Compliance requirements determine which AWS services, regions, and configurations are available to you. This gates the entire architecture.
>
> A) None — No specific compliance requirements
> B) SOC 2 / ISO 27001 — Security and availability standards
> C) PCI DSS — Payment card data handling
> D) HIPAA — Healthcare data
> E) FedRAMP / Government — Federal compliance
> F) GDPR / Data residency — EU data sovereignty requirements
> G) I don't know
>
> _(Multiple selections allowed)_

| Answer            | Recommendation Impact                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| None              | Full service catalog available, any region                                                                                                 |
| SOC 2 / ISO 27001 | CloudTrail, Config, Security Hub enabled by default; encryption at rest required                                                           |
| PCI DSS           | Dedicated VPC with strict segmentation, WAF required, no shared tenancy for cardholder data, specific RDS encryption config                |
| HIPAA             | BAA-eligible services only, encryption in transit and at rest mandatory, specific logging requirements, us-east-1/us-west-2 preferred      |
| FedRAMP           | GovCloud regions required (us-gov-east-1, us-gov-west-1), GovCloud-specific service endpoints, limited service catalog                     |
| GDPR              | EU regions required (eu-west-1, eu-central-1), data residency constraints, no cross-region replication outside EU without explicit consent |

Interpret:

```
A -> (no constraint written — full service catalog available, any region)
B -> compliance: ["soc2"] — CloudTrail, Config, Security Hub enabled; encryption at rest required
C -> compliance: ["pci"] — Dedicated VPC, WAF required, strict segmentation
D -> compliance: ["hipaa"] — BAA-eligible services only, encryption mandatory, us-east-1/us-west-2 preferred
E -> compliance: ["fedramp"] — GovCloud regions required (us-gov-east-1, us-gov-west-1)
F -> compliance: ["gdpr"] — EU regions required (eu-west-1, eu-central-1), data residency constraints
G -> same as default (A) — no constraint assumed; verify with compliance team before production
```

Default: A — no constraint.

---

## Q3 — Approximately how much are you spending on GCP per month in total?

**Rationale:** Total GCP spend is the primary input for ARR estimation, which determines credits eligibility tier. Also provides a sanity check for cost estimates when billing data is not uploaded.

> Total GCP spend helps me estimate AWS credits eligibility and provides a cost baseline for the migration plan.
>
> A) < $1,000/month
> B) $1,000–$5,000/month
> C) $5,000–$20,000/month
> D) $20,000–$100,000/month
> E) > $100,000/month
> F) I don't know

**Billing enrichment:** If `billing-profile.json` exists, show:

> Your billing data shows ~$[total_monthly_spend]/month. Does this match your expectation?

| Answer                 | Recommendation Impact                                                                                                        |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| < $1,000/month         | AWS Activate credits eligibility (~$5K–$25K); cost estimates use conservative ranges                                         |
| $1,000–$5,000/month    | IW Migrate credits at 25% of ARR (~$3K–$15K/yr); mid-range estimates                                                         |
| $5,000–$20,000/month   | IW Migrate credits at 25% of ARR (~$15K–$60K/yr); Reserved Instance recommendations included                                 |
| $20,000–$100,000/month | IW Migrate credits at 25% of ARR (~$60K–$300K/yr); Savings Plans analysis; AWS Specialist consultation eligible (>=$60K ARR) |
| > $100,000/month       | MAP eligibility (>$500K ARR); Enterprise support tier; dedicated migration team engagement                                   |

Interpret (write constraint only — do NOT surface the downstream notes to the user):

```
A -> gcp_monthly_spend: "<$1K"
B -> gcp_monthly_spend: "$1K-$5K"
C -> gcp_monthly_spend: "$5K-$20K"
D -> gcp_monthly_spend: "$20K-$100K"
E -> gcp_monthly_spend: ">$100K"
F -> same as default (billing-informed bucket if billing data exists, otherwise B)
```

Default: If `billing-profile.json` exists, use the billing-informed bucket from Step 2 extraction. Otherwise B — `gcp_monthly_spend: "$1K-$5K"`.

---

## Q4 — _(Skipped)_

Credits program eligibility is inferred from Q3 (GCP spend) alone. No question asked.

Default: `funding_stage`: not set.

---

## Q5 — Do you need to run workloads across multiple cloud providers?

**Rationale:** Multi-cloud portability is an early exit condition that immediately determines the compute recommendation without needing further questions. If multi-cloud is required, Kubernetes (EKS) is the only portable abstraction layer.

> Multi-cloud portability is an immediate decision point — if required, Kubernetes (EKS) is the only portable abstraction, and we can skip several compute questions.
>
> A) Yes, multi-cloud required
> B) No, AWS-only is acceptable
> C) I don't know

| Answer                    | Recommendation Impact                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Yes, multi-cloud required | **Immediate EKS recommendation** — Kubernetes is the only portable abstraction layer. Skip Q8. ECS Fargate excluded. |
| No, AWS-only acceptable   | Full compute decision tree continues — EKS vs ECS Fargate evaluated based on K8s sentiment (Q8)                      |

Interpret:

```
A -> compute: "eks" — Immediate EKS recommendation. EARLY EXIT: skip Q8.
B -> (no constraint written — full compute decision tree continues)
C -> same as default (B) — assume AWS-only
```

Default: B — no constraint, evaluate full compute options.

---

## Q6 — If your application went down unexpectedly right now, what would happen?

**Rationale:** Availability requirements drive database engine selection, deployment topology, and whether multi-AZ is mandatory. Aurora Global Database and multi-region compute are only recommended when Catastrophic is selected AND Q1 confirms global users — both signals are required.

**Context for user:** When asking, include these descriptions so the user can self-select accurately:

- **Inconvenient** — users can wait, no revenue impact (e.g., internal tool, dev/staging environment, hobby project)
- **Significant Issue** — users notice and complain, some revenue impact, but workarounds exist (e.g., B2B SaaS with email support SLA)
- **Mission-Critical** — direct revenue loss per minute of downtime, SLA obligations to customers, needs fast recovery (e.g., e-commerce checkout, paid API)
- **Catastrophic** — regulatory, safety, or major financial consequences; every minute of downtime is measurable loss (e.g., financial transactions, healthcare systems, real-time trading)

> Availability requirements drive database engine selection, deployment topology, and whether multi-AZ is mandatory.
>
> A) INCONVENIENT — Users can wait, brief outages tolerable (5–30 min)
> B) SIGNIFICANT ISSUE — Customers frustrated, revenue loss
> C) MISSION-CRITICAL — Cannot tolerate outages, SLA violations
> D) CATASTROPHIC — Regulatory, safety, or major financial consequences per minute of downtime
> E) I don't know

| Answer            | Recommendation Impact                                                                                                                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Inconvenient      | Single-AZ RDS acceptable, standard ECS/EKS deployment, no special HA requirements                                                                                                                                                                      |
| Significant Issue | Multi-AZ RDS required, ALB with health checks, auto-scaling groups                                                                                                                                                                                     |
| Mission-Critical  | Aurora Multi-AZ (higher availability than RDS), multi-AZ mandatory, Route 53 health checks; single-region with fast failover is sufficient for most mission-critical workloads                                                                         |
| Catastrophic      | If Q1 = Global: Aurora Global Database + active-active multi-region + Route 53 failover routing; If Q1 = Single/Multi-region: Aurora Multi-AZ with aggressive RTO/RPO targets is sufficient — global infrastructure not warranted without global users |

Interpret:

```
A -> availability: "single-az" — Single-AZ RDS acceptable, standard deployment
B -> availability: "multi-az" — Multi-AZ RDS required, ALB with health checks, auto-scaling
C -> availability: "multi-az-ha" — Aurora Multi-AZ, multi-AZ mandatory, Route 53 health checks
D -> IF Q1 = C (Global): availability: "multi-region" — Aurora Global Database + active-active multi-region + Route 53 failover
     IF Q1 = A or B: availability: "multi-az-ha" — Aurora Multi-AZ with aggressive RTO/RPO (global infra not warranted without global users)
E -> same as default (B) — assume multi-AZ for safety
```

Default: B — `availability: "multi-az"`.

---

## Q7 — Do you have a scheduled maintenance window where downtime is acceptable?

**Rationale:** Determines cutover strategy and which database migration tooling is recommended. Zero-downtime migrations require significantly more complex infrastructure (blue/green, traffic shifting). With a maintenance window, databases can be taken offline briefly and migrated with native tools — without one, live replication via DMS is required.

**Database migration tooling notes:**

- For PostgreSQL databases <10GB: **pg_dump/pg_restore** is sufficient.
- For larger PostgreSQL databases (>10GB): **pgcopydb** offers parallel table copying and index rebuilding, significantly reducing migration time within the same maintenance window.
- pgcopydb's CDC mode requires `wal_level=logical` on Cloud SQL, which must be enabled explicitly.

> The maintenance window determines your migration cutover strategy and which database migration tooling we recommend. Zero-downtime migrations require significantly more complex infrastructure.
>
> A) Yes — weekly maintenance window (e.g., Sunday 2–4am)
> B) Yes — monthly maintenance window only
> C) No — zero downtime required, must use blue/green or rolling deployment
> D) Flexible — we can schedule one if needed
> E) I don't know

| Answer         | Recommendation Impact                                                                                                                                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Weekly window  | Standard cutover with DNS switchover during window; **pg_dump/pg_restore** for PostgreSQL <10GB; **pgcopydb** for larger databases — parallel copying cuts migration time significantly; no DMS licensing, no replication lag risk |
| Monthly window | Cutover timed to monthly window; pg_dump/pg_restore or **pgcopydb** depending on DB size; blue/green for application layer                                                                                                         |
| Zero downtime  | **AWS DMS required** for live database replication; blue/green deployment for application layer; Aurora blue/green deployments; Route 53 weighted routing for traffic shifting                                                     |
| Flexible       | Recommend scheduling a weekly window to enable pg_dump/pgcopydb approach; falls back to DMS if window cannot be arranged                                                                                                           |

Interpret:

```
A -> cutover_strategy: "maintenance-window-weekly" — pg_dump/pg_restore or pgcopydb recommended; standard cutover with DNS switchover
B -> cutover_strategy: "maintenance-window-monthly" — pg_dump/pg_restore or pgcopydb recommended; blue/green for app layer
C -> cutover_strategy: "zero-downtime" — AWS DMS required for live DB replication; blue/green deployment; Route 53 weighted routing
D -> cutover_strategy: "flexible" — Recommend scheduling weekly window for pg_dump approach; DMS fallback
E -> same as default (D) — assume flexible
```

Default: D — `cutover_strategy: "flexible"`.

## Clarify

# Phase 2: Clarify Requirements

**Phase 2 of 5** — Ask adaptive questions before design begins, then interpret answers into ready-to-apply design constraints.

The output — `preferences.json` — is consumed directly by Design and Estimate without any further interpretation.

Questions are organized into **six named categories (A–F)** with documented firing rules. Up to 22 questions across categories, depending on which discovery artifacts exist and which GCP services are detected. A standalone **AI-Only** flow exists for migrations that only move AI/LLM calls to Bedrock.

## Category Reference Files

| File                  | Category                     | Questions | Loaded When                                     |
| --------------------- | ---------------------------- | --------- | ----------------------------------------------- |
| `clarify-global.md`   | A — Global/Strategic         | Q1–Q7     | Always                                          |
| `clarify-compute.md`  | B — Config Gaps, C — Compute | Q8–Q11    | Compute or billing-source resources present     |
| `clarify-database.md` | D — Database                 | Q12–Q13   | Database resources present                      |
| `clarify-ai.md`       | F — AI/Bedrock               | Q14–Q22   | `ai-workload-profile.json` exists               |
| `clarify-ai-only.md`  | _(standalone)_               | Q1–Q10    | AI-only migration (no infrastructure artifacts) |

---

## Step 0: Prior Run Check

If `$MIGRATION_DIR/preferences.json` already exists:

> "I found existing migration preferences from a previous run. Would you like to:"
>
> A) Re-use these preferences and skip questions
> B) Start fresh and re-answer all questions

- If A: skip to Validation Checklist, proceed with existing file.
- If B: continue to Step 1.

---

## Step 1: Read Inventory and Determine Migration Type

Read `$MIGRATION_DIR/` and check which discovery outputs exist:

- `gcp-resource-inventory.json` + `gcp-resource-clusters.json` — infrastructure discovered
- `ai-workload-profile.json` — AI workloads detected
- `billing-profile.json` — billing data parsed

At least one discovery artifact must exist to proceed.

### Migration Type Detection

- **Full migration**: `gcp-resource-inventory.json` or `billing-profile.json` exists (may also have `ai-workload-profile.json`)
- **AI-only migration**: ONLY `ai-workload-profile.json` exists (no infrastructure or billing artifacts)

**If AI-only**: Read `steering/clarify-ai-only.md` NOW and follow that flow. Skip all remaining steps below.

> **HARD GATE — AI-Only Path:** You MUST read `steering/clarify-ai-only.md` before presenting any questions. The question text, answer options, and interpretation rules are ONLY in that file — they are NOT in this file. Do NOT fabricate questions from the summaries above.

### Discovery Summary

Present a discovery summary:

**If `gcp-resource-inventory.json` exists:**

> **Infrastructure discovered:** [total resources] GCP resources across [cluster count] clusters
> **Top resource types:** [list top 3–5 types]

**If `ai-workload-profile.json` exists:**

> **AI workloads detected:** [from `models[].model_id`]
> **Capabilities in use:** [from `integration.capabilities_summary` where true]
> **Integration pattern:** [from `integration.pattern`] via [from `integration.primary_sdk`]

**If `billing-profile.json` exists:**

> **Monthly GCP spend:** $[total_monthly_spend]
> **Top services by cost:** [top 3–5 from billing data]

---

## Step 2: Extract Known Information

Before generating questions, scan the inventory to extract values that are already known:

1. **GCP regions** — Extract all GCP regions from the inventory. Map to the closest AWS region as a suggested default for Q1.
2. **Resource types present** — Build a set of resource types: compute (Cloud Run, Cloud Functions, GKE, GCE), database (Cloud SQL, Spanner, Memorystore), storage (Cloud Storage), messaging (Pub/Sub).
3. **Billing SKUs** — If `billing-profile.json` exists, check if any SKU reveals storage class, HA configuration, or other answerable questions.
4. **GCP spend baseline** — If `billing-profile.json` exists, read `summary.total_monthly_spend` and map it to the Q3 bucket (`<1000` → A, `1000-5000` → B, `5000-20000` → C, `20000-100000` → D, `>100000` → E). Use this as the **billing-informed default for Q3** instead of the hardcoded B. Still ask Q3 (the user may know about spend beyond this billing export), but if they answer "I don't know" or "use all defaults", apply the billing-derived bucket.
5. **Config confidence** — If inventory `metadata.source = "billing"`, identify resources with `config_confidence = "assumed"` for Category B questions.
6. **AI framework detection** — If `ai-workload-profile.json` exists, check `integration.gateway_type` and `integration.frameworks` for auto-detection of Q14 answer.

Record extracted values. Questions whose answers are fully determined by extraction will be skipped and the extracted value used directly with `chosen_by: "extracted"`.

---

## Step 3: Generate Questions by Category

### Category Definitions and Firing Rules

| Category | Name               | Firing Rule                                                                                     | Reference File        | Questions                                                                                                           |
| -------- | ------------------ | ----------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **A**    | Global/Strategic   | **Always fires**                                                                                | `clarify-global.md`   | Q1 (location), Q2 (compliance), Q3 (GCP spend), Q4 (funding stage), Q5 (multi-cloud), Q6 (uptime), Q7 (maintenance) |
| **B**    | Configuration Gaps | Inventory with `metadata.source == "billing"` AND at least one `config_confidence == "assumed"` | `clarify-compute.md`  | Cloud SQL HA, Cloud Run count, Memorystore memory, Functions gen                                                    |
| **C**    | Compute Model      | Compute resources present (Cloud Run, Cloud Functions, GKE, GCE)                                | `clarify-compute.md`  | Q8 (K8s sentiment), Q9 (WebSocket), Q10 (Cloud Run traffic), Q11 (Cloud Run spend)                                  |
| **D**    | Database Model     | Database resources present (Cloud SQL, Spanner, Memorystore)                                    | `clarify-database.md` | Q12 (DB traffic pattern), Q13 (DB I/O)                                                                              |
| **E**    | Migration Posture  | **Disabled by default** — requires explicit user opt-in                                         | _(inline below)_      | HA upgrades, right-sizing                                                                                           |
| **F**    | AI/Bedrock         | `ai-workload-profile.json` exists                                                               | `clarify-ai.md`       | Q14–Q22                                                                                                             |

**Apply firing rules to determine which categories are active:**

1. Category A is always active.
2. Check inventory `metadata.source` — if `"billing"` with assumed configs, Category B is active.
3. Check for compute resources — if present, Category C is active. Within C, skip Q8 if no GKE present. Skip Q10/Q11 if no Cloud Run present.
4. Check for database resources — if present, Category D is active.
5. Category E is disabled by default. Do not activate unless user opts in.
6. Check for `ai-workload-profile.json` — if present, Category F is active.

**If no IaC, billing data, or code is available** (empty discovery): only Category A is active. All service-specific categories are skipped.

### HARD GATE — Read Category Files Before Proceeding

> **STOP. You MUST read each active category's file NOW, before moving to Step 4.**
>
> The exact question wording, answer options, context rationale, and interpretation rules exist ONLY in the category files listed below. They are NOT in this file. The table above is a summary index only — do NOT use it to fabricate questions.
>
> **Read these files based on which categories are active:**
>
> | Active Category | File to Read                    |
> | --------------- | ------------------------------- |
> | A (always)      | `steering/clarify-global.md`    |
> | B or C          | `steering/clarify-compute.md`   |
> | D               | `steering/clarify-database.md`  |
> | F               | `steering/clarify-ai.md`        |
>
> **Do NOT proceed to Step 4 until you have read every applicable file above.**

### Early-Exit Rules

Apply these before presenting questions:

- **Q5 = "Yes, multi-cloud required"** — Immediately record `compute: "eks"`. Skip Q8 (Kubernetes sentiment) — all container workloads resolve to EKS.
- **Q10/Q11 N/A** — Cloud Run not present, auto-skip.
- **Q12/Q13 N/A** — Cloud SQL not present, auto-skip.
- **Q14 auto-detected** — If `integration.gateway_type` and `integration.frameworks` fully resolve the framework, skip Q14 and use extracted value.

---

## Category E — Migration Posture (Disabled by Default)

_Fire when:_ User explicitly opts in.
_Default behavior when disabled:_ Apply conservative defaults — no HA upgrades, no right-sizing.

If the user opts in, present after all other categories:

- **HA upgrade preference**: Should we recommend upgrading Single-AZ to Multi-AZ where possible?
  > Default: No — keep current topology.
- **Right-sizing from billing**: Should we use billing utilization data to right-size instance types?
  > Default: No — match current capacity.

---

## Step 4: Present Questions Interactively

Present questions **one at a time** in conversational order. Wait for the user's response to each question before presenting the next one. This creates a natural dialogue rather than an overwhelming form.

**Formatting rule:** When presenting answer options, put each option on its own line with a blank line between options so they are visually separated and easy to scan. Never run options together on consecutive lines without spacing.

### Flow

1. **Calculate question set**: Before starting, determine which questions will be asked. Remove all **pre-excluded** questions first — these are never counted in M and never mentioned to the user:
   - Category firing rules (which categories are active based on inventory artifacts)
   - N/A skips (Cloud Run not present → remove Q10/Q11; Cloud SQL not present → remove Q12/Q13; no GKE → remove Q8)
   - Auto-detection skips (Q14 framework auto-detected from code)
   - IDE/CLI mode skips (Q4 in non-web mode)

   Pre-excluded questions do not exist from the user's perspective — do NOT announce them as "skipped" during the flow.

   Calculate `M` = total questions remaining after removing pre-excluded questions. **Do NOT factor in answer-dependent early-exit skips** (e.g., Q5→Q8) — those are the only skips communicated to the user mid-flow.

   **Double-check:** List out the specific question numbers that will be asked. Verify the count matches M.

2. **Opening message**: Present a brief introduction before the first question:

   > Before mapping your infrastructure to AWS, I have **M questions** to tailor the migration plan. I'll ask them one at a time.
   >
   > You can answer each, or say **"use all defaults"** to accept defaults for all remaining questions.

3. **Ask one question at a time**: For each question in order:
   - Show the progress indicator: **"Question N of M"**
   - When entering a new section for the first time, show the section header
   - Present the question with its context and answer options
   - **Wait for the user's response before presenting the next question**
   - Apply the interpret rule immediately after receiving the answer
   - Check inline early-exit rules: if Q5 = "Yes, multi-cloud required", record `compute: "eks"`, remove Q8 from remaining questions, add Q8 to `questions_skipped_early_exit`, and reduce `M` by the number of questions skipped.

   **Communicating skipped questions:** When an answer causes later questions to be skipped, reduce `M` by the number of skipped questions and show a one-line note before the next question:
   > *(Skipping [count] question(s) based on your previous answer — [M] questions total now.)*

   Then continue the progress indicator using the updated `M`. For example, if the original M was 8 and 1 question is skipped after Question 4, M becomes 7. The next question shown is "Question 5 of 7", then "Question 6 of 7", then "Question 7 of 7".

   Keep it short and general. Never reference internal question IDs (Q8, Q14, etc.) or technical constraint details (compute: "eks") in user-facing messages. The user doesn't need to know which specific question was removed or why — just that the total changed.

4. **Handle user shortcuts at any point during the conversation**:
   - **"use all defaults"** or **"defaults for the rest"** → Before applying defaults, present a plain-language summary of what the defaults mean for the remaining unanswered questions so the customer knows exactly what they're getting. Use a bulleted list where each item is a self-contained sentence — no option codes, no table columns. Example:

     > Here's what I'll assume for the remaining questions:
     >
     > - **Uptime**: Your app needs high availability — we'll deploy across multiple availability zones (Multi-AZ)
     > - **Maintenance window**: Flexible — we can schedule a maintenance window when you're ready for cutover
     > - **Kubernetes**: Neutral stance — we'll evaluate both EKS and ECS and recommend the best fit
     > - **Database I/O**: Medium workload — Aurora standard pricing (we can switch to I/O-Optimized later if needed)
     > - *(... list all remaining unanswered questions ...)*
     >
     > These are conservative, middle-of-the-road choices. Does this work for you, or would you prefer to go through them one by one?

     - If the customer **accepts** → Apply all defaults, skip to Step 5
     - If the customer **rejects** or wants to go through them → Continue presenting questions one at a time as normal from where they left off

5. **Handle "I don't know" or "idk" answers**: When the user selects "I don't know" (or says "idk", "not sure", etc.) for any question, do NOT silently apply the default. Instead, explain the default and confirm:

     > The default for this question is **[default option label]** — [plain-language explanation of what this means for their migration].
     >
     > Is that acceptable, or would you like to reconsider?
     >
     > **Exception — Q3 (GCP spend):** Do not explain downstream implications (credits, pricing tiers, savings programs). Just state the default bucket and, if billing data exists, note it matches their billing data. Nothing more.

     - If the customer **accepts** → Apply the default, record `chosen_by: "default"`, move to the next question
     - If the customer **wants to reconsider** → Re-present the same question's options (excluding "I don't know") and let them choose

6. **Section transitions**: When moving between categories, briefly introduce the new section:
   > *Now let's talk about your infrastructure...*
   >
   > *(or)* *Now let's discuss your AI workloads...*

7. **Completion**: After the last question is answered, confirm:
   > That's all my questions. Let me generate your migration preferences.

   **If questions were skipped**, acknowledge it briefly so the user isn't surprised by the gap between the announced total and the number actually asked:
   > That's all my questions — the rest didn't apply to your setup. Let me generate your migration preferences.

### Question Order

Present in this order (skipping any that don't apply):

```
--- Section 1: About Your Users & Requirements ---
Q1 → Q2 → Q3 → Q4 → Q5 → Q6 → Q7

--- Section 2: Your Infrastructure ---
[Category B questions, if applicable]
Q8 → Q9 → Q10 → Q11 → Q12 → Q13

--- Section 3: AI Workloads ---
Q14 → Q15 → Q16 → Q17 → Q18 → Q19 → Q20 → Q21 → Q22
```

Wait for the user's response to EVERY question. Do NOT batch questions. Do NOT proceed to Design without completing all questions or receiving an explicit "use all defaults".

---

## Answer Combination Triggers

| Scenario                     | Key Answers                                  | Recommendation                                            |
| ---------------------------- | -------------------------------------------- | --------------------------------------------------------- |
| Early-stage credits          | Q4 = Pre-seed/Seed                           | AWS Activate Founders or Portfolio credits                |
| Growth-stage credits         | Q4 = Series B+ and Q3 spend                  | IW Migrate or MAP credits based on ARR                    |
| Must stay portable           | Q5 = Yes multi-cloud                         | EKS only, no ECS Fargate                                  |
| Kubernetes-averse            | Q5 = No + Q8 = Frustrated                    | ECS Fargate strongly recommended                          |
| WebSocket app                | Q9 = Yes                                     | ALB WebSocket config required                             |
| Low-traffic Cloud Run        | Q10 = Business hours + Q11 < $100            | Recommend staying on Cloud Run                            |
| High I/O database            | Q13 = High IOPS                              | Aurora I/O-Optimized                                      |
| Write-heavy global DB        | Q6 = Catastrophic + Q12 = Write-heavy/global | Aurora DSQL                                               |
| Rapidly growing DB           | Q12 = Rapidly growing                        | Aurora Serverless v2                                      |
| Zero downtime required       | Q7 = No downtime                             | Blue/green + AWS DMS required                             |
| HIPAA compliance             | Q2 = HIPAA                                   | BAA services only, specific regions                       |
| FedRAMP required             | Q2 = FedRAMP                                 | GovCloud regions only                                     |
| Gateway-only AI              | Q14 = B only (LLM router/gateway)            | Config change only; skip SDK migration                    |
| LangChain/LangGraph AI       | Q14 includes C                               | Provider swap via ChatBedrock; 1–3 days                   |
| OpenAI Agents SDK            | Q14 includes E                               | Highest AI effort; Bedrock Agents; 2–4 weeks              |
| Multi-agent + MCP            | Q14 = D + F                                  | Bedrock Agents to unify orchestration + MCP               |
| Voice platform AI            | Q14 includes G                               | Check native Bedrock support; Nova Sonic if needed        |
| GPT-4 Turbo migration        | Q19 = GPT-4 Turbo                            | Claude Sonnet 4.6 — 70% cheaper on input                  |
| o-series migration           | Q19 = o-series                               | Claude Sonnet 4.6 with extended thinking                  |
| High-volume cost-critical AI | Q18 = High + cost critical                   | Nova Micro or Haiku 4.5 + provisioned throughput          |
| Reasoning/agent workload     | Q17 = Extended thinking                      | Claude Sonnet 4.6 extended thinking; Opus 4.6 for hardest |
| Speech-to-speech AI          | Q17 = Real-time speech                       | Nova Sonic                                                |
| RAG workload                 | Q17 = RAG optimization                       | Bedrock Knowledge Bases + Titan Embeddings                |
| Vision workload              | Q20 = Vision required                        | Claude Sonnet 4.6 (multimodal)                            |
| Latency-critical AI          | Q21 = Critical                               | Haiku 4.5 or Nova Micro + streaming                       |
| Complex reasoning tasks      | Q22 = Complex                                | Claude Sonnet 4.6; Opus 4.6 for hardest                   |

---

## Step 5: Interpret and Write preferences.json

Apply the interpret rule for every answered question (defined in each category file). For skipped questions, apply the documented default.

**Before writing the file**, verify that every question Q1–Q22 appears in exactly one of: `questions_asked`, `questions_defaulted`, `questions_skipped_extracted`, `questions_skipped_early_exit`, or `questions_skipped_not_applicable`. If any question is missing, fix it before writing the file.

Write `$MIGRATION_DIR/preferences.json`:

```json
{
  "metadata": {
    "timestamp": "<ISO timestamp>",
    "discovery_artifacts": ["gcp-resource-inventory.json", "ai-workload-profile.json"],
    "questions_asked": [
      "Q1",
      "Q2",
      "Q3",
      "Q5",
      "Q6",
      "Q7",
      "Q14",
      "Q16",
      "Q17",
      "Q19",
      "Q21",
      "Q22"
    ],
    "questions_defaulted": ["Q9"],
    "questions_skipped_extracted": ["Q14"],
    "questions_skipped_early_exit": ["Q8"],
    "questions_skipped_not_applicable": ["Q4", "Q10", "Q11", "Q12", "Q13"],
    "category_e_enabled": false,
    "inventory_clarifications": {}
  },
  "design_constraints": {
    "target_region": { "value": "us-east-1", "chosen_by": "user" },
    "compliance": { "value": ["hipaa"], "chosen_by": "user" },
    "gcp_monthly_spend": { "value": "$5K-$20K", "chosen_by": "user" },
    "funding_stage": { "value": "series-a", "chosen_by": "user" },
    "availability": { "value": "multi-az", "chosen_by": "default" },
    "cutover_strategy": { "value": "maintenance-window-weekly", "chosen_by": "user" },
    "kubernetes": { "value": "eks-or-ecs", "chosen_by": "user" },
    "database_traffic": { "value": "steady", "chosen_by": "user" },
    "db_io_workload": { "value": "medium", "chosen_by": "user" }
  },
  "ai_constraints": {
    "ai_framework": { "value": ["direct"], "chosen_by": "extracted" },
    "ai_monthly_spend": { "value": "$500-$2K", "chosen_by": "user" },
    "ai_priority": { "value": "balanced", "chosen_by": "user" },
    "ai_critical_feature": { "value": "function-calling", "chosen_by": "user" },
    "ai_volume_cost": { "value": "low-quality", "chosen_by": "user" },
    "ai_model_baseline": { "value": "claude-sonnet-4-6", "chosen_by": "derived" },
    "ai_vision": { "value": "text-only", "chosen_by": "user" },
    "ai_latency": { "value": "important", "chosen_by": "user" },
    "ai_complexity": { "value": "moderate", "chosen_by": "user" },
    "ai_capabilities_required": {
      "value": ["text_generation", "streaming", "function_calling"],
      "chosen_by": "derived"
    }
  },
  "question_details": {
    "Q1": { "question": "Where are your users located?", "answer": "A) Single region", "interpreted_as": { "target_region": "us-east-1" } },
    "Q8": { "question": "How does your team feel about managing Kubernetes?", "answer": null, "skipped_reason": "early_exit", "note": "Q5=multi-cloud → EKS only" },
    "Q9": { "question": "Do any services need WebSocket support?", "answer": "I don't know", "interpreted_as": {}, "note": "Default: no constraint" }
  }
}
```

### Schema Rules

1. Every entry in `design_constraints` and `ai_constraints` is an object with `value` and `chosen_by` fields.
2. `chosen_by` values: `"user"` (explicitly answered), `"default"` (system default applied — includes "I don't know" answers), `"extracted"` (inferred from inventory), `"derived"` (computed from combination of answers + detected capabilities).
3. Only write a key to `design_constraints` / `ai_constraints` if the answer produces a constraint. Absent keys mean "no constraint — Design decides."
4. Do not write null values.
5. For billing-source inventories, `metadata.inventory_clarifications` records Category B answers.
6. `metadata.questions_skipped_early_exit` records questions skipped due to early-exit logic (e.g., Q8 skipped because Q5=multi-cloud).
7. `metadata.questions_skipped_extracted` records questions skipped because inventory already provided the answer.
8. `metadata.questions_skipped_not_applicable` records questions skipped because the relevant service wasn't in the inventory.
9. `ai_constraints` section is present ONLY if Category F fired. Omit entirely if no AI artifacts exist.
10. `ai_constraints.ai_capabilities_required` is the UNION of detected capabilities from `ai-workload-profile.json` + critical feature from Q17 + vision from Q20. `chosen_by` is `"derived"`.
11. `ai_constraints.ai_framework` is an array (Q14 is select-all-that-apply). If auto-detected, `chosen_by` is `"extracted"`.
12. `question_details` — audit log of Q&A. One entry per question in `questions_asked` + `questions_defaulted` + `questions_skipped_early_exit`. Fields: `question`, `answer` (verbatim or `null` if skipped), `interpreted_as`, optional `skipped_reason`/`note`. Omit `questions_skipped_not_applicable`. Informational only — downstream phases ignore it.

---

## Defaults Table

| Question                | Default              | Constraint                                        |
| ----------------------- | -------------------- | ------------------------------------------------- |
| Q1 — Location           | A (single region)    | `target_region`: closest AWS region to GCP region |
| Q2 — Compliance         | A (none)             | no constraint                                     |
| Q3 — GCP spend          | Billing-informed bucket if `billing-profile.json` exists, otherwise B ($1K–$5K) | `gcp_monthly_spend` mapped from billing data or `"$1K-$5K"` |
| Q4 — Funding stage      | _(skip in IDE mode)_ | no constraint                                     |
| Q5 — Multi-cloud        | B (AWS-only)         | no constraint                                     |
| Q6 — Uptime             | B (significant)      | `availability: "multi-az"`                        |
| Q7 — Maintenance        | D (flexible)         | `cutover_strategy: "flexible"`                    |
| Q8 — K8s sentiment      | B (neutral)          | `kubernetes: "eks-or-ecs"`                        |
| Q9 — WebSocket          | B (no)               | no constraint                                     |
| Q10 — Cloud Run traffic | C (24/7)             | `cloud_run_traffic_pattern: "constant-24-7"`      |
| Q11 — Cloud Run spend   | B ($100–$500)        | `cloud_run_monthly_spend: "$100-$500"`            |
| Q12 — DB traffic        | A (steady)           | `database_traffic: "steady"`                      |
| Q13 — DB I/O            | B (medium)           | `db_io_workload: "medium"`                        |
| Q14 — AI framework      | _(auto-detect)_      | `ai_framework` from code detection                |
| Q15 — AI spend          | B ($500–$2K)         | `ai_monthly_spend: "$500-$2K"`                    |
| Q16 — AI priority       | E (balanced)         | `ai_priority: "balanced"`                         |
| Q17 — Critical feature  | J (none)             | no additional override                            |
| Q18 — Volume + cost     | A (low + quality)    | `ai_volume_cost: "low-quality"`                   |
| Q19 — Current model     | _(auto-detect)_      | `ai_model_baseline` from code detection           |
| Q20 — Vision            | A (text only)        | no constraint                                     |
| Q21 — AI latency        | B (important)        | `ai_latency: "important"`                         |
| Q22 — Task complexity   | B (moderate)         | `ai_complexity: "moderate"`                       |

---

## Validation Checklist

Before handing off to Design:

- [ ] `preferences.json` written to `$MIGRATION_DIR/`
- [ ] `design_constraints.target_region` is populated with `value` and `chosen_by`
- [ ] `design_constraints.availability` is populated (if Q6 was asked or defaulted)
- [ ] Only keys with non-null values are present in `design_constraints`
- [ ] Every entry in `design_constraints` and `ai_constraints` has `value` and `chosen_by` fields
- [ ] Config gap answers recorded in `metadata.inventory_clarifications` (billing mode only)
- [ ] Early-exit skips recorded in `metadata.questions_skipped_early_exit`
- [ ] `ai_constraints` section present ONLY if Category F fired
- [ ] If Category F fired, `ai_constraints.ai_framework` is populated (from detection or Q14)
- [ ] If Category F fired, `ai_capabilities_required` is derived from detection + Q17 + Q20
- [ ] `ai_constraints.ai_framework` is an array (Q14 is multi-select)
- [ ] `question_details` includes an entry for every question in `questions_asked`, `questions_defaulted`, and `questions_skipped_early_exit`
- [ ] Output is valid JSON

---

## Step 6: Update Phase Status

Update `$MIGRATION_DIR/.phase-status.json`:

- Set `phases.clarify` to `"completed"`
- Update `last_updated` to current timestamp

Output to user: "Clarification complete. Proceeding to Phase 3: Design AWS Architecture."

---

## Scope Boundary

**This phase covers requirements gathering ONLY.**

FORBIDDEN — Do NOT include ANY of:

- Detailed AWS architecture or service configurations
- Code migration examples or SDK snippets
- Detailed cost calculations
- Migration timelines or execution plans
- Terraform generation

**Your ONLY job: Understand what the user needs. Nothing else.**

## Clustering Algorithm

# Terraform Clustering: Deterministic Algorithm

Groups resources into named clusters using priority-ordered rules.

## Input

All resources with fields:

- `address`, `type`, `classification` (PRIMARY/SECONDARY)
- `secondary_role` (if SECONDARY)
- `typed_edges[]`, `depth`, `serves[]`

## Algorithm: Apply Rules in Priority Order

### Rule 1: Networking Cluster

**IF** `google_compute_network` resource exists:

- Group: `google_compute_network` + ALL network_path secondaries (subnetworks, firewalls, routers)
- Cluster ID: `networking_vpc_{gcp_region}_001` (e.g., `networking_vpc_us-central1_001`)
- **Reasoning**: Network is shared infrastructure; groups all config together

**Output**: 1 cluster (or 0 if no networks found)

**Mark these resources as clustered; remove from unassigned pool.**

### Rule 2: Same-Type Grouping (GROUP ALL INTO ONE CLUSTER PER TYPE)

**CRITICAL: Create ONE cluster per resource type, NOT one cluster per resource.**

**Process:**

1. **Identify all resource types with 2+ PRIMARY resources**
   - Example: 4× `google_pubsub_topic`, 3× `google_storage_bucket`, 2× `google_sql_database_instance`

2. **For EACH resource type with 2+ primaries: Create ONE cluster containing ALL of them**
   - Do NOT create separate clusters for each resource
   - Create ONE cluster with ALL matching resources

3. **Cluster ID format**: `{service_category}_{service_type}_{gcp_region}_{sequence:001}`
   - `messaging_pubsubtopic_us-central1_001` (contains ALL 4 pubsub topics)
   - `storage_bucket_us-central1_001` (contains ALL 3 storage buckets)
   - `database_sql_us-central1_001` (contains ALL 2 SQL instances)

4. **Primary resources in cluster**: List ALL matching resources
   - Example cluster `messaging_pubsubtopic_us-central1_001`:
     - primary_resources:
       - `google_pubsub_topic.order_events`
       - `google_pubsub_topic.inventory_events`
       - `google_pubsub_topic.user_events`
       - `google_pubsub_topic.dead_letter`

5. **Secondary resources**: Collect ALL secondaries that `serve` ANY of the grouped primaries
   - All subscriptions for all grouped topics
   - All IAM bindings for all grouped resources
   - All supporting resources

**Correct Examples (ONE cluster per type):**

- 4× `google_pubsub_topic` → 1 cluster: `messaging_pubsubtopic_us-central1_001`
- 3× `google_storage_bucket` → 1 cluster: `storage_bucket_us-central1_001`
- 2× `google_sql_database_instance` → 1 cluster: `database_sql_us-central1_001`
- 3× `google_container_cluster` → 1 cluster: `compute_gke_us-central1_001` (NOT `k8s_001`, `k8s_002`, `k8s_003`)

**INCORRECT Examples (DO NOT DO THIS):**

- ❌ 4× `google_pubsub_topic` → 4 clusters (`compute_pubsubtopic_001`, `compute_pubsubtopic_002`, etc.)
- ❌ 3× `google_storage_bucket` → 3 clusters (`compute_storagebucket_001`, `compute_storagebucket_002`, etc.)
- ❌ 3× `google_container_cluster` → 3 clusters (`k8s_001`, `k8s_002`, `k8s_003`)

**Output**: ONE cluster per resource type (not per resource)

**Reasoning**: Identical workloads of the same GCP service type migrate together, share operational characteristics, and are managed as a unit.

**Mark all resources of this type as clustered; remove from unassigned pool.**

### Rule 3: Seed Clusters

**FOR EACH** remaining PRIMARY resource (unassigned):

- Create cluster seeded by this PRIMARY
- Add all SECONDARY resources in its `serves[]` array
- Cluster ID: `{service_type}_{gcp_region}_{sequence}` (e.g., `cloudrun_us-central1_001`)
- **Reasoning**: Primary + its supports = deployment unit

**Output**: N clusters (one per remaining PRIMARY)

**Mark all included resources as clustered.**

### Rule 4: Merge on Dependencies

**IF** two clusters have **bidirectional** `data_dependency` edges between their PRIMARY resources (A→B AND B→A):

- **THEN** merge clusters

**Action**: Combine into one cluster; update ID to reflect both (e.g., `web-api_us-central1_001`)

**Reasoning**: Bidirectional data dependencies indicate a tightly coupled deployment unit that must migrate together.

**Do NOT merge** when edges are unidirectional (A→B only). Unidirectional dependencies are captured in `dependencies[]` instead.

### Rule 5: Skip API Services

**IF** resource is `google_project_service`:

- Classify as orchestration secondary
- Do NOT create its own cluster
- Attach to cluster of service it enables (e.g., `google_project_service.cloud_run` attaches to Cloud Run cluster)

**Reasoning**: API enablement is prerequisite, not a deployable unit.

### Rule 6: Deterministic Naming

Apply consistent cluster naming:

- **Format**: `{service_category}_{service_type}_{gcp_region}_{sequence}`
- **service_category**: One of: `compute`, `database`, `storage`, `networking`, `messaging`, `monitoring`, `analytics`, `security`
- **service_type**: GCP service shortname (e.g., `cloudrun`, `sql`, `bucket`, `vpc`)
- **gcp_region**: Source region (e.g., `us-central1`)
- **sequence**: Zero-padded counter (e.g., `001`, `002`)

**Examples**:

- `compute_cloudrun_us-central1_001`
- `database_sql_us-west1_001`
- `storage_bucket_multi-region_001`
- `networking_vpc_us-central1_001` (rule 1 network cluster)

**Reasoning**: Names reflect deployment intent; deterministic for reproducibility.

## Post-Clustering: Populate Cluster Metadata

After all clusters are formed, populate these fields for each cluster:

### `network`

Identify which VPC/network the cluster's resources belong to. Trace `network_path` edges from resources in this cluster to find the `google_compute_network` they reference. Store the network cluster ID (e.g., `networking_vpc_us-central1_001`). Set to `null` if resources have no network association.

### `must_migrate_together`

Default: `true` for all clusters. Set to `false` only if the cluster contains resources that can be independently migrated without breaking dependencies (rare — most clusters are atomic).

### `dependencies`

Derive from Primary→Primary edges that cross cluster boundaries. If cluster A contains a resource with a `data_dependency` edge to a resource in cluster B, then cluster A depends on cluster B. Store as array of cluster IDs.

### `creation_order`

Build a global ordering of clusters by depth level:

```json
"creation_order": [
  { "depth": 0, "clusters": ["networking_vpc_us-central1_001"] },
  { "depth": 1, "clusters": ["security_iam_us-central1_001"] },
  { "depth": 2, "clusters": ["database_sql_us-central1_001", "storage_gcs_us-central1_001"] },
  { "depth": 3, "clusters": ["compute_cloudrun_us-central1_001"] }
]
```

Cluster depth = minimum depth across all primary resources in the cluster. Clusters at the same depth can be migrated in parallel.

## Output Cluster Schema

Each cluster includes:

```json
{
  "cluster_id": "compute_cloudrun_us-central1_001",
  "gcp_region": "us-central1",
  "primary_resources": ["google_cloud_run_service.app"],
  "secondary_resources": ["google_service_account.app_runner"],
  "network": "networking_vpc_us-central1_001",
  "creation_order_depth": 2,
  "must_migrate_together": true,
  "dependencies": ["database_sql_us-central1_001"],
  "edges": [
    {
      "from": "google_cloud_run_service.app",
      "to": "google_sql_database_instance.db",
      "relationship_type": "data_dependency",
      "evidence": {
        "field_path": "template.spec.containers[0].env[].value",
        "reference": "DATABASE_URL"
      }
    }
  ]
}
```

## Determinism Guarantee

Given the same classified resource inputs, the clustering algorithm produces the same cluster structure every run:

1. Rules applied in fixed order
2. Sequence counters increment deterministically
3. Naming reflects source state, not random IDs
4. All clustering heuristics are deterministic (no LLM-based decisions within the clustering algorithm itself)

**Note:** Resource classification (see `clustering-classification-rules.md`) may use LLM inference as a fallback for resource types not in the hardcoded tables. If LLM-classified resources enter the pipeline, overall reproducibility depends on the LLM producing consistent classifications.

## Clustering Classification Rules

# Terraform Clustering: Classification Rules

Hardcoded lists for classifying GCP resources as PRIMARY or SECONDARY.

Each PRIMARY resource is assigned a `tier` indicating its infrastructure layer.

## Priority 1: PRIMARY Resources (Workload-Bearing)

These resource types are always PRIMARY:

### Compute (`tier: "compute"`)

- `google_cloud_run_service` — Serverless container workload
- `google_cloud_run_v2_service` — Serverless container workload (v2 API)
- `google_container_cluster` — Kubernetes cluster
- `google_container_node_pool` — Kubernetes node pool
- `google_compute_instance` — Virtual machine
- `google_cloudfunctions_function` — Serverless function (Gen 1)
- `google_cloudfunctions2_function` — Serverless function (Gen 2)
- `google_app_engine_application` — App Engine application

### Database (`tier: "database"`)

- `google_sql_database_instance` — Relational database
- `google_spanner_instance` — Globally-distributed relational database
- `google_firestore_database` — Document database
- `google_bigtable_instance` — Wide-column NoSQL database
- `google_redis_instance` — In-memory cache

### Storage (`tier: "storage"`)

- `google_storage_bucket` — Object storage
- `google_filestore_instance` — Managed NFS file storage
- `google_bigquery_dataset` — Data warehouse

### Messaging (`tier: "messaging"`)

- `google_pubsub_topic` — Message queue
- `google_cloud_tasks_queue` — Task queue

### Networking (`tier: "networking"`)

- `google_compute_network` — Virtual network (VPC — primary because it defines topology)
- `google_compute_security_policy` — Web application firewall (Cloud Armor)
- `google_dns_managed_zone` — DNS zone

### Monitoring (`tier: "monitoring"`)

- `google_monitoring_alert_policy` — Alert policy

### Other

- `module.*` — Terraform module that wraps primary resources (tier inferred from wrapped resource)

**Action**: Mark as `PRIMARY` with assigned `tier`. Classification done. No secondary_role.

## Priority 2: SECONDARY Resources by Role

Match resource type against secondary classification table. Each match assigns a `secondary_role`:

### Identity (`identity`)

- `google_service_account` — Workload identity
- `data.google_service_account` — Data source reference to existing service account

### Access Control (`access_control`)

- `google_*_iam_member` — IAM binding (all variants: project, cloud_run_service, storage_bucket, etc.)
- `google_*_iam_policy` — IAM policy (all variants)

### Network Path (`network_path`)

- `google_vpc_access_connector` — VPC connector for serverless
- `google_compute_subnetwork` — Subnet
- `google_compute_firewall` — Firewall rule
- `google_compute_router` — Cloud router
- `google_compute_router_nat` — NAT rule
- `google_compute_global_address` — Global IP address (for VPC peering, load balancing)
- `google_service_networking_connection` — VPC peering

### Configuration (`configuration`)

- `google_sql_database` — SQL schema
- `google_sql_user` — SQL user
- `google_spanner_database` — Spanner database schema
- `google_secret_manager_secret` — Secret vault
- `google_secret_manager_secret_version` — Secret value
- `google_dns_record_set` — DNS record
- `google_monitoring_notification_channel` — Alert notification target

### Encryption (`encryption`)

- `google_kms_crypto_key` — KMS encryption key
- `google_kms_key_ring` — KMS key ring

### Orchestration (`orchestration`)

- `null_resource` — Terraform orchestration marker
- `time_sleep` — Orchestration delay
- `google_project_service` — API service enablement (prerequisite, not a deployable unit)

**Action**: Mark as `SECONDARY` with assigned role.

## Priority 3: LLM Inference Fallback

If resource type not in Priority 1 or 2, apply these **deterministic fallback heuristics** BEFORE free-form LLM reasoning:

| Pattern                                              | Classification    | secondary_role | confidence |
| ---------------------------------------------------- | ----------------- | -------------- | ---------- |
| Name contains `scheduler`, `task`, `job`, `workflow` | SECONDARY         | orchestration  | 0.65       |
| Name contains `log`, `metric`, `alert`, `dashboard`  | SECONDARY         | configuration  | 0.60       |
| Resource has zero references to/from other resources | SECONDARY         | configuration  | 0.50       |
| Resource only referenced by a `module` block         | SECONDARY         | configuration  | 0.55       |
| Type contains `policy` or `binding`                  | SECONDARY         | access_control | 0.65       |
| Type contains `network` or `subnet`                  | SECONDARY         | network_path   | 0.60       |
| None of the above match                              | Use LLM reasoning | —              | 0.50-0.75  |

If still uncertain after heuristics, use LLM reasoning. Mark with:

- `classification_source: "llm_inference"`
- `confidence: 0.5-0.75`

**Default**: If all heuristics and LLM fail: `SECONDARY` / `configuration` with confidence 0.5. It is safer to under-classify (secondary) than over-classify (primary), because secondaries are grouped into existing clusters while primaries create new clusters.

## Serves[] Population

For SECONDARY resources, populate `serves[]` array (list of PRIMARY resources it supports):

1. Extract all outgoing references from this SECONDARY's config
2. Include direct references: `field = resource_type.name.id` patterns
3. Include transitive chains: if referenced resource is also SECONDARY, trace to PRIMARY

**Example**: `google_compute_firewall` → references `google_compute_network` (SECONDARY) → serves `google_compute_instance.web` (PRIMARY)

**Serves array**: Points back to PRIMARY workloads affected by this firewall rule. Trace through SECONDARY resources until a PRIMARY is reached.

## Depth Calculation

# Terraform Clustering: Depth Calculation

Assigns topological depth to every resource via Kahn's algorithm (longest path variant).

## Depth Semantics

- **Depth 0**: Resources with no incoming dependencies (can start immediately)
- **Depth N**: Resources where all dependencies are at depth ≤ N-1, and at least one is at depth N-1

Higher depth = later in deployment sequence.

## Algorithm: Kahn's Algorithm (Longest Path Variant)

### Input

All resources with:

- `address`, `type`
- `dependencies[]` array (addresses of resources this one depends on)

### Step 1: Build Dependency Graph

For each resource:

- Outgoing edges: follow its `dependencies[]` array
- Incoming edges: count how many resources depend on this one
- Store: `in_degree[resource] = count_of_incoming_edges`

### Step 2: Initialize Queue

Create queue of all resources with `in_degree = 0`.

These are depth 0 (no dependencies).

Assign: `depth[resource] = 0` for all queued resources.

### Step 3: Process Queue (Longest Path)

While queue not empty:

1. **Dequeue** resource R
2. **For each** resource D that depends on R (traverse reverse edges):
   - Update: `depth[D] = max(depth[D], depth[R] + 1)`
   - Decrement: `in_degree[D] -= 1`
   - **If** `in_degree[D]` becomes 0: **Enqueue** D

**Note:** "Resources that depend on R" means all resources X where X's `dependencies[]` contains R. This correctly assigns higher depths to dependent resources (which must deploy later).

### Step 4: Cycle Detection

If queue empties but unassigned resources remain:

- **Cycle detected**: Some resources have circular dependencies
- **Bounded retry** (max 3 attempts total):
  1. Identify the cycle (trace unassigned resources' dependencies)
  2. Find lowest-confidence edge in cycle (prefer `unknown_dependency` or LLM-inferred edges over deterministic edges)
  3. **Only break inferred edges** (confidence < 1.0). If all edges in the cycle are deterministic (hardcoded classification), do NOT break — proceed to STOP.
  4. Remove the selected edge and restart the algorithm
  5. Log warning: "Circular dependency detected and broken (attempt N/3): {resources and edges removed}"
- **If cycle persists after 3 attempts**: **STOP**. Output: "Unresolvable circular dependency between: [resource addresses]. All edges are deterministic. Manual review required — restructure Terraform dependencies or add `depends_on` overrides."

### Step 5: Assign Final Depths

All resources have assigned `depth` field.

Verify: Every resource has `depth ∈ [0, max_depth]`.

## Pseudocode

```
function calculateDepth(resources) {
  // Build graph
  in_degree = {}
  depends_on = {}
  dependents_of = {}  // Reverse adjacency: resource → resources that depend on it
  for each resource R:
    in_degree[R] = count incoming edges
    depends_on[R] = R.dependencies[]
    dependents_of[R] = []

  // Populate dependents_of (reverse edges)
  for each resource R:
    for each D in R.dependencies[]:
      dependents_of[D].append(R)

  // Initialize depth 0
  depth = {}
  queue = [R for R in resources if in_degree[R] == 0]
  for each R in queue:
    depth[R] = 0

  // Process queue (longest path variant)
  while queue not empty:
    R = queue.dequeue()
    for each D in dependents_of[R]:  // Iterate resources that depend on R
      depth[D] = max(depth[D], depth[R] + 1)
      in_degree[D] -= 1
      if in_degree[D] == 0:
        queue.enqueue(D)

  // Cycle check (bounded: max 3 attempts)
  if any resource not assigned depth:
    if attempt >= 3:
      STOP("Unresolvable circular dependency. Manual review required.")
    edge = find_lowest_confidence_edge_in_cycle()
    if edge.confidence == 1.0:
      STOP("Cycle contains only deterministic edges. Manual review required.")
    remove(edge)
    return calculateDepth(resources, attempt + 1)  // Retry

  return depth
}
```

## Example

**Resources and dependencies:**

```
A: depends on [] → depth 0
B: depends on [A] → depth 1
C: depends on [A] → depth 1
D: depends on [B, C] → depth 2
```

**Queue trace:**

1. Initial queue: [A] (in_degree 0)
2. Dequeue A, depth[A]=0; enqueue B, C (both now in_degree 0)
3. Dequeue B, depth[B]=1; update depth[D]=max(0,1+1)=2; in_degree[D]=1
4. Dequeue C, depth[C]=1; update depth[D]=max(2,1+1)=2; enqueue D (in_degree 0)
5. Dequeue D, depth[D]=2
6. Queue empty; all depths assigned

**Final**: A:0, B:1, C:1, D:2 ✓

## Deployment Order Guarantee

Resources sorted by ascending depth can deploy in order:

```
Deploy depth 0: A
Deploy depth 1: B, C (parallel OK)
Deploy depth 2: D
```

No dependency violations; parallelism at same depth.

## Design Ai

# Design Phase: AI Workloads (Bedrock)

> Loaded by `design.md` when `ai-workload-profile.json` exists.

**Execute ALL steps in order. Do not skip or optimize.**

---

## Step 0: Load Inputs

Read `$MIGRATION_DIR/ai-workload-profile.json`:

- `summary.ai_source` — `"gemini"`, `"openai"`, `"both"`, `"other"`
- `models[]` — Detected AI models with service, capabilities, evidence
- `integration` — SDK, frameworks, languages, gateway type, capability summary
- `infrastructure[]` — Terraform resources related to AI (may be empty)
- `current_costs` — Present only if billing data was provided

Read `$MIGRATION_DIR/preferences.json` → `ai_constraints` (if present). If absent: use defaults (prefer managed Bedrock, no latency constraint, no budget cap).

**Load source-specific design reference based on `ai_source`:**

- `"gemini"` → load `steering/design-ref-ai-gemini-to-bedrock.md`
- `"openai"` → load `steering/design-ref-ai-openai-to-bedrock.md`
- `"both"` → load both files
- `"other"` or absent → load `steering/design-ref-ai.md` (traditional ML rubric)

---

## Part 1: Bedrock Model Selection

For each model in `models[]`, select the best-fit Bedrock model using the loaded design reference mapping tables. Do NOT use a hardcoded mapping — the design-ref files contain tier-organized tables with pricing and competitive analysis.

**Apply user preference overrides from `ai_constraints`:**

| Preference                | Override                                          |
| ------------------------- | ------------------------------------------------- |
| `ai_priority = "cost"`    | Prefer "Winner" column; flag if source is cheaper |
| `ai_priority = "quality"` | Prefer Claude Sonnet/Opus regardless of cost      |
| `ai_priority = "speed"`   | Prefer Claude Sonnet (fastest integration)        |
| `ai_latency = "critical"` | Prefer smaller/faster models (Haiku, Nova Lite)   |
| `ai_latency = "flexible"` | Any model; flag Batch API for 50% savings         |

**Stay-or-migrate assessment per model:**

- Bedrock cheaper → `"strong_migrate"`
- Bedrock within 25% of source AND priority != cost → `"moderate_migrate"`
- Source > 25% cheaper AND priority = cost → `"weak_migrate"` or `"recommend_stay"`

Overall assessment = weakest across all models. If any `"recommend_stay"`, flag prominently.

**Model comparison table** (include in output and user summary): Model, Provider, Max Context, Input/Output Price per 1M, Price Comparison, Streaming, Function Calling, Assessment.

---

## Part 1B: Volume-Based Strategy

If `ai_token_volume` is `"high"`, generate a `tiered_strategy`:

| Tier | Traffic | Model Selection              | Use Cases                                            |
| ---- | ------- | ---------------------------- | ---------------------------------------------------- |
| 1    | 60%     | Nova Micro or Llama 4 Scout  | Classification, extraction, short answers, routing   |
| 2    | 30%     | Llama 4 Maverick or Nova Pro | Summarization, moderate generation, Q&A with context |
| 3    | 10%     | Claude Sonnet 4.6            | Reasoning, long-form, agentic tasks, tool use        |

Set `tiered_strategy: null` for low/medium volume.

---

## Part 2: Feature Parity Validation

For each capability in `integration.capabilities_summary` that is `true`, check Bedrock parity:

| Capability        | Vertex AI               | Amazon Bedrock                   | Parity  |
| ----------------- | ----------------------- | -------------------------------- | ------- |
| Text Generation   | GenerativeModel API     | Converse API                     | Full    |
| Streaming         | stream_generate_content | InvokeModelWithResponseStream    | Full    |
| Function Calling  | Tool declarations       | Tool use in Converse API         | Full    |
| Embeddings        | TextEmbeddingModel      | Titan Embeddings via InvokeModel | Full    |
| Vision/Multimodal | Gemini multimodal input | Claude multimodal messages       | Full    |
| Batch Processing  | BatchPredictionJob      | Batch Inference (async)          | Partial |
| Fine-tuning       | Vertex AI tuning        | Bedrock Custom Model             | Partial |
| Grounding / RAG   | Vertex AI Search & RAG  | Bedrock Knowledge Bases          | Full    |
| Agents            | Vertex AI Agent Builder | Bedrock Agents                   | Full    |

Record `capability_gaps[]` for any Partial or None parity.

---

## Part 3: Analyze Detected Workloads

For each model in `models[]`, record:

- **Workload type**: text generation, embeddings, vision, code generation, custom model
- **Integration pattern mapping**:

| GCP Pattern  | AWS Pattern                    | Effort |
| ------------ | ------------------------------ | ------ |
| `direct_sdk` | Bedrock SDK (boto3 / AWS SDK)  | Medium |
| `framework`  | LangChain/LlamaIndex + Bedrock | Low    |
| `rest_api`   | Bedrock REST API               | Medium |
| `mixed`      | Match per-model                | Varies |

- **Migration complexity**: Low / Medium / High

---

## Part 4: Infrastructure Mapping

Map GCP AI infrastructure to AWS equivalents:

| GCP Resource                              | AWS Equivalent                                  |
| ----------------------------------------- | ----------------------------------------------- |
| `google_vertex_ai_endpoint`               | Bedrock Model Access (serverless, no infra)     |
| `google_vertex_ai_index` / index_endpoint | OpenSearch Serverless or Bedrock Knowledge Base |
| `google_vertex_ai_featurestore`           | SageMaker Feature Store                         |
| `google_vertex_ai_dataset`                | S3 + Bedrock training job config                |
| `google_vertex_ai_pipeline_job`           | Step Functions + Bedrock                        |

Service accounts with `role: "supports_ai"` → IAM role with Bedrock permissions. Confidence = `inferred`.

---

## Part 5: Code Migration Plan

For each detected `integration.pattern` and `ai_source`, generate before/after migration examples.

**Patterns to include (matched to detected language and source):**

| Pattern              | Source                    | Target              | Key Change                            |
| -------------------- | ------------------------- | ------------------- | ------------------------------------- |
| Direct SDK           | Vertex AI                 | boto3 Converse API  | `generate_content()` → `converse()`   |
| Direct SDK           | OpenAI                    | boto3 Converse API  | `completions.create()` → `converse()` |
| LangChain            | ChatVertexAI / ChatOpenAI | ChatBedrock         | Swap import and model_id              |
| LlamaIndex           | Vertex / OpenAI LLM       | BedrockConverse     | Swap import                           |
| LLM Router (LiteLLM) | Any                       | Config change       | `model="bedrock/<model_id>"` (1 line) |
| Embeddings           | TextEmbeddingModel        | Titan Embeddings v2 | `invoke_model` with JSON body         |
| Streaming            | `stream=True`             | `converse_stream`   | Event loop over `contentBlockDelta`   |

Generate concrete code examples using actual model IDs from the selected Bedrock models. Only include patterns matching the detected integration.

---

## Part 6: Generate Output

Write `aws-design-ai.json` to `$MIGRATION_DIR/`.

**Schema — top-level fields:**

| Field                                 | Type        | Description                                                                                                                                                                                         |
| ------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `metadata`                            | object      | `phase`, `focus`, `ai_source`, `bedrock_models_selected`, `timestamp`                                                                                                                               |
| `ai_architecture.honest_assessment`   | string      | `"strong_migrate"`, `"moderate_migrate"`, `"weak_migrate"`, `"recommend_stay"`                                                                                                                      |
| `ai_architecture.tiered_strategy`     | object/null | Tiered model routing (null for low/medium volume)                                                                                                                                                   |
| `ai_architecture.bedrock_models`      | array       | Per-model: `gcp_model_id`, `aws_model_id`, `capabilities_matched[]`, `capability_gaps[]`, `honest_assessment`, `source_provider_price`, `bedrock_price`, `price_comparison`, `migration_complexity` |
| `ai_architecture.capability_mapping`  | object      | Per-capability: `parity` (full/partial/none), `notes`                                                                                                                                               |
| `ai_architecture.code_migration`      | object      | `primary_pattern`, `framework`, `files_to_modify[]`, `dependency_changes`                                                                                                                           |
| `ai_architecture.infrastructure`      | array       | GCP resource → AWS equivalent mappings with confidence                                                                                                                                              |
| `ai_architecture.services_to_migrate` | array       | GCP service → AWS service with effort and notes                                                                                                                                                     |

## Validation Checklist

- [ ] `metadata.ai_source` matches `summary.ai_source` from input
- [ ] Every model in `models[]` has a corresponding `bedrock_models` entry
- [ ] Every `bedrock_models[]` entry has pricing (`source_provider_price`, `bedrock_price`, `price_comparison`)
- [ ] `capability_mapping` covers every `true` capability from `capabilities_summary`
- [ ] `code_migration.primary_pattern` matches `integration.pattern`
- [ ] All model IDs use current Bedrock identifiers
- [ ] `honest_assessment` logic is consistent (weakest model drives overall)

## Present Summary

After writing `aws-design-ai.json`, present under 25 lines:

1. Overall honest assessment
2. Model comparison table (source → Bedrock, price comparison, assessment per model)
3. Integration pattern and migration complexity
4. Capability gaps (if any)
5. If weak_migrate or recommend_stay: flag prominently with cost justification

## Design Billing

# Design Phase: Billing-Only Service Mapping

> Loaded by `design.md` when `billing-profile.json` exists and `gcp-resource-inventory.json` does NOT exist.

**Execute ALL steps in order. Do not skip or optimize.**

This is the fallback design path when only billing data is available (no Terraform/IaC). Mappings are inferred from billing service names and SKU descriptions — confidence is always `billing_inferred`.

---

## Step 0: Load Inputs

Read `$MIGRATION_DIR/billing-profile.json`. This file contains:

- `services[]` — Each GCP service with monthly cost, SKU breakdown, and AI signals
- `summary` — Total monthly spend and service count

Read `$MIGRATION_DIR/preferences.json` → `design_constraints` (target region, compliance, etc.).

Also read `preferences.json` → `metadata.inventory_clarifications` (may be empty if user defaulted all Category B questions). These are billing-only configuration answers collected during Clarify.

---

## Step 1: Load Billing Services

For each entry in `billing-profile.json` → `services[]`:

1. Extract `gcp_service` (display name, e.g., "Cloud Run")
2. Extract `gcp_service_type` (Terraform-style type, e.g., "google_cloud_run_service")
3. Extract `top_skus[]` for additional context (SKU descriptions hint at specific features)
4. Extract `monthly_cost` for cost context

---

## Step 2: Service Lookup

For each billing service, attempt lookup in order:

**2a. Fast-path lookup:**

1. Look up `gcp_service_type` in `steering/design-ref-fast-path.md` → Direct Mappings table
2. If found: assign AWS service
3. Enrich with SKU hints:
   - If `top_skus` mention "PostgreSQL" → specify "RDS Aurora PostgreSQL"
   - If `top_skus` mention "MySQL" → specify "RDS Aurora MySQL"
   - If `top_skus` mention "CPU Allocation" → indicates compute (Fargate)
   - If `top_skus` mention "Storage" → check if object storage (S3) or block storage (EBS)

**2b. Billing heuristic lookup (if not in fast-path):**

Look up `gcp_service_type` in the table below. These are default mappings for common GCP services when no configuration data is available. The IaC path uses the full rubric in category files and may select a different AWS target based on actual configuration.

| `gcp_service_type`               | Billing Name         | Default AWS Target | Alternatives (chosen by IaC path) |
| -------------------------------- | -------------------- | ------------------ | --------------------------------- |
| `google_cloud_run_service`       | Cloud Run            | Fargate            | Lambda, EC2                       |
| `google_cloudfunctions_function` | Cloud Functions      | Lambda             | Fargate                           |
| `google_compute_instance`        | Compute Engine       | EC2                | Fargate, ASG                      |
| `google_container_cluster`       | GKE                  | EKS                | ECS, Fargate                      |
| `google_app_engine_application`  | App Engine           | Fargate            | Amplify, Lambda                   |
| `google_firestore_database`      | Firestore            | DynamoDB           | —                                 |
| `google_bigquery_dataset`        | BigQuery             | Athena             | Redshift                          |
| `google_compute_forwarding_rule` | Cloud Load Balancing | ALB                | NLB                               |
| `google_compute_backend_service` | Cloud Load Balancing | ALB Target Groups  | NLB                               |
| `google_pubsub_topic`            | Pub/Sub              | SNS                | SQS, SNS FIFO                     |
| `google_pubsub_subscription`     | Pub/Sub              | SQS                | SNS Subscription                  |
| `google_cloud_tasks_queue`       | Cloud Tasks          | SQS                | EventBridge                       |

If found: assign the Default AWS Target. Set rationale to: "Billing heuristic: [GCP service] → [AWS service]. Provide Terraform files for configuration-aware mapping."

**2c. If not found in either table:** proceed to Step 3.

**2d. Enrich with Category B answers (if available):**

After lookup, check `metadata.inventory_clarifications` for user-provided configuration data and merge into `aws_config`:

- If `inventory_clarifications.cloud_sql_ha` exists → add `"high_availability": true/false` to the Cloud SQL / Aurora design entry
- If `inventory_clarifications.cloud_run_count` exists → set `"service_count"` in the Cloud Run / Fargate design entry
- If `inventory_clarifications.memorystore_memory` exists → set `"memory_gb"` in the Redis / ElastiCache design entry
- If `inventory_clarifications.cloud_functions_gen` exists → note `"functions_generation"` in the Cloud Functions / Lambda design entry

When a clarification is applied, add `"inventory_clarifications_applied": true` to the service's `aws_config`.

**No rubric evaluation** — without IaC config, there is insufficient data for the 6-criteria rubric.

---

## Step 3: Flag Unknowns

For each service not found in fast-path or billing heuristic table:

1. Record in `unknowns[]` with:
   - `gcp_service` — Display name
   - `gcp_service_type` — Resource type
   - `monthly_cost` — How much is spent on this service
   - `reason` — "No IaC configuration available; service does not match any fast-path or billing heuristic entry"
   - `suggestion` — "Provide Terraform files for accurate mapping, or manually specify the AWS equivalent"

---

## Step 4: Generate Output

**File 1: `aws-design-billing.json`**

Write to `$MIGRATION_DIR/aws-design-billing.json`:

```json
{
  "metadata": {
    "phase": "design",
    "design_source": "billing_only",
    "confidence_note": "All mappings inferred from billing data only — no IaC configuration available. Confidence is billing_inferred for all services.",
    "total_services": 8,
    "mapped_services": 6,
    "unmapped_services": 2,
    "timestamp": "2026-02-26T14:30:00Z"
  },
  "services": [
    {
      "gcp_service": "Cloud Run",
      "gcp_service_type": "google_cloud_run_service",
      "aws_service": "Fargate",
      "aws_config": {
        "region": "us-east-1"
      },
      "monthly_cost": 450.00,
      "confidence": "billing_inferred",
      "rationale": "Fast-path: Cloud Run → Fargate. SKU hints: CPU + Memory allocation.",
      "sku_hints": ["CPU Allocation Time", "Memory Allocation Time"]
    },
    {
      "gcp_service": "Cloud SQL",
      "gcp_service_type": "google_sql_database_instance",
      "aws_service": "RDS Aurora PostgreSQL",
      "aws_config": {
        "region": "us-east-1",
        "high_availability": false,
        "inventory_clarifications_applied": true
      },
      "monthly_cost": 800.00,
      "confidence": "billing_inferred",
      "rationale": "Fast-path: Cloud SQL → RDS Aurora. SKU hints: PostgreSQL engine. User confirmed single-zone (Category B).",
      "sku_hints": ["DB custom CORE", "DB custom RAM"]
    }
  ],
  "unknowns": [
    {
      "gcp_service": "Cloud Armor",
      "gcp_service_type": "google_compute_security_policy",
      "monthly_cost": 50.00,
      "reason": "No IaC configuration available; billing name does not match any fast-path entry",
      "suggestion": "Provide Terraform files for accurate mapping, or manually specify the AWS equivalent"
    }
  ]
}
```

## Output Validation Checklist

- `metadata.design_source` is `"billing_only"`
- `metadata.total_services` equals `mapped_services` + `unmapped_services`
- Every service from `billing-profile.json` appears in either `services[]` or `unknowns[]`
- All `confidence` values are `"billing_inferred"`
- Every `services[]` entry has `gcp_service`, `aws_service`, `monthly_cost`, `rationale`
- Every `unknowns[]` entry has `gcp_service`, `monthly_cost`, `reason`, `suggestion`
- Output is valid JSON

## Present Summary

After writing `aws-design-billing.json`, present a concise summary to the user:

1. Mapped X of Y GCP billing services to AWS equivalents
2. Accuracy notice: billing-inferred confidence, provide .tf files for higher accuracy
3. Per-service table: GCP service → AWS service (with monthly GCP cost)
4. Unmapped services list with suggestions
5. Total monthly GCP spend

Keep it under 20 lines. The user can ask for details or re-read `aws-design-billing.json` at any time.

## Design Infra

# Design Phase: Infrastructure Mapping

> Loaded by `design.md` when `gcp-resource-inventory.json` and `gcp-resource-clusters.json` exist.

**Execute ALL steps in order. Do not skip or optimize.**

## Step 0: Validate Inputs

Read `preferences.json`. If missing: **STOP**. Output: "Phase 2 (Clarify) not completed. Run Phase 2 first."

Read `gcp-resource-clusters.json`.

## Step 1: Order Clusters

Sort clusters by `creation_order_depth` (lowest first, representing foundational infrastructure).

## Step 2: Two-Pass Mapping per Cluster

For each cluster, process `primary_resources` first, then `secondary_resources` (as classified during discover phase — see `gcp-resource-clusters.json`).

### Pass 1: Fast-Path Lookup

For each PRIMARY resource in the cluster:

1. Extract GCP type (e.g., `google_sql_database_instance`)
2. Look up in `steering/design-ref-fast-path.md` → Direct Mappings table
3. If found (deterministic 1:1 match): assign AWS service with confidence = `deterministic`
4. If not found: proceed to Pass 2

### Pass 2: Rubric-Based Selection

For resources not covered by fast-path:

1. Determine service category (via `steering/design-ref-index.md`):
   - `google_compute_instance` → compute
   - `google_cloudfunctions_function` → compute
   - `google_sql_database_instance` → database
   - `google_storage_bucket` → storage
   - `google_compute_network` → networking
   - etc.

   **Catch-all for unknown types**: If resource type not found in `design-ref-index.md`:
   - Check resource name pattern (e.g., "scheduler" → orchestration, "log" → monitoring, "metric" → monitoring)
   - If pattern match: use that category
   - If no pattern match: **STOP**. Output: "Unknown GCP resource type: [type]. Not in fast-path.md or index.md. Cannot auto-map. Please file an issue with this resource type."

2. Load rubric from corresponding `steering/design-ref-*.md` file (e.g., `design-ref-compute.md`, `design-ref-database.md`)

3. Evaluate 6 criteria (1-sentence each):
   - **Eliminators**: Feature incompatibility (hard blocker)
   - **Operational Model**: Managed vs self-hosted fit
   - **User Preference**: From `preferences.json` design_constraints
   - **Feature Parity**: GCP feature → AWS feature availability
   - **Cluster Context**: Affinity with other resources in this cluster
   - **Simplicity**: Prefer fewer resources / less config

4. Select best-fit AWS service. Confidence = `inferred`

## Step 3: Handle Secondary Resources

For each SECONDARY resource:

1. Use `steering/design-ref-index.md` for category
2. Apply fast-path (most secondaries have deterministic mappings)
3. If rubric needed: apply same 6-criteria approach

## Step 3.5: Validate AWS Architecture (using awsknowledge)

**Validation checks** (if awsknowledge available):

For each mapped AWS service, verify:

1. **Regional Availability**: Is the service available in the target region (e.g., `us-east-1`)?
   - Use awsknowledge to check regional support
   - If unavailable: add warning, suggest fallback region

2. **Feature Parity**: Do required features exist in AWS service?
   - Match GCP features from `preferences.json` design_constraints
   - Check AWS feature availability via awsknowledge
   - If feature missing: add warning, suggest alternative service

3. **Service Compatibility**: Are there known issues or constraints?
   - Check best practices and gotchas via awsknowledge
   - Add to warnings if applicable

**If awsknowledge unavailable:**

- Set `validation_status: "skipped"` in output
- Note in summary: "Architecture validation unavailable (non-critical)"
- Continue with design (validation is informational, not blocking)

**If validation succeeds:**

- Set `validation_status: "completed"` in output
- List validated services in summary

## Step 4: Write Design Output

**File 1: `aws-design.json`**

```json
{
  "clusters": [
    {
      "cluster_id": "compute_instance_us-central1_001",
      "gcp_region": "us-central1",
      "aws_region": "us-east-1",
      "resources": [
        {
          "gcp_address": "google_compute_instance.web",
          "gcp_type": "google_compute_instance",
          "gcp_config": {
            "machine_type": "n2-standard-2",
            "zone": "us-central1-a",
            "boot_disk_size_gb": 100
          },
          "aws_service": "Fargate",
          "aws_config": {
            "cpu": "0.5",
            "memory": "1024",
            "region": "us-east-1"
          },
          "confidence": "deterministic",
          "rationale": "1:1 compute mapping with Cold Start considerations",
          "rubric_applied": [
            "Eliminators: PASS",
            "Operational Model: Managed Fargate",
            "User Preference: Speed (q2)",
            "Feature Parity: Full (always-on compute)",
            "Cluster Context: Standalone compute tier",
            "Simplicity: Fargate (managed, no EC2)"
          ]
        }
      ]
    }
  ],
  "warnings": [
    "service X not fully supported in us-east-1; fallback to us-west-2"
  ]
}
```

## Output Validation Checklist

- `clusters` array is non-empty
- Every cluster has `cluster_id` matching a cluster from `gcp-resource-clusters.json`
- Every cluster has `gcp_region` and `aws_region`
- Every resource has `gcp_address`, `gcp_type`, `gcp_config`, `aws_service`, `aws_config`
- All `confidence` values are either `"deterministic"` or `"inferred"`
- All `rationale` fields are non-empty
- Every resource from every evaluated cluster appears in the output
- No duplicate `gcp_address` values across clusters
- Output is valid JSON

## Present Summary

After writing `aws-design.json`, present a concise summary to the user:

1. Total resources mapped and cluster count
2. Per-cluster table: GCP resource → AWS service (one line each, include confidence)
3. Any warnings (regional fallbacks, inferred mappings with low confidence)

Keep it under 20 lines. The user can ask for details or re-read `aws-design.json` at any time.

## Design Ref Ai Gemini To Bedrock

# Gemini to Bedrock — Model Selection Guide

**Applies to:** Vertex AI Generative AI (Gemini models) → Amazon Bedrock

This file is loaded by `design-ai.md` when `ai-workload-profile.json` has `summary.ai_source` = `"gemini"` or `"both"`. It provides model mapping tables with pricing and honest competitive analysis for Gemini → Bedrock migration decisions.

Verify all pricing via AWS Pricing MCP or `steering/cached-prices.md`.

---

## Competitive Reality (March 2026)

Gemini 3.1 Pro Preview (Feb 19, 2026) has shifted the landscape. Be honest with users:

- Gemini 3.1 Pro leads 13/16 Google-reported benchmarks and 6/10 on the Artificial Analysis Intelligence Index
- ARC-AGI-2: 77.1% (2.5x jump over Gemini 3 Pro), SWE-Bench: 80.6% (tied with Opus 4.6 at 80.8%)
- Costs $2/$12 per 1M tokens — less than half of Opus 4.6 ($5/$25), cheaper than Sonnet 4.6 ($3/$15)
- ~119 tokens/sec — faster than any Bedrock model at this quality tier

**Where Bedrock still wins:**

- Claude Sonnet/Opus 4.6 lead on real-world agentic tasks (GDPval evaluation) — the gap between benchmarks and production agent reliability is real
- Claude prompt caching (90% savings on repeated content) has no Gemini equivalent at Preview tier
- Claude function calling remains best-in-class for complex multi-turn tool use
- AWS ecosystem integration (Bedrock Agents, Knowledge Bases, Guardrails) has no Gemini equivalent

**Migration case by tier:**

- Gemini Pro → Bedrock: driven by AWS consolidation, agentic reliability, or ecosystem — NOT cost or general benchmarks
- Gemini Flash/Lite → Nova Lite/Micro: still 64-88% cheaper, strong cost case
- Gemini 2.5 Pro → Bedrock: moderate case (older model, higher price than 3.1 Pro)

---

## Bedrock Model Portfolio

| Model             | Best For                     | Complexity | Speed  | Context |
| ----------------- | ---------------------------- | ---------- | ------ | ------- |
| Claude Sonnet 4.6 | Agentic tasks, tool use      | High       | High   | 200K    |
| Claude Opus 4.6   | Maximum reasoning            | High       | Medium | 200K    |
| Claude Haiku 4.5  | Simple + fast                | Medium     | High   | 200K    |
| Llama 4 Maverick  | Cost-effective + multimodal  | Medium     | High   | 1M      |
| Llama 4 Scout     | Ultra-long context, cheapest | Medium     | Medium | 10M     |
| Nova 2 Pro        | AWS flagship, multimodal     | High       | High   | 1M      |
| Nova 2 Lite       | AWS mid-tier, long context   | Medium     | High   | 1M      |
| Nova Pro          | AWS balanced                 | Medium     | High   | 300K    |
| Nova Lite         | AWS fast + cheapest          | Medium     | High   | 300K    |
| Nova Micro        | AWS fastest, text-only       | Low        | High   | 128K    |
| Nova Premier      | Complex reasoning            | High       | Medium | 1M      |
| DeepSeek-R1       | Chain-of-thought reasoning   | High       | Medium | 128K    |
| Mistral Large 3   | EU/Multilingual              | High       | Medium | 256K    |

---

## Gemini → Bedrock Model Mapping

### Gemini Pro Tier

| Gemini Model           | Price (in/out per 1M) | Best Bedrock Match | Bedrock Price  | Winner              |
| ---------------------- | --------------------- | ------------------ | -------------- | ------------------- |
| Gemini 3.1 Pro Preview | $2.00 / $12.00        | Claude Sonnet 4.6  | $3.00 / $15.00 | Gemini 24% cheaper  |
| Gemini 3.1 Pro Preview | $2.00 / $12.00        | Claude Opus 4.6    | $5.00 / $25.00 | Gemini 54% cheaper  |
| Gemini 3 Pro           | $0.50 / $3.00         | Llama 4 Maverick   | $0.24 / $0.97  | Bedrock 64% cheaper |
| Gemini 3 Pro           | $0.50 / $3.00         | Llama 4 Scout      | $0.17 / $0.66  | Bedrock 75% cheaper |
| Gemini 3 Pro           | $0.50 / $3.00         | Nova Pro           | $0.80 / $3.20  | Gemini 17% cheaper  |
| Gemini 2.5 Pro         | $1.25 / $10.00        | Claude Sonnet 4.6  | $3.00 / $15.00 | Gemini 40% cheaper  |
| Gemini 2.5 Pro         | $1.25 / $10.00        | Nova Pro           | $0.80 / $3.20  | Bedrock 62% cheaper |
| Gemini 3.1 Pro Preview | $2.00 / $12.00        | Nova 2 Pro         | $1.38 / $11.00 | Bedrock 14% cheaper |
| Gemini 2.5 Pro         | $1.25 / $10.00        | Nova 2 Pro         | $1.38 / $11.00 | Gemini 9% cheaper   |

### Gemini Flash/Lite Tier

| Gemini Model     | Price (in/out per 1M) | Best Bedrock Match | Bedrock Price  | Winner              |
| ---------------- | --------------------- | ------------------ | -------------- | ------------------- |
| Gemini 2.5 Flash | $0.30 / $2.50         | Nova Lite          | $0.06 / $0.24  | Bedrock 88% cheaper |
| Gemini 2.0 Flash | $0.10 / $0.40         | Nova Micro         | $0.035 / $0.14 | Bedrock 65% cheaper |
| Gemini Flash     | $0.075 / $0.30        | Nova Micro         | $0.035 / $0.14 | Bedrock 53% cheaper |

### Legacy/Specialized

| Gemini Model            | Price (in/out per 1M) | Best Bedrock Match    | Bedrock Price    | Winner                             |
| ----------------------- | --------------------- | --------------------- | ---------------- | ---------------------------------- |
| text-bison / chat-bison | Legacy                | Llama 4 Scout         | $0.17 / $0.66    | Bedrock (better quality + cheaper) |
| text-embedding-004      | $0.025 / N/A          | Titan Embeddings V2   | $0.02 / N/A      | Bedrock 20% cheaper                |
| imagen-*                | Varies                | Titan Image Generator | $0.008-$0.04/img | Varies                             |

_Percentages are blended savings using a 2:1 input-to-output token ratio. Actual savings depend on your input/output ratio._

---

## Decision Paths by Priority

### Quality-First

Gemini 3.1 Pro Preview matches or beats Opus 4.6 on most reasoning benchmarks at less than half the cost. Be transparent:

- If user needs **general reasoning/coding quality** → Gemini 3.1 Pro is competitive or better. Migration case is weak unless driven by AWS consolidation.
- If user needs **agentic reliability** (real-world multi-step tasks) → **Claude Sonnet 4.6** still leads on GDPval. This is the honest differentiator.
- If user needs **maximum reasoning on hardest problems** → Claude Opus 4.6 ($5/$25) — tied with Gemini 3.1 Pro on SWE-Bench.

### Speed-First

Gemini Flash → **Nova Micro** (<200ms, text-only, cheapest), **Haiku 4.5** (<400ms, vision), or **Llama 4 Scout** (<300ms, cheapest capable)

### Cost-First

- Gemini Flash/Lite → **Nova Lite** (54-88% cheaper), **Nova Micro** (53-64% cheaper)
- Gemini Pro → **Llama 4 Maverick** ($0.24/$0.97, 63% cheaper than Gemini 3 Pro) or **Llama 4 Scout** ($0.17/$0.66, 75% cheaper)

### Balanced

- Gemini 3.1 Pro → **Nova 2 Pro** (-14% cost, AWS-native) or **Claude Sonnet 4.6** (+31% cost, stronger agentic reliability)
- Gemini 2.5 Pro → **Nova 2 Pro** (+10% cost, AWS-native) or **Nova Pro** (-62% cost)
- Gemini 3 Pro → **Llama 4 Maverick** (-63%), **Nova Pro** (+20%)

---

## Volume-Based Recommendations

**Low (<1M tokens/day):** Use best model for quality. Cost difference minimal at this volume.

**Medium (1-10M tokens/day):** Present cost comparison at volume. At 5M input + 2.5M output/day:

| Model             | Monthly Cost   |
| ----------------- | -------------- |
| Gemini 3 Pro      | $300           |
| Llama 4 Maverick  | $109 (-64%)    |
| Llama 4 Scout     | $75 (-75%)     |
| Nova Pro          | $360 (+20%)    |
| Claude Sonnet 4.6 | $1,575 (+425%) |

**High (10-100M tokens/day):** Cost optimization critical. Recommend multi-model tiered approach. Llama 4 Maverick/Scout or Nova for output-heavy workloads.

**Very high (>100M tokens/day):** Mandatory multi-model tiered strategy:

- Simple tasks (60% of traffic) → Nova Micro or Llama 4 Scout
- Moderate tasks (30% of traffic) → Llama 4 Maverick or Nova Pro
- Complex tasks (10% of traffic) → Claude Sonnet 4.6

---

## Cost Comparison Table (150M input + 75M output per month)

| Gemini Model                    | Monthly | Best Bedrock Match             | Monthly | Difference |
| ------------------------------- | ------- | ------------------------------ | ------- | ---------- |
| Gemini 3.1 Pro Preview ($2/$12) | $1,200  | Claude Sonnet 4.6 ($3/$15)     | $1,575  | +24%       |
| Gemini 3.1 Pro Preview ($2/$12) | $1,200  | Claude Opus 4.6 ($5/$25)       | $2,625  | +54%       |
| Gemini 3.1 Pro Preview ($2/$12) | $1,200  | Nova 2 Pro ($1.38/$11.00)      | $1,032  | -14%       |
| Gemini 3 Pro ($0.50/$3.00)      | $300    | Llama 4 Maverick ($0.24/$0.97) | $109    | -64%       |
| Gemini 3 Pro ($0.50/$3.00)      | $300    | Llama 4 Scout ($0.17/$0.66)    | $75     | -75%       |
| Gemini 2.5 Pro ($1.25/$10)      | $938    | Nova 2 Pro ($1.38/$11.00)      | $1,032  | +9%        |
| Gemini 2.5 Pro ($1.25/$10)      | $938    | Nova Pro ($0.80/$3.20)         | $360    | -62%       |
| Gemini 2.5 Flash ($0.30/$2.50)  | $233    | Nova Lite ($0.06/$0.24)        | $27     | -88%       |
| Gemini 2.0 Flash ($0.10/$0.40)  | $45     | Nova Micro ($0.035/$0.14)      | $16     | -64%       |

_Difference column shows blended savings at a 2:1 input/output token ratio. Positive = Bedrock costs more (Gemini cheaper), negative = Bedrock cheaper._

---

## Prompt Caching (Claude Only)

Cache frequently-used system prompts for 90% cost reduction on cached portions. Example: 10K token system prompt repeated 1000x → $30 without caching, $3 with caching.

Not available on other Bedrock models. This is a significant Claude advantage for applications with heavy system prompt repetition.

---

## Feature Migration Notes

| Gemini Feature         | Bedrock Equivalent                                          | Notes                          |
| ---------------------- | ----------------------------------------------------------- | ------------------------------ |
| Function calling       | Claude tools (excellent), Mistral (good)                    | Minimal changes                |
| Structured output/JSON | Claude (excellent), Nova Pro (good)                         | Most models via prompt         |
| Streaming              | All major models                                            | Same SSE pattern               |
| Vision                 | Claude Sonnet/Haiku, Llama 4 Maverick                       | Multimodal parity              |
| Context caching        | Claude prompt caching                                       | 90% savings on cached portions |
| Audio/video input      | Nova Sonic (speech), Transcribe/Rekognition (preprocessing) | Different architecture         |
| Embeddings             | Amazon Titan Embeddings ($0.02/1M, 1536 dims)               | Must re-embed all docs         |

## Design Ref Ai Openai To Bedrock

# OpenAI to Bedrock — Model Selection Guide

**Applies to:** OpenAI SDK usage detected in GCP-hosted applications → Amazon Bedrock

This file is loaded by `design-ai.md` when `ai-workload-profile.json` has `summary.ai_source` = `"openai"` or `"both"`. It provides model mapping tables with pricing and honest competitive analysis for OpenAI → Bedrock migration decisions.

Many GCP-hosted applications use OpenAI's API rather than Vertex AI. This guide covers that migration path.

Verify all pricing via AWS Pricing MCP or `steering/cached-prices.md`. Uses OpenAI Standard tier pricing.

---

## Key Insight: The Landscape Has Changed (March 2026)

**It is no longer "Bedrock is always cheaper."** It depends on the model.

- **OpenAI cheaper:** GPT-5.2 (50%), GPT-5.1/5 (40%), GPT-4.1 (43%), GPT-4o (29%), o4-mini/o3-mini/o1-mini (69%)
- **Bedrock cheaper:** Nova Lite vs Mini models (85-86%), Nova Micro vs Nano (58-65%), Nova Premier vs Pro models (88-92%), DeepSeek-R1 vs o3 (32%)

---

## Model Mapping Tables

### Flagship (GPT-5 Series)

Percentages below are blended savings using a 2:1 input-to-output token ratio.

| OpenAI Model    | Price (in/out per 1M) | Best Bedrock Match | Bedrock Price  | Winner              |
| --------------- | --------------------- | ------------------ | -------------- | ------------------- |
| GPT-5.2         | $1.75 / $14.00        | Claude Opus 4.6    | $5.00 / $25.00 | OpenAI 50% cheaper  |
| GPT-5.1 / GPT-5 | $1.25 / $10.00        | Claude Sonnet 4.6  | $3.00 / $15.00 | OpenAI 40% cheaper  |
| GPT-5 Mini      | $0.25 / $2.00         | Nova Lite          | $0.06 / $0.24  | Bedrock 86% cheaper |
| GPT-5 Nano      | $0.05 / $0.40         | Nova Micro         | $0.035 / $0.14 | Bedrock 58% cheaper |

### Pro Models (Extended Reasoning)

| OpenAI Model | Price (in/out per 1M) | Best Bedrock Match | Bedrock Price  | Winner              |
| ------------ | --------------------- | ------------------ | -------------- | ------------------- |
| GPT-5.2 Pro  | $21.00 / $168.00      | Nova Premier       | $2.50 / $12.50 | Bedrock 92% cheaper |
| GPT-5 Pro    | $15.00 / $120.00      | Nova Premier       | $2.50 / $12.50 | Bedrock 88% cheaper |

### GPT-4.1 Series

| OpenAI Model | Price (in/out per 1M) | Best Bedrock Match | Bedrock Price  | Winner              |
| ------------ | --------------------- | ------------------ | -------------- | ------------------- |
| GPT-4.1      | $2.00 / $8.00         | Claude Sonnet 4.6  | $3.00 / $15.00 | OpenAI 43% cheaper  |
| GPT-4.1 Mini | $0.40 / $1.60         | Nova Lite          | $0.06 / $0.24  | Bedrock 85% cheaper |
| GPT-4.1 Nano | $0.10 / $0.40         | Nova Micro         | $0.035 / $0.14 | Bedrock 65% cheaper |

### GPT-4o Series

| OpenAI Model | Price (in/out per 1M) | Best Bedrock Match | Bedrock Price  | Winner              |
| ------------ | --------------------- | ------------------ | -------------- | ------------------- |
| GPT-4o       | $2.50 / $10.00        | Claude Sonnet 4.6  | $3.00 / $15.00 | OpenAI 29% cheaper  |
| GPT-4o Mini  | $0.15 / $0.60         | Nova Lite          | $0.06 / $0.24  | Bedrock 60% cheaper |

### Reasoning Models (o-series)

| OpenAI Model                | Price (in/out per 1M) | Best Bedrock Match | Bedrock Price  | Winner              |
| --------------------------- | --------------------- | ------------------ | -------------- | ------------------- |
| o1-pro                      | $150.00 / $600.00     | Nova Premier       | $2.50 / $12.50 | Bedrock 98% cheaper |
| o3-pro                      | $20.00 / $80.00       | Nova Premier       | $2.50 / $12.50 | Bedrock 85% cheaper |
| o1                          | $15.00 / $60.00       | Nova Premier       | $2.50 / $12.50 | Bedrock 81% cheaper |
| o3                          | $2.00 / $8.00         | DeepSeek-R1        | $1.35 / $5.40  | Bedrock 32% cheaper |
| o4-mini / o3-mini / o1-mini | $1.10 / $4.40         | Claude Sonnet 4.6  | $3.00 / $15.00 | OpenAI 69% cheaper  |

### Legacy Models

| OpenAI Model  | Price (in/out per 1M) | Best Bedrock Match | Bedrock Price  | Winner                                    |
| ------------- | --------------------- | ------------------ | -------------- | ----------------------------------------- |
| GPT-4 Turbo   | $10.00 / $30.00       | Claude Sonnet 4.6  | $3.00 / $15.00 | Bedrock 58% cheaper                       |
| GPT-4         | $30.00 / $60.00       | Claude Sonnet 4.6  | $3.00 / $15.00 | Bedrock 82% cheaper                       |
| GPT-3.5 Turbo | $0.50 / $1.50         | Llama 4 Maverick   | $0.24 / $0.97  | Bedrock 42% cheaper + much better quality |

### OpenAI Models on Bedrock (gpt-oss)

OpenAI's open-source models are available directly on Bedrock, enabling migration without switching model families:

| OpenAI Model | Price (in/out per 1M) | Bedrock gpt-oss | Bedrock Price | Notes                                 |
| ------------ | --------------------- | --------------- | ------------- | ------------------------------------- |
| GPT-4o Mini  | $0.15 / $0.60         | gpt-oss-120b    | $0.15 / $0.60 | Same cost, runs on AWS infrastructure |
| GPT-5 Nano   | $0.05 / $0.40         | gpt-oss-20b     | $0.07 / $0.30 | Similar budget tier on AWS            |

This path avoids model-family risk: the application stays on OpenAI-architecture models while consolidating on AWS infrastructure.

_Percentages are blended savings using a 2:1 input-to-output token ratio. Actual savings depend on your input/output ratio._

---

## Migration Decision Framework

**Migrate to Bedrock if:**

- Using Pro/expensive models (o1-pro, GPT-5.2 Pro) → 85-98% savings
- Using Mini/Nano models at high volume → 58-86% savings
- Using legacy GPT-4/3.5 → 42-82% savings
- Need AWS infrastructure integration
- Need prompt caching (Claude only, 90% savings on cached content)
- Using o3 for reasoning → DeepSeek-R1 on Bedrock is 32% cheaper
- Want to stay on OpenAI models → gpt-oss on Bedrock (same models, AWS infrastructure)

**Consider staying on OpenAI if:**

- Using mid-tier flagships (GPT-5, GPT-4.1, o3, o4-mini) → OpenAI 29-69% cheaper
- Low volume (<$500/mo) where absolute savings are small
- Heavily integrated with OpenAI ecosystem (Assistants API, DALL-E, Whisper, Realtime)
- Need Realtime API (no Bedrock equivalent)

**Analyze carefully:** Calculate actual token usage x model-specific pricing. Small % differences matter at scale.

---

## Feature Migration

| OpenAI Feature       | Bedrock Equivalent                                        | Notes                               |
| -------------------- | --------------------------------------------------------- | ----------------------------------- |
| Function calling     | Claude tools (excellent, similar format)                  | Minimal changes                     |
| Streaming            | All major models                                          | Verify gateway format               |
| Vision (GPT-4V)      | Claude Sonnet/Haiku, Llama 4 Maverick                     | 70-95% cheaper                      |
| Embeddings (ada-002) | Titan Embeddings ($0.02/1M, 1536 dims)                    | Must re-embed all docs              |
| DALL-E               | Titan Image Generator ($0.008-$0.04/img)                  | 50-70% cheaper                      |
| Whisper (STT)        | Amazon Transcribe ($0.024/min)                            | 4x more expensive but more features |
| TTS                  | Amazon Polly                                              | Different pricing model             |
| Assistants API       | Bedrock Agents (sessions, action groups, knowledge bases) | 2-4 week migration                  |
| JSON mode            | Claude (excellent), Nova Pro (good)                       | Most models via prompt              |
| Realtime API         | No equivalent                                             | Stay on OpenAI for this             |

---

## Common Migration Paths

### GPT-4/4 Turbo → Claude Sonnet 4.6

70-90% savings, similar or better quality, longer context (200K vs 128K). Low risk.

### GPT-3.5 Turbo → Llama 4 Maverick

Similar cost, dramatically better quality, 1M context (vs 16K).

### GPT-4 → Multi-Model (high spend)

Tier by complexity: simple → Nova Micro/Llama 4 Scout (60%), moderate → Llama 4 Maverick/Nova Pro (30%), complex → Claude Sonnet (10%). 85-95% savings.

### Pro models → Nova Premier

80-98% savings. Strong migration case at any volume.

---

## Volume-Based Recommendations

**Low (<1M tokens/day):** Use best model for quality. Cost difference minimal.

**Medium (1-10M tokens/day):** Present cost comparison at volume. At 5M input + 2.5M output/day, evaluate per-model economics carefully.

**High (10-100M tokens/day):** Multi-model tiered approach recommended. Route by task complexity.

**Very high (>100M tokens/day):** Mandatory tiering:

- Simple tasks (60%) → Nova Micro or Llama 4 Scout
- Moderate tasks (30%) → Llama 4 Maverick or Nova Pro
- Complex tasks (10%) → Claude Sonnet 4.6

---

## OpenAI Pricing Tiers

OpenAI offers 4 tiers: Batch (50% off, 24hr), Flex (30-50% off, higher latency), Standard (baseline), Priority (2x, lowest latency). This guide uses Standard tier for comparison.

## Design Ref Ai

# AI/ML Services Design Rubric

**Applies to:** Vertex AI (traditional ML), Cloud Vision API, Cloud ML Engine (deprecated — now part of Vertex AI)

## LLM Routing

If the detected AI workload is LLM-based (generative models), load the source-specific design reference instead of this file:

- If `ai-workload-profile.json` → `summary.ai_source` = `"gemini"`: load `steering/design-ref-ai-gemini-to-bedrock.md`
- If `ai-workload-profile.json` → `summary.ai_source` = `"openai"`: load `steering/design-ref-ai-openai-to-bedrock.md`
- If `ai-workload-profile.json` → `summary.ai_source` = `"both"`: load both files
- If `ai-workload-profile.json` → `summary.ai_source` = `"other"` or absent, OR if the workload is traditional ML (custom models, Vision API, Speech API): use the SageMaker/Rekognition/Textract rubric below.

---

## Signals (Decision Criteria)

### Vertex AI (Endpoints / Models)

- **Custom model inference** → SageMaker Endpoints
- **Pre-built model APIs** → AWS APIs (Rekognition, Textract, Translate, etc.)
- **Batch prediction** → SageMaker Batch Transform

### Cloud Vision API

- **Image classification, OCR** → AWS Rekognition (images) or Textract (OCR)
- **Document understanding** → AWS Textract (more powerful for docs)

### Cloud ML Engine (deprecated — now part of Vertex AI)

- **Model training** → SageMaker (managed training jobs)
- **AutoML** → SageMaker Autopilot / Canvas

## 6-Criteria Rubric

Apply in order:

1. **Eliminators**: Does GCP config require AWS-unsupported features? If yes: use alternative
2. **Operational Model**: Managed (SageMaker) vs Custom (EC2 + training)?
   - Prefer managed
3. **User Preference**: From `preferences.json`: `design_constraints.cost_sensitivity` + `ai_constraints` (if present)
   - If cost-sensitive → check SageMaker Spot + Autopilot
4. **Feature Parity**: Does GCP config need model type unavailable in AWS?
   - Example: TensorFlow 2.x → SageMaker (supported)
5. **Cluster Context**: Are other compute resources running ML? Prefer SageMaker affinity
6. **Simplicity**: SageMaker endpoints (managed) > custom EC2 instances

## Examples

### Example 1: Vertex AI Endpoint (PyTorch model)

- GCP: `google_ai_platform_model` (model_name="image-classifier", framework=PYTORCH)
- Signals: Custom model inference, PyTorch
- Criterion 1 (Eliminators): PASS (PyTorch supported)
- Criterion 2 (Operational Model): SageMaker Endpoint (managed)
- → **AWS: SageMaker Endpoint (PyTorch container)**
- Confidence: `inferred`

### Example 2: Cloud Vision API

- GCP: `google_vision_api_call` (feature=TEXT_DETECTION, image_source=GCS)
- Signals: Pre-built API
- → **AWS: Textract (if document OCR) or Rekognition (if image classification)**
- Confidence: `inferred`

### Example 3: AutoML (image classification)

- GCP: `google_automl_image_classification_dataset`
- Signals: Training pipeline, classification
- Criterion 1 (Eliminators): PASS
- Criterion 2 (Operational Model): SageMaker Autopilot (managed)
- → **AWS: SageMaker Autopilot + Canvas (for low-code)**
- Confidence: `inferred`

## Output Schema

```json
{
  "gcp_type": "google_ai_platform_model",
  "gcp_address": "image-classifier-v2",
  "gcp_config": {
    "framework": "PYTORCH",
    "version": "1.9"
  },
  "aws_service": "SageMaker",
  "aws_config": {
    "endpoint_name": "image-classifier-v2",
    "instance_type": "ml.m5.large",
    "container_image": "pytorch:1.9"
  },
  "confidence": "inferred",
  "rationale": "Vertex AI custom model → SageMaker Endpoint (PyTorch supported)"
}
```

## Design Ref Compute

# Compute Mappings

## google_cloud_run_service / google_cloud_run_v2_service

**Purpose:** Serverless container execution platform

**Default:** aws_ecs_service (ECS Fargate)

**Rationale for default:** Fargate is the recommended AWS equivalent to Cloud Run — fully managed containers, auto-scaling, better dev/prod parity than App Runner, broader feature set (service discovery, load balancer integration, capacity providers).

**Candidates:**
- aws_ecs_service (ECS Fargate)
- aws_apprunner_service (App Runner)
- aws_lambda_function (Lambda)

**Signals:**

| Config Field | Value | Favors | Weight | Reason |
|---|---|---|---|---|
| timeout | > 900s | aws_ecs_service | strong | Exceeds Lambda maximum, App Runner max is 120s for request timeout |
| timeout | <= 120s | aws_apprunner_service | moderate | Within App Runner and Lambda limits, App Runner is simplest |
| timeout | 121s - 900s | aws_ecs_service | moderate | Exceeds App Runner, within Lambda, but long timeout suggests long-running work |
| memory | > 10240MB | aws_ecs_service | strong | Exceeds Lambda maximum (10GB) |
| memory | <= 3008MB | aws_lambda_function | weak | Within Lambda limits, but not a strong signal alone |
| min_instances | > 0 | aws_ecs_service | moderate | Always-on workload, Fargate more cost-effective than Lambda provisioned concurrency |
| min_instances | 0 or absent | aws_apprunner_service | weak | Scale-to-zero, all three support this |
| max_instances | > 100 | aws_ecs_service | moderate | High scale needs, Fargate has more predictable scaling |
| concurrency | 1 | aws_lambda_function | moderate | Single-request processing aligns with Lambda model |
| concurrency | > 80 | aws_ecs_service | moderate | High concurrency per instance suggests long-lived container |
| gpu | required | aws_ecs_service | strong | Only Fargate supports GPU tasks |
| allow_public | false | aws_ecs_service | moderate | Internal-only services are simpler on Fargate with private ALB |

**Eliminators:**
- timeout > 900s → eliminates aws_lambda_function (Lambda max 900s)
- timeout > 120s → eliminates aws_apprunner_service (App Runner request timeout max 120s)
- memory > 10240MB → eliminates aws_lambda_function (Lambda max 10GB)
- memory > 30720MB → eliminates aws_apprunner_service (App Runner max 30GB)
- gpu required → eliminates aws_lambda_function and aws_apprunner_service

**Peek at secondaries:** No

**1:Many Expansion:**

If App Runner:
- aws_apprunner_service — primary
- aws_apprunner_auto_scaling_configuration_version — if custom scaling needed
- aws_apprunner_vpc_connector — if VPC access needed
- aws_ecr_repository — for container image storage

If Lambda:
- aws_lambda_function — primary
- aws_lambda_function_url — if public HTTP endpoint needed (replaces Cloud Run URL)
- aws_cloudwatch_log_group — Lambda logging
- aws_ecr_repository — if using container image (vs zip deployment)

If ECS Fargate:
- aws_ecs_service — primary
- aws_ecs_task_definition — container configuration
- aws_ecs_cluster — if no cluster exists yet (shared across services)
- aws_lb — Application Load Balancer for HTTP traffic
- aws_lb_target_group — routing to ECS tasks
- aws_lb_listener — HTTP/HTTPS listener
- aws_ecr_repository — for container image storage
- aws_cloudwatch_log_group — ECS logging

**Source Config to Carry Forward:**
- container_image — determines image source (GCR/AR → ECR migration needed)
- memory — determines memory allocation
- cpu — determines CPU allocation
- timeout — determines timeout configuration
- min_instances — determines min capacity / desired count
- max_instances — determines max capacity / auto-scaling limits
- concurrency — determines target tracking scaling metric
- env_vars — determines environment variables (references may need updating)
- secret_env_vars — determines secrets references (Secret Manager ARNs)
- vpc_connector — determines VPC configuration
- allow_public — determines load balancer scheme (internet-facing vs internal)
- service_account — determines IAM role (resolved during secondary mapping)

---

## google_container_cluster

**Purpose:** Kubernetes container orchestration

**Default:** aws_ecs_service (ECS Fargate)

**Rationale for default:** ECS Fargate is the standard AWS migration target for GKE workloads — managed container execution, no node management, integrates natively with VPC, ALB, and IAM.

**Candidates:**
- ECS Fargate (via `aws_ecs_service` + `aws_ecs_task_definition`)
- ECS EC2 (same resources, different launch type)
- EKS (`aws_eks_cluster`)

**Preference shortcuts (check preferences.json first):**
- `compute: "eks"` → always EKS. Skip all other criteria.
- `kubernetes: "eks-managed"` → EKS.
- `kubernetes: "ecs-fargate"` → ECS Fargate.
- `kubernetes: "eks-or-ecs"` → continue rubric evaluation.

**Eliminators:**
- GPU node pools (any `google_container_node_pool` with accelerators configured) → eliminates ECS Fargate (limited GPU support), favor ECS EC2
- 10+ node pools of different machine families → eliminates ECS Fargate and ECS EC2, favor EKS (complex topology requires Kubernetes orchestration)

**Signals:**

| Signal | Favors | Weight | Reason |
|---|---|---|---|
| Single node pool, standard machine type (e2-standard, n1-standard) | ECS Fargate | strong | Straightforward workload, no need for node management |
| Multiple node pools | EKS | moderate | Complex topology is harder to replicate on ECS |
| Cluster description mentions "web service", "API", "backend" | ECS Fargate | moderate | Typical ECS Fargate workload |
| High node count (initial or max > 20) | EKS | moderate | Large fleets benefit from Kubernetes orchestration |
| Workload Insights or Dataplane V2 features used | EKS | weak | Advanced networking features map better to EKS |

**1:Many Expansion — ECS Fargate (most common case):**

**MANDATORY — always add ALL of the following to `new_aws_resources` when mapping a GKE cluster to ECS:**

| Resource | Always required? | Condition |
|---|---|---|
| `aws_ecs_cluster` | Yes, unless already created by a prior cluster | First ECS cluster in the migration |
| `aws_ecs_service` | Yes | One per node pool |
| `aws_ecs_task_definition` | Yes | One per node pool |
| `aws_ecr_repository` | **Always** | Container images must be re-pushed from GCR/Artifact Registry to ECR. Number of repos = number of distinct workloads. Cannot run on ECS without ECR. |
| `aws_lb` | **Always** (unless cluster is explicitly documented as internal-only with no external traffic) | GKE has implicit ingress. ECS has no external entry point without ALB. |
| `aws_lb_target_group` | Yes, with ALB | One per service family |
| `aws_lb_listener` | Yes, with ALB | HTTP port 80 and HTTPS port 443 |
| `aws_appautoscaling_target` | When node pool has `autoscaling` block | Registers ECS service as a scalable target |
| `aws_appautoscaling_policy` | When `aws_appautoscaling_target` is added | Defines scaling behavior (target tracking on CPU/memory) |

**PROHIBITED omissions:**
- Never omit `aws_ecr_repository`. Container images cannot be pulled from GCR on ECS.
- Never omit `aws_lb` unless the cluster is explicitly documented as internal-only. "I don't see an ingress resource" is not a sufficient reason to omit the ALB — GKE clusters with external workloads rely on the cluster's default ingress.
- Never omit `aws_appautoscaling_target` + `aws_appautoscaling_policy` when node pool autoscaling is configured.

**1:Many Expansion — EKS:**
- `aws_eks_cluster` — primary
- `aws_eks_node_group` — one per `google_container_node_pool`
- `aws_iam_role` — EKS cluster role
- `aws_iam_role` — EKS node group role
- `aws_ecr_repository` — always required (same reason as ECS)

**Source Config to Carry Forward:**
- name — cluster name
- location / region — determines AWS region and AZ placement
- network — determines VPC placement (resolved from google_compute_network mapping)
- subnetwork — determines subnet placement
- logging_service / monitoring_service — determines CloudWatch logging/monitoring config
- min_master_version — Kubernetes version reference
- workload_identity_config — determines IAM trust policy configuration (absorbed into task role)

---

## google_container_node_pool

**This is a secondary resource. Its target depends on what `google_container_cluster` mapped to.**

**CRITICAL: `google_container_node_pool` is NOT eligible for Pass 1. It must be evaluated in Pass 2 AFTER its parent cluster is resolved.**

**When cluster → ECS Fargate or ECS EC2:**
- **Target: `absorbed`**
- Node pool parameters translate into ECS task definition config and service scaling config — there are no nodes to manage on Fargate.
- Node pool does NOT become a 1:1 AWS resource.
- `aws_ecs_service` and `aws_ecs_task_definition` appear in `new_aws_resources` of the cluster, not as direct mapping targets of the node pool.

Carry forward these fields into the reason (they inform task definition and service config):
- `machine_type` — translates to vCPU/memory allocation for the task definition
- `disk_size_gb` — informs ephemeral storage config on the task
- `min_node_count` — becomes minimum task count / desired count baseline
- `max_node_count` — becomes maximum task count for auto-scaling policy
- `initial_node_count` — use as desired count if no billing data is available
- `autoscaling` block present → trigger `aws_appautoscaling_target` + `aws_appautoscaling_policy` in `new_aws_resources`

**When cluster → EKS:**
- **Target: `aws_eks_node_group`**
- One node pool → one EKS managed node group.
- Carry forward: `machine_type`, `min_node_count`, `max_node_count`, `disk_size_gb`, `node_count`

---

## google_compute_instance

**Purpose:** Virtual machines

**Default:** aws_instance (EC2)

**Candidates:**
- aws_instance (EC2)

**Signals:** None — direct 1:1 mapping. EC2 is the only candidate.

**Eliminators:** None

**Peek at secondaries:** No

**1:Many Expansion:**
- aws_instance — primary
- aws_ebs_volume — if additional disks attached (beyond root)
- aws_eip — if static external IP assigned

**Source Config to Carry Forward:**
- machine_type — determines instance_type (translation needed by Pillar 4)
- zone — determines availability_zone
- boot_disk.image — determines ami
- boot_disk.size — determines root volume size
- network_interface.network — determines VPC/subnet placement
- metadata.startup_script — determines user_data
- tags — determines instance tags
- service_account — determines IAM instance profile (resolved during secondary mapping)

---

## google_cloudfunctions_function / google_cloudfunctions2_function

**Purpose:** Serverless functions

**Default:** aws_lambda_function (Lambda)

**Candidates:**
- aws_lambda_function (Lambda)

**Signals:** None — direct 1:1 mapping. Cloud Functions and Lambda are equivalent models.

**Eliminators:**
- timeout > 900s (Cloud Functions 2nd gen supports up to 3600s) → Lambda cannot handle this, flag for user. Recommend ECS Fargate as alternative.
- memory > 10240MB → Lambda cannot handle this, flag for user.

**Peek at secondaries:** No

**1:Many Expansion:**
- aws_lambda_function — primary
- aws_cloudwatch_log_group — logging
- aws_lambda_event_source_mapping — if triggered by Pub/Sub (maps to SQS trigger)
- aws_lambda_permission — if triggered by HTTP (API Gateway or function URL)

**Source Config to Carry Forward:**
- runtime — determines runtime
- entry_point — determines handler
- memory_mb — determines memory_size
- timeout — determines timeout
- environment_variables — determines environment variables
- vpc_connector — determines VPC configuration
- source_archive_bucket / source_archive_object — determines deployment package source
- trigger_http — determines function URL or API Gateway need
- event_trigger — determines event source mapping

---

## Secondary: google_service_account

**Behavior:** Service accounts are identity secondaries that provide IAM credentials to compute resources. They map to AWS IAM roles based on what the primary compute resource became.

**Mapping Behavior:**

When google_cloud_run_service maps to:
- aws_apprunner_service → service account maps to aws_iam_role (execution role for App Runner)
- aws_lambda_function → service account maps to aws_iam_role (execution role for Lambda)
- aws_ecs_service → service account maps to aws_iam_role (task execution role for ECS)

When google_cloudfunctions_function maps to:
- aws_lambda_function → service account maps to aws_iam_role (execution role for Lambda)

When google_container_cluster maps to:
- aws_eks_cluster → service account maps to aws_iam_role (IRSA - IAM Roles for Service Accounts via OpenID Connect provider)
- aws_ecs_cluster → service account maps to aws_iam_role (cluster execution role)

When google_compute_instance maps to:
- aws_ec2_instance → service account maps to aws_iam_role (instance profile attached to EC2)

**Implementation Notes:**
1. Service account IAM bindings (google_project_iam_member, google_*_iam_member) become policy statements on the AWS role
2. Service account email becomes role assume role policy (who can assume this role)
3. Service account keys should be migrated to AWS Secrets Manager
4. For Kubernetes (EKS), uses IRSA to bind service accounts to IAM roles via OpenID Connect

**Skip Condition:**
If the primary compute resource is skipped or not mapped to AWS, skip this service account.

---

## google_app_engine_application

**Purpose:** Fully managed application hosting platform

**Default:** aws_ecs_service (ECS Fargate)

**Rationale for default:** App Engine applications are typically web apps or APIs. Fargate provides similar managed container hosting with auto-scaling, no server management, and better integration with the broader AWS ecosystem.

**Candidates:**
- aws_ecs_service (ECS Fargate) — general-purpose, best for most App Engine apps
- aws_amplify_app (Amplify Hosting) — for static/JAMstack apps with backend APIs
- aws_apprunner_service (App Runner) — simpler setup, fewer configuration options

**Signals:**

| Signal | Favors | Weight | Reason |
|---|---|---|---|
| Standard environment (Python, Java, Node.js, Go, PHP, Ruby) | Fargate | strong | Container-based deployment matches standard env |
| Flexible environment (custom runtime/Dockerfile) | Fargate | strong | Custom containers are Fargate's strength |
| Static site with API backend | Amplify | moderate | Amplify handles static hosting + API routes |
| Simple web service, minimal config | App Runner | weak | App Runner is simpler but less configurable |

**1:Many Expansion (Fargate):**
- aws_ecs_service
- aws_ecs_task_definition
- aws_lb (Application Load Balancer)
- aws_lb_target_group
- aws_lb_listener

## Design Ref Database

# Database Mappings

## google_sql_database_instance

**Purpose:** Managed relational database (MySQL, PostgreSQL)

**Default:** aws_db_instance (RDS) or aws_rds_cluster (Aurora)

**Rationale for default:** AWS RDS is the closest equivalent to Cloud SQL — fully managed, multi-AZ support, automated backups. Aurora is preferred for higher scale requirements.

**Candidates:**
- aws_db_instance (RDS MySQL or RDS PostgreSQL)
- aws_rds_cluster (Aurora MySQL or Aurora PostgreSQL)

**Signals:**

| Config Field | Value | Favors | Weight | Reason |
|---|---|---|---|---|
| database_version | >= MySQL 8.0 or PostgreSQL 13+ | aws_rds_cluster | moderate | Aurora supports latest versions better |
| backup_configuration.enabled | true | aws_db_instance or aws_rds_cluster | weak | Both support backups equally |
| backup_configuration.point_in_time_recovery_enabled | true | aws_rds_cluster | moderate | Aurora has superior PITR capabilities |
| settings.backup_config.transaction_log_retention_days | > 7 | aws_rds_cluster | moderate | Aurora supports longer retention |
| settings.ip_configuration.require_ssl | true | aws_db_instance or aws_rds_cluster | weak | Both enforce SSL |
| tier | Scaling for high IOPS | aws_rds_cluster | moderate | Aurora better for scaling to high I/O |
| scale (inferred from current load) | Large (> 100 GB, > 10K QPS) | aws_rds_cluster | strong | Aurora handles scale better |
| scale (inferred from current load) | Standard (< 100 GB, < 5K QPS) | aws_db_instance | moderate | RDS sufficient for smaller workloads |

**Eliminators:**
- Custom engine features not in AWS → flag for user, may need workaround

**Peek at secondaries:** Yes — check for google_sql_database resources and backup configurations

**1:Many Expansion (RDS):**
- aws_db_instance — primary
- aws_db_parameter_group — if custom parameters needed
- aws_db_option_group — if DB options needed
- aws_db_subnet_group — for multi-AZ placement
- aws_security_group — for database access control

**1:Many Expansion (Aurora):**
- aws_rds_cluster — cluster definition
- aws_rds_cluster_instance — one or more instances (2+ for HA)
- aws_rds_cluster_parameter_group — custom cluster parameters
- aws_db_subnet_group — for multi-AZ placement
- aws_security_group — for database access control
- aws_rds_cluster_backup — if backing up to specific window needed

**Source Config to Carry Forward:**
- database_version — determines engine/engine_version
- tier — determines instance_class or cluster instance type
- region — determines AWS region
- availability_type — determines multi_az (HA requirement)
- backup_configuration — determines backup retention and window
- settings.ip_configuration — determines db_subnet_group and security groups
- name — determines database name
- user credentials — determines master username/password (migrate to Secrets Manager)

---

## google_firestore_database

**Purpose:** NoSQL document database with real-time capabilities

**Default:** aws_dynamodb_table (DynamoDB)

**Rationale for default:** DynamoDB is the closest AWS equivalent to Firestore — serverless NoSQL, auto-scaling, document-oriented data model. Similar pricing model (read/write units).

**Candidates:**
- aws_dynamodb_table (DynamoDB)
- aws_rds_cluster (Aurora PostgreSQL — if relational features critical)

**Signals:**

| Config Field | Value | Favors | Weight | Reason |
|---|---|---|---|---|
| Data model | Document/JSON-like | aws_dynamodb_table | strong | Firestore's natural equivalent |
| Data model | Highly relational (lots of joins) | aws_rds_cluster | strong | Aurora handles complex relationships better |
| Query patterns | Mostly key-value reads | aws_dynamodb_table | strong | DynamoDB's strength |
| Query patterns | Range queries, filters | aws_dynamodb_table | moderate | DynamoDB GSI handles this, but more complex |
| Query patterns | Complex queries, aggregations | aws_rds_cluster | strong | Aurora PostgreSQL better for analytics |
| Real-time listeners | Required | aws_dynamodb_table + aws_kinesis | strong | DynamoDB Streams + Lambda for real-time |
| Real-time listeners | Not required | aws_dynamodb_table | moderate | Standard DynamoDB sufficient |
| Indexes | Multiple custom indexes | aws_dynamodb_table | moderate | DynamoDB supports up to 10 GSI |
| Indexes | Complex multi-column indexes | aws_rds_cluster | moderate | Aurora handles complex indexes better |

**Eliminators:**
- ACID transactions across unrelated documents → DynamoDB transactions are limited (up to 25 items), consider Aurora instead

**Peek at secondaries:** No

**1:Many Expansion (DynamoDB):**
- aws_dynamodb_table — primary
- aws_dynamodb_global_table — if multi-region replication needed
- aws_kinesis_stream — if real-time processing needed (for Streams)
- aws_lambda_function — for Streams processing (real-time listeners)

**1:Many Expansion (Aurora PostgreSQL):**
- aws_rds_cluster — primary
- aws_rds_cluster_instance — 2+ instances for HA
- aws_db_subnet_group — for placement
- aws_security_group — for access control

**Source Config to Carry Forward:**
- Collection structure — informs table design and GSI strategy
- Document structure — informs item schema
- Indexes — informs DynamoDB GSI configuration
- Real-time listeners — informs whether Streams and Lambda are needed

---

## google_bigquery_dataset

**Purpose:** Data warehouse and analytics

**Default:** aws_athena_workgroup (Athena) or aws_redshift_cluster (Redshift)

**Rationale for default:** Athena is the closest BigQuery equivalent for ad-hoc queries on data in S3 (similar pay-per-query model). Redshift is preferred for frequent/complex interactive queries requiring consistent performance.

**Candidates:**
- aws_athena_workgroup (Athena — query data in S3)
- aws_redshift_cluster (Redshift — data warehouse cluster)

**Signals:**

| Config Field | Value | Favors | Weight | Reason |
|---|---|---|---|---|
| Query pattern | Infrequent, ad-hoc analytics | aws_athena_workgroup | strong | Athena's strength; similar to BigQuery pay-per-query |
| Query pattern | Frequent interactive queries (dashboards) | aws_redshift_cluster | strong | Redshift's consistency and performance |
| Data volume | Large (> 100 GB) | aws_athena_workgroup or aws_redshift_cluster | weak | Both handle large data; choice depends on query pattern |
| Data volume | Massive (> 1 TB, > 10K queries/month) | aws_redshift_cluster | moderate | Redshift more cost-effective at scale |
| Query complexity | Simple aggregations | aws_athena_workgroup | moderate | Athena sufficient |
| Query complexity | Complex, multi-table joins, UDFs | aws_redshift_cluster | moderate | Redshift better for complex queries |
| SLA requirements | Consistent sub-second performance | aws_redshift_cluster | strong | Redshift cluster SLA > Athena variable performance |
| Cost sensitivity | Budget-conscious, sporadic usage | aws_athena_workgroup | strong | Pay only for data scanned |
| Cost sensitivity | Predictable workload | aws_redshift_cluster | moderate | Cluster cost predictable once sized |

**Eliminators:**
- Real-time data ingestion patterns (streaming) → Neither Athena nor Redshift ideal; consider Kinesis + DynamoDB instead

**Peek at secondaries:** Yes — check for linked datasets, scheduled queries, or Pub/Sub triggers

**1:Many Expansion (Athena):**
- aws_athena_workgroup — query execution workgroup
- aws_s3_bucket — data storage (linked from data_source)
- aws_glue_catalog_database — metadata catalog
- aws_glue_catalog_table — table definitions
- aws_athena_named_query — saved queries

**1:Many Expansion (Redshift):**
- aws_redshift_cluster — primary data warehouse
- aws_redshift_subnet_group — cluster placement
- aws_security_group — access control
- aws_redshift_parameter_group — cluster parameters
- aws_s3_bucket — for external table data (Redshift Spectrum)

**Source Config to Carry Forward:**
- Dataset name and description — determines Athena workgroup name or Redshift database name
- Table schemas — informs Glue catalog design (Athena) or Redshift table definitions
- Scheduled queries — informs Lambda/EventBridge triggers (Athena) or Redshift scheduled queries
- Linked sources — informs S3 bucket configuration (Athena) or external table setup (Redshift)

---

## Secondary: google_sql_database

**Behavior:** SQL databases are configuration secondaries that define which databases are created within a Cloud SQL instance. They are absorbed into the primary database resource configuration.

**Mapping Behavior:**

When google_sql_database_instance maps to:
- aws_db_instance (RDS) → Each google_sql_database is absorbed as `db_name` during RDS initialization
- aws_rds_cluster (Aurora) → Each google_sql_database is absorbed as `database_name` during Aurora initialization

**Implementation:**
1. Database names and character sets are carried forward to AWS resource configuration
2. Database creation SQL (`CREATE DATABASE ...`) runs during RDS/Aurora initialization
3. No separate aws_db resource is created
4. Multiple databases on same instance each become their own initialization

**Skip Condition:**
If the primary google_sql_database_instance is skipped or not mapped to AWS, skip these secondaries.

---

## Secondary: google_sql_user

**Behavior:** SQL users are configuration secondaries that define database authentication credentials. They map to AWS Secrets Manager for secure credential storage.

**Mapping Behavior:**

When google_sql_database_instance maps to:
- aws_db_instance (RDS) → Service account credentials become `master_username` / `master_password` stored in aws_secretsmanager_secret
- aws_rds_cluster (Aurora) → Service account credentials become `master_username` / `master_password` stored in aws_secretsmanager_secret

**Implementation:**
1. GCP service account email/password becomes AWS master user credentials
2. Credentials must be stored in AWS Secrets Manager (not in code/config)
3. Connection strings must be updated with new AWS credentials
4. Application code must retrieve credentials from Secrets Manager

**Security Note:**
Never commit database passwords. Use Secrets Manager for credential management and rotation.

**Skip Condition:**
If the primary google_sql_database_instance is skipped, skip these secondaries.

---

## google_redis_instance (Memorystore)

**Purpose:** In-memory cache and data store

**Default:** aws_elasticache_replication_group (ElastiCache Redis)

**Rationale for default:** ElastiCache Redis is the direct 1:1 equivalent to Memorystore Redis. Same Redis engine, managed service with multi-AZ failover.

**Candidates:**
- aws_elasticache_replication_group (ElastiCache Redis) — always the target

**This is a fast-path (deterministic) mapping.** No rubric evaluation needed.

**Signals:**

| Signal | Favors | Weight | Reason |
|---|---|---|---|
| Cluster mode enabled | ElastiCache Redis with cluster mode | strong | Preserve sharding topology |
| High availability required | ElastiCache Redis Multi-AZ with auto-failover | strong | Match HA configuration |
| Single node, dev/test | ElastiCache Redis (single node) | moderate | Cost optimization for dev |

**1:Many Expansion:**
- aws_elasticache_replication_group
- aws_elasticache_subnet_group
- aws_elasticache_parameter_group (if custom parameters)

**Source Config to Carry Forward:**
- tier → determines node type (e.g., BASIC → cache.t4g.micro, STANDARD_HA → cache.r7g.large)
- memory_size_gb → determines node size
- redis_version → determines engine version
- auth_enabled → determines transit encryption and AUTH token
- replica_count → determines number of replicas per shard

## Design Ref Fast Path

# Fast Path: Unconditional Mappings

> This file contains deterministic resource mappings that skip the evaluation rubric entirely. Use as a lookup table in Pass 1 of Design phase.
>
> **CRITICAL:** If a resource type appears in any table below, use the mapping directly. Do NOT proceed to Pass 2 rubric evaluation. This is not optional guidance — it is an authoritative lookup.

---

## Purpose

Fast-path mappings are 100% deterministic mappings with **zero viable alternatives** and **no config-dependent conditions**. They encode domain knowledge that doesn't change:

- Single candidate (no alternatives to evaluate)
- No eliminator rules apply (service limits don't matter)
- Operational model is identical
- No conflicts possible

Example: `google_compute_network` always maps to `aws_vpc`. There is no alternative VPC service on AWS. No rubric needed.

---

## Direct Mappings (Primary)

Unconditional mappings for primary resources. These resolve in Pass 1 without rubric evaluation.

**Usage:** If resource type matches column 1, use mapping in column 2. Set `confidence: "deterministic"`. Add `new_aws_resources` from column 4. Do not proceed to Pass 2.

| GCP Resource Type | AWS Target | Reason | new_aws_resources |
|---|---|---|---|
| `google_compute_network` | `aws_vpc` | Single candidate for VPC abstraction. No alternatives on AWS. Always 1:1. | `[aws_internet_gateway, aws_route_table, aws_route]` |
| `google_compute_subnetwork` | `aws_subnet` | Single candidate for subnet abstraction. Always 1:1. | `[]` |
| `google_storage_bucket` | `aws_s3_bucket` | Single candidate for object storage. Storage class affects S3 tier but destination is always S3. | `[]` |
| `google_compute_firewall` | `aws_security_group` | Single candidate for firewall rules. Always 1:1. | `[]` |
| `google_dns_record_set` | `aws_route53_record` | Single candidate for DNS records. Always 1:1. | `[]` |
| `google_dns_managed_zone` | `aws_route53_zone` | Single candidate for managed DNS zone. Always 1:1. | `[]` |
| `google_sql_database_instance` (PostgreSQL) | `aws_rds_cluster` (Aurora PostgreSQL) | 1:1 mapping; Serverless v2 for dev, Provisioned for prod. | `[aws_rds_cluster_instance]` |
| `google_sql_database_instance` (MySQL) | `aws_rds_cluster` (Aurora MySQL) | 1:1 mapping; Serverless v2 for dev, Provisioned for prod. | `[aws_rds_cluster_instance]` |
| `google_sql_database_instance` (SQL Server) | `aws_db_instance` (SQL Server) | 1:1 mapping; always provisioned (no serverless). | `[]` |
| `google_redis_instance` | `aws_elasticache_replication_group` | 1:1 mapping; preserve cluster mode and node type. | `[aws_elasticache_subnet_group]` |
| `google_service_account` | `aws_iam_role` | 1:1 mapping; map permissions directly, adjust service principals. | `[aws_iam_role_policy]` |

---

## Skip Mappings

Resources that should never be mapped to AWS resources. Record in "Skipped Resources" section of aws-design-report.md.

**Usage:** If resource type matches below, skip it entirely. Do NOT map to AWS. Record reason in report.

| GCP Resource Type | Reason |
|---|---|
| `google_project_service` | API enablement is implicit on AWS. Services are enabled by default. No AWS equivalent needed. |
| `data.google_service_account` | Data source only (read-only). No mapping needed. Use actual service account if created. |
| `null_resource` | Terraform orchestration artifact. Not needed on AWS. |
| `time_sleep` | Terraform orchestration artifact. Not needed on AWS. |

---

## Secondary Behavior Lookups

Determines how secondary resources map **based on what their primary became**.

**Usage (Pass 1):**
1. Primary is resolved (fast-path or rubric)
2. Secondary's `serves` array is checked
3. For each primary the secondary serves, look up behavior in this table
4. If found: apply behavior. If not found: check "Direct Mappings (Secondary)" table

**Format:** If secondary_role matches column 1 AND primary became the AWS service in column 2, apply column 3.

| Secondary Role | Primary Becomes | Behavior | Target | Notes |
|---|---|---|---|---|
| `identity` | `aws_lambda_function` | maps | `aws_iam_role` | Lambda requires explicit IAM role |
| `identity` | `aws_ecs_task_definition` | maps | `aws_iam_role` | ECS task requires explicit IAM role |
| `identity` | `aws_apprunner_service` | maps | `aws_iam_role` | App Runner requires explicit IAM role |
| `identity` | `aws_ec2_instance` | absorbed | `aws_iam_instance_profile` | Instance profile is attached to instance config |
| `identity` | `aws_rds_cluster` | absorbed | (not separate) | RDS uses DB-level authentication |
| `identity` | skip | skip | (not needed) | If primary is skipped, identity not needed |
| `network_path` | `aws_vpc` | absorbed | (not separate) | Subnet, firewall rules absorbed into VPC config |
| `network_path` | `aws_security_group` | absorbed | (not separate) | Rules absorbed into security group config |
| `network_path` | skip | skip | (not needed) | If primary is skipped, network not needed |
| `access_control` | any | maps | `aws_iam_policy_statement` | IAM bindings become policy statements on roles |
| `access_control` | skip | skip | (not needed) | If primary is skipped, access control not needed |
| `configuration` | `aws_rds_db_instance` | absorbed | (db_name, db_user fields) | Database and user absorbed into RDS config |
| `configuration` | `aws_secretsmanager_secret` | absorbed | (secret fields) | Secret versions absorbed into secret config |
| `configuration` | `aws_route53_zone` | absorbed | (record config) | DNS records absorbed into zone config |
| `configuration` | skip | skip | (not needed) | If primary is skipped, configuration not needed |
| `encryption` | any | maps | `aws_kms_key_policy` | KMS permissions referenced in resource policy |
| `encryption` | skip | skip | (not needed) | If primary is skipped, encryption not needed |
| `orchestration` | any | skip | (not needed) | Terraform orchestration not needed on AWS |

---

## Direct Mappings (Secondary)

Mappings for secondary resources that don't depend on what their primary became. Use if not found in "Secondary Behavior Lookups" above.

**Usage (Pass 1):**
1. Secondary not resolved by "Secondary Behavior Lookups"
2. Check this table
3. If secondary type matches column 1: apply mapping in column 2

| GCP Secondary Type | AWS Target | Reason |
|---|---|---|
| `google_kms_crypto_key` | `aws_kms_key` | 1:1 mapping. Always separate resource. |
| `google_kms_key_ring` | (absorbed) | Key ring is metadata on aws_kms_key. Not separate. |
| `google_compute_router_nat` | `aws_nat_gateway` | 1:1 mapping. NAT routing rules absorbed into route table. |
| `google_compute_address` | `aws_eip` (if address_type=EXTERNAL) or `aws_nat_gateway` (if purpose=NAT) | Determined by config (address_type, purpose) — rubric needed if ambiguous. |

---

## Examples

### Example 1: Primary Fast-Path Resolution

**Resource:** `google_storage_bucket.data_lake`

**Pass 1 Evaluation:**
```
Check Direct Mappings (Primary) table:
  google_storage_bucket → aws_s3_bucket ✓ found

Result:
  source: "google_storage_bucket.data_lake"
  target: "aws_s3_bucket"
  confidence: "deterministic"
  reason: "Fast path: Object storage bucket → S3. Single candidate, no alternatives."
  source_config: { "storage_class": "NEARLINE", "lifecycle_rule": "delete after 90 days" }
  related: { "gcp": [], "aws": [] }
  new_aws_resources: []

Do NOT proceed to Pass 2 for this resource.
```

---

### Example 2: Secondary Fast-Path Resolution (After Primary)

**Primary Resolution (from fast-path or rubric):**
```
google_sql_database_instance → aws_rds_db_instance
```

**Secondary:** `google_sql_database.main` (secondary_role: configuration, serves: [google_sql_database_instance.main])

**Pass 1 Evaluation:**
```
Check Secondary Behavior Lookups:
  secondary_role=configuration, primary_becomes=aws_rds_db_instance
  → behavior: absorbed, target: (db_name field)  ✓ found

Result:
  source: "google_sql_database.main"
  target: "(absorbed into aws_rds_db_instance.database_name)"
  confidence: "deterministic"
  reason: "Fast path: Database configuration absorbed. Database name becomes db_name on RDS instance."
  related: { "gcp": ["google_sql_database_instance.main"] }

Do NOT proceed to Pass 2 for this resource.
```

---

### Example 3: Secondary Deferred to Pass 2

**Primary:** `google_cloud_run_service.api` (not in fast-path, needs rubric)

**Secondary:** `google_service_account.app` (secondary_role: identity, serves: [google_cloud_run_service.api])

**Pass 1 Evaluation:**
```
Check Secondary Behavior Lookups:
  secondary_role=identity, primary_becomes=??? (not yet resolved)

Primary not yet resolved. Cannot determine behavior.

Result: Leave secondary for Pass 2.

(After Pass 2 resolves primary to aws_apprunner_service,
 return to secondary in Pass 2 Phase 2)
```

---

### Example 4: Skip Mapping

**Resource:** `google_project_service.run`

**Pass 1 Evaluation:**
```
Check Skip Mappings table:
  google_project_service → skip ✓ found

Result:
  source: "google_project_service.run"
  target: "(skipped)"
  confidence: "deterministic"
  reason: "Fast path skip: API enablement not needed on AWS. Services are enabled by default."
  related: { "gcp": [], "aws": [] }

Note: Add to "Skipped Resources" section of aws-design-report.md

Do NOT proceed to Pass 2 for this resource.
```

---

## Pass 1 Algorithm

**For each resource in cluster (both primary and secondary):**

### Primary Resource

```
1. Is resource_type in "Direct Mappings (Primary)" table?
   YES → Record mapping. Set confidence=deterministic. Add new_aws_resources.
         Mark as RESOLVED. Do not proceed to Pass 2.
   NO  → Continue to step 2.

2. Is resource_type in "Skip Mappings" table?
   YES → Skip resource. Record in skipped list.
         Mark as RESOLVED. Do not proceed to Pass 2.
   NO  → Leave for Pass 2 (rubric evaluation)
```

### Secondary Resource

```
1. Are ALL primaries in secondary.serves[] already resolved?
   NO  → Leave for Pass 2 (wait for primaries)
   YES → Continue to step 2.

2. For each primary served:
   Check "Secondary Behavior Lookups" for (secondary_role, primary_became):
   FOUND → Record behavior. Mark secondary as RESOLVED. Do not proceed to Pass 2.
   NOT FOUND → Continue to step 3.

3. Is secondary_type in "Direct Mappings (Secondary)" table?
   YES → Record mapping. Mark as RESOLVED. Do not proceed to Pass 2.
   NO  → Leave for Pass 2 (rubric evaluation needed)
```

---

## After Pass 1

**If ALL resources resolved by Pass 1:**
- Write cluster block to aws-design.json
- Add all new_aws_resources to cluster's new_aws_resources array
- Update metadata: `resolved_by_fast_path` += count
- Move to next cluster (skip Pass 2 entirely)

**If ANY resources unresolved:**
- Record Pass 1 results (mapped, skipped, absorbed)
- Proceed to Pass 2 (rubric) for remaining resources
- Use Pass 1 results as context for Pass 2 evaluation

---

## Maintenance Notes

**Adding new fast-path mappings:**

1. Ensure mapping is **100% unconditional** (no config-dependent logic)
2. Verify **no viable alternative** exists on AWS
3. Include **clear reasoning** for why there's no ambiguity
4. Test with sample resources before committing

**Example (good candidate for fast-path):**
```
google_compute_instance → aws_ec2_instance
Reason: Single candidate. No serverless alternative for fixed VMs.
No config field changes this decision.
```

**Example (NOT a fast-path candidate):**
```
google_cloud_run_service → ??? (could be Lambda, App Runner, or ECS)
Reason: Timeout, memory, concurrency, GPU support, and scale behavior
determine candidate. Config-dependent. Needs rubric.
```

---

## Related Files

- `design.md` — Pass 1 (fast-path) and Pass 2 (rubric) algorithm
- `design-ref-index.md` — Lookup for which design-ref file contains resource
- `design-ref-compute.md` — Rubric rules for compute resources
- `design-ref-database.md` — Rubric rules for database resources
- `design-ref-networking.md` — Rubric rules for networking resources
- `design-ref-storage.md` — Rubric rules for storage resources
- `design-ref-messaging.md` — Rubric rules for messaging resources
- `design-ref-ai.md` — Rubric rules for AI/ML resources

---

**Last Updated:** 2026-02-24
**Status:** Active (Production)

## Design Ref Index

# GCP Service → Design Reference Mapping

## Compute Services

| GCP Service         | Resource Type                    | Reference File | Fast-Path          |
| ------------------- | -------------------------------- | -------------- | ------------------ |
| Cloud Run           | `google_cloud_run_service`       | `compute.md`   | Fargate            |
| Cloud Functions     | `google_cloudfunctions_function` | `compute.md`   | Lambda             |
| Compute Engine (VM) | `google_compute_instance`        | `compute.md`   | EC2 or Fargate     |
| GKE                 | `google_container_cluster`       | `compute.md`   | EKS                |
| App Engine          | `google_app_engine_application`  | `compute.md`   | Fargate or Amplify |

## Database Services

| GCP Service            | Resource Type                  | Reference File | Fast-Path             |
| ---------------------- | ------------------------------ | -------------- | --------------------- |
| Cloud SQL (PostgreSQL) | `google_sql_database_instance` | `database.md`  | RDS Aurora PostgreSQL |
| Cloud SQL (MySQL)      | `google_sql_database_instance` | `database.md`  | RDS Aurora MySQL      |
| Cloud SQL (SQL Server) | `google_sql_database_instance` | `database.md`  | RDS SQL Server        |
| Firestore (instance)   | `google_firestore_database`    | `database.md`  | DynamoDB              |
| Firestore (document)   | `google_firestore_document`    | `database.md`  | DynamoDB              |
| BigQuery               | `google_bigquery_dataset`      | `database.md`  | Redshift or Athena    |
| Memorystore (Redis)    | `google_redis_instance`        | `database.md`  | ElastiCache Redis     |
| Cloud Spanner          | `google_spanner_instance`      | `database.md`  | Aurora DSQL           |

## Storage Services

| GCP Service         | Resource Type           | Reference File | Fast-Path |
| ------------------- | ----------------------- | -------------- | --------- |
| Cloud Storage (GCS) | `google_storage_bucket`   | `storage.md`   | S3        |
| Filestore           | `google_filestore_instance` | `storage.md`   | EFS       |

## Networking Services

| GCP Service          | Resource Type                     | Reference File  | Fast-Path          |
| -------------------- | --------------------------------- | --------------- | ------------------ |
| VPC Network          | `google_compute_network`          | `networking.md` | VPC                |
| Firewall Rules       | `google_compute_firewall`         | `networking.md` | Security Groups    |
| Cloud Load Balancing | `google_compute_forwarding_rule`  | `networking.md` | ALB/NLB            |
| Cloud CDN            | (part of compute_backend_service) | `networking.md` | CloudFront         |
| Cloud DNS            | `google_dns_managed_zone`         | `networking.md` | Route 53           |
| Cloud Interconnect   | (custom config)                   | `networking.md` | AWS Direct Connect |
| Cloud Armor          | `google_compute_security_policy`  | `networking.md` | AWS WAF            |

## Messaging Services

| GCP Service | Resource Type              | Reference File | Fast-Path          |
| ----------- | -------------------------- | -------------- | ------------------ |
| Pub/Sub     | `google_pubsub_topic`      | `messaging.md` | SNS or SQS         |
| Cloud Tasks | `google_cloud_tasks_queue` | `messaging.md` | SQS or EventBridge |

## AI/ML Services

| GCP Service                | Resource Type       | Reference File            | Fast-Path               |
| -------------------------- | ------------------- | ------------------------- | ----------------------- |
| Vertex AI (LLM/Gemini)     | (generative models) | `ai-gemini-to-bedrock.md` | Bedrock                 |
| OpenAI (in GCP env)        | (openai SDK)        | `ai-openai-to-bedrock.md` | Bedrock                 |
| Vertex AI (traditional ML) | (custom endpoints)  | `ai.md`                   | SageMaker               |
| Vertex AI (pipelines)      | (custom config)     | `ai.md`                   | SageMaker Pipelines     |
| Cloud Vision API           | (managed API)       | `ai.md`                   | Textract or Rekognition |

## Secondary/Infrastructure Services

| GCP Service      | Resource Type            | Reference File    | Fast-Path  |
| ---------------- | ------------------------ | ----------------- | ---------- |
| Service Accounts | `google_service_account` | `networking.md`   | IAM Roles  |
| Cloud Monitoring | (managed)                | Not in v1.0 scope | CloudWatch |

---

**Usage:**

1. Extract GCP resource type from Terraform
2. Find in table above
3. If resource found in `fast-path.md` Direct Mappings table: use that mapping (confidence = deterministic)
4. Otherwise: load Reference File listed above and apply 6-criteria rubric (confidence = inferred)

## Design Ref Messaging

# Messaging Mappings

## google_pubsub_topic

**Purpose:** Pub/Sub message topic for publish-subscribe patterns

**Default:** aws_sns_topic + aws_sqs_queue (SNS+SQS)

**Rationale for default:** SNS+SQS is the most flexible AWS messaging pattern. It supports both fan-out and queuing, covering the full range of Pub/Sub usage patterns.

**Candidates:**
- aws_sns_topic (SNS only)
- aws_sqs_queue (SQS only)
- aws_sns_topic + aws_sqs_queue (SNS+SQS combo)

**Signals:**

| Config Field | Value | Favors | Weight | Reason |
|---|---|---|---|---|
| All subscriptions are push | true | aws_sns_topic | strong | Push delivery aligns with SNS model |
| All subscriptions are pull | true | aws_sqs_queue | strong | Pull/polling aligns with SQS model |
| Mix of push and pull | true | aws_sns_topic + aws_sqs_queue | strong | SNS for fan-out, SQS for pull consumers |
| Multiple subscriptions | true | aws_sns_topic | moderate | Fan-out pattern is SNS's strength |
| Single subscription, pull | true | aws_sqs_queue | strong | No fan-out needed, SQS is simpler |
| Subscription has filter | present | aws_sns_topic | moderate | SNS supports subscription filter policies |

**Eliminators:** None — all candidates work for any Pub/Sub config, they differ in fit.

**Peek at secondaries:** Yes — must look at google_pubsub_subscription resources that serve this topic.

**How to peek:**
1. Find all secondaries where `serves` includes this topic's address
2. Filter to type `google_pubsub_subscription`
3. Check each subscription's config for: push_endpoint (push) vs subscription_type: pull
4. Check for dead_letter_topic, filter, ack_deadline_seconds

**Decision logic:**
1. If all subscriptions have push_endpoint → SNS only
2. If all subscriptions are pull with single subscriber → SQS only
3. If multiple subscribers or mix of push/pull → SNS + SQS
4. If no subscriptions found → default to SNS + SQS

**1:Many Expansion:**

If SNS only:
- aws_sns_topic — primary
- aws_sns_topic_subscription — one per push subscription

If SQS only:
- aws_sqs_queue — primary
- aws_sqs_queue (DLQ) — if dead_letter_topic is configured on any subscription

If SNS + SQS:
- aws_sns_topic — fan-out
- aws_sqs_queue — one per pull subscription
- aws_sns_topic_subscription — to connect SQS queues to SNS topic
- aws_sqs_queue (DLQ) — if dead_letter_topic is configured

**Source Config to Carry Forward:**
- message_retention_duration — determines message retention (SQS: MessageRetentionPeriod, SNS: N/A)
- name — determines resource naming

**Important:** SNS does not support message retention. Messages are delivered immediately and not stored. If message retention is required, use SQS (which supports 1-14 day retention via MessageRetentionPeriod). Do not set message_retention on SNS resources.

**Subscription config to carry forward (from secondaries):**
- ack_deadline_seconds — determines SQS VisibilityTimeout
- message_retention_duration — determines SQS MessageRetentionPeriod
- dead_letter_topic — determines DLQ configuration and maxReceiveCount
- max_delivery_attempts — determines SQS maxReceiveCount on redrive policy
- push_endpoint — determines SNS subscription endpoint
- filter — determines SNS subscription filter policy
- retry_minimum_backoff / retry_maximum_backoff — determines SQS retry behavior

---

## google_pubsub_topic (dead letter)

**Behavior:** A Pub/Sub topic used as a dead letter destination maps differently from a regular topic. It becomes:
- aws_sqs_queue with purpose "dead-letter" if the parent subscription maps to SQS
- aws_sns_topic with purpose "dead-letter" if the parent subscription maps to SNS

Detect by checking if this topic is referenced in any subscription's `dead_letter_topic` field. If so, it does not get its own independent mapping — it's created as part of the parent topic's 1:many expansion.

---

## Secondary: google_pubsub_subscription

**Note:** Subscriptions are classified as secondaries in Pillar 1 but play a special role in Pillar 2. Their config drives the primary topic's mapping decision (push vs pull). After the topic is mapped, subscriptions map as follows:

- If topic mapped to SNS → push subscription becomes aws_sns_topic_subscription
- If topic mapped to SQS → pull subscription is absorbed into SQS config (SQS is inherently pull)
- If topic mapped to SNS+SQS → push subscriptions become SNS subscriptions, pull subscriptions become SQS queues subscribed to SNS

---

## Secondary: google_service_account (pubsub_invoker)

**Behavior:** The pubsub_invoker service account is a GCP-specific pattern for authenticating Pub/Sub push deliveries to Cloud Run. On AWS:
- If using SNS → push to HTTP endpoint, SNS handles delivery natively, no separate identity needed
- If target is Lambda → SNS invokes Lambda directly via aws_lambda_permission, no separate identity
- If target is ECS/App Runner → SNS pushes to HTTPS endpoint, authentication handled differently

This service account typically maps to nothing on AWS. Skip with reason.

---

## google_cloud_tasks_queue

**Purpose:** Task queue for asynchronous HTTP callback execution with rate limiting and retry logic

**Default:** SQS + Lambda (or EventBridge for scheduled tasks)

**Rationale for default:** Cloud Tasks is a rate-limited, retryable task queue — SQS provides equivalent queueing with dead-letter support. EventBridge handles scheduling patterns that Cloud Tasks also supports.

**Candidates:**
- SQS Standard + Lambda — for HTTP callback pattern with retry
- SQS FIFO + Lambda — if ordering matters
- EventBridge + SNS/SQS — for scheduled/delayed task execution

**Signals:**

| Signal | Favors | Weight | Reason |
|---|---|---|---|
| HTTP target tasks (push to URL) | SQS + Lambda | strong | Lambda invoked by SQS, calls target URL |
| Rate limiting configured | SQS + Lambda (with concurrency) | moderate | Lambda reserved concurrency acts as rate limiter |
| Scheduled task execution | EventBridge + SQS | strong | EventBridge handles cron/rate-based scheduling |
| Ordered delivery required | SQS FIFO | strong | FIFO guarantees ordering |

**1:Many Expansion:**
- aws_sqs_queue
- aws_lambda_function (processor)
- aws_lambda_event_source_mapping
- aws_sqs_queue (dead-letter, if retry config present)

## Design Ref Networking

# Networking Mappings

## google_compute_network

**Purpose:** Virtual private cloud network

**Default:** aws_vpc (VPC)

**Candidates:**
- aws_vpc

**Signals:** None — direct 1:1 mapping.

**Eliminators:** None

**Peek at secondaries:** No

**1:Many Expansion:**

A GCP VPC always expands to multiple AWS resources:
- aws_vpc — primary
- aws_internet_gateway — GCP VPCs have implicit internet access, AWS requires explicit IGW
- aws_route_table — at least one for public subnets
- aws_route — default route to IGW

**Note on subnets:** GCP VPC subnets are separate resources (google_compute_subnetwork). On AWS, you typically need subnets in at least 2 AZs for services like RDS and ECS. The number of AWS subnets may exceed the number of GCP subnets. This is handled in the secondary mapping for google_compute_subnetwork.

**Source Config to Carry Forward:**
- name — determines VPC name (becomes VPC tag or resource identifier)
- auto_create_subnetworks — if true, GCP auto-creates subnets in every region. AWS doesn't have this concept; subnets must be explicit.
- routing_mode — REGIONAL is standard (AWS VPCs are regional by nature). GLOBAL has no AWS equivalent.

---

## google_compute_subnetwork

**Purpose:** Subnet within a VPC network

**Default:** aws_subnet

**Candidates:**
- aws_subnet

**Signals:** None — direct 1:1 mapping.

**Eliminators:** None

**Peek at secondaries:** No

**1:Many Expansion:**
- aws_subnet — primary
- aws_route_table — if custom routes defined
- aws_network_acl — if custom access control needed

**Source Config to Carry Forward:**
- name — determines subnet name
- ip_cidr_range — determines CIDR block
- region — determines AWS region (mapped from GCP region)
- network — determines VPC association (resolved from google_compute_network mapping)
- private_ip_google_access — determines DNS hostname type
- log_config — determines VPC Flow Logs configuration

---

## google_compute_address (Static IP)

**Purpose:** Static external IP address

**Default:** aws_eip (Elastic IP) or aws_internet_gateway (if network-level)

**Candidates:**
- aws_eip — for instance-level static IP
- aws_internet_gateway — for network NAT

**Signals:**

| Config Field | Value | Favors | Weight | Reason |
|---|---|---|---|---|
| address_type | INTERNAL | aws_network_interface | moderate | Internal static IP |
| address_type | EXTERNAL | aws_eip | strong | External static IP |
| purpose | NAT | aws_nat_gateway | strong | NAT gateway for outbound NAT |
| purpose | GCE_ENDPOINT | aws_network_interface | moderate | Instance endpoint |
| network_tier | PREMIUM | aws_eip | moderate | Premium tier maps to standard EIP |
| network_tier | STANDARD | aws_eip | weak | Standard tier may have performance implications |

**Eliminators:** None

**Peek at secondaries:** No

**1:Many Expansion (EIP):**
- aws_eip — primary
- aws_eip_association — if associated to instance

**1:Many Expansion (NAT Gateway):**
- aws_nat_gateway — primary
- aws_eip — elastic IP for NAT gateway
- aws_route — for NAT routing

**Source Config to Carry Forward:**
- address_type — determines EIP or NAT gateway type
- region — determines AWS region
- network — determines VPC (resolved from google_compute_network mapping)

---

## google_compute_forwarding_rule (Load Balancer)

**Purpose:** Load balancing and traffic forwarding

**Default:** aws_lb (Load Balancer) - ALB or NLB depending on protocol

**Candidates:**
- aws_lb with type = "application" (ALB for HTTP/HTTPS)
- aws_lb with type = "network" (NLB for TCP/UDP)

**Signals:**

| Config Field | Value | Favors | Weight | Reason |
|---|---|---|---|---|
| load_balancing_scheme | EXTERNAL | aws_lb | strong | Public load balancer |
| load_balancing_scheme | INTERNAL | aws_lb with internal=true | moderate | Internal load balancer |
| ip_protocol | TCP | aws_lb type network | strong | NLB for TCP |
| ip_protocol | UDP | aws_lb type network | strong | NLB for UDP |
| ip_protocol | HTTP | aws_lb type application | strong | ALB for HTTP |
| ip_protocol | HTTPS | aws_lb type application | strong | ALB for HTTPS |
| ports | 80, 443 | aws_lb type application | strong | ALB for web traffic |
| ports | 3306, 5432 | aws_lb type network | strong | NLB for database traffic |
| all_ports | true | aws_lb type network | strong | NLB for all ports (passthrough) |

**Eliminators:** None

**Peek at secondaries:** Yes — must check google_backend_service and google_target_pool resources

**1:Many Expansion (ALB - Application Load Balancer):**
- aws_lb with type = "application"
- aws_lb_listener — one per port/protocol
- aws_lb_target_group — one per backend service
- aws_lb_listener_rule — for path/host-based routing
- aws_security_group — for ALB ingress rules

**1:Many Expansion (NLB - Network Load Balancer):**
- aws_lb with type = "network"
- aws_lb_listener — one per port/protocol
- aws_lb_target_group — one per backend service
- aws_security_group — for NLB ingress rules (if using security groups)

**Source Config to Carry Forward:**
- name — determines load balancer name
- ip_protocol — determines ALB vs NLB
- ports — determines listener ports
- load_balancing_scheme — determines internal vs external
- region — determines AWS region
- network / subnetwork — determines VPC and subnet placement

---

## Secondary: google_compute_subnetwork

**Behavior:** Subnets are network_path secondaries that define which subnets exist within a VPC. Each subnet maps to an AWS subnet.

**Mapping Behavior:**

When google_compute_network maps to:
- aws_vpc → Each google_compute_subnetwork becomes a separate aws_subnet

**Implementation Notes:**
1. GCP subnet CIDR range carries forward to aws_subnet cidr_block
2. GCP subnet region determines AWS availability zone (may need adjustment for multi-AZ)
3. Each subnet gets a route table association
4. **Important:** AWS typically requires subnets in at least 2 AZs for HA services (RDS, ECS)
   - If GCP has 1 subnet, create 2-3 AWS subnets across AZs
   - This may result in MORE AWS subnets than GCP subnets
5. Private IP Google Access (GCP) → DNS hostname type on AWS subnet
6. VPC Flow Logs configuration → aws_flow_log resource

**Skip Condition:**
If the primary google_compute_network is skipped, skip these secondaries. However, AWS requires at least one subnet, so plan accordingly.

---

## Secondary: google_compute_firewall

**Behavior:** Firewalls are network_path secondaries that define network access control rules. They map to AWS security groups.

**Mapping Behavior:**

When firewall serves compute resource:
- Firewall rules become aws_security_group with ingress/egress rules attached to compute resources

When firewall serves network resource:
- Becomes aws_security_group that can be referenced by multiple compute resources

**Rule Translation:**
- GCP firewall `allow` rules → aws_security_group ingress rules
- GCP firewall `deny` rules → aws_security_group deny rules (or use separate deny policy)
- GCP firewall `sourceRanges` → security group CIDR blocks
- GCP firewall `targetTags` → security group resource associations (EC2 tags)
- GCP firewall ports/protocols → security group port/protocol specifications

**Implementation Notes:**
1. Firewall direction (ingress/egress) must be explicitly set in AWS security groups
2. GCP has implicit default allow; AWS is implicit deny
3. Stateful rules: GCP firewalls are stateful, AWS security groups are stateful
4. Named ranges and service accounts in rules must be expanded to actual IPs/IDs
5. Multiple rules may need to be combined into single security group

**Skip Condition:**
If the primary compute resource is skipped, firewall rules can be skipped. Otherwise, create security group for access control.

---

## Cloud Interconnect

**Purpose:** Dedicated/partner connectivity between on-premises and cloud

**Default:** AWS Direct Connect

**Rationale for default:** Direct Connect is the 1:1 equivalent for dedicated enterprise connectivity. For development or temporary migration needs, Site-to-Site VPN is a faster, lower-cost alternative.

**Candidates:**
- AWS Direct Connect — dedicated connection, lowest latency, highest bandwidth
- AWS Site-to-Site VPN — encrypted tunnel over public internet, quicker setup

**Signals:**

| Signal | Favors | Weight | Reason |
|---|---|---|---|
| Dedicated interconnect (10/100 Gbps) | Direct Connect | strong | Requires dedicated fiber; 6+ months setup |
| Partner interconnect | Direct Connect (hosted) | moderate | Partner-facilitated, faster setup |
| Development/temporary connectivity | Site-to-Site VPN | strong | Quicker, lower cost, sufficient for migration |
| Compliance (PCI, HIPAA, FedRAMP) | Direct Connect | strong | Explicit data path required |

**Migration Notes:**
- Direct Connect requires physical provisioning (plan 2-6 months lead time)
- During migration, use Site-to-Site VPN as temporary bridge
- BGP configuration must be adapted from GCP Cloud Router to AWS VGW/TGW

## Design Ref Storage

# Storage Services Design Rubric

**Applies to:** Cloud Storage (GCS), Filestore

**Quick lookup (no rubric):** Check `fast-path.md` first (Cloud Storage → S3, deterministic)

## Deterministic Mapping

**Cloud Storage (`google_storage_bucket`) → S3 (`aws_s3_bucket`)**

Confidence: `deterministic` (always 1:1, no decision tree)

**Behavior preservation:**

- Bucket versioning → S3 versioning
- Lifecycle rules → S3 Lifecycle policies
- Access control (UNIFORM vs FINE-GRAINED) → S3 ACLs + Bucket Policies
- Regional location → S3 region selection
- Encryption (default or CSEK) → S3 encryption (default AES-256 or KMS)

## GCS → S3 Attribute Mapping

| GCS Attribute                 | S3 Equivalent                               | Notes                                        |
| ----------------------------- | ------------------------------------------- | -------------------------------------------- |
| `location` (region)           | `region`                                    | Direct mapping; respect user's region choice |
| `versioning_enabled`          | `versioning_enabled`                        | 1:1 copy                                     |
| `lifecycle_rules`             | `lifecycle_rule`                            | Adapt rule conditions                        |
| `uniform_bucket_level_access` | `block_public_acl` + policies               | Convert UNIFORM to S3 ACL block              |
| `encryption` (CSEK)           | `sse_algorithm = "aws:kms"`                 | Use AWS KMS (customer-managed key)           |
| `cors`                        | `cors_rule`                                 | 1:1 copy                                     |
| `retention_policy`            | `object_lock_configuration` (if applicable) | Object Lock stricter than GCS retention      |

## Output Schema

```json
{
  "gcp_type": "google_storage_bucket",
  "gcp_address": "my-app-assets",
  "gcp_config": {
    "location": "us-central1",
    "versioning_enabled": true,
    "lifecycle_rule": [
      {
        "action": "Delete",
        "condition": { "age_days": 90 }
      }
    ]
  },
  "aws_service": "S3",
  "aws_config": {
    "bucket": "my-app-assets-us-east-1",
    "versioning_enabled": true,
    "lifecycle_rule": [
      {
        "id": "delete-old-versions",
        "status": "Enabled",
        "noncurrent_version_expiration": { "days": 90 }
      }
    ],
    "region": "us-east-1"
  },
  "confidence": "deterministic",
  "rationale": "GCS → S3 is 1:1 deterministic; preserve versioning, lifecycle, encryption"
}
```

## Filestore → EFS

**Filestore (`google_filestore_instance`) → EFS (`aws_efs_file_system`)**

Confidence: `deterministic` (both managed NFS, 1:1 mapping)

**Behavior preservation:**

- Managed NFS file system → Managed NFS file system
- Performance tier selection → EFS throughput mode
- Network-attached storage → VPC mount targets
- Shared file access across instances → Shared file access across instances

### Filestore → EFS Attribute Mapping

| Filestore Attribute       | EFS Equivalent                            | Notes                                                    |
| ------------------------- | ----------------------------------------- | -------------------------------------------------------- |
| `tier` (STANDARD)         | `throughput_mode = "bursting"`            | Standard performance maps to bursting throughput          |
| `tier` (PREMIUM)          | `throughput_mode = "provisioned"`         | Premium performance maps to provisioned throughput        |
| `tier` (ENTERPRISE)       | `throughput_mode = "provisioned"`         | Enterprise maps to provisioned with higher IOPS          |
| `capacity_gb`             | (no direct equivalent — EFS auto-scales)  | EFS grows/shrinks automatically; no pre-provisioned size |
| `networks[].network`      | `aws_efs_mount_target.subnet_id`          | Mount target placed in mapped VPC subnet                 |
| `file_shares[].name`      | Mount target path                         | Share name becomes mount path convention                 |
| `file_shares[].capacity`  | (no direct equivalent)                    | EFS has no capacity limits per share                     |

### Filestore → EFS Output Schema

```json
{
  "gcp_type": "google_filestore_instance",
  "gcp_address": "my-app-nfs",
  "gcp_config": {
    "tier": "STANDARD",
    "file_shares": [
      {
        "name": "vol1",
        "capacity_gb": 1024
      }
    ],
    "networks": [
      {
        "network": "projects/my-project/global/networks/my-vpc",
        "modes": ["MODE_IPV4"]
      }
    ]
  },
  "aws_service": "EFS",
  "aws_config": {
    "creation_token": "my-app-nfs",
    "throughput_mode": "bursting",
    "performance_mode": "generalPurpose",
    "encrypted": true,
    "mount_targets": [
      {
        "subnet_id": "subnet-xxx",
        "security_groups": ["sg-xxx"]
      }
    ]
  },
  "confidence": "deterministic",
  "rationale": "Filestore → EFS is 1:1 deterministic; both are managed NFS. EFS auto-scales (no capacity_gb equivalent)."
}
```

## Notes

Cloud Storage and Filestore have direct AWS equivalents with no decision tree required. All mappings are deterministic.

For non-storage use cases (static site hosting, data lakes, etc.), the hosting compute service (Fargate, Amplify) determines architecture, not the bucket itself.

## Design

# Phase 3: Design AWS Architecture (Orchestrator)

**Execute ALL steps in order. Do not skip or optimize.**

## Prerequisites

Read `$MIGRATION_DIR/preferences.json`. If missing: **STOP**. Output: "Phase 2 (Clarify) not completed. Run Phase 2 first."

Check which discovery artifacts exist in `$MIGRATION_DIR/`:

- `gcp-resource-inventory.json` (IaC discovery ran)
- `gcp-resource-clusters.json` (IaC discovery ran)
- `billing-profile.json` (billing discovery ran)
- `ai-workload-profile.json` (AI workloads detected)

If **none** of these artifacts exist: **STOP**. Output: "No discovery artifacts found. Run Phase 1 (Discover) first."

## Routing Rules

### Infrastructure Design (IaC-based)

IF `gcp-resource-inventory.json` AND `gcp-resource-clusters.json` both exist:

→ Load `design-infra.md`

Produces: `aws-design.json`

### Billing-Only Design (fallback)

IF `billing-profile.json` exists AND `gcp-resource-inventory.json` does **NOT** exist:

→ Load `design-billing.md`

Produces: `aws-design-billing.json`

### AI Workload Design

IF `ai-workload-profile.json` exists:

→ Load `design-ai.md`

Produces: `aws-design-ai.json`

### Mutual Exclusion

- **design-infra** and **design-billing** never both run (billing-only is the fallback when no IaC exists).
- **design-ai** runs independently of either design-infra or design-billing (no shared state). Run it after the infra/billing design completes.

## Phase Completion

After all applicable sub-designs finish, use the Phase Status Update Protocol (Write tool) to write `.phase-status.json` with `phases.design` set to `"completed"` — **in the same turn** as the output message below.

Output to user: "AWS Architecture designed. Proceeding to Phase 4: Estimate Costs."

## Reference Files

Sub-design files may reference rubrics in `steering/`:

- `steering/design-ref-index.md` — GCP type → rubric file lookup
- `steering/design-ref-fast-path.md` — Deterministic 1:1 GCP→AWS mappings
- `steering/design-ref-compute.md` — Compute service rubric
- `steering/design-ref-database.md` — Database service rubric
- `steering/design-ref-storage.md` — Storage service rubric
- `steering/design-ref-networking.md` — Networking service rubric
- `steering/design-ref-messaging.md` — Messaging service rubric
- `steering/design-ref-ai.md` — AI/ML service rubric

## Scope Boundary

**This phase covers architecture mapping ONLY.**

FORBIDDEN — Do NOT include ANY of:

- Cost calculations or pricing estimates
- Execution timelines or migration schedules
- Terraform or IaC code generation
- Risk assessments or rollback procedures
- Team staffing or resource allocation

**Your ONLY job: Map GCP resources to AWS services. Nothing else.**

## Discover App Code

# Discover Phase: App Code Discovery

> Self-contained application code discovery sub-file. Scans for source code, detects GCP SDK imports, infers resources, flags AI signals, and if AI confidence >= 70%, extracts detailed AI workload information and generates `ai-workload-profile.json`.
> If no source code files are found, exits cleanly with no output.

**Dead-end handling:** If this file exits without producing artifacts (no source code found, or AI confidence < 70%), report to the parent orchestrator: what signals were found (if any), the confidence level, and that the user should provide Terraform files or billing exports to proceed with migration planning.

**Execute ALL steps in order. Do not skip or optimize.**

---

## Step 0: Self-Scan for Source Code

Recursively scan the entire target directory tree for source code and dependency manifests:

**Source code:**

- `**/*.py` (Python)
- `**/*.js`, `**/*.ts`, `**/*.jsx`, `**/*.tsx` (JavaScript/TypeScript)
- `**/*.go` (Go)
- `**/*.java` (Java)
- `**/*.scala`, `**/*.kt`, `**/*.rs` (Other)

**Dependency manifests:**

- `requirements.txt`, `setup.py`, `pyproject.toml`, `Pipfile` (Python)
- `package.json`, `package-lock.json`, `yarn.lock` (JavaScript)
- `go.mod`, `go.sum` (Go)
- `pom.xml`, `build.gradle` (Java)

**Exit gate:** If NO source code files or dependency manifests are found, **exit cleanly**. Return no output artifacts. Other sub-discovery files may still produce artifacts.

---

## Step 1: Detect GCP SDK Imports

Scan source files for GCP service imports:

- `google.cloud` (Python: `from google.cloud import ...`)
- `@google-cloud/` (JS/TS: `import ... from '@google-cloud/...'`)
- `cloud.google.com/go` (Go: `import "cloud.google.com/go/..."`)
- `com.google.cloud` (Java: `import com.google.cloud.*`)

For each import found, record:

- `file_path` — Source file containing the import
- `import_statement` — The actual import line
- `inferred_gcp_service` — Which GCP service this maps to
- `confidence` — 0.60-0.80 (lower than IaC since we're inferring from code, not reading config)

---

## Step 2: Infer Resources from Code

Map SDK imports to likely GCP resources. These are inferred — they supplement IaC evidence but at lower confidence:

| Import pattern               | Inferred GCP resource |
| ---------------------------- | --------------------- |
| `google.cloud.storage`       | Cloud Storage bucket  |
| `google.cloud.firestore`     | Firestore database    |
| `google.cloud.pubsub`        | Pub/Sub topic         |
| `google.cloud.bigquery`      | BigQuery dataset      |
| `google.cloud.sql`           | Cloud SQL instance    |
| `google.cloud.run`           | Cloud Run service     |
| `google.cloud.functions`     | Cloud Functions       |
| `google.cloud.secretmanager` | Secret Manager        |
| `redis` / `ioredis`          | Redis instance        |

Confidence for inferred resources: 0.60-0.80 (inferring existence, not reading infrastructure config).

---

## Step 3: Flag AI Signals

Scan source code files and dependency manifests for AI-relevant patterns. For each match, record the pattern, file location, and confidence score.

| Pattern                       | What to look for                                                                                                                                          | Confidence |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 2.1 Google AI Platform SDK    | Imports: `google.cloud.aiplatform` (Python), `@google-cloud/aiplatform` (JS), `cloud.google.com/go/aiplatform` (Go), `com.google.cloud.aiplatform` (Java) | 95%        |
| 2.2 BigQuery ML SDK           | `google.cloud.bigquery` + ML operations; SQL containing `CREATE MODEL` or `ML.*`                                                                          | 85%        |
| 2.3 LLM SDKs (Gemini)         | Imports: `google.generativeai`, `vertexai.generative_models`, Gemini model strings (`gemini-pro`, `gemini-2.5-flash`, etc.)                               | 98%        |
| 2.4 LLM SDKs (OpenAI)         | Imports: `openai`, `from openai import OpenAI`, `client.chat.completions.create()`, model strings (`gpt-4o`, `gpt-4.1`, `o3`, etc.)                       | 98%        |
| 2.5 LLM SDKs (Other)          | Imports: `anthropic`, `cohere`, `mistralai`, other LLM provider SDKs                                                                                      | 98%        |
| 2.6 Document/Vision/Speech AI | Imports: `google.cloud.documentai*`, `google.cloud.vision*`, `google.cloud.speech*`, `google.cloud.translate*`, `google.cloud.dialogflow*`                | 90%        |
| 2.7 Embeddings & RAG          | `langchain` + `VertexAIEmbeddings`; `llama_index` + Vertex AI; vector database usage with embeddings                                                      | 85%        |

Also check dependency manifests for AI/ML SDK dependencies:

- `google-cloud-aiplatform`
- `google-cloud-vertexai`
- `google-cloud-bigquery-ml`
- `google-cloud-language`
- `google-cloud-vision`
- `google-cloud-speech`
- `openai` (OpenAI SDK — many GCP-hosted apps use OpenAI rather than Vertex AI)
- `anthropic` (Anthropic SDK)
- `litellm` (LLM router — indicates gateway usage)
- `langchain`, `langchain-google-vertexai`, `langchain-openai`, `langchain-aws` (orchestration frameworks)

---

## Step 4: AI Detection Gate

Compute overall AI confidence from all signals found in Step 3:

```text
IF (Multiple strong signals: LLM SDK + AI Platform SDK)
  THEN confidence = 95%+ (very high)

IF (Any one strong signal: LLM SDK, AI Platform SDK, Generative AI imports)
  THEN confidence = 90%+ (high)

IF (Weaker signals only: BigQuery ML, variable patterns)
  THEN confidence = 60-70% (medium)

IF (No signals found)
  THEN confidence = 0% (no AI workload detected)
```

### False Positive Checklist

Before finalizing AI detection, verify signals are genuine:

- **BigQuery alone is not AI** — Require `google_bigquery_ml_model` or `CREATE MODEL` SQL. A `google_bigquery_dataset` by itself is standard analytics.
- **Vector database alone is not AI** — Require embeddings library imports (langchain, llama-index). A Firestore/Datastore by itself is a regular database.
- **Dead/commented-out code excluded** — Only count active code.

**Exit gate:** If overall AI confidence < 70%, **exit cleanly**. Do not generate `ai-workload-profile.json`. Report to the parent orchestrator: signals found, confidence level, and reason for not generating the AI profile. The inferred resources from Steps 1-2 remain available for other sub-files (e.g., discover-iac.md may use them for evidence merge). If no other sub-discoverer produces artifacts, the parent orchestrator will inform the user to provide Terraform files or billing exports.

**If confidence >= 70%**, continue to Steps 5-8 below.

---

## Step 5: Extract AI Model Details

For each AI signal found during detection, extract model-level details:

**From application code:**

Scan files that contained AI signals for specific model information:

- **Model identifiers** — Look for model name strings passed to constructors or API calls:

  **Gemini/Vertex AI patterns:**
  - `GenerativeModel("gemini-pro")` -> model_id: `"gemini-pro"`
  - `aiplatform.Model.list(filter='display_name="my-model"')` -> model_id: `"my-model"`
  - `TextEmbeddingModel.from_pretrained("text-embedding-004")` -> model_id: `"text-embedding-004"`

  **OpenAI patterns:**
  - `client.chat.completions.create(model="gpt-4o")` -> model_id: `"gpt-4o"`
  - `openai.ChatCompletion.create(model="gpt-4")` -> model_id: `"gpt-4"` (legacy API)
  - `client.embeddings.create(model="text-embedding-3-small")` -> model_id: `"text-embedding-3-small"`
  - Model strings in config files or environment variables: `OPENAI_MODEL`, `MODEL_NAME`, etc.
  - Look for model string patterns: `gpt-*`, `o1*`, `o3*`, `o4*`, `text-embedding-*`, `dall-e-*`, `whisper-*`, `tts-*`

  **Other provider patterns:**
  - `anthropic.Anthropic().messages.create(model="claude-*")` -> model_id: `"claude-*"`

- **Capabilities used** — Determine from API calls and method signatures:
  - `text_generation`: `generate_content()`, `predict()`, `messages.create()`, `chat.completions.create()`
  - `streaming`: `generate_content(stream=True)`, `stream()`, `stream=True` in OpenAI calls, async iterators
  - `function_calling`: `tools=` parameter, `function_declarations=`, `functions=` (OpenAI legacy), tool definitions
  - `vision`: image bytes, image URLs, or multimodal content passed as input
  - `embeddings`: `TextEmbeddingModel`, `VertexAIEmbeddings`, `client.embeddings.create()`, embedding API calls
  - `batch_processing`: batch predict calls, bulk processing patterns
  - `json_mode`: `response_format={"type": "json_object"}` (OpenAI), structured output schemas
  - `image_generation`: `client.images.generate()` (DALL-E), Imagen API calls
  - `speech_to_text`: `client.audio.transcriptions.create()` (Whisper)
  - `text_to_speech`: `client.audio.speech.create()` (TTS)

- **Usage context** — Infer from the combination of:
  - File path and module name (e.g., `src/search/indexer.py` -> search/indexing)
  - Class and function names (e.g., `RecommendationEngine.get_recommendations` -> recommendations)
  - Import statements (e.g., `from langchain.embeddings` -> embeddings/RAG)
  - Surrounding code context (what data flows in and out of the AI call)

**From Terraform (if IaC discovery also ran):**

- Vertex AI endpoint configurations (display name, location, machine type)
- Model deployment settings (traffic split, scaling)
- Resource addresses for cross-referencing with code

**From billing data (if billing discovery also ran):**

- Which AI services have billing line items
- Monthly spend per AI service

---

## Step 6: Map Integration Patterns

Determine how the application integrates with AI services:

- **Primary SDK**: Which Google AI SDK is used
  - `google-cloud-aiplatform` (Vertex AI Platform SDK)
  - `google-generativeai` (Gemini API)
  - `vertexai` (Vertex AI SDK for Python)
  - `@google-cloud/aiplatform` (Node.js)
  - `cloud.google.com/go/aiplatform` (Go)

- **SDK version**: Extract from dependency files (`requirements.txt`, `package.json`, `go.mod`, etc.)

- **Frameworks**: Does the code use orchestration frameworks?
  - LangChain (`from langchain...`)
  - LlamaIndex (`from llama_index...`)
  - Semantic Kernel
  - No framework (raw SDK calls)

- **Languages**: Which programming languages contain AI code?

- **Integration pattern**: Classify as one of:
  - `direct_sdk` — Direct Google SDK calls (e.g., `aiplatform.init()`, `model.predict()`) or OpenAI SDK calls
  - `framework` — Via LangChain, LlamaIndex, or similar
  - `rest_api` — Raw HTTP calls to Vertex AI or OpenAI endpoints
  - `mixed` — Combination of the above

- **Gateway/router type** (`gateway_type`): Detect whether AI calls go through a gateway, router, or framework. This critically affects migration effort (gateway users can migrate in 1-3 days vs 1-3 weeks for direct SDK).

  Scan for these patterns and classify:

  | Pattern                                                      | Gateway Type     | Evidence                           |
  | ------------------------------------------------------------ | ---------------- | ---------------------------------- |
  | `from litellm import completion` / `litellm` in dependencies | `llm_router`     | LiteLLM — multi-provider router    |
  | `base_url` containing `openrouter.ai`                        | `llm_router`     | OpenRouter — multi-provider router |
  | `portkey` imports or `x-portkey-` headers                    | `llm_router`     | Portkey — AI gateway               |
  | `helicone` imports or `x-helicone-` headers                  | `llm_router`     | Helicone — AI gateway              |
  | Kong, Apigee, or custom API gateway routing to AI endpoints  | `api_gateway`    | API gateway proxying AI calls      |
  | `from vapi_python import Vapi` / Vapi SDK                    | `voice_platform` | Vapi — voice AI platform           |
  | `bland` SDK or Bland.ai API calls                            | `voice_platform` | Bland.ai — voice AI platform       |
  | `retell` SDK or Retell API calls                             | `voice_platform` | Retell — voice AI platform         |
  | `from langchain` with provider imports                       | `framework`      | LangChain orchestration framework  |
  | `from llama_index` with provider imports                     | `framework`      | LlamaIndex orchestration framework |
  | Direct SDK calls only (no router/gateway/framework)          | `direct`         | Direct API integration             |

  Set `gateway_type` to `null` if no AI signals were detected or detection is ambiguous.

Build the **capabilities summary** — a flat boolean map of which AI capabilities are actively used across all detected models:

```json
{
  "text_generation": true,
  "streaming": true,
  "function_calling": false,
  "vision": false,
  "embeddings": true,
  "batch_processing": false
}
```

A capability is `true` only if there is evidence from code analysis that it is actively used.

---

## Step 7: Capture Supporting Infrastructure

**Only if Terraform files were found (IaC discovery also ran)**, extract AI-related infrastructure resources:

- **AI resources**: `google_vertex_ai_endpoint`, `google_vertex_ai_model`, `google_vertex_ai_featurestore`, `google_vertex_ai_index`, `google_vertex_ai_tensorboard`, etc.
- **Supporting resources** that serve AI primaries:
  - Service accounts used by AI endpoints
  - VPC connectors attached to AI services
  - Secret Manager entries referenced by AI code (API keys, credentials)
  - Cloud Storage buckets used for model artifacts or training data

For each resource, capture: `address`, `type`, `file`, and relevant `config`.

If no Terraform files were provided, set `infrastructure: []`.

---

## Step 8: Generate ai-workload-profile.json

Load `steering/schema-discover-ai.md` and generate output following the `ai-workload-profile.json` schema.

**CRITICAL field names** — use EXACTLY these keys:

- `model_id` (not model_name, name)
- `service` (not service_type, gcp_service)
- `detected_via` (not detection_method, source)
- `capabilities_used` (not capabilities, features)
- `usage_context` (not description, purpose)
- `pattern` in integration (not integration_type, method)
- `gateway_type` in integration (not gateway, router_type)
- `capabilities_summary` (not capabilities, feature_flags)
- `ai_source` in summary (not provider, source_provider)

**Determining `ai_source`:**

- `"gemini"` — Only Gemini/Vertex AI generative models detected (patterns 2.3)
- `"openai"` — Only OpenAI SDK/models detected (patterns 2.4)
- `"both"` — Both Gemini and OpenAI detected in the same codebase
- `"other"` — Other LLM providers (Anthropic, Cohere, etc.) or traditional ML only (no LLM)

**Conditional sections:**

- `current_costs` — Include ONLY if billing data was provided (billing discovery ran). Omit entirely if no billing data.
- `infrastructure` — Set to `[]` if no Terraform files were provided (IaC discovery did not run).

After generating the output file, the parent `discover.md` handles the phase status update — do not update `.phase-status.json` here.

---

## Output Validation Checklist — ai-workload-profile.json

- `metadata.sources_analyzed` reflects which data sources were actually provided
- `summary.overall_confidence` matches the detection confidence from Step 4
- `summary.total_models_detected` matches the length of `models` array
- `summary.ai_source` is set correctly: `"gemini"`, `"openai"`, `"both"`, or `"other"` based on detected LLM SDKs
- Every entry in `models` has `model_id`, `service`, `detected_via`, `evidence`, `capabilities_used`, and `usage_context`
- `models[].detected_via` only contains sources that were actually analyzed (`"code"`, `"terraform"`, `"billing"`)
- `models[].evidence` array has at least one entry per source listed in `detected_via`
- `models[].capabilities_used` only lists capabilities with evidence from code analysis
- `integration.capabilities_summary` is consistent with the union of all `models[].capabilities_used`
- `integration.gateway_type` is set: one of `"llm_router"`, `"api_gateway"`, `"voice_platform"`, `"framework"`, `"direct"`, or `null`
- `infrastructure` is empty array `[]` if no Terraform was provided
- `current_costs` section is present ONLY if billing data was provided; omitted entirely otherwise
- `detection_signals` matches the signals found in Step 3
- All field names use EXACT required keys

---

## Design Phase Integration

The Design phase (`steering/design.md`) uses `ai-workload-profile.json`:

1. **`summary.ai_source`** — Routes to the correct design reference: `"gemini"` → `ai-gemini-to-bedrock.md`, `"openai"` → `ai-openai-to-bedrock.md`, `"both"` → load both, `"other"` → `ai.md` (traditional ML)
2. **`models`** — Determines which Bedrock models to recommend via the model selection decision tree
3. **`integration.capabilities_summary`** — Validates Bedrock feature parity (e.g., if `function_calling` is `true`, selected Bedrock model must support tool use)
4. **`integration.pattern`** and **`integration.primary_sdk`** — Determines code migration guidance (direct SDK swap vs framework provider swap vs REST endpoint change)
5. **`integration.gateway_type`** — Determines migration effort and approach: `"llm_router"` or `"framework"` → config change (1-3 days); `"direct"` → full SDK swap (1-3 weeks)
6. **`integration.frameworks`** — If LangChain is used, migration may be simpler (swap provider, keep chains)
7. **`infrastructure`** — Identifies supporting AWS resources needed (IAM roles, VPC config)
8. **`current_costs.monthly_ai_spend`** — Baseline for cost comparison in estimate phase

---

## Scope Boundary

**This phase covers Discover & Analysis ONLY.**

FORBIDDEN — Do NOT include ANY of:

- AWS service names, recommendations, or equivalents
- Migration strategies, phases, or timelines
- Terraform generation for AWS
- Cost estimates or comparisons
- Effort estimates

**Your ONLY job: Inventory what exists in GCP. Nothing else.**

## Discover Billing

# Discover Phase: Billing Discovery

> Self-contained billing discovery sub-file. Scans for billing CSV/JSON files, parses billing data, builds service usage profiles, flags AI signals, and generates `billing-profile.json`.
> If no billing files are found, exits cleanly with no output.

**Execute ALL steps in order. Do not skip or optimize.**

---

## Step 0: Self-Scan for Billing Files

Scan the target directory for billing data:

- `**/*billing*.csv` — GCP billing export CSV
- `**/*billing*.json` — BigQuery billing export JSON
- `**/*cost*.csv`, `**/*cost*.json` — Cost report exports
- `**/*usage*.csv`, `**/*usage*.json` — Usage report exports

**Exit gate:** If NO billing files are found, **exit cleanly**. Return no output artifacts. Other sub-discovery files may still produce artifacts.

---

## Step 1: Parse Billing Data

Supported formats:

- GCP billing export CSV
- BigQuery billing export JSON

Extract from each line item:

- `service_description` — GCP service name
- `sku_description` — Specific SKU/resource
- `cost` — Cost amount
- `usage_amount` — Usage quantity
- `usage_unit` — Usage unit (e.g., hours, bytes, requests)

Group by service and calculate monthly totals.

---

## Step 2: Build Service Usage Profile

From the parsed billing data:

1. List all GCP services with non-zero spend
2. Calculate monthly cost per service
3. Identify top services by spend (sorted descending)
4. Note usage patterns (consistent vs bursty spend)

---

## Step 3: Flag AI Signals

Scan billing line items for AI-relevant patterns. For each match, record the pattern, line item details, and confidence score.

| Pattern                     | What to look for                                                                                        | Confidence |
| --------------------------- | ------------------------------------------------------------------------------------------------------- | ---------- |
| 3.1 Vertex AI billing       | Description contains "Vertex AI", "AI Platform"; monthly cost > $10                                     | 98%        |
| 3.2 BigQuery ML billing     | "BigQuery ML" line items + high BigQuery analysis costs (>$500/month)                                   | 80%        |
| 3.3 Generative AI API       | "Generative AI API", "Gemini API", foundation model token charges                                       | 95%        |
| 3.4 Specialized AI services | "Document AI", "Vision AI", "Speech-to-Text", "Natural Language API", "Cloud Translation", "Dialogflow" | 85%        |

---

## Step 4: Generate billing-profile.json

Write `$MIGRATION_DIR/billing-profile.json` with the following structure:

```json
{
  "metadata": {
    "report_date": "[ISO 8601 date]",
    "billing_files_analyzed": ["path/to/billing.csv"],
    "currency": "USD"
  },
  "summary": {
    "total_monthly_spend": 0.00,
    "service_count": 0,
    "top_services_by_spend": []
  },
  "services": [
    {
      "service": "Cloud Run",
      "gcp_service_type": "google_cloud_run_service",
      "monthly_cost": 450.00,
      "top_skus": [
        {
          "sku": "Cloud Run - CPU Allocation Time",
          "monthly_cost": 320.00,
          "usage_amount": 1500,
          "usage_unit": "vCPU-seconds"
        }
      ],
      "usage_pattern": "consistent"
    }
  ],
  "ai_signals": [
    {
      "pattern": "3.1",
      "service_description": "Vertex AI",
      "monthly_cost": 200.00,
      "confidence": 0.98
    }
  ],
  "ai_detection": {
    "has_ai_workload": false,
    "confidence": 0,
    "ai_monthly_spend": 0.00
  }
}
```

Load `steering/schema-discover-billing.md` and validate the output against the `billing-profile.json` schema.

After generating the output file, the parent `discover.md` handles the phase status update — do not update `.phase-status.json` here.

---

## Scope Boundary

**This phase covers Discover & Analysis ONLY.**

FORBIDDEN — Do NOT include ANY of:

- AWS service names, recommendations, or equivalents
- Migration strategies, phases, or timelines
- Terraform generation for AWS
- Cost estimates or comparisons
- Effort estimates

**Your ONLY job: Inventory what exists in GCP. Nothing else.**

## Discover Iac

# Discover Phase: IaC (Terraform) Discovery

> Self-contained IaC discovery sub-file. Scans for IaC files, extracts Terraform resources, classifies, builds dependency graphs, clusters, and generates output files.
> If no IaC files are found, exits cleanly with no output.

**Execute ALL steps in order. Do not skip or optimize.**

## Step 0: Self-Scan for IaC Files

Recursively scan the entire target directory tree for infrastructure files:

**Terraform:**

- `**/*.tf`, `**/*.tf.json` — resource definitions
- `**/*.tfvars`, `**/*.auto.tfvars` — variable values
- `**/*.tfstate` — state files (read-only, if present)
- `**/.terraform.lock.hcl` — lock files
- `**/modules/*/` — module directories and nested modules

**Contextual files** (recorded but not processed — useful for future discovery phases):

- **Kubernetes:** `**/k8s/*.yaml`, `**/kubernetes/*.yaml`, `**/manifests/*.yaml`
- **Docker:** `**/Dockerfile`, `**/docker-compose*.yml`
- **CI/CD:** `**/cloudbuild.yaml`, `**/.github/workflows/*.yml`, `**/.gitlab-ci.yml`, `**/Jenkinsfile`

Record file paths and types for all files found.

**Exit gate:** If NO Terraform files (`.tf`, `.tfvars`, `.tfstate`, `.terraform.lock.hcl`) are found, **exit cleanly**. Return no output artifacts. Other sub-discovery files may still produce artifacts.

## Step 1: Extract Resources from Terraform

1. Read all `.tf`, `.tfvars`, and `.tfstate` files in working directory (recursively)
2. Extract all resources matching `google_*` pattern (e.g., `google_compute_instance`, `google_sql_database_instance`)
3. For each resource, capture exactly:
   - `address` (e.g., `google_compute_instance.web`)
   - `type` (e.g., `google_compute_instance`)
   - `name` (resource name component, e.g., `web`)
   - `config` (object with key attributes: `machine_type`, `name`, `region`, etc.)
   - `raw_hcl` (raw HCL text for this resource, needed for Step 4)
   - `depends_on` (array of addresses this resource depends on)
4. Also extract provider and backend configuration (for region detection)
5. Report total resources found to user (e.g., "Parsed 50 GCP resources from 12 Terraform files")

## Step 2: Flag AI Signals

Scan all `.tf` files for AI-relevant patterns. For each match, record the pattern, file location, and confidence score.

| Pattern             | What to look for                                                                                                                                                     | Confidence |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Vertex AI resources | `google_vertex_ai_*` resource types (`_model`, `_endpoint`, `_training_pipeline`, `_custom_job`, `_index`, `_featurestore`, `_tensorboard`, `_batch_prediction_job`) | 95%        |
| BigQuery ML         | `google_bigquery_ml_*` resource types                                                                                                                                | 85%        |
| Cloud AI Services   | `google_cloud_document_ai_*`, `google_cloud_vision_*`, `google_cloud_speech_*`, `google_cloud_translation_*`, `google_cloud_dialogflow_*`                            | 80%        |
| AI module usage     | Module names containing `*ai*`, `*ml*`, `*model*`, `*prediction*`; variable values referencing `vertex-ai`, `bigquery-ml`                                            | 70%        |
| Variable references | Variable/local names matching `*vertex*`, `*prediction*`, `*model*`, `*ml*`; values containing `vertex-ai`, `bigquery`, `gemini`, `palm`                             | 60%        |

Record all signals for the `ai_detection` section in `gcp-resource-inventory.json`. If any signal has confidence >= 70%, set `has_ai_workload: true`.

**Note:** This step only detects signals from Terraform. Full AI workload profiling (code analysis, billing data) is handled by `discover-app-code.md`.

## Step 2.5: Complexity Assessment

Count the unique GCP resource types extracted in Step 1 that are PRIMARY candidates
(compute, database, storage, messaging services — not IAM, firewall rules, or project services).
Use the Priority 1 list from clustering-classification-rules.md as reference:

**Primary types:** google_cloud_run_v2_service, google_cloud_run_service, google_cloudfunctions_function,
google_cloudfunctions2_function, google_compute_instance, google_container_cluster,
google_app_engine_application, google_sql_database_instance, google_spanner_instance,
google_firestore_database, google_bigtable_instance, google_bigquery_dataset,
google_redis_instance, google_storage_bucket, google_filestore_instance,
google_pubsub_topic, google_cloud_tasks_queue

Count resources matching these types. This is the **primary resource count**.

- **If primary resource count ≤ 8:** Use **simplified discovery** (Step 3S below). Skip Steps 3-6.
- **If primary resource count > 8:** Use **full discovery** (Steps 3-6, unchanged).

## Step 3S: Simplified Discovery (≤ 8 primary resources)

For small projects, skip the full clustering pipeline. Instead:

1. **Classify resources** using only Priority 1 hardcoded rules from the PRIMARY types list above.
   - Resources matching the list → PRIMARY
   - All other resources → SECONDARY with role inferred from type:
     - `google_service_account*`, `google_project_iam*` → role: identity
     - `google_compute_firewall`, `google_compute_network`, `google_compute_subnetwork`,
       `google_compute_global_address`, `google_compute_router*`, `google_dns*` → role: network_path
     - `google_secret_manager*`, `google_kms*` → role: encryption
     - `google_project_service` → role: configuration
     - Everything else → role: configuration
   - Set `confidence: 0.99` for all

2. **Build simple dependency edges:**
   - For each SECONDARY resource, find which PRIMARY resource it serves by checking
     Terraform reference expressions (e.g., `google_cloud_run_v2_service.X.name` referenced
     in a service account → that SA serves that Cloud Run service)
   - Edge type: `serves` for all edges (skip typed-edge classification)
   - If no reference found, attach to the nearest PRIMARY resource by file proximity

3. **Create clusters** using simple grouping:
   - **Networking cluster:** All `google_compute_network`, `google_compute_subnetwork`,
     `google_compute_firewall`, `google_compute_router*`, `google_compute_global_address`,
     `google_dns*` resources → 1 cluster
   - **Per-primary clusters:** Each PRIMARY resource + its SECONDARY `serves` dependents → 1 cluster
   - `google_project_service` resources → attach to the cluster of the service they enable
   - Naming: `{category}_{type}_{region}_{sequence}` (same convention as full clustering)

4. **Set depth:** Networking cluster = depth 0. All other clusters = depth 1. (No Kahn's algorithm needed.)

5. **Load** `steering/schema-discover-iac.md` and write output files
   (`gcp-resource-inventory.json`, `gcp-resource-clusters.json`) using the same schema.
   Add to metadata: `"clustering_mode": "simplified"`.

6. **Proceed to Step 7** (same as full path).

**Note:** The simplified path produces the SAME output schema as the full path. Downstream
phases (clarify, design, estimate, generate) work identically regardless of clustering mode.

## Step 3: Classify Resources (PRIMARY vs SECONDARY)

1. Read `steering/clustering-classification-rules.md` completely
2. For EACH resource from Step 1, apply classification rules in priority order:
   - **Priority 1**: Check if in PRIMARY list → mark `classification: "PRIMARY"`, assign `tier`, continue
   - **Priority 2**: Check if type matches SECONDARY patterns → mark `classification: "SECONDARY"` with `secondary_role` (one of: `identity`, `access_control`, `network_path`, `configuration`, `encryption`, `orchestration`)
   - **Priority 3**: Apply fallback heuristics first, then LLM inference → mark as SECONDARY with `secondary_role` and `confidence` field (0.5-0.75)
   - **Default**: Mark as `SECONDARY` with `secondary_role: "configuration"` and `confidence: 0.5`
3. For each resource, also record:
   - `confidence`: `0.99` (hardcoded) or `0.5-0.75` (LLM inference)
4. Confirm ALL resources have `classification` and `confidence` fields
5. Report counts (e.g., "Classified: 12 PRIMARY, 38 SECONDARY")

## Step 4: Build Dependency Edges and Populate Serves

1. Read `steering/typed-edges-strategy.md` completely
2. For EACH resource from Step 1, extract references from `raw_hcl`:
   - Extract all `google_*\.[\w\.]+` patterns
   - Classify edge type by field name/value context (see typed-edges-strategy.md)
   - Store as `{from, to, relationship_type, evidence}` in `typed_edges[]` array
   - Include both **Secondary→Primary** edges (identity, network_path, etc.) and **Primary→Primary** edges (data_dependency, cache_dependency, publishes_to, etc.)
3. For SECONDARY resources, populate `serves[]` array:
   - Trace outgoing references to PRIMARY resources
   - Trace incoming `depends_on` references from PRIMARY resources
   - Include transitive chains (e.g., IAM → SA → Cloud Run)
4. Report dependency summary (e.g., "Found 45 typed edges, 38 secondaries populated serves arrays")

## Step 5: Calculate Topological Depth

1. Read `steering/depth-calculation.md` completely
2. Use Kahn's algorithm (or equivalent topological sort) to assign `depth` field:
   - Depth 0: resources with no incoming dependencies
   - Depth N: resources where at least one dependency is depth N-1
3. **Detect cycles**: If any resource cannot be assigned depth, flag error: "Circular dependency detected between: [resources]. Breaking lowest-confidence edge."
4. Confirm ALL resources have `depth` field (integer >= 0)
5. Report depth summary (e.g., "Depth 0: 8 resources, Depth 1: 15 resources, ..., Max depth: 3")

## Step 6: Apply Clustering Algorithm

1. Read `steering/clustering-algorithm.md` completely
2. Apply Rules 1-6 in exact priority order:
   - **Rule 1: Networking Cluster** — `google_compute_network` + all `network_path` secondaries → 1 cluster
   - **Rule 2: Same-Type Grouping** — ALL primaries of identical type → 1 cluster (not one per resource)
   - **Rule 3: Seed Clusters** — Each remaining PRIMARY gets cluster + its `serves[]` secondaries
   - **Rule 4: Merge on Dependencies** — Merge only if single deployment unit (rare)
   - **Rule 5: Skip API Services** — `google_project_service` never gets own cluster; attach to service it enables
   - **Rule 6: Deterministic Naming** — `{service_category}_{service_type}_{gcp_region}_{sequence}` (e.g., `compute_cloudrun_us-central1_001`, `database_sql_us-central1_001`)
3. For each cluster, also populate:
   - `network` — which VPC/network the cluster's resources belong to
   - `must_migrate_together` — boolean (true for all clusters by default; set false only if resources can be migrated independently)
   - `dependencies` — array of other cluster IDs this cluster depends on (derived from Primary→Primary edges between clusters)
4. Assign `cluster_id` to EVERY resource (must match one of generated clusters)
5. Confirm ALL resources have `cluster_id` field
6. Build `creation_order` — global ordering of clusters by depth level
7. Report clustering results (e.g., "Generated 6 clusters from 50 resources")

## Step 7: Write Final Output Files

**This step is MANDATORY. Write all files with exact schemas.**

### 7a: Write gcp-resource-inventory.json

1. Create file: `$MIGRATION_DIR/gcp-resource-inventory.json`
2. Load `steering/schema-discover-iac.md` and write with the exact schema for `gcp-resource-inventory.json`

**CRITICAL field names (use EXACTLY these):**

- `address` (resource Terraform address)
- `type` (resource Terraform type)
- `name` (resource name component)
- `classification` (PRIMARY or SECONDARY)
- `tier` (infrastructure layer: compute, database, storage, networking, identity, etc.)
- `confidence` (classification confidence, 0.0-1.0)
- `secondary_role` (for secondaries only; one of: identity, access_control, network_path, configuration, encryption, orchestration)
- `serves` (for secondaries only; list of resources this secondary supports)
- `cluster_id` (assigned cluster)
- `depth` (topological depth, integer >= 0)

Include top-level sections:

- `metadata` — report_date, project_directory, terraform_version
- `summary` — total_resources, primary_resources, secondary_resources, total_clusters, classification_coverage
- `resources[]` — all resources with above fields
- `ai_detection` — has_ai_workload, confidence, confidence_level, signals_found, ai_services

### 7b: Write gcp-resource-clusters.json

1. Create file: `$MIGRATION_DIR/gcp-resource-clusters.json`
2. Write with the exact schema for `gcp-resource-clusters.json` (from `schema-discover-iac.md`, already loaded above)

**CRITICAL field names (use EXACTLY these):**

- `cluster_id` (matches resources' cluster_id)
- `primary_resources` (array of addresses)
- `secondary_resources` (array of addresses)
- `network` (which VPC/network this cluster belongs to)
- `creation_order_depth` (matches resource depths)
- `must_migrate_together` (boolean — whether cluster is atomic deployment unit)
- `dependencies` (array of other cluster IDs this depends on)
- `gcp_region` (GCP region for this cluster)
- `edges` (array of {from, to, relationship_type, evidence})

Include top-level `creation_order` array:

```json
"creation_order": [
  { "depth": 0, "clusters": ["networking_vpc_us-central1_001"] },
  { "depth": 1, "clusters": ["security_iam_us-central1_001"] },
  { "depth": 2, "clusters": ["database_sql_us-central1_001"] }
]
```

### 7c: Validate Output Files

1. Confirm `$MIGRATION_DIR/gcp-resource-inventory.json` exists and is valid JSON
2. Confirm `$MIGRATION_DIR/gcp-resource-clusters.json` exists and is valid JSON
3. Verify all resource addresses in inventory appear in exactly one cluster
4. Verify all cluster IDs match resource cluster_id assignments
5. Report to user: "Wrote gcp-resource-inventory.json (X resources) and gcp-resource-clusters.json (Y clusters)"

After generating output files, the parent `discover.md` handles the phase status update — do not update `.phase-status.json` here.

## Output Validation Checklist

### gcp-resource-inventory.json

- Every resource has `address`, `type`, `name`, and `classification` fields
- Every resource has `confidence` field
- Every PRIMARY resource has `depth` and `tier` fields
- Every SECONDARY resource has `secondary_role` and `serves` fields
- Every resource has `cluster_id` matching one of the generated clusters
- All field names use EXACT required keys (see Step 7a)
- No duplicate resource addresses
- `ai_detection` section present with `has_ai_workload` and `confidence` fields
- If `has_ai_workload: true`, then `signals_found` array contains at least one signal with confidence >= 70%
- If `has_ai_workload: false`, then `confidence: 0` and `signals_found: []`
- `ai_services` array lists only services actually detected (vertex_ai, bigquery_ml, etc.)
- `confidence_level` is one of: "very_high" (90%+), "high" (70-89%), "medium" (50-69%), "low" (< 50%), "none" (0%)
- Output is valid JSON

### gcp-resource-clusters.json

- Every cluster has `cluster_id`, `primary_resources`, `secondary_resources`
- `primary_resources` and `secondary_resources` are non-overlapping
- `creation_order_depth` matches resource depths
- `gcp_region` is populated for every cluster
- `network` field is populated (references VPC resource or null if standalone)
- `must_migrate_together` is a boolean
- `dependencies` array contains only valid cluster IDs
- `edges` array uses `{from, to, relationship_type, evidence}` format
- `creation_order` array is topologically sorted
- All cluster dependencies exist in clusters array
- All resource addresses across all clusters account for every resource in inventory
- No duplicate cluster_ids
- No cycles in dependency graph
- Output is valid JSON

---

## Design Phase Integration

The Design phase (`steering/design.md`) uses both outputs:

1. **From gcp-resource-clusters.json:**
   - `creation_order` — evaluates clusters depth-first (foundational first)
   - `primary_resources` / `secondary_resources` — knows which resources map independently vs which support others
   - `edges` — understands resource relationships and evidence
   - `network` — knows which VPC resources belong to
   - `dependencies` — understands cluster-level ordering
   - `must_migrate_together` — respects atomic deployment constraints

2. **From gcp-resource-inventory.json:**
   - `config` — looks up config values against design-ref signals
   - `classification` / `secondary_role` — handles primary/secondary differently
   - `serves` — determines if secondary's primary is mapped
   - `depth` — validates clustering logic
   - `tier` — routes to correct design-ref file (compute.md, database.md, etc.)
   - `ai_detection` — determines if AI design phase runs

---

## Scope Boundary

**This phase covers Discover & Analysis ONLY.**

FORBIDDEN — Do NOT include ANY of:

- AWS service names, recommendations, or equivalents
- Migration strategies, phases, or timelines
- Terraform generation for AWS
- Cost estimates or comparisons
- Effort estimates

**Your ONLY job: Inventory what exists in GCP. Nothing else.**

## Discover

# Phase 1: Discover GCP Resources

Lightweight orchestrator that delegates to domain-specific discoverers. Each sub-discovery file is self-contained — it scans for its own input, processes what it finds, and exits cleanly if nothing is relevant.
**Execute ALL steps in order. Do not skip or deviate.**

## Sub-Discovery Files

- **discover-iac.md** → `gcp-resource-inventory.json` + `gcp-resource-clusters.json` (if Terraform found)
- **discover-app-code.md** → `ai-workload-profile.json` (if source code with AI signals found)
- **discover-billing.md** → `billing-profile.json` (if billing data found)

Multiple artifacts can be produced in a single run — they are not mutually exclusive.

## Step 0: Initialize Migration State

1. Check for existing `.migration/` directory at the project root.
   - **If existing runs found:** List them with their phase status and ask:
     - `[A] Resume: Continue with [latest run]`
     - `[B] Fresh: Create new migration run`
     - `[C] Cancel`
   - **If resuming:** Set `$MIGRATION_DIR` to the selected run's directory. Read its `.phase-status.json` and skip to the appropriate phase per the State Machine in POWER.md.
   - **If fresh or no existing runs:** Continue to step 2.
2. **Resolve the current local timestamp FIRST** by running the shell command `date "+%m%d-%H%M"` in the user's project directory to get the actual `MMDD-HHMM` value in the user's local timezone. **Do NOT hardcode, guess, or infer the timestamp — always execute the command and use its output.** Then create `.migration/[MMDD-HHMM]/` directory using the resolved value (e.g., if the command returns `0226-1430`, create `.migration/0226-1430/`). Set `$MIGRATION_DIR` to this new directory.
3. Create `.migration/.gitignore` file (if not already present) with exact content:

   ```
   # Auto-generated migration state (temporary, should not be committed)
   *
   !.gitignore
   ```

   This prevents accidental commits of migration artifacts.

4. Write `.phase-status.json` with exact schema:

   ```json
   {
     "migration_id": "[MMDD-HHMM]",
     "last_updated": "[ISO 8601 timestamp with local timezone offset]",
     "phases": {
       "discover": "in_progress",
       "clarify": "pending",
       "design": "pending",
       "estimate": "pending",
       "generate": "pending",
       "feedback": "pending"
     }
   }
   ```

5. Confirm both `.migration/.gitignore` and `.phase-status.json` exist before proceeding to Step 1.

## Step 1: Load Phase Status Schema

Load `steering/schema-phase-status.md` now. Each sub-discovery file loads its own output schema — do not load them here.

## Step 2: Scan for Input Sources and Run Sub-Discoveries

Scan the project directory for each input type. Only load sub-discovery files when their input files are present.

**2a. Check for Terraform files:**
Glob for: `**/*.tf`, `**/*.tfvars`, `**/*.tfstate`, `**/.terraform.lock.hcl`

- If found → Load `discover-iac.md`
- If not found → Skip. Log: "No Terraform files found — skipping IaC discovery."

**2b. Check for source code / dependency manifests:**
Glob for: `**/*.py`, `**/*.js`, `**/*.ts`, `**/*.jsx`, `**/*.tsx`, `**/*.go`, `**/*.java`, `**/*.scala`, `**/*.kt`, `**/*.rs`, `**/requirements.txt`, `**/setup.py`, `**/pyproject.toml`, `**/Pipfile`, `**/package.json`, `**/go.mod`, `**/pom.xml`, `**/build.gradle`

- If found → Load `discover-app-code.md`
- If not found → Skip. Log: "No source code found — skipping app code discovery."

**2c. Check for billing data:**
Glob for: `**/*billing*.csv`, `**/*billing*.json`, `**/*cost*.csv`, `**/*cost*.json`, `**/*usage*.csv`, `**/*usage*.json`

- If not found → Skip. Log: "No billing files found — skipping billing discovery."
- If found AND **no** Terraform files from 2a → Load `discover-billing.md` (billing is the primary source — needs full processing for the billing-only design path).
- If found AND Terraform files **were** found in 2a → Use lightweight extraction below. Do **not** load `discover-billing.md`.

**Lightweight billing extraction (when IaC is the primary source):**

When Terraform is present, billing data is supplementary — only service-level costs and AI signal detection are needed. Extract via a script to avoid reading the raw file into context.

1. Use Bash to read only the **first line** of the billing file to identify column headers.
2. Write a script to `$MIGRATION_DIR/_extract_billing.py` (or `.js` / shell — use whatever runtime is available) that:
   - Reads the billing CSV/JSON file
   - Groups line items by service description, sums cost per service
   - Extracts top 3 SKU descriptions per service by cost
   - Scans service and SKU descriptions (case-insensitive) for AI keywords: `vertex ai`, `ai platform`, `bigquery ml`, `generative ai`, `gemini`, `document ai`, `vision ai`, `speech-to-text`, `natural language`, `dialogflow`, `translation`
   - Outputs JSON to stdout matching the schema in step 4
3. Run the script: try `python3 _extract_billing.py` first. If `python3` is not found, try `python _extract_billing.py`. If neither is available, delete the script and fall back to loading `discover-billing.md`.
4. Write the script's JSON output to `$MIGRATION_DIR/billing-profile.json` with this exact schema:

   ```json
   {
     "summary": { "total_monthly_spend": 0.00 },
     "services": [
       {
         "gcp_service": "Cloud Run",
         "monthly_cost": 450.00,
         "top_skus": [
           { "sku_description": "Cloud Run - CPU Allocation Time", "monthly_cost": 300.00 }
         ]
       }
     ],
     "ai_signals": { "detected": false }
   }
   ```

   Services sorted descending by `monthly_cost`. Only include services with cost > 0.

5. Delete the script file after successful execution.

**Critical:** Do **not** Read the billing file with the Read tool. Do **not** load `discover-billing.md` or `schema-discover-billing.md`.

**If NONE of the three checks found files**: STOP and output: "No GCP sources detected. Provide at least one source type (Terraform files, application code, or billing exports) and try again."

## Step 3: Check Outputs

After all loaded sub-discoveries complete, check what artifacts were produced in `$MIGRATION_DIR/`:

1. Check for output files:
   - `gcp-resource-inventory.json` — IaC discovery succeeded
   - `gcp-resource-clusters.json` — IaC discovery produced clusters
   - `ai-workload-profile.json` — App code discovery detected AI workloads
   - `billing-profile.json` — Billing data parsed
2. **If NO artifacts were produced** (sub-discoveries ran but produced no output): STOP and output: "Discovery ran but produced no artifacts. Check that your input files contain valid GCP resources and try again."

## Step 4: Update Phase Status

In the **same turn** as the output message below, use the Phase Status Update Protocol (Write tool) to write `.phase-status.json` with `phases.discover` set to `"completed"` and all other phases unchanged from their initial values.

Output to user — build message from whichever artifacts exist:

- If `gcp-resource-inventory.json` exists: "Discovered X total resources across Y clusters."
- If `ai-workload-profile.json` exists: "Detected AI workloads (source: [ai_source])."
- If `billing-profile.json` exists: "Parsed billing data ($Z/month across N services)."

Format: "Discover phase complete. [artifact summaries joined by space] Proceeding to Phase 2: Clarify."

## Output Files

**Discover phase writes files to `$MIGRATION_DIR/`. Possible outputs (depending on what sub-discoverers find):**

1. `gcp-resource-inventory.json` — from discover-iac.md
2. `gcp-resource-clusters.json` — from discover-iac.md
3. `ai-workload-profile.json` — from discover-app-code.md
4. `billing-profile.json` — from discover-billing.md

**No other files must be created:**

- No README.md
- No discovery-summary.md
- No EXECUTION_REPORT.txt
- No discovery-log.md
- No documentation or report files

All user communication via output messages only.

## Error Handling

- **Missing `.migration` directory**: Create it (Step 0)
- **Missing `.migration/.gitignore`**: Create it automatically (Step 0) — prevents accidental commits
- **No input files found for any sub-discoverer**: STOP with error message (Step 2)
- **Sub-discoveries ran but produced no artifacts**: STOP with error message (Step 3)
- **Sub-discoverer fails**: STOP and report exact failure point and which sub-discoverer failed
- **Output file validation fails**: STOP and report schema errors
- **Extra files created (README, reports, etc.)**: Failure. Discover must produce ONLY the JSON artifact files.

## Scope Boundary

**This phase covers Discover & Analysis ONLY.**

FORBIDDEN — Do NOT include ANY of:

- AWS service names, recommendations, or equivalents
- Migration strategies, phases, or timelines
- Terraform generation for AWS
- Cost estimates or comparisons
- Effort estimates

**Your ONLY job: Inventory what exists in GCP. Nothing else.**

## Estimate Ai

# Estimate Phase: AI Workload Cost Analysis

> Loaded by estimate.md when aws-design-ai.json exists.

**Execute ALL steps in order. Do not skip or optimize.**

## Pricing Mode

The parent `estimate.md` selects the pricing mode before loading this file.

**Price lookup order:**

1. **`steering/cached-prices.md` (primary)** — Look up Bedrock model pricing and source provider pricing by table. Set `pricing_source: "cached"`.
2. **MCP (secondary)** — If a model is NOT in cached-prices.md and MCP is available, query `get_pricing("AmazonBedrock", "us-east-1")` with model filter. Set `pricing_source: "live"`.

For typical migrations (Claude, Llama, Nova, Mistral, DeepSeek, Gemma, OpenAI gpt-oss, Gemini source pricing), ALL prices are in `cached-prices.md`. Zero MCP calls needed.

## Prerequisites

Read from `$MIGRATION_DIR/`:

- **`ai-workload-profile.json`** — `current_costs.monthly_ai_spend`, `current_costs.services_detected`, `models[]`
- **`preferences.json`** — `ai_constraints.ai_token_volume.value`, `ai_constraints.ai_capabilities_required.value`
- **`aws-design-ai.json`** — `metadata.ai_source`, `ai_architecture.honest_assessment`, `ai_architecture.tiered_strategy`, `ai_architecture.bedrock_models[]` (with `source_provider_price`, `bedrock_price`, `honest_assessment`), `ai_architecture.capability_mapping`

---

## Part 1: Establish Current GCP AI Costs

Determine current Vertex AI spending from the best available source:

1. **Billing data (preferred)** — Use `current_costs.monthly_ai_spend` from `ai-workload-profile.json`
2. **Estimated from token volume** — Use `ai_constraints.ai_token_volume.value` from `preferences.json` with Gemini pricing from `cached-prices.md` (under "Source Provider Pricing"). Apply 60/40 input/output ratio if actual ratio unknown.
3. **Neither available** — Note in output and present model comparison at multiple volume tiers so user can find their range.

---

## Part 2: Build Model Comparison Table

Calculate the monthly Bedrock cost for **every viable model** at the user's token volume.

**Token volume mapping** (from `ai_token_volume` in `preferences.json`):

| `ai_token_volume` | Input tokens/month | Output tokens/month | Ratio |
| ----------------- | ------------------ | ------------------- | ----- |
| `"low"`           | 6M                 | 4M                  | 60/40 |
| `"medium"`        | 60M                | 40M                 | 60/40 |
| `"high"`          | 600M               | 400M                | 60/40 |
| `"very_high"`     | 6B                 | 4B                  | 60/40 |

If design or discover phase has more specific token estimates, use those instead.

**Cost formula:** `Monthly = (input_tokens / 1M × input_rate) + (output_tokens / 1M × output_rate)`

**Long-context surcharge:** If `ai_critical_feature = "ultra_long_context"` in `preferences.json`, Claude models charge 2x the standard input rate for tokens beyond 200K context. Apply the surcharge to the portion of input tokens that exceeds 200K per request. If per-request token counts are unknown, assume 50% of input tokens fall in the long-context tier as a conservative estimate.

**Comparison table columns:** Model, Bedrock Monthly, vs Source Provider ($ and %), vs Current GCP, Quality, Capabilities Match (checked against `ai_capabilities_required`).

Include source provider pricing from `aws-design-ai.json` → `bedrock_models[].source_provider_price`.

If Bedrock is more expensive for the recommended model, flag prominently.

If embeddings are needed, add a separate line (additive to primary model cost).

---

## Part 3: Recommended Model Cost Breakdown

Using the model selected in the design phase, show:

- Input tokens × rate, output tokens × rate, embeddings × rate (if applicable)
- Total monthly cost
- Comparison to current GCP spend (monthly and annual difference)
- Backup model cost for comparison

---

## Part 4: ROI Analysis

Present the monthly and annual cost difference between current GCP AI spend and projected Bedrock cost:

- **If Bedrock is cheaper**: present monthly and annual savings clearly
- **If Bedrock is more expensive**: state clearly, justify with non-cost benefits or note "not justified if cost is the only priority"

Reference `aws-design-ai.json` → `honest_assessment`. If `"recommend_stay"`, present prominently.

**Non-cost benefits to present:** model flexibility (30+ models), prompt caching (Claude, 90% savings), AWS ecosystem (Guardrails, Knowledge Bases, Agents), vendor diversification, multi-model strategy.

---

## Part 5: Cost Optimization Opportunities

Present applicable optimizations with estimated savings:

| Optimization               | Savings | Applies When                                        |
| -------------------------- | ------- | --------------------------------------------------- |
| Model downsizing / tiering | 60-87%  | High volume, premium model selected                 |
| Prompt caching (Claude)    | ~30%    | Repeated system prompts                             |
| Batch API                  | 50%     | Non-real-time workloads (`ai_latency = "flexible"`) |
| Provisioned throughput     | Varies  | Token volume > 100M/month, predictable traffic      |
| Input token reduction      | 10-30%  | Prompt optimization, shorter context                |
| Multi-model tiered routing | 60-87%  | High/very-high volume, `tiered_strategy` in design  |

For each applicable optimization, calculate before/after monthly cost and show an `optimized_projection` (best-case monthly with all optimizations).

---

## Output

Write `estimation-ai.json` to `$MIGRATION_DIR/`.

**Schema — top-level fields:**

| Field                        | Type   | Description                                                                                                         |
| ---------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| `phase`                      | string | `"estimate"`                                                                                                        |
| `timestamp`                  | string | ISO 8601                                                                                                            |
| `pricing_source`             | string | `"cached"` or `"live"`                                                                                              |
| `accuracy_confidence`        | string | `"±5-10%"` or `"±15-25%"`                                                                                           |
| `current_costs`              | object | `source`, `gcp_monthly_ai_spend`, `services[]`                                                                      |
| `token_volume`               | object | `source`, `monthly_input_tokens`, `monthly_output_tokens`, ratio                                                    |
| `model_comparison`           | array  | All viable models: `model`, `monthly_cost`, `vs_current`, `quality`, `capabilities_match`, `missing_capabilities[]` |
| `recommended_model`          | object | `model`, `monthly_cost`, `breakdown` (input/output/embeddings), `rationale`                                         |
| `backup_model`               | object | `model`, `monthly_cost`, `rationale`                                                                                |
| `embeddings`                 | object | `model`, `monthly_cost`, `monthly_tokens`, `note` (if applicable)                                                   |
| `cost_comparison`            | object | `current_gcp_monthly`, `projected_bedrock_monthly`, `monthly_difference`, `annual_difference`, `percent_change`     |
| `roi_analysis`                  | object | `monthly_cost_delta`, `annual_cost_delta`, `justification`, `non_cost_benefits[]`                                   |
| `optimization_opportunities` | array  | `opportunity`, `potential_savings_monthly`, `implementation_effort`, `description`                                  |
| `optimized_projection`       | object | `monthly_with_optimizations`, `vs_current`, `note`                                                                  |

All cost values are numbers, not strings. Output must be valid JSON.

## Validation Checklist

- [ ] `model_comparison` includes ALL viable Bedrock models, not just recommended
- [ ] Every model has `capabilities_match` checked against `ai_capabilities_required`
- [ ] `recommended_model.rationale` references user's priority, preference, and volume
- [ ] `roi_analysis` is honest — if migration increases cost, says so
- [ ] `optimization_opportunities` only includes strategies relevant to user's workload
- [ ] No compute, database, storage, or networking costs (those belong in `estimate-infra.md`)

## Present Summary

After writing `estimation-ai.json`, present under 25 lines:

1. Current GCP AI spend vs projected Bedrock cost (recommended model)
2. Model comparison table: model name, monthly cost, vs source provider %, capabilities match
3. Recommended model with cost breakdown
4. If migration increases cost: flag honestly with non-cost justification
5. Top 2-3 optimization opportunities with potential savings
6. Optimized projection

## Generate Phase Integration

The Generate phase uses `estimation-ai.json`:

1. **`recommended_model`** — Which Bedrock model to provision and test
2. **`optimization_opportunities`** — Which optimizations to implement and when
4. **`cost_comparison`** — Cost monitoring targets and alerts in production
5. **`model_comparison`** — Fallback options if recommended model doesn't meet quality bar

## Scope Boundary

**This phase covers financial analysis ONLY for AI workloads.**

FORBIDDEN — Do NOT include compute, database, storage, networking cost calculations, infrastructure provisioning, code migration examples, or detailed migration timelines.

## Estimate Billing

# Estimate Phase: Billing-Only Cost Analysis

> Loaded by estimate.md when aws-design-billing.json exists and aws-design.json does NOT exist.

**Execute ALL steps in order. Do not skip or optimize.**

**Known limitations:** Cost inference from billing SKU details (tighter ranges), historical trend projection, and AWS Cost Calculator integration are not yet supported.

## Pricing Mode

Without source configuration (CPU, memory, disk, scaling), billing-only estimates use **GCP-cost-ratio projections** (Step 2 below) rather than precise per-resource AWS pricing lookups. The pricing cache and MCP API are not directly used for per-service calculations — instead, GCP actual spend is scaled by service-type multipliers.

Overall accuracy: ±30-40% due to the lack of configuration detail.

## Overview

When only billing data was available for design, cost estimates carry wider ranges. Without source configuration, we cannot calculate precise AWS costs. Instead, we produce low/mid/high estimates per service based on typical AWS pricing for the mapped service type.

**Input:** `$MIGRATION_DIR/aws-design-billing.json`, `$MIGRATION_DIR/billing-profile.json`, `$MIGRATION_DIR/preferences.json`
**Output:** `$MIGRATION_DIR/estimation-billing.json`

## Prerequisites

Read from `$MIGRATION_DIR/`:

**From `aws-design-billing.json`:**

- `services[]` — GCP services with AWS mappings and confidence levels
- `metadata.design_source` — must be `"billing_only"`

**From `billing-profile.json`:**

- `services[]` — GCP services with monthly costs and SKUs
- `summary.total_monthly_spend` — Total GCP spend (this is the baseline)

**From `preferences.json`:**

- `design_constraints` — User preferences for optimization approach

## Step 1: Establish GCP Baseline from Billing

Use `billing-profile.json` as the authoritative GCP cost baseline:

```
GCP Monthly Baseline: $[total_monthly_spend]

Per-service breakdown:
  [service 1]: $[monthly_cost]
  [service 2]: $[monthly_cost]
  ...
```

This is actual spend data — higher confidence than inferred costs.

## Step 2: Generate AWS Cost Ranges

For each service in `aws-design-billing.json`, produce low/mid/high estimates:

### Range Calculation

Since we lack source configuration, apply percentage-based ranges around the GCP cost:

```
For each service:
  GCP monthly cost: $X

  Low estimate:  $X x 0.6  (aggressive optimization, smallest viable config)
  Mid estimate:  $X x 1.0  (roughly equivalent config, typical pricing)
  High estimate: $X x 1.4  (premium config, higher availability, no optimization)
```

### Adjust Ranges by Service Type

Some service types have tighter ranges than others:

| Service Type             | Range Factor | Rationale                                   |
| ------------------------ | ------------ | ------------------------------------------- |
| Compute (Cloud Run, GKE) | ±30%         | Pricing varies by config and scaling        |
| Database (Cloud SQL)     | ±35%         | Engine, HA, and sizing drive large variance |
| Storage (GCS)            | ±15%         | Storage pricing is relatively stable        |
| Messaging (Pub/Sub)      | ±20%         | Usage-based, somewhat predictable           |
| Networking (LB, DNS)     | ±20%         | Fixed + usage components                    |
| AI (Vertex AI)           | ±40%         | Model choice drives massive variance        |

### Adjust by SKU Hints

If `aws-design-billing.json` has `sku_hints` from SKU analysis, tighten the range:

- SKU indicates specific instance size -> reduce range to ±15%
- SKU indicates storage class -> reduce range to ±10%
- No SKU hints available -> use full range

## Step 3: Total Cost Projection

```
AWS Projected Monthly Cost:
  Low:  $[sum of all low estimates]
  Mid:  $[sum of all mid estimates]
  High: $[sum of all high estimates]

vs GCP Actual Monthly: $[total_monthly_spend]

Difference:
  Best case:  [low vs GCP] (potential savings of $X/month)
  Expected:   [mid vs GCP] (roughly equivalent cost)
  Worst case: [high vs GCP] (potential increase of $X/month)
```

## Step 4: Document Unknowns

List what would narrow the cost ranges:

```
Unknowns that affect cost precision:
1. Compute sizing (CPU, memory) -- Would narrow compute range from ±30% to ±10%
2. Database engine and HA config -- Would narrow database range from ±35% to ±15%
3. Scaling configuration -- Affects whether Reserved Instances are viable
4. Network topology -- VPC, subnets, peering costs
5. Security requirements -- Encryption, compliance may add costs

Recommendation:
  Run IaC discovery (provide Terraform files) to reduce unknowns.
  This would narrow total estimate range from ±30-40% to ±10-15%.
```

## Step 5: Generate Output

Write `estimation-billing.json`.

### estimation-billing.json schema

```json
{
  "phase": "estimate",
  "timestamp": "[ISO 8601]",
  "metadata": {
    "estimate_source": "billing_only",
    "pricing_source": "cached|live|fallback",
    "confidence_note": "Estimates have wider ranges due to billing-only source"
  },
  "accuracy_confidence": "±30-40%",

  "gcp_baseline": {
    "source": "billing_data",
    "total_monthly_spend": 0.00,
    "service_count": 0,
    "services": [
      {
        "gcp_service": "Cloud Run",
        "monthly_cost": 450.00
      }
    ]
  },

  "aws_projection": {
    "low_monthly": 0.00,
    "mid_monthly": 0.00,
    "high_monthly": 0.00,
    "services": [
      {
        "gcp_service": "Cloud Run",
        "gcp_monthly": 450.00,
        "aws_target": "Fargate",
        "aws_low": 270.00,
        "aws_mid": 450.00,
        "aws_high": 630.00,
        "range_factor": "±30%",
        "unknowns": ["instance sizing", "scaling config"]
      }
    ]
  },

  "cost_comparison": {
    "gcp_monthly": 0.00,
    "aws_monthly_low": 0.00,
    "aws_monthly_mid": 0.00,
    "aws_monthly_high": 0.00,
    "best_case_savings": 0.00,
    "worst_case_increase": 0.00
  },

  "unknowns": [
    {
      "category": "compute_sizing",
      "impact": "high",
      "resolution": "Provide Terraform files or describe instance configurations"
    },
    {
      "category": "database_config",
      "impact": "high",
      "resolution": "Provide Terraform files or describe database engine, HA, sizing"
    },
    {
      "category": "scaling_config",
      "impact": "medium",
      "resolution": "Describe traffic patterns and scaling requirements"
    },
    {
      "category": "network_topology",
      "impact": "medium",
      "resolution": "Describe VPC, subnet, and peering configuration"
    }
  ],

  "recommendation": {
    "confidence": "low",
    "note": "These estimates are based on billing data only. For precise estimates (±10-15%), run IaC discovery by providing Terraform files.",
    "next_steps": [
      "Review cost ranges with stakeholders",
      "Consider running IaC discovery for tighter estimates",
      "Use mid estimate for initial budgeting",
      "Plan for high estimate as worst-case budget"
    ]
  }
}
```

## Output Validation Checklist

- `metadata.estimate_source` is `"billing_only"`
- `accuracy_confidence` is `"±30-40%"` (never tighter for billing-only)
- `gcp_baseline` matches `billing-profile.json` totals
- Every service has low/mid/high estimates
- `unknowns` array is populated with resolution steps
- `recommendation.confidence` is `"low"` (billing-only never produces high confidence)
- No reference to Terraform-based configurations
- All unknowns documented with impact and resolution
- All cost values are numbers, not strings
- Output is valid JSON

## Present Summary

After writing `estimation-billing.json`, present a concise summary to the user:

1. GCP baseline from billing data (total monthly spend)
2. AWS projected cost ranges: low / mid / high per service
3. Total projection: best case / expected / worst case vs GCP
4. Key unknowns that would narrow the estimates
6. Recommendation: run IaC discovery for tighter estimates (±10-15% vs ±30-40%)

Keep it under 20 lines. The user can ask for details or re-read `estimation-billing.json` at any time.

## Generate Phase Integration

The Generate phase uses `estimation-billing.json`:

- Uses wide cost ranges for conservative timeline planning
- Recommends IaC discovery as a prerequisite step
- Documents unknowns as prerequisites per generation step

## Estimate Infra

# Estimate Phase: Infrastructure Cost Analysis

> Loaded by estimate.md when aws-design.json exists.

**Execute ALL steps in order. Do not skip or optimize.**

## Pricing Mode

The parent `estimate.md` determines pricing source before loading this file.

**Price lookup order for each AWS service in `aws-design.json`:**

1. **`steering/cached-prices.md` (primary)** — Read once. Look up each service by table. If found, use the price directly. No MCP call needed. Set `pricing_source: "cached"`.
2. **MCP with recipes (secondary)** — If a service is NOT in cached-prices.md and MCP is available, use the Pricing Recipes table below. Set `pricing_source: "live"`.

For typical migrations (Fargate, Aurora/RDS, Aurora Serverless v2, S3, ALB, NAT Gateway, Lambda, Secrets Manager, CloudWatch, ElastiCache, DynamoDB), ALL prices are in `cached-prices.md`. Zero MCP calls needed.

## Step 0: Validate Design Output

Before pricing queries, validate `aws-design.json`:

1. **File exists**: If missing, **STOP**. Output: "Phase 3 (Design) not completed. Run Phase 3 first."
2. **Valid JSON**: If parse fails, **STOP**. Output: "Design file corrupted (invalid JSON). Re-run Phase 3."
3. **Required fields**:
   - `clusters` array is not empty: If empty, **STOP**. Output: "No clusters in design. Re-run Phase 3."
   - Each cluster has `resources` array: If missing, **STOP**. Output: "Cluster [id] missing resources. Re-run Phase 3."
   - Each resource has `aws_service` field: If missing, **STOP**. Output: "Resource [address] missing aws_service. Re-run Phase 3."
   - Each resource has `aws_config` field: If missing, **STOP**. Output: "Resource [address] missing aws_config. Re-run Phase 3."

If all validations pass, proceed to Part 1.

## Pricing Recipes (MCP Fallback Only)

Only use these recipes when a service is NOT in `cached-prices.md` and MCP is available.
Do NOT call get_pricing_service_codes, get_pricing_service_attributes, or get_pricing_attribute_values — go directly to get_pricing.

| AWS Service          | service_code      | filters                                                                                                              | output_options                                                                                                                                     |
| -------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fargate              | AmazonECS         | `[{"Field":"productFamily","Value":"Compute"}]`                                                                      | `{"pricing_terms":["OnDemand"],"product_attributes":["usagetype","location"],"exclude_free_products":true}`                                        |
| Aurora PostgreSQL    | AmazonRDS         | `[{"Field":"databaseEngine","Value":"Aurora PostgreSQL"},{"Field":"deploymentOption","Value":"Single-AZ"}]`          | `{"pricing_terms":["OnDemand"],"product_attributes":["instanceType","databaseEngine","deploymentOption","location"],"exclude_free_products":true}` |
| RDS PostgreSQL       | AmazonRDS         | `[{"Field":"databaseEngine","Value":"PostgreSQL"},{"Field":"deploymentOption","Value":"Multi-AZ"}]`                  | `{"pricing_terms":["OnDemand"],"product_attributes":["instanceType","databaseEngine","deploymentOption","location"],"exclude_free_products":true}` |
| Aurora MySQL         | AmazonRDS         | `[{"Field":"databaseEngine","Value":"Aurora MySQL"},{"Field":"deploymentOption","Value":"Single-AZ"}]`               | `{"pricing_terms":["OnDemand"],"product_attributes":["instanceType","databaseEngine","deploymentOption","location"],"exclude_free_products":true}` |
| Aurora Serverless v2 | AmazonRDS         | `[{"Field":"usagetype","Value":["Aurora:ServerlessV2Usage","Aurora:ServerlessV2IOOptimizedUsage"],"Type":"ANY_OF"}]` | `{"pricing_terms":["OnDemand"],"product_attributes":["usagetype","databaseEngine","location"],"exclude_free_products":true}`                       |
| S3                   | AmazonS3          | `[{"Field":"storageClass","Value":"General Purpose"}]`                                                               | `{"pricing_terms":["OnDemand"],"product_attributes":["storageClass","volumeType","location"],"exclude_free_products":true}`                        |
| ALB                  | AWSELB            | `[{"Field":"productFamily","Value":"Load Balancer-Application"}]`                                                    | `{"pricing_terms":["OnDemand"],"product_attributes":["productFamily","location"],"exclude_free_products":true}`                                    |
| NAT Gateway          | AmazonEC2         | `[{"Field":"productFamily","Value":"NAT Gateway"}]`                                                                  | `{"pricing_terms":["OnDemand"],"product_attributes":["productFamily","location","group"],"exclude_free_products":true}`                            |
| Lambda               | AWSLambda         | `[{"Field":"group","Value":"AWS-Lambda-Duration"}]`                                                                  | `{"pricing_terms":["OnDemand"],"product_attributes":["group","location","usagetype"],"exclude_free_products":true}`                                |
| Secrets Manager      | AWSSecretsManager | `[]`                                                                                                                 | `{"pricing_terms":["OnDemand"],"exclude_free_products":true}`                                                                                      |
| CloudWatch Logs      | AmazonCloudWatch  | `[{"Field":"usagetype","Value":"DataProcessing-Bytes"}]`                                                             | `{"pricing_terms":["OnDemand"],"product_attributes":["productFamily","location","usagetype"],"exclude_free_products":true}`                        |
| ElastiCache Redis    | AmazonElastiCache | `[{"Field":"cacheEngine","Value":"Redis"},{"Field":"instanceType","Value":"cache.t4g","Type":"CONTAINS"}]`           | `{"pricing_terms":["OnDemand"],"product_attributes":["instanceType","cacheEngine","location"],"exclude_free_products":true}`                       |
| DynamoDB             | AmazonDynamoDB    | `[]`                                                                                                                 | `{"pricing_terms":["OnDemand"],"product_attributes":["group","location"],"exclude_free_products":true}`                                            |

**Important notes on MCP filters:**

- **Fargate**: Use `productFamily=Compute`, NOT EC2-style filters (operatingSystem, tenancy, capacitystatus do not exist in AmazonECS)
- **Aurora (PostgreSQL/MySQL)**: Use `deploymentOption=Single-AZ`. Aurora handles multi-AZ replication natively — there is no "Multi-AZ" pricing option for Aurora
- **Lambda**: Filter by `group=AWS-Lambda-Duration` for compute pricing, separate call with `group=AWS-Lambda-Requests` for request pricing
- **CloudWatch**: Filter by specific `usagetype=DataProcessing-Bytes` for log ingestion pricing (avoids pulling all vended log types)

**Batching rule:** If MCP calls are needed, group up to 4 requests in parallel per turn.

---

## Part 1: Calculate Current GCP Costs

Determine the current GCP monthly infrastructure costs. Use the best available source:

1. **`billing-profile.json` (preferred)** — Use actual billing data as the GCP baseline. Highest confidence (±5%).
2. **`gcp-resource-inventory.json` (fallback)** — Estimate costs from discovered resource configurations. Wider range (±20-30%).
3. **`preferences.json` → `gcp_monthly_spend`** — User-provided monthly spend from clarification.
4. **Conservative default** — If none of the above: use `AWS monthly balanced × 1.25`.

Present the GCP baseline as a total and per-service breakdown, noting which source was used.

---

## Part 2: Calculate Projected AWS Costs

For each service in `aws-design.json`, calculate monthly cost using rates from `cached-prices.md`. Track `pricing_source` per service.

Calculate 3 cost tiers to show the optimization range:

| Tier          | Description                             | Examples                                                            |
| ------------- | --------------------------------------- | ------------------------------------------------------------------- |
| **Premium**   | Latest generation, highest availability | db.r6g instances, Fargate Spot disabled, Multi-AZ everything        |
| **Balanced**  | Standard generation, typical setup      | db.t4g instances, Fargate on-demand, Single-AZ where acceptable     |
| **Optimized** | Cost-minimized with trade-offs          | db.t4g with reserved pricing, Fargate Spot 70%, S3-IA for cold data |

**Per-service calculation approach:**

| Domain            | Formula                                                                               | Key inputs from aws-design.json                             |
| ----------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Compute (Fargate) | (vCPU × vCPU rate + memory GB × memory rate) × 730 hours × instance count             | `aws_config.cpu`, `aws_config.memory`                       |
| Compute (Lambda)  | requests × request rate + (requests × duration × memory GB) × GB-second rate          | Estimated from usage patterns                               |
| Database (Aurora) | instance rate × 730 hours × instance count + storage GB × storage rate + I/O estimate | `aws_config.instance_class`, `aws_config.allocated_storage` |
| Database (RDS)    | instance rate × 730 hours × instance count + storage GB × storage rate                | `aws_config.instance_class`, `aws_config.allocated_storage` |
| Storage (S3)      | GB × per-GB rate + request estimates                                                  | `aws_config.storage_gb` or source `gcp_config`              |
| Networking (ALB)  | fixed monthly + LCU estimate                                                          | From compute service count                                  |
| Networking (NAT)  | fixed monthly × count + GB processed × data rate                                      | From VPC design                                             |
| Supporting        | Per-unit rates × quantities (secrets, log GB, metrics)                                | Inferred from service count                                 |

Show calculation breakdown per service: rate × quantity = cost. Present all 3 tiers side-by-side.

---

## Part 3: Cost Comparison

Present a side-by-side comparison:

- GCP current monthly total
- AWS Premium / Balanced / Optimized monthly totals
- Difference (savings or increase) per tier vs GCP
- Per-service breakdown for the Balanced tier

---

## Part 4: ROI Analysis

Present the monthly and annual cost difference between GCP baseline and each AWS tier (Premium, Balanced, Optimized). This is the recurring savings (or increase) the customer can expect.

- If AWS is cheaper: present the monthly and annual savings for each tier
- If AWS is more expensive: state clearly and note that cost savings alone do not justify migration — operational benefits must be the driver

**Operational efficiency factors to highlight** (qualitative — do not assign dollar values):

- Reduction in operational overhead from managed services (Fargate vs self-managed, RDS vs self-hosted DB)
- Reduced on-call burden from AWS-managed HA, patching, and scaling
- Engineering time freed for product work instead of infrastructure maintenance

**Non-cost benefits to present:** operational efficiency, global reach, service breadth, enterprise integration, vendor diversification, scaling flexibility (auto-scaling, spot instances, savings plans).

---

## Part 5: Cost Optimization Opportunities

Present applicable optimizations with estimated savings:

| Optimization                       | Savings Range | Applies To                       | When                                    |
| ---------------------------------- | ------------- | -------------------------------- | --------------------------------------- |
| Reserved Instances / Savings Plans | 40-60%        | RDS, Aurora                      | Post-migration (after validating usage) |
| Compute Savings Plans              | 20-50%        | Fargate, Lambda                  | Post-migration                          |
| S3 Intelligent-Tiering / S3-IA     | 38-50%        | S3 storage                       | During migration                        |
| Spot Instances                     | 60-90%        | Batch/non-critical EC2 workloads | If batch jobs exist                     |

For each applicable optimization, calculate the before and after monthly cost.

---

## Part 6: Recommendation

Present 3 paths:

1. **Migrate with Optimizations (Best ROI)** — optimized service choices, monthly cost, projected annual savings
2. **Phased Migration (Lower Risk)** — cluster-by-cluster per design evaluation order, validate each before proceeding
3. **Stay on GCP (Lowest Cost)** — only if AWS is more expensive and costs are the sole metric

Include migrate/stay decision factors:

- **Migrate if:** operational efficiency matters, AWS-specific services needed, batch workloads (Spot savings), long-term AWS strategy, growing infrastructure
- **Stay if:** cost is the only metric and AWS is more expensive, team deeply experienced with GCP, no need for AWS-specific services

---

## Output

Read `steering/schema-estimate-infra.md` for the `estimation-infra.json` schema and validation checklist, then write `estimation-infra.json` to `$MIGRATION_DIR/`.

## Present Summary

After writing `estimation-infra.json`, present a concise summary to the user:

1. GCP baseline vs AWS projected (balanced tier) — one-line comparison
2. Three-tier table: Premium / Balanced / Optimized with monthly totals
3. Per-service cost breakdown (balanced tier, 1 line per service)
4. Monthly and annual savings (or increase) vs GCP per tier
5. Top 2-3 optimization opportunities with savings amounts

Keep it under 25 lines. The user can ask for details or re-read `estimation-infra.json` at any time.

## Generate Phase Integration

The Generate phase (`steering/generate.md`) uses `estimation-infra.json` as follows:

1. **`projected_costs.breakdown`** — Budget allocation per cluster migration phase
2. **`optimization_opportunities`** — Which optimizations to implement and when (some during initial migration, some post-migration)
4. **`cost_comparison`** — Set cost monitoring targets and alerts for each migrated cluster
5. **`recommendation.next_steps`** — Prerequisites for starting generation

The generated artifacts reference the cost estimates to set per-cluster cost monitoring thresholds and validate that actual AWS spend aligns with projections after each cluster migration.

## Estimate

# Phase 4: Estimate AWS Costs (Orchestrator)

**Execute ALL steps in order. Do not skip or optimize.**

## Step 0: Pricing Mode Selection

Before running any sub-estimate file, determine the pricing source.

### Step 0a: Load Pricing Cache

Read `steering/cached-prices.md`. Check the `Last updated` date in the header:

- If <= 90 days old: **Cached prices are the primary source.** No MCP calls needed for services listed in the cache. Proceed to Step 1.
- If > 90 days old: Cache is stale. Attempt MCP (Step 0b) for fresh prices; use stale cache as fallback.

### Step 0b: MCP Availability Check (only if cache stale or service not listed)

Attempt to reach awspricing with **up to 2 retries** (3 total attempts):

1. **Attempt 1**: Call `get_pricing_service_codes()`
2. **If timeout/error**: Wait 1 second, retry (Attempt 2)
3. **If still fails**: Wait 2 seconds, retry (Attempt 3)
4. **If all 3 attempts fail**: Use cached prices with staleness warning

### Pricing Hierarchy

Each sub-estimate file uses this lookup order per service:

1. **`steering/cached-prices.md`** (primary) — Cached prices (±5-25% accuracy). Set `pricing_source: "cached"`. Used first because it requires zero API calls and covers most common services.
2. **MCP API** (fallback) — Real-time pricing for services NOT in cached-prices.md (±5-10% accuracy, more precise). Set `pricing_source: "live"`. Only called when the cache lacks the needed service or model.

If cache is > 90 days old and MCP is unavailable:

- Add warning: "Cached pricing data is >90 days old; accuracy may be significantly degraded"
- **Display to user**: Add visible warning with staleness notice

## Step 1: Prerequisites

Read `$MIGRATION_DIR/preferences.json`. If missing: **STOP**. Output: "Phase 2 (Clarify) not completed. Run Phase 2 first."

Check which design artifacts exist in `$MIGRATION_DIR/`:

- `aws-design.json` (infrastructure design from IaC)
- `aws-design-ai.json` (AI workload design)
- `aws-design-billing.json` (billing-only design)

If **none** of these artifacts exist: **STOP**. Output: "No design artifacts found. Run Phase 3 (Design) first."

## Step 2: Routing Rules

### Infrastructure Estimate

IF `aws-design.json` exists:

> Load `estimate-infra.md`

Produces: `estimation-infra.json`

### Billing-Only Estimate

IF `aws-design-billing.json` exists AND `aws-design.json` does **NOT** exist:

> Load `estimate-billing.md`

Produces: `estimation-billing.json`

### AI Estimate

IF `aws-design-ai.json` exists:

> Load `estimate-ai.md`

Produces: `estimation-ai.json`

### Mutual Exclusion

- **estimate-infra** and **estimate-billing** never both run (billing-only is the fallback when no IaC exists).
- **estimate-ai** runs independently of either estimate-infra or estimate-billing (no shared state). Run it after the infra/billing estimate completes.

## Phase Completion

After all applicable sub-estimates finish, use the Phase Status Update Protocol (Write tool) to write `.phase-status.json` with `phases.estimate` set to `"completed"` — **in the same turn** as the output message below.

Output to user: "Cost estimation complete. Proceeding to Phase 5: Generate Migration Artifacts."

## Reference Files

- `steering/cached-prices.md` — Cached AWS + source provider pricing (±5-25%, primary source)

## Scope Boundary

**This phase covers financial analysis ONLY.**

FORBIDDEN — Do NOT include ANY of:

- Changes to architecture mappings from the Design phase
- Execution timelines or migration schedules
- Terraform or IaC code generation
- Detailed migration procedures or runbooks
- Team staffing or resource allocation

**Your ONLY job: Show the financial picture of moving to AWS. Nothing else.**

## Feedback Trace

# Feedback Trace Builder

Builds an anonymized telemetry trace from migration artifacts in `$MIGRATION_DIR/`. The trace never includes resource names, file paths, account IDs, IPs, variable values, or secrets.

**Execute ALL steps in order. Do not skip or deviate.**

## Step 1: Initialize Trace Object

Create an empty `trace` object with `migration_id` from `.phase-status.json`.

## Step 2: Extract Phase Metadata

Read `$MIGRATION_DIR/.phase-status.json` and add to `trace`:

```json
{
  "migration_id": "<from .phase-status.json>",
  "phases_completed": ["<list of phases with value 'completed'>"]
}
```

Only include phases with value `"completed"`.

## Step 3: Extract Discovery Summary

IF `$MIGRATION_DIR/gcp-resource-inventory.json` exists, add:

```json
{
  "discovery": {
    "total_resources": "<summary.total_resources>",
    "primary_resources": "<summary.primary_resources>",
    "secondary_resources": "<summary.secondary_resources>",
    "resource_type_counts": { "<type>": "<count>" },
    "has_ai_workload": "<ai_detection.has_ai_workload>"
  }
}
```

For `resource_type_counts`: group `resources[]` by `type` and count each. Do NOT include resource names or addresses.

## Step 4: Extract Cluster Count

IF `$MIGRATION_DIR/gcp-resource-clusters.json` exists, add:

```json
{ "cluster_count": "<clusters array length>" }
```

## Step 5: Extract AI Profile Summary

IF `$MIGRATION_DIR/ai-workload-profile.json` exists, add:

```json
{
  "ai_profile": {
    "ai_source": "<summary.ai_source>",
    "total_models_detected": "<summary.total_models_detected>",
    "languages_found": "<summary.languages_found>",
    "integration_pattern": "<integration.pattern>",
    "gateway_type": "<integration.gateway_type>",
    "capabilities_summary": "<integration.capabilities_summary>"
  }
}
```

## Step 6: Extract Billing Summary

IF `$MIGRATION_DIR/billing-profile.json` exists, add:

```json
{
  "billing": {
    "total_monthly_spend": "<summary.total_monthly_spend>",
    "service_count": "<summary.service_count>"
  }
}
```

## Step 7: Extract Preferences Metadata

IF `$MIGRATION_DIR/preferences.json` exists, add:

```json
{
  "preferences": {
    "questions_asked_count": "<metadata.questions_asked array length>",
    "questions_defaulted_count": "<metadata.questions_defaulted array length>",
    "questions_skipped_count": "<sum of questions_skipped_extracted + questions_skipped_early_exit + questions_skipped_not_applicable lengths>",
    "category_e_enabled": "<metadata.category_e_enabled>",
    "constraint_values": "<enum values only from design_constraints — e.g., region string, compliance array, availability string>"
  }
}
```

Include only the `value` field from each constraint. Do NOT include `chosen_by` or any free-text fields.

## Step 8: Extract Design Summary

IF `$MIGRATION_DIR/aws-design.json` exists, add each resource mapping as:

```json
{
  "design_mappings": [
    { "gcp_type": "<gcp_type>", "aws_service": "<aws_service>", "confidence": "<confidence>" }
  ],
  "unmapped_count": "<count of resources with no aws_service>"
}
```

IF `$MIGRATION_DIR/aws-design-ai.json` exists, add:

```json
{
  "design_ai": {
    "honest_assessment": "<ai_architecture.honest_assessment>",
    "bedrock_model_count": "<metadata.bedrock_models_selected>"
  }
}
```

## Step 9: Extract Estimation Summary

For each `estimation-*.json` file that exists in `$MIGRATION_DIR/`, add:

```json
{
  "estimation_<type>": {
    "pricing_source": "<pricing_source.status or pricing_mode>",
    "accuracy_confidence": "<accuracy_confidence>",
    "monthly_cost": "<projected optimized or mid monthly cost>"
  }
}
```

Where `<type>` is `infra`, `ai`, or `billing` based on the filename.

## Step 10: Extract Generation Summary

For each `generation-*.json` file that exists in `$MIGRATION_DIR/`, add:

```json
{
  "generation_<type>": {
    "generation_source": "<generation_source>",
    "total_weeks": "<migration_plan.total_weeks>",
    "risk_count": "<risks array length>"
  }
}
```

## Step 11: Count Generated Artifacts

Count files in generated artifact directories (if they exist):

```json
{
  "artifacts": {
    "terraform_file_count": "<count of files in $MIGRATION_DIR/terraform/>",
    "scripts_file_count": "<count of files in $MIGRATION_DIR/scripts/>",
    "ai_migration_file_count": "<count of files in $MIGRATION_DIR/ai-migration/>"
  }
}
```

Only include keys for directories that exist. Use 0 if directory exists but is empty.

## Step 12: Write Trace

Write the assembled `trace` object to `$MIGRATION_DIR/trace.json`.

Output: "Trace built. Extracted anonymized data from N artifacts."

## Feedback

# Phase 6: Feedback (Optional)

Builds an anonymized usage trace and directs the user to the Pulse survey form.

**Execute ALL steps in order. Do not skip or deviate.**

## Prerequisites

Read `$MIGRATION_DIR/.phase-status.json`. Verify `phases.discover == "completed"`. If not: **STOP**. Output: "Feedback requires at least the Discover phase to be completed."

## Step 1: Build Trace

Load `steering/feedback-trace.md` and execute it. This produces `$MIGRATION_DIR/trace.json`.

If trace building fails: log the error, set `trace_included` to `false`, and skip to Step 3.

## Step 2: Show Trace and Provide Instructions

Read `$MIGRATION_DIR/trace.json` and display it pretty-printed so the user can see exactly what data is included:

```
--- Anonymized Trace (what will be shared) ---

<pretty-printed trace.json>

--- End Trace ---

This trace contains only aggregate counts, enum values, and timing data.
No resource names, file paths, account IDs, or secrets are included.
```

Then output the single-line minified version for copy-paste:

```
--- Copy the line below and paste it into the "Migration trace (optional)" field ---

<trace.json as single-line minified JSON — no newlines, no extra whitespace>

--- End ---
```

Then provide the survey link:

```
Open the feedback form in your browser:
https://pulse.amazon/survey/JWX45QZH

Answer the 5 quick questions in the form, then paste the trace line above
into the "Migration trace (optional)" field and submit.
```

## Step 3: Write feedback.json

Write `$MIGRATION_DIR/feedback.json`:

```json
{
  "timestamp": "<ISO 8601>",
  "survey_url": "https://pulse.amazon/survey/JWX45QZH",
  "phases_completed_at_feedback": ["<list of completed phases>"],
  "trace_included": true
}
```

If trace building failed: set `"trace_included": false`.

## Step 4: Update Phase Status

Use the Phase Status Update Protocol (Write tool) to write `.phase-status.json` with `phases.feedback` set to `"completed"` — **in the same turn** as the output message below.

Output to user: "Thank you for helping improve this tool."

After feedback completes, return control to the workflow execution in POWER.md. The calling checkpoint determines whether to advance to the next phase or end the migration.

## Generate Ai

# Generate Phase: AI Migration Plan

> Loaded by generate.md when estimation-ai.json exists.

**Execute ALL steps in order. Do not skip or optimize.**

## Prerequisites

Read from `$MIGRATION_DIR/`:

- `aws-design-ai.json` (REQUIRED) — AI architecture design from Phase 3
- `estimation-ai.json` (REQUIRED) — AI cost estimates from Phase 4
- `ai-workload-profile.json` (REQUIRED) — AI workload profile from Phase 1
- `preferences.json` (REQUIRED) — User migration preferences from Phase 2

If any required file is missing: **STOP**. Output: "Missing required artifact: [filename]. Complete the prior phase that produces it."

## Part 1: Fast-Track Timeline

Check `preferences.json` → `ai_constraints.ai_framework` to determine timeline:

**Gateway users (1-3 days)** — `ai_framework` includes `llm_router`, `api_gateway`, `voice_platform`, or `framework`:

| Gateway Type                      | Migration Action                                              | Effort            |
| --------------------------------- | ------------------------------------------------------------- | ----------------- |
| LLM Router (LiteLLM, OpenRouter)  | Change model string to `bedrock/<model_id>`                   | 1 config line     |
| API Gateway (Kong, Apigee)        | Add Bedrock upstream + SigV4 signing                          | 1-2 config files  |
| Voice Platform (Vapi, Bland.ai)   | Check native Bedrock support, update dashboard                | Dashboard config  |
| Framework (LangChain, LlamaIndex) | Swap provider import (e.g., `ChatBedrock` for `ChatVertexAI`) | 1-5 lines of code |

**Direct SDK users (1-3 weeks)** — `ai_framework` = `direct`:

- **Week 1:** Enable Bedrock access, create IAM role, develop provider adapter with feature flag, unit test
- **Week 2:** Deploy to staging, run A/B comparison, measure latency/quality/cost, tune prompts
- **Week 3:** Gradual rollout (10% → 50% → 100%), monitor, disable source provider after 48h stable

**Timeline adjustments:** Single model = shorter; multiple models = +1 week; framework integration = 1-2 weeks; custom inference pipeline = 3 weeks; if alongside infra migration, align with Weeks 3-8.

---

## Part 2: Step-by-Step Migration Guide

Based on `ai-workload-profile.json` → `integration.pattern` and `integration.languages`, generate SDK migration examples.

**Migration patterns to include (matched to detected language and source):**

| Source SDK         | Target                            | Key Change                                                       |
| ------------------ | --------------------------------- | ---------------------------------------------------------------- |
| Vertex AI (Python) | boto3 Bedrock Converse API        | `GenerativeModel.generate_content()` → `bedrock.converse()`      |
| Vertex AI (JS)     | @aws-sdk/client-bedrock-runtime   | `model.generateContent()` → `client.send(new ConverseCommand())` |
| Vertex AI (Go)     | aws-sdk-go-v2 bedrockruntime      | `aiplatform` → `bedrockruntime.Converse()`                       |
| Vertex AI (Java)   | AWS SDK BedrockRuntimeClient      | `GenerativeModel` → `BedrockRuntimeClient.converse()`            |
| OpenAI SDK         | boto3 Bedrock Converse API        | `client.chat.completions.create()` → `bedrock.converse()`        |
| LiteLLM            | LiteLLM config change             | `model="gpt-4o"` → `model="bedrock/anthropic.claude-sonnet-4-6"` |
| LangChain          | langchain_aws                     | `ChatOpenAI`/`ChatVertexAI` → `ChatBedrock`                      |
| LlamaIndex         | llama_index.llms.bedrock_converse | `Vertex` → `BedrockConverse`                                     |

For each detected language and pattern, generate before/after code examples using actual model IDs from `aws-design-ai.json`.

Include streaming migration (`converse_stream`) if `capabilities_summary.streaming = true`.

Include embeddings migration (Titan Embeddings v2 via `invoke_model`) if `capabilities_summary.embeddings = true`.

---

## Part 3: Rollback Plan

**Feature flag strategy:** `AI_PROVIDER` env var controls routing:

- `vertex_ai` (default) — existing provider
- `bedrock` — switch to Bedrock
- `shadow` — send to both, return source response (for comparison)

**Rollback triggers:** quality below threshold, P95 latency > 2x baseline, error rate > 1% for 5 min, cost per request > 3x source.

**Rollback steps:** Set `AI_PROVIDER=vertex_ai` (instant), verify source traffic, monitor 1 hour, investigate, re-attempt.

---

## Part 4: Monitoring and Observability

**Key metrics and alert thresholds:**

| Metric            | Alert Threshold                | Severity |
| ----------------- | ------------------------------ | -------- |
| Error rate        | > 5% for 2 min → auto-rollback | Critical |
| Latency P95       | > 3x baseline for 5 min        | High     |
| Daily cost        | > 2x projected                 | Medium   |
| Token usage trend | > 120% of estimate             | Low      |
| Response quality  | < 90% of source score          | High     |

**Dashboard panels:** Request volume by provider, latency comparison (P50/P95/P99), error rates, token usage, cost tracking, quality scores.

---

## Part 5: Production Readiness Checklist

- [ ] Bedrock model access enabled
- [ ] IAM role with `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream`
- [ ] Provider adapter deployed and tested in staging
- [ ] A/B test with >= 100 representative prompts
- [ ] Response quality >= 90% of source baseline
- [ ] Latency P95 within 2x of source baseline
- [ ] Error rate < 0.1% in staging
- [ ] Monitoring dashboards and alerting active
- [ ] Rollback procedure documented and tested
- [ ] Cost estimates validated against staging usage

---

## Part 6: Success Criteria

| Category | Criteria            | Target                             |
| -------- | ------------------- | ---------------------------------- |
| Quality  | Response quality    | >= 90% of source baseline          |
| Quality  | Capability coverage | 100% of `ai-workload-profile.json` |
| Latency  | P50                 | Within 1.5x of source              |
| Latency  | P95                 | Within 2x of source                |
| Cost     | Monthly             | Within 20% of `estimation-ai.json` |
| Cost     | Per request         | Within 30% of source per-request   |

---

## Output

Write `generation-ai.json` to `$MIGRATION_DIR/`.

**Schema — top-level fields:**

| Field                            | Type   | Description                                                                           |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| `phase`                          | string | `"generate"`                                                                          |
| `generation_source`              | string | `"ai"`                                                                                |
| `timestamp`                      | string | ISO 8601                                                                              |
| `migration_plan`                 | object | `total_weeks`, `approach`, `phases[]` (name, week, activities), `models_to_migrate[]` |
| `step_by_step_guide`             | object | `languages[]`, `primary_pattern`, `files_to_modify[]`, `dependency_changes`           |
| `rollback_plan`                  | object | `mechanism`, `flag_name`, `default_value`, `rollback_time`, `triggers[]`              |
| `monitoring`                     | object | `dashboards[]`, `alerting_rules[]` (severity, condition, action)                      |
| `production_readiness_checklist` | array  | String checklist items (at least 5)                                                   |
| `success_criteria`               | object | `quality`, `latency`, `cost` sub-objects with targets                                 |
| `recommendation`                 | object | `approach`, `confidence`, `key_risks[]`, `estimated_total_effort_hours`               |

## Validation Checklist

- [ ] `migration_plan.models_to_migrate` covers all models from `aws-design-ai.json`
- [ ] `step_by_step_guide.languages` matches `ai-workload-profile.json` languages
- [ ] `step_by_step_guide.files_to_modify` matches `aws-design-ai.json` code_migration
- [ ] `rollback_plan.mechanism` is `"feature_flag"`
- [ ] `success_criteria` covers quality, latency, and cost

## Generate Phase Integration

The parent orchestrator (`generate.md`) uses `generation-ai.json` to:

1. Gate Stage 2 artifact generation — `generate-artifacts-ai.md` requires this file
2. Provide AI migration context to `generate-artifacts-docs.md` for MIGRATION_GUIDE.md
3. Set phase completion status in `.phase-status.json`

## Generate Artifacts Ai

# Generate Phase: AI Artifact Generation

> Loaded by generate.md when generation-ai.json and aws-design-ai.json exist.

**Execute ALL steps in order. Do not skip or optimize.**

## Overview

Generate migration artifacts from the AI migration plan and design. Artifacts vary by gateway type detected in discovery.

**Outputs (all users):**

- `ai-migration/setup_bedrock.sh` — Bedrock model access and IAM setup
- `ai-migration/test_comparison.py` — A/B test harness (always Python)

**Outputs (direct SDK users — `ai_framework` = `"direct"`):**

- `ai-migration/provider_adapter.{py,js,go}` — Provider abstraction with feature flag

**Outputs (gateway users — `ai_framework` != `"direct"`):**

- `ai-migration/gateway_config.{yaml,py,json}` — Gateway-specific configuration snippet

**Outputs (if user opted into model evaluation in generate-ai.md Part 0):**

- `ai-migration/eval-prompts.jsonl` — Evaluation prompt dataset
- `ai-migration/run-evaluation.sh` — Bedrock evaluation job script

## Prerequisites

Read from `$MIGRATION_DIR/`:

- `aws-design-ai.json` (REQUIRED) — AI architecture with model mappings and code migration plan
- `generation-ai.json` (REQUIRED) — AI migration plan with timeline and rollback strategy
- `ai-workload-profile.json` (REQUIRED) — AI workload profile with models, languages, and capabilities

If any required file is missing: **STOP**. Output: "Missing required artifact: [filename]. Complete the prior phase that produces it."

---

## Step 0: Determine Artifact Path

Check `preferences.json` → `ai_constraints.ai_framework.value`:

- `"direct"` or absent → Generate provider adapter (Step 1) + setup (Step 3) + test harness (Step 2)
- `"llm_router"`, `"api_gateway"`, `"voice_platform"`, or `"framework"` → Skip Step 1, generate gateway config (Step 3B) instead

**Determine language** (direct SDK users only): Read `ai-workload-profile.json` → `integration.languages` array. Use the first entry: `"python"` → `.py`, `"javascript"`/`"typescript"` → `.js`, `"go"` → `.go`, other/unknown → `.py`.

---

## Step 1: Generate Provider Adapter (Direct SDK Only)

Generate `ai-migration/provider_adapter.{py,js,go}` — an abstraction layer that lets the user switch between the source AI provider and Bedrock via an environment variable.

**Requirements:**

- Read `AI_PROVIDER` env var to select provider: `vertex_ai` (current), `bedrock` (target), `shadow` (both — return source response, log Bedrock response)
- Expose only the methods matching capabilities in `ai-workload-profile.json` → `integration.capabilities_summary`:
  - `text_generation: true` → `generate(prompt) → str`
  - `streaming: true` → `generate_stream(prompt) → Iterator[str]`
  - `embeddings: true` → `embed(text) → list[float]`
- **Source provider class**: Use SDK imports from `ai-workload-profile.json` → `integration.sdk_imports`. Use model IDs from `ai-workload-profile.json` → `models[].model_id`.
- **Bedrock provider class**: Use `boto3` Converse API (`converse` for generate, `converse_stream` for streaming, `invoke_model` for embeddings with Titan). Use model IDs from `aws-design-ai.json` → `ai_architecture.bedrock_models[].aws_model_id`. Use region from `preferences.json` → `design_constraints.target_region`.
- **Shadow mode**: Send requests to both providers, return source response, log Bedrock response for comparison.
- Include error handling and logging for API calls.

For JS: use `@aws-sdk/client-bedrock-runtime` + `@google-cloud/vertexai`. For Go: use `github.com/aws/aws-sdk-go-v2/service/bedrockruntime` + `cloud.google.com/go/aiplatform`.

---

## Step 2: Generate Test Comparison Harness

Generate `ai-migration/test_comparison.py` — always Python regardless of adapter language.

**Requirements:**

- Accept prompts from a JSON file (`--prompts`) or use built-in defaults (`--quick`)
- Run each prompt against both the source provider and Bedrock
- Measure per-prompt: latency (ms), success/failure, response text (truncated to 500 chars)
- Compute summary statistics: p50/p95/mean latency per provider, quality score (trait matching against expected traits), pass/fail criteria
- Pass criteria: Bedrock latency ≤ 2x source latency, mean quality score ≥ 0.9
- Output structured JSON to `--output` (default: `comparison_results.json`)
- Built-in test prompts: include 3-5 prompts based on `ai-workload-profile.json` → `models[].usage_context` covering the primary use case
- Import the provider adapter via `from provider_adapter import get_provider`

---

## Step 3: Generate Bedrock Setup Script

Generate `ai-migration/setup_bedrock.sh`.

**Requirements:**

- Dry-run by default (`--execute` flag to run for real)
- Step 1 — Request model access: List each model from `aws-design-ai.json` → `bedrock_models[].aws_model_id` and the embedding model
- Step 2 — Create IAM role: Trust policy for the compute platform (Lambda, ECS, or EC2 based on `aws-design.json` if present). Bedrock policy: `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` scoped to `arn:aws:bedrock:*::foundation-model/*`
- Step 3 — Print required environment variables: `AWS_REGION`, `AI_PROVIDER=bedrock`, model IDs
- Step 4 — Verification: Test Bedrock access with a simple `converse` call using the primary model
- If `$MIGRATION_DIR/terraform/` exists, print coordination note: "Ensure the IAM role is referenced in compute.tf task definitions"
- Use region from `preferences.json` → `design_constraints.target_region`

---

## Step 3B: Generate Gateway Configuration (Gateway Users Only)

Skip if `ai_framework` = `"direct"` or absent. Read `preferences.json` → `ai_constraints.ai_framework.value` to determine format.

**`"llm_router"`** → Generate `gateway_config.yaml` (LiteLLM format):

- Map each model from `aws-design-ai.json` to a `bedrock/MODEL_ID` entry with `aws_region_name`
- Include embedding model entry if embeddings are used
- Note required env vars: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`

**`"framework"`** → Generate `gateway_config.py`:

- Show before/after import swap for the detected framework (`ai-workload-profile.json` → `integration.sdk_imports`)
- LangChain: `langchain_google_vertexai` → `langchain_aws.ChatBedrock` (or `langchain_openai` → `langchain_aws.ChatBedrock`)
- LlamaIndex: `llama_index.llms.vertex` → `llama_index.llms.bedrock_converse`
- Include pip install note for the AWS package

**`"voice_platform"`** → Generate `gateway_config.json`:

- Dashboard configuration steps: add Bedrock as provider, set model ID, set region, test before switching production
- Include the Bedrock model ID and region from design artifacts

**`"api_gateway"`** → Generate `gateway_config.yaml`:

- Upstream URL: `https://bedrock-runtime.{region}.amazonaws.com`
- Auth: AWS SigV4 signing for the `bedrock` service
- Note: Converse API endpoint is `POST /model/{modelId}/converse`
- Include gateway-specific notes (Kong plugin, Apigee policy)

---

## Step 3C: Generate Evaluation Artifacts (If User Opted In)

Skip if the user did not opt into model evaluation in `generate-ai.md` Part 0.

**`eval-prompts.jsonl`**: Generate 10-20 domain-specific prompts in JSONL format (`{"prompt": "...", "referenceResponse": "", "category": "..."}`). Base prompts on `ai-workload-profile.json` → `models[].usage_context`. Include function-calling prompts if `capabilities_summary.function_calling` is true, retrieval prompts if RAG patterns were detected. Include 2-3 edge case prompts.

**`run-evaluation.sh`**: Dry-run by default. Creates S3 bucket, uploads prompts, calls `aws bedrock create-evaluation-job` with model IDs from `aws-design-ai.json`, downloads results. Use the same model IDs and region as `setup_bedrock.sh`.

---

## Step 4: Self-Check

Verify all generated artifacts:

- [ ] Provider adapter (or gateway config) uses actual model IDs from `aws-design-ai.json` — no placeholders
- [ ] Only capabilities present in `capabilities_summary` have methods/tests generated
- [ ] Feature flag (`AI_PROVIDER` env var) controls provider selection in adapter
- [ ] Test harness includes domain-specific prompts from `usage_context`
- [ ] Test harness produces structured JSON output with latency and quality metrics
- [ ] Setup script has correct region from `preferences.json`
- [ ] Setup script IAM role follows least privilege
- [ ] All scripts default to dry-run mode
- [ ] Evaluation artifacts (if generated) have correct model IDs and region
- [ ] No hardcoded credentials in any file

## Phase Completion

Report generated files to the parent orchestrator. **Do NOT update `.phase-status.json`** — the parent `generate.md` handles phase completion.

Output:

```
Generated AI migration artifacts:
- ai-migration/setup_bedrock.sh
- ai-migration/test_comparison.py
- ai-migration/provider_adapter.{py|js|go}    # Direct SDK users only
- ai-migration/gateway_config.{yaml|py|json}  # Gateway users only
- ai-migration/eval-prompts.jsonl              # If evaluation opted in
- ai-migration/run-evaluation.sh               # If evaluation opted in

Gateway type: [ai_framework value]
Language: [detected language]
Models to migrate: [count] models
Capabilities covered: [list from capabilities_summary]
```

## Generate Artifacts Billing

# Generate Phase: Billing Skeleton Artifact Generation

> Loaded by generate.md when generation-billing.json and aws-design-billing.json exist.

**Execute ALL steps in order. Do not skip or optimize.**

## Overview

Generate **skeleton Terraform** with TODO markers for billing-only migrations. These configurations are NOT deployable as-is — they require manual configuration refinement based on actual infrastructure discovery.

Every resource block includes TODO markers indicating what is missing and where to get it.

## Prerequisites

Read from `$MIGRATION_DIR/`:

- `aws-design-billing.json` (REQUIRED) — Billing-based service mapping from Phase 3
- `generation-billing.json` (REQUIRED) — Conservative migration plan from Stage 1

If any required file is missing: **STOP**. Output: "Missing required artifact: [filename]. Complete the prior phase that produces it."

## Output Structure

| File           | When                                 | Contains                               |
| -------------- | ------------------------------------ | -------------------------------------- |
| `main.tf`      | Only if infra track didn't create it | Provider config, backend, data sources |
| `variables.tf` | Only if infra track didn't create it | Inferred variables with TODO markers   |
| `skeleton.tf`  | Always                               | Resource stubs with TODO markers       |

Do NOT overwrite existing `main.tf` or `variables.tf` if the infrastructure track already generated them.

## Step 0: Read Design Inputs

From `aws-design-billing.json`: `services[]` (mapped), `unknowns[]` (unmapped), `metadata.total_services`, `metadata.confidence_note`.

From `generation-billing.json`: migration timeline (for header comments), risk level (for confidence tags).

## Step 1: Generate main.tf (if not present)

**Requirements:**

- Header comment block: "SKELETON TERRAFORM — BILLING-ONLY MIGRATION", WARNING about TODO markers, confidence LOW, action required note
- `terraform` block: `required_version >= 1.5.0`, `hashicorp/aws ~> 5.0`, commented S3 backend
- `provider "aws"` block: `region = var.aws_region`, `default_tags` with Project, Environment, ManagedBy, `Confidence = "billing-only-skeleton"`
- Data sources: `aws_caller_identity`, `aws_region`, `aws_availability_zones`

## Step 2: Generate variables.tf (if not present)

**Global variables:** `aws_region` (from preferences.json), `project_name`, `environment`.

**Per-service variables:** For each mapped service in `aws-design-billing.json.services[]`, create variables with:

- **Known defaults** get a `# Verify` comment
- **Unknown values** get a `# TODO` comment with placeholder
- Use billing SKU hints to inform reasonable defaults where possible

Header comment: "Many values are placeholders. Search for TODO to find values needing manual configuration."

## Step 3: Generate skeleton.tf

For each mapped service in `aws-design-billing.json.services[]`, generate a resource stub.

**Every resource block must include:**

- Header comment: AWS service name, GCP source, confidence level, monthly GCP cost, SKU hints
- `# TODO: Verify all configuration values against actual GCP resource settings`
- At least one `# TODO` per configurable attribute
- Tags: Name, GCPSource, `Confidence = "billing-inferred"`

**Resource generation by GCP service type:**

| GCP Service          | AWS Resource Type                   | Key TODO Attributes                                  |
| -------------------- | ----------------------------------- | ---------------------------------------------------- |
| Cloud Run, GCE, GKE  | ECS cluster + task def              | CPU, memory, container image, port, auto-scaling     |
| Cloud SQL            | RDS instance                        | Engine, version, instance class, storage, networking |
| Spanner, Firestore   | DynamoDB / Aurora                   | Capacity, schema, access patterns                    |
| Cloud Storage        | S3 bucket + versioning + encryption | Bucket count, storage classes, lifecycle policies    |
| Cloud Load Balancing | VPC + ALB                           | CIDR, subnets, security groups, listeners            |
| Cloud DNS            | Route 53                            | Zone names, record types                             |
| Cloud NAT            | NAT Gateway                         | Subnet associations                                  |

For compute stubs: include ECS cluster + task definition with `FARGATE` compatibility, `awsvpc` network mode, `awslogs` log configuration.

For database stubs: include `storage_encrypted = true`, `skip_final_snapshot = true # TODO: Set to false for production`.

For storage stubs: include bucket with account ID suffix, versioning enabled, SSE-KMS encryption.

**Unmapped services:** At the bottom of `skeleton.tf`, add a comment block for each service in `unknowns[]` with: service name, monthly cost, reason unmapped, possible AWS target suggestion, TODO marker.

## Step 4: Self-Check

- [ ] Every mapped service has a resource stub in `skeleton.tf`
- [ ] Every resource has at least one `# TODO` comment
- [ ] No resource is presented as production-ready — all have confidence markers
- [ ] Skeleton warning header present at top of `main.tf` and `skeleton.tf`
- [ ] No hardcoded credentials
- [ ] Tags include `Confidence = "billing-inferred"` on every resource
- [ ] Unmapped services from `unknowns[]` listed at bottom
- [ ] Did not overwrite existing `main.tf` or `variables.tf` from infrastructure track

## Phase Completion

Report generated files to the parent orchestrator. **Do NOT update `.phase-status.json`** — the parent `generate.md` handles phase completion.

```
Generated billing skeleton artifacts:
- terraform/skeleton.tf (with TODO markers)
- terraform/main.tf (if not already present)
- terraform/variables.tf (if not already present)

WARNING: These are SKELETON configurations generated from billing data only.
They are NOT deployable without manual configuration.
TODO markers: [N] items requiring manual configuration
Unmapped services: [N] services need manual AWS target assignment

Recommendation: Provide Terraform files and re-run discovery for deployable configurations.
```

## Generate Artifacts Docs

# Generate Phase: Documentation Generation

> Loaded by generate.md LAST, after all other artifact generation sub-files complete.

**Execute ALL steps in order. Do not skip or optimize.**

## Overview

Produce comprehensive migration documentation from all generated artifacts. This runs LAST because it references all previously generated plans and artifacts.

**Outputs:**

- `MIGRATION_GUIDE.md` — Step-by-step migration guide organized by phase
- `README.md` — Quick start, artifact catalog, and architecture overview

## Prerequisites

At least one generation JSON must exist in `$MIGRATION_DIR/`:

- `generation-infra.json` (infrastructure migration plan)
- `generation-ai.json` (AI migration plan)
- `generation-billing.json` (billing-only migration plan)

Scan for all generated artifacts:

- `terraform/` directory (Terraform configurations)
- `scripts/` directory (migration scripts)
- `ai-migration/` directory (AI provider adapter and test harness)

If **no** generation JSON exists: **STOP**. Output: "No migration plans found. Stage 1 of Generate phase did not complete."

## Output Structure

```
$MIGRATION_DIR/
├── MIGRATION_GUIDE.md     # Detailed step-by-step migration guide
└── README.md              # Quick reference and artifact catalog
```

## Step 1: Generate MIGRATION_GUIDE.md

Build a phase-based migration guide that adapts sections based on which tracks ran.

### Document Structure

The MIGRATION_GUIDE.md follows this structure:

- Title: `# GCP to AWS Migration Guide`
- Subtitle: `> Generated by GCP to AWS Migration Advisor`
- Table of Contents (auto-generated from sections)
- Section 1: Prerequisites (always included)

#### Prerequisites Section Content

Include these checklists:

- AWS Account Setup: account created, IAM user, AWS CLI, Terraform >= 1.5.0
- GCP Access: project access, gcloud CLI, service account with export permissions
- Tools Required: terraform, aws-cli, gcloud, docker, jq
- If AI track ran: add python >= 3.9, boto3

### Conditional Sections

#### IF infrastructure track ran (generation-infra.json exists)

Generate the following sections:

**Section 2: Infrastructure Setup** — Deploy AWS Infrastructure subsection with numbered steps:

1. Review Terraform configurations in `terraform/` (main.tf, variables.tf, domain .tf files)
1. Initialize and plan: `cd terraform/ && terraform init && terraform plan -out=migration.tfplan`
1. Review the plan output carefully before applying
1. Apply: `terraform apply migration.tfplan`

Post-Infrastructure Tasks checklist: verify resources, check security groups, validate IAM roles.

**Section 3: Data Migration** — **Include ONLY if `scripts/02-migrate-data.sh`,
`scripts/03-migrate-containers.sh`, or `scripts/04-migrate-secrets.sh` exist.**
If NONE of these scripts were generated, skip Section 3 entirely.

Include only subsections for scripts that were generated:

Database Migration subsection (only if `scripts/02-migrate-data.sh` exists) with numbered steps:

1. Run prerequisites check: `./scripts/01-validate-prerequisites.sh`
1. Execute data migration (dry run first): `./scripts/02-migrate-data.sh` then `./scripts/02-migrate-data.sh --execute`
1. Validate data integrity: `./scripts/05-validate-migration.sh`

Container Image Migration (only if `scripts/03-migrate-containers.sh` exists): `./scripts/03-migrate-containers.sh` (dry run, then `--execute`)

Secrets Migration (only if `scripts/04-migrate-secrets.sh` exists): `./scripts/04-migrate-secrets.sh` (dry run, then `--execute`)

**Section 4: Service Migration** — Per-cluster migration steps from generation-infra.json, organized by creation_order depth.

#### IF AI track ran (generation-ai.json exists)

Generate the following section:

**Section 5: AI Migration** with subsections:

- Setup Bedrock Access: run `./setup_bedrock.sh`, enable model access in AWS Console
- Deploy Provider Adapter: review adapter file, update TODO markers, deploy with application
- Run A/B Comparison: `python ai-migration/test_comparison.py --quick`, review results, verify quality >= 90%
- Gradual Rollout: shadow mode, 10% traffic, scale to 100%, disable Vertex AI after 48 hours stable

#### IF billing-only track ran (generation-billing.json exists)

Generate the following section:

**Section 2: Billing-Only Limitations** — Include blockquote warning that the plan was generated from billing data only. Before Proceeding subsection recommending IaC discovery or manual audit. Using the Skeleton Terraform subsection with steps to find and resolve TODO markers.

### Common Sections (always included)

**Cutover section** with subsections:

- Pre-Cutover Checklist (from generation plan)
- Execute Cutover (DNS switch, traffic migration, monitoring)
- Post-Cutover Monitoring (24-48 hour watch, then 30-day monitoring)

**Validation and Cleanup section** with subsections:

- Validation Steps checklist: services responding, performance thresholds, data integrity, cost tracking
- GCP Teardown checklist (after stability period): archive data, delete resources, disable billing

**Troubleshooting section** with a Common Issues table:

| Issue                        | Cause                      | Resolution                                 |
| ---------------------------- | -------------------------- | ------------------------------------------ |
| Terraform apply fails        | Missing permissions        | Check IAM role has required policies       |
| Database connection refused  | Security group rules       | Verify inbound rules allow app subnet CIDR |
| Container image pull fails   | ECR authentication         | Run `aws ecr get-login-password`           |
| Bedrock InvokeModel fails    | Model access not enabled   | Enable in AWS Console                      |
| High latency after migration | Suboptimal instance sizing | Review CloudWatch metrics and right-size   |

Rollback Procedure subsection (from generation plan — rollback triggers, steps, and RTO).

### Footer

End the document with:

```
---
Generated by GCP to AWS Migration Advisor
```

## Step 2: Generate README.md

Build a quick-reference README for the migration artifacts.

### README Structure

The README.md follows this structure:

- Title: `# GCP to AWS Migration Artifacts`
- Subtitle: `> Generated by GCP to AWS Migration Advisor`

#### Quick Start

Numbered steps:

1. Review the Migration Guide (link to MIGRATION_GUIDE.md)
1. Deploy infrastructure: `cd terraform/ && terraform init && terraform plan`
1. Run migration scripts: `./scripts/01-validate-prerequisites.sh`
1. If AI track ran: Set up AI: `cd ai-migration/ && ./setup_bedrock.sh`

#### Artifact Catalog

Table with columns: Artifact, Description, Status. List all generated files/directories.

Subsections:

- Migration Plans (Stage 1): list generation-*.json files
- Infrastructure (Stage 2): list .tf files and migration scripts if they exist
- AI Migration (Stage 2): list adapter, test harness, setup script if they exist
- Documentation: MIGRATION_GUIDE.md and README.md

#### Architecture Overview

- Source (GCP): list GCP services from design artifacts
- Target (AWS): list AWS services from design artifacts with region
- Migration Approach: summary from generation plans (phased/fast-track/conservative)

#### Cost Summary

Table from estimation artifacts with: Current GCP Monthly, Projected AWS Monthly, Annual Savings (or Increase), Timeline.

#### Key Decisions

Bullet list from design and generation artifacts: Compute, Database, Storage, and AI/ML (if applicable) with GCP service, AWS service, and rationale.

#### TODO Items

Include a command to find all TODO markers:

```bash
grep -rn "TODO" terraform/ scripts/ ai-migration/ 2>/dev/null
```

#### Footer

End with: `Generated by GCP to AWS Migration Advisor`

### Populate from artifacts

- **Artifact catalog**: List all files actually generated (check for directory/file existence)
- **Architecture overview**: Extract from `aws-design.json`, `aws-design-ai.json`, or `aws-design-billing.json`
- **Cost summary**: Extract from `estimation-infra.json`, `estimation-ai.json`, or `estimation-billing.json`
- **Key decisions**: Extract from design artifact `rationale` fields
- **Timeline**: Extract from `generation-*.json` `migration_plan.total_weeks`

## Step 3: Self-Check

After generating documentation, verify:

1. **All file references are valid**: Every file path mentioned in MIGRATION_GUIDE.md exists in the artifact directory
1. **Commands are syntactically correct**: All bash commands use correct syntax
1. **No unresolved placeholders**: All `[placeholder]` values are replaced with actual data from artifacts
1. **Conditional sections match**: Only sections for tracks that actually ran are included
1. **TODO count is accurate**: Count matches actual TODO markers in generated artifacts
1. **Cost figures match**: Values in README.md match estimation artifacts
1. **Timeline matches**: Week counts match generation plan artifacts
1. **Rollback instructions match**: Rollback steps match generation plan

## Phase Completion

Report the list of generated files to the parent orchestrator. **Do NOT update `.phase-status.json`** — the parent `generate.md` handles phase completion.

Output:

```
Generated documentation:
- MIGRATION_GUIDE.md ([N] sections, covering [tracks that ran])
- README.md (artifact catalog, architecture overview, cost summary)

Sections included:
- [List which conditional sections were generated based on tracks that ran]
```

## Generate Artifacts Infra

# Generate Phase: Infrastructure Artifact Generation

> Loaded by generate.md when generation-infra.json and aws-design.json exist.

**Execute ALL steps in order. Do not skip or optimize.**

## Overview

Transform the design (`aws-design.json`) and migration plan (`generation-infra.json`) into deployable Terraform configurations. Migration scripts are generated separately by `generate-artifacts-scripts.md`.

## Prerequisites

Read from `$MIGRATION_DIR/`:

- `aws-design.json` (REQUIRED) — AWS architecture design with cluster-level resource mappings
- `generation-infra.json` (REQUIRED) — Migration plan with timeline and service assignments
- `preferences.json` (REQUIRED) — User preferences including target region, sizing, compliance
- `gcp-resource-clusters.json` (REQUIRED) — Cluster dependency graph for ordering

Reference files (read as needed): `steering/design-ref-index.md` and domain-specific files (`steering/design-ref-compute.md`, `steering/design-ref-database.md`, `steering/design-ref-storage.md`, `steering/design-ref-networking.md`, `steering/design-ref-messaging.md`, `steering/design-ref-ai.md`).

If any REQUIRED file is missing: **STOP**. Output: "Missing required artifact: [filename]. Complete the prior phase that produces it."

## Output Structure

Generate `$MIGRATION_DIR/terraform/` with only the files needed for domains that have resources in `aws-design.json`:

| File            | Domain     | Contains                                         |
| --------------- | ---------- | ------------------------------------------------ |
| `main.tf`       | core       | Provider config, backend, data sources           |
| `variables.tf`  | core       | All input variables with types and defaults      |
| `outputs.tf`    | core       | Resource outputs and migration summary           |
| `vpc.tf`        | networking | VPC, subnets, NAT, security groups, route tables |
| `security.tf`   | security   | IAM roles, policies, KMS keys                    |
| `storage.tf`    | storage    | S3 buckets, EFS, backup vaults                   |
| `database.tf`   | database   | RDS/Aurora instances, parameter groups           |
| `compute.tf`    | compute    | Fargate/ECS, Lambda, EC2                         |
| `monitoring.tf` | monitoring | CloudWatch dashboards, alarms, log groups        |

## Step 0: Plan Generation Scope

Build a generation manifest: read all resources from `aws-design.json` clusters, assign each to its target .tf file by `aws_service`:

| AWS Service                                           | Target File     |
| ----------------------------------------------------- | --------------- |
| VPC, Subnet, NAT Gateway, Security Group, Route Table | `vpc.tf`        |
| IAM Role, IAM Policy, KMS Key                         | `security.tf`   |
| S3, EFS, Backup Vault                                 | `storage.tf`    |
| RDS, Aurora, DynamoDB, ElastiCache                    | `database.tf`   |
| Fargate, ECS, Lambda, EC2                             | `compute.tf`    |
| CloudWatch, SNS (for alarms)                          | `monitoring.tf` |

## Step 1: Generate main.tf

**Requirements:**

- `terraform` block: `required_version >= 1.5.0`, `hashicorp/aws ~> 5.0`, commented S3 backend
- `provider "aws"` block: `region = var.aws_region`, `default_tags` with Project, Environment, ManagedBy, MigrationId
- Data sources: `aws_caller_identity`, `aws_region`, `aws_availability_zones`

## Step 2: Generate variables.tf

**Global variables (always include):** `aws_region` (from `preferences.json` target_region), `project_name`, `environment` (from `preferences.json`), `migration_id`.

**Per-cluster variables:** Extract configurable values from `aws_config` in `aws-design.json`. Infer types (`string`, `number`, `bool`, `list(string)`, `map(string)`). Use `aws_config` values as defaults. Deduplicate shared variables. Add GCP source as comment (e.g., `# GCP source: db-custom-2-7680`).

## Step 3: Generate Per-Domain .tf Files

For each domain with resources in the generation manifest:

**General rules:**

- Consult `steering/design-ref-*.md` for AWS configuration best practices
- A single GCP resource may map to multiple AWS resources (1:Many expansion)
- Use `gcp_config` values from `aws-design.json` to populate resource attributes
- For `confidence: "inferred"` resources, add comment: `# Inferred mapping — verify configuration`
- Include `secondary_resources` from the cluster (IAM roles, security groups)
- Tag every resource: Project, Environment, ManagedBy, MigrationId

**Domain-specific rules:**

| Domain     | Key Rules                                                                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Networking | At least 2 AZs; public + private subnets; NAT gateway for private subnet internet                                             |
| Security   | Least-privilege IAM (specific ARNs, never wildcards); per-service roles for Fargate/Lambda                                    |
| Storage    | Versioning enabled; SSE-S3 or SSE-KMS encryption; block public access; lifecycle policies                                     |
| Database   | Private subnets; subnet group + parameter group + security group; backups; encryption                                         |
| Compute    | Fargate in private subnets; task definitions from `aws_config` CPU/memory; auto-scaling                                       |
| Monitoring | Log groups per service; dashboard with key metrics; alarms from `generation-infra.json` success_metrics; 30-day log retention |

## Step 4: Generate outputs.tf

Output identifiers for key resources (VPC ID, database endpoint, ECS cluster name, etc.) plus a `migration_summary` output with region, VPC ID, environment, service count, and migration ID.

## Step 5: Self-Check

Verify these quality rules before reporting completion:

- [ ] No wildcard IAM policies (`"Action": "*"` or `"Resource": "*"`)
- [ ] No default VPC references — all resources use the created VPC
- [ ] No hardcoded credentials in any .tf file
- [ ] Tags on every resource (Project, Environment, ManagedBy, MigrationId)
- [ ] Encryption at rest on all storage (S3, EBS, RDS)
- [ ] Databases and internal services use private subnets
- [ ] No `0.0.0.0/0` ingress except ALB port 443
- [ ] Every variable has `type` and `description`
- [ ] Every output has `description`
- [ ] Region from `var.aws_region`, never hardcoded

## Phase Completion

Report generated files to the parent orchestrator. **Do NOT update `.phase-status.json`** — the parent `generate.md` handles phase completion.

```
Generated terraform artifacts:
- terraform/main.tf
- terraform/variables.tf
- terraform/outputs.tf
- terraform/[domain].tf (for each domain with resources)

Total: [N] Terraform files
TODO markers: [N] items requiring manual configuration
```

## Generate Artifacts Scripts

# Generate Phase: Migration Script Generation

> Loaded by generate.md after generate-artifacts-infra.md completes (terraform files generated).

**Execute ALL steps in order. Do not skip or optimize.**

## Overview

Transform the migration plan (`generation-infra.json`) into numbered migration scripts for data, container, secrets, and validation tasks.

**Outputs:**

- `scripts/` directory — Numbered migration scripts for data and service migration

## Prerequisites

Read the following artifacts from `$MIGRATION_DIR/`:

- `aws-design.json` (REQUIRED) — AWS architecture design with cluster-level resource mappings
- `generation-infra.json` (REQUIRED) — Migration plan with timeline and service assignments
- `preferences.json` (REQUIRED) — User preferences including target region, sizing, compliance

If any REQUIRED file is missing: **STOP**. Output: "Missing required artifact: [filename]. Complete the prior phase that produces it."

## Step 1: Detect Resource Categories

Scan `aws-design.json` clusters[].resources[] to determine which resource categories exist.
Set boolean flags for downstream script generation:

- **has_databases**: true if ANY resource has `aws_service` containing "RDS", "Aurora", "DynamoDB",
  "ElastiCache", "Redshift" OR `gcp_type` starting with `google_sql_`, `google_firestore_`,
  `google_bigtable_`, `google_bigquery_`, `google_redis_`
- **has_storage**: true if ANY resource has `aws_service` = "S3" OR `gcp_type` = `google_storage_bucket`
- **has_containers**: true if ANY resource has `aws_service` containing "Fargate", "ECS", "EKS"
  OR `gcp_type` starting with `google_cloud_run_`, `google_container_cluster`
- **has_secrets**: true if ANY resource has `aws_service` containing "Secrets Manager"
  OR `gcp_type` starting with `google_secret_manager_`
- **has_data_migration**: has_databases OR has_storage (used for script 02)

Report detected categories to user: "Resource categories detected: [list active flags]"

## Output Structure

Scripts 02-04 are generated **only** when the corresponding resource categories are detected:

```
$MIGRATION_DIR/
├── scripts/
│   ├── 01-validate-prerequisites.sh          # Always
│   ├── 02-migrate-data.sh                    # Only if has_data_migration
│   ├── 03-migrate-containers.sh              # Only if has_containers
│   ├── 04-migrate-secrets.sh                 # Only if has_secrets
│   └── 05-validate-migration.sh              # Always (adapts checks)
```

## Step 2: Generate Migration Scripts

### Script Rules

- Every script defaults to **dry-run mode** — requires `--execute` flag to make changes
- Every script includes a verification step after execution
- Scripts are numbered for execution order
- Scripts use `set -euo pipefail` for safety
- Scripts log all actions to `$MIGRATION_DIR/logs/`

### 01-validate-prerequisites.sh

Verify all prerequisites before migration:

- AWS CLI configured and authenticated
- Required IAM permissions present
- Target VPC and subnets exist (Terraform applied)
- GCP connectivity established (for data transfer)
- Required tools installed (aws, gcloud, terraform, jq)

### 02-migrate-data.sh — IF has_data_migration

**Skip this script entirely if `has_data_migration` is false.**

Based on database and storage resources in `aws-design.json`:

**Cloud SQL to RDS/Aurora** — include only if `has_databases`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Cloud SQL → RDS data migration
# Usage: ./02-migrate-data.sh [--execute]

DRY_RUN=true
[[ "${1:-}" == "--execute" ]] && DRY_RUN=false

echo "=== Database Migration: Cloud SQL → RDS ==="
echo "Mode: $([ "$DRY_RUN" = true ] && echo 'DRY RUN' || echo 'EXECUTE')"

# TODO: Configure source and target connection details
SOURCE_HOST="<cloud-sql-ip>"      # TODO: Set Cloud SQL IP
TARGET_HOST="<rds-endpoint>"       # From terraform output database_endpoint
DATABASE_NAME="<database>"         # TODO: Set database name

if [ "$DRY_RUN" = true ]; then
  echo "[DRY RUN] Would export from Cloud SQL: $SOURCE_HOST"
  echo "[DRY RUN] Would import to RDS: $TARGET_HOST"
  echo "[DRY RUN] Database: $DATABASE_NAME"
else
  # Export from Cloud SQL
  echo "Exporting from Cloud SQL..."
  gcloud sql export sql "$SOURCE_HOST" "gs://migration-bucket/export.sql" \
    --database="$DATABASE_NAME"

  # Import to RDS
  echo "Importing to RDS..."
  # TODO: Use pg_restore, mysql, or appropriate tool for your database engine
  # psql -h "$TARGET_HOST" -U admin -d "$DATABASE_NAME" < export.sql
fi

# Verification
echo "=== Verification ==="
echo "TODO: Compare row counts between source and target"
echo "TODO: Run checksum validation on critical tables"
```

**BigQuery to S3** — include only if `has_databases`:

```bash
# BigQuery → S3 data export
# TODO: Configure BigQuery dataset and S3 bucket
# bq extract --destination_format=PARQUET 'dataset.table' 'gs://bucket/export/'
# aws s3 sync gs://bucket/export/ s3://target-bucket/import/
```

**Firestore to DynamoDB** — include only if `has_databases`:

```bash
# Firestore → DynamoDB migration
# TODO: Use AWS DMS or custom export/import script
```

### 03-migrate-containers.sh — IF has_containers

**Skip this script entirely if `has_containers` is false.**

Migrate container images from GCR/Artifact Registry to ECR:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Container image migration: GCR → ECR
# Usage: ./03-migrate-containers.sh [--execute]

DRY_RUN=true
[[ "${1:-}" == "--execute" ]] && DRY_RUN=false

AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION="us-east-1"  # From preferences.json target_region
ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# TODO: List container images from aws-design.json compute resources
IMAGES=(
  "gcr.io/project/image1:latest"
  # Add more images from your GCP container registry
)

for IMAGE in "${IMAGES[@]}"; do
  IMAGE_NAME=$(echo "$IMAGE" | rev | cut -d'/' -f1 | rev | cut -d':' -f1)
  IMAGE_TAG=$(echo "$IMAGE" | rev | cut -d':' -f1 | rev)

  if [ "$DRY_RUN" = true ]; then
    echo "[DRY RUN] Would migrate: $IMAGE → $ECR_REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
  else
    echo "Creating ECR repository: $IMAGE_NAME"
    aws ecr create-repository --repository-name "$IMAGE_NAME" --region "$AWS_REGION" 2>/dev/null || true

    echo "Pulling from GCR: $IMAGE"
    docker pull "$IMAGE"

    echo "Tagging for ECR: $ECR_REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
    docker tag "$IMAGE" "$ECR_REGISTRY/$IMAGE_NAME:$IMAGE_TAG"

    echo "Pushing to ECR..."
    aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"
    docker push "$ECR_REGISTRY/$IMAGE_NAME:$IMAGE_TAG"
  fi
done

# Verification
echo "=== Verification ==="
echo "Listing ECR repositories..."
aws ecr describe-repositories --region "$AWS_REGION" --query 'repositories[].repositoryName' --output table
```

### 04-migrate-secrets.sh — IF has_secrets

**Skip this script entirely if `has_secrets` is false.**

Migrate secrets from GCP Secret Manager to AWS Secrets Manager:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Secrets migration: GCP Secret Manager → AWS Secrets Manager
# Usage: ./04-migrate-secrets.sh [--execute]

DRY_RUN=true
[[ "${1:-}" == "--execute" ]] && DRY_RUN=false

# TODO: List secrets to migrate
SECRETS=(
  "database-password"
  "api-key"
  # Add more secrets from your GCP project
)

for SECRET_NAME in "${SECRETS[@]}"; do
  if [ "$DRY_RUN" = true ]; then
    echo "[DRY RUN] Would migrate secret: $SECRET_NAME"
  else
    echo "Reading secret from GCP: $SECRET_NAME"
    SECRET_VALUE=$(gcloud secrets versions access latest --secret="$SECRET_NAME")

    echo "Creating secret in AWS: $SECRET_NAME"
    aws secretsmanager create-secret \
      --name "$SECRET_NAME" \
      --secret-string "$SECRET_VALUE" \
      --tags Key=MigrationSource,Value=gcp-secret-manager 2>/dev/null || \
    aws secretsmanager put-secret-value \
      --secret-id "$SECRET_NAME" \
      --secret-string "$SECRET_VALUE"
  fi
done

# Verification
echo "=== Verification ==="
aws secretsmanager list-secrets --query 'SecretList[].Name' --output table
```

### 05-validate-migration.sh

Post-migration validation script. **Always generated**, but adapt checks based on which resource
categories were detected in Step 1. Only include validation sections for resources that exist.

```bash
#!/usr/bin/env bash
set -euo pipefail

# Post-migration validation
# Usage: ./05-validate-migration.sh

echo "=== Migration Validation ==="

# Check Terraform state (always included)
echo "--- Terraform Resources ---"
cd terraform/
terraform state list | wc -l
echo "resources in Terraform state"

# --- Include ONLY if has_containers ---
# Check ECS services
echo "--- ECS Services ---"
aws ecs list-services --cluster "${PROJECT_NAME:-gcp-migration}" --query 'serviceArns' --output table 2>/dev/null || echo "No ECS cluster found"

# --- Include ONLY if has_databases ---
# Check RDS instances
echo "--- RDS Instances ---"
aws rds describe-db-instances --query 'DBInstances[].{ID:DBInstanceIdentifier,Status:DBInstanceStatus,Endpoint:Endpoint.Address}' --output table 2>/dev/null || echo "No RDS instances found"

# --- Include ONLY if has_storage ---
# Check S3 buckets
echo "--- S3 Buckets ---"
aws s3 ls | grep "${PROJECT_NAME:-gcp-migration}" || echo "No matching S3 buckets found"

# --- Include ONLY if has_secrets ---
# Check secrets
echo "--- Secrets Manager ---"
aws secretsmanager list-secrets --query 'SecretList[].Name' --output table 2>/dev/null || echo "No secrets found"

echo "=== Validation Complete ==="
echo "Review the output above. All resources should show healthy status."
echo "TODO: Run application-level health checks"
echo "TODO: Compare performance metrics against GCP baseline"
```

## Step 3: Self-Check

After generating all scripts, verify the following quality rules:

### Script Quality Rules

1. All scripts use `set -euo pipefail`
2. All scripts default to dry-run mode
3. All scripts include verification steps
4. All scripts are numbered for execution order
5. All TODO markers are clearly marked with context

## Phase Completion

Report the list of generated script files to the parent orchestrator. **Do NOT update `.phase-status.json`** — the parent `generate.md` handles phase completion.

Only list scripts that were actually generated (based on Step 1 resource detection flags):

```
Resource categories detected: [list active flags from Step 1]

Generated migration scripts:
- scripts/01-validate-prerequisites.sh
- scripts/02-migrate-data.sh                    # only if has_data_migration
- scripts/03-migrate-containers.sh              # only if has_containers
- scripts/04-migrate-secrets.sh                 # only if has_secrets
- scripts/05-validate-migration.sh

Total: [N] migration scripts
TODO markers: [N] items requiring manual configuration
Skipped scripts: [list any scripts not generated, with reason]
```

## Generate Billing

# Generate Phase: Billing-Only Migration Plan

> Loaded by generate.md when estimation-billing.json exists.

**Execute ALL steps in order. Do not skip or optimize.**

**Known limitations:** Partial IaC discovery (mixed Terraform + billing-only services) is not yet supported. Confidence scoring per service based on billing SKU specificity is not yet implemented.

## Overview

This file produces a **conservative migration plan** with wider timelines and lower confidence thresholds than the infrastructure path. Billing-only data provides service-level spend but lacks configuration details (instance sizes, replication settings, networking topology). The plan accounts for this uncertainty with:

- Longer discovery refinement phase upfront
- Wider success criteria thresholds
- Explicit recommendation to run IaC discovery before executing the plan

## Prerequisites

Read the following artifacts from `$MIGRATION_DIR/`:

- `aws-design-billing.json` (REQUIRED) — Billing-based service mapping from Phase 3
- `estimation-billing.json` (REQUIRED) — Billing-only cost estimates from Phase 4
- `billing-profile.json` (REQUIRED) — GCP billing breakdown from Phase 1
- `preferences.json` (REQUIRED) — User migration preferences from Phase 2

If any required file is missing: **STOP**. Output: "Missing required artifact: [filename]. Complete the prior phase that produces it."

## Part 1: Context and Limitations

### What Billing Data Provides

- Service-level monthly spend (which GCP services are in use)
- Relative cost distribution (which services are most expensive)
- AI signal detection (whether AI/ML services appear in billing)
- SKU-level hints about usage patterns

### What Billing Data Does NOT Provide

- Instance sizes and configurations (CPU, memory, storage)
- Networking topology (VPC, subnets, firewall rules)
- Database engines and versions
- Replication and high-availability settings
- Inter-service dependencies
- Scaling configurations (min/max instances, autoscaling policies)
- Security configurations (IAM roles, encryption settings)

### Recommendation

> **For a more accurate migration plan, provide Terraform files and re-run discovery.**
> This billing-only plan is suitable for initial budgeting and stakeholder discussions,
> but must be refined with IaC discovery before executing the actual migration.

## Part 2: Conservative Timeline

A 15-week timeline with extended discovery and parallel-run phases to account for billing-only uncertainty.

### Stage 1: Discovery Refinement (Weeks 1-4)

- **Week 1-2**: Audit current GCP infrastructure manually
  - Document instance sizes, database configs, networking topology
  - Map dependencies between services
  - Identify stateful vs stateless services
  - Catalog secrets, environment variables, API keys
- **Week 3-4**: Refine AWS design based on discovered configurations
  - Update `aws-design-billing.json` unknowns with actual values
  - Re-estimate costs with refined configuration data
  - Identify any services that need different AWS targets
  - Consider running IaC discovery if Terraform files become available

### Stage 2: Service Migration (Weeks 5-9)

- **Week 5-6**: Provision AWS infrastructure
  - Set up VPC, subnets, security groups (based on discovery findings)
  - Provision compute, database, and storage resources
  - Configure IAM roles and policies
- **Week 7-8**: Deploy applications
  - Migrate application code and configurations
  - Set up CI/CD pipelines
  - Deploy to AWS staging environment
- **Week 9**: Integration testing
  - End-to-end testing on AWS
  - Performance baseline measurement
  - Data migration dry run

### Stage 3: Parallel Run (Weeks 10-12)

- Run both GCP and AWS simultaneously
- Compare performance, reliability, and costs
- Validate data consistency between environments
- Build confidence in AWS deployment
- Monitor for 2+ weeks before cutover decision

### Stage 4: Cutover and Validation (Weeks 13-15)

- **Week 13**: Execute cutover (DNS switch, traffic migration)
- **Week 14**: Intensive monitoring (48-hour watch period)
- **Week 15**: Stabilization and GCP teardown planning

## Part 3: Risk Assessment

Risks are higher for billing-only migrations due to configuration uncertainty.

| Risk                                         | Probability | Impact | Mitigation                                                          |
| -------------------------------------------- | ----------- | ------ | ------------------------------------------------------------------- |
| Incorrect service sizing                     | high        | high   | Extended discovery phase (Weeks 1-4); right-size after parallel run |
| Missing dependencies discovered late         | high        | medium | Manual dependency mapping in Week 1-2; extra buffer in timeline     |
| Data migration complexity underestimated     | medium      | high   | Dry run in Week 9; parallel run (Weeks 10-12) as safety net         |
| Cost overrun due to unknown configurations   | high        | medium | Set billing alerts at 80% of high estimate; weekly cost reviews     |
| Performance regression from incorrect sizing | medium      | high   | Parallel run comparison; resize before cutover                      |
| Longer timeline than planned                 | high        | medium | Build 3-week buffer into schedule; communicate 15-week plan upfront |
| Unmapped services block migration            | medium      | high   | Address unknowns in discovery refinement (Weeks 1-4)                |

## Part 4: Per-Service Migration Steps

For each service in `aws-design-billing.json.services[]`, generate a migration step template.

### Migration Step Template

```
Service: [gcp_service] → [aws_service]
Monthly Cost: $[monthly_cost] (GCP) → $[aws_mid] estimated (AWS)
Confidence: billing_inferred

Steps:
1. [ ] Determine actual configuration (instance size, storage, etc.)
   - TODO: Check GCP console or Terraform for [gcp_service] configuration
2. [ ] Provision AWS [aws_service] with discovered configuration
3. [ ] Migrate data (if applicable)
4. [ ] Test functionality and performance
5. [ ] Validate cost aligns with estimate

Unknowns:
- Instance sizing: TODO — verify in GCP console
- Scaling configuration: TODO — verify current autoscaling policies
- Dependencies: TODO — map which services depend on this one
```

### Example: Cloud Run to Fargate

```
Service: Cloud Run → Fargate
Monthly Cost: $450.00 (GCP) → $270-$630 estimated (AWS)
Confidence: billing_inferred
SKU Hints: CPU Allocation Time, Memory Allocation Time

Steps:
1. [ ] Determine actual configuration
   - TODO: Check CPU/memory allocation per Cloud Run service
   - TODO: Check concurrency and scaling settings
   - TODO: Check number of Cloud Run services
2. [ ] Create Fargate task definitions with matching CPU/memory
3. [ ] Set up ALB and target groups
4. [ ] Deploy container images to ECR
5. [ ] Configure autoscaling to match Cloud Run behavior
6. [ ] Test endpoint connectivity and performance

Unknowns:
- CPU allocation: TODO — check Cloud Run service configurations
- Memory allocation: TODO — check Cloud Run service configurations
- Number of services: TODO — count from GCP console or gcloud CLI
- Concurrency settings: TODO — check Cloud Run concurrency limits
```

### Unmapped Services

For each entry in `aws-design-billing.json.unknowns[]`:

```
Service: [gcp_service] — UNMAPPED
Monthly Cost: $[monthly_cost] (GCP)
Reason: [reason]
Suggestion: [suggestion]

Action Required:
- [ ] TODO: Manually identify the AWS equivalent for [gcp_service]
- [ ] TODO: Determine configuration and sizing
- [ ] TODO: Add to migration plan once mapped
```

## Part 5: Success Criteria

Relaxed thresholds reflecting billing-only uncertainty.

| Criteria                    | Target                     | Note                                                          |
| --------------------------- | -------------------------- | ------------------------------------------------------------- |
| Performance within baseline | Within 20% of GCP          | Wider than infra path (10%) due to sizing uncertainty         |
| Monitoring stability        | 48-hour watch period       | Longer than infra path (24 hours)                             |
| Post-migration stability    | 45-day observation         | Longer than infra path (30 days)                              |
| Cost variance               | Within 40% of mid estimate | Wider than infra path (15%) due to billing-only confidence    |
| Data integrity              | 100%                       | Same as infra path — no compromise on data                    |
| Service availability        | 99%                        | Lower than infra path (99.9%) initially, improve after tuning |

## Part 6: Output Format

Generate `generation-billing.json` in `$MIGRATION_DIR/` with the following schema:

```json
{
  "phase": "generate",
  "generation_source": "billing_only",
  "confidence": "low",
  "timestamp": "2026-02-26T14:30:00Z",
  "migration_plan": {
    "total_weeks": 15,
    "approach": "conservative_with_discovery",
    "phases": [
      {
        "name": "Discovery Refinement",
        "weeks": "1-4",
        "key_activities": [
          "Manual infrastructure audit",
          "Dependency mapping",
          "Configuration documentation",
          "Design refinement"
        ],
        "note": "Extended discovery to compensate for missing IaC data"
      },
      {
        "name": "Service Migration",
        "weeks": "5-9",
        "key_activities": [
          "AWS infrastructure provisioning",
          "Application deployment",
          "Integration testing",
          "Data migration dry run"
        ]
      },
      {
        "name": "Parallel Run",
        "weeks": "10-12",
        "key_activities": [
          "Dual environment operation",
          "Performance comparison",
          "Cost validation",
          "Confidence building"
        ]
      },
      {
        "name": "Cutover and Validation",
        "weeks": "13-15",
        "key_activities": [
          "DNS switch",
          "48-hour intensive monitoring",
          "Stabilization"
        ]
      }
    ],
    "services": [
      {
        "gcp_service": "Cloud Run",
        "aws_service": "Fargate",
        "monthly_cost_gcp": 450.00,
        "estimated_cost_aws_mid": 450.00,
        "confidence": "billing_inferred",
        "unknowns": ["instance sizing", "scaling config"]
      }
    ]
  },
  "risks": [
    {
      "category": "incorrect_sizing",
      "probability": "high",
      "impact": "high",
      "mitigation": "Extended discovery phase; right-size after parallel run",
      "phase_affected": "Discovery Refinement"
    }
  ],
  "success_metrics": {
    "performance_threshold": "within 20% of GCP baseline",
    "monitoring_period_hours": 48,
    "stability_period_days": 45,
    "cost_variance_threshold": "within 40% of mid estimate",
    "data_integrity": "100%",
    "availability_target": "99%"
  },
  "recommendation": {
    "approach": "Conservative migration with extended discovery",
    "confidence": "low",
    "iac_discovery_offered": true,
    "note": "For tighter estimates and a shorter timeline, provide Terraform files and re-run discovery.",
    "key_risks": [
      "Configuration uncertainty",
      "Missing dependency information",
      "Cost variance due to unknown sizing"
    ],
    "estimated_total_effort_hours": 720
  }
}
```

## Output Validation Checklist

- `phase` is `"generate"`
- `generation_source` is `"billing_only"`
- `confidence` is `"low"`
- `migration_plan.total_weeks` is 12-18 (conservative range)
- `migration_plan.phases` includes Discovery Refinement as first phase
- `migration_plan.services` covers every service from `aws-design-billing.json`
- `risks` array has at least 4 entries (more than infra path, reflecting higher uncertainty)
- Each risk `probability` is appropriately elevated (most are "medium" or "high")
- `success_metrics` has relaxed thresholds compared to infrastructure path
- `recommendation.iac_discovery_offered` is `true`
- `recommendation.confidence` is `"low"`
- Output is valid JSON

## Generate Phase Integration

The parent orchestrator (`generate.md`) uses `generation-billing.json` to:

1. Gate Stage 2 artifact generation — `generate-artifacts-billing.md` requires this file
2. Provide billing context to `generate-artifacts-docs.md` for MIGRATION_GUIDE.md
3. Set phase completion status in `.phase-status.json`

## Generate Infra

# Generate Phase: Infrastructure Migration Plan

> Loaded by generate.md when estimation-infra.json exists.

**Execute ALL steps in order. Do not skip or optimize.**

## Prerequisites

Read the following artifacts from `$MIGRATION_DIR/`:

- `aws-design.json` (REQUIRED) — AWS architecture design from Phase 3
- `estimation-infra.json` (REQUIRED) — Cost estimates from Phase 4
- `gcp-resource-clusters.json` (REQUIRED) — Cluster dependency graph from Phase 1
- `preferences.json` (REQUIRED) — User migration preferences from Phase 2

If any required file is missing: **STOP**. Output: "Missing required artifact: [filename]. Complete the prior phase that produces it."

## Part 1: Migration Timeline

Build an 8-12 week migration timeline based on:

- **Cluster count** from `gcp-resource-clusters.json` — more clusters = longer infrastructure phase
- **Dependency depth** from `creation_order` — deeper graphs need more sequential work
- **Service complexity** from `aws-design.json` — databases and stateful services take longer
- **Cutover strategy** from `preferences.json` — maintenance window vs. blue-green affects timeline

### Stage 1: Setup (Weeks 1-2)

- Finalize AWS account structure and billing alerts
- Provision foundational infrastructure: VPC, subnets, routing, NAT gateways
- Configure IAM roles and policies per cluster requirements
- Establish GCP-to-AWS connectivity (VPN or Direct Connect for data migration)
- Set up CI/CD pipeline for Terraform deployments
- Configure monitoring baseline (CloudWatch, alarms)

### Stage 2: Proof of Concept (Weeks 3-4)

- Deploy the **shallowest-depth cluster** (lowest `creation_order_depth`) to AWS
- Validate application connectivity and performance
- Test data pipeline from GCP to AWS (database replication, storage sync)
- Measure baseline latency and throughput
- Confirm cost tracking matches `estimation-infra.json` projections
- **Go/No-Go checkpoint**: If PoC fails acceptance criteria, stop and reassess

### Stage 3: Infrastructure Deployment (Weeks 5-7)

- Deploy remaining clusters in `creation_order` sequence (depth-first)
- For each cluster:
  - Deploy infrastructure per `aws-design.json` resource mappings
  - Configure cross-cluster networking and security groups
  - Validate service health checks
  - Run integration tests
- Implement monitoring and logging per cluster
- Establish backup and restore procedures

### Stage 4: Data Migration (Weeks 8-9)

**Include this phase ONLY if `aws-design.json` contains database or storage resources
(see resource detection rules in generate-artifacts-scripts.md Step 4).**
**If no data migration is needed, compress the timeline: move Cutover to Weeks 8-9
and Validation to Week 10. Reduce `total_weeks` accordingly.**

- **Databases**: Set up continuous replication (Cloud SQL to RDS/Aurora)
  - Initial full snapshot transfer
  - Enable ongoing replication (DMS or native replication)
  - Validate data integrity (row counts, checksums)
- **Object storage**: Sync GCS buckets to S3
  - Use AWS DataSync or `gsutil`/`aws s3 sync` for bulk transfer
  - Enable ongoing sync for new objects
- **Secrets**: Migrate secrets from Secret Manager to AWS Secrets Manager
- Establish dual-write pattern for production data

### Stage 5: Cutover (Weeks 10-11, or Weeks 8-9 if Stage 4 skipped)

- Pre-cutover validation:
  - All clusters deployed and healthy on AWS
  - Data replication lag < 1 second
  - All integration tests passing
  - Rollback procedures tested
- Execute cutover per `preferences.json` cutover_strategy:
  - **maintenance-window**: Schedule downtime, switch DNS, validate
  - **blue-green**: Gradual traffic shift (10% → 50% → 100%)
- Monitor for 24-48 hours post-cutover
- Keep GCP resources running as hot standby

### Stage 6: Validation and Cleanup (Week 12)

- Monitor AWS performance for 1 full week
- Compare actual costs against `estimation-infra.json` projections
- Run final data integrity checks
- Document any drift or issues
- Begin GCP teardown planning (execute teardown after 2-week stability period)

## Part 2: Risk Assessment

Build a risk matrix from the discovered infrastructure and migration complexity.

### Risk Categories

For each risk, assess:

- **Probability**: `"high"` (>60%), `"medium"` (30-60%), `"low"` (<30%)
- **Impact**: `"critical"` (service outage), `"high"` (degraded service), `"medium"` (delayed timeline), `"low"` (minor inconvenience)
- **Mitigation**: Specific action to reduce probability or impact

### Standard Risks

| Risk                             | Probability | Impact   | Mitigation                                                                                      |
| -------------------------------- | ----------- | -------- | ----------------------------------------------------------------------------------------------- |
| Data loss during migration       | low         | critical | Dual-write for 2 weeks before cutover; full backup before migration; checksums on all transfers |
| Performance regression on AWS    | medium      | high     | PoC testing (Weeks 3-4); load testing (Week 5); performance baseline comparison                 |
| Extended downtime during cutover | medium      | high     | Practice cutover in staging; automate DNS switch; rollback procedure on standby                 |
| Cost overrun vs estimates        | medium      | medium   | Set billing alerts at 80% and 100% of projected; weekly cost review                             |
| Team capacity constraints        | medium      | medium   | Allocate 2 FTE engineers dedicated for 12 weeks; identify backup resources                      |
| Cross-region latency             | low         | medium   | Validate latency in PoC phase; consider same-region deployment for latency-sensitive services   |
| Terraform state corruption       | low         | high     | Remote state with locking (S3 + DynamoDB); state backups before each apply                      |

### Dynamic Risks

Add additional risks based on discovered infrastructure:

- If **databases with replication** exist: Add "Replication lag during cutover" (medium/high)
- If **stateful services** (Redis, Elasticsearch): Add "State migration data loss" (low/critical)
- If **multiple regions** in GCP: Add "Cross-region dependency during migration" (medium/medium)
- If **AI workloads** coexist: Add "Model performance drift on Bedrock" (medium/high)

## Part 3: Success Metrics

### Per-Service Metrics

For each service in `aws-design.json`, define:

| Metric       | Target                                           | Measurement                     |
| ------------ | ------------------------------------------------ | ------------------------------- |
| Availability | 99.9% uptime                                     | CloudWatch synthetic monitoring |
| Latency      | Within 10% of GCP baseline                       | P50, P95, P99 response times    |
| Error rate   | < 0.1%                                           | CloudWatch error metrics        |
| Cost         | Within 15% of `estimation-infra.json` projection | AWS Cost Explorer weekly        |

### Overall Migration Metrics

| Metric             | Target                                       |
| ------------------ | -------------------------------------------- |
| Data integrity     | 100% — zero data loss confirmed by checksums |
| Migration timeline | Within 2 weeks of planned schedule           |
| Rollback success   | Tested and confirmed < 1 hour RTO            |
| Team confidence    | Go/No-Go passed at each phase gate           |

## Part 4: Rollback Procedures

### Trigger Conditions

Initiate rollback if ANY of:

- Data integrity issues detected during validation (checksum mismatch)
- Performance regression > 20% vs GCP baseline (P95 latency)
- Error rate > 1% sustained for 15 minutes
- Cost overrun > 50% vs `estimation-infra.json` projections
- Critical AWS service limitation discovered that blocks functionality

### Per-Phase Rollback

| Phase                | Rollback Action                                    | RTO          |
| -------------------- | -------------------------------------------------- | ------------ |
| Setup (1-2)          | Delete AWS resources; no impact                    | < 1 hour     |
| PoC (3-4)            | Tear down PoC cluster; GCP unaffected              | < 1 hour     |
| Infrastructure (5-7) | Tear down AWS clusters; GCP still primary          | < 2 hours    |
| Data Migration (8-9) | Stop replication; GCP data is authoritative        | < 30 minutes |
| Cutover (10-11)      | Reverse DNS to GCP; resume GCP traffic             | < 1 hour     |
| Post-Cutover (12+)   | Manual restore from backup; GCP resources archived | 2-4 hours    |

### Rollback Procedure (Pre-DNS Cutover)

1. Pause dual-write replication
2. Reverse DNS records (AWS to GCP endpoints)
3. Verify GCP services receiving traffic
4. Shut down AWS workloads (keep for 1 week as standby)
5. Monitor GCP for 24 hours
6. Post-mortem: document what triggered rollback

### Rollback Procedure (Post-DNS Cutover)

1. If within 48 hours: Reverse DNS, resume GCP from replicated state
2. If beyond 48 hours: Restore GCP from backup (2-4 hour RTO)
3. Validate data integrity after restore
4. Resume GCP operations
5. Post-mortem and reassess migration approach

## Part 5: Team and Roles

### RACI Matrix

| Activity               | Migration Lead | Infrastructure Engineer | Database Engineer | Application Developer | QA Engineer |
| ---------------------- | -------------- | ----------------------- | ----------------- | --------------------- | ----------- |
| Migration planning     | A/R            | C                       | C                 | C                     | I           |
| AWS account setup      | A              | R                       | I                 | I                     | I           |
| Network infrastructure | A              | R                       | I                 | I                     | I           |
| Database migration     | A              | C                       | R                 | I                     | C           |
| Application deployment | A              | C                       | I                 | R                     | C           |
| Data validation        | A              | I                       | R                 | C                     | R           |
| Performance testing    | A              | C                       | C                 | C                     | R           |
| Cutover execution      | R              | R                       | R                 | C                     | C           |
| Rollback execution     | R              | R                       | R                 | I                     | I           |

**R** = Responsible, **A** = Accountable, **C** = Consulted, **I** = Informed

### Staffing Estimate

- **Minimum**: 2 FTE engineers for 12 weeks
- **Recommended**: 3 FTE (1 infra, 1 database/data, 1 app/QA) for 12 weeks
- **With AI track**: Add 1 FTE ML engineer for weeks 3-8

## Part 6: Go/No-Go Framework

Each phase gate requires explicit approval before proceeding.

### Phase Gate Criteria

| Gate | Phase Transition             | Go Criteria                                                     | No-Go Action              |
| ---- | ---------------------------- | --------------------------------------------------------------- | ------------------------- |
| G1   | Setup → PoC                  | VPC online, IAM configured, connectivity verified               | Fix infrastructure issues |
| G2   | PoC → Full Deploy            | PoC cluster healthy, latency acceptable, costs tracking         | Reassess architecture     |
| G3   | Full Deploy → Data Migration | All clusters deployed, integration tests passing                | Debug failing clusters    |
| G4   | Data Migration → Cutover     | Replication lag < 1s, data integrity confirmed, rollback tested | Fix replication issues    |
| G5   | Cutover → Validation         | DNS switched, traffic flowing, error rate < 0.1%                | Execute rollback          |
| G6   | Validation → Cleanup         | 1 week stable operation, costs within 15% of estimate           | Extend monitoring period  |

## Part 7: Post-Migration Monitoring

### 30-Day Post-Migration Plan

**Week 1 (Days 1-7)**: Intensive monitoring

- Check all CloudWatch dashboards every 4 hours
- Compare latency/throughput to GCP baseline daily
- Review AWS costs daily vs projections
- Maintain GCP hot standby

**Week 2 (Days 8-14)**: Stabilization

- Reduce monitoring frequency to twice daily
- Begin decommissioning GCP hot standby (read-only mode)
- Address any performance tuning items
- Validate backup/restore procedures on AWS

**Weeks 3-4 (Days 15-30)**: Optimization

- Implement cost optimization opportunities from `estimation-infra.json`
- Right-size instances based on actual usage data
- Enable Reserved Instances or Savings Plans for stable workloads
- Archive GCP resources and begin teardown
- Final cost reconciliation: actual vs projected

## Part 8: Decision Tree

### Cutover Decision Flowchart

```
START: All clusters deployed?
  NO → Continue infrastructure deployment
  YES → Data replication active?
    NO → Start data migration
    YES → Replication lag < 1 second?
      NO → Wait for replication to catch up
      YES → All integration tests passing?
        NO → Fix failing tests
        YES → Rollback procedure tested?
          NO → Execute rollback drill
          YES → READY FOR CUTOVER
            → Execute cutover per strategy
            → Monitor 24-48 hours
            → Error rate < 0.1%?
              NO → EXECUTE ROLLBACK
              YES → CUTOVER SUCCESSFUL
                → Begin 30-day monitoring
                → Plan GCP teardown (Week 14)
```

## Part 9: Output Format

Generate `generation-infra.json` in `$MIGRATION_DIR/` with the following schema:

```json
{
  "phase": "generate",
  "generation_source": "infrastructure",
  "timestamp": "2026-02-26T14:30:00Z",
  "migration_plan": {
    "total_weeks": 12,
    "phases": [
      {
        "name": "Setup",
        "weeks": "1-2",
        "clusters_targeted": [],
        "key_activities": ["AWS account setup", "VPC provisioning", "IAM configuration"],
        "dependencies": [],
        "go_no_go_criteria": "VPC online, IAM configured, connectivity verified"
      }
    ],
    "services": [
      {
        "gcp_service": "Cloud Run",
        "aws_service": "Fargate",
        "migration_week": 5,
        "cluster_id": "compute_cloudrun_us-central1_001",
        "estimated_effort_hours": 40,
        "data_migration_required": false // derive from resource detection flags (has_databases, has_storage)
      }
    ],
    "critical_path": [
      "VPC setup (Week 1)",
      "PoC deployment (Week 3-4)",
      "Database replication (Week 8-9)",
      "DNS cutover (Week 10-11)"
    ],
    "dependencies": [
      {
        "from_cluster": "networking_vpc_us-central1_001",
        "to_cluster": "compute_cloudrun_us-central1_001",
        "type": "must_precede"
      }
    ]
  },
  "risks": [
    {
      "category": "data_loss",
      "probability": "low",
      "impact": "critical",
      "mitigation": "Dual-write for 2 weeks; full backup before cutover; checksum validation",
      "phase_affected": "Data Migration"
    }
  ],
  "success_metrics": {
    "per_service": [
      {
        "service": "Fargate",
        "availability_target": "99.9%",
        "latency_target": "within 10% of GCP baseline",
        "cost_target": "within 15% of estimation"
      }
    ],
    "overall": {
      "data_integrity": "100%",
      "timeline_variance": "within 2 weeks",
      "rollback_rto": "< 1 hour"
    }
  },
  "rollback_procedures": {
    "trigger_conditions": [
      "Data integrity failure",
      "Performance regression > 20%",
      "Error rate > 1% sustained 15 min",
      "Cost overrun > 50%"
    ],
    "pre_cutover_rto": "< 1 hour",
    "post_cutover_rto": "2-4 hours",
    "rollback_window": "Reversible until 48 hours post-DNS cutover"
  },
  "team_roles": {
    "minimum_fte": 2,
    "recommended_fte": 3,
    "duration_weeks": 12,
    "roles": ["Migration Lead", "Infrastructure Engineer", "Database Engineer"]
  },
  "go_no_go_criteria": [
    {
      "gate": "G1",
      "transition": "Setup to PoC",
      "criteria": "VPC online, IAM configured, connectivity verified"
    }
  ],
  "post_migration": {
    "monitoring_duration_days": 30,
    "gcp_teardown_week": 14,
    "optimization_start_week": 15
  },
  "recommendation": {
    "approach": "Phased cluster-by-cluster migration",
    "confidence": "high",
    "key_risks": ["Data migration complexity", "Performance validation"],
    "estimated_total_effort_hours": 480
  }
}
```

## Output Validation Checklist

- `phase` is `"generate"`
- `generation_source` is `"infrastructure"`
- `migration_plan.total_weeks` is a positive integer (8-16 range)
- `migration_plan.phases` array has at least 4 entries (Setup, PoC, Infrastructure, Cutover, Validation — plus Data Migration if data resources exist)
- `migration_plan.services` covers every service from `aws-design.json`
- `migration_plan.critical_path` is non-empty
- `migration_plan.dependencies` reflect `gcp-resource-clusters.json` creation_order
- `risks` array has at least 3 entries with probability, impact, mitigation
- `success_metrics` has both `per_service` and `overall` sections
- `rollback_procedures` has trigger conditions and RTO values
- `team_roles` has minimum and recommended FTE counts
- `go_no_go_criteria` has at least 4 gates
- `post_migration` specifies monitoring duration and teardown timing
- All cluster IDs reference valid clusters from `gcp-resource-clusters.json`
- Output is valid JSON

## Generate Phase Integration

The parent orchestrator (`generate.md`) uses `generation-infra.json` to:

1. Gate Stage 2 artifact generation — `generate-artifacts-infra.md` requires this file
2. Provide timeline context to `generate-artifacts-docs.md` for MIGRATION_GUIDE.md
3. Set phase completion status in `.phase-status.json`

## Generate

# Phase 5: Generate Migration Artifacts (Orchestrator)

**Execute ALL steps in order. Do not skip or optimize.**

## Overview

The Generate phase has **2 mandatory stages** that run sequentially:

1. **Stage 1: Migration Planning** — Produces execution plans (JSON) from estimation + design artifacts
2. **Stage 2: Artifact Generation** — Produces deployable code (Terraform, scripts, adapters, docs) from plans + designs

Both stages must complete for the phase to succeed.

## Prerequisites

Read `$MIGRATION_DIR/preferences.json`. If missing: **STOP**. Output: "Phase 2 (Clarify) not completed. Run Phase 2 first."

Check which estimation artifacts exist in `$MIGRATION_DIR/`:

- `estimation-infra.json` (infrastructure estimation)
- `estimation-ai.json` (AI workload estimation)
- `estimation-billing.json` (billing-only estimation)

If **none** of these estimation artifacts exist: **STOP**. Output: "No estimation artifacts found. Run Phase 4 (Estimate) first."

## Stage 1: Migration Planning

Route based on which estimation artifacts exist. Multiple paths can run independently.

### Infrastructure Migration Plan

IF `estimation-infra.json` exists:

> Load `generate-infra.md`

Produces: `generation-infra.json`

### AI Migration Plan

IF `estimation-ai.json` exists:

> Load `generate-ai.md`

Produces: `generation-ai.json`

### Billing-Only Migration Plan

IF `estimation-billing.json` exists:

> Load `generate-billing.md`

Produces: `generation-billing.json`

## Stage 2: Artifact Generation

**MUST proceed only after Stage 1 completes.** Route based on generation plans + design artifacts.

### Infrastructure Artifacts

IF `generation-infra.json` AND `aws-design.json` exist:

> Load `generate-artifacts-infra.md`

Produces: `terraform/` directory

After generate-artifacts-infra.md completes (terraform files generated),
load `generate-artifacts-scripts.md` to generate migration scripts.

Produces: `scripts/` directory

### AI Artifacts

IF `generation-ai.json` AND `aws-design-ai.json` exist:

> Load `generate-artifacts-ai.md`

Produces: `ai-migration/` directory

### Billing Skeleton Artifacts

IF `generation-billing.json` AND `aws-design-billing.json` exist:

> Load `generate-artifacts-billing.md`

Produces: `terraform/skeleton.tf` (with TODO markers)

### Documentation (ALWAYS runs last)

AFTER all above artifact generation sub-files complete:

> Load `generate-artifacts-docs.md`

Produces: `MIGRATION_GUIDE.md`, `README.md`

## Phase Completion

Verify both stages are complete:

1. **Stage 1**: At least one `generation-*.json` file exists
2. **Stage 2**: At least one artifact directory or file was produced, plus documentation

Use the Phase Status Update Protocol (Write tool) to write `.phase-status.json` with `phases.generate` set to `"completed"` — **in the same turn** as the summary below.

## Summary

Present final summary to user:

1. **Plans generated** — List all `generation-*.json` files produced
2. **Artifacts generated** — List all directories and files created (terraform/, scripts/, ai-migration/, MIGRATION_GUIDE.md, README.md)
3. **Key timelines** — Highlight migration timeline from the generation plans
4. **Key risks** — Highlight top risks from the generation plans
5. **TODO markers** — Note any TODO markers in generated artifacts that require manual attention
6. **Next steps** — Recommend reviewing generated artifacts, customizing TODO sections, and beginning migration execution

Output to user: "Migration artifact generation complete. All phases of the GCP-to-AWS migration analysis are complete."

## Schema Discover Ai

# AI Discovery Schema

Schema for `ai-workload-profile.json`, produced by `discover-app-code.md` when AI confidence >= 70%.

**Convention**: Values shown as `X|Y` in examples indicate allowed alternatives — use exactly one value per field, not the literal pipe character.

---

## ai-workload-profile.json (Phase 1 output)

Focused profile of AI/ML workloads including models, capabilities, integration patterns, and supporting infrastructure. Generated by `discover-app-code.md` when AI confidence >= 70%.

```json
{
  "metadata": {
    "report_date": "2026-02-26",
    "project_directory": "/path/to/project",
    "sources_analyzed": {
      "terraform": true,
      "application_code": true,
      "billing_data": false
    }
  },

  "summary": {
    "overall_confidence": 0.95,
    "confidence_level": "very_high",
    "total_models_detected": 2,
    "languages_found": ["python"],
    "ai_source": "gemini|openai|both|other"
  },

  "models": [
    {
      "model_id": "gemini-pro",
      "service": "vertex_ai_generative",
      "detected_via": ["code", "terraform"],
      "evidence": [
        {
          "source": "code",
          "file": "src/ai/client.py",
          "line": 12,
          "pattern": "GenerativeModel(\"gemini-pro\")"
        },
        {
          "source": "terraform",
          "file": "vertex.tf",
          "resource": "google_vertex_ai_endpoint.main",
          "pattern": "Vertex AI endpoint resource"
        }
      ],
      "capabilities_used": ["text_generation", "streaming"],
      "usage_context": "Recommendation engine - generates product recommendations from user profiles"
    },
    {
      "model_id": "text-embedding-004",
      "service": "vertex_ai_embeddings",
      "detected_via": ["code"],
      "evidence": [
        {
          "source": "code",
          "file": "src/embeddings/indexer.py",
          "line": 5,
          "pattern": "VertexAIEmbeddings()"
        }
      ],
      "capabilities_used": ["embeddings"],
      "usage_context": "Document indexing for semantic search"
    }
  ],

  "integration": {
    "primary_sdk": "google-cloud-aiplatform",
    "sdk_version": "1.38.0",
    "frameworks": ["langchain"],
    "languages": ["python"],
    "pattern": "direct_sdk",
    "gateway_type": "llm_router|api_gateway|voice_platform|framework|direct|null",
    "capabilities_summary": {
      "text_generation": true,
      "streaming": true,
      "function_calling": false,
      "vision": false,
      "embeddings": true,
      "batch_processing": false
    }
  },

  "infrastructure": [
    {
      "address": "google_vertex_ai_endpoint.main",
      "type": "google_vertex_ai_endpoint",
      "file": "vertex.tf",
      "config": {
        "display_name": "recommendation-endpoint",
        "location": "us-central1"
      }
    },
    {
      "address": "google_service_account.vertex_sa",
      "type": "google_service_account",
      "file": "iam.tf",
      "role": "supports_ai",
      "config": {
        "account_id": "vertex-ai-sa"
      }
    }
  ],

  "current_costs": {
    "monthly_ai_spend": 450,
    "services_detected": ["Vertex AI Predictions", "Generative AI API"]
  },

  "detection_signals": [
    {
      "method": "terraform",
      "pattern": "google_vertex_ai_endpoint resource",
      "confidence": 0.95,
      "evidence": "Found resource 'main' in vertex.tf"
    },
    {
      "method": "code",
      "pattern": "google.cloud.aiplatform import",
      "confidence": 0.95,
      "evidence": "Found in src/ai/client.py line 3"
    }
  ]
}
```

**CRITICAL Field Names** (use EXACTLY these keys):

- `model_id` — Model identifier string (NOT `model_name`, `name`)
- `service` — GCP service category (NOT `service_type`, `gcp_service`)
- `detected_via` — Array of detection sources (NOT `detection_method`, `source`)
- `capabilities_used` — Array of capability strings per model (NOT `capabilities`, `features`)
- `usage_context` — Human-readable description of what the model does (NOT `description`, `purpose`)
- `pattern` — Integration pattern in `integration` object (NOT `integration_type`, `method`)
- `gateway_type` — Gateway/router type in `integration` object: `"llm_router"`, `"api_gateway"`, `"voice_platform"`, `"framework"`, `"direct"`, or `null`
- `capabilities_summary` — Boolean map in `integration` object (NOT `capabilities`, `feature_flags`)
- `ai_source` — Source AI provider in `summary` object: `"gemini"`, `"openai"`, `"both"`, or `"other"`

**Key Fields:**

- `metadata.sources_analyzed` — Which data sources were provided (affects which sections are populated)
- `summary.overall_confidence` — Combined detection confidence from all signals
- `models[]` — Each distinct AI model/service detected, with evidence and capabilities
- `integration.pattern` — How the app connects to AI (`direct_sdk`, `framework`, `rest_api`, `mixed`)
- `integration.capabilities_summary` — Union of all capabilities across all models
- `infrastructure[]` — Terraform resources related to AI (empty array if no Terraform provided)
- `current_costs` — Present ONLY if billing data was provided; omitted entirely otherwise
- `detection_signals[]` — Raw signals from AI detection for transparency

**Conditional sections:**

- `current_costs` — Include ONLY if billing data was provided (billing discovery ran). Omit entirely if no billing data.
- `infrastructure` — Set to `[]` if no Terraform files were provided (IaC discovery did not run).

## Schema Discover Billing

# Billing Discovery Schema

Schema for `billing-profile.json`, produced by `discover-billing.md`.

**Convention**: Values shown as `X|Y` in examples indicate allowed alternatives — use exactly one value per field, not the literal pipe character.

---

## billing-profile.json (Phase 1 output)

Cost breakdown derived from GCP billing export CSV. Provides service-level spend and AI signal detection from billing data alone.

```json
{
  "metadata": {
    "report_date": "2026-02-24",
    "project_directory": "/path/to/project",
    "billing_source": "gcp-billing-export.csv",
    "billing_period": "2026-01"
  },
  "summary": {
    "total_monthly_spend": 2450.00,
    "service_count": 8,
    "currency": "USD"
  },
  "services": [
    {
      "gcp_service": "Cloud Run",
      "gcp_service_type": "google_cloud_run_service",
      "monthly_cost": 450.00,
      "percentage_of_total": 0.18,
      "top_skus": [
        {
          "sku_description": "Cloud Run - CPU Allocation Time",
          "monthly_cost": 300.00
        },
        {
          "sku_description": "Cloud Run - Memory Allocation Time",
          "monthly_cost": 150.00
        }
      ],
      "ai_signals": []
    },
    {
      "gcp_service": "Cloud SQL",
      "gcp_service_type": "google_sql_database_instance",
      "monthly_cost": 800.00,
      "percentage_of_total": 0.33,
      "top_skus": [
        {
          "sku_description": "Cloud SQL for PostgreSQL - DB custom CORE",
          "monthly_cost": 500.00
        },
        {
          "sku_description": "Cloud SQL for PostgreSQL - DB custom RAM",
          "monthly_cost": 300.00
        }
      ],
      "ai_signals": []
    },
    {
      "gcp_service": "Vertex AI",
      "gcp_service_type": "google_vertex_ai_endpoint",
      "monthly_cost": 600.00,
      "percentage_of_total": 0.24,
      "top_skus": [
        {
          "sku_description": "Vertex AI Prediction - Online Prediction",
          "monthly_cost": 400.00
        },
        {
          "sku_description": "Generative AI - Gemini Pro Input Tokens",
          "monthly_cost": 200.00
        }
      ],
      "ai_signals": ["vertex_ai", "generative_ai"]
    }
  ],
  "ai_signals": {
    "detected": true,
    "confidence": 0.85,
    "services": ["Vertex AI"]
  }
}
```

**Key Fields:**

- `summary.total_monthly_spend` — Total monthly GCP spend from the billing export
- `summary.service_count` — Number of distinct GCP services with charges
- `services[].gcp_service_type` — Terraform resource type equivalent for the service (used by downstream phases)
- `services[].monthly_cost` — Monthly cost for this service
- `services[].top_skus` — Highest-cost line items within the service
- `services[].ai_signals` — AI-related keywords found in SKU descriptions for this service
- `ai_signals.detected` — Whether any AI/ML services were found in the billing data
- `ai_signals.confidence` — Confidence that the project uses AI (derived from billing SKU analysis)
- `ai_signals.services` — List of AI-related GCP services found

## Schema Discover Iac

# IaC Discovery Schemas

Schemas for `gcp-resource-inventory.json` and `gcp-resource-clusters.json`, produced by `discover-iac.md`.

**Convention**: Values shown as `X|Y` in examples indicate allowed alternatives — use exactly one value per field, not the literal pipe character.

---

## gcp-resource-inventory.json (Phase 1 output)

Complete inventory of discovered GCP resources with classification, dependencies, and AI detection.

```json
{
  "metadata": {
    "report_date": "2026-02-26",
    "project_directory": "/path/to/terraform",
    "terraform_version": ">= 1.0.0"
  },
  "summary": {
    "total_resources": 50,
    "primary_resources": 12,
    "secondary_resources": 38,
    "total_clusters": 6,
    "classification_coverage": "100%"
  },
  "resources": [
    {
      "address": "google_cloud_run_service.orders_api",
      "type": "google_cloud_run_service",
      "name": "orders_api",
      "classification": "PRIMARY",
      "tier": "compute",
      "confidence": 0.99,
      "config": {
        "timeout": 60,
        "memory_mb": 512,
        "concurrency": 100
      },
      "depth": 3,
      "cluster_id": "compute_cloudrun_us-central1_001"
    },
    {
      "address": "google_service_account.app",
      "type": "google_service_account",
      "name": "app",
      "classification": "SECONDARY",
      "tier": "identity",
      "confidence": 0.99,
      "secondary_role": "identity",
      "serves": ["google_cloud_run_service.orders_api", "google_cloud_run_service.products_api"],
      "config": {
        "account_id": "app-sa"
      },
      "depth": 2,
      "cluster_id": "compute_cloudrun_us-central1_001"
    },
    {
      "address": "google_compute_network.main",
      "type": "google_compute_network",
      "name": "main",
      "classification": "PRIMARY",
      "tier": "networking",
      "confidence": 0.99,
      "config": {
        "auto_create_subnetworks": false
      },
      "depth": 0,
      "cluster_id": "networking_vpc_us-central1_001"
    }
  ],
  "ai_detection": {
    "has_ai_workload": false,
    "confidence": 0,
    "confidence_level": "none",
    "signals_found": [],
    "ai_services": []
  }
}
```

**CRITICAL Field Names** (use EXACTLY these keys):

- `address` — Terraform resource address (NOT `id`, `resource_address`)
- `type` — Resource type (NOT `resource_type`)
- `name` — Resource name component (NOT `resource_name`)
- `classification` — `"PRIMARY"` or `"SECONDARY"` (NOT `class`, `category`)
- `tier` — Infrastructure layer: compute, database, storage, networking, identity, messaging, monitoring (NOT `layer`)
- `confidence` — Classification confidence 0.0-1.0 (NOT `certainty`)
- `secondary_role` — For secondaries only: identity, access_control, network_path, configuration, encryption, orchestration
- `serves` — For secondaries only: array of primary resource addresses served
- `depth` — Dependency depth (0 = foundational, N = depends on depth N-1)
- `cluster_id` — Which cluster this resource belongs to

**Key Sections:**

- `metadata` — Report metadata (report_date, project_directory, terraform_version)
- `summary` — Aggregate statistics (total_resources, primary/secondary counts, cluster count, classification_coverage)
- `resources[]` — All discovered resources with fields above
- `ai_detection` — AI workload detection results:
  - `has_ai_workload` — boolean
  - `confidence` — 0.0-1.0
  - `confidence_level` — "very_high" (90%+), "high" (70-89%), "medium" (50-69%), "low" (< 50%), "none" (0%)
  - `signals_found[]` — array of detection signals with method, pattern, confidence, evidence
  - `ai_services[]` — list of AI services detected (vertex_ai, bigquery_ml, etc.)

---

## gcp-resource-clusters.json (Phase 1 output)

Resources grouped into logical clusters for migration with full dependency graph and creation order.

```json
{
  "clusters": [
    {
      "cluster_id": "networking_vpc_us-central1_001",
      "gcp_region": "us-central1",
      "primary_resources": [
        "google_compute_network.main"
      ],
      "secondary_resources": [
        "google_compute_subnetwork.app",
        "google_compute_firewall.app"
      ],
      "network": null,
      "creation_order_depth": 0,
      "must_migrate_together": true,
      "dependencies": [],
      "edges": []
    },
    {
      "cluster_id": "database_sql_us-central1_001",
      "gcp_region": "us-central1",
      "primary_resources": [
        "google_sql_database_instance.db"
      ],
      "secondary_resources": [
        "google_sql_database.main"
      ],
      "network": "networking_vpc_us-central1_001",
      "creation_order_depth": 1,
      "must_migrate_together": true,
      "dependencies": ["networking_vpc_us-central1_001"],
      "edges": [
        {
          "from": "google_sql_database_instance.db",
          "to": "google_compute_network.main",
          "relationship_type": "network_membership",
          "evidence": {
            "field_path": "settings.ip_configuration.private_network",
            "reference": "VPC membership"
          }
        }
      ]
    },
    {
      "cluster_id": "compute_cloudrun_us-central1_001",
      "gcp_region": "us-central1",
      "primary_resources": [
        "google_cloud_run_service.orders_api",
        "google_cloud_run_service.products_api"
      ],
      "secondary_resources": [
        "google_service_account.app"
      ],
      "network": "networking_vpc_us-central1_001",
      "creation_order_depth": 2,
      "must_migrate_together": true,
      "dependencies": ["database_sql_us-central1_001"],
      "edges": [
        {
          "from": "google_cloud_run_service.orders_api",
          "to": "google_sql_database_instance.db",
          "relationship_type": "data_dependency",
          "evidence": {
            "field_path": "template.spec.containers[0].env[].value",
            "reference": "DATABASE_URL"
          }
        }
      ]
    }
  ],
  "creation_order": [
    { "depth": 0, "clusters": ["networking_vpc_us-central1_001"] },
    { "depth": 1, "clusters": ["database_sql_us-central1_001"] },
    { "depth": 2, "clusters": ["compute_cloudrun_us-central1_001"] }
  ]
}
```

**Key Fields:**

- `cluster_id` — Unique cluster identifier (deterministic format: `{service_category}_{service_type}_{gcp_region}_{sequence}`)
- `gcp_region` — GCP region for this cluster
- `primary_resources` — GCP resources that map independently
- `secondary_resources` — GCP resources that support primary resources
- `network` — Which VPC cluster this cluster belongs to (cluster ID reference, or null if networking cluster itself)
- `creation_order_depth` — Depth level in topological sort (0 = foundational)
- `must_migrate_together` — Boolean indicating if cluster is an atomic deployment unit
- `dependencies` — Other cluster IDs this cluster depends on (derived from cross-cluster Primary->Primary edges)
- `edges` — Typed relationships between resources with structured evidence
- `creation_order` — Global ordering of clusters by depth level (for migration sequencing)

## Schema Estimate Infra

# Infrastructure Estimate Schema

Schema for `estimation-infra.json`, produced by `estimate-infra.md`.

---

## estimation-infra.json schema

```json
{
  "phase": "estimate",
  "design_source": "infrastructure",
  "timestamp": "2026-02-24T14:00:00Z",
  "pricing_source": {
    "status": "cached|live|fallback",
    "message": "Using cached prices from 2026-03-04 (±5-10% accuracy)|Using live AWS pricing API|Using cached rates from 2026-02-24 (±15-25% accuracy)",
    "fallback_staleness": {
      "last_updated": "2026-02-24",
      "days_old": 3,
      "is_stale": false,
      "staleness_warning": null
    },
    "services_by_source": {
      "live": ["Fargate", "RDS Aurora", "S3", "ALB"],
      "fallback": ["NAT Gateway"],
      "estimated": []
    },
    "services_with_missing_fallback": []
  },
  "accuracy_confidence": "±5-10%|±15-25%",

  "current_costs": {
    "source": "billing_data|inventory_estimate|preferences|default",
    "gcp_monthly": 300,
    "gcp_annual": 3600,
    "baseline_note": "From billing-profile.json actual spend data",
    "breakdown": { "compute": 75, "database": 50, "storage": 40, "networking": 20, "other": 15 }
  },

  "projected_costs": {
    "aws_monthly_premium": 1003,
    "aws_monthly_balanced": 265,
    "aws_monthly_optimized": 194,
    "aws_annual_optimized": 2328,
    "breakdown": {
      "compute": {
        "service": "Fargate",
        "monthly": 71,
        "alternative": { "service": "Lambda", "monthly": 9, "savings": 62 }
      },
      "database": {
        "service": "Aurora PostgreSQL",
        "monthly": 269,
        "alternative": { "service": "RDS PostgreSQL", "monthly": 75, "savings": 194 }
      },
      "storage": {
        "service": "S3 Standard + Intelligent-Tiering",
        "monthly": 86,
        "alternative": { "service": "S3-IA", "monthly": 65, "savings": 21 }
      },
      "networking": { "service": "ALB + NAT Gateway", "monthly": 53 },
      "supporting": { "secrets_manager": 1.20, "cloudwatch": 35.30 }
    }
  },

  "cost_comparison": {
    "gcp_monthly_baseline": 300,
    "option_a_premium": {
      "aws_monthly": 1003,
      "monthly_difference": 703,
      "annual_difference": 8436,
      "percent_change": "+234%"
    },
    "option_b_balanced": {
      "aws_monthly": 265,
      "monthly_difference": -35,
      "annual_difference": -420,
      "percent_change": "-12%"
    },
    "option_c_optimized": {
      "aws_monthly": 194,
      "monthly_difference": -106,
      "annual_difference": -1272,
      "percent_change": "-35%"
    }
  },

  "roi_analysis": {
    "recurring_savings": {
      "monthly_difference_balanced": -35,
      "monthly_difference_optimized": -106,
      "annual_difference_balanced": -420,
      "annual_difference_optimized": -1272,
      "note": "Negative = AWS cheaper. Based on balanced/optimized tiers vs GCP baseline."
    },
    "operational_efficiency_factors": [
      "Reduced operational overhead from managed services (Fargate, RDS)",
      "Reduced on-call burden from AWS-managed HA, patching, and scaling",
      "Engineering time freed for product work instead of infrastructure maintenance"
    ],
    "non_cost_benefits": [
      "Operational efficiency (fewer engineers needed for managed services)",
      "Better global reach (more AWS regions)",
      "Broader service catalog for future workloads",
      "Better enterprise tool integration",
      "Vendor diversification (reduce single-vendor risk)",
      "Auto-scaling, spot instances, savings plans flexibility"
    ]
  },

  "optimization_opportunities": [
    {
      "opportunity": "Reserved Instances",
      "target_services": ["RDS", "Aurora"],
      "savings_monthly": 58,
      "savings_percent": "40%",
      "commitment": "1-year",
      "implementation_effort": "low",
      "description": "Commit to 1-year reserved capacity for predictable workloads"
    },
    {
      "opportunity": "S3 Infrequent Access",
      "target_services": ["S3"],
      "savings_monthly": 52,
      "savings_percent": "38%",
      "commitment": "none",
      "implementation_effort": "low",
      "description": "Move infrequently accessed data to S3-IA storage class"
    },
    {
      "opportunity": "Spot Instances for Batch",
      "target_services": ["EC2"],
      "savings_monthly": 6,
      "savings_percent": "70%",
      "commitment": "none",
      "implementation_effort": "medium",
      "description": "Use Spot instances for fault-tolerant batch processing jobs"
    },
    {
      "opportunity": "Compute Savings Plans",
      "target_services": ["Fargate", "Lambda"],
      "savings_monthly": 20,
      "savings_percent": "25%",
      "commitment": "1-year",
      "implementation_effort": "low",
      "description": "AWS Savings Plans covering Fargate and Lambda usage"
    }
  ],

  "financial_summary": {
    "current_gcp_monthly": 300,
    "projected_aws_balanced_monthly": 265,
    "projected_aws_optimized_monthly": 194,
    "monthly_savings_balanced": 35,
    "monthly_savings_optimized": 106,
    "annual_savings_optimized": 1272,
    "recommendation": "Migrate with optimizations for best ROI"
  },

  "recommendation": {
    "path": "Full Infrastructure with Optimizations",
    "roi_justification": "Optimized tier saves $106/month ($1,272/year) vs GCP with operational efficiency benefits",
    "confidence": "high",
    "next_steps": [
      "Review financial case with stakeholders",
      "Confirm service tier selections (Aurora vs RDS, Fargate vs Lambda)",
      "Get approval to proceed to Execute phase",
      "Schedule migration timeline per cluster evaluation order"
    ]
  }
}
```

## Output Validation Checklist

- `design_source` is `"infrastructure"`
- `pricing_source.status` is `"cached"`, `"live"`, or `"fallback"`
- `accuracy_confidence` matches the pricing mode (±5-10% for cached/live, ±15-25% for fallback)
- `current_costs.source` is `"billing_data"` if `billing-profile.json` was used, `"inventory_estimate"`, `"preferences"`, or `"default"` otherwise
- `current_costs.gcp_monthly` matches billing-profile.json total (if used) or is a reasonable estimate
- `projected_costs` has all three tiers (premium, balanced, optimized)
- `projected_costs.breakdown` covers compute, database, storage, networking, and supporting services
- Every service in `aws-design.json` is represented in the cost breakdown
- `cost_comparison` shows all three options with monthly and annual differences
- `roi_analysis` presents recurring monthly/annual savings (or increase) per tier
- `roi_analysis` is honest — if migration increases cost, say so and justify with non-cost benefits
- `optimization_opportunities` only includes strategies relevant to the designed architecture
- `financial_summary` provides a clear executive-level view
- `recommendation.next_steps` includes actionable items
- No references to AI-specific costs (those belong in `estimate-ai.md`)
- No references to billing-only estimates (those belong in `estimate-billing.md`)
- All cost values are numbers, not strings
- Output is valid JSON

## Schema Phase Status

# .phase-status.json

Lightweight phase tracking. This is the SINGLE source of truth for the `.phase-status.json` schema. All steering files reference this definition.

```json
{
  "migration_id": "0226-1430",
  "last_updated": "2026-02-26T15:35:22Z",
  "phases": {
    "discover": "completed",
    "clarify": "completed",
    "design": "in_progress",
    "estimate": "pending",
    "generate": "pending",
    "feedback": "pending"
  }
}
```

**Field Definitions:**

| Field           | Type     | Set When                                                         |
| --------------- | -------- | ---------------------------------------------------------------- |
| `migration_id`  | string   | Created (matches folder name, never changes)                     |
| `last_updated`  | ISO 8601 | After each phase update                                          |
| `phases.<name>` | string   | Phase transitions: `"pending"` → `"in_progress"` → `"completed"` |

**Rules:**

- Phase status progresses: `"pending"` → `"in_progress"` → `"completed"`. Never goes backward.
- Valid phase names: discover, clarify, design, estimate, generate, feedback.
- `migration_id` matches the `$MIGRATION_DIR` folder name (e.g., `0226-1430`).

## Typed Edges Strategy

# Terraform Clustering: Typed Edge Strategy

Infers edge types from HCL context to classify relationships between resources.

Edges are categorized into two groups:

- **Secondary→Primary relationships** — infrastructure support (identity, network, encryption)
- **Primary→Primary relationships** — service communication (data, cache, messaging, storage)

## Pass 1: Extract References from HCL

Parse HCL configuration text for all `resource_type.name.attribute` patterns:

- Regex: `(google_\w+)\.(\w+)\.(\w+)` or `google_\w+\.[\w\.]+`
- Capture fully qualified references: `google_sql_database_instance.prod.id`
- Include references in: attribute values, `depends_on` arrays, variable interpolations

Store each reference with:

- `reference`: target resource address
- `field_path`: HCL attribute path where reference appears
- `raw_context`: surrounding HCL text (10 lines for LLM context)

## Pass 2: Classify Edge Type by Field Context

For each reference, determine edge type. Use the `secondary_role` of the source resource to guide classification.

### Secondary→Primary Relationships

These use the secondary's `secondary_role` as the relationship type:

- `identity_binding` — service account attached to compute resource
- `network_path` — VPC connector, subnet, firewall serving a resource
- `access_control` — IAM binding granting access to resource
- `configuration` — database user, secret version, DNS record configuring resource
- `encryption` — KMS key protecting a resource
- `orchestration` — null_resource, time_sleep sequencing

### Primary→Primary Relationships

Infer from field paths and environment variable names:

#### Data Dependencies

Field name matches: `DATABASE*`, `DB_*`, `SQL*`, `CONNECTION_*`

Environment variable name matches: `DATABASE*`, `DB_HOST`, `SQL_*`

- **Type**: `data_dependency`
- **Example**: `google_cloud_run_service.app.env.DATABASE_URL` → `google_sql_database_instance.prod.id`

#### Cache Dependencies

Field name matches: `REDIS*`, `CACHE*`, `MEMCACHE*`

- **Type**: `cache_dependency`
- **Example**: `google_cloudfunctions_function.worker.env.REDIS_HOST` → `google_redis_instance.cache.host`

#### Publish Dependencies

Field name matches: `PUBSUB*`, `TOPIC*`, `QUEUE*`, `STREAM*`

- **Type**: `publishes_to`
- **Example**: `google_cloud_run_service.publisher.env.PUBSUB_TOPIC` → `google_pubsub_topic.events.id`

#### Storage Dependencies

Field name matches: `BUCKET*`, `STORAGE*`, `S3*`

Direction determined by context:

- Write context (upload, save, persist) → `writes_to`
- Read context (download, fetch, load) → `reads_from`
- Bidirectional → Both edge types

- **Example**: `google_cloud_run_service.worker.env.STORAGE_BUCKET` → `google_storage_bucket.data.name`

#### DNS Resolution

A DNS record pointing to a compute resource.

- **Type**: `dns_resolution`
- **Example**: `google_dns_record_set.api` → `google_compute_instance.web` (A record pointing to compute IP)

#### Network Membership

Resources sharing the same VPC/subnet.

- **Type**: `network_membership`
- **Example**: Multiple primary resources referencing the same `google_compute_network.main`

### Infrastructure Relationships

These apply to both Secondary→Primary and resource-to-resource references:

#### Network Path

Field name: `vpc_connector`, `network`, `subnetwork`

- **Type**: `network_path`
- **Example**: `google_cloudfunctions_function.app.vpc_connector` → `google_vpc_access_connector.main.id`

#### Encryption

Field name: `kms_key_name`, `encryption_key`, `key_ring`

- **Type**: `encryption`
- **Example**: `google_sql_database_instance.db.backup_encryption_key_name` → `google_kms_crypto_key.sql.id`

#### Orchestration

Explicit `depends_on` array

- **Type**: `orchestration`
- **Example**: `depends_on = [google_project_service.run]`

## Default Fallback

If no patterns match, use LLM to infer edge type from:

- Resource types (compute → storage likely data_dependency)
- Field names and values
- Raw HCL context

If LLM uncertain: `unknown_dependency` with confidence field.

## Evidence Structure

Every edge must include a structured `evidence` object:

```json
{
  "from": "google_cloud_run_service.api",
  "to": "google_sql_database_instance.db",
  "relationship_type": "data_dependency",
  "evidence": {
    "field_path": "template.spec.containers[0].env[].value",
    "reference": "DATABASE_URL"
  }
}
```

Evidence fields:

- `field_path` — HCL attribute path where the reference appears
- `reference` — the specific value, variable name, or env var that creates the relationship

All edges stored in resource's `typed_edges[]` array and in the cluster's `edges[]` array.
