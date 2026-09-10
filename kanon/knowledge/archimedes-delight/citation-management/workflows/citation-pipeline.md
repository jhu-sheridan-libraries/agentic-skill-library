# Citation Pipeline

## Trigger

Use this workflow when the user has a dataset or paper reference — one they
already hold, or one produced by `dataset-discovery` or `literature-review` — and
needs it turned into a correctly formatted citation.

## Depends On

- **MCP servers:** none. The workflow operates on a reference already in hand.
- **Skills:** Citation Management (this member's `knowledge.md`).

## Steps

1. **Extract metadata.** Pull the citable fields from the reference: authors,
   year, title, container/venue or repository, and identifier (DOI or accession).
   For datasets, also capture version and access date. Mark any missing field as
   unknown — do not guess it.
2. **Select citation style.** If the target venue specifies a style, use it.
   Otherwise use the field's default. Confirm the choice with the researcher.
3. **Format.** Produce the citation in the chosen style. For datasets, include
   publisher, version, and access date; for papers, include the DOI when available.
4. **Verify.** Check the formatted citation against the style's rules and confirm
   every required field is present and resolvable. Surface the result to the
   researcher for approval; if a required field is still unknown, report the gap
   rather than emitting an incomplete-but-polished citation.
