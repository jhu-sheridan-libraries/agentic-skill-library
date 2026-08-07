/**
 * Rosetta Stone — Kiro Skill Pretty-Printer
 *
 * Renders a canonical KnowledgeArtifact back into the kiro-skill source format:
 * - `SKILL.md` with YAML frontmatter (name, description, keywords)
 * - `references/*.md` from workflows
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
import { codePointCompare } from "../../contracts";
import { renderDeterministicYaml } from "../../canonical";
import type { SourcePrintOutput, SourceTranslatorContext } from "../../registry";

// ═══════════════════════════════════════════════════════════════════════════════
// Pretty-Printer
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Pretty-print a canonical KnowledgeArtifact into kiro-skill source format.
 *
 * Produces:
 * - `SKILL.md` with frontmatter: name, description, keywords
 * - `references/*.md` from workflows
 */
export function prettyPrintKiroSkill(
	artifact: Record<string, unknown>,
	_context: SourceTranslatorContext,
): SourcePrintOutput {
	const diagnostics: TranslationDiagnostic[] = [];
	const documents: SourceDocument[] = [];

	const fm = (artifact.frontmatter ?? {}) as Record<string, unknown>;
	const body = (artifact.body as string) ?? "";
	const workflows = (artifact.workflows as Array<{ name: string; filename: string; content: string }>) ?? [];

	// Build SKILL.md frontmatter
	const skillFm: Record<string, unknown> = {};

	if (fm.name) skillFm.name = fm.name;
	if (fm.description) skillFm.description = fm.description;
	if (Array.isArray(fm.keywords) && fm.keywords.length > 0) {
		skillFm.keywords = fm.keywords;
	}

	// Render SKILL.md
	const SKILL_KEY_ORDER = ["name", "description", "keywords"];
	const frontmatterYaml = renderDeterministicYaml(skillFm, SKILL_KEY_ORDER);
	const skillContent = `---\n${frontmatterYaml}---\n${body}\n`;

	documents.push({
		path: "SKILL.md" as NormalizedRelativePath,
		content: skillContent,
		executable: false,
	});

	// Render references/*.md from workflows
	const sortedWorkflows = [...workflows].sort((a, b) =>
		codePointCompare(a.filename, b.filename),
	);

	for (const wf of sortedWorkflows) {
		documents.push({
			path: `references/${wf.filename}` as NormalizedRelativePath,
			content: `${wf.content}\n`,
			executable: false,
		});
	}

	return { documents, diagnostics };
}
