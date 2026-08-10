/**
 * Rosetta Stone — Kiro Target Translator
 *
 * Wraps the existing kiro adapter logic with resolved variants, body overrides,
 * template bundles, effective compatibility actions, structured diagnostics,
 * and deterministic TranslationPlan output.
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - Pure function only
 *
 * Requirements: 6.1, 6.5, 6.6, 7.3, 7.5, 13.8
 */

import type {
	DegradationRecord,
	KnowledgeArtifact,
	OutputFile,
	TranslationDiagnostic,
} from "../../../schemas";
import {
	evaluateCompatibility,
	identifyUsedCapabilities,
	resolveEffectiveProfile,
} from "../../compatibility";
import { createPlan } from "../../plan";
import type {
	TargetTranslationOutput,
	TargetTranslatorContext,
} from "../../registry";

// ═══════════════════════════════════════════════════════════════════════════════
// Kiro Target Translator
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Translate a canonical KnowledgeArtifact into Kiro harness-native output.
 *
 * Handles both `steering` and `power` variants:
 * - steering: produces a steering .md file plus hooks and MCP config
 * - power: produces POWER.md, steering files, workflows, hooks, and MCP config
 *
 * Uses the template bundle for all rendering and applies body overrides
 * when available for the "kiro" harness.
 */
export function translateKiroTarget(
	artifact: Record<string, unknown>,
	context: TargetTranslatorContext,
): TargetTranslationOutput {
	const diagnostics: TranslationDiagnostic[] = [];
	const degradations: DegradationRecord[] = [];

	const art = artifact as unknown as KnowledgeArtifact;
	const { format, variant, canonicalSchemaVersion, templates } = context;

	// Resolve body override for kiro harness
	const body = art.bodyOverrides?.kiro ?? art.body;

	// Evaluate compatibility
	const variantContract = format.variants[variant];
	const effectiveProfile = resolveEffectiveProfile(format, variantContract);
	const usedCapabilities = identifyUsedCapabilities(art);
	const evaluation = evaluateCompatibility(
		effectiveProfile,
		usedCapabilities,
		art,
	);
	diagnostics.push(...evaluation.diagnostics);
	degradations.push(...evaluation.degradations);

	// Resolve harness-config for kiro
	const harnessConfig = (art.frontmatter as Record<string, unknown>)[
		"harness-config"
	] as Record<string, unknown> | undefined;
	const kiroConfig = (harnessConfig?.kiro ?? {}) as Record<string, unknown>;

	// Render output files
	const outputFiles: OutputFile[] = [];

	if (variant === "power") {
		// Generate POWER.md
		const powerContent = templates.render("kiro/power.md.njk", {
			artifact: art,
			harnessConfig: kiroConfig,
			body,
		});
		outputFiles.push({
			relativePath: "POWER.md",
			content: powerContent,
			executable: false,
		});

		// Workflow files under steering/
		for (const wf of art.workflows) {
			outputFiles.push({
				relativePath: `steering/${wf.filename}`,
				content: wf.content,
				executable: false,
			});
		}

		// Main steering .md file (unless suppressed)
		const emitMainSteering = kiroConfig["main-steering"] !== false;
		if (emitMainSteering) {
			const steeringContent = templates.render("kiro/power-steering.md.njk", {
				artifact: art,
				harnessConfig: kiroConfig,
				body,
			});
			outputFiles.push({
				relativePath: `steering/${art.name}.md`,
				content: steeringContent,
				executable: false,
			});
		}
	} else {
		// steering variant (default)
		const steeringContent = templates.render("kiro/steering.md.njk", {
			artifact: art,
			harnessConfig: kiroConfig,
			body,
			inclusion: "manual",
			fileMatchPattern: undefined,
			auditComment: `<!-- forge:kiro-inclusion: manual -->`,
		});
		outputFiles.push({
			relativePath: `${art.name}.md`,
			content: steeringContent,
			executable: false,
		});
	}

	// Generate hook files
	for (const hook of art.hooks) {
		const kiroHook = buildKiroHookData(hook);
		const hookContent = templates.render("kiro/hook.json.njk", {
			hook: kiroHook,
		});
		const hookName = hook.name.toLowerCase().replace(/\s+/g, "-");
		outputFiles.push({
			relativePath: `${hookName}.kiro.hook`,
			content: hookContent,
			executable: false,
		});
	}

	// Handle spec-hooks from harness-config (Kiro-specific extension)
	const specHooks = kiroConfig["spec-hooks"] as
		| Array<Record<string, unknown>>
		| undefined;
	if (specHooks && Array.isArray(specHooks)) {
		for (const specHook of specHooks) {
			const hookContent = templates.render("kiro/hook.json.njk", {
				hook: specHook,
			});
			const hookName = String(specHook.name || "spec-hook")
				.toLowerCase()
				.replace(/\s+/g, "-");
			outputFiles.push({
				relativePath: `${hookName}.kiro.hook`,
				content: hookContent,
				executable: false,
			});
		}
	}

	// Generate mcp.json
	if (art.mcpServers.length > 0) {
		const mcpConfig = buildMcpConfigData(art.mcpServers);
		const mcpContent = templates.render("kiro/mcp.json.njk", {
			mcpConfig,
		});
		outputFiles.push({
			relativePath: "mcp.json",
			content: mcpContent,
			executable: false,
		});
	}

	// Build plan deterministically
	const plan = createPlan(format.id, canonicalSchemaVersion, outputFiles, {
		variant,
	});

	return { plan, diagnostics, degradations };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Internal Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/** Kiro event mapping from canonical events. */
const KIRO_EVENT_MAP: Record<string, string> = {
	file_edited: "fileEdited",
	file_created: "fileCreated",
	file_deleted: "fileDeleted",
	agent_stop: "agentStop",
	prompt_submit: "promptSubmit",
	pre_tool_use: "preToolUse",
	post_tool_use: "postToolUse",
	pre_task: "preTaskExecution",
	post_task: "postTaskExecution",
	user_triggered: "userTriggered",
};

/**
 * Build Kiro hook data structure for template rendering.
 */
function buildKiroHookData(
	hook: KnowledgeArtifact["hooks"][number],
): Record<string, unknown> {
	const kiroEvent = KIRO_EVENT_MAP[hook.event] ?? hook.event;
	const when: Record<string, unknown> = { type: kiroEvent };
	if (hook.condition?.file_patterns?.length) {
		when.patterns = hook.condition.file_patterns;
	}
	if (hook.condition?.tool_types?.length) {
		when.toolTypes = hook.condition.tool_types;
	}

	let then: Record<string, unknown>;
	if (hook.action.type === "ask_agent") {
		then = { type: "askAgent", prompt: hook.action.prompt };
	} else {
		then = { type: "runCommand", command: hook.action.command };
	}

	return {
		name: hook.name,
		version: "1.0.0",
		description: hook.description || "",
		when,
		then,
	};
}

/**
 * Build MCP config data structure for template rendering.
 */
function buildMcpConfigData(
	servers: KnowledgeArtifact["mcpServers"],
): Record<string, unknown> {
	const mcpServers: Record<string, unknown> = {};
	for (const server of servers) {
		if ("command" in server) {
			mcpServers[server.name] = {
				command: server.command,
				args: server.args,
				env: server.env,
				...(server.timeout ? { timeout: server.timeout } : {}),
			};
		} else {
			mcpServers[server.name] = {
				url: server.url,
				...(server.env && Object.keys(server.env).length > 0
					? { env: server.env }
					: {}),
				...(server.timeout ? { timeout: server.timeout } : {}),
			};
		}
	}
	return { mcpServers };
}
