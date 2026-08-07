# Solr Compass

Solr Compass is a Bun-powered MCP server for Apache Solr-backed semantic search, codebase retrieval, and cross-session memory.

## Requirements

- Bun 1.3.14 or later
- Docker Desktop for the bundled local SolrCloud environment

## Kiro MCP configuration

Pin the package version so MCP startup is reproducible:

```json
{
  "mcpServers": {
    "solr-compass": {
      "command": "bunx",
      "args": ["--bun", "@stevenjmiklovic/solrcompass@0.1.0"]
    }
  }
}
```

On first use, call the idempotent initializer:

```text
compass_setup { "action": "initialize" }
```

It downloads the pinned `solr:10.0.0` and `zookeeper:3.9.3` images when absent, starts the local containers, uploads the bundled configset, and creates the configured collections. Later calls return without changing an already-ready environment.

## Content root

Docker Compose and the Solr configset resolve from the installed package. Catalog artifact indexing resolves `catalog.json` and `knowledge/` separately in this order:

1. `SOUK_COMPASS_CONTENT_ROOT`
2. `${CLAUDE_PLUGIN_ROOT}/kanon`
3. The current directory when named `kanon`, otherwise its `kanon/` child

Codebase search, user documents, and memory do not require catalog content.

## Development

Run commands from this directory:

```bash
bun install --frozen-lockfile
bun test
bun run typecheck
bun run lint
bun run build
npm pack --dry-run
```

Publishing is a separate release action and requires npm authentication and explicit confirmation.

## License

MIT
