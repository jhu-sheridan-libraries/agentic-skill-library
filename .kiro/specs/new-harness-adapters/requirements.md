# Requirements Document

## Introduction

Skill Forge currently compiles knowledge artifacts to seven AI coding assistant harnesses: Kiro, Claude Code, GitHub Copilot, Cursor, Windsurf, Cline, and Amazon Q Developer. This feature adds three new harness targets — Zed, JetBrains AI (Junie), and Aider — to expand coverage to the next most impactful developer audiences. Each new harness follows the established adapter pattern: a pure-function adapter, Nunjucks templates, format registry entry, schema integration, and full test coverage.

## Glossary

- **Harness**: A target AI coding assistant that Skill Forge compiles artifacts for. Each harness has its own file format, directory conventions, and feature support.
- **Adapter**: A pure function in `src/adapters/` that receives a `KnowledgeArtifact` and a Nunjucks `Environment`, and returns an `AdapterResult` containing output files and warnings.
- **Format_Registry**: The `HARNESS_FORMAT_REGISTRY` constant in `src/format-registry.ts` that maps each harness to its valid output formats and default format.
- **HarnessName**: The Zod enum in `src/schemas.ts` listing all supported harness identifiers.
- **Zed**: An open-source, GPU-accelerated code editor with a built-in AI assistant. Uses `.zed/prompts/` for custom prompt files and `.zed/settings.json` for MCP context server configuration.
- **JetBrains_AI**: JetBrains' AI coding assistant ecosystem, primarily Junie. Uses `.junie/guidelines/` for project guidelines and `.junie/mcp.json` for MCP server configuration.
- **Aider**: A terminal-based AI pair programming tool. Uses `.aider/prompts/` for convention files referenced via `--read` flags. Does not natively support MCP servers or hooks.
- **Context_Server**: Zed's term for MCP servers, configured under the `context_servers` key in `.zed/settings.json`.

## Requirements

### Requirement 1: Zed Harness Adapter

**User Story:** As an artifact author targeting Zed, I want Skill Forge to compile my knowledge artifacts into Zed-native prompt files and context server configuration, so that my artifacts work seamlessly in the Zed editor.

#### Acceptance Criteria

1. THE system SHALL register `"zed"` as a valid `HarnessName` in the `SUPPORTED_HARNESSES` array in `src/schemas.ts`.
2. THE Format_Registry SHALL define Zed with a single format: `prompt` (default).
3. THE Zed adapter SHALL produce a markdown prompt file at `.zed/prompts/<artifact-name>.md` containing the artifact body and workflows, using the base template pattern.
4. WHEN an artifact defines MCP servers, THE Zed adapter SHALL produce a `.zed/settings.json` file with servers configured under the `context_servers` key, where each server entry has the shape `{ command: { path, args, env } }`.
5. WHEN an artifact defines hooks, THE Zed adapter SHALL emit a warning that Zed does not support hooks and skip all hook definitions.
6. THE Zed adapter SHALL be a pure function with no side effects, consistent with all existing adapters.

### Requirement 2: JetBrains AI Harness Adapter

**User Story:** As an artifact author targeting JetBrains IDEs, I want Skill Forge to compile my knowledge artifacts into Junie-compatible guidelines and MCP configuration, so that my artifacts work in IntelliJ, PyCharm, WebStorm, and other JetBrains products.

#### Acceptance Criteria

1. THE system SHALL register `"jetbrains"` as a valid `HarnessName` in the `SUPPORTED_HARNESSES` array in `src/schemas.ts`.
2. THE Format_Registry SHALL define JetBrains with a single format: `guideline` (default).
3. THE JetBrains adapter SHALL produce a markdown guideline file at `.junie/guidelines/<artifact-name>.md` containing the artifact body and workflows, using the base template pattern.
4. WHEN an artifact defines MCP servers, THE JetBrains adapter SHALL produce a `.junie/mcp.json` file with the standard `{ mcpServers: { ... } }` structure matching the existing MCP template pattern.
5. WHEN an artifact defines hooks, THE JetBrains adapter SHALL emit a warning that JetBrains AI does not support hooks and skip all hook definitions.
6. THE JetBrains adapter SHALL be a pure function with no side effects, consistent with all existing adapters.

### Requirement 3: Aider Harness Adapter

**User Story:** As an artifact author targeting Aider, I want Skill Forge to compile my knowledge artifacts into Aider-compatible convention files, so that my artifacts can be loaded via Aider's `--read` flag.

#### Acceptance Criteria

1. THE system SHALL register `"aider"` as a valid `HarnessName` in the `SUPPORTED_HARNESSES` array in `src/schemas.ts`.
2. THE Format_Registry SHALL define Aider with a single format: `convention` (default).
3. THE Aider adapter SHALL produce a markdown convention file at `.aider/prompts/<artifact-name>.md` containing the artifact body and workflows, using the base template pattern.
4. WHEN an artifact defines MCP servers, THE Aider adapter SHALL emit a warning that Aider does not natively support MCP servers and skip MCP definitions.
5. WHEN an artifact defines hooks, THE Aider adapter SHALL emit a warning that Aider does not support hooks and skip all hook definitions.
6. THE Aider adapter SHALL be a pure function with no side effects, consistent with all existing adapters.

### Requirement 4: Schema and Registry Integration

**User Story:** As a developer, I want the new harnesses to be fully integrated into the schema, format registry, and adapter registry, so that all existing CLI commands (build, validate, catalog, browse) work with the new harnesses without special-casing.

#### Acceptance Criteria

1. THE `SUPPORTED_HARNESSES` array in `src/schemas.ts` SHALL include `"zed"`, `"jetbrains"`, and `"aider"` alongside the existing seven harnesses.
2. THE `HARNESS_FORMAT_REGISTRY` in `src/format-registry.ts` SHALL include entries for `zed`, `jetbrains`, and `aider` with their respective formats and defaults.
3. THE `adapterRegistry` in `src/adapters/index.ts` SHALL map `zed`, `jetbrains`, and `aider` to their respective adapter functions.
4. THE `FrontmatterSchema` SHALL accept the new harness names in the `harnesses` array and in `harness-config` keys.
5. THE `FrontmatterSchema` SHALL validate `format` fields in `harness-config.zed`, `harness-config.jetbrains`, and `harness-config.aider` against their respective valid format sets.
6. WHEN an artifact's `harnesses` array defaults (no explicit harnesses specified), THE default SHALL include all ten harnesses.

### Requirement 5: Template Creation

**User Story:** As a developer, I want each new harness to have its own Nunjucks templates following the established template directory pattern, so that output generation is consistent and maintainable.

#### Acceptance Criteria

1. THE template directory `templates/harness-adapters/zed/` SHALL contain a `prompt.md.njk` template extending the base template, and a `settings.json.njk` template for MCP context server output.
2. THE template directory `templates/harness-adapters/jetbrains/` SHALL contain a `guideline.md.njk` template extending the base template, and a `mcp.json.njk` template for MCP server output.
3. THE template directory `templates/harness-adapters/aider/` SHALL contain a `convention.md.njk` template extending the base template.
4. ALL new templates SHALL follow the existing template conventions: extending `../_base/base.md.njk` for markdown output, using `{{ mcpConfig | dump(2) }}` for JSON output.

### Requirement 6: Build Pipeline Integration

**User Story:** As an artifact author, I want `forge build` to produce output for the new harnesses in `dist/`, so that I can use the compiled artifacts immediately.

#### Acceptance Criteria

1. WHEN running `forge build`, THE build pipeline SHALL produce output directories `dist/zed/`, `dist/jetbrains/`, and `dist/aider/` for artifacts that target those harnesses.
2. WHEN running `forge build --harness zed`, THE build pipeline SHALL produce output only for the Zed harness.
3. WHEN running `forge build --harness jetbrains`, THE build pipeline SHALL produce output only for the JetBrains harness.
4. WHEN running `forge build --harness aider`, THE build pipeline SHALL produce output only for the Aider harness.
5. THE build pipeline SHALL require no changes beyond the schema, registry, and adapter additions — the existing build orchestration SHALL discover new harnesses automatically via the adapter registry.

### Requirement 7: Catalog and Browse Integration

**User Story:** As a catalog consumer, I want the new harnesses to appear in the catalog and browse SPA, so that users can discover artifacts that target Zed, JetBrains, or Aider.

#### Acceptance Criteria

1. THE catalog generator SHALL include `zed`, `jetbrains`, and `aider` in `formatByHarness` entries for artifacts that target those harnesses.
2. THE browse SPA harness filter SHALL include the new harnesses as filter options.
3. THE wizard's harness multi-select SHALL include the new harnesses with descriptive labels:
   - `"zed — Prompt files for Zed editor's AI assistant"`
   - `"jetbrains — Guidelines for JetBrains Junie AI"`
   - `"aider — Convention files for Aider CLI pair programmer"`

### Requirement 8: Validation Support

**User Story:** As an artifact author, I want `forge validate` to correctly validate artifacts targeting the new harnesses, so that I get clear error messages for invalid configuration.

#### Acceptance Criteria

1. WHEN an artifact's `harnesses` array includes `"zed"`, `"jetbrains"`, or `"aider"`, THE validator SHALL accept the artifact without errors.
2. WHEN `harness-config.zed.format` contains an invalid value, THE validator SHALL produce a descriptive error identifying the harness and valid format values.
3. WHEN `harness-config.jetbrains.format` contains an invalid value, THE validator SHALL produce a descriptive error identifying the harness and valid format values.
4. WHEN `harness-config.aider.format` contains an invalid value, THE validator SHALL produce a descriptive error identifying the harness and valid format values.

### Requirement 9: Existing Artifact Backward Compatibility

**User Story:** As an existing artifact author, I want my current artifacts to continue working without modification after the new harnesses are added, so that the addition is non-breaking.

#### Acceptance Criteria

1. WHEN an existing artifact's `harnesses` array explicitly lists only the original seven harnesses, THE system SHALL continue to build only for those seven harnesses with no change in behavior.
2. WHEN an existing artifact omits the `harnesses` field (relying on the default), THE default SHALL expand to include all ten harnesses, and the new harnesses SHALL produce valid output using their default formats.
3. THE addition of new harnesses SHALL NOT change the output of any existing harness adapter for any existing artifact.

### Requirement 10: Test Coverage

**User Story:** As a developer, I want comprehensive test coverage for all new adapters, so that regressions are caught immediately.

#### Acceptance Criteria

1. EACH new adapter SHALL have unit tests covering: default format output, MCP server handling (output or warning), hook handling (warning), and workflow inclusion.
2. THE format registry SHALL have tests verifying the new harness entries return correct defaults and valid format sets.
3. THE schema SHALL have tests verifying the new harness names are accepted in `harnesses` arrays and `harness-config` keys.
4. THE schema SHALL have tests verifying invalid `format` values for new harnesses produce descriptive validation errors.
5. ALL existing tests SHALL continue to pass without modification.
