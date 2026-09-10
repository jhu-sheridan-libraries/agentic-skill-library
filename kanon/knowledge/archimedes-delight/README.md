# Archimedes Delight

This directory is a **namespace container**, not a Kanon artifact. It groups independently forgeable research skills and agents under the Archimedes Delight collection.

Kanon ignores this README when forging artifacts. At a namespace root, it discovers only immediate child directories that contain their own `knowledge.md`.

## Purpose

Archimedes Delight supports the research lifecycle from discovery and appraisal through creation and communication. The nested [`archimedes-delight/`](./archimedes-delight/knowledge.md) member is the collection router and front door; the other members can also be installed and used independently.

## Members

The collection has a router plus eleven capability members, grouped by the four research phases the [router](./archimedes-delight/knowledge.md) uses to sequence work.

### Router

| Member | Kind | Role |
|---|---|---|
| [`archimedes-delight`](./archimedes-delight/knowledge.md) | Router skill (Kiro power) | Front door — maps a user's intent to the right member and hands off. |

### Discover

| Member | Kind | Use it when you want to… |
|---|---|---|
| [`literature-review`](./literature-review/knowledge.md) | Autonomous agent | Hand off "review the literature on X" and receive a synthesized, cited summary. |
| [`dataset-discovery`](./dataset-discovery/knowledge.md) | Autonomous agent | Hand off "find datasets about Y" and receive a ranked shortlist from open-data repositories. |
| [`evidence-synthesis`](./evidence-synthesis/knowledge.md) | Autonomous agent | Hand off a screened source set and receive an integrated synthesis — literature matrix, convergence/divergence, contradiction-resolution table, gap taxonomy. |
| [`research-ideation`](./research-ideation/knowledge.md) | Guided skill | Generate ideas (SCAMPER, TRIZ, morphological analysis) and turn observations into testable, falsifiable hypotheses. |
| [`methodology-design`](./methodology-design/knowledge.md) | Guided skill | Design the study — let the question drive the paradigm, method, data strategy, validity criteria, reporting guideline, and preregistration plan. |

### Appraise

| Member | Kind | Use it when you want to… |
|---|---|---|
| [`critical-appraisal`](./critical-appraisal/knowledge.md) | Guided skill | Judge whether a study's design and analysis support its claims — evidence hierarchy, effect sizes, bias, GRADE. |
| [`peer-review`](./peer-review/knowledge.md) | Guided skill | Run a structured review of a manuscript or proposal and produce an actionable report. |

### Create

| Member | Kind | Use it when you want to… |
|---|---|---|
| [`manuscript-writing`](./manuscript-writing/knowledge.md) | Guided skill | Structure and write a paper — IMRAD, reporting guidelines, venue adaptation, revision protocol. |
| [`citation-management`](./citation-management/knowledge.md) | Guided skill | Turn a dataset or paper reference into a correctly formatted citation, step by step. |
| [`figure-preparation`](./figure-preparation/knowledge.md) | Guided skill | Prepare publication figures and schematics — QA checklist, journal requirements, accessibility. |

### Communicate

| Member | Kind | Use it when you want to… |
|---|---|---|
| [`research-presentation`](./research-presentation/knowledge.md) | Guided skill | Build a conference talk or poster — narrative, slide/poster design, timing, QA. |

## Structure

```text
archimedes-delight/
├── README.md                         # Maintainer documentation; not forged
├── registry.yaml                     # Generated collection index
├── archimedes-delight/               # Router skill; rendered as a Kiro power
├── literature-review/                # Autonomous literature-review agent
├── dataset-discovery/                # Autonomous dataset-discovery agent
├── evidence-synthesis/               # Autonomous cross-source synthesis agent
├── research-ideation/                # Guided research-ideation skill
├── methodology-design/               # Guided study-design skill
├── critical-appraisal/               # Guided evidence-appraisal skill
├── peer-review/                      # Guided manuscript and proposal review
├── manuscript-writing/               # Guided scholarly-writing skill
├── citation-management/              # Citation skill and pipeline workflow
├── figure-preparation/               # Guided publication-figure skill
└── research-presentation/            # Guided slide and poster skill
```

Each member is an independent artifact. Its `knowledge.md` defines its canonical content and metadata. A member may also contain:

- `hooks.yaml` for hooks
- `mcp-servers.yaml` for MCP server definitions
- `workflows/` for forgeable workflows and supporting resources
- `body.<harness>.md` for harness-specific body overrides

## Sources of Truth

- Artifact content and metadata: each member's `knowledge.md` (linked in [Members](#members) above)
- Collection metadata: [`../../collections/archimedes-delight.yaml`](../../collections/archimedes-delight.yaml)
- Collection membership: each member's `collections: [archimedes-delight]` frontmatter
- Architecture and implementation history: [`../../../.kiro/specs/archimedes-delight/`](../../../.kiro/specs/archimedes-delight/)
- Design decision for the two synthesis/methodology members: [`../../docs/adr/0073-harvest-pipeline-agent-substance-into-router-dispatched-members.md`](../../docs/adr/0073-harvest-pipeline-agent-substance-into-router-dispatched-members.md)
- Deterministic structural gate: [`../../src/__tests__/archimedes-delight-structure.test.ts`](../../src/__tests__/archimedes-delight-structure.test.ts)
- Human-readable collection index: [`registry.yaml`](./registry.yaml), which is generated and must not be edited manually

Regenerate the collection index from `kanon/` with:

```bash
bun run scripts/generate-registry.ts --collection archimedes-delight
```

## Forging Boundary

Keep this directory as a pure namespace container:

- **Do not add a root `knowledge.md`.** Doing so would turn this directory into one flat artifact and prevent Kanon from discovering the member directories.
- Put maintainer-only documentation at this root, where it is not ingested.
- Do not put maintainer-only documentation under a member's `workflows/`; Kanon recursively ingests files there.
- Do not edit generated output in `dist/` or generated plugin skills in `skills/`. Update the canonical member files here and regenerate instead.
