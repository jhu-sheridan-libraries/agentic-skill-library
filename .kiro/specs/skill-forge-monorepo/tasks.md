# Implementation Plan: Skill Forge Monorepo

## Overview

Implement the Skill Forge CLI tool — a TypeScript/Bun pipeline that parses knowledge artifacts (Markdown + YAML), validates them with Zod schemas, transforms them through seven harness adapters, renders output via Nunjucks templates, and emits harness-native files to `dist/`. The plan progresses bottom-up: schemas → parsing → validation → adapters → build orchestrator → install/new/catalog → eval framework → CLI wiring.

## Tasks

- [x] 1. Implement Zod schemas and parsing utilities
  - [x] 1.1 Implement the complete Zod schemas in `src/schemas.ts`
    - Schemas are already stubbed; verify all schemas match the design: `CanonicalEventSchema`, `CanonicalActionSchema`, `CanonicalHookSchema`, `HooksFileSchema`, `McpServerDefinitionSchema`, `McpServersFileSchema`, `FrontmatterSchema`, `WorkflowFileSchema`, `KnowledgeArtifactSchema`, `CatalogEntrySchema`, `CatalogSchema`, `ValidationErrorSchema`, `ValidationResultSchema`
    - Ensure `FrontmatterSchema` uses `.passthrough()` to preserve unknown fields
    - Export all inferred TypeScript types alongside schemas
    - _Requirements: 1.1–1.6, 2.1–2.5, 3.1–3.5, 4.1_

  - [x] 1.2 Create a parser module `src/parser.ts` for knowledge artifact loading
    - Implement `parseKnowledgeMd(filePath: string)` using `gray-matter` to extract frontmatter and body
    - Implement `parseHooksYaml(filePath: string)` using `js-yaml` to parse hooks
    - Implement `parseMcpServersYaml(filePath: string)` using `js-yaml` to parse MCP server definitions
    - Implement `parseWorkflows(workflowsDir: string)` to read all `.md` files from a `workflows/` subdirectory
    - Implement `loadKnowledgeArtifact(artifactDir: string)` that orchestrates all parsers, validates with Zod, and returns a typed `KnowledgeArtifact`
    - Handle missing optional files (`hooks.yaml`, `mcp-servers.yaml`, `workflows/`) gracefully with empty defaults
    - Handle `harness-config` frontmatter field: extract per-harness config blocks and pass through to adapters
    - Separate `extraFields` from known frontmatter fields for template passthrough
    - _Requirements: 1.1–1.6, 2.1–2.7, 3.1–3.7, 4.1–4.3_

  - [x] 1.3 Write property tests for schema round-trips with fast-check
    - **Property: Hook YAML round-trip** — For all valid canonical hooks, parsing then serializing then parsing produces equivalent data
    - **Validates: Requirement 3.6**
    - **Property: Frontmatter round-trip** — For all valid frontmatter objects, serializing to YAML then parsing produces equivalent metadata
    - **Validates: Requirement 22.1**
    - **Property: MCP definition round-trip** — For all valid MCP server definitions, parsing from YAML then serializing to JSON produces valid parseable JSON
    - **Validates: Requirement 23.1**

  - [x] 1.4 Write unit tests for parser edge cases
    - Test `knowledge.md` with no frontmatter (infer name from directory)
    - Test `knowledge.md` with empty frontmatter (`---\n---`)
    - Test invalid YAML syntax returns `ValidationError` with file path and line number
    - Test unsupported event type in `hooks.yaml` returns `ValidationError`
    - Test missing `knowledge.md` in artifact directory emits warning
    - _Requirements: 1.5, 2.3, 2.5, 3.5, 22.2, 22.3_

- [x] 2. Checkpoint — Ensure schemas and parser tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement the validation module
  - [x] 3.1 Implement `validateArtifact()` and `validateAll()` in `src/validate.ts`
    - Validate `knowledge.md` exists and has valid YAML frontmatter
    - Validate `hooks.yaml` contains only supported event types and action types
    - Validate `mcp-servers.yaml` contains valid server definitions with required fields (`name`, `command`)
    - Validate all harness names in frontmatter `harnesses` list are recognized
    - Validate `harness-config` keys reference harnesses present in the `harnesses` list (warn if not)
    - Return structured `ValidationResult` with per-field errors including file paths
    - _Requirements: 18.1–18.8, 2.5, 3.5, 4.5_

  - [x] 3.2 Implement `validateCommand()` CLI handler in `src/validate.ts`
    - Wire `forge validate` (all artifacts) and `forge validate <artifact-path>` (single artifact)
    - Print pass/fail per artifact to stderr with summary count
    - Exit with non-zero status code if any errors found
    - _Requirements: 18.1–18.2, 18.7–18.8, 27.4–27.5_

  - [x] 3.3 Write unit tests for validation
    - Test valid artifact passes validation
    - Test missing `knowledge.md` fails validation
    - Test invalid hook event type produces error
    - Test unrecognized harness name produces error
    - _Requirements: 18.3–18.6_

- [x] 4. Implement the Nunjucks template engine setup
  - [x] 4.1 Create a template engine module `src/template-engine.ts`
    - Initialize Nunjucks environment with `templates/harness-adapters/` as the template root
    - Configure template inheritance support (`{% extends %}`, `{% block %}`)
    - Add custom filters if needed (e.g., kebab-to-title-case)
    - Implement `renderTemplate(templatePath: string, context: object): string`
    - Handle template syntax errors by returning `TemplateError` with file path and Nunjucks error message
    - _Requirements: 14.1–14.5_

  - [x] 4.2 Write unit tests for template rendering
    - Test base template renders artifact body
    - Test harness template extends base template
    - Test missing template variable produces `TemplateError`
    - Test template syntax error produces `TemplateError` with file path
    - _Requirements: 14.3–14.5, 27.3_

- [x] 5. Implement harness adapters (Kiro, Claude Code, Copilot)
  - [x] 5.1 Implement the Kiro adapter in `src/adapters/kiro.ts`
    - Generate steering `.md` files with YAML frontmatter (`inclusion` field from artifact metadata or `harness-config.kiro.inclusion`)
    - Translate canonical hooks to `.kiro.hook` JSON files with `name`, `version`, `when`, `then` fields
    - Map canonical events to Kiro events using the event map from the design
    - Generate `mcp.json` from MCP server definitions
    - Generate `POWER.md` with frontmatter when `harness-config.kiro.power` is `true`
    - Copy workflows to `steering/` subdirectory
    - Handle `harness-config.kiro.spec-hooks` and `harness-config.kiro.fileMatchPattern`
    - _Requirements: 7.1–7.8, 21.1, 21.3_

  - [x] 5.2 Implement the Claude Code adapter in `src/adapters/claude-code.ts`
    - Generate `CLAUDE.md` with canonical body text and appended workflow sections
    - Translate `agent_stop` + `run_command` hooks to `.claude/settings.json` Stop hook entries
    - Skip unsupported hook events and emit warnings
    - Generate `.claude/mcp.json` from MCP server definitions
    - _Requirements: 8.1–8.5, 21.1, 21.4_

  - [x] 5.3 Implement the Copilot adapter in `src/adapters/copilot.ts`
    - Generate `.github/copilot-instructions.md` with canonical body text
    - Generate path-scoped `.github/instructions/<artifact>.instructions.md` with `applyTo` frontmatter when `file_patterns` or `harness-config.copilot.path-scoped` is set
    - Generate `AGENTS.md` when workflows exist or `harness-config.copilot.agents-md` is `true`
    - Skip hooks and emit warning (Copilot doesn't support hooks)
    - _Requirements: 9.1–9.4, 21.4_

  - [x] 5.4 Write unit tests for Kiro, Claude Code, and Copilot adapters
    - Test Kiro adapter generates correct hook JSON structure
    - Test Kiro adapter maps canonical events to Kiro events
    - Test Claude Code adapter translates `agent_stop` hooks to settings.json
    - Test Claude Code adapter skips unsupported events with warnings
    - Test Copilot adapter generates path-scoped instructions
    - Test Copilot adapter skips hooks with warning
    - _Requirements: 7.1–7.8, 8.1–8.5, 9.1–9.4_

- [x] 6. Implement harness adapters (Cursor, Windsurf, Cline, Q Developer)
  - [x] 6.1 Implement the Cursor adapter in `src/adapters/cursor.ts`
    - Generate `.cursor/rules/<artifact>.md` with YAML frontmatter and inclusion mode mapping (`always` → `always`, `fileMatch` → `auto`, `manual` → `agent-requested`)
    - Generate `.cursor/mcp.json` from MCP server definitions
    - Skip hooks and emit warning
    - _Requirements: 10.1–10.4_

  - [x] 6.2 Implement the Windsurf adapter in `src/adapters/windsurf.ts`
    - Generate `.windsurf/rules/<artifact>.md` with canonical body text
    - Copy workflows to `.windsurf/workflows/`
    - Generate `.windsurf/mcp.json` from MCP server definitions
    - Skip hooks and emit warning
    - _Requirements: 11.1–11.4_

  - [x] 6.3 Implement the Cline adapter in `src/adapters/cline.ts`
    - Generate `.clinerules/<artifact>.md` with canonical body text
    - Translate hooks to executable shell scripts under `.clinerules/hooks/` with `executable: true`
    - Generate VS Code MCP configuration entries
    - Handle `harness-config.cline.toggleable` and `harness-config.cline.default-enabled`
    - _Requirements: 12.1–12.6, 21.2_

  - [x] 6.4 Implement the Q Developer adapter in `src/adapters/qdeveloper.ts`
    - Generate `.q/rules/<artifact>.md` with canonical body text
    - Generate `.q/agents/` files from workflows
    - Generate MCP configuration for Q Developer IDE plugin
    - Skip hooks and emit warning
    - _Requirements: 13.1–13.4_

  - [x] 6.5 Write unit tests for Cursor, Windsurf, Cline, and Q Developer adapters
    - Test Cursor inclusion mode mapping
    - Test Cline hook script generation with executable flag
    - Test Windsurf workflow file copying
    - Test Q Developer agent generation from workflows
    - Test all four adapters skip unsupported hooks with warnings
    - _Requirements: 10.1–10.4, 11.1–11.4, 12.1–12.6, 13.1–13.4_

- [x] 7. Checkpoint — Ensure all adapter tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement the build orchestrator
  - [x] 8.1 Implement `build()` in `src/build.ts`
    - Scan `knowledge/` directory for artifact directories (skip dirs without `knowledge.md`, emit warning)
    - Load and parse each artifact via `loadKnowledgeArtifact()`
    - Resolve shared MCP servers from `mcp-servers/` directory with artifact-local override precedence
    - Clear `dist/` (full build) or `dist/<harness>/` (single harness build) before writing
    - Route each artifact through the adapter registry for each target harness
    - Write `OutputFile[]` results to `dist/<harness>/<artifact>/`
    - Set executable permission on files with `executable: true`
    - Collect and return warnings and errors; skip failed artifact-harness combos and continue
    - _Requirements: 5.1–5.6, 6.1–6.4, 4.2–4.4_

  - [x] 8.2 Implement `buildCommand()` CLI handler in `src/build.ts`
    - Wire `forge build` (all harnesses) and `forge build --harness <name>` (single harness)
    - Validate harness name against `SUPPORTED_HARNESSES`, error with valid list if invalid
    - Print summary to stderr: artifacts compiled, harnesses targeted, file count
    - Handle empty knowledge directory with helpful error message suggesting `forge new`
    - _Requirements: 5.5, 6.3, 27.1, 27.4–27.5_

  - [x] 8.3 Write property test for build idempotency
    - **Property: Build idempotency** — For all valid knowledge directories, running build twice without changes produces byte-identical dist output
    - **Validates: Requirements 24.1, 24.2**

  - [x] 8.4 Write unit tests for build orchestrator
    - Test full build compiles all artifacts × all harnesses
    - Test single harness build only clears and writes to `dist/<harness>/`
    - Test build skips artifact when harness not in frontmatter `harnesses` list
    - Test build continues on adapter error, logging to stderr
    - _Requirements: 5.1–5.6, 6.1–6.4_

- [x] 9. Implement catalog generation
  - [x] 9.1 Implement `generateCatalog()` and `catalogCommand()` in `src/catalog.ts`
    - Scan knowledge directory and produce `CatalogEntry[]` from parsed artifacts
    - Include `evals: true` when artifact has `evals/` subdirectory
    - Sort entries alphabetically by `name`
    - Serialize with `JSON.stringify(entries, null, 2)` for pretty-printed 2-space indentation
    - Integrate catalog generation into the build pipeline (auto-regenerate after `forge build`)
    - _Requirements: 19.1–19.5, 32.5_

  - [x] 9.2 Write property test for catalog serialization round-trip
    - **Property: Catalog round-trip** — For all valid catalog contents, serializing to JSON then deserializing produces equivalent catalog object
    - **Validates: Requirements 20.1, 20.2**

  - [x] 9.3 Write unit tests for catalog generation
    - Test catalog contains exactly one entry per artifact with no duplicates
    - Test catalog entries are sorted alphabetically
    - Test catalog JSON is valid UTF-8 and parseable
    - _Requirements: 19.3–19.5, 20.1–20.3_

- [x] 10. Checkpoint — Ensure build and catalog tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement the `forge new` scaffolding command
  - [x] 11.1 Implement `newCommand()` in `src/new.ts`
    - Create `knowledge/<artifact-name>/` directory with `knowledge.md`, empty `workflows/`, stub `hooks.yaml`, and stub `mcp-servers.yaml`
    - Load scaffold templates from `templates/knowledge/` and render with Nunjucks
    - Populate frontmatter: `name` from artifact name, `displayName` as title-cased, placeholder `description`, empty `keywords`, placeholder `author`, all seven harnesses
    - Error if directory already exists
    - Print confirmation to stderr with path and next steps
    - _Requirements: 17.1–17.5_

  - [x] 11.2 Write unit tests for `forge new`
    - Test scaffold creates correct directory structure
    - Test scaffold populates frontmatter correctly
    - Test error when artifact directory already exists
    - _Requirements: 17.1–17.4_

- [x] 12. Implement the install module
  - [x] 12.1 Implement `install()` for direct CLI install in `src/install.ts`
    - Copy compiled output from `dist/<harness>/<artifact>/` to current working directory at harness-expected paths
    - Create missing directories as needed
    - Prompt for confirmation before overwriting (unless `--force`)
    - Support `--dry-run` to show plan without writing
    - Support `--source <path>` for remote skill-forge repo path
    - Error if artifact not built, suggest `forge build`
    - Print summary to stderr
    - _Requirements: 15.1–15.5, 16.1–16.4, 28.2_

  - [x] 12.2 Implement `runInteractiveInstaller()` in `src/install.ts`
    - Use `@clack/prompts` for the interactive wizard
    - Present searchable multi-select of artifacts from catalog (show `displayName`, `description`, `keywords`)
    - Present multi-select of harnesses, pre-selecting detected harnesses (check for `.kiro/`, `.cursor/`, etc. in cwd)
    - Display confirmation summary before proceeding
    - Offer to run `forge build` if dist output missing
    - Support `--dry-run` flag
    - _Requirements: 31.1–31.8_

  - [x] 12.3 Implement `installCommand()` CLI handler in `src/install.ts`
    - Wire `forge install` (no args → interactive), `forge install <artifact> --harness <name>`, `forge install <artifact> --all`
    - Pass through `--force`, `--dry-run`, `--source`, `--from-release` options
    - _Requirements: 15.1, 16.1, 31.1, 27.2_

  - [x] 12.4 Write unit tests for install module
    - Test single harness install copies correct files
    - Test `--all` installs for every built harness
    - Test `--dry-run` produces plan without writing files
    - Test error when artifact not built
    - _Requirements: 15.1–15.5, 16.1–16.4_

- [x] 13. Checkpoint — Ensure new, install, and all integration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Implement the eval framework
  - [x] 14.1 Implement eval discovery and prompt resolver in `src/eval.ts`
    - Implement `discoverEvalConfigs()` to scan `knowledge/*/evals/` and top-level `evals/` for promptfoo YAML configs
    - Implement `resolvePromptRefs()` to map `file://` prompt references to actual `dist/` file paths
    - Implement `applyHarnessContext()` to wrap prompts in harness context templates from `templates/eval-contexts/`
    - _Requirements: 32.1–32.4, 33.1–33.3, 38.1–38.4_

  - [x] 14.2 Implement `runEvals()` and `evalCommand()` in `src/eval.ts`
    - Invoke promptfoo programmatically via its Node.js API (`evaluate()`)
    - Support filtering by artifact name and harness
    - Support `--threshold`, `--output`, `--ci`, `--provider`, `--no-context` options
    - Print results to stderr with pass/fail per test, aggregate scores, summary
    - Exit non-zero on failures
    - _Requirements: 33.1–33.8, 34.1–34.6, 37.1–37.5_

  - [x] 14.3 Implement `scaffoldEvals()` for `forge eval --init <artifact>` in `src/eval.ts`
    - Generate starter `evals/promptfooconfig.yaml` within the artifact directory
    - Include compiled steering file as prompt, default provider config, placeholder test cases
    - Generate at least one test case per harness and per hook
    - Print generated files and next steps to stderr
    - _Requirements: 35.1–35.5_

  - [x] 14.4 Write unit tests for eval framework
    - Test eval discovery finds configs in artifact and top-level `evals/` directories
    - Test prompt resolver maps `file://` refs to correct dist paths
    - Test harness context wrapping applies correct template
    - Test `--no-context` skips context wrapping
    - _Requirements: 32.1–32.4, 33.1–33.4, 38.1–38.4_

- [x] 15. Wire up the CLI entry point
  - [x] 15.1 Finalize `src/cli.ts` command wiring
    - Verify all six commands (`build`, `install`, `new`, `validate`, `catalog`, `eval`) are registered and wired to their handlers
    - Ensure all CLI options match the design spec
    - Ensure stderr for diagnostics, stdout for machine-readable output
    - Ensure exit code 0 on success, non-zero on error
    - _Requirements: 27.4–27.5, 30.1_

  - [x] 15.2 Write integration tests for CLI commands
    - Test `forge build` end-to-end with a sample knowledge artifact
    - Test `forge validate` returns correct exit codes
    - Test `forge new` creates expected directory structure
    - Test `forge catalog` produces valid JSON
    - _Requirements: 27.1–27.5_

- [x] 16. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The codebase already has stub files with correct interfaces — implementation fills in the `throw new Error("Not implemented")` bodies
- All adapters are pure functions (no I/O) — the build orchestrator handles file system operations
- Property tests use `fast-check` (already in devDependencies) and target the round-trip/idempotency requirements
- Unit tests use Bun's built-in test runner (`bun test`)
