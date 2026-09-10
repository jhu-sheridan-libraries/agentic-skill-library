/**
 * Rosetta Stone — Gemini CLI Harness-Native Source Translator
 *
 * Translates Gemini CLI's native format (GEMINI.md, .gemini/settings.json)
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

function isGeminiMd(path: string): boolean {
	return path === "GEMINI.md" || path.endsWith("/GEMINI.md");
}

function isSettingsJson(path: string): boolean {
	return path.endsWith("settings.json");
}

/**
 * Parse GEMINI.md — markdown with optional frontmatter.
 */
function parseGeminiMd(
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
 * Parse .gemini/settings.json — extract MCP server definitions from the
 * "mcpServers" object and preserve unmapped settings as namespaced extra fields.
 */
function parseSettingsDocument(
	doc: SourceDocument,
	formatId: string,
	diagnostics: TranslationDiagnostic[],
): { mcpServers: McpServerDefinition[]; extraFields: Record<string, unknown> } {
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
		return { mcpServers: [], extraFields: {} };
	}

	const servers: McpServerDefinition[] = [];
	const mcpServers = (data.mcpServers ?? {}) as Record<string, unknown>;
	for (const [name, config] of Object.entries(mcpServers)) {
		if (!config || typeof config !== "object") continue;
		const cfg = config as Record<string, unknown>;
		if (cfg.url || cfg.httpUrl) {
			const transport = cfg.httpUrl ? ("http" as const) : ("sse" as const);
			servers.push({
				name,
				transport,
				url: (cfg.httpUrl ?? cfg.url) as string,
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

	// Preserve unmapped settings fields as namespaced extra data
	const extraFields: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(data)) {
		if (key === "mcpServers") continue;
		extraFields[namespacedExtraField(formatId, doc.path, key)] = value;
	}

	return { mcpServers: servers, extraFields };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Exported Translator
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Gemini CLI harness-native source translator.
 *
 * Consumes:
 * - GEMINI.md → body content becomes the artifact body
 * - .gemini/settings.json → extracts MCP server definitions and preserves
 *   remaining settings as extra fields
 *
 * Sets type: "rule" and harnesses: ["gemini-cli"]
 */
export function translateGeminiCliNative(
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
	const geminiMdDocs = sorted.filter((d) => isGeminiMd(d.path));
	const settingsDocs = sorted.filter((d) => isSettingsJson(d.path));

	// Handle missing primary file
	if (geminiMdDocs.length === 0) {
		diagnostics.push(
			createDiagnostic("RS_CANONICAL_MISSING_KNOWLEDGE_MD", {
				formatId: context.format.id,
				message: "No GEMINI.md file found in the document set.",
			}),
		);
		return {
			diagnostics,
			consumedPaths: accountant.getConsumedPaths(),
			preservedPaths: accountant.getPreservedPaths(),
		};
	}

	// Parse primary GEMINI.md
	const primaryDoc = geminiMdDocs[0];
	const { body, frontmatter } = parseGeminiMd(primaryDoc, diagnostics);

	accountant.consume(primaryDoc.path);
	accountant.mapField(primaryDoc.path, "content", "body");

	// Mark additional GEMINI.md files as preserved
	for (let i = 1; i < geminiMdDocs.length; i++) {
		accountant.preserve(geminiMdDocs[i].path);
	}

	// Parse settings files
	const allMcpServers: McpServerDefinition[] = [];
	const allExtraFields: Record<string, unknown> = {};
	for (const settingsDoc of settingsDocs) {
		const { mcpServers, extraFields } = parseSettingsDocument(
			settingsDoc,
			context.format.id,
			diagnostics,
		);
		allMcpServers.push(...mcpServers);
		Object.assign(allExtraFields, extraFields);
		accountant.consume(settingsDoc.path);
		accountant.mapField(settingsDoc.path, "mcpServers", "mcpServers");
		accountant.mapField(settingsDoc.path, "settings", "extraFields");
	}

	// Derive artifact name
	const name = artifactNameHint ?? "gemini";

	// Build the canonical candidate
	const candidate: Record<string, unknown> = {
		name,
		frontmatter: {
			name,
			...frontmatter,
			type: "rule",
			harnesses: ["gemini-cli"],
		},
		body,
		hooks: [],
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
