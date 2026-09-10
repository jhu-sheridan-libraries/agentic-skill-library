# Implementation Plan

## Overview

This plan is a content-collection addition plus one small code addition (registry generation). Content "verification" means validating authored members against the existing, already-tested pipeline (`kanon validate`, `catalog generate`, `build`, `build:skills`), run from `kanon/` via `bun run dev <command>`; the code addition is covered by typecheck/lint, the existing catalog tests, and a YAML-parse check.

Archimedes Delight is a **collection** (see design.md / requirements.md): a namespace container `kanon/knowledge/archimedes-delight/` (no root `knowledge.md`) holding ten members — the `archimedes-delight` router (`type: skill`, Kiro format `power`), two `type: agent` members (`literature-review`, `dataset-discovery`), and seven `type: skill` guided members (`research-ideation`, `critical-appraisal`, `peer-review`, `manuscript-writing`, `citation-management`, `figure-preparation`, `research-presentation`) — plus a metadata-only manifest `collections/archimedes-delight.yaml` and a generated `registry.yaml`. Six of the guided skills are CC-BY-4.0 adaptations from the sibling SciAgent-Skills project. Membership is by each member's `collections: [archimedes-delight]` frontmatter (ADR-0016), following the `byron-powers` precedent.

The whole plan is already implemented on disk; completed items are marked `[x]`. The literature-search wiring is handled by the companion `bibliographic-mcp` spec and is reflected here.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3", "4", "5", "11"] },
    { "id": 3, "tasks": ["12"] },
    { "id": 4, "tasks": ["6"] },
    { "id": 5, "tasks": ["7", "8", "9"] },
    { "id": 6, "tasks": ["10"] }
  ]
}
```

- Wave 0–1: the manifest (1) then the namespace container + router (2).
- Wave 2: the original three capability members (3, 4, 5) and the six SciAgent-adapted members (11) are independent and can be authored in any order.
- Wave 3: the router is updated to route to all nine capability members (12), after the members exist.
- Wave 4: validation (6) gates the verification tasks.
- Wave 5: catalog/membership + registry generation (7), multi-harness build (8), and plugin-skill regeneration (9) run in parallel.
- Wave 6: the changelog fragment (10) closes out.
- Literature-search MCP wiring (`literature-review/mcp-servers.yaml` → bundled `bibliographic-mcp`) is owned by the `bibliographic-mcp` spec, Task 8 there; it has already landed and is re-validated under Task 6 here.
- Registry generation (Task 13) is a code addition (the one in this spec); it is built before it can be exercised by Task 7.

## Tasks

- [x] 1. Create the collection manifest
  - Create `kanon/collections/archimedes-delight.yaml` as a metadata-only manifest (name, displayName, description, version, author, trust, tags) with no member list, per ADR-0016.
  - _Requirements: 2.2_

- [x] 2. Scaffold the namespace container and router member
  - Ensure `kanon/knowledge/archimedes-delight/` is a **pure container** (no root `knowledge.md`), and create the router member at `kanon/knowledge/archimedes-delight/archimedes-delight/knowledge.md`.
  - Router frontmatter: `name: archimedes-delight`, `type: skill`, `harness-config.kiro.format: power` (ADR-0051 canonical form, no deprecation warning), `author: Steven J. Miklovic`, `harnesses: [kiro, claude-code, codex, copilot, cursor, gemini-cli]`, `collections: [archimedes-delight]`, `depends: [literature-review, dataset-discovery, citation-management]`, `inclusion: manual`.
  - Router body: Overview, Members table, Routing tree (intent → member, RODA-vs-literature, autonomous-vs-guided, human-in-the-loop boundary), Getting Started.
  - Verify: `bun run dev validate` reports no schema errors and no `type: power` deprecation warning for the router.
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 2.1_

- [x] 3. Author the `literature-review` agent member
  - Create `literature-review/knowledge.md` (`type: agent`) with `## Goal` / `## Inputs` / `## Outputs` / `## Autonomous Loop` (each step naming its deliverable) / `## Synthesis Quality` / `## Human-in-the-Loop Boundary` / `## Data Access` / `## Failure Modes`.
  - Triage step includes a source-quality screen (evidence tier, currency, predatory-journal / conflict-of-interest signals).
  - Create `literature-review/mcp-servers.yaml` for the Literature_Search_MCP_Server (initially the placeholder; rewired to the bundled `bibliographic-mcp` server by the `bibliographic-mcp` spec — in-repo build launch, `CROSSREF_POLITE_EMAIL` / `BIBLIOGRAPHIC_MCP_DIR` as `${ENV_VAR}`, `autoApprove: []`).
  - Verify: member validates clean; `## Goal`/`## Inputs`/`## Outputs`/`## Autonomous Loop` satisfy the `agent-should-document-loop` convention.
  - _Requirements: 1.3, 3.4, 3.5, 7.1, 7.2, 7.3, 8.1, 8.2, 8.4, 8.5_

- [x] 4. Author the `dataset-discovery` agent member
  - Create `dataset-discovery/knowledge.md` (`type: agent`) with the same heading set, `## Data Access` in the SciAgent database-skill shape ("when to use RODA" bullets, enumerated operations, RODA-vs-literature routing pointer), the read-only-only `autoApprove` rubric, and a `## Failure Modes` table.
  - Create `dataset-discovery/mcp-servers.yaml` with the `awslabs.roda-mcp-server` stdio entry (`command: uvx`, `args: [awslabs.roda-mcp-server@latest]`, `env: {FASTMCP_LOG_LEVEL: ERROR}`, `autoApprove: []`).
  - Verify: member validates clean; agent-loop convention satisfied; RODA entry parses against the MCP discriminated-union schema.
  - _Requirements: 1.3, 3.1, 3.2, 3.3, 3.5, 8.1, 8.3, 8.4, 8.5_

- [x] 5. Author the `citation-management` skill member and workflow
  - Create `citation-management/knowledge.md` (`type: skill`) in SciAgent's prose-guide shape: Overview, Key Concepts, Decision Framework (ASCII tree + table), Best Practices, Common Pitfalls (each with a "how to avoid"), Workflow, Further Reading, Related Skills.
  - Create `citation-management/workflows/citation-pipeline.md` (Trigger / Depends On / Steps), scoped to the single citation-formatting procedure.
  - Verify: member validates clean; `loadKnowledgeArtifact()` loads the workflow with no parse errors.
  - _Requirements: 1.3, 4.1, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 6. Validate the collection (schema + security)
  - Run `bun run dev validate`: all ten members pass, the router's nine `depends` references resolve to sibling members, the six adapted members' `attribution` blocks parse, and there are no new warnings on the members.
  - Run `bun run dev validate --security`: no credential-like value flagged in any member's `mcp-servers.yaml` (RODA `FASTMCP_LOG_LEVEL` and the `${ENV_VAR}` placeholders are not literals).
  - _Requirements: 3.6, 6.4, 10.6_

- [x] 7. Regenerate the catalog + registry and confirm membership
  - Run `bun run dev catalog generate`; confirm all ten members appear as valid `CatalogEntry` records, and that a bazaar-wide `registry.yaml` is written alongside `catalog.json`.
  - Run `bun run scripts/generate-registry.ts --collection archimedes-delight`; confirm `knowledge/archimedes-delight/registry.yaml` lists all ten members and parses as valid YAML.
  - Confirm `buildCollectionMembership()` output lists all ten under `archimedes-delight`, with no edit to `collections/archimedes-delight.yaml`.
  - _Requirements: 1.6, 2.3, 2.4, 11.1, 11.2, 11.3, 11.6_

- [x] 8. Build for all target harnesses (strict and non-strict)
  - Run `bun run dev build` and `bun run dev build --strict`; confirm every member renders to its declared harnesses with 0 errors. Expected capability-degradation warnings (e.g. `toggleable-rules` omit, `workflows` inline) are informational, not failures.
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 9. Regenerate committed plugin skills
  - Run `bun run build:skills`; confirm the router and all seven guided-skill members generate `skills/<member>/SKILL.md` (eight total for this collection). Note: `literature-review` and `dataset-discovery` are `type: agent`, which the selector (`type === "skill" || type === "power"`) intentionally does not pick up — they do not produce plugin skills, and that is expected.
  - _Requirements: 4.2_

- [x] 11. Author the six SciAgent-adapted guided-skill members _Depends: 2_
  - Create `research-ideation`, `critical-appraisal`, `peer-review`, `manuscript-writing`, `figure-preparation`, and `research-presentation` members (`type: skill`), each domain-neutral (condensed, no life-sciences-specific content) and in SciAgent's prose-guide shape (Overview, Key Concepts, Decision Framework, Best Practices, Common Pitfalls with "how to avoid", Further Reading, Related Skills).
  - Give each an `attribution` block: `upstream[].{work, authors, license: CC-BY-4.0, url, relationship: adapted}` + a `notice`, and `collections: [archimedes-delight]`.
  - Fold overlapping SciAgent `citation-management` / `literature-review` content into the existing same-named members rather than duplicating; exclude the DB-client skills (covered by `bibliographic-mcp`); consolidate the journal figure guides into `figure-preparation`.
  - Verify: each member validates clean; `attribution` parses.
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 12. Update the router to route to all nine capability members _Depends: 3, 4, 5, 11_
  - Update the router `knowledge.md`: `depends` lists all nine capability members; the Members table and routing tree group them by research phase (discover → appraise → create → communicate); bump the router version.
  - Verify: router validates clean; all nine `depends` references resolve.
  - _Requirements: 1.4, 2.1_

- [x] 13. Add registry.yaml generation _Depends: none (code addition)_
  - Add `src/registry.ts` (pure projection: catalog entry → SciAgent-style registry entry; `inferSubType`, `renderBazaarRegistry`, `renderCollectionRegistry`).
  - Add `scripts/generate-registry.ts` (CLI: bazaar-wide default; `--collection <name>` / `--out <path>`), plus a `build:registry` package script.
  - Wire bazaar-wide generation into `catalogCommand` (writes `registry.yaml` alongside `catalog.json`).
  - Verify: `bun x tsc --noEmit` and `biome check` clean on the new files; the existing `src/__tests__/catalog.test.ts` still passes; both generated `registry.yaml` files parse as valid YAML.
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

- [ ] 10. Add a changelog fragment _Depends: 6, 7, 8, 9, 11, 12, 13_
  - Run `bun run changelog:new --type added --message "..."` from `kanon/` describing the expanded `archimedes-delight` collection (router + nine capability members, six adapted from SciAgent-Skills under CC-BY) and the new `registry.yaml` generation bundled with catalog creation.
  - Assess whether an ADR is warranted for the registry-generation code path (a new `src/` module + a `catalogCommand` side effect) and, if so, add one under `kanon/docs/adr/` with the next sequential number and update the ADR index.
  - _Requirements: 1.1, 10.1, 11.1_

## Notes

- **Structure changed from single artifact to collection, then expanded.** An earlier draft scaffolded one `knowledge.md` in the `jh-drcc` collection. The implemented design is a ten-member collection in the `archimedes-delight` collection, following `byron-powers`. Tasks 1–9 and 11–13 reflect the implemented reality and are complete on disk.
- **Router type.** The router is `type: skill` + `harness-config.kiro.format: power` (ADR-0051 canonical), not `type: power` — the deprecated alias raises a validation warning.
- **Agents don't become plugin skills.** `literature-review` and `dataset-discovery` are `type: agent`; `generate-plugin-skills.ts` only emits skills for `type: skill`/`power`. This is expected, not a gap.
- **CC-BY attribution.** The six SciAgent-adapted members each carry an `attribution` block (`relationship: adapted`, `license: CC-BY-4.0`); adaptation is domain-neutral (life-sciences-specific content removed).
- **Registry is generated, not hand-authored.** `registry.yaml` (bazaar-wide and collection-scoped) derives from the catalog via `src/registry.ts`; bazaar-wide generation is bundled into `kanon catalog generate`. This is the one code addition (Task 13).
- **Literature-search wiring lives in the `bibliographic-mcp` spec.** That spec builds the bundled server and owns the `literature-review/mcp-servers.yaml` rewire; the entry has already been staged (in-repo build launch) and re-validates under Task 6 here.
- **Router persona (Requirement 9)** is a separate concurrent thread; its authoring is tracked in that requirement's design subsection, not duplicated as a task here.
- **Only Task 10 (changelog + ADR assessment) remains** to close out this spec.
