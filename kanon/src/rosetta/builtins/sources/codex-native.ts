/**
 * Rosetta Stone — Codex Harness-Native Source Translator
 *
 * Translates Codex's native format (AGENTS.md, skills, TOML MCP config)
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
	normalizeDocumentOrder,
	SourceAccountant,
} from "../../source-accounting";

// ═══════════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════════════

function isAgentsMd(path: string): boolean {
	return path === "AGENTS.md" || path.endsWith("/AGENTS.md");
}

function isSkillMd(path: string): boolean {
	return path.endsWith("SKILL.md");
}

function isConfigToml(path: string): boolean {
	return path.endsWith("config.toml");
}

function isMarkdownDoc(path: string): boolean {
	return path.endsWith(".md");
}

/**
 * Derives a kebab-case artifact name from a document path.
 * For SKILL.md files, prefers the parent directory name.
 * For AGENTS.md, uses "codex-agents".
 */
function deriveArtifactName(path: string): string {
	const segments = path.split("/");
	const base = segments[segments.length - 1] ?? "";
	let name = base.replace(/\.[^.]+$/, "");

	// .codex/skills/<name>/SKILL.md → use the skill directory name
	if (name.toLowerCase() === "skill" && segments.length >= 2) {
		name = segments[segments.length - 2];
	}

	// AGENTS.md → stable descriptive name
	if (name.toLowerCase() === "agents") {
		name = "codex-agents";
	}

	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/**
 * Parse a markdown file with optional frontmatter.
 */
function parseMarkdownContent(
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
 * Parse `.codex/config.toml` — extract [mcp_servers.<name>] tables.
 *
 * This is a deliberately small TOML reader scoped to the mcp_servers section.
 * It understands `command = "..."`, `args = [...]`, and `env = { K = "v" }`.
 */
function parseConfigTomlDocument(
	doc: SourceDocument,
	_diagnostics: TranslationDiagnostic[],
): McpServerDefinition[] {
	const content =
		typeof doc.content === "string"
			? doc.content
			: new TextDecoder().decode(doc.content);

	const lines = content.split(/\r?\n/);
	const mcpServers: McpServerDefinition[] = [];

	let current: {
		name: string;
		command?: string;
		url?: string;
		args: string[];
		env: Record<string, string>;
		timeout?: number;
	} | null = null;

	const flush = () => {
		if (!current) return;
		if (current.command) {
			mcpServers.push({
				name: current.name,
				transport: "stdio",
				command: current.command,
				args: current.args,
				env: current.env,
				...(current.timeout !== undefined ? { timeout: current.timeout } : {}),
			});
		} else if (current.url) {
			mcpServers.push({
				name: current.name,
				transport: "sse",
				url: current.url,
				env: current.env,
				...(current.timeout !== undefined ? { timeout: current.timeout } : {}),
			});
		}
		current = null;
	};

	const parseStringArray = (value: string): string[] => {
		const inner = value.trim().replace(/^\[/, "").replace(/\]$/, "");
		if (!inner.trim()) return [];
		return inner
			.split(",")
			.map((s) => s.trim().replace(/^["']|["']$/g, ""))
			.filter((s) => s.length > 0);
	};

	const parseInlineTable = (value: string): Record<string, string> => {
		const env: Record<string, string> = {};
		const inner = value.trim().replace(/^\{/, "").replace(/\}$/, "");
		for (const pair of inner.split(",")) {
			const eq = pair.indexOf("=");
			if (eq === -1) continue;
			const k = pair
				.slice(0, eq)
				.trim()
				.replace(/^["']|["']$/g, "");
			const v = pair
				.slice(eq + 1)
				.trim()
				.replace(/^["']|["']$/g, "");
			if (k) env[k] = v;
		}
		return env;
	};

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;

		const tableMatch = trimmed.match(/^\[mcp_servers\.([^\]]+)\]$/);
		if (tableMatch) {
			flush();
			current = {
				name: tableMatch[1].replace(/^["']|["']$/g, ""),
				args: [],
				env: {},
			};
			continue;
		}

		// Leaving the mcp_servers section
		if (trimmed.startsWith("[") && !trimmed.startsWith("[mcp_servers")) {
			flush();
			continue;
		}

		if (!current) continue;

		const eq = trimmed.indexOf("=");
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		const value = trimmed.slice(eq + 1).trim();

		if (key === "command") {
			current.command = value.replace(/^["']|["']$/g, "");
		} else if (key === "url") {
			current.url = value.replace(/^["']|["']$/g, "");
		} else if (key === "args") {
			current.args = parseStringArray(value);
		} else if (key === "env") {
			current.env = parseInlineTable(value);
		} else if (key === "startup_timeout_ms") {
			const parsed = Number(value);
			if (Number.isFinite(parsed)) current.timeout = parsed;
		}
	}
	flush();

	return mcpServers;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Exported Translator
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Codex harness-native source translator.
 *
 * Consumes:
 * - AGENTS.md → body content becomes the artifact body
 * - SKILL.md files under .codex/skills/ or .agents/skills/
 * - .codex/config.toml → TOML MCP server configuration
 *
 * Sets type: "rule" and harnesses: ["codex"]
 */
export function translateCodexNative(
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
	const agentsMdDocs = sorted.filter((d) => isAgentsMd(d.path));
	const skillDocs = sorted.filter(
		(d) => isSkillMd(d.path) && !isAgentsMd(d.path),
	);
	const tomlDocs = sorted.filter((d) => isConfigToml(d.path));
	// Other markdown docs that aren't AGENTS.md or SKILL.md
	const otherMdDocs = sorted.filter(
		(d) =>
			isMarkdownDoc(d.path) &&
			!isAgentsMd(d.path) &&
			!isSkillMd(d.path) &&
			!isConfigToml(d.path),
	);

	// Pick the primary document: prefer AGENTS.md, fall back to SKILL.md
	const primaryDoc = agentsMdDocs[0] ?? skillDocs[0];

	// Handle missing primary file
	if (!primaryDoc) {
		diagnostics.push(
			createDiagnostic("RS_CANONICAL_MISSING_KNOWLEDGE_MD", {
				formatId: context.format.id,
				message: "No AGENTS.md or SKILL.md file found in the document set.",
			}),
		);
		return {
			diagnostics,
			consumedPaths: accountant.getConsumedPaths(),
			preservedPaths: accountant.getPreservedPaths(),
		};
	}

	// Parse primary markdown
	const { body, frontmatter } = parseMarkdownContent(primaryDoc, diagnostics);

	accountant.consume(primaryDoc.path);
	accountant.mapField(primaryDoc.path, "content", "body");

	// Mark remaining AGENTS.md and SKILL.md as preserved
	for (let i = 1; i < agentsMdDocs.length; i++) {
		accountant.preserve(agentsMdDocs[i].path);
	}
	for (const skillDoc of skillDocs) {
		if (skillDoc.path !== primaryDoc.path) {
			accountant.preserve(skillDoc.path);
		}
	}

	// Parse TOML MCP config
	const allMcpServers: McpServerDefinition[] = [];
	for (const tomlDoc of tomlDocs) {
		const servers = parseConfigTomlDocument(tomlDoc, diagnostics);
		allMcpServers.push(...servers);
		accountant.consume(tomlDoc.path);
		accountant.mapField(tomlDoc.path, "mcp_servers", "mcpServers");
	}

	// Preserve other markdown docs
	for (const otherDoc of otherMdDocs) {
		accountant.preserve(otherDoc.path);
	}

	// Derive artifact name
	const name = artifactNameHint ?? deriveArtifactName(primaryDoc.path);

	// Build the canonical candidate
	const candidate: Record<string, unknown> = {
		name,
		frontmatter: {
			name,
			...frontmatter,
			type: "rule",
			harnesses: ["codex"],
		},
		body,
		hooks: [],
		mcpServers: allMcpServers,
		workflows: [],
		sourcePath: primaryDoc.path,
		extraFields: {},
		bodyOverrides: {},
	};

	return {
		candidate,
		diagnostics,
		consumedPaths: accountant.getConsumedPaths(),
		preservedPaths: accountant.getPreservedPaths(),
	};
}
