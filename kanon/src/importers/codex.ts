import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import matter from "gray-matter";
import type { McpServerDefinition } from "../schemas";
import type { ImportedFile, ImportParser } from "./types";

/**
 * Derives a kebab-case artifact name from a file path.
 * For SKILL.md files, prefers the parent directory name.
 */
function deriveArtifactName(filePath: string): string {
	const parts = filePath.split("/");
	const base = basename(filePath);
	let name = base.replace(/\.[^.]+$/, "");
	// `.codex/skills/<name>/SKILL.md` → use the skill directory name
	if (name.toLowerCase() === "skill" && parts.length >= 2) {
		name = parts[parts.length - 2];
	}
	// `AGENTS.md` → use a stable, descriptive name
	if (name.toLowerCase() === "agents") {
		name = "codex-agents";
	}
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/**
 * Parse an AGENTS.md or SKILL.md file — markdown with optional YAML frontmatter.
 */
async function parseMarkdown(filePath: string): Promise<ImportedFile> {
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
 * Parse `.codex/config.toml` — extract `[mcp_servers.<name>]` tables.
 *
 * This is a deliberately small TOML reader scoped to the mcp_servers section.
 * It understands `command = "..."`, `args = [...]`, and `env = { K = "v" }`.
 */
async function parseConfigToml(filePath: string): Promise<ImportedFile> {
	const raw = await readFile(filePath, "utf-8");
	const lines = raw.split(/\r?\n/);

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
				timeout: current.timeout,
			});
		} else if (current.url) {
			mcpServers.push({
				name: current.name,
				transport: "sse",
				url: current.url,
				env: current.env,
				timeout: current.timeout,
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

	return {
		sourcePath: filePath,
		artifactName: "codex-mcp",
		body: "",
		frontmatter: {},
		hooks: [],
		mcpServers,
		extraFields: {},
	};
}

/**
 * Codex import parser.
 * Handles AGENTS.md, SKILL.md files under .codex/skills and .agents/skills,
 * and `.codex/config.toml`.
 */
export const parseCodex: ImportParser = async (
	filePath: string,
): Promise<ImportedFile> => {
	if (filePath.endsWith("config.toml")) {
		return parseConfigToml(filePath);
	}
	return parseMarkdown(filePath);
};

export default parseCodex;
