# Archimedes Delight

This directory is a **namespace container**, not a Kanon artifact. It groups independently forgeable research skills and agents under the Archimedes Delight collection.

Kanon ignores this README when forging artifacts. At a namespace root, it discovers only immediate child directories that contain their own `knowledge.md`.

## Purpose

Archimedes Delight supports the research lifecycle from discovery and appraisal through creation and communication. The nested `archimedes-delight/` member is the collection router and front door; the other members can also be installed and used independently.

## Structure

```text
archimedes-delight/
├── README.md                         # Maintainer documentation; not forged
├── registry.yaml                     # Generated collection index
├── archimedes-delight/               # Router skill; rendered as a Kiro power
├── literature-review/                # Autonomous literature-review agent
├── dataset-discovery/                # Autonomous dataset-discovery agent
├── research-ideation/                # Guided research-ideation skill
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

- Artifact content and metadata: each member's `knowledge.md`
- Collection metadata: [`../../collections/archimedes-delight.yaml`](../../collections/archimedes-delight.yaml)
- Collection membership: each member's `collections: [archimedes-delight]` frontmatter
- Architecture and implementation history: [`../../../.kiro/specs/archimedes-delight/`](../../../.kiro/specs/archimedes-delight/)
- Human-readable collection index: `registry.yaml`, which is generated and must not be edited manually

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
