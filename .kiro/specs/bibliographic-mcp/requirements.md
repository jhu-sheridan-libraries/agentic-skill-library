# Requirements Document

## Introduction

Bibliographic MCP is a deterministic, in-repo Model Context Protocol server that gives the Archimedes Delight `literature-review` agent a real, working literature-search and verification capability — replacing the `sse` placeholder that member currently declares. No official institutionally-hosted remote MCP server exists for PubMed, arXiv, or Semantic Scholar, and the only community-hosted instances found during the archimedes-delight spec's authoring are unaffiliated individuals' personal hosting with no SLA — unsuitable as the backbone of an academic research tool. This spec defines a server the repo owns and can self-host.

The server is **deterministic**: every tool is plain HTTP-over-public-APIs plus string/regex/reducer logic, with no LLM calls. Its capabilities are ported to TypeScript from the deterministic bibliographic tooling in the sibling `academic-research-skills` (ARS) repository — specifically the title-similarity/dedup helper, the Crossref / OpenAlex / arXiv / Semantic Scholar lookup clients, and the retraction-status reducer. The port is a derivative work of ARS, which is **CC-BY-NC-4.0**; that licensing constraint is a first-class requirement (see Requirement 8), not an afterthought.

The server is bundled in-repo under `kanon/mcp-servers/bibliographic-mcp/`, following the existing `souk-compass` precedent: a Bun + TypeScript MCP server with its own `package.json`, a compiled bridge entrypoint, `zod` schemas, and per-tool source files. It is wired into Archimedes Delight by pointing the `literature-review` member's `mcp-servers.yaml` entry at it, satisfying `archimedes-delight` Requirement 7.6. It does not change Kanon's compiler, catalog, or schema.

## Glossary

- **Bibliographic_MCP_Server**: The MCP server defined by this spec, bundled at `kanon/mcp-servers/bibliographic-mcp/`, exposing deterministic literature-search and verification tools over stdio (and optionally SSE/HTTP for remote hosting).
- **Bibliographic_Source**: A public bibliographic API the server queries — Crossref, OpenAlex, arXiv, or Semantic Scholar.
- **Source_Client**: A TypeScript client for one Bibliographic_Source implementing DOI-first lookup with title cross-check, title-similarity fallback, request throttling, bounded retry with backoff, and graceful degradation (a transient failure yields a typed "degraded" result, never a crash).
- **Title_Similarity**: The deterministic title-normalization-plus-ratio helper ported from ARS `_text_similarity.py` — case/punctuation normalization, a dotted-acronym pre-pass, CJK-aware normalization, an exact-normalized-title identity check, a generic-title screen, and a similarity ratio compared against a `0.70` match threshold.
- **Ratcliff_Obershelp**: The Ratcliff/Obershelp string-similarity algorithm that Python's `difflib.SequenceMatcher.ratio()` implements and that ARS's `0.70` threshold is calibrated against; the TypeScript port must reproduce this ratio (not a substitute metric such as Levenshtein).
- **Retraction_Reducer**: The deterministic reducer ported from ARS `retraction_status.py` — it consumes already-fetched OpenAlex/Crossref metadata and reconciles a retraction verdict (`retracted` / `not_retracted` / `reinstated` / `disputed` / `unknown`) with no network I/O of its own.
- **MCP_Tool**: A tool the server exposes to an AI assistant via the MCP protocol (e.g. `search_literature`, `resolve_doi`, `check_retraction`).
- **Degraded_Result**: A typed result a Source_Client returns when a Bibliographic_Source is unavailable (timeout, 5xx, malformed body, exhausted retries) — the tool reports the degradation to the caller rather than throwing or fabricating.
- **Literature_Review_Member**: The `literature-review` artifact of the `archimedes-delight` collection, whose `mcp-servers.yaml` this spec rewires to the Bibliographic_MCP_Server.
- **Souk_Compass_Precedent**: The existing bundled MCP server at `kanon/mcp-servers/souk-compass/`, whose package/bridge/tool/schema layout this server mirrors.
- **Polite_Pool**: The etiquette by which Crossref/OpenAlex grant higher rate limits when a contact email is supplied (in the `User-Agent` header for Crossref, a `mailto` param for OpenAlex), configured via `${ENV_VAR}` and never hardcoded.

## Requirements

### Requirement 1: Bundled MCP server scaffold

**User Story:** As a Kanon maintainer, I want the bibliographic server to live in-repo like Souk Compass, so that it is versioned, testable, and self-hostable without depending on any third party's service.

#### Acceptance Criteria

1. THE SYSTEM SHALL provide a directory `kanon/mcp-servers/bibliographic-mcp/` containing a `package.json` (Bun + TypeScript, `type: module`), a `tsconfig.json`, a `src/` tree, and a compiled bridge entrypoint referenced by the `bin` field, mirroring the Souk_Compass_Precedent.
2. THE SYSTEM SHALL declare the server's dependencies as the MCP SDK (`@modelcontextprotocol/sdk`) and `zod`, with no dependency requiring network access at install time beyond the standard registry.
3. THE SYSTEM SHALL expose the server over MCP stdio transport by default, and SHALL allow optional SSE/HTTP transport for remote self-hosting behind a JHU-controlled endpoint.
4. THE SYSTEM SHALL provide a `bun test` script and unit tests, and SHALL pass `bun x tsc --noEmit` and `biome check`.
5. THE SYSTEM SHALL NOT modify Kanon's `src/`, catalog, schema, or adapters — it is a standalone bundled server, consistent with how Souk Compass is packaged.

### Requirement 2: Deterministic title similarity and dedup

**User Story:** As the literature-review agent, I want deterministic title matching and deduplication, so that my search/triage steps can resolve the same paper across sources and drop duplicates without guessing.

#### Acceptance Criteria

1. THE SYSTEM SHALL provide a Title_Similarity module porting ARS `_text_similarity.py` behavior: base normalization (lowercase, punctuation→whitespace, whitespace collapse), a dotted-acronym pre-pass (`R.A.G.` → `RAG`), CJK-aware normalization, an `exactNormalizedTitle` identity check, a `genericTitle` closed-set screen, and a `similarity` ratio.
2. THE SYSTEM SHALL compute the similarity ratio using a Ratcliff_Obershelp implementation that reproduces Python `difflib.SequenceMatcher.ratio()` values, so the ARS-calibrated `0.70` match threshold remains valid.
3. WHEN two titles differ only by punctuation, case, dotted-acronym spelling, or CJK typesetting variants THEN THE SYSTEM SHALL treat them as matching per the ported rules.
4. THE SYSTEM SHALL provide a dedup operation over a candidate result set that collapses records resolving to the same DOI or the same normalized title.
5. THE SYSTEM SHALL include unit tests that pin the ported similarity/identity/generic-title behavior against representative fixtures, including at least one dotted-acronym and one CJK case.

### Requirement 3: Bibliographic source clients

**User Story:** As the literature-review agent, I want to search and resolve papers across public bibliographic sources, so that my search step returns real candidate results instead of a placeholder.

#### Acceptance Criteria

1. THE SYSTEM SHALL provide Source_Clients for at least Crossref and OpenAlex, and SHALL be structured so arXiv and Semantic Scholar clients can be added without changing the tool layer.
2. THE SYSTEM SHALL implement, per Source_Client, DOI-first lookup with a mandatory Title_Similarity cross-check at the `0.70` threshold (returning a match only when the resolved title passes), plus a title-search fallback.
3. THE SYSTEM SHALL throttle requests per client to respect each source's rate limits, and SHALL retry on HTTP 429 with bounded backoff, treating exhausted retries as a Degraded_Result.
4. WHEN a Bibliographic_Source returns a 404 THEN THE SYSTEM SHALL treat it as a miss (no result), and WHEN it returns a 5xx, a network error, a timeout, or a malformed body THEN THE SYSTEM SHALL return a Degraded_Result rather than throwing.
5. THE SYSTEM SHALL support Polite_Pool configuration via `${ENV_VAR}` (a contact email placed in the `User-Agent` for Crossref and as a `mailto` for OpenAlex), and SHALL NOT hardcode any email or credential.
6. THE SYSTEM SHALL restrict each client to its source's HTTPS host and SHALL redact any query string (which may carry the polite-pool email) from error messages and logs.

### Requirement 4: Retraction and source-quality signals

**User Story:** As the literature-review agent, I want a deterministic retraction check, so that my triage step's source-quality screen can flag retracted works instead of relying on the model's memory.

#### Acceptance Criteria

1. THE SYSTEM SHALL provide a Retraction_Reducer porting ARS `retraction_status.py` behavior: given already-fetched OpenAlex/Crossref metadata for a DOI, reconcile a verdict of `retracted`, `not_retracted`, `reinstated`, `disputed`, or `unknown` with no network I/O inside the reducer.
2. THE SYSTEM SHALL expose the retraction check as an MCP tool that fetches the needed metadata via the Source_Clients and then runs the reducer, returning the verdict plus its supporting observations and resolver agreement.
3. WHEN the resolvers disagree in a way that cannot be reconciled THEN THE SYSTEM SHALL return `disputed` rather than picking one arbitrarily, and WHEN no resolver can be reached THEN THE SYSTEM SHALL return `unknown` with a degradation note.
4. THE SYSTEM SHALL treat the retraction verdict as advisory data returned to the agent; it SHALL NOT itself decide whether citing a retracted work is legitimate.

### Requirement 5: MCP tool surface

**User Story:** As the literature-review agent, I want a small, well-typed set of tools, so that my define-scope → search → triage → synthesize loop can call them directly.

#### Acceptance Criteria

1. THE SYSTEM SHALL expose at minimum these MCP tools with `zod`-validated inputs and outputs: `search_literature` (query → deduplicated candidate list), `resolve_doi` (DOI + expected title → verified record or miss), and `check_retraction` (DOI → retraction verdict).
2. THE SYSTEM SHALL return every tool result as structured, typed data including a per-source status field so the agent can distinguish a real empty result from a Degraded_Result.
3. THE SYSTEM SHALL document each tool's name, purpose, inputs, and outputs in the server's `README.md`.
4. THE SYSTEM SHALL name and shape the tools so the `literature-review` member's documented loop can consume them without the agent needing to know source-specific details.
5. THE SYSTEM SHALL NOT expose any tool that mutates external state — every tool is read-only search/lookup, consistent with the read-only-only `autoApprove` rubric in the `archimedes-delight` spec.

### Requirement 6: Wiring into Archimedes Delight

**User Story:** As a Kanon maintainer, I want the server wired into the literature-review agent, so that installing Archimedes Delight yields a working literature-search capability.

#### Acceptance Criteria

1. THE SYSTEM SHALL update the Literature_Review_Member's `mcp-servers.yaml` to declare the Bibliographic_MCP_Server (a stdio entry launching the bundled server, e.g. via its `bin`, or an SSE/HTTP entry pointing at a self-hosted endpoint), replacing the current placeholder entry.
2. THE SYSTEM SHALL set the Bibliographic_MCP_Server entry's `autoApprove` consistent with the read-only-only rubric — the read-only search/lookup tools may be listed once confirmed, defaulting to `[]`.
3. THE SYSTEM SHALL keep the `literature-review` member's agent-loop body content unchanged in structure when the wiring lands (satisfying `archimedes-delight` Requirement 7.6), updating only the Data Access section's "current limitation" note to reflect that a working server is now available.
4. WHEN `kanon validate` is run after wiring THEN THE SYSTEM SHALL parse the updated `mcp-servers.yaml` against the discriminated-union MCP schema with no errors.
5. WHEN `kanon validate --security` is run after wiring THEN THE SYSTEM SHALL NOT flag any credential-like value in the updated `mcp-servers.yaml` (the polite-pool email is an `${ENV_VAR}`, not a literal).

### Requirement 7: Configuration and credential boundary

**User Story:** As a Kanon maintainer, I want configuration to follow the repo's credential boundary, so that no secrets are committed and self-hosting is straightforward.

#### Acceptance Criteria

1. THE SYSTEM SHALL read all environment-specific configuration (polite-pool email, optional API keys for sources that support them, transport/port for remote hosting) from environment variables with sensible defaults, following the Souk_Compass_Precedent's config pattern.
2. THE SYSTEM SHALL function with zero configuration in an anonymous mode (public APIs, lower rate limits) so it works out of the box for local stdio use.
3. THE SYSTEM SHALL reference any credential via `${ENV_VAR}` in the Archimedes Delight `mcp-servers.yaml` entry rather than a literal value.
4. THE SYSTEM SHALL NOT write any secret to disk or logs.

### Requirement 8: Attribution and licensing (ARS derivative work)

**User Story:** As a Kanon maintainer operating in an academic (non-commercial) research computing environment, I want the ARS derivation handled correctly, so that the bundled server complies with ARS's CC-BY-NC-4.0 license and the repo's attribution conventions.

**Context — academic, non-commercial use.** This server is built for and used in an academic computing environment (Johns Hopkins faculty/staff research), which is **NonCommercial** use as CC-BY-NC-4.0 defines it (§1.i: "not primarily intended for or directed towards commercial advantage or monetary compensation"). The license **expressly grants** producing and Sharing Adapted Material — including a TypeScript port — for NonCommercial purposes (§2.a.1.b). So the port itself is permitted; the obligations that remain are **attribution** (§3.a, triggered whenever the material is Shared) and **NC-compatible downstream licensing** (§3.a.4). The confirmed licensor is **Cheng-I Wu, © 2026**.

#### Acceptance Criteria

1. THE SYSTEM SHALL record, in the server's `README.md` and a `NOTICE` file, that the deterministic bibliographic logic is an adaptation of `academic-research-skills` (© 2026 Cheng-I Wu, CC-BY-NC-4.0), satisfying the §3.a attribution conditions: creator identification, copyright notice, a notice referring to the license, the warranty-disclaimer notice, a link to the licensed material, and an explicit indication that the material was modified (ported to TypeScript).
2. THE SYSTEM SHALL license the port under terms that do not prevent downstream recipients from complying with CC-BY-NC-4.0 (§3.a.4) — i.e. an NC-compatible license (CC-BY-NC-4.0 itself, or a compatible non-commercial term) — and SHALL NOT relabel the ported logic as permissively-licensed (e.g. MIT) in a way that would authorize the commercial use the NC term forbids.
3. THE SYSTEM SHALL keep the server's use within the NonCommercial scope. WHERE the server would be distributed through a channel that is primarily for commercial advantage or monetary compensation (for example, bundling into a commercially-sold product) THEN THE SYSTEM SHALL either keep the ported logic out of that channel (in-repo / self-host / academic distribution only) or re-derive the affected logic from a differently-licensed source, rather than redistributing it under conflicting terms.
4. WHERE the server is made available to the public as an installable package (for example, publishing to a public registry) THEN THE SYSTEM SHALL treat that as Sharing under §1.j and carry the full §3.a attribution with it, and SHALL confirm the chosen distribution does not impose terms that conflict with the NC condition.
5. THE SYSTEM SHALL preserve the ARS calibration rationale (e.g. the `0.70` threshold provenance) in code comments so the derivation and its constraints are traceable.

## Open Questions for Design

- Should the server ship pointing the `literature-review` member at a **stdio** launch of the bundled server (works out of the box, per-user process) or an **SSE/HTTP** self-hosted endpoint (shared, JHU-controlled) by default? Design should pick the default and document how to switch.
- Which additional sources beyond Crossref + OpenAlex are worth porting first (arXiv for preprints, Semantic Scholar for citation graph) given each adds a client but shares the Title_Similarity core?
- Is a faithful Ratcliff/Obershelp port available as a vetted npm package, or must it be implemented in-repo to guarantee `difflib` parity for the `0.70` threshold? Design should resolve the parity risk explicitly.
- Does the CC-BY-NC-4.0 term block bundling the server in a Kanon release that is distributed commercially, and if so what is the mitigation (self-host-only, or clean-room re-derivation of the similarity/retraction logic)?
