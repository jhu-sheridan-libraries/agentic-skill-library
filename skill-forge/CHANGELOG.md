# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-04-27

### Added
- Added MCP bridge compilation smoke test to CI (`bun run build:bridge` + `node bridge/mcp-server.cjs --version`)
- Added ADR-0031 documenting Souk Compass as a standalone MCP server for Solr-backed semantic search with pluggable embedding providers and multi-tier caching.
- ADR-0030: authoring-level version embedding and manifests
- Multi-harness `forge import --harness` command supporting all 7 harness-native formats (Kiro, Claude Code, Copilot, Cursor, Windsurf, Cline, Q Developer) with auto-detection, --force, and --dry-run
- Admin UI components in Browse SPA: capability badges with color-coded matrix grid, inline temper preview panel, import modal with file scanner, version display with upgrade button, workspace tab with project management, interactive dependency graph (inline SVG with force-directed layout), and build dashboard with config persistence and history
- Interactive `forge temper` command for previewing the compiled AI experience per artifact-harness pair, with terminal output, JSON mode, side-by-side comparison (--compare), and web preview (--web)
- Admin API endpoints for capabilities (GET /api/capabilities), temper (POST /api/temper), import scan/execute (POST /api/import), versions/upgrade (GET/POST /api/versions, /api/upgrade), workspace (GET/PUT /api/workspace), dependency graph (GET /api/graph), and build trigger/status (POST /api/build, GET /api/build/status)
- Comprehensive unit test suite for Souk Compass MCP server — 191 tests across 9 files covering SoukVectorClient, embedding provider factory, tool handlers, MCP error boundary, CachedEmbeddingProvider, chunker, serialization, workspace profiler, and hook/plugin validation.
- Added `changelog-check` CI job that enforces a changelog fragment exists for PRs touching source files, with `skip-changelog` label escape hatch
- Added daily `dist-drift.yml` scheduled workflow that rebuilds artifacts and MCP bridge on `main` and warns if `dist/` or `bridge/` have drifted from source
- Harness capability matrix declaring support levels (full/partial/none) for 8 capabilities across all 7 harnesses, with configurable degradation strategies (inline/comment/omit) applied automatically during build
- Added promptfoo eval suites for codeshop (routing, skill-quality, shared-concepts), all 8 byron-powers artifacts, ADR (workflow-correctness, template-quality, generate-from-diff, health-check), and karpathy-mode (principle-enforcement, tradeoff-awareness) — 71 tests total
- Multi-repo and monorepo workspace support via forge.config.yaml with multiple knowledge sources, per-project harness/artifact configuration, workspace-aware build and install, and --project flag
- Artifact versioning with semver version embedding in compiled output, .forge-manifest.json sidecar files, `forge upgrade` command with migration script support, --force, and --dry-run

### Changed
- Updated README with complete CLI command reference, project structure, capability matrix, and development instructions
- Trimmed knowledge artifact keywords to 6-19 per artifact, removed keyword/category overlaps, established canonical 10-category taxonomy, and added 'writing' to CategoryEnum in schemas.ts
- Added Bun dependency caching (`~/.bun/install/cache` + `node_modules`) keyed on `bun.lock` hash to all GitHub Actions workflows (CI, release, audit, pages)
- Added event-driven hooks to five neon-caravan artifacts (commit-craft, review-ritual, type-guardian, debug-journal, karpathy-mode) and added missing Overview, Examples, and Troubleshooting sections to all knowledge artifacts per Kiro Power best practices.
- Switched Souk Compass local Solr from standalone mode to SolrCloud (1 node + ZooKeeper), enabling the Collections API for programmatic collection management and configset-based schema deployment. Updated health check to use ping endpoint for mode-agnostic operation.
- Added Overview, Examples, Troubleshooting, and Steering Files listing sections to all eight byron-powers artifacts (novelist, fantasy-novelist, scifi-novelist, mystery-series-novelist, series-continuity, book-agent-publicist, technical-author, proofreader-review-checklist) per Kiro Power best practices.
- Updated the Hello test artifact with a fun onboarding section that greets users in 20 languages and bumped version to 0.2.0.
- Split CI into parallel jobs (`lint-and-typecheck`, `test`, `validate-and-build`) so lint, tests, and artifact validation run concurrently
- Added `concurrency` group with `cancel-in-progress: true` to CI so rapid pushes to a PR cancel stale in-progress runs
- Rewrote top-level README with current collection counts, full repo structure, and complete Quick Start
- Replaced stub skill-forge CONTRIBUTING with code-level guide covering module map, adapter/backend patterns, testing conventions, and common pitfalls
- Overhauled CLI help metadata with thorough examples, option groups, and coverage for all commands including catalog export, guild, and collection
- Updated the knowledge.md scaffold template to include skeleton Overview, Best Practices, Examples, and Troubleshooting sections so new artifacts start with the recommended Kiro Power structure.

### Fixed
- Fixed the CI eval job to use the eval suite's Bedrock credentials, and skip forked pull request runs where the required secrets are unavailable.
- Fixed all Biome lint errors and TypeScript type-check failures: resolved Bun Dirent type incompatibility in versioning.ts, tightened mapKiroEvent return type to CanonicalEvent, added missing changelog/migrations fields to CatalogEntry test factories, added buildHistory to BrowseState test fixtures, removed unused imports, applied Biome formatting, and suppressed intentional ANSI escape regex checks
- Updated GitHub workflows to install Node 22 and run repository automation from the `skill-forge` directory so CI, audit, CodeQL, and release jobs target the actual project files.
- Fixed SQLite BLOB deserialization in CachedEmbeddingProvider — Bun's bun:sqlite returns Uint8Array for BLOB columns, now uses TextDecoder instead of toString() for correct embedding recovery.
- Removed hardcoded test count from PR template checklist to prevent staleness
- Static catalog export: use replacer function in generateStaticHtmlPage to prevent String.replace dollar-sign corruption of embedded JSON


## [0.2.0] - 2026-04-20

### Added
- Added 4 property-based tests for collection admin correctness (Properties 10–12, 16) — YAML round-trip, unknown key preservation, validation consistency, and filtering correctness.
- Added unit tests for `collection-admin.ts` — 15 tests covering `parseCollectionFile`, `serializeCollection`, `validateCollectionInput`, `getCollection` member resolution, and error paths for CRUD operations.
- Documented browse UI module extraction architecture (ADR-0025).
- Added unit tests for `admin.ts` — 20 tests covering `serializeFrontmatter`, `validateArtifactInput`, `toKebabCase`, and error paths for `createArtifact`, `updateArtifact`, `deleteArtifact`.
- Added coverage tests for `eval.ts` (5 tests), `install.ts` (7 tests), and `build.ts` (5 tests) — covering scaffoldEvals, dry-run install, --force overwrite, --all multi-harness, error paths, and malformed frontmatter handling.
- Added unit tests for `manifest-admin.ts` — 9 tests covering `readManifest`, `readSyncLock`, `computeSyncStatus` (synced/outdated/missing), and error paths for `addManifestEntry`, `editManifestEntry`, `removeManifestEntry`.
- Added 3 property-based tests for manifest admin correctness (Properties 13–15) — sync status computation, entry validation delegation, and top-level field preservation during mutations.
- Added 30 integration tests for browse server mutation endpoints — artifact/collection/manifest CRUD round-trips, sync status verification, Content-Type validation, and structured error responses (400/404/409).
- Added manifest entry management to `forge catalog browse` — view manifest entries with sync status indicators, add/edit/remove entries via REST API (`GET/POST/PUT/DELETE /api/manifest/entries`), and display synced/outdated/missing status from sync-lock comparison
- Documented browse server admin CRUD architecture with mutable state wrapper and modular admin layers (ADR-0024)
- Added 9 property-based tests for artifact admin correctness (Properties 1–9) — frontmatter serialization round-trip, validation consistency, kebab-case enforcement, file structure verification, update preservation, delete removal, catalog consistency, toKebabCase output, and comma-separated parsing.
- Added full CRUD capabilities to `forge catalog browse` for knowledge artifacts — create, edit, and delete artifacts directly from the browser UI via `POST /api/artifact`, `PUT /api/artifact/:name`, and `DELETE /api/artifact/:name` endpoints with validation, conflict detection, and automatic catalog refresh
- Extract browse UI template (`generateHtmlPage`, `generateStaticHtmlPage`, `escapeHtml`) into dedicated `browse-ui.ts` module, reducing `browse.ts` from ~2950 to ~500 lines (ADR-0025).
- Added tab navigation (Artifacts | Collections | Manifest) to `forge catalog browse` with a shared UI design system including design tokens, reusable card/form/badge/toast/modal components, and context-aware create buttons
- Added collection management to `forge catalog browse` — list, view, create, edit, and delete collection YAML files via REST API (`GET/POST/PUT/DELETE /api/collections`) with trust-level and tag filtering in the UI

### Fixed
- Fix GitHub Pages workflow to deploy from `jhu-main` instead of `main` so the catalog browser shows all knowledge artifacts
- Fixed release workflow: added `working-directory: skill-forge` to all jobs, externalized playwright/electron from binary compilation, and improved audit severity counting with jq JSON parsing.


## [0.1.1] - 2026-04-13

### Added
- Added `src/asset-conventions.ts` registry mapping each of the 8 asset types to required files, optional files, and type-specific validation rule keys
- Added `forge import <path> [--all] [--format] [--dry-run] [--collections]` command for ingesting external Kiro powers (`POWER.md` + `steering/`) and skills (`SKILL.md` + `references/`) into the skill-forge knowledge directory
- Added forge tutorial command providing a step-by-step guided walkthrough for first-time users covering artifact creation via the interactive wizard, generated file exploration, and building with progress indicators and jargon-free language
- Auto-fetch from configured backend when artifact or collection is not in global cache (guild init)
- Added maturity badge, trust lane label, and maturity filter to catalog browser card and detail views in `forge catalog browse`
- Add jhu collection and backend (jhu-sheridan-libraries/agentic-skill-forge)
- Documented decision to use an auto-detecting multi-format importer for `forge import` over a hardcoded single-format path, enabling extensibility to future source formats without CLI surface changes (ADR-0019)
- Implemented Kiro harness adapter with steering files, hook JSON, POWER.md, spec-hooks, and MCP config generation
- Added `hello-world` example power and full `kiro-official` collection knowledge definitions covering 26 powers:

- `arm-soc-migration`
- `aws-agentcore`
- `aws-amplify`
- `aws-devops-agent`
- `aws-healthomics`
- `aws-infrastructure-as-code`
- `aws-mcp`
- `aws-observability`
- `aws-sam`
- `checkout-api-reference`
- `cloud-architect`
- `cloudwatch-application-signals`
- `datadog`
- `dynatrace`
- `figma`
- `gcp-aws-migrate`
- `graviton-migration-power`
- `neon`
- `postman`
- `power-builder`
- `saas-builder`
- `spark-troubleshooting-agent`
- `stackgen`
- `strands`
- `stripe`
- `terraform`
- Added forge catalog browse subcommand with local web-based catalog browser featuring search, harness/type/category filtering, and artifact detail view with knowledge.md preview
- Added AssetTypeSchema expanding the `type` field to 8 values (skill, power, rule, workflow, agent, prompt, template, reference-pack) as a semantic asset taxonomy, with ArtifactTypeSchema kept as a backward-compatible alias
- Implemented forge new scaffolding command with template-driven artifact creation
- Added DevSecOps GitHub Actions workflows: CodeQL static analysis (src/ and bridge/ with security-extended queries), scheduled dependency audit with bun audit and Gitleaks secret scanning (custom rules for mcp-servers.yaml env blocks), OSSF Scorecard, Dependabot weekly updates, path-based PR labeler, and stale issue management
- Implemented Nunjucks template engine module with inheritance support and custom filters
- Added --yes flag to forge new command to skip the interactive wizard and use template defaults for CI and scripting use cases
- Added `forge help [command]` subcommand as an alternative to --help, with contextual command help and unknown command error handling
- Added context-bazaar Claude Code plugin packaging with `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `.mcp.json`, and a bundled MCP bridge (`bridge/mcp-server.cjs`) exposing `catalog_list`, `artifact_content`, and `collection_list` tools
- Added styled help screens with chalk color styling, aligned command tables, per-command usage examples, grouped options, and --no-color support via a pure-function Help_Renderer module
- Added CONTRIBUTING.md covering artifact scaffolding, frontmatter fields, quality bar, collection assignment, import workflow, development commands, changelog fragment process, and pull request checklist
- Added `forge.config.yaml` per-repo configuration and `~/.forge/config.yaml` user-global configuration loaded via `src/config.ts`; declares named install backends, publish target, and governance author allowlists
- Added asset type select prompt to the `forge new` interactive wizard with descriptions for all 8 asset types; prompt is skipped when `--type` is passed on the command line
- Added harness-specific emoji icons to the catalog browser filter checkboxes, card footer, and detail view (👻 kiro, 🤖 claude-code, 🐙 copilot, 🖱️ cursor, 🏄 windsurf, 🔧 cline, ☁️ qdeveloper)
- Added ecosystem, depends, and enhances metadata fields to frontmatter and catalog schemas with kebab-case validation
- Documented decision to declare collection membership in artifact frontmatter rather than in collection manifests, with four alternatives considered and rationale for eliminating the two-source-of-truth problem (ADR-0016)
- Documented decision to use a pre-bundled MCP server as the Claude Code plugin integration layer over pure skill file distribution or a slash command, enabling interactive parameterised catalog queries from inside the assistant (ADR-0020)
- Added `--strict` flag to `forge build` that treats compatibility warnings (partial or missing harness support for an asset type) as hard errors
- Documented decision to use the `gh` CLI rather than direct GitHub REST API calls for release creation and asset download, delegating auth management to an already-installed tool (ADR-0018)
- Added CollectionSchema for metadata-only collection manifests in `collections/*.yaml`; collection membership is declared by artifacts in their own frontmatter via `collections: [name]` rather than listed in the manifest, eliminating stale cross-references
- Added multi-root source scanning so `forge build`, `forge validate`, and `forge catalog generate` scan both `knowledge/` and `packages/` directories, skipping roots that do not exist
- Added `src/collections.ts` with `loadCollections`, `validateArtifactCollectionRefs`, and `buildCollectionMembership` for loading collection manifests, cross-validating artifact collection references, and computing derived membership maps
- Added `forge publish` command running the full pipeline (validate --strict, build, catalog, release-manifest.json, per-harness tarballs) and publishing via `gh release create` for GitHub or `aws s3 sync` for S3; `--dry-run` packages without uploading
- Added pluggable backend abstraction in `src/backends/` with a shared `ArtifactBackend` interface and four implementations: `LocalBackend` (filesystem), `GitHubBackend` (gh CLI), `S3Backend` (aws CLI, compatible with R2/MinIO), and `HttpBackend` (generic HTTPS with bearer token support)
- Added asset × harness compatibility matrix in `src/compatibility.ts` so `forge build` skips type/harness combinations with no meaningful output and emits partial-support warnings for degraded combinations
- Documented decision to use a pluggable ArtifactBackend interface over hardcoding GitHub as the only install/publish target, enabling private S3 and HTTP backends alongside the public GitHub releases backend (ADR-0017)
- Implemented Cursor, Windsurf, Cline, and Q Developer harness adapters
- Documented decision to add `--security` flag to `forge validate` over a standalone command or CI-only approach, integrating prompt injection, hook exfiltration, and MCP surface checks as a local-and-CI gate (ADR-0021)
- Added `--backend <name>` flag to `forge install` for fetching artifacts from a named backend declared in `forge.config.yaml`; enables installing from private S3 buckets and HTTP endpoints alongside the existing `--from-release` GitHub path
- Added file-writer module with buildKnowledgeMd, buildHooksYaml, buildMcpServersYaml, and writeWizardResult functions for serializing wizard output to gray-matter markdown and YAML files
- Added `collections` field to artifact frontmatter and catalog entries so artifacts declare their own collection membership; the catalog derives collection membership from artifact metadata rather than from a separate member list
- Added governance lane validation warnings: `trust: official` or `partner` without a `license` field, `risk-level: high` without a `trust` lane, and artifacts declaring a collection name with no matching manifest in `collections/`
- Added CODE_OF_CONDUCT.md addressing contributor responsibility in the AI harness era: curated vs. uncurated AI-assisted contributions, knowledge quality standards, attribution policy, and the expectation that all submitted content has been reviewed and understood by its author
- Added four seed knowledge artifacts to the Neon Caravan collection: `commit-craft` (prompt), `type-guardian` (skill), `debug-journal` (workflow with three phase files), and `review-ritual` (skill)
- Added `forge collection build` subcommand and `src/collection-builder.ts` that assembles per-collection dist bundles at `dist/<harness>/collections/<name>/` by merging pre-built member artifact outputs derived from catalog collection membership
- Added category taxonomy (CategoryEnum) with 9 initial values for tagging knowledge artifacts by domain
- Added generated `dist/` artifacts for kiro, claude-code, and copilot harnesses covering all power definitions including kiro-official, byron-powers, hello-world, and adr collections
- Added `karpathy-mode` knowledge entry (Andrej Karpathy's behavioral coding guidelines) with kiro and claude-code harness targets, examples workflow, MIT license, and upstream provenance tracking
- Added cross-artifact dependency reference validation with warnings for unresolved depends/enhances references
- Implemented Claude Code adapter with CLAUDE.md, Stop hooks in settings.json, and MCP config
- Added Collection filter group to `forge catalog browse` UI so users can browse artifacts scoped to a single collection; filter group is hidden when no artifacts have collection membership
- Added GitHub issue templates for artifact submission (identity table, content preview, quality self-assessment) and content quality report (exact-quote requirement, severity taxonomy, fix capacity check)
- Implemented eval framework with discovery, prompt resolver, harness context wrapping, promptfoo integration, and scaffold command
- Added interactive wizard to forge new command using @clack/prompts for guided artifact configuration including frontmatter metadata, knowledge body, hooks, and MCP server definitions with inline Zod validation and cancellation safety
- Added download cache at `~/.forge/cache/<backend>/<artifact>@<version>/` so remote backend artifacts (GitHub releases, S3, HTTP) are not re-downloaded on repeated installs
- Added `.forge-manifest.json` written alongside installed artifacts recording artifact name, harness, version, backend label, and install timestamp to enable future upgrade tracking
- Added enhanced version output with Bun runtime version and OS platform info to `forge --version`
- Verified CLI entry point with all six commands wired and functional
- Added root-level CLAUDE.md providing Claude Code with commands, architecture overview, compile pipeline, type system, collection model, MCP bridge details, test helper conventions, and changelog/ADR discipline
- Added asset-type-aware validation warnings to `forge validate`: `reference-pack` without `inclusion: manual`, `workflow` with empty or missing `workflows/` directory, and `prompt` with a body shorter than 50 characters
- Added `--type <type>` flag to `forge new` for pre-selecting the asset type and bypassing the wizard type prompt; validates against the 8-value AssetTypeSchema and scaffolds type-appropriate structure (e.g. `workflow` pre-creates `workflows/main.md`)
- Added typo suggestion for unknown commands using Levenshtein distance (fastest-levenshtein), suggesting the closest match when distance ≤ 2
- Implemented catalog generation with generateCatalog, serializeCatalog, and catalogCommand
- Added namespaced artifact layout support for `packages/@org/<artifact>/knowledge.md` alongside the existing flat `knowledge/<artifact>/knowledge.md` layout; dist output paths always use the leaf artifact name
- Add --backend option to guild init for specifying a named backend
- Added CLI startup banners: full-color gradient banner with dark navy background for interactive use, and plain-text logBanner() export for log files
- Added `forge collection new [name]` interactive wizard for scaffolding collection manifests; changed `forge collection` bare invocation to show a status overview with member counts and an interactive "create first collection?" prompt when none exist
- Added three ADR power hooks (agent-stop reminder, pre-task ADR listing, post-task diff summary) and updated ADR knowledge metadata with `harness-config` and corrected author field
- Implemented install module with direct CLI install, interactive wizard using clack/prompts, and installCommand handler
- Added bazaar governance and discovery fields to artifact frontmatter and catalog entries: `maturity`, `trust`, `risk-level`, `audience`, `model-assumptions`, `id`, `license`, `successor`, and `replaces`, all optional with safe defaults so existing artifacts require no changes
- Documented decision to combine static pattern matching with LLM adversarial rubric evals as a two-layer artifact security review, using the existing promptfoo eval infrastructure against compiled CLAUDE.md artifacts (ADR-0022)
- Implemented build orchestrator with full and single-harness build, shared MCP server resolution, and CLI handler
- Added `harness-config` field (with `kiro.format: "power"`) to `importKiroPower` frontmatter output so imported powers carry their format declaration forward
- Implemented parser module with parseKnowledgeMd, parseHooksYaml, parseMcpServersYaml, parseWorkflows, and loadKnowledgeArtifact
- Implemented validation module with validateArtifact, validateAll, and validateCommand CLI handler
- Verified and completed Zod schemas in src/schemas.ts with all required schemas, types, and passthrough support
- Added biome.json config scoping lint to src/, scripts/, evals/, and collections/, excluding generated files (bridge/, coverage/, dist/, .forge/, upstream/, catalog.json)
- Implemented Copilot adapter with instructions, path-scoped files, and AGENTS.md generation
- Added dependency composition for `workflow` and `agent` artifact types: MCP servers from `depends` artifacts are merged before compilation, and hooks are merged when `inherit-hooks: true` is set in the artifact's frontmatter
- Added `kiro-official.yaml` collection manifest, `sync-kiro-powers.sh` script for pulling upstream power sources, and `upstream/.gitkeep` placeholder directory
- Added dependency cycle detection to `forge validate` using DFS over the `depends` graph; cycles now produce hard validation errors identifying the full cycle path

### Changed
- Changed detail view to merge redundant Harnesses and Formats sections into a single Targets section showing icon, harness name, and format inline; improved back-to-catalog button with pill styling and animated arrow
- Changed writing-related power knowledge (novelist, technical-author, proofreader-review-checklist, book-agent-publicist, scifi-novelist, fantasy-novelist, mystery-series-novelist, series-continuity) to live under `knowledge/byron-powers/` namespace with new hooks and workflow content
- Expanded SECURITY.md with MCP bridge attack surface documentation, distinction between security issues and content quality issues, coordinated disclosure timeline, and in-scope vs. out-of-scope table
- Updated forge new scaffold template to include categories, ecosystem, depends, and enhances fields with guiding YAML comments
- Changed eval output formatting to use horizontal rules, filled progress bars, tree connectors (├─/╰─) for response and grading reason detail lines, and suppressed noisy GCP metadata probe warnings from promptfoo
- Changed root help screen to display subcommands indented under their parent commands (catalog, collection) in a structured hierarchy; stripped `[options]` noise from command names at the overview level
- Expanded pull request template with artifact changes table, breaking changes callout, split checklist (Code / Artifacts / Housekeeping), harness output preview command, and structured prompting to prevent empty sections
- Changed `maturity: deprecated` without a `successor` field from a validation warning to a validation error, enforcing that deprecated artifacts always point to their replacement
- Changed banner display logic to suppress on --help, -h, and `forge help` invocations, showing only on bare `forge` with no arguments
- Changed the type-field deprecation warning to a lifecycle warning emitted during `forge validate` when an artifact has `maturity: deprecated` but no `successor` field set
- Changed `forge new` scaffold template to include commented-out bazaar metadata stubs (maturity, trust, license, audience, risk-level, model-assumptions) so authors can see available fields without being required to fill them in
- Changed catalog browser to registry-style card hierarchy with display name, monospace package name, 2-line description, pill keywords, and icon-only harness footer; added Space Grotesk display font and Inter body font; improved filter bar with labeled groups and pill-style checkboxes

### Deprecated
- Deprecated `BuildOptions.knowledgeDir` (singular string) in favor of `BuildOptions.knowledgeDirs: string[]` to support multi-root scanning; the old field is still accepted but will be removed in a future version

### Fixed
- Fixed trailing `help` on CLI commands (e.g. `forge build help`, `forge catalog browse help`) now showing the help screen instead of erroring with "too many arguments"
- Fixed type errors across source and test files for strict TypeScript compliance — added missing collections/inherit-hooks fields, corrected Dirent typing for Node.js compatibility, and resolved narrowing issues in tests
- Fixed wizard validateField returning parsed string values as error messages, causing text prompts to mirror input instead of proceeding
- GitHubBackend fetchArtifact tarball extraction double-nesting (harness prefix already in archive)
- Fixed `forge import` crashing on non-artifact directories by verifying `POWER.md` / `SKILL.md` existence before dispatching, and filtering out dot-directories (`.github`, `.kiro`, etc.) during source scanning
- Fixed `forge tutorial` crashing on re-run when the hello-world artifact already exists by removing the existing directory before re-scaffolding when the user confirms overwrite
- GitHubBackend fetchArtifact directory existence check (Bun.file().exists() does not work on directories)
- Fixed CLI banner right edge so all lines render as a uniform rectangle by computing visual terminal column width (handling wide emoji including ⚡) and normalising trailing padding dynamically rather than hardcoding it per line
- Global install version selection now picks newest release instead of oldest
- GitHubBackend fetchCatalog now uses gh release download instead of broken gh api path
- Fixed build.ts resolveComposition destructuring that referenced a nonexistent `resolved` property, causing a type error and potential runtime failure


### Architecture Decisions

- [ADR-009](docs/adr/0009-clack-prompts-for-interactive-cli.md): Use @clack/prompts for interactive CLI flows
- [ADR-010](docs/adr/0010-scaffold-first-overwrite-on-success.md): Scaffold-first, overwrite-on-success pattern for interactive wizard
