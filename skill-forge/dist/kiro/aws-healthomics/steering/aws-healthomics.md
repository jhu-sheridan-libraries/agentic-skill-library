<!-- forge:version 0.1.0 -->
---
inclusion: manual
---

# When to use this power

When you want to create, migrate, run, debug and identify optimization opportunities for genomics workflows in AWS HealthOmics

# When to Load Steering Files

Whenever you are asked to perform a task related to any of the following scenarios - ensure you load and read the appropriate markdown file mentioned

- Creating a workflow from a remote Git repository URL (GitHub, GitLab, Bitbucket) -> use `./steering/git-integration.md` (takes precedence over workflow-development.md)
- Creating a new WDL, Nextflow or CWL workflow from local files -> use `./steering/workflow-development.md`
- Running a deployed HealthOmics workflow -> use `./steering/running-a-workflow.md`
- Submitting, monitoring, or managing batch runs (multiple samples/runs at once) -> use `./steering/batch-runs.md`
- Onboarding an existing WDL workflow ensuring compatibility with HealthOmics -> use `./steering/migration-guide-for-wdl.md`
- Onboarding an existing Nextflow workflow ensuring compatibility with HealthOmics -> use `./steering/migration-guide-for-nextflow.md`
- Modifying, updating, or fixing an existing HealthOmics workflow -> use `./steering/workflow-versioning.md`
- Diagnosing workflow creation issues -> use `./steering/troubleshooting.md`
- Diagnosing run failures -> use `./steering/troubleshooting.md`
- Using public containers with HealthOmics via ECR Pullthrough Caches -> use `./steering/ecr-pull-through-cache.md`
- Setting up VPC infrastructure for HealthOmics workflows (subnets, NAT Gateway, security groups, endpoints) -> use `./steering/vpc-setup.md`
- Managing HealthOmics VPC configurations (creating, listing, getting, or deleting configurations) -> use `./steering/healthomics-configuration.md`
- Running workflows with VPC connectivity, public internet access, cross-region access, or access to private VPC resources -> use `./steering/vpc-connected-workflow-runs.md`


# Onboarding

1. **Ensure the user has valid AWS Credentials** These are used by the HealthOmics MCP server to interact with AWS Services.
2. **Obtain the current account number**  Using `aws sts get-caller-identity`
3. **Create a `config.toml`** Create a `.healthomics/config.toml` file to specify run parameters. This helps you, the agent, create workflows and start runs with the correct settings:

    **config.toml:**
    ```toml
    // This is a service role used to start runs, it must have a trust policy for the omics principal
    omics_iam_role = "arn:aws:iam::<ACCOUNT_ID>:role/<HEALTHOMICS_ROLE_NAME>"
    // Outputs of runs are written here, the service role must have write permissions to this location
    run_output_uri = "s3://<YOUR_BUCKET>/healthomics-outputs/"
    run_storage_type = "DYNAMIC"  # Recommended for faster runs and automatic scaling
    ```

    - Ask the customer for the `omics_iam_role` and `run_output_uri` values. You may also offer to create them. Record the values by updating the toml
    - ALWAYS use settings from `.healthomics/config.toml` when they are set
4. **Dependencies** The MCP server configured by this power requires [`uvx`](https://docs.astral.sh/uv/getting-started/installation/)
```

# Integrations

This power integrates with [AWS Healthomics MCP Server](https://github.com/awslabs/mcp/tree/main/src/aws-healthomics-mcp-server)  (Apache-2.0 license).


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

## Batch Runs

# SOP: Batch Runs in HealthOmics

## Purpose

This SOP defines how you, the agent, submit, monitor, and manage batch runs in AWS HealthOmics. Batch runs let users submit multiple runs in a single API request, sharing a common base configuration with per-run parameter overrides. Use batch runs to reduce submission overhead and simplify lifecycle management for large-scale workflow processing.

## Trigger Conditions

Follow this SOP WHEN:
- User wants to run the same workflow across multiple samples or inputs.
- User wants to submit many runs at once (up to 100,000).
- User mentions "batch", "batch run", or "multiple samples" in the context of running workflows.
- User wants to cancel or delete multiple runs that were submitted together.
- User wants to monitor progress across a group of related runs.

DO NOT follow this SOP WHEN:
- User wants to run a single workflow with a single set of inputs — use the [Running a Workflow SOP](./running-a-workflow.md).
- User wants to re-run a single failed run — use the [Running a Workflow SOP](./running-a-workflow.md).

## Key Concepts

- **Batch** — A collection of workflow runs sharing common configuration, managed as a single resource with its own ARN and lifecycle status.
- **defaultRunSetting** — Shared configuration for all runs in the batch (workflow ID, IAM role, output URI, common parameters).
- **Run-specific settings** — Per-run configurations (via `inlineSettings` or `s3UriSettings`) that override or merge with the default. Each MUST include a unique `runSettingId`.
- **runSettingId** — A required, customer-provided unique identifier for each run configuration. Use `ListRunsInBatch` to map each `runSettingId` to the HealthOmics-generated `runId`.
- **Parameter merging** — Per-run parameters are merged with `defaultRunSetting` parameters. Run-specific values take precedence when keys overlap. The same merging applies to `runTags`.

### Batch Status Lifecycle

`PENDING` → `SUBMITTING` → `INPROGRESS` → `PROCESSED`

Other terminal states: `CANCELLED`, `FAILED`, `RUNS_DELETED`.

## Prerequisites

1. An active HealthOmics private workflow. Batch runs are NOT supported with Ready2Run workflows.
2. An IAM service role with permissions to run HealthOmics workflows and access S3 buckets.
3. S3 locations for input data and output results.
4. Run-specific parameters for each sample or configuration.
5. ALWAYS read and use preferences/defaults from `.healthomics/config.toml` if present.

## IAM Permissions

The user's IAM identity MUST have permissions for both batch operations and the underlying run operations. `StartRunBatch` requires dual authorization: `omics:StartRunBatch` on the batch resource AND `omics:StartRun` on the run, workflow, and run group resources.

Required batch actions:
- `omics:StartRunBatch`
- `omics:GetBatch`
- `omics:ListBatch`
- `omics:ListRunsInBatch`
- `omics:CancelRunBatch`
- `omics:DeleteRunBatch`
- `omics:DeleteBatch`

The IAM service role passed in `roleArn` requires the same permissions as for individual `StartRun` calls.

## Procedure

### Step 1: Prepare the Batch Configuration

1. Verify the workflow is deployed and `ACTIVE` via `GetAHOWorkflow`.
2. Identify the shared configuration for `defaultRunSetting`:
   - `workflowId` — The deployed workflow ID.
   - `roleArn` — IAM service role ARN (check `.healthomics/config.toml`).
   - `outputUri` — S3 output location (check `.healthomics/config.toml`).
   - `storageType` — Use `DYNAMIC` (recommended).
   - `parameters` — Common parameters shared across all runs (e.g., reference genome).
3. Prepare per-run configurations, each with a unique `runSettingId` and any parameter overrides.

### Step 2: Choose Submission Method

- **Inline settings (≤100 runs):** Provide run configurations directly via `inlineSettings` array.
- **S3 settings (>100 runs, up to 100,000):** Store run configurations as a JSON array in S3 and provide the URI via `s3UriSettings`.

IF using `s3UriSettings`:
- The S3 file MUST be a JSON array of run setting objects.
- Maximum file size is 6 GB.
- The IAM service role in `roleArn` MUST have read access to the S3 file.
- DO NOT modify the S3 file after submission — HealthOmics validates the file's ETag and fails the batch if the file changes.

### Step 3: Submit the Batch

Call `StartAHORunBatch` with:
- `batchName` — A human-readable name for the batch.
- `defaultRunSetting` — The shared configuration.
- `batchRunSettings` — Either `inlineSettings` (array) or `s3UriSettings` (S3 URI).
- `requestId` — An idempotency token to prevent duplicate submissions (optional but recommended).
- `tags` — Tags for the batch resource itself (optional).

The API validates common fields synchronously and returns a batch ID with status `PENDING`. Runs are submitted gradually and asynchronously according to throughput quotas.

### Step 4: Monitor Batch Progress

1. Call `GetAHOBatch` to check overall status and submission progress.
   - `status` — Overall batch state.
   - `submissionSummary` — Counts of successful and failed submissions.
   - `runSummary` — Counts of runs in each execution state.
2. Call `ListAHORunsInBatch` to get details for individual runs.
   - Each entry maps `runSettingId` to the HealthOmics-generated `runId`.
   - Filter by `submissionStatus` to find failed submissions.

Run execution summaries are eventually consistent and may lag behind actual run states. Final counts are accurate once the batch reaches `PROCESSED`.

### Step 5: Handle Failures

There are two distinct failure types:

#### Batch-level failures
The batch itself failed — no runs were created (or only some were). Batch status is `FAILED`.
1. Call `GetAHOBatch` and check the `failureReason` field.
2. Fix the issue (e.g., too many runs, invalid workflow ID, inaccessible S3 URI).
3. Submit a new batch with corrected configuration.

#### Run-level failures
The batch succeeded but individual runs failed to submit. The batch continues processing other runs.
1. Call `GetAHOBatch` and check `submissionSummary.failedStartSubmissionCount`.
2. Call `ListAHORunsInBatch` with `submissionStatus=FAILED` to identify which runs failed.
3. Check `submissionFailureReason` and `submissionFailureMessage` for each failed run.
4. Create a new batch containing only the corrected run configurations with the same `defaultRunSetting`.

HealthOmics automatically retries transient errors (`ThrottlingException`, `RequestTimeoutException`, `InternalServerException`). A run is marked `FAILED` only after all retries are exhausted. Non-retryable errors (`ValidationException`, `AccessDeniedException`, `ResourceNotFoundException`) fail immediately.

## Canceling a Batch

Call `CancelAHORunBatch` to cancel a batch in progress.
- Cancel is only allowed on batches in `PENDING`, `SUBMITTING`, or `INPROGRESS` state.
- Only one cancel or delete operation per batch is allowed at a time.
- Cancel operations are non-atomic and may be partially successful. Use `GetAHOBatch` to review `successfulCancelSubmissionCount` and `failedCancelSubmissionCount`.

## Deleting Batch Runs

Call `DeleteAHORunBatch` to delete the individual runs within a batch.
- Delete is only allowed on batches in `PROCESSED` or `CANCELLED` state.
- Only one cancel or delete operation per batch is allowed at a time.
- Delete operations are non-atomic and may be partially successful.

## Deleting Batch Metadata

Call `DeleteAHOBatch` to remove the batch resource and its metadata.
- Requires the batch to be in a terminal state (`PROCESSED`, `FAILED`, `CANCELLED`, or `RUNS_DELETED`).
- Does NOT delete individual runs. Call `DeleteAHORunBatch` first if you want to remove runs.
- After deletion, the batch metadata is no longer accessible.

## Example

### Inline settings (small batch)

```json
{
  "batchName": "cohort-analysis",
  "defaultRunSetting": {
    "workflowId": "1234567",
    "roleArn": "arn:aws:iam::123456789012:role/OmicsRole",
    "outputUri": "s3://my-bucket/output/",
    "storageType": "DYNAMIC",
    "parameters": {
      "referenceUri": "s3://my-bucket/reference/genome.fasta"
    }
  },
  "batchRunSettings": {
    "inlineSettings": [
      {
        "runSettingId": "sample-A",
        "name": "Sample-A-Analysis",
        "parameters": {
          "inputUri": "s3://my-bucket/input/sample-A.fastq"
        }
      },
      {
        "runSettingId": "sample-B",
        "name": "Sample-B-Analysis",
        "parameters": {
          "inputUri": "s3://my-bucket/input/sample-B.fastq"
        }
      }
    ]
  }
}
```

### S3 settings (large batch)

```json
{
  "batchName": "large-cohort",
  "defaultRunSetting": {
    "workflowId": "1234567",
    "roleArn": "arn:aws:iam::123456789012:role/OmicsRole",
    "outputUri": "s3://my-bucket/output/",
    "storageType": "DYNAMIC",
    "parameters": {
      "referenceUri": "s3://my-bucket/reference/genome.fasta"
    }
  },
  "batchRunSettings": {
    "s3UriSettings": "s3://my-bucket/configs/run-configs.json"
  }
}
```

The S3 file at `s3://my-bucket/configs/run-configs.json` is a JSON array with the same structure as `inlineSettings`:

```json
[
  {
    "runSettingId": "sample-001",
    "parameters": { "inputUri": "s3://my-bucket/input/sample-001.fastq" }
  },
  {
    "runSettingId": "sample-002",
    "parameters": { "inputUri": "s3://my-bucket/input/sample-002.fastq" }
  }
]
```

## Limitations and Considerations

- **Shared throughput quotas** — Batch operations share the same per-account quotas as individual API counterparts. Avoid calling individual run APIs while a large batch is in progress.
- **Non-atomic operations** — `StartRunBatch`, `CancelRunBatch`, and `DeleteRunBatch` can all be partially successful. Always check submission summaries.
- **Eventual consistency** — Run execution status counts in `GetBatch` may lag behind actual run states.
- **Single filter per list call** — `ListRunsInBatch` and `ListBatch` support only one filter per API call.
- **Re-run not supported** — The `runId` (re-run) field is not supported in `StartRunBatch`. Each batch always creates new runs.
- **Ready2Run workflows** — Not supported with batch runs.
- **Inline limit** — `inlineSettings` supports up to 100 entries. For larger batches, use `s3UriSettings`.
- **S3 file immutability** — Do not modify the S3 configuration file after submitting the batch.

## Ecr Pull Through Cache

# SOP: ECR Pull-Through Cache and Container Registry Maps

## Purpose

This SOP defines how you, the agent, configure ECR Pull-Through Caches and Container Registry Maps so that HealthOmics workflows can access containers from public registries. HealthOmics requires containers from PRIVATE ECR repositories with correct permissions.

## Key Concepts

- **ECR Pull-Through Cache**: Automatically pulls and caches containers from upstream registries. Workflows reference containers using ECR private URIs.
- **Container Registry Map**: Optional mapping that allows workflows to use original public registry URIs while HealthOmics automatically redirects to your ECR pull-through caches.

## When to Use Each Approach

- **New workflows**: Use ECR pull-through caches with private ECR URIs (registry maps not needed).
- **Migrating existing workflows**: Use container registry maps to avoid changing container URIs in workflow definitions.

## Prerequisites

- AWS credentials configured with appropriate IAM permissions for ECR and HealthOmics.
- For Docker Hub: a Docker Hub access token (obtain from https://docs.docker.com/security/access-tokens/).

## MCP Tools Reference

| Tool | Purpose |
|------|---------|
| `ValidateHealthOmicsECRConfig` | Validate ECR configuration for HealthOmics |
| `ListPullThroughCacheRules` | List existing PTC rules with HealthOmics usability status |
| `CreatePullThroughCacheForHealthOmics` | Create PTC rules pre-configured for HealthOmics |
| `ListECRRepositories` | List ECR private repositories with HealthOmics accessibility status |
| `CheckContainerAvailability` | Check if a container is available and accessible by HealthOmics |
| `CloneContainerToECR` | Clone containers to ECR with HealthOmics access permissions |
| `GrantHealthOmicsRepositoryAccess` | Grant HealthOmics access to an ECR repository |
| `CreateContainerRegistryMap` | Generate container registry maps for workflows |

## Procedure

### Step 1: Validate Current ECR Configuration

1. Call `ValidateHealthOmicsECRConfig` to check:
   - Existing pull-through cache rules.
   - Registry permissions policy for HealthOmics.
   - Repository creation templates.
   - Required permissions for each prefix.
2. Review the returned list of issues with specific remediation steps.

### Step 2: Create Secrets for Authenticated Registries

IF the upstream registry requires authentication, create secrets in AWS Secrets Manager BEFORE creating pull-through cache rules.

Docker Hub Secret (required for Docker Hub):
```bash
aws secretsmanager create-secret \
    --name "ecr-pullthroughcache/docker-hub" \
    --description "Docker Hub credentials for ECR pull through cache" \
    --secret-string '{"username": "your-docker-username", "accessToken": "your-docker-access-token"}' \
    --region us-east-1
```

Quay.io Secret (ONLY for private Quay repositories):
```bash
aws secretsmanager create-secret \
    --name "ecr-pullthroughcache/quay" \
    --description "Quay.io credentials for ECR pull through cache" \
    --secret-string '{"username": "your-quay-username", "accessToken": "your-quay-access-token"}' \
    --region us-east-1
```

### Step 3: Create Pull-Through Cache Rules

1. Call `ListPullThroughCacheRules` to check for existing rules. IF a valid cache already exists for the upstream registry, reuse it — DO NOT create another.
2. Call `CreatePullThroughCacheForHealthOmics` with:
   - `upstream_registry`: `docker-hub`, `quay`, or `ecr-public`
   - `ecr_repository_prefix`: OPTIONAL custom prefix (defaults to registry type name)
   - `credential_arn`: OPTIONAL Secrets Manager ARN (REQUIRED for `docker-hub`)

This tool automatically:
- Creates the pull-through cache rule.
- Updates the registry permissions policy for HealthOmics.
- Creates a repository creation template granting HealthOmics image pull permissions.

| Registry | upstream_registry | credential_arn | Notes |
|----------|------------------|----------------|-------|
| Docker Hub | `docker-hub` | Required | Use secret ARN from Step 2 |
| Quay.io | `quay` | Optional | Only needed for private repos |
| ECR Public | `ecr-public` | Not needed | Public access |

### Step 4: Verify Pull-Through Cache Configuration

1. Call `ListPullThroughCacheRules` to verify rules are properly configured.
2. A rule is usable by HealthOmics WHEN:
   - Registry permissions policy grants HealthOmics required permissions.
   - Repository creation template exists for the prefix.
   - Template grants HealthOmics image pull permissions.

### Step 5: Check Container Availability

1. Call `CheckContainerAvailability` with:
   - `repository_name`: ECR repository name (e.g., `docker-hub/library/ubuntu`)
   - `image_tag`: image tag (default: `latest`)
   - `initiate_pull_through`: set to `true` to trigger pull-through for missing images (recommended)

Example repository names for pull-through caches:
- Docker Hub official: `docker-hub/library/ubuntu`
- Docker Hub user: `docker-hub/broadinstitute/gatk`
- Quay.io: `quay/biocontainers/samtools`
- ECR Public: `ecr-public/lts/ubuntu`

### Step 6: Clone Containers (Alternative Approach)

IF you need containers from registries NOT supported by pull-through cache (e.g., Seqera Wave), OR you want to copy without pull-through:

1. Call `CloneContainerToECR` — it will:
   - Parse source image references (handles Docker Hub shorthand).
   - Use existing pull-through cache rules when available.
   - Grant HealthOmics access permissions automatically.
   - Return the ECR URI and digest.

Supported image reference formats:
- `ubuntu:latest` → Docker Hub official
- `myorg/myimage:v1` → Docker Hub user
- `quay.io/biocontainers/samtools:1.17` → Quay.io
- `public.ecr.aws/lts/ubuntu:22.04` → ECR Public
- Image URIs with hashes (`sha256:...`) are also supported.

### Step 7: Grant HealthOmics Access to Existing Repositories

1. Call `ListECRRepositories` to list repositories and check HealthOmics accessibility status.
2. For repositories NOT created through pull-through cache, call `GrantHealthOmicsRepositoryAccess` to add required permissions:
   - `ecr:BatchGetImage`
   - `ecr:GetDownloadUrlForLayer`
3. The tool preserves existing repository policies while adding HealthOmics permissions.

### Step 8: Create Container Registry Maps (Optional)

IF migrating existing workflows that reference public container URIs you MUST create a container registry map (preferred) ALTERNATIVELY you MAY replace the existing container URIs with the new ECR Private URIs:

IF you have cloned containers not supported by ECR PTC you MUST provide image mappings for those containers:

1. Call `CreateContainerRegistryMap` with:
   - `include_pull_through_caches`: auto-discover and include PTC rules (default: `true`)
   - `additional_registry_mappings`: custom registry mappings
   - `image_mappings`: specific image overrides (take precedence over registry mappings)

2. Use the generated map:
   - Pass directly to `CreateAHOWorkflow` via `container_registry_map` parameter.
   - OR upload to S3 and reference via `container_registry_map_uri` parameter.

Example registry map:
```json
{
    "registryMappings": [
        { "upstreamRegistryUrl": "registry-1.docker.io", "ecrRepositoryPrefix": "docker-hub" },
        { "upstreamRegistryUrl": "quay.io", "ecrRepositoryPrefix": "quay" },
        { "upstreamRegistryUrl": "public.ecr.aws", "ecrRepositoryPrefix": "ecr-public" }
    ]
}
```

Example image overrides:
```json
{
    "imageMappings": [
        {
            "sourceImage": "ubuntu",
            "destinationImage": "123456789012.dkr.ecr.us-east-1.amazonaws.com/docker-hub/library/ubuntu:20.04"
        }
    ]
}
```

Registry mappings and image mappings can be combined. Image mappings override any matching registry mapping.

### Step 9: Configure HealthOmics Service Role

ENSURE the HealthOmics service role has ECR permissions:
```json
{
    "Effect": "Allow",
    "Action": [
        "ecr:BatchGetImage",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchCheckLayerAvailability"
    ],
    "Resource": [
        "arn:aws:ecr:us-east-1:123456789012:repository/docker-hub/*",
        "arn:aws:ecr:us-east-1:123456789012:repository/quay/*",
        "arn:aws:ecr:us-east-1:123456789012:repository/ecr-public/*"
    ]
}
```

Adjust repository ARN patterns to match your pull-through cache prefixes.

## Regions

Configure your ECR registry and HealthOmics workflows in the SAME region. IF using multiple regions, repeat these steps in each region.

## Quick Reference: Common Workflows

### New Workflow with Pull-Through Cache
1. `CreatePullThroughCacheForHealthOmics` — create PTC rule.
2. `ValidateHealthOmicsECRConfig` — verify configuration.
3. Use ECR URIs in workflow OR use container registry mapping.

### Migrate Existing Workflow
1. `CreatePullThroughCacheForHealthOmics` — create required PTC rules.
2. `CreateContainerRegistryMap` — generate registry map.
3. `CloneContainerToECR` — clone containers from unsupported registries.
4. `CreateAHOWorkflow` with `container_registry_map` parameter.

### Verify Container Access
1. `CheckContainerAvailability` with `initiate_pull_through: true`.
2. `ListECRRepositories` with `filter_healthomics_accessible: true`.

### Troubleshoot Access Issues
1. `ValidateHealthOmicsECRConfig` — check for configuration issues.
2. `ListPullThroughCacheRules` — verify PTC rule status.
3. `GrantHealthOmicsRepositoryAccess` — fix repository permissions.

## Git Integration

# SOP: Git Integration for HealthOmics Workflows

## Purpose

This SOP defines how you, the agent, handle workflow creation when a user provides a Git repository URL. You MUST use the `definitionRepository` parameter instead of manually cloning, packaging, and uploading.

## Trigger Conditions

Follow this SOP WHEN:
- User provides a GitHub, GitLab, or Bitbucket repository URL
- User wants to create a workflow from a specific branch, tag, or commit
- User references a public workflow repository (e.g., nf-core pipelines)
- User wants to keep their workflow definition in source control

DO NOT follow this SOP WHEN:
- User has local workflow files not in a Git repository — use traditional packaging instead
- User provides an S3 URI for the workflow definition
- User explicitly requests local packaging

## Supported Git Providers

| Provider | URL Format |
|----------|------------|
| GitHub | `https://github.com/owner/repo` |
| GitLab | `https://gitlab.com/owner/repo` |
| Bitbucket | `https://bitbucket.org/owner/repo` |
| GitLab Self-Managed | `https://gitlab.example.com/owner/repo` |
| GitHub Enterprise | `https://github.example.com/owner/repo` |

## Procedure

### Step 1: Check for Existing Code Connections

1. Call `ListCodeConnections(provider_type_filter="GitHub")` (or GitLab, Bitbucket as appropriate).
2. IF a connection with status `AVAILABLE` exists, use its `connection_arn`. Proceed to Step 3.
3. IF no suitable connection exists, proceed to Step 2.

### Step 2: Create Code Connection (If Needed)

1. Call `CreateCodeConnection` with:
   - `connection_name`: a descriptive name (e.g., `"my-github-connection"`)
   - `provider_type`: one of `GitHub`, `GitLab`, `Bitbucket`, `GitHubEnterpriseServer`, `GitLabSelfManaged`
2. INFORM the user they must complete OAuth authorization in the AWS Console.
   - The tool returns a `console_url` — provide this to the user.
   - Connection status will be `PENDING` until OAuth is completed.
3. Call `GetCodeConnection(connection_arn="...")` to verify status.
4. DO NOT proceed until status is `AVAILABLE`.

### Step 3: Parse Repository Information

Extract from the user-provided URL:
- `fullRepositoryId`: `owner/repo` format (e.g., `nf-core/rnaseq`)
- `sourceReference`:
  - `type`: `BRANCH`, `TAG`, or `COMMIT`
  - `value`: the branch name, tag name, or commit SHA

### Step 4: Check for Container Registry Map

1. Check if the repository contains a container registry map file at common locations: `container-registry-map.json`, `registry-map.json`, `.healthomics/container-registry-map.json`.
2. IF a container registry map exists:
   - Pass `container_registry_map_uri` pointing to the S3 location if uploaded, OR use `container_registry_map` parameter with the map contents.
3. IF no container registry map exists:
   - Analyze the workflow definition for container references.
   - IF containers reference public registries (Docker Hub, Quay.io, ECR Public):
     - Follow the [ECR Pull Through Cache SOP](./ecr-pull-through-cache.md).
     - Call `CreateContainerRegistryMap` to generate a registry map.
     - Call `ValidateHealthOmicsECRConfig` to verify ECR configuration.
   - IF containers reference private ECR repositories:
     - Proceed without a container registry map.

### Step 5: Create the Workflow

Call `CreateAHOWorkflow` with the `definition_repository` parameter:

```
CreateAHOWorkflow(
    name="my-workflow",
    definition_repository={
        "connectionArn": "<connection_arn>",
        "fullRepositoryId": "owner/repo",
        "sourceReference": {
            "type": "BRANCH",
            "value": "main"
        },
        "excludeFilePatterns": ["test/*", "docs/*"]  # optional
    },
    description="Workflow created from Git repository",
    parameter_template_path="parameters.json",  # optional
    readme_path="README.md",  # optional
    container_registry_map={...}  # if needed
)
```

### Step 6: Verify Workflow Creation

1. Call `GetAHOWorkflow(workflow_id="...")`.
2. Confirm status is `ACTIVE`.
3. Confirm workflow type matches expected engine (WDL, NEXTFLOW, CWL).

## Parameter Reference

### definitionRepository Object

| Field | Required | Description |
|-------|----------|-------------|
| `connectionArn` | Yes | ARN of the CodeConnection |
| `fullRepositoryId` | Yes | `owner/repo` format |
| `sourceReference.type` | Yes | `BRANCH`, `TAG`, or `COMMIT` |
| `sourceReference.value` | Yes | Branch name, tag name, or commit SHA |
| `excludeFilePatterns` | No | Glob patterns for files to exclude |

### Additional Parameters

| Parameter | Description |
|-----------|-------------|
| `parameter_template_path` | Path to parameter template JSON within the repo |
| `readme_path` | Path to README markdown file within the repo |

## Common Scenarios

### nf-core Pipeline
```
1. ListCodeConnections(provider_type_filter="GitHub")
2. IF no connection: CreateCodeConnection(connection_name="github", provider_type="GitHub")
3. CreateAHOWorkflow(
       name="nf-core-rnaseq",
       definition_repository={
           "connectionArn": "...",
           "fullRepositoryId": "nf-core/rnaseq",
           "sourceReference": {"type": "TAG", "value": "3.14.0"}
       },
       container_registry_map={...}
   )
```

### Specific Branch
```
CreateAHOWorkflow(
    name="my-workflow-dev",
    definition_repository={
        "connectionArn": "...",
        "fullRepositoryId": "my-org/my-workflow",
        "sourceReference": {"type": "BRANCH", "value": "develop"}
    }
)
```

### Specific Commit
```
CreateAHOWorkflow(
    name="my-workflow",
    definition_repository={
        "connectionArn": "...",
        "fullRepositoryId": "owner/repo",
        "sourceReference": {"type": "COMMIT", "value": "abc123def456"}
    }
)
```

## Error Handling

### Connection Not Available
- IF `GetCodeConnection` returns status `PENDING`:
  - Remind user to complete OAuth authorization in AWS Console.
  - Provide the console URL from the connection creation response.
  - WAIT for user confirmation before retrying.

### Repository Access Denied
- Verify the connection has appropriate repository permissions.
- For private repositories, ensure OAuth scope includes repo access.
- Check that `fullRepositoryId` is correct.

### Workflow Definition Not Found
- Verify the repository contains a valid workflow file (`main.wdl`, `main.nf`, `main.cwl`).
- Check `excludeFilePatterns` isn't excluding the main workflow file.
- Use `path_to_main` parameter if the main file isn't at the repository root.

## Required IAM Permissions

Users need these permissions for Git integration:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "codeconnections:CreateConnection",
                "codeconnections:GetConnection",
                "codeconnections:ListConnections",
                "codeconnections:UseConnection"
            ],
            "Resource": "*"
        }
    ]
}
```

## References

- [AWS HealthOmics Git Integration Documentation](https://docs.aws.amazon.com/omics/latest/dev/workflows-git-integration.html)
- [CreateWorkflow API Reference](https://docs.aws.amazon.com/omics/latest/api/API_CreateWorkflow.html)
- [ECR Pull Through Cache SOP](./ecr-pull-through-cache.md)

## Healthomics Configuration

# SOP: HealthOmics Configuration Management

## Purpose

This SOP defines how you, the agent, create and manage HealthOmics Configuration resources. A Configuration stores reusable VPC networking settings (subnets and security groups) that can be shared across multiple workflow runs.

## Trigger Conditions

Follow this SOP WHEN:
- User wants to create, view, or delete a HealthOmics Configuration.
- User wants to configure settings for workflow runs.
- User asks about managing configurations for HealthOmics.
- User wants to list existing configurations or check configuration status.

DO NOT follow this SOP WHEN:
- User wants to start a workflow run with VPC networking — use the [VPC Connected Workflow Runs SOP](./vpc-connected-workflow-runs.md).
- User wants to set up a VPC, subnets, or NAT gateways from scratch — use the [VPC Setup SOP](./vpc-setup.md).

## Key Concepts

- **Configuration** — A reusable HealthOmics resource that stores settings for workflow runs. Configurations can be shared across multiple workflow runs.
- **Configuration Name** — A unique name (maximum 128 characters) that identifies the configuration. Must start with an alphanumeric character and can contain letters, numbers, hyphens, dots, and underscores (pattern: `[A-Za-z0-9][A-Za-z0-9\-\._]*`). Used to reference the configuration when starting runs.
- **Configuration Description** — An optional description (maximum 256 characters) of the configuration's purpose.
- **Configuration Status** — The lifecycle state of a configuration: `CREATING`, `ACTIVE`, `UPDATING`, `DELETING`, `DELETED`, or `FAILED`.
- **Service-Linked Role** — An IAM role (`AWSServiceRoleForHealthOmics`) automatically created when you create your first configuration. It grants HealthOmics permission to manage elastic network interfaces (ENIs) in the customer's VPC.

### Configuration Lifecycle

`CREATING` → `ACTIVE` → `UPDATING` → `DELETING` → `DELETED`

A configuration may also reach `FAILED` status if provisioning encounters an error.

- **CREATING** — Resources are being provisioned. This can take up to 15 minutes.
- **ACTIVE** — The configuration is ready to use with workflow runs.
- **UPDATING** — The configuration is being modified.
- **DELETING** — Resources are being cleaned up.
- **DELETED** — The configuration has been fully removed.
- **FAILED** — Configuration provisioning or deletion encountered an error.

## VPC Configuration

A VPC configuration stores VPC networking settings (subnets and security groups) that enable workflows to connect to customer VPCs.

### VPC Configuration Settings

- **VPC Config** — The networking settings within a configuration, including security group IDs and subnet IDs. All subnets and security groups must belong to the same VPC.
- **Subnet IDs** — 1 to 16 subnets. Maximum one subnet per Availability Zone. All subnets must belong to the same VPC. Use private subnets with NAT Gateway routes for runs requiring internet access.
- **Security Group IDs** — 1 to 5 security groups. All must belong to the same VPC as the subnets.

## Prerequisites

1. An existing VPC in the same Region as HealthOmics workflows.
2. At least one subnet in an Availability Zone where HealthOmics operates in the Region.
3. Appropriate security groups controlling inbound and outbound traffic.
4. IAM permissions to create and manage HealthOmics configurations.
5. Sufficient ENI capacity in the AWS account (default limit: 5,000 ENIs per Region).
6. For the first configuration created in an account: `iam:CreateServiceLinkedRole` permission to allow automatic creation of the `AWSServiceRoleForHealthOmics` service-linked role.

## Procedure

### Step 1: Gather VPC Information

1. Verify the user has the following information:
   - **VPC** — An existing VPC in the same Region as their workflows.
   - **Subnet IDs** — 1 to 16 subnets. Maximum one subnet per Availability Zone. All subnets must belong to the same VPC. Use private subnets with NAT Gateway routes for runs requiring internet access.
   - **Security Group IDs** — 1 to 5 security groups. All must belong to the same VPC as the subnets.
   - **Configuration Name** — A descriptive, unique name (maximum 128 characters, pattern: `[A-Za-z0-9][A-Za-z0-9\-\._]*`). Must start with an alphanumeric character. Follow the naming convention: include environment, purpose, and team (e.g., `prod-genomics-vpc`, `dev-clinical-trials-vpc`).

### Step 2: Create the Configuration

1. Call `CreateAHOConfiguration` with:
   - `name` — The configuration name.
   - `description` — A description of the configuration's purpose (optional, maximum 256 characters).
   - `run_configurations` — Configuration settings containing:
     - `vpcConfig.securityGroupIds` — List of 1–5 security group IDs.
     - `vpcConfig.subnetIds` — List of 1–16 subnet IDs.
   - `tags` — Optional resource tags (recommended: Environment, Owner, CostCenter, Purpose).
   - `request_id` — Idempotency token (optional, auto-generated if not provided).
2. The configuration will initially have status `CREATING`. Inform the user that provisioning takes up to 15 minutes.
3. Call `GetAHOConfiguration` to poll the status until it becomes `ACTIVE`.
4. DO NOT proceed to start a workflow run until the configuration status is `ACTIVE`.

### Step 3: Verify the Configuration

1. Call `GetAHOConfiguration` with the configuration `name`.
2. Confirm the status is `ACTIVE`.
3. Confirm the VPC ID, subnet IDs, and security group IDs are correct.

### Step 4: Use the Configuration

Once the configuration is `ACTIVE`, it can be referenced when starting workflow runs with VPC networking. See the [VPC Connected Workflow Runs SOP](./vpc-connected-workflow-runs.md) for details on starting runs.

### Step 5: Handle Failures

IF the configuration creation fails or gets stuck in `CREATING`:
1. Wait up to 15 minutes — resource provisioning takes time. If the status doesn't change to `ACTIVE` after 15 minutes, continue with the checks below.
2. Verify subnets and security groups exist and belong to the same VPC.
3. Verify at least one subnet is in an Availability Zone where HealthOmics operates (see the Supported Regions and AZs table in the [VPC Setup SOP](./vpc-setup.md)).
4. Verify the user has the required IAM permissions.
5. Verify the service-linked role (`AWSServiceRoleForHealthOmics`) was created successfully. IF the creation fails due to a permissions error, advise the user to add the IAM permission shown in the Service-Linked Role section below.
6. Verify the account has not exceeded the maximum configurations quota (default: 10, quota ID: `L-D91CDC5E`).
7. Check that no two subnets are in the same Availability Zone.
8. After resolving the issue, call `DeleteAHOConfiguration` to clean up the failed configuration, then retry `CreateAHOConfiguration`.

IF a configuration deletion fails:
1. Check if active workflow runs are using the configuration. You cannot delete a configuration that is in use.
2. Wait for all runs using the configuration to complete, then retry `DeleteAHOConfiguration`.

IF deleting the service-linked role fails:
1. Verify ALL configurations in the account have been deleted first. Active configurations prevent role deletion.
2. Delete all remaining configurations using `DeleteAHOConfiguration`, then retry role deletion.

## Service-Linked Role

The first time a user creates a configuration, HealthOmics automatically creates a service-linked role (`AWSServiceRoleForHealthOmics`) in their account. This role grants HealthOmics the following permissions to manage ENIs in the user's VPC:

- `ec2:DescribeSubnets`, `ec2:DescribeTags`, `ec2:DescribeSecurityGroups`, `ec2:DescribeSecurityGroupRules`, `ec2:DescribeVpcs`, `ec2:DescribeNetworkInterfaces`, `ec2:DescribeAvailabilityZones`
- `ec2:GetSecurityGroupsForVpc`
- `ec2:CreateNetworkInterface` (tagged with `Service: HealthOmics`)
- `ec2:CreateTags` (on network interfaces created by HealthOmics)
- `ec2:DeleteNetworkInterface` (only for HealthOmics-tagged ENIs)
- `ec2:AssignPrivateIpAddresses`, `ec2:UnassignPrivateIpAddresses` (only for HealthOmics-tagged ENIs)

The user must have `iam:CreateServiceLinkedRole` permission for this to succeed. IF the creation fails due to a permissions error, advise the user to add the following IAM permission:

```json
{
  "Effect": "Allow",
  "Action": "iam:CreateServiceLinkedRole",
  "Resource": "arn:aws:iam::*:role/aws-service-role/omics.amazonaws.com/AWSServiceRoleForHealthOmics",
  "Condition": {
    "StringEquals": {
      "iam:AWSServiceName": "omics.amazonaws.com"
    }
  }
}
```

**Note on Service-Linked Role Deletion:** The service-linked role can only be deleted after ALL configurations in the account have been deleted. IF the user wants to delete the role:
1. First delete all configurations using `DeleteAHOConfiguration`.
2. Then delete the role through the IAM console or API.

## Managing Configurations

### Listing Configurations

1. Call `ListAHOConfigurations` to retrieve all configurations in the account.
2. Present the results showing name, description, status, and creation time.
3. IF the user is looking for a specific configuration, filter the results by name or status.

### Getting Configuration Details

1. Call `GetAHOConfiguration` with the configuration `name`.
2. Present the full details including:
   - Configuration ARN and UUID.
   - VPC ID, subnet IDs, and security group IDs.
   - Current status.
   - Creation time and tags.

### Deleting a Configuration

1. Verify the configuration is NOT currently in use by any active workflow runs.
2. Call `DeleteAHOConfiguration` with the configuration `name`.
3. The configuration status will change to `DELETING` while resources are cleaned up, then to `DELETED`.

## Examples

### Creating a configuration with multiple subnets (multi-AZ)

Request:

```json
{
  "name": "prod-genomics-vpc",
  "description": "Production VPC configuration for genomics workflows with internet access",
  "runConfigurations": {
    "vpcConfig": {
      "securityGroupIds": ["sg-0123456789abcdef0"],
      "subnetIds": [
        "subnet-0a1b2c3d4e5f6g7h8",
        "subnet-1a2b3c4d5e6f7g8h9"
      ]
    }
  },
  "tags": {
    "Environment": "production",
    "Team": "genomics"
  }
}
```

Response:

```json
{
  "arn": "arn:aws:omics:us-west-2:123456789012:configuration/prod-genomics-vpc",
  "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "prod-genomics-vpc",
  "runConfigurations": {
    "vpcConfig": {
      "securityGroupIds": ["sg-0123456789abcdef0"],
      "subnetIds": [
        "subnet-0a1b2c3d4e5f6g7h8",
        "subnet-1a2b3c4d5e6f7g8h9"
      ],
      "vpcId": "vpc-0abcdef1234567890"
    }
  },
  "status": "CREATING",
  "creationTime": "2026-03-27T15:30:00Z",
  "tags": {
    "Environment": "production",
    "Team": "genomics"
  }
}
```

### Creating a minimal configuration (single subnet)

Request:

```json
{
  "name": "dev-testing-vpc",
  "description": "Development VPC for workflow testing",
  "runConfigurations": {
    "vpcConfig": {
      "securityGroupIds": ["sg-0987654321fedcba0"],
      "subnetIds": ["subnet-0a1b2c3d4e5f6g7h8"]
    }
  }
}
```

### Getting configuration details

Response:

```json
{
  "arn": "arn:aws:omics:us-west-2:123456789012:configuration/prod-genomics-vpc",
  "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "name": "prod-genomics-vpc",
  "runConfigurations": {
    "vpcConfig": {
      "securityGroupIds": ["sg-0123456789abcdef0"],
      "subnetIds": [
        "subnet-0a1b2c3d4e5f6g7h8",
        "subnet-1a2b3c4d5e6f7g8h9"
      ],
      "vpcId": "vpc-0abcdef1234567890"
    }
  },
  "status": "ACTIVE",
  "creationTime": "2026-03-27T15:30:00Z",
  "tags": {
    "Environment": "production",
    "Team": "genomics"
  }
}
```

### Listing configurations

Response:

```json
{
  "items": [
    {
      "arn": "arn:aws:omics:us-west-2:123456789012:configuration/prod-genomics-vpc",
      "name": "prod-genomics-vpc",
      "description": "Production VPC configuration for genomics workflows with internet access",
      "status": "ACTIVE",
      "creationTime": "2026-03-27T15:30:00Z"
    },
    {
      "arn": "arn:aws:omics:us-west-2:123456789012:configuration/dev-testing-vpc",
      "name": "dev-testing-vpc",
      "description": "Development VPC for workflow testing",
      "status": "ACTIVE",
      "creationTime": "2026-03-27T16:00:00Z"
    }
  ]
}
```

## Limitations and Considerations

- **Provisioning time** — Configuration creation takes up to 15 minutes while resources are provisioned. Do not attempt to start runs until the configuration status is `ACTIVE`.
- **Maximum configurations per account** — Default limit of 10 configurations (quota ID: `L-D91CDC5E`). Request a quota increase via the Service Quotas console if more are needed.
- **Single VPC per configuration** — All subnets and security groups in a configuration must belong to the same VPC. To use multiple VPCs, create separate configurations.
- **One subnet per Availability Zone** — A configuration can have at most one subnet in each Availability Zone.
- **Cannot delete in-use configurations** — A configuration that is referenced by active workflow runs cannot be deleted. Wait for all runs to complete first.
- **Configuration immutability during runs** — Workflow runs use a snapshot of the configuration at run start time. Modifying or deleting a configuration does not affect active runs.
- **Service-linked role required** — The first configuration creation in an account requires `iam:CreateServiceLinkedRole` permission. Subsequent creations do not need this.
- **ENI capacity** — HealthOmics provisions ENIs in your VPC. Monitor your ENI usage and request quota increases if needed (default: 5,000 per Region).
- **Do not modify HealthOmics ENIs** — ENIs tagged with `Service: HealthOmics` are managed by HealthOmics. Modifying or deleting them can cause service disruptions.
- **Configuration name constraints** — Must be 1-128 characters, start with an alphanumeric character, and contain only letters, numbers, hyphens, dots, and underscores.

## Configuration Limits

| Resource | Default Limit | Quota ID | Adjustable |
|---|---|---|---|
| Maximum configurations per account | 10 | L-D91CDC5E | Yes |
| Maximum security groups per configuration | 5 | — | No |
| Maximum subnets per configuration | 16 | — | No |
| Maximum subnets per Availability Zone | 1 | — | No |
| Elastic network interfaces per Region | 5,000 | — | Yes |

To request a quota increase, open the [Service Quotas console](https://console.aws.amazon.com/servicequotas/home/services/omics/quotas/L-D91CDC5E), choose **AWS services**, search for **AWS HealthOmics**, select the quota, and choose **Request quota increase**.

## Migration Guide For Nextflow

# SOP: Nextflow Workflow Migration to AWS HealthOmics

## Purpose

This SOP defines how you, the agent, onboard an existing Nextflow workflow to be compatible with AWS HealthOmics. This involves container migration, resource configuration, storage migration, and output path standardization.

## Constraints

AWS HealthOmics requires:
- All containers MUST be in ECR repositories accessible to HealthOmics.
- All input files MUST be in S3.
- All processes MUST have explicit CPU and memory declarations.
- Output directories MUST use `/mnt/workflow/pubdir/` prefix.

## Non-Goals

- DO NOT modify the scientific logic of the workflow.
- DO NOT change the workflow structure or dependencies.
- DO NOT perform performance optimization beyond HealthOmics requirements.

## Procedure

### Phase 1: Container Inventory and Migration

**Objective**: Identify all containers and create ECR migration plan.

**Steps**:
1. Extract all unique container URIs from module files and config files.
2. Generate `container_inventory.csv` with columns: Module/Process name, Original container URI, Container registry, Tool name and version, Target ECR URI.
3. Follow the [ECR Pull Through Cache SOP](./ecr-pull-through-cache.md) to migrate the containers in container_inventory.csv to ECR.
4. Save the container registry map JSON file produced in step 3.

**Done WHEN**:
- `container_inventory.csv` documents all containers.
- All module `main.nf` files use ECR URIs or are covered by the container registry mapping.
- Zero references to external registries remain.
- All Wave containers are cloned to ECR private and URIs are replaced or covered by the container registry map.
- All containers are verified accessible from ECR.

### Phase 2: Resource Declaration Audit

**Objective**: Ensure all processes have CPU and memory declarations.

**HealthOmics Limits**: Min 2 vCPUs / 4 GB memory. Max 96 vCPUs / 768 GB memory.

**Steps**:
1. Scan all module files for resource declarations.
2. Identify processes relying only on labels.
3. Verify all processes in `conf/base.config` have explicit resources.
4. Add HealthOmics-specific resource overrides to Nextflow files or the modules configuration file or the top level `nextflow.config`.

DO NOT create a HealthOmics specific profile. HealthOmics DOES NOT current support profiles.

**Done WHEN**:
- All processes have resources via direct declaration or label.
- All resources meet HealthOmics minimums.

### Phase 3: Reference and Input File Migration

**Objective**: Migrate all reference files and inputs to S3.

You MUST complete the following steps

**Steps**:
1. Identify input files, samplesheets, and hardcoded/configured references:
   - Scan `*.config` files for file references.
   - Extract reference parameters from `nextflow.config`.
   - List files in `assets/` directory.
   - Identify files referenced in sample sheets.
   - Scan for hardcoded paths in helper scripts and process shell scripts.
   - Scan for resources downloaded via http, https, ftp etc.
2. Produce an inventory csv file listing all required file resources   
3. Design S3 bucket structure appropriate for storing these inputs.
4. Create and run a script (`scripts/migrate_references_to_s3.sh`) to retrieve all required files and copy them to the S3 bucket structure.
5. Update sample sheets to point to new S3 URIs then copy those sample sheets to S3.
6. Update any hardcoded paths in the workflow definition or config files with the new S3 URLs.
7. Update the inventory CSV with the S3 URIs of all relocated files

**Done WHEN**:
- Reference inventory CSV lists all files and S3 URIs.
- All reference files accessible from S3.

### Phase 4: Output Path Standardization

**Objective**: Update all publishDir directives for HealthOmics compatibility.

**Key Rule**: All outputs MUST be under `/mnt/workflow/pubdir/`.

**Steps**:
1. Find all `publishDir` declarations in modules, subworkflows, and configs.
2. Replace `${params.outdir}` with `/mnt/workflow/pubdir`.
3. Preserve all other `publishDir` options (mode, pattern, saveAs).

**Done WHEN**:
- All `publishDir` paths use `/mnt/workflow/pubdir/` prefix.
- No references to ${params.outdir} in publishDir directives — all use the literal /mnt/workflow/pubdir path or a subdirectory.
- Relative path structure preserved.

### Phase 5: Configuration and Testing

**Objective**: Create HealthOmics-specific configuration and validate.

**Steps**:
1. Create comprehensive `conf/healthomics.config`:
   ```groovy
   params {
       container_registry = '<account>.dkr.ecr.<region>.amazonaws.com/<workflow-name>'
       igenomes_base = 's3://<bucket>/references'
       outdir = '/mnt/workflow/pubdir'
       publish_dir_mode = 'copy'
       max_cpus = 96
       max_memory = 768.GB
       max_time = 168.h
   }

   process {
       conda = null
       container = { "${params.container_registry}/${task.process.tokenize(':')[-1].toLowerCase()}" }
       errorStrategy = { task.exitStatus in [143,137,104,134,139,140] ? 'retry' : 'finish' }
       maxRetries = 3
   }
   ```

2. Create `conf/test/test_healthomics.config` with small test dataset.

3. Update `nextflow.config` with profiles:
   ```groovy
   profiles {
       healthomics { includeConfig 'conf/healthomics.config' }
       test_healthomics { includeConfig 'conf/test/test_healthomics.config' }
   }
   ```

4. Execute test plan:
   - Stage 1: Validate configuration locally.
   - Stage 2: Test on HealthOmics with minimal dataset.
   - Stage 3: Test with full-size dataset.
   - Stage 4: Resource optimization.

**Done WHEN**:
- `conf/healthomics.config` complete with correct syntax.
- Test profile completes successfully on HealthOmics.

## Technical Patterns

### Container Registry (Before/After)
```
Original: quay.io/biocontainers/bwa:0.7.17--h5bf99c6_8
Target:   <account-id>.dkr.ecr.<region>.amazonaws.com/sarek/bwa:0.7.17--h5bf99c6_8
```

### Resource Declaration
```groovy
process EXAMPLE {
    cpus 4
    memory 8.GB
}
```

### PublishDir (Before/After)
```groovy
// Before
publishDir "${params.outdir}/preprocessing/mapped", mode: params.publish_dir_mode
// After
publishDir "/mnt/workflow/pubdir/preprocessing/mapped", mode: params.publish_dir_mode
```

### S3 Reference (Before/After)
```groovy
// Before
params.fasta = "${params.igenomes_base}/Homo_sapiens/GATK/GRCh38/Sequence/WholeGenomeFasta/Homo_sapiens_assembly38.fasta"
// After
params.fasta = "s3://<bucket>/references/Homo_sapiens/GATK/GRCh38/Sequence/WholeGenomeFasta/Homo_sapiens_assembly38.fasta"
```

## Dependencies

- AWS CLI configured with appropriate permissions
- ECR repositories created
- S3 bucket(s) with appropriate permissions
- HealthOmics service access
- Docker/Finch/Podman installed for container operations

## References

- [AWS HealthOmics Documentation](https://docs.aws.amazon.com/omics/)
- [nf-core documentation](https://nf-co.re)
- [Nextflow on AWS HealthOmics](https://www.nextflow.io/docs/latest/aws.html#aws-omics)
- [ECR Documentation](https://docs.aws.amazon.com/ecr/)

## Migration Guide For Wdl

# SOP: WDL Workflow Migration to AWS HealthOmics

## Purpose

This SOP defines how you, the agent, migrate on-prem or Cromwell-variant WDL workflows to run in AWS HealthOmics. This involves container migration, runtime configuration, storage migration, and output path standardization.

## Constraints

AWS HealthOmics requires:
- All containers MUST be in ECR repositories accessible to HealthOmics.
- All input files MUST be in S3.
- All tasks MUST have explicit CPU and memory runtime attributes.
- Output files are automatically collected from task outputs.
- WDL 1.0+ syntax is required (draft-2 is NOT supported).
- WDL 1.1 syntax is preferred

## Non-Goals

- DO NOT modify the scientific logic of the workflow.
- DO NOT change the workflow structure or task dependencies.
- DO NOT perform performance optimization beyond HealthOmics requirements.

## Procedure

### Phase 1: Container Inventory and Migration

**Objective**: Identify all containers and create ECR migration plan.

**Steps**:
1. Extract all unique container URIs from runtime sections:
   - Scan all WDL files for `docker:` and `container:` runtime attributes.
   - Check imported WDL files and sub-workflows.
   - Identify containers in struct/object definitions.
2. Generate `container_inventory.csv` with columns: Task name, Original container URI, Container registry, Tool name and version, Target ECR URI.
3. Create `scripts/migrate_containers_to_ecr.sh` to:
   - Find or create ECR repositories for each tool with access policies allowing the omics principal to read.
   - Pull each container from source registry ensuring x86 containers are pulled.
   - Tag for ECR: `<account>.dkr.ecr.<region>.amazonaws.com/<workflow-name>/<tool>:<version>`
   - Push to ECR repositories.
4. Create `scripts/update_container_refs.sh` to:
   - Replace all container URIs in WDL task runtime sections.
   - Update to use ECR registry.
   - Parameterize container references.
5. Create `healthomics.inputs.json` with ECR registry base path parameter.

**Done WHEN**:
- `container_inventory.csv` documents all containers.
- Migration script pushes all containers to ECR.
- All WDL task runtime sections use ECR URIs.
- Zero references to external registries remain.
- At least 5 key containers verified accessible from ECR.

### Phase 2: Runtime Attribute Audit

**Objective**: Ensure all tasks have CPU and memory runtime declarations.

**HealthOmics Limits**: Min 2 vCPUs / 4 GiB memory. Max 96 vCPUs / 768 GiB memory.

**Steps**:
1. Scan all WDL files for runtime sections.
2. Identify tasks missing `cpu`, `memory`, or `disks` attributes.
3. Check for dynamic resource calculations.
4. Add or update runtime attributes in all tasks:
   ```wdl
   runtime {
       docker: "..."
       cpu: 4
       memory: "8 GiB"
   }
   ```
5. Document resource requirements per task in `docs/healthomics_resources.md`.
6. Create validation script to confirm no task lacks runtime attributes.

**Done WHEN**:
- All tasks have `docker` (or `container` for WDL 1.1), `cpu`, and `memory` runtime attributes.
- All resources meet HealthOmics minimums (≥2 vCPU, ≥4 GB).

### Phase 3: WDL Version Compatibility

**Objective**: Ensure WDL 1.0+ compatibility.

**Steps**:
1. Scan all WDL files for version statements. Identify draft-2 syntax usage.
2. Upgrade syntax as needed:
   - Update version declaration to `version 1.0` or `version 1.1`.
   - Replace `${}` with `~{}` for command interpolation.
   - Update type declarations.
   - Replace deprecated functions.
   - Update struct definitions if using WDL 1.1.
   - Replace `command { ... }` with `command <<< ... >>>` for WDL 1.1+.
3. Validate imports:
   - Ensure all imported WDL files are the same version as the main workflow.
   - Update import statements to use proper aliasing.
   - Check for circular dependencies.
4. Lint:
   - Call `LintAHOWorkflowDefinition` or `LintAHOWorkflowBundle` to verify syntax.
   - For large workflows, use `miniwdl check` if available locally.
   - Resolve all issues.

**Done WHEN**:
- All WDL files declare version 1.0 or higher.
- No draft-2 syntax remains.
- Syntax validation passes for all WDL files.
- All imports resolve correctly.

### Phase 4: Reference and Input File Migration

**Objective**: Migrate all reference files and inputs to S3.

**Steps**:
1. Identify input files and reference data:
   - Extract all `File` and `File?` input parameters.
   - Scan for hardcoded file paths in command sections.
   - List reference files in workflow inputs.
   - Identify files in `Array[File]` inputs.
   - Generate reference inventory with sizes.
2. Design S3 bucket structure appropriate for the workflow. Example:
   ```
   s3://<bucket>/
   ├── references/
   │   ├── Homo_sapiens/
   │   │   ├── GATK/GRCh38/
   │   │   └── NCBI/GRCh38/
   │   └── Mus_musculus/
   ├── annotation/
   └── inputs/
       └── samples/
   ```
3. Create `scripts/migrate_references_to_s3.sh` to:
   - Copy from existing S3 locations if available.
   - Upload local files if needed.
   - Obtain and upload `http(s)://` and `ftp://` resources to S3.
   - Set appropriate S3 storage class (Intelligent-Tiering).
   - Validate checksums after upload.
4. Create `healthomics.inputs.json` with S3 URIs for all File inputs.
5. Update any hardcoded paths in command sections to use input variables.

**Done WHEN**:
- Reference inventory CSV lists all files and sizes.
- All reference files accessible from S3.
- `healthomics.inputs.json` uses S3 URIs exclusively.
- No hardcoded file paths in command sections.

### Phase 5: Output Collection Strategy

**Objective**: Ensure all workflow outputs are properly declared.

**Key Rule**: Intermediate files are automatically cleaned up unless declared as workflow outputs.

**Steps**:
1. Audit workflow outputs:
   - Identify all task outputs that should be retained.
   - Check workflow output section completeness.
   - Verify output types (`File`, `Array[File]`, etc.).
2. Update workflow output section:
   ```wdl
   output {
       File final_vcf = CallVariants.vcf
       File final_vcf_index = CallVariants.vcf_index
       Array[File] bam_files = AlignReads.bam
       File metrics_report = CollectMetrics.report
   }
   ```
3. Document output structure in `docs/healthomics_outputs.md`.
4. Verify all task output declarations and glob patterns.

**Done WHEN**:
- Workflow output section includes all desired outputs.
- All task outputs properly declared.
- Output types correctly specified.

### Phase 6: Configuration and Testing

**Objective**: Create HealthOmics-specific configuration and validate.

**Steps**:
1. Create comprehensive `healthomics.inputs.json` with all required inputs using S3 URIs.
2. Create `test_healthomics.inputs.json`:
   - Use small test dataset (e.g., chr22 only).
   - Minimal sample set (1-2 samples).
   - Use DYNAMIC storage for test runs.
3. Execute test plan:
   - Stage 1: Validate WDL syntax and lint.
   - Stage 2: Test on HealthOmics with minimal dataset.
   - Stage 3: Test with full-size dataset.
   - Stage 4: Resource optimization.
4. IF a test run fails, call `DiagnoseAHORunFailure` to identify issues and remediate.

**Done WHEN**:
- `healthomics.inputs.json` complete with all required inputs.
- WDL validation passes.
- Test workflow completes successfully on HealthOmics.

## Technical Patterns

### Container Runtime (Before/After)
```wdl
# Before
runtime {
    docker: "quay.io/biocontainers/bwa:0.7.17--h5bf99c6_8"
}

# After
runtime {
    docker: "<account-id>.dkr.ecr.<region>.amazonaws.com/workflow-name/bwa:0.7.17--h5bf99c6_8"
    cpu: 4
    memory: "8 GB"
}
```

### WDL Version Upgrade (Before/After)
```wdl
# Before (draft-2)
workflow MyWorkflow {
    call MyTask { input: file = input_file }
}

# After (1.0+)
version 1.0

workflow MyWorkflow {
    input {
        File input_file
    }
    call MyTask { input: file = input_file }
    output {
        File result = MyTask.output_file
    }
}
```

### S3 Input (Before/After)
```json
// Before
{ "WorkflowName.reference_fasta": "/path/to/reference.fasta" }

// After
{ "WorkflowName.reference_fasta": "s3://bucket/references/Homo_sapiens/GATK/GRCh38/Sequence/reference.fasta" }
```

## WDL-Specific Considerations

- **Scatter-Gather**: Ensure scattered tasks have appropriate resources. Verify `Array[File]` outputs are properly collected.
- **Sub-Workflows**: Ensure all imported WDL files are migrated. Verify sub-workflow outputs are properly passed.
- **Optional Inputs**: Handle `File?` inputs gracefully. Use `select_first()` or `defined()` appropriately.
- **Command Section**: Use `~{}` for variable interpolation (WDL 1.0+). Avoid hardcoded paths. Use `sep()` for array joining.

## Dependencies

- AWS CLI configured with appropriate permissions
- ECR repositories created
- S3 bucket(s) created with appropriate permissions
- HealthOmics service access
- HealthOmics MCP server
- Docker/Finch/Podman installed for container operations

## References

- [AWS HealthOmics Documentation](https://docs.aws.amazon.com/omics/)
- [WDL 1.0 Specification](https://github.com/openwdl/wdl/blob/main/versions/1.0/SPEC.md)
- [WDL 1.1 Specification](https://github.com/openwdl/wdl/blob/main/versions/1.1/SPEC.md)
- [WDL on AWS HealthOmics](https://docs.aws.amazon.com/omics/latest/dev/workflows.html)
- [ECR Documentation](https://docs.aws.amazon.com/ecr/)

## Running A Workflow

# SOP: Running a HealthOmics Workflow

## Purpose

This SOP defines how you, the agent, run a deployed HealthOmics workflow and handle run failures.

## Trigger Conditions

Follow this SOP WHEN:
- User wants to execute/run a workflow that has already been deployed to HealthOmics.
- User wants to re-run a workflow after fixing a failure.
- User wants to test a workflow on HealthOmics.

## Procedure

### Pre-conditions

1. Verify the workflow has been deployed successfully via `GetAHOWorkflow`.
2. Verify a `parameters.json` or `inputs.json` exists with valid, accessible inputs.
   - IF `parameters.json` contains placeholder inputs you MUST offer to find suitable inputs using `SearchGenomicsFiles` tool.
   - IF you cannot find suitable inputs STOP and ASK the user to provide values. DO NOT proceed until values are provided. 
3. ALL file inputs MUST come from S3 locations in the same region as the workflow run.
4. Verify all S3 objects exist.
5. ALWAYS read and use preferences/defaults from `.healthomics/config.toml` if present.
6. A run requires an S3 output location that is writable — ASK the user where they want outputs written.
7. You MUST identify an IAM service role's ARN to run the workflow, this may already be in `.healthomics/config.toml`. A run requires a Service Role with:
   - A trust policy allowing `omics` to assume the role.
   - Permissions to read inputs and write to the output location.
   - Permissions to write HealthOmics logs to CloudWatch.
   - Access to ECR containers used in the run.

### Execution

1. Call `StartAHORun` to start the run.
2. Call `GetAHORun` to check status.
3. WHEN the workflow completes, outputs will be at the specified output location.

### Handling Failures

IF the workflow run fails:
1. Call `DiagnoseAHORunFailure` to get failure details.
2. Fix the workflow definition based on the diagnosis.
3. Create a new version via `CreateAHOWorkflowVersion` — see the [Workflow Versioning SOP](./workflow-versioning.md).
4. Retry the run.

IF the run fails with a service error (5xx), a transient error occurred — re-start the run without changes. See the [Troubleshooting SOP](./troubleshooting.md) for more detail.

## Troubleshooting

# SOP: Troubleshooting HealthOmics Workflows

## Purpose

This SOP defines how you, the agent, diagnose and resolve common HealthOmics workflow failures.

## Workflow Creation Failure

IF a workflow fails to reach `CREATED` status, check these causes in order:

1. The workflow zip package is corrupted or missing.
2. The workflow zip package has multiple workflow definition files at the top level. There MUST be only one `main.wdl`, `main.nf`, etc. at the top level — dependencies MUST be in sub-directories.
3. The workflow zip package is missing a dependency required by the workflow definition, or the dependency location is inconsistent with the import path.
4. The workflow has invalid syntax. Call `LintAHOWorkflowDefinition` or `LintAHOWorkflowBundle` to verify.
5. After identifying and fixing the cause, redeploy the workflow by calling `CreateAHOWorkflow` (for a new workflow) or `CreateAHOWorkflowVersion` (for a new version of an existing workflow).

## Run Failures

- IF a run fails with a service error (5xx): a transient error occurred in the HealthOmics service. 
    1. Re-start the run with identical inputs.
    2. IF the previous run used a run cache you MUST also use that run cache for the re-run.
- IF a run fails with a customer error (4xx): 
    1. Call `DiagnoseAHORunFailure` to access important logs and run information. 
    2. Use the diagnosis to fix the workflow, service role permissions or input parameters as appropriate. 
    3. IF you modify the workflow definition you MUST create a new version via `CreateAHOWorkflowVersion`.
    4. IF the previous run used a Run Cache you MUST reference that when starting the new run. Otherwise, you MAY create a Run Cache for this run.
    5. Start a new run of the workflow/ workflow version using identical or modified inputs and Run Cache as appropriate.

## VPC Connected Workflow Run Failures

IF a workflow run using VPC networking fails with connectivity-related errors:

- **Run fails to access public internet:**
    1. Verify the configuration is using private subnets (not public subnets).
    2. Verify the private subnets' route tables have a route to a NAT Gateway for `0.0.0.0/0`.
    3. Verify the NAT Gateway is in a public subnet with a route to an Internet Gateway, and is in AVAILABLE state with an Elastic IP.
    4. Verify security groups allow outbound traffic to the required destinations and ports.
    5. Call `DiagnoseAHORunFailure` to get detailed failure information.
    6. Fix the VPC configuration and retry the run.
- **Run fails to access AWS services in other Regions:**
    1. Verify the VPC has internet access via NAT Gateway or appropriate VPC endpoints configured.
    2. Verify the IAM service role has permissions to access the cross-Region resources.
- **Run fails to access private VPC resources:**
    1. Verify the security groups allow traffic to the target resource's IP and port.
    2. Verify network ACLs on the subnets allow the required traffic (network ACLs are stateless — they need explicit rules for both directions, including ephemeral ports 1024-65535 for return traffic).
    3. Verify the target resource's security group allows inbound traffic from the HealthOmics ENIs.
- **Run fails with non-connectivity errors:**
    - IF 5xx, a transient error occurred — re-start the run without changes.
    - IF 4xx, call `DiagnoseAHORunFailure` to diagnose and fix the workflow. See the [Running a Workflow SOP](./running-a-workflow.md) for handling run failures.
- **Cause is unclear:**
    1. Enable VPC Flow Logs on the VPC or on specific HealthOmics ENIs (tagged `Service: HealthOmics`, `eniType: CUSTOMER`).
    2. Query flow logs in CloudWatch Logs Insights filtering for `action = "REJECT"` to identify rejected traffic.
    3. Use the results to identify the failing network component (security group, network ACL, NAT Gateway, or route table) and fix it.
    4. Retry the run.

For VPC infrastructure setup, see the [VPC Setup SOP](./vpc-setup.md). For configuration management, see the [HealthOmics Configuration Management SOP](./healthomics-configuration.md).

## Vpc Connected Workflow Runs

# SOP: VPC Connected Workflow Runs

## Purpose

This SOP defines how you, the agent, help users run HealthOmics workflows with VPC networking enabled. VPC Connected Workflow Runs allow workflows to access resources in the customer's VPC, the public internet, AWS services in other Regions, and on-premises resources.

## Trigger Conditions

Follow this SOP WHEN:
- User wants to run a workflow that needs access to the public internet (e.g., downloading datasets from NIH, academic repositories).
- User wants to run a workflow that connects to third-party license servers or external APIs.
- User wants to run a workflow that reads or writes data from S3 buckets in other AWS Regions.
- User wants to run a workflow that accesses on-premises resources via VPN or Direct Connect.
- User wants to run a workflow that connects to AWS resources within their VPC.
- User mentions "VPC", "internet access", "public internet", "cross-region", "VPC networking", or "VPC connected" in the context of running workflows.

DO NOT follow this SOP WHEN:
- User only needs to access S3 and ECR in the same Region — the default `RESTRICTED` networking mode handles this.
- User wants to manage configurations without starting a run — use the [HealthOmics Configuration Management SOP](./healthomics-configuration.md).
- User wants to set up a VPC, subnets, or NAT gateways from scratch — use the [VPC Setup SOP](./vpc-setup.md).

## Prerequisites

1. An `ACTIVE` HealthOmics Configuration with VPC networking settings. See [HealthOmics Configuration Management SOP](./healthomics-configuration.md) to create one, or [VPC Setup SOP](./vpc-setup.md) for full VPC infrastructure setup.
2. An IAM service role for HealthOmics with permissions to run workflows.
3. ALWAYS read and use preferences/defaults from `.healthomics/config.toml` if present.

## Procedure

### Step 1: Create or Verify Configuration

1. Call `ListAHOConfigurations` to check for existing configurations.
2. IF a suitable `ACTIVE` configuration exists, call `GetAHOConfiguration` to verify it has `runConfigurations.vpcConfig` with valid `securityGroupIds` and `subnetIds`. Configurations without VPC settings cannot be used for VPC Connected Workflow Runs.
3. IF no suitable configuration exists, follow the [HealthOmics Configuration Management SOP](./healthomics-configuration.md) to create one. For full VPC infrastructure setup, see the [VPC Setup SOP](./vpc-setup.md).
4. Verify the configuration status is `ACTIVE` before proceeding.

### Step 2: Start a Workflow Run with VPC Networking

1. Verify the workflow has been deployed successfully via `GetAHOWorkflow`.
2. Verify inputs and parameters are ready (see [Running a Workflow SOP](./running-a-workflow.md) for input validation steps).
3. Call `StartAHORun` with the following VPC-specific parameters in addition to standard run parameters:
   - `networking_mode` — Set to `VPC`.
   - `configuration_name` — The name of the `ACTIVE` configuration to use.
4. ALWAYS include standard run parameters from `.healthomics/config.toml`:
   - `role_arn` — IAM service role ARN.
   - `output_uri` — S3 output location.
   - `storage_type` — `DYNAMIC` recommended.

### Step 3: Verify Connectivity

1. Call `GetAHORun` to monitor the run status and verify VPC configuration details in the response:
   - `networkingMode` — Should show `VPC`.
   - `configuration` — Should show the configuration name, ARN, and UUID.
   - `vpcConfig` — Should show the security group IDs and VPC ID.
2. Check workflow logs in CloudWatch Logs for connection success or failure messages.
3. IF the run fails due to connectivity issues, see the [Troubleshooting SOP](./troubleshooting.md) for VPC-specific failure handling and VPC Flow Logs analysis.

## Examples

### StartAHORun request with VPC networking

```json
{
  "workflow_id": "1234567",
  "role_arn": "arn:aws:iam::123456789012:role/OmicsWorkflowRole",
  "output_uri": "s3://my-bucket/outputs/",
  "storage_type": "DYNAMIC",
  "networking_mode": "VPC",
  "configuration_name": "prod-genomics-vpc",
  "parameters": {
    "inputUri": "s3://my-bucket/input/sample.fastq",
    "referenceUri": "s3://my-bucket/reference/genome.fasta"
  }
}
```

### GetAHORun response (VPC-related fields)

```json
{
  "arn": "arn:aws:omics:us-west-2:123456789012:run/1234567",
  "id": "1234567",
  "status": "RUNNING",
  "workflowId": "7654321",
  "networkingMode": "VPC",
  "configuration": {
    "name": "prod-genomics-vpc",
    "arn": "arn:aws:omics:us-west-2:123456789012:configuration/prod-genomics-vpc",
    "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  },
  "vpcConfig": {
    "securityGroupIds": ["sg-0123456789abcdef0"],
    "vpcId": "vpc-0abcdef1234567890"
  }
}
```

**Note:** If `networking_mode` is omitted, the default `RESTRICTED` mode is used. No configuration is required for `RESTRICTED` mode.

## Call Caching Considerations

When using VPC networking with call caching, ensure your workflow engine is configured appropriately:
- Consult the HealthOmics documentation on engine-specific caching features.
- When connecting to non-deterministic or dynamic resources (e.g., third-party databases on the public internet), use the cache task opt-out feature in your workflows to avoid caching dynamic datasets that could impact run outputs.

## Limitations and Considerations

- **VPC networking is per-run** — You specify the networking mode each time you start a run. Different runs of the same workflow can use different networking modes.
- **No public IP for runs** — Connecting a run to a public subnet does NOT give it internet access or a public IP address. Always use private subnets with NAT Gateway routes.
- **Configuration must be ACTIVE** — You cannot start a run with a configuration that is in `CREATING`, `UPDATING`, `DELETING`, `DELETED`, or `FAILED` status.
- **Configuration must have VPC settings** — Verify the configuration has `runConfigurations.vpcConfig` before using it for VPC Connected Workflow Runs.
- **Network throughput scaling** — Network throughput starts at 10 Gbps per ENI and scales to 100 Gbps over a 60-minute period with sustained traffic. Contact AWS Support for immediate high-throughput needs.
- **Data transfer responsibility** — When using VPC networking mode, you are responsible for determining whether it is safe and compliant to transfer or use data across AWS Regions.
- **ENI management** — Do not modify or delete ENIs created by HealthOmics (tagged with `Service: HealthOmics` and `eniType: CUSTOMER`). This can cause service delays or disruptions.
- **HealthOmics-managed VPC unchanged** — Every HealthOmics run executes inside a VPC owned by HealthOmics. Configuring your run to access your VPC has no effect on the HealthOmics-managed VPC.
- **In-Region S3 routing** — In-Region S3 traffic routes through the HealthOmics service VPC by default. Configuring S3 interface endpoints overrides this. Use S3 Gateway endpoints for best performance.

## Vpc Setup

# SOP: VPC Setup for HealthOmics Workflows

## Purpose

This SOP defines how you, the agent, help users set up a VPC for use with HealthOmics VPC Connected Workflow Runs. This covers VPC infrastructure requirements including subnets, NAT Gateways, security groups, route tables, and VPC endpoints.

## Trigger Conditions

Follow this SOP WHEN:
- User wants to set up a VPC for HealthOmics workflows.
- User wants to configure subnets, NAT Gateways, security groups, or route tables for HealthOmics.
- User wants to know which Regions and Availability Zones HealthOmics supports.
- User wants to add VPC endpoints to optimize costs or performance for HealthOmics.
- User asks about VPC requirements for running workflows with internet access.

DO NOT follow this SOP WHEN:
- User wants to start a workflow run with VPC networking — use the [VPC Connected Workflow Runs SOP](./vpc-connected-workflow-runs.md).
- User wants to create or manage a HealthOmics Configuration resource — use the [HealthOmics Configuration Management SOP](./healthomics-configuration.md).

## Key Concepts

- **Networking Mode** — Controls network access for a workflow run. Two modes are available:
  - `RESTRICTED` (default) — Runs can only access S3 and ECR in the same Region. No internet or cross-Region access.
  - `VPC` — Run traffic is routed through ENIs in the customer's VPC. Enables internet, cross-Region, and private resource access.
- **ENI** — Elastic Network Interface. HealthOmics provisions ENIs in the customer's VPC to route run traffic. These are managed automatically by the HealthOmics service-linked role.
- **NAT Gateway** — Required in the customer's VPC for runs that need public internet access. Runs connected to a VPC do NOT automatically have internet access — the VPC must be configured with a NAT Gateway.
- **In-Region S3 Routing** — In-Region Amazon S3 traffic is routed through the HealthOmics service VPC by default. If you configure Amazon S3 interface endpoints in your VPC, traffic is routed through your VPC instead. Use S3 Gateway endpoints for best performance and cost optimization.

## Supported Regions and Availability Zones

HealthOmics Workflows operates in the following Regions and Availability Zones. When creating VPC subnets, ensure they are in one or more of these Availability Zones.

| Region | Availability Zone Name | Availability Zone ID |
|---|---|---|
| us-west-2 | us-west-2a | usw2-az2 |
| us-west-2 | us-west-2b | usw2-az1 |
| us-west-2 | us-west-2c | usw2-az3 |
| us-east-1 | us-east-1a | use1-az4 |
| us-east-1 | us-east-1b | use1-az6 |
| us-east-1 | us-east-1c | use1-az1 |
| us-east-1 | us-east-1d | use1-az2 |
| eu-west-1 | eu-west-1a | euw1-az2 |
| eu-west-1 | eu-west-1b | euw1-az3 |
| eu-west-1 | eu-west-1c | euw1-az1 |
| eu-central-1 | eu-central-1a | euc1-az2 |
| eu-central-1 | eu-central-1b | euc1-az3 |
| eu-central-1 | eu-central-1c | euc1-az1 |
| eu-west-2 | eu-west-2a | euw2-az2 |
| eu-west-2 | eu-west-2b | euw2-az3 |
| eu-west-2 | eu-west-2c | euw2-az1 |
| ap-southeast-1 | ap-southeast-1a | apse1-az2 |
| ap-southeast-1 | ap-southeast-1b | apse1-az1 |
| ap-southeast-1 | ap-southeast-1c | apse1-az3 |
| il-central-1 | il-central-1a | ilc1-az1 |
| il-central-1 | il-central-1b | ilc1-az2 |
| il-central-1 | il-central-1c | ilc1-az3 |
| ap-northeast-2 | ap-northeast-2a | apne2-az1 |
| ap-northeast-2 | ap-northeast-2b | apne2-az2 |
| ap-northeast-2 | ap-northeast-2c | apne2-az3 |

## Procedure

### Step 1: Assess VPC Requirements

1. Determine what external resources the workflow needs to access:
   - **Public internet** (datasets, APIs, license servers) → Requires NAT Gateway.
   - **AWS services in other Regions** (cross-Region S3) → Requires NAT Gateway or VPC endpoints.
   - **Private VPC resources** (databases, internal services) → Requires appropriate security group rules.
   - **On-premises resources** → Requires Site-to-Site VPN or Direct Connect.
2. IF the user only needs same-Region S3 and ECR access, inform them that `RESTRICTED` mode (the default) is sufficient and VPC networking is not needed.

### Step 2: Create or Verify VPC Infrastructure

1. Verify the user has a VPC with appropriate subnets:
   - Use **private subnets** for workflow runs. Connecting a run to a public subnet does NOT give it internet access or a public IP address.
   - Subnets must be in Availability Zones where HealthOmics operates in the Region (see the Supported Regions and AZs table above).
   - Recommend multiple subnets across different Availability Zones for better availability.
2. IF the workflow needs public internet access, verify a NAT Gateway is configured:
   - The NAT Gateway must be in a **public subnet**.
   - The private subnets' route tables must route `0.0.0.0/0` traffic to the NAT Gateway.
   - For production workloads, recommend one NAT Gateway per Availability Zone for resiliency.
3. Verify security groups allow outbound traffic to required destinations:

   | Type | Protocol | Port Range | Destination | Description |
   |---|---|---|---|---|
   | HTTPS | TCP | 443 | 0.0.0.0/0 | Allow HTTPS to internet |
   | HTTP | TCP | 80 | 0.0.0.0/0 | Allow HTTP to internet (if needed) |

   - Use specific destination CIDR blocks instead of `0.0.0.0/0` when possible (principle of least privilege).
   - For on-premises resources, allow traffic to the specific VPN or CIDR ranges.

4. Verify route tables on private subnets:

   | Destination | Target |
   |---|---|
   | 10.0.0.0/16 | local |
   | 0.0.0.0/0 | nat-xxxxxxxxx |

   - For on-premises resources, add routes to a virtual private gateway.

5. OPTIONALLY, recommend VPC endpoints for AWS services the workflow needs to access to reduce NAT Gateway costs and improve performance.

### Step 3: Create HealthOmics Configuration

Once the VPC infrastructure is ready, create a HealthOmics Configuration resource to store the VPC settings. Follow the [HealthOmics Configuration Management SOP](./healthomics-configuration.md).

### Step 4: Validate Setup

1. Start a test workflow run with VPC networking to validate connectivity. See the [VPC Connected Workflow Runs SOP](./vpc-connected-workflow-runs.md).
2. IF connectivity issues occur, see the [Troubleshooting SOP](./troubleshooting.md) for VPC-specific troubleshooting including VPC Flow Logs analysis.

## Best Practices

### Security
- Use least-privilege security groups. Allow only the minimum required outbound traffic. Use specific destination CIDR blocks instead of `0.0.0.0/0` when possible. Document the purpose of each security group rule.
- Separate configurations by environment (dev, staging, production). Use different VPCs or subnets for each environment. Apply appropriate tags for organization.
- Enable VPC Flow Logs for security analysis. Set up CloudWatch alarms for unusual traffic patterns. Regularly review CloudTrail logs for configuration changes.
- Use VPC endpoints for AWS services the workflow accesses to keep traffic within the AWS network, reduce NAT Gateway costs, and improve performance.

### Performance
- Network throughput starts at 10 Gbps per ENI and scales to 100 Gbps over a 60-minute period with sustained traffic. For workflows with immediate high-throughput requirements, plan ahead and contact AWS Support for pre-warming.
- Deploy one NAT Gateway per Availability Zone for production workloads to improve resiliency and throughput, and reduce cross-AZ data transfer costs.
- Reuse configurations across multiple workflows to reduce management overhead and ensure consistent network settings.
- Test configurations with test workflows before production use. Validate network connectivity and verify security group rules allow required traffic.

### Cost Optimization
- Use VPC endpoints where possible to reduce NAT Gateway data processing charges.
- Monitor data transfer costs with AWS Cost Explorer. Data transfer in has no charge; data transfer out to internet incurs standard rates; cross-Region transfer has higher rates.
- Right-size NAT Gateway deployment — one for dev, one per AZ for production. Monitor NAT Gateway utilization to avoid over-provisioning.
- Delete unused configurations regularly. Use tags to identify configuration ownership and purpose.

### Operational
- Use descriptive configuration names (e.g., `prod-genomics-vpc`, `dev-clinical-trials-vpc`). Include environment, purpose, and team in the name.
- Tag all configurations with Environment, Owner, CostCenter, and Purpose.
- Document which external services each configuration accesses. Maintain a map of security group rules and their purposes.
- Share network architecture diagrams with your team.

## VPC Networking Quotas

| Resource | Default Limit | Quota ID | Adjustable |
|---|---|---|---|
| Maximum configurations per account | 10 | L-D91CDC5E | Yes |
| Maximum security groups per configuration | 5 | — | No |
| Maximum subnets per configuration | 16 | — | No |
| Maximum subnets per Availability Zone | 1 | — | No |
| Elastic network interfaces per Region | 5,000 | — | Yes |

To request a quota increase, open the [Service Quotas console](https://console.aws.amazon.com/servicequotas/home/services/omics/quotas/L-D91CDC5E), choose **AWS services**, search for **AWS HealthOmics**, select the quota, and choose **Request quota increase**.

## Workflow Development

# SOP: Workflow Development

## Purpose

This SOP defines how you, the agent, create and deploy genomics workflows for AWS HealthOmics from local files. For running deployed workflows, see the [Running a Workflow SOP](./running-a-workflow.md).

## Procedure: Creating a Workflow

### Language Selection
- Use WDL 1.1, Nextflow DSL2, or CWL 1.2.
- PREFER WDL 1.1 unless the user instructs otherwise.

### Structure
- Define a top-level entry point: `main.wdl`, `main.nf`, or `main.cwl`.
- IF writing a Nexflow workflow, THEN follow the nf-core project structure.
- IF writing WDL or CWL, THEN place tasks in a `./tasks/` folder structs in `./structs/` etc and reference these via imports

### Code Documentation
- Use comments to document the purpose of each task and workflow.
- For WDL: generate `meta` and `parameter_meta` blocks.
- For Nextflow: generate `nf-schema.json`.
- You MUST create a detailed `README.md` describing the purpose of the workflow, it's inputs, steps, and outputs.

### Scripting Rules
- Use BASH best practices for task/process command/script definitions.
- You MUST use `set -eu` to prevent silent failures.
- In WDL:
    - You MUST use `~{var_name}` interpolation syntax when interpolating variables in Strings.
    - You MUST use `<<< >>>` syntax to delimit the command block. DO NOT use curly braces.

### Parallelization
- WHERE possible, use `scatter` patterns (WDL) and `Channels` (Nextflow) to parallelize tasks.
- WHERE possible, scatter over arrays of samples.
- IF the software in a task is capable of using intervals THEN you MUST use intervals to parallelize (scatter) tasks.
- You MAY compute intervals in reference genomes so they have approximately even sizes.
- NOTE: HealthOmics supports large scatters but may require quota limit increases (Maximum concurrent tasks per run).

### Task Parameters
- ALL tasks/processes MUST declare CPU, memory, and container requirements.
- You MUST use at least 1 GB memory and 1 CPU for all tasks.
- You MAY set appropriate timeouts and retries using language-appropriate directives.
- You MUST declare a `container` for each task. The container value MAY be a variable.

### Outputs
- Final workflow outputs MUST be declared. Intermediate task outputs will NOT be retained by HealthOmics.
- WHEN using Nextflow `publishDir`, the path MUST be a subdirectory of `/mnt/workflow/pubdir`.

### Containers
- All workflow tasks run in containers. Containers MUST contain all software used in the script/command.
- If the container is in a public registry (e.g. docker, ecr-public, quay.io) you MUST use ECR Pull Through caches. Consult the [ECR Pull Through Cache SOP](./ecr-pull-through-cache.md).
- ALL other container images MUST be in the user's AWS ECR private registry in repositories readable by HealthOmics.
  - Use the `ListECRRepositories`, `CheckContainerAvailability` tools to find existing containers
  - Use the `CloneContainerToECR` tool to add containers to ECR 
- IF suitable containers cannot be found you SHOULD create appropriate Dockerfiles, build the images and push them to ECR
  - You MUST use x86_64 architecture containers `--platform linux/amd64`

### parameters.json
- You MUST define an example `parameters.json` for the workflow.
- You MAY use the `SearchGenomicsFiles` tool to help identify suitable inputs.
- Workflow parameters MUST NOT be namespaced:

  Correct:
  ```json
  {
    "input_file": "s3://bucket/path/to/input.vcf"
  }
  ```

  Wrong:
  ```json
  {
    "MyWorkflow.input_file": "s3://bucket/path/to/input.vcf"
  }
  ```

### Linting
- IF the workflow is WDL or CWL, you MUST call `LintAHOWorkflowDefinition` or `LintAHOWorkflowBundle` to validate the workflow.
- When calling the `Lint*` tools you MUST supply a file path(s) or S3 URI(s) to reference the workflow content
- DO NOT proceed to deployment if linting errors exist — resolve them first.
- You MAY proceed if only warnings remain, but fixing these is desirable.

## Procedure: Deploying a Workflow

### Step 1. Packaging
- You MUST use the `PackageAHOWorkflow` tool to create a zip package of the workflow.
- You MUST use file paths or S3 paths to reference input files to the package AND the output path.
- For large workflows with more than ~15 files output to S3 is recommended.

### Step 2. Deploy to HealthOmics
- Call `CreateAHOWorkflow` to create the new workflow.
- IF updating an existing workflow: call `CreateAHOWorkflowVersion` instead — see the [Workflow Versioning SOP](./workflow-versioning.md).
  - Use semantic versioning (e.g., `1.0.0`, `1.0.1`).
- You MUST reference the package created in Step 1 as the workflow `definition_source`.
- You MUST reference the package as a file path or S3 URI.
- Call `GetAHOWorkflow` to verify the workflow was created successfully.

### Step 3. Run the Workflow
- Follow the [Running a Workflow SOP](./running-a-workflow.md) to execute the deployed workflow.

## Workflow Versioning

# SOP: Workflow Versioning

## Purpose

This SOP defines how you, the agent, handle modifications to existing HealthOmics workflows. You MUST use `CreateAHOWorkflowVersion` to create a new version rather than creating an entirely new workflow. This preserves workflow history, maintains consistent workflow IDs, and follows HealthOmics best practices.

## Trigger Conditions

Use `CreateAHOWorkflowVersion` WHEN:
- Fixing bugs in an existing workflow
- Adding new features or tasks to a workflow
- Updating container images or versions
- Modifying resource allocations (CPU, memory)
- Changing workflow parameters or outputs
- Optimizing workflow performance after analyzing run metrics
- Applying fixes after diagnosing run failures

Use `CreateAHOWorkflow` ONLY WHEN:
- Creating a brand new workflow that doesn't exist yet
- The workflow represents fundamentally different functionality
- The customer explicitly requests a new workflow ID

## Procedure

### Step 1: Identify the Existing Workflow

1. Call `ListAHOWorkflows` to find the workflow.
2. Call `GetAHOWorkflow` to retrieve current workflow details including the workflow ID.

### Step 2: Make Modifications Locally

1. Edit the workflow definition files as needed.
2. Call `LintAHOWorkflowDefinition` or `LintAHOWorkflowBundle` to validate changes.
3. DO NOT proceed if linting errors exist — resolve them first.

### Step 3: Package the Updated Workflow

- Call `PackageAHOWorkflow` to create a zip package of the workflow.

### Step 4: Create a New Version

1. Call `CreateAHOWorkflowVersion` with the existing workflow ID.
2. Apply semantic versioning:
   - MAJOR (e.g., `1.0.0` → `2.0.0`): Breaking changes to inputs/outputs
   - MINOR (e.g., `1.0.0` → `1.1.0`): New features, backward compatible
   - PATCH (e.g., `1.0.0` → `1.0.1`): Bug fixes, performance improvements
3. Include a meaningful description of changes.

### Step 5: Verify the New Version

1. Call `GetAHOWorkflow` to confirm the version was created successfully.
2. Confirm status is `ACTIVE`.

## Common Scenarios

### After Diagnosing a Run Failure
1. `DiagnoseAHORunFailure` identifies the issue.
2. Fix the workflow definition.
3. Call `CreateAHOWorkflowVersion` with the fix.
4. Re-run using the updated workflow version.

### After Performance Optimization
1. `AnalyzeAHORunPerformance` suggests improvements.
2. Apply recommended resource adjustments.
3. Call `CreateAHOWorkflowVersion` with the optimizations.
4. Run the optimized version to validate improvements.

### Updating Container Images
1. Update container references in task definitions.
2. Test locally if possible.
3. Call `CreateAHOWorkflowVersion` with the updated containers.

## Benefits of Versioning

- Audit trail: complete history of workflow changes
- Rollback capability: easy to revert to previous versions
- Consistent integration: downstream systems reference the same workflow ID
- Cost tracking: all runs grouped under a single workflow for billing
- Compliance: maintains lineage for regulatory requirements in genomics workflows
