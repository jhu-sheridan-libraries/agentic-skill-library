# Requirements Document

## Introduction

Archimedes Delight is a new knowledge artifact for the Kanon catalog: an elite academic research library tool aimed at Johns Hopkins staff and faculty engaged in advanced scholarly research. Unlike single-purpose artifacts, it bundles four kinds of capability in one package — MCP servers for data access (starting with a RODA MCP server for repository/dataset access), Skills that guide research tasks (citation management, dataset-discovery guidance), Workflows that sequence multi-step research tasks (dataset-to-citation pipeline), and autonomous Agents that run their own search/evaluate/synthesize loop (literature review, dataset discovery). It joins the `jh-drcc` collection (Johns Hopkins Digital Research and Curation Center), placing it alongside sibling artifacts like `alice-whiterabbit` and `jhu-editorial-check`.

Archimedes Delight includes two **autonomous agent** capabilities — literature review and dataset discovery — each of which runs a define-scope → search → triage → synthesize loop rather than documenting steps for a human to follow. These are authored as agent-loop sections *within* the single `archimedes-delight` artifact's `knowledge.md` body, not as separate artifacts. This follows from what `type` actually is in Kanon: per ADR-0014, `type` is a single asset-taxonomy tag (skill, power, agent, …) used for discovery and validation — it is decoupled from output format (which lives in `harness-config.<harness>.format` per ADR-0012/0013) and does not unlock any distinct agent runtime. On the harnesses this artifact targets (Kiro, Claude Code), a `type: agent` artifact renders as the same steering/markdown that a `type: power` artifact does; Kiro's format registry only defines `steering` and `power` formats, with no `agent` format. Since the "agent" behavior is documented body content plus shared MCP access — exactly what a `power` already bundles — splitting agents into separate `type: agent` artifacts would buy only a distinct catalog tag at the cost of extra artifacts, extra collection members, and `depends`-composition wiring. The agents therefore live inside the power and share its MCP servers directly.

No official, institutionally-hosted remote MCP server exists today for PubMed, arXiv, or Semantic Scholar (confirmed by research during this spec's authoring — see Requirement 7). This spec therefore treats the literature-search MCP server as a placeholder pending a JHU DRCC-hosted instance, rather than depending on a third party's personally-hosted community server.

This spec covers the single artifact authored under `kanon/knowledge/archimedes-delight/` — its frontmatter, MCP server declarations, skill/workflow/agent-loop body content, and collection membership — not a change to Kanon's core compiler or schema. Where a capability needed isn't yet supported by the current schema/build pipeline, that gap is called out explicitly as a requirement so design can decide whether to extend the pipeline or work within existing capabilities.

## Glossary

- **Artifact**: The `archimedes-delight` knowledge artifact directory under `kanon/knowledge/archimedes-delight/`, containing `knowledge.md`, `mcp-servers.yaml`, and `workflows/*.md` per the layout `kanon/build.ts` and `parser.ts` expect. There is exactly one Artifact in this spec — agents, skills, and workflows are all sections within it, not separate artifacts.
- **RODA_MCP_Server**: The `awslabs.roda-mcp-server` MCP server entry in the Artifact's `mcp-servers.yaml`, launched via `uvx awslabs.roda-mcp-server@latest`, providing data access to RODA (Registry of Open Data on AWS) — the first of potentially several data-access MCP servers this Artifact declares.
- **Literature_Search_MCP_Server**: A placeholder MCP server entry in the Artifact's `mcp-servers.yaml`, intended to provide search access to academic literature (PubMed, arXiv, Semantic Scholar, or a JHU library discovery API), to be pointed at a JHU DRCC-hosted endpoint once one exists (see Requirement 7).
- **Research_Skill**: A guided (human-in-the-loop) capability documented within the Artifact — e.g. citation formatting/management or dataset discovery guidance — surfaced to `claude-code` via the plugin skills pipeline (`bun run build:skills`), which already selects `type: power` artifacts (see Requirement 4).
- **Research_Workflow**: A file under the Artifact's `workflows/` directory describing a multi-step research procedure (e.g. "stage a dataset for citation minting") that a human follows with AI assistance, as distinct from a Research_Agent, which runs its own loop autonomously.
- **Research_Agent**: An autonomous capability documented as its own section within the Artifact's `knowledge.md` body — not a separate `type: agent` artifact — that runs a define-scope → search → triage/evaluate → synthesize loop against one or more of the Artifact's own MCP servers without per-step human direction. This spec defines two: the Literature_Review_Agent and the Dataset_Discovery_Agent (see Requirement 8).
- **Literature_Review_Agent**: The Research_Agent documented in the Artifact covering literature review — search → triage → synthesize against the Literature_Search_MCP_Server, producing a summary with citations (see Requirement 8).
- **Dataset_Discovery_Agent**: The Research_Agent documented in the Artifact covering dataset discovery — search → evaluate → shortlist against the RODA_MCP_Server, producing a ranked shortlist of candidate datasets (see Requirement 8).
- **jh-drcc Collection**: The existing collection declared in `kanon/collections/jh-drcc.yaml`, whose membership is derived at build time from artifacts listing `jh-drcc` in their own `collections:` frontmatter field (per ADR-0016) — there is no separate `jhu-drcc` collection in this repo.
- **Target_Harness**: Any of the harnesses declared in the Artifact's `harnesses:` frontmatter field that `kanon build` will generate output for (e.g. `kiro`, `claude-code`).

## Requirements

### Requirement 1: Artifact scaffold and identity

**User Story:** As a Kanon catalog maintainer, I want `archimedes-delight` to exist as a properly-formed knowledge artifact, so that it can be parsed, cataloged, and built like every other artifact in the repo.

#### Acceptance Criteria

1. THE SYSTEM SHALL provide a directory `kanon/knowledge/archimedes-delight/` containing a `knowledge.md` file with YAML frontmatter conforming to `FrontmatterSchema` in `src/schemas.ts`.
2. THE SYSTEM SHALL set the Artifact's frontmatter `name` field to `archimedes-delight` and `type` field to `power` — the Artifact's content is a domain bundle (elite academic research tooling) containing several capability shapes (skills, a workflow, MCP servers, two agent-loop sections) unified by domain rather than by being one single thing, which is the defining nature of `power` as distinct from `skill` (one discrete capability), `workflow` (content whose sole reason to exist is a sequence of steps), `agent` (content that is entirely the operating spec of one autonomous unit), or `reference-pack` (passive, manual-inclusion reference material with no live MCP wiring).
3. THE SYSTEM SHALL set the Artifact's `author` field to identify Johns Hopkins DRCC, consistent with sibling artifacts (e.g. `alice-whiterabbit`, `jhu-editorial-check`).
4. THE SYSTEM SHALL populate `description` with a single paragraph identifying the Artifact as an elite academic research library tool for JHU staff and faculty, covering data access, skills, and workflows, in line with the description conventions used by other `jh-drcc` artifacts.
5. THE SYSTEM SHALL populate `keywords` with terms that support catalog discoverability, including at minimum `jh-drcc`, `roda`, and terms describing its research-library purpose.
6. WHEN `kanon catalog generate` is run after the Artifact is added THEN THE SYSTEM SHALL include `archimedes-delight` as a `CatalogEntry` in `catalog.json` without validation errors.

### Requirement 2: Collection membership in jh-drcc

**User Story:** As a Kanon catalog maintainer, I want Archimedes Delight to be discoverable as part of the JH DRCC collection, so that staff and faculty browsing that collection see it alongside related DRCC tools.

#### Acceptance Criteria

1. THE SYSTEM SHALL list `jh-drcc` in the Artifact's `collections:` frontmatter field.
2. THE SYSTEM SHALL NOT require any edit to `kanon/collections/jh-drcc.yaml` itself to achieve membership, consistent with the metadata-only collection design (ADR-0016).
3. WHEN `buildCollectionMembership()` runs after the Artifact is added THEN THE SYSTEM SHALL report `archimedes-delight` as a member of the `jh-drcc` collection.
4. IF the user or a future editor removes the Artifact's directory THEN THE SYSTEM SHALL no longer show `archimedes-delight` as a `jh-drcc` member on the next catalog/collection build, with no manual cleanup of the collection manifest required.

### Requirement 3: RODA and other data-access MCP servers

**User Story:** As a researcher using Archimedes Delight, I want it to give me MCP-backed access to research data sources, so that I can query and retrieve repository/dataset content without leaving my AI coding/research assistant.

#### Acceptance Criteria

1. THE SYSTEM SHALL provide a `mcp-servers.yaml` file in the Artifact directory declaring a RODA_MCP_Server entry with `name: awslabs.roda-mcp-server`, `command: uvx`, `args: ["awslabs.roda-mcp-server@latest"]`, and `env: {FASTMCP_LOG_LEVEL: ERROR}`, translating the artifact's native `{"mcpServers": {...}}` JSON shape into the `- name / description / command / args / env / autoApprove` list shape used by existing artifacts' `mcp-servers.yaml` (e.g. `kanon/knowledge/alice-whiterabbit/mcp-servers.yaml`).
2. THE SYSTEM SHALL document, in the Artifact's `knowledge.md` body, what the RODA_MCP_Server is for (data access to the Registry of Open Data on AWS) and which tools/operations it exposes, to the extent discoverable from the `awslabs.roda-mcp-server` package at authoring time.
3. THE SYSTEM SHALL set `autoApprove` on the RODA_MCP_Server entry to an explicit list of read-only/safe tool names once known, defaulting to `[]` until design confirms which of its tools are safe to auto-approve.
4. WHERE credentials or endpoint configuration are required to reach RODA or another data source THEN THE SYSTEM SHALL reference them via `${ENV_VAR}` placeholders rather than hardcoded values, consistent with the `kanon.config.yaml` / `~/.forge/config.yaml` credential boundary described in the repo's `CLAUDE.md`.
5. THE SYSTEM SHALL structure `mcp-servers.yaml` so that additional data-access MCP servers (beyond RODA) can be appended as later entries without restructuring the file.
6. WHEN `kanon validate --security` is run against the Artifact THEN THE SYSTEM SHALL NOT flag any credential-like value hardcoded in `mcp-servers.yaml`.

### Requirement 4: Research skills

**User Story:** As a staff or faculty researcher, I want Archimedes Delight to offer discrete skills for common research tasks, so that my AI assistant can guide me through citation and dataset-discovery tasks on demand.

#### Acceptance Criteria

1. THE SYSTEM SHALL define at least one Research_Skill associated with the Artifact, describing a concrete guided research task (e.g. citation formatting/management or dataset-discovery guidance) — literature review and autonomous dataset discovery are excluded from Research_Skill scope and covered instead by their respective Research_Agent sections (Requirement 8).
2. WHERE a Research_Skill is intended to render as a Claude Code plugin skill THEN THE SYSTEM SHALL rely on the Artifact's `type: power` + `claude-code` `harnesses` frontmatter, which `scripts/generate-plugin-skills.ts` already selects (its selector matches `type === "skill" || type === "power"`) — no separate `type: skill` artifact is needed.
3. THE SYSTEM SHALL document each Research_Skill's purpose, expected inputs, and expected outputs in the Artifact's `knowledge.md` body.
4. THE SYSTEM SHALL ensure every documented Research_Skill can be exercised using only the MCP servers and workflows also declared by the Artifact, or explicitly note any external dependency it needs.

### Requirement 5: Research workflows

**User Story:** As a staff or faculty researcher, I want multi-step research procedures captured as workflows, so that I can run a repeatable process (e.g. a dataset-to-citation pipeline) instead of re-deriving the steps each time.

#### Acceptance Criteria

1. THE SYSTEM SHALL provide a `workflows/` directory under the Artifact containing at least one Research_Workflow markdown file.
2. THE SYSTEM SHALL ensure each Research_Workflow file states its trigger/entry condition, its ordered steps, and which MCP servers or skills it relies on.
3. WHEN `loadKnowledgeArtifact()` parses the Artifact THEN THE SYSTEM SHALL successfully load all files under `workflows/` without parse errors.
4. THE SYSTEM SHALL keep each Research_Workflow scoped to a single research procedure rather than combining unrelated procedures in one file.
5. THE SYSTEM SHALL NOT include literature review or autonomous dataset discovery among the Artifact's Research_Workflow files — both are out of scope for `workflows/` and are instead covered by their Research_Agent sections (Requirement 8), since they require autonomous execution rather than human-followed steps.

### Requirement 6: Harness targeting and build compatibility

**User Story:** As a Kanon catalog maintainer, I want Archimedes Delight's harness targets declared accurately, so that `kanon build` produces correct output and any partial-support warnings are expected rather than surprising.

#### Acceptance Criteria

1. THE SYSTEM SHALL declare a `harnesses:` frontmatter list covering at minimum the harness(es) staff and faculty are expected to use Archimedes Delight through (e.g. `claude-code`, and `kiro` if steering/power output is desired).
2. WHEN `kanon build` is run for a harness not declared in `harnesses:` THEN THE SYSTEM SHALL either omit output for that harness or produce it consistent with `src/compatibility.ts`'s declared support level for the Artifact's `type`.
3. IF the Artifact's `type` has only partial or no support on a Target_Harness listed in `harnesses:` THEN `kanon build --strict` SHALL fail with an actionable error, and non-strict `kanon build` SHALL produce a warning rather than silently dropping content.
4. THE SYSTEM SHALL pass `kanon validate` with no errors once the Artifact, its `mcp-servers.yaml`, and its `workflows/*.md` are authored.

### Requirement 7: Literature-search MCP server as a JHU-hosted placeholder

**User Story:** As a Kanon catalog maintainer, I want the literature-search MCP server declared without depending on an unaffiliated third party's personally-hosted service, so that Archimedes Delight's literature-review capability doesn't inherit an unreliability or trust risk it can't control.

#### Acceptance Criteria

1. THE SYSTEM SHALL declare a Literature_Search_MCP_Server entry in `mcp-servers.yaml` using `transport: sse` (or `http`) and a placeholder `url` (e.g. `https://TBD.internal.jh.edu/mcp` or an equivalent clearly-marked-placeholder value) rather than a working third-party-hosted URL.
2. THE SYSTEM SHALL document, in the Artifact's `knowledge.md` body, that no official/institutional remote MCP server exists today for PubMed, arXiv, or Semantic Scholar (confirmed by research during this spec's authoring), and that this entry is a placeholder pending a JHU DRCC-hosted instance.
3. THE SYSTEM SHALL document, alongside the placeholder, at least one concrete candidate implementation the future hosted instance could be based on (e.g. `cyanheads/pubmed-mcp-server`, which supports self-hosting via `transport: http`/`sse`), so a future maintainer standing up the real endpoint has a documented starting point.
4. IF the placeholder `url` is left unresolved THEN `kanon build` (non-strict) SHALL still succeed — a placeholder URL is not a validation failure, only a functional gap flagged in documentation.
5. THE SYSTEM SHALL NOT set `disabled: true` on the Literature_Search_MCP_Server entry solely because it is a placeholder — the requirement is documentation of its placeholder status, not disabling it, since disabling is a separate decision for whoever wires up the real endpoint.

### Requirement 8: Literature review and dataset discovery as autonomous agents

**User Story:** As a staff or faculty researcher, I want literature review and dataset discovery to run as autonomous agents rather than a set of steps I execute myself, so that I can hand off "review the literature on X" or "find datasets about Y" and receive a synthesized result.

#### Acceptance Criteria

1. THE SYSTEM SHALL document the Literature_Review_Agent and the Dataset_Discovery_Agent as their own clearly-delimited sections within the single Artifact's `knowledge.md` body — neither is a separate knowledge artifact directory, consistent with `type` being a single asset-taxonomy tag (ADR-0014) decoupled from output format, and with Kiro's format registry having no distinct `agent` output format (only `steering`/`power`).
2. THE SYSTEM SHALL document, for the Literature_Review_Agent, its autonomous loop (define scope → search via the Literature_Search_MCP_Server → triage/screen results → synthesize findings) and its expected inputs (a research question or topic) and outputs (a synthesized literature summary with citations).
3. THE SYSTEM SHALL document, for the Dataset_Discovery_Agent, its autonomous loop (define scope → search via the RODA_MCP_Server → evaluate candidate datasets → shortlist) and its expected inputs (a research question or dataset criteria) and outputs (a ranked shortlist of candidate datasets).
4. THE SYSTEM SHALL ensure both Research_Agents draw only on MCP servers already declared in the Artifact's own `mcp-servers.yaml` (RODA_MCP_Server, Literature_Search_MCP_Server) — no `depends` frontmatter field or cross-artifact composition is introduced by this requirement.
5. THE SYSTEM SHALL distinguish, in the Artifact's body, each Research_Agent from the human-followed Research_Skill and Research_Workflow content, so a reader can tell which capabilities run autonomously and which require step-by-step human direction.

## Open Questions for Design

- Which specific `awslabs.roda-mcp-server` tools are safe to list in `autoApprove` (read-only search/metadata calls vs. anything mutating or costly) — the confirmed JSON gives command/args/env but not its tool list.
- What each Research_Agent's `knowledge.md` section should say about failure modes when its MCP server is a placeholder not yet resolved to a real endpoint (e.g. the Literature_Search_MCP_Server) versus a working one already available (RODA, for the Dataset_Discovery_Agent) — whether the agent should degrade gracefully or explicitly tell the user the capability isn't wired up yet.
