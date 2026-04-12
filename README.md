# context-bazaar

Knowledge artifacts for AI coding assistants. Skills, powers, workflows, prompts, and agents — compiled for Kiro, Claude Code, Copilot, Cursor, Windsurf, Cline, and Q Developer from a single source.

## Install

```
/plugin marketplace add https://github.com/thinkingsage/context-bazaar
/plugin install context-bazaar
```

Once installed, Claude Code loads an MCP server with three tools:

| Tool | What it does |
|---|---|
| `catalog_list` | List artifacts, filter by `collection` or `type` |
| `artifact_content` | Read a specific artifact's full content |
| `collection_list` | List collections with member counts |

Ask the assistant: *"what's in the neon-caravan collection?"* or *"show me the commit-craft artifact"*.

## Collections

### Neon Caravan
Craft-focused developer workflow artifacts.

| Artifact | Type | Description |
|---|---|---|
| `commit-craft` | prompt | Write commit messages that explain why, not just what |
| `debug-journal` | workflow | Three-phase debugging methodology: articulate → isolate → fix |
| `review-ritual` | skill | Code review as craft — reading order, comment taxonomy, approval |
| `type-guardian` | skill | TypeScript type discipline — strictness, `unknown` vs `any`, discriminated unions |

### Byron Powers
Literary and publishing workflow powers.

| Artifact | Type | Description |
|---|---|---|
| `book-agent-publicist` | power | Finding agents, deals, contracts, publicity, career strategy |
| `novelist` | power | Complete novel-writing companion across creative and professional tracks |
| `technical-author` | power | Technical book writing in the O'Reilly/Pragmatic/Manning style |
| `proofreader-review-checklist` | power | Structured checklists for manuscripts, proposals, queries, and synopses |

## Contributing artifacts

```bash
# Scaffold a new artifact
forge new my-artifact --type skill

# Validate all artifacts
forge validate

# Build compiled output for all harnesses
forge build

# Browse the catalog
forge catalog browse
```

Artifacts live in `skill-forge/knowledge/<name>/`. Each has:
- `knowledge.md` — frontmatter metadata + content body
- `hooks.yaml` — optional event hooks
- `mcp-servers.yaml` — optional MCP server declarations
- `workflows/` — optional phase files (for `type: workflow`)

To assign an artifact to a collection, add to its frontmatter:
```yaml
collections: [neon-caravan]
```

## Importing external powers

```bash
# Import Kiro powers from a local directory
forge import ~/my-powers --all --collections my-collection

# Dry run first
forge import ~/my-powers --all --dry-run
```

Supports Kiro power format (`POWER.md` + `steering/`) and skill format (`SKILL.md` + `references/`).

## Harness targets

All artifacts compile to seven harnesses by default. Override per artifact:

```yaml
harnesses:
  - kiro
  - claude-code
```

## License

[Boost Software License 1.0](LICENSE)
