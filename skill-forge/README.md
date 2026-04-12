# Skill Forge

Write knowledge once, compile to every AI coding assistant harness.

## Quick Start

```bash
# Clone and install
git clone https://github.com/jhu-sheridan-libraries/skill-forge.git
cd skill-forge
bun install

# Build all artifacts for all harnesses
bun run dev build

# Build for a single harness
bun run dev build --harness kiro

# Install into your project
bun run dev install my-artifact --harness kiro --source .

# Scaffold a new knowledge artifact
bun run dev new my-artifact

# Validate artifacts
bun run dev validate

# Run eval tests
bun run dev eval
```

## Supported Harnesses

- **Kiro** — steering files, hooks, powers
- **Claude Code** — CLAUDE.md, settings.json, MCP
- **GitHub Copilot** — instructions, path-scoped, AGENTS.md
- **Cursor** — rules, MCP
- **Windsurf** — rules, workflows, MCP
- **Cline** — toggleable rules, hook scripts, MCP
- **Amazon Q Developer** — rules, agents, MCP

## Project Structure

```
skill-forge/
├── knowledge/          # Canonical knowledge artifacts
├── dist/               # Compiled per-harness output (generated)
├── mcp-servers/        # Shared MCP server definitions
├── templates/          # Nunjucks templates
│   ├── knowledge/      # Scaffold templates for `forge new`
│   ├── harness-adapters/  # Per-harness output templates
│   └── eval-contexts/  # Harness context simulation for evals
├── evals/              # Cross-artifact eval suites
├── src/                # CLI and core modules
│   └── adapters/       # Per-harness adapter modules
├── .github/workflows/  # CI/CD
├── catalog.json        # Machine-readable artifact catalog (generated)
└── package.json
```

## License

MIT
