# ADR-0058: Composable Indexing Policy Pipeline for Souk Compass

## Status

Proposed

## Date

2026-08-09

## Context

ADR-0035 introduced codebase indexing with an inline directory walker, fixed default exclusions, simple glob filtering, and line-based chunks. Those mechanics now need to serve both full indexing and reindexing while accommodating language-specific build output, per-root exclusions and scoring preferences, syntax-aware Elixir chunks, and later git-aware incremental scans.

Adding each concern directly to the two tool handlers would duplicate policy and make the full- and incremental-indexing paths drift. The original ADR does not establish a shared boundary for indexing policy, nor does it define the precedence of caller overrides, language defaults, and root-local configuration.

## Decision

Model codebase-indexing policy as composable modules under `mcp-servers/souk-compass/src/`, with the tool handlers remaining orchestration layers.

- `file-scanner.ts` is the single directory-walking boundary. It owns text-file eligibility, glob matching, size limits, and exclusion composition.
- `project-detector.ts` supplies marker-file-based language presets. An explicit caller `exclude` list replaces presets; `.solrcompass-ignore` rules are always overlaid after that choice.
- `ignore-parser.ts` owns the project-local gitignore-like format and its last-match-wins semantics. `root-config.ts` validates the separate `.solrcompass.json` file for bounded per-root search configuration.
- `elixir-chunker.ts` provides a deterministic `.ex`/`.exs` chunker that preserves source ordering and applies line-based splitting only when a structural chunk exceeds the configured maximum.
- `boost-map.ts` reranks retrieved results in application code using the most-specific matching root-config pattern, consistent with ADR-0052's client-side scoring approach.
- `git-diff.ts` is the intentionally I/O-bound boundary for repository metadata. It returns typed success or expected-fallback outcomes rather than throwing, so the future reindex orchestrator can safely use a full scan when history is unavailable, too large, or too slow.

The modules expose narrow types and keep parsing, matching, chunking, and reranking deterministic where possible. They do not alter the codebase collection, document identity scheme, or batch/commit behavior established in ADR-0035.

## Consequences

### Positive

- Full indexing and reindexing will share identical discovery and exclusion behavior.
- Root-specific customization does not require global MCP configuration or repeated tool arguments.
- Language-specific scanning and structural chunking can grow without expanding tool-handler complexity.
- Structured git-diff fallbacks preserve a non-fatal reindex path and make fallback reasons reportable.
- Pure policy functions are independently testable, including with property-based tests.

### Negative

- The indexer now has several modules and contracts to keep compatible instead of one local implementation.
- The custom glob and gitignore-like implementations intentionally cover the supported subset, not every edge case of third-party matchers.
- Tool integrations must explicitly compose the modules; merely adding a module does not change indexing behavior.

### Neutral

- `.solrcompass-ignore` and `.solrcompass.json` are optional; absent files preserve configured defaults.
- The `git-diff` adapter is the only Wave 1 module that performs subprocess work; all expected operational failures are represented as values.

## Links and References

- Extends: [ADR-0035](./0035-codebase-indexing-as-separate-collection.md)
- Related: [ADR-0052](./0052-client-side-hybrid-search-score-fusion.md)
- Implementation: `kanon/mcp-servers/souk-compass/src/file-scanner.ts`, `project-detector.ts`, `ignore-parser.ts`, `root-config.ts`, `elixir-chunker.ts`, `boost-map.ts`, and `git-diff.ts`
- Spec: `kanon/mcp-servers/souk-compass/.kiro/specs/indexing-improvements/design.md`
