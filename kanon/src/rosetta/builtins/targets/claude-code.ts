/**
 * Rosetta Stone — Claude Code Target Translator
 *
 * Wraps the existing claude-code adapter logic with resolved variants, body
 * overrides, template bundles, effective compatibility actions, structured
 * diagnostics, and deterministic TranslationPlan output.
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
import { createDiagnostic } from "../../diagnostics";
import { createPlan } from "../../plan";
import type {
	TargetTranslationOutput,
	TargetTranslatorContext,
} from "../../registry";

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

/** Claude Code supported hook events */
const SUPPORTED_CLAUDE_EVENTS = new Set(["agent_stop"]);

// ═══════════════════════════════════════════════════════════════════════════════
// Claude Code Target Translator
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Translate a canonical KnowledgeArtifact into Claude Code harness-native output.
 *
 * Renders CLAUDE.md output, handles MCP server configuration (.claude/mcp.json),
 * and translates agent_stop hooks to .claude/settings.json.
 *
 * Applies body overrides for "claude-code" harness when available.
 */
export function translateClaudeCodeTarget(
	artifact: Record<string, unknown>,
	context: TargetTranslatorContext,
): TargetTranslationOutput {
	const diagnostics: TranslationDiagnostic[] = [];
	const degradations: DegradationRecord[] = [];

	const art = artifact as unknown as KnowledgeArtifact;
	const { format, variant, canonicalSchemaVersion, templates } = context;

	// Resolve body override for claude-code harness
	const body = art.bodyOverrides?.["claude-code"] ?? art.body;

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

	// Render output files
	const outputFiles: OutputFile[] = [];

	// Generate CLAUDE.md via template
	const claudeContent = templates.render("claude-code/claude.md.njk", {
		artifact: art,
		body,
	});
	outputFiles.push({
		relativePath: "CLAUDE.md",
		content: claudeContent,
		executable: false,
	});

	// Translate agent_stop + run_command hooks to .claude/settings.json
	const stopHooks: Array<{ command: string }> = [];
	for (const hook of art.hooks) {
		if (!SUPPORTED_CLAUDE_EVENTS.has(hook.event)) {
			diagnostics.push(
				createDiagnostic("RS_COMPATIBILITY_PARTIAL", {
					formatId: format.id,
					message: `Hook "${hook.name}" uses event "${hook.event}" which is not supported by Claude Code. Skipped.`,
					remediation:
						"Only agent_stop hooks with run_command actions are supported.",
					canonical: {
						artifactName: art.name,
						fieldPath: "hooks",
					},
				}),
			);
			continue;
		}
		if (hook.action.type === "run_command") {
			stopHooks.push({ command: hook.action.command });
		}
	}

	if (stopHooks.length > 0) {
		const settings = {
			hooks: {
				stop: stopHooks.map((h) => ({ type: "command", command: h.command })),
			},
		};
		const settingsContent = templates.render("claude-code/settings.json.njk", {
			settings,
		});
		outputFiles.push({
			relativePath: ".claude/settings.json",
			content: settingsContent,
			executable: false,
		});
	}

	// Generate .claude/mcp.json
	if (art.mcpServers.length > 0) {
		const mcpConfig = buildMcpConfigData(art.mcpServers);
		const mcpContent = templates.render("claude-code/mcp.json.njk", {
			mcpConfig,
		});
		outputFiles.push({
			relativePath: ".claude/mcp.json",
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

/**
 * Build MCP config data structure for Claude Code template rendering.
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
