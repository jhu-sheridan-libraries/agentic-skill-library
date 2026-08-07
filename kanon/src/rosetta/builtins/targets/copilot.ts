/**
 * Rosetta Stone — Copilot Target Translator
 *
 * Translates a canonical KnowledgeArtifact into GitHub Copilot's native output
 * format (.github/copilot-instructions.md or agent file per variant).
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - Pure function only
 *
 * Requirements: 6.1, 6.5, 6.6, 12.2, 12.5, 13.8
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
import { codePointCompare } from "../../contracts";
import { createPlan } from "../../plan";
import type {
	TargetTranslationOutput,
	TargetTranslatorContext,
} from "../../registry";

// ═══════════════════════════════════════════════════════════════════════════════
// Copilot Target Translator
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Translate a canonical artifact into Copilot-native output files.
 *
 * Supports variants:
 * - "instructions" (default): .github/copilot-instructions.md
 * - "agent": AGENTS.md
 */
export function translateCopilotTarget(
	artifact: Record<string, unknown>,
	context: TargetTranslatorContext,
): TargetTranslationOutput {
	const diagnostics: TranslationDiagnostic[] = [];
	const degradations: DegradationRecord[] = [];

	const art = artifact as unknown as KnowledgeArtifact;
	const { format, variant, canonicalSchemaVersion, templates } = context;

	// Resolve body override for copilot harness
	const body = art.bodyOverrides?.copilot ?? art.body;

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

	if (variant === "agent") {
		// Agent variant: AGENTS.md
		const content = templates.render("copilot/agents.md.njk", {
			artifact: art,
			body,
		});
		outputFiles.push({
			relativePath: "AGENTS.md",
			content,
			executable: false,
		});
	} else {
		// Default "instructions" variant: .github/copilot-instructions.md
		const content = templates.render("copilot/instructions.md.njk", {
			artifact: art,
			body,
		});
		outputFiles.push({
			relativePath: ".github/copilot-instructions.md",
			content,
			executable: false,
		});
	}

	// Sort output files deterministically by path
	outputFiles.sort((a, b) => codePointCompare(a.relativePath, b.relativePath));

	const plan = createPlan(format.id, canonicalSchemaVersion, outputFiles, {
		variant,
	});

	return { plan, diagnostics, degradations };
}
