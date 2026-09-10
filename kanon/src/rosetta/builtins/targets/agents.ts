/**
 * Rosetta Stone — Vendor-Neutral AGENTS.md Target Translator
 *
 * Emits a single root `AGENTS.md` from a canonical KnowledgeArtifact, following
 * the vendor-neutral AGENTS.md open standard. Unlike the Codex target, this
 * translator produces NO tool-specific sidecar files (no `.codex/`, no MCP
 * config): the AGENTS.md standard defines only the Markdown file itself.
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - Pure function only
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
// AGENTS.md Target Translator
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Translate a canonical KnowledgeArtifact into a vendor-neutral AGENTS.md file.
 *
 * Produces a repo-wide `AGENTS.md` containing the full body. MCP servers and
 * hooks are not part of the AGENTS.md standard, so they are reported as
 * diagnostics rather than emitted as sidecar files.
 */
export function translateAgentsTarget(
	artifact: Record<string, unknown>,
	context: TargetTranslatorContext,
): TargetTranslationOutput {
	const diagnostics: TranslationDiagnostic[] = [];
	const degradations: DegradationRecord[] = [];

	const art = artifact as unknown as KnowledgeArtifact;
	const { format, variant, canonicalSchemaVersion, templates } = context;

	// Resolve body override for the agents harness when available.
	const body = art.bodyOverrides?.agents ?? art.body;

	// Evaluate compatibility.
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

	// Collect degraded sections for inline rendering.
	const degradedSections: string[] = [];
	for (const deg of degradations) {
		if (deg.action === "inline") {
			degradedSections.push(
				`<!-- Degraded: ${deg.capability} (${deg.affectedValueCount} value(s) affected) -->`,
			);
		}
	}

	const outputFiles: OutputFile[] = [];

	const renderContext = {
		artifact: art,
		body,
		degradedSections,
	};

	// Single root AGENTS.md with the full body.
	const agentsContent = templates.render(
		"agents/agents-md.md.njk",
		renderContext,
	);
	outputFiles.push({
		relativePath: "AGENTS.md",
		content: agentsContent,
		executable: false,
	});

	// MCP servers are not part of the AGENTS.md standard.
	if (art.mcpServers.length > 0) {
		diagnostics.push(
			createDiagnostic("RS_COMPATIBILITY_NONE", {
				formatId: format.id,
				message:
					"The vendor-neutral AGENTS.md standard defines no MCP configuration; MCP server definitions are omitted.",
				remediation:
					"Configure MCP servers via each consuming tool's own configuration.",
				canonical: {
					artifactName: art.name,
					fieldPath: "mcpServers",
				},
			}),
		);
	}

	// Hooks are not part of the AGENTS.md standard.
	if (art.hooks.length > 0) {
		diagnostics.push(
			createDiagnostic("RS_COMPATIBILITY_NONE", {
				formatId: format.id,
				message:
					"The vendor-neutral AGENTS.md standard has no declarative hook system; hook definitions are omitted.",
				remediation:
					"Implement hooks via each consuming tool's own mechanism, or as manual guidance.",
				canonical: {
					artifactName: art.name,
					fieldPath: "hooks",
				},
			}),
		);
	}

	// Build plan deterministically.
	const plan = createPlan(format.id, canonicalSchemaVersion, outputFiles, {
		variant,
	});

	return { plan, diagnostics, degradations };
}
