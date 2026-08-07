/**
 * Rosetta Stone — Windsurf Target Translator
 *
 * Translates a canonical KnowledgeArtifact into Windsurf's native output
 * format (.windsurf/rules/<name>.md).
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
// Windsurf Target Translator
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Translate a canonical artifact into Windsurf-native output files.
 *
 * Produces .windsurf/rules/<artifact-name>.md
 */
export function translateWindsurfTarget(
	artifact: Record<string, unknown>,
	context: TargetTranslatorContext,
): TargetTranslationOutput {
	const diagnostics: TranslationDiagnostic[] = [];
	const degradations: DegradationRecord[] = [];

	const art = artifact as unknown as KnowledgeArtifact;
	const { format, variant, canonicalSchemaVersion, templates } = context;

	// Resolve body override for windsurf harness
	const body = art.bodyOverrides?.windsurf ?? art.body;

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

	const content = templates.render("windsurf/rule.md.njk", {
		artifact: art,
		body,
	});
	outputFiles.push({
		relativePath: `.windsurf/rules/${art.name}.md`,
		content,
		executable: false,
	});

	// Sort output files deterministically by path
	outputFiles.sort((a, b) => codePointCompare(a.relativePath, b.relativePath));

	const plan = createPlan(format.id, canonicalSchemaVersion, outputFiles, {
		variant,
	});

	return { plan, diagnostics, degradations };
}
