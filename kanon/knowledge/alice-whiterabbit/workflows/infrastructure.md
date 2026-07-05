# ALICE Infrastructure Context

## Environment Layout

| Environment | Path | Purpose |
|---|---|---|
| drcc-ai | `terraform/envs/drcc-ai/` | Main AI environment — Bedrock, AgentCore, API keys, services |
| drcc | `terraform/envs/drcc/` | Base DRCC environment — shared infrastructure |
| core-dev | `terraform/envs/core-dev/` | Development/testing environment |

## Module Inventory

| Module | Path | Key Resources |
|---|---|---|
| bedrock-iam | `terraform/modules/bedrock-iam/` | IAM roles for Bedrock access, `/bedrock/` path scoping |
| bedrock-api-keys | `terraform/modules/bedrock-api-keys/` | API key provisioning and rotation |
| bedrock-agentcore | `terraform/modules/bedrock-agentcore/` | AgentCore agent infrastructure |
| alice-services | `terraform/modules/alice-services/` | Core ALICE services (Lambda, ECS, S3 buckets) |
| cheshire-gate | `terraform/modules/cheshire-gate/` | API Gateway for external access |
| looking-glass | `terraform/modules/looking-glass/` | Vector search / semantic indexing |
| cloudwatch-api-key-dashboard | `terraform/modules/cloudwatch-api-key-dashboard/` | API key usage monitoring |
| aws-ai-consumer-iam | `terraform/modules/aws-ai-consumer-iam/` | Consumer IAM roles |
| kiro-seats | `terraform/modules/kiro-seats/` | Kiro IDE seat management |
| strands-agent | `terraform/modules/strands-agent/` | Strands agent deployment |

## IAM Roles

| Role | ARN Pattern | Use Case |
|---|---|---|
| JH-AiAccessRole | `arn:aws:iam::584034200963:role/bedrock/JH-AiAccessRole` | Developer access — Terraform applies, agent deployment, infra management |
| SSO direct (drcc-ai) | Via AWS SSO | Day-to-day CLI usage, read-only console |

- IAM scoped to `/bedrock/` path
- S3, Secrets Manager, SSM scoped to project namespaces

## AWS Profiles

```ini
# ~/.aws/config
[profile drcc-ai]          # SSO direct — alice CLI usage
[profile drcc-ai-access]   # Assume JH-AiAccessRole — terraform, infra
  role_arn = arn:aws:iam::584034200963:role/bedrock/JH-AiAccessRole
  source_profile = drcc-sso
  region = us-east-1
```

## OpenTofu Workflow

```bash
cd terraform/envs/<env>
tofu init
tofu validate
tofu plan
tofu apply    # requires drcc-ai-access profile
```

## State Management Rules

- Never commit `terraform.tfvars` or `backend.tfvars` with credentials
- Pass secrets via environment variables: `export TF_VAR_<name>=<value>`
- Backend state stored in S3 (configured per environment)
- Use `tofu plan` before every `tofu apply`

## Cross-Module Dependencies

```
drcc-ai environment
├── bedrock-iam (IAM roles)
│   └── bedrock-api-keys (depends on IAM)
│       └── alice-services (depends on API keys)
├── bedrock-agentcore (depends on IAM)
├── cheshire-gate (depends on alice-services)
├── looking-glass (depends on alice-services)
├── cloudwatch-api-key-dashboard (depends on bedrock-api-keys)
└── kiro-seats (standalone)
```

## Resource Naming

- S3 buckets: `jh-{namespace}-{environment}-{purpose}` (e.g., `jh-drcc-ai-audio`)
- Secrets: `{namespace}/{environment}/{name}`
- IAM paths: `/bedrock/`
- Account: `584034200963`, Region: `us-east-1`
