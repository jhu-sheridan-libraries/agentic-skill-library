---
inclusion: manual
---

# Citation Pipeline

## Trigger

Apply this workflow when a user has a dataset or paper reference in hand — or a
candidate produced by the Dataset Discovery Agent — and needs a correctly
formatted citation in a specific style.

## Depends On

- **MCP servers:** none required. Works from a dataset or paper reference already
  in hand. When the reference is a RODA dataset, the RODA MCP Server may be used
  to retrieve missing metadata.
- **Skills:** Citation Management.

## Steps

1. **Extract metadata** — pull title, authors, publication date, publisher or
   repository, version, and identifier (DOI/accession) from the reference. For a
   RODA dataset, retrieve any missing fields via the RODA MCP Server.
2. **Select citation style** — confirm the target style with the user (e.g. APA,
   MLA, Chicago, or a dataset-citation style such as DataCite).
3. **Format** — assemble the citation in the selected style.
4. **Verify** — check the formatted citation against the source metadata, and
   flag any fields that could not be populated from the reference.