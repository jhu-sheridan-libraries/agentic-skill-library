# Byron Powers

This directory is a **namespace container**, not a Kanon artifact. It groups independently forgeable literary and publishing workflow artifacts.

Kanon ignores this README when forging artifacts. At a namespace root, it discovers only immediate child directories that contain their own `knowledge.md`.

## Purpose

Byron Powers provides workflows for novelists, technical authors, editors, agents, and publicists. Unlike Archimedes Delight, this collection has no collection-level router artifact; users install and invoke its members directly.

## Structure

```text
byron-powers/
├── README.md                          # Maintainer documentation; not forged
├── book-agent-publicist/              # Agent and publicity workflows
├── fantasy-novelist/                  # Fantasy-writing workflows
├── mystery-series-novelist/           # Mystery-series workflows
├── novelist/                          # General long-form fiction workflows
├── proofreader-review-checklist/      # Proofreading and review checklist
├── scifi-novelist/                    # Science-fiction workflows
├── series-continuity/                 # Cross-volume continuity workflows
├── technical-author/                  # Technical-authoring workflows
└── writing-clearly-and-concisely/     # Clear and concise writing guidance
```

Each member is an independent artifact. Its `knowledge.md` defines its canonical content and metadata. Members may also contain:

- `hooks.yaml` for hooks
- `mcp-servers.yaml` for MCP server definitions
- `workflows/` for forgeable workflows and supporting resources
- `body.<harness>.md` for harness-specific body overrides
- `evals/` for evaluation assets, which are not part of the forged artifact body

## Sources of Truth

- Artifact content and metadata: each member's `knowledge.md`
- Collection metadata: [`../../collections/byron-powers.yaml`](../../collections/byron-powers.yaml)
- Collection membership: each member's `collections: [byron-powers]` frontmatter

## Forging Boundary

Keep this directory as a pure namespace container:

- **Do not add a root `knowledge.md`.** Doing so would turn this directory into one flat artifact and prevent Kanon from discovering the member directories.
- Put maintainer-only documentation at this root, where it is not ingested.
- Do not put maintainer-only documentation under a member's `workflows/`; Kanon recursively ingests files there.
- Do not edit generated output in `dist/` or generated plugin skills in `skills/`. Update the canonical member files here and regenerate instead.
