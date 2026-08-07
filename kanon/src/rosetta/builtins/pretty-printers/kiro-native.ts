/**
 * Rosetta Stone — Kiro Native Pretty-Printer
 *
 * Renders a canonical KnowledgeArtifact back into the Kiro native format:
 * - Primary steering markdown (frontmatter + body)
 * - Hook files as JSON
 * - MCP server definitions as JSON
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
import { renderDeterministicYaml } from "../../canonical";
import { codePointCompare, stableJsonStringify } from "../../contracts";
import type {
	SourcePrintOutput,
	SourceTranslatorContext,
} from "../../registry";

// ═══════════════════════════════════════════════════════════════════════════════
// Pretty-Printer
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Pretty-print a canonical KnowledgeArtifact into Kiro native format.
 *
 * Produces:
 * - Primary steering markdown with frontmatter
 * - `hooks/<name>.kiro.hook` JSON files for each hook
 * - `mcp.json` for MCP server definitions
 */
export function prettyPrintKiroNative(
	artifact: Record<string, unknown>,
	_context: SourceTranslatorContext,
): SourcePrintOutput {
	const diagnostics: TranslationDiagnostic[] = [];
	const documents: SourceDocument[] = [];

	const fm = (artifact.frontmatter ?? {}) as Record<string, unknown>;
	const body = (artifact.body as string) ?? "";
	const hooks = (artifact.hooks as CanonicalHook[]) ?? [];
	const mcpServers = (artifact.mcpServers as McpServerDefinition[]) ?? [];
	const name = (artifact.name as string) ?? "unnamed";

	// Build the primary markdown frontmatter
	const steeringFm: Record<string, unknown> = {};
	const STEERING_KEY_ORDER = [
		"name",
		"displayName",
		"description",
		"keywords",
		"author",
		"version",
		"type",
		"harnesses",
		"inclusion",
		"file_patterns",
		"categories",
		"ecosystem",
		"depends",
		"enhances",
		"maturity",
		"trust",
		"audience",
	];

	for (const key of STEERING_KEY_ORDER) {
		if (fm[key] !== undefined) {
			steeringFm[key] = fm[key];
		}
	}
	// Add remaining keys in code-point order
	const remainingKeys = Object.keys(fm)
		.filter((k) => !STEERING_KEY_ORDER.includes(k))
		.sort(codePointCompare);
	for (const key of remainingKeys) {
		if (fm[key] !== undefined) {
			steeringFm[key] = fm[key];
		}
	}

	// Render primary markdown
	const frontmatterYaml = renderDeterministicYaml(
		steeringFm,
		STEERING_KEY_ORDER,
	);
	const primaryPath = `${name}.md`;
	const primaryContent = `---\n${frontmatterYaml}---\n${body}\n`;

	documents.push({
		path: primaryPath as NormalizedRelativePath,
		content: primaryContent,
		executable: false,
	});

	// Render hook files as JSON
	const sortedHooks = [...hooks].sort((a, b) =>
		codePointCompare(a.name, b.name),
	);

	for (const hook of sortedHooks) {
		const hookObj: Record<string, unknown> = {
			name: hook.name,
			event: hook.event,
		};
		if (hook.description) hookObj.description = hook.description;
		if (hook.condition) hookObj.condition = hook.condition;
		hookObj.action = hook.action;
		if (hook.gate) hookObj.gate = hook.gate;
		if (hook.postcondition) hookObj.postcondition = hook.postcondition;

		const hookJson = stableJsonStringify(hookObj);
		documents.push({
			path: `hooks/${hook.name}.kiro.hook` as NormalizedRelativePath,
			content: `${hookJson}\n`,
			executable: false,
		});
	}

	// Render MCP server definitions as JSON
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
				serverConfig.type = server.transport;
			}
			if (server.env && Object.keys(server.env).length > 0) {
				serverConfig.env = server.env;
			}
			if (server.timeout !== undefined) {
				serverConfig.timeout = server.timeout;
			}
			mcpObj[server.name] = serverConfig;
		}

		const mcpJson = stableJsonStringify({ mcpServers: mcpObj });
		documents.push({
			path: "mcp.json" as NormalizedRelativePath,
			content: `${mcpJson}\n`,
			executable: false,
		});
	}

	return { documents, diagnostics };
}
