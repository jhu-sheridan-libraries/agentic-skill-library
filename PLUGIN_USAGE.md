# Claude Code Plugin Usage

context-bazaar is available as a [Claude Code plugin](https://docs.anthropic.com/en/docs/claude-code/plugins). Once installed, the artifact catalog is exposed to your assistant via MCP tools.

## Install

```
/plugin marketplace add https://github.com/thinkingsage/context-bazaar
/plugin install context-bazaar
```

## MCP Tools

Once installed, Claude Code loads an MCP server with three tools:

| Tool | What it does |
|---|---|
| `catalog_list` | List artifacts, filter by `collection` or `type` |
| `artifact_content` | Read a specific artifact's full content |
| `collection_list` | List collections with member counts |

Ask the assistant: *"what's in the neon-caravan collection?"* or *"show me the commit-craft artifact"*.

## How It Works

The plugin ships a pre-compiled MCP bridge (`skill-forge/bridge/mcp-server.cjs`) that reads from `skill-forge/catalog.json`. Both the bridge and catalog are committed to the repository, so no build step is needed after installation.
