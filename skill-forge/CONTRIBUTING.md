# Contributing to Skill Forge

## Adding a Knowledge Artifact

1. Run `forge new <artifact-name>` to scaffold the directory structure
2. Edit `knowledge/<artifact-name>/knowledge.md` with your content
3. Add hooks in `hooks.yaml` and MCP servers in `mcp-servers.yaml` as needed
4. Run `forge validate` to check your artifact
5. Run `forge build` to compile to all harnesses
6. Run `forge eval --init <artifact-name>` to scaffold eval tests
7. Submit a pull request

## Development

```bash
bun install
bun test
bun run lint
```
