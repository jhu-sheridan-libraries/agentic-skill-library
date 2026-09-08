/**
 * Rosetta Stone — Gemini CLI Native Pretty-Printer
 *
 * Renders a canonical KnowledgeArtifact back into Gemini CLI native format:
 * - `GEMINI.md` body
 * - `.gemini/settings.json` from mcpServers
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
import { codePointCompare, stableJsonStringify } from "../../contracts";
import type {
	SourcePrintOutput,
	SourceTranslatorContext,
} from "../../registry";

// ═══════════════════════════════════════════════════════════════════════════════
// Pretty-Printer
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Pretty-print a canonical KnowledgeArtifact into Gemini CLI native format.
 *
 * Produces:
 * - `GEMINI.md` with the artifact body
 * - `.gemini/settings.json` from mcpServers
 */
export function prettyPrintGeminiCliNative(
	artifact: Record<string, unknown>,
	_context: SourceTranslatorContext,
): SourcePrintOutput {
	const diagnostics: TranslationDiagnostic[] = [];
	const documents: SourceDocument[] = [];

	const body = (artifact.body as string) ?? "";
	const mcpServers = (artifact.mcpServers as McpServerDefinition[]) ?? [];

	// Render GEMINI.md
	documents.push({
		path: "GEMINI.md" as NormalizedRelativePath,
		content: `${body}\n`,
		executable: false,
	});

	// Render .gemini/settings.json from mcpServers
	if (mcpServers.length > 0) {
		const mcpObj: Record<string, unknown> = {};
		const sortedServers = [...mcpServers].sort((a, b) =>
			codePointCompare(a.name, b.name),
		);

		for (const server of sortedServers) {
			const serverConfig: Record<string, unknown> = {};
			if (server.transport === "stdio") {
				serverConfig.command = server.command;
				if (server.args && server.args.length > 0) {
					serverConfig.args = server.args;
				}
			} else {
				// Gemini CLI uses "httpUrl" for streamable-HTTP servers.
				serverConfig.httpUrl = server.url;
			}
			if (server.env && Object.keys(server.env).length > 0) {
				serverConfig.env = server.env;
			}
			if (server.timeout !== undefined) {
				serverConfig.timeout = server.timeout;
			}
			mcpObj[server.name] = serverConfig;
		}

		const settingsJson = stableJsonStringify({ mcpServers: mcpObj });
		documents.push({
			path: ".gemini/settings.json" as NormalizedRelativePath,
			content: `${settingsJson}\n`,
			executable: false,
		});
	}

	return { documents, diagnostics };
}
