/**
 * Rosetta Stone — Gemini CLI Target Translator
 *
 * Translates a canonical KnowledgeArtifact into Gemini CLI harness-native
 * output: a GEMINI.md context file and, when MCP servers are declared, a
 * .gemini/settings.json file with an "mcpServers" object.
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
// Gemini CLI Target Translator
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Translate a canonical KnowledgeArtifact into Gemini CLI harness-native output.
 *
 * Renders GEMINI.md and, when MCP servers are present, .gemini/settings.json.
 * Applies body overrides for "gemini-cli" harness when available.
 */
export function translateGeminiCliTarget(
	artifact: Record<string, unknown>,
	context: TargetTranslatorContext,
): TargetTranslationOutput {
	const diagnostics: TranslationDiagnostic[] = [];
	const degradations: DegradationRecord[] = [];

	const art = artifact as unknown as KnowledgeArtifact;
	const { format, variant, canonicalSchemaVersion, templates } = context;

	// Resolve body override for gemini-cli harness
	const body = art.bodyOverrides?.["gemini-cli"] ?? art.body;

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

	// Generate GEMINI.md via template
	const geminiContent = templates.render("gemini-cli/gemini.md.njk", {
		artifact: art,
		body,
	});
	outputFiles.push({
		relativePath: "GEMINI.md",
		content: geminiContent,
		executable: false,
	});

	// Generate .gemini/settings.json with mcpServers
	if (art.mcpServers.length > 0) {
		const settings = buildSettingsData(art.mcpServers);
		const settingsContent = templates.render("gemini-cli/settings.json.njk", {
			settings,
		});
		outputFiles.push({
			relativePath: ".gemini/settings.json",
			content: settingsContent,
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
 * Build the .gemini/settings.json data structure for Gemini CLI template
 * rendering. Stdio servers use command/args/env; remote servers use httpUrl
 * (Gemini CLI's streamable-HTTP field).
 */
function buildSettingsData(
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
				httpUrl: server.url,
				...(server.env && Object.keys(server.env).length > 0
					? { env: server.env }
					: {}),
				...(server.timeout ? { timeout: server.timeout } : {}),
			};
		}
	}
	return { mcpServers };
}
