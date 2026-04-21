<!-- forge:version 0.1.0 -->
---
name: terraform
displayName: Deploy infrastructure with Terraform
description: Build and manage Infrastructure as Code with Terraform - access registry providers, modules, policies, and HCP Terraform workflow management
keywords: ["terraform","hashicorp","infrastructure","iac","hcp","providers","modules","registry"]
author: HashiCorp
---

# Terraform Power

## Overview

Access Terraform Registry APIs and HCP Terraform for IaC development. Search provider docs, discover modules, manage workspaces, and execute runs.

**Key capabilities:**
- **Provider Documentation**: Search and retrieve docs for resources, data sources, functions
- **Module Discovery**: Find verified and community modules from the Registry
- **HCP Terraform**: Workspace management, runs, variables, private registry
- **Sentinel Policies**: Access governance and compliance policies

## Available Steering Files

- **getting-started** - Interactive setup guide for new projects
- **terraform-best-practices** - Coding conventions and patterns (auto-loads for .tf files)

## Available MCP Servers

### terraform
**Package:** `hashicorp/terraform-mcp-server` | **Connection:** Docker stdio

**Provider Tools:**

| Tool | Purpose | Returns |
|------|---------|---------|
| `search_providers` | Find provider documentation by service name | List of available documentation with IDs, titles, and categories |
| `get_provider_details` | Retrieve complete documentation for a specific provider component | Full documentation content in markdown format |
| `get_latest_provider_version` | Retrieve the latest version of a specific provider | The latest version of a provider |

**Module Tools:**

| Tool | Purpose | Returns |
|------|---------|---------|
| `search_modules` | Find modules by name or functionality | Module details including names, descriptions, download counts, and verification status |
| `get_module_details` | Get comprehensive module information | Complete documentation with inputs, outputs, examples, and submodules |
| `get_latest_module_version` | Retrieve the latest version of a specific module | The latest version of a module |

**Policy Tools:**

| Tool | Purpose | Returns |
|------|---------|---------|
| `search_policies` | Find Sentinel policies by topic or requirement | Policy listings with IDs, names, and download statistics |
| `get_policy_details` | Retrieve detailed policy documentation | Policy implementation details and usage instructions |

**HCP Terraform/Enterprise Tools** (require `TFE_TOKEN`):

| Tool | Purpose | Returns |
|------|---------|---------|
| `list_terraform_orgs` | Fetch all Terraform organizations | List of organizations with their details |
| `list_terraform_projects` | Fetch all Terraform projects | List of projects with their metadata |
| `list_workspaces` | Search and list workspaces in an organization | Workspace details including configuration and status |
| `get_workspace_details` | Get comprehensive workspace information | Complete workspace configuration, variables, and state information |
| `create_workspace` | Create a new Terraform workspace | Confirmation of workspace creation (destructive operation) |
| `update_workspace` | Update workspace configuration | Updated workspace configuration (potentially destructive) |
| `delete_workspace_safely` | Delete workspace if it manages no resources | Confirmation of deletion (requires `ENABLE_TF_OPERATIONS`) |
| `list_runs` | List or search runs in a workspace | Run details with optional filtering |
| `get_run_details` | Get detailed information about a specific run | Complete run information including logs and status |
| `create_run` | Create a new Terraform run | Run creation confirmation with available run types |
| `action_run` | Perform actions on runs (apply, discard, cancel) | Action confirmation (requires `ENABLE_TF_OPERATIONS`) |
| `search_private_modules` | Find private modules in your organization | List of private modules matching search criteria |
| `get_private_module_details` | Get detailed private module information | Complete module details including inputs, outputs, and examples |
| `search_private_providers` | Find private providers in your organization | List of private providers matching search criteria |
| `get_private_provider_details` | Get detailed private provider information | Provider details including usage and version information |

**Variable Management Tools** (require `TFE_TOKEN`):

| Tool | Purpose | Returns |
|------|---------|---------|
| `list_variable_sets` | List all variable sets in an organization | Variable set details and configurations |
| `create_variable_set` | Create a new variable set | Confirmation of variable set creation |
| `create_variable_in_variable_set` | Add a variable to a variable set | Variable creation confirmation |
| `delete_variable_in_variable_set` | Remove a variable from a variable set | Variable deletion confirmation |
| `attach_variable_set_to_workspaces` | Attach variable set to workspaces | Attachment confirmation |
| `detach_variable_set_from_workspaces` | Detach variable set from workspaces | Detachment confirmation |
| `list_workspace_variables` | List all variables in a workspace | Workspace variable details |
| `create_workspace_variable` | Create a variable in a workspace | Variable creation confirmation |
| `update_workspace_variable` | Update an existing workspace variable | Updated variable configuration |

**Workspace Tagging Tools** (require `TFE_TOKEN`):

| Tool | Purpose | Returns |
|------|---------|---------|
| `create_workspace_tags` | Add tags to a workspace | Tag creation confirmation |
| `read_workspace_tags` | Read all tags from a workspace | List of workspace tags |

## Examples

```javascript
// 1. Search for S3 bucket resource docs
search_providers({
  "provider_name": "aws",
  "provider_namespace": "hashicorp",
  "service_slug": "s3_bucket",
  "provider_document_type": "resources"
})
// Returns: provider_doc_id like "10735923"

// 2. Get full documentation
get_provider_details({ "provider_doc_id": "10735923" })

// 3. Search for VPC modules
search_modules({ "module_query": "vpc" })
// Returns: module_id like "terraform-aws-modules/vpc/aws/6.5.1"

// 4. Get module details
get_module_details({ "module_id": "terraform-aws-modules/vpc/aws/6.5.1" })

// 5. Get latest provider version
get_latest_provider_version({ "namespace": "hashicorp", "name": "aws" })
```

## Workflow: Research → Write Config

```javascript
// Step 1: Search provider docs
const results = search_providers({
  "provider_name": "aws",
  "provider_namespace": "hashicorp", 
  "service_slug": "lambda_function",
  "provider_document_type": "resources"
})

// Step 2: Get detailed docs using provider_doc_id from results
const docs = get_provider_details({ "provider_doc_id": "..." })

// Step 3: Get version for constraint
const version = get_latest_provider_version({ "namespace": "hashicorp", "name": "aws" })

// Now write accurate Terraform config
```

## Configuration

**Prerequisites:** Docker installed and running

### Enabling HCP Terraform Features

By default, this power only includes Terraform Registry tools (providers, modules, policies). To enable HCP Terraform workspace management, runs, and variables, you need to configure your API token.

**Step 1:** Generate an API token from [HCP Terraform](https://app.terraform.io/app/settings/tokens) or your Terraform Enterprise instance.

**Step 2:** Update the `mcp.json` in this power to include your token:

```json
{
  "mcpServers": {
    "terraform": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e", "TFE_TOKEN",
        "hashicorp/terraform-mcp-server"
      ],
      "env": {
        "TFE_TOKEN": "${TFE_TOKEN}"
      },
      "disabled": false
    }
  }
}
```

This uses shell expansion to read the token from your environment. Set it with `export TFE_TOKEN=your-api-token-here` before launching Kiro.

> ⚠️ **IMPORTANT: Docker Container Restart Required**
> 
> After adding or changing `TFE_TOKEN`, `TFE_ADDRESS`, or any other environment variables, you **must restart the Docker container** for the changes to take effect. The MCP server runs inside Docker and only reads environment variables at container startup.
> 
> To restart: Stop the running container and reconnect the MCP server in Kiro, or restart Kiro entirely.

### Terraform Enterprise (Custom Endpoint)

For organizations using Terraform Enterprise with a custom endpoint, add the `TFE_ADDRESS` environment variable:

```json
{
  "mcpServers": {
    "terraform": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e", "TFE_TOKEN",
        "-e", "TFE_ADDRESS",
        "hashicorp/terraform-mcp-server"
      ],
      "env": {
        "TFE_TOKEN": "${TFE_TOKEN}",
        "TFE_ADDRESS": "${TFE_ADDRESS}"
      },
      "disabled": false
    }
  }
}
```

### Environment Variables Reference

| Variable | Description |
|----------|-------------|
| `TFE_TOKEN` | HCP Terraform or Terraform Enterprise API token (required for workspace/run tools) |
| `TFE_ADDRESS` | Custom Terraform Enterprise URL (omit for HCP Terraform at `app.terraform.io`) |
| `ENABLE_TF_OPERATIONS` | Set to `true` to enable destructive operations (apply/destroy) |

## Best Practices

**Do:** Always `search_*` before `get_*_details`, pin versions, use modules, review plans

**Don't:** Hardcode credentials, skip plan review, use `auto_approve` blindly

## Troubleshooting

| Error | Solution |
|-------|----------|
| Provider/Module not found | Use `search_*` first to get valid IDs |
| Unauthorized | Set `TFE_TOKEN` env var |
| Token set but still unauthorized | **Restart the Docker container** - env vars are only read at startup |
| Docker not running | Start Docker daemon |
| Changed TFE_ADDRESS but still hitting wrong endpoint | **Restart the Docker container** after changing any env vars |

## Resources

[Terraform MCP Docs](https://developer.hashicorp.com/terraform/mcp-server/reference) · [Registry](https://registry.terraform.io) · [HCP Terraform](https://app.terraform.io) · [MCP Server repo](https://github.com/hashicorp/terraform-mcp-server)

---

**Package:** `hashicorp/terraform-mcp-server` | **License:** MPL-2.0

## Code Style

# Terraform Code Style Guidelines

HashiCorp's official Terraform style guide for consistent, maintainable infrastructure-as-code.

## Module Structure

```
├── README.md
├── main.tf
├── variables.tf
├── outputs.tf
├── modules/
│   ├── nestedA/
│   │   ├── README.md
│   │   ├── variables.tf
│   │   ├── main.tf
│   │   ├── outputs.tf
├── examples/
│   ├── exampleA/
│   │   ├── main.tf
```

### Required Files
- `main.tf` – Primary resource and data source definitions
- `variables.tf` – Input variable definitions (alphabetical order)
- `outputs.tf` – Output value definitions (alphabetical order)
- `README.md` – Module purpose, usage, examples

### Recommended Files
- `providers.tf` – Provider configurations
- `terraform.tf` – Terraform version requirements
- `backend.tf` – Backend configuration (root modules only)
- `locals.tf` – Local value definitions

## Code Formatting

- Indent two spaces for each nesting level
- Align equals signs for consecutive single-line arguments
- Arguments first, then nested blocks with blank line separation
- Meta-arguments (count, for_each) first
- lifecycle blocks last, separated by blank lines
- One blank line between top-level blocks
- Run `terraform fmt` before every commit

## Resource Organization

- Define data sources before resources that reference them
- Group related resources (networking, compute, storage)
- Order: meta-arguments → resource parameters → nested blocks → lifecycle → depends_on

## Resource Naming

```hcl
# Good: descriptive nouns, underscores, no type in name
resource "aws_instance" "web_server" {}

# Bad: type in name
resource "aws_instance" "webserver_instance" {}
```

## Variables and Outputs

```hcl
variable "instance_type" {
  type        = string
  description = "EC2 instance type"
  default     = "t3.micro"
  sensitive   = false
}

output "instance_id" {
  description = "ID of the EC2 instance"
  value       = aws_instance.web_server.id
  sensitive   = false
}
```

Order: type → description → default → sensitive → validation

## Comments

- Use `#` for comments (not `//` or `/* */`)
- Write self-documenting code
- Comment only to clarify complexity or business logic

## Dynamic Resources

```hcl
# count for on/off or identical resources
resource "aws_instance" "web" {
  count = var.enable_web ? var.instance_count : 0
}

# for_each for distinct values
resource "aws_subnet" "private" {
  for_each = toset(var.availability_zones)
  availability_zone = each.value
}
```

## Version Management

```hcl
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"  # Pessimistic constraint
    }
  }
}
```

- Use `~>` for modules/providers (allows safe updates)
- Document rationale for strict constraints
- Avoid open-ended constraints (`>`, `>=` without upper bound)

## Security

- Never commit `terraform.tfstate` or `.terraform/`
- Use dynamic provider credentials when possible
- Access secrets from external secret management
- Set `sensitive = true` for sensitive variables
- Use environment variables for provider credentials

## Testing

- Write Terraform tests for modules
- Run tests in CI/CD pipelines
- Use validation blocks with meaningful error messages
- Validate inputs before resource creation

## State Management

- Use remote state storage (S3, HCP Terraform, etc.)
- Use `tfe_outputs` data source for cross-workspace data
- Separate environments into different workspaces/directories

## Getting Started

# Get Started with Terraform

## Overview

Interactive guide for setting up Terraform in a new project.

## Trigger

When user says "Get started with Terraform" or similar.

---

## Step 1: Check Existing Setup

Look for `*.tf` files, `.terraform/`, `terraform.tfstate`.

**If found:** Ask to continue or start fresh.
**If not:** Proceed to Step 2.

## Step 2: Determine Provider

Ask: "Which cloud provider? (AWS, Azure, GCP, other)"

Use MCP to get provider info:
```javascript
search_providers({
  "provider_name": "aws",
  "provider_namespace": "hashicorp",
  "service_slug": "aws",
  "provider_document_type": "overview"
})

get_latest_provider_version({ "namespace": "hashicorp", "name": "aws" })
```

## Step 3: Create Base Files

**versions.tf:**
```hcl
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"  # Use version from MCP
    }
  }
}
```

**provider.tf:**
```hcl
provider "aws" {
  region = var.aws_region
}
```

**variables.tf:**
```hcl
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}
```

## Step 4: First Resource

Ask what to create. Use MCP to get docs:

```javascript
// Search for resource
search_providers({
  "provider_name": "aws",
  "provider_namespace": "hashicorp",
  "service_slug": "s3_bucket",
  "provider_document_type": "resources"
})

// Get full docs with provider_doc_id from results
get_provider_details({ "provider_doc_id": "..." })
```

Or find a module:
```javascript
search_modules({ "module_query": "vpc aws" })
get_module_details({ "module_id": "terraform-aws-modules/vpc/aws/6.5.1" })
```

## Step 5: Initialize

Guide through:
1. `terraform init`
2. `terraform validate`
3. `terraform plan`

## Step 6: What's Next

Offer help with:
- Adding resources/modules
- Multiple environments
- HCP Terraform setup
- CI/CD pipelines

---

## Quick Reference

```bash
terraform init      # Initialize
terraform fmt       # Format
terraform validate  # Validate
terraform plan      # Preview
terraform apply     # Apply
```

## File Structure

```
project/
├── versions.tf      # Terraform/provider versions
├── provider.tf      # Provider config
├── variables.tf     # Input variables
├── main.tf          # Resources
├── outputs.tf       # Outputs
└── terraform.tfvars # Values (don't commit secrets)
```

## Mcp Usage

# Terraform MCP Server Usage Instructions

Guidelines for using the Terraform MCP server to generate high-quality Terraform code.

## Core Capabilities

- **Registry Integration**: Access public and private Terraform registries for module/provider info
- **Style Guide Compliance**: Consistent HCL/TF file generation
- **Workflow Automation**: HCP Terraform and Terraform Enterprise API operations

## Operational Guidelines

### Pre-Generation Phase

**ALWAYS** consult the MCP server before generating Terraform code to:

1. Retrieve latest provider documentation and constraints
2. Access organization-specific styling guidelines
3. Identify available modules and their requirements
4. Understand enterprise-specific policies

### Registry Search Priority

When enterprise tools are enabled AND a Terraform token is provided:

1. **First**: Search private registries for modules and providers
2. **Second**: Fall back to public registry if no results
3. **Document**: Note the source registry in comments

### Provider Consistency Rules

**CRITICAL**: Maintain provider version consistency across all modules:

- Verify provider requirements before module creation
- Ensure compatible provider version constraints
- Flag any provider version conflicts before code generation
- Use explicit version pinning when required

### Validation Workflow

Execute validation in this order:

1. **terraform validate**: Run immediately after code generation
   - Verify syntax correctness
   - Check resource attribute validity
   - Ensure provider configuration completeness

2. **terraform plan**: Only after successful validation
   - Review resource changes
   - Identify potential issues before apply

### User Confirmation Requirements

**MANDATORY**: Request explicit user confirmation before:

- `create_run`: Initiates a new Terraform run
- `apply_run`: Applies changes to infrastructure
- `discard_run`: Discards a planned run
- `cancel_run`: Cancels an in-progress run

**Confirmation prompt should include**:
- Clear description of the operation
- List of resources to be affected
- Potential risks or impacts
- Request for explicit "yes/no" confirmation

## Error Handling

1. **Registry Access Failure**: Log error, attempt fallback, inform user
2. **Validation Errors**: Parse messages, provide remediation steps, re-validate
3. **Plan Failures**: Analyze output, suggest adjustments, document assumptions

## Best Practices

### Context Preservation
- Maintain state of previous MCP server queries within session
- Track which registries have been searched
- Remember user preferences stated earlier

### Progressive Enhancement
- Start with minimal viable configuration
- Iteratively add complexity based on validation results
- Use MCP server feedback to refine generated code

### Documentation Generation
- Include inline comments explaining non-obvious configurations
- Document registry sources for modules
- Add README sections for complex modules

### Security Considerations
- Never expose Terraform tokens in outputs
- Sanitize sensitive data in error messages
- Follow principle of least privilege for API operations

## Troubleshooting Checklist

- [ ] MCP server connection verified
- [ ] Appropriate registry searched based on token availability
- [ ] Style guide resources retrieved and applied
- [ ] Provider consistency validated across modules
- [ ] terraform validate executed successfully
- [ ] terraform plan reviewed (if applicable)
- [ ] User confirmation obtained for destructive operations

## Terraform Best Practices

# Terraform Best Practices

Auto-loaded when editing .tf files.

## Naming

```hcl
# snake_case, descriptive names
resource "aws_instance" "web_server" {}
resource "aws_security_group" "allow_https" {}

variable "instance_type" {}
variable "enable_monitoring" {}
```

## File Structure

```
module/
├── main.tf          # Resources
├── variables.tf     # Inputs
├── outputs.tf       # Outputs
├── versions.tf      # Version constraints
└── README.md        # Docs
```

Add new resources to the `main.tf` file. Once this file contains more than 15 resources, put additional resources into their own separate .tf files. For example, if adding OpenSearch resources, put them in a file named, `opensearch.tf`.

Always add new outputs to the `outputs.tf` file.

## Variables

```hcl
variable "environment" {
  description = "Deployment environment"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Must be dev, staging, or prod."
  }
}

variable "database_password" {
  description = "DB password"
  type        = string
  sensitive   = true
}
```

## Modules

```hcl
# Pin versions
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.0"

  name = "my-vpc"
  cidr = "10.0.0.0/16"
}
```

## Patterns

```hcl
# count for on/off
resource "aws_nat_gateway" "main" {
  count = var.enable_nat ? 1 : 0
}

# for_each for collections
resource "aws_subnet" "private" {
  for_each          = toset(var.availability_zones)
  availability_zone = each.value
}

# locals for computed values
locals {
  common_tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
```

## Security

```hcl
# Use data sources for secrets
data "aws_secretsmanager_secret_version" "db" {
  secret_id = "prod/database/password"
}

# Least privilege IAM
data "aws_iam_policy_document" "lambda" {
  statement {
    effect    = "Allow"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["arn:aws:logs:*:*:log-group:/aws/lambda/${var.function_name}:*"]
  }
}
```

## Do / Don't

**Do:** Pin versions, use modules, validate inputs, use remote state, review plans

**Don't:** Hardcode secrets, use wildcards in IAM, skip version constraints, commit .tfvars with secrets
