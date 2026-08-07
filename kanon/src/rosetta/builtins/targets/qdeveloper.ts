/**
 * Rosetta Stone — Q Developer Target Translator
 *
 * Translates a canonical KnowledgeArtifact into Amazon Q Developer's native
 * output format (.qdeveloper/rules/<name>.md or agent files).
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
// Q Developer Target Translator
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Translate a canonical artifact into Q Developer-native output files.
 *
 * Supports variants:
 * - "rule" (default): .qdeveloper/rules/<artifact-name>.md
 * - "agent": .qdeveloper/agents/<artifact-name>.md
 */
export function translateQDeveloperTarget(
	artifact: Record<string, unknown>,
	context: TargetTranslatorContext,
): TargetTranslationOutput {
	const diagnostics: TranslationDiagnostic[] = [];
	const degradations: DegradationRecord[] = [];

	const art = artifact as unknown as KnowledgeArtifact;
	const { format, variant, canonicalSchemaVersion, templates } = context;

	// Resolve body override for qdeveloper harness
	const body = art.bodyOverrides?.qdeveloper ?? art.body;

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
		// Agent variant: .qdeveloper/agents/<name>.md
		const content = templates.render("qdeveloper/agent.md.njk", {
			artifact: art,
			body,
		});
		outputFiles.push({
			relativePath: `.qdeveloper/agents/${art.name}.md`,
			content,
			executable: false,
		});
	} else {
		// Default "rule" variant: .qdeveloper/rules/<name>.md
		const content = templates.render("qdeveloper/rule.md.njk", {
			artifact: art,
			body,
		});
		outputFiles.push({
			relativePath: `.qdeveloper/rules/${art.name}.md`,
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
