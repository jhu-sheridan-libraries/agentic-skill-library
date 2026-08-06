# Implementation Plan

This is a content-only artifact addition — no changes to `kanon`'s compiler, schema, or adapters. "Verification" throughout means validating the authored content against the existing, already-tested pipeline (`kanon validate`, `catalog generate`, `build`, `build:skills`), run from `kanon/` via `bun run dev <command>`. Tasks are ordered so the artifact parses as early as possible, then accretes content, then is verified end-to-end.

- [ ] 1. Scaffold the artifact directory and frontmatter
  - Create `kanon/knowledge/archimedes-delight/knowledge.md` with the exact frontmatter from design.md (`name: archimedes-delight`, `type: power`, `author: Johns Hopkins DRCC`, `harnesses: [kiro, claude-code]`, `collections: [jh-drcc]`, `maturity: experimental`, `trust: community`, `audience: advanced`, `harness-config.kiro.format: power`, `harness-config.claude-code.format: claude-md`, `depends: []`).
  - Populate `description` and `keywords` (including `jh-drcc`, `roda`) per design.
  - Add a minimal placeholder body (a single `# Archimedes Delight` + `## Overview` stub) so the file parses; full body is Task 4.
  - Verify: `bun run dev validate` reports no schema errors for the new artifact.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1_

- [ ] 2. Author `mcp-servers.yaml` (RODA + literature-search placeholder) _Depends: 1_
  - Create `kanon/knowledge/archimedes-delight/mcp-servers.yaml` with the two entries from design.md: the `awslabs.roda-mcp-server` stdio entry (`command: uvx`, `args: [awslabs.roda-mcp-server@latest]`, `env: {FASTMCP_LOG_LEVEL: ERROR}`, `autoApprove: []`) and the `archimedes-delight-literature-search` URL entry (`transport: sse`, placeholder `url: https://TBD.internal.jh.edu/mcp`, `autoApprove: []`, no `disabled` field).
  - Verify: `bun run dev validate` parses both entries against the discriminated-union MCP schema with no errors.
  - Verify: `bun run dev validate --security` flags no credential-like value, and the placeholder `url` does not itself trigger a security warning.
  - _Requirements: 3.1, 3.3, 3.5, 3.6, 7.1, 7.4, 7.5_

- [ ] 3. Author the `citation-pipeline` workflow file _Depends: 1_
  - Create `kanon/knowledge/archimedes-delight/workflows/citation-pipeline.md` following the design's shared structure (Trigger / Depends On / Steps), scoped to the single citation-formatting procedure.
  - Include an explicit `inclusion: manual` (or `fileMatch`) marker so it isn't treated as always-on (avoids the Kiro progressive-disclosure warning).
  - Verify: `bun run dev validate` loads the workflow file with no parse errors and no "workflow inclusion missing/always" warning.
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 4. Author the full `knowledge.md` body _Depends: 2, 3_
  - [ ] 4.1 Overview + Data Access sections
    - Replace the Task 1 stub with the full Overview, and a `## Data Access` section documenting the RODA MCP Server (purpose + tools, with the note to confirm the tool list before populating `autoApprove`) and the Literature Search MCP Server placeholder (no official PubMed/arXiv/Semantic Scholar remote MCP exists; placeholder pending a JHU DRCC-hosted instance; `cyanheads/pubmed-mcp-server` as documented self-hostable candidate; do not substitute a third-party personal instance).
    - Include the `${ENV_VAR}` credential-boundary guidance for future credentialed data-access servers.
    - _Requirements: 3.2, 3.4, 7.2, 7.3_
  - [ ] 4.2 Research Skills + steering table
    - Add `## Available Steering Files` (listing `citation-pipeline`) and `## Research Skills` documenting Citation Management (purpose, inputs, outputs), exercisable via the artifact's own workflow/MCP servers.
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [ ] 4.3 Autonomous Research Agents section
    - Add a `## Autonomous Research Agents` section, structurally separate from `## Research Skills`, documenting the Literature Review Agent (inputs, outputs, define-scope→search→triage→synthesize loop, plus the "current limitation" note that it must tell the user rather than fabricate when the literature-search endpoint is a placeholder) and the Dataset Discovery Agent (inputs, outputs, define-scope→search→evaluate→shortlist loop against the real RODA server, with the note to rely only on confirmed RODA tools).
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - Verify: `bun run dev validate` still clean after body is complete.

- [ ] 5. Regenerate the catalog and confirm the entry _Depends: 4_
  - Run `bun run dev catalog generate` and confirm `archimedes-delight` appears as a valid `CatalogEntry` in `catalog.json`.
  - Confirm `buildCollectionMembership()` output (via the catalog / `collection_list`) lists `archimedes-delight` under `jh-drcc`, with no edit to `collections/jh-drcc.yaml`.
  - _Requirements: 1.6, 2.2, 2.3_

- [ ] 6. Build for all target harnesses (strict and non-strict) _Depends: 4_
  - Run `bun run dev build` and `bun run dev build --strict`; confirm Kiro output (`POWER.md`, `steering/citation-pipeline.md`, MCP config with both servers) and Claude Code output (CLAUDE.md section including both agent sub-sections) render with no strict-mode errors and only expected `power` partial-support warnings for `claude-code`.
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 7. Regenerate committed plugin skills _Depends: 4_
  - Run `bun run build:skills`; confirm `skills/archimedes-delight/SKILL.md` is generated (selected via `type: power` + `claude-code`) covering the citation skill, the workflow, and both agent sections, and commit the regenerated `skills/` output.
  - _Requirements: 4.2_

- [ ] 8. Add a changelog fragment _Depends: 5, 6, 7_
  - Run `bun run changelog:new --type added --message "..."` describing the new `archimedes-delight` research-library artifact in the `jh-drcc` collection.
  - _Requirements: 1.1_
