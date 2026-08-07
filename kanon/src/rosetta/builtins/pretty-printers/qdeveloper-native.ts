/**
 * Rosetta Stone — Q Developer Native Pretty-Printer
 *
 * Renders a canonical KnowledgeArtifact back into Q Developer native format:
 * - `.qdeveloper/rules/<name>.md` with body content
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
 * Pretty-print a canonical KnowledgeArtifact into Q Developer native format.
 *
 * Produces:
 * - `.qdeveloper/rules/<name>.md` with the artifact body
 */
export function prettyPrintQDeveloperNative(
	artifact: Record<string, unknown>,
	_context: SourceTranslatorContext,
): SourcePrintOutput {
	const diagnostics: TranslationDiagnostic[] = [];
	const documents: SourceDocument[] = [];

	const body = (artifact.body as string) ?? "";
	const name = (artifact.name as string) ?? "rule";

	documents.push({
		path: `.qdeveloper/rules/${name}.md` as NormalizedRelativePath,
		content: `${body}\n`,
		executable: false,
	});

	return { documents, diagnostics };
}
