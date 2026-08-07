/**
 * Rosetta Stone — Kiro Harness-Native Source Translator
 *
 * Translates Kiro's native format (.kiro/steering/*.md, hooks, MCP servers)
 * into a canonical KnowledgeArtifact candidate. Handles both "steering" and
 * "power" variants.
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - Pure function only
 *
 * Requirements: 2.9, 4.1, 4.2, 4.3, 4.5, 4.6
 */

import matter from "gray-matter";
import type {
	CanonicalEvent,
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

const KIRO_EVENT_MAP: Record<string, CanonicalEvent> = {
	fileEdited: "file_edited",
	fileCreated: "file_created",
	fileDeleted: "file_deleted",
	agentStop: "agent_stop",
	promptSubmit: "prompt_submit",
	preToolUse: "pre_tool_use",
	postToolUse: "post_tool_use",
	preTaskExecution: "pre_task",
	postTaskExecution: "post_task",
	userTriggered: "user_triggered",
	file_edited: "file_edited",
	file_created: "file_created",
	file_deleted: "file_deleted",
	agent_stop: "agent_stop",
	prompt_submit: "prompt_submit",
	pre_tool_use: "pre_tool_use",
	post_tool_use: "post_tool_use",
	pre_task: "pre_task",
	post_task: "post_task",
	user_triggered: "user_triggered",
};

function mapKiroEvent(rawEvent: string): CanonicalEvent {
	return (KIRO_EVENT_MAP[rawEvent] ?? rawEvent) as CanonicalEvent;
}

/**
 * Derives a kebab-case artifact name from a document path.
 */
function deriveArtifactName(path: string): string {
	const segments = path.split("/");
	const base = segments[segments.length - 1] ?? "";
	const name =
		base.replace(/\.kiro\.hook$/, "") || base.replace(/\.[^.]+$/, "");
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/**
 * Checks if a document is a primary steering/power markdown file.
 */
function isPrimaryMd(path: string): boolean {
	return (
		path.endsWith(".md") &&
		!path.endsWith(".kiro.hook") &&
		!path.includes("hooks/") &&
		!path.includes("mcp-servers")
	);
}

/**
 * Checks if a document is a hook file.
 */
function isHookFile(path: string): boolean {
	return path.endsWith(".kiro.hook") || path.includes("hooks/");
}

/**
 * Checks if a document is an MCP server definition file.
 */
function isMcpFile(path: string): boolean {
	return path.includes("mcp-servers") || path.endsWith("mcp.json");
}

/**
 * Parse a hook from a JSON document.
 */
function parseHookDocument(
	doc: SourceDocument,
	diagnostics: TranslationDiagnostic[],
): CanonicalHook[] {
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
				message: `Hook file "${doc.path}" contains invalid JSON.`,
				source: { path: doc.path },
			}),
		);
		return [];
	}

	if (!data || typeof data !== "object") return [];

	const hooks: CanonicalHook[] = [];
	const hook: Partial<CanonicalHook> = {};

	// Map event
	const rawEvent =
		(data.event as string) ??
		((data.when as Record<string, unknown>)?.event as string);
	if (rawEvent) {
		hook.event = mapKiroEvent(rawEvent);
	}

	// Map action
	const rawAction =
		(data.action as Record<string, unknown>) ??
		(data.then as Record<string, unknown>);
	if (rawAction) {
		if (
			rawAction.type === "run_command" ||
			(rawAction.command && !rawAction.prompt)
		) {
			hook.action = {
				type: "run_command",
				command:
					(rawAction.command as string) ?? (rawAction.prompt as string) ?? "",
			};
		} else if (rawAction.type === "ask_agent" || rawAction.prompt) {
			hook.action = {
				type: "ask_agent",
				prompt:
					(rawAction.prompt as string) ?? (rawAction.command as string) ?? "",
			};
		}
	}

	// Map name and description
	hook.name =
		(data.name as string) ??
		(data.id as string) ??
		deriveArtifactName(doc.path);
	if (data.description) hook.description = data.description as string;

	// Map condition
	const whenObj = data.when as Record<string, unknown> | undefined;
	const conditionObj = data.condition as Record<string, unknown> | undefined;
	const filePatterns =
		(conditionObj?.file_patterns as string[]) ??
		(whenObj?.filePatterns as string[]);
	const toolTypes =
		(conditionObj?.tool_types as string[]) ?? (whenObj?.toolTypes as string[]);

	if (filePatterns || toolTypes) {
		hook.condition = {};
		if (filePatterns) {
			hook.condition.file_patterns = Array.isArray(filePatterns)
				? filePatterns
				: [filePatterns as unknown as string];
		}
		if (toolTypes) {
			hook.condition.tool_types = Array.isArray(toolTypes)
				? toolTypes
				: [toolTypes as unknown as string];
		}
	}

	if (hook.event && hook.action && hook.name) {
		hooks.push(hook as CanonicalHook);
	}

	return hooks;
}

/**
 * Parse MCP server definitions from a JSON document.
 */
function parseMcpDocument(
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
		// Handle { mcpServers: { name: config } } shape
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
				});
			} else if (cfg.command) {
				servers.push({
					name,
					transport: "stdio" as const,
					command: cfg.command as string,
					args: (cfg.args as string[]) ?? [],
					env: (cfg.env as Record<string, string>) ?? {},
					...(cfg.timeout ? { timeout: cfg.timeout as number } : {}),
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
 * Kiro harness-native source translator.
 *
 * Consumes:
 * - Primary steering/power markdown file (frontmatter + body)
 * - Hook files (.kiro.hook JSON → CanonicalHook[])
 * - MCP server definitions (JSON → McpServerDefinition[])
 *
 * Handles both "steering" and "power" variants:
 * - Power: looks for POWER.md/SKILL.md frontmatter structure
 * - Steering: standard steering markdown format
 */
export function translateKiroNative(
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
	const primaryDocs = sorted.filter((d) => isPrimaryMd(d.path));
	const hookDocs = sorted.filter((d) => isHookFile(d.path));
	const mcpDocs = sorted.filter((d) => isMcpFile(d.path));

	// Handle missing primary file
	if (primaryDocs.length === 0) {
		diagnostics.push(
			createDiagnostic("RS_CANONICAL_MISSING_KNOWLEDGE_MD", {
				formatId: context.format.id,
				message:
					"No primary Kiro steering or power markdown file found in the document set.",
			}),
		);
		return {
			diagnostics,
			consumedPaths: accountant.getConsumedPaths(),
			preservedPaths: accountant.getPreservedPaths(),
		};
	}

	// Parse primary markdown (use first matching file)
	const primaryDoc = primaryDocs[0];
	const content =
		typeof primaryDoc.content === "string"
			? primaryDoc.content
			: new TextDecoder().decode(primaryDoc.content);

	let frontmatterData: Record<string, unknown> = {};
	let body = "";

	try {
		const parsed = matter(content);
		frontmatterData = { ...parsed.data };
		body = parsed.content.trim();
	} catch {
		diagnostics.push(
			createDiagnostic("RS_CANONICAL_INVALID_FRONTMATTER", {
				formatId: context.format.id,
				message: `Failed to parse frontmatter in "${primaryDoc.path}".`,
				source: { path: primaryDoc.path },
			}),
		);
		// Continue with empty data — body still available as raw content
		body = content.trim();
	}

	accountant.consume(primaryDoc.path);
	accountant.mapField(primaryDoc.path, "frontmatter", "frontmatter");
	accountant.mapField(primaryDoc.path, "content", "body");

	// Mark additional primary docs as preserved (multi-file sets)
	for (let i = 1; i < primaryDocs.length; i++) {
		accountant.preserve(primaryDocs[i].path);
	}

	// Parse hooks
	const allHooks: CanonicalHook[] = [];
	for (const hookDoc of hookDocs) {
		const hooks = parseHookDocument(hookDoc, diagnostics);
		allHooks.push(...hooks);
		accountant.consume(hookDoc.path);
		accountant.mapField(hookDoc.path, "hooks", "hooks");
	}

	// Parse MCP servers
	const allMcpServers: McpServerDefinition[] = [];
	for (const mcpDoc of mcpDocs) {
		const servers = parseMcpDocument(mcpDoc, diagnostics);
		allMcpServers.push(...servers);
		accountant.consume(mcpDoc.path);
		accountant.mapField(mcpDoc.path, "mcpServers", "mcpServers");
	}

	// Derive artifact name
	const name =
		artifactNameHint ??
		(frontmatterData.name as string) ??
		deriveArtifactName(primaryDoc.path);

	// Build extra fields from source-specific frontmatter keys
	const extraFields: Record<string, unknown> = {};
	const knownFrontmatterKeys = new Set([
		"name",
		"displayName",
		"description",
		"keywords",
		"author",
		"version",
		"harnesses",
		"type",
		"inclusion",
		"file_patterns",
		"categories",
		"ecosystem",
		"depends",
		"enhances",
		"id",
		"license",
		"maturity",
		"trust",
		"risk-level",
		"audience",
		"model-assumptions",
		"successor",
		"replaces",
		"collections",
		"inherit-hooks",
		"visibility",
		"priority",
		"outcomes",
		"harness-config",
		"migrations",
	]);

	for (const [key, value] of Object.entries(frontmatterData)) {
		if (!knownFrontmatterKeys.has(key)) {
			extraFields[
				namespacedExtraField(context.format.id, primaryDoc.path, key)
			] = value;
		}
	}

	// Build the canonical candidate
	const candidate: Record<string, unknown> = {
		name,
		frontmatter: {
			name,
			...frontmatterData,
			type: (frontmatterData.type as string) ?? "skill",
			harnesses: (frontmatterData.harnesses as string[]) ?? ["kiro"],
		},
		body,
		hooks: allHooks,
		mcpServers: allMcpServers,
		workflows: [],
		sourcePath: primaryDoc.path,
		extraFields,
		bodyOverrides: {},
	};

	return {
		candidate,
		diagnostics,
		consumedPaths: accountant.getConsumedPaths(),
		preservedPaths: accountant.getPreservedPaths(),
	};
}
