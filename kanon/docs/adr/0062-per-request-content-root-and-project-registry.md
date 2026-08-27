# ADR-0062: Per-request content root and cross-project registry for Solr Compass

## Status

Accepted

## Date

2026-08-27

## Context

ADR-0055 replaced Solr Compass's single `pluginRoot` with two explicit roots and defined `contentRoot` resolution as: `SOUK_COMPASS_CONTENT_ROOT`, then `${CLAUDE_PLUGIN_ROOT}/kanon`, then the process working directory or its `kanon/` child. That value is resolved **once at process startup** (`resolveContentRoot()` into the `CONTENT_ROOT` module constant in `index.ts`) and stored on `ToolContext.contentRoot`. Every artifact tool (`compass_index_artifacts`, `compass_reindex`, and `compass_search --includeContent`) reads the catalog from that one frozen path.

Two problems followed from a startup-frozen, single-valued content root:

1. **User-global servers serve many projects.** Solr Compass is commonly configured once in `~/.kiro/settings/mcp.json` and shared across every workspace the user opens. A startup-frozen root pins the server to whichever directory it happened to launch in. In practice, with no `SOUK_COMPASS_CONTENT_ROOT` and no `CLAUDE_PLUGIN_ROOT`, resolution fell to `<cwd>/kanon`, which for most launch working directories is a path with no `catalog.json`.

2. **The failure was illegible.** `loadCatalog()` did a bare `readFile` of `catalog.json`; a missing file surfaced as an unhandled `ENOENT` that the tool layer reported only as "An unexpected error occurred." An operator could not tell that the problem was content-root resolution. By contrast, the codebase tools (`compass_index_folder`, `compass_search_codebase`) already took an explicit `path`/`root` per request and worked fine — the artifact tools were the outlier in having no per-request escape hatch.

Hardcoding `SOUK_COMPASS_CONTENT_ROOT` to one repo in the user-global config was rejected: it would break artifact indexing for every other project the shared server sees.

## Decision

Make the content root a **per-request** concern for the artifact tools, and add a **cross-project registry** so one server can address many projects by name. Two tiers:

**Tier 2 — per-request content root.** `compass_index_artifacts`, `compass_search`, and `compass_reindex` gain an optional `contentRoot` argument. A new pure resolver, `resolveRequestContentRoot(selector, fallback, registry?)` in `catalog-reader.ts`, resolves the effective root with precedence: explicit `contentRoot` > registered `project` (tier 3) > `fallback` (the startup `ctx.contentRoot`). When a request names neither, behavior is identical to before, so this is backward compatible. `loadCatalog()` now throws `SoukCompassError(CONTENT_ROOT_INVALID)` naming the resolved path and the ways to set it, instead of leaking `ENOENT`; the reindex handler surfaces that code as a legible tool result rather than rethrowing.

**Tier 3 — project registry.** A new `project-registry.ts` reads an optional `~/.solrcompass/projects.json` of shape `{ "projects": { "<name>": "<contentRoot>" } }` (directory overridable via `SOUK_COMPASS_REGISTRY_DIR`). The three artifact tools accept an optional `project` name resolved against this registry. A missing/unreadable registry is treated as no registered projects (not an error); a present-but-malformed registry throws so corruption is visible. An unknown `project` name throws `CONTENT_ROOT_INVALID` and lists the known names.

The content root itself stays in each repo. `~/.solrcompass` holds only the *registry* (a name→root map), consistent with it already holding derived state such as the embed cache. Codebase tools are unchanged — they already resolve roots per request.

## Consequences

### Positive

- One user-global Solr Compass server can index and search any registered project by name, or any directory by explicit path, without a per-project MCP config or a startup restart.
- The most common misconfiguration (content root not pointing at a Kanon dir) now produces a legible, actionable error instead of "An unexpected error occurred."
- Backward compatible: omitting both `contentRoot` and `project` preserves ADR-0055 startup resolution exactly.
- Resolution precedence lives in one pure, unit-tested function shared by all three tools.

### Negative / Trade-offs

- Three ways to select a content root (explicit path, project name, startup default) is more surface than one frozen value; mitigated by a single documented precedence order and a clear error on an unknown project.
- The registry is a new user-global file to maintain. It is optional and additive — nothing requires it.

### Neutral

- No change to embeddings, Solr schema, collection names, or the codebase tools.
- `ToolContext.contentRoot` remains as the fallback; the startup resolver from ADR-0055 is untouched.

## Links and References

- Builds on: [ADR-0055](./0055-publish-solr-compass-as-a-bun-npm-package.md) — introduced `contentRoot` and its startup resolution order, which this ADR extends to per-request plus a registry.
- Relates to: [ADR-0031](./0031-souk-compass-standalone-mcp-server-for-semantic-search.md) — Solr Compass as a standalone server.
- Implementation: `kanon/mcp-servers/souk-compass/src/project-registry.ts`, `src/catalog-reader.ts` (`resolveRequestContentRoot`, hardened `loadCatalog`), `src/errors.ts` (`CONTENT_ROOT_INVALID`), `src/schemas.ts`, `src/tools/compass-index.ts`, `src/tools/compass-reindex.ts`, `src/tools/compass-search.ts`, `src/index.ts`.
- Tests: `src/__tests__/project-registry.test.ts`, `src/__tests__/catalog-reader.test.ts`.
