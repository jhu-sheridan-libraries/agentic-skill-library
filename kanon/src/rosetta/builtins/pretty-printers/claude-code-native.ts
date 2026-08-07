/**
 * Rosetta Stone — Claude Code Native Pretty-Printer
 *
 * Renders a canonical KnowledgeArtifact back into Claude Code native format:
 * - `CLAUDE.md` body
 * - `.claude/settings.json` from hooks (commands)
 * - `.claude/mcp.json` from mcpServers
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - Pure function only
 *
 * Requirements: 5.4, 12.4, 16.2
 */

import type {
	CanonicalHook,
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
 * Pretty-print a canonical KnowledgeArtifact into Claude Code native format.
 *
 * Produces:
 * - `CLAUDE.md` with the artifact body
 * - `.claude/settings.json` from hooks (agent_stop → commands)
 * - `.claude/mcp.json` from mcpServers
 */
export function prettyPrintClaudeCodeNative(
	artifact: Record<string, unknown>,
	_context: SourceTranslatorContext,
): SourcePrintOutput {
	const diagnostics: TranslationDiagnostic[] = [];
	const documents: SourceDocument[] = [];

	const body = (artifact.body as string) ?? "";
	const hooks = (artifact.hooks as CanonicalHook[]) ?? [];
	const mcpServers = (artifact.mcpServers as McpServerDefinition[]) ?? [];

	// Render CLAUDE.md
	documents.push({
		path: "CLAUDE.md" as NormalizedRelativePath,
		content: `${body}\n`,
		executable: false,
	});

	// Render .claude/settings.json from hooks (agent_stop events → commands)
	const commands: string[] = [];
	const sortedHooks = [...hooks].sort((a, b) =>
		codePointCompare(a.name, b.name),
	);

	for (const hook of sortedHooks) {
		if (hook.event === "agent_stop" && hook.action?.type === "run_command") {
			commands.push(hook.action.command);
		}
	}

	if (commands.length > 0) {
		const settingsObj: Record<string, unknown> = { commands };
		const settingsJson = stableJsonStringify(settingsObj);
		documents.push({
			path: ".claude/settings.json" as NormalizedRelativePath,
			content: `${settingsJson}\n`,
			executable: false,
		});
	}

	// Render .claude/mcp.json from mcpServers
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
				serverConfig.url = server.url;
				if (server.transport === "http") {
					serverConfig.type = "http";
				}
			}
			if (server.env && Object.keys(server.env).length > 0) {
				serverConfig.env = server.env;
			}
			if (server.timeout !== undefined) {
				serverConfig.timeout = server.timeout;
			}
			if (server.autoApprove && server.autoApprove.length > 0) {
				serverConfig.autoApprove = server.autoApprove;
			}
			mcpObj[server.name] = serverConfig;
		}

		const mcpJson = stableJsonStringify({ mcpServers: mcpObj });
		documents.push({
			path: ".claude/mcp.json" as NormalizedRelativePath,
			content: `${mcpJson}\n`,
			executable: false,
		});
	}

	return { documents, diagnostics };
}
