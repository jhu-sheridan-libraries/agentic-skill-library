---
inclusion: always
---

# Tech Stack & Build System

## Runtime & Tooling

- **Runtime**: Bun (≥ 1.0)
- **Language**: TypeScript (ESNext, strict mode, bundler module resolution)
- **Package manager**: Bun (`bun install`, `bun.lock`)
- **Test runner**: Bun test (`bun test`)
- **Linter/Formatter**: Biome (`biome check`, `biome format`)
- **Templating**: Nunjucks (`.njk` templates)
- **Validation**: Zod v4 schemas
- **CLI framework**: Commander
- **Interactive prompts**: @clack/prompts
- **Frontmatter parsing**: gray-matter
- **YAML**: js-yaml
- **Property-based testing**: fast-check (devDependency)
- **Eval framework**: promptfoo

## Common Commands

All commands run from the `skill-forge/` directory:

```bash
# Install dependencies
bun install

# Run CLI in dev mode
bun run dev <command>

# Build all artifacts for all harnesses
bun run dev build

# Build for a single harness
bun run dev build --harness kiro

# Validate artifacts
bun run dev validate

# Run security validation
bun run dev validate --security

# Browse catalog
bun run dev catalog browse

# Scaffold a new artifact
bun run dev new my-artifact --type skill

# Run tests (all 333+ must pass)
bun test

# Type check (ignore Dirent<NonSharedBuffer> errors in test files — Bun type def issue)
bun x tsc --noEmit

# Lint
bun run lint        # check
bun run lint:fix    # auto-fix

# Format
bun run format

# Compile the MCP bridge
bun run build:bridge

# Changelog fragment
bun run changelog:new --type added --message "description"

# Compile changelog
bun run changelog:compile
```

## Module System

- ESM (`"type": "module"` in package.json)
- The MCP bridge (`bridge/mcp-server.cjs`) is built as CJS for Node.js compatibility

## Key Conventions

- Adapters are **pure functions** — no side effects, no I/O. They receive a parsed artifact and a Nunjucks environment, return `AdapterResult` with files and warnings.
- Schemas are defined centrally in `src/schemas.ts` using Zod.
- Templates live in `templates/harness-adapters/<harness>/` as `.njk` files.
- Names use **kebab-case** everywhere: artifact names, collection names, directory names.
- Every substantive change requires a **changelog fragment** in `skill-forge/changes/`.
