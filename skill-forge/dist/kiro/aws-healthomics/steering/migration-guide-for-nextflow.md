<!-- forge:version 0.1.0 -->
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