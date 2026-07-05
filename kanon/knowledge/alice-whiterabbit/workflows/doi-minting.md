# ALICE Mint — DOI Minting Context

## Module Layout

```
alice-cli/src/alice_cli/commands/
└── mint.py                # mint_group Click group + base mint command + subcommands

alice-cli/src/alice_cli/
├── metadata.py            # DataCite Metadata Schema 4.x serialization
├── typemap.py             # Extension → ResourceType inference
├── checksum.py            # SHA-256 computation and verification
├── datacite_client.py     # DataCite REST API client
├── jscholarship.py        # JScholarship SWORD/DSpace deposit client
├── citation.py            # BibTeX / APA / Chicago / RIS formatting
├── catalog.py             # DynamoDB Metadata Catalog operations
├── preserve.py            # S3 staging + permanent bucket operations
├── ledger.py              # Checksum Ledger (Parquet) append operations
└── manifest.py            # Manifest file parsing (JSON / JSONL)
```

## DOI Lifecycle

DOIs follow a three-state lifecycle managed through the DataCite API:

```
draft  →  findable  →  registered (retracted)
  ↑                         |
  └── re-mint if needed ────┘
```

| State | Meaning | Discoverable | Resolvable |
|---|---|---|---|
| `draft` | Registered with DataCite, metadata can be edited | No | No |
| `findable` | Published, metadata locked, landing page active | Yes | Yes |
| `registered` | Retracted, DOI still resolves but marked as retracted | No | Yes (with notice) |
| `local` | Local-only identifier (`local/` prefix), no DataCite registration | No | No |

### Two-Tier Storage

| Bucket | Purpose | Lock |
|---|---|---|
| **Staging Bucket** | Draft artifacts, metadata iteration | None |
| **Permanent Bucket** | Published artifacts, immutable | S3 Object Lock (compliance mode) |

The Permanent Bucket is entirely separate from the Cloud Locker.

## Metadata Requirements (DataCite Schema 4.x)

### Required Fields

| Field | Type | Description |
|---|---|---|
| `creators` | list[str] | At least one creator (JHED or name) |
| `title` | str | Artifact title |
| `publisher` | str | Default: `Johns Hopkins University` |
| `publicationYear` | int | Year of publication |
| `resourceTypeGeneral` | str | DataCite controlled vocabulary |

### Optional Fields

| Field | Type | Description |
|---|---|---|
| `resourceType` | str | Free-text subtype (e.g. `ConversationThread`) |
| `relatedIdentifiers` | list | Related DOIs, URLs, arXiv IDs, PMIDs |

### Resource Type Inference

The `typemap.py` module infers `resourceTypeGeneral` from file extension:

| Extension | Type |
|---|---|
| `.csv`, `.tsv`, `.parquet` | Dataset |
| `.ipynb` | ComputationalNotebook |
| `.py`, `.r`, `.R` | Software |
| `.pdf`, `.md`, `.tex`, `.docx` | Text |
| Directory | Collection |
| stdin | Other |

Override with `--type <type>` on any mint command.

## Citation Formatting

Four citation formats are supported via `alice mint cite`:

| Format | Key | Example Output |
|---|---|---|
| BibTeX | `bibtex` | `@misc{...}` with author, title, year, publisher, doi, url |
| APA | `apa` | Author (Year). Title. Publisher. https://doi.org/... |
| Chicago | `chicago` | Author. "Title." Publisher, Year. https://doi.org/... |
| RIS | `ris` | `TY - GEN`, `AU`, `TI`, `PY`, `PB`, `DO`, `UR`, `ER` tags |

### Citation Functions

| Function | Purpose |
|---|---|
| `format_bibtex(meta, doi, url)` | BibTeX `@misc` entry |
| `format_apa(meta, doi)` | APA 7th edition |
| `format_chicago(meta, doi)` | Chicago Manual of Style |
| `format_ris(meta, doi, url)` | RIS interchange format |

## Versioning

DOIs support version chains linked by DataCite relation types:

- `IsNewVersionOf` — points from new version to previous
- `IsPreviousVersionOf` — points from previous to new version

```bash
# Create a new version of an existing DOI
alice mint version 10.12345/alice.abc123 updated-paper.pdf --title "Revised Analysis"
```

- Version numbering is computed from chain length (N+1)
- Each version gets its own DOI, checksum, and catalog entry
- `--latest` flag shows the latest version in a chain

## Batch Minting

Mint multiple artifacts from a manifest file (JSON or JSONL):

### Manifest Format (JSON)

```json
[
  {"path": "paper.pdf", "title": "My Paper", "type": "Text", "creator": "jsmith1"},
  {"path": "data.csv", "title": "Dataset", "type": "Dataset"}
]
```

### Manifest Format (JSONL)

```jsonl
{"path": "paper.pdf", "title": "My Paper", "type": "Text"}
{"path": "data.csv", "title": "Dataset", "type": "Dataset"}
```

```bash
alice mint --manifest artifacts.json --concurrency 4
```

- Entries are processed with configurable concurrency
- Failures are logged per entry; remaining entries continue
- Summary shows succeeded/failed counts

## Local Mode

For development and internal-only tracking without DataCite credentials:

```bash
# Mint locally (no DataCite API call)
alice mint paper.pdf --title "Internal Draft" --local

# Or via environment variable
export ALICE_MINT_MODE=local
alice mint paper.pdf --title "Internal Draft"
```

- Generates `local/alice.<uuid>` identifiers
- Status is always `local` in the catalog
- Cannot be published or deposited to JScholarship
- All read-side operations (search, cite, export, status) work normally

## Command Reference

### `alice mint <path>`

Register a draft DOI for a research artifact.

```bash
# Mint from a file
alice mint paper.pdf --title "Neural Network Analysis"

# Mint from a directory
alice mint ./dataset/ --title "Experiment Results" --type Dataset

# Mint from a URL
alice mint --url https://example.com/data.csv --title "Remote Dataset"

# Mint from a session
alice mint --session abc123 --title "Chat Session"

# Interactive mode (prompts for metadata)
alice mint paper.pdf -i

# Batch mint from manifest
alice mint --manifest artifacts.json --concurrency 4

# Local mode (no DataCite)
alice mint paper.pdf --title "Draft" --local
```

Options: `--title`, `--type`, `-i` (interactive), `--session`, `--url`, `--manifest`, `--concurrency`, `--quiet`, `--local`

### `alice mint publish <doi>`

Publish a draft DOI — copies artifact to Permanent Bucket with Object Lock, sets DOI state to `findable`.

```bash
# Publish to S3 only
alice mint publish 10.12345/alice.abc123

# Publish and deposit to JScholarship
alice mint publish 10.12345/alice.abc123 --deposit jscholarship

# Publish to both
alice mint publish 10.12345/alice.abc123 --deposit both
```

Options: `--deposit {s3,jscholarship,both}`

### `alice mint cite <doi>`

Generate a formatted citation.

```bash
# BibTeX (default)
alice mint cite 10.12345/alice.abc123

# APA format
alice mint cite 10.12345/alice.abc123 --format apa

# Chicago format, copy to clipboard
alice mint cite 10.12345/alice.abc123 --format chicago --copy

# RIS format
alice mint cite 10.12345/alice.abc123 --format ris
```

Options: `--format {bibtex,apa,chicago,ris}`, `--copy`

### `alice mint search <query>`

Search the Metadata Catalog and optionally DataCite.

```bash
# Search by title
alice mint search "neural network"

# Filter by creator
alice mint search "experiment" --creator jsmith1

# Filter by type and date range
alice mint search "dataset" --type Dataset --since 2025-01-01 --until 2025-06-30

# Search only your own artifacts
alice mint search "" --mine

# Search DataCite (remote)
alice mint search "neural network" --datacite
```

Options: `--creator`, `--type`, `--since`, `--until`, `--status`, `--limit`, `--datacite`, `--mine`

### `alice mint version <doi> <path>`

Create a new version of an existing DOI.

```bash
# New version
alice mint version 10.12345/alice.abc123 updated-paper.pdf --title "Revised Analysis"

# Show latest version
alice mint version 10.12345/alice.abc123 --latest
```

Options: `--title`, `--latest`, `--force`

### `alice mint verify <doi>`

Verify artifact integrity (checksums across all storage locations).

```bash
# Verify a single DOI
alice mint verify 10.12345/alice.abc123

# Verify all artifacts
alice mint verify --all

# Verify against source file
alice mint verify 10.12345/alice.abc123 --source paper.pdf
```

Options: `--all`, `--source`

### `alice mint update <doi>`

Update metadata on a draft DOI.

```bash
# Update title
alice mint update 10.12345/alice.abc123 --title "New Title"

# Add a creator
alice mint update 10.12345/alice.abc123 --add-creator "jdoe2"

# Interactive update
alice mint update 10.12345/alice.abc123 -i
```

Options: `--title`, `--type`, `--add-creator`, `--remove-creator`, `-i`

### `alice mint retract <doi>`

Retract a published DOI (sets state to `registered`).

```bash
alice mint retract 10.12345/alice.abc123 --reason "Data quality issues identified"
```

Options: `--reason`, `--force`

### `alice mint share <doi>`

Share artifact access with collaborators via pre-signed URLs.

```bash
# Share with a collaborator
alice mint share 10.12345/alice.abc123 --with jdoe2 --expires 7d

# List active shares
alice mint share 10.12345/alice.abc123 --list

# Revoke a share
alice mint share 10.12345/alice.abc123 --revoke jdoe2
```

Options: `--with`, `--expires`, `--revoke`, `--list`

### `alice mint transfer <doi>`

Transfer DOI ownership to another user.

```bash
alice mint transfer 10.12345/alice.abc123 --to jdoe2
```

Options: `--to`, `--keep-creator`, `--force`

### `alice mint link <doi>`

Manage related identifier links (DOIs, URLs, arXiv, PMID).

```bash
# Link to a related DOI
alice mint link 10.12345/alice.abc123 --related-to 10.12345/alice.xyz --relation IsSupplementTo

# Link to an arXiv preprint
alice mint link 10.12345/alice.abc123 --related-to 2401.12345 --relation IsDescribedBy --id-type arXiv

# List existing links
alice mint link 10.12345/alice.abc123 --list

# Remove a link
alice mint link 10.12345/alice.abc123 --remove 10.12345/alice.xyz
```

Options: `--related-to`, `--relation`, `--id-type`, `--list`, `--remove`

### `alice mint export`

Export catalog entries in bulk.

```bash
# Export all as CSV
alice mint export --format csv --output catalog.csv

# Export as BibTeX
alice mint export --format bibtex --output refs.bib

# Export filtered
alice mint export --format json --status findable --since 2025-01-01
```

Options: `--format {csv,json,bibtex}`, `--output`, `--all`, `--status`, `--since`, `--until`, `--type`

### `alice mint deposit <doi>`

Deposit a published artifact to JScholarship.

```bash
alice mint deposit 10.12345/alice.abc123
```

### `alice mint status <doi>`

Show the current status of a DOI.

```bash
alice mint status 10.12345/alice.abc123
```

## Common Workflows

### Minting a DOI

```bash
# 1. Mint a draft DOI
alice mint paper.pdf --title "Neural Network Analysis" --type Text

# 2. Check status
alice mint status 10.12345/alice.abc123

# 3. Update metadata if needed
alice mint update 10.12345/alice.abc123 --add-creator "jdoe2"
```

### Publishing a Draft

```bash
# 1. Verify integrity before publishing
alice mint verify 10.12345/alice.abc123

# 2. Publish (copies to Permanent Bucket, sets findable)
alice mint publish 10.12345/alice.abc123

# 3. Deposit to JScholarship
alice mint deposit 10.12345/alice.abc123
```

### Citing an Artifact

```bash
# Generate BibTeX
alice mint cite 10.12345/alice.abc123 --format bibtex

# Copy APA citation to clipboard
alice mint cite 10.12345/alice.abc123 --format apa --copy
```

### Searching the Catalog

```bash
# Find your artifacts
alice mint search "" --mine

# Search by topic
alice mint search "machine learning" --type Dataset --since 2025-01-01
```

### Versioning

```bash
# 1. Create a new version
alice mint version 10.12345/alice.abc123 revised-paper.pdf --title "Revised Analysis v2"

# 2. The new DOI is automatically linked to the previous version
alice mint link <new-doi> --list
```

### Batch Minting from a Manifest

```bash
# 1. Create a manifest file
cat > artifacts.json << 'EOF'
[
  {"path": "paper.pdf", "title": "Research Paper", "type": "Text"},
  {"path": "data.csv", "title": "Supporting Data", "type": "Dataset"},
  {"path": "code.py", "title": "Analysis Code", "type": "Software"}
]
EOF

# 2. Batch mint
alice mint --manifest artifacts.json --concurrency 4

# 3. Export the catalog
alice mint export --format csv --output minted.csv
```

## Error Handling

| Error Class | Trigger | Recovery |
|---|---|---|
| `MintError` | Invalid input (missing title, bad type) | Fix input and retry |
| `DataCiteError` | DataCite API failure | Retry for 5xx; check credentials for 4xx |
| `CatalogError` | DynamoDB failure | Check AWS credentials |
| `PreserveError` | S3 upload/download failure | No DOI registered if upload fails |
| `JScholarshipError` | SWORD/DSpace failure | Warning only; retry with `alice mint deposit` |
| `IntegrityError` | Checksum mismatch | Copy aborted, DOI stays draft; re-mint |

### Key Invariant

S3 upload succeeds before DataCite registration. If S3 fails, no side effects occur.

## Infrastructure

### Terraform Module: `alice-preserve`

| Resource | Purpose |
|---|---|
| `aws_s3_bucket.staging` | Draft artifact storage |
| `aws_s3_bucket.permanent` | Immutable artifact storage (Object Lock) |
| `aws_s3_bucket.replica` | Cross-region replica |
| `aws_dynamodb_table.metadata_catalog` | DOI metadata, status, checksums |
| `aws_glue_catalog_table.checksum_ledger` | Append-only Parquet ledger |
| `aws_lambda_function.integrity` | SHA-256 verification on PutObject |
| `aws_sns_topic.integrity_alerts` | Checksum mismatch alerts |
| `aws_cloudfront_distribution.landing_pages` | DOI landing page CDN |
| `aws_athena_workgroup.preserve` | Ledger and inventory queries |
