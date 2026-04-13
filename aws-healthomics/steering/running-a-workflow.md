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
