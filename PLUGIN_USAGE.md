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

## Skills

The plugin ships a small set of discoverable skills — self-contained behavioral guides that Claude Code can auto-invoke based on their description, without any MCP round-trip:

| Skill | What it does |
|---|---|
| `kanon` | Onboarding and assistant guide for the Kanon CLI & Context Bazaar itself — tutorials, authoring, commands |
| `karpathy-mode` | Reduce common LLM coding mistakes: avoid overcomplication, make surgical changes |
| `laconic-output` | Spartan, no-filler communication mode |
| `review-ritual` | Code review as a craft — read with intent, comment with purpose |
| `type-guardian` | TypeScript type discipline |

These come from artifacts in `knowledge/` tagged `type: skill` with `claude-code` in their `harnesses` list. Not every catalog artifact is a plugin skill — rules, workflows, and powers are still only reachable through the MCP tools below or `kanon install`.

## MCP Tools

Once installed, the plugin loads an MCP server with three tools:

| Tool | What it does |
|---|---|
| `catalog_list` | List artifacts, filter by `collection` or `type` |
| `artifact_content` | Read a specific artifact's full content |
| `collection_list` | List collections with member counts |

Ask the assistant: *"what's in the neon-caravan collection?"* or *"show me the commit-craft artifact"*.

The imported Library AI Workshop skills are grouped in the `library-ai-workshop` collection. Ask the assistant to list that collection, then install a focused artifact such as `facilitate-library-ai-workshop` or `review-ai-research-output` for a Codex project.

## How It Works

The plugin ships a pre-compiled MCP bridge (`kanon/bridge/mcp-server.cjs`) that reads from `kanon/catalog.json`. Both the bridge and catalog are release assets, so no build step is needed after installation.
