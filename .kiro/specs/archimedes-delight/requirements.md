# Requirements Document

## Introduction

Archimedes Delight is a **collection** of knowledge artifacts for the Kanon catalog: an academic research-science skillset aimed at Johns Hopkins staff and faculty engaged in advanced scholarly research. Rather than one monolithic artifact, it is a namespaced collection under `kanon/knowledge/archimedes-delight/` (a pure container directory, no root `knowledge.md`) with a **router** artifact plus focused capability members:

- **`archimedes-delight`** (router; `type: skill`, Kiro format `power`) — the entry point that directs a user or assistant to the right member, across four research phases (discover → appraise → create → communicate).

Discover:
- **`literature-review`** (`type: agent`) — an autonomous literature-review agent.
- **`dataset-discovery`** (`type: agent`) — an autonomous dataset-discovery agent over open-data repositories (starting with RODA).
- **`research-ideation`** (`type: skill`) — a guided divergent-thinking + hypothesis-formulation skill.

Appraise:
- **`critical-appraisal`** (`type: skill`) — a guided evidence-evaluation skill.
- **`peer-review`** (`type: skill`) — a guided manuscript/proposal review skill.

Create:
- **`manuscript-writing`** (`type: skill`) — a guided scholarly-writing skill.
- **`citation-management`** (`type: skill`) — a guided citation-formatting skill with a `citation-pipeline` workflow.
- **`figure-preparation`** (`type: skill`) — a guided figure/schematic preparation skill.

Communicate:
- **`research-presentation`** (`type: skill`) — a guided slides/posters skill.

The six SciAgent-adapted guided skills (`research-ideation`, `critical-appraisal`, `peer-review`, `manuscript-writing`, `figure-preparation`, `research-presentation`) are domain-neutral adaptations of the sibling `SciAgent-Skills` `scientific-writing` set (CC-BY-4.0) and carry an `attribution` block (see Requirement 10).

Membership is declared by each member's own `collections: [archimedes-delight]` frontmatter (per ADR-0016), and the collection is described by a metadata-only manifest at `collections/archimedes-delight.yaml`. This layout follows the `byron-powers` precedent, which is the pipeline's supported namespaced-collection shape (`collectArtifactPaths` descends one level into a container that has no root `knowledge.md`). A generated `registry.yaml` provides a lighter, SciAgent-Skills-style index of the collection (see Requirement 11).

The two autonomous capabilities — literature review and dataset discovery — are authored as their own `type: agent` members. This is a change from the taxonomy reasoning of an earlier single-artifact draft (per ADR-0014, `type` is a taxonomy tag decoupled from output format, and Kiro has no distinct `agent` format): the collection was chosen for **discoverability, independent installation, and correct per-capability typing** — each member is its own `CatalogEntry`, installs on its own, renders as its own plugin skill, and carries a `type` that agent-aware harnesses (Copilot `AGENTS.md`, Q Developer) can render correctly. The router preserves the single-front-door experience via its `depends` list.

No official, institutionally-hosted remote MCP server exists today for PubMed, arXiv, or Semantic Scholar (confirmed by research during this spec's authoring — see Requirement 7). This spec therefore initially treats the literature-search MCP server as a placeholder pending a JHU-hosted instance. A companion spec, `bibliographic-mcp`, defines a deterministic bibliographic MCP server bundled in-repo that replaces this placeholder with a working, self-hostable endpoint (see Requirement 7 and the `bibliographic-mcp` spec).

This spec covers the collection's content authored under `kanon/knowledge/archimedes-delight/` and its manifest under `kanon/collections/` — frontmatter, MCP server declarations, skill/workflow/agent body content, and collection membership — not a change to Kanon's core compiler or schema. Where a capability needed isn't yet supported by the current schema/build pipeline, that gap is called out explicitly as a requirement.

## Glossary

- **Collection**: The `archimedes-delight` collection — a metadata-only manifest at `collections/archimedes-delight.yaml` (ADR-0016) plus every artifact declaring `collections: [archimedes-delight]`. Its members live under the namespace container `kanon/knowledge/archimedes-delight/`.
- **Namespace_Container**: The directory `kanon/knowledge/archimedes-delight/`, which holds one subdirectory per member and has **no** root `knowledge.md`, so the pipeline's one-level discovery (`collectArtifactPaths`) treats each member subdirectory as its own artifact.
- **Router_Artifact**: The `archimedes-delight` member at `kanon/knowledge/archimedes-delight/archimedes-delight/knowledge.md` (`type: skill`, Kiro format `power`) — the collection's entry point, which maps user intent to the correct member and declares `depends: [literature-review, dataset-discovery, citation-management]`.
- **Member**: Any artifact directory under the Namespace_Container containing a `knowledge.md` — one of the Router_Artifact, `literature-review`, `dataset-discovery`, or `citation-management`.
- **RODA_MCP_Server**: The `awslabs.roda-mcp-server` MCP server entry in the `dataset-discovery` member's `mcp-servers.yaml`, launched via `uvx awslabs.roda-mcp-server@latest`, providing data access to RODA (Registry of Open Data on AWS).
- **Literature_Search_MCP_Server**: The MCP server entry in the `literature-review` member's `mcp-servers.yaml` providing search over academic literature. Initially a placeholder (`transport: sse`, placeholder `url`); intended to be pointed at the `bibliographic-mcp` server (or another JHU-hosted endpoint) once available (see Requirement 7).
- **Research_Skill**: A guided (human-in-the-loop) capability member — the `citation-management` member — surfaced to `claude-code` via the plugin skills pipeline (`bun run build:skills`), which selects `type: skill`/`power` members.
- **Research_Workflow**: A file under a member's `workflows/` directory describing a multi-step research procedure a human follows with AI assistance. The only one is `citation-management/workflows/citation-pipeline.md`, distinct from a Research_Agent, which runs its own loop autonomously.
- **Research_Agent**: An autonomous `type: agent` member that runs a define-scope → search → triage/evaluate → synthesize loop against its own MCP server(s) without per-step human direction. This spec defines two: the Literature_Review_Agent and the Dataset_Discovery_Agent (see Requirement 8).
- **Literature_Review_Agent**: The `literature-review` member — search → triage → synthesize against the Literature_Search_MCP_Server, producing a cited summary (see Requirement 8).
- **Dataset_Discovery_Agent**: The `dataset-discovery` member — search → evaluate → shortlist against the RODA_MCP_Server, producing a ranked shortlist of candidate datasets (see Requirement 8).
- **Target_Harness**: Any of the harnesses declared in a member's `harnesses:` frontmatter field that `kanon build` will generate output for (e.g. `kiro`, `claude-code`, `codex`, `copilot`, `cursor`, `gemini-cli`).
- **Router_Persona**: The light-touch, erudite voice applied only to the Router_Artifact's prose — an Archimedes-of-Syracuse classical framing (e.g. a signature greeting, an occasional classical flourish) with occasional wit, layered over the Overview and Getting Started/hand-off prose without altering routing logic, factual content, or the human-in-the-loop boundary.

## Requirements

### Requirement 1: Collection scaffold and member identity

**User Story:** As a Kanon catalog maintainer, I want `archimedes-delight` to exist as a properly-formed collection of knowledge artifacts, so that each member can be parsed, cataloged, and built like every other artifact in the repo.

#### Acceptance Criteria

1. THE SYSTEM SHALL provide a Namespace_Container `kanon/knowledge/archimedes-delight/` with no root `knowledge.md`, holding one member subdirectory per artifact, each with a `knowledge.md` whose YAML frontmatter conforms to `FrontmatterSchema` in `src/schemas.ts`.
2. THE SYSTEM SHALL set the Router_Artifact's frontmatter `name` to `archimedes-delight`, `type` to `skill`, and `harness-config.kiro.format` to `power` (the ADR-0051 canonical form, avoiding the deprecated `type: power` alias) so it presents a Kiro power entry point without raising a deprecation warning.
3. THE SYSTEM SHALL set each Research_Agent member's `type` to `agent` and the `citation-management` member's `type` to `skill`, and SHALL set every member's `author` field consistently (e.g. `Steven J. Miklovic`).
4. THE SYSTEM SHALL populate each member's `description` with a paragraph identifying its purpose, and the Router_Artifact's `description` SHALL identify the collection as an academic research skillset for JHU staff and faculty covering literature review, dataset discovery, and citation management.
5. THE SYSTEM SHALL populate each member's `keywords` with terms supporting catalog discoverability, including at minimum `archimedes-delight` on every member, `roda` on the `dataset-discovery` member, and terms describing each member's research purpose.
6. WHEN `kanon catalog generate` is run after the collection is added THEN THE SYSTEM SHALL include all ten members (the router plus nine capability members) as `CatalogEntry` records in `catalog.json` without validation errors.

### Requirement 2: Collection membership

**User Story:** As a Kanon catalog maintainer, I want the members discoverable as one collection, so that staff and faculty browsing the catalog see them grouped as Archimedes Delight.

#### Acceptance Criteria

1. THE SYSTEM SHALL list `archimedes-delight` in every member's `collections:` frontmatter field.
2. THE SYSTEM SHALL provide a metadata-only manifest `collections/archimedes-delight.yaml` and SHALL NOT require any member list inside it to achieve membership, consistent with ADR-0016.
3. WHEN `buildCollectionMembership()` runs after the collection is added THEN THE SYSTEM SHALL report all ten members under the `archimedes-delight` collection.
4. IF a maintainer removes a member's directory THEN THE SYSTEM SHALL no longer show that member under `archimedes-delight` on the next catalog/collection build, with no manual cleanup of the manifest required.

### Requirement 3: RODA and other data-access MCP servers

**User Story:** As a researcher using Archimedes Delight, I want MCP-backed access to research data sources, so that I can query and retrieve repository/dataset content without leaving my AI assistant.

#### Acceptance Criteria

1. THE SYSTEM SHALL provide an `mcp-servers.yaml` in the `dataset-discovery` member declaring a RODA_MCP_Server entry with `name: awslabs.roda-mcp-server`, `command: uvx`, `args: ["awslabs.roda-mcp-server@latest"]`, and `env: {FASTMCP_LOG_LEVEL: ERROR}`, in the `- name / description / command / args / env / autoApprove` list shape.
2. THE SYSTEM SHALL document, in the `dataset-discovery` member's `knowledge.md`, what the RODA_MCP_Server is for and which operations it exposes (search / metadata retrieval / discovery), written in the SciAgent database-skill shape (a "when to use RODA" list, enumerated operations, and a RODA-vs-literature routing pointer).
3. THE SYSTEM SHALL set `autoApprove` on the RODA_MCP_Server to an explicit list of read-only/safe tool names once known, defaulting to `[]` until a maintainer confirms which tools are safe, and SHALL document the read-only-only rubric (approve only search/metadata/discovery, never mutating or costly tools, confirmed against the installed version).
4. WHERE credentials or endpoint configuration are required to reach a data source THEN THE SYSTEM SHALL reference them via `${ENV_VAR}` placeholders rather than hardcoded values, consistent with the `kanon.config.yaml` / `~/.forge/config.yaml` credential boundary.
5. THE SYSTEM SHALL structure each member's `mcp-servers.yaml` as a flat top-level list so that additional data-access MCP servers can be appended without restructuring the file.
6. WHEN `kanon validate --security` is run against the collection THEN THE SYSTEM SHALL NOT flag any credential-like value hardcoded in any member's `mcp-servers.yaml`.

### Requirement 4: Research skills

**User Story:** As a staff or faculty researcher, I want Archimedes Delight to offer a discrete skill for citation management, so that my AI assistant can guide me through citation tasks on demand.

#### Acceptance Criteria

1. THE SYSTEM SHALL provide the `citation-management` member describing a concrete guided research task (citation formatting/management) — literature review and autonomous dataset discovery are excluded from Research_Skill scope and covered instead by their Research_Agent members (Requirement 8).
2. WHERE a Research_Skill is intended to render as a Claude Code plugin skill THEN THE SYSTEM SHALL rely on the member's `type: skill` (or `power`) + `claude-code` frontmatter, which `scripts/generate-plugin-skills.ts` selects — producing one `skills/citation-management/SKILL.md` per member.
3. THE SYSTEM SHALL document the `citation-management` member's purpose, expected inputs, and expected outputs in its `knowledge.md`, authored in SciAgent's prose-guide shape (Key Concepts, a Decision Framework with an ASCII tree and a table, Best Practices, and Common Pitfalls each with a "how to avoid").
4. THE SYSTEM SHALL ensure the Research_Skill can be exercised using only the workflows/MCP servers the collection declares, or explicitly note any external dependency.

### Requirement 5: Research workflows

**User Story:** As a staff or faculty researcher, I want multi-step research procedures captured as workflows, so that I can run a repeatable process instead of re-deriving the steps each time.

#### Acceptance Criteria

1. THE SYSTEM SHALL provide a `workflows/` directory under the `citation-management` member containing at least one Research_Workflow markdown file (`citation-pipeline.md`).
2. THE SYSTEM SHALL ensure each Research_Workflow file states its trigger/entry condition, its ordered steps, and which MCP servers or skills it relies on.
3. WHEN `loadKnowledgeArtifact()` parses the `citation-management` member THEN THE SYSTEM SHALL successfully load all files under `workflows/` without parse errors.
4. THE SYSTEM SHALL keep each Research_Workflow scoped to a single research procedure rather than combining unrelated procedures in one file.
5. THE SYSTEM SHALL NOT include literature review or autonomous dataset discovery among the Research_Workflow files — both are `type: agent` members (Requirement 8), since they require autonomous execution rather than human-followed steps.

### Requirement 6: Harness targeting and build compatibility

**User Story:** As a Kanon catalog maintainer, I want each member's harness targets declared accurately, so that `kanon build` produces correct output and any partial-support warnings are expected.

#### Acceptance Criteria

1. THE SYSTEM SHALL declare a `harnesses:` frontmatter list on each member covering the harnesses staff and faculty are expected to use (at minimum `kiro` and `claude-code`).
2. WHEN `kanon build` is run for a harness not declared in a member's `harnesses:` THEN THE SYSTEM SHALL either omit output for that harness or produce it consistent with `src/compatibility.ts`'s declared support level for the member's `type`.
3. IF a member's `type` has only partial or no support on a Target_Harness listed in its `harnesses:` THEN `kanon build --strict` SHALL fail with an actionable error, and non-strict `kanon build` SHALL produce a capability-degradation warning rather than silently dropping content.
4. THE SYSTEM SHALL pass `kanon validate` with no errors once every member, its `mcp-servers.yaml`, and its `workflows/*.md` are authored, and the Router_Artifact's `depends` references SHALL resolve to sibling members.

### Requirement 7: Literature-search MCP server (placeholder → bibliographic-mcp)

**User Story:** As a Kanon catalog maintainer, I want the literature-search MCP server declared without depending on an unaffiliated third party's personally-hosted service, so that the literature-review capability doesn't inherit an unreliability or trust risk it can't control.

#### Acceptance Criteria

1. THE SYSTEM SHALL declare a Literature_Search_MCP_Server entry in the `literature-review` member's `mcp-servers.yaml` using `transport: sse` (or `http`) and either a placeholder `url` or a reference to the bundled `bibliographic-mcp` server, rather than a working third-party-hosted URL.
2. THE SYSTEM SHALL document, in the `literature-review` member's `knowledge.md`, that no official/institutional remote MCP server exists today for PubMed, arXiv, or Semantic Scholar (confirmed during this spec's authoring), and that the entry is initially a placeholder pending a JHU-hosted or bundled instance.
3. THE SYSTEM SHALL document, alongside the placeholder, at least one concrete candidate implementation the hosted instance could be based on (e.g. `cyanheads/pubmed-mcp-server`, or the in-repo `bibliographic-mcp` server defined by the companion spec), so a future maintainer has a documented starting point.
4. IF the placeholder `url` is left unresolved THEN `kanon build` (non-strict) SHALL still succeed — a placeholder URL is a functional gap flagged in documentation, not a validation failure.
5. THE SYSTEM SHALL NOT set `disabled: true` on the Literature_Search_MCP_Server entry solely because it is a placeholder.
6. WHEN the `bibliographic-mcp` server is available THEN THE SYSTEM SHALL point the Literature_Search_MCP_Server entry at it (per the wiring defined in the `bibliographic-mcp` spec), replacing the placeholder without any change to the `literature-review` member's agent-loop body content.

### Requirement 8: Literature review and dataset discovery as autonomous agent members

**User Story:** As a staff or faculty researcher, I want literature review and dataset discovery to run as autonomous agents rather than steps I execute myself, so that I can hand off "review the literature on X" or "find datasets about Y" and receive a synthesized result.

#### Acceptance Criteria

1. THE SYSTEM SHALL author the Literature_Review_Agent and the Dataset_Discovery_Agent as their own `type: agent` members within the collection — each a separate artifact directory, consistent with the collection structure and with agent-aware harnesses rendering the `agent` type correctly.
2. THE SYSTEM SHALL document, for the Literature_Review_Agent, its autonomous loop (define scope → search via the Literature_Search_MCP_Server → triage/screen results → synthesize findings) using `## Goal` / `## Inputs` / `## Outputs` / `## Autonomous Loop` headings, with each loop step naming its deliverable, a `## Failure Modes` table, and a triage step that screens for source quality (evidence tier, currency, predatory-journal / conflict-of-interest signals).
3. THE SYSTEM SHALL document, for the Dataset_Discovery_Agent, its autonomous loop (define scope → search via the RODA_MCP_Server → evaluate candidate datasets → shortlist) using the same heading set, with each step naming its deliverable and a `## Failure Modes` table.
4. THE SYSTEM SHALL ensure each Research_Agent draws only on MCP servers declared in its own member's `mcp-servers.yaml` (the Literature_Review_Agent on the Literature_Search_MCP_Server; the Dataset_Discovery_Agent on the RODA_MCP_Server) — no cross-member composition beyond the Router_Artifact's `depends` list is introduced.
5. THE SYSTEM SHALL apply a human-in-the-loop boundary in each Research_Agent's body — the agent triages/synthesizes while the researcher judges/verifies, and never fabricates a source, result, or metadata value to fill a gap — and SHALL keep the Research_Agent members structurally distinct from the guided `citation-management` member.

### Requirement 9: Router persona and voice

**User Story:** As a staff or faculty researcher, I want the Archimedes Delight router to greet me with a little erudite personality, so that the collection's front door feels distinctive and engaging without ever sacrificing precision, routing accuracy, or research honesty.

#### Acceptance Criteria

1. THE Router_Artifact SHALL adopt the Router_Persona — a light-touch, erudite voice with an Archimedes-of-Syracuse classical framing (for example a signature greeting and an occasional classical flourish) with occasional wit — applied to its `## Overview` and `## Getting Started` (hand-off) prose.
2. THE SYSTEM SHALL confine the Router_Persona to the Router_Artifact, and the `literature-review`, `dataset-discovery`, and `citation-management` members SHALL retain their existing neutral, task-focused voice.
3. THE Router_Persona SHALL preserve the Router_Artifact's routing logic, routing tree, members table, and all factual and precision content unchanged.
4. THE Router_Persona SHALL preserve the human-in-the-loop boundary and the never-fabricate rule, so that the router still never fabricates a source, result, or metadata value, and still frames the agents as triaging/synthesizing while the researcher judges and verifies.
5. THE Router_Persona SHALL remain professional and appropriate for Johns Hopkins staff and faculty, without gimmickry that undermines the collection's credibility.
6. THE SYSTEM SHALL implement the Router_Persona as content-only changes to the Router_Artifact's `knowledge.md`, introducing no schema, adapter, or build-pipeline change.

### Requirement 10: SciAgent-adapted research-craft members with attribution

**User Story:** As a Kanon catalog maintainer, I want the imported scholarly-craft skills adapted and attributed correctly, so that the collection gains domain-neutral research-craft coverage while complying with the CC-BY-4.0 license of the source project.

#### Acceptance Criteria

1. THE SYSTEM SHALL provide six guided-skill members adapted from the sibling `SciAgent-Skills` `scientific-writing` set: `research-ideation`, `critical-appraisal`, `peer-review`, `manuscript-writing`, `figure-preparation`, and `research-presentation`.
2. THE SYSTEM SHALL make each such member domain-neutral — condensed and stripped of life-sciences-specific content — so it applies across research disciplines.
3. THE SYSTEM SHALL give each adapted member an `attribution` frontmatter block conforming to `AttributionRecordSchema`, with `upstream[].license: CC-BY-4.0`, `relationship: adapted`, an author/work identifying SciAgent-Skills, and a `notice` recording the adaptation.
4. THE SYSTEM SHALL NOT duplicate SciAgent skills that overlap existing members — `citation-management` and `literature-review` content is folded into the existing same-named members rather than added as new members.
5. THE SYSTEM SHALL exclude SciAgent database-client skills (PubMed/OpenAlex/bioRxiv) from the collection, since the `bibliographic-mcp` server owns that data-access path, and SHALL consolidate the journal-specific figure guides into the single `figure-preparation` member.
6. WHEN `kanon validate` is run THEN THE SYSTEM SHALL report no schema errors for the adapted members, and their `attribution` blocks SHALL parse.

### Requirement 11: Generated registry index

**User Story:** As a Kanon catalog maintainer, I want a generated `registry.yaml` index (bazaar-wide and per-collection), so that the bazaar and the substantial `archimedes-delight` collection each have a lightweight, human-readable, SciAgent-Skills-compatible index derived from the catalog.

#### Acceptance Criteria

1. THE SYSTEM SHALL generate a `registry.yaml` whose entries carry `name`, `type`, `sub_type`, `category`, `path`, `description`, `date_added`, and optional `tags`, derived from the same parsed catalog as `catalog.json` so the two do not drift.
2. THE SYSTEM SHALL bundle bazaar-wide `registry.yaml` generation with catalog creation, so `kanon catalog generate` writes a top-level `registry.yaml` alongside `catalog.json`.
3. THE SYSTEM SHALL provide a collection-scoped generator that writes a collection's own `registry.yaml` (e.g. `knowledge/archimedes-delight/registry.yaml`) containing only that collection's members.
4. WHERE a catalog entry has no `sub_type` field (Kanon has none) THEN THE SYSTEM SHALL infer one from artifact shape: `agent` for `type: agent`, `database` for a member with MCP servers, `pipeline` for a member with workflows, otherwise `guide`.
5. THE SYSTEM SHALL keep the registry projection pure and shared between the bazaar-wide and collection-scoped paths so both produce identical entry shapes, and SHALL treat `catalog.json` as the authoritative index and `registry.yaml` as a derived discovery aid.
6. WHEN either registry is regenerated THEN THE SYSTEM SHALL produce valid YAML with entries sorted deterministically.

## Open Questions for Design

- Which specific `awslabs.roda-mcp-server` tools are safe to list in `autoApprove` — the confirmed JSON gives command/args/env but not its tool list. (Design records the read-only-only rubric as the answer.)
- Whether the `literature-review` member's `mcp-servers.yaml` should ship pointing at the bundled `bibliographic-mcp` server from the outset, or retain the placeholder until that server is built. (Resolved by the wiring requirement 7.6 and the `bibliographic-mcp` spec's rollout ordering.)
