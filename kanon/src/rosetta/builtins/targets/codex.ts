/**
 * Rosetta Stone — Codex Target Translator
 *
 * Wraps the existing codex adapter logic with resolved variants, body overrides,
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
	McpServerDefinition,
	OutputFile,
	TranslationDiagnostic,
} from "../../../schemas";
import { isStdioServer } from "../../../schemas";
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
// Codex Target Translator
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Translate a canonical KnowledgeArtifact into Codex harness-native output.
 *
 * Handles `agents-md` and `skill` variants:
 * - agents-md: produces a repo-wide AGENTS.md with full body
 * - skill: produces .codex/skills/<name>/SKILL.md with references and an
 *   AGENTS.md pointer
 *
 * Applies body overrides for "codex" harness when available.
 */
export function translateCodexTarget(
	artifact: Record<string, unknown>,
	context: TargetTranslatorContext,
): TargetTranslationOutput {
	const diagnostics: TranslationDiagnostic[] = [];
	const degradations: DegradationRecord[] = [];

	const art = artifact as unknown as KnowledgeArtifact;
	const { format, variant, canonicalSchemaVersion, templates } = context;

	// Resolve body override for codex harness
	const body = art.bodyOverrides?.codex ?? art.body;

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

	// Collect degraded sections for inline rendering
	const degradedSections: string[] = [];
	for (const deg of degradations) {
		if (deg.action === "inline") {
			degradedSections.push(
				`<!-- Degraded: ${deg.capability} (${deg.affectedValueCount} value(s) affected) -->`,
			);
		}
	}

	// Render output files
	const outputFiles: OutputFile[] = [];
	const skillName = art.name;

	const renderContext = {
		artifact: art,
		body,
		degradedSections,
	};

	if (variant === "skill") {
		// Native Codex skill discovery path + AGENTS.md pointer
		const skillContent = templates.render("codex/skill.md.njk", renderContext);
		outputFiles.push({
			relativePath: `.codex/skills/${skillName}/SKILL.md`,
			content: skillContent,
			executable: false,
		});

		// Workflow phase files under references/
		for (const wf of art.workflows) {
			outputFiles.push({
				relativePath: `.codex/skills/${skillName}/references/${wf.filename}`,
				content: wf.content,
				executable: false,
			});
		}

		// AGENTS.md pointer
		const pointerContent = templates.render(
			"codex/agents-pointer.md.njk",
			renderContext,
		);
		outputFiles.push({
			relativePath: "AGENTS.md",
			content: pointerContent,
			executable: false,
		});
	} else {
		// "agents-md" variant (default): repo-wide AGENTS.md with full body
		const agentsContent = templates.render(
			"codex/agents-md.md.njk",
			renderContext,
		);
		outputFiles.push({
			relativePath: "AGENTS.md",
			content: agentsContent,
			executable: false,
		});
	}

	// MCP servers → .codex/config.toml
	if (art.mcpServers.length > 0) {
		const tomlContent = buildCodexMcpToml(art.mcpServers);
		outputFiles.push({
			relativePath: ".codex/config.toml",
			content: tomlContent,
			executable: false,
		});
	}

	// Hooks diagnostic — Codex has no declarative hook system
	if (art.hooks.length > 0) {
		diagnostics.push(
			createDiagnostic("RS_COMPATIBILITY_NONE", {
				formatId: format.id,
				message:
					"Codex has no declarative event-hook system; hook definitions are omitted.",
				remediation:
					"Implement hooks as manual guidance or shell scripts for Codex environments.",
				canonical: {
					artifactName: art.name,
					fieldPath: "hooks",
				},
			}),
		);
	}

	// Build plan deterministically
	const plan = createPlan(format.id, canonicalSchemaVersion, outputFiles, {
		variant,
	});

	return { plan, diagnostics, degradations };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Internal Helpers — TOML Generation
// ═══════════════════════════════════════════════════════════════════════════════

/** TOML string literal — escape backslashes and double quotes. */
function tomlString(value: string): string {
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** TOML dotted-table key segment. */
function tomlKey(value: string): string {
	return /^[A-Za-z0-9_-]+$/.test(value) ? value : tomlString(value);
}

/** TOML inline array of strings. */
function tomlStringArray(values: string[]): string {
	return `[${values.map((v) => tomlString(v)).join(", ")}]`;
}

/** TOML inline table of string env vars. */
function tomlEnvTable(env: Record<string, string>): string {
	const pairs = Object.entries(env).map(([k, v]) => `${k} = ${tomlString(v)}`);
	return `{ ${pairs.join(", ")} }`;
}

/**
 * Serialize canonical MCP server definitions into Codex `config.toml` form.
 * Codex registers servers under `[mcp_servers.<name>]` tables.
 */
function buildCodexMcpToml(servers: McpServerDefinition[]): string {
	const blocks: string[] = [
		"# Generated by Kanon — merge into ~/.codex/config.toml or .codex/config.toml",
	];
	for (const server of servers) {
		const lines = [`[mcp_servers.${tomlKey(server.name)}]`];
		if (isStdioServer(server)) {
			lines.push(`command = ${tomlString(server.command)}`);
			if (server.args.length > 0) {
				lines.push(`args = ${tomlStringArray(server.args)}`);
			}
			if (Object.keys(server.env).length > 0) {
				lines.push(`env = ${tomlEnvTable(server.env)}`);
			}
		} else {
			// URL-based (SSE / streamable HTTP) servers.
			lines.push(`url = ${tomlString(server.url)}`);
			if (server.env && Object.keys(server.env).length > 0) {
				lines.push(`env = ${tomlEnvTable(server.env)}`);
			}
		}
		if (server.timeout) {
			lines.push(`startup_timeout_ms = ${server.timeout}`);
		}
		blocks.push(lines.join("\n"));
	}
	return `${blocks.join("\n\n")}\n`;
}
