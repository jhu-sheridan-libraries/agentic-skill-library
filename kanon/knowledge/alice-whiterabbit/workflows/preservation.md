# ALICE Preserve — Digital Preservation Context

## Module Layout

```
alice-cli/src/alice_cli/preserve/
├── __init__.py            # preserve_group Click group, subcommand registration
├── commands/              # One file per subcommand (9 subcommands)
│   ├── ingest.py          # SIP creation + pipeline start
│   ├── package.py         # BagIt create / validate
│   ├── disseminate.py     # DIP generation from AIP
│   ├── identify.py        # PRONOM format identification
│   ├── events.py          # PREMIS event history
│   ├── plan.py            # Format risk assessment
│   ├── normalize.py       # Format conversion
│   ├── backlog.py         # Staging backlog listing
│   └── appraise.py        # Approve / reject / return backlog items
├── bagit.py               # RFC 8493 BagIt packaging (pure Python)
├── oais.py                # OAIS SIP → AIP → DIP lifecycle
├── premis.py              # Pydantic PREMIS event + agent models
├── format_id.py           # Siegfried + extension fallback
├── tech_metadata.py       # Format-specific characterization
├── format_policy.py       # YAML policy registry + risk assessment
├── normalizer.py          # Format conversion dispatch
├── backlog_manager.py     # Staging backlog queries + appraisal
├── catalog.py             # DynamoDB Metadata Catalog OAIS extensions
├── ledger.py              # Checksum Ledger extended event types
└── event_query.py         # PREMIS event sorting, filtering, query helpers
```

## OAIS Lifecycle

The system follows the Open Archival Information System (ISO 14721) reference model with three package types:

```
SIP (Submission)  →  AIP (Archival)  →  DIP (Dissemination)
     ingest            pipeline            disseminate
```

| Package | Description | Storage |
|---|---|---|
| **SIP** | User-submitted bundle: original bitstream + descriptive metadata | Staging Bucket (backlog) |
| **AIP** | Preservation-grade bundle: original + BagIt manifests + PREMIS + tech metadata + format ID | Permanent Bucket (Object Lock) |
| **DIP** | Access-oriented derivative: normalized copies + simplified metadata | Local output directory |

### Lifecycle States

```
[upload] → SIP → Backlog → Ingesting → AIP → DIP
                    ↓           ↓
                 Rejected   IngestFailed
                    ↓
                 Returned → resubmit as SIP
```

## BagIt Packaging (RFC 8493)

Each preserved artifact is packaged as a self-describing BagIt bag with embedded checksums.

### Bag Structure

```
<bag-name>/
├── bagit.txt                  # BagIt-Version: 1.0, Tag-File-Character-Encoding: UTF-8
├── bag-info.txt               # Source-Organization, Bagging-Date, Bag-Size, Payload-Oxum, External-Identifier
├── manifest-sha256.txt        # SHA-256 checksums for all data/ files
├── tagmanifest-sha256.txt     # SHA-256 checksums for tag files (bagit.txt, bag-info.txt, etc.)
├── data/                      # Payload directory (original files, preserving directory structure)
│   └── <original files>
├── metadata/                  # Descriptive metadata (added during SIP creation)
│   └── descriptive.json
└── premis/                    # PREMIS events (added during AIP creation)
    └── events.json
```

### Key Models

- `BagInfo` — Pydantic model for `bag-info.txt` fields (source_organization, bagging_date, bag_size, payload_oxum, external_identifier)
- `BagManifestEntry` — Pydantic model for manifest lines (checksum + filepath)
- `Payload-Oxum` — `octetcount.streamcount` format (total bytes and file count in `data/`)

### Functions

| Function | Purpose |
|---|---|
| `create_bag(source_path, output_dir, bag_info)` | Create a BagIt bag from a file or directory |
| `validate_bag(bag_path)` | Validate bag integrity (returns list of errors, empty = valid) |
| `compute_payload_oxum(data_dir)` | Compute Payload-Oxum for a data directory |
| `serialize_bag_info(info)` / `parse_bag_info(text)` | Round-trip bag-info.txt serialization |
| `serialize_manifest(entries)` / `parse_manifest(text)` | Round-trip manifest serialization |

## PREMIS Events

Every preservation action is recorded as a PREMIS event for full audit trail.

### Event Types

| Event Type | Trigger |
|---|---|
| `ingestion` | SIP submitted via `alice preserve ingest` |
| `fixity check` | Integrity Lambda verifies checksum on Permanent Bucket write |
| `virus check` | GuardDuty Malware Protection scan during ingest pipeline |
| `format identification` | Siegfried / extension-based format ID |
| `validation` | BagIt bag validation |
| `normalization` | Format conversion via `alice preserve normalize` |
| `migration` | Format migration (long-term format evolution) |
| `dissemination` | DIP generated via `alice preserve disseminate` |
| `appraisal` | Approve / reject / return via `alice preserve appraise` |
| `deletion` | Artifact removal |

### PREMIS Models

- `PremisEvent` — Pydantic model: event_identifier (UUID4), event_type, event_date_time (ISO 8601 UTC), event_outcome (success/warning/failure), event_detail, event_outcome_detail, linking_agent_identifier
- `PremisAgent` — Pydantic model: agent_identifier (e.g. `alice-cli/0.2.3`), agent_name, agent_type (software/person/organization)

### Serialization

| Function | Purpose |
|---|---|
| `serialize_premis_event(event)` / `deserialize_premis_event(json_str)` | Single event round-trip |
| `serialize_premis_agent(agent)` / `deserialize_premis_agent(json_str)` | Single agent round-trip |
| `serialize_event_list(events)` / `deserialize_event_list(json_str)` | Event list round-trip |

Events are stored in the Metadata Catalog (`premis_events` attribute) and embedded in the AIP's `premis/events.json` tag file.

## Format Identification

Format identification uses Siegfried (PRONOM signatures) with extension-based fallback.

### Identification Flow

1. Check if Siegfried is installed (`is_siegfried_available()`)
2. If available: invoke Siegfried CLI, parse JSON output → PUID, MIME type, format name, version, basis
3. If unavailable: fall back to extension map (`typemap.py`) → warn on stderr about reduced accuracy
4. If Siegfried cannot identify: PUID = `UNKNOWN`, include Siegfried warning
5. Record a PREMIS event of type `format identification`

### Key Model

`FormatIdentification` — Pydantic model: puid, mime_type, format_name, format_version, basis, warning, file_path

## Ingest Pipeline

The ingest pipeline is an AWS Step Functions state machine with discrete Lambda steps.

### Pipeline Steps

```
VirusScan → FormatIdentify → Validate → Checksum → MetadataExtract → BagItPackage → CatalogUpdate → LedgerAppend
```

| Step | Lambda | Skip Flag | Description |
|---|---|---|---|
| Virus Scan | `virus-scan` | `--skip-virus-scan` | GuardDuty Malware Protection for S3 |
| Format Identify | `format-identify` | `--skip-format-id` | Siegfried Lambda Layer (falls back to extension) |
| Validate | `validate` | — | BagIt structure and checksum validation |
| Checksum | `checksum` | — | SHA-256 computation |
| Metadata Extract | `metadata-extract` | — | Format-specific technical metadata |
| BagIt Package | `bagit-package` | — | Create AIP BagIt bag |
| Catalog Update | `catalog-update` | — | Update DynamoDB Metadata Catalog |
| Ledger Append | `ledger-append` | — | Append to Checksum Ledger |

- Each step records a PREMIS event regardless of outcome
- Failed steps halt the pipeline and set status to `ingest_failed`
- Malware detection quarantines the item (status `quarantined`)
- Normalization can be skipped with `--skip-normalize`

## Backlog and Appraisal

The Staging Bucket serves as the preservation backlog. Items land there on upload and remain until appraised.

### Backlog Statuses

| Status | Meaning |
|---|---|
| `backlog` | Uploaded, awaiting review |
| `ingest_failed` | Pipeline failed, needs attention |
| `quarantined` | Malware detected |
| `ingesting` | Pipeline in progress |
| `rejected` | Appraiser rejected |
| `returned` | Returned to submitter for revision |
| `completed` | Successfully ingested as AIP |

### Appraisal Actions

| Action | Flag | Effect |
|---|---|---|
| Approve | `--approve` | Starts ingest pipeline, status → `ingesting` |
| Reject | `--reject` | Status → `rejected`, PREMIS appraisal event recorded |
| Return | `--return` | Status → `returned`, PREMIS appraisal event recorded |

All appraisal actions accept `--reason <text>` for reject/return.

## Format Policy and Normalization

### Format Policy Registry

YAML file at `~/.alice/format-policy.yaml` (or `--policy-file <path>`):

```yaml
fmt/276:  # PDF 1.7
  risk_level: low
  preferred_format_puid: fmt/354  # PDF/A-2b
  normalization_tool: ghostscript
  notes: "Normalize to PDF/A for long-term preservation"

fmt/353:  # TIFF
  risk_level: low
  preferred_format_puid: x-fmt/392  # JPEG 2000
  normalization_tool: imagemagick
```

- `RiskLevel` enum: `low`, `medium`, `high`, `unknown`
- Unknown PUIDs default to `unknown` risk with manual review recommended
- `alice preserve plan` cross-references catalog entries against the registry

### Normalization

- Policy-driven: looks up PUID in registry, applies configured tool
- Override: `--format <target-puid>` bypasses registry
- Original bitstream is never modified — normalized copy stored alongside
- PREMIS `normalization` event recorded with source/target PUIDs and tool

## Command Reference

### `alice preserve ingest <path>`

Create a SIP and start the ingest pipeline.

```bash
# Single file ingest
alice preserve ingest paper.pdf --title "My Research Paper" --creator "jsmith1"

# Directory ingest
alice preserve ingest ./dataset/ --title "Experiment Results" --type Dataset

# With metadata file
alice preserve ingest paper.pdf --metadata-file metadata.json

# Skip virus scan (dev/testing)
alice preserve ingest paper.pdf --title "Draft" --skip-virus-scan

# Skip format identification (use extension only)
alice preserve ingest paper.pdf --title "Draft" --skip-format-id

# Check pipeline status
alice preserve ingest --status arn:aws:states:us-east-1:584034200963:execution:ingest:abc123
```

Options: `--title`, `--creator`, `--type`, `--description`, `--metadata-file`, `--skip-virus-scan`, `--skip-normalize`, `--skip-format-id`, `--status <execution-id>`

### `alice preserve package <path>`

Create or validate BagIt bags.

```bash
# Create a bag from a file
alice preserve package paper.pdf

# Create a bag from a directory
alice preserve package ./dataset/ --output /tmp/my-bag

# Validate an existing bag
alice preserve package --validate /path/to/bag-dir
```

Options: `--output <dir>`, `--validate <bag-path>`

### `alice preserve disseminate <doi>`

Generate a DIP (access copy) from an AIP.

```bash
# Generate DIP with default normalization
alice preserve disseminate 10.12345/alice.abc123 --output ./access-copies/

# Generate DIP in a specific format
alice preserve disseminate 10.12345/alice.abc123 --format pdf --output ./copies/
```

Options: `--output <dir>`, `--format <target-format>`

### `alice preserve identify <path>`

Identify file formats via Siegfried (PRONOM) with extension fallback. Outputs JSON to stdout.

```bash
# Identify a single file
alice preserve identify paper.pdf

# Identify all files in a directory
alice preserve identify ./dataset/

# Pipe to jq
alice preserve identify ./dataset/ | jq '.[].puid'
```

### `alice preserve events <doi>`

Browse PREMIS preservation events for an artifact.

```bash
# Show all events
alice preserve events 10.12345/alice.abc123

# Filter by event type
alice preserve events 10.12345/alice.abc123 --type "fixity check"

# Filter by date
alice preserve events 10.12345/alice.abc123 --since 2025-01-01
```

Options: `--type <event-type>`, `--since <date>`

### `alice preserve plan`

Assess format risk using the policy registry.

```bash
# Risk assessment for all catalog entries
alice preserve plan

# Risk assessment for a specific artifact
alice preserve plan --doi 10.12345/alice.abc123

# Use a custom policy file
alice preserve plan --policy-file ./custom-policy.yaml
```

Options: `--doi <doi>`, `--policy-file <path>`

### `alice preserve normalize <doi>`

Convert artifacts to preferred preservation formats.

```bash
# Normalize using policy registry
alice preserve normalize 10.12345/alice.abc123

# Override with specific target format
alice preserve normalize 10.12345/alice.abc123 --format fmt/354
```

Options: `--format <target-puid>`

### `alice preserve backlog`

List items awaiting ingest in the staging backlog.

```bash
# Show full backlog
alice preserve backlog

# Filter by status
alice preserve backlog --status ingest_failed

# Filter by date and sort
alice preserve backlog --since 2025-01-01 --sort size
```

Options: `--status <status>`, `--since <date>`, `--sort <field>` (date, size, title)

### `alice preserve appraise <identifier>`

Approve, reject, or return backlog items.

```bash
# Approve for ingest
alice preserve appraise abc123-def456 --approve

# Reject with reason
alice preserve appraise abc123-def456 --reject --reason "Duplicate submission"

# Return for revision
alice preserve appraise abc123-def456 --return --reason "Missing metadata fields"
```

Options: `--approve`, `--reject`, `--return` (mutually exclusive), `--reason <text>`

## Common Workflows

### Single-File Ingest

```bash
# 1. Ingest a research paper
alice preserve ingest paper.pdf --title "Neural Network Analysis" --creator "jsmith1" --type Text

# 2. Check pipeline status
alice preserve ingest --status <execution-arn>

# 3. Verify PREMIS events
alice preserve events 10.12345/alice.abc123
```

### Directory Ingest with Format Identification

```bash
# 1. Identify formats in the dataset
alice preserve identify ./experiment-data/

# 2. Check format risk
alice preserve plan --policy-file ~/.alice/format-policy.yaml

# 3. Ingest the directory
alice preserve ingest ./experiment-data/ --title "Experiment 42 Data" --type Dataset

# 4. Monitor pipeline
alice preserve ingest --status <execution-arn>
```

### Checking and Managing the Backlog

```bash
# 1. View all backlog items
alice preserve backlog

# 2. Filter to failed ingests
alice preserve backlog --status ingest_failed

# 3. Review recent uploads
alice preserve backlog --since 2025-06-01 --sort date
```

### Appraising Items

```bash
# 1. Review the backlog
alice preserve backlog

# 2. Approve a good submission
alice preserve appraise abc123 --approve

# 3. Reject a duplicate
alice preserve appraise def456 --reject --reason "Duplicate of 10.12345/alice.xyz"

# 4. Return for revision
alice preserve appraise ghi789 --return --reason "Missing creator metadata"
```

### Generating DIPs (Access Copies)

```bash
# 1. Generate access copies with default normalization
alice preserve disseminate 10.12345/alice.abc123 --output ./access/

# 2. Generate in a specific format
alice preserve disseminate 10.12345/alice.abc123 --format pdf --output ./access/

# 3. Check the dissemination event was recorded
alice preserve events 10.12345/alice.abc123 --type dissemination
```

### Checking PREMIS Event History

```bash
# Full history
alice preserve events 10.12345/alice.abc123

# Only fixity checks
alice preserve events 10.12345/alice.abc123 --type "fixity check"

# Events since a date
alice preserve events 10.12345/alice.abc123 --since 2025-06-01
```

## Infrastructure

### Terraform Module: `alice-preserve` (extensions)

| Resource | Purpose |
|---|---|
| `aws_sfn_state_machine.ingest_pipeline` | Step Functions ingest pipeline |
| `aws_lambda_function.*` | Per-step Lambda functions (8 steps) |
| `aws_guardduty_malware_protection_plan.staging` | Virus scanning for Staging Bucket |
| `aws_lambda_layer_version.siegfried` | Siegfried binary + PRONOM signatures |
| `aws_cloudwatch_metric_alarm.fixity_*` | Fixity mismatch, failure, staleness alarms |
| `aws_cloudwatch_dashboard.fixity` | Fixity observability dashboard |
| `aws_sns_topic_subscription.fixity_email` | Email alerts for fixity issues |

### Fixity Metrics (CloudWatch)

| Metric | Namespace | Description |
|---|---|---|
| `FixityCheckTotal` | `ALiCE/Preserve` | Count of all fixity checks |
| `FixityMismatchTotal` | `ALiCE/Preserve` | Count of checksum mismatches |
| `FixityCheckDurationMs` | `ALiCE/Preserve` | Duration of each fixity check |
| `FixityCheckErrors` | `ALiCE/Preserve` | Count of fixity check errors |
