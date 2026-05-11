import type nunjucks from "nunjucks";
import type {
	CapabilityEntry,
	KnowledgeArtifact,
	McpServerDefinition,
} from "../schemas";
import { isStdioServer } from "../schemas";
import type { HarnessCapabilityName } from "./capabilities";

export interface OutputFile {
	relativePath: string;
	content: string;
	executable?: boolean;
}

export interface AdapterWarning {
	artifactName: string;
	harnessName: string;
	message: string;
}

export interface AdapterResult {
	files: OutputFile[];
	warnings: AdapterWarning[];
}

export interface AdapterContext {
	capabilities: Record<HarnessCapabilityName, CapabilityEntry>;
	strict: boolean;
}

export type HarnessAdapter = (
	artifact: KnowledgeArtifact,
	templateEnv: nunjucks.Environment,
	context?: AdapterContext,
) => AdapterResult;

/**
 * Build a harness-native mcpServers config object from canonical server definitions.
 * Handles both stdio (command-based) and URL-based (SSE/HTTP) servers.
 */
export function buildMcpConfig(
	servers: McpServerDefinition[],
): Record<string, unknown> {
	const mcpConfig: Record<string, unknown> = { mcpServers: {} };
	for (const server of servers) {
		if (isStdioServer(server)) {
			const entry: Record<string, unknown> = {
				command: server.command,
				args: server.args,
				env: server.env,
			};
			if (server.timeout) entry.timeout = server.timeout;
			if (server.autoApprove?.length) entry.autoApprove = server.autoApprove;
			if (server.disabled !== undefined) entry.disabled = server.disabled;
			(mcpConfig.mcpServers as Record<string, unknown>)[server.name] = entry;
		} else {
			const entry: Record<string, unknown> = {
				url: server.url,
			};
			if (server.env && Object.keys(server.env).length > 0)
				entry.env = server.env;
			if (server.timeout) entry.timeout = server.timeout;
			if (server.autoApprove?.length) entry.autoApprove = server.autoApprove;
			if (server.disabled !== undefined) entry.disabled = server.disabled;
			(mcpConfig.mcpServers as Record<string, unknown>)[server.name] = entry;
		}
	}
	return mcpConfig;
}
