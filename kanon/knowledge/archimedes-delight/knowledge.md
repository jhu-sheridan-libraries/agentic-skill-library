---
name: archimedes-delight
displayName: Archimedes Delight
description: >-
  Elite academic research library tool for Johns Hopkins staff and faculty.
  Provides MCP-backed data access to research repositories (starting with
  RODA — Registry of Open Data on AWS), guided research skills for citation
  management, autonomous agents for literature review and dataset discovery,
  and multi-step research workflows.
keywords:
  - archimedes-delight
  - jh-drcc
  - roda
  - research-library
  - literature-review
  - dataset-discovery
  - citation-management
  - academic-research
author: Johns Hopkins DRCC
version: 0.1.1
harnesses:
  - kiro
  - claude-code
type: skill
inclusion: auto
categories:
  - documentation
  - devops
ecosystem:
  - aws
depends: []
enhances: []
maturity: experimental
trust: community
audience: advanced
model-assumptions: []
collections:
  - jh-drcc
inherit-hooks: false
harness-config:
  kiro:
    format: power
    inclusion: manual
  claude-code:
    format: claude-md
---

# Archimedes Delight

## Overview

Archimedes Delight is an elite academic research library tool for Johns Hopkins
staff and faculty engaged in advanced scholarly research. It bundles four kinds
of capability in one package:

- **Data access** via MCP servers (starting with RODA — the Registry of Open
  Data on AWS — plus a placeholder for literature search).
- **Guided research skills** that a human drives step by step with AI
  assistance (citation management).
- **Autonomous research agents** that run their own search / evaluate /
  synthesize loop (literature review, dataset discovery).
- **Research workflows** that sequence a repeatable multi-step procedure
  (the dataset/paper-to-citation pipeline).

Two of these capabilities — **literature review** and **dataset discovery** —
are *autonomous agents*, documented under "Autonomous Research Agents" below.
They run their own loop rather than being driven step by step. The rest are
*guided*: a human directs each step. This distinction matters for anyone (a
person or an external agent runtime) deciding which capability to hand off
versus which to walk through.

### Consuming these capabilities

Each capability is declared in a machine-readable form so it can be consumed
without reading prose:

- **MCP servers** live in `mcp-servers.yaml` (this artifact's directory) and are
  merged into each target harness's MCP config at build time. Any runtime that
  speaks MCP can call them directly.
- **The catalog entry** for `archimedes-delight` (in `catalog.json`, via
  `kanon catalog generate`) exposes this artifact's metadata, collection
  membership, and content to the catalog MCP bridge (`catalog_list`,
  `artifact_content`, `collection_list`).
- **Agent loops** below are written as explicit define-scope → search →
  triage/evaluate → synthesize steps with named inputs and outputs, so an
  external orchestrator can execute them rather than paraphrase them.

## Data Access

### RODA MCP Server

The `awslabs.roda-mcp-server` MCP server provides search, metadata retrieval,
and discovery over datasets published in the **Registry of Open Data on AWS
(RODA)**. It launches via `uvx awslabs.roda-mcp-server@latest` and needs no
credentials — RODA is a public, no-auth service.

**Tool list:** confirm the exact tools exposed by the installed package version
before populating `autoApprove` in `mcp-servers.yaml`. It ships with
`autoApprove: []` deliberately: nothing is pre-approved until a maintainer
inspects the package's tools and opts specific **read-only** ones (search,
metadata, discovery) in. An external unattended runtime (for example, a polling
worker that only permits allowlisted read-only tools) should treat the
intersection of RODA's confirmed read-only tools and its own safe-tool allowlist
as the callable set — populating `autoApprove` here and the runtime's allowlist
are two separate gates that must agree.

### Literature Search MCP Server (placeholder)

No official or institutionally-hosted remote MCP server exists today for PubMed,
arXiv, or Semantic Scholar (confirmed by research during this artifact's
authoring). The `archimedes-delight-literature-search` entry in
`mcp-servers.yaml` is therefore a **placeholder** whose `url`
(`https://TBD.internal.jh.edu/mcp`) points at nothing yet. It is pending a JHU
DRCC-hosted instance.

A documented candidate implementation for that future instance is
[`cyanheads/pubmed-mcp-server`](https://github.com/cyanheads/pubmed-mcp-server),
which supports self-hosting via `transport: http` or `sse`. Do **not** point
this entry at an unaffiliated third party's personally-hosted instance in
production — an elite research-library tool should not inherit an unaffiliated
individual's uptime and trust risk.

### Credential guidance for future data-access servers

RODA needs no credentials, so none are wired up here. When a future data-access
server is added to `mcp-servers.yaml` that *does* require credentials (a
JHU-internal repository API, or the eventual real literature-search endpoint if
it requires auth), reference them via `${ENV_VAR}` placeholders rather than
hardcoded values, consistent with the `kanon.config.yaml` / `~/.forge/config.yaml`
credential boundary. `kanon validate --security` will flag credential-like
values hardcoded in `mcp-servers.yaml`.

## Available Steering Files

| File | Inclusion | Trigger | Content |
|---|---|---|---|
| **citation-pipeline** | manual | `#citation-pipeline` in chat | Turning a discovered dataset or paper into a formatted citation |

## Research Skills

Guided, human-in-the-loop capabilities. A human drives each step; the AI
assists. These are distinct from the Autonomous Research Agents below.

### Citation Management

- **Purpose:** turn a dataset or paper reference into a correctly-formatted
  citation in a chosen style.
- **Inputs:** a dataset or paper reference (a RODA dataset record, a DOI, a
  BibTeX entry, or free-text bibliographic details) and a target citation style.
- **Outputs:** a formatted citation string in the requested style, plus a note
  of any missing metadata fields the reference could not supply.
- **Dependencies:** exercisable using only this artifact's own capabilities —
  the `citation-pipeline` workflow (see Available Steering Files) and, when the
  input is a dataset reference, the RODA MCP Server for metadata retrieval. No
  external dependency is required.

## Autonomous Research Agents

These capabilities run their own loop rather than being driven step by step.
Hand off a goal ("review the literature on X", "find datasets about Y") and
receive a synthesized result. They are structurally separated from the guided
Research Skills above precisely so a reader — or an external agent runtime —
can tell which capabilities execute autonomously and which require step-by-step
human direction. Both agents draw **only** on MCP servers already declared in
this artifact's own `mcp-servers.yaml`; there is no cross-artifact composition.

### Literature Review Agent

- **Inputs:** a research question or topic (free text).
- **Outputs:** a synthesized literature summary with citations.
- **Loop:**
  1. Define scope — turn the question into search terms, date ranges, and
     inclusion/exclusion criteria.
  2. Search — query the Literature Search MCP Server.
  3. Triage — screen results against the inclusion/exclusion criteria.
  4. Synthesize — summarize the screened set and attach citations.
- **Current limitation:** the Literature Search MCP Server is currently a
  placeholder (see Data Access above). Until a real endpoint is wired up, the
  agent must handle the missing search step explicitly rather than fabricate
  results:
  - In an **interactive** session, tell the user the search step cannot be
    completed because the endpoint is not yet configured.
  - In an **unattended** run (for example, a scheduled or polling agent runtime
    with no human in the loop), skip and log the gap — do not "ask the user",
    do not fabricate results, and do not fail the whole run silently. Report the
    capability as unavailable and continue.

### Dataset Discovery Agent

- **Inputs:** a research question or dataset criteria (free text).
- **Outputs:** a ranked shortlist of candidate datasets.
- **Loop:**
  1. Define scope — turn the question into dataset criteria (domain, size,
     license, format).
  2. Search — query the RODA MCP Server.
  3. Evaluate — score candidates on relevance, size, license, and format.
  4. Shortlist — return a ranked list with the reasoning for each ranking.
- **Current limitation:** RODA's exact tool list is unconfirmed at authoring
  time (see Data Access above). The agent should rely only on documented and
  confirmed RODA tools once `autoApprove` is populated. Otherwise it proceeds
  normally — the RODA endpoint itself is real and working, so this agent has no
  placeholder gap, unlike the Literature Review Agent.
