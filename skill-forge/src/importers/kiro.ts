import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import matter from "gray-matter";
import type { CanonicalHook } from "../schemas";
import type { ImportedFile, ImportParser } from "./types";

/**
 * Derives a kebab-case artifact name from a file path.
 * Uses the filename without extension, already expected to be kebab-case.
 */
function deriveArtifactName(filePath: string): string {
	const base = basename(filePath);
	// Remove all extensions (e.g., ".kiro.hook" → base without extensions)
	const name =
		base.replace(/\.kiro\.hook$/, "") || base.replace(/\.[^.]+$/, "");
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

/**
 * Parse a Kiro steering markdown file (.kiro/steering/*.md).
 * Extracts YAML frontmatter and markdown body.
 */
async function parseSteeringMd(filePath: string): Promise<ImportedFile> {
	const raw = await readFile(filePath, "utf-8");
	const parsed = matter(raw);

	const frontmatter: Record<string, unknown> = { ...parsed.data };
	const body = parsed.content.trim();
	const artifactName = deriveArtifactName(filePath);

	return {
		sourcePath: filePath,
		artifactName,
		body,
		frontmatter,
		hooks: [],
		mcpServers: [],
		extraFields: {},
	};
}

/**
 * Parse a Kiro hook file (.kiro/hooks/*.kiro.hook).
 * These are JSON files that map to CanonicalHook.
 */
async function parseHookFile(filePath: string): Promise<ImportedFile> {
	const raw = await readFile(filePath, "utf-8");
	const data = JSON.parse(raw);
	const artifactName = deriveArtifactName(filePath);

	const hooks: CanonicalHook[] = [];
	const extraFields: Record<string, unknown> = {};

	// Map Kiro hook JSON to CanonicalHook
	if (data && typeof data === "object") {
		const hook: Partial<CanonicalHook> = {};

		// Map event
		if (data.event || data.when?.event) {
			const rawEvent = data.event || data.when?.event;
			hook.event = mapKiroEvent(rawEvent);
		}

		// Map action
		if (data.action || data.then) {
			const rawAction = data.action || data.then;
			if (rawAction?.type === "run_command" || rawAction?.command) {
				hook.action = {
					type: "run_command",
					command: rawAction.command || rawAction.prompt || "",
				};
			} else if (rawAction?.type === "ask_agent" || rawAction?.prompt) {
				hook.action = {
					type: "ask_agent",
					prompt: rawAction.prompt || rawAction.command || "",
				};
			}
		}

		// Map name and description
		hook.name = data.name || data.id || artifactName;
		if (data.description) hook.description = data.description;

		// Map condition
		if (data.condition || data.when?.filePatterns || data.when?.toolTypes) {
			hook.condition = {};
			const filePatterns =
				data.condition?.file_patterns || data.when?.filePatterns;
			const toolTypes = data.condition?.tool_types || data.when?.toolTypes;
			if (filePatterns)
				hook.condition.file_patterns = Array.isArray(filePatterns)
					? filePatterns
					: [filePatterns];
			if (toolTypes)
				hook.condition.tool_types = Array.isArray(toolTypes)
					? toolTypes
					: [toolTypes];
		}

		if (hook.event && hook.action && hook.name) {
			hooks.push(hook as CanonicalHook);
		}

		// Preserve unmapped fields
		const knownFields = new Set([
			"event",
			"when",
			"action",
			"then",
			"name",
			"id",
			"description",
			"condition",
		]);
		for (const [key, value] of Object.entries(data)) {
			if (!knownFields.has(key)) {
				extraFields[key] = value;
			}
		}
	}

	return {
		sourcePath: filePath,
		artifactName,
		body: "",
		frontmatter: {},
		hooks,
		mcpServers: [],
		extraFields,
	};
}

function mapKiroEvent(rawEvent: string): import("../schemas").CanonicalEvent {
	const eventMap: Record<string, string> = {
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
		// Already canonical
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
	return (eventMap[rawEvent] ||
		rawEvent) as import("../schemas").CanonicalEvent;
}

/**
 * Kiro import parser.
 * Handles .kiro/steering/*.md (frontmatter + body) and .kiro/hooks/*.kiro.hook (JSON → CanonicalHook).
 */
export const parseKiro: ImportParser = async (
	filePath: string,
): Promise<ImportedFile> => {
	if (filePath.endsWith(".kiro.hook")) {
		return parseHookFile(filePath);
	}
	return parseSteeringMd(filePath);
};

export default parseKiro;
