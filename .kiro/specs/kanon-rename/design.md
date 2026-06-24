# Design Document

## Overview

The rename from "Skill Forge" to "Kanon" is a mechanical refactoring operation across the codebase. The design prioritizes:

1. **Atomicity** — All changes land in one PR so the repo is never in a half-renamed state.
2. **Backward compatibility** — Deprecated aliases bridge existing muscle memory for one release.
3. **Git history preservation** — Directory renames use `git mv` so blame/log stay useful.
4. **Scriptability** — The bulk of the work is deterministic text replacement, automatable via a migration script.

## Architecture

### Directory Structure (After Migration)

```
context-bazaar/
├── kanon/                          # Was: skill-forge/
│   ├── src/
│   ├── knowledge/
│   │   └── kanon/                  # Was: knowledge/skill-forge/
│   ├── kanon.config.yaml           # Was: forge.config.yaml
│   ├── package.json                # name: @thinkingsage/kanon
│   └── ...
├── powers/
│   └── kanon/                      # Was: powers/skill-forge/
├── .mcp.json                       # Updated paths
└── ...
```

### CLI Binary Strategy

In `package.json`:
```json
{
  "bin": {
    "kanon": "./src/cli.ts",
    "forge": "./src/cli-deprecated.ts"
  }
}
```

The `cli-deprecated.ts` shim:
```typescript
import { stderr } from "process";
stderr.write(
  "\x1b[33m⚠ `forge` is deprecated. Use `kanon` instead.\x1b[0m\n"
);
await import("./cli.ts");
```

### Config File Fallback

In the config loader (`src/config.ts` or equivalent):
```typescript
function resolveConfigPath(dir: string): string {
  const primary = join(dir, "kanon.config.yaml");
  if (existsSync(primary)) return primary;
  
  const legacy = join(dir, "forge.config.yaml");
  if (existsSync(legacy)) {
    warn("forge.config.yaml is deprecated — rename to kanon.config.yaml");
    return legacy;
  }
  
  throw new ConfigNotFoundError(dir);
}
```

### Replacement Strategy

The migration script performs replacements in this order (most-specific first to avoid partial matches):

| Priority | Pattern | Replacement | Context |
|----------|---------|-------------|---------|
| 1 | `@thinkingsage/skill-forge` | `@thinkingsage/kanon` | Package refs |
| 2 | `skill-forge/` (in paths) | `kanon/` | File paths |
| 3 | `skill-forge` (kebab-case) | `kanon` | General refs |
| 4 | `Skill Forge` (title case) | `Kanon` | Prose |
| 5 | `skill_forge` (snake_case) | `kanon` | Rare identifiers |
| 6 | `forge.config.yaml` | `kanon.config.yaml` | Config refs |
| 7 | `"forge"` (as bin name) | `"kanon"` | package.json bin key |
| 8 | `` `forge `` (CLI command) | `` `kanon `` | Doc code blocks |
| 9 | `bun run dev` | `bun run dev` | **No change** (dev alias stays) |

### Files Excluded from Bulk Replacement

- `CHANGELOG.md` — Historical entries should preserve the name used at that time
- `docs/adr/0044-rename-skill-forge-to-kanon.md` — References both names intentionally
- `.git/` — Never touched
- `node_modules/` — Never touched
- `dist/` — Regenerated after rename

### Validation Sequence

After all replacements:

1. `bun x tsc --noEmit` — Type check
2. `bun test` — Full test suite
3. `bun run lint` — Biome lint
4. `bun run dev build` — Full harness build
5. `bun run dev validate` — Artifact validation
6. `bun run dev catalog build` — Catalog generation
7. Manual: `bun run dev --help` shows "kanon" branding

## Alternatives Considered

### Gradual rename over multiple PRs
Rejected. A half-renamed state creates confusion about which name is canonical and which imports/paths are correct. The rename is mechanical enough to do atomically.

### Keep `forge` as primary, add `kanon` as alias
Rejected. This defeats the purpose — we want "Kanon" to be the canonical identity. A brief backward-compat shim is sufficient.

### Automated codemod tool (jscodeshift, etc.)
Overkill. The changes are string replacements in paths and prose, not AST-level refactoring. A shell script with `sed`/`find` is simpler and auditable.
