# Plugin Usage

context-bazaar is available as a Claude Code plugin and as a Codex plugin. Once installed, the artifact catalog is exposed to your assistant via MCP tools.

## Install in Claude Code

```
/plugin marketplace add https://github.com/thinkingsage/context-bazaar
/plugin install context-bazaar
```

## Install in Codex

For local development, expose the checkout through your personal Codex marketplace. The standard personal marketplace expects plugins under `~/plugins`, so link or copy this checkout there:

```bash
mkdir -p ~/plugins
ln -s /path/to/context-bazaar ~/plugins/context-bazaar
```

Add this entry to the `plugins` array in `~/.agents/plugins/marketplace.json`:

```json
{
  "name": "context-bazaar",
  "source": {
    "source": "local",
    "path": "./plugins/context-bazaar"
  },
  "policy": {
    "installation": "AVAILABLE",
    "authentication": "ON_INSTALL"
  },
  "category": "Developer Tools"
}
```

Then install it:

```bash
codex plugin add context-bazaar@personal
```

The Codex plugin reads `.codex-plugin/plugin.json`, starts the catalog MCP bridge from `.mcp.json`, and does not require a local build step when `kanon/bridge/mcp-server.cjs` and `kanon/catalog.json` are present.

To compile and install individual knowledge artifacts into a Codex project, use Kanon:

```bash
cd kanon
bun run dev build --harness codex
bun run dev install commit-craft --harness codex --source .
```

## MCP Tools

Once installed, the plugin loads an MCP server with three tools:

| Tool | What it does |
|---|---|
| `catalog_list` | List artifacts, filter by `collection` or `type` |
| `artifact_content` | Read a specific artifact's full content |
| `collection_list` | List collections with member counts |

Ask the assistant: *"what's in the neon-caravan collection?"* or *"show me the commit-craft artifact"*.

## How It Works

The plugin ships a pre-compiled MCP bridge (`kanon/bridge/mcp-server.cjs`) that reads from `kanon/catalog.json`. Both the bridge and catalog are release assets, so no build step is needed after installation.
