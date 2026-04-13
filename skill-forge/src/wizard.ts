import * as p from "@clack/prompts";
import type { z } from "zod";
import { HARNESS_FORMAT_REGISTRY } from "./format-registry";
import type {
	AssetType,
	CanonicalHook,
	Frontmatter,
	McpServerDefinition,
} from "./schemas";
import {
	CATEGORIES,
	CanonicalEventSchema,
	CanonicalHookSchema,
	FrontmatterSchema,
	McpServerDefinitionSchema,
	SUPPORTED_HARNESSES,
} from "./schemas";

/** Collected wizard results — everything needed to write files. */
export interface WizardResult {
	frontmatter: Frontmatter;
	knowledgeBody: string;
	hooks: CanonicalHook[];
	mcpServers: McpServerDefinition[];
}

/**
 * Split a comma-separated string into a trimmed, non-empty array.
 */
export function parseCommaSeparated(input: string): string[] {
	return input
		.split(",")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

/**
 * Parse `KEY=VALUE,KEY=VALUE` format into a record.
 * Entries without an `=` sign are silently skipped.
 */
export function parseKeyValuePairs(input: string): Record<string, string> {
	const result: Record<string, string> = {};
	const entries = parseCommaSeparated(input);
	for (const entry of entries) {
		const eqIndex = entry.indexOf("=");
		if (eqIndex === -1) continue;
		const key = entry.slice(0, eqIndex).trim();
		const value = entry.slice(eqIndex + 1).trim();
		if (key.length > 0) {
			result[key] = value;
		}
	}
	return result;
}

/**
 * Run a Zod schema's `.safeParse()` on a value.
 * Returns `undefined` on success, or a user-friendly error message string on failure.
 * Designed to be used directly as a `@clack/prompts` validate callback return value.
 */
export function validateField<T>(
	schema: z.ZodType<T>,
	value: unknown,
): string | undefined {
	const result = schema.safeParse(value);
	if (result.success) {
		return undefined;
	}
	const messages = result.error.issues.map((issue) => issue.message);
	return messages.join("; ");
}

/**
 * Check if the user cancelled a prompt. If so, display a message and exit.
 */
export function handleCancel(value: unknown): void {
	if (p.isCancel(value)) {
		p.cancel("Wizard cancelled. Your scaffold files remain intact.");
		process.exit(0);
	}
}

const ASSET_TYPE_DESCRIPTIONS: Record<AssetType, string> = {
	skill: "General-purpose knowledge injected into AI context",
	power: "Kiro capability bundle (POWER.md + steering dir)",
	rule: "Lint-style rules for harnesses that support them",
	workflow: "Step-by-step process guide with workflow files",
	agent: "Agent definition with hooks and MCP tools",
	prompt: "Reusable prompt template",
	template: "Reference scaffold or boilerplate",
	"reference-pack": "Background reference (included on demand only)",
};

/**
 * Collect all frontmatter fields via interactive prompts.
 * Returns a validated Frontmatter object.
 *
 * @param preSelectedType - If provided, skip the type prompt and use this value.
 */
export async function promptFrontmatter(
	name: string,
	displayName: string,
	preSelectedType?: AssetType,
): Promise<Frontmatter> {
	const description = await p.text({
		message: "Describe your artifact in a sentence or two",
		validate: (val) => {
			return validateField(FrontmatterSchema.shape.description, val);
		},
	});
	handleCancel(description);

	const keywordsRaw = await p.text({
		message: "Keywords (comma-separated, e.g. react, testing, hooks)",
		validate: (val) => {
			const parsed = parseCommaSeparated(val ?? "");
			return validateField(FrontmatterSchema.shape.keywords, parsed);
		},
	});
	handleCancel(keywordsRaw);

	const author = await p.text({
		message: "Author name",
		validate: (val) => {
			return validateField(FrontmatterSchema.shape.author, val);
		},
	});
	handleCancel(author);

	// Type selection — skip if pre-selected via --type flag
	let selectedType: AssetType;
	if (preSelectedType) {
		selectedType = preSelectedType;
	} else {
		const typeOptions = (
			Object.keys(ASSET_TYPE_DESCRIPTIONS) as AssetType[]
		).map((t) => ({
			value: t,
			label: t,
			hint: ASSET_TYPE_DESCRIPTIONS[t],
		}));
		const typeRaw = await p.select({
			message: "What kind of artifact is this?",
			options: typeOptions,
			initialValue: "skill" as AssetType,
		});
		handleCancel(typeRaw);
		selectedType = typeRaw as AssetType;
	}

	const inclusion = await p.select({
		message: "When should this artifact be included?",
		options: [
			{
				value: "always" as const,
				label: "always",
				hint: "Included in every AI session automatically",
			},
			{
				value: "fileMatch" as const,
				label: "fileMatch",
				hint: "Included only when matching files are open",
			},
			{
				value: "manual" as const,
				label: "manual",
				hint: "Included only when explicitly referenced",
			},
		],
	});
	handleCancel(inclusion);

	let filePatterns: string[] | undefined;
	if (inclusion === "fileMatch") {
		const filePatternsRaw = await p.text({
			message: "File patterns to match (comma-separated globs)",
			validate: (val) => {
				const parsed = parseCommaSeparated(val ?? "");
				if (parsed.length === 0) return "At least one file pattern is required";
				return validateField(FrontmatterSchema.shape.file_patterns, parsed);
			},
		});
		handleCancel(filePatternsRaw);
		filePatterns = parseCommaSeparated(filePatternsRaw as string);
	}

	const categories = await p.multiselect({
		message: "Pick the categories that apply",
		options: CATEGORIES.map((cat) => ({
			value: cat,
			label: cat,
		})),
		required: false,
	});
	handleCancel(categories);

	const HARNESS_DESCRIPTIONS: Record<string, string> = {
		kiro: "Steering files or powers for Kiro IDE",
		cursor: "Rule files for Cursor",
		copilot: "Instructions or agents for GitHub Copilot",
		"claude-code": "CLAUDE.md for Claude Code",
		windsurf: "Rule files for Windsurf",
		cline: "Rule files for Cline",
		qdeveloper: "Rules or agents for Amazon Q Developer",
	};

	const harnesses = await p.multiselect({
		message: "Which AI coding tools should this target?",
		options: SUPPORTED_HARNESSES.map((h) => ({
			value: h,
			label: `${h} — ${HARNESS_DESCRIPTIONS[h]}`,
		})),
		initialValues: [...SUPPORTED_HARNESSES],
		required: false,
	});
	handleCancel(harnesses);

	// Per-harness format prompts for multi-format harnesses
	const FORMAT_DESCRIPTIONS: Record<string, Record<string, string>> = {
		kiro: {
			steering: "A markdown knowledge file included in AI context",
			power: "A capability bundle with POWER.md and steering directory",
		},
		copilot: {
			instructions: "A copilot-instructions.md file for GitHub Copilot",
			agent: "An AGENTS.md file for GitHub Copilot agents",
		},
		qdeveloper: {
			rule: "A rule file in .q/rules/",
			agent: "An agent file in .q/agents/",
		},
	};

	const harnessConfig: Record<string, Record<string, unknown>> = {};
	const selectedHarnesses = harnesses as string[];

	for (const harness of selectedHarnesses) {
		const registryEntry =
			HARNESS_FORMAT_REGISTRY[harness as keyof typeof HARNESS_FORMAT_REGISTRY];
		if (registryEntry.formats.length > 1) {
			const formatDescriptions = FORMAT_DESCRIPTIONS[harness];
			const format = await p.select({
				message: `Output format for ${harness}`,
				options: registryEntry.formats.map((f) => ({
					value: f,
					label: f,
					hint: formatDescriptions?.[f] ?? "",
				})),
			});
			handleCancel(format);

			// Only write non-default format selections to keep frontmatter minimal
			if (format !== registryEntry.default) {
				harnessConfig[harness] = { format: format as string };
			}
		}
	}

	const ecosystemRaw = await p.text({
		message: "Ecosystem tags (comma-separated, e.g. typescript, bun, react)",
		validate: (val) => {
			if (!val) return undefined;
			const parsed = parseCommaSeparated(val);
			return validateField(FrontmatterSchema.shape.ecosystem, parsed);
		},
	});
	handleCancel(ecosystemRaw);

	const frontmatter: Frontmatter = {
		name,
		displayName,
		version: "0.1.0",
		description: description as string,
		keywords: parseCommaSeparated(keywordsRaw as string),
		author: author as string,
		type: selectedType,
		inclusion: inclusion as Frontmatter["inclusion"],
		...(filePatterns ? { file_patterns: filePatterns } : {}),
		categories: categories as Frontmatter["categories"],
		harnesses: harnesses as Frontmatter["harnesses"],
		ecosystem: ecosystemRaw ? parseCommaSeparated(ecosystemRaw as string) : [],
		depends: [],
		enhances: [],
		maturity: "experimental",
		"model-assumptions": [],
		collections: [],
		"inherit-hooks": false,
		...(Object.keys(harnessConfig).length > 0
			? { "harness-config": harnessConfig }
			: {}),
	};

	return frontmatter;
}

/**
 * Collect the markdown body content for the knowledge file.
 * Returns the user-provided content, or an empty string if left blank.
 */
export async function promptKnowledgeBody(): Promise<string> {
	const body = await p.text({
		message: "Write your knowledge content (or leave blank to fill in later)",
		defaultValue: "",
	});
	handleCancel(body);

	const trimmed = (body as string).trim();
	return trimmed;
}

const FILE_EVENTS = new Set(["file_edited", "file_created", "file_deleted"]);
const TOOL_EVENTS = new Set(["pre_tool_use", "post_tool_use"]);

/**
 * Collect one hook definition via interactive prompts.
 * Returns the validated hook, or null if the user chooses to skip after a validation failure.
 */
async function promptSingleHook(): Promise<CanonicalHook | null> {
	const event = await p.select({
		message: "Select the event type for this hook",
		options: CanonicalEventSchema.options.map((evt) => ({
			value: evt,
			label: evt,
		})),
	});
	handleCancel(event);

	let filePatterns: string[] | undefined;
	let toolTypes: string[] | undefined;

	if (FILE_EVENTS.has(event as string)) {
		const raw = await p.text({
			message: "File patterns to match (comma-separated globs)",
			validate: (val) => {
				if (!val || val.trim().length === 0)
					return "At least one file pattern is required";
				return undefined;
			},
		});
		handleCancel(raw);
		filePatterns = parseCommaSeparated(raw as string);
	}

	if (TOOL_EVENTS.has(event as string)) {
		const raw = await p.text({
			message: "Tool types to match (comma-separated)",
			validate: (val) => {
				if (!val || val.trim().length === 0)
					return "At least one tool type is required";
				return undefined;
			},
		});
		handleCancel(raw);
		toolTypes = parseCommaSeparated(raw as string);
	}

	const actionType = await p.select({
		message: "Select the action type",
		options: [
			{
				value: "ask_agent" as const,
				label: "ask_agent",
				hint: "Send a prompt to the AI agent",
			},
			{
				value: "run_command" as const,
				label: "run_command",
				hint: "Execute a shell command",
			},
		],
	});
	handleCancel(actionType);

	let action: CanonicalHook["action"];

	if (actionType === "ask_agent") {
		const prompt = await p.text({
			message: "Agent prompt",
			validate: (val) => {
				if (!val || val.trim().length === 0) return "Prompt cannot be empty";
				return undefined;
			},
		});
		handleCancel(prompt);
		action = { type: "ask_agent", prompt: prompt as string };
	} else {
		const command = await p.text({
			message: "Shell command",
			validate: (val) => {
				if (!val || val.trim().length === 0) return "Command cannot be empty";
				return undefined;
			},
		});
		handleCancel(command);
		action = { type: "run_command", command: command as string };
	}

	const hookName = await p.text({
		message: "Hook name",
		validate: (val) => {
			if (!val || val.trim().length === 0) return "Hook name cannot be empty";
			return undefined;
		},
	});
	handleCancel(hookName);

	const condition: CanonicalHook["condition"] =
		filePatterns || toolTypes
			? {
					...(filePatterns ? { file_patterns: filePatterns } : {}),
					...(toolTypes ? { tool_types: toolTypes } : {}),
				}
			: undefined;

	const hook = {
		name: hookName as string,
		event: event as CanonicalHook["event"],
		...(condition ? { condition } : {}),
		action,
	};

	const validation = CanonicalHookSchema.safeParse(hook);
	if (!validation.success) {
		const messages = validation.error.issues.map((i) => i.message).join("; ");
		p.log.error(`Hook validation failed: ${messages}`);
		const retry = await p.confirm({
			message: "Would you like to retry this hook?",
		});
		handleCancel(retry);
		if (retry) {
			return promptSingleHook();
		}
		return null;
	}

	return validation.data;
}

/**
 * Loop collecting hook definitions until the user declines to add more.
 * Returns an array of validated hooks (may be empty).
 */
export async function promptHooks(): Promise<CanonicalHook[]> {
	const hooks: CanonicalHook[] = [];

	let addHook = await p.confirm({
		message: "Would you like to add a hook?",
	});
	handleCancel(addHook);

	while (addHook) {
		const hook = await promptSingleHook();
		if (hook) {
			hooks.push(hook);
		}

		addHook = await p.confirm({
			message: "Would you like to add another hook?",
		});
		handleCancel(addHook);
	}

	return hooks;
}

/**
 * Collect one MCP server definition via interactive prompts.
 * Returns the validated server, or null if the user chooses to skip after a validation failure.
 */
async function promptSingleMcpServer(): Promise<McpServerDefinition | null> {
	const name = await p.text({
		message: "Server name",
		validate: (val) => {
			if (!val || val.trim().length === 0) return "Server name cannot be empty";
			return undefined;
		},
	});
	handleCancel(name);

	const command = await p.text({
		message: "Server command",
		validate: (val) => {
			if (!val || val.trim().length === 0) return "Command cannot be empty";
			return undefined;
		},
	});
	handleCancel(command);

	const argsRaw = await p.text({
		message: "Command arguments (space-separated)",
		defaultValue: "",
	});
	handleCancel(argsRaw);

	const args = (argsRaw as string)
		.split(" ")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);

	const envRaw = await p.text({
		message: "Environment variables (KEY=VALUE, comma-separated)",
		defaultValue: "",
	});
	handleCancel(envRaw);

	const env = (envRaw as string).trim()
		? parseKeyValuePairs(envRaw as string)
		: {};

	const server = {
		name: name as string,
		command: command as string,
		args,
		env,
	};

	const validation = McpServerDefinitionSchema.safeParse(server);
	if (!validation.success) {
		const messages = validation.error.issues.map((i) => i.message).join("; ");
		p.log.error(`MCP server validation failed: ${messages}`);
		const retry = await p.confirm({
			message: "Would you like to retry this MCP server?",
		});
		handleCancel(retry);
		if (retry) {
			return promptSingleMcpServer();
		}
		return null;
	}

	return validation.data;
}

/**
 * Loop collecting MCP server definitions until the user declines to add more.
 * Returns an array of validated MCP servers (may be empty).
 */
export async function promptMcpServers(): Promise<McpServerDefinition[]> {
	const servers: McpServerDefinition[] = [];

	let addServer = await p.confirm({
		message: "Would you like to add an MCP server?",
	});
	handleCancel(addServer);

	while (addServer) {
		const server = await promptSingleMcpServer();
		if (server) {
			servers.push(server);
		}

		addServer = await p.confirm({
			message: "Would you like to add another MCP server?",
		});
		handleCancel(addServer);
	}

	return servers;
}

/**
 * Run the full interactive wizard.
 * Orchestrates the prompt flow: intro → frontmatter → knowledge body → hooks → MCP servers.
 */
export async function runWizard(
	artifactName: string,
	displayName: string,
	preSelectedType?: AssetType,
): Promise<WizardResult> {
	p.intro(`Configuring artifact: ${displayName}`);

	const frontmatter = await promptFrontmatter(
		artifactName,
		displayName,
		preSelectedType,
	);
	const knowledgeBody = await promptKnowledgeBody();
	const hooks = await promptHooks();
	const mcpServers = await promptMcpServers();

	return {
		frontmatter,
		knowledgeBody,
		hooks,
		mcpServers,
	};
}
