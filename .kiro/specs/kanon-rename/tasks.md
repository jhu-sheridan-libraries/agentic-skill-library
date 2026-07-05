# Tasks

## Phase 1: Preparatory Changes (backward-compatible)

- [x] **Task 1.1**: Create `src/cli-deprecated.ts` shim that prints deprecation warning and re-exports `cli.ts`
  - File: `kanon/src/cli-deprecated.ts` (new)
  - Acceptance: Running via the `forge` bin entry prints warning to stderr, then runs normally

- [x] **Task 1.2**: Add config file fallback logic
  - File: Config loader (wherever `forge.config.yaml` is currently read)
  - Acceptance: Loader tries `kanon.config.yaml` first, falls back to `forge.config.yaml` with deprecation warning

- [x] **Task 1.3**: Update CLI Commander metadata
  - File: `src/cli.ts`
  - Acceptance: `.name("kanon")`, description references Kanon, help output shows new name

## Phase 2: Directory & Package Rename

- [x] **Task 2.1**: Rename top-level directory
  - Command: `git mv skill-forge kanon`
  - Acceptance: Directory exists at `kanon/`, git tracks the rename

- [x] **Task 2.2**: Rename power directory
  - Command: `git mv powers/skill-forge powers/kanon`
  - Acceptance: Power lives at `powers/kanon/`

- [x] **Task 2.3**: Rename self-referencing knowledge artifact
  - Command: `git mv kanon/knowledge/skill-forge kanon/knowledge/kanon`
  - Acceptance: Artifact at `kanon/knowledge/kanon/knowledge.md`

- [x] **Task 2.4**: Rename config file
  - Command: `git mv kanon/forge.config.yaml kanon/kanon.config.yaml`
  - Acceptance: Config at `kanon/kanon.config.yaml`

- [x] **Task 2.5**: Update `package.json` identity
  - Fields: `name` → `@thinkingsage/kanon`, `bin` → `{ "kanon": "./src/cli.ts", "forge": "./src/cli-deprecated.ts" }`
  - Acceptance: `bun install` succeeds, both bin entries resolve

## Phase 3: Bulk Text Replacement

- [x] **Task 3.1**: Replace `@thinkingsage/skill-forge` → `@thinkingsage/kanon` in all files
  - Scope: All non-excluded files
  - Acceptance: `grep -r "@thinkingsage/skill-forge"` returns zero results

- [x] **Task 3.2**: Replace path references `skill-forge/` → `kanon/`
  - Scope: CI workflows, MCP config, plugin manifests, steering, hooks, docs
  - Acceptance: `grep -r "skill-forge/" --include="*.yml" --include="*.json" --include="*.md"` returns zero results (excluding CHANGELOG and ADR-0044)

- [x] **Task 3.3**: Replace `Skill Forge` → `Kanon` in prose
  - Scope: READMEs, docs, ADR headers, CITATION.cff, contributing guides
  - Acceptance: `grep -r "Skill Forge"` returns only CHANGELOG historical entries and ADR-0044

- [x] **Task 3.4**: Replace remaining `skill-forge` and `skill_forge` references
  - Scope: Code, imports, steering, knowledge artifact frontmatter
  - Acceptance: `grep -r "skill-forge\|skill_forge"` returns only CHANGELOG and ADR-0044

- [x] **Task 3.5**: Replace `forge.config.yaml` references → `kanon.config.yaml`
  - Scope: Source code, docs, steering
  - Acceptance: Code references new name (fallback logic from Task 1.2 handles legacy)

- [x] **Task 3.6**: Replace CLI command references `` `forge `` → `` `kanon `` in documentation
  - Scope: All `.md` files with CLI examples
  - Acceptance: Doc examples show `kanon build`, `kanon new`, etc.

## Phase 4: Infrastructure Updates

- [x] **Task 4.1**: Update `.github/workflows/*.yml` — working directory and paths
  - Files: `ci.yml`, `release.yml`, `pages.yml`, `audit.yml`, `codeql.yml`
  - Acceptance: CI would find files at correct paths (verify with `act` or manual path check)

- [x] **Task 4.2**: Update `.mcp.json` bridge path
  - File: `.mcp.json`
  - Acceptance: Path points to `kanon/bridge/mcp-server.cjs`

- [x] **Task 4.3**: Update `.claude-plugin/plugin.json`
  - File: `.claude-plugin/plugin.json`
  - Acceptance: Paths reference `kanon/` directory

- [x] **Task 4.4**: Update `.kiro/hooks/*.json` paths
  - Files: All hook files referencing `skill-forge`
  - Acceptance: Hooks reference `kanon/` paths

- [x] **Task 4.5**: Update `.kiro/steering/*.md` references
  - Files: `product.md`, `structure.md`, `tech.md`, `changelog-manual-entry.md`
  - Acceptance: Steering docs reference correct directory and CLI name

- [x] **Task 4.6**: Update `.github/dependabot.yml` directory
  - Acceptance: Dependabot monitors `kanon/` for updates

- [x] **Task 4.7**: Update `.github/labeler.yml` path patterns
  - Acceptance: Label rules match files under `kanon/`

## Phase 5: Validation

- [x] **Task 5.1**: TypeScript compiles — `bun x tsc --noEmit`
  - Acceptance: Exit code 0

- [x] **Task 5.2**: All tests pass — `bun test`
  - Acceptance: 333+ tests pass, exit code 0

- [x] **Task 5.3**: Lint clean — `bun run lint`
  - Acceptance: Exit code 0, no errors

- [x] **Task 5.4**: Full build succeeds — `bun run dev build`
  - Acceptance: All harness outputs generated in `dist/`

- [x] **Task 5.5**: CLI shows new branding — `bun run dev --help`
  - Acceptance: Output shows "kanon" name and description

- [x] **Task 5.6**: Catalog generates — `bun run dev catalog build`
  - Acceptance: `catalog.json` regenerated successfully

## Phase 6: Cleanup & Documentation

- [x] **Task 6.1**: Update root `README.md` with new name and paths
  - Acceptance: README references Kanon throughout, install instructions use new package name

- [x] **Task 6.2**: Update `CONTRIBUTING.md` with new directory and CLI name
  - Acceptance: Contributor instructions reference `kanon/` and `kanon` CLI

- [x] **Task 6.3**: Update `CITATION.cff` with new title
  - Acceptance: Citation uses "Kanon" as the software title

- [x] **Task 6.4**: Add CHANGELOG entry with migration instructions
  - Acceptance: CHANGELOG documents the rename and tells users how to update

- [x] **Task 6.5**: Create changelog fragment for the rename
  - Command: `bun run changelog:new --type changed --message "Renamed from Skill Forge to Kanon"`
  - Acceptance: Fragment exists in `changes/`

- [x] **Task 6.6**: Update ADR README title reference
  - File: `kanon/docs/adr/README.md`
  - Acceptance: Header says "Kanon" not "Skill Forge"
