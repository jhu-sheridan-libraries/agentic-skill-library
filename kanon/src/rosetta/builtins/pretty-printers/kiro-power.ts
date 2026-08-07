/**
 * Rosetta Stone — Kiro Power Pretty-Printer
 *
 * Renders a canonical KnowledgeArtifact back into the kiro-power source format:
 * - `POWER.md` with YAML frontmatter (name, description, keywords, globs, alwaysApply)
 * - `steering/*.md` from workflows
 *
 * CONSTRAINTS:
 * - NO filesystem, process, clock, random, Git, or network imports
 * - Pure function only
 *
 * Requirements: 5.4, 12.4, 16.2
 */

import type {
	NormalizedRelativePath,
	SourceDocument,
	TranslationDiagnostic,
} from "../../../schemas";
import { renderDeterministicYaml } from "../../canonical";
import { codePointCompare } from "../../contracts";
import type {
	SourcePrintOutput,
	SourceTranslatorContext,
} from "../../registry";

// ═══════════════════════════════════════════════════════════════════════════════
// Pretty-Printer
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Pretty-print a canonical KnowledgeArtifact into kiro-power source format.
 *
 * Produces:
 * - `POWER.md` with frontmatter: name, description, keywords, globs (from file_patterns),
 *   alwaysApply (from inclusion)
 * - `steering/*.md` from workflows
 */
export function prettyPrintKiroPower(
	artifact: Record<string, unknown>,
	_context: SourceTranslatorContext,
): SourcePrintOutput {
	const diagnostics: TranslationDiagnostic[] = [];
	const documents: SourceDocument[] = [];

	const fm = (artifact.frontmatter ?? {}) as Record<string, unknown>;
	const body = (artifact.body as string) ?? "";
	const workflows =
		(artifact.workflows as Array<{
			name: string;
			filename: string;
			content: string;
		}>) ?? [];

	// Build POWER.md frontmatter
	const powerFm: Record<string, unknown> = {};

	if (fm.name) powerFm.name = fm.name;
	if (fm.description) powerFm.description = fm.description;
	if (Array.isArray(fm.keywords) && fm.keywords.length > 0) {
		powerFm.keywords = fm.keywords;
	}

	// Map file_patterns → globs
	if (Array.isArray(fm.file_patterns) && fm.file_patterns.length > 0) {
		powerFm.globs = fm.file_patterns;
	}

	// Map inclusion → alwaysApply
	if (fm.inclusion === "always") {
		powerFm.alwaysApply = true;
	} else if (fm.inclusion && fm.inclusion !== "manual") {
		powerFm.inclusion = fm.inclusion;
	}

	// Render POWER.md
	const POWER_KEY_ORDER = [
		"name",
		"description",
		"keywords",
		"globs",
		"alwaysApply",
		"inclusion",
	];
	const frontmatterYaml = renderDeterministicYaml(powerFm, POWER_KEY_ORDER);
	const powerContent = `---\n${frontmatterYaml}---\n${body}\n`;

	documents.push({
		path: "POWER.md" as NormalizedRelativePath,
		content: powerContent,
		executable: false,
	});

	// Render steering/*.md from workflows
	const sortedWorkflows = [...workflows].sort((a, b) =>
		codePointCompare(a.filename, b.filename),
	);

	for (const wf of sortedWorkflows) {
		documents.push({
			path: `steering/${wf.filename}` as NormalizedRelativePath,
			content: `${wf.content}\n`,
			executable: false,
		});
	}

	return { documents, diagnostics };
}
