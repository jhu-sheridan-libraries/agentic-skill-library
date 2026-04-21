import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import matter from "gray-matter";
import type { CanonicalHook, McpServerDefinition } from "../schemas";
import type { ImportedFile, ImportParser } from "./types";

/**
 * Derives a kebab-case artifact name from a file path.
 */
function deriveArtifactName(filePath: string): string {
	const base = basename(filePath);
	const name = base.replace(/\.[^.]+$/, "");
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/**
 * Parse CLAUDE.md — a markdown file with optional frontmatter.
 */
async function parseClaudeMd(filePath: string): Promise<ImportedFile> {
	const raw = await readFile(filePath, "utf-8");
	const parsed = matter(raw);

	return {
		sourcePath: filePath,
		artifactName: deriveArtifactName(filePath),
		body: parsed.content.trim(),
		frontmatter: { ...parsed.data },
		hooks: [],
		mcpServers: [],
		extraFields: {},
	};
}

/**
 * Parse .claude/settings.json — extract command entries as agent_stop hooks.
 */
async function parseSettingsJson(filePath: string): Promise<ImportedFile> {
	const raw = await readFile(filePath, "utf-8");
	const data = JSON.parse(raw);

	const hooks: CanonicalHook[] = [];
	const extraFields: Record<string, unknown> = {};
	const knownFields = new Set(["commands", "permissions"]);

	// Extract command entries → CanonicalHook with event: "agent_stop"
	if (data.commands && Array.isArray(data.commands)) {
		for (const cmd of data.commands) {
			if (typeof cmd === "string") {
				hooks.push({
					name: `agent-stop-${cmd.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
					event: "agent_stop",
					action: { type: "run_command", command: cmd },
				});
			} else if (cmd && typeof cmd === "object" && cmd.command) {
				hooks.push({
					name:
						cmd.name ||
						`agent-stop-${cmd.command.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
					description: cmd.description,
					event: "agent_stop",
					action: { type: "run_command", command: cmd.command },
				});
			}
		}
	}

	// Preserve unmapped fields
	for (const [key, value] of Object.entries(data)) {
		if (!knownFields.has(key)) {
			extraFields[key] = value;
		}
	}

	return {
		sourcePath: filePath,
		artifactName: "claude-settings",
		body: "",
		frontmatter: {},
		hooks,
		mcpServers: [],
		extraFields,
	};
}

/**
 * Parse .claude/mcp.json — extract MCP server definitions.
 */
async function parseMcpJson(filePath: string): Promise<ImportedFile> {
	const raw = await readFile(filePath, "utf-8");
	const data = JSON.parse(raw);

	const mcpServers: McpServerDefinition[] = [];
	const extraFields: Record<string, unknown> = {};

	if (data.mcpServers && typeof data.mcpServers === "object") {
		for (const [name, config] of Object.entries(data.mcpServers)) {
			const cfg = config as Record<string, unknown>;
			mcpServers.push({
				name,
				command: (cfg.command as string) || "",
				args: (cfg.args as string[]) || [],
				env: (cfg.env as Record<string, string>) || {},
			});
		}
	} else if (Array.isArray(data)) {
		for (const entry of data) {
			if (entry && typeof entry === "object" && entry.name && entry.command) {
				mcpServers.push({
					name: entry.name,
					command: entry.command,
					args: entry.args || [],
					env: entry.env || {},
				});
			}
		}
	} else {
		// Preserve entire content as extra if structure is unrecognized
		extraFields.rawContent = data;
	}

	return {
		sourcePath: filePath,
		artifactName: "claude-mcp",
		body: "",
		frontmatter: {},
		hooks: [],
		mcpServers,
		extraFields,
	};
}

/**
 * Claude Code import parser.
 * Handles CLAUDE.md, .claude/settings.json, and .claude/mcp.json.
 */
export const parseClaudeCode: ImportParser = async (
	filePath: string,
): Promise<ImportedFile> => {
	if (filePath.endsWith("settings.json")) {
		return parseSettingsJson(filePath);
	}
	if (filePath.endsWith("mcp.json")) {
		return parseMcpJson(filePath);
	}
	return parseClaudeMd(filePath);
};

export default parseClaudeCode;
