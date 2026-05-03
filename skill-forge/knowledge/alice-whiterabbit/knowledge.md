---
name: alice-whiterabbit
displayName: JHU White Rabbit
description: Guide to ALICE (AWS Language Intelligence and Cognitive Exploration) — manage Bedrock credentials, invoke LLMs, use AI research utilities, mint DOIs, and run digital preservation workflows at Johns Hopkins. Covers CLI commands, infrastructure, TUI development, testing patterns, model selection, research prompt recipes, OAIS lifecycle, and format identification.
keywords:
  - alice-cli
  - alice
  - bedrock
  - llm-research
  - jhu
  - poetry
  - pytest
  - ruff
  - mypy
  - polly
  - teaparty
  - tui
  - textual
  - tofu
  - terraform
  - sso
  - converse-api
  - click
  - pydub
  - hypothesis
  - moto
  - rich
  - agentcore
  - cite
  - cloud-locker
  - looking-glass
  - cheshire-gate
  - preserve
  - mint
author: Steven J Miklovic, Johns Hopkins DRCC
version: 0.1.0
harnesses:
  - kiro
  - claude-code
  - cursor
type: power
inclusion: auto
categories:
  - architecture
  - devops
  - documentation
ecosystem:
  - aws
  - bedrock
  - python
depends: []
enhances: []
maturity: stable
trust: community
audience: intermediate
model-assumptions: []
collections:
  - jhu
inherit-hooks: false
harness-config:
  kiro:
    format: power
  claude-code:
    format: claude-md
  cursor:
    format: rule
---

# White Rabbit

## Overview

ALICE (AWS Language Intelligence and Cognitive Exploration) is a Python CLI tool for GenAI research at Johns Hopkins. It manages AWS Bedrock credentials, invokes foundation models (Claude, Nova, Mistral, DeepSeek), and provides multi-model comparison, batch processing, session history, and cost tracking.

Built with Click, boto3, Rich, and Textual. Packaged with Poetry. Requires Python 3.12+ and an AWS SSO profile.

## Available Steering Files

| File | Inclusion | Pattern / Trigger | Content |
|---|---|---|---|
| **development** | fileMatch | `alice-cli/src/**` | Project structure, conventions, tooling commands, new command checklist, changelog rules |
| **infrastructure** | fileMatch | `terraform/**` | Environment layout, module inventory, IAM roles, tofu workflow, state management |
| **tui-development** | fileMatch | `alice-cli/src/**/tui/**` | AliceScreen contract, screen registry, widgets, CRT theme, worker threads |
| **teaparty-development** | fileMatch | `alice-cli/src/**/teaparty/**` | Pipeline stages, Polly engines, SSML, voice resolver, script schema, audio stitching |
| **testing-patterns** | fileMatch | `alice-cli/tests/**` | pytest, hypothesis PBT, moto mocking, fixtures, benchmark patterns |
| **model-selection** | manual | `#model-selection` in chat | Bedrock model tiers, cost-aware patterns, task-to-model reference |
| **research-prompts** | manual | `#research-prompts` in chat | Prompt recipes for summarization, literature reviews, metadata, citations, batch |
| **preservation** | fileMatch | `alice-cli/src/**/preserve/**` | OAIS lifecycle, BagIt packaging, PREMIS events, format identification, ingest pipeline, backlog/appraisal |
| **doi-minting** | fileMatch | `alice-cli/src/**/mint/**` | DOI lifecycle, DataCite metadata, citation formatting, versioning, batch minting |

## Current Development

Active specs in `.kiro/specs/`:

| Spec | Status | Scope |
|---|---|---|
| teaparty | complete | Podcast-style audio generation pipeline (Bedrock + Polly + pydub) |
| tui-enhancements | complete | 12 new TUI screens, AliceScreen base class, streaming, command palette |
| agentcore-integration | in progress | AgentCore agent deployment and management |
| alice-notebook | in progress | Jupyter-style notebook interface |
| cite-enhancements | in progress | Citation pipeline improvements |
| cheshire-gate-enhancements | in progress | API gateway enhancements |
| looking-glass-vector-indexing | in progress | Vector search indexing |
| doi-mint-command | in progress | DOI minting CLI command |
| madhatter | in progress | Text transformation pipeline |
| cloudwatch-api-key-dashboard | in progress | API key usage monitoring |
| preserve-archivematrix | in progress | Archivematica-inspired digital preservation (OAIS, BagIt, PREMIS, format ID) |

Architectural decisions are tracked in `alice-cli/docs/adr/` (15 ADRs). Key decisions: AliceScreen base class (ADR-013), data-driven screen registry (ADR-015), worker thread UI communication (ADR-014), config precedence (ADR-003), error hierarchy (ADR-009).

## Onboarding

### Prerequisites

- Python 3.12+
- AWS CLI configured with an SSO profile (e.g. `drcc-ai`)
- Active SSO session: `aws sso login --profile <PROFILE>`
- Poetry (for development installs)

### Installation

```bash
cd alice-cli

# Standard install
poetry install

# With TUI support (full-screen terminal UI)
poetry install --extras tui

# With AgentCore support
poetry install --extras agentcore

# Isolated install via pipx
pipx install .
pipx install ".[tui]"
```

One-off use without installing:

```bash
uvx --from ./alice-cli alice env --profile myprofile
```

### First-Time Setup

```bash
# 1. Authenticate — fetches Bedrock API key, stores credentials to ~/.alice/
alice auth --profile <PROFILE>

# 2. Verify — shows SSO state, identity, region, namespace
alice status

# 3. Export credentials into your shell
eval $(alice env --eval)
```

After the first `alice auth`, most commands work without `--profile`.

### Shell Completion

```bash
alice install-completion
```

Installs tab completion for bash, zsh, fish, or PowerShell. Restart your shell afterward.

## JH-AiAccessRole (Developer Access)

The `JH-AiAccessRole` is an IAM role that grants broad permissions to develop and consume all ALICE project resources (Bedrock, AgentCore, Lambda, ECS, DynamoDB, CloudWatch, etc.). Any user with an SSO role in the account can assume it.

### AWS CLI Configuration

Add a profile to `~/.aws/config` that chains off your SSO profile:

```ini
[profile drcc-ai-access]
role_arn = arn:aws:iam::584034200963:role/bedrock/JH-AiAccessRole
source_profile = drcc-sso
region = us-east-1
```

Then authenticate and verify:

```bash
aws sso login --profile drcc-sso
aws sts get-caller-identity --profile drcc-ai-access
```

### When to Use

- `drcc-ai` (SSO direct) — day-to-day `alice` CLI usage, read-only console browsing
- `drcc-ai-access` (assume role) — Terraform applies, deploying agents, managing infrastructure, CodeBuild triggers, DynamoDB admin operations

### What It Grants

Broad access to: Bedrock, AgentCore, Lambda, CodeBuild, ECR, ECS, EFS, ELB, DynamoDB, CloudWatch, API Gateway, EventBridge, SNS, X-Ray, Route 53, Service Discovery. IAM is scoped to the `/bedrock/` path. S3, Secrets Manager, and SSM are scoped to project namespaces.

## Common Workflows

### Authentication and Credentials

```bash
# Standard auth (detects JHED from SSO, fetches API key, saves to ~/.alice/)
alice auth --profile <PROFILE>

# API key mode (skip SSO entirely)
alice auth --api-key <SECRET_KEY>

# Export credentials
eval $(alice env --eval)       # shell variables
alice env --env-file           # .env format
alice env --json               # raw JSON
```

### Invoking Models

```bash
# Single prompt
alice invoke "Explain the Krebs cycle"

# Specify model
alice invoke --model-id opus "Summarize this paper"

# Multi-turn chat
alice chat
alice chat --model-id nova-pro
```

Default model: `sonnet` → `us.anthropic.claude-sonnet-4-6`. Use `alice list-aliases` to see all aliases.

### Multi-Model Operations

```bash
# Compare responses across models
alice compare "What is entropy?" --models sonnet,nova-pro,mistral-large

# Two-model debate
alice dialog "Best programming language?" --models sonnet,nova-pro

# Batch prompts from CSV
alice batch prompts.csv

# Summarize a file or stdin
alice summarize paper.pdf
cat notes.txt | alice summarize -
```

### Session History and Costs

```bash
alice recall                   # browse all sessions
alice recall --type chat       # filter by type
alice recall --model sonnet    # filter by model
alice appraise                 # view token usage and costs
```

Sessions are stored in S3 (CloudLocker) with local fallback under `~/.alice/locker/`.

### Secrets Management

```bash
alice get-secret               # your own Bedrock API key
alice get-secret myapp-config  # short name (auto-prefixes namespace/environment)
alice list-secrets             # list all secrets under namespace/environment
```

### Quota

```bash
alice quota                    # your token usage and remaining quota
alice quota --jhed someuser    # check another user
```

### Claude Code Integration

```bash
# One-step: auth + launch Claude Code with Bedrock credentials
alice auth --profile <PROFILE> --claude

# After first run, just:
alice auth --claude
```

### AWS CLI Passthrough

```bash
alice run s3 ls
alice run secretsmanager list-secrets
```

Injects `--region` and `--profile` from alice context automatically.

### TUI Mode

```bash
alice --tui
```

Full-screen terminal UI with amber-on-black retro CRT aesthetic. Requires `poetry install --extras tui`. Recommended font: Source Code Pro or Fira Code.

### Configuration

```bash
alice config    # show resolved config and sources
```

Precedence: CLI flag > environment variable > stored credentials > default.

| Setting | Default | Env var | CLI flag |
|---|---|---|---|
| Profile | — | `AWS_PROFILE` | `--profile` |
| Region | `us-east-1` | — | `--region` |
| Namespace | `drcc` | `ALICE_NAMESPACE` | `--namespace` |
| Environment | `ai` | `ALICE_ENVIRONMENT` | `--environment` |
| API key | — | `BEDROCK_SECRET_KEY` | `--api-key` |

## Global Options

| Option | Default | Description |
|---|---|---|
| `--profile` | `$AWS_PROFILE` | AWS CLI profile |
| `--region` | `us-east-1` | AWS region |
| `--namespace` | `drcc` | Resource namespace |
| `--environment` | `ai` | Deployment environment |
| `--api-key` | `$BEDROCK_SECRET_KEY` | Bedrock API key (skips SSO) |
| `--quiet` | off | Suppress banner and status messages |
| `--debug` | off | Enable structured debug logging to stderr |
| `--personality` | `alice` | Voice personality (`alice`, `mr_rogers`, `shodan`) |
| `--tui` | off | Launch interactive TUI |
| `--version` | — | Print version and exit |

## Command Reference

| Command | Description |
|---|---|
| `alice auth` | Authenticate and store credentials |
| `alice auth --claude` | Authenticate and launch Claude Code |
| `alice env` | Export Bedrock credentials for shell use |
| `alice invoke <prompt>` | Invoke a Bedrock model |
| `alice chat` | Multi-turn conversation |
| `alice batch <file>` | Batch prompts from CSV |
| `alice compare <prompt>` | Compare responses across models |
| `alice dialog <prompt>` | Two-model conversation |
| `alice summarize [file]` | Summarize file or stdin |
| `alice appraise` | View token usage and session costs |
| `alice recall` | Browse session history |
| `alice quota` | View token quota |
| `alice compose` | AgentCore agent wizard |
| `alice get-secret [name]` | Retrieve a secret |
| `alice list-secrets` | List secrets in namespace |
| `alice list-aliases` | Show model alias mappings |
| `alice list-models` | List Bedrock foundation models |
| `alice run <args>` | AWS CLI passthrough |
| `alice config` | Show configuration |
| `alice status` | Health check |
| `alice diagnose` | Diagnostic checks |
| `alice install-completion` | Install shell tab completion |
| `alice preserve ingest <path>` | Create a SIP and start the ingest pipeline |
| `alice preserve package <path>` | Create or validate BagIt bags |
| `alice preserve disseminate <doi>` | Generate a DIP (access copy) from an AIP |
| `alice preserve identify <path>` | Identify file formats via Siegfried / extension fallback |
| `alice preserve events <doi>` | Browse PREMIS preservation events |
| `alice preserve plan` | Assess format risk using the policy registry |
| `alice preserve normalize <doi>` | Convert artifacts to preferred preservation formats |
| `alice preserve backlog` | List items awaiting ingest in the staging backlog |
| `alice preserve appraise <id>` | Approve, reject, or return backlog items |
| `alice mint <path>` | Register a draft DOI for a research artifact |
| `alice mint publish <doi>` | Publish a draft DOI to permanent storage |
| `alice mint verify <doi>` | Verify artifact integrity (checksums) |
| `alice mint cite <doi>` | Generate a formatted citation (BibTeX, APA, Chicago, RIS) |
| `alice mint search <query>` | Search the Metadata Catalog or DataCite |
| `alice mint update <doi>` | Update metadata on a draft DOI |
| `alice mint version <doi> <path>` | Create a new version of an existing DOI |
| `alice mint retract <doi>` | Retract a published DOI |
| `alice mint share <doi>` | Share artifact access with collaborators |
| `alice mint transfer <doi>` | Transfer DOI ownership |
| `alice mint link <doi>` | Manage related identifier links |
| `alice mint export` | Export catalog entries in bulk |
| `alice mint deposit <doi>` | Deposit to JScholarship |
| `alice mint status <doi>` | Show DOI status |

## Troubleshooting

### Error: "SSO session expired"

**Cause:** AWS SSO token has expired.
**Solution:**
```bash
aws sso login --profile <PROFILE>
alice auth --profile <PROFILE>
```

### Error: "Command not found: alice"

**Cause:** CLI not on PATH after install.
**Solution:**
1. If using Poetry: `poetry shell` or prefix with `poetry run alice`
2. If using pipx: ensure `~/.local/bin` is in your PATH
3. Verify: `which alice`

### Error: "No credentials found"

**Cause:** Haven't run `alice auth` yet, or credentials expired.
**Solution:**
```bash
alice auth --profile <PROFILE>
alice status   # verify
```

### Error: "Access denied" on Bedrock calls

**Cause:** Missing permissions or wrong profile/region.
**Solution:**
1. Verify profile: `alice config`
2. Check region matches your Bedrock setup (default: `us-east-1`)
3. Re-authenticate: `alice auth --profile <PROFILE>`

### Diagnostic Check

```bash
alice diagnose
```

Runs comprehensive checks on SSO session, credentials, connectivity, and configuration.

## Complementary Powers

These Kiro Powers pair well with ALICE but are installed separately:

- **aws-cost-optimization** — Deeper Bedrock spend analysis, pricing lookups, and budget forecasting beyond what `alice appraise` and `alice quota` provide. Useful for teams managing research budgets.
- **aws-observability** — Monitor Bedrock API call patterns, track error rates and latency via CloudWatch. Audit secret access and Bedrock usage via CloudTrail.
- **aws-agentcore** — Direct tool access for deploying and managing AgentCore agents, complementing the `alice compose` wizard.

Install any of these from the Kiro Powers panel to use alongside ALICE.

## Best Practices

- Always run `alice auth` before starting a session to ensure fresh credentials
- Use `alice status` to verify your setup before invoking models
- Use `--quiet` flag when piping output to other commands
- Use `eval $(alice env --eval)` to load credentials into your shell for other tools
- Use `alice appraise` regularly to monitor token usage and costs
- Prefer model aliases (`sonnet`, `opus`, `haiku`) over full model IDs
- Use `alice compare` to evaluate model quality before committing to one
