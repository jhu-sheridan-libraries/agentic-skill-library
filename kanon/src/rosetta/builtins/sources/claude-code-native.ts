/**
 * Rosetta Stone — Claude Code Harness-Native Source Translator
 *
 * Translates Claude Code's native format (CLAUDE.md, .claude/settings.json)
 * into a canonical KnowledgeArtifact candidate.
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - Pure function only
 *
 * Requirements: 2.9, 4.1, 4.2, 4.3, 4.5, 4.6
 */

import matter from "gray-matter";
import type {
	CanonicalHook,
	McpServerDefinition,
	SourceDocument,
	TranslationDiagnostic,
} from "../../../schemas";
import { createDiagnostic } from "../../diagnostics";
import type {
	SourceTranslationOutput,
	SourceTranslatorContext,
} from "../../registry";
import {
	namespacedExtraField,
	normalizeDocumentOrder,
	SourceAccountant,
} from "../../source-accounting";

// ═══════════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════════════

function isClaudeMd(path: string): boolean {
	return path === "CLAUDE.md" || path.endsWith("/CLAUDE.md");
}

function isSettingsJson(path: string): boolean {
	return path.endsWith("settings.json");
}

function isMcpJson(path: string): boolean {
	return path.endsWith("mcp.json");
}

/**
 * Parse CLAUDE.md — markdown with optional frontmatter.
 */
function parseClaudeMd(
	doc: SourceDocument,
	diagnostics: TranslationDiagnostic[],
): { body: string; frontmatter: Record<string, unknown> } {
	const content =
		typeof doc.content === "string"
			? doc.content
			: new TextDecoder().decode(doc.content);

	try {
		const parsed = matter(content);
		return { body: parsed.content.trim(), frontmatter: { ...parsed.data } };
	} catch {
		diagnostics.push(
			createDiagnostic("RS_CANONICAL_INVALID_FRONTMATTER", {
				message: `Failed to parse frontmatter in "${doc.path}".`,
				source: { path: doc.path },
			}),
		);
		return { body: content.trim(), frontmatter: {} };
	}
}

/**
 * Parse .claude/settings.json — extract command entries as agent_stop hooks
 * and preserve unmapped settings as extra fields.
 */
function parseSettingsDocument(
	doc: SourceDocument,
	formatId: string,
	diagnostics: TranslationDiagnostic[],
): { hooks: CanonicalHook[]; extraFields: Record<string, unknown> } {
	const content =
		typeof doc.content === "string"
			? doc.content
			: new TextDecoder().decode(doc.content);

	let data: Record<string, unknown>;
	try {
		data = JSON.parse(content);
	} catch {
		diagnostics.push(
			createDiagnostic("RS_CANONICAL_INVALID_YAML", {
				message: `Settings file "${doc.path}" contains invalid JSON.`,
				source: { path: doc.path },
			}),
		);
		return { hooks: [], extraFields: {} };
	}

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
			} else if (
				cmd &&
				typeof cmd === "object" &&
				(cmd as Record<string, unknown>).command
			) {
				const cmdObj = cmd as Record<string, unknown>;
				hooks.push({
					name:
						(cmdObj.name as string) ??
						`agent-stop-${(cmdObj.command as string).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
					description: cmdObj.description as string | undefined,
					event: "agent_stop",
					action: { type: "run_command", command: cmdObj.command as string },
				});
			}
		}
	}

	// Preserve unmapped fields as namespaced extra data
	for (const [key, value] of Object.entries(data)) {
		if (!knownFields.has(key)) {
			extraFields[namespacedExtraField(formatId, doc.path, key)] = value;
		}
	}

	// Preserve permissions as extra data too
	if (data.permissions !== undefined) {
		extraFields[namespacedExtraField(formatId, doc.path, "permissions")] =
			data.permissions;
	}

	return { hooks, extraFields };
}

/**
 * Parse .claude/mcp.json — extract MCP server definitions.
 */
function parseMcpJsonDocument(
	doc: SourceDocument,
	diagnostics: TranslationDiagnostic[],
): McpServerDefinition[] {
	const content =
		typeof doc.content === "string"
			? doc.content
			: new TextDecoder().decode(doc.content);

	let data: unknown;
	try {
		data = JSON.parse(content);
	} catch {
		diagnostics.push(
			createDiagnostic("RS_CANONICAL_INVALID_YAML", {
				message: `MCP file "${doc.path}" contains invalid JSON.`,
				source: { path: doc.path },
			}),
		);
		return [];
	}

	const servers: McpServerDefinition[] = [];

	if (data && typeof data === "object" && !Array.isArray(data)) {
		const obj = data as Record<string, unknown>;
		const mcpServers = (obj.mcpServers ?? obj) as Record<string, unknown>;
		for (const [name, config] of Object.entries(mcpServers)) {
			if (!config || typeof config !== "object") continue;
			const cfg = config as Record<string, unknown>;
			if (cfg.url) {
				const transport =
					cfg.type === "http" ? ("http" as const) : ("sse" as const);
				servers.push({
					name,
					transport,
					url: cfg.url as string,
					env: (cfg.env as Record<string, string>) ?? {},
					...(cfg.timeout ? { timeout: cfg.timeout as number } : {}),
					...(cfg.autoApprove
						? { autoApprove: cfg.autoApprove as string[] }
						: {}),
				});
			} else if (cfg.command) {
				servers.push({
					name,
					transport: "stdio" as const,
					command: cfg.command as string,
					args: (cfg.args as string[]) ?? [],
					env: (cfg.env as Record<string, string>) ?? {},
					...(cfg.timeout ? { timeout: cfg.timeout as number } : {}),
					...(cfg.autoApprove
						? { autoApprove: cfg.autoApprove as string[] }
						: {}),
				});
			}
		}
	} else if (Array.isArray(data)) {
		for (const entry of data) {
			if (!entry || typeof entry !== "object") continue;
			const cfg = entry as Record<string, unknown>;
			if (!cfg.name) continue;
			if (cfg.url) {
				servers.push({
					name: cfg.name as string,
					transport:
						cfg.transport === "http" ? ("http" as const) : ("sse" as const),
					url: cfg.url as string,
					env: (cfg.env as Record<string, string>) ?? {},
				});
			} else if (cfg.command) {
				servers.push({
					name: cfg.name as string,
					transport: "stdio" as const,
					command: cfg.command as string,
					args: (cfg.args as string[]) ?? [],
					env: (cfg.env as Record<string, string>) ?? {},
				});
			}
		}
	}

	return servers;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Exported Translator
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Claude Code harness-native source translator.
 *
 * Consumes:
 * - CLAUDE.md → body content becomes the artifact body
 * - .claude/settings.json → extracts hooks and relevant settings as extra fields
 * - .claude/mcp.json → extracts MCP server definitions
 *
 * Sets type: "rule" and harnesses: ["claude-code"]
 */
export function translateClaudeCodeNative(
	documents: readonly SourceDocument[],
	context: SourceTranslatorContext,
): SourceTranslationOutput {
	const accountant = new SourceAccountant();
	const diagnostics: TranslationDiagnostic[] = [];
	const sorted = normalizeDocumentOrder(documents);

	// Determine artifact name from caller context
	const artifactNameHint = context.callerContext.artifactNameHint as
		| string
		| undefined;

	// Classify documents
	const claudeMdDocs = sorted.filter((d) => isClaudeMd(d.path));
	const settingsDocs = sorted.filter((d) => isSettingsJson(d.path));
	const mcpDocs = sorted.filter((d) => isMcpJson(d.path));

	// Handle missing primary file
	if (claudeMdDocs.length === 0) {
		diagnostics.push(
			createDiagnostic("RS_CANONICAL_MISSING_KNOWLEDGE_MD", {
				formatId: context.format.id,
				message: "No CLAUDE.md file found in the document set.",
			}),
		);
		return {
			diagnostics,
			consumedPaths: accountant.getConsumedPaths(),
			preservedPaths: accountant.getPreservedPaths(),
		};
	}

	// Parse primary CLAUDE.md
	const primaryDoc = claudeMdDocs[0];
	const { body, frontmatter } = parseClaudeMd(primaryDoc, diagnostics);

	accountant.consume(primaryDoc.path);
	accountant.mapField(primaryDoc.path, "content", "body");

	// Mark additional CLAUDE.md files as preserved
	for (let i = 1; i < claudeMdDocs.length; i++) {
		accountant.preserve(claudeMdDocs[i].path);
	}

	// Parse settings files
	const allHooks: CanonicalHook[] = [];
	const allExtraFields: Record<string, unknown> = {};

	for (const settingsDoc of settingsDocs) {
		const { hooks, extraFields } = parseSettingsDocument(
			settingsDoc,
			context.format.id,
			diagnostics,
		);
		allHooks.push(...hooks);
		Object.assign(allExtraFields, extraFields);
		accountant.consume(settingsDoc.path);
		accountant.mapField(settingsDoc.path, "commands", "hooks");
		accountant.mapField(settingsDoc.path, "settings", "extraFields");
	}

	// Parse MCP server files
	const allMcpServers: McpServerDefinition[] = [];
	for (const mcpDoc of mcpDocs) {
		const servers = parseMcpJsonDocument(mcpDoc, diagnostics);
		allMcpServers.push(...servers);
		accountant.consume(mcpDoc.path);
		accountant.mapField(mcpDoc.path, "mcpServers", "mcpServers");
	}

	// Derive artifact name
	const name = artifactNameHint ?? "claude";

	// Build the canonical candidate
	const candidate: Record<string, unknown> = {
		name,
		frontmatter: {
			name,
			...frontmatter,
			type: "rule",
			harnesses: ["claude-code"],
		},
		body,
		hooks: allHooks,
		mcpServers: allMcpServers,
		workflows: [],
		sourcePath: primaryDoc.path,
		extraFields: allExtraFields,
		bodyOverrides: {},
	};

	return {
		candidate,
		diagnostics,
		consumedPaths: accountant.getConsumedPaths(),
		preservedPaths: accountant.getPreservedPaths(),
	};
}
