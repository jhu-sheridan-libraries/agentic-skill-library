# ADR-0037: Features Filter Replaces Format Filter in Browse UI

## Status

Accepted

## Date

2026-05-11

## Context

The catalog browse UI had a "Format" filter (claude-md, instructions, power, rule, steering) that was largely redundant with the Harness filter. Most harnesses have exactly one format, so selecting a harness already implied the format. The Format filter answered a question users weren't asking ("what file format does this compile to?") rather than a useful discovery question.

The catalog entry schema (`CatalogEntrySchema`) included `formatByHarness` but no computed metadata about what an artifact *does* — whether it has hooks, MCP servers, workflows, or conditional inclusion. This information existed in the parsed `KnowledgeArtifact` but was discarded during catalog generation.

## Decision

Replace the Format filter with a Features filter that exposes orthogonal, actionable dimensions derived from artifact content:

1. **Schema extension**: Add a `features` object to `CatalogEntrySchema` with boolean fields: `hooks`, `mcp`, `workflows`, `conditionalInclusion`.

2. **Catalog generation**: Populate features at generation time from the parsed artifact:
   - `hooks`: `artifact.hooks.length > 0`
   - `mcp`: `artifact.mcpServers.length > 0`
   - `workflows`: `artifact.workflows.length > 0`
   - `conditionalInclusion`: `frontmatter.inclusion === "fileMatch" || "manual"`

3. **Browse UI**: Replace `format-filter` div and `populateFormatFilter()` with `features-filter` div and `populateFeaturesFilter()`. Only features present in the current catalog are shown as checkboxes.

4. **Filtering logic**: Features filter uses OR semantics (artifact matches if it has *any* of the selected features), consistent with the Harness filter behavior.

The `formatByHarness` field remains in the catalog entry and is still displayed in the artifact detail view's "Targets" section — it's useful context when viewing a specific artifact, just not useful as a filter dimension.

## Consequences

### Positive

- Users can filter by what artifacts *do* (has hooks, has MCP) rather than an implementation detail (format)
- Features are orthogonal to Harness and Category — they add genuine filtering power
- Computed at generation time from existing data — no new authoring burden on artifact creators
- Only features that exist in the catalog appear as checkboxes — no empty/useless options

### Negative

- The `features` object adds ~50 bytes per catalog entry to `catalog.json`
- If new feature dimensions are added later, the schema must be extended and catalog regenerated

### Neutral

- `formatByHarness` remains in the schema and detail view — no breaking change to existing consumers
- The static export embeds features data alongside catalog data (no additional fetch needed)
