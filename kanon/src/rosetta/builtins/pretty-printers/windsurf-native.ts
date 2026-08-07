/**
 * Rosetta Stone — Windsurf Native Pretty-Printer
 *
 * Renders a canonical KnowledgeArtifact back into Windsurf native format:
 * - `.windsurfrules` with body content
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
import type {
	SourcePrintOutput,
	SourceTranslatorContext,
} from "../../registry";

// ═══════════════════════════════════════════════════════════════════════════════
// Pretty-Printer
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Pretty-print a canonical KnowledgeArtifact into Windsurf native format.
 *
 * Produces:
 * - `.windsurfrules` with the artifact body
 */
export function prettyPrintWindsurfNative(
	artifact: Record<string, unknown>,
	_context: SourceTranslatorContext,
): SourcePrintOutput {
	const diagnostics: TranslationDiagnostic[] = [];
	const documents: SourceDocument[] = [];

	const body = (artifact.body as string) ?? "";

	documents.push({
		path: ".windsurfrules" as NormalizedRelativePath,
		content: `${body}\n`,
		executable: false,
	});

	return { documents, diagnostics };
}
