/**
 * Rosetta Stone — Codex Native Pretty-Printer
 *
 * Renders a canonical KnowledgeArtifact back into Codex native format:
 * - `AGENTS.md` body
 * - `.codex/config.toml` from mcpServers (TOML format)
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - Pure function only
 *
 * Requirements: 5.4, 12.4, 16.2
 */

import type {
	McpServerDefinition,
	NormalizedRelativePath,
	SourceDocument,
	TranslationDiagnostic,
} from "../../../schemas";
import { codePointCompare } from "../../contracts";
import type {
	SourcePrintOutput,
	SourceTranslatorContext,
} from "../../registry";

// ═══════════════════════════════════════════════════════════════════════════════
// TOML Rendering Helper
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Render MCP server definitions as TOML [mcp_servers.<name>] tables.
 */
function renderMcpToml(servers: McpServerDefinition[]): string {
	const lines: string[] = [];

	for (const server of servers) {
		lines.push(`[mcp_servers.${quoteTomlKey(server.name)}]`);

		if (server.transport === "stdio") {
			lines.push(`command = ${quoteTomlString(server.command ?? "")}`);
			if (server.args && server.args.length > 0) {
				const argsStr = server.args.map(quoteTomlString).join(", ");
				lines.push(`args = [${argsStr}]`);
			}
		} else if (server.url) {
			lines.push(`url = ${quoteTomlString(server.url)}`);
		}

		if (server.env && Object.keys(server.env).length > 0) {
			const envEntries = Object.keys(server.env)
				.sort(codePointCompare)
				.map((k) => `${quoteTomlKey(k)} = ${quoteTomlString(server.env?.[k])}`)
				.join(", ");
			lines.push(`env = { ${envEntries} }`);
		}

		if (server.timeout !== undefined) {
			lines.push(`startup_timeout_ms = ${server.timeout}`);
		}

		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Quote a string for TOML output.
 */
function quoteTomlString(value: string): string {
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Quote a TOML key if it contains special characters.
 */
function quoteTomlKey(key: string): string {
	if (/^[a-zA-Z0-9_-]+$/.test(key)) {
		return key;
	}
	return quoteTomlString(key);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Pretty-Printer
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Pretty-print a canonical KnowledgeArtifact into Codex native format.
 *
 * Produces:
 * - `AGENTS.md` with the artifact body
 * - `.codex/config.toml` from mcpServers in TOML format
 */
export function prettyPrintCodexNative(
	artifact: Record<string, unknown>,
	_context: SourceTranslatorContext,
): SourcePrintOutput {
	const diagnostics: TranslationDiagnostic[] = [];
	const documents: SourceDocument[] = [];

	const body = (artifact.body as string) ?? "";
	const mcpServers = (artifact.mcpServers as McpServerDefinition[]) ?? [];

	// Render AGENTS.md
	documents.push({
		path: "AGENTS.md" as NormalizedRelativePath,
		content: `${body}\n`,
		executable: false,
	});

	// Render .codex/config.toml from mcpServers
	if (mcpServers.length > 0) {
		const sortedServers = [...mcpServers].sort((a, b) =>
			codePointCompare(a.name, b.name),
		);
		const tomlContent = renderMcpToml(sortedServers);
		documents.push({
			path: ".codex/config.toml" as NormalizedRelativePath,
			content: tomlContent,
			executable: false,
		});
	}

	return { documents, diagnostics };
}
