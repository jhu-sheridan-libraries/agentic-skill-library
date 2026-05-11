# ADR 035: Transport-discriminated MCP server schema with shared config builder

## Status

Accepted

## Date

2026-05-05

## Context

The original `McpServerDefinitionSchema` assumed all MCP servers are stdio-based (command + args). However, the MCP ecosystem now supports URL-based servers using SSE (Server-Sent Events) and HTTP streamable transports. Kiro's own `mcp.json` format already supports both `command`/`args` and `url`/`headers` shapes.

Additionally, each harness adapter contained duplicated logic for converting canonical MCP server definitions into harness-native `mcp.json` format. This duplication meant every adapter needed updating when the schema changed.

## Decision

### 1. Split the MCP server schema into a transport-discriminated union

The `McpServerDefinitionSchema` is now a Zod discriminated union of two variants:

- **`StdioMcpServerSchema`** — `transport: "stdio"`, requires `command` and `args`
- **`UrlMcpServerSchema`** — `transport: "sse" | "http"`, requires `url`

A Zod preprocessor infers the transport from shape when not explicitly provided:
- Has `url` field → defaults to `"sse"`
- Has `command` field → defaults to `"stdio"`

Type guards `isStdioServer()` and `isUrlServer()` provide safe narrowing.

Both variants gained optional fields: `timeout`, `autoApprove`, `disabled`.

### 2. Extract shared `buildMcpConfig` utility

A single `buildMcpConfig(servers: McpServerDefinition[])` function in `adapters/types.ts` handles conversion from canonical format to harness-native `mcpServers` JSON for both transport types. All adapters (kiro, claude-code, cursor, windsurf, cline, qdeveloper) now delegate to this function instead of inlining the conversion.

### 3. Update importers to handle both shapes

The Claude Code importer (`importers/claude-code.ts`) now detects whether an MCP config entry has a `url` or `command` field and produces the appropriate typed server definition.

## Consequences

### Positive

- URL-based MCP servers (SSE, HTTP streamable) are now first-class citizens in the canonical format
- Existing stdio-based `mcp-servers.yaml` files continue to work without changes (preprocessor infers transport)
- Single point of change for MCP config generation — adapters no longer duplicate this logic
- Type guards make it safe to handle transport-specific fields without casts
- `autoApprove` and `disabled` fields are preserved through the pipeline (previously lost)

### Negative

- The `McpServerDefinition` type is now a union, requiring type narrowing in code that accesses transport-specific fields
- The preprocessor adds a layer of indirection to schema parsing

### Risks

- If a future MCP transport type is added, the preprocessor's inference logic may need updating
- The `"sse"` default for URL-based servers may not be correct for all cases (HTTP streamable is newer)

## Alternatives Considered

1. **Separate `mcp-servers-url.yaml` file** — Rejected; adds file proliferation and splits a single concept across files
2. **Optional fields on a single flat schema** — Rejected; loses type safety and makes it unclear which fields apply to which transport
3. **Keep adapter-local MCP config generation** — Rejected; the duplication was already causing drift between adapters
