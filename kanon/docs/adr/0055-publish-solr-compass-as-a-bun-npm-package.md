# ADR-0055: Publish Solr Compass as a Bun npm Package with Independent Roots

## Status

Accepted

## Date

2026-08-06

## Context

ADR-0031 established Solr Compass as an independently versioned MCP server, but its launch path still assumed a context-bazaar source checkout. The server also used one `pluginRoot` value for two unrelated concerns: locating bundled Docker Compose/configset assets and locating a Kanon `catalog.json` plus `knowledge/` tree. That coupling does not hold after installation from npm because package assets live in Bun's package cache while catalog content, when present, belongs to the user's workspace or plugin installation.

The Kiro Power needs a reproducible launch command with no absolute source path. First-run setup must continue to pull official images and provision SolrCloud collections without requiring users to find package-cache files or run lower-level Docker commands.

## Decision

Publish the server as the public Bun package `@stevenjmiklovic/solrcompass`, beginning at package version `0.1.0`, with an executable `solrcompass` bin backed by a Bun-targeted ESM bundle.

Kiro launches an exact package version with:

```text
bunx --bun @stevenjmiklovic/solrcompass@0.1.0
```

The npm package version and the canonical knowledge-artifact version are independent release surfaces. A package release is prepared and validated from `kanon/mcp-servers/souk-compass/`; actual `npm publish` remains an explicit authenticated release action rather than part of Kanon's artifact/GitHub-release publisher.

Replace `pluginRoot` with two explicit roots:

- `packageRoot` is derived from the running module's `import.meta.url` and owns `docker-compose.yml` plus `solr/configset/`.
- `contentRoot` owns `catalog.json` and `knowledge/`. It resolves from `SOUK_COMPASS_CONTENT_ROOT`, then `${CLAUDE_PLUGIN_ROOT}/kanon`, then the process working directory or its `kanon/` child.

`compass_setup initialize` runs Docker Compose from `packageRoot`, preserving one-call image acquisition, configset upload, collection creation, and readiness verification. Compose uses the verified official patch tags `solr:10.0.0` and `zookeeper:3.9.3` rather than floating minor tags.

The published tarball uses an allowlist containing the executable bundle, Compose definition, Solr configset/schema/setup guide, package README, license, and package metadata. Source, tests, caches, and generated local data are excluded.

## Consequences

### Positive

- Kiro users can launch Solr Compass without cloning context-bazaar or editing an absolute MCP server path.
- Exact npm and container versions make first-run behavior reproducible.
- Packaged infrastructure assets remain discoverable regardless of the user's current workspace.
- Catalog indexing can be pointed at any compatible Kanon content tree while codebase, document, and memory features remain usable without one.
- Solr Compass retains an independent release cadence and failure boundary from the Kanon CLI and catalog bridge.

### Negative

- Bun and Docker remain runtime prerequisites for the default local deployment.
- Artifact indexing needs `SOUK_COMPASS_CONTENT_ROOT` when the launch working directory does not contain a Kanon content tree.
- Package releases must keep the Kiro version pin synchronized intentionally; publishing a new npm version does not update installed Power artifacts automatically.
- Patch-pinned container tags require deliberate updates for security and maintenance releases.

### Neutral

- The internal source directory and legacy Solr resource names remain `souk-compass`; the public product and npm package are named Solr Compass.
- A custom Docker image is not introduced. Official Solr and ZooKeeper images remain provisioned by Compose.

## Links and References

- Extends: [ADR-0031](0031-souk-compass-standalone-mcp-server-for-semantic-search.md)
- Extends: [ADR-0032](0032-solrcloud-mode-for-souk-compass.md)
- Related: [ADR-0034](0034-solr-10-upgrade-with-scalar-quantization.md)
- Package: `kanon/mcp-servers/souk-compass/`
- Kiro artifact: `kanon/knowledge/solr-compass/`
