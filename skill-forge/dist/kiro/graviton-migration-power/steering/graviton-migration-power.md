---
inclusion: manual
---

# Graviton Migration Power

## Overview

The Graviton Migration Power helps developers migrate workloads to AWS Graviton processors (Arm64 architecture). It analyzes source code for known code patterns and dependency libraries to identify compatibilities with Graviton processors, generates reports highlighting detected compatibility issues (manual review recommended), and provides actionable suggestions for minimal required and recommended versions for both language runtimes and dependency libraries.

### What This Power Does

The goal is to migrate a codebase from x86 to Arm. Use the MCP server tools to help you with this. Check for x86-specific dependencies (build flags, intrinsics, libraries, etc) and change them to Arm architecture equivalents, help identify compatibility issues and suggests optimizations for Arm architecture. Look at Dockerfiles, versionfiles, and other dependencies,  compatibility, and optimize performance.

Steps to follow:
* Look in all Dockerfiles and use the check_image and/or skopeo tools to verify Arm compatibility, changing the base image if necessary.
* Look at the packages installed by the Dockerfile and send each package to the knowledge_base_search tool to check each package for Arm compatibility. If a package is not compatible, change it to a compatible version. When invoking the tool, explicitly ask "Is [package] compatible with Arm architecture?" where [package] is the name of the package.
* Look at the contents of any requirements.txt files line-by-line and send each line to the knowledge_base_search tool to check each package for Arm compatibility. If a package is not compatible, change it to a compatible version.
* Look at the codebase that you have access to, and determine what the language used is.
* Run the migrate_ease_scan tool on the codebase, using the appropriate language scanner based on what language the codebase uses.
* Provide an analysis report with complete dependency analysis, migration recommendations and optimizations for AWS Graviton processor
* Get a confirmation with user before proceeding with the code changes

---

## Onboarding

### Prerequisites

Before using the Graviton Migration Power, ensure the following are installed and running:

#### Required Tools

1. **Docker Desktop**: Required for running the Arm MCP server and migration assessment tools
   - Verify installation: `docker --version`
   - Ensure Docker daemon is running: `docker ps`
   - **CRITICAL**: If Docker is not installed or not running, DO NOT proceed with migration assessment

2. **Git** (optional but recommended): For scanning remote repositories
   - Verify installation: `git --version`

### Step 1: Validate MCP Server Connection

The power uses the Arm MCP server running in a Docker container. Test the connection:

```bash
# The MCP server should auto-start when you use the power
# If you encounter issues, verify Docker is running
docker ps
```

### Step 2: Understand Available Tools

This power provides access to several specialized tools:

- **migrate-ease scan**: Scans codebases for Arm compatibility issues (C++, Python, Go, JS, Java)
- **skopeo**: Inspects container images remotely for architecture support
- **knowledge base search**: Searches Arm documentation for migration guidance
- **check image**: Quick Docker image architecture verification
- **mca (Machine Code Analyzer)**: Analyzes assembly code performance predictions

---

## Steering Files

This power has the following steering files for detailed workflow guidance:

- **karpenter.md** — Guides detection and migration of Karpenter configurations (NodePool, EC2NodeClass) to use Graviton ARM64 instances. Covers gradual rollout with taints/tolerations, instance family mappings, and post-migration cleanup.

---

## License & Legal

### Power License

This power is provided by AWS and is subject to the AWS Customer Agreement and applicable AWS service terms.

### MCP Server Licenses

This power uses the following MCP server and tools:

- **arm-mcp** (`armswdev/arm-mcp:latest`): Docker container providing Arm migration tools
  - Distributed via Docker Hub by Arm
  - Contains multiple open-source tools with their respective licenses
  - For complete license information, see: https://github.com/arm/mcp/blob/main/LICENSE


### Third-Party Dependencies

This power requires Docker to run the MCP server container. Docker is subject to its own licensing terms. See: https://www.docker.com/legal/docker-subscription-service-agreement/

### Usage Terms

By using this power, you acknowledge that:
- You are responsible for compliance with all applicable licenses
- Code analysis is performed using open-source tools within a Docker container
- You should review and comply with individual tool licenses for production use

---

## Additional Resources

- AWS Graviton Technical Guide: https://github.com/aws/aws-graviton-getting-started
- Arm Architecture Reference: Available through knowledge base search
- Migration Tools Documentation: Included in MCP server responses

---

## Power Metadata

**Version**: 1.1  
**Author**: AWS  
**Supported Languages**: C++, Python, Go, JavaScript, Java  
**Container Runtime**: Docker required  
**MCP Server**: arm-mcp (Docker-based). License information, see: https://github.com/arm/mcp/blob/main/LICENSE

## Karpenter

# Karpenter Configuration Migration to Graviton (ARM64)

This steering file guides the detection and migration of Karpenter configurations to use AWS Graviton (ARM64) instances.

## Detection

When analyzing a workspace for Karpenter configurations, look for:

- YAML files containing `apiVersion: karpenter.sh/v1` or `karpenter.sh/v1beta1`
- Resources of `kind: NodePool` and `kind: EC2NodeClass`
- Existing `kubernetes.io/arch` requirements set to `amd64` only
- Instance family requirements using x86-only families (e.g., `m5`, `c5`, `r5`)
- Any `nodeSelector` or `tolerations` in workload manifests referencing architecture
- Helm values files with architecture or instance-type settings for Karpenter

## Migration Strategy

Follow a gradual rollout approach:

### 1. Create a Dedicated Graviton NodePool

Create a separate NodePool for Graviton nodes rather than modifying the existing x86 NodePool. This gives independent control over instance selection and rollout pace.

Example Graviton NodePool:

```yaml
apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: graviton
spec:
  disruption:
    consolidationPolicy: WhenEmptyOrUnderutilized
    consolidateAfter: 1m
  template:
    spec:
      terminationGracePeriod: 24h
      expireAfter: 720h
      nodeClassRef:
        group: karpenter.k8s.aws
        kind: EC2NodeClass
        name: default
      taints:
        - key: graviton-migration
          effect: NoSchedule
      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["on-demand", "spot"]
        - key: kubernetes.io/arch
          operator: In
          values: ["arm64"]
        - key: karpenter.k8s.aws/instance-generation
          operator: Gt
          values: ["4"]
```

### 2. Add Tolerations to Workloads

For each workload being migrated, add a toleration for the Graviton taint:

```yaml
spec:
  tolerations:
    - key: graviton-migration
      operator: Exists
```

### 3. Force Scheduling on Graviton (After Validation)

Once a workload is validated on ARM64, pin it to Graviton nodes:

```yaml
spec:
  nodeSelector:
    kubernetes.io/arch: arm64
  tolerations:
    - key: graviton-migration
      operator: Exists
```

### 4. Post-Migration Cleanup

After all workloads are migrated:

- Remove the `graviton-migration` taint from the Graviton NodePool
- Remove tolerations and nodeSelectors from workload specs
- Delete the old x86-only NodePool

## Common x86 to Graviton Instance Family Mappings

| x86 Family | Graviton Equivalent | Notes |
|------------|-------------------|-------|
| m5, m6i    | m6g, m7g          | General purpose |
| c5, c6i    | c6g, c7g          | Compute optimized |
| r5, r6i    | r6g, r7g          | Memory optimized |
| t3          | t4g               | Burstable |

## Key Checks

- Verify all container images support `linux/arm64` (multi-arch or ARM64-specific)
- Check sidecar containers (service mesh proxies, logging agents) for ARM64 support
- Check DaemonSets for ARM64 compatibility
- Validate any init containers also have ARM64 images
- Use the `check_image` or `skopeo` tools from the Graviton Migration Power to verify image architecture support
- Run `migrate_ease_scan` on application source code to detect architecture-specific code

## References

- [Migrating from x86 to Graviton on EKS using Karpenter](https://aws.amazon.com/blogs/containers/migrating-from-x86-to-aws-graviton-on-amazon-eks-using-karpenter/)
- [Karpenter NodePool docs](https://karpenter.sh/docs/concepts/nodepools/)
- [AWS Graviton Getting Started](https://github.com/aws/aws-graviton-getting-started)
